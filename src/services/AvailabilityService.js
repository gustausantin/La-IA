// AvailabilityService.js - Servicio para gestión de disponibilidades
import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE DISPONIBILIDADES - WORLD CLASS
 * Interfaz JavaScript para el sistema de disponibilidades completo
 */
export class AvailabilityService {
    
    /**
     * Verificar disponibilidad para una fecha/hora específica
     * @param {string} restaurantId - ID del restaurante
     * @param {string} date - Fecha en formato YYYY-MM-DD
     * @param {string} time - Hora en formato HH:MM
     * @param {number} partySize - Número de personas
     * @param {number} durationMinutes - Duración en minutos (opcional)
     * @returns {Promise<Object>} Resultado de disponibilidad
     */
    static async checkAvailability(restaurantId, date, time, partySize = 2, durationMinutes = null) {
        try {
            const { data, error } = await supabase.rpc('check_availability', {
                p_restaurant_id: restaurantId,
                p_date: date,
                p_time: time,
                p_party_size: partySize,
                p_duration_minutes: durationMinutes
            });

            if (error) {
                throw new Error(`Error verificando disponibilidad: ${error.message}`);
            }

            const result = data[0];
            return {
                success: true,
                availableSlots: result.available_slots,
                suggestedTimes: result.suggested_times || [],
                availableTables: result.available_tables || [],
                hasAvailability: result.available_slots > 0
            };

        } catch (error) {
            console.error('❌ AvailabilityService.checkAvailability:', error);
            return {
                success: false,
                error: error.message,
                availableSlots: 0,
                suggestedTimes: [],
                availableTables: [],
                hasAvailability: false
            };
        }
    }

    /**
     * Reservar una mesa de forma transaccional
     * @param {Object} bookingData - Datos de la reserva
     * @returns {Promise<Object>} Resultado de la reserva
     */
    static async bookTable({
        restaurantId,
        date,
        time,
        partySize,
        channel = 'web',
        customer = {},
        durationMinutes = null,
        specialRequests = null
    }) {
        try {
            const { data, error } = await supabase.rpc('book_table', {
                p_restaurant_id: restaurantId,
                p_date: date,
                p_time: time,
                p_party_size: partySize,
                p_channel: channel,
                p_customer: customer,
                p_duration_minutes: durationMinutes,
                p_special_requests: specialRequests
            });

            if (error) {
                throw new Error(`Error realizando reserva: ${error.message}`);
            }

            const result = data[0];
            return {
                success: result.success,
                reservationId: result.reservation_id,
                tableInfo: result.table_info,
                message: result.message
            };

        } catch (error) {
            console.error('❌ AvailabilityService.bookTable:', error);
            return {
                success: false,
                error: error.message,
                message: `Error al procesar la reserva: ${error.message}`
            };
        }
    }

