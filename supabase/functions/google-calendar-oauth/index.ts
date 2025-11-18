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
    // ✅ Esta función DEBE ser pública porque Google redirige directamente aquí
    // No requerimos autenticación cuando viene de Google (tiene parámetros code/state)
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // business_id
    const error = url.searchParams.get('error')
    const apikey = url.searchParams.get('apikey') // ✅ Apikey del query string (para hacer la función pública)
    
    // ✅ Verificar que el apikey sea válido (opcional, pero recomendado para seguridad)
    if (apikey) {
      const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (expectedAnonKey && apikey !== expectedAnonKey) {
        console.warn('⚠️ Apikey inválido en query string')
        // No bloqueamos, pero registramos la advertencia
      }
    }
    
    // ✅ Si no hay parámetros de OAuth, podría ser una petición directa (no permitida)
    // Pero si viene de Google, debe tener code y state

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

    // ✅ Obtener el redirect_uri completo (incluyendo apikey si está presente)
    const redirectUriWithParams = url.toString().split('?')[0] // URL base sin parámetros
    const apikeyParam = apikey ? `?apikey=${encodeURIComponent(apikey)}` : ''
    const fullRedirectUri = `${redirectUriWithParams}${apikeyParam}`

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, fullRedirectUri)
    
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
async function exchangeCodeForTokens(code: string, redirectUri: string) {
  // ✅ CRÍTICO: El redirectUri DEBE coincidir EXACTAMENTE con el registrado en Google Cloud Console
  // Usar el URI exacto que está registrado en Google Cloud Console
  const expectedRedirectUri = 'https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM';
  
  // Usar el URI esperado (el que está registrado en Google Cloud Console)
  const redirectUriToUse = expectedRedirectUri;
  
  console.log('🔍 Usando redirect_uri para exchange:', redirectUriToUse);
  
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
      redirect_uri: redirectUriToUse, // ✅ Usar el URI exacto registrado en Google Cloud Console
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
  // ✅ CRÍTICO: Obtener URL pública correcta
  // Prioridad: PUBLIC_SITE_URL > SITE_URL > Referer header > localhost
  let publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 
                      Deno.env.get('SITE_URL')
  
  // Si no hay URL configurada, intentar obtenerla del referer
  if (!publicSiteUrl) {
    // En producción, usar el dominio de Supabase si está disponible
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    if (supabaseUrl.includes('supabase.co')) {
      // Extraer el proyecto ref y construir URL de producción
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0]
      if (projectRef) {
        publicSiteUrl = `https://${projectRef}.supabase.co`
      }
    }
  }
  
  // Fallback final
  if (!publicSiteUrl) {
    publicSiteUrl = 'http://localhost:5173'
    console.warn('⚠️ No se encontró PUBLIC_SITE_URL, usando localhost como fallback')
  }
  
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
  console.log('📍 URL pública usada:', publicSiteUrl)
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': redirectUrl,
    },
  })
}
