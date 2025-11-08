import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export const useOccupancyData = (businessId, selectedDate, selectedZone) => {
    const [occupancyData, setOccupancyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState(null);

    const fetchOccupancyData = useCallback(async () => {
        if (!businessId || !selectedDate) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');

            // 1. Obtener todas las mesas activas del restaurante
            let tablesQuery = supabase
                .from('resources')
                .select('id, name, capacity, is_active')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name', { ascending: true });

            const { data: tables, error: tablesError } = await tablesQuery;
            if (tablesError) throw tablesError;

            if (!tables || tables.length === 0) {
                setOccupancyData([]);
                setMetrics(null);
                setLoading(false);
                return;
            }

            console.log('📊 Mesas encontradas:', tables.length, tables);

            const tableIds = tables.map(table => table.id);

            // 2. Obtener slots de disponibilidad para la fecha y mesas seleccionadas
            // ✅ availability_slots usa resource_id, NO table_id
            const { data: slots, error: slotsError } = await supabase
                .from('availability_slots')
                .select('id, resource_id, start_time, end_time, status, appointment_id')
                .eq('business_id', businessId)
                .eq('slot_date', dateStr)
                .in('resource_id', tableIds)
                .order('start_time', { ascending: true });

            if (slotsError) throw slotsError;
            
            console.log('🎯 Slots encontrados para', dateStr, ':', slots?.length || 0);
            
            // ✅ SLOTS MAPEADOS CON resource_id y appointment_id
            const inconsistentSlots = slots?.filter(s => s.status === 'reserved' && !s.appointment_id) || [];
            if (inconsistentSlots.length > 0) {
                console.warn('⚠️ Slots reservados sin appointment_id:', inconsistentSlots.length);
            }
            
            console.log('📍 Slots por recurso:', tableIds.map(tid => ({
                resource_id: tid,
                resource_name: tables.find(t => t.id === tid)?.name,
                slots_count: slots?.filter(s => s.resource_id === tid).length || 0,
                reserved: slots?.filter(s => s.resource_id === tid && s.status === 'reserved').length || 0,
                with_appointment: slots?.filter(s => s.resource_id === tid && s.status === 'reserved' && s.appointment_id).length || 0
            })));

            // 3. Obtener detalles de reservas para los slots ocupados
            const reservedSlotIds = slots
                ?.filter(s => s.status === 'reserved' && s.appointment_id)
                .map(s => s.appointment_id) || [];

            let reservations = [];
            if (reservedSlotIds.length > 0) {
                const { data: fetchedReservations, error: reservationsError } = await supabase
                    .from('appointments')
                    .select('id, customer_name, party_size, special_requests, status')
                    .in('id', reservedSlotIds);

                if (reservationsError) throw reservationsError;
                reservations = fetchedReservations || [];
            }

            // 4. Combinar datos y calcular métricas
            let totalSlots = 0;
            let reservedSlots = 0;
            let freeSlots = 0;
            let totalRevenue = 0;
            const averageTicketPrice = 45; // Esto debería venir de restaurant_settings
            const tableStats = [];

            const combinedData = tables.map(table => {
                const tableSlots = slots?.filter(s => s.resource_id === table.id) || [];
                const tableSlotsReserved = tableSlots.filter(s => s.status === 'reserved').length;
                const tableSlotsFree = tableSlots.filter(s => s.status === 'free').length;
                
                totalSlots += tableSlots.length;
                reservedSlots += tableSlotsReserved;
                freeSlots += tableSlotsFree;

                const slotsWithReservationInfo = tableSlots.map(slot => {
                    const reservation = reservations.find(r => r.id === slot.appointment_id);
                    if (reservation) {
                        totalRevenue += (reservation.party_size || 1) * averageTicketPrice;
                    }
                    return {
                        ...slot,
                        reservation_info: reservation ? {
                            customer_name: reservation.customer_name,
                            party_size: reservation.party_size,
                            special_requests: reservation.special_requests,
                            status: reservation.status,
                        } : null,
                    };
                });

                // Estadísticas por mesa
                tableStats.push({
                    tableId: table.id,
                    tableName: table.name,
                    zone: 'general',
                    capacity: table.capacity,
                    totalCount: tableSlots.length,
                    reservedCount: tableSlotsReserved,
                    freeCount: tableSlotsFree,
                    occupancyRate: tableSlots.length > 0 
                        ? (tableSlotsReserved / tableSlots.length) * 100 
                        : 0,
                });

                return {
                    table_id: table.id,
                    table_name: table.name,
                    table_capacity: table.capacity,
                    table_zone: 'general',
                    slots: slotsWithReservationInfo,
                };
            });

            // Calcular métricas globales
            const occupancyRate = totalSlots > 0 ? (reservedSlots / totalSlots) * 100 : 0;

            // Encontrar hora pico
            const hourCounts = {};
            slots?.forEach(slot => {
                if (slot.status === 'reserved') {
                    const hour = slot.start_time.substring(0, 5);
                    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                }
            });

            const peakHour = Object.entries(hourCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

            setMetrics({
                occupancyRate: occupancyRate.toFixed(1),
                totalSlots,
                reservedSlots,
                freeSlots,
                peakHour,
                estimatedRevenue: totalRevenue.toFixed(2),
                tableStats,
            });

            setOccupancyData(combinedData);

        } catch (err) {
            console.error("Error fetching occupancy data:", err);
            setError(err.message);
            toast.error("Error al cargar datos de ocupación: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [businessId, selectedDate, selectedZone]);

    useEffect(() => {
        fetchOccupancyData();
    }, [fetchOccupancyData]);

    return { 
        occupancyData, 
        metrics,
        loading, 
        error, 
        reload: fetchOccupancyData 
    };
};

