// CRMMessagingWorker.js - Worker para procesamiento y envío de mensajes
// Maneja la cola de mensajes programados con priorización WhatsApp/Email

import { supabase } from '../lib/supabase';
import CRMEligibilityService from './CRMEligibilityService';

/**
 * Worker para el procesamiento y envío de mensajes CRM
 * Procesa la cola scheduled_messages con priorización inteligente
 */
export class CRMMessagingWorker {
  
  constructor() {
    this.isProcessing = false;
    this.batchSize = 10; // Procesar 10 mensajes por lote
    this.retryAttempts = 3;
    this.retryDelayMs = 5000; // 5 segundos entre reintentos
  }
  
  /**
   * Inicia el procesamiento de la cola de mensajes
   */
  async startProcessing() {
    if (this.isProcessing) {
      console.log('⚠️ Worker ya está procesando mensajes');
      return;
    }
    
    this.isProcessing = true;
    console.log('🚀 Iniciando CRM Messaging Worker...');
    
    try {
      await this.processMessageQueue();
    } catch (error) {
      console.error('❌ Error en el worker de mensajería:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Procesa la cola de mensajes programados
   */
  async processMessageQueue() {
    try {
      // 1. Obtener mensajes listos para envío
      const pendingMessages = await this.getPendingMessages();
      
      if (pendingMessages.length === 0) {
        console.log('📭 No hay mensajes pendientes para procesar');
        return;
      }
      
      console.log(`📨 Procesando ${pendingMessages.length} mensajes pendientes`);
      
      // 2. Procesar mensajes en lotes
      for (let i = 0; i < pendingMessages.length; i += this.batchSize) {
        const batch = pendingMessages.slice(i, i + this.batchSize);
        await this.processBatch(batch);
        
        // Pequeña pausa entre lotes para no sobrecargar
        await this.sleep(1000);
      }
      
      console.log('✅ Procesamiento de cola completado');
      
    } catch (error) {
      console.error('❌ Error procesando cola de mensajes:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene mensajes pendientes para procesar
   */
  async getPendingMessages() {
    try {
      const now = new Date().toISOString();
      
      const { data: messages, error } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          customer:customer_id(*),
          template:template_id(*),
          automation_rule:automation_rule_id(*),
          restaurant:business_id(*)
        `)
        .eq('status', 'planned')
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(50); // Límite de seguridad
      
      if (error) throw error;
      
      return messages || [];
      
    } catch (error) {
      console.error('Error obteniendo mensajes pendientes:', error);
      throw error;
    }
  }
  
  /**
   * Procesa un lote de mensajes
   */
  async processBatch(messages) {
    const promises = messages.map(message => this.processMessage(message));
    await Promise.allSettled(promises);
  }
  
  /**
   * Procesa un mensaje individual
   */
  async processMessage(message) {
    try {
      console.log(`📤 Procesando mensaje ${message.id} para cliente ${message.customer?.name}`);
      
      // 1. Marcar como procesando
      await this.updateMessageStatus(message.id, 'processing');
      
      // 2. Verificar elegibilidad en tiempo real
      const eligibility = await CRMEligibilityService.checkEligibility(
        message.customer_id,
        message.business_id,
        message.automation_rule_id
      );
      
      if (!eligibility.eligible) {
        console.log(`⏭️ Mensaje ${message.id} saltado:`, eligibility.reasons);
        await this.updateMessageStatus(message.id, 'skipped', {
          last_error: `Skipped: ${eligibility.reasons.join(', ')}`
        });
        return;
      }
      
      // 3. Determinar canal final y enviar
      const finalChannel = eligibility.channel || message.channel_planned;
      
      const result = await this.sendMessage(message, finalChannel);
      
      if (result.success) {
        await this.updateMessageStatus(message.id, 'sent', {
          channel_final: finalChannel,
          provider_message_id: result.messageId,
          provider_response: result.response,
          sent_at: new Date().toISOString()
        });
        
        // Crear log de interacción
        await this.createInteractionLog(message, 'message_sent', result);
        
        console.log(`✅ Mensaje ${message.id} enviado exitosamente vía ${finalChannel}`);
        
      } else {
        // Manejar fallo
        await this.handleMessageFailure(message, result.error);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando mensaje ${message.id}:`, error);
      await this.handleMessageFailure(message, error.message);
    }
  }
  
  /**
   * Envía un mensaje por el canal especificado
   */
  async sendMessage(message, channel) {
    try {
      console.log(`📱 Enviando mensaje vía ${channel}...`);
      
      if (channel === 'whatsapp') {
        return await this.sendWhatsAppMessage(message);
      } else if (channel === 'email') {
        return await this.sendEmailMessage(message);
      } else {
        throw new Error(`Canal no soportado: ${channel}`);
      }
      
    } catch (error) {
      console.error(`Error enviando mensaje vía ${channel}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Envía mensaje por WhatsApp (Twilio)
   */
  async sendWhatsAppMessage(message) {
    try {
      // 1. Obtener credenciales de Twilio para el restaurante
      const credentials = await this.getChannelCredentials(message.business_id, 'twilio_whatsapp');
      
      if (!credentials) {
        throw new Error('Credenciales de Twilio WhatsApp no configuradas');
      }
      
      // 2. Preparar datos del mensaje
      const messageData = {
        from: credentials.whatsapp_number,
        to: `whatsapp:${message.customer.phone}`,
        body: message.content_rendered
      };
      
      // 3. Si es un template aprobado, usar template
      if (message.template?.provider_template_name) {
        messageData.contentSid = message.template.provider_template_name;
        messageData.contentVariables = JSON.stringify(message.variables_used || {});
        delete messageData.body;
      }
      
      // 4. Enviar vía API de Twilio (simulado por ahora)
      const response = await this.callTwilioAPI(credentials, messageData);
      
      return {
        success: true,
        messageId: response.sid,
        response: response
      };
      
    } catch (error) {
      console.error('Error enviando WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Envía mensaje por Email (SendGrid/Resend)
   */
  async sendEmailMessage(message) {
    try {
      // 1. Obtener credenciales de email para el restaurante
      const credentials = await this.getChannelCredentials(message.business_id, 'sendgrid_email');
      
      if (!credentials) {
        throw new Error('Credenciales de email no configuradas');
      }
      
      // 2. Preparar datos del email
      const emailData = {
        from: `${credentials.from_name} <${credentials.from_email}>`,
        to: message.customer.email,
        subject: message.subject_rendered || message.template?.subject || 'Mensaje de ' + message.restaurant.name,
        html: this.convertMarkdownToHTML(message.content_rendered),
        text: message.content_rendered
      };
      
      // 3. Enviar vía API de SendGrid (simulado por ahora)
      const response = await this.callSendGridAPI(credentials, emailData);
      
      return {
        success: true,
        messageId: response.message_id,
        response: response
      };
      
    } catch (error) {
      console.error('Error enviando email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Obtiene credenciales del canal para un restaurante
   */
  async getChannelCredentials(businessId, channel) {
    try {
      const { data, error } = await supabase
        .from('channel_credentials')
        .select('credentials, config')
        .eq('business_id', businessId)
        .eq('channel', channel)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return { ...data.credentials, ...data.config };
      
    } catch (error) {
      console.error('Error obteniendo credenciales:', error);
      return null;
    }
  }
  
  /**
   * Simula llamada a API de Twilio
   */
  async callTwilioAPI(credentials, messageData) {
    // En producción, aquí iría la llamada real a Twilio
    console.log('🔄 Simulando envío Twilio:', { 
      to: messageData.to, 
      from: messageData.from,
      preview: messageData.body?.substring(0, 50) + '...'
    });
    
    // Simular respuesta de Twilio
    await this.sleep(500);
    
    return {
      sid: `SM${Date.now()}${Date.now().toString(36)}`,
      status: 'sent',
      to: messageData.to,
      from: messageData.from,
      date_sent: new Date().toISOString()
    };
  }
  
  /**
   * Simula llamada a API de SendGrid
   */
  async callSendGridAPI(credentials, emailData) {
    // En producción, aquí iría la llamada real a SendGrid
    console.log('📧 Simulando envío SendGrid:', { 
      to: emailData.to, 
      from: emailData.from,
      subject: emailData.subject
    });
    
    // Simular respuesta de SendGrid
    await this.sleep(500);
    
    return {
      message_id: `msg_${Date.now()}${Date.now().toString(36)}`,
      status: 'sent',
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject
    };
  }
  
  /**
   * Actualiza el estado de un mensaje
   */
  async updateMessageStatus(messageId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        last_attempted_at: new Date().toISOString(),
        ...additionalData
      };
      
      const { error } = await supabase
        .from('scheduled_messages')
        .update(updateData)
        .eq('id', messageId);
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error actualizando estado del mensaje:', error);
    }
  }
  
  /**
   * Maneja fallos en el envío de mensajes
   */
  async handleMessageFailure(message, errorMessage) {
    try {
      const retryCount = (message.retry_count || 0) + 1;
      
      if (retryCount <= this.retryAttempts) {
        // Programar reintento
        const nextAttempt = new Date();
        nextAttempt.setMilliseconds(nextAttempt.getMilliseconds() + (this.retryDelayMs * retryCount));
        
        await this.updateMessageStatus(message.id, 'planned', {
          retry_count: retryCount,
          last_error: errorMessage,
          scheduled_for: nextAttempt.toISOString()
        });
        
        console.log(`🔄 Mensaje ${message.id} programado para reintento ${retryCount}/${this.retryAttempts}`);
        
      } else {
        // Marcar como fallido definitivamente
        await this.updateMessageStatus(message.id, 'failed', {
          last_error: errorMessage,
          failed_at: new Date().toISOString()
        });
        
        // Crear log de fallo
        await this.createInteractionLog(message, 'message_failed', { error: errorMessage });
        
        console.log(`❌ Mensaje ${message.id} marcado como fallido después de ${this.retryAttempts} intentos`);
      }
      
    } catch (error) {
      console.error('Error manejando fallo de mensaje:', error);
    }
  }
  
  /**
   * Crea un log de interacción
   */
  async createInteractionLog(message, interactionType, result) {
    try {
      const logData = {
        business_id: message.business_id,
        customer_id: message.customer_id,
        scheduled_message_id: message.id,
        interaction_type: interactionType,
        channel: message.channel_final || message.channel_planned,
        subject: message.subject_rendered,
        content_preview: message.content_rendered?.substring(0, 100),
        provider_message_id: result?.messageId,
        provider_response: result?.response,
        metadata: {
          template_id: message.template_id,
          automation_rule_id: message.automation_rule_id,
          variables_used: message.variables_used
        }
      };
      
      const { error } = await supabase
        .from('interaction_logs')
        .insert([logData]);
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error creando log de interacción:', error);
    }
  }
  
  /**
   * Convierte Markdown a HTML básico
   */
  convertMarkdownToHTML(markdown) {
    if (!markdown) return '';
    
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }
  
  /**
   * Pausa la ejecución por el tiempo especificado
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Obtiene estadísticas del worker
   */
  async getWorkerStats(businessId, hours = 24) {
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);
      
      const { data: messages, error } = await supabase
        .from('scheduled_messages')
        .select('status, channel_final, created_at, retry_count')
        .eq('business_id', businessId)
        .gte('created_at', startTime.toISOString());
      
      if (error) throw error;
      
      const stats = {
        totalMessages: messages.length,
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        failed: messages.filter(m => m.status === 'failed').length,
        pending: messages.filter(m => m.status === 'planned').length,
        processing: messages.filter(m => m.status === 'processing').length,
        skipped: messages.filter(m => m.status === 'skipped').length,
        whatsapp: messages.filter(m => m.channel_final === 'whatsapp').length,
        email: messages.filter(m => m.channel_final === 'email').length,
        retries: messages.reduce((sum, m) => sum + (m.retry_count || 0), 0),
        period: `${hours} horas`
      };
      
      return stats;
      
    } catch (error) {
      console.error('Error obteniendo estadísticas del worker:', error);
      throw error;
    }
  }
}

// Instancia singleton del worker
export const messagingWorker = new CRMMessagingWorker();

export default CRMMessagingWorker;

