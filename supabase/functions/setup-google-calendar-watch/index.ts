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
    const calendarIds = integration.config?.calendar_ids || 
                       (integration.config?.calendar_id ? [integration.config.calendar_id] : [])
    
    if (calendarIds.length === 0) {
      throw new Error('No hay calendarios configurados')
    }

    // ✅ URL del webhook (debe ser HTTPS y público)
    // Usar la URL pública de Supabase con el endpoint del webhook
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`
    
    const watchChannels: any[] = []

    // ✅ Configurar watch para cada calendario
    for (const calendarId of calendarIds) {
      try {
        // Generar channel_id único
        const channelId = `la-ia-${business_id}-${calendarId}-${Date.now()}`
        
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
            }),
          }
        )

        if (!watchResponse.ok) {
          const errorData = await watchResponse.json().catch(() => ({}))
          console.warn(`⚠️ Error configurando watch para ${calendarId}:`, errorData)
          continue
        }

        const watchData = await watchResponse.json()
        
        watchChannels.push({
          calendar_id: calendarId,
          channel_id: channelId,
          resource_id: watchData.resourceId,
          expiration: watchData.expiration,
        })

        console.log(`✅ Watch configurado para calendario ${calendarId}`)
      } catch (error) {
        console.error(`❌ Error configurando watch para ${calendarId}:`, error)
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

