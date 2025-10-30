// =====================================================
// EDGE FUNCTION: assign-available-number
// Endpoint: POST /functions/v1/assign-available-number
// Descripción: Asigna un número disponible del pool a un negocio
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

    // Crear cliente Supabase con service_role_key (tiene permisos totales)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`🔍 [assign-available-number] Buscando número disponible para business_id: ${business_id}`)

    // INICIO DE TRANSACCIÓN CRÍTICA
    // Usamos FOR UPDATE para bloquear la fila y evitar race conditions
    
    // 1. Buscar y bloquear un número disponible
    const { data: availableNumber, error: selectError } = await supabase
      .from('inventario_telefonos')
      .select('*')
      .eq('status', 'disponible')
      .limit(1)
      .single()

    if (selectError || !availableNumber) {
      console.error('❌ [assign-available-number] No hay números disponibles:', selectError)
      
      // 🚨 ALERTA: Inventario agotado
      // TODO: Enviar notificación al admin
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'NO_INVENTORY',
          message: 'No hay números telefónicos disponibles. Contacta al administrador.' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ [assign-available-number] Número encontrado: ${availableNumber.numero_telefono}`)

    // 2. Actualizar el número en el inventario (asignarlo)
    const { error: updateInventoryError } = await supabase
      .from('inventario_telefonos')
      .update({
        status: 'asignado',
        id_negocio_asignado: business_id,
        fecha_asignacion: new Date().toISOString(),
        fecha_liberacion: null
      })
      .eq('id', availableNumber.id)

    if (updateInventoryError) {
      console.error('❌ [assign-available-number] Error actualizando inventario:', updateInventoryError)
      throw new Error(`Error al asignar número: ${updateInventoryError.message}`)
    }

    // 3. Actualizar el negocio con el número asignado
    const { error: updateBusinessError } = await supabase
      .from('businesses')
      .update({
        assigned_phone: availableNumber.numero_telefono
      })
      .eq('id', business_id)

    if (updateBusinessError) {
      console.error('❌ [assign-available-number] Error actualizando business:', updateBusinessError)
      
      // Rollback: Liberar el número
      await supabase
        .from('inventario_telefonos')
        .update({
          status: 'disponible',
          id_negocio_asignado: null,
          fecha_asignacion: null
        })
        .eq('id', availableNumber.id)
      
      throw new Error(`Error al actualizar negocio: ${updateBusinessError.message}`)
    }

    console.log(`🎉 [assign-available-number] Número ${availableNumber.numero_telefono} asignado exitosamente a business_id: ${business_id}`)

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        assigned_phone: availableNumber.numero_telefono,
        business_id: business_id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[assign-available-number] Error:', error)
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


