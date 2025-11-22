// Google Calendar Webhook Handler
// Recibe notificaciones push de Google Calendar cuando hay cambios
// ✅ GRATIS y EFICIENTE - Solo se ejecuta cuando hay cambios reales

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
    console.log('📥 Webhook de Google Calendar recibido')
    console.log('📋 Headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2))
    console.log('📋 Method:', req.method)
    console.log('📋 URL:', req.url)

    // ✅ Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ Google Calendar envía notificaciones en formato JSON
    let notification
    try {
      notification = await req.json()
      console.log('📨 Notificación recibida:', JSON.stringify(notification, null, 2))
    } catch (error) {
      console.warn('⚠️ No se pudo parsear el body como JSON:', error)
      // Si no hay body, puede ser una verificación inicial de Google
      return new Response(
        JSON.stringify({ message: 'Webhook endpoint activo', received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!notification) {
      console.warn('⚠️ Notificación vacía o null')
      // Si no hay body, puede ser una verificación inicial de Google
      return new Response(
        JSON.stringify({ message: 'Webhook endpoint activo', received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Google Calendar envía notificaciones con esta estructura:
    // {
    //   "channel_id": "unique-channel-id",
    //   "resource_id": "calendar-resource-id",
    //   "resource_state": "sync" | "exists" | "not_exists",
    //   "resource_uri": "https://www.googleapis.com/calendar/v3/calendars/...",
    //   "changed": "2025-11-21T12:00:00Z"
    // }

    const { channel_id, resource_id, resource_state, resource_uri } = notification

    if (!channel_id || !resource_uri) {
      console.warn('⚠️ Notificación incompleta, ignorando')
      return new Response(
        JSON.stringify({ message: 'Notificación incompleta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Buscar la integración que tiene este channel_id
    // Buscar en watch_channels dentro de config
    const { data: integrations, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('provider', 'google_calendar')
      .eq('is_active', true)

    if (integrationError || !integrations || integrations.length === 0) {
      console.warn(`⚠️ No se encontraron integraciones activas`)
      return new Response(
        JSON.stringify({ message: 'Integración no encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Buscar la integración que tiene este channel_id en sus watch_channels
    let integration = null
    for (const integ of integrations) {
      const watchChannels = integ.config?.watch_channels || []
      const hasChannel = watchChannels.some((wc: any) => wc.channel_id === channel_id)
      if (hasChannel) {
        integration = integ
        break
      }
    }

    if (!integration) {
      console.warn(`⚠️ No se encontró integración para channel_id: ${channel_id}`)
      return new Response(
        JSON.stringify({ message: 'Integración no encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const businessId = integration.business_id
    console.log(`🔄 Sincronizando cambios para business_id: ${businessId}`)

    // ✅ Refrescar token si es necesario
    let accessToken = integration.access_token || integration.credentials?.access_token
    const refreshToken = integration.refresh_token || integration.credentials?.refresh_token
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

    // ✅ Extraer calendar_id del resource_uri
    // Formato: https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events
    const calendarIdMatch = resource_uri.match(/calendars\/([^\/]+)/)
    if (!calendarIdMatch) {
      console.warn('⚠️ No se pudo extraer calendar_id del resource_uri')
      return new Response(
        JSON.stringify({ message: 'Calendar ID no encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const calendarId = decodeURIComponent(calendarIdMatch[1])
    console.log(`📅 Sincronizando calendario: ${calendarId}`)

    // ✅ Obtener eventos modificados desde la última sincronización
    const lastSyncAt = integration.last_sync_at
      ? new Date(integration.last_sync_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas si no hay sync previo

    const timeMin = lastSyncAt.toISOString()
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // Próximos 90 días

    // ✅ Obtener eventos actualizados desde lastSyncAt
    const encodedCalendarId = encodeURIComponent(calendarId)
    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&updatedMin=${timeMin}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!eventsResponse.ok) {
      const errorData = await eventsResponse.json().catch(() => ({}))
      console.error(`❌ Error obteniendo eventos:`, errorData)
      throw new Error(`Error obteniendo eventos: ${JSON.stringify(errorData)}`)
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData?.items || []

    console.log(`📅 ${events.length} eventos encontrados para sincronizar`)

    // ✅ Obtener mapeo de calendarios a empleados
    const employeeCalendarMapping = integration.config?.employee_calendar_mapping || {}
    const resourceCalendarMapping = integration.config?.resource_calendar_mapping || {}

    // ✅ Buscar employee_id para este calendario
    let employeeId = null
    for (const [empId, calId] of Object.entries(employeeCalendarMapping)) {
      if (calId === calendarId) {
        employeeId = empId
        break
      }
    }

    // Si no hay mapeo por empleado, buscar por recurso
    if (!employeeId) {
      for (const [resId, calId] of Object.entries(resourceCalendarMapping)) {
        if (calId === calendarId) {
          // Buscar employee_id desde resource_id
          const { data: employee } = await supabaseClient
            .from('employees')
            .select('id')
            .eq('assigned_resource_id', resId)
            .eq('business_id', businessId)
            .single()
          
          if (employee) {
            employeeId = employee.id
          }
          break
        }
      }
    }

    let imported = 0
    let updated = 0

    // ✅ Procesar cada evento
    for (const event of events) {
      const isAllDay = !!event.start.date
      const hasTime = !!event.start.dateTime

      // Solo procesar eventos con hora (appointments)
      if (hasTime && !isAllDay) {
        try {
          const result = await syncEventToAppointment(
            supabaseClient,
            businessId,
            event,
            calendarId,
            employeeId
          )
          
          if (result.created) imported++
          if (result.updated) updated++
        } catch (error) {
          console.error(`❌ Error sincronizando evento ${event.id}:`, error)
        }
      }
    }

    // ✅ Actualizar última sincronización
    await supabaseClient
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    console.log(`✅ Sincronización completada: ${imported} importados, ${updated} actualizados`)

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        calendar_id: calendarId,
        events_processed: events.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en webhook de Google Calendar:', error)
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Error desconocido',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * Sincronizar un evento de Google Calendar a appointment
 */
async function syncEventToAppointment(
  supabaseClient: any,
  businessId: string,
  event: any,
  calendarId: string,
  employeeId: string | null
) {
  const startDateTime = event.start.dateTime
  const endDateTime = event.end.dateTime

  if (!startDateTime || !endDateTime) {
    throw new Error('Evento sin fecha/hora válida')
  }

  // ✅ Parsear fecha y hora (usar hora local, no UTC)
  const parseISODateTime = (isoString: string) => {
    const match = isoString.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
    if (!match || !match[1]) {
      throw new Error(`Formato ISO inválido: ${isoString}`)
    }
    const dateTimePart = match[1]
    const [datePart, timePart] = dateTimePart.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const timeParts = timePart.split(':')
    const hours = Number(timeParts[0])
    const minutes = Number(timeParts[1])
    const seconds = Number(timeParts[2] || 0)
    return { year, month, day, hours, minutes, seconds }
  }

  const startParsed = parseISODateTime(startDateTime)
  const endParsed = parseISODateTime(endDateTime)

  const appointmentDate = `${startParsed.year}-${String(startParsed.month).padStart(2, '0')}-${String(startParsed.day).padStart(2, '0')}`
  const appointmentTime = `${String(startParsed.hours).padStart(2, '0')}:${String(startParsed.minutes).padStart(2, '0')}:${String(startParsed.seconds).padStart(2, '0')}`
  const endTime = `${String(endParsed.hours).padStart(2, '0')}:${String(endParsed.minutes).padStart(2, '0')}:${String(endParsed.seconds).padStart(2, '0')}`

  // Calcular duración
  const startTime = new Date(startDateTime)
  const endTimeObj = new Date(endDateTime)
  const durationMinutes = Math.round((endTimeObj.getTime() - startTime.getTime()) / (1000 * 60))

  // ✅ Buscar si ya existe un appointment con este gcal_event_id
  const { data: existing } = await supabaseClient
    .from('appointments')
    .select('id')
    .eq('business_id', businessId)
    .eq('gcal_event_id', event.id)
    .single()

  // ✅ Obtener cliente genérico (NO crear uno nuevo por evento)
  // Solo usar "Cliente de Google Calendar" - si no existe, se crea UNA VEZ en la importación inicial
  let { data: customer } = await supabaseClient
    .from('customers')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', 'Cliente de Google Calendar')
    .maybeSingle()

  if (!customer) {
    // ✅ Si no existe el cliente genérico, crearlo UNA VEZ (solo la primera vez)
    console.log('⚠️ Cliente genérico no existe, creándolo UNA VEZ...')
    const { data: newCustomer, error: customerError } = await supabaseClient
      .from('customers')
      .insert({
        business_id: businessId,
        name: 'Cliente de Google Calendar',
        email: null,
        phone: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single()
    
    if (customerError) {
      console.error('❌ Error creando cliente genérico:', customerError)
      throw new Error(`No se pudo obtener o crear cliente genérico: ${customerError.message}`)
    }
    
    customer = newCustomer
    console.log('✅ Cliente genérico creado UNA VEZ:', customer.id)
  }

  // ✅ Obtener primer servicio activo
  const { data: service } = await supabaseClient
    .from('business_services')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('position_order', { ascending: true })
    .limit(1)
    .single()

  if (!service) {
    throw new Error('No hay servicios activos para este negocio')
  }

  const appointmentData: any = {
    business_id: businessId,
    customer_id: customer.id,
    service_id: service.id,
    employee_id: employeeId,
    resource_id: employeeId, // Usar employee_id como resource_id también
    customer_name: 'Cliente de Google Calendar', // ✅ SIEMPRE este nombre, no el del evento
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    duration_minutes: durationMinutes,
    end_time: endTime,
    status: 'blocked',
    source: 'google_calendar',
    notes: event.description || event.summary || 'Evento de Google Calendar',
    gcal_event_id: event.id,
    calendar_id: calendarId,
    internal_notes: {
      gcal_event_id: event.id,
      calendar_id: calendarId,
      source: 'google_calendar_webhook',
      original_summary: event.summary,
      original_description: event.description || null,
      // ✅ Guardar información extraída del evento aquí (NO crear cliente)
      extracted_customer_name: event.summary || null,
      extracted_customer_email: null, // Se puede extraer del description si es necesario
      extracted_customer_phone: null, // Se puede extraer del description si es necesario
    }, // ✅ JSONB - Supabase lo maneja automáticamente
    updated_at: new Date().toISOString()
  }

  if (existing) {
    // Actualizar appointment existente
    const { error } = await supabaseClient
      .from('appointments')
      .update(appointmentData)
      .eq('id', existing.id)

    if (error) throw error

    return { created: false, updated: true }
  } else {
    // Crear nuevo appointment
    appointmentData.created_at = new Date().toISOString()
    
    const { error } = await supabaseClient
      .from('appointments')
      .insert(appointmentData)

    if (error) throw error

    return { created: true, updated: false }
  }
}

