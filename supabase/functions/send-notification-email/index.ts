// ========================================
// SUPABASE EDGE FUNCTION: send-notification-email
// Envía notificaciones por email cuando hay eventos en reservas
// ========================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SMTP_CONFIG = {
  host: 'smtp.hostinger.com',
  port: 465,
  user: Deno.env.get('SMTP_USER') || 'noreply@la-ia.site',
  password: Deno.env.get('SMTP_PASSWORD'),
};

// Helper para enviar email usando SMTP
async function sendEmail(options: any) {
  const { from, replyTo, to, subject, html } = options;
  
  // Usar librería SMTP para Deno
  // Por ahora usamos fetch a un servicio SMTP-to-HTTP
  // En producción, puedes usar: https://deno.land/x/smtp
  
  // ALTERNATIVA: Llamar a un endpoint de tu server.js que tenga nodemailer
  const response = await fetch('https://la-ia-app.vercel.app/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      from,
      replyTo,
      to,
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }
  
  return await response.json();
}

// Helper para formatear fecha
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('es-ES', options);
}

// Helper para verificar horario silencioso
function isQuietHours(quietHours: any): boolean {
  if (!quietHours || !quietHours.enabled) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const [startHour, startMinute] = (quietHours.start || '23:00').split(':').map(Number);
  const [endHour, endMinute] = (quietHours.end || '09:00').split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  
  return currentTime >= startTime && currentTime < endTime;
}

// Template procesador simple
function processTemplate(template: string, variables: Record<string, any>): string {
  let html = template;
  
  // Reemplazar variables: {{ Variable }} → valor
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{ ?${key} ?}}`, 'g');
    html = html.replace(regex, variables[key] || '');
  });
  
  // Manejar condicionales: {{ if Variable }} ... {{ endif }}
  html = html.replace(/{{ ?if (\w+) ?}}([\s\S]*?){{ ?endif ?}}/g, (match, variable, content) => {
    return variables[variable] ? content : '';
  });
  
  return html;
}

// Templates inline (los mismos que creamos)
const NEW_RESERVATION_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nueva Reserva</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#7c3aed;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">🍽️ Nueva Reserva</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">{{ RestaurantName }}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>{{ ContactName }}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">Se ha confirmado una nueva reserva en tu restaurante. Aquí están los detalles:</p>
<div style="background-color:#f9fafb;border-left:4px solid #7c3aed;padding:25px;border-radius:8px;margin-bottom:30px;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👤 Cliente</span><span style="color:#111827;font-size:18px;font-weight:600;">{{ CustomerName }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📧 Email</span><span style="color:#111827;font-size:16px;">{{ CustomerEmail }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📱 Teléfono</span><span style="color:#111827;font-size:16px;">{{ CustomerPhone }}</span></div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📅 Fecha</span><span style="color:#111827;font-size:18px;font-weight:600;">{{ ReservationDate }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">🕐 Hora</span><span style="color:#111827;font-size:18px;font-weight:600;">{{ ReservationTime }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👥 Comensales</span><span style="color:#111827;font-size:18px;font-weight:600;">{{ PartySize }} personas</span></div>
{{ if SpecialRequests }}<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><div><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">💬 Peticiones especiales</span><span style="color:#111827;font-size:16px;font-style:italic;">{{ SpecialRequests }}</span></div>{{ endif }}
</div>
<div style="text-align:center;margin:35px 0;">
<a href="{{ AppURL }}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 6px rgba(124,58,237,0.3);">Ver detalles en la app</a>
</div>
<div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:8px;margin-top:30px;">
<p style="margin:0;font-size:14px;color:#1e40af;line-height:1.5;"><strong>💡 Consejo:</strong> Puedes gestionar esta reserva directamente desde la aplicación.</p>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;text-align:center;">Este email fue enviado por <strong style="color:#7c3aed;">La-IA</strong> - Sistema de reservas inteligente</p>
<p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;"><a href="https://la-ia-app.vercel.app" style="color:#7c3aed;text-decoration:none;">www.la-ia.site</a> | <a href="https://la-ia-app.vercel.app/configuracion" style="color:#7c3aed;text-decoration:none;">Configurar notificaciones</a></p>
</div>
</div>
</body>
</html>`;

