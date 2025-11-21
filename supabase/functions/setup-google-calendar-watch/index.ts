// Setup Google Calendar Watch
// Configura notificaciones push de Google Calendar para sincronización automática
// ✅ GRATIS - Los canales expiran después de 7 días y se renuevan automáticamente

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
    
    if (!authHeader && !apikey) {
      return new Response(
        JSON.stringify({ 
          code: 401, 
          message: 'Missing authorization',
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
    const { business_id } = await req.json()

    if (!business_id) {
      return new Response(
        JSON.stringify({ 
          code: 400, 
          message: 'Missing business_id'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // ✅ Obtener integración
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('business_id', business_id)
      .eq('provider', 'google_calendar')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('Google Calendar no conectado')
    }

    // ✅ Obtener access_token (refrescar si es necesario)
    let accessToken = integration.access_token || integration.credentials?.access_token
    const refreshToken = integration.refresh_token || integration.credentials?.refresh_token
    const tokenExpiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null

    if (!accessToken || (tokenExpiresAt && tokenExpiresAt <= new Date())) {
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

      await supabaseClient
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString(),
        })
        .eq('id', integration.id)
    }

    // ✅ Obtener calendarios a monitorear
    let calendarIds: string[] = []
    
    if (Array.isArray(integration.config?.calendar_ids)) {
      calendarIds = integration.config.calendar_ids
    } else if (integration.config?.calendar_id) {
      calendarIds = [integration.config.calendar_id]
    }
    
    console.log(`📅 Calendarios a monitorear: ${calendarIds.length}`, calendarIds)
    
    if (calendarIds.length === 0) {
      throw new Error('No hay calendarios configurados en integration.config.calendar_ids')
    }

    // ✅ URL del webhook (debe ser HTTPS y público)
    // Usar la URL pública de Supabase con el endpoint del webhook
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL no está configurado en las variables de entorno')
    }
    
    const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`
    console.log(`🔗 Webhook URL: ${webhookUrl}`)
    
    const watchChannels: any[] = []

    // ✅ Configurar watch para cada calendario
    for (const calendarId of calendarIds) {
      try {
        // Validar calendarId
        if (!calendarId || typeof calendarId !== 'string') {
          console.error(`❌ calendarId inválido: ${calendarId}`)
          continue
        }
        
        // Generar channel_id único que cumpla con el formato requerido por Google: [A-Za-z0-9\-_+/=]+
        // Limpiar business_id y calendarId de caracteres especiales
        const cleanBusinessId = business_id.replace(/[^A-Za-z0-9\-_]/g, '').substring(0, 16)
        const cleanCalendarId = calendarId.replace(/[^A-Za-z0-9\-_]/g, '').substring(0, 20)
        const timestamp = Date.now()
        const channelId = `la-ia-${cleanBusinessId}-${cleanCalendarId}-${timestamp}`
        
        console.log(`🔄 Configurando watch para calendario: ${calendarId.substring(0, 50)}...`)
        
        // ✅ Configurar watch en Google Calendar
        const watchResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: channelId,
              type: 'web_hook',
              address: webhookUrl,
              // ✅ Expira en 7 días (máximo permitido por Google)
              expiration: Date.now() + (7 * 24 * 60 * 60 * 1000),
              // ✅ Token para identificar el business_id en el webhook
              token: business_id,
            }),
          }
        )

        if (!watchResponse.ok) {
          const errorText = await watchResponse.text()
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { raw: errorText }
          }
          
          console.error(`❌ Error configurando watch para ${calendarId}:`, {
            status: watchResponse.status,
            statusText: watchResponse.statusText,
            error: errorData
          })
          
          // Si es un error 403 o 401, puede ser un problema de permisos
          if (watchResponse.status === 403 || watchResponse.status === 401) {
            throw new Error(`Error de permisos al configurar watch para ${calendarId}: ${JSON.stringify(errorData)}`)
          }
          
          continue
        }

        const watchData = await watchResponse.json()
        
        if (!watchData.resourceId) {
          console.error(`❌ watchData no tiene resourceId:`, watchData)
          continue
        }
        
        watchChannels.push({
          calendar_id: calendarId,
          channel_id: channelId,
          resource_id: watchData.resourceId,
          expiration: watchData.expiration,
        })

        console.log(`✅ Watch configurado para calendario ${calendarId.substring(0, 30)}...`)
      } catch (error) {
        console.error(`❌ Error configurando watch para ${calendarId}:`, error)
        // Si es un error crítico (permisos), lanzarlo para que se propague
        if (error?.message?.includes('permisos')) {
          throw error
        }
        continue
      }
    }

    if (watchChannels.length === 0) {
      throw new Error('No se pudo configurar ningún watch')
    }

    // ✅ Guardar información de watch en la integración
    await supabaseClient
      .from('integrations')
      .update({
        config: {
          ...integration.config,
          watch_channels: watchChannels,
          watch_setup_at: new Date().toISOString(),
        },
      })
      .eq('id', integration.id)

    return new Response(
      JSON.stringify({
        success: true,
        channels_configured: watchChannels.length,
        channels: watchChannels,
        message: 'Notificaciones push configuradas correctamente. Los cambios en Google Calendar se sincronizarán automáticamente.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error configurando watch:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Error desconocido',
        success: false,
        details: error?.stack || 'No hay detalles adicionales'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

