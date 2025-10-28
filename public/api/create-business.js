// API endpoint para crear negocio con SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { businessData, userId } = req.body;

    // Cliente con SERVICE_ROLE_KEY (bypasea RLS)
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔵 API: Creando negocio con SERVICE_ROLE_KEY');
    console.log('📋 Payload:', businessData);

    // 1. Crear negocio
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .insert([businessData])
      .select()
      .single();

    if (businessError) {
      console.error('❌ Error creando negocio:', businessError);
      return res.status(400).json({ error: businessError.message });
    }

    console.log('✅ Negocio creado:', business.id);

    // 2. Crear mapping
    const { error: mappingError } = await supabaseAdmin
      .from('user_business_mapping')
      .insert([{
        auth_user_id: userId,
        business_id: business.id,
        role: 'owner',
        active: true
      }]);

    if (mappingError) {
      console.error('❌ Error creando mapping:', mappingError);
      return res.status(400).json({ error: mappingError.message });
    }

    console.log('✅ Mapping creado');

    // 3. Crear servicios
    if (businessData.services && businessData.services.length > 0) {
      const servicesData = businessData.services.map((serviceName, index) => ({
        business_id: business.id,
        name: serviceName,
        duration_minutes: 60,
        price: 0,
        active: true,
        display_order: index + 1
      }));

      await supabaseAdmin.from('services').insert(servicesData);
      console.log('✅ Servicios creados:', servicesData.length);
    }

    // 4. Crear recursos
    if (businessData.resources && businessData.resources.length > 0) {
      const resourcesData = businessData.resources.map((resourceName, index) => ({
        business_id: business.id,
        name: resourceName,
        type: 'room',
        capacity: 1,
        active: true,
        display_order: index + 1
      }));

      await supabaseAdmin.from('resources').insert(resourcesData);
      console.log('✅ Recursos creados:', resourcesData.length);
    }

    return res.status(200).json({ 
      success: true, 
      business 
    });

  } catch (error) {
    console.error('💥 Error fatal en API:', error);
    return res.status(500).json({ error: error.message });
  }
}


