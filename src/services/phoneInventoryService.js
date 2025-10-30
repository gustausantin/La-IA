/**
 * Phone Inventory Service
 * Gestión del pool de números telefónicos
 */

import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

/**
 * Asigna un número telefónico disponible del pool a un negocio
 * @param {string} businessId - UUID del negocio
 * @returns {Promise<{success: boolean, assigned_phone?: string, error?: string}>}
 */
export const assignAvailableNumber = async (businessId) => {
  try {
    logger.info('📞 [PhoneInventory] Solicitando número para business_id:', businessId);

    const { data, error } = await supabase.functions.invoke('assign-available-number', {
      body: { business_id: businessId }
    });

    if (error) {
      logger.error('❌ [PhoneInventory] Error en Edge Function:', error);
      return {
        success: false,
        error: 'FUNCTION_ERROR',
        message: 'La función de asignación de números no está disponible. Por favor, contacta al administrador.'
      };
    }

    if (!data.success) {
      logger.error('❌ [PhoneInventory] Edge Function retornó error:', data);
      
      // Caso especial: Inventario agotado
      if (data.error === 'NO_INVENTORY') {
        return {
          success: false,
          error: 'NO_INVENTORY',
          message: data.message || 'No hay números disponibles en este momento.'
        };
      }

      return {
        success: false,
        error: data.error,
        message: data.message
      };
    }

    logger.info('✅ [PhoneInventory] Número asignado exitosamente:', data.assigned_phone);

    return {
      success: true,
      assigned_phone: data.assigned_phone
    };

  } catch (error) {
    logger.error('💥 [PhoneInventory] Error inesperado:', error);
    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: 'Error al asignar número telefónico. Por favor, intenta de nuevo.'
    };
  }
};

/**
 * Libera el número asignado a un negocio (lo pone en cuarentena 48h)
 * @param {string} businessId - UUID del negocio
 * @returns {Promise<{success: boolean, released_phone?: string, error?: string}>}
 */
export const releaseBusinessNumber = async (businessId) => {
  try {
    logger.info('🔓 [PhoneInventory] Liberando número para business_id:', businessId);

    const { data, error } = await supabase.functions.invoke('release-business-number', {
      body: { business_id: businessId }
    });

    if (error) {
      logger.error('❌ [PhoneInventory] Error en Edge Function:', error);
      throw error;
    }

    if (!data.success) {
      logger.error('❌ [PhoneInventory] Edge Function retornó error:', data);
      return {
        success: false,
        error: data.error,
        message: data.message
      };
    }

    logger.info('✅ [PhoneInventory] Número liberado:', data.released_phone);

    return {
      success: true,
      released_phone: data.released_phone,
      quarantine_until: data.quarantine_until
    };

  } catch (error) {
    logger.error('💥 [PhoneInventory] Error inesperado:', error);
    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: 'Error al liberar número telefónico.'
    };
  }
};

/**
 * Obtiene el estado actual del inventario (para admin/debug)
 * @returns {Promise<{available: number, assigned: number, quarantined: number}>}
 */
export const getInventoryStatus = async () => {
  try {
    const { data, error } = await supabase
      .from('inventario_telefonos')
      .select('status');

    if (error) throw error;

    const status = {
      available: 0,
      assigned: 0,
      quarantined: 0
    };

    data.forEach(row => {
      if (row.status === 'disponible') status.available++;
      else if (row.status === 'asignado') status.assigned++;
      else if (row.status === 'en_cuarentena') status.quarantined++;
    });

    return status;

  } catch (error) {
    logger.error('💥 [PhoneInventory] Error obteniendo estado:', error);
    return { available: 0, assigned: 0, quarantined: 0 };
  }
};

