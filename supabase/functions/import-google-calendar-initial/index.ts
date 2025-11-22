// Import Google Calendar Initial Events
// Imports all-day events from Google Calendar to calendar_exceptions
// Production-ready version

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
        // ✅ Obtener configuración de días de anticipación máxima del negocio
        const { data: businessData, error: businessError } = await supabaseClient
          .from('businesses')
          .select('settings')
          .eq('id', business_id)
          .single()
        
        const advanceBookingDays = businessData?.settings?.booking_settings?.advance_booking_days || 90
        console.log(`📅 Días de anticipación máxima configurados: ${advanceBookingDays}`)
        
        const { safe, doubtful, timedEvents } = await classifyGoogleCalendarEvents(
          accessToken, 
          calendarIds, 
          business_id,
          supabaseClient,
          advanceBookingDays
        )
        
        return new Response(
          JSON.stringify({
            success: true,
            safe: safe || [],
            doubtful: doubtful || [],
            timedEvents: timedEvents || [], // Eventos con hora para importar como appointments
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
            timedEvents: [],
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

      // ✅ Separar eventos de todo el día de eventos con hora
      const allDayEvents = events.filter(e => e.start?.date && !e.start?.dateTime)
      const timedEvents = events.filter(e => e.start?.dateTime && !e.start?.date)

      console.log(`📊 Eventos a importar: ${allDayEvents.length} de todo el día, ${timedEvents.length} con hora`)

      // ✅ DETECTAR CONFLICTOS antes de importar eventos con hora
      const conflicts = await detectConflicts(
        supabaseClient,
        business_id,
        timedEvents,
        integration.config?.resource_calendar_mapping || {},
        integration.config?.employee_calendar_mapping || {}
      )

      // Si hay conflictos, devolverlos para que el frontend los muestre
      if (conflicts.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            has_conflicts: true,
            conflicts: conflicts,
            message: `Se encontraron ${conflicts.length} conflicto(s) entre Google Calendar y appointments existentes`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Import all-day events to calendar_exceptions
      const calendarExceptionsResult = await importEventsToCalendarExceptions(
        supabaseClient,
        business_id,
        allDayEvents
      )

      // Import timed events to appointments (blocked)
      const appointmentsResult = await importEventsToAppointments(
        supabaseClient,
        business_id,
        timedEvents,
        integration.config?.resource_calendar_mapping || {},
        integration.config?.employee_calendar_mapping || {}
      )

      // Update last sync time
        // ✅ Calcular total de eventos sincronizados (excepciones + appointments bloqueados)
        const totalSynced = calendarExceptionsResult.imported + appointmentsResult.imported
        
        await supabaseClient
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          config: {
            ...integration.config,
            initial_import_completed: true,
            events_imported: totalSynced,
            appointments_imported: appointmentsResult.imported,
            events_synced: totalSynced, // ✅ Actualizar contador de eventos sincronizados
          },
        })
        .eq('id', integration.id)

      return new Response(
        JSON.stringify({
          success: true,
          imported: calendarExceptionsResult.imported + appointmentsResult.imported,
          skipped: calendarExceptionsResult.skipped + appointmentsResult.skipped,
          calendar_exceptions: calendarExceptionsResult.imported,
          appointments: appointmentsResult.imported,
          // ✅ FASE 2: Incluir información sobre eventos sin asignar
          unassigned_count: appointmentsResult.unassigned_count || 0,
          unassigned_appointments: appointmentsResult.unassigned_appointments || [],
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
 * Also separates events with time (to be imported as appointments)
 */
async function classifyGoogleCalendarEvents(
  accessToken: string, 
  calendarIds: string[],
  businessId: string,
  supabaseClient: any,
  advanceBookingDays: number = 90
) {
  // ✅ Solo obtener eventos FUTUROS (desde mañana en adelante)
  // Calcular mañana a las 00:00:00 en la zona horaria local
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0) // Mañana a las 00:00:00
  
  // ✅ Calcular timeMax usando la configuración del negocio (advance_booking_days)
  const maxDate = new Date(tomorrow)
  maxDate.setDate(maxDate.getDate() + advanceBookingDays) // Mañana + días de anticipación máxima
  
  const timeMin = tomorrow.toISOString()
  const timeMax = maxDate.toISOString()
  
  console.log(`📅 Filtrando eventos: Solo desde mañana (${tomorrow.toISOString()}) hasta ${timeMax} (${advanceBookingDays} días de anticipación máxima)`)

  const safe: any[] = [] // Eventos de todo el día seguros
  const doubtful: any[] = [] // Eventos de todo el día dudosos
  const timedEvents: any[] = [] // Eventos con hora (se importarán como appointments bloqueados)
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
        const isAllDay = !!event.start.date
        const hasTime = !!event.start.dateTime

        // ✅ Filtrar eventos pasados o de hoy (solo eventos futuros desde mañana)
        let eventDate: Date | null = null
        if (hasTime && event.start.dateTime) {
          eventDate = new Date(event.start.dateTime)
        } else if (isAllDay && event.start.date) {
          // Para eventos de todo el día, usar la fecha como inicio del día
          eventDate = new Date(event.start.date + 'T00:00:00')
        }
        
        if (eventDate) {
          // Comparar solo la fecha (sin hora) para eventos de todo el día
          const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
          const tomorrowDateOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
          const maxDateOnly = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())
          
          // ✅ Filtrar eventos pasados o de hoy
          if (eventDateOnly < tomorrowDateOnly) {
            console.log(`  ⏭️ Evento pasado o de hoy omitido: "${event.summary}" - Fecha: ${eventDate.toISOString()}`)
            continue // Omitir eventos pasados o de hoy
          }
          
          // ✅ Filtrar eventos más allá del límite de anticipación máxima
          if (eventDateOnly > maxDateOnly) {
            console.log(`  ⏭️ Evento más allá del límite (${advanceBookingDays} días) omitido: "${event.summary}" - Fecha: ${eventDate.toISOString()}`)
            continue // Omitir eventos más allá del límite configurado
          }
        }

        // ✅ Separar eventos con hora (se importarán como appointments bloqueados)
        if (hasTime && !isAllDay) {
          console.log(`  ⏰ Evento con HORA detectado: "${event.summary}" - Se importará como appointment bloqueado`)
          timedEvents.push({
            id: event.id,
            summary: event.summary || 'Sin título',
            start: event.start,
            end: event.end,
            selected: true, // Por defecto se importan todos los eventos con hora
            type: 'blocked',
            reason: event.summary || 'Evento bloqueado de Google Calendar',
            calendar_id: calendarId, // Guardar de qué calendario viene
          })
          continue
        }

        // ✅ Eventos de todo el día (se importan como calendar_exceptions)
        const classification = classifyEvent(event)

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
  console.log(`✅ Procesamiento completado: ${calendarsProcessed} calendario(s) procesado(s), ${calendarsFailed} fallido(s). Eventos encontrados: ${safe.length} seguros (todo el día), ${doubtful.length} dudosos (todo el día), ${timedEvents.length} con hora (appointments)`)
  
  return { safe, doubtful, timedEvents }
}

/**
 * Classify a single event
 */
function classifyEvent(event: any) {
  // SOLO importar eventos de TODO EL DÍA
  const isAllDay = !!event.start.date
  const hasTime = !!event.start.dateTime
  
  if (hasTime || !isAllDay) {
    console.log(`  ⏭️  Saltando evento "${event.summary}": tiene hora específica`)
    return {
      type: 'skip',
      confidence: 'none',
      reason: 'Eventos con hora no se importan. Créalos directamente en LA-IA.',
    }
  }
  
  console.log(`  ✅ Evento de TODO EL DÍA encontrado: "${event.summary}" - Start: ${event.start.date}`)

  const summary = (event.summary || '').toLowerCase()
  
  // ✅ Palabras clave para días CERRADOS
  const closedKeywords = [
    'cerrado', 'closed', 'cierre', 'close',
    'vacaciones', 'vacation', 'holidays', 'holiday',
    'festivo', 'festivos', 'fiesta', 'fiestas',
    'puente', 'bridge day'
  ]
  
  // ✅ Festivos españoles comunes (siempre cerrados)
  // Incluye variaciones en español e inglés
  const spanishHolidays = [
    // Enero
    'año nuevo', 'new year', 'año nuevo', 'new year\'s day',
    'reyes', 'epifanía', 'epiphany', 'reyes magos', 'three kings',
    // Marzo/Abril (Semana Santa - variable)
    'viernes santo', 'good friday', 'semana santa', 'holy week',
    'lunes de pascua', 'easter monday', 'pascua', 'easter',
    // Mayo
    'día del trabajo', 'labor day', 'may day', 'primero de mayo', '1 de mayo',
    // Agosto
    'asunción', 'assumption', 'día de la asunción', '15 de agosto',
    // Octubre
    'día de españa', 'hispanic day', 'fiesta nacional', '12 de octubre',
    // Noviembre
    'todos los santos', 'all saints', 'all saints\' day', 'día de todos los santos', '1 de noviembre',
    // Diciembre
    'inmaculada', 'inmaculada concepción', 'immaculate conception', '8 de diciembre',
    'constitución', 'constitution day', 'día de la constitución', '6 de diciembre',
    'navidad', 'christmas', 'nochebuena', 'christmas eve', '25 de diciembre',
    'san esteban', 'boxing day', 'día de san esteban', '26 de diciembre',
    // Otros comunes
    'san jose', 'san josé', 'josefina', '19 de marzo',
    // Días festivos genéricos
    'festivo', 'festivos', 'fiesta', 'fiestas', 'holiday', 'holidays'
  ]
  
  // ✅ Verificar si es día cerrado por palabras clave
  const hasClosedKeyword = closedKeywords.some(keyword => summary.includes(keyword))
  
  // ✅ Verificar si es festivo español
  const isSpanishHoliday = spanishHolidays.some(holiday => summary.includes(holiday))
  
  // ✅ Si tiene palabra clave de cerrado O es festivo español → CERRADO
  if (hasClosedKeyword || isSpanishHoliday) {
    return {
      type: 'closed',
      confidence: 'high',
      reason: event.summary || 'Día cerrado',
    }
  }

  // ✅ Evento de todo el día sin palabra clave → DUDOSO (el usuario decidirá)
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
  console.log(`📋 Estructura del primer evento:`, JSON.stringify(events[0] || {}, null, 2))

  for (const event of events) {
    console.log(`📅 Procesando evento: ${event.id} - "${event.summary}" - selected: ${event.selected}`)
    console.log(`📋 Evento completo:`, JSON.stringify(event, null, 2))
    
    if (!event.selected) {
      console.log(`  ⏭️  Evento no seleccionado, saltando...`)
      skipped++
      continue
    }

    try {
      // ✅ DEBUG: Log completo del evento recibido
      console.log(`  🔍 Evento recibido para importar:`, JSON.stringify({
        id: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end,
        type: event.type,
        selected: event.selected
      }, null, 2))
      
      // ✅ Parsear fechas de inicio y fin (para manejar rangos)
      const startDate = event.start?.date || event.start?.dateTime?.split('T')[0]
      const endDate = event.end?.date || event.end?.dateTime?.split('T')[0]

      console.log(`  📅 Fechas parseadas: startDate="${startDate}", endDate="${endDate}"`)
      console.log(`  📅 event.start completo:`, JSON.stringify(event.start))
      console.log(`  📅 event.end completo:`, JSON.stringify(event.end))

      if (!startDate) {
        console.warn(`⚠️ Evento sin fecha de inicio: ${event.id}`, JSON.stringify(event.start))
        skipped++
        continue
      }
      
      // ✅ VERIFICACIÓN CRÍTICA: Si endDate no existe, es un solo día
      if (!endDate) {
        console.warn(`  ⚠️ ADVERTENCIA: No se encontró endDate. El evento será tratado como un solo día.`)
      }

      // ✅ Calcular rango de fechas
      // Google Calendar usa endDate EXCLUSIVO (el día después del último día del evento)
      // Ejemplo: evento del 2 al 5 → start: 2025-12-02, end: 2025-12-06 (exclusivo)
      // Entonces el rango real es: 2, 3, 4, 5 (4 días)
      
      // ✅ Crear fechas en UTC para evitar problemas de zona horaria
      const startParts = startDate.split('-')
      const startYear = parseInt(startParts[0])
      const startMonth = parseInt(startParts[1]) - 1 // Mes es 0-indexed
      const startDay = parseInt(startParts[2])
      const start = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0))
      
      let actualEnd: Date
      
      if (endDate && endDate !== startDate) {
        // Hay fecha de fin diferente → es un rango
        const endParts = endDate.split('-')
        const endYear = parseInt(endParts[0])
        const endMonth = parseInt(endParts[1]) - 1 // Mes es 0-indexed
        const endDay = parseInt(endParts[2])
        const end = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0))
        
        // Restar 1 día porque Google Calendar usa endDate exclusivo
        actualEnd = new Date(end)
        actualEnd.setUTCDate(actualEnd.getUTCDate() - 1)
        console.log(`  📆 Evento de RANGO detectado: ${startDate} a ${endDate} (end exclusivo)`)
        console.log(`  📆 Rango calculado: desde ${formatDate(start)} hasta ${formatDate(actualEnd)}`)
      } else {
        // No hay fecha de fin o es igual → evento de un solo día
        actualEnd = new Date(start)
        console.log(`  📆 Evento de UN SOLO DÍA: ${startDate}`)
      }
      
      // ✅ Generar array de todas las fechas del rango
      const datesInRange: string[] = []
      const currentDate = new Date(start)
      
      console.log(`  🔄 Iniciando loop de fechas:`)
      console.log(`    - start: ${formatDate(start)} (${start.toISOString()})`)
      console.log(`    - actualEnd: ${formatDate(actualEnd)} (${actualEnd.toISOString()})`)
      
      let loopCount = 0
      const maxDays = 365 // Protección contra loops infinitos
      
      // ✅ Usar comparación de fechas normalizadas (solo año, mes, día)
      const startTime = start.getTime()
      const endTime = actualEnd.getTime()
      
      console.log(`    - Comparación: startTime=${startTime}, endTime=${endTime}, startTime <= endTime: ${startTime <= endTime}`)
      
      while (currentDate.getTime() <= actualEnd.getTime() && loopCount < maxDays) {
        const formattedDate = formatDate(currentDate)
        datesInRange.push(formattedDate)
        console.log(`    - Loop ${loopCount + 1}: Agregando fecha ${formattedDate} (${currentDate.toISOString()})`)
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
        loopCount++
        
        // Protección adicional: si el loop no avanza, salir
        if (loopCount > 0 && currentDate.getTime() === start.getTime() && loopCount > 1) {
          console.error(`    ❌ ERROR: El loop no está avanzando. Saliendo.`)
          break
        }
      }

      console.log(`  📅 Total días en rango: ${datesInRange.length}`)
      console.log(`  📅 Fechas a procesar:`, datesInRange)
      
      if (loopCount >= maxDays) {
        console.error(`❌ ERROR: Loop de fechas excedió el máximo (${maxDays} días). Esto no debería pasar.`)
      }
      
      if (datesInRange.length === 0) {
        console.error(`❌ ERROR CRÍTICO: No se generaron fechas. start=${formatDate(start)}, actualEnd=${formatDate(actualEnd)}`)
        console.warn(`⚠️ No se generaron fechas para el evento ${event.id}`)
        skipped++
        continue
      }

      // Determine if closed based on type
      const isClosed = event.type === 'closed'
      console.log(`  🔒 Tipo: ${event.type}, isClosed: ${isClosed}`)

      // ✅ Procesar CADA día del rango
      console.log(`  🔄 Iniciando procesamiento de ${datesInRange.length} días del rango...`)
      for (let i = 0; i < datesInRange.length; i++) {
        const exceptionDate = datesInRange[i]
        console.log(`  🔄 Procesando día ${i + 1}/${datesInRange.length}: ${exceptionDate}`)
        
        const exceptionData = {
          business_id: businessId,
          exception_date: exceptionDate,
          is_open: !isClosed, // false = cerrado, true = abierto
          open_time: isClosed ? null : '09:00', // Default hours if open
          close_time: isClosed ? null : '22:00', // Default hours if open
          reason: event.reason || event.summary || 'Evento importado de Google Calendar',
        }

        console.log(`  💾 Insertando/actualizando excepción para ${exceptionDate}:`, JSON.stringify(exceptionData))

        // ✅ Verificar si ya existe una excepción para esta fecha
        const { data: existing, error: checkError } = await supabaseClient
          .from('calendar_exceptions')
          .select('id')
          .eq('business_id', businessId)
          .eq('exception_date', exceptionDate)
          .maybeSingle()
        
        if (checkError) {
          console.error(`❌ Error verificando existencia para ${exceptionDate}:`, checkError)
          skipped++
          continue // Continuar con el siguiente día del rango
        }

        let result
        
        if (existing) {
          // ✅ Actualizar si existe
          console.log(`  🔄 Actualizando excepción existente (id: ${existing.id}) para ${exceptionDate}`)
          const { data, error } = await supabaseClient
            .from('calendar_exceptions')
            .update(exceptionData)
            .eq('id', existing.id)
            .select()
          
          if (error) {
            console.error(`❌ Error actualizando evento ${event.id} para ${exceptionDate}:`, error)
            skipped++
            continue // Continuar con el siguiente día
          }
          
          result = data
        } else {
          // ✅ Insertar si no existe
          console.log(`  ➕ Insertando nueva excepción para ${exceptionDate}`)
          const { data, error } = await supabaseClient
            .from('calendar_exceptions')
            .insert(exceptionData)
            .select()
          
          if (error) {
            console.error(`❌ Error insertando evento ${event.id} para ${exceptionDate}:`, error)
            skipped++
            continue // Continuar con el siguiente día
          }
          
          result = data
        }
        
        if (result && result.length > 0) {
          console.log(`  ✅ Día ${exceptionDate} importado correctamente`)
          imported++
        } else {
          console.warn(`⚠️ Operación no devolvió datos para ${exceptionDate}`)
          skipped++
        }
      } // Fin del loop de fechas

    } catch (error) {
      console.error(`❌ Error processing event ${event.id}:`, error)
      console.error(`❌ Error stack:`, error?.stack)
      // Si hay un error general, contar todos los días del rango como omitidos
      // (pero esto solo pasa si hay un error antes de procesar las fechas)
      skipped++
    }
  }

  console.log(`✅ Importación completada: ${imported} importados, ${skipped} omitidos`)
  return { imported, skipped }
}

