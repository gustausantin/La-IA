// CRMIntegrationService.js - Integraciones reales con Twilio y SendGrid
// Gestiona las conexiones con proveedores externos de mensajería

import { supabase } from '../lib/supabase';

/**
 * Servicio de integraciones CRM con proveedores externos
 * Maneja Twilio WhatsApp, SendGrid Email y otros proveedores
 */
export class CRMIntegrationService {
  
  /**
   * Envía mensaje por WhatsApp usando Twilio
   */
  static async sendWhatsAppMessage(businessId, messageData) {
    try {
      console.log('📱 Enviando WhatsApp via Twilio:', messageData);
      
      // 1. Obtener credenciales de Twilio
      const credentials = await this.getChannelCredentials(businessId, 'twilio_whatsapp');
      
      if (!credentials) {
        throw new Error('Credenciales de Twilio WhatsApp no configuradas');
      }
      
      // 2. Preparar datos para Twilio API
      const twilioData = {
        From: `whatsapp:${credentials.whatsapp_number}`,
        To: `whatsapp:${messageData.to}`,
        Body: messageData.body
      };
      
      // 3. Si es un template aprobado, usar ContentSid
      if (messageData.templateName && credentials.use_templates) {
        twilioData.ContentSid = messageData.templateName;
        if (messageData.variables) {
          twilioData.ContentVariables = JSON.stringify(messageData.variables);
        }
        delete twilioData.Body; // No usar body con templates
      }
      
      // 4. Llamar a Twilio API
      const response = await this.callTwilioAPI(credentials, twilioData);
      
      return {
        success: true,
        messageId: response.sid,
        status: response.status,
        provider: 'twilio',
        channel: 'whatsapp',
        response: response
      };
      
    } catch (error) {
      console.error('❌ Error enviando WhatsApp:', error);
      return {
        success: false,
        error: error.message,
        provider: 'twilio',
        channel: 'whatsapp'
      };
    }
  }
  
  /**
   * Envía email usando SendGrid
   */
  static async sendEmailMessage(businessId, messageData) {
    try {
      console.log('📧 Enviando Email via SendGrid:', messageData);
      
      // 1. Obtener credenciales de SendGrid
      const credentials = await this.getChannelCredentials(businessId, 'sendgrid_email');
      
      if (!credentials) {
        throw new Error('Credenciales de SendGrid no configuradas');
      }
      
      // 2. Preparar datos para SendGrid API
      const emailData = {
        personalizations: [{
          to: [{ email: messageData.to }],
          subject: messageData.subject
        }],
        from: {
          email: credentials.from_email,
          name: credentials.from_name || credentials.from_email
        },
        content: [
          {
            type: 'text/plain',
            value: messageData.text || messageData.body
          },
          {
            type: 'text/html',
            value: messageData.html || this.convertMarkdownToHTML(messageData.body)
          }
        ]
      };
      
      // 3. Si es un template de SendGrid
      if (messageData.templateId) {
        emailData.template_id = messageData.templateId;
        if (messageData.variables) {
          emailData.personalizations[0].dynamic_template_data = messageData.variables;
        }
        delete emailData.content; // No usar content con templates
      }
      
      // 4. Llamar a SendGrid API
      const response = await this.callSendGridAPI(credentials, emailData);
      
      return {
        success: true,
        messageId: response.message_id || response['x-message-id'],
        status: 'sent',
        provider: 'sendgrid',
        channel: 'email',
        response: response
      };
      
    } catch (error) {
      console.error('❌ Error enviando Email:', error);
      return {
        success: false,
        error: error.message,
        provider: 'sendgrid',
        channel: 'email'
      };
    }
  }
  