    /**
     * Liberar slot de una reserva cancelada
     * @param {string} reservationId - ID de la reserva
     * @returns {Promise<Object>} Resultado de la liberación
     */
    static async releaseReservationSlot(reservationId) {
        try {
            const { data, error } = await supabase.rpc('release_reservation_slot', {
                p_reservation_id: reservationId
            });

            if (error) {
                throw new Error(`Error liberando slot: ${error.message}`);
            }

            return {
                success: data,
                message: data ? 'Slot liberado correctamente' : 'No se pudo liberar el slot'
            };

        } catch (error) {
            console.error('❌ AvailabilityService.releaseReservationSlot:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generar slots de disponibilidad para un rango de fechas
     * @param {string} restaurantId - ID del restaurante
     * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
     * @param {string} endDate - Fecha de fin (YYYY-MM-DD, opcional)
     * @returns {Promise<Object>} Resultado de la generación
     */
    static async generateAvailabilitySlots(restaurantId, startDate, endDate = null) {
        try {
            const { data, error } = await supabase.rpc('generate_availability_slots_simple', {
                p_restaurant_id: restaurantId,
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) {
                throw new Error(`Error generando slots: ${error.message}`);
            }

            const result = data[0];
            return {
                success: true,
                slotsGenerated: result.slots_generated,
                dateRange: result.date_range,
                message: `Generados ${result.slots_generated} slots para el período ${result.date_range}`
            };

        } catch (error) {
            console.error('❌ AvailabilityService.generateAvailabilitySlots:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener slots de disponibilidad para una fecha específica
     * @param {string} restaurantId - ID del restaurante
     * @param {string} date - Fecha en formato YYYY-MM-DD
     * @param {string} status - Estado de los slots ('free', 'reserved', 'blocked', etc.)
     * @returns {Promise<Object>} Lista de slots
     */
    static async getAvailabilitySlots(restaurantId, date, status = 'free') {
        try {
            let query = supabase
                .from('availability_slots')
                .select(`
                    id, slot_date, start_time, end_time, status, shift_name,
                    tables (
                        id, name, capacity, table_type, is_active
                    ),
                    metadata
                `)
                .eq('restaurant_id', restaurantId)
                .eq('slot_date', date)
                .order('start_time');

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Error obteniendo slots: ${error.message}`);
            }

            return {
                success: true,
                slots: data || [],
                count: data?.length || 0
            };

        } catch (error) {
            console.error('❌ AvailabilityService.getAvailabilitySlots:', error);
            return {
                success: false,
                error: error.message,
                slots: [],
                count: 0
            };
        }
    }

    /**
     * Obtener horarios disponibles para una fecha (agrupados por turnos)
     * @param {string} restaurantId - ID del restaurante
     * @param {string} date - Fecha en formato YYYY-MM-DD
     * @param {number} partySize - Número de personas
     * @returns {Promise<Object>} Horarios disponibles agrupados
     */
    static async getAvailableTimeSlots(restaurantId, date, partySize = 2) {
        try {
            const { data, error } = await supabase
                .from('availability_slots')
                .select(`
                    start_time, end_time, shift_name,
                    tables (
                        id, name, capacity, table_type
                    )
                `)
                .eq('restaurant_id', restaurantId)
                .eq('slot_date', date)
                .eq('status', 'free')
                .gte('tables.capacity', partySize)
                .eq('tables.is_active', true)
                .order('start_time');

            if (error) {
                throw new Error(`Error obteniendo horarios: ${error.message}`);
            }

            // Agrupar por turnos y horarios
            const groupedSlots = {};
            data?.forEach(slot => {
                const shiftName = slot.shift_name || 'general';
                const timeKey = slot.start_time;

                if (!groupedSlots[shiftName]) {
                    groupedSlots[shiftName] = {};
                }

                if (!groupedSlots[shiftName][timeKey]) {
                    groupedSlots[shiftName][timeKey] = {
                        time: slot.start_time,
                        endTime: slot.end_time,
                        availableTables: []
                    };
                }

                groupedSlots[shiftName][timeKey].availableTables.push(slot.tables);
            });

            // Convertir a array estructurado
            const shifts = Object.keys(groupedSlots).map(shiftName => ({
                shiftName,
                timeSlots: Object.values(groupedSlots[shiftName]).map(slot => ({
                    ...slot,
                    availableCount: slot.availableTables.length
                }))
            }));

            return {
                success: true,
                shifts,
                totalSlots: data?.length || 0
            };

        } catch (error) {
            console.error('❌ AvailabilityService.getAvailableTimeSlots:', error);
            return {
                success: false,
                error: error.message,
                shifts: [],
                totalSlots: 0
            };
        }
    }

    /**
     * Crear evento especial (cierre, festivo, etc.)
     * @param {Object} eventData - Datos del evento
     * @returns {Promise<Object>} Resultado de la creación
     */
    static async createSpecialEvent({
        restaurantId,
        eventName,
        eventType,
        startDate,
        endDate,
        startTime = null,
        endTime = null,
        affectedTables = null,
        description = null
    }) {
        try {
            const { data, error } = await supabase
                .from('special_events')
                .insert({
                    restaurant_id: restaurantId,
                    event_name: eventName,
                    event_type: eventType,
                    start_date: startDate,
                    end_date: endDate,
                    start_time: startTime,
                    end_time: endTime,
                    affected_tables: affectedTables,
                    description: description,
                    is_active: true
                })
                .select()
                .single();

            if (error) {
                throw new Error(`Error creando evento: ${error.message}`);
            }

            // Regenerar slots afectados
            await this.generateAvailabilitySlots(restaurantId, startDate, endDate);

            return {
                success: true,
                event: data,
                message: 'Evento especial creado y slots regenerados'
            };

        } catch (error) {
            console.error('❌ AvailabilityService.createSpecialEvent:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validar si una fecha/hora está disponible para reservas
     * @param {string} restaurantId - ID del restaurante
     * @param {string} date - Fecha en formato YYYY-MM-DD
     * @param {string} time - Hora en formato HH:MM
     * @returns {Promise<Object>} Resultado de validación
     */
    static async validateBookingTime(restaurantId, date, time) {
        try {
            // 1. Verificar configuración del restaurante
            const { data: restaurant, error: restaurantError } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', restaurantId)
                .single();

            if (restaurantError) {
                throw new Error(`Error obteniendo configuración: ${restaurantError.message}`);
            }

            const settings = restaurant.settings || {};
            const minAdvanceHours = settings.min_advance_hours || 2;
            const allowSameDayBookings = settings.allow_same_day_bookings !== false;

            // 2. Validar tiempo mínimo de antelación
            const bookingDateTime = new Date(`${date}T${time}`);
            const minBookingTime = new Date();
            minBookingTime.setHours(minBookingTime.getHours() + minAdvanceHours);

            if (bookingDateTime < minBookingTime) {
                return {
                    valid: false,
                    reason: `Reserva demasiado próxima. Mínimo ${minAdvanceHours} horas de antelación`,
                    code: 'MIN_ADVANCE_TIME'
                };
            }

            // 3. Validar reservas del mismo día si está deshabilitado
            if (!allowSameDayBookings) {
                const today = new Date().toISOString().split('T')[0];
                if (date === today) {
                    return {
                        valid: false,
                        reason: 'No se permiten reservas para el mismo día',
                        code: 'SAME_DAY_DISABLED'
                    };
                }
            }

            // 4. Verificar si hay eventos especiales que afecten esta fecha/hora
            const { data: events, error: eventsError } = await supabase
                .from('special_events')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('is_active', true)
                .lte('start_date', date)
                .gte('end_date', date);

            if (eventsError) {
                console.warn('Error verificando eventos especiales:', eventsError);
            }

            const blockingEvent = events?.find(event => {
                if (event.event_type === 'closure' || event.event_type === 'holiday') {
                    // Si no hay horas específicas, bloquea todo el día
                    if (!event.start_time && !event.end_time) return true;
                    
                    // Si hay horas específicas, verificar si la hora solicitada está en el rango
                    if (event.start_time && event.end_time) {
                        return time >= event.start_time && time <= event.end_time;
                    }
                }
                return false;
            });

            if (blockingEvent) {
                return {
                    valid: false,
                    reason: `${blockingEvent.event_name}: ${blockingEvent.description || 'No disponible'}`,
                    code: 'SPECIAL_EVENT_BLOCK'
                };
            }

            return {
                valid: true,
                message: 'Fecha y hora válidas para reserva'
            };

        } catch (error) {
            console.error('❌ AvailabilityService.validateBookingTime:', error);
            return {
                valid: false,
                reason: `Error de validación: ${error.message}`,
                code: 'VALIDATION_ERROR'
            };
        }
    }

    /**
     * Inicializar sistema de disponibilidades para un restaurante
     * @param {string} restaurantId - ID del restaurante
     * @returns {Promise<Object>} Resultado de la inicialización
     */
    static async initializeAvailabilitySystem(restaurantId) {
        try {
            const { data, error } = await supabase.rpc('initialize_availability_system', {
                p_restaurant_id: restaurantId
            });

            if (error) {
                throw new Error(`Error inicializando sistema: ${error.message}`);
            }

            return {
                success: true,
                message: data
            };

        } catch (error) {
            console.error('❌ AvailabilityService.initializeAvailabilitySystem:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default AvailabilityService;
