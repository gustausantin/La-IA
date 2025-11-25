// ============================================
// Edge Function: generate-flash-offer-text
// Propósito: Generar texto de oferta flash usando OpenAI GPT-4o-mini
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // 1. Obtener API Key de OpenAI desde Supabase Secrets
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("⚠️ OPENAI_API_KEY no está configurada en Supabase Secrets");
    }

    // 2. Obtener parámetros
    const { business_id, slot_time, service_name, discount_percent, vertical_type } = await req.json();
    
    if (!business_id || !slot_time || !service_name) {
      throw new Error("Parámetros requeridos: business_id, slot_time, service_name");
    }

    console.log(`✨ Generando oferta flash para ${business_id}:`);
    console.log(`   - Servicio: ${service_name}`);
    console.log(`   - Hora: ${slot_time}`);
    console.log(`   - Descuento: ${discount_percent}%`);
    console.log(`   - Vertical: ${vertical_type}`);

    // 3. Mapear vertical a emoji y contexto
    const verticalContext = {
      barbershop: { emoji: "💈✂️", context: "barbería", services: "cortes y afeitados" },
      salon: { emoji: "💅✨", context: "salón de belleza", services: "peluquería y estética" },
      spa: { emoji: "🧖‍♀️💆", context: "spa", services: "masajes y tratamientos" },
      clinic: { emoji: "🩺💉", context: "clínica", services: "consultas y tratamientos" },
      gym: { emoji: "💪🏋️", context: "gimnasio", services: "entrenamientos" },
      tattoo: { emoji: "🎨🖋️", context: "estudio de tatuajes", services: "tatuajes y diseños" },
      nails: { emoji: "💅✨", context: "salón de uñas", services: "manicura y pedicura" },
      restaurant: { emoji: "🍽️👨‍🍳", context: "restaurante", services: "mesas" },
    };

    const vType = vertical_type || "salon";
    const vInfo = verticalContext[vType] || verticalContext["salon"];

    // 4. Crear prompt contextual para OpenAI
    const prompt = `Eres un experto en marketing para negocios de ${vInfo.context}.

Genera un texto de máximo 120 caracteres para WhatsApp Status anunciando un hueco disponible:

- Horario: ${slot_time}
- Servicio: ${service_name}
- Descuento: ${discount_percent}%
- Tono: Urgente pero amigable, como una oportunidad exclusiva
- Emojis: Usa MÁXIMO 2 emojis relevantes (sugerencia: ${vInfo.emoji})
- Call to Action: "DM para reservar" o similar

EJEMPLOS DE REFERENCIA (NO COPIES EXACTO):
- "¡Hueco Flash! Corte a las 12:00 con 15% dto. Solo hoy. DM para reservar 💈✂️"
- "Oportunidad 🔥 Tinte a las 14:00 con 20% OFF. Última hora. Escríbeme 💅"
- "Masaje express a las 16:00 con descuento. Solo para seguidores. DM 💆✨"

IMPORTANTE:
- NO uses comillas
- NO uses hashtags
- Máximo 120 caracteres
- Genera SOLO el texto, sin explicaciones

Genera el texto:`;

    // 5. Llamar a OpenAI API
    console.log("🤖 Llamando a OpenAI API...");
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Modelo rápido y económico
        messages: [
          {
            role: "system",
            content: `Eres un experto en copywriting para pequeños negocios de ${vInfo.services}. Generas textos cortos, urgentes y efectivos para redes sociales. Siempre respetas el límite de caracteres y usas emojis con moderación.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 60, // ~120 caracteres
        temperature: 0.8, // Creatividad moderada
        top_p: 0.9,
        frequency_penalty: 0.5, // Evita repetición
        presence_penalty: 0.5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    
    // 6. Extraer texto generado
    const generatedText = data.choices[0].message.content.trim();
    
    // Remover comillas si las tiene
    const cleanText = generatedText.replace(/^["']|["']$/g, "");
    
    // Verificar longitud
    if (cleanText.length > 120) {
      console.warn(`⚠️ Texto generado es muy largo (${cleanText.length} chars). Truncando...`);
    }

    const finalText = cleanText.substring(0, 120);

    // 7. Calcular costo
    const totalTokens = data.usage.total_tokens;
    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;
    
    // Pricing de gpt-4o-mini: $0.150 / 1M input tokens, $0.600 / 1M output tokens
    const costUSD = (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.60;

    console.log(`✅ Texto generado: "${finalText}"`);
    console.log(`📊 Tokens: ${totalTokens} (input: ${inputTokens}, output: ${outputTokens})`);
    console.log(`💰 Costo: $${costUSD.toFixed(6)} USD (~€${(costUSD * 0.92).toFixed(6)})`);

    // 8. Devolver resultado
    return new Response(
      JSON.stringify({
        success: true,
        offer_text: finalText,
        metadata: {
          tokens_used: totalTokens,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: parseFloat(costUSD.toFixed(6)),
          cost_eur: parseFloat((costUSD * 0.92).toFixed(6)),
          char_count: finalText.length,
          model: "gpt-4o-mini",
        },
        suggested_actions: [
          {
            type: "copy_to_clipboard",
            label: "Copiar texto",
          },
          {
            type: "whatsapp_status",
            label: "Pegar en WhatsApp Status",
            url: "https://wa.me/",
          },
        ],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error en generate-flash-offer-text:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        offer_text: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});




