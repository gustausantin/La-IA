// GoogleCalendarService.js - Integración con Google Calendar
import { supabase } from '../lib/supabase';

class GoogleCalendarService {
    constructor() {
        this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        this.redirectUri = `${window.location.origin}/auth/google/callback`;
        this.scopes = [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly'
        ].join(' ');
    }

    /**
     * 🔗 Iniciar proceso de OAuth con Google
     */
    async connect(businessId) {
        try {
            const state = JSON.stringify({
                businessId,
                timestamp: Date.now()
            });

            // Guardar state en localStorage para validar después
            localStorage.setItem('google_oauth_state', state);

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            authUrl.searchParams.append('client_id', this.clientId);
            authUrl.searchParams.append('redirect_uri', this.redirectUri);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('scope', this.scopes);
            authUrl.searchParams.append('access_type', 'offline');
            authUrl.searchParams.append('prompt', 'consent');
            authUrl.searchParams.append('state', state);

            // Redirigir a Google OAuth
            window.location.href = authUrl.toString();
        } catch (error) {
            console.error('❌ Error iniciando OAuth:', error);
            throw error;
        }
    }

    /**
     * 🔄 Manejar callback de OAuth
     */
    async handleCallback(code, state) {
        try {
            // Validar state
            const savedState = localStorage.getItem('google_oauth_state');
            if (savedState !== state) {
                throw new Error('Estado de OAuth inválido');
            }

            const stateData = JSON.parse(state);
            
            // Intercambiar code por tokens (esto se hace en Edge Function)
            const { data, error } = await supabase.functions.invoke('google-oauth-callback', {
                body: {
                    code,
                    businessId: stateData.businessId,
                    redirectUri: this.redirectUri
                }
            });

            if (error) throw error;

            console.log('✅ Conectado a Google Calendar:', data);
            localStorage.removeItem('google_oauth_state');

            return { success: true, data };
        } catch (error) {
            console.error('❌ Error en callback:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔌 Desconectar Google Calendar
     */
    async disconnect(businessId) {
        try {
            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar');

            if (error) throw error;

            console.log('✅ Google Calendar desconectado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error desconectando:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔍 Verificar si está conectado
     */
    async isConnected(businessId) {
        try {
            const { data, error } = await supabase
                .from('integrations')
                .select('id, status, created_at, expires_at')
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar')
                .eq('status', 'active')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            const isConnected = !!data;
            const isExpired = data?.expires_at ? new Date(data.expires_at) < new Date() : false;

            return {
                success: true,
                isConnected: isConnected && !isExpired,
                integration: data,
                needsReconnect: isExpired
            };
        } catch (error) {
            console.error('❌ Error verificando conexión:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔄 Sincronizar eventos (bidireccional)
     */
    async sync(businessId, options = {}) {
        try {
            const {
                direction = 'both', // 'import', 'export', 'both'
                dateRange = 30 // días hacia adelante y atrás
            } = options;

            console.log(`🔄 Iniciando sincronización: ${direction}`);

            const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
                body: {
                    businessId,
                    direction,
                    dateRange
                }
            });

            if (error) throw error;

            console.log('✅ Sincronización completada:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 📥 Importar eventos de Google Calendar a LA-IA
     */
    async importEvents(businessId, startDate, endDate) {
        try {
            const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
                body: {
                    businessId,
                    direction: 'import',
                    startDate,
                    endDate
                }
            });

            if (error) throw error;

            console.log(`✅ ${data.imported} eventos importados`);
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error importando:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 📤 Exportar citas de LA-IA a Google Calendar
     */
    async exportEvents(businessId, appointmentIds = []) {
        try {
            const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
                body: {
                    businessId,
                    direction: 'export',
                    appointmentIds
                }
            });

            if (error) throw error;

            console.log(`✅ ${data.exported} eventos exportados`);
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error exportando:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 📊 Obtener estadísticas de sincronización
     */
    async getSyncStats(businessId) {
        try {
            const { data, error } = await supabase
                .from('google_calendar_events')
                .select('sync_status, created_at')
                .eq('business_id', businessId);

            if (error) throw error;

            const stats = {
                total: data.length,
                synced: data.filter(e => e.sync_status === 'synced').length,
                pending: data.filter(e => e.sync_status === 'pending').length,
                error: data.filter(e => e.sync_status === 'error').length,
                lastSync: data.length > 0 ? new Date(Math.max(...data.map(e => new Date(e.created_at)))) : null
            };

            return { success: true, stats };
        } catch (error) {
            console.error('❌ Error obteniendo stats:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔄 Configurar auto-sync
     */
    async enableAutoSync(businessId, intervalMinutes = 15) {
        try {
            // Actualizar configuración en integrations
            const { error } = await supabase
                .from('integrations')
                .update({
                    metadata: {
                        autoSync: true,
                        intervalMinutes
                    }
                })
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar');

            if (error) throw error;

            console.log(`✅ Auto-sync activado (cada ${intervalMinutes} min)`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error activando auto-sync:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ⏸️ Desactivar auto-sync
     */
    async disableAutoSync(businessId) {
        try {
            const { error } = await supabase
                .from('integrations')
                .update({
                    metadata: {
                        autoSync: false
                    }
                })
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar');

            if (error) throw error;

            console.log('✅ Auto-sync desactivado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error desactivando auto-sync:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔔 Configurar webhooks de Google Calendar
     */
    async setupWebhook(businessId) {
        try {
            const { data, error } = await supabase.functions.invoke('google-calendar-webhook', {
                body: {
                    businessId,
                    action: 'setup'
                }
            });

            if (error) throw error;

            console.log('✅ Webhook configurado');
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error configurando webhook:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔄 Real-time: Suscribirse a cambios de sincronización
     */
    subscribeToSyncEvents(businessId, callback) {
        const subscription = supabase
            .channel(`gcal-sync:${businessId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'google_calendar_events',
                    filter: `business_id=eq.${businessId}`
                },
                (payload) => {
                    console.log('🔔 Cambio en sincronización:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        return subscription;
    }
}

export default new GoogleCalendarService();

