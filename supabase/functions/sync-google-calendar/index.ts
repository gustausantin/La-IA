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
    async function getCalendarForAppointment(appointment: any): Promise<string | null> {
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

      // ✅ Prioridad 2: Si NO hay employee_id pero SÍ hay resource_id, intentar encontrar el empleado desde el recurso
      if (!appointment.employee_id && appointment.resource_id) {
        console.log(`🔍 Buscando empleado para resource_id ${appointment.resource_id}...`)
        try {
          const { data: employeeData, error: employeeError } = await supabaseClient
            .from('employees')
            .select('id')
            .eq('business_id', business_id)
            .eq('assigned_resource_id', appointment.resource_id)
            .eq('is_active', true)
            .maybeSingle()
          
          if (!employeeError && employeeData && employeeData.id) {
            const inferredEmployeeId = employeeData.id
            console.log(`✅ Empleado encontrado para resource_id ${appointment.resource_id}: ${inferredEmployeeId}`)
            
            // Intentar usar el mapeo del empleado encontrado
            const employeeMapping = integration.config?.employee_calendar_mapping || {}
            const mappedCalendar = employeeMapping[inferredEmployeeId]
            if (mappedCalendar) {
              console.log(`🔗 Usando calendario del empleado inferido ${inferredEmployeeId}: ${mappedCalendar}`)
              return mappedCalendar
            } else {
              console.warn(`⚠️ Empleado ${inferredEmployeeId} encontrado pero no tiene calendario mapeado`)
            }
          } else {
            console.warn(`⚠️ No se encontró empleado activo con assigned_resource_id = ${appointment.resource_id}`)
          }
        } catch (error) {
          console.error(`❌ Error buscando empleado para resource_id ${appointment.resource_id}:`, error)
        }
      }

      // ✅ Prioridad 3: Si hay resource_id y está mapeado directamente, usar ese calendario (compatibilidad)
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

      console.log(`📤 Creando evento en Google Calendar:`, {
        calendar_id: targetCalendarId,
        summary: event.summary,
        start: event.start.dateTime,
        end: event.end.dateTime,
        timeZone: event.start.timeZone,
      })

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
        console.error(`❌ Error creando evento en Google Calendar:`, {
          status: createResponse.status,
          statusText: createResponse.statusText,
          error: errorData,
          calendar_id: targetCalendarId,
          event_summary: event.summary,
        })
        throw new Error(`Failed to create Google Calendar event (${createResponse.status}): ${JSON.stringify(errorData)}`)
      }

      const createdEvent = await createResponse.json()
      console.log(`✅ Evento creado exitosamente:`, {
        event_id: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        calendar_id: targetCalendarId,
      })

      // Update appointment with Google Calendar event ID
      // ✅ Usar columnas directas (gcal_event_id, calendar_id, synced_to_gcal) y también internal_notes para consistencia
      // internal_notes ahora es JSONB, Supabase lo devuelve como objeto, no como string
      const currentInternalNotes = appointment.internal_notes ? 
        (typeof appointment.internal_notes === 'string' ? JSON.parse(appointment.internal_notes) : appointment.internal_notes) : 
        {}
      
      const updatedInternalNotes = {
        ...currentInternalNotes,
        gcal_event_id: createdEvent.id,
        calendar_id: targetCalendarId,
        synced_at: new Date().toISOString(),
      }
      
      // ✅ Actualizar tanto columnas directas como internal_notes (JSONB, no necesita stringify)
      await supabaseClient
        .from('appointments')
        .update({
          gcal_event_id: createdEvent.id, // ✅ Columna directa
          calendar_id: targetCalendarId, // ✅ Columna directa
          synced_to_gcal: true, // ✅ Columna directa (BOOLEAN)
          internal_notes: updatedInternalNotes, // ✅ JSONB - Supabase lo maneja automáticamente
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
      console.log(`🔄 Sincronizando reserva ${reservation_id} con Google Calendar (action: ${action})`)
      
      // Create event in Google Calendar
      const { data: reservation, error: reservationError } = await supabaseClient
        .from('appointments')
        .select('*')
        .eq('id', reservation_id)
        .single()

      if (reservationError || !reservation) {
        console.error(`❌ Error obteniendo reserva ${reservation_id}:`, reservationError)
        throw new Error(`Reservation not found: ${reservationError?.message || 'Unknown error'}`)
      }

      console.log(`📋 Reserva encontrada:`, {
        id: reservation.id,
        customer_name: reservation.customer_name,
        status: reservation.status,
        employee_id: reservation.employee_id,
        resource_id: reservation.resource_id,
        appointment_date: reservation.appointment_date,
        appointment_time: reservation.appointment_time,
      })

      // Skip if already synced
      // ✅ Verificar en columna directa synced_to_gcal, gcal_event_id o internal_notes
      const internalNotes = reservation.internal_notes ? 
        (typeof reservation.internal_notes === 'string' ? JSON.parse(reservation.internal_notes) : reservation.internal_notes) : 
        {}
      
      const gcalEventId = reservation.gcal_event_id || internalNotes.gcal_event_id
      const isSynced = reservation.synced_to_gcal || internalNotes.synced_to_gcal || !!gcalEventId
      
      if (isSynced && gcalEventId) {
        console.log(`⏭️ Reserva ${reservation_id} ya está sincronizada con Google Calendar (gcal_event_id: ${gcalEventId})`)
        return new Response(
          JSON.stringify({ success: true, event_id: gcalEventId, already_synced: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`🔍 Buscando calendario para empleado ${reservation.employee_id} o recurso ${reservation.resource_id}`)
      const targetCalendarId = await getCalendarForAppointment(reservation)
      
      if (!targetCalendarId) {
        console.warn(`⚠️ No se puede sincronizar reserva ${reservation_id} - no hay calendario mapeado`, {
          employee_id: reservation.employee_id,
          resource_id: reservation.resource_id,
          employee_mapping: integration.config?.employee_calendar_mapping,
          resource_mapping: integration.config?.resource_calendar_mapping,
        })
        return new Response(
          JSON.stringify({ 
            success: false, 
            skipped: true, 
            reason: 'no_calendar_mapping',
            message: `No hay calendario mapeado para el empleado ${reservation.employee_id || reservation.resource_id || 'N/A'}. Por favor, vincula un calendario a este trabajador en la configuración.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log(`✅ Calendario encontrado: ${targetCalendarId} - Creando evento en Google Calendar...`)
      const createdEvent = await createGoogleCalendarEvent(reservation, targetCalendarId)
      console.log(`✅ Evento creado en Google Calendar: ${createdEvent.id}`)

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

      // ✅ Obtener gcal_event_id desde columna directa o internal_notes
      const internalNotes = reservation.internal_notes ? 
        (typeof reservation.internal_notes === 'string' ? JSON.parse(reservation.internal_notes) : reservation.internal_notes) : 
        {}
      
      const eventId = reservation.gcal_event_id || internalNotes.gcal_event_id || reservation.metadata?.google_calendar_event_id
      
      // ✅ CRÍTICO: Calcular el NUEVO calendario basado en el employee_id ACTUALIZADO
      // NO usar el calendar_id guardado, porque puede ser el calendario antiguo
      const newCalendarId = await getCalendarForAppointment(reservation)
      
      // ✅ Obtener el calendario ANTIGUO (si existe) para comparar
      const oldCalendarId = reservation.calendar_id || internalNotes.calendar_id || reservation.metadata?.google_calendar_id

      console.log('🔄 Actualizando evento en Google Calendar:', {
        reservation_id: reservation.id,
        event_id: eventId,
        old_calendar_id: oldCalendarId,
        new_calendar_id: newCalendarId,
        employee_id: reservation.employee_id,
        resource_id: reservation.resource_id
      })

      if (!eventId) {
        // Create if doesn't exist - reuse the create logic
        if (!newCalendarId) {
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
        
        const createdEvent = await createGoogleCalendarEvent(reservation, newCalendarId)

        return new Response(
          JSON.stringify({ success: true, event_id: createdEvent.id, calendar_id: newCalendarId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!newCalendarId) {
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

      // ✅ Si el calendario cambió, mover el evento al nuevo calendario
      if (oldCalendarId && oldCalendarId !== newCalendarId) {
        console.log(`🔄 El calendario cambió de ${oldCalendarId} a ${newCalendarId}. Moviendo evento...`)
        
        // 1. Obtener el evento completo del calendario antiguo
        const getEventResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(oldCalendarId)}/events/${eventId}`,
          {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )

        if (!getEventResponse.ok && getEventResponse.status !== 404) {
          const errorData = await getEventResponse.json().catch(() => ({ error: 'Unknown error' }))
          console.warn(`⚠️ Error obteniendo evento del calendario antiguo: ${JSON.stringify(errorData)}`)
        }

        // 2. Crear el evento en el nuevo calendario con los datos actualizados
        const appointmentDate = reservation.appointment_date || reservation.reservation_date
        const appointmentTime = reservation.appointment_time || reservation.reservation_time
        const durationMinutes = reservation.duration_minutes || 90

        const newEvent = {
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
          extendedProperties: {
            private: {
              la_ia_appointment_id: reservation.id,
              la_ia_business_id: business_id,
            },
          },
        }

        const createInNewCalendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(newCalendarId)}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newEvent),
          }
        )

        if (!createInNewCalendarResponse.ok) {
          const errorData = await createInNewCalendarResponse.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Failed to create event in new calendar: ${JSON.stringify(errorData)}`)
        }

        const newEventData = await createInNewCalendarResponse.json()
        console.log(`✅ Evento creado en nuevo calendario ${newCalendarId}: ${newEventData.id}`)

        // 3. Eliminar el evento del calendario antiguo
        const deleteFromOldCalendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(oldCalendarId)}/events/${eventId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )

        if (!deleteFromOldCalendarResponse.ok && deleteFromOldCalendarResponse.status !== 404) {
          const errorData = await deleteFromOldCalendarResponse.json().catch(() => ({ error: 'Unknown error' }))
          console.warn(`⚠️ Error eliminando evento del calendario antiguo: ${JSON.stringify(errorData)}`)
          // Continuar de todas formas, el evento ya está en el nuevo calendario
        } else {
          console.log(`✅ Evento eliminado del calendario antiguo ${oldCalendarId}`)
        }

        // 4. Actualizar la reserva con el nuevo event_id y calendar_id
        const updatedInternalNotes = {
          ...internalNotes,
          gcal_event_id: newEventData.id,
          calendar_id: newCalendarId,
          synced_at: new Date().toISOString(),
        }

        await supabaseClient
          .from('appointments')
          .update({
            gcal_event_id: newEventData.id, // ✅ Nuevo event_id
            calendar_id: newCalendarId, // ✅ Nuevo calendar_id
            synced_to_gcal: true,
            internal_notes: updatedInternalNotes,
          })
          .eq('id', reservation.id)

        return new Response(
          JSON.stringify({ 
            success: true, 
            event_id: newEventData.id, 
            calendar_id: newCalendarId,
            moved: true,
            old_calendar_id: oldCalendarId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ✅ Si el calendario NO cambió, solo actualizar el evento existente
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
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(newCalendarId)}/events/${eventId}`,
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

      // ✅ Actualizar calendar_id en la reserva si cambió (aunque el evento esté en el mismo calendario)
      if (oldCalendarId !== newCalendarId) {
        const updatedInternalNotes = {
          ...internalNotes,
          calendar_id: newCalendarId,
          synced_at: new Date().toISOString(),
        }

        await supabaseClient
          .from('appointments')
          .update({
            calendar_id: newCalendarId,
            internal_notes: updatedInternalNotes,
          })
          .eq('id', reservation.id)
      }

      return new Response(
        JSON.stringify({ success: true, calendar_id: newCalendarId }),
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

      // ✅ Obtener gcal_event_id desde columna directa o internal_notes
      const internalNotes = reservation?.internal_notes ? 
        (typeof reservation.internal_notes === 'string' ? JSON.parse(reservation.internal_notes) : reservation.internal_notes) : 
        {}
      
      const eventId = reservation?.gcal_event_id || internalNotes.gcal_event_id || reservation?.metadata?.google_calendar_event_id
      const calendarIdForDelete = reservation?.calendar_id || internalNotes.calendar_id || reservation?.metadata?.google_calendar_id || await getCalendarForAppointment(reservation)

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
            gcal_event_id: null, // ✅ Columna directa
            calendar_id: null, // ✅ Columna directa
            synced_to_gcal: false, // ✅ Columna directa (BOOLEAN)
            internal_notes: {
              ...(internalNotes || {}),
              gcal_event_id: null,
            }, // ✅ JSONB - Supabase lo maneja automáticamente
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

