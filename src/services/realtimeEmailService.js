// ========================================
// REALTIME EMAIL SERVICE
// Escucha cambios en reservations y envía emails automáticamente
// ========================================

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { format, parseISO } from 'date-fns';
import esLocale from 'date-fns/locale/es/index.js';

// Cliente de Supabase con Service Role (bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurar transporter SMTP
const createTransporter = () => {
  const smtpUser = process.env.SMTP_USER || 'noreply@la-ia.site';
  const smtpPass = process.env.SMTP_PASSWORD;
  
  console.log('🔑 Configuración SMTP:');
  console.log('  Usuario:', smtpUser);
  console.log('  Password:', smtpPass ? `${smtpPass.substring(0, 3)}***` : '❌ NO CONFIGURADA');
  
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

// Formatear fecha en español
const formatDate = (dateString) => {
  try {
    const date = parseISO(dateString);
    return format(date, "EEEE d 'de' MMMM, yyyy", { locale: esLocale });
  } catch (error) {
    return dateString;
  }
};

// Verificar horario silencioso
const isQuietHours = (quietHours) => {
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
};

// Template de nueva reserva
const getNewReservationEmailHTML = (variables) => {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#7c3aed;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">🍽️ Nueva Reserva</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">${variables.BusinessName}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>${variables.ContactName}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">Se ha confirmado una nueva reserva en tu negocio:</p>
<div style="background-color:#f9fafb;border-left:4px solid #7c3aed;padding:25px;border-radius:8px;margin-bottom:30px;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👤 Cliente</span><span style="color:#111827;font-size:18px;font-weight:600;">${variables.CustomerName}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📧 Email</span><span style="color:#111827;font-size:16px;">${variables.CustomerEmail}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📱 Teléfono</span><span style="color:#111827;font-size:16px;">${variables.CustomerPhone}</span></div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📅 Fecha</span><span style="color:#111827;font-size:18px;font-weight:600;">${variables.ReservationDate}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">🕐 Hora</span><span style="color:#111827;font-size:18px;font-weight:600;">${variables.ReservationTime}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👥 Comensales</span><span style="color:#111827;font-size:18px;font-weight:600;">${variables.PartySize} personas</span></div>
${variables.SpecialRequests ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><div><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">💬 Peticiones especiales</span><span style="color:#111827;font-size:16px;font-style:italic;">${variables.SpecialRequests}</span></div>` : ''}
</div>
<div style="text-align:center;margin:35px 0;">
<a href="${variables.AppURL}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Ver detalles en la app</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Enviado por <strong style="color:#7c3aed;">La-IA</strong> - Sistema de reservas inteligente</p>
</div>
</div>
</body>
</html>`;
};

// Template de reserva modificada
const getModifiedReservationEmailHTML = (variables, changes) => {
  const changesHTML = Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => {
    const fieldNames = {
      reservation_date: '📅 Fecha',
      reservation_time: '🕐 Hora',
      party_size: '👥 Comensales',
      special_requests: '📝 Peticiones especiales',
    };
    return `<div style="margin-bottom:15px;">
      <span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">${fieldNames[field] || field}</span>
      <span style="color:#991b1b;font-size:16px;text-decoration:line-through;opacity:0.6;">${oldVal}</span>
      <span style="color:#059669;font-size:18px;font-weight:600;margin-left:10px;">→ ${newVal}</span>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#f59e0b;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">📝 Reserva Modificada</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">${variables.BusinessName}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>${variables.ContactName}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">Se ha <strong style="color:#f59e0b;">modificado una reserva</strong> en tu negocio:</p>
<div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:25px;border-radius:8px;margin-bottom:20px;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👤 Cliente</span><span style="color:#111827;font-size:18px;font-weight:600;">${variables.CustomerName}</span></div>
</div>
<div style="background-color:#f0fdf4;border-left:4px solid #059669;padding:25px;border-radius:8px;margin-bottom:30px;">
<h3 style="margin:0 0 15px 0;color:#065f46;font-size:16px;">Cambios realizados:</h3>
${changesHTML}
</div>
<div style="text-align:center;margin:35px 0;">
<a href="${variables.AppURL}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Ver en la app</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Enviado por <strong style="color:#7c3aed;">La-IA</strong></p>
</div>
</div>
</body>
</html>`;
};

// Template de reserva cancelada
const getCancelledReservationEmailHTML = (variables) => {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#ef4444;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">❌ Reserva Cancelada</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">${variables.BusinessName}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>${variables.ContactName}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">Se ha <strong style="color:#ef4444;">cancelado una reserva</strong> en tu negocio:</p>
<div style="background-color:#fef2f2;border-left:4px solid #ef4444;padding:25px;border-radius:8px;margin-bottom:30px;">
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👤 Cliente</span><span style="color:#111827;font-size:18px;font-weight:600;">${variables.CustomerName}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📅 Fecha</span><span style="color:#111827;font-size:18px;font-weight:600;text-decoration:line-through;opacity:0.6;">${variables.ReservationDate}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">🕐 Hora</span><span style="color:#111827;font-size:18px;font-weight:600;text-decoration:line-through;opacity:0.6;">${variables.ReservationTime}</span></div>
<div style="margin-bottom:15px;"><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">👥 Comensales</span><span style="color:#111827;font-size:18px;font-weight:600;text-decoration:line-through;opacity:0.6;">${variables.PartySize} personas</span></div>
${variables.CancellationReason ? `<hr style="border:none;border-top:1px solid #fee2e2;margin:20px 0;"><div><span style="color:#6b7280;font-size:14px;display:block;margin-bottom:4px;">📝 Motivo</span><span style="color:#991b1b;font-size:16px;font-style:italic;">${variables.CancellationReason}</span></div>` : ''}
</div>
<div style="text-align:center;margin:35px 0;">
<a href="${variables.AppURL}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Ver en la app</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Enviado por <strong style="color:#7c3aed;">La-IA</strong></p>
</div>
</div>
</body>
</html>`;
};

// Enviar email de nueva reserva
export const sendNewReservationEmail = async (reservation, business) => {
  try {
    console.log('📧 Enviando email de nueva reserva:', reservation.id);
    
    const settings = business.settings || {};
    const notificationSettings = settings.notifications || {};
    const reservationNotif = notificationSettings.new_reservation || {};
    
    // Verificar si está habilitado
    if (reservationNotif.enabled === false) {
      console.log('⏭️ Notificaciones de nueva reserva deshabilitadas');
      return { success: true, skipped: true, reason: 'disabled' };
    }
    
    // Verificar horario silencioso
    if (isQuietHours(notificationSettings.quiet_hours)) {
      console.log('🔕 Horario silencioso activo');
      return { success: true, skipped: true, reason: 'quiet_hours' };
    }
    
    // Obtener emails destino
    const notificationEmails = settings.notification_emails || [business.email];
    
    if (!notificationEmails || notificationEmails.length === 0) {
      console.warn('⚠️ No hay emails configurados');
      return { success: false, error: 'No notification emails' };
    }
    
    // Preparar variables
    const variables = {
      BusinessName: business.name,
      ContactName: settings.contact_name || 'Equipo',
      CustomerName: reservation.customer_name,
      CustomerEmail: reservation.customer_email,
      CustomerPhone: reservation.customer_phone || 'No proporcionado',
      ReservationDate: formatDate(reservation.reservation_date),
      ReservationTime: reservation.reservation_time,
      PartySize: reservation.party_size,
      SpecialRequests: reservation.special_requests || '',
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${reservation.id}`,
    };
    
    // Generar HTML
    const html = getNewReservationEmailHTML(variables);
    
    // Enviar
    const transporter = createTransporter();
    
    console.log('📬 Enviando email a:', notificationEmails);
    
    const info = await transporter.sendMail({
      from: `La-IA - ${business.name} <noreply@la-ia.site>`,
      replyTo: business.email,
      to: notificationEmails,
      subject: `🍽️ Nueva reserva - ${reservation.customer_name}`,
      html,
    });
    
    console.log('✅ Email enviado:', info.messageId);
    console.log('✅ Aceptado por:', info.accepted);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

// Función helper para limpiar mensajes automáticos de special_requests
const cleanAutomaticMessages = (text) => {
  if (!text) return '';
  return text
    .replace(/\n\n⚠️ GRUPO GRANDE.*?REQUIERE APROBACIÓN\./s, '')
    .replace(/\n\n📋 Mesas combinadas:.*?personas\./s, '')
    .trim();
};

// Enviar email de reserva modificada
export const sendModifiedReservationEmail = async (newReservation, oldReservation, business) => {
  try {
    console.log('📧 Enviando email de modificación:', newReservation.id);
    
    const settings = business.settings || {};
    const notificationSettings = settings.notifications || {};
    const modifiedNotif = notificationSettings.modified_reservation || { enabled: true };
    
    if (modifiedNotif.enabled === false) {
      console.log('⏭️ Notificaciones de modificación deshabilitadas');
      return { success: true, skipped: true, reason: 'disabled' };
    }
    
    if (isQuietHours(notificationSettings.quiet_hours)) {
      console.log('🔕 Horario silencioso activo');
      return { success: true, skipped: true, reason: 'quiet_hours' };
    }
    
    // Detectar cambios (limpiando mensajes automáticos de special_requests)
    const changes = {};
    const fieldsToCheck = ['reservation_date', 'reservation_time', 'party_size', 'special_requests'];
    
    fieldsToCheck.forEach(field => {
      let oldValue = oldReservation[field];
      let newValue = newReservation[field];
      
      // 🔥 Limpiar mensajes automáticos de special_requests antes de comparar
      if (field === 'special_requests') {
        oldValue = cleanAutomaticMessages(oldValue);
        newValue = cleanAutomaticMessages(newValue);
      }
      
      // Registrar cambio si los valores son diferentes (incluso si uno es null/undefined)
      // Convertir a string para comparación
      const oldStr = String(oldValue || '');
      const newStr = String(newValue || '');
      
      if (oldStr !== newStr && newValue !== undefined && newValue !== null) {
        let oldVal = oldValue || 'No especificado';
        let newVal = newValue;
        
        if (field === 'reservation_date' && newValue) {
          if (oldValue) oldVal = formatDate(oldValue);
          newVal = formatDate(newValue);
        }
        if (field === 'party_size') {
          if (oldValue) oldVal = `${oldValue} personas`;
          newVal = `${newValue} personas`;
        }
        
        changes[field] = { old: oldVal, new: newVal };
      }
    });
    
    // Si no hay cambios relevantes, no enviar
    if (Object.keys(changes).length === 0) {
      console.log('⏭️ No hay cambios relevantes');
      return { success: true, skipped: true, reason: 'no_changes' };
    }
    
    const notificationEmails = settings.notification_emails || [business.email];
    
    if (!notificationEmails || notificationEmails.length === 0) {
      console.warn('⚠️ No hay emails configurados');
      return { success: false, error: 'No notification emails' };
    }
    
    const variables = {
      BusinessName: business.name,
      ContactName: settings.contact_name || 'Equipo',
      CustomerName: newReservation.customer_name,
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${newReservation.id}`,
    };
    
    const html = getModifiedReservationEmailHTML(variables, changes);
    
    const transporter = createTransporter();
    
    console.log('📬 Enviando email a:', notificationEmails);
    
    const info = await transporter.sendMail({
      from: `La-IA - ${business.name} <noreply@la-ia.site>`,
      replyTo: business.email,
      to: notificationEmails,
      subject: `📝 Reserva modificada - ${newReservation.customer_name}`,
      html,
    });
    
    console.log('✅ Email de modificación enviado:', info.messageId);
    console.log('✅ Aceptado por:', info.accepted);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando email de modificación:', error);
    return { success: false, error: error.message };
  }
};

// Enviar email de reserva cancelada
export const sendCancelledReservationEmail = async (reservation, business) => {
  try {
    console.log('📧 Enviando email de cancelación:', reservation.id);
    
    const settings = business.settings || {};
    const notificationSettings = settings.notifications || {};
    const cancelledNotif = notificationSettings.cancelled_reservation || {};
    
    if (cancelledNotif.enabled === false) {
      console.log('⏭️ Notificaciones de cancelación deshabilitadas');
      return { success: true, skipped: true, reason: 'disabled' };
    }
    
    if (isQuietHours(notificationSettings.quiet_hours)) {
      console.log('🔕 Horario silencioso activo');
      return { success: true, skipped: true, reason: 'quiet_hours' };
    }
    
    const notificationEmails = settings.notification_emails || [business.email];
    
    if (!notificationEmails || notificationEmails.length === 0) {
      console.warn('⚠️ No hay emails configurados');
      return { success: false, error: 'No notification emails' };
    }
    
    const variables = {
      BusinessName: business.name,
      ContactName: settings.contact_name || 'Equipo',
      CustomerName: reservation.customer_name,
      CustomerEmail: reservation.customer_email,
      CustomerPhone: reservation.customer_phone || 'No proporcionado',
      ReservationDate: formatDate(reservation.reservation_date),
      ReservationTime: reservation.reservation_time,
      PartySize: reservation.party_size,
      CancellationReason: reservation.cancellation_reason || '',
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${reservation.id}`,
    };
    
    const html = getCancelledReservationEmailHTML(variables);
    
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `La-IA - ${business.name} <noreply@la-ia.site>`,
      replyTo: business.email,
      to: notificationEmails,
      subject: `❌ Reserva cancelada - ${reservation.customer_name}`,
      html,
    });
    
    console.log('✅ Email de cancelación enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando email de cancelación:', error);
    return { success: false, error: error.message };
  }
};

// 🆕 Enviar email de GRUPO GRANDE (pending_approval)
const sendPendingApprovalEmail = async (reservation, business) => {
  try {
    console.log('📧 Preparando email de grupo grande para:', business.email);
    
    // Obtener mesas de la reserva
    const { data: reservationTables } = await supabase
      .from('reservation_tables')
      .select(`
        table_id,
        tables (
          id,
          table_number,
          name,
          capacity,
          zone
        )
      `)
      .eq('reservation_id', reservation.id);
    
    // Construir lista de mesas
    let tablesList = '';
    let totalCapacity = 0;
    let zone = '';
    
    if (reservationTables && reservationTables.length > 0) {
      zone = reservationTables[0].tables.zone || 'Principal';
      reservationTables.forEach(rt => {
        const tableName = rt.tables.name || `Mesa ${rt.tables.table_number}`;
        const capacity = rt.tables.capacity || 0;
        tablesList += `<li>🪑 ${tableName} (${capacity} personas)</li>`;
        totalCapacity += capacity;
      });
    }
    
    // Verificar horario silencioso
    const quietHours = business.settings?.notifications?.quiet_hours;
    if (isQuietHours(quietHours)) {
      console.log('🔕 Horario silencioso activo, no se envía email');
      return { success: false, reason: 'quiet_hours' };
    }
    
    // Obtener emails de notificación
    const notificationEmails = business.settings?.notifications?.email_recipients || [business.email];
    
    // Leer template HTML
    const fs = await import('fs/promises');
    const path = await import('path');
    const templatePath = path.join(process.cwd(), 'email-templates', 'pending_approval_notification.html');
    let html = await fs.readFile(templatePath, 'utf-8');
    
    // Reemplazar variables
    const variables = {
      BusinessName: business.name,
      ContactName: business.contact_name || 'Equipo',
      CustomerName: reservation.customer_name,
      CustomerPhone: reservation.customer_phone,
      CustomerEmail: reservation.customer_email || '',
      ReservationDate: formatDate(reservation.reservation_date),
      ReservationTime: reservation.reservation_time,
      PartySize: reservation.party_size,
      Zone: zone,
      TablesList: tablesList,
      TotalCapacity: totalCapacity,
      SpecialRequests: reservation.special_requests || '',
      ApproveURL: `https://la-ia-app.vercel.app/reservas?action=approve&id=${reservation.id}`,
      RejectURL: `https://la-ia-app.vercel.app/reservas?action=reject&id=${reservation.id}`,
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${reservation.id}`,
    };
    
    // Reemplazar todas las variables en el HTML
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, variables[key]);
    });
    
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `La-IA - ${business.name} <noreply@la-ia.site>`,
      replyTo: business.email,
      to: notificationEmails,
      subject: `⚠️ GRUPO GRANDE - Requiere tu Aprobación - ${reservation.customer_name}`,
      html,
    });
    
    console.log('✅ Email de grupo grande enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando email de grupo grande:', error);
    return { success: false, error: error.message };
  }
};

// 🔥 NOTA: Los mensajes de aprobación/rechazo al CLIENTE se envían por WhatsApp desde N8n
// Los templates están en la tabla message_templates de Supabase
// N8n se encarga de:
// 1. Detectar cambios de estado (pending_approval → pending o cancelled)
// 2. Obtener el template correspondiente de message_templates
// 3. Reemplazar variables
// 4. Enviar WhatsApp al cliente

// Cache de reservas para detectar cambios (cuando payload.old no funciona)
const reservationsCache = new Map();

// Iniciar listener de Realtime
export const startRealtimeEmailListener = () => {
  console.log('🎧 Iniciando listener de notificaciones por email...');
  
  const channel = supabase
    .channel('reservation-notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments',
      },
      async (payload) => {
        console.log('🆕 Nueva reserva detectada:', payload.new.id);
        
        // Guardar en cache para futuras comparaciones (INCLUIR STATUS)
        reservationsCache.set(payload.new.id, {
          status: payload.new.status,
          reservation_date: payload.new.reservation_date,
          reservation_time: payload.new.reservation_time,
          party_size: payload.new.party_size,
          special_requests: payload.new.special_requests,
        });
        
        try {
          // Obtener datos completos del negocio
          const { data: business } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', payload.new.business_id)
            .single();
          
          if (business) {
            // 🆕 Si es pending_approval (grupo grande), enviar email especial
            if (payload.new.status === 'pending_approval') {
              console.log('⚠️ Reserva de GRUPO GRANDE detectada, enviando email de aprobación...');
              await sendPendingApprovalEmail(payload.new, business);
            } else {
              // Email normal para reservas regulares
              await sendNewReservationEmail(payload.new, business);
            }
          }
        } catch (error) {
          console.error('Error procesando nueva reserva:', error);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'appointments',
      },
      async (payload) => {
        console.log('🔔 UPDATE detectado:', payload.new.id);
        
        try {
          const { data: business } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', payload.new.business_id)
            .single();
          
          if (!business) {
            console.log('⚠️ Negocio no encontrado');
            return;
          }
          
          // 🔥 OBTENER ESTADO ANTERIOR DEL CACHE O PAYLOAD.OLD
          const cachedOld = reservationsCache.get(payload.new.id);
          const oldStatus = payload.old?.status || cachedOld?.status;
          
          console.log('📊 Comparación de estados:', {
            oldStatus,
            newStatus: payload.new.status,
            fromCache: !payload.old?.status && cachedOld?.status
          });
          
          // 🆕 Aprobación: detectar cambio de pending_approval a pending
          if (oldStatus === 'pending_approval' && payload.new.status === 'pending') {
            console.log('✅ Reserva de grupo grande APROBADA:', payload.new.id);
            console.log('📱 N8n se encargará de enviar WhatsApp al cliente');
            // N8n detectará este cambio y enviará WhatsApp usando template 'aprobacion_grupo'
          }
          // Cancelación: detectar cambio a 'cancelled'
          else if (payload.new.status === 'cancelled' && oldStatus !== 'cancelled') {
            console.log('❌ Reserva cancelada detectada:', payload.new.id);
            // 🆕 Si venía de pending_approval, es un rechazo
            if (oldStatus === 'pending_approval') {
              console.log('❌ Reserva de grupo grande RECHAZADA:', payload.new.id);
              console.log('📱 N8n se encargará de enviar WhatsApp al cliente');
              // N8n detectará este cambio y enviará WhatsApp usando template 'rechazo_grupo'
            } else {
              await sendCancelledReservationEmail(payload.new, business);
            }
          }
          // Modificación (cambios en campos relevantes, pero NO cancelación)
          else if (payload.new.status !== 'cancelled') {
            console.log('📝 Posible modificación detectada:', payload.new.id);
            
            // Intentar obtener valores antiguos del cache o de payload.old
            const oldReservation = {
              reservation_date: payload.old?.reservation_date || cachedOld?.reservation_date,
              reservation_time: payload.old?.reservation_time || cachedOld?.reservation_time,
              party_size: payload.old?.party_size || cachedOld?.party_size,
              special_requests: payload.old?.special_requests || cachedOld?.special_requests,
            };
            
            console.log('  Valores antiguos (cache):', cachedOld);
            console.log('  Valores nuevos:', {
              date: payload.new.reservation_date,
              time: payload.new.reservation_time,
              size: payload.new.party_size,
              requests: payload.new.special_requests
            });
            
            await sendModifiedReservationEmail(payload.new, oldReservation, business);
          }
          
          // 🔥 ACTUALIZAR CACHE CON TODOS LOS VALORES (INCLUIR STATUS)
          reservationsCache.set(payload.new.id, {
            status: payload.new.status,
            reservation_date: payload.new.reservation_date,
            reservation_time: payload.new.reservation_time,
            party_size: payload.new.party_size,
            special_requests: payload.new.special_requests,
          });
        } catch (error) {
          console.error('Error procesando actualización de reserva:', error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Listener de notificaciones activo');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Error en canal de Realtime');
      }
    });
  
  return channel;
};


