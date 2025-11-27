// =====================================================
// EDGE FUNCTION: vapi-inbound-handler
// Endpoint: POST /functions/v1/vapi-inbound-handler
// Descripción: Maneja webhooks de VAPI para hidratar el prompt dinámicamente
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeo de vocabulario de clientes según vertical_type
// Basado en useVertical.js del frontend
const getClientTerm = (verticalType: string): string => {
  const patientVerticals = ['fisioterapia', 'clinica_dental']
  return patientVerticals.includes(verticalType) ? 'Paciente' : 'Cliente'
}

// Mapeo especial para yoga_pilates
const getClientTermForVertical = (verticalType: string): string => {
  if (verticalType === 'yoga_pilates') return 'Alumno'
  return getClientTerm(verticalType)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body (webhook de VAPI)
    const body = await req.json()
    
    // VAPI envía el número en: message.phoneNumber.phoneNumber
    const phoneNumber = body?.message?.phoneNumber?.phoneNumber || body?.phoneNumber
    
    if (!phoneNumber) {
      console.error('[vapi-inbound-handler] No phone number provided:', body)
      return new Response(
        JSON.stringify({ 
          error: 'Phone number is required',
          received: body 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[vapi-inbound-handler] Processing call for phone:', phoneNumber)

    // Crear cliente Supabase con SERVICE_ROLE_KEY para bypassear RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Buscar negocio por assigned_phone o phone
    // Normalizar el número (remover espacios, guiones, y convertir 00 a +)
    let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '')
    // Convertir prefijo internacional 00 a +
    if (normalizedPhone.startsWith('00')) {
      normalizedPhone = '+' + normalizedPhone.substring(2)
    }
    // Asegurar que tenga el prefijo + si es un número internacional
    if (!normalizedPhone.startsWith('+') && normalizedPhone.startsWith('34')) {
      normalizedPhone = '+' + normalizedPhone
    }
    
    console.log('[vapi-inbound-handler] Normalized phone:', normalizedPhone)
    
    // Buscar el negocio - intentar primero búsqueda exacta, luego con ilike
    // Primero: búsqueda exacta (más rápida y precisa)
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        business_name,
        vertical_type,
        agent_config,
        settings,
        assigned_phone,
        phone
      `)
      .or(`assigned_phone.eq.${normalizedPhone},phone.eq.${normalizedPhone}`)
      .eq('active', true)
      .maybeSingle()
    
    // Si no se encuentra con búsqueda exacta, intentar con ilike (más flexible)
    if (!business && !businessError) {
      console.log('[vapi-inbound-handler] Exact match not found, trying ilike search...')
      const { data: businessLike, error: errorLike } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          business_name,
          vertical_type,
          agent_config,
          settings,
          assigned_phone,
          phone
        `)
        .or(`assigned_phone.ilike.%${normalizedPhone}%,phone.ilike.%${normalizedPhone}%`)
        .eq('active', true)
        .maybeSingle()
      
      business = businessLike
      businessError = errorLike
    }

    if (businessError || !business) {
      console.warn('[vapi-inbound-handler] Business not found for phone:', phoneNumber, businessError)
      
      // Valores por defecto (Fallback) para que la llamada no falle
      return new Response(
        JSON.stringify({
          assistantOverrides: {
            variableValues: {
              BUSINESS_NAME: 'Nuestro negocio',
              SECTOR_NAME: 'Servicios profesionales',
              CLIENT_TERM: 'Cliente',
              ASSET_TERM: 'Recurso',
              SERVICES_LIST: 'Servicios disponibles',
              TONE_INSTRUCTIONS: 'Sé amable y profesional'
            }
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('[vapi-inbound-handler] Found business:', business.id, business.name)

    // 2, 3, 4. Ejecutar consultas en paralelo para optimizar rendimiento
    // Estas consultas son independientes entre sí, solo dependen de business.vertical_type y business.id
    const [verticalConfigResult, contextResult, servicesResult] = await Promise.all([
      // 2. Configuración del vertical desde business_verticals
      supabase
        .from('business_verticals')
        .select('display_name, resource_name_singular, resource_name_plural, appointment_name')
        .eq('code', business.vertical_type)
        .single(),
      
      // 2b. Contexto personalizado del vertical desde vertical_context
      // Esta tabla sirve tanto para demos como para producción
      supabase
        .from('vertical_context')
        .select('base_prompt, context_info, tone_instructions, resource_singular, resource_plural')
        .or(`vertical_code.eq.${business.vertical_type},vertical_id.eq.${business.vertical_type}`)
        .single(),
      
      // 3. Servicios del negocio
      supabase
        .from('services')
        .select('name')
        .eq('business_id', business.id)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .limit(10) // Limitar a 10 servicios más relevantes
    ])

    // Extraer datos y manejar errores
    const { data: verticalConfig, error: verticalError } = verticalConfigResult
    if (verticalError) {
      console.error('[vapi-inbound-handler] Error fetching vertical config:', verticalError)
    }

    const { data: verticalContext, error: contextError } = contextResult
    // Si hay error, simplemente ignoramos (la tabla puede no tener datos para este vertical)
    if (contextError && contextError.code !== 'PGRST116') {
      console.warn('[vapi-inbound-handler] vertical_context not found (optional):', contextError.message)
    }

    const { data: services, error: servicesError } = servicesResult
    if (servicesError) {
      console.error('[vapi-inbound-handler] Error fetching services:', servicesError)
    }

    // 4. Extraer datos del negocio
    const businessName = business.business_name || business.name || 'Nuestro negocio'
    
    // Extraer assistant_name y tone desde agent_config
    const agentConfig = business.agent_config || {}
    const personality = agentConfig.personality || {}
    const assistantName = personality.name || agentConfig.assistant_name || 'Asistente'
    const tone = personality.tone || agentConfig.tone || 'friendly'
    
    // Extraer website desde settings si existe
    const settings = business.settings || {}
    const website = settings.website || ''

    // 5. Construir vocabulario según vertical
    // Priorizar business_vertical_context si existe, sino usar business_verticals
    const verticalType = business.vertical_type || 'peluqueria_barberia'
    const clientTerm = getClientTermForVertical(verticalType)
    const assetTerm = verticalContext?.resource_singular 
      || verticalConfig?.resource_name_singular 
      || 'Recurso'
    const sectorName = verticalConfig?.display_name || 'Servicios profesionales'
    
    // 6. Construir lista de servicios
    const servicesList = services && services.length > 0
      ? services.map(s => s.name).join(', ')
      : 'Servicios disponibles'

    // 7. Construir instrucciones de tono
    // Priorizar tone_instructions de business_vertical_context si existe
    let toneInstructions = verticalContext?.tone_instructions
    
    if (!toneInstructions) {
      // Fallback a lógica basada en tone del negocio
      toneInstructions = tone === 'friendly' 
        ? 'Sé amable, cercano y profesional. Usa un tono cálido y acogedor.'
        : tone === 'professional'
        ? 'Sé profesional, claro y directo. Mantén un tono formal pero accesible.'
        : tone === 'casual'
        ? 'Sé relajado y conversacional. Usa un tono informal pero respetuoso.'
        : 'Sé amable y profesional.'
    }
    
    // 7b. Extraer context_info adicional si existe
    const contextInfo = verticalContext?.context_info || {}

    // 8. Preparar respuesta para VAPI
    const response = {
      assistantOverrides: {
        variableValues: {
          BUSINESS_NAME: businessName,
          SECTOR_NAME: sectorName,
          CLIENT_TERM: clientTerm,
          ASSET_TERM: assetTerm,
          SERVICES_LIST: servicesList,
          TONE_INSTRUCTIONS: toneInstructions,
          ASSISTANT_NAME: assistantName,
          WEBSITE: website || '',
          // Si existe base_prompt en business_vertical_context, incluirlo
          ...(verticalContext?.base_prompt && { BASE_PROMPT: verticalContext.base_prompt }),
          // Si existe context_info, incluirlo como JSON string
          ...(Object.keys(contextInfo).length > 0 && { 
            CONTEXT_INFO: JSON.stringify(contextInfo) 
          })
        }
      }
    }

    console.log('[vapi-inbound-handler] Response prepared:', {
      businessName,
      sectorName,
      clientTerm,
      assetTerm,
      servicesCount: services?.length || 0
    })

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[vapi-inbound-handler] Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        assistantOverrides: {
          variableValues: {
            BUSINESS_NAME: 'Nuestro negocio',
            SECTOR_NAME: 'Servicios profesionales',
            CLIENT_TERM: 'Cliente',
            ASSET_TERM: 'Recurso',
            SERVICES_LIST: 'Servicios disponibles',
            TONE_INSTRUCTIONS: 'Sé amable y profesional'
          }
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

