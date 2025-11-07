// =====================================================
// EDGE FUNCTION: complete-onboarding
// Descripción: Finaliza el onboarding de 4 pasos y crea el business
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Tipos
interface OnboardingPayload {
  businessName: string;
  vertical: string;
  assistantName: string;
  assistantVoice: string;
  userEmail: string;
  userId: string;
}

// Servicios por defecto según vertical
const DEFAULT_SERVICES = {
  fisioterapia: { name: 'Sesión Fisioterapia', duration: 45, price: 40 },
  masajes_osteopatia: { name: 'Masaje Relajante', duration: 60, price: 50 },
  clinica_dental: { name: 'Revisión General', duration: 30, price: 40 },
  psicologia_coaching: { name: 'Primera Sesión', duration: 60, price: 80 },
  centro_estetica: { name: 'Limpieza Facial', duration: 60, price: 45 },
  peluqueria_barberia: { name: 'Corte y Peinado', duration: 30, price: 25 },
  centro_unas: { name: 'Manicura', duration: 30, price: 20 },
  entrenador_personal: { name: 'Sesión Personal', duration: 60, price: 40 },
  yoga_pilates: { name: 'Clase de Yoga', duration: 60, price: 15 },
  veterinario: { name: 'Consulta General', duration: 30, price: 35 },
};

// Recursos por defecto según vertical
const DEFAULT_RESOURCES = {
  fisioterapia: { name: 'Camilla 1', singular: 'camilla', plural: 'camillas' },
  masajes_osteopatia: { name: 'Camilla 1', singular: 'camilla', plural: 'camillas' },
  clinica_dental: { name: 'Sillón 1', singular: 'sillón', plural: 'sillones' },
  psicologia_coaching: { name: 'Despacho 1', singular: 'despacho', plural: 'despachos' },
  centro_estetica: { name: 'Cabina 1', singular: 'cabina', plural: 'cabinas' },
  peluqueria_barberia: { name: 'Silla 1', singular: 'silla', plural: 'sillas' },
  centro_unas: { name: 'Puesto 1', singular: 'puesto', plural: 'puestos' },
  entrenador_personal: { name: 'Slot 1', singular: 'slot', plural: 'slots' },
  yoga_pilates: { name: 'Plaza 1', singular: 'plaza', plural: 'plazas' },
  veterinario: { name: 'Box 1', singular: 'box', plural: 'boxes' },
};

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // ✅ Usar SERVICE_ROLE_KEY para bypass de RLS y no validar JWT del usuario
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

    const payload: OnboardingPayload = await req.json();
    const { businessName, vertical, assistantName, assistantVoice, userEmail, userId } = payload;

    console.log('📦 Payload recibido:', payload);

    if (!businessName || !vertical || !assistantName || !assistantVoice || !userId) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ SCHEMA CORRECTO de businesses (sin owner_email)
    const businessData = {
      name: businessName,
      vertical_type: vertical,
      email: userEmail || null, // ✅ Usar 'email', NO 'owner_email'
      owner_id: userId, // ✅ Usar 'owner_id' para el FK
      onboarding_completed: true,
      onboarding_step: 4,
      agent_status: 'OFF',
      copilot_step: 0,
      copilot_completed: false,
      agent_config: {
        assistant_name: assistantName,
        voice_id: assistantVoice,
        prompt_version: `${vertical}_v1`,
      },
    };

    console.log('💾 Insertando business:', businessData);

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert(businessData)
      .select()
      .single();

    if (businessError) {
      console.error('❌ Error creando business:', businessError);
      throw businessError;
    }

    console.log('✅ Business creado:', business.id);

    // Crear mapping user-business
    const { error: mappingError } = await supabase.from('user_business_mapping').insert({
      user_id: userId,
      auth_user_id: userId, // ✅ Ambos campos por si acaso
      business_id: business.id,
      role: 'owner',
      active: true,
    });

    if (mappingError) {
      console.error('❌ Error creando mapping:', mappingError);
    } else {
      console.log('✅ User-business mapping creado');
    }

    // Crear servicio por defecto
    const defaultService = DEFAULT_SERVICES[vertical as keyof typeof DEFAULT_SERVICES];
    if (defaultService) {
      const { error: serviceError } = await supabase.from('services').insert({
        business_id: business.id,
        name: defaultService.name,
        duration_minutes: defaultService.duration,
        price: defaultService.price,
        is_active: true,
        requires_resource: true,
      });

      if (serviceError) {
        console.error('⚠️ Error creando servicio por defecto:', serviceError);
      } else {
        console.log('✅ Servicio por defecto creado:', defaultService.name);
      }
    }

    // Crear recurso por defecto
    const defaultResource = DEFAULT_RESOURCES[vertical as keyof typeof DEFAULT_RESOURCES];
    if (defaultResource) {
      const { error: resourceError } = await supabase.from('resources').insert({
        business_id: business.id,
        name: defaultResource.name,
        resource_type: defaultResource.singular,
        is_active: true,
      });

      if (resourceError) {
        console.error('⚠️ Error creando recurso por defecto:', resourceError);
      } else {
        console.log('✅ Recurso por defecto creado:', defaultResource.name);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        businessId: business.id,
        message: `¡${businessName} creado con éxito!`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error en complete-onboarding:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
