// ============================================
// Edge Function: get-snapshot (v4.0 - OPTIMIZADO)
// Propósito: OpenAI analiza y ORDENA los 6 bloques de información dinámicamente
// Optimización: Prompt más conciso, menos tokens, mejor rendimiento
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// ============================================
// CACHÉ EN MEMORIA (60 segundos)
// ============================================
const cache = new Map();
const CACHE_TTL = 60000; // 60 segundos

function getCacheKey(businessId) {
  const minute = Math.floor(Date.now() / CACHE_TTL);
  return `${businessId}:${minute}`;
}

function getFromCache(businessId) {
  const key = getCacheKey(businessId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ Usando caché (edad: ${Date.now() - cached.timestamp}ms)`);
    return cached.data;
  }
  return null;
}

function saveToCache(businessId, data) {
  const key = getCacheKey(businessId);
  cache.set(key, { data, timestamp: Date.now() });
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
          headers: { Authorization: req.headers.get("Authorization") }
        }
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
      return new Response(JSON.stringify(cachedResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
    const { data: snapshot, error: snapshotError } = await supabaseClient.rpc(
      "get_unified_dashboard_snapshot",
      {
        p_business_id: business_id,
        p_timestamp: currentTimestamp
      }
    );
    const sqlDuration = Date.now() - sqlStart;

    if (snapshotError) {
      console.error("❌ Error al obtener snapshot:", snapshotError);
      throw new Error(`Error al obtener snapshot: ${snapshotError.message}`);
    }

    console.log(`✅ Snapshot obtenido en ${sqlDuration}ms:`, JSON.stringify(snapshot).substring(0, 200) + "...");

    // 6. Construir prompts para OpenAI
    const systemPrompt = buildSystemPromptOptimized(agentName, businessName, businessType, ownerName);
    const userPrompt = buildUserPromptOptimized(snapshot);

    console.log("🧠 Enviando a OpenAI...");

    // 7. Llamar a OpenAI
    const openaiStart = Date.now();
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 300 // Reducido de 350 a 300
      })
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
      data: snapshot,
      metadata: {
        agent_name: agentName,
        business_name: businessName,
        timestamp: currentTimestamp,
        tokens_used: totalTokens,
        cost_usd: parseFloat(costUSD.toFixed(6)),
        cached: false
      }
    };

    // 10. Guardar en caché
    saveToCache(business_id, response);

    // 11. Devolver respuesta
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Error en get-snapshot:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        prioridad: "ERROR",
        mood: "alert",
        mensaje: "Hubo un error al analizar el estado. Intenta refrescar.",
        accion: null,
        bloques: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

// ============================================
// FUNCIÓN: System Prompt OPTIMIZADO
// ============================================
function buildSystemPromptOptimized(agentName, businessName, businessType, ownerName) {
  return `Eres ${agentName} de ${businessName} (${businessType}). Analiza el snapshot y genera respuesta JSON.

MISIÓN:
1. Detecta lo MÁS CRÍTICO
2. Ordena 6 bloques por prioridad (1-6)
3. Mensaje para ${ownerName} (máx 50 palabras)
4. Acción SI hay problema crítico

BLOQUES: RESERVAS|EQUIPO|FACTURACION|COMUNICACIONES|NOSHOWS|CLIENTES

PRIORIDADES:
CRISIS: conflictos_horario>0 | ausentes_hoy>0 CON citas_afectadas>0 → EQUIPO primero
RIESGO: en_riesgo_hoy>0 CON horas_hasta<2 → NOSHOWS primero
ATENCION: especiales_hoy>0 | minutos_hasta<120 → CLIENTES primero
INFORMATIVO: día normal → RESERVAS primero
CELEBRACION: porcentaje_vs_promedio>150 → FACTURACION primero

REGLAS:
- SOLO datos del snapshot
- NO inventes números
- NO menciones captación/promociones
- accion=null si no hay problema urgente
- texto_colapsado: máx 18 palabras

ACCIONES (solo problemas urgentes):
- ver_equipo: conflictos_horario>0
- whatsapp_cliente: en_riesgo_hoy con risk_score>70
- ver_reservas: próxima cita <30min

JSON:
{"prioridad":"CRISIS|RIESGO|ATENCION|INFORMATIVO|CELEBRACION","mood":"alert|serious|focused|zen|excited","mensaje":"<50 palabras>","accion":null O {"id":"","label":"","tipo":"","payload":{}},"bloques":[{"id":"RESERVAS|EQUIPO|FACTURACION|COMUNICACIONES|NOSHOWS|CLIENTES","prioridad":1-6,"texto_colapsado":"<18 palabras"},...]}

EJEMPLOS:

Conflicto crítico:
{"prioridad":"CRISIS","mood":"alert","mensaje":"Laura tiene 2 citas pero no tiene horario hoy. Transferir o cancelar urgente.","accion":{"id":"ver_equipo","label":"Ver equipo","tipo":"navigate","payload":{"route":"/equipo"}},"bloques":[{"id":"EQUIPO","prioridad":1,"texto_colapsado":"Laura: 2 citas sin horario"},{"id":"RESERVAS","prioridad":2,"texto_colapsado":"8 citas hoy, próxima en 15min"},...]}

No-show en riesgo:
{"prioridad":"RIESGO","mood":"serious","mensaje":"María tiene cita en 1h con 85% riesgo no-show. Confirmar por WhatsApp.","accion":{"id":"whatsapp","label":"WhatsApp María","tipo":"whatsapp","payload":{"telefono":"+34666777888"}},"bloques":[{"id":"NOSHOWS","prioridad":1,"texto_colapsado":"María 85% riesgo en 1h"},{"id":"RESERVAS","prioridad":2,"texto_colapsado":"7 citas hoy"},...]}

Día normal:
{"prioridad":"INFORMATIVO","mood":"zen","mensaje":"8 citas hoy. Próxima: Juan a las 10:30. Equipo 65% ocupado, 3 horas libres.","accion":null,"bloques":[{"id":"RESERVAS","prioridad":1,"texto_colapsado":"8 citas, próxima en 15min"},{"id":"EQUIPO","prioridad":2,"texto_colapsado":"2 empleados, 3h libres"},...]}

CRÍTICO: SIEMPRE 6 bloques (1-6). accion=null si INFORMATIVO.`;
}

// ============================================
// FUNCIÓN: User Prompt OPTIMIZADO
// ============================================
function buildUserPromptOptimized(snapshot) {
  // Extraer solo datos relevantes para reducir tokens
  const relevantData = {
    reservas: {
      total_hoy: snapshot.reservas?.total_hoy || 0,
      proxima_cita: snapshot.reservas?.proxima_cita || null,
      conflictos: snapshot.reservas?.conflictos || 0,
      huecos_horas: snapshot.reservas?.huecos_horas || 0
    },
    equipo: {
      total_empleados: snapshot.equipo?.total_empleados || 0,
      total_horas_libres: snapshot.equipo?.total_horas_libres || 0,
      conflictos_horario: snapshot.equipo?.conflictos_horario || 0,
      empleados_con_conflicto: snapshot.equipo?.empleados_con_conflicto || [],
      ausentes_hoy: snapshot.horarios?.ausentes_hoy || snapshot.equipo?.ausentes_hoy || []
    },
    facturacion: {
      total_hoy: snapshot.facturacion?.total_hoy || 0,
      porcentaje_vs_promedio: snapshot.facturacion?.porcentaje_vs_promedio || 0,
      citas_completadas: snapshot.facturacion?.citas_completadas || 0,
      citas_pendientes: snapshot.facturacion?.citas_pendientes || 0
    },
    noshows: {
      en_riesgo_hoy: snapshot.noshows?.en_riesgo_hoy || []
    },
    comunicaciones: {
      mensajes_pendientes: snapshot.comunicaciones?.mensajes_pendientes || 0,
      incidencias_urgentes: snapshot.comunicaciones?.incidencias_urgentes || 0
    },
    clientes: {
      especiales_hoy: snapshot.clientes?.especiales_hoy || []
    }
  };

  return `Snapshot:\n${JSON.stringify(relevantData)}\n\nResponde JSON.`;
}

