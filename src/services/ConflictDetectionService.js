// =========================================
// CONFLICT DETECTION SERVICE
// Sistema completo de detección de conflictos
// =========================================

import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

class ConflictDetectionService {
    
    /**
     * 🚨 DETECTAR CONFLICTOS AL CAMBIAR HORARIOS
     */
    static async detectScheduleConflicts(businessId, newSchedule, startDate, endDate) {
        try {
            const conflicts = [];
            
            // Obtener reservas en el rango afectado
            const { data: reservations, error } = await supabase
                .from('appointments')
                .select(`
                    id, customer_name, reservation_date, reservation_time,
                    party_size, table_id, tables(name, zone)
                `)
                .eq('business_id', businessId)
                .gte('reservation_date', startDate)
                .lte('reservation_date', endDate)
                .in('status', ['confirmada', 'pendiente', 'confirmed', 'pending']);
            
            if (error) throw error;
            
            // Verificar cada reserva contra el nuevo horario
            for (const reservation of reservations) {
                const dayOfWeek = new Date(reservation.reservation_date).getDay();
                const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
                const daySchedule = newSchedule[dayName];
                
                if (!daySchedule || daySchedule.closed) {
                    conflicts.push({
                        type: 'DAY_CLOSED',
                        reservation,
                        reason: `El ${dayName} estará cerrado pero hay reserva confirmada`
                    });
                    continue;
                }
                
                const reservationTime = reservation.reservation_time;
                const openTime = daySchedule.open;
                const closeTime = daySchedule.close;
                
                if (reservationTime < openTime || reservationTime >= closeTime) {
                    conflicts.push({
                        type: 'OUTSIDE_HOURS',
                        reservation,
                        reason: `Reserva a las ${reservationTime} pero horario será ${openTime}-${closeTime}`
                    });
                }
            }
            
            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                affectedReservations: conflicts.length,
                conflictTypes: [...new Set(conflicts.map(c => c.type))]
            };
            
        } catch (error) {
            console.error('Error detectando conflictos de horario:', error);
            throw error;
        }
    }
    
    /**
     * 🪑 DETECTAR CONFLICTOS AL CAMBIAR MESAS
     */
    static async detectTableConflicts(businessId, tableId, changeType, newCapacity = null) {
        try {
            // Obtener reservas futuras de esta mesa
            const { data: reservations, error } = await supabase
                .from('appointments')
                .select(`
                    id, customer_name, reservation_date, reservation_time,
                    party_size, customer_phone
                `)
                .eq('business_id', businessId)
                .eq('table_id', tableId)
                .gte('reservation_date', format(new Date(), 'yyyy-MM-dd'))
                .in('status', ['confirmada', 'pendiente', 'confirmed', 'pending'])
                .order('reservation_date', { ascending: true });
            
            if (error) throw error;
            
            const conflicts = [];
            
            if (changeType === 'DELETE' && reservations.length > 0) {
                conflicts.push({
                    type: 'TABLE_DELETE_WITH_RESERVATIONS',
                    affectedReservations: reservations,
                    reason: `No se puede eliminar: ${reservations.length} reservas futuras`
                });
            }
            
            if (changeType === 'CAPACITY_CHANGE' && newCapacity) {
                const oversizedReservations = reservations.filter(r => r.party_size > newCapacity);
                if (oversizedReservations.length > 0) {
                    conflicts.push({
                        type: 'CAPACITY_TOO_SMALL',
                        affectedReservations: oversizedReservations,
                        reason: `Nueva capacidad (${newCapacity}) menor que reservas existentes`
                    });
                }
            }
            
            if (changeType === 'DEACTIVATE' && reservations.length > 0) {
                conflicts.push({
                    type: 'TABLE_DEACTIVATE_WITH_RESERVATIONS',
                    affectedReservations: reservations,
                    reason: `No se puede desactivar: ${reservations.length} reservas futuras`
                });
            }
            
            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                affectedReservations: reservations.length,
                nextReservation: reservations[0] || null
            };
            
        } catch (error) {
            console.error('Error detectando conflictos de mesa:', error);
            throw error;
        }
    }
    
    /**
     * 🎉 DETECTAR CONFLICTOS AL CREAR EVENTOS ESPECIALES
     */
    static async detectEventConflicts(businessId, eventDate, eventType) {
        try {
            if (eventType !== 'closure' && eventType !== 'holiday') {
                return { hasConflicts: false, conflicts: [] };
            }
            
            // Obtener reservas en la fecha del evento
            const { data: reservations, error } = await supabase
                .from('appointments')
                .select(`
                    id, customer_name, reservation_time, party_size,
                    customer_phone, table_id, tables(name, zone)
                `)
                .eq('business_id', businessId)
                .eq('reservation_date', eventDate)
                .in('status', ['confirmada', 'pendiente', 'confirmed', 'pending']);
            
            if (error) throw error;
            
            const conflicts = reservations.length > 0 ? [{
                type: 'EVENT_CLOSURE_WITH_RESERVATIONS',
                affectedReservations: reservations,
                eventDate,
                reason: `Cierre programado pero hay ${reservations.length} reservas confirmadas`
            }] : [];
            
            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                affectedReservations: reservations.length
            };
            
        } catch (error) {
            console.error('Error detectando conflictos de evento:', error);
            throw error;
        }
    }
    
    /**
     * ✅ VALIDAR DISPONIBILIDAD ANTES DE CREAR RESERVA
     */
    static async validateReservationAvailability(businessId, reservationDate, reservationTime, partySize, tableId = null) {
        try {
            // 1. Verificar que hay availability_slots para esa fecha/hora
            // ✅ Incluir employee_id y resource_id para asociar correctamente la reserva con el empleado
            let availabilityQuery = supabase
                .from('availability_slots')
                .select('id, table_id, resource_id, employee_id, status, start_time, end_time')
                .eq('business_id', businessId)
                .eq('slot_date', reservationDate)
                .eq('status', 'free')
                .lte('start_time', reservationTime)
                .gte('end_time', reservationTime);
            
            if (tableId) {
                // Buscar por table_id O resource_id (puede ser que tableId sea realmente un resource_id)
                availabilityQuery = availabilityQuery.or(`table_id.eq.${tableId},resource_id.eq.${tableId}`);
            }
            
            const { data: availableSlots, error } = await availabilityQuery;
            if (error) throw error;
            
            // 2. Verificar capacidad de mesa si se especifica
            if (tableId) {
                const { data: table, error: tableError } = await supabase
                    .from('resources')
                    .select('capacity, is_active, status')
                    .eq('id', tableId)
                    .single();
                
                if (tableError) throw tableError;
                
                if (!table.is_active || table.status !== 'available') {
                    return {
                        isValid: false,
                        reason: 'MESA_NO_DISPONIBLE',
                        message: 'La mesa seleccionada no está disponible'
                    };
                }
                
                if (table.capacity < partySize) {
                    return {
                        isValid: false,
                        reason: 'CAPACIDAD_INSUFICIENTE',
                        message: `La mesa tiene capacidad para ${table.capacity} pero se necesita para ${partySize}`
                    };
                }
            }
            
            // 3. Verificar que no hay conflictos de horario
            if (availableSlots.length === 0) {
                return {
                    isValid: false,
                    reason: 'SIN_DISPONIBILIDAD',
                    message: 'No hay disponibilidad en esa fecha y hora'
                };
            }
            
            return {
                isValid: true,
                availableSlots,
                message: 'Reserva válida'
            };
            
        } catch (error) {
            console.error('Error validando disponibilidad:', error);
            return {
                isValid: false,
                reason: 'ERROR_VALIDACION',
                message: 'Error al validar disponibilidad: ' + error.message
            };
        }
    }
    
    /**
     * 🔄 DETECTAR NECESIDAD DE REGENERAR DISPONIBILIDADES
     */
    static async detectAvailabilityUpdateNeeds(businessId, changeType, changeData) {
        try {
            const needsUpdate = {
                required: false,
                reason: '',
                priority: 'low', // low, medium, high, critical
                affectedDates: []
            };
            
            switch (changeType) {
                case 'SCHEDULE_CHANGE':
                    needsUpdate.required = true;
                    needsUpdate.reason = 'Cambio en horarios de apertura';
                    needsUpdate.priority = 'high';
                    break;
                    
                case 'TABLE_CHANGE':
                    needsUpdate.required = true;
                    needsUpdate.reason = 'Cambio en configuración de mesas';
                    needsUpdate.priority = 'medium';
                    break;
                    
                case 'POLICY_CHANGE':
                    needsUpdate.required = true;
                    needsUpdate.reason = 'Cambio en política de reservas';
                    needsUpdate.priority = 'high';
                    break;
                    
                case 'SPECIAL_EVENT':
                    needsUpdate.required = true;
                    needsUpdate.reason = 'Nuevo evento especial añadido';
                    needsUpdate.priority = 'critical';
                    needsUpdate.affectedDates = [changeData.eventDate];
                    break;
            }
            
            return needsUpdate;
            
        } catch (error) {
            console.error('Error detectando necesidad de actualización:', error);
            throw error;
        }
    }
}

export default ConflictDetectionService;

