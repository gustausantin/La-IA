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
 * Get calendar information - tries to find "La - IA" calendar, falls back to primary
 */
async function getCalendarInfo(accessToken: string) {
  // ✅ List all calendars to find "La - IA" or use primary
  const calendarListResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!calendarListResponse.ok) {
    throw new Error('Failed to fetch calendar list')
  }

  const calendarListData = await calendarListResponse.json()
  const allCalendars = calendarListData.items || []
  
  // ✅ Buscar calendario "La - IA" o similar
  let selectedCalendar = allCalendars.find((cal: any) => 
    cal.summary?.toLowerCase().includes('la-ia') || 
    cal.summary?.toLowerCase().includes('la ia') ||
    cal.summary?.toLowerCase() === 'la - ia' ||
    cal.summary?.toLowerCase().includes('la- ia')
  )
  
  // Si no se encuentra "La - IA", usar el calendario primario
  if (!selectedCalendar) {
    const primaryCalendar = allCalendars.find((cal: any) => cal.primary)
    selectedCalendar = primaryCalendar || { id: 'primary', summary: 'Principal' }
    
    // Si no hay primario en la lista, obtenerlo directamente
    if (!selectedCalendar || selectedCalendar.id === 'primary') {
      const primaryResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })
      
      if (primaryResponse.ok) {
        selectedCalendar = await primaryResponse.json()
      }
    }
  }
  
  console.log(`✅ Calendario seleccionado: "${selectedCalendar?.summary || 'Principal'}" (ID: ${selectedCalendar?.id || 'primary'})`)
  
  return selectedCalendar || { id: 'primary', summary: 'Principal' }
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
      calendar_id: calendarData.id || 'primary', // Calendario por defecto hasta que el usuario seleccione
      calendar_name: calendarData.summary || 'Principal',
      sync_direction: 'unidirectional', // ✅ Unidireccional: LA-IA → Google Calendar
      events_synced: 0,
      calendar_selection_completed: false, // El usuario debe seleccionar qué calendarios usar
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
 * ✅ CRÍTICO: Redirige a la página de integraciones (tab=canales) para que el usuario vea el resultado
 * NO debe redirigir al Dashboard, DEBE volver a /configuracion?tab=canales
 */
function redirectToApp(status: 'success' | 'error', message?: string) {
  const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 
                        Deno.env.get('SITE_URL') || 
                        'http://localhost:5173'
  
  // ✅ CRÍTICO: Construir URL de configuración con tab=canales
  // NO redirigir al Dashboard, siempre volver a la página de integraciones
  const params = new URLSearchParams({
    tab: 'canales', // ✅ Tab de integraciones
    integration: 'google_calendar',
    status,
  })
  
  if (message && status === 'error') {
    params.append('message', message)
  }
  
  // ✅ URL completa: /configuracion?tab=canales&integration=google_calendar&status=success
  const redirectUrl = `${publicSiteUrl}/configuracion?${params.toString()}`
  
  console.log('🔄 Redirigiendo después de OAuth:', redirectUrl)
  console.log('✅ CRÍTICO: Debe volver a /configuracion?tab=canales, NO al Dashboard')
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': redirectUrl,
    },
  })
}
