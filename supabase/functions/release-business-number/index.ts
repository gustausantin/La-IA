// =====================================================
// EDGE FUNCTION: release-business-number
// Endpoint: POST /functions/v1/release-business-number
// Descripción: Libera el número de un negocio y lo pone en cuarentena (48h)
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
    const { business_id } = await req.json()

    // Validar business_id
    if (!business_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'business_id is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase con service_role_key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`🔍 [release-business-number] Liberando número para business_id: ${business_id}`)

    // 1. Buscar el número asignado a este negocio
    const { data: assignedNumber, error: selectError } = await supabase
      .from('inventario_telefonos')
      .select('*')
      .eq('id_negocio_asignado', business_id)
      .eq('status', 'asignado')
      .single()

    if (selectError || !assignedNumber) {
      console.warn('⚠️ [release-business-number] No se encontró número asignado:', selectError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'NO_ASSIGNED_NUMBER',
          message: 'Este negocio no tiene un número asignado' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📞 [release-business-number] Número encontrado: ${assignedNumber.numero_telefono}`)

    // 2. Poner el número en cuarentena (48h)
    const { error: updateInventoryError } = await supabase
      .from('inventario_telefonos')
      .update({
        status: 'en_cuarentena',
        id_negocio_asignado: null,
        fecha_liberacion: new Date().toISOString()
      })
      .eq('id', assignedNumber.id)

    if (updateInventoryError) {
      console.error('❌ [release-business-number] Error actualizando inventario:', updateInventoryError)
      throw new Error(`Error al liberar número: ${updateInventoryError.message}`)
    }

    // 3. Limpiar el campo assigned_phone del negocio
    const { error: updateBusinessError } = await supabase
      .from('businesses')
      .update({
        assigned_phone: null
      })
      .eq('id', business_id)

    if (updateBusinessError) {
      console.error('❌ [release-business-number] Error actualizando business:', updateBusinessError)
      // No hacemos rollback aquí, el número ya está en cuarentena (estado seguro)
    }

    console.log(`⏳ [release-business-number] Número ${assignedNumber.numero_telefono} puesto en cuarentena por 48h`)

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        released_phone: assignedNumber.numero_telefono,
        business_id: business_id,
        quarantine_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        message: 'Número liberado. Estará disponible de nuevo en 48 horas.'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[release-business-number] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


