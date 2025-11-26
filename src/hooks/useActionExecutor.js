import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

/**
 * Hook para ejecutar acciones del dashboard
 * Maneja: transferir citas, cancelar, generar ofertas, navegación
 */
export const useActionExecutor = () => {
  const [executing, setExecuting] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);

  /**
   * Mostrar modal de confirmación para acciones destructivas
   */
  const showConfirmationModal = useCallback((action) => {
    return new Promise((resolve) => {
      const message = getConfirmationMessage(action);
      const confirmed = window.confirm(message);
      resolve(confirmed);
    });
  }, []);

  /**
   * Generar mensaje de confirmación según la acción
   */
  const getConfirmationMessage = (action) => {
    switch (action.id) {
      case 'transfer_appointments':
        return `⚠️ ¿Estás seguro de que quieres transferir las citas?\n\nSe enviarán WhatsApps a los clientes afectados.\n\n✓ Esta acción se puede revertir si es necesario.`;
      
      case 'cancel_appointments':
        return `⚠️ ¿Estás seguro de que quieres cancelar las citas?\n\nSe enviarán mensajes de reagendado a los clientes.\n\n⚠️ Esta acción liberará los slots de disponibilidad.`;
      
      case 'generate_offer':
        return `💡 ¿Generar oferta flash para este hueco?\n\nSe usará OpenAI para crear el texto.\n\n✓ Luego podrás editarlo antes de publicar.`;
      
      default:
        return `¿Confirmas esta acción: ${action.label}?`;
    }
  };

  /**
   * Ejecutar acción
   */
  const executeAction = useCallback(async (action) => {
    if (!action) {
      logger.warn('useActionExecutor: No action provided');
      return { success: false, error: 'No action provided' };
    }

    setCurrentAction(action);
    setExecuting(true);

    try {
      logger.info('🎯 Executing action:', action.id);

      // 1. Validar si necesita confirmación
      if (action.type === 'destructive') {
        const confirmed = await showConfirmationModal(action);
        
        if (!confirmed) {
          logger.info('❌ Action cancelled by user');
          toast('Acción cancelada', { icon: '🚫' });
          return { success: false, cancelled: true };
        }
      }

      // 2. Ejecutar según tipo de acción
      if (action.endpoint) {
        // Acción que requiere Edge Function
        const functionName = action.endpoint.replace('/functions/v1/', '');
        
        logger.info(`📡 Calling Edge Function: ${functionName}`);
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: action.payload
        });

        if (error) {
          throw error;
        }

        logger.info('✅ Action executed successfully:', data);
        
        // Feedback visual
        toast.success(getSuccessMessage(action.id));
        
        return { success: true, data };

      } else if (action.payload?.route) {
        // Acción de navegación
        logger.info(`🔗 Navigating to: ${action.payload.route}`);
        window.location.href = action.payload.route;
        return { success: true, navigated: true };

      } else if (action.payload?.action === 'refresh') {
        // Acción de refresh
        logger.info('🔄 Refreshing page...');
        window.location.reload();
        return { success: true, refreshed: true };

      } else {
        throw new Error('Unknown action type');
      }

    } catch (err) {
      logger.error('❌ Error executing action:', err);
      toast.error(`Error: ${err.message}`);
      return { success: false, error: err.message };

    } finally {
      setExecuting(false);
      setCurrentAction(null);
    }
  }, [showConfirmationModal]);

  /**
   * Mensajes de éxito según acción
   */
  const getSuccessMessage = (actionId) => {
    switch (actionId) {
      case 'transfer_appointments':
        return '✅ Citas transferidas y clientes notificados';
      case 'cancel_appointments':
        return '✅ Citas canceladas y mensajes enviados';
      case 'generate_offer':
        return '✨ Oferta generada con éxito';
      default:
        return '✅ Acción completada';
    }
  };

  return {
    executeAction,
    executing,
    currentAction
  };
};

export default useActionExecutor;








