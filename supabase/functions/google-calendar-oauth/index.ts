// Google Calendar OAuth2 Handler
// Handles the OAuth2 callback and exchanges code for tokens
// Production-ready version

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // business_id
    const error = url.searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('❌ OAuth error:', error)
      return redirectToApp('error', `OAuth error: ${error}`)
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing required parameters:', { has_code: !!code, has_state: !!state })
      return redirectToApp('error', 'Missing code or state parameter')
    }

    const businessId = state

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code)
    
    // Get calendar information
    const calendarData = await getCalendarInfo(tokens.access_token)
    
    // Save integration to database
    await saveIntegration(businessId, tokens, calendarData)
    
    // Redirect to app with success
    return redirectToApp('success')

  } catch (error) {
    console.error('❌ OAuth error:', error)
    return redirectToApp('error', error.message || 'Unknown error')
  }
})

/**
 * Exchange authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(code: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set')
  }

  // Construct redirect_uri - must match exactly with Google Cloud Console
  const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth`
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured')
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json()
    console.error('❌ Token exchange failed:', errorData)
    throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`)
  }

  return await tokenResponse.json()
}

/**
 * Get primary calendar information
 */
async function getCalendarInfo(accessToken: string) {
  const calendarResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (!calendarResponse.ok) {
    const errorData = await calendarResponse.json()
    throw new Error(`Failed to get calendar info: ${JSON.stringify(errorData)}`)
  }

  return await calendarResponse.json()
}

/**
 * Save integration to database
 */
async function saveIntegration(
  businessId: string,
  tokens: any,
  calendarData: any
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials are not configured')
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

  const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()

  const integrationData = {
    business_id: businessId,
    provider: 'google_calendar',
    is_active: true,
    status: 'active',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    expires_at: expiresAt,
    scopes: tokens.scope?.split(' ') || [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    credentials: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      scope: tokens.scope,
    },
    config: {
      calendar_id: 'primary',
      calendar_name: calendarData.summary || 'Principal',
      sync_direction: 'bidirectional',
      events_synced: 0,
    },
    metadata: {
      calendar_id: calendarData.id,
      calendar_timezone: calendarData.timeZone,
      autoSync: false,
      intervalMinutes: 15,
    },
    connected_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
  }

  // Try INSERT first, then UPDATE if it fails (more robust than upsert)
  const { data: insertData, error: insertError } = await supabaseClient
    .from('integrations')
    .insert(integrationData)
    .select()
    .single()

  if (insertError) {
    // If it fails due to unique constraint, do UPDATE
    if (insertError.code === '23505' || 
        insertError.message?.includes('unique') || 
        insertError.message?.includes('duplicate')) {
      
      const { data: updateData, error: updateError } = await supabaseClient
        .from('integrations')
        .update(integrationData)
        .eq('business_id', businessId)
        .eq('provider', 'google_calendar')
        .select()
        .single()
      
      if (updateError) {
        console.error('❌ Error updating integration:', updateError)
        throw new Error(`Database error: ${updateError.message}`)
      }
      
      console.log('✅ Integration updated successfully')
      return updateData
    } else {
      console.error('❌ Error inserting integration:', insertError)
      throw new Error(`Database error: ${insertError.message}`)
    }
  }

  console.log('✅ Integration saved successfully')
  return insertData
}

/**
 * Redirect to app with status
 * Redirige a la página de integraciones (tab=canales) para que el usuario vea el resultado
 */
function redirectToApp(status: 'success' | 'error', message?: string) {
  const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 
                        Deno.env.get('SITE_URL') || 
                        'http://localhost:5173'
  
  const params = new URLSearchParams({
    tab: 'canales', // ✅ Redirigir al tab de integraciones
    integration: 'google_calendar',
    status,
  })
  
  if (message && status === 'error') {
    params.append('message', message)
  }
  
  const redirectUrl = `${publicSiteUrl}/configuracion?${params.toString()}`
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': redirectUrl,
    },
  })
}
