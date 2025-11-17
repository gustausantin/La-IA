// ========================================
// EMAIL NOTIFICATION SERVICE
// Servicio para enviar notificaciones por email usando SMTP de Hostinger
// ========================================

import nodemailer from 'nodemailer';
import { supabase } from '../lib/supabase';
import { log } from '../utils/logger';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Configuración del transporter SMTP
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: process.env.SMTP_USER || 'noreply@la-ia.site',
      pass: process.env.SMTP_PASSWORD // Contraseña desde variables de entorno
    }
  });
};

/**
 * Carga un template HTML y reemplaza las variables
 */
const loadAndProcessTemplate = (templateName, variables) => {
  // En producción, cargarías el HTML desde archivos
  // Por ahora, lo definimos inline (más adelante puedes mover a archivos)
  const templates = {
    new_reservation: getNewReservationTemplate(),
    cancelled_reservation: getCancelledReservationTemplate()
  };
  
  let html = templates[templateName];
  
  if (!html) {
    throw new Error(`Template '${templateName}' no encontrado`);
  }
  
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
};

/**
 * Verifica si está en horario silencioso
 */
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
  
  // Si el horario silencioso cruza medianoche
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  
  return currentTime >= startTime && currentTime < endTime;
};

/**
 * Formatea una fecha legible en español
 */
const formatDate = (dateString) => {
  try {
    const date = parseISO(dateString);
    return format(date, "EEEE d 'de' MMMM, yyyy", { locale: es });
  } catch (error) {
    return dateString;
  }
};

/**
 * Envía notificación de nueva reserva
 */
