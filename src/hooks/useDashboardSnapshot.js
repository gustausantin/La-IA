import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

/**
 * Hook personalizado para obtener el "snapshot" del dashboard
 * Llama a la Edge Function get-snapshot cada 2 minutos
 * Retorna el escenario actual detectado por el backend
 */
export const useDashboardSnapshot = (businessId) => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchSnapshot = useCallback(async () => {
    if (!businessId) {
      logger.warn('useDashboardSnapshot: No businessId provided');
      setLoading(false);
      return;
    }

    try {
      logger.info('📊 Fetching dashboard snapshot for business:', businessId);
      
      // ⏱️ Iniciar medición de tiempo
      const startTime = performance.now();
      
      // Llamada a la Edge Function get-snapshot
      const { data, error: functionError } = await supabase.functions.invoke('get-snapshot', {
        body: { 
          business_id: businessId,
          timestamp: new Date().toISOString()
        }
      });
      
      // ⏱️ Finalizar medición de tiempo
      const endTime = performance.now();
      const totalTime = Math.round(endTime - startTime);
      
      logger.info(`⏱️ TIMING CLIENT: get-snapshot completado en ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);

      if (functionError) {
        throw functionError;
      }

      if (!data) {
        throw new Error('No data returned from get-snapshot');
      }

      logger.info('✅ Snapshot received:', data.prioridad || data.scenario);
      
      setSnapshot(data);
      setLastUpdate(new Date());
      setError(null);

    } catch (err) {
      logger.error('❌ Error fetching dashboard snapshot:', err);
      setError(err);
      
      // Fallback: mostrar escenario de error (nuevo formato)
      setSnapshot({
        prioridad: 'ERROR',
        mood: 'serious',
        mensaje: 'Hubo un problema al analizar el estado. Intenta refrescar.',
        accion: {
          id: 'refresh',
          label: '🔄 Refrescar',
          tipo: 'navigate',
          payload: { route: '/dashboard-socio-virtual' }
        },
        data: {},
        metadata: {}
      });
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Auto-refresh cada 2 minutos
  useEffect(() => {
    if (!businessId) return;

    // Fetch inicial
    fetchSnapshot();

    // Interval para auto-refresh
    const interval = setInterval(() => {
      logger.info('🔄 Auto-refreshing dashboard snapshot...');
      fetchSnapshot();
    }, 120000); // 2 minutos

    return () => {
      clearInterval(interval);
    };
  }, [businessId, fetchSnapshot]);

  return {
    snapshot,
    loading,
    error,
    lastUpdate,
    refresh: fetchSnapshot
  };
};

export default useDashboardSnapshot;


