// Renew Google Calendar Watch Channels
// Renueva automáticamente los canales de watch que están por expirar (cada 7 días)
// ✅ Se puede ejecutar como cron job o manualmente

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
    console.log('🔄 Renovando canales de watch de Google Calendar')

    // ✅ Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ✅ Obtener todas las integraciones activas con watch_channels
    const { data: integrations, error: integrationsError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('provider', 'google_calendar')
      .eq('is_active', true)

    if (integrationsError || !integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No hay integraciones activas',
          renewed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalRenewed = 0
    let totalErrors = 0

    // ✅ Renovar canales para cada integración
    for (const integration of integrations) {
      const watchChannels = integration.config?.watch_channels || []
      
      if (watchChannels.length === 0) {
        continue
      }

      // ✅ Verificar si algún canal está por expirar (menos de 1 día)
      const now = Date.now()
      const channelsToRenew = watchChannels.filter((wc: any) => {
        const expiration = wc.expiration ? new Date(wc.expiration).getTime() : 0
        const daysUntilExpiration = (expiration - now) / (24 * 60 * 60 * 1000)
        return daysUntilExpiration < 1 // Renovar si queda menos de 1 día
      })

      if (channelsToRenew.length === 0) {
        console.log(`✅ Integración ${integration.business_id}: No hay canales por renovar`)
        continue
      }

      console.log(`🔄 Renovando ${channelsToRenew.length} canal(es) para business_id: ${integration.business_id}`)

      try {
        // ✅ Refrescar token si es necesario
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

        // ✅ URL del webhook
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`

        const renewedChannels: any[] = []

        // ✅ Renovar cada canal
        for (const channel of channelsToRenew) {
          try {
            // Generar nuevo channel_id
            const newChannelId = `la-ia-${integration.business_id}-${channel.calendar_id}-${Date.now()}`
            
            // ✅ Configurar nuevo watch
            const watchResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(channel.calendar_id)}/events/watch`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: newChannelId,
                  type: 'web_hook',
                  address: webhookUrl,
                  expiration: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 días
                }),
              }
            )

            if (!watchResponse.ok) {
              const errorData = await watchResponse.json().catch(() => ({}))
              console.warn(`⚠️ Error renovando watch para ${channel.calendar_id}:`, errorData)
              continue
            }

            const watchData = await watchResponse.json()
            
            renewedChannels.push({
              calendar_id: channel.calendar_id,
              channel_id: newChannelId,
              resource_id: watchData.resourceId,
              expiration: watchData.expiration,
            })

            console.log(`✅ Canal renovado para calendario ${channel.calendar_id}`)
          } catch (error) {
            console.error(`❌ Error renovando canal ${channel.calendar_id}:`, error)
            continue
          }
        }

        if (renewedChannels.length > 0) {
          // ✅ Actualizar watch_channels: mantener los no renovados y agregar los renovados
          const channelsNotRenewed = watchChannels.filter((wc: any) => 
            !channelsToRenew.some((ctr: any) => ctr.calendar_id === wc.calendar_id)
          )
          
          const updatedWatchChannels = [...channelsNotRenewed, ...renewedChannels]

          await supabaseClient
            .from('integrations')
            .update({
              config: {
                ...integration.config,
                watch_channels: updatedWatchChannels,
                watch_renewed_at: new Date().toISOString(),
              },
            })
            .eq('id', integration.id)

          totalRenewed += renewedChannels.length
        }
      } catch (error) {
        console.error(`❌ Error renovando canales para business_id ${integration.business_id}:`, error)
        totalErrors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        renewed: totalRenewed,
        errors: totalErrors,
        total_integrations: integrations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error renovando watch channels:', error)
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