export const sendNewReservationNotification = async (reservationId) => {
  try {
    log.info('📧 Enviando notificación de nueva reserva:', reservationId);
    
    // 1. Obtener datos de la reserva
    const { data: reservation, error: reservationError } = await supabase
      .from('appointments')
      .select(`
        *,
        business:businesses(
          id,
          name,
          email,
          settings
        )
      `)
      .eq('id', reservationId)
      .single();
    
    if (reservationError || !reservation) {
      throw new Error('No se pudo obtener la reserva: ' + reservationError?.message);
    }
    
    const business = reservation.business;
    const settings = business.settings || {};
    
    // 2. Verificar si las notificaciones están habilitadas
    const notificationSettings = settings.notifications || {};
    const reservationNotif = notificationSettings.new_reservation || {};
    
    if (!reservationNotif.enabled) {
      log.info('⏭️ Notificaciones de nueva reserva deshabilitadas para este negocio');
      return { success: true, skipped: true, reason: 'disabled' };
    }
    
    // 3. Verificar horario silencioso
    if (isQuietHours(notificationSettings.quiet_hours)) {
      log.info('🔕 Horario silencioso activo, email no enviado');
      return { success: true, skipped: true, reason: 'quiet_hours' };
    }
    
    // 4. Obtener emails destino
    const notificationEmails = settings.notification_emails || [business.email];
    
    if (!notificationEmails || notificationEmails.length === 0) {
      log.warn('⚠️ No hay emails configurados para notificaciones');
      return { success: false, error: 'No notification emails configured' };
    }
    
    // 5. Preparar variables del template
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
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${reservation.id}`
    };
    
    // 6. Generar HTML del email
    const html = loadAndProcessTemplate('new_reservation', variables);
    
    // 7. Enviar email
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `La-IA - ${business.name} <noreply@la-ia.site>`,
      replyTo: business.email,
      to: notificationEmails,
      subject: `🍽️ Nueva reserva - ${reservation.customer_name}`,
      html: html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    log.info('✅ Email enviado correctamente:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: notificationEmails
    };
    
  } catch (error) {
    log.error('❌ Error enviando notificación de nueva reserva:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Envía notificación de reserva cancelada
 */
export const sendCancelledReservationNotification = async (reservationId) => {
  try {
    log.info('📧 Enviando notificación de reserva cancelada:', reservationId);
    
    // 1. Obtener datos de la reserva
    const { data: reservation, error: reservationError } = await supabase
      .from('appointments')
      .select(`
        *,
        business:businesses(
          id,
          name,
          email,
          settings
        )
      `)
      .eq('id', reservationId)
      .single();
    
    if (reservationError || !reservation) {
      throw new Error('No se pudo obtener la reserva: ' + reservationError?.message);
    }
    
    const business = reservation.business;
    const settings = business.settings || {};
    
    // 2. Verificar si las notificaciones están habilitadas
    const notificationSettings = settings.notifications || {};
    const cancelledNotif = notificationSettings.cancelled_reservation || {};
    
    if (!cancelledNotif.enabled) {
      log.info('⏭️ Notificaciones de cancelación deshabilitadas para este negocio');
      return { success: true, skipped: true, reason: 'disabled' };
    }
    
    // 3. Verificar horario silencioso
    if (isQuietHours(notificationSettings.quiet_hours)) {
      log.info('🔕 Horario silencioso activo, email no enviado');
      return { success: true, skipped: true, reason: 'quiet_hours' };
    }
    
    // 4. Obtener emails destino
    const notificationEmails = settings.notification_emails || [business.email];
    
    if (!notificationEmails || notificationEmails.length === 0) {
      log.warn('⚠️ No hay emails configurados para notificaciones');
      return { success: false, error: 'No notification emails configured' };
    }
    
    // 5. Preparar variables del template
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
      CancellationDate: format(new Date(), "EEEE d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es }),
      AppURL: `https://la-ia-app.vercel.app/reservas?id=${reservation.id}`
    };
    
    // 6. Generar HTML del email
    const html = loadAndProcessTemplate('cancelled_reservation', variables);
    
    // 7. Enviar email
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `La-IA - ${business.name} <noreply@la-ia.site>`,
      replyTo: business.email,
      to: notificationEmails,
      subject: `❌ Reserva cancelada - ${reservation.customer_name}`,
      html: html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    log.info('✅ Email de cancelación enviado correctamente:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: notificationEmails
    };
    
  } catch (error) {
    log.error('❌ Error enviando notificación de cancelación:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ========================================
// TEMPLATES HTML (inline por ahora)
// ========================================

function getNewReservationTemplate() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva Reserva - La-IA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); overflow: hidden;">
        <div style="background-color: #7c3aed; padding: 30px 40px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🍽️ Nueva Reserva</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">{{ BusinessName }}</p>
        </div>
        <div style="padding: 40px;">
            <p style="font-size: 18px; color: #1a1a1a; margin: 0 0 25px 0;">
                Hola <strong>{{ ContactName }}</strong>,
            </p>
            <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 30px 0;">
                Se ha confirmado una nueva reserva en tu negocio. Aquí están los detalles:
            </p>
            <div style="background-color: #f9fafb; border-left: 4px solid #7c3aed; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">👤 Cliente</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600;">{{ CustomerName }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📧 Email</span>
                    <span style="color: #111827; font-size: 16px;">{{ CustomerEmail }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📱 Teléfono</span>
                    <span style="color: #111827; font-size: 16px;">{{ CustomerPhone }}</span>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📅 Fecha</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600;">{{ ReservationDate }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">🕐 Hora</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600;">{{ ReservationTime }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">👥 Comensales</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600;">{{ PartySize }} personas</span>
                </div>
                {{ if SpecialRequests }}
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <div>
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">💬 Peticiones especiales</span>
                    <span style="color: #111827; font-size: 16px; font-style: italic;">{{ SpecialRequests }}</span>
                </div>
                {{ endif }}
            </div>
            <div style="text-align: center; margin: 35px 0;">
                <a href="{{ AppURL }}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">
                    Ver detalles en la app
                </a>
            </div>
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin-top: 30px;">
                <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
                    <strong>💡 Consejo:</strong> Puedes gestionar esta reserva directamente desde la aplicación. Si necesitas contactar al cliente, simplemente responde a este email.
                </p>
            </div>
        </div>
        <div style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; text-align: center;">
                Este email fue enviado por <strong style="color: #7c3aed;">La-IA</strong> - Sistema de reservas inteligente
            </p>
            <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
                <a href="https://la-ia-app.vercel.app" style="color: #7c3aed; text-decoration: none;">www.la-ia.site</a>
                | 
                <a href="https://la-ia-app.vercel.app/configuracion" style="color: #7c3aed; text-decoration: none;">Configurar notificaciones</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}

function getCancelledReservationTemplate() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reserva Cancelada - La-IA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); overflow: hidden;">
        <div style="background-color: #ef4444; padding: 30px 40px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">❌ Reserva Cancelada</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">{{ BusinessName }}</p>
        </div>
        <div style="padding: 40px;">
            <p style="font-size: 18px; color: #1a1a1a; margin: 0 0 25px 0;">
                Hola <strong>{{ ContactName }}</strong>,
            </p>
            <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 30px 0;">
                Se ha <strong style="color: #ef4444;">cancelado una reserva</strong> en tu negocio. Aquí están los detalles:
            </p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">👤 Cliente</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600;">{{ CustomerName }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📧 Email</span>
                    <span style="color: #111827; font-size: 16px;">{{ CustomerEmail }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📱 Teléfono</span>
                    <span style="color: #111827; font-size: 16px;">{{ CustomerPhone }}</span>
                </div>
                <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;">
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📅 Fecha cancelada</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600; text-decoration: line-through; opacity: 0.6;">{{ ReservationDate }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">🕐 Hora cancelada</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600; text-decoration: line-through; opacity: 0.6;">{{ ReservationTime }}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">👥 Comensales</span>
                    <span style="color: #111827; font-size: 18px; font-weight: 600; text-decoration: line-through; opacity: 0.6;">{{ PartySize }} personas</span>
                </div>
                {{ if CancellationReason }}
                <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;">
                <div>
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">📝 Motivo de cancelación</span>
                    <span style="color: #991b1b; font-size: 16px; font-style: italic;">{{ CancellationReason }}</span>
                </div>
                {{ endif }}
                <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;">
                <div>
                    <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">⏰ Cancelado el</span>
                    <span style="color: #991b1b; font-size: 14px;">{{ CancellationDate }}</span>
                </div>
            </div>
            <div style="text-align: center; margin: 35px 0;">
                <a href="{{ AppURL }}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">
                    Ver en la app
                </a>
            </div>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-top: 30px;">
                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                    <strong>💡 Sugerencia:</strong> Si tenías una lista de espera para esta fecha y hora, este es un buen momento para contactar a otros clientes interesados.
                </p>
            </div>
        </div>
        <div style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; text-align: center;">
                Este email fue enviado por <strong style="color: #7c3aed;">La-IA</strong> - Sistema de reservas inteligente
            </p>
            <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
                <a href="https://la-ia-app.vercel.app" style="color: #7c3aed; text-decoration: none;">www.la-ia.site</a>
                | 
                <a href="https://la-ia-app.vercel.app/configuracion" style="color: #7c3aed; text-decoration: none;">Configurar notificaciones</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}

