// =====================================================
// EDGE FUNCTION: get-vertical-onboarding-config
// Endpoint: POST /functions/v1/get-vertical-onboarding-config
// Descripción: Obtiene configuración dinámica del onboarding según vertical
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
    const { vertical_type } = await req.json()

    // Validar vertical_type
    if (!vertical_type) {
      return new Response(
        JSON.stringify({ error: 'vertical_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Obtener configuración del vertical (nombre de recursos)
    const { data: verticalConfig, error: verticalError } = await supabase
      .from('business_verticals')
      .select('resource_name_singular, resource_name_plural, appointment_name, default_duration_minutes')
      .eq('code', vertical_type)
      .single()

    if (verticalError || !verticalConfig) {
      return new Response(
        JSON.stringify({ error: 'Vertical type not found', details: verticalError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Obtener servicios predefinidos para este vertical
    const { data: services, error: servicesError } = await supabase
      .from('service_templates')
      .select('name, description, category, duration_minutes, suggested_price, is_popular')
      .eq('vertical_type', vertical_type)
      .order('is_popular', { ascending: false })
      .order('sort_order', { ascending: true })

    if (servicesError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching services', details: servicesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Preparar respuesta
    const response = {
      success: true,
      vertical_type,
      resource_name_singular: verticalConfig.resource_name_singular,
      resource_name_plural: verticalConfig.resource_name_plural,
      appointment_name: verticalConfig.appointment_name || 'Cita',
      default_duration_minutes: verticalConfig.default_duration_minutes || 60,
      suggested_services: services || []
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[get-vertical-onboarding-config] Error:', error)
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

