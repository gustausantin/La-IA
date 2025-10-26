
// src/lib/restaurantService.js
import { supabase } from './supabase';

/**
 * Obtiene el restaurante asociado al usuario autenticado
 * @param {Object} authUser - Usuario autenticado de Supabase
 * @returns {Promise<Object>} Datos del restaurante y rol del usuario
 */
export async function getMiRestaurante(authUser) {
  try {
    const { data, error } = await supabase
      .from('user_restaurant_mapping')
      .select(`
        role,
        permissions,
        restaurant:restaurant_id (
          id,
          name,
          address,
          phone,
          email,
          website,
          logo_url,
          cuisine_type,
          city,
          postal_code,
          country,
          settings,
          created_at
        )
      `)
      .eq('auth_user_id', authUser.id)
      .single();

    if (error) {
      throw error;
    }

    return {
      restaurant: data.restaurant,
      role: data.role,
      permissions: data.permissions || []
    };
  } catch (error) {
    throw error;
  }
}

/** Devuelve el mapping y el restaurante por defecto del usuario */
export async function getUserRestaurant(authUserId) {
  const { data, error } = await supabase
    .from('user_restaurant_mapping')
    .select(`
      role,
      permissions,
      restaurant:restaurant_id (*)
    `)
    .eq('auth_user_id', authUserId)  // ← clave correcta
    .single();

  if (error) throw error;
  return data; // { role, permissions, restaurant: {...} }
}

/** Inserta el vínculo usuario⇄restaurante (si creas uno por defecto) */
export async function linkUserToRestaurant({ authUserId, restaurantId, role = 'owner' }) {
  const { error } = await supabase
    .from('user_restaurant_mapping')
    .insert({
      auth_user_id: authUserId,      // ← clave correcta
      restaurant_id: restaurantId,
      role,
      permissions: {}
    });
  if (error) throw error;
}

/**
 * Verifica si el usuario tiene permisos específicos
 * @param {Object} authUser - Usuario autenticado
 * @param {string} permission - Permiso a verificar
 * @returns {Promise<boolean>} True si tiene el permiso
 */
export async function hasPermission(authUser, permission) {
  try {
    const { data } = await supabase
      .from('user_restaurant_mapping')
      .select('permissions, role')
      .eq('auth_user_id', authUser.id)
      .single();

    if (!data) return false;

    // Los owners tienen todos los permisos
    if (data.role === 'owner') return true;

    // Verificar en el array de permisos
    return data.permissions && data.permissions.includes(permission);
  } catch (error) {
    return false;
  }
}
