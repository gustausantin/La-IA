// ============================================
// Edge Function: get-snapshot
// Propósito: Analizar estado del negocio y devolver escenario crítico actual
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
    const { business_id, timestamp } = await req.json();
    
    if (!business_id) {
      throw new Error("business_id es requerido");
    }

    const currentTimestamp = timestamp || new Date().toISOString();

    console.log(`📊 Analizando snapshot para business ${business_id} en ${currentTimestamp}`);

    // 3. Obtener datos del negocio
    const { data: business, error: businessError } = await supabaseClient
      .from("businesses")
      .select("name, settings, vertical_type")
      .eq("id", business_id)
      .single();

    if (businessError || !business) {
      throw new Error("Negocio no encontrado");
    }

    // ============================================
    // PRIORIDAD 1: CRISIS DE PERSONAL
    // ============================================
    console.log("🔍 Verificando crisis de personal...");
    
    const { data: employeeConflicts, error: conflictError } = await supabaseClient
      .rpc("detect_employee_absences_with_appointments", {
        p_business_id: business_id,
        p_timestamp: currentTimestamp,
      });

    if (!conflictError && employeeConflicts && employeeConflicts.length > 0) {
      console.log(`🚨 CRISIS DETECTADA: ${employeeConflicts.length} empleado(s) ausente(s) con citas`);
      return buildCrisisPersonalScenario(employeeConflicts[0], business, corsHeaders);
    }

    // ============================================
    // PRIORIDAD 2: RIESGO DE NO-SHOW
    // ============================================
    console.log("🔍 Verificando riesgo de no-show...");
    
    const { data: highRiskAppts, error: riskError } = await supabaseClient
      .rpc("get_high_risk_appointments", {
        p_business_id: business_id,
        p_timestamp: currentTimestamp,
        p_risk_threshold: 60,
      });

    if (!riskError && highRiskAppts && highRiskAppts.length > 0) {
      console.log(`⚠️ RIESGO DETECTADO: ${highRiskAppts.length} cita(s) con alto riesgo`);
      return buildRiesgoNoShowScenario(highRiskAppts[0], business, corsHeaders);
    }

    // ============================================
    // PRIORIDAD 3: HUECO MUERTO
    // ============================================
    console.log("🔍 Verificando huecos libres...");
    
    const { data: freeSlots, error: slotsError } = await supabaseClient
      .rpc("get_upcoming_free_slots", {
        p_business_id: business_id,
        p_timestamp: currentTimestamp,
        p_hours_ahead: 2,
      });

    if (!slotsError && freeSlots && freeSlots.length > 0) {
      console.log(`💰 OPORTUNIDAD: ${freeSlots.length} hueco(s) libre(s) próximos`);
      return buildHuecoMuertoScenario(freeSlots[0], business, corsHeaders);
    }

    // ============================================
    // PRIORIDAD 4: PALMADA EN LA ESPALDA
    // ============================================
    console.log("👏 Todo bien, generando palmada en la espalda...");
    return buildPalmadaEspaldaScenario(business_id, currentTimestamp, business, supabaseClient, corsHeaders);

  } catch (error) {
    console.error("❌ Error en get-snapshot:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        scenario: "ERROR",
        priority: "LOW",
        lua_message: "Hubo un error al analizar el estado. Intenta refrescar.",
        actions: []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// ============================================
// ESCENARIO 1: CRISIS DE PERSONAL
// ============================================
function buildCrisisPersonalScenario(conflict: any, business: any, corsHeaders: any) {
  const affectedAppts = conflict.affected_appointments || [];
  const alternatives = conflict.alternative_employees || [];
  
  const message = `🚨 Alerta Roja: ${conflict.employee_name} no viene hoy y tiene ${conflict.affected_count} cita(s) asignada(s).${
    alternatives.length > 0 
      ? ` ${alternatives[0].name} está libre en esos horarios.`
      : " No hay empleados alternativos disponibles."
  }`;

  const actions = [];

  // Acción 1: Transferir citas (si hay alternativas)
  if (alternatives.length > 0) {
    actions.push({
      id: "transfer_appointments",
      label: `🔀 Mover citas a ${alternatives[0].name} y avisar`,
      endpoint: "/functions/v1/transfer-appointments",
      type: "destructive",
      payload: {
        business_id: business.id,
        from_employee_id: conflict.employee_id,
        from_employee_name: conflict.employee_name,
        to_employee_id: alternatives[0].id,
        to_employee_name: alternatives[0].name,
        to_resource_id: alternatives[0].assigned_resource_id,
        appointment_ids: affectedAppts.map((a: any) => a.id),
        notify_customers: true,
      },
    });
  }

  // Acción 2: Cancelar citas
  actions.push({
    id: "cancel_appointments_batch",
    label: "🚫 Cancelar y pedir reagendar",
    endpoint: "/functions/v1/cancel-appointments-batch",
    type: "destructive",
    payload: {
      business_id: business.id,
      appointment_ids: affectedAppts.map((a: any) => a.id),
      cancellation_reason: `${conflict.employee_name} no está disponible`,
      send_reschedule_message: true,
    },
  });

  return new Response(
    JSON.stringify({
      scenario: "CRISIS_PERSONAL",
      priority: "CRITICAL",
      lua_message: message,
      data: {
        employee: {
          id: conflict.employee_id,
          name: conflict.employee_name,
          avatar_url: conflict.employee_avatar_url,
          absence_type: conflict.absence_type,
          absence_reason: conflict.absence_reason,
        },
        affected_appointments: affectedAppts,
        alternatives: alternatives,
      },
      actions: actions,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================
// ESCENARIO 2: RIESGO DE NO-SHOW
// ============================================
function buildRiesgoNoShowScenario(appt: any, business: any, corsHeaders: any) {
  const hoursUntil = Math.floor(appt.hours_until_appointment);
  
  const message = `⚠️ Ojo con las ${appt.appointment_time.substring(0, 5)}. Viene ${appt.customer_name} (${appt.no_show_count > 0 ? `tiene historial de plantones` : `riesgo detectado`}) y no ha confirmado. ¿Quieres asegurar el tiro?`;

  const actions = [
    {
      id: "call_customer",
      label: "📞 Llamar ahora",
      endpoint: null,
      type: "safe",
      payload: {
        phone: appt.customer_phone,
        action: "call",
      },
    },
    {
      id: "whatsapp_customer",
      label: "💬 Enviar WhatsApp manual",
      endpoint: null,
      type: "safe",
      payload: {
        phone: appt.customer_phone,
        message: `Hola ${appt.customer_name}, ¿sigues viniendo a tu cita de las ${appt.appointment_time.substring(0, 5)}? Tengo lista de espera.`,
        action: "whatsapp",
      },
    },
  ];

  return new Response(
    JSON.stringify({
      scenario: "RIESGO_NOSHOW",
      priority: "HIGH",
      lua_message: message,
      data: {
        appointment: {
          id: appt.appointment_id,
          customer_name: appt.customer_name,
          customer_phone: appt.customer_phone,
          customer_email: appt.customer_email,
          date: appt.appointment_date,
          time: appt.appointment_time,
          service_name: appt.service_name,
          employee_name: appt.employee_name,
          risk_score: appt.risk_score,
          risk_level: appt.risk_level,
          no_show_count: appt.no_show_count,
          days_since_last_visit: appt.days_since_last_visit,
          hours_until: hoursUntil,
        },
      },
      actions: actions,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================
// ESCENARIO 3: HUECO MUERTO
// ============================================
function buildHuecoMuertoScenario(slot: any, business: any, corsHeaders: any) {
  const timeStr = slot.start_time.substring(0, 5);
  const minutesUntil = slot.minutes_until_slot;
  
  const message = `💰 Se ha quedado libre el hueco de las ${timeStr} (en ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}min). Es dinero perdido. ¿Quieres que te redacte una oferta para tus Estados de WhatsApp?`;

  const potentialServices = slot.potential_services || [];
  const defaultService = potentialServices[0] || { name: "Servicio", duration_minutes: 60 };

  const actions = [
    {
      id: "generate_flash_offer",
      label: "✨ Generar Texto Oferta (15% dto)",
      endpoint: "/functions/v1/generate-flash-offer-text",
      type: "safe",
      payload: {
        business_id: business.id,
        slot_time: timeStr,
        service_name: defaultService.name,
        discount_percent: 15,
        vertical_type: business.vertical_type || "salon",
      },
    },
  ];

  return new Response(
    JSON.stringify({
      scenario: "HUECO_MUERTO",
      priority: "MEDIUM",
      lua_message: message,
      data: {
        slot: {
          id: slot.slot_id,
          date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          employee_name: slot.employee_name,
          resource_name: slot.resource_name,
          minutes_until: minutesUntil,
          potential_services: potentialServices,
        },
      },
      actions: actions,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ============================================
// ESCENARIO 4: PALMADA EN LA ESPALDA
// ============================================
async function buildPalmadaEspaldaScenario(
  businessId: string, 
  timestamp: string, 
  business: any, 
  supabaseClient: any, 
  corsHeaders: any
) {
  // Obtener métricas del día
  const today = new Date(timestamp).toISOString().split("T")[0];
  
  // Citas de hoy
  const { data: todayAppts } = await supabaseClient
    .from("appointments")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("appointment_date", today);

  const completedCount = todayAppts?.filter((a: any) => a.status === "completed").length || 0;
  const totalCount = todayAppts?.length || 0;

  // Caja aproximada (si existe campo price en appointments o services)
  // Por simplicidad, usamos un valor estimado
  const estimatedRevenue = completedCount * 50; // €50 promedio por servicio

  // Determinar tono según contexto
  const currentHour = new Date(timestamp).getHours();
  let message = "";

  // Si es temprano y no hay caja, tono realista
  if (currentHour < 14 && estimatedRevenue === 0) {
    message = "🌅 Mañana tranquila de momento. ¿Movemos las redes para activar reservas?";
  }
  // Si es tarde y caja baja, tono empático
  else if (currentHour >= 16 && estimatedRevenue < 200) {
    message = `💼 Día tranquilo. Llevas ${estimatedRevenue}€. Mañana es otro día.`;
  }
  // Si va bien, palmada real
  else if (estimatedRevenue > 300 || completedCount > 8) {
    message = `👏 La maquinaria está perfecta. Llevas ${estimatedRevenue}€ hoy y cero retrasos. ${totalCount > completedCount ? `Tu próxima rotación pronto.` : `¡Gran día!`}`;
  }
  // Default neutro
  else {
    message = `✨ Todo fluye bien. Llevas ${estimatedRevenue}€ y ${completedCount} cita(s) completada(s).`;
  }

  const actions = [
    {
      id: "view_tomorrow",
      label: "📅 Ver agenda de mañana",
      endpoint: null,
      type: "safe",
      payload: {
        route: "/reservas?date=tomorrow",
      },
    },
    {
      id: "view_revenue_breakdown",
      label: "💰 Ver desglose de caja",
      endpoint: null,
      type: "safe",
      payload: {
        route: "/reportes?view=revenue",
      },
    },
  ];

  return new Response(
    JSON.stringify({
      scenario: "PALMADA_ESPALDA",
      priority: "LOW",
      lua_message: message,
      data: {
        stats: {
          today_appointments: totalCount,
          completed_appointments: completedCount,
          estimated_revenue: estimatedRevenue,
          current_hour: currentHour,
        },
      },
      actions: actions,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

