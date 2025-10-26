import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurar transporter SMTP (con dynamic import)
const createTransporter = async () => {
  const nodemailer = (await import('nodemailer')).default;
  
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'info@la-ia.site',
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

// Template: Agente Desconectado
const getAgentOfflineEmailHTML = (variables) => {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#dc2626;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">⚠️ ALERTA: Agente IA Desconectado</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">${variables.RestaurantName}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>${variables.ContactName}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">
Tu agente de inteligencia artificial <strong style="color:#dc2626;">no está respondiendo</strong> desde las <strong>${variables.DisconnectedSince}</strong>.
</p>
<div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:25px;border-radius:8px;margin-bottom:30px;">
<h3 style="margin:0 0 15px 0;color:#991b1b;font-size:16px;">⚠️ Impacto</h3>
<ul style="margin:0;padding-left:20px;color:#7f1d1d;">
<li>Los clientes NO recibirán respuestas automáticas por WhatsApp</li>
<li>Las reservas podrían NO procesarse correctamente</li>
<li>Los mensajes se están perdiendo</li>
</ul>
</div>
<div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:20px;border-radius:8px;margin-bottom:30px;">
<h3 style="margin:0 0 10px 0;color:#92400e;font-size:14px;">✅ Qué hacer:</h3>
<ol style="margin:0;padding-left:20px;color:#78350f;font-size:14px;">
<li>Verifica tu integración con WhatsApp</li>
<li>Revisa Make.com / n8n workflows</li>
<li>Comprueba que el webhook está activo</li>
</ol>
</div>
<div style="text-align:center;margin:35px 0;">
<a href="${variables.AppURL}" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Revisar configuración</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Alerta enviada por <strong style="color:#7c3aed;">La-IA</strong> - Sistema de Monitoreo</p>
</div>
</div>
</body>
</html>`;
};

// Template: Error Crítico
const getCriticalErrorEmailHTML = (variables) => {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#ea580c;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">🔴 Error Crítico del Sistema</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">${variables.RestaurantName}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>${variables.ContactName}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">
Se ha detectado un <strong style="color:#ea580c;">error crítico</strong> en tu sistema:
</p>
<div style="background-color:#fff7ed;border-left:4px solid #ea580c;padding:25px;border-radius:8px;margin-bottom:30px;">
<h3 style="margin:0 0 10px 0;color:#9a3412;font-size:16px;">📋 Detalles del Error:</h3>
<p style="margin:0;color:#7c2d12;font-family:monospace;font-size:14px;"><strong>Tipo:</strong> ${variables.ErrorType}</p>
<p style="margin:8px 0 0 0;color:#7c2d12;font-family:monospace;font-size:14px;"><strong>Mensaje:</strong> ${variables.ErrorMessage}</p>
<p style="margin:8px 0 0 0;color:#7c2d12;font-family:monospace;font-size:14px;"><strong>Ocurrencias:</strong> ${variables.ErrorCount} veces en los últimos 10 minutos</p>
</div>
<div style="text-align:center;margin:35px 0;">
<a href="${variables.AppURL}" style="display:inline-block;background-color:#ea580c;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Ver detalles</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Alerta enviada por <strong style="color:#7c3aed;">La-IA</strong> - Sistema de Monitoreo</p>
</div>
</div>
</body>
</html>`;
};

// Template: Agente desactivado manualmente
const getAgentDeactivatedEmailHTML = (variables) => {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);overflow:hidden;">
<div style="background-color:#6366f1;padding:30px 40px;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:28px;font-weight:bold;">💤 Agente Desactivado</h1>
<p style="margin:8px 0 0 0;font-size:16px;opacity:0.9;">${variables.RestaurantName}</p>
</div>
<div style="padding:40px;">
<p style="font-size:18px;color:#1a1a1a;margin:0 0 25px 0;">Hola <strong>${variables.ContactName}</strong>,</p>
<p style="font-size:16px;color:#333333;line-height:1.6;margin:0 0 30px 0;">
Has <strong>desactivado tu agente IA</strong> correctamente.
</p>
<div style="background-color:#eff6ff;border-left:4px solid:#3b82f6;padding:25px;border-radius:8px;margin-bottom:30px;">
<h3 style="margin:0 0 15px 0;color:#1e40af;font-size:16px;">ℹ️ Qué significa esto:</h3>
<ul style="margin:0;padding-left:20px;color:#1e3a8a;">
<li>Tu agente <strong>NO responderá</strong> a mensajes de WhatsApp</li>
<li>Las llamadas <strong>NO serán atendidas</strong> automáticamente</li>
<li>Instagram y Facebook <strong>NO recibirán respuestas</strong></li>
<li>Las reservas manuales desde el dashboard <strong>siguen funcionando</strong></li>
</ul>
</div>
<div style="background-color:#fef3c7;border-left:4px solid:#f59e0b;padding:20px;border-radius:8px;margin-bottom:30px;">
<h3 style="margin:0 0 10px 0;color:#92400e;font-size:14px;">⚠️ Recuerda:</h3>
<p style="margin:0;color:#78350f;font-size:14px;">Los clientes que intenten contactarte NO recibirán respuesta automática. Puedes reactivar tu agente en cualquier momento desde la configuración.</p>
</div>
<div style="text-align:center;margin:35px 0;">
<a href="${variables.AppURL}" style="display:inline-block;background-color:#6366f1;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Reactivar agente</a>
</div>
</div>
<div style="background-color:#f9fafb;padding:30px 40px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Confirmación enviada por <strong style="color:#7c3aed;">La-IA</strong></p>
</div>
</div>
</body>
</html>`;
};

// Enviar confirmación de agente desactivado
export const sendAgentDeactivatedConfirmation = async (restaurant) => {
  try {
    console.log('📧 Enviando confirmación de agente desactivado:', restaurant.id);
    
    const settings = restaurant.settings || {};
    const notificationEmails = settings.notification_emails || [restaurant.email];
    
    const variables = {
      RestaurantName: restaurant.name,
      ContactName: settings.contact_name || 'Equipo',
      AppURL: 'https://la-ia-app.vercel.app/configuracion',
    };
    
    const html = getAgentDeactivatedEmailHTML(variables);
    const transporter = await createTransporter();
    
    const info = await transporter.sendMail({
      from: `La-IA - ${restaurant.name} <noreply@la-ia.site>`,
      replyTo: restaurant.email,
      to: notificationEmails,
      subject: `💤 Agente desactivado - ${restaurant.name}`,
      html,
    });
    
    console.log('✅ Email de confirmación enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando confirmación:', error);
    return { success: false, error: error.message };
  }
};

// Enviar alerta de agente desconectado
export const sendAgentOfflineAlert = async (restaurant, lastSeen) => {
  try {
    console.log('🚨 Enviando alerta de agente desconectado:', restaurant.id);
    
    const settings = restaurant.settings || {};
    const notificationSettings = settings.notifications || {};
    const systemNotif = notificationSettings.system_alerts || { enabled: true };
    
    if (systemNotif.enabled === false) {
      console.log('⏭️ Alertas del sistema deshabilitadas');
      return { success: true, skipped: true };
    }
    
    const notificationEmails = settings.notification_emails || [restaurant.email];
    
    const variables = {
      RestaurantName: restaurant.name,
      ContactName: settings.contact_name || 'Equipo',
      DisconnectedSince: new Date(lastSeen).toLocaleTimeString('es-ES'),
      AppURL: 'https://la-ia-app.vercel.app/configuracion',
    };
    
    const html = getAgentOfflineEmailHTML(variables);
    const transporter = await createTransporter();
    
    const info = await transporter.sendMail({
      from: `ALERTA La-IA - ${restaurant.name} <noreply@la-ia.site>`,
      replyTo: restaurant.email,
      to: notificationEmails,
      subject: `🚨 URGENTE: Agente IA Desconectado - ${restaurant.name}`,
      html,
    });
    
    console.log('✅ Alerta de agente desconectado enviada:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando alerta de agente:', error);
    return { success: false, error: error.message };
  }
};

// Enviar alerta de error crítico
export const sendCriticalErrorAlert = async (restaurant, errorType, errorMessage, errorCount) => {
  try {
    console.log('🚨 Enviando alerta de error crítico:', errorType);
    
    const settings = restaurant.settings || {};
    const notificationSettings = settings.notifications || {};
    const systemNotif = notificationSettings.system_alerts || { enabled: true };
    
    if (systemNotif.enabled === false) {
      console.log('⏭️ Alertas del sistema deshabilitadas');
      return { success: true, skipped: true };
    }
    
    const notificationEmails = settings.notification_emails || [restaurant.email];
    
    const variables = {
      RestaurantName: restaurant.name,
      ContactName: settings.contact_name || 'Equipo',
      ErrorType: errorType,
      ErrorMessage: errorMessage,
      ErrorCount: errorCount,
      AppURL: 'https://la-ia-app.vercel.app/configuracion',
    };
    
    const html = getCriticalErrorEmailHTML(variables);
    const transporter = await createTransporter();
    
    const info = await transporter.sendMail({
      from: `ALERTA La-IA - ${restaurant.name} <noreply@la-ia.site>`,
      replyTo: restaurant.email,
      to: notificationEmails,
      subject: `🔴 Error Crítico: ${errorType} - ${restaurant.name}`,
      html,
    });
    
    console.log('✅ Alerta de error crítico enviada:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando alerta de error:', error);
    return { success: false, error: error.message };
  }
};

// Sistema de health check para agentes
const agentHealthStatus = new Map(); // {restaurant_id: lastSeen}

export const startAgentHealthMonitor = () => {
  console.log('🏥 Iniciando monitor de salud de agentes...');
  
  // Check cada 5 minutos
  setInterval(async () => {
    console.log('🔍 Verificando salud de agentes...');
    
    try {
      // Obtener todos los restaurantes activos
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('*')
        .eq('active', true);
      
      if (!restaurants) return;
      
      for (const restaurant of restaurants) {
        const lastSeen = agentHealthStatus.get(restaurant.id);
        const now = Date.now();
        
        // Si no hemos visto actividad en 10 minutos, alertar
        if (lastSeen && (now - lastSeen) > 10 * 60 * 1000) {
          console.log(`⚠️ Agente inactivo detectado: ${restaurant.name}`);
          await sendAgentOfflineAlert(restaurant, lastSeen);
          
          // Evitar spam: quitar del tracking hasta que vuelva
          agentHealthStatus.delete(restaurant.id);
        }
      }
    } catch (error) {
      console.error('Error en health check:', error);
    }
  }, 5 * 60 * 1000); // Cada 5 minutos
};

// Registrar actividad del agente (llamar cuando el agente procesa algo)
export const registerAgentActivity = (restaurantId) => {
  agentHealthStatus.set(restaurantId, Date.now());
};

// Sistema de tracking de errores
const errorTracking = new Map(); // {errorKey: {count, firstSeen, lastSeen}}

export const trackError = async (restaurantId, errorType, errorMessage) => {
  const errorKey = `${restaurantId}:${errorType}`;
  const now = Date.now();
  
  const existing = errorTracking.get(errorKey);
  
  if (existing) {
    existing.count++;
    existing.lastSeen = now;
    
    // Si el mismo error ocurre 3+ veces en 10 minutos, alertar
    if (existing.count >= 3 && (now - existing.firstSeen) < 10 * 60 * 1000) {
      console.log(`🚨 Error crítico detectado: ${errorType} (${existing.count} veces)`);
      
      // Obtener restaurante
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();
      
      if (restaurant) {
        await sendCriticalErrorAlert(restaurant, errorType, errorMessage, existing.count);
      }
      
      // Reset contador para evitar spam
      errorTracking.delete(errorKey);
    }
  } else {
    errorTracking.set(errorKey, {
      count: 1,
      firstSeen: now,
      lastSeen: now,
    });
  }
  
  // Limpiar errores antiguos (más de 15 minutos)
  for (const [key, value] of errorTracking.entries()) {
    if (now - value.lastSeen > 15 * 60 * 1000) {
      errorTracking.delete(key);
    }
  }
};

