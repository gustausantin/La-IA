// Google Calendar Sync - Bidirectional Sync
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { businessId, direction = 'both', dateRange = 30, startDate, endDate, appointmentIds } = await req.json();

    if (!businessId) {
      throw new Error('Missing businessId');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get integration credentials
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('business_id', businessId)
      .eq('provider', 'google_calendar')
      .eq('status', 'active')
      .single();

    if (intError || !integration) {
      throw new Error('Google Calendar not connected');
    }

    // Check if token is expired and refresh if needed
    const credentials = await refreshTokenIfNeeded(integration, supabase);

    let imported = 0;
    let exported = 0;
    let errors = [];

    // IMPORT: Google Calendar → LA-IA
    if (direction === 'import' || direction === 'both') {
      try {
        const importResult = await importFromGoogleCalendar(
          credentials.access_token,
          businessId,
          startDate,
          endDate,
          dateRange,
          supabase
        );
        imported = importResult.count;
        errors = [...errors, ...importResult.errors];
      } catch (error) {
        console.error('❌ Error importing:', error);
        errors.push({ type: 'import', message: error.message });
      }
    }

    // EXPORT: LA-IA → Google Calendar
    if (direction === 'export' || direction === 'both') {
      try {
        const exportResult = await exportToGoogleCalendar(
          credentials.access_token,
          businessId,
          appointmentIds,
          dateRange,
          supabase
        );
        exported = exportResult.count;
        errors = [...errors, ...exportResult.errors];
      } catch (error) {
        console.error('❌ Error exporting:', error);
        errors.push({ type: 'export', message: error.message });
      }
    }

    console.log(`✅ Sync completed: ${imported} imported, ${exported} exported`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        exported,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// Helper: Refresh token if expired
async function refreshTokenIfNeeded(integration: any, supabase: any) {
  const expiresAt = new Date(integration.expires_at);
  const now = new Date();

  if (expiresAt > now) {
    return integration.credentials;
  }

  console.log('🔄 Refreshing expired token...');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
      refresh_token: integration.credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date();
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokens.expires_in);

  await supabase
    .from('integrations')
    .update({
      credentials: {
        ...integration.credentials,
        access_token: tokens.access_token,
      },
      expires_at: newExpiresAt.toISOString(),
    })
    .eq('id', integration.id);

  return {
    ...integration.credentials,
    access_token: tokens.access_token,
  };
}

// IMPORT: Google Calendar → LA-IA
async function importFromGoogleCalendar(
  accessToken: string,
  businessId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  dateRange: number,
  supabase: any
) {
  const errors: any[] = [];
  let count = 0;

  // Calculate date range
  const timeMin = startDate || new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = endDate || new Date(Date.now() + dateRange * 24 * 60 * 60 * 1000).toISOString();

  // Fetch events from Google Calendar
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.statusText}`);
  }

  const { items } = await response.json();

  // Get existing synced events to avoid duplicates
  const { data: existing } = await supabase
    .from('google_calendar_events')
    .select('gcal_event_id')
    .eq('business_id', businessId);

  const existingIds = new Set(existing?.map((e: any) => e.gcal_event_id) || []);

  // Process each event
  for (const event of items || []) {
    try {
      // Skip if already synced
      if (existingIds.has(event.id)) {
        continue;
      }

      // Extract date and time
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = new Date(event.end.dateTime || event.end.date);

      // Store in google_calendar_events table
      await supabase.from('google_calendar_events').insert({
        business_id: businessId,
        integration_id: null, // Will be set by trigger
        gcal_event_id: event.id,
        summary: event.summary,
        description: event.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: event.status || 'confirmed',
        attendees: event.attendees || [],
        location: event.location,
        raw_data: event,
        sync_status: 'synced',
      });

      count++;
    } catch (error) {
      console.error(`❌ Error importing event ${event.id}:`, error);
      errors.push({ eventId: event.id, message: error.message });
    }
  }

  return { count, errors };
}

// EXPORT: LA-IA → Google Calendar
async function exportToGoogleCalendar(
  accessToken: string,
  businessId: string,
  appointmentIds: string[] | undefined,
  dateRange: number,
  supabase: any
) {
  const errors: any[] = [];
  let count = 0;

  // Get appointments to export
  let query = supabase
    .from('appointments')
    .select(`
      *,
      customer:customers(name, phone, email),
      service:services(name, duration_minutes)
    `)
    .eq('business_id', businessId)
    .in('status', ['confirmed', 'pending']);

  if (appointmentIds && appointmentIds.length > 0) {
    query = query.in('id', appointmentIds);
  } else {
    // Export appointments within date range
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + dateRange * 24 * 60 * 60 * 1000);
    query = query.gte('appointment_date', startDate.toISOString().split('T')[0])
      .lte('appointment_date', endDate.toISOString().split('T')[0]);
  }

  const { data: appointments, error: appError } = await query;

  if (appError) throw appError;

  // Check which appointments are already exported
  const { data: existing } = await supabase
    .from('google_calendar_events')
    .select('appointment_id, gcal_event_id')
    .eq('business_id', businessId)
    .not('appointment_id', 'is', null);

  const existingMap = new Map(existing?.map((e: any) => [e.appointment_id, e.gcal_event_id]) || []);

  // Export each appointment
  for (const appointment of appointments || []) {
    try {
      // Skip if already exported
      if (existingMap.has(appointment.id)) {
        continue;
      }

      // Create Google Calendar event
      const startDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
      const endDateTime = new Date(startDateTime.getTime() + (appointment.duration_minutes || 60) * 60 * 1000);

      const event = {
        summary: `${appointment.service?.name || 'Cita'} - ${appointment.customer_name}`,
        description: `Cliente: ${appointment.customer_name}\nTeléfono: ${appointment.customer_phone || 'N/A'}\nNotas: ${appointment.notes || 'N/A'}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Europe/Madrid',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Europe/Madrid',
        },
        attendees: appointment.customer?.email ? [{ email: appointment.customer.email }] : [],
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const createdEvent = await response.json();

      // Store reference in google_calendar_events
      await supabase.from('google_calendar_events').insert({
        business_id: businessId,
        gcal_event_id: createdEvent.id,
        appointment_id: appointment.id,
        summary: createdEvent.summary,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: 'confirmed',
        sync_status: 'synced',
        raw_data: createdEvent,
      });

      count++;
    } catch (error) {
      console.error(`❌ Error exporting appointment ${appointment.id}:`, error);
      errors.push({ appointmentId: appointment.id, message: error.message });
    }
  }

  return { count, errors };
}

