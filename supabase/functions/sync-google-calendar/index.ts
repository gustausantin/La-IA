// Google Calendar Sync - Bidirectional Synchronization
// Syncs appointments between LA-IA and Google Calendar

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
    // ✅ Extraer y validar header de autorización
    const authHeader = req.headers.get('authorization')
    const apikey = req.headers.get('apikey')
    
    // ✅ Verificar que hay algún método de autenticación
    if (!authHeader && !apikey) {
      console.error('❌ Missing authorization header or apikey')
      return new Response(
        JSON.stringify({ 
          code: 401, 
          message: 'Missing authorization header',
          error: 'Se requiere autenticación para acceder a esta función'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ✅ Crear cliente de Supabase con service role key (para operaciones internas)
    // El service role key bypassa RLS, lo cual es necesario para leer integrations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ Parsear el body de la petición
    let requestBody
    try {
      requestBody = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          code: 400, 
          message: 'Invalid request body',
          error: 'El cuerpo de la petición debe ser JSON válido'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { business_id, action, reservation_id, direction } = requestBody

    // ✅ Validar que business_id está presente
    if (!business_id) {
      return new Response(
        JSON.stringify({ 
          code: 400, 
          message: 'Missing business_id',
          error: 'Se requiere business_id en el cuerpo de la petición'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get integration config
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('business_id', business_id)
      .eq('provider', 'google_calendar')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('Google Calendar not connected')
    }

    // ✅ Obtener access_token (puede estar en access_token o en credentials.access_token)
    let accessToken = integration.access_token || integration.credentials?.access_token
    const refreshToken = integration.refresh_token || integration.credentials?.refresh_token

    if (!accessToken) {
      throw new Error('No access token found in integration')
    }

    if (!refreshToken) {
      throw new Error('No refresh token found in integration')
    }

    // Check token expiration and refresh if needed
    const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null
    
    // ✅ Si el token expiró o está a punto de expirar (5 minutos de margen), refrescarlo
    const shouldRefresh = !tokenExpiresAt || tokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000)
    
    if (shouldRefresh) {
      console.log('🔄 Token expirado o próximo a expirar, refrescando...')
      
      // Refresh token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!refreshResponse.ok) {
        const errorData = await refreshResponse.json().catch(() => ({}))
        console.error('❌ Error refrescando token:', errorData)
        throw new Error(`Failed to refresh token: ${JSON.stringify(errorData)}`)
      }

      const newTokens = await refreshResponse.json()
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString()

      // Update tokens en la base de datos
      const updateData: any = {
        token_expires_at: newExpiresAt,
      }

      // Actualizar access_token en el lugar correcto
      if (integration.access_token) {
        updateData.access_token = newTokens.access_token
      }
      
      if (integration.credentials) {
        updateData.credentials = {
          ...integration.credentials,
          access_token: newTokens.access_token,
        }
      } else {
        updateData.credentials = {
          access_token: newTokens.access_token,
          refresh_token: refreshToken,
          token_type: newTokens.token_type || 'Bearer',
        }
      }

      await supabaseClient
        .from('integrations')
        .update(updateData)
        .eq('id', integration.id)

      // Actualizar el token en el objeto integration para usar en esta petición
      accessToken = newTokens.access_token
      integration.access_token = newTokens.access_token
      
      console.log('✅ Token refrescado exitosamente')
    }
    // ✅ Soporte para múltiples calendarios o uno solo
    const calendarIds = integration.config.calendar_ids || 
                       (integration.config.calendar_id ? [integration.config.calendar_id] : ['primary'])
    const calendarId = calendarIds[0] || 'primary' // Para compatibilidad con acciones que usan un solo calendario

    // Handle different actions
    if (action === 'test') {
      // Test sync - list recent events from all selected calendars and classify them
      const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      
      // ✅ Procesar TODOS los calendarios seleccionados
      const allEvents: any[] = []
      const calendarResults: any[] = []
      
      for (const calId of calendarIds) {
        try {
          const eventsResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=100&singleEvents=true&orderBy=startTime`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            }
          )

          if (!eventsResponse.ok) {
            const errorData = await eventsResponse.json().catch(() => ({ error: 'Unknown error' }))
            console.warn(`⚠️ Error obteniendo eventos del calendario ${calId}:`, errorData)
            
            // Si es un error de autenticación, no continuar con otros calendarios
            if (eventsResponse.status === 401 || eventsResponse.status === 403) {
              throw new Error(`Error de autenticación con Google Calendar: ${JSON.stringify(errorData)}`)
            }
            
            continue
          }

          const eventsData = await eventsResponse.json()
          const calendarEvents = eventsData.items || []
          
          // Obtener nombre del calendario
          const calendarInfo = integration.config?.calendars_selected?.find((cal: any) => cal.id === calId)
          const calendarName = calendarInfo?.name || calId
          
          calendarResults.push({
            calendar_id: calId,
            calendar_name: calendarName,
            total_events: calendarEvents.length,
            all_day_events: calendarEvents.filter((e: any) => !!e.start.date).length,
            timed_events: calendarEvents.filter((e: any) => !!e.start.dateTime).length,
          })
          
          allEvents.push(...calendarEvents)
        } catch (error) {
          console.error(`❌ Error procesando calendario ${calId}:`, error)
          // Continuar con los demás calendarios aunque uno falle
        }
      }
      
      // Clasificar eventos totales
      const allDayEvents = allEvents.filter(event => !!event.start.date)
      const timedEvents = allEvents.filter(event => !!event.start.dateTime)
      
      return new Response(
        JSON.stringify({
          success: true,
          events_synced: allEvents.length, // Total de eventos en todos los calendarios
          all_day_events: allDayEvents.length,
          timed_events: timedEvents.length,
          calendars: calendarIds.length, // Cantidad de calendarios procesados
          calendar_details: calendarResults, // Detalle por calendario
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper function to determine which calendar to use for an appointment
    function getCalendarForAppointment(appointment: any): string | null {
      const calendarIds = integration.config?.calendar_ids || 
                         (integration.config?.calendar_id ? [integration.config.calendar_id] : [])
      const defaultCalendar = calendarIds[0] || 'primary'

      // ✅ Prioridad 1: Si hay employee_id y está mapeado, usar ese calendario
      if (appointment.employee_id) {
        const employeeMapping = integration.config?.employee_calendar_mapping || {}
        const mappedCalendar = employeeMapping[appointment.employee_id]
        if (mappedCalendar) {
          console.log(`🔗 Usando calendario del empleado ${appointment.employee_id}: ${mappedCalendar}`)
          return mappedCalendar
        }
      }

      // ✅ Prioridad 2: Si hay resource_id y está mapeado, usar ese calendario (compatibilidad)
      if (appointment.resource_id && integration.config?.resource_calendar_mapping) {
        const mappedCalendarId = integration.config.resource_calendar_mapping[appointment.resource_id]
        if (mappedCalendarId) {
          console.log(`🔗 Usando calendario vinculado para recurso ${appointment.resource_id}: ${mappedCalendarId}`)
          return mappedCalendarId
        }
      }

      // ❌ NO hay fallback - si no está mapeado, retornar null (no sincronizar)
      console.warn(`⚠️ No hay calendario mapeado para employee_id=${appointment.employee_id} o resource_id=${appointment.resource_id} - no se sincroniza`)
      return null
    }

    // Helper function to create Google Calendar event from appointment
    async function createGoogleCalendarEvent(appointment: any, targetCalendarId: string) {
      // ✅ Usar campos correctos: appointment_date y appointment_time (no reservation_date/reservation_time)
      const appointmentDate = appointment.appointment_date || appointment.reservation_date
      const appointmentTime = appointment.appointment_time || appointment.reservation_time
      const durationMinutes = appointment.duration_minutes || 90

      if (!appointmentDate || !appointmentTime) {
        throw new Error('Missing appointment_date or appointment_time')
      }

      const event = {
        summary: `Reserva: ${appointment.customer_name || 'Cliente'}`,
        description: `Reserva desde LA-IA\nTeléfono: ${appointment.customer_phone || 'N/A'}\nPersonas: ${appointment.party_size || 1}${appointment.special_requests ? `\nNotas: ${appointment.special_requests}` : ''}`,
        start: {
          dateTime: `${appointmentDate}T${appointmentTime}`,
          timeZone: 'Europe/Madrid',
        },
        end: {
          dateTime: `${appointmentDate}T${calculateEndTime(appointmentTime, durationMinutes)}`,
          timeZone: 'Europe/Madrid',
        },
        colorId: getColorByStatus(appointment.status),
        extendedProperties: {
          private: {
            la_ia_appointment_id: appointment.id,
            la_ia_business_id: business_id,
          },
        },
      }

      const createResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Failed to create Google Calendar event: ${JSON.stringify(errorData)}`)
      }

      const createdEvent = await createResponse.json()

      // Update appointment with Google Calendar event ID
      await supabaseClient
        .from('appointments')
        .update({
          gcal_event_id: createdEvent.id,
          synced_to_gcal: true,
          metadata: {
            ...(appointment.metadata || {}),
            google_calendar_event_id: createdEvent.id,
            google_calendar_id: targetCalendarId,
          },
        })
        .eq('id', appointment.id)

      // Update sync counter
      await supabaseClient
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          config: {
            ...integration.config,
            events_synced: (integration.config.events_synced || 0) + 1,
          },
        })
        .eq('id', integration.id)

      return createdEvent
    }

    // ✅ Soporte para action: 'push' (alias de 'create')
    if ((action === 'create' || action === 'push') && reservation_id) {
      // Create event in Google Calendar
      const { data: reservation, error: reservationError } = await supabaseClient
        .from('appointments')
        .select('*')
        .eq('id', reservation_id)
        .single()

      if (reservationError || !reservation) {
        throw new Error(`Reservation not found: ${reservationError?.message || 'Unknown error'}`)
      }

      // Skip if already synced
      if (reservation.gcal_event_id || reservation.synced_to_gcal) {
        console.log(`⏭️ Reserva ${reservation_id} ya está sincronizada con Google Calendar`)
        return new Response(
          JSON.stringify({ success: true, event_id: reservation.gcal_event_id, already_synced: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const targetCalendarId = getCalendarForAppointment(reservation)
      
      if (!targetCalendarId) {
        console.warn(`⚠️ No se puede sincronizar reserva ${reservation_id} - no hay calendario mapeado para el empleado ${reservation.employee_id}`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            skipped: true, 
            reason: 'no_calendar_mapping',
            message: `No hay calendario mapeado para el empleado. Por favor, vincula un calendario a este trabajador en la configuración.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const createdEvent = await createGoogleCalendarEvent(reservation, targetCalendarId)

      return new Response(
        JSON.stringify({ success: true, event_id: createdEvent.id, calendar_id: targetCalendarId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update' && reservation_id) {
      // Update event in Google Calendar
      const { data: reservation } = await supabaseClient
        .from('appointments')
        .select('*')
        .eq('id', reservation_id)
        .single()

      if (!reservation) {
        throw new Error('Reservation not found')
      }

      const eventId = reservation.gcal_event_id || reservation.metadata?.google_calendar_event_id
      const calendarIdForUpdate = reservation.metadata?.google_calendar_id || getCalendarForAppointment(reservation)

      if (!eventId) {
        // Create if doesn't exist - reuse the create logic
        if (!calendarIdForUpdate) {
          console.warn(`⚠️ No se puede crear evento para reserva ${reservation.id} - no hay calendario mapeado`)
          return new Response(
            JSON.stringify({ 
              success: false, 
              skipped: true, 
              reason: 'no_calendar_mapping'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const createdEvent = await createGoogleCalendarEvent(reservation, calendarIdForUpdate)

        return new Response(
          JSON.stringify({ success: true, event_id: createdEvent.id, calendar_id: calendarIdForUpdate }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!calendarIdForUpdate) {
        console.warn(`⚠️ No se puede actualizar evento para reserva ${reservation.id} - no hay calendario mapeado`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            skipped: true, 
            reason: 'no_calendar_mapping'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ✅ Usar campos correctos: appointment_date y appointment_time
      const appointmentDate = reservation.appointment_date || reservation.reservation_date
      const appointmentTime = reservation.appointment_time || reservation.reservation_time
      const durationMinutes = reservation.duration_minutes || 90

      const event = {
        summary: `Reserva: ${reservation.customer_name || 'Cliente'}`,
        description: `Reserva desde LA-IA\nTeléfono: ${reservation.customer_phone || 'N/A'}\nPersonas: ${reservation.party_size || 1}${reservation.special_requests ? `\nNotas: ${reservation.special_requests}` : ''}`,
        start: {
          dateTime: `${appointmentDate}T${appointmentTime}`,
          timeZone: 'Europe/Madrid',
        },
        end: {
          dateTime: `${appointmentDate}T${calculateEndTime(appointmentTime, durationMinutes)}`,
          timeZone: 'Europe/Madrid',
        },
        colorId: getColorByStatus(reservation.status),
      }

      const updateResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarIdForUpdate)}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Failed to update Google Calendar event: ${JSON.stringify(errorData)}`)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete' && reservation_id) {
      // Delete event from Google Calendar
      const { data: reservation } = await supabaseClient
        .from('appointments')
        .select('metadata')
        .eq('id', reservation_id)
        .single()

      const eventId = reservation?.gcal_event_id || reservation?.metadata?.google_calendar_event_id
      const calendarIdForDelete = reservation?.metadata?.google_calendar_id || getCalendarForAppointment(reservation)

      if (eventId && calendarIdForDelete) {
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarIdForDelete)}/events/${eventId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const errorData = await deleteResponse.json().catch(() => ({ error: 'Unknown error' }))
          console.warn(`⚠️ Error eliminando evento de Google Calendar: ${JSON.stringify(errorData)}`)
        }

        // Update appointment to mark as not synced
        await supabaseClient
          .from('appointments')
          .update({
            gcal_event_id: null,
            synced_to_gcal: false,
            metadata: {
              ...(reservation?.metadata || {}),
              google_calendar_event_id: null,
            },
          })
          .eq('id', reservation_id)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper functions
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const endMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(endMinutes / 60)
  const endMins = endMinutes % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`
}

function getColorByStatus(status: string): string {
  const colors: Record<string, string> = {
    confirmed: '9', // Blue
    pending: '5', // Yellow
    cancelled: '11', // Red
    completed: '10', // Green
    no_show: '8', // Gray
  }
  return colors[status] || '9'
}

