// ============================================
// Edge Function: transfer-appointments
// Propósito: Transferir citas de un empleado a otro y notificar clientes
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
      from_employee_id,
      from_employee_name,
      to_employee_id,
      to_employee_name,
      to_resource_id,
      appointment_ids,
      notify_customers,
    } = await req.json();

    if (!business_id || !from_employee_id || !to_employee_id || !appointment_ids || appointment_ids.length === 0) {
      throw new Error("Parámetros requeridos: business_id, from_employee_id, to_employee_id, appointment_ids");
    }

    console.log(`🔀 Transfiriendo ${appointment_ids.length} cita(s):`);
    console.log(`   Desde: ${from_employee_name} (${from_employee_id})`);
    console.log(`   Hacia: ${to_employee_name} (${to_employee_id})`);

    // 3. Verificar que el empleado destino existe y está activo
    const { data: toEmployee, error: empError } = await supabaseClient
      .from("employees")
      .select("id, name, assigned_resource_id")
      .eq("id", to_employee_id)
      .eq("business_id", business_id)
      .eq("is_active", true)
      .single();

    if (empError || !toEmployee) {
      throw new Error(`Empleado destino no encontrado o inactivo`);
    }

    const finalResourceId = to_resource_id || toEmployee.assigned_resource_id;

    // 4. Obtener detalles de las citas antes de actualizar
    const { data: appointments, error: apptsError } = await supabaseClient
      .from("appointments")
      .select("id, customer_name, customer_phone, appointment_time, appointment_date, duration_minutes")
      .in("id", appointment_ids)
      .eq("business_id", business_id);

    if (apptsError || !appointments || appointments.length === 0) {
      throw new Error("No se encontraron las citas especificadas");
    }

    console.log(`📋 Citas a transferir:`);
    appointments.forEach((a: any) => {
      console.log(`   - ${a.customer_name} a las ${a.appointment_time}`);
    });

    // 5. Actualizar appointments
    const { data: updatedAppointments, error: updateError } = await supabaseClient
      .from("appointments")
      .update({
        employee_id: to_employee_id,
        resource_id: finalResourceId,
        notes: `Transferido desde ${from_employee_name} el ${new Date().toISOString()}`,
        updated_at: new Date().toISOString(),
      })
      .in("id", appointment_ids)
      .select();

    if (updateError) {
      throw new Error(`Error actualizando citas: ${updateError.message}`);
    }

    console.log(`✅ ${updatedAppointments.length} cita(s) actualizadas`);

    // 6. Actualizar availability_slots si corresponde
    try {
      const { error: slotsError } = await supabaseClient
        .from("availability_slots")
        .update({
          employee_id: to_employee_id,
          resource_id: finalResourceId,
        })
        .eq("business_id", business_id)
        .in("id", appointments.map((a: any) => a.slot_id).filter(Boolean));

      if (slotsError) {
        console.warn("⚠️ Error actualizando slots (no crítico):", slotsError.message);
      }
    } catch (slotUpdateError) {
      console.warn("⚠️ No se pudieron actualizar slots:", slotUpdateError);
    }

    // 7. Sincronizar con Google Calendar si está activo
    try {
      // Verificar si hay integración con Google Calendar
      const { data: integration } = await supabaseClient
        .from("integrations")
        .select("id, status")
        .eq("business_id", business_id)
        .eq("provider", "google_calendar")
        .eq("status", "active")
        .maybeSingle();

      if (integration) {
        console.log("📅 Sincronizando con Google Calendar...");
        
        for (const appt of updatedAppointments) {
          await supabaseClient.functions.invoke("sync-google-calendar", {
            body: {
              business_id,
              action: "update",
              appointment_id: appt.id,
            },
          });
        }
        
        console.log("✅ Google Calendar sincronizado");
      }
    } catch (gcalError) {
      console.warn("⚠️ Error sincronizando Google Calendar (no crítico):", gcalError);
    }

    // 8. Enviar notificaciones WhatsApp si está habilitado
    const notificationResults = [];
    
    if (notify_customers) {
      console.log("📱 Enviando notificaciones WhatsApp...");
      
      for (const appt of appointments) {
        try {
          if (!appt.customer_phone) {
            console.warn(`⚠️ ${appt.customer_name} no tiene teléfono registrado`);
            continue;
          }

          const message = `Hola ${appt.customer_name}, te informamos que tu cita del ${formatDate(appt.appointment_date)} a las ${formatTime(appt.appointment_time)} será atendida por ${to_employee_name}. ¡Gracias por tu comprensión!`;

          // Aquí se integraría con Twilio/WhatsApp API
          // Por ahora, solo registramos el intento
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
          console.error(`❌ Error enviando notificación a ${appt.customer_name}:`, notifError);
          notificationResults.push({
            customer_name: appt.customer_name,
            customer_phone: appt.customer_phone,
            sent: false,
            error: notifError.message,
          });
        }
      }
    }

    // 9. Devolver resultado
    return new Response(
      JSON.stringify({
        success: true,
        transferred_count: updatedAppointments.length,
        from_employee: from_employee_name,
        to_employee: to_employee_name,
        appointments: updatedAppointments.map((a: any) => ({
          id: a.id,
          customer_name: a.customer_name,
          time: a.appointment_time,
        })),
        notifications_sent: notify_customers,
        notification_results: notificationResults,
        message: `✅ ${updatedAppointments.length} cita(s) transferida(s) exitosamente`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error en transfer-appointments:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        transferred_count: 0,
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









