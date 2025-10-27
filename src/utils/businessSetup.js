// businessSetup.js - Utilidades para configuración automática de negocios
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/**
 * Crea automáticamente un negocio para un usuario si no existe
 * @param {object} user - Usuario autenticado
 * @returns {Promise<object|null>} - Negocio creado o null si error
 */
export const createBusinessForUser = async (user) => {
  try {
    console.log('🚀 Creando negocio automáticamente para usuario:', user.email);
    
    // Verificar si ya existe un negocio para este usuario
    const { data: existingMapping } = await supabase
      .from('user_restaurant_mapping')
      .select('restaurant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    
    if (existingMapping?.restaurant_id) {
      console.log('✅ Negocio ya existe, no es necesario crear');
      return null;
    }

    // Crear negocio con datos por defecto
    const businessData = {
      name: `Negocio de ${user.email.split('@')[0]}`,
      email: user.email,
      phone: '+34 600 000 000',
      address: 'Dirección pendiente',
      city: 'Madrid',
      country: 'España',
      postal_code: '28001',
      cuisine_type: 'internacional',
      plan: 'trial',
      active: true
    };

    // Insertar negocio
    const { data: business, error: businessError } = await supabase
      .from('restaurants')
      .insert([businessData])
      .select()
      .single();

    if (businessError) {
      throw businessError;
    }

    // Crear mapping usuario-negocio
    const { error: mappingError } = await supabase
      .from('user_restaurant_mapping')
      .insert([{
        auth_user_id: user.id,
        restaurant_id: business.id,
        role: 'owner'
      }]);

    if (mappingError) {
      throw mappingError;
    }

    console.log('✅ Negocio creado exitosamente:', business.name);
    
    // Disparar evento para actualizar contextos
    window.dispatchEvent(new CustomEvent('force-business-reload'));
    
    toast.success('¡Configuración inicial completada!');
    
    return business;
    
  } catch (error) {
    console.error('❌ Error creando negocio:', error);
    toast.error(`Error en configuración inicial: ${error.message}`);
    return null;
  }
};

/**
 * Verifica y crea negocio si es necesario
 * @param {object} user - Usuario autenticado
 * @returns {Promise<boolean>} - true si todo OK, false si error
 */
export const ensureBusinessExists = async (user) => {
  if (!user) return false;

  try {
    // Verificar si ya existe
    const { data: mapping } = await supabase
      .from('user_restaurant_mapping')
      .select('restaurant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (mapping?.restaurant_id) {
      return true; // Ya existe
    }

    // Crear automáticamente
    const business = await createBusinessForUser(user);
    return business !== null;
    
  } catch (error) {
    console.error('Error verificando/creando negocio:', error);
    return false;
  }
};
