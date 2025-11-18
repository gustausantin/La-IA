// Google Calendar OAuth2 Handler
// Handles the OAuth2 callback and exchanges code for tokens
// ✅ FUNCIÓN PÚBLICA - Configurada mediante supabase.functions.config.json con "auth": false

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ✅ URI EXACTA registrada en Google Cloud Console
const EXPECTED_REDIRECT_URI = 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Petición recibida en google-calendar-oauth')
    console.log('📍 URL:', req.url)
    console.log('🔑 Método:', req.method)
    
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // business_id
    const error = url.searchParams.get('error')
    const apikey = url.searchParams.get('apikey')
    
    console.log('🔍 Parámetros recibidos:', {
      has_code: !!code,
      has_state: !!state,
      has_error: !!error,
      has_apikey: !!apikey,
      state_value: state
    })
    
    // Validar apikey (opcional pero recomendado)
    if (apikey) {
      const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (expectedAnonKey && apikey !== expectedAnonKey) {
        console.warn('⚠️ Apikey inválido en query string')
      } else if (expectedAnonKey) {
        console.log('✅ Apikey válido')
      }
    }

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
    console.log('🔄 Intercambiando código por tokens...')
    const tokens = await exchangeCodeForTokens(code)
    
    // Get calendar information
    console.log('📅 Obteniendo información del calendario...')
    const calendarData = await getCalendarInfo(tokens.access_token)
    
    // Save integration to database
    console.log('💾 Guardando integración en base de datos...')
    await saveIntegration(businessId, tokens, calendarData)
    
    // Redirect to app with success
    console.log('✅ OAuth completado exitosamente')
    return redirectToApp('success')

  } catch (error) {
    console.error('❌ Error en OAuth:', error)
    return redirectToApp('error', error.message || 'Unknown error')
  }
})

/**
 * Exchange authorization code for access and refresh tokens
 * ✅ USA LA URI EXACTA registrada en Google Cloud Console
 */
async function exchangeCodeForTokens(code: string) {
  console.log('🔍 Usando redirect_uri:', EXPECTED_REDIRECT_URI)
  
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
      redirect_uri: EXPECTED_REDIRECT_URI, // ✅ URI EXACTA de Google Cloud Console
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}))
    console.error('❌ Token exchange failed:', errorData)
    throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`)
  }

  const tokens = await tokenResponse.json()
  console.log('✅ Tokens obtenidos exitosamente')
  return tokens
}

/**
 * Get calendar information - tries to find "La - IA" calendar, falls back to primary
 */
async function getCalendarInfo(accessToken: string) {
  const calendarListResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!calendarListResponse.ok) {
    const errorData = await calendarListResponse.json().catch(() => ({}))
    console.error('❌ Error obteniendo lista de calendarios:', errorData)
    throw new Error('Failed to fetch calendar list')
  }

  const calendarListData = await calendarListResponse.json()
  const allCalendars = calendarListData.items || []
  
  // Buscar calendario "La - IA" o similar
  let selectedCalendar = allCalendars.find((cal: any) => 
    cal.summary?.toLowerCase().includes('la-ia') || 
    cal.summary?.toLowerCase().includes('la ia') ||
    cal.summary?.toLowerCase() === 'la - ia' ||
    cal.summary?.toLowerCase().includes('la- ia')
  )
  
  // Si no se encuentra, usar el calendario primario
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
      calendar_id: calendarData.id || 'primary',
      calendar_name: calendarData.summary || 'Principal',
      sync_direction: 'unidirectional',
      events_synced: 0,
      calendar_selection_completed: false,
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

  // Try INSERT first, then UPDATE if it fails
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
 */
function redirectToApp(status: 'success' | 'error', message?: string) {
  // Obtener URL pública
  let publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 
                      Deno.env.get('SITE_URL')
  
  if (!publicSiteUrl) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    if (supabaseUrl.includes('supabase.co')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0]
      if (projectRef) {
        publicSiteUrl = `https://${projectRef}.supabase.co`
      }
    }
  }
  
  if (!publicSiteUrl) {
    publicSiteUrl = 'http://localhost:5173'
    console.warn('⚠️ No se encontró PUBLIC_SITE_URL, usando localhost como fallback')
  }
  
  const params = new URLSearchParams({
    tab: 'canales',
    integration: 'google_calendar',
    status,
  })
  
  if (message && status === 'error') {
    params.append('message', message)
  }
  
  const redirectUrl = `${publicSiteUrl}/configuracion?${params.toString()}`
  
  console.log('🔄 Redirigiendo a:', redirectUrl)
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': redirectUrl,
    },
  })
}
