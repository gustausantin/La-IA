// =====================================================
// EDGE FUNCTION: get-snapshot-preview
// Descripción: Genera un preview de "lo que te espera mañana" usando OpenAI
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    // 1️⃣ Obtener API Key de OpenAI
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('⚠️ OPENAI_API_KEY no está configurada');
    }

    // 2️⃣ Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3️⃣ Parsear el payload
    const { business_id, target_date } = await req.json();

    if (!business_id || !target_date) {
      return new Response(
        JSON.stringify({ error: 'business_id y target_date son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extraer solo la fecha (YYYY-MM-DD)
    const dateOnly = target_date.split('T')[0];

    console.log('🔮 Generando preview con OpenAI para:', { business_id, date: dateOnly });

    // 4️⃣ Consultar DATOS REALES de mañana
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, customer_name, customer_phone, appointment_time, status, service_id, customer_id')
      .eq('business_id', business_id)
      .eq('appointment_date', dateOnly)
      .order('appointment_time', { ascending: true });

    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, active')
      .eq('business_id', business_id);

    const { data: absences } = await supabase
      .from('absences')
      .select('*')
      .eq('business_id', business_id)
      .lte('start_date', dateOnly)
      .gte('end_date', dateOnly);

    // Obtener info del negocio
    const { data: business } = await supabase
      .from('businesses')
      .select('name, vertical_type')
      .eq('id', business_id)
      .single();

    // 5️⃣ Preparar datos para OpenAI
    const totalAppointments = appointments?.length || 0;
    const confirmedCount = appointments?.filter(a => a.status === 'confirmed').length || 0;
    const pendingCount = appointments?.filter(a => a.status === 'pending').length || 0;
    const employeesActive = employees?.filter(e => e.active).length || 0;
    const absencesCount = absences?.length || 0;

    // 6️⃣ Crear prompt para OpenAI
    const prompt = `Eres el asistente virtual de ${business?.name || 'un negocio'} (tipo: ${business?.vertical_type || 'servicio'}).

DATOS REALES DE MAÑANA (${dateOnly}):
- Total citas agendadas: ${totalAppointments}
- Citas confirmadas: ${confirmedCount}
- Citas pendientes confirmación: ${pendingCount}
- Empleados activos: ${employeesActive}
- Ausencias del equipo: ${absencesCount}

${appointments && appointments.length > 0 ? `
DETALLE DE CITAS:
${appointments.map(a => `- ${a.appointment_time}: ${a.customer_name || 'Cliente'} (${a.status})`).join('\n')}
` : ''}

TAREA: Genera un preview profesional con 4 puntos clave sobre lo que le espera mañana al negocio.

FORMATO REQUERIDO (JSON):
{
  "puntos": [
    { "icono": "📅", "texto": "Descripción corta y específica" },
    { "icono": "👥", "texto": "Descripción corta y específica" },
    { "icono": "⚠️", "texto": "Descripción corta y específica" },
    { "icono": "💰", "texto": "Descripción corta y específica" }
  ],
  "mensaje": "Resumen ejecutivo en máximo 35 palabras"
}

REGLAS IMPORTANTES:
- Usa SOLO datos reales proporcionados
- USA NÚMEROS, NO LETRAS: "7 citas" NO "siete citas"
- Cada punto: máximo 50 caracteres
- Mensaje: máximo 35 palabras
- Sé específico y profesional
- Si no hay citas, menciona día tranquilo
- Si hay ausencias, alertar
- Usa emojis relevantes: 📅💼👥⚠️✅💰🌟📊
- SIEMPRE usa dígitos para cantidades: 0, 1, 2, 3... NO "cero", "uno", "dos"

Genera el JSON:`;

    // 7️⃣ Llamar a OpenAI
    console.log('🤖 Llamando a OpenAI GPT-4o-mini...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente ejecutivo que analiza datos de negocio y genera insights profesionales en formato JSON. Siempre devuelves JSON válido sin markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI error: ${errorData.error?.message || 'Unknown'}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedContent = openaiData.choices[0].message.content;
    
    // 8️⃣ Parsear respuesta de OpenAI
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', generatedContent);
      throw new Error('OpenAI devolvió formato inválido');
    }

    // 9️⃣ Agregar stats para debugging
    const response = {
      ...parsedResponse,
      stats: {
        total_appointments: totalAppointments,
        confirmed: confirmedCount,
        pending: pendingCount,
        absences: absencesCount,
        employees_active: employeesActive
      },
      metadata: {
        tokens_used: openaiData.usage.total_tokens,
        generated_by: 'OpenAI GPT-4o-mini',
        date: dateOnly
      }
    };

    console.log('✅ Preview generado por OpenAI:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error en get-snapshot-preview:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        puntos: [],
        mensaje: 'Error al generar preview'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

