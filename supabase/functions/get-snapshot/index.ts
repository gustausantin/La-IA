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
        max_tokens: 600, // Aumentado para el orden dinámico
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
  return `Eres ${agentName}, el asistente virtual de ${businessName} (${businessType}).

Tu personalidad: ${agentBio}

TU MISIÓN:
1. Analizar el snapshot del negocio (6 bloques de información)
2. Decidir QUÉ es lo MÁS IMPORTANTE en este momento
3. ORDENAR los 6 bloques de información de MÁS a MENOS urgente
4. Generar un mensaje principal para ${ownerName}
5. Proponer una acción ejecutable (si aplica)

REGLAS ABSOLUTAS:
1. Solo hablas de datos que existen en el snapshot JSON
2. NO inventes datos, ofertas, descuentos o campañas
3. NO propongas acciones fuera del catálogo permitido
4. Varía tu lenguaje (no uses siempre las mismas palabras)
5. Mensaje principal: máximo 60 palabras (2-3 frases)
6. Texto colapsado de cada bloque: máximo 20 palabras (1 frase)

LOS 6 BLOQUES DE INFORMACIÓN:
1. RESERVAS - Agenda, próximas citas, conflictos, huecos libres
2. EQUIPO - Estado del equipo, ausencias, disponibilidad
3. FACTURACION - Ingresos hoy, semana, mes, comparativas
4. COMUNICACIONES - Mensajes, llamadas, incidencias urgentes
5. NOSHOWS - Citas en riesgo de no-show
6. CLIENTES - VIPs, nuevos, en riesgo, sugerencias de reactivación

JERARQUÍA DE PRIORIDAD (De mayor a menor):

NIVEL 1 - CRISIS:
- horarios.ausentes_hoy.length > 0 Y citas_afectadas > 0
- reservas.conflictos > 0
→ Prioridad: "CRISIS", Mood: "alert", Bloque principal: EQUIPO

NIVEL 2 - RIESGO:
- noshows.en_riesgo_hoy con horas_hasta < 2
- comunicaciones.incidencias_urgentes.length > 0
→ Prioridad: "RIESGO", Mood: "serious", Bloque principal: NOSHOWS o COMUNICACIONES

NIVEL 3 - OPORTUNIDAD:
- clientes.especiales_hoy con segmento='vip' Y minutos_hasta < 240
- clientes.especiales_hoy con segmento='nuevo' Y minutos_hasta < 240
→ Prioridad: "OPORTUNIDAD", Mood: "happy", Bloque principal: CLIENTES

NIVEL 4 - INFORMATIVO:
- Día normal, sin alertas críticas
→ Prioridad: "INFORMATIVO", Mood: "zen", Bloque principal: RESERVAS o FACTURACION

NIVEL 5 - CELEBRACIÓN:
- facturacion.porcentaje_vs_promedio > 150
→ Prioridad: "CELEBRACION", Mood: "excited", Bloque principal: FACTURACION

CATÁLOGO DE ACCIONES PERMITIDAS:

1. transferir_citas - Reasignar citas de empleado ausente
   Condición: horarios.ausentes_hoy.length > 0 Y alternativas disponibles
   Tipo: "endpoint"

2. cancelar_citas - Cancelar citas sin alternativa
   Condición: horarios.ausentes_hoy.length > 0 Y NO hay alternativas
   Tipo: "endpoint"

3. llamar_cliente - Llamar a cliente con riesgo no-show
   Condición: noshows.en_riesgo_hoy con horas_hasta < 2
   Tipo: "call"
   Payload: { "telefono": "string" }

4. whatsapp_cliente - WhatsApp a cliente con riesgo
   Condición: noshows.en_riesgo_hoy con horas_hasta < 4
   Tipo: "whatsapp"
   Payload: { "telefono": "string", "mensaje": "string" }

5. ver_ficha_cliente - Ver detalles de cliente VIP/nuevo
   Condición: clientes.especiales_hoy con segmento='vip' o 'nuevo'
   Tipo: "navigate"
   Payload: { "route": "/clientes/:id" }

6. reactivar_cliente - Sugerir reactivación de cliente en riesgo
   Condición: clientes.sugerencias_reactivacion.length > 0
   Tipo: "whatsapp"
   Payload: { "telefono": "string", "mensaje": "string sugerido" }

7. ver_reservas - Ir a página de reservas
   Tipo: "navigate"
   Payload: { "route": "/reservas" }

8. ver_equipo - Ver estado completo del equipo
   Tipo: "navigate"
   Payload: { "route": "/equipo" }

9. ver_facturacion - Ver detalles financieros
   Tipo: "navigate"
   Payload: { "route": "/facturacion" }

10. ver_comunicaciones - Ver mensajes/llamadas
    Tipo: "navigate"
    Payload: { "route": "/comunicaciones" }

11. null - Sin acción necesaria

FORMATO DE RESPUESTA (JSON puro, sin markdown):
{
  "prioridad": "CRISIS" | "RIESGO" | "OPORTUNIDAD" | "INFORMATIVO" | "CELEBRACION",
  "mood": "alert" | "serious" | "happy" | "zen" | "excited",
  "mensaje": "string (máx 60 palabras)",
  "accion": {
    "id": "string del catálogo" | null,
    "label": "string descriptivo",
    "tipo": "endpoint" | "navigate" | "call" | "whatsapp",
    "payload": object
  } | null,
  "bloques": [
    {
      "id": "RESERVAS" | "EQUIPO" | "FACTURACION" | "COMUNICACIONES" | "NOSHOWS" | "CLIENTES",
      "prioridad": 1-6,
      "texto_colapsado": "string (máx 20 palabras)"
    }
  ]
}

IMPORTANTE: El array "bloques" DEBE tener los 6 bloques SIEMPRE, ordenados de más (1) a menos (6) urgente.`;
}

// ============================================
// FUNCIÓN: Construir User Prompt
// ============================================
function buildUserPrompt(
  agentName: string,
  ownerName: string,
  snapshot: any
): string {
  return `${agentName}, analiza este snapshot y responde:

SNAPSHOT COMPLETO:
${JSON.stringify(snapshot, null, 2)}

TAREAS:
1. Identifica el problema/oportunidad MÁS IMPORTANTE
2. Genera un mensaje principal (máx 60 palabras)
3. Propón UNA acción del catálogo (o null si no aplica)
4. Ordena los 6 bloques de más a menos urgente
5. Escribe el texto colapsado de cada bloque (máx 20 palabras)

Responde SOLO con JSON (sin markdown):`;
}
