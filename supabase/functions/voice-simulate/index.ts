// =====================================================
// EDGE FUNCTION: voice-simulate (MOCK)
// Endpoint: POST /functions/v1/voice-simulate
// Ticket: A4
// Descripción: Mock de simulación de llamada IA para onboarding
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { business_id, vertical_type, greeting_script } = await req.json()

    // Validar datos mínimos
    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // MOCK: Transcripción simulada basada en vertical
    const mockTranscripts: Record<string, string> = {
      fisioterapia: `
📞 Llamada simulada - Fisioterapia

Cliente: "Hola, buenos días. Quería reservar una sesión de fisioterapia."

IA: "¡Buenos días! Claro que sí, estoy encantada de ayudarte. Trabajo con el equipo de ${greeting_script || 'tu clínica'}. ¿Para cuándo te gustaría la cita?"

Cliente: "Pues mañana por la tarde si es posible."

IA: "Perfecto. Mañana tengo disponibilidad a las 17:00 o a las 18:30. ¿Cuál te viene mejor?"

Cliente: "A las 17:00 me va bien."

IA: "Genial. ¿Me dices tu nombre completo y un teléfono de contacto?"

Cliente: "Soy María García, mi teléfono es el 612345678."

IA: "Perfecto María. Tu cita queda confirmada para mañana a las 17:00. Te enviaré un recordatorio por WhatsApp. ¿Algo más en lo que pueda ayudarte?"

Cliente: "No, eso es todo. ¡Muchas gracias!"

IA: "¡A ti! Nos vemos mañana. Que tengas un buen día."

✅ Resultado: Cita creada automáticamente
      `,
      psicologia: `
📞 Llamada simulada - Psicología

Cliente: "Hola, quería pedir cita para terapia individual."

IA: "¡Hola! Por supuesto. Soy el asistente virtual de ${greeting_script || 'tu consulta'}. ¿Es tu primera visita con nosotros?"

Cliente: "Sí, sería la primera."

IA: "Estupendo. Las primeras sesiones suelen durar una hora. ¿Qué día te vendría bien?"

Cliente: "El jueves que viene, si hay hueco."

IA: "El jueves tengo disponible a las 10:00, a las 16:00 o a las 19:00. ¿Cuál prefieres?"

Cliente: "A las 19:00 perfecto."

IA: "Genial. ¿Tu nombre y teléfono para confirmar la cita?"

Cliente: "Carlos Ruiz, teléfono 654321987."

IA: "Perfecto Carlos. Tu primera sesión queda reservada para el jueves a las 19:00. Te enviaré un recordatorio el día anterior. ¿Necesitas algo más?"

Cliente: "No, muchas gracias."

IA: "A ti. ¡Hasta el jueves!"

✅ Resultado: Cita creada automáticamente
      `,
      masajes_osteopatia: `
📞 Llamada simulada - Masajes

Cliente: "Hola, quisiera reservar un masaje."

IA: "¡Hola! Claro que sí. Te habla el asistente de ${greeting_script || 'tu centro'}. ¿Qué tipo de masaje te interesa?"

Cliente: "Un masaje relajante de una hora."

IA: "Perfecto. ¿Para cuándo lo necesitas?"

Cliente: "Para este sábado si es posible."

IA: "Este sábado tengo disponibilidad a las 11:00, 13:00 o 17:00. ¿Te va bien alguno?"

Cliente: "A las 11:00 me viene genial."

IA: "Estupendo. ¿Tu nombre y teléfono?"

Cliente: "Laura Martín, 698765432."

IA: "Perfecto Laura. Tu masaje relajante de una hora queda reservado para el sábado a las 11:00. Te confirmaré por WhatsApp. ¿Algo más?"

Cliente: "Nada más, gracias."

IA: "¡A ti! Nos vemos el sábado."

✅ Resultado: Cita creada automáticamente
      `,
      default: `
📞 Llamada simulada

Cliente: "Hola, quería pedir cita."

IA: "¡Hola! Claro, te ayudo encantada. Soy el asistente virtual de ${greeting_script || 'tu negocio'}. ¿Para qué servicio necesitas la cita?"

Cliente: "Para el servicio principal que ofrecéis."

IA: "Perfecto. ¿Qué día te vendría bien?"

Cliente: "El martes próximo."

IA: "El martes tengo disponible a las 10:00, 12:00 o 16:00. ¿Cuál prefieres?"

Cliente: "A las 10:00 está bien."

IA: "Genial. ¿Tu nombre y teléfono para confirmar?"

Cliente: "Ana López, 600112233."

IA: "Perfecto Ana. Tu cita queda confirmada para el martes a las 10:00. Te enviaré un recordatorio. ¿Algo más?"

Cliente: "No, gracias."

IA: "¡De nada! Hasta el martes."

✅ Resultado: Cita creada automáticamente
      `
    }

    // Seleccionar transcripción según vertical
    const transcript = mockTranscripts[vertical_type || 'default'] || mockTranscripts.default

    // URL de audio mock (puedes subir un audio real a Supabase Storage)
    const audioUrl = 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/demo-audio/sample-call.mp3'

    // Metadata adicional
    const metadata = {
      duration_seconds: 45,
      outcome: 'appointment_created',
      sentiment: 'positive',
      language: 'es-ES',
      customer_name: 'Cliente Demo',
      customer_phone: '+34612345678',
      appointment_date: new Date(Date.now() + 86400000).toISOString(), // Mañana
    }

    // Log opcional (para debugging)
    console.log(`[voice-simulate] Mock simulation for business ${business_id}`)

    // Retornar mock response
    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        audio_url: audioUrl,
        metadata,
        message: 'Simulación de llamada completada (MOCK)'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[voice-simulate] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})



