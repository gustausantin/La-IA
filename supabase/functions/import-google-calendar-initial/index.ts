// Import Google Calendar Initial Events
// Imports all-day events from Google Calendar to calendar_exceptions
// Production-ready version

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
    console.log('📥 Import function called')
    
    // ✅ Leer el body UNA SOLA VEZ
    const body = await req.json()
    console.log('📥 Body received:', JSON.stringify(body))
    const { business_id, action, events } = body

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required. Use "classify" or "import"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get integration config
    console.log(`🔍 Buscando integración para business_id: ${business_id}`)
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('business_id', business_id)
      .eq('provider', 'google_calendar')
      .eq('is_active', true)
      .single()

    if (integrationError) {
      console.error('❌ Error obteniendo integración:', integrationError)
      throw new Error(`Error obteniendo integración: ${integrationError.message}`)
    }
    
    if (!integration) {
      console.error('❌ Integración no encontrada')
      throw new Error('Google Calendar not connected')
    }
    
    console.log(`✅ Integración encontrada: ${integration.id}`)
    console.log(`📅 Config calendarios:`, JSON.stringify(integration.config))

    // Check token expiration and refresh if needed
    const tokenExpiresAt = new Date(integration.token_expires_at || integration.expires_at || 0)
    let accessToken = integration.access_token

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
        const errorData = await refreshResponse.json().catch(() => ({}))
        throw new Error(`Failed to refresh token: ${JSON.stringify(errorData)}`)
      }

      const newTokens = await refreshResponse.json()
      const newExpiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString()

      // Update tokens
      await supabaseClient
        .from('integrations')
        .update({
          access_token: newTokens.access_token,
          token_expires_at: newExpiresAt,
          expires_at: newExpiresAt,
        })
        .eq('id', integration.id)

      accessToken = newTokens.access_token
    }

    // ✅ Soporte para múltiples calendarios o uno solo
    let calendarIds: string[] = []
    
    try {
      if (integration.config?.calendar_ids && Array.isArray(integration.config.calendar_ids)) {
        calendarIds = integration.config.calendar_ids.filter((id: any) => typeof id === 'string' && id.length > 0)
      } else if (integration.config?.calendar_id) {
        if (Array.isArray(integration.config.calendar_id)) {
          calendarIds = integration.config.calendar_id.filter((id: any) => typeof id === 'string' && id.length > 0)
        } else if (typeof integration.config.calendar_id === 'string') {
          calendarIds = [integration.config.calendar_id]
        }
      }
      
      // Si no hay calendarios válidos, usar 'primary' como fallback
      if (calendarIds.length === 0) {
        calendarIds = ['primary']
      }
      
      console.log(`📅 Calendarios a procesar: ${JSON.stringify(calendarIds)}`)
    } catch (configError) {
      console.error('❌ Error procesando configuración de calendarios:', configError)
      calendarIds = ['primary'] // Fallback a primary
    }

    // Handle different actions
    if (action === 'classify') {
      // Classify events: return safe and doubtful events from all selected calendars
      // ✅ Envolver en try-catch para asegurar que siempre devolvamos una respuesta
      try {
        const { safe, doubtful } = await classifyGoogleCalendarEvents(accessToken, calendarIds)
        
        return new Response(
          JSON.stringify({
            success: true,
            safe: safe || [],
            doubtful: doubtful || [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (classifyError) {
        console.error('❌ Error en classifyGoogleCalendarEvents:', classifyError)
        // ✅ Aún así devolver una respuesta exitosa con arrays vacíos
        return new Response(
          JSON.stringify({
            success: true,
            safe: [],
            doubtful: [],
            warning: 'Error procesando algunos calendarios, pero la operación se completó'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (action === 'import') {
      // ✅ events ya viene del body inicial
      if (!events || !Array.isArray(events)) {
        throw new Error('events array is required')
      }

      // Import selected events
      const result = await importEventsToCalendarExceptions(
        supabaseClient,
        business_id,
        events
      )

      // Update last sync time
      await supabaseClient
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          config: {
            ...integration.config,
            initial_import_completed: true,
            events_imported: result.imported,
          },
        })
        .eq('id', integration.id)

      return new Response(
        JSON.stringify({
          success: true,
          imported: result.imported,
          skipped: result.skipped,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action. Use "classify" or "import"')

  } catch (error) {
    console.error('❌ Import error:', error)
    console.error('❌ Error stack:', error?.stack)
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Error desconocido',
        details: error?.stack || 'Sin detalles adicionales'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Classify Google Calendar events into safe and doubtful from multiple calendars
 */
async function classifyGoogleCalendarEvents(accessToken: string, calendarIds: string[]) {
  // Get events from last 90 days and next 90 days
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const safe: any[] = []
  const doubtful: any[] = []
  let calendarsProcessed = 0
  let calendarsFailed = 0

  // ✅ Procesar TODOS los calendarios seleccionados
  for (const calendarId of calendarIds) {
    try {
      // ✅ Codificar el calendar_id para URLs (puede contener caracteres especiales)
      const encodedCalendarId = encodeURIComponent(calendarId)
      console.log(`📅 Procesando calendario: ${calendarId} (codificado: ${encodedCalendarId})`)
      
      let eventsResponse: Response | null = null
      
      try {
        eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )
      } catch (fetchError) {
        calendarsFailed++
        console.error(`❌ Error haciendo fetch del calendario "${calendarId}":`, fetchError)
        continue // Continuar con el siguiente calendario
      }
      
      if (!eventsResponse) {
        calendarsFailed++
        console.warn(`⚠️ Respuesta vacía del calendario "${calendarId}". Continuando...`)
        continue
      }

      if (!eventsResponse.ok) {
        calendarsFailed++
        let errorMessage = 'Error desconocido'
        let errorCode = eventsResponse.status
        
        try {
          const errorData = await eventsResponse.json()
          errorMessage = errorData?.error?.message || errorData?.message || 'Error desconocido'
          errorCode = errorData?.error?.code || eventsResponse.status
        } catch (parseError) {
          // Si no se puede parsear el error, usar el status code
          console.warn(`⚠️ No se pudo parsear el error del calendario "${calendarId}"`)
        }
        
        // Si es 404, el calendario no existe o no está accesible - continuar con el siguiente
        if (errorCode === 404 || eventsResponse.status === 404) {
          console.warn(`⚠️ Calendario "${calendarId}" no encontrado o no accesible (404). Continuando con el siguiente calendario...`)
          continue // NO lanzar error, solo continuar
        }
        
        // Para otros errores, también continuamos pero lo registramos
        console.warn(`⚠️ Error obteniendo eventos del calendario "${calendarId}" (${errorCode}): ${errorMessage}. Continuando con el siguiente calendario...`)
        continue // NO lanzar error, solo continuar
      }

      let items: any[] = []
      try {
        const eventsData = await eventsResponse.json()
        items = eventsData?.items || []
      } catch (parseError) {
        calendarsFailed++
        console.error(`❌ Error parseando respuesta del calendario "${calendarId}":`, parseError)
        continue // Continuar con el siguiente calendario
      }
      
      calendarsProcessed++

      // ✅ DEBUG: Log todos los eventos para ver qué estamos recibiendo
      console.log(`📅 Calendario ${calendarId}: ${items?.length || 0} eventos recibidos`)
      if (items && items.length > 0) {
        items.forEach((event: any, idx: number) => {
          const isAllDay = !!event.start.date
          const hasTime = !!event.start.dateTime
          console.log(`  Evento ${idx + 1}: "${event.summary || 'Sin título'}" - AllDay: ${isAllDay}, HasTime: ${hasTime}, Start: ${JSON.stringify(event.start)}`)
        })
      }

      for (const event of items || []) {
        const classification = classifyEvent(event)

        // Skip events with time (reservations)
        if (classification.type === 'skip') {
          continue
        }

        if (classification.confidence === 'high') {
          safe.push({
            id: event.id,
            summary: event.summary || 'Sin título',
            start: event.start,
            end: event.end,
            selected: true, // Selected by default
            type: classification.type,
            reason: classification.reason,
            calendar_id: calendarId, // Guardar de qué calendario viene
          })
        } else {
          doubtful.push({
            id: event.id,
            summary: event.summary || 'Sin título',
            start: event.start,
            end: event.end,
            selected: false, // Not selected by default
            type: classification.suggestedType,
            reason: classification.reason,
            calendar_id: calendarId, // Guardar de qué calendario viene
          })
        }
      }
    } catch (error) {
      calendarsFailed++
      console.error(`❌ Error procesando calendario ${calendarId}:`, error)
      // Continuar con los demás calendarios aunque uno falle - NO lanzar error
    }
  }

  // ✅ Siempre devolver arrays (vacíos si no hay eventos o si todos fallaron)
  // NO lanzar error aunque todos los calendarios fallen - es válido no tener eventos
  console.log(`✅ Procesamiento completado: ${calendarsProcessed} calendario(s) procesado(s), ${calendarsFailed} fallido(s). Eventos encontrados: ${safe.length} seguros, ${doubtful.length} dudosos`)
  
  return { safe, doubtful }
}

/**
 * Classify a single event
 */
function classifyEvent(event: any) {
  // SOLO importar eventos de TODO EL DÍA
  // ✅ Verificar AMBOS formatos: date (todo el día) y dateTime (con hora)
  const isAllDay = !!event.start.date // Sin hora = todo el día
  const hasTime = !!event.start.dateTime // Con hora específica
  
  // ✅ Si tiene dateTime, NO es evento de todo el día (aunque tenga date también)
  if (hasTime || !isAllDay) {
    // Evento con hora → NO importar
    console.log(`  ⏭️  Saltando evento "${event.summary}": tiene hora específica`)
    return {
      type: 'skip',
      confidence: 'none',
      reason: 'Eventos con hora no se importan. Créalos directamente en LA-IA.',
    }
  }
  
  // ✅ Confirmar que es evento de TODO EL DÍA
  console.log(`  ✅ Evento de TODO EL DÍA encontrado: "${event.summary}" - Start: ${event.start.date}`)

  // Evento de todo el día → Clasificar
  const summary = (event.summary || '').toLowerCase()
  const keywords = ['cerrado', 'closed', 'vacaciones', 'vacation', 'holiday', 'festivo', 'cierre']

  const hasKeyword = keywords.some(keyword => summary.includes(keyword))

  if (hasKeyword) {
    return {
      type: 'closed',
      confidence: 'high',
      reason: event.summary || 'Día cerrado',
    }
  }

  // Evento de todo el día sin palabra clave → DUDOSO
  return {
    type: 'special_event',
    suggestedType: 'special_event',
    confidence: 'low',
    reason: event.summary || 'Evento especial',
  }
}

/**
 * Import events to calendar_exceptions
 */
async function importEventsToCalendarExceptions(
  supabaseClient: any,
  businessId: string,
  events: any[]
) {
  let imported = 0
  let skipped = 0

  console.log(`📥 Importando ${events.length} eventos para business_id: ${businessId}`)

  for (const event of events) {
    console.log(`📅 Procesando evento: ${event.id} - "${event.summary}" - selected: ${event.selected}`)
    
    if (!event.selected) {
      console.log(`  ⏭️  Evento no seleccionado, saltando...`)
      skipped++
      continue
    }

    try {
      // Parse date from Google Calendar format
      const exceptionDate = event.start?.date || event.start?.dateTime?.split('T')[0]

      if (!exceptionDate) {
        console.warn(`⚠️ Evento sin fecha: ${event.id}`, JSON.stringify(event.start))
        skipped++
        continue
      }

      console.log(`  📆 Fecha del evento: ${exceptionDate}`)

      // Determine if closed based on type
      const isClosed = event.type === 'closed'
      console.log(`  🔒 Tipo: ${event.type}, isClosed: ${isClosed}`)

      const exceptionData = {
        business_id: businessId,
        exception_date: exceptionDate,
        is_open: !isClosed, // false = cerrado, true = abierto
        open_time: isClosed ? null : '09:00', // Default hours if open
        close_time: isClosed ? null : '22:00', // Default hours if open
        reason: event.reason || event.summary || 'Evento importado de Google Calendar',
      }

      console.log(`  💾 Insertando/actualizando excepción:`, JSON.stringify(exceptionData))

      // Insert or update calendar exception
      const { data, error } = await supabaseClient
        .from('calendar_exceptions')
        .upsert(exceptionData, {
          onConflict: 'business_id,exception_date',
        })
        .select()
        
      if (error) {
        console.error(`❌ Error importing event ${event.id}:`, error)
        console.error(`❌ Error details:`, JSON.stringify(error))
        skipped++
        continue
      }
      
      console.log(`  ✅ Evento importado correctamente:`, data)
      imported++

    } catch (error) {
      console.error(`❌ Error processing event ${event.id}:`, error)
      console.error(`❌ Error stack:`, error?.stack)
      skipped++
    }
  }

  console.log(`✅ Importación completada: ${imported} importados, ${skipped} omitidos`)
  return { imported, skipped }
}

