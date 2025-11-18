// Check Availability Unified
// Verifica disponibilidad consultando tanto appointments locales como Google Calendar en tiempo real

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    console.log('🔍 Check Availability Unified called')
    
    // ✅ Extraer y validar header de autorización
    const authHeader = req.headers.get('authorization')
    const apikey = req.headers.get('apikey')
    
    if (!authHeader && !apikey) {
      return new Response(
        JSON.stringify({ 
          code: 401, 
          message: 'Missing authorization header',
          error: 'Se requiere autenticación'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ✅ Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ Parsear body
    const body = await req.json()
    const { business_id, resource_id, start_time, end_time } = body

    if (!business_id || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ 
          error: 'business_id, start_time, y end_time son requeridos' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startTime = new Date(start_time)
    const endTime = new Date(end_time)

    console.log(`🔍 Verificando disponibilidad: business_id=${business_id}, resource_id=${resource_id || 'null'}, start=${startTime.toISOString()}, end=${endTime.toISOString()}`)

    // ✅ 1. Verificar appointments locales
    const localConflicts = await checkLocalAppointments(
      supabaseClient,
      business_id,
      resource_id,
      startTime,
      endTime
    )

    console.log(`📊 Conflictos locales encontrados: ${localConflicts.length}`)

    // ✅ 2. Verificar Google Calendar (si hay integración)
    const googleConflicts = await checkGoogleCalendar(
      supabaseClient,
      business_id,
      resource_id,
      startTime,
      endTime
    )

    console.log(`📊 Conflictos en Google Calendar encontrados: ${googleConflicts.length}`)

    // ✅ 3. Combinar resultados
    const allConflicts = [...localConflicts, ...googleConflicts]
    const available = allConflicts.length === 0

    return new Response(
      JSON.stringify({
        available,
        conflicts: allConflicts,
        local_conflicts: localConflicts.length,
        google_conflicts: googleConflicts.length,
        source: 'unified'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Check Availability Unified error:', error)
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Error desconocido',
        available: false,
        conflicts: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Verificar conflictos en appointments locales
 */
async function checkLocalAppointments(
  supabaseClient: any,
  businessId: string,
  resourceId: string | null,
  startTime: Date,
  endTime: Date
) {
  try {
    let query = supabaseClient
      .from('appointments')
      .select('id, start_time, end_time, status, source, notes')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed', 'blocked']) // Solo estados que bloquean
      .or(`start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()}`)

    // Si hay resource_id, filtrar por recurso o null (bloqueos globales)
    if (resourceId) {
      query = query.or(`resource_id.eq.${resourceId},resource_id.is.null`)
    } else {
      query = query.is('resource_id', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Error verificando appointments locales:', error)
      return []
    }

    return (data || []).map((appointment: any) => ({
      type: 'local',
      id: appointment.id,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      reason: appointment.notes || 'Reserva existente',
      source: appointment.source
    }))
  } catch (error) {
    console.error('❌ Error en checkLocalAppointments:', error)
    return []
  }
}

/**
 * Verificar conflictos en Google Calendar (tiempo real)
 */
async function checkGoogleCalendar(
  supabaseClient: any,
  businessId: string,
  resourceId: string | null,
  startTime: Date,
  endTime: Date
) {
  try {
    // ✅ Obtener integración de Google Calendar
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('business_id', businessId)
      .eq('provider', 'google_calendar')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      console.log('ℹ️ No hay integración de Google Calendar activa')
      return []
    }

    // ✅ Obtener access_token (refrescar si es necesario)
    let accessToken = integration.access_token
    const refreshToken = integration.refresh_token
    const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null

    if (!accessToken || (tokenExpiresAt && tokenExpiresAt <= new Date())) {
      console.log('🔄 Refrescando token de Google Calendar...')
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!refreshResponse.ok) {
        console.error('❌ Error refrescando token')
        return []
      }

      const newTokens = await refreshResponse.json()
      accessToken = newTokens.access_token

      // Actualizar token en BD
      await supabaseClient
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString(),
        })
        .eq('id', integration.id)
    }

    // ✅ Obtener calendarios a verificar
    const resourceCalendarMapping = integration.config?.resource_calendar_mapping || {}
    let calendarIds: string[] = []

    if (resourceId && resourceCalendarMapping[resourceId]) {
      // Si hay recurso vinculado, verificar solo ese calendario
      calendarIds = [resourceCalendarMapping[resourceId]]
    } else if (integration.config?.calendar_ids) {
      // Si no hay recurso vinculado, verificar todos los calendarios seleccionados
      calendarIds = Array.isArray(integration.config.calendar_ids)
        ? integration.config.calendar_ids
        : [integration.config.calendar_ids]
    } else if (integration.config?.calendar_id) {
      calendarIds = Array.isArray(integration.config.calendar_id)
        ? integration.config.calendar_id
        : [integration.config.calendar_id]
    } else {
      calendarIds = ['primary']
    }

    console.log(`📅 Verificando ${calendarIds.length} calendario(s) en Google Calendar`)

    // ✅ Consultar Google Calendar API para cada calendario
    const conflicts: any[] = []
    const timeMin = startTime.toISOString()
    const timeMax = endTime.toISOString()

    for (const calendarId of calendarIds) {
      try {
        const encodedCalendarId = encodeURIComponent(calendarId)
        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )

        if (!eventsResponse.ok) {
          console.warn(`⚠️ Error consultando calendario ${calendarId}`)
          continue
        }

        const eventsData = await eventsResponse.json()
        const events = eventsData?.items || []

        for (const event of events) {
          // Solo eventos con hora (no todo el día)
          if (event.start?.dateTime) {
            const eventStart = new Date(event.start.dateTime)
            const eventEnd = new Date(event.end?.dateTime || event.start.dateTime)

            // Verificar solapamiento
            if (eventStart < endTime && eventEnd > startTime) {
              conflicts.push({
                type: 'google_calendar',
                id: event.id,
                start_time: eventStart.toISOString(),
                end_time: eventEnd.toISOString(),
                reason: event.summary || 'Evento en Google Calendar',
                calendar_id: calendarId,
                source: 'google_calendar'
              })
            }
          }
        }
      } catch (calendarError) {
        console.error(`❌ Error consultando calendario ${calendarId}:`, calendarError)
        continue
      }
    }

    return conflicts
  } catch (error) {
    console.error('❌ Error en checkGoogleCalendar:', error)
    return []
  }
}

