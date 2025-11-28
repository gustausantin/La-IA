// =====================================================
// EDGE FUNCTION: vapi-inbound-handler (WORKFLOW MODE)
// =====================================================
// Devuelve workflowId + workflowOverrides + voice
// - workflowId: ID del Workflow a ejecutar
// - workflowOverrides.variableValues: Variables dinámicas
// - voice: Fuerza la voz de ElevenLabs según el avatar
// El modelo se configura DENTRO del Workflow en VAPI
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-vapi-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// 1) TU WORKFLOW REAL
const WORKFLOW_ID = '5d6025b6-45cb-468f-85f0-6b364a882773';

// 2) MAPA DE VOCES ELEVENLABS (Avatar -> VoiceId)
const AVATAR_VOICES: Record<string, string> = {
  'Lua': 'RgXx32WYOGrd7gFNifSf',      // Voz femenina principal
  'Clara': 'EXAVITQu4vr4xnSDxMaL',    // Voz femenina alternativa
  'Hugo': 'ErXwobaYiN019PkySvjV',     // Voz masculina
  'Álex': 'TxGEqnHWrfWFTfGW9XjX',     // Voz masculina alternativa
  'Mariana': 'RgXx32WYOGrd7gFNifSf',  // Mariana usa voz de Lua
  'Default': 'RgXx32WYOGrd7gFNifSf'   // Fallback a Lua
};

const getClientTerm = (verticalType: string): string => {
  const patientVerticals = ['fisioterapia', 'clinica_dental', 'podologia'];
  return patientVerticals.includes(verticalType) ? 'Paciente' : 'Cliente';
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const msg = body?.message ?? {};
    const type = msg.type ?? '';

    // ⚠️ CRÍTICO: Solo en "assistant-request" devolvemos configuración del workflow
    // Para otros eventos (speech-update, end-of-call-report, etc.) solo OK
    if (type !== 'assistant-request') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📞 assistant-request recibido');

    // Extraer teléfono del negocio/cliente
    const phoneNumber =
      msg?.phoneNumber?.number ||
      msg?.phoneNumber?.phoneNumber ||
      msg?.customer?.number ||
      '';

    // Si no hay número, devolvemos workflow sin personalizar pero con voz por defecto
    if (!phoneNumber) {
      console.warn('⚠️ No phone number - usando workflow sin variables');
      return new Response(JSON.stringify({
        workflowId: WORKFLOW_ID,
        voice: {
          provider: "11labs",
          voiceId: AVATAR_VOICES['Default']
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📞 Procesando llamada para: ${phoneNumber}`);

    // --- LÓGICA DE NEGOCIO ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Buscar negocio
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, business_name, vertical_type, agent_config, settings')
      .or(`assigned_phone.ilike.%${normalizedPhone}%,phone.ilike.%${normalizedPhone}%`)
      .eq('active', true)
      .maybeSingle();

    // Fallback seguro si no encontramos negocio
    const safeBusiness: any =
      business || {
        id: null,
        name: 'La Central',
        business_name: 'La Central',
        vertical_type: 'default',
        agent_config: { assistant_name: 'Lua' },
        settings: {},
      };

    if (!business) {
      console.warn(`❌ Negocio no encontrado para ${normalizedPhone} - usando fallback`);
    } else {
      console.log(`✅ Negocio encontrado: ${business.name} (ID: ${business.id})`);
    }

    // Cargar datos en paralelo
    const [verticalRes, contextRes, servicesRes] = await Promise.all([
      supabase
        .from('business_verticals')
        .select('*')
        .eq('code', safeBusiness.vertical_type)
        .maybeSingle(),
      supabase
        .from('vertical_context')
        .select('*')
        .or(
          `vertical_code.eq.${safeBusiness.vertical_type},vertical_id.eq.${safeBusiness.vertical_type}`,
        )
        .maybeSingle(),
      safeBusiness.id
        ? supabase
            .from('services')
            .select('name')
            .eq('business_id', safeBusiness.id)
            .eq('active', true)
            .limit(10)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);

    const verticalConfig: any = verticalRes.data || {};
    const verticalContext: any = contextRes.data || {};
    const services: any[] = servicesRes.data || [];
    const personality: any = safeBusiness.agent_config?.personality || {};

    const selectedAvatarName: string =
      personality.name || safeBusiness.agent_config?.assistant_name || 'Lua';

    // Seleccionar VoiceId de ElevenLabs según el avatar
    const selectedVoiceId: string =
      AVATAR_VOICES[selectedAvatarName] || AVATAR_VOICES['Default'];

    const servicesList =
      services.length > 0
        ? services.map((s: any) => s.name).join(', ')
        : 'Consultar';

    let toneInstructions: string =
      verticalContext.tone_instructions ||
      (personality.tone === 'professional'
        ? 'Sé muy profesional y formal.'
        : 'Sé amable, cercano y cálido.');

    // --- VARIABLES QUE LEE EL WORKFLOW ---
    const variableValues: Record<string, string> = {
      BUSINESS_NAME:
        safeBusiness.business_name || safeBusiness.name || 'Negocio',
      ASSISTANT_NAME: selectedAvatarName,
      SECTOR_NAME: verticalConfig.display_name || 'Servicios',
      CLIENT_TERM: getClientTerm(safeBusiness.vertical_type),
      ASSET_TERM: verticalContext.resource_singular || 'Cita',
      SERVICES_LIST: servicesList,
      TONE_INSTRUCTIONS: toneInstructions,
      WEBSITE: safeBusiness.settings?.website || '',
    };

    // Variables opcionales
    if (verticalContext.base_prompt) {
      variableValues.BASE_PROMPT = verticalContext.base_prompt;
    }
    if (verticalContext.context_info) {
      variableValues.CONTEXT_INFO = JSON.stringify(verticalContext.context_info);
    }

    // 🎯 ESTA ES LA RESPUESTA QUE VAPI ESPERA PARA WORKFLOW
    // Incluye workflowId, workflowOverrides Y voice para forzar la voz
    const response = {
      workflowId: WORKFLOW_ID,
      workflowOverrides: {
        variableValues,
      },
      // 👇 FORZAMOS LA VOZ DE ELEVENLABS según el avatar
      voice: {
        provider: "11labs",
        voiceId: selectedVoiceId
      }
    };

    console.log(`✅ Config generada para: ${safeBusiness.name} (Avatar: ${selectedAvatarName})`);
    console.log(`🎙️ Voz seleccionada: ${selectedAvatarName} (${selectedVoiceId})`);
    console.log(`📦 Variables inyectadas:`, Object.keys(variableValues).join(', '));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('🔥 Error en vapi-inbound-handler:', e);

    // Fallback mínimo: que al menos arranque el workflow con voz por defecto
    const fallback = {
      workflowId: WORKFLOW_ID,
      workflowOverrides: {
        variableValues: {
          BUSINESS_NAME: 'Atención al Cliente',
          ASSISTANT_NAME: 'Lua',
          CLIENT_TERM: 'Cliente',
          ASSET_TERM: 'Cita',
          SERVICES_LIST: 'Información general',
          TONE_INSTRUCTIONS: 'Sé amable y profesional.',
        },
      },
      voice: {
        provider: "11labs",
        voiceId: AVATAR_VOICES['Default']
      }
    };

    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
