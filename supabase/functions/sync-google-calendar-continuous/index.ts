// Sync Google Calendar Continuous
// Sincronización periódica de Google Calendar → LA-IA
// Se ejecuta cada 10-15 minutos para detectar cambios en Google Calendar

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
    console.log('🔄 Sync Google Calendar Continuous called')
    
    // ✅ Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ Parsear body (opcional, puede ser llamado sin body para sincronizar todos)
    let requestBody: any = {}
    try {
      requestBody = await req.json()
    } catch {
      // Si no hay body, continuar (sincronizar todos los negocios activos)
    }

    const { business_id } = requestBody

    // ✅ Obtener integraciones activas
    let integrationsQuery = supabaseClient
      .from('integrations')
      .select('*')
      .eq('provider', 'google_calendar')
      .eq('is_active', true)

    if (business_id) {
      integrationsQuery = integrationsQuery.eq('business_id', business_id)
    }

    const { data: integrations, error: integrationsError } = await integrationsQuery

    if (integrationsError || !integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No hay integraciones activas de Google Calendar',
          synced: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Sincronizando ${integrations.length} integración(es)`)

    let totalSynced = 0
    let totalErrors = 0

    // ✅ Sincronizar cada integración
    for (const integration of integrations) {
      try {
        const result = await syncBusinessCalendar(supabaseClient, integration)
        if (result.success) {
          totalSynced++
        } else {
          totalErrors++
        }
      } catch (error) {
        console.error(`❌ Error sincronizando business_id ${integration.business_id}:`, error)
        totalErrors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        errors: totalErrors,
        total: integrations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Sync Google Calendar Continuous error:', error)
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Error desconocido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Sincronizar calendario de un negocio específico
 */
async function syncBusinessCalendar(supabaseClient: any, integration: any) {
  try {
    const businessId = integration.business_id
    console.log(`🔄 Sincronizando business_id: ${businessId}`)

    // ✅ Obtener access_token (refrescar si es necesario)
    let accessToken = integration.access_token
    const refreshToken = integration.refresh_token
    const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null

    if (!accessToken || (tokenExpiresAt && tokenExpiresAt <= new Date())) {
      console.log('🔄 Refrescando token...')
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
        throw new Error('Error refrescando token')
      }

      const newTokens = await refreshResponse.json()
      accessToken = newTokens.access_token

      // Actualizar token
      await supabaseClient
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString(),
        })
        .eq('id', integration.id)
    }

    // ✅ Obtener calendarios a sincronizar
    let calendarIds: string[] = []
    if (integration.config?.calendar_ids && Array.isArray(integration.config.calendar_ids)) {
      calendarIds = integration.config.calendar_ids
    } else if (integration.config?.calendar_id) {
      calendarIds = Array.isArray(integration.config.calendar_id)
        ? integration.config.calendar_id
        : [integration.config.calendar_id]
    } else {
      calendarIds = ['primary']
    }

    // ✅ Obtener última sincronización
    const lastSyncAt = integration.last_sync_at
      ? new Date(integration.last_sync_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas si no hay sync previo

    const timeMin = lastSyncAt.toISOString()
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // Próximos 90 días

    console.log(`📅 Sincronizando desde ${timeMin} hasta ${timeMax}`)

    let totalImported = 0
    let totalUpdated = 0
    let totalDeleted = 0

    const resourceCalendarMapping = integration.config?.resource_calendar_mapping || {}

    // ✅ Sincronizar cada calendario
    for (const calendarId of calendarIds) {
      try {
        const encodedCalendarId = encodeURIComponent(calendarId)
        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&updatedMin=${timeMin}`,
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

        console.log(`📅 Calendario ${calendarId}: ${events.length} eventos encontrados`)

        // ✅ Procesar cada evento
        for (const event of events) {
          const isAllDay = !!event.start.date
          const hasTime = !!event.start.dateTime

          if (hasTime && !isAllDay) {
            // Evento con hora → appointment bloqueado
            const result = await syncTimedEvent(
              supabaseClient,
              businessId,
              event,
              calendarId,
              resourceCalendarMapping
            )
            if (result.created) totalImported++
            if (result.updated) totalUpdated++
          } else if (isAllDay) {
            // Evento de todo el día → calendar_exception (solo si es cerrado)
            // Por ahora solo sincronizamos eventos con hora
            // Los eventos de todo el día se manejan en import-google-calendar-initial
          }
        }
      } catch (calendarError) {
        console.error(`❌ Error sincronizando calendario ${calendarId}:`, calendarError)
        continue
      }
    }

    // ✅ Actualizar última sincronización
    await supabaseClient
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    console.log(`✅ Sincronización completada: ${totalImported} importados, ${totalUpdated} actualizados`)

    return {
      success: true,
      imported: totalImported,
      updated: totalUpdated,
      deleted: totalDeleted
    }
  } catch (error) {
    console.error('❌ Error en syncBusinessCalendar:', error)
    return {
      success: false,
      error: error?.message || 'Error desconocido'
    }
  }
}

/**
 * Sincronizar evento con hora como appointment bloqueado
 */
async function syncTimedEvent(
  supabaseClient: any,
  businessId: string,
  event: any,
  calendarId: string,
  resourceCalendarMapping: Record<string, string>
) {
  try {
    const startTime = new Date(event.start.dateTime)
    const endTime = new Date(event.end?.dateTime || event.start.dateTime)

    // ✅ Determinar resource_id
    let resourceId: string | null = null
    if (resourceCalendarMapping[calendarId]) {
      resourceId = resourceCalendarMapping[calendarId]
    }

    // ✅ Verificar si existe
    const { data: existing } = await supabaseClient
      .from('appointments')
      .select('id')
      .eq('business_id', businessId)
      .eq('gcal_event_id', event.id)
      .maybeSingle()

    const appointmentData = {
      business_id: businessId,
      resource_id: resourceId,
      employee_id: null,
      customer_id: null,
      service_id: null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
      status: 'blocked',
      source: 'google_calendar',
      synced_to_gcal: false,
      gcal_event_id: event.id,
      notes: event.summary || 'Evento bloqueado de Google Calendar',
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      // Actualizar
      await supabaseClient
        .from('appointments')
        .update(appointmentData)
        .eq('id', existing.id)

      return { updated: true, created: false }
    } else {
      // Crear
      appointmentData.created_at = new Date().toISOString()
      await supabaseClient
        .from('appointments')
        .insert(appointmentData)

      return { created: true, updated: false }
    }
  } catch (error) {
    console.error(`❌ Error sincronizando evento ${event.id}:`, error)
    return { created: false, updated: false }
  }
}