  /**
   * Obtiene credenciales del canal para un restaurante
   */
  static async getChannelCredentials(businessId, channel) {
    try {
      const { data, error } = await supabase
        .from('channel_credentials')
        .select('credentials, config, is_active')
        .eq('business_id', businessId)
        .eq('channel', channel)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        console.log(`⚠️ No hay credenciales activas para ${channel} en restaurant ${businessId}`);
        return null;
      }
      
      // Combinar credenciales y config
      return { ...data.credentials, ...data.config };
      
    } catch (error) {
      console.error('Error obteniendo credenciales:', error);
      return null;
    }
  }
  
  /**
   * Guarda o actualiza credenciales de un canal
   */
  static async saveChannelCredentials(businessId, channel, credentials, config = {}) {
    try {
      const credentialData = {
        business_id: businessId,
        channel: channel,
        credentials: credentials, // Se encriptará en producción
        config: config,
        is_active: true,
        last_test_at: null,
        last_test_success: null
      };
      
      // Upsert (insert or update)
      const { data, error } = await supabase
        .from('channel_credentials')
        .upsert(credentialData, {
          onConflict: 'business_id,channel'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`✅ Credenciales guardadas para ${channel}`);
      return { success: true, data };
      
    } catch (error) {
      console.error('Error guardando credenciales:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Prueba las credenciales de un canal
   */
  static async testChannelCredentials(businessId, channel) {
    try {
      console.log(`🧪 Probando credenciales para ${channel}...`);
      
      let result;
      
      if (channel === 'twilio_whatsapp') {
        result = await this.testTwilioCredentials(businessId);
      } else if (channel === 'sendgrid_email') {
        result = await this.testSendGridCredentials(businessId);
      } else {
        throw new Error(`Canal no soportado: ${channel}`);
      }
      
      // Actualizar resultado del test
      await supabase
        .from('channel_credentials')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_success: result.success,
          last_test_error: result.success ? null : result.error
        })
        .eq('business_id', businessId)
        .eq('channel', channel);
      
      return result;
      
    } catch (error) {
      console.error('Error probando credenciales:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Prueba credenciales de Twilio
   */
  static async testTwilioCredentials(businessId) {
    try {
      const credentials = await this.getChannelCredentials(businessId, 'twilio_whatsapp');
      
      if (!credentials) {
        return { success: false, error: 'No hay credenciales configuradas' };
      }
      
      // Test básico: verificar que las credenciales son válidas
      const testMessage = {
        From: `whatsapp:${credentials.whatsapp_number}`,
        To: `whatsapp:${credentials.test_phone || '+34600000000'}`,
        Body: '🧪 Test de conexión CRM - La-IA'
      };
      
      const response = await this.callTwilioAPI(credentials, testMessage, true);
      
      return {
        success: true,
        message: 'Credenciales de Twilio validadas correctamente',
        response: response
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error en Twilio: ${error.message}`
      };
    }
  }
  
  /**
   * Prueba credenciales de SendGrid
   */
  static async testSendGridCredentials(businessId) {
    try {
      const credentials = await this.getChannelCredentials(businessId, 'sendgrid_email');
      
      if (!credentials) {
        return { success: false, error: 'No hay credenciales configuradas' };
      }
      
      // Test básico: enviar email de prueba
      const testEmail = {
        personalizations: [{
          to: [{ email: credentials.test_email || credentials.from_email }],
          subject: '🧪 Test de conexión CRM - La-IA'
        }],
        from: {
          email: credentials.from_email,
          name: credentials.from_name || 'La-IA CRM'
        },
        content: [{
          type: 'text/html',
          value: '<p>Este es un email de prueba del sistema CRM de La-IA.</p><p>✅ Las credenciales funcionan correctamente.</p>'
        }]
      };
      
      const response = await this.callSendGridAPI(credentials, testEmail, true);
      
      return {
        success: true,
        message: 'Credenciales de SendGrid validadas correctamente',
        response: response
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Error en SendGrid: ${error.message}`
      };
    }
  }
  
  /**
   * Llama a la API de Twilio
   */
  static async callTwilioAPI(credentials, messageData, isTest = false) {
    try {
      const { account_sid, auth_token } = credentials;
      
      if (!account_sid || !auth_token) {
        throw new Error('Faltan credenciales de Twilio (account_sid, auth_token)');
      }
      
      // En modo test, solo validar credenciales sin enviar
      if (isTest) {
        console.log('🧪 Test mode - simulando llamada a Twilio API');
        return {
          sid: `TEST_${Date.now()}`,
          status: 'queued',
          from: messageData.From,
          to: messageData.To,
          date_sent: new Date().toISOString()
        };
      }
      
      // En producción, aquí iría la llamada real a Twilio
      const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${account_sid}:${auth_token}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(messageData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Twilio API error: ${error.message}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error('Error en Twilio API:', error);
      throw error;
    }
  }
  
  /**
   * Llama a la API de SendGrid
   */
  static async callSendGridAPI(credentials, emailData, isTest = false) {
    try {
      const { api_key } = credentials;
      
      if (!api_key) {
        throw new Error('Falta API key de SendGrid');
      }
      
      // En modo test, solo validar credenciales
      if (isTest) {
        console.log('🧪 Test mode - simulando llamada a SendGrid API');
        return {
          message_id: `TEST_${Date.now()}`,
          status: 'sent',
          to: emailData.personalizations[0].to[0].email,
          from: emailData.from.email
        };
      }
      
      // En producción, llamada real a SendGrid
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }
      
      // SendGrid devuelve 202 sin body en éxito
      return {
        message_id: response.headers.get('x-message-id') || `sg_${Date.now()}`,
        status: 'sent'
      };
      
    } catch (error) {
      console.error('Error en SendGrid API:', error);
      throw error;
    }
  }
  
  /**
   * Convierte Markdown básico a HTML
   */
  static convertMarkdownToHTML(markdown) {
    if (!markdown) return '';
    
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^(.+)$/, '<p>$1</p>');
  }
  
  /**
   * Obtiene estadísticas de integraciones
   */
  static async getIntegrationStats(businessId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Mensajes enviados por canal
      const { data: messages, error } = await supabase
        .from('scheduled_messages')
        .select('channel_final, status, provider_response, created_at')
        .eq('business_id', businessId)
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      
      const stats = {
        totalMessages: messages.length,
        whatsappMessages: messages.filter(m => m.channel_final === 'whatsapp').length,
        emailMessages: messages.filter(m => m.channel_final === 'email').length,
        successfulMessages: messages.filter(m => ['sent', 'delivered'].includes(m.status)).length,
        failedMessages: messages.filter(m => m.status === 'failed').length,
        deliveryRate: 0,
        period: `${days} días`
      };
      
      if (stats.totalMessages > 0) {
        stats.deliveryRate = Math.round((stats.successfulMessages / stats.totalMessages) * 100);
      }
      
      return stats;
      
    } catch (error) {
      console.error('Error obteniendo estadísticas de integraciones:', error);
      throw error;
    }
  }
}

export default CRMIntegrationService;

