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

export default function IntegracionesContent() {
    const { businessId, business } = useAuthContext();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
    const [googleCalendarConfig, setGoogleCalendarConfig] = useState(null);

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
            const timeoutId = setTimeout(() => {
                loadIntegrationsConfig();
            }, 1500);
            
            return () => clearTimeout(timeoutId);
        }
    }, [businessId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadIntegrationsConfig = async () => {
        try {
            setLoading(true);
            
            // Buscar configuración de Google Calendar
            const { data, error } = await supabase
                .from('integrations')
                .select('*')
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar')
                .maybeSingle(); // Usar maybeSingle() en lugar de single() para manejar mejor cuando no hay resultados

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
                throw error;
            }

            if (data) {
                setGoogleCalendarConnected(data.is_active === true);
                setGoogleCalendarConfig(data);
            } else {
                // No hay integración configurada aún
                setGoogleCalendarConnected(false);
                setGoogleCalendarConfig(null);
            }
        } catch (error) {
            console.error('❌ Error cargando integraciones:', error);
            // No mostrar toast aquí para evitar spam, solo log
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

            // Construir URL de la Edge Function
            // Formato: https://{project-ref}.supabase.co/functions/v1/{function-name}
            const supabaseUrlObj = new URL(supabaseUrl);
            const edgeFunctionUrl = `${supabaseUrlObj.origin}/functions/v1/google-calendar-oauth`;
            const redirectUri = edgeFunctionUrl;
            
            // 🔍 DEBUG: Log para verificar la URI exacta
            console.log('🔍 DEBUG OAuth:');
            console.log('  - Supabase URL:', supabaseUrl);
            console.log('  - Edge Function URL:', edgeFunctionUrl);
            console.log('  - redirectUri completo:', redirectUri);
            console.log('  - clientId:', clientId ? `${clientId.substring(0, 20)}...` : 'NO CONFIGURADO');
            console.log('  - businessId:', businessId);
            
            // Verificar que la URI no tenga trailing slash ni espacios
            const cleanRedirectUri = redirectUri.trim().replace(/\/$/, '');
            
            if (cleanRedirectUri !== redirectUri) {
                console.warn('⚠️ URI tenía trailing slash o espacios, corregido:', cleanRedirectUri);
            }

            const scopes = [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
            ].join(' ');

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${clientId}` +
                `&redirect_uri=${encodeURIComponent(cleanRedirectUri)}` +
                `&response_type=code` +
                `&scope=${encodeURIComponent(scopes)}` +
                `&access_type=offline` +
                `&prompt=consent` +
                `&state=${businessId}`; // Pasar businessId como state

            // 🔍 DEBUG: Mostrar URL completa (sin el código por seguridad)
            console.log('🔍 URL de autorización (sin parámetros sensibles):');
            console.log('  - Base:', `https://accounts.google.com/o/oauth2/v2/auth`);
            console.log('  - redirect_uri codificado:', encodeURIComponent(cleanRedirectUri));
            console.log('  - URI completa (decodificada para verificación):', 
                `https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=${cleanRedirectUri}&...`);

            // Guardar intento de conexión
            localStorage.setItem('google_calendar_connecting', 'true');
            localStorage.setItem('google_calendar_business_id', businessId);
            localStorage.setItem('google_calendar_redirect_uri', cleanRedirectUri); // Guardar para debug

            toast.dismiss('google-connect');
            
            // Mostrar mensaje con la URI para verificación
            console.log('✅ Redirigiendo a Google OAuth...');
            console.log('⚠️ IMPORTANTE: Verifica que esta URI esté en Google Cloud Console:');
            console.log(`   ${cleanRedirectUri}`);
            
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
        if (!confirm('¿Estás seguro de desconectar Google Calendar? Se detendrá la sincronización.')) {
            return;
        }

        try {
            setLoading(true);
            toast.loading('Desconectando...', { id: 'google-disconnect' });

            const { error } = await supabase
                .from('integrations')
                .update({
                    is_active: false,
                    disconnected_at: new Date().toISOString()
                })
                .eq('id', googleCalendarConfig.id);

            if (error) throw error;

            toast.dismiss('google-disconnect');
            toast.success('✅ Google Calendar desconectado');
            
            setGoogleCalendarConnected(false);
            await loadIntegrationsConfig();

        } catch (error) {
            console.error('Error desconectando:', error);
            toast.dismiss('google-disconnect');
            toast.error('Error al desconectar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Probar sincronización
    const handleTestSync = async () => {
        try {
            setLoading(true);
            toast.loading('Probando sincronización...', { id: 'test-sync' });

            // Llamar a Edge Function para probar sync
            const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
                body: {
                    business_id: businessId,
                    action: 'test'
                }
            });

            if (error) throw error;

            toast.dismiss('test-sync');
            toast.success('✅ Sincronización exitosa! ' + (data?.events_synced || 0) + ' eventos sincronizados');

        } catch (error) {
            console.error('Error en prueba de sincronización:', error);
            toast.dismiss('test-sync');
            toast.error('Error en la sincronización: ' + error.message);
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
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-gray-900">Google Calendar</h3>
                                    {googleCalendarConnected && (
                                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            Conectado
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    Sincroniza automáticamente tus reservas con Google Calendar
                                </p>
                            </div>
                        </div>

                        {/* Estado */}
                        {googleCalendarConnected ? (
                            <div className="flex items-center gap-2 text-green-600">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm font-semibold">Activo</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                                <span className="text-sm font-semibold">Inactivo</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-6 space-y-4">
                    {/* Características */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Sincronización Bidireccional</p>
                                <p className="text-xs text-gray-600">Cambios en LA-IA → Google Calendar y viceversa</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Tiempo Real</p>
                                <p className="text-xs text-gray-600">Actualizaciones instantáneas vía webhooks</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Calendario Dedicado</p>
                                <p className="text-xs text-gray-600">Crea un calendario específico para LA-IA</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Notificaciones Sync</p>
                                <p className="text-xs text-gray-600">Alertas de sincronización y errores</p>
                            </div>
                        </div>
                    </div>

                    {/* Información de conexión */}
                    {googleCalendarConnected && googleCalendarConfig && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700 font-medium">Calendario:</span>
                                    <span className="text-gray-900 font-semibold">
                                        {googleCalendarConfig.config?.calendar_name || 'LA-IA Reservas'}
                                    </span>
                                </div>
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
                    )}

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
                                    onClick={handleTestSync}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium disabled:opacity-50"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    Probar Sincronización
                                </button>
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

            {/* Info adicional */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                            ¿Cómo funciona la sincronización?
                        </h4>
                        <ul className="text-xs text-yellow-800 space-y-1">
                            <li>• Cada reserva creada en LA-IA se crea automáticamente en Google Calendar</li>
                            <li>• Si modificas o cancelas en LA-IA, se actualiza en Google Calendar</li>
                            <li>• Si creas un evento en Google Calendar, se bloquea ese horario en LA-IA</li>
                            <li>• La sincronización ocurre en tiempo real (menos de 5 segundos)</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Otras integraciones (próximamente) */}
            <div className="bg-gray-100 rounded-xl p-6 text-center">
                <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700 mb-1">Próximamente</h3>
                <p className="text-sm text-gray-600">
                    Outlook Calendar, Apple Calendar, Zapier, Make y más...
                </p>
            </div>
        </div>
    );
}