/**
 * Import timed events to appointments table (blocked appointments)
 */
// Helper function to extract information from Google Calendar event
function extractEventInfo(event: any) {
  const summary = event.summary || ''
  const description = event.description || ''
  const combined = `${summary} ${description}`.toLowerCase()

  // Extract customer name (common patterns)
  let customerName: string | null = null
  const namePatterns = [
    /(?:cliente|customer|nombre|name)[\s:]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
    /(?:con|with|atendido por|atendido por)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i,
    /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/, // First words if capitalized
  ]
  
  for (const pattern of namePatterns) {
    const match = combined.match(pattern)
    if (match && match[1]) {
      customerName = match[1].trim()
      break
    }
  }

  // Extract phone number
  let customerPhone: string | null = null
  const phonePatterns = [
    /(?:tel|phone|teléfono|móvil|mobile)[\s:]+([+\d\s\-()]+)/i,
    /(\+?\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9})/,
  ]
  
  for (const pattern of phonePatterns) {
    const match = combined.match(pattern)
    if (match && match[1]) {
      customerPhone = match[1].trim().replace(/\s+/g, '')
      break
    }
  }

  // Extract email
  let customerEmail: string | null = null
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
  const emailMatch = combined.match(emailPattern)
  if (emailMatch) {
    customerEmail = emailMatch[1].trim()
  }

  // Extract notes (use description if available, otherwise summary)
  const notes = description || summary || null

  return {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    notes: notes,
  }
}

