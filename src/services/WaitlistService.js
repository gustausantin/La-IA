// WaitlistService.js - Servicio para gestión de lista de espera
import { supabase } from '../lib/supabase';

class WaitlistService {
    /**
     * 📝 Agregar cliente a lista de espera
     */
    async addToWaitlist({
        businessId,
        customerId = null,
        customerName,
        customerPhone,
        customerEmail = null,
        serviceId = null,
        serviceName,
        preferredDate,
        preferredTime = null,
        flexibleTime = true,
        preferredResourceId = null,
        priority = 3,
        notes = null,
        source = 'manual'
    }) {
        try {
            const { data, error } = await supabase
                .from('waitlist')
                .insert({
                    business_id: businessId,
                    customer_id: customerId,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    customer_email: customerEmail,
                    service_id: serviceId,
                    service_name: serviceName,
                    preferred_date: preferredDate,
                    preferred_time: preferredTime,
                    flexible_time: flexibleTime,
                    preferred_resource_id: preferredResourceId,
                    priority,
                    notes,
                    source,
                    status: 'waiting'
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Cliente agregado a lista de espera:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error al agregar a lista de espera:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 📋 Obtener lista de espera activa
     */
    async getActiveWaitlist(businessId, filters = {}) {
        try {
            let query = supabase
                .from('waitlist')
                .select(`
                    *,
                    customer:customers(id, name, phone, email),
                    service:services(id, name, duration_minutes),
                    preferred_resource:resources(id, name)
                `)
                .eq('business_id', businessId)
                .eq('status', 'waiting')
                .order('priority', { ascending: true })
                .order('created_at', { ascending: true });

            // Filtros opcionales
            if (filters.date) {
                query = query.eq('preferred_date', filters.date);
            }

            if (filters.serviceId) {
                query = query.eq('service_id', filters.serviceId);
            }

            if (filters.resourceId) {
                query = query.eq('preferred_resource_id', filters.resourceId);
            }

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data: data || [] };
        } catch (error) {
            console.error('❌ Error al obtener lista de espera:', error);
            return { success: false, error: error.message, data: [] };
        }
    }

    /**
     * ✅ Convertir entrada de waitlist a reserva
     */
    async convertToReservation(waitlistId, reservationData) {
        try {
            // 1. Marcar como convertida
            const { error: updateError } = await supabase
                .from('waitlist')
                .update({
                    status: 'converted',
                    converted_at: new Date().toISOString()
                })
                .eq('id', waitlistId);

            if (updateError) throw updateError;

            // 2. Crear la reserva (esto se hace desde ReservationWizard normalmente)
            console.log('✅ Entrada de waitlist convertida a reserva');
            return { success: true };
        } catch (error) {
            console.error('❌ Error al convertir waitlist:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ❌ Cancelar entrada de waitlist
     */
    async cancelWaitlist(waitlistId) {
        try {
            const { error } = await supabase
                .from('waitlist')
                .update({ status: 'cancelled' })
                .eq('id', waitlistId);

            if (error) throw error;

            console.log('✅ Entrada de waitlist cancelada');
            return { success: true };
        } catch (error) {
            console.error('❌ Error al cancelar waitlist:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔔 Marcar como contactado
     */
    async markAsContacted(waitlistId) {
        try {
            const { error } = await supabase
                .from('waitlist')
                .update({
                    status: 'contacted',
                    contacted_at: new Date().toISOString()
                })
                .eq('id', waitlistId);

            if (error) throw error;

            console.log('✅ Cliente marcado como contactado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error al marcar como contactado:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🧹 Limpiar registros expirados
     */
    async cleanupExpired(businessId) {
        try {
            const { data, error } = await supabase
                .rpc('cleanup_expired_waitlist');

            if (error) throw error;

            console.log(`✅ ${data} registros expirados limpiados`);
            return { success: true, deletedCount: data };
        } catch (error) {
            console.error('❌ Error al limpiar waitlist:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 📊 Obtener estadísticas de waitlist
     */
    async getWaitlistStats(businessId) {
        try {
            const { data, error } = await supabase
                .from('waitlist')
                .select('status, preferred_date')
                .eq('business_id', businessId);

            if (error) throw error;

            // Calcular estadísticas
            const stats = {
                total: data.length,
                waiting: data.filter(w => w.status === 'waiting').length,
                contacted: data.filter(w => w.status === 'contacted').length,
                converted: data.filter(w => w.status === 'converted').length,
                cancelled: data.filter(w => w.status === 'cancelled').length,
                expired: data.filter(w => w.status === 'expired').length
            };

            return { success: true, stats };
        } catch (error) {
            console.error('❌ Error al obtener stats:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔍 Verificar si hay espacio disponible para fecha/hora
     */
    async checkAvailability(businessId, date, time, resourceId = null) {
        try {
            // Obtener todas las citas para esa fecha/hora/recurso
            let query = supabase
                .from('appointments')
                .select('id')
                .eq('business_id', businessId)
                .eq('appointment_date', date)
                .eq('appointment_time', time)
                .in('status', ['confirmed', 'pending']);

            if (resourceId) {
                query = query.eq('resource_id', resourceId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const hasAvailability = data.length === 0;

            return { 
                success: true, 
                hasAvailability,
                message: hasAvailability 
                    ? 'Hay disponibilidad' 
                    : 'No hay disponibilidad'
            };
        } catch (error) {
            console.error('❌ Error al verificar disponibilidad:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔄 Suscribirse a cambios en waitlist en tiempo real
     */
    subscribeToWaitlist(businessId, callback) {
        const subscription = supabase
            .channel(`waitlist:${businessId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'waitlist',
                    filter: `business_id=eq.${businessId}`
                },
                (payload) => {
                    console.log('🔔 Cambio en waitlist:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        return subscription;
    }
}

export default new WaitlistService();