const CANCELLED_RESERVATION_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reserva Cancelada</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#ef4444;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">❌ Reserva Cancelada</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">{{ RestaurantName }}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>{{ ContactName }}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">Se ha <strong style="color:#ef4444;">cancelado una reserva</strong> en tu restaurante.</p>
<div style="background-color:#fef2f2;border-left:4px solid #ef4444;padding:25px;border-radius:8px;margin-bottom:30px;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👤 Cliente</span><span style="color:#111827;font-size:18px;font-weight:600;">{{ CustomerName }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📅 Fecha cancelada</span><span style="color:#111827;font-size:18px;font-weight:600;text-decoration:line-through;opacity:0.6;">{{ ReservationDate }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">🕐 Hora cancelada</span><span style="color:#111827;font-size:18px;font-weight:600;text-decoration:line-through;opacity:0.6;">{{ ReservationTime }}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👥 Comensales</span><span style="color:#111827;font-size:18px;font-weight:600;text-decoration:line-through;opacity:0.6;">{{ PartySize }} personas</span></div>
{{ if CancellationReason }}<hr style="border:none;border-top:1px solid #fee2e2;margin:20px 0;"><div><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📝 Motivo</span><span style="color:#991b1b;font-size:16px;font-style:italic;">{{ CancellationReason }}</span></div>{{ endif }}
</div>
<div style="text-align:center;margin:35px 0;">
<a href="{{ AppURL }}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Ver en la app</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;text-align:center;">Este email fue enviado por <strong style="color:#7c3aed;">La-IA</strong></p>
</div>
</div>
</body>
</html>`;

serve(async (req) => {
  try {
    // Solo aceptar POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { event, reservation_id, restaurant_id } = await req.json();

    console.log('📧 Procesando evento de notificación:', { event, reservation_id, restaurant_id });

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener datos de la reserva
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        restaurant:restaurants(
          id,
          name,
          email,
          settings
        )
      `)
      .eq('id', reservation_id)
      .single();

    if (reservationError || !reservation) {
      throw new Error(`No se pudo obtener la reserva: ${reservationError?.message}`);
    }

    const restaurant = reservation.restaurant;
    const settings = restaurant.settings || {};

    // 2. Verificar si las notificaciones están habilitadas
    const notificationSettings = settings.notifications || {};
    let notifConfig;
    
    if (event === 'new_reservation') {
      notifConfig = notificationSettings.new_reservation || {};
    } else if (event === 'cancelled_reservation') {
      notifConfig = notificationSettings.cancelled_reservation || {};
    }

    if (!notifConfig?.enabled) {
      console.log('⏭️ Notificaciones deshabilitadas para este evento');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Verificar horario silencioso
    if (isQuietHours(notificationSettings.quiet_hours)) {
      console.log('🔕 Horario silencioso activo');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'quiet_hours' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Obtener emails destino
    const notificationEmails = settings.notification_emails || [restaurant.email];

    if (!notificationEmails || notificationEmails.length === 0) {
      throw new Error('No hay emails configurados para notificaciones');
    }

    // 5. Preparar variables del template
    const variables = {
      RestaurantName: restaurant.name,
      ContactName: settings.contact_name || 'Equipo',
      CustomerName: reservation.customer_name,
      CustomerEmail: reservation.customer_email,
      CustomerPhone: reservation.customer_phone || 'No proporcionado',
      ReservationDate: formatDate(reservation.reservation_date),
      ReservationTime: reservation.reservation_time,
      PartySize: reservation.party_size,
      SpecialRequests: reservation.special_requests || '',
      CancellationReason: reservation.cancellation_reason || '',
      CancellationDate: new Date().toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${reservation.id}`,
    };

    // 6. Generar HTML del email
    const template = event === 'new_reservation' ? NEW_RESERVATION_TEMPLATE : CANCELLED_RESERVATION_TEMPLATE;
    const html = processTemplate(template, variables);

    // 7. Enviar email
    const subject = event === 'new_reservation' 
      ? `🍽️ Nueva reserva - ${reservation.customer_name}`
      : `❌ Reserva cancelada - ${reservation.customer_name}`;

    const result = await sendEmail({
      from: `La-IA - ${restaurant.name} <noreply@la-ia.site>`,
      replyTo: restaurant.email,
      to: notificationEmails,
      subject,
      html,
    });

    console.log('✅ Email enviado correctamente');

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

