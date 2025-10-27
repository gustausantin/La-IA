// occupancyCalculator.js - Cálculo avanzado de ocupación
import { supabase } from '../lib/supabase';
import { format, parseISO, differenceInHours, isWithinInterval } from 'date-fns';

/**
 * Calcula la ocupación promedio real del restaurante
 * @param {string} restaurantId - ID del restaurante
 * @param {number} days - Número de días hacia atrás para calcular (default: 7)
 * @returns {Promise<{occupancy: number, details: object}>}
 */
export const calculateOccupancy = async (restaurantId, days = 7) => {
    try {
        const today = new Date();
        const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
        
        console.log(`📊 Calculando ocupación para ${days} días desde ${format(startDate, 'yyyy-MM-dd')}`);

        // 1. Obtener configuración del restaurante (horarios y mesas)
        const { data: restaurant, error: restaurantError } = await supabase
            .from("businesses")
            .select("settings")
            .eq("id", restaurantId)
            .single();

        if (restaurantError) throw restaurantError;

        const operatingHours = restaurant?.settings?.operating_hours || {};
        
        // 2. Obtener mesas activas (excluyendo mantenimiento)
        const { data: tables, error: tablesError } = await supabase
            .from("tables")
            .select("id, capacity, status")
            .eq("restaurant_id", restaurantId)
            .eq("is_active", true)
            .neq("status", "maintenance");

        if (tablesError) throw tablesError;

        const totalTableCapacity = tables.reduce((sum, table) => sum + (table.capacity || 0), 0);
        
        // 3. Obtener reservas confirmadas del período
        const { data: reservations, error: reservationsError } = await supabase
            .from("reservations")
            .select(`
                id, party_size, reservation_date, reservation_time, 
                table_id, status, created_at
            `)
            .eq("restaurant_id", restaurantId)
            .gte("reservation_date", format(startDate, 'yyyy-MM-dd'))
            .lte("reservation_date", format(today, 'yyyy-MM-dd'))
            .in("status", ["confirmada", "completed"]);

        if (reservationsError) throw reservationsError;

        // 4. Calcular ocupación por día
        const dailyOccupancy = [];
        let totalOccupancyHours = 0;
        let totalPossibleHours = 0;

        for (let d = 0; d < days; d++) {
            const currentDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
            const dayKey = format(currentDate, 'EEEE').toLowerCase(); // monday, tuesday, etc.
            const dayHours = operatingHours[dayKey];
            
            // Verificar si el restaurante está abierto ese día
            if (!dayHours || dayHours.closed) {
                dailyOccupancy.push({
                    date: format(currentDate, 'yyyy-MM-dd'),
                    occupancy: 0,
                    closed: true
                });
                continue;
            }

            // Calcular horas de operación
            const openTime = dayHours.open || "09:00";
            const closeTime = dayHours.close || "22:00";
            const openHour = parseInt(openTime.split(':')[0]);
            const closeHour = parseInt(closeTime.split(':')[0]);
            const operatingHoursCount = closeHour - openHour;

            if (operatingHoursCount <= 0) {
                dailyOccupancy.push({
                    date: format(currentDate, 'yyyy-MM-dd'),
                    occupancy: 0,
                    invalidHours: true
                });
                continue;
            }

            // Filtrar reservas de este día
            const dayReservations = reservations.filter(res => 
                res.reservation_date === format(currentDate, 'yyyy-MM-dd')
            );

            // Calcular ocupación por cada hora de operación
            let dayOccupiedHours = 0;
            
            for (let hour = openHour; hour < closeHour; hour++) {
                // Encontrar reservas que ocupan esta hora
                const hourReservations = dayReservations.filter(res => {
                    const resHour = parseInt(res.reservation_time?.split(':')[0] || '0');
                    // Asumir que cada reserva dura 2 horas en promedio
                    return resHour <= hour && hour < resHour + 2;
                });

                const hourGuests = hourReservations.reduce((sum, res) => sum + (res.party_size || 0), 0);
                const hourOccupancy = totalTableCapacity > 0 ? Math.min(hourGuests / totalTableCapacity, 1) : 0;
                
                dayOccupiedHours += hourOccupancy;
            }

            const dayOccupancyPercent = operatingHoursCount > 0 ? (dayOccupiedHours / operatingHoursCount) * 100 : 0;
            
            dailyOccupancy.push({
                date: format(currentDate, 'yyyy-MM-dd'),
                occupancy: Math.round(dayOccupancyPercent),
                reservations: dayReservations.length,
                guests: dayReservations.reduce((sum, res) => sum + (res.party_size || 0), 0),
                operatingHours: operatingHoursCount
            });

            totalOccupancyHours += dayOccupiedHours;
            totalPossibleHours += operatingHoursCount;
        }

        // 5. Calcular ocupación promedio general
        const averageOccupancy = totalPossibleHours > 0 
            ? Math.round((totalOccupancyHours / totalPossibleHours) * 100)
            : 0;

        // 6. Calcular estadísticas adicionales
        const totalReservations = reservations.length;
        const totalGuests = reservations.reduce((sum, res) => sum + (res.party_size || 0), 0);
        const averagePartySize = totalReservations > 0 ? Math.round((totalGuests / totalReservations) * 10) / 10 : 0;
        
        // Buscar día más ocupado
        const busiestDay = dailyOccupancy.reduce((max, day) => 
            day.occupancy > max.occupancy ? day : max, 
            { occupancy: 0, date: '' }
        );

        console.log(`✅ Ocupación calculada: ${averageOccupancy}%`, {
            totalReservations,
            totalGuests,
            averagePartySize,
            busiestDay: busiestDay.date,
            totalTableCapacity
        });

        return {
            occupancy: averageOccupancy,
            details: {
                totalReservations,
                totalGuests,
                averagePartySize,
                totalTableCapacity,
                activeTables: tables.length,
                busiestDay,
                dailyOccupancy,
                calculationPeriod: {
                    startDate: format(startDate, 'yyyy-MM-dd'),
                    endDate: format(today, 'yyyy-MM-dd'),
                    days
                }
            }
        };

    } catch (error) {
        console.error("❌ Error calculando ocupación:", error);
        return {
            occupancy: 0,
            details: {
                error: error.message,
                totalReservations: 0,
                totalGuests: 0,
                averagePartySize: 0,
                totalTableCapacity: 0,
                activeTables: 0
            }
        };
    }
};

