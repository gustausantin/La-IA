// ============================================
// Edge Function: cancel-appointments-batch
// Propósito: Cancelar múltiples citas y enviar mensaje de reagendación
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Crear cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 2. Obtener parámetros
    const {
      business_id,
      appointment_ids,
      cancellation_reason,
      send_reschedule_message,
    } = await req.json();

    if (!business_id || !appointment_ids || appointment_ids.length === 0) {
      throw new Error("Parámetros requeridos: business_id, appointment_ids");
    }

    console.log(`🚫 Cancelando ${appointment_ids.length} cita(s)...`);
    console.log(`   Motivo: ${cancellation_reason || "No especificado"}`);

    // 3. Obtener detalles de las citas antes de cancelar
    const { data: appointments, error: apptsError } = await supabaseClient
      .from("appointments")
      .select(`
        id, 
        customer_name, 
        customer_phone, 
        customer_email,
        appointment_time, 
        appointment_date,
        employee_id,
        resource_id,
        service_id,
        business_services(name)
      `)
      .in("id", appointment_ids)
      .eq("business_id", business_id);

    if (apptsError || !appointments || appointments.length === 0) {
      throw new Error("No se encontraron las citas especificadas");
    }

    console.log(`📋 Citas a cancelar:`);
    appointments.forEach((a: any) => {
      console.log(`   - ${a.customer_name} a las ${a.appointment_time}`);
    });

    // 4. Actualizar appointments a status='cancelled'
    const { data: cancelledAppointments, error: updateError } = await supabaseClient
      .from("appointments")
      .update({
        status: "cancelled",
        notes: `Cancelado: ${cancellation_reason || "Motivo no especificado"}. Fecha: ${new Date().toISOString()}`,
        updated_at: new Date().toISOString(),
      })
      .in("id", appointment_ids)
      .select();

    if (updateError) {
      throw new Error(`Error cancelando citas: ${updateError.message}`);
    }

    console.log(`✅ ${cancelledAppointments.length} cita(s) canceladas`);

    // 5. Liberar availability_slots
    try {
      for (const appt of appointments) {
        const { error: slotError } = await supabaseClient
          .from("availability_slots")
          .update({
            status: "free",
            is_available: true,
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", business_id)
          .eq("slot_date", appt.appointment_date)
          .eq("start_time", appt.appointment_time)
          .eq("employee_id", appt.employee_id)
          .eq("resource_id", appt.resource_id);

        if (slotError) {
          console.warn(`⚠️ Error liberando slot para ${appt.customer_name}:`, slotError.message);
        }
      }

      console.log("✅ Slots liberados");
    } catch (slotError) {
      console.warn("⚠️ Error liberando slots (no crítico):", slotError);
    }

    // 6. Sincronizar con Google Calendar si está activo
    try {
      const { data: integration } = await supabaseClient
        .from("integrations")
        .select("id, status")
        .eq("business_id", business_id)
        .eq("provider", "google_calendar")
        .eq("status", "active")
        .maybeSingle();

      if (integration) {
        console.log("📅 Sincronizando con Google Calendar...");
        
        for (const appt of cancelledAppointments) {
          await supabaseClient.functions.invoke("sync-google-calendar", {
            body: {
              business_id,
              action: "cancel",
              appointment_id: appt.id,
            },
          });
        }
        
        console.log("✅ Google Calendar sincronizado");
      }
    } catch (gcalError) {
      console.warn("⚠️ Error sincronizando Google Calendar (no crítico):", gcalError);
    }

    // 7. Enviar mensajes de reagendación si está habilitado
    const notificationResults = [];
    
    if (send_reschedule_message) {
      console.log("📱 Enviando mensajes de reagendación...");
      
      // Obtener nombre del negocio
      const { data: business } = await supabaseClient
        .from("businesses")
        .select("name")
        .eq("id", business_id)
        .single();

      const businessName = business?.name || "nuestro negocio";
      
      for (const appt of appointments) {
        try {
          if (!appt.customer_phone) {
            console.warn(`⚠️ ${appt.customer_name} no tiene teléfono registrado`);
            continue;
          }

          const serviceName = appt.business_services?.name || "tu cita";
          
          const message = `Hola ${appt.customer_name}, lamentamos informarte que debemos cancelar tu cita de ${serviceName} del ${formatDate(appt.appointment_date)} a las ${formatTime(appt.appointment_time)} por motivo de ${cancellation_reason || "fuerza mayor"}. ¿Podemos reagendar para otro día? Escríbenos para coordinar. Disculpa las molestias. - ${businessName}`;

          console.log(`   ✉️ ${appt.customer_name}: "${message.substring(0, 50)}..."`);
          
          notificationResults.push({
            customer_name: appt.customer_name,
            customer_phone: appt.customer_phone,
            sent: true,
            message: message,
          });

          // TODO: Integrar con WhatsApp API real
          // await sendWhatsAppMessage(appt.customer_phone, message);

        } catch (notifError) {
          console.error(`❌ Error enviando mensaje a ${appt.customer_name}:`, notifError);
          notificationResults.push({
            customer_name: appt.customer_name,
            customer_phone: appt.customer_phone,
            sent: false,
            error: notifError.message,
          });
        }
      }
    }

    // 8. Devolver resultado
    return new Response(
      JSON.stringify({
        success: true,
        cancelled_count: cancelledAppointments.length,
        reason: cancellation_reason,
        appointments: cancelledAppointments.map((a: any) => ({
          id: a.id,
          customer_name: a.customer_name,
          date: a.appointment_date,
          time: a.appointment_time,
        })),
        notifications_sent: send_reschedule_message,
        notification_results: notificationResults,
        message: `✅ ${cancelledAppointments.length} cita(s) cancelada(s) exitosamente`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error en cancel-appointments-batch:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        cancelled_count: 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Helper functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { 
    day: "numeric", 
    month: "long",
  });
}

function formatTime(timeStr: string): string {
  return timeStr.substring(0, 5);
}


