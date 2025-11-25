// ============================================
// Edge Function: get-snapshot (v3.0 - Orden Dinámico Completo)
// Propósito: OpenAI analiza y ORDENA los 6 bloques de información dinámicamente
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// CACHÉ EN MEMORIA (60 segundos)
// ============================================
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 60 segundos

function getCacheKey(businessId: string): string {
  const minute = Math.floor(Date.now() / CACHE_TTL);
  return `${businessId}:${minute}`;
}

function getFromCache(businessId: string): any | null {
  const key = getCacheKey(businessId);
  const cached = cache.get(key);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`✅ Usando caché (edad: ${Date.now() - cached.timestamp}ms)`);
    return cached.data;
  }
  
  return null;
}

function saveToCache(businessId: string, data: any): void {
  const key = getCacheKey(businessId);
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`💾 Guardado en caché (key: ${key})`);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Obtener API Key de OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("⚠️ OPENAI_API_KEY no está configurada en Supabase Secrets");
    }

    // 2. Crear cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 3. Obtener parámetros
    const { business_id, timestamp } = await req.json();
    
    if (!business_id) {
      throw new Error("business_id es requerido");
    }

    const currentTimestamp = timestamp || new Date().toISOString();

    console.log(`📊 Analizando snapshot para business ${business_id} en ${currentTimestamp}`);

    // 4. Verificar caché primero
    const cachedResponse = getFromCache(business_id);
    if (cachedResponse) {
      console.log(`⚡ Devolviendo respuesta desde caché`);
      return new Response(
        JSON.stringify(cachedResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔄 Caché no disponible, procesando nueva solicitud...`);

    // 5. Obtener datos del negocio y configuración del agente
    const { data: business, error: businessError } = await supabaseClient
      .from("businesses")
      .select("name, settings, vertical_type")
      .eq("id", business_id)
      .single();

    if (businessError || !business) {
      throw new Error("Negocio no encontrado");
    }

    // Extraer configuración del agente
    const agentConfig = business.settings?.agent || {};
    const agentName = agentConfig.name || "Asistente";
    const agentBio = agentConfig.bio || "Asistente virtual profesional";
    const ownerName = business.settings?.contact_name || "Jefe";
    const businessName = business.name || "el negocio";
    const businessType = business.vertical_type || "servicios";

    console.log(`🤖 Agente: ${agentName} | Dueño: ${ownerName} | Negocio: ${businessName}`);

    // 5. Obtener snapshot unificado de la BD
    const sqlStart = Date.now();
    const { data: snapshot, error: snapshotError } = await supabaseClient
      .rpc("get_unified_dashboard_snapshot", {
        p_business_id: business_id,
        p_timestamp: currentTimestamp,
      });
    const sqlDuration = Date.now() - sqlStart;

    if (snapshotError) {
      console.error("❌ Error al obtener snapshot:", snapshotError);
      throw new Error(`Error al obtener snapshot: ${snapshotError.message}`);
    }

    console.log(`✅ Snapshot obtenido en ${sqlDuration}ms:`, JSON.stringify(snapshot).substring(0, 200) + "...");

    // 6. Construir prompts para OpenAI
    const systemPrompt = buildSystemPrompt(agentName, businessName, businessType, agentBio, ownerName);
    const userPrompt = buildUserPrompt(agentName, ownerName, snapshot);

    console.log("🧠 Enviando a OpenAI...");

    // 7. Llamar a OpenAI
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
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4, // Balance entre consistencia y variedad
        max_tokens: 350, // Optimizado para respuesta JSON compacta
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`);
    }

    const openaiData = await openaiResponse.json();
    const openaiDuration = Date.now() - openaiStart;
    const aiDecision = JSON.parse(openaiData.choices[0].message.content);

    console.log(`✅ OpenAI respondió en ${openaiDuration}ms`);
    console.log("✅ Decisión de IA:", JSON.stringify(aiDecision));

    // 8. Calcular costo
    const totalTokens = openaiData.usage.total_tokens;
    const inputTokens = openaiData.usage.prompt_tokens;
    const outputTokens = openaiData.usage.completion_tokens;
    const costUSD = (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.60;

    console.log(`📊 Tokens: ${totalTokens} (in: ${inputTokens}, out: ${outputTokens})`);
    console.log(`💰 Costo: $${costUSD.toFixed(6)} USD`);
    console.log(`⏱️ TIMING: SQL=${sqlDuration}ms | OpenAI=${openaiDuration}ms | TOTAL=${sqlDuration + openaiDuration}ms`);

    // 9. Preparar respuesta
    const response = {
      ...aiDecision,
      data: snapshot, // Datos originales para el frontend
      metadata: {
        agent_name: agentName,
        business_name: businessName,
        timestamp: currentTimestamp,
        tokens_used: totalTokens,
        cost_usd: parseFloat(costUSD.toFixed(6)),
        cached: false,
      },
    };

    // 10. Guardar en caché
    saveToCache(business_id, response);

    // 11. Devolver respuesta
    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error en get-snapshot:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        prioridad: "ERROR",
        mood: "alert",
        mensaje: "Hubo un error al analizar el estado. Intenta refrescar.",
        accion: null,
        bloques: [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// ============================================
// FUNCIÓN: Construir System Prompt
// ============================================
function buildSystemPrompt(
  agentName: string,
  businessName: string,
  businessType: string,
  agentBio: string,
  ownerName: string
): string {
  return `Eres ${agentName}, asistente virtual de ${businessName} (${businessType}). ${agentBio}

MISIÓN: Analiza 6 bloques del negocio, detecta lo MÁS IMPORTANTE, ordénalos por urgencia, genera mensaje para ${ownerName} (máx 60 palabras) y propón 1 acción ejecutable SI APLICA.

REGLAS:
- Usa SOLO datos del snapshot JSON (no inventes)
- NO menciones: captación, ofertas, descuentos, promociones, "atraer clientes"
- Enfócate en: gestionar existente, optimizar recursos, resolver problemas
- Varía tu lenguaje
- Mensaje: máx 60 palabras | Texto colapsado bloque: máx 20 palabras
- Si no hay acción necesaria: accion = null (NO texto "sin acción")

6 BLOQUES: RESERVAS (agenda, conflictos) | EQUIPO (ausencias) | FACTURACION (ingresos) | COMUNICACIONES (mensajes urgentes) | NOSHOWS (riesgo) | CLIENTES (VIP, nuevos)

PRIORIDADES:
CRISIS (alert): ausentes_hoy>0 CON citas_afectadas | conflictos>0 → EQUIPO principal
RIESGO (serious): noshows horas_hasta<2 | incidencias_urgentes>0 → NOSHOWS/COMUNICACIONES
ATENCION (focused): VIP/nuevo minutos_hasta<240 → CLIENTES
INFORMATIVO (zen): día normal → RESERVAS/FACTURACION
CELEBRACION (excited): facturacion >150% promedio → FACTURACION

ACCIONES (solo si hay problema que resolver):
transferir_citas (endpoint): ausentes_hoy>0 CON alternativas
cancelar_citas (endpoint): ausentes_hoy>0 SIN alternativas
llamar_cliente (call): riesgo no-show <2h → {telefono}
whatsapp_cliente (whatsapp): riesgo no-show <4h → {telefono, mensaje}
ver_ficha_cliente (navigate): VIP/nuevo hoy → {route: "/clientes/:id"}
ver_reservas (navigate): muchas reservas hoy → {route: "/reservas"}
ver_equipo (navigate): ausencias → {route: "/equipo"}
ver_facturacion (navigate): baja facturación → {route: "/facturacion"}
ver_comunicaciones (navigate): mensajes pendientes → {route: "/comunicaciones"}

RESPONDE JSON:
{"prioridad":"CRISIS|RIESGO|ATENCION|INFORMATIVO|CELEBRACION","mood":"alert|serious|focused|zen|excited","mensaje":"string max 60 palabras","accion":null O {"id":"accion_id","label":"texto botón","tipo":"tipo","payload":{}},"bloques":[{"id":"RESERVAS|EQUIPO|FACTURACION|COMUNICACIONES|NOSHOWS|CLIENTES","prioridad":1-6,"texto_colapsado":"max 20 palabras"}]}

CRÍTICO:
- bloques: SIEMPRE 6 elementos, ordenados 1-6
- accion: null si no hay acción necesaria (NO pongas objeto con texto "sin acción")
- Si es día INFORMATIVO normal: accion=null`;
}

// ============================================
// FUNCIÓN: Construir User Prompt
// ============================================
function buildUserPrompt(
  agentName: string,
  ownerName: string,
  snapshot: any
): string {
  return `Analiza el snapshot y genera la respuesta JSON:

${JSON.stringify(snapshot)}

Responde JSON sin markdown.`;
}
