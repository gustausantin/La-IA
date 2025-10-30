// =====================================================
// EDGE FUNCTION: create-demo-session
// Descripción: Crea una sesión de demo temporal en la BD
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Tipos
interface DemoSessionPayload {
  vertical: string;
  businessName: string;
  assistantName: string;
  assistantVoice: string;
  serviceName: string;
  serviceDuration: number;
  slots: Record<string, 'libre' | 'ocupado'>; // { "10:00": "libre", "10:45": "ocupado" }
  whatsapp: string;
}

// Número de demo (hardcoded, en producción sería del pool)
const DEMO_PHONE = '+34931204462';

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parsear el payload
    const payload: DemoSessionPayload = await req.json();
    const {
      vertical,
      businessName,
      assistantName,
      assistantVoice,
      serviceName,
      serviceDuration,
      slots,
      whatsapp,
    } = payload;

    console.log('📞 Creando sesión de demo:', payload);

    // Validaciones
    if (!vertical || !businessName || !assistantName || !assistantVoice || !slots || !whatsapp) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generar un session_id único
    const sessionId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Insertar en la tabla demo_sessions
    const { data: session, error: sessionError } = await supabase
      .from('demo_sessions')
      .insert({
        business_name: businessName,
        vertical_type: vertical,
        assistant_name: assistantName,
        voice_id: assistantVoice,
        demo_slots: slots,
        demo_service_name: serviceName,
        demo_service_duration: serviceDuration,
        whatsapp_for_demo: whatsapp,
        demo_phone: DEMO_PHONE,
        completed: false,
        reservation_created: false,
        whatsapp_sent: false,
        user_agent: req.headers.get('user-agent') || 'unknown',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Error creando demo_session:', sessionError);
      throw sessionError;
    }

    console.log('✅ Demo session creada:', session.id);

    // TODO: Aquí podríamos cargar la configuración en el contexto de Vapi/OpenAI
    // para que cuando llamen al DEMO_PHONE, el agente IA use estos datos

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        demoPhone: DEMO_PHONE,
        expiresAt: session.expires_at,
        message: '¡Demo lista! Llama al número para empezar.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error en create-demo-session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

