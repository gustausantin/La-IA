// List Google Calendars
// Lists all calendars available for the authenticated user

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // ✅ CRÍTICO: Handle CORS preflight FIRST, before any other logic
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { business_id } = await req.json()

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
    const tokenExpiresAt = new Date(integration.token_expires_at || integration.expires_at || 0)
    let accessToken = integration.access_token

    if (tokenExpiresAt < new Date()) {
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

    // List all calendars
    const calendarsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!calendarsResponse.ok) {
      const errorData = await calendarsResponse.json()
      throw new Error(`Google API error: ${JSON.stringify(errorData)}`)
    }

    const calendarsData = await calendarsResponse.json()
    const calendars = (calendarsData.items || []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
      selected: cal.selected || false,
    }))

    return new Response(
      JSON.stringify({
        success: true,
        calendars,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ List calendars error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