/**
 * FASE 1: Mapeo Inteligente Recurso → Trabajador por Horario
 * 
 * Busca el trabajador correcto para un recurso en un horario específico:
 * 1. Busca en employee_schedules por resource_id + day_of_week + horario
 * 2. Si no encuentra, usa assigned_resource_id como fallback
 * 3. Si no encuentra, retorna null (requiere asignación manual)
 */
async function getEmployeeForResourceByTime(
  supabaseClient: any,
  resourceId: string,
  appointmentDateTime: Date,
  businessId: string
): Promise<string | null> {
  try {
    const dayOfWeek = appointmentDateTime.getDay() // 0-6 (Domingo-Sábado)
    const [hours, minutes] = appointmentDateTime.toISOString().split('T')[1].split(':').map(Number)
    const timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

    console.log(`    🔍 Buscando trabajador para recurso ${resourceId} en día ${dayOfWeek} a las ${timeValue}`)

    // ✅ PASO 1: Buscar en employee_schedules (mapeo por horario específico)
    const { data: schedules, error: schedulesError } = await supabaseClient
      .from('employee_schedules')
      .select('employee_id, start_time, end_time')
      .eq('resource_id', resourceId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working', true)
      .lte('start_time', timeValue)
      .gte('end_time', timeValue)

    if (schedulesError) {
      console.error(`    ❌ Error buscando schedules:`, schedulesError)
    } else if (schedules && schedules.length > 0) {
      // Si hay múltiples coincidencias, tomar la primera (o la más específica)
      const matchedSchedule = schedules[0]
      console.log(`    ✅ Encontrado en employee_schedules: employee_id=${matchedSchedule.employee_id}`)
      return matchedSchedule.employee_id
    }

    // ✅ PASO 2: Fallback - Buscar por assigned_resource_id
    const { data: employees, error: employeesError } = await supabaseClient
      .from('employees')
      .select('id')
      .eq('business_id', businessId)
      .eq('assigned_resource_id', resourceId)
      .eq('is_active', true)
      .limit(1)

    if (employeesError) {
      console.error(`    ❌ Error buscando employees:`, employeesError)
    } else if (employees && employees.length > 0) {
      console.log(`    ✅ Encontrado por assigned_resource_id: employee_id=${employees[0].id}`)
      return employees[0].id
    }

    // ✅ PASO 3: No se encontró trabajador
    console.log(`    ⚠️ No se encontró trabajador para recurso ${resourceId}`)
    return null

  } catch (error) {
    console.error(`    ❌ Error en getEmployeeForResourceByTime:`, error)
    return null
  }
}

/**
 * ✅ PARSEAR ISO STRING directamente sin conversión UTC
 * Evita el problema de zona horaria (1 hora de diferencia)
 */
function parseISODateTime(isoString: string | null | undefined) {
  // ✅ Validar que el string existe y no está vacío
  if (!isoString || typeof isoString !== 'string') {
    throw new Error(`parseISODateTime: isoString es inválido: ${isoString}`)
  }

  // ✅ Extraer solo la parte de fecha/hora sin la zona horaria usando regex
  // Formato esperado: YYYY-MM-DDTHH:MM:SS[+/-HH:MM] o YYYY-MM-DDTHH:MM:SSZ
  const dateTimeMatch = isoString.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
  let dateTimePart: string
  
  if (dateTimeMatch && dateTimeMatch[1]) {
    dateTimePart = dateTimeMatch[1]
  } else {
    // Fallback: si el regex no funciona, intentar métodos alternativos
    if (isoString.endsWith('Z')) {
      dateTimePart = isoString.slice(0, -1)
    } else {
      // Buscar el primer + o - que viene después de la hora (formato: +HH:MM o -HH:MM)
      const timezonePos = isoString.search(/[+-]\d{2}:\d{2}/)
      if (timezonePos > 0) {
        dateTimePart = isoString.substring(0, timezonePos)
      } else {
        dateTimePart = isoString
      }
    }
  }
  
  // Validar que contiene 'T' para separar fecha y hora
  if (!dateTimePart || !dateTimePart.includes('T')) {
    throw new Error(`parseISODateTime: formato inválido, no contiene 'T'. Original: ${isoString}, Procesado: ${dateTimePart}`)
  }

  const [datePart, timePart] = dateTimePart.split('T')
  
  if (!datePart || !timePart) {
    throw new Error(`parseISODateTime: no se pudo separar fecha y hora. Original: ${isoString}, dateTimePart: ${dateTimePart}`)
  }

  const [year, month, day] = datePart.split('-').map(Number)
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`parseISODateTime: fecha inválida: ${datePart} (de ${isoString})`)
  }

  const timeParts = timePart.split(':')
  const hours = Number(timeParts[0])
  const minutes = Number(timeParts[1])
  // Los segundos pueden venir con decimales (ej: "09:00:00.000"), solo tomar la parte entera
  const seconds = timeParts[2] ? Number(timeParts[2].split('.')[0]) : 0

  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`parseISODateTime: hora inválida: ${timePart} (de ${isoString})`)
  }

  return { year, month, day, hours, minutes, seconds }
}