/**
 * Calcula la ocupación en tiempo real para un día específico
 * @param {string} restaurantId - ID del restaurante
 * @param {Date} date - Fecha para calcular (default: hoy)
 * @returns {Promise<object>}
 */
export const calculateTodayOccupancy = async (restaurantId, date = new Date()) => {
    try {
        const dateString = format(date, 'yyyy-MM-dd');
        const dayKey = format(date, 'EEEE').toLowerCase();
        
        // Obtener horarios y reservas de hoy
        const [restaurantRes, tablesRes, reservationsRes] = await Promise.all([
            supabase
                .from("businesses")
                .select("settings")
                .eq("id", restaurantId)
                .single(),
            supabase
                .from("tables")
                .select("id, capacity, status")
                .eq("restaurant_id", restaurantId)
                .eq("is_active", true)
                .neq("status", "maintenance"),
            supabase
                .from("reservations")
                .select("id, party_size, reservation_time, table_id, status")
                .eq("restaurant_id", restaurantId)
                .eq("reservation_date", dateString)
                .in("status", ["confirmada", "completed"])
        ]);

        const operatingHours = restaurantRes.data?.settings?.operating_hours?.[dayKey];
        const tables = tablesRes.data || [];
        const reservations = reservationsRes.data || [];

        if (!operatingHours || operatingHours.closed) {
            return {
                occupancy: 0,
                status: 'closed',
                message: 'Restaurante cerrado hoy'
            };
        }

        const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity || 0), 0);
        const totalGuests = reservations.reduce((sum, res) => sum + (res.party_size || 0), 0);
        
        // Ocupación simple para hoy
        const occupancy = totalCapacity > 0 ? Math.round((totalGuests / totalCapacity) * 100) : 0;

        return {
            occupancy: Math.min(occupancy, 100), // Cap at 100%
            status: 'open',
            details: {
                totalReservations: reservations.length,
                totalGuests,
                totalCapacity,
                activeTables: tables.length,
                operatingHours
            }
        };

    } catch (error) {
        console.error("❌ Error calculando ocupación de hoy:", error);
        return {
            occupancy: 0,
            status: 'error',
            message: error.message
        };
    }
};
