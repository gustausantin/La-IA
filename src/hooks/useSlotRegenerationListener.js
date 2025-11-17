// =====================================================
// HOOK: Escuchar notificaciones de regeneración automática
// =====================================================

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AutoSlotRegenerationService } from '../services/AutoSlotRegenerationService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

/**
 * Hook para escuchar notificaciones de regeneración automática desde triggers de PostgreSQL
 * @param {boolean} enabled - Si está habilitado (default: true)
 * @param {Function} onRegenerationComplete - Callback cuando se completa la regeneración
 * @returns {Object} { isListening, lastRegeneration }
 */
export const useSlotRegenerationListener = (enabled = true, onRegenerationComplete = null) => {
  const { businessId } = useAuth();
  const channelRef = useRef(null);
  const isListeningRef = useRef(false);
  const lastRegenerationRef = useRef(null);

  useEffect(() => {
    if (!enabled || !businessId) {
      return;
    }

    // Crear canal de suscripción
    const channel = supabase
      .channel('slot_regeneration_listener')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots'
        },
        (payload) => {
          console.log('📡 Cambio detectado en availability_slots:', payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios de availability_slots');
        }
      });

    // Escuchar notificaciones de PostgreSQL (pg_notify)
    const handleNotification = async (payload) => {
      try {
        const data = JSON.parse(payload);
        
        // Solo procesar notificaciones para este negocio
        if (data.business_id !== businessId) {
          return;
        }

        console.log('🔔 Notificación de regeneración recibida:', data);

        // Regenerar slots automáticamente
        const result = await AutoSlotRegenerationService.regenerate(
          businessId,
          data.reason || 'automatic_trigger',
          {
            silent: true, // No mostrar toast automático
            advanceDays: 30 // Usar valor por defecto
          }
        );

        if (result.success) {
          lastRegenerationRef.current = {
            timestamp: new Date(),
            reason: data.reason,
            slotsUpdated: result.slotsUpdated
          };

          // Mostrar toast informativo
          toast.success(
            `⚡ Disponibilidad actualizada automáticamente (${result.slotsUpdated} slots)`,
            {
              duration: 3000,
              position: 'bottom-center',
              icon: '✅'
            }
          );

          // Llamar callback si existe
          if (onRegenerationComplete) {
            onRegenerationComplete(result);
          }

          // Disparar evento personalizado para que otros componentes se actualicen
          window.dispatchEvent(new CustomEvent('availabilityRegenerated', {
            detail: {
              reason: data.reason,
              slotsUpdated: result.slotsUpdated,
              timestamp: new Date()
            }
          }));
        } else {
          console.error('❌ Error en regeneración automática:', result.errorMessage);
          // No mostrar error automático para no molestar al usuario
        }
      } catch (error) {
        console.error('❌ Error procesando notificación:', error);
      }
    };

    // Suscribirse a notificaciones de PostgreSQL
    // NOTA: pg_notify no está disponible directamente en el cliente de Supabase
    // Necesitamos usar un enfoque alternativo: polling o webhooks
    
    // Por ahora, usamos el canal de cambios de Supabase
    // En el futuro, podríamos implementar un webhook o usar Supabase Realtime
    
    channelRef.current = channel;
    isListeningRef.current = true;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isListeningRef.current = false;
      }
    };
  }, [enabled, businessId, onRegenerationComplete]);

  return {
    isListening: isListeningRef.current,
    lastRegeneration: lastRegenerationRef.current
  };
};

export default useSlotRegenerationListener;