async function importEventsToAppointments(
  supabaseClient: any,
  businessId: string,
  events: any[],
  resourceCalendarMapping: Record<string, string> = {},
  employeeCalendarMapping: Record<string, string> = {}
) {
  let imported = 0
  let skipped = 0
  const unassignedAppointments: any[] = [] // ✅ FASE 2: Eventos sin asignar

  console.log(`📥 Importando ${events.length} eventos con hora como appointments bloqueados para business_id: ${businessId}`)

  // ✅ Obtener cliente genérico y servicio genérico UNA VEZ (fuera del loop)
  let genericCustomerId: string | null = null
  let genericServiceId: string | null = null

  try {
    // Buscar o crear cliente genérico
    const { data: existingCustomer } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('name', 'Cliente de Google Calendar')
      .maybeSingle()

    if (existingCustomer) {
      genericCustomerId = existingCustomer.id
      console.log(`✅ Cliente genérico encontrado: ${genericCustomerId}`)
    } else {
      // ✅ Crear cliente genérico UNA VEZ (solo si no existe)
      // Este es el ÚNICO cliente que se crea para eventos de Google Calendar
      console.log(`⚠️ Cliente genérico no existe, creándolo UNA VEZ...`)
      const { data: newCustomer, error: customerError } = await supabaseClient
        .from('customers')
        .insert({
          business_id: businessId,
          name: 'Cliente de Google Calendar',
          email: null,
          phone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (customerError) {
        console.error(`❌ Error creando cliente genérico:`, customerError)
        // ❌ NO continuar si no se puede crear el cliente genérico
        throw new Error(`No se pudo crear cliente genérico: ${customerError.message}`)
      } else {
        genericCustomerId = newCustomer.id
        console.log(`✅ Cliente genérico creado UNA VEZ: ${genericCustomerId}`)
      }
    }

    // Buscar primer servicio activo
    const { data: firstService } = await supabaseClient
      .from('business_services')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('position_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstService) {
      genericServiceId = firstService.id
      console.log(`✅ Servicio genérico encontrado: ${genericServiceId}`)
    } else {
      console.warn(`⚠️ No hay servicios activos para business_id ${businessId}`)
    }
  } catch (error) {
    console.error(`❌ Error obteniendo cliente/servicio genérico:`, error)
  }

  for (const event of events) {
    if (!event.selected) {
      console.log(`  ⏭️  Evento no seleccionado, saltando...`)
      skipped++
      continue
    }

    try {
      // ✅ Parsear fechas/horas del evento
      const startDateTime = event.start?.dateTime
      const endDateTime = event.end?.dateTime

      if (!startDateTime || !endDateTime) {
        console.warn(`⚠️ Evento sin fecha/hora de inicio o fin: ${event.id}`, { start: event.start, end: event.end })
        skipped++
        continue
      }

      // ✅ Validar que son strings válidos
      if (typeof startDateTime !== 'string' || typeof endDateTime !== 'string') {
        console.warn(`⚠️ Evento con fecha/hora inválida (no es string): ${event.id}`, { 
          startDateTime: typeof startDateTime, 
          endDateTime: typeof endDateTime 
        })
        skipped++
        continue
      }

      // ✅ PARSEAR DIRECTAMENTE sin usar new Date() (evita conversión UTC)
      let startParsed, endParsed
      try {
        startParsed = parseISODateTime(startDateTime)
        endParsed = parseISODateTime(endDateTime)
      } catch (parseError) {
        console.error(`❌ Error parseando fechas para evento ${event.id}:`, parseError)
        console.error(`  startDateTime: ${startDateTime}, endDateTime: ${endDateTime}`)
        skipped++
        continue
      }

      // Formatear fecha y hora LOCAL (no UTC)
      const localAppointmentDate = `${startParsed.year}-${String(startParsed.month).padStart(2, '0')}-${String(startParsed.day).padStart(2, '0')}`
      const localAppointmentTime = `${String(startParsed.hours).padStart(2, '0')}:${String(startParsed.minutes).padStart(2, '0')}:${String(startParsed.seconds).padStart(2, '0')}`
      const localEndTime = `${String(endParsed.hours).padStart(2, '0')}:${String(endParsed.minutes).padStart(2, '0')}:${String(endParsed.seconds).padStart(2, '0')}`

      // Calcular duración usando Date objects (solo para cálculo)
      const startTime = new Date(startDateTime)
      const endTime = new Date(endDateTime)
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      // ✅ Determinar resource_id basándose en el mapeo de calendarios
      let resourceId: string | null = null
      if (event.calendar_id && resourceCalendarMapping[event.calendar_id]) {
        resourceId = resourceCalendarMapping[event.calendar_id]
        console.log(`  🔗 Recurso vinculado encontrado: calendar_id=${event.calendar_id} → resource_id=${resourceId}`)
      } else {
        console.log(`  ℹ️ No hay recurso vinculado para calendar_id=${event.calendar_id}, resource_id será null`)
      }

      // ✅ Determinar employee_id basándose en el mapeo inverso de calendarios
      let employeeId: string | null = null
      if (event.calendar_id) {
        // Buscar en el mapeo inverso: calendar_id → employee_id
        const mappedEmployeeId = Object.keys(employeeCalendarMapping).find(
          empId => employeeCalendarMapping[empId] === event.calendar_id
        )
        if (mappedEmployeeId) {
          employeeId = mappedEmployeeId
          console.log(`  👤 Empleado vinculado encontrado: calendar_id=${event.calendar_id} → employee_id=${employeeId}`)
        } else {
          console.log(`  ℹ️ No hay empleado vinculado para calendar_id=${event.calendar_id}, employee_id será null`)
        }
      }

      // ✅ FASE 1: Si tenemos resource_id pero NO employee_id, intentar mapeo inteligente por horario
      if (resourceId && !employeeId) {
        console.log(`  🔍 Intentando mapeo inteligente: resource_id=${resourceId} a las ${localAppointmentTime}`)
        employeeId = await getEmployeeForResourceByTime(
          supabaseClient,
          resourceId,
          startTime, // Usar Date object solo para el mapeo
          businessId
        )
        if (employeeId) {
          console.log(`  ✅ Mapeo inteligente exitoso: resource_id=${resourceId} → employee_id=${employeeId}`)
        } else {
          console.log(`  ⚠️ No se pudo mapear automáticamente: resource_id=${resourceId} requiere asignación manual`)
        }
      }

      // ✅ Extraer información del evento (customer_name, phone, email, notes)
      const eventInfo = extractEventInfo(event)
      console.log(`  📋 Información extraída del evento:`, eventInfo)

      // ✅ Verificar si ya existe un appointment con este gcal_event_id
      // Buscar tanto en columna directa como en internal_notes (JSONB)
      const { data: existingByColumn, error: checkError1 } = await supabaseClient
        .from('appointments')
        .select('id')
        .eq('business_id', businessId)
        .eq('gcal_event_id', event.id)
        .maybeSingle()
      
      // Si no se encuentra en columna directa, buscar en internal_notes (JSONB)
      let existing = existingByColumn
      if (!existing && !checkError1) {
        const { data: existingByNotes, error: checkError2 } = await supabaseClient
          .from('appointments')
          .select('id, internal_notes')
          .eq('business_id', businessId)
          .maybeSingle()
        
        if (!checkError2 && existingByNotes?.internal_notes) {
          const notes = typeof existingByNotes.internal_notes === 'string' 
            ? JSON.parse(existingByNotes.internal_notes) 
            : existingByNotes.internal_notes
          if (notes?.gcal_event_id === event.id) {
            existing = existingByNotes
          }
        }
      }
      
      const checkError = checkError1

      if (checkError) {
        console.error(`❌ Error verificando existencia para gcal_event_id ${event.id}:`, checkError)
        skipped++
        continue
      }

      // ✅ Validar que tenemos customer_id y service_id (NOT NULL)
      if (!genericCustomerId) {
        console.error(`❌ No se pudo obtener cliente genérico para business_id ${businessId}`)
        skipped++
        continue
      }

      if (!genericServiceId) {
        console.error(`❌ No se pudo obtener servicio genérico para business_id ${businessId}`)
        skipped++
        continue
      }

      // ✅ Construir appointmentData con SOLO las columnas que existen
      // ✅ SIEMPRE usar "Cliente de Google Calendar" como customer_name
      // ✅ Guardar información extraída del evento en notes e internal_notes
      const appointmentData = {
        business_id: businessId,
        customer_id: genericCustomerId, // ✅ NOT NULL - usar cliente genérico
        service_id: genericServiceId, // ✅ NOT NULL - usar servicio genérico
        resource_id: resourceId, // ✅ NULLABLE
        employee_id: employeeId, // ✅ NULLABLE - asignar empleado desde mapeo de calendario
        customer_name: 'Cliente de Google Calendar', // ✅ NOT NULL - SIEMPRE este nombre
        customer_email: null, // ✅ NULLABLE - no guardar email aquí, está en internal_notes
        customer_phone: null, // ✅ NULLABLE - no guardar teléfono aquí, está en internal_notes
        appointment_date: localAppointmentDate, // ✅ NOT NULL - Fecha LOCAL (no UTC)
        appointment_time: localAppointmentTime, // ✅ NOT NULL - Hora LOCAL (no UTC)
        duration_minutes: durationMinutes, // ✅ NOT NULL
        end_time: localEndTime, // ✅ NULLABLE - Hora LOCAL de fin
        status: event.status === 'cancelled' ? 'cancelled' : 'blocked', // ✅ NULLABLE (default 'confirmed')
        source: 'google_calendar', // ✅ NULLABLE
        notes: eventInfo.notes || event.summary || 'Evento bloqueado de Google Calendar', // ✅ NULLABLE - descripción del evento
        internal_notes: {
          requires_manual_assignment: !employeeId && !!resourceId,
          import_source: 'google_calendar',
          original_summary: event.summary,
          original_description: event.description || null,
          // ✅ Guardar información extraída del evento aquí
          extracted_customer_name: eventInfo.customer_name || null,
          extracted_customer_email: eventInfo.customer_email || null,
          extracted_customer_phone: eventInfo.customer_phone || null,
        }, // ✅ JSONB - Supabase lo maneja automáticamente, no necesita JSON.stringify()
        gcal_event_id: event.id, // ✅ NULLABLE - ID del evento en Google Calendar
        calendar_id: event.calendar_id || null, // ✅ NULLABLE - ID del calendario
        created_at: new Date().toISOString(), // ✅ NOT NULL (default now())
        updated_at: new Date().toISOString(), // ✅ NOT NULL (default now())
      }

      let result

      if (existing) {
        // ✅ Actualizar si existe
        console.log(`  🔄 Actualizando appointment existente (id: ${existing.id}) para gcal_event_id ${event.id}`)
        const { data, error } = await supabaseClient
          .from('appointments')
          .update(appointmentData)
          .eq('id', existing.id)
          .select()

        if (error) {
          console.error(`❌ Error actualizando appointment para gcal_event_id ${event.id}:`, error)
          skipped++
          continue
        }

        result = data
      } else {
        // ✅ Insertar si no existe
        console.log(`  ➕ Insertando nuevo appointment bloqueado para gcal_event_id ${event.id}`)
        const { data, error } = await supabaseClient
          .from('appointments')
          .insert(appointmentData)
          .select()

        if (error) {
          console.error(`❌ Error insertando appointment para gcal_event_id ${event.id}:`, error)
          skipped++
          continue
        }

        result = data
      }

      if (result && result.length > 0) {
        console.log(`  ✅ Appointment bloqueado importado correctamente: ${result[0].id}`)
        imported++
        
        // ✅ BLOQUEAR SLOTS cuando se importa un appointment bloqueado
        await blockAvailabilitySlots(
          supabaseClient,
          businessId,
          localAppointmentDate,
          localAppointmentTime,
          durationMinutes,
          employeeId,
          resourceId
        )
        
        // ✅ FASE 2: Si requiere asignación manual, agregar a la lista
        if (!employeeId && resourceId) {
          unassignedAppointments.push({
            appointment_id: result[0].id,
            gcal_event_id: event.id,
            resource_id: resourceId,
            appointment_date: localAppointmentDate,
            appointment_time: localAppointmentTime,
            customer_name: 'Cliente de Google Calendar', // ✅ SIEMPRE este nombre
            summary: event.summary || 'Sin título',
          })
        }
      } else {
        console.warn(`⚠️ Operación no devolvió datos para gcal_event_id ${event.id}`)
        skipped++
      }

    } catch (error) {
      console.error(`❌ Error processing timed event ${event.id}:`, error)
      skipped++
    }
  }

  console.log(`✅ Importación de appointments completada: ${imported} importados, ${skipped} omitidos`)
  if (unassignedAppointments.length > 0) {
    console.log(`⚠️ ${unassignedAppointments.length} eventos requieren asignación manual de trabajador`)
  }
  return { 
    imported, 
    skipped,
    unassigned_count: unassignedAppointments.length, // ✅ FASE 2: Cantidad de eventos sin asignar
    unassigned_appointments: unassignedAppointments // ✅ FASE 2: Lista de eventos sin asignar
  }
}

/**
 * ✅ DETECTAR CONFLICTOS entre eventos de Google Calendar y appointments existentes
 */
async function detectConflicts(
  supabaseClient: any,
  businessId: string,
  events: any[],
  resourceCalendarMapping: Record<string, string> = {},
  employeeCalendarMapping: Record<string, string> = {}
): Promise<any[]> {
  const conflicts: any[] = []

  console.log(`🔍 Detectando conflictos para ${events.length} eventos...`)

  for (const event of events) {
    if (!event.selected || !event.start?.dateTime) {
      continue
    }

    try {
      const startTime = new Date(event.start.dateTime)
      const endTime = new Date(event.end?.dateTime || event.start.dateTime)
      const appointmentDate = startTime.toISOString().split('T')[0]
      const appointmentTime = startTime.toISOString().split('T')[1].split('.')[0].substring(0, 8)

      // Determinar employee_id del evento
      let employeeId: string | null = null
      if (event.calendar_id) {
        const mappedEmployeeId = Object.keys(employeeCalendarMapping).find(
          empId => employeeCalendarMapping[empId] === event.calendar_id
        )
        if (mappedEmployeeId) {
          employeeId = mappedEmployeeId
        }
      }

      // Buscar appointments existentes que se solapen con este evento
      const { data: existingAppointments, error } = await supabaseClient
        .from('appointments')
        .select('id, customer_name, appointment_date, appointment_time, status, employee_id, resource_id, end_time, duration_minutes')
        .eq('business_id', businessId)
        .eq('appointment_date', appointmentDate)
        .in('status', ['pending', 'confirmed', 'blocked'])
        .neq('source', 'google_calendar') // Excluir appointments ya importados de Google Calendar

      if (error) {
        console.error(`❌ Error buscando conflictos para evento ${event.id}:`, error)
        continue
      }

      // Verificar solapamiento de horarios
      for (const existing of existingAppointments || []) {
        // Si hay employee_id, verificar que coincida
        if (employeeId && existing.employee_id && existing.employee_id !== employeeId) {
          continue // No es conflicto si es otro empleado
        }

        // Verificar solapamiento de horarios
        // ✅ CORREGIDO: appointments NO tiene start_time, usar appointment_time
        const existingStart = new Date(`${existing.appointment_date}T${existing.appointment_time}`)
        const existingEnd = existing.end_time 
          ? new Date(`${existing.appointment_date}T${existing.end_time}`)
          : new Date(existingStart.getTime() + (existing.duration_minutes || 60) * 60000)

        // Verificar si hay solapamiento
        const overlaps = (startTime < existingEnd && endTime > existingStart)

        if (overlaps) {
          conflicts.push({
            gcal_event_id: event.id,
            gcal_summary: event.summary || 'Sin título',
            gcal_start: startTime.toISOString(),
            gcal_end: endTime.toISOString(),
            gcal_employee_id: employeeId,
            existing_appointment_id: existing.id,
            existing_customer_name: existing.customer_name || 'Sin nombre',
            existing_appointment_date: existing.appointment_date,
            existing_appointment_time: existing.appointment_time,
            existing_status: existing.status,
            existing_employee_id: existing.employee_id,
            conflict_type: 'TIME_OVERLAP'
          })
        }
      }
    } catch (error) {
      console.error(`❌ Error procesando conflicto para evento ${event.id}:`, error)
    }
  }

  console.log(`🔍 Conflictos detectados: ${conflicts.length}`)
  return conflicts
}

/**
 * ✅ BLOQUEAR/ELIMINAR SLOTS cuando se importa un appointment bloqueado
 */
async function blockAvailabilitySlots(
  supabaseClient: any,
  businessId: string,
  appointmentDate: string,
  appointmentTime: string,
  durationMinutes: number,
  employeeId: string | null,
  resourceId: string | null
): Promise<void> {
  try {
    // Calcular hora de fin
    const [hours, minutes] = appointmentTime.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + durationMinutes
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`

    console.log(`  🔒 Bloqueando slots: ${appointmentDate} ${appointmentTime} - ${endTime} (${durationMinutes} min)`)

    // Buscar slots que se solapen con este appointment
    let query = supabaseClient
      .from('availability_slots')
      .select('id')
      .eq('business_id', businessId)
      .eq('slot_date', appointmentDate)
      .lte('start_time', endTime)
      .gte('end_time', appointmentTime)

    // Si hay employee_id, filtrar por employee_id
    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    } else if (resourceId) {
      // Si hay resource_id pero no employee_id, buscar slots del recurso
      query = query.eq('resource_id', resourceId)
    }

    const { data: slotsToBlock, error } = await query

    if (error) {
      console.error(`  ⚠️ Error buscando slots a bloquear:`, error)
      return
    }

    if (slotsToBlock && slotsToBlock.length > 0) {
      console.log(`  🔒 Eliminando ${slotsToBlock.length} slot(s) que se solapan con el appointment bloqueado`)
      
      // Eliminar slots que se solapan
      const slotIds = slotsToBlock.map((s: any) => s.id)
      const { error: deleteError } = await supabaseClient
        .from('availability_slots')
        .delete()
        .in('id', slotIds)

      if (deleteError) {
        console.error(`  ❌ Error eliminando slots:`, deleteError)
      } else {
        console.log(`  ✅ ${slotIds.length} slot(s) eliminado(s) correctamente`)
      }
    } else {
      console.log(`  ℹ️ No se encontraron slots a bloquear para ${appointmentDate} ${appointmentTime}`)
    }
  } catch (error) {
    console.error(`  ❌ Error bloqueando slots:`, error)
  }
}

/**
 * Helper function to format date as YYYY-MM-DD (usando UTC para evitar problemas de zona horaria)
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
