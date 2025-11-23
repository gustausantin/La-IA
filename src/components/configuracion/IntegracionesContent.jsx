// IntegracionesContent.jsx - Configuración de Integraciones Externas
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import {
    Calendar as CalendarIcon,
    Check,
    X,
    RefreshCw,
    AlertCircle,
    ExternalLink,
    Settings,
    Zap,
    Link as LinkIcon
} from 'lucide-react';
import GoogleCalendarImportModal from './GoogleCalendarImportModal';
import GoogleCalendarSelector from './GoogleCalendarSelector';
import ResourceCalendarLinker from './ResourceCalendarLinker';
import EmployeeCalendarLinker from './EmployeeCalendarLinker';
import UnassignedAppointmentsReview from './UnassignedAppointmentsReview';
import CalendarMappingTypeSelector from './CalendarMappingTypeSelector';
import GoogleCalendarConflictModal from './GoogleCalendarConflictModal';

export default function IntegracionesContent() {
    const { businessId, business } = useAuthContext();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
    const [googleCalendarConfig, setGoogleCalendarConfig] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showCalendarSelector, setShowCalendarSelector] = useState(false);
    const [unassignedAppointments, setUnassignedAppointments] = useState([]); // ✅ FASE 2: Eventos sin asignar
    const [mappingType, setMappingType] = useState(null); // ✅ 'employee' | 'resource' | null
    const [conflicts, setConflicts] = useState(null); // ✅ Conflictos detectados
    const [conflictEvents, setConflictEvents] = useState([]); // ✅ Eventos con conflictos
    const [showDisconnectModal, setShowDisconnectModal] = useState(false); // ✅ Modal de confirmación de desconexión
    const [disconnectStats, setDisconnectStats] = useState(null); // ✅ Estadísticas para el modal

    // Cargar configuración de integraciones
    useEffect(() => {
        if (businessId) {
            loadIntegrationsConfig();
        }
    }, [businessId]);

    // Recargar cuando se vuelve de OAuth (detectar parámetros en URL)
    useEffect(() => {
        if (!businessId) return;
        
        const integration = searchParams.get('integration');
        const status = searchParams.get('status');
        
        // Si viene de un redirect de OAuth exitoso, recargar la configuración
        if (integration === 'google_calendar' && status === 'success') {
            console.log('🔄 Recargando configuración después de OAuth exitoso...');
            // Pequeño delay para asegurar que la Edge Function haya guardado los datos
            const timeoutId = setTimeout(async () => {
                await loadIntegrationsConfig();
                
                // ✅ Configurar notificaciones push automáticas (webhooks)
                try {
                    console.log('🔔 Configurando notificaciones push de Google Calendar...');
                    const { error: watchError } = await supabase.functions.invoke('setup-google-calendar-watch', {
                        body: {
                            business_id: businessId
                        }
                    });
                    
                    if (watchError) {
                        console.warn('⚠️ Error configurando watch (se puede configurar manualmente después):', watchError);
                        // No bloquear el flujo si falla el watch
                    } else {
                        console.log('✅ Notificaciones push configuradas - Los cambios en Google Calendar se sincronizarán automáticamente');
                    }
                } catch (watchError) {
                    console.warn('⚠️ Error configurando watch:', watchError);
                    // Continuar de todas formas
                }
                
                // ✅ Limpiar parámetros OAuth pero PRESERVAR tab=integraciones
                const url = new URL(window.location.href);
                url.searchParams.delete('integration');
                url.searchParams.delete('status');
                url.searchParams.delete('message');
                // ✅ Asegurar que tab=integraciones esté presente
                if (!url.searchParams.has('tab')) {
                    url.searchParams.set('tab', 'integraciones');
                }
                window.history.replaceState({}, '', url.toString());
                
                // Verificar si es primera conexión después de cargar la configuración
                // Esperar un poco para que el estado se actualice
                setTimeout(() => {
                    // Leer directamente de la base de datos para obtener el estado actualizado
                    supabase
                        .from('integrations')
                        .select('config')
                        .eq('business_id', businessId)
                        .eq('provider', 'google_calendar')
                        .maybeSingle()
                        .then(async ({ data: integrationData }) => {
                            const hasImported = integrationData?.config?.initial_import_completed;
                            const isActive = integrationData?.is_active;
                            const calendarSelected = integrationData?.config?.calendar_selection_completed;
                            
                            // Si no hay calendario seleccionado, mostrar selector primero
                            if (!calendarSelected && isActive) {
                                console.log('📅 Primera conexión detectada - Mostrando selector de calendarios');
                                setShowCalendarSelector(true);
                            } else if (!hasImported && isActive) {
                                console.log('📥 Calendario seleccionado - Verificando conflictos antes de importar...');
                                
                                // 🚨 DETECTAR CONFLICTOS antes de ofrecer importación
                                const conflictResult = await detectConflicts();
                                
                                if (conflictResult.hasConflicts) {
                                    console.log('⚠️ Conflictos detectados en primera conexión');
                                    setConflicts(conflictResult.conflicts);
                                    setConflictEvents(conflictResult.events);
                                    toast.warning(`⚠️ Se encontraron ${conflictResult.conflicts.length} conflicto(s) con reservas existentes.`, {
                                        duration: 6000
                                    });
                                } else {
                                    console.log('✅ No hay conflictos - Mostrando modal de importación');
                                    setShowImportModal(true);
                                }
                            }
                        });
                }, 800);
            }, 1500);
            
            return () => clearTimeout(timeoutId);
        }
    }, [businessId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

    // 🚨 Función para detectar conflictos entre Google Calendar y appointments existentes
    const detectConflicts = async () => {
        try {
            console.log('🔍 Detectando conflictos entre Google Calendar y LA-IA...');
            
            // 1. Obtener eventos de Google Calendar
            const { data: gcalData, error: gcalError } = await supabase.functions.invoke('sync-google-calendar', {
                body: {
                    business_id: businessId,
                    action: 'list' // Solo listar, no sincronizar
                }
            });

            if (gcalError) {
                console.warn('⚠️ No se pudieron obtener eventos de Google Calendar:', gcalError);
                return { hasConflicts: false, conflicts: [], events: [] };
            }

            const gcalEvents = gcalData?.events || [];
            console.log(`📅 Eventos de Google Calendar: ${gcalEvents.length}`);

            if (gcalEvents.length === 0) {
                return { hasConflicts: false, conflicts: [], events: [] };
            }

            // 2. Obtener appointments existentes de LA-IA
            const { data: appointments, error: apptError } = await supabase
                .from('appointments')
                .select('id, customer_name, appointment_date, appointment_time, status, duration_minutes')
                .eq('business_id', businessId)
                .in('status', ['confirmed', 'pending'])
                .gte('appointment_date', new Date().toISOString().split('T')[0]); // Solo futuros

            if (apptError) {
                console.error('❌ Error obteniendo appointments:', apptError);
                throw apptError;
            }

            console.log(`📋 Appointments de LA-IA: ${appointments?.length || 0}`);

            if (!appointments || appointments.length === 0) {
                return { hasConflicts: false, conflicts: [], events: gcalEvents };
            }

            // 3. Detectar solapamientos
            const conflicts = [];
            
            for (const gcalEvent of gcalEvents) {
                const gcalStart = new Date(gcalEvent.start.dateTime || gcalEvent.start.date);
                const gcalEnd = new Date(gcalEvent.end.dateTime || gcalEvent.end.date);
                
                // Verificar contra cada appointment
                for (const appt of appointments) {
                    const apptDateTime = new Date(`${appt.appointment_date}T${appt.appointment_time}`);
                    const apptDuration = appt.duration_minutes || 60;
                    const apptEnd = new Date(apptDateTime.getTime() + apptDuration * 60000);
                    
                    // Detectar solapamiento: (start1 < end2) && (end1 > start2)
                    const overlaps = (gcalStart < apptEnd) && (gcalEnd > apptDateTime);
                    
                    if (overlaps) {
                        conflicts.push({
                            gcal_event_id: gcalEvent.id,
                            gcal_summary: gcalEvent.summary,
                            gcal_start: gcalEvent.start.dateTime || gcalEvent.start.date,
                            gcal_end: gcalEvent.end.dateTime || gcalEvent.end.date,
                            existing_appointment_id: appt.id,
                            existing_customer_name: appt.customer_name,
                            existing_appointment_date: appt.appointment_date,
                            existing_appointment_time: appt.appointment_time,
                            existing_status: appt.status
                        });
                        
                        console.log('⚠️ Conflicto detectado:', {
                            gcal: gcalEvent.summary,
                            laia: appt.customer_name,
                            fecha: appt.appointment_date
                        });
                    }
                }
            }

            console.log(`🚨 Total de conflictos detectados: ${conflicts.length}`);

            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                events: gcalEvents
            };

        } catch (error) {
            console.error('❌ Error detectando conflictos:', error);
            return { hasConflicts: false, conflicts: [], events: [] };
        }
    };

    const loadIntegrationsConfig = async () => {
        try {
            setLoading(true);
            console.log('🔍 Cargando configuración de integraciones para business_id:', businessId);
            
            // Buscar configuración de Google Calendar con timeout
            const queryPromise = supabase
                .from('integrations')
                .select('*')
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar')
                .maybeSingle();
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT')), 5000)
            );
            
            const result = await Promise.race([queryPromise, timeoutPromise]);
            const { data, error } = result;

            if (error) {
                // Log del error para debugging
                console.error('❌ Error cargando integraciones:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                console.error('Error details:', error.details);
                
                // Si es un error 406, puede ser un problema de RLS o headers
                if (error.code === 'PGRST301' || error.message?.includes('406')) {
                    console.error('⚠️ Error 406: Problema con políticas RLS o headers. Verifica las políticas de la tabla integrations.');
                    toast.error('Error de permisos. Por favor, recarga la página.');
                }
                
                // No lanzar error, solo mostrar como desconectado
                setGoogleCalendarConnected(false);
                setGoogleCalendarConfig(null);
                return;
            }

            if (data) {
                // ✅ LÓGICA CLARA: Está conectado SOLO si:
                // 1. Tiene tokens (access_token Y refresh_token)
                // 2. is_active = true (CRÍTICO: si es false, NO está conectado)
                // 3. status = 'active' (no 'disconnected' ni otro valor)
                // 4. Token no expirado
                const hasTokens = !!(data.access_token || data.credentials?.access_token);
                const isActive = data.is_active === true; // ✅ CRÍTICO: debe ser explícitamente true
                const statusActive = data.status === 'active'; // No 'disconnected' ni null
                const notExpired = !data.token_expires_at || new Date(data.token_expires_at) > new Date();
                
                // ✅ Está conectado SOLO si TODAS las condiciones se cumplen
                // Si is_active = false, NO está conectado, sin importar los tokens
                const isConnected = hasTokens && isActive && statusActive && notExpired;
                
                setGoogleCalendarConnected(isConnected);
                setGoogleCalendarConfig(data);
                
                console.log('✅ Integración cargada:', {
                    id: data.id,
                    business_id: data.business_id,
                    provider: data.provider,
                    is_active: data.is_active,
                    status: data.status,
                    has_tokens: hasTokens,
                    not_expired: notExpired,
                    connected: isConnected,
                    token_expires_at: data.token_expires_at,
                    initial_import_completed: data.config?.initial_import_completed,
                    calendar_selection_completed: data.config?.calendar_selection_completed,
                    config: data.config,
                    reason: !isConnected ? (
                        !hasTokens ? 'Sin tokens' :
                        !isActive ? 'is_active = false' :
                        !statusActive ? `status = '${data.status}' (no 'active')` :
                        'Token expirado'
                    ) : 'Todas las condiciones OK'
                });
            } else {
                // No hay integración configurada aún
                setGoogleCalendarConnected(false);
                setGoogleCalendarConfig(null);
                console.log('ℹ️ No hay integración de Google Calendar configurada para este negocio');
            }
        } catch (error) {
            console.error('❌ Error cargando integraciones:', error);
            if (error.message === 'TIMEOUT') {
                console.error('⏱️ Timeout cargando integraciones - puede ser problema de RLS');
                toast.error('Timeout cargando integraciones. Verifica políticas RLS.');
            }
            setGoogleCalendarConnected(false);
            setGoogleCalendarConfig(null);
        } finally {
            setLoading(false);
        }
    };

    // Conectar con Google Calendar
    const handleConnectGoogleCalendar = async () => {
        try {
            setLoading(true);
            toast.loading('Conectando con Google Calendar...', { id: 'google-connect' });

            // PASO 1: Redirigir a OAuth2 de Google
            // Construir URI de redirección - Usar la Edge Function de Supabase
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            
            if (!clientId) {
                throw new Error('Google Client ID no configurado. Contacta al administrador.');
            }

            if (!supabaseUrl) {
                throw new Error('Supabase URL no configurado. Contacta al administrador.');
            }

            // ✅ CRÍTICO: Usar el redirect_uri EXACTO que está registrado en Google Cloud Console
            // Este URI DEBE coincidir exactamente con el que está en Google Cloud Console
            // IMPORTANTE: Sin espacios, sin trailing slashes, exactamente como está en Google Cloud Console
            const expectedRedirectUri = 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM';
            
            // ✅ Limpiar URI: eliminar espacios, trailing slashes, y caracteres invisibles
            const cleanRedirectUri = expectedRedirectUri.trim().replace(/\s+/g, '').replace(/\/$/, '');
            
            // ✅ Verificación crítica: mostrar el URI exacto que se enviará
            console.log('🔍 VERIFICACIÓN DE REDIRECT_URI:');
            console.log('  - URI esperado (de Google Cloud Console):');
            console.log('    ', expectedRedirectUri);
            console.log('  - URI limpio (que se enviará):');
            console.log('    ', cleanRedirectUri);
            console.log('  - Longitud esperada:', expectedRedirectUri.length);
            console.log('  - Longitud obtenida:', cleanRedirectUri.length);
            console.log('  - ¿Coinciden?', expectedRedirectUri === cleanRedirectUri ? '✅ SÍ' : '❌ NO');
            
            if (expectedRedirectUri !== cleanRedirectUri) {
                console.error('❌ ERROR: El URI no coincide!');
                console.error('  Diferencia en caracteres:');
                for (let i = 0; i < Math.max(expectedRedirectUri.length, cleanRedirectUri.length); i++) {
                    if (expectedRedirectUri[i] !== cleanRedirectUri[i]) {
                        console.error(`    Posición ${i}: esperado "${expectedRedirectUri[i]}" (charCode: ${expectedRedirectUri.charCodeAt(i)}), obtenido "${cleanRedirectUri[i]}" (charCode: ${cleanRedirectUri.charCodeAt(i)})`);
                        break;
                    }
                }
            }

            const scopes = [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
            ].join(' ');

            // ✅ Codificar el redirect_uri para la URL de autorización
            const encodedRedirectUri = encodeURIComponent(cleanRedirectUri);
            
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${clientId}` +
                `&redirect_uri=${encodedRedirectUri}` +
                `&response_type=code` +
                `&scope=${encodeURIComponent(scopes)}` +
                `&access_type=offline` +
                `&prompt=consent` +
                `&state=${businessId}`; // Pasar businessId como state

            // ✅ DEBUG: Mostrar información completa de la petición OAuth
            console.log('');
            console.log('🔍 INFORMACIÓN COMPLETA DE OAUTH:');
            console.log('  - Client ID:', clientId);
            console.log('  - Redirect URI (SIN codificar - debe estar en Google Cloud Console):');
            console.log('    ', cleanRedirectUri);
            console.log('  - Redirect URI (codificado para URL):');
            console.log('    ', encodedRedirectUri);
            console.log('  - Scopes:', scopes);
            console.log('');
            console.log('⚠️ VERIFICACIÓN CRÍTICA:');
            console.log('  El URI que está en Google Cloud Console DEBE ser EXACTAMENTE:');
            console.log('  ', cleanRedirectUri);
            console.log('  (Sin codificar, sin espacios, sin trailing slash)');
            console.log('');
            console.log('  Si el error persiste, verifica en Google Cloud Console:');
            console.log('  1. Ve a APIs & Services > Credentials');
            console.log('  2. Edita tu OAuth 2.0 Client ID');
            console.log('  3. En "Authorized redirect URIs", copia y pega EXACTAMENTE este URI:');
            console.log('     ', cleanRedirectUri);
            console.log('  4. Guarda los cambios');
            console.log('  5. Espera 1-2 minutos para que se propaguen los cambios');

            // Guardar intento de conexión
            localStorage.setItem('google_calendar_connecting', 'true');
            localStorage.setItem('google_calendar_business_id', businessId);

            toast.dismiss('google-connect');
            
            toast.success('Redirigiendo a Google...', {
                duration: 2000,
                icon: '🔗'
            });

            // Pequeño delay para que el usuario vea el mensaje
            setTimeout(() => {
                window.location.href = authUrl;
            }, 500);

        } catch (error) {
            console.error('Error conectando Google Calendar:', error);
            toast.dismiss('google-connect');
            toast.error('Error: ' + error.message);
            setLoading(false);
        }
    };

    // Obtener estadísticas antes de desconectar
    const getDisconnectStats = async () => {
        try {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

            // 1. Obtener todos los eventos de Google Calendar y filtrar en JavaScript
            const { data: allGcalEvents, error: gcalError } = await supabase
                .from('appointments')
                .select('id, appointment_date, appointment_time')
                .eq('business_id', businessId)
                .eq('source', 'google_calendar');

            if (gcalError) throw gcalError;

            // Filtrar eventos futuros
            const futureGcalEvents = (allGcalEvents || []).filter(event => {
                if (event.appointment_date > today) return true;
                if (event.appointment_date === today && event.appointment_time >= currentTime) return true;
                return false;
            });

            // Filtrar eventos pasados
            const pastGcalEvents = (allGcalEvents || []).filter(event => {
                if (event.appointment_date < today) return true;
                if (event.appointment_date === today && event.appointment_time < currentTime) return true;
                return false;
            });

            // 2. Contar eventos de LA-IA que fueron sincronizados (tienen gcal_event_id)
            const { data: laiaSyncedEvents, error: laiaError } = await supabase
                .from('appointments')
                .select('id')
                .eq('business_id', businessId)
                .neq('source', 'google_calendar')
                .not('gcal_event_id', 'is', null);

            if (laiaError) throw laiaError;

            return {
                futureGcalCount: futureGcalEvents.length,
                laiaSyncedCount: laiaSyncedEvents?.length || 0,
                pastGcalCount: pastGcalEvents.length
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return {
                futureGcalCount: 0,
                laiaSyncedCount: 0,
                pastGcalCount: 0
            };
        }
    };

    // Abrir modal de confirmación con estadísticas
    const handleDisconnectClick = async () => {
        setLoading(true);
        try {
            const stats = await getDisconnectStats();
            setDisconnectStats(stats);
            setShowDisconnectModal(true);
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            toast.error('Error al obtener estadísticas');
        } finally {
            setLoading(false);
        }
    };

    // Desconectar Google Calendar (ejecutado después de confirmar en el modal)
    const handleDisconnectGoogleCalendar = async () => {
        try {
            setLoading(true);
            setShowDisconnectModal(false);
            toast.loading('Desconectando Google Calendar...', { id: 'google-disconnect' });

            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

            // ✅ PASO 1: Cancelar webhooks/watch de Google Calendar
            try {
                console.log('🛑 Cancelando webhooks/watch de Google Calendar...');
                const { error: watchError } = await supabase.functions.invoke('stop-google-calendar-watch', {
                    body: {
                        business_id: businessId
                    }
                });
                
                if (watchError) {
                    console.warn('⚠️ Error cancelando watch (puede que no exista):', watchError);
                } else {
                    console.log('✅ Webhooks/watch de Google Calendar cancelados');
                }
            } catch (watchError) {
                console.warn('⚠️ Error al intentar cancelar watch:', watchError);
            }

            // ✅ PASO 2: Eliminar eventos futuros de Google Calendar
            console.log('🗑️ Eliminando eventos futuros de Google Calendar...');
            
            // Primero obtener los eventos futuros
            const { data: allGcalEvents, error: fetchError } = await supabase
                .from('appointments')
                .select('id, table_id, appointment_date, appointment_time')
                .eq('business_id', businessId)
                .eq('source', 'google_calendar');

            if (fetchError) throw fetchError;

            // Filtrar eventos futuros en JavaScript
            const futureEvents = (allGcalEvents || []).filter(event => {
                if (event.appointment_date > today) return true;
                if (event.appointment_date === today && event.appointment_time >= currentTime) return true;
                return false;
            });

            // Eliminar eventos futuros
            let deletedFutureEvents = [];
            if (futureEvents.length > 0) {
                const futureEventIds = futureEvents.map(e => e.id);
                const { data: deleted, error: deleteError } = await supabase
                    .from('appointments')
                    .delete()
                    .in('id', futureEventIds)
                    .select('id, table_id, appointment_date, appointment_time');

                if (deleteError) {
                    console.error('❌ Error eliminando eventos futuros:', deleteError);
                } else {
                    deletedFutureEvents = deleted || [];
                    console.log(`✅ ${deletedFutureEvents.length} eventos futuros de Google Calendar eliminados`);
                }
            } else {
                console.log('ℹ️ No hay eventos futuros de Google Calendar para eliminar');
            }

            if (deleteError) {
                console.error('❌ Error eliminando eventos futuros:', deleteError);
            } else {
                console.log(`✅ ${deletedFutureEvents?.length || 0} eventos futuros de Google Calendar eliminados`);
                
                // Liberar availability_slots asociados
                if (deletedFutureEvents && deletedFutureEvents.length > 0) {
                    for (const event of deletedFutureEvents) {
                        if (event.table_id && event.appointment_date && event.appointment_time) {
                            const { error: slotError } = await supabase
                                .from('availability_slots')
                                .update({
                                    status: 'free',
                                    is_available: true,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('table_id', event.table_id)
                                .eq('slot_date', event.appointment_date)
                                .eq('start_time', event.appointment_time);

                            if (slotError) {
                                console.warn(`⚠️ Error liberando slot para evento ${event.id}:`, slotError);
                            }
                        }
                    }
                    console.log('✅ Slots liberados');
                }
            }

            // ✅ PASO 3: Desvincular eventos de LA-IA que fueron sincronizados
            console.log('🔗 Desvinculando eventos de LA-IA sincronizados...');
            const { data: unlinkedEvents, error: unlinkError } = await supabase
                .from('appointments')
                .update({
                    gcal_event_id: null,
                    synced_to_gcal: false,
                    updated_at: new Date().toISOString()
                })
                .eq('business_id', businessId)
                .neq('source', 'google_calendar')
                .not('gcal_event_id', 'is', null)
                .select('id');

            if (unlinkError) {
                console.error('❌ Error desvinculando eventos:', unlinkError);
            } else {
                console.log(`✅ ${unlinkedEvents?.length || 0} eventos de LA-IA desvinculados`);
            }

            // ✅ PASO 4: Limpiar tabla de caché de Google Calendar
            console.log('🧹 Limpiando caché de Google Calendar...');
            const { error: cacheError } = await supabase
                .from('google_calendar_events')
                .delete()
                .eq('business_id', businessId);

            if (cacheError) {
                console.warn('⚠️ Error limpiando caché (puede que la tabla no exista):', cacheError);
            } else {
                console.log('✅ Caché de Google Calendar limpiado');
            }

            // ✅ PASO 5: Marcar integración como inactiva
            const { error } = await supabase
                .from('integrations')
                .update({
                    is_active: false,
                    disconnected_at: new Date().toISOString(),
                    config: {
                        ...googleCalendarConfig.config,
                        watch_channel_id: null,
                        watch_resource_id: null,
                        watch_expiration: null
                    }
                })
                .eq('id', googleCalendarConfig.id);

            if (error) throw error;

            toast.dismiss('google-disconnect');
            
            // Mostrar resumen de lo que se hizo
            const summary = [];
            if (deletedFutureEvents?.length > 0) {
                summary.push(`${deletedFutureEvents.length} citas futuras de Google Calendar eliminadas`);
            }
            if (unlinkedEvents?.length > 0) {
                summary.push(`${unlinkedEvents.length} citas de LA-IA desvinculadas`);
            }
            
            toast.success(
                `✅ Google Calendar desconectado correctamente. ${summary.length > 0 ? summary.join(', ') + '.' : 'Todas las comunicaciones se han detenido.'}`,
                { duration: 5000 }
            );
            
            // ✅ ACTUALIZAR ESTADO INMEDIATAMENTE
            setGoogleCalendarConnected(false);
            setGoogleCalendarConfig(null);
            setDisconnectStats(null);
            
            // Recargar configuración
            await loadIntegrationsConfig();

            console.log('✅ Desconexión completada - Estado actualizado a DESCONECTADO - Sin comunicación con Google Calendar');

        } catch (error) {
            console.error('❌ Error desconectando:', error);
            toast.dismiss('google-disconnect');
            toast.error('Error al desconectar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Probar sincronización con detección de conflictos
    // Sincroniza manualmente las reservas con Google Calendar
    const handleTestSync = async () => {
        try {
            setLoading(true);
            toast.loading('Verificando conflictos...', { id: 'test-sync' });

            // ✅ Verificar que el usuario esté autenticado antes de llamar a la función
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                throw new Error(`Error de autenticación: ${sessionError.message}`);
            }
            
            if (!session) {
                throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
            }

            console.log('✅ Usuario autenticado, detectando conflictos...');

            // 🚨 PASO 1: Detectar conflictos ANTES de sincronizar
            const conflictResult = await detectConflicts();

            toast.dismiss('test-sync');

            // Si hay conflictos, mostrar modal
            if (conflictResult.hasConflicts) {
                console.log('⚠️ Conflictos detectados, mostrando modal...');
                setConflicts(conflictResult.conflicts);
                setConflictEvents(conflictResult.events);
                toast.warning(`⚠️ Se encontraron ${conflictResult.conflicts.length} conflicto(s). Por favor, resuélvelos antes de sincronizar.`, {
                    duration: 5000
                });
                return; // Detener aquí, el usuario debe resolver conflictos
            }

            // Si NO hay conflictos, proceder con sincronización normal
            toast.loading('Sincronizando con Google Calendar...', { id: 'test-sync' });

            const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
                body: {
                    business_id: businessId,
                    action: 'sync' // Sincronizar eventos
                }
            });

            if (error) {
                console.error('❌ Error en sync-google-calendar:', error);
                if (error.message?.includes('authorization') || error.message?.includes('401')) {
                    throw new Error('Error de autenticación. Por favor, recarga la página e intenta nuevamente.');
                }
                throw error;
            }

            toast.dismiss('test-sync');
            
            if (data?.success) {
                toast.success('✅ Sincronización completada sin conflictos', { duration: 3000 });
                await loadIntegrationsConfig();
            } else {
                throw new Error(data?.error || 'Error desconocido');
            }

        } catch (error) {
            console.error('Error en prueba de sincronización:', error);
            toast.dismiss('test-sync');
            
            if (error.message?.includes('CORS') || error.message?.includes('Failed to send')) {
                toast.error('⚠️ La función de sincronización no está desplegada. Por favor, despliega la Edge Function sync-google-calendar.', {
                    duration: 7000
                });
            } else {
                toast.error('Error en la sincronización: ' + (error.message || 'Error desconocido'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-purple-600" />
                    Integraciones
                </h2>
                <p className="text-gray-600 mt-1">
                    Conecta LA-IA con tus herramientas favoritas
                </p>
            </div>

            {/* Google Calendar Card */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 overflow-hidden hover:border-blue-300 transition-all">
                {/* Header de la card */}
                <div className={`p-6 ${googleCalendarConnected ? 'bg-gradient-to-r from-green-50 to-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            {/* Icono de Google Calendar */}
                            <div className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center">
                                <CalendarIcon className="w-10 h-10 text-blue-600" />
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-gray-900">Google Calendar</h3>
                                    {googleCalendarConnected ? (
                                        <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1.5">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                            Conectado
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1.5">
                                            <X className="w-3 h-3" />
                                            Desconectado
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Sincroniza automáticamente tus reservas con Google Calendar
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-6 space-y-4">
                    {/* Características - MEJOR EXPLICADAS CON CHECKS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Sincronización Unidireccional</p>
                                <p className="text-xs text-gray-600">LA-IA → Google Calendar (fuente única de verdad)</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Sincronización Automática</p>
                                <p className="text-xs text-gray-600">Cada reserva creada/modificada se sincroniza automáticamente</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Sin Conflictos</p>
                                <p className="text-xs text-gray-600">Control total: LA-IA es la única fuente de verdad</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Vista Completa</p>
                                <p className="text-xs text-gray-600">Ve todas tus reservas en Google Calendar</p>
                            </div>
                        </div>
                    </div>

                    {/* Información de conexión - SOLO SI ESTÁ CONECTADO */}
                    {googleCalendarConnected && googleCalendarConfig ? (
                        <>
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-700 font-medium">Calendario(s):</span>
                                        <span className="text-gray-900 font-semibold">
                                            {googleCalendarConfig.config?.calendar_name || 'No seleccionado'}
                                        </span>
                                    </div>
                                    {googleCalendarConfig.config?.calendars_selected && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-700 font-medium">Calendarios activos:</span>
                                            <span className="text-gray-900 text-xs">
                                                {googleCalendarConfig.config.calendars_selected.length} calendario(s)
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-700 font-medium">Última Sync:</span>
                                        <span className="text-gray-900">
                                            {googleCalendarConfig.last_sync_at 
                                                ? new Date(googleCalendarConfig.last_sync_at).toLocaleString()
                                                : 'Nunca'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-700 font-medium">Eventos Sincronizados:</span>
                                        <span className="text-gray-900 font-bold">
                                            {googleCalendarConfig.config?.events_synced || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ Selección previa: ¿Por trabajador o por recurso? */}
                            {googleCalendarConfig.config?.calendar_selection_completed && !mappingType && (
                                <CalendarMappingTypeSelector
                                    onSelect={async (type) => {
                                        setMappingType(type);
                                        // Guardar tipo de mapeo en la configuración
                                        try {
                                            const { data: integration } = await supabase
                                                .from('integrations')
                                                .select('id, config')
                                                .eq('business_id', businessId)
                                                .eq('provider', 'google_calendar')
                                                .eq('is_active', true)
                                                .single();

                                            if (integration) {
                                                await supabase
                                                    .from('integrations')
                                                    .update({
                                                        config: {
                                                            ...integration.config,
                                                            mapping_type: type
                                                        }
                                                    })
                                                    .eq('id', integration.id);
                                                
                                                await loadIntegrationsConfig();
                                            }
                                        } catch (error) {
                                            console.error('Error guardando tipo de mapeo:', error);
                                        }
                                    }}
                                />
                            )}

                            {/* ⚙️ Configuración de Prioridad de Conflictos */}
                            {googleCalendarConfig.config?.calendar_selection_completed && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                        ⚡ Resolución Automática de Conflictos
                                    </h4>
                                    <p className="text-sm text-blue-800 mb-3">
                                        Elige qué hacer cuando hay conflictos entre Google Calendar y LA-IA:
                                    </p>
                                    <div className="space-y-2">
                                        <label className="flex items-start gap-3 p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                                            <input
                                                type="radio"
                                                name="conflict_priority"
                                                value="ask"
                                                checked={!googleCalendarConfig.config?.conflict_resolution_strategy || googleCalendarConfig.config?.conflict_resolution_strategy === 'ask'}
                                                onChange={async (e) => {
                                                    try {
                                                        const { error } = await supabase
                                                            .from('integrations')
                                                            .update({
                                                                config: {
                                                                    ...googleCalendarConfig.config,
                                                                    conflict_resolution_strategy: 'ask'
                                                                }
                                                            })
                                                            .eq('id', googleCalendarConfig.id);
                                                        
                                                        if (error) throw error;
                                                        toast.success('Configuración guardada');
                                                        await loadIntegrationsConfig();
                                                    } catch (error) {
                                                        console.error('Error guardando configuración:', error);
                                                        toast.error('Error al guardar');
                                                    }
                                                }}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">Preguntarme siempre (Recomendado)</div>
                                                <div className="text-xs text-gray-600">
                                                    Mostraré un modal para que decidas qué hacer en cada conflicto
                                                </div>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                                            <input
                                                type="radio"
                                                name="conflict_priority"
                                                value="laia"
                                                checked={googleCalendarConfig.config?.conflict_resolution_strategy === 'laia'}
                                                onChange={async (e) => {
                                                    try {
                                                        const { error } = await supabase
                                                            .from('integrations')
                                                            .update({
                                                                config: {
                                                                    ...googleCalendarConfig.config,
                                                                    conflict_resolution_strategy: 'laia'
                                                                }
                                                            })
                                                            .eq('id', googleCalendarConfig.id);
                                                        
                                                        if (error) throw error;
                                                        toast.success('LA-IA será la fuente de verdad');
                                                        await loadIntegrationsConfig();
                                                    } catch (error) {
                                                        console.error('Error guardando configuración:', error);
                                                        toast.error('Error al guardar');
                                                    }
                                                }}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">LA-IA es la fuente de verdad</div>
                                                <div className="text-xs text-gray-600">
                                                    Las reservas de LA-IA tienen prioridad, eventos conflictivos de GCal se omitirán
                                                </div>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                                            <input
                                                type="radio"
                                                name="conflict_priority"
                                                value="gcal"
                                                checked={googleCalendarConfig.config?.conflict_resolution_strategy === 'gcal'}
                                                onChange={async (e) => {
                                                    if (!confirm('⚠️ Esto cancelará automáticamente las reservas de LA-IA que conflicten con Google Calendar. ¿Estás seguro?')) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    try {
                                                        const { error } = await supabase
                                                            .from('integrations')
                                                            .update({
                                                                config: {
                                                                    ...googleCalendarConfig.config,
                                                                    conflict_resolution_strategy: 'gcal'
                                                                }
                                                            })
                                                            .eq('id', googleCalendarConfig.id);
                                                        
                                                        if (error) throw error;
                                                        toast.success('Google Calendar será la fuente de verdad');
                                                        await loadIntegrationsConfig();
                                                    } catch (error) {
                                                        console.error('Error guardando configuración:', error);
                                                        toast.error('Error al guardar');
                                                    }
                                                }}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">Google Calendar es la fuente de verdad</div>
                                                <div className="text-xs text-red-600 font-medium">
                                                    ⚠️ Las reservas de LA-IA se cancelarán automáticamente si hay conflictos
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Vincular Empleados con Calendarios (solo si se seleccionó "Por Trabajador") */}
                            {googleCalendarConfig.config?.calendar_selection_completed && mappingType === 'employee' && (
                                <EmployeeCalendarLinker
                                    businessId={businessId}
                                    integrationConfig={googleCalendarConfig.config}
                                    onUpdate={(updateData) => {
                                        if (updateData?.hasConflicts) {
                                            // Mostrar modal de conflictos
                                            setConflicts(updateData.conflicts);
                                            setConflictEvents(updateData.events);
                                        } else {
                                            // Recargar configuración normalmente (también cuando no hay updateData)
                                            loadIntegrationsConfig();
                                        }
                                    }}
                                />
                            )}

                            {/* Vincular Recursos con Calendarios (solo si se seleccionó "Por Recurso") */}
                            {googleCalendarConfig.config?.calendar_selection_completed && mappingType === 'resource' && (
                                <ResourceCalendarLinker
                                    businessId={businessId}
                                    integrationConfig={googleCalendarConfig.config}
                                    onUpdate={loadIntegrationsConfig}
                                />
                            )}
                        </>
                    ) : null}

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-3">
                        {!googleCalendarConnected ? (
                            <button
                                onClick={handleConnectGoogleCalendar}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md font-semibold disabled:opacity-50"
                            >
                                <LinkIcon className="w-5 h-5" />
                                Conectar con Google Calendar
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        console.log('🔘 Botón Seleccionar Calendarios clickeado');
                                        setShowCalendarSelector(true);
                                    }}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md font-semibold disabled:opacity-50"
                                >
                                    <Settings className="w-5 h-5" />
                                    Seleccionar Calendarios
                                </button>
                                <button
                                    onClick={handleTestSync}
                                    disabled={loading || !googleCalendarConfig?.config?.calendar_selection_completed}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium disabled:opacity-50"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    Probar Sincronización
                                </button>
                                {(() => {
                                    // ✅ Mostrar botón de importar SOLO si:
                                    // 1. Google Calendar está conectado
                                    // 2. calendar_selection_completed es true (ya se seleccionaron calendarios)
                                    // 3. employee_calendar_mapping existe y tiene al menos una entrada (calendarios vinculados con trabajadores)
                                    const calendarSelectionCompleted = googleCalendarConfig?.config?.calendar_selection_completed;
                                    const employeeMapping = googleCalendarConfig?.config?.employee_calendar_mapping || {};
                                    const hasEmployeeMapping = Object.keys(employeeMapping).length > 0;
                                    
                                    const shouldShowImport = googleCalendarConnected && calendarSelectionCompleted && hasEmployeeMapping;
                                    
                                    console.log('🔍 Evaluando botón Importar:', {
                                        connected: googleCalendarConnected,
                                        calendar_selection_completed: calendarSelectionCompleted,
                                        has_employee_mapping: hasEmployeeMapping,
                                        employee_mapping_keys: Object.keys(employeeMapping),
                                        shouldShowImport,
                                        config: googleCalendarConfig?.config
                                    });
                                    
                                    return shouldShowImport ? (
                                        <button
                                            onClick={() => setShowImportModal(true)}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50"
                                        >
                                            <CalendarIcon className="w-4 h-4" />
                                            Importar Eventos
                                        </button>
                                    ) : null;
                                })()}
                                <button
                                    onClick={handleDisconnectClick}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium disabled:opacity-50"
                                >
                                    <X className="w-4 h-4" />
                                    Desconectar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mensaje si está desconectado */}
            {!googleCalendarConnected && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                                Google Calendar no está conectado
                            </p>
                            <p className="text-xs text-gray-600">
                                Conecta tu cuenta de Google Calendar para sincronizar automáticamente tus reservas.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Otras integraciones (próximamente) */}
            <div className="bg-gray-100 rounded-xl p-6 text-center">
                <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700 mb-1">Próximamente</h3>
                <p className="text-sm text-gray-600">
                    Outlook Calendar, Apple Calendar, Zapier, Make y más...
                </p>
            </div>

            {/* Modal de Selector de Calendarios */}
            {showCalendarSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Seleccionar Calendarios de Google
                            </h3>
                            <button
                                onClick={() => setShowCalendarSelector(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <GoogleCalendarSelector
                                businessId={businessId}
                                currentCalendarId={googleCalendarConfig?.config?.calendar_id || googleCalendarConfig?.config?.calendar_ids}
                                onCalendarSelected={() => {
                                    setShowCalendarSelector(false);
                                    loadIntegrationsConfig();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Importación de Google Calendar */}
            <GoogleCalendarImportModal
                businessId={businessId}
                isOpen={showImportModal}
                onClose={() => {
                    setShowImportModal(false);
                    setUnassignedAppointments([]); // Limpiar al cerrar
                }}
                onComplete={(unassigned) => {
                    // ✅ FASE 2: Guardar eventos sin asignar para mostrar en UI de revisión
                    setUnassignedAppointments(unassigned || []);
                    // Recargar configuración después de importar
                    loadIntegrationsConfig();
                }}
            />

            {/* ✅ FASE 2: UI de Revisión - Mostrar eventos sin asignar */}
            {unassignedAppointments.length > 0 && (
                <UnassignedAppointmentsReview
                    businessId={businessId}
                    unassignedAppointments={unassignedAppointments}
                    onComplete={() => {
                        // Limpiar lista y recargar configuración
                        setUnassignedAppointments([]);
                        loadIntegrationsConfig();
                    }}
                />
            )}

            {/* ✅ Modal de Conflictos - Mostrar cuando hay conflictos entre Google Calendar y appointments existentes */}
            {conflicts && conflicts.length > 0 && (
                <GoogleCalendarConflictModal
                    conflicts={conflicts}
                    businessId={businessId}
                    events={conflictEvents}
                    onResolve={async (result) => {
                        console.log('✅ Conflictos resueltos:', result);
                        setConflicts(null);
                        setConflictEvents([]);
                        
                        // Recargar configuración y mostrar resumen
                        await loadIntegrationsConfig();
                        
                        // Toast de resumen según estrategia
                        if (result.strategy === 'gcal') {
                            toast.success(`✅ ${result.imported} eventos importados desde Google Calendar. ${result.cancelled} appointment(s) cancelado(s).`, {
                                duration: 6000
                            });
                        } else if (result.strategy === 'laia') {
                            toast.success(`✅ ${result.imported} eventos importados. Appointments de LA-IA mantenidos (${result.skipped} eventos omitidos).`, {
                                duration: 6000
                            });
                        } else if (result.strategy === 'skip') {
                            toast.success(`✅ ${result.imported} eventos sin conflictos importados. ${result.skipped} eventos omitidos.`, {
                                duration: 6000
                            });
                        }
                    }}
                    onCancel={() => {
                        console.log('❌ Usuario canceló resolución de conflictos');
                        setConflicts(null);
                        setConflictEvents([]);
                        toast.info('Sincronización cancelada. Puedes resolverlos más tarde.', {
                            duration: 4000
                        });
                    }}
                />
            )}

            {/* ✅ Modal de Confirmación de Desconexión Mejorado */}
            {showDisconnectModal && disconnectStats && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">¿Desconectar Google Calendar?</h3>
                                    <p className="text-sm text-gray-600 mt-1">Esto detendrá la sincronización automática</p>
                                </div>
                            </div>
                        </div>

                        {/* Contenido con estadísticas */}
                        <div className="p-6 space-y-4">
                            {/* Historial - Se mantiene */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-blue-600 font-bold">📊</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-blue-900 mb-1">Historial</p>
                                        <p className="text-sm text-blue-800">
                                            Se mantendrán <strong>{disconnectStats.pastGcalCount}</strong> citas pasadas para tus estadísticas.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Citas futuras de Google Calendar - Se eliminan */}
                            {disconnectStats.futureGcalCount > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-red-600 font-bold">🗑️</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-red-900 mb-1">Citas futuras de Google Calendar</p>
                                            <p className="text-sm text-red-800">
                                                Se eliminarán <strong>{disconnectStats.futureGcalCount}</strong> citas para liberar tu agenda.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Citas de LA-IA - Se mantienen */}
                            {disconnectStats.laiaSyncedCount > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-green-600 font-bold">✅</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-green-900 mb-1">Citas creadas en LA-IA</p>
                                            <p className="text-sm text-green-800">
                                                Se mantendrán <strong>{disconnectStats.laiaSyncedCount}</strong> citas, solo se desvincularán del calendario.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mensaje si no hay nada que eliminar */}
                            {disconnectStats.futureGcalCount === 0 && disconnectStats.laiaSyncedCount === 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <p className="text-sm text-gray-700">
                                        No hay citas futuras de Google Calendar ni citas sincronizadas. Solo se detendrá la sincronización.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer con botones */}
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDisconnectModal(false);
                                    setDisconnectStats(null);
                                }}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDisconnectGoogleCalendar}
                                disabled={loading}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Desconectando...
                                    </span>
                                ) : (
                                    'Sí, desconectar y limpiar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

