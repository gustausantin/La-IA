// Google Calendar OAuth2 Handler
// Handles the OAuth2 callback and exchanges code for tokens

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // business_id
    const error = url.searchParams.get('error')

    if (error) {
      return new Response(
        JSON.stringify({ error: 'OAuth error', details: error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const businessId = state

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
        redirect_uri: `${Deno.env.get('PUBLIC_SITE_URL')}/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`)
    }

    const tokens = await tokenResponse.json()

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

    // Get primary calendar info
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary',
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      }
    )

    const calendarData = await calendarResponse.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store integration
    const { data, error: dbError } = await supabaseClient
      .from('integrations')
      .upsert({
        business_id: businessId,
        provider: 'google_calendar',
        is_active: true,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        config: {
          calendar_id: 'primary',
          calendar_name: calendarData.summary || 'Principal',
          sync_direction: 'bidirectional',
          events_synced: 0,
        },
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,provider'
      })

    if (dbError) throw dbError

    // Redirect back to app
    const redirectUrl = `${Deno.env.get('PUBLIC_SITE_URL')}/configuracion?integration=google_calendar&status=success`
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    })

  } catch (error) {
    console.error('OAuth error:', error)
    
    const redirectUrl = `${Deno.env.get('PUBLIC_SITE_URL')}/configuracion?integration=google_calendar&status=error&message=${encodeURIComponent(error.message)}`
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    })
  }
})

