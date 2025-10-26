// useOccupancy.js - Hook para obtener ocupación en tiempo real
import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { calculateOccupancy, calculateTodayOccupancy } from '../utils/occupancyCalculator';

export const useOccupancy = (period = 7) => {
    const { restaurantId } = useAuthContext();
    const [occupancy, setOccupancy] = useState({
        average: 0,
        today: 0,
        details: {},
        todayDetails: {}
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadOccupancy = useCallback(async () => {
        if (!restaurantId) {
            setOccupancy({ average: 0, today: 0, details: {}, todayDetails: {} });
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🏢 Cargando ocupación...', { restaurantId, period });

            // Cargar ocupación promedio y de hoy en paralelo
            const [averageResult, todayResult] = await Promise.allSettled([
                calculateOccupancy(restaurantId, period),
                calculateTodayOccupancy(restaurantId)
            ]);

            const average = averageResult.status === 'fulfilled' 
                ? averageResult.value.occupancy 
                : 0;
            const averageDetails = averageResult.status === 'fulfilled' 
                ? averageResult.value.details 
                : {};

            const today = todayResult.status === 'fulfilled' 
                ? todayResult.value.occupancy 
                : 0;
            const todayDetails = todayResult.status === 'fulfilled' 
                ? todayResult.value.details 
                : {};

            setOccupancy({
                average,
                today,
                details: averageDetails,
                todayDetails
            });

            console.log('✅ Ocupación cargada:', { average, today });

        } catch (err) {
            console.error('❌ Error cargando ocupación:', err);
            setError(err.message);
            setOccupancy({ average: 0, today: 0, details: {}, todayDetails: {} });
        } finally {
            setLoading(false);
        }
    }, [restaurantId, period]);

    // Cargar ocupación al montar y cuando cambien las dependencias
    useEffect(() => {
        loadOccupancy();
    }, [loadOccupancy]);

    // Recargar cada 5 minutos
    useEffect(() => {
        if (!restaurantId) return;

        const interval = setInterval(() => {
            console.log('🔄 Recargando ocupación automáticamente...');
            loadOccupancy();
        }, 5 * 60 * 1000); // 5 minutos

        return () => clearInterval(interval);
    }, [restaurantId, loadOccupancy]);

    return {
        occupancy,
        loading,
        error,
        refresh: loadOccupancy
    };
};
