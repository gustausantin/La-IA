// Google Calendar Sync - Bidirectional Synchronization
// Syncs appointments between LA-IA and Google Calendar

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { business_id, action, reservation_id, direction } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    // Check token expiration and refresh if needed
    const tokenExpiresAt = new Date(integration.token_expires_at)
    if (tokenExpiresAt < new Date()) {
      // Refresh token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token')
      }

      const newTokens = await refreshResponse.json()
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString()

      // Update tokens
      await supabaseClient
        .from('integrations')
        .update({
          access_token: newTokens.access_token,
          token_expires_at: newExpiresAt,
        })
        .eq('id', integration.id)

      integration.access_token = newTokens.access_token
    }

    const accessToken = integration.access_token
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
            const errorData = await eventsResponse.json()
            console.warn(`⚠️ Error obteniendo eventos del calendario ${calId}:`, errorData)
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

    if (action === 'create' && reservation_id) {
      // Create event in Google Calendar
      const { data: reservation } = await supabaseClient
        .from('appointments')
        .select('*')
        .eq('id', reservation_id)
        .single()

      if (!reservation) {
        throw new Error('Reservation not found')
      }

      const event = {
        summary: `Reserva: ${reservation.customer_name}`,
        description: `Reserva desde LA-IA\nTeléfono: ${reservation.customer_phone || 'N/A'}\nPersonas: ${reservation.party_size || 1}`,
        start: {
          dateTime: `${reservation.reservation_date}T${reservation.reservation_time}`,
          timeZone: 'Europe/Madrid',
        },
        end: {
          dateTime: `${reservation.reservation_date}T${calculateEndTime(reservation.reservation_time, 90)}`,
          timeZone: 'Europe/Madrid',
        },
        colorId: getColorByStatus(reservation.status),
        extendedProperties: {
          private: {
            la_ia_reservation_id: reservation.id,
            la_ia_business_id: business_id,
          },
        },
      }

      const createResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

      const createdEvent = await createResponse.json()

      // Update reservation with Google Calendar event ID
      await supabaseClient
        .from('appointments')
        .update({
          metadata: {
            ...reservation.metadata,
            google_calendar_event_id: createdEvent.id,
          },
        })
        .eq('id', reservation_id)

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

      return new Response(
        JSON.stringify({ success: true, event_id: createdEvent.id }),
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

      const eventId = reservation.metadata?.google_calendar_event_id

      if (!eventId) {
        // Create if doesn't exist - reuse the create logic
        const event = {
          summary: `Reserva: ${reservation.customer_name}`,
          description: `Reserva desde LA-IA\nTeléfono: ${reservation.customer_phone || 'N/A'}\nPersonas: ${reservation.party_size || 1}`,
          start: {
            dateTime: `${reservation.reservation_date}T${reservation.reservation_time}`,
            timeZone: 'Europe/Madrid',
          },
          end: {
            dateTime: `${reservation.reservation_date}T${calculateEndTime(reservation.reservation_time, 90)}`,
            timeZone: 'Europe/Madrid',
          },
          colorId: getColorByStatus(reservation.status),
          extendedProperties: {
            private: {
              la_ia_reservation_id: reservation.id,
              la_ia_business_id: business_id,
            },
          },
        }

        const createResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        )

        const createdEvent = await createResponse.json()

        // Update reservation with Google Calendar event ID
        await supabaseClient
          .from('appointments')
          .update({
            metadata: {
              ...reservation.metadata,
              google_calendar_event_id: createdEvent.id,
            },
          })
          .eq('id', reservation.id)

        return new Response(
          JSON.stringify({ success: true, event_id: createdEvent.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const event = {
        summary: `Reserva: ${reservation.customer_name}`,
        description: `Reserva desde LA-IA\nTeléfono: ${reservation.customer_phone || 'N/A'}\nPersonas: ${reservation.party_size || 1}`,
        start: {
          dateTime: `${reservation.reservation_date}T${reservation.reservation_time}`,
          timeZone: 'Europe/Madrid',
        },
        end: {
          dateTime: `${reservation.reservation_date}T${calculateEndTime(reservation.reservation_time, 90)}`,
          timeZone: 'Europe/Madrid',
        },
        colorId: getColorByStatus(reservation.status),
      }

      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

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

      const eventId = reservation?.metadata?.google_calendar_event_id

      if (eventId) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )
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

