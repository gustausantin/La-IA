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
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth`,
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

    // Store integration - CRÍTICO: Usar SERVICE_ROLE_KEY para bypass RLS
    console.log('💾 Guardando integración en base de datos...', {
      business_id: businessId,
      provider: 'google_calendar',
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token
    })

    // Preparar datos de integración usando la estructura real de la tabla
    const integrationData = {
      business_id: businessId,
      provider: 'google_calendar',
      is_active: true,
      status: 'active', // Usar status también para compatibilidad
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      expires_at: expiresAt, // También actualizar expires_at si existe
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

    const { data: upsertData, error: dbError } = await supabaseClient
      .from('integrations')
      .upsert(integrationData, {
        onConflict: 'business_id,provider'
      })
      .select()

    if (dbError) {
      console.error('❌ Error guardando integración:', dbError)
      console.error('❌ Detalles del error:', {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code
      })
      throw new Error(`Database error: ${dbError.message}`)
    }

    if (!upsertData || upsertData.length === 0) {
      console.error('⚠️ ADVERTENCIA: upsert no devolvió datos');
      throw new Error('No se pudo verificar que los datos se guardaron correctamente');
    }

    console.log('✅ Integración guardada exitosamente:', {
      id: upsertData[0]?.id,
      business_id: upsertData[0]?.business_id,
      provider: upsertData[0]?.provider,
      is_active: upsertData[0]?.is_active,
      status: upsertData[0]?.status,
      has_access_token: !!upsertData[0]?.access_token,
      has_refresh_token: !!upsertData[0]?.refresh_token
    })
    
    // Verificar que realmente se guardó
    const { data: verifyData, error: verifyError } = await supabaseClient
      .from('integrations')
      .select('id, business_id, provider, is_active, status')
      .eq('business_id', businessId)
      .eq('provider', 'google_calendar')
      .single();
    
    if (verifyError) {
      console.error('❌ ERROR CRÍTICO: No se pudo verificar el guardado:', verifyError);
      throw new Error(`Verificación falló: ${verifyError.message}`);
    }
    
    console.log('✅ Verificación exitosa - Integración confirmada en BD:', verifyData);

    // Redirect back to app
    // Construir URL de redirección - usar PUBLIC_SITE_URL o construir desde el request
    const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 
                          Deno.env.get('SITE_URL') || 
                          'http://localhost:5173' // Fallback para desarrollo
    
    const redirectUrl = `${publicSiteUrl}/configuracion?integration=google_calendar&status=success`
    
    console.log('✅ Redirecting to:', redirectUrl)
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    })

  } catch (error) {
    console.error('OAuth error:', error)
    
    // Construir URL de redirección con fallback
    const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 
                          Deno.env.get('SITE_URL') || 
                          'http://localhost:5173' // Fallback para desarrollo
    
    const redirectUrl = `${publicSiteUrl}/configuracion?integration=google_calendar&status=error&message=${encodeURIComponent(error.message)}`
    
    console.error('❌ Redirecting to error page:', redirectUrl)
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    })
  }
})

