// ============================================
// Edge Function: get-snapshot-preview (v1.0)
// Propósito: Vista previa ligera de MAÑANA (solo 4 puntos clave)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("⚠️ OPENAI_API_KEY no está configurada");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { business_id, target_date } = await req.json();
    
    if (!business_id || !target_date) {
      throw new Error("business_id y target_date son requeridos");
    }

    console.log(`📊 Generando preview para ${business_id} en ${target_date}`);

    // Obtener configuración del agente
    const { data: business } = await supabaseClient
      .from("businesses")
      .select("name, settings")
      .eq("id", business_id)
      .single();

    const agentName = business?.settings?.agent?.name || "Asistente";

    const sqlStart = Date.now();
    
    // Obtener snapshot simplificado para mañana
    const { data: snapshot, error: snapshotError } = await supabaseClient
      .rpc("get_unified_dashboard_snapshot", {
        p_business_id: business_id,
        p_timestamp: target_date,
      });
    
    const sqlDuration = Date.now() - sqlStart;

    if (snapshotError) {
      console.error("❌ Error al obtener snapshot:", snapshotError);
      throw new Error(`Error al obtener snapshot: ${snapshotError.message}`);
    }

    console.log(`✅ Snapshot obtenido en ${sqlDuration}ms`);

    // Prompt simplificado para preview (solo 4 puntos clave)
    const systemPrompt = `Eres ${agentName}. Analiza el snapshot de MAÑANA y genera 4 puntos clave (máx 15 palabras cada uno) que resuman lo más importante.

ENFÓCATE EN:
- Reservas confirmadas (cantidad)
- Ausencias del equipo que afecten citas
- Clientes VIP o nuevos agendados
- Proyección de facturación

NO menciones: captación, ofertas, descuentos, promociones.

RESPONDE JSON:
{"mensaje":"Resumen corto de mañana (max 40 palabras)","puntos":[{"icono":"emoji","texto":"max 15 palabras"}]}

IMPORTANTE: puntos DEBE tener exactamente 4 elementos.`;

    const userPrompt = `Analiza y resume en 4 puntos:

${JSON.stringify(snapshot)}`;

    console.log("🧠 Llamando a OpenAI para preview...");
    const openaiStart = Date.now();

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 200, // Reducido para preview rápido
      }),
    });

    const openaiDuration = Date.now() - openaiStart;

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`);
    }

    const openaiData = await openaiResponse.json();
    const previewData = JSON.parse(openaiData.choices[0].message.content);

    console.log(`⏱️ TIMING PREVIEW: SQL=${sqlDuration}ms | OpenAI=${openaiDuration}ms | TOTAL=${sqlDuration + openaiDuration}ms`);

    const response = {
      fecha: target_date,
      mensaje: previewData.mensaje || "Mañana tenemos actividad programada",
      puntos: previewData.puntos || []
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error en get-snapshot-preview:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fecha: null,
        mensaje: "No se pudo generar el preview de mañana",
        puntos: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});




