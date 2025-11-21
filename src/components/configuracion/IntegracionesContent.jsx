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
                
                // ✅ Limpiar parámetros OAuth pero PRESERVAR tab=canales
                const url = new URL(window.location.href);
                url.searchParams.delete('integration');
                url.searchParams.delete('status');
                url.searchParams.delete('message');
                // ✅ Asegurar que tab=canales esté presente
                if (!url.searchParams.has('tab')) {
                    url.searchParams.set('tab', 'canales');
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
                        .then(({ data: integrationData }) => {
                            const hasImported = integrationData?.config?.initial_import_completed;
                            const isActive = integrationData?.is_active;
                            const calendarSelected = integrationData?.config?.calendar_selection_completed;
                            
                            // Si no hay calendario seleccionado, mostrar selector primero
                            if (!calendarSelected && isActive) {
                                console.log('📅 Primera conexión detectada - Mostrando selector de calendarios');
                                setShowCalendarSelector(true);
                            } else if (!hasImported && isActive) {
                                console.log('📥 Calendario seleccionado - Ofreciendo importación inicial');
                                setShowImportModal(true);
                            }
                        });
                }, 800);
            }, 1500);
            
            return () => clearTimeout(timeoutId);
        }
    }, [businessId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Desconectar Google Calendar
    const handleDisconnectGoogleCalendar = async () => {
        if (!confirm('¿Estás seguro de desconectar Google Calendar? Se detendrá la sincronización y deberás volver a conectar para usarlo.')) {
            return;
        }

        try {
            setLoading(true);
            toast.loading('Desconectando Google Calendar...', { id: 'google-disconnect' });

            // ✅ DESCONECTAR: Marcar como inactivo (no actualizar status si tiene constraint)
            const { error } = await supabase
                .from('integrations')
                .update({
                    is_active: false,
                    disconnected_at: new Date().toISOString()
                })
                .eq('id', googleCalendarConfig.id);

            if (error) throw error;

            toast.dismiss('google-disconnect');
            toast.success('✅ Google Calendar desconectado correctamente', { duration: 3000 });
            
            // ✅ ACTUALIZAR ESTADO INMEDIATAMENTE (sin esperar recarga)
            setGoogleCalendarConnected(false);
            setGoogleCalendarConfig(null);
            
            // Recargar configuración para asegurar estado actualizado
            await loadIntegrationsConfig();

            console.log('✅ Desconexión completada - Estado actualizado a DESCONECTADO');

        } catch (error) {
            console.error('❌ Error desconectando:', error);
            toast.dismiss('google-disconnect');
            toast.error('Error al desconectar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Probar sincronización
    // Sincroniza manualmente las reservas con Google Calendar
    const handleTestSync = async () => {
        try {
            setLoading(true);
            toast.loading('Sincronizando con Google Calendar...', { id: 'test-sync' });

            // ✅ Verificar que el usuario esté autenticado antes de llamar a la función
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                throw new Error(`Error de autenticación: ${sessionError.message}`);
            }
            
            if (!session) {
                throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
            }

            console.log('✅ Usuario autenticado, llamando a sync-google-calendar...');

            // Llamar a Edge Function para sincronizar
            const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
                body: {
                    business_id: businessId,
                    action: 'test' // Acción de prueba: solo verifica conexión y lista eventos
                }
            });

            if (error) {
                console.error('❌ Error en sync-google-calendar:', error);
                // Si es error de autorización, sugerir recargar sesión
                if (error.message?.includes('authorization') || error.message?.includes('401')) {
                    throw new Error('Error de autenticación. Por favor, recarga la página e intenta nuevamente.');
                }
                throw error;
            }

            toast.dismiss('test-sync');
            
            if (data?.success) {
                // Mensaje simple y claro
                toast.success('✅ Sincronización completada', { duration: 3000 });
                
                // Recargar configuración para actualizar last_sync_at
                await loadIntegrationsConfig();
            } else {
                throw new Error(data?.error || 'Error desconocido');
            }

        } catch (error) {
            console.error('Error en prueba de sincronización:', error);
            toast.dismiss('test-sync');
            
            // Si es error de CORS o función no encontrada, mostrar mensaje más claro
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
                                    onClick={handleDisconnectGoogleCalendar}
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
                    onResolve={(result) => {
                        console.log('Conflictos resueltos:', result);
                        setConflicts(null);
                        setConflictEvents([]);
                        loadIntegrationsConfig();
                    }}
                    onCancel={() => {
                        setConflicts(null);
                        setConflictEvents([]);
                    }}
                />
            )}
        </div>
    );
}

