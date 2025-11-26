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
      
      // ⏰ TIMEOUT: Si no responde en 30 segundos, cancelar
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        logger.error('⏰ TIMEOUT: get-snapshot no respondió en 30 segundos');
      }, 30000);
      
      // Llamada a la Edge Function get-snapshot
      const { data, error: functionError } = await supabase.functions.invoke('get-snapshot', {
        body: { 
          business_id: businessId,
          timestamp: new Date().toISOString()
        }
      });
      
      clearTimeout(timeoutId);
      
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
      const errorMessage = err.name === 'AbortError' 
        ? '⏰ La conexión está tardando demasiado. ¿Está Docker Desktop iniciado?' 
        : 'Hubo un problema al analizar el estado. Intenta refrescar.';
      
      setSnapshot({
        prioridad: 'ERROR',
        mood: 'serious',
        mensaje: errorMessage,
        accion: {
          id: 'refresh',
          label: '🔄 Refrescar',
          tipo: 'navigate',
          payload: { route: '/dashboard-socio-virtual' }
        },
        bloques: [
          {
            id: 1,
            categoria: 'sistema',
            titulo: '⚠️ Error de Conexión',
            resumen: 'No se pudo conectar con el servidor',
            estado: 'problema',
            prioridad: 'alto',
            microdatos: [{ texto: 'Error', color: 'rojo', icono: '❌' }]
          }
        ],
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


