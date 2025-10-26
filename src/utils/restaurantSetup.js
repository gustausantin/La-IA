// restaurantSetup.js - Utilidades para configuración automática de restaurant
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/**
 * Crea automáticamente un restaurant para un usuario si no existe
 * @param {object} user - Usuario autenticado
 * @returns {Promise<object|null>} - Restaurant creado o null si error
 */
export const createRestaurantForUser = async (user) => {
  try {
    console.log('🚀 Creando restaurant automáticamente para usuario:', user.email);
    
    // Verificar si ya existe un restaurant para este usuario
    const { data: existingMapping } = await supabase
      .from('user_restaurant_mapping')
      .select('restaurant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    
    if (existingMapping?.restaurant_id) {
      console.log('✅ Restaurant ya existe, no es necesario crear');
      return null;
    }

    // Crear restaurant con datos por defecto
    const restaurantData = {
      name: `Restaurante de ${user.email.split('@')[0]}`,
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

    // Insertar restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert([restaurantData])
      .select()
      .single();

    if (restaurantError) {
      throw restaurantError;
    }

    // Crear mapping usuario-restaurant
    const { error: mappingError } = await supabase
      .from('user_restaurant_mapping')
      .insert([{
        auth_user_id: user.id,
        restaurant_id: restaurant.id,
        role: 'owner'
      }]);

    if (mappingError) {
      throw mappingError;
    }

    console.log('✅ Restaurant creado exitosamente:', restaurant.name);
    
    // Disparar evento para actualizar contextos
    window.dispatchEvent(new CustomEvent('force-restaurant-reload'));
    
    toast.success('¡Configuración inicial completada!');
    
    return restaurant;
    
  } catch (error) {
    console.error('❌ Error creando restaurant:', error);
    toast.error(`Error en configuración inicial: ${error.message}`);
    return null;
  }
};

/**
 * Verifica y crea restaurant si es necesario
 * @param {object} user - Usuario autenticado
 * @returns {Promise<boolean>} - true si todo OK, false si error
 */
export const ensureRestaurantExists = async (user) => {
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
    const restaurant = await createRestaurantForUser(user);
    return restaurant !== null;
    
  } catch (error) {
    console.error('Error verificando/creando restaurant:', error);
    return false;
  }
};
