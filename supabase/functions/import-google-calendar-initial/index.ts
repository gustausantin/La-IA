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
        const { safe, doubtful, timedEvents } = await classifyGoogleCalendarEvents(accessToken, calendarIds)
        
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
        integration.config?.resource_calendar_mapping || {}
      )

      // Update last sync time
      await supabaseClient
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          config: {
            ...integration.config,
            initial_import_completed: true,
            events_imported: calendarExceptionsResult.imported + appointmentsResult.imported,
            appointments_imported: appointmentsResult.imported,
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
async function classifyGoogleCalendarEvents(accessToken: string, calendarIds: string[]) {
  // Get events from last 90 days and next 90 days
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

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
async function importEventsToAppointments(
  supabaseClient: any,
  businessId: string,
  events: any[],
  resourceCalendarMapping: Record<string, string> = {}
) {
  let imported = 0
  let skipped = 0

  console.log(`📥 Importando ${events.length} eventos con hora como appointments bloqueados para business_id: ${businessId}`)

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
        console.warn(`⚠️ Evento sin fecha/hora de inicio o fin: ${event.id}`)
        skipped++
        continue
      }

      const startTime = new Date(startDateTime)
      const endTime = new Date(endDateTime)

      // ✅ Determinar resource_id basándose en el mapeo de calendarios
      let resourceId: string | null = null
      if (event.calendar_id && resourceCalendarMapping[event.calendar_id]) {
        resourceId = resourceCalendarMapping[event.calendar_id]
        console.log(`  🔗 Recurso vinculado encontrado: calendar_id=${event.calendar_id} → resource_id=${resourceId}`)
      } else {
        console.log(`  ℹ️ No hay recurso vinculado para calendar_id=${event.calendar_id}, resource_id será null`)
      }

      // ✅ Verificar si ya existe un appointment con este gcal_event_id
      const { data: existing, error: checkError } = await supabaseClient
        .from('appointments')
        .select('id')
        .eq('business_id', businessId)
        .eq('gcal_event_id', event.id)
        .maybeSingle()

      if (checkError) {
        console.error(`❌ Error verificando existencia para gcal_event_id ${event.id}:`, checkError)
        skipped++
        continue
      }

      const appointmentData = {
        business_id: businessId,
        resource_id: resourceId,
        employee_id: null, // No se asigna empleado para bloqueos de Google Calendar
        customer_id: null, // No hay cliente en bloqueos de Google Calendar
        service_id: null, // No hay servicio en bloqueos de Google Calendar
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
        status: 'blocked', // Estado bloqueado
        source: 'google_calendar',
        synced_to_gcal: false, // No se sincroniza de vuelta (es bloqueo)
        gcal_event_id: event.id, // ID del evento en Google Calendar
        notes: event.summary || event.reason || 'Evento bloqueado de Google Calendar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
  return { imported, skipped }
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

