
// src/lib/businessService.js
import { supabase } from './supabase';

/**
 * Obtiene el negocio asociado al usuario autenticado
 * @param {Object} authUser - Usuario autenticado de Supabase
 * @returns {Promise<Object>} Datos del negocio y rol del usuario
 */
export async function getMiBusiness(authUser) {
  try {
    const { data, error } = await supabase
      .from('user_business_mapping')
      .select(`
        role,
        permissions,
        business:business_id (
          id,
          name,
          address,
          phone,
          email,
          website,
          logo_url,
          vertical_type,
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
      business: data.business,
      role: data.role,
      permissions: data.permissions || []
    };
  } catch (error) {
    throw error;
  }
}

/** Devuelve el mapping y el negocio por defecto del usuario */
export async function getUserBusiness(authUserId) {
  const { data, error } = await supabase
    .from('user_business_mapping')
    .select(`
      role,
      permissions,
      business:business_id (*)
    `)
    .eq('auth_user_id', authUserId)
    .single();

  if (error) throw error;
  return data; // { role, permissions, business: {...} }
}

/** Inserta el vínculo usuario⇄negocio (si creas uno por defecto) */
export async function linkUserToBusiness({ authUserId, businessId, role = 'owner' }) {
  const { error } = await supabase
    .from('user_business_mapping')
    .insert({
      auth_user_id: authUserId,
      business_id: businessId,
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
      .from('user_business_mapping')
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
