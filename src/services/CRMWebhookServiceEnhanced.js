// CRMWebhookServiceEnhanced.js - Sistema de webhooks para integraciones externas
// Gestiona webhooks salientes y entrantes para N8N, Zapier y otros proveedores

import { supabase } from '../lib/supabase';

/**
 * Servicio de webhooks mejorado para integraciones CRM
 * Maneja notificaciones a sistemas externos como N8N, Zapier, etc.
 */
export class CRMWebhookServiceEnhanced {
  
  /**
   * Dispara webhook para evento de reserva completada
   */
  static async triggerReservationWebhook(reservationId, restaurantId, eventType = 'reservation_completed') {
    try {
      console.log('🔔 Disparando webhook de reserva:', { reservationId, eventType });
      
      // Obtener datos completos de la reserva
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          *,
          customer:customer_id(*),
          table:table_id(*)
        `)
        .eq('id', reservationId)
        .single();
      
      if (reservationError || !reservation) {
        throw new Error('Reserva no encontrada');
      }
      
      // Obtener datos del restaurante
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('id, name, email, phone')
        .eq('id', restaurantId)
        .single();
      
      // Preparar payload del webhook
      const webhookPayload = {
        event_type: eventType,
        event_id: `${eventType}_${reservationId}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        restaurant: restaurant,
        reservation: {
          id: reservation.id,
          customer_name: reservation.customer_name,
          customer_email: reservation.customer_email,
          customer_phone: reservation.customer_phone,
          reservation_date: reservation.reservation_date,
          reservation_time: reservation.reservation_time,
          party_size: reservation.party_size,
          status: reservation.status,
          table_number: reservation.table_number,
          special_requests: reservation.special_requests,
          source: reservation.source
        },
        customer: reservation.customer ? {
          id: reservation.customer.id,
          name: reservation.customer.name,
          email: reservation.customer.email,
          phone: reservation.customer.phone,
          total_visits: reservation.customer.total_visits,
          total_spent: reservation.customer.total_spent,
          segment: reservation.customer.preferences?.segment,
          last_visit: reservation.customer.last_visit
        } : null
      };
      
      // Enviar webhook
      await this.sendWebhook(restaurantId, 'reservation', webhookPayload);
      
      console.log('✅ Webhook de reserva enviado exitosamente');
      
    } catch (error) {
      console.error('❌ Error disparando webhook de reserva:', error);
    }
  }
  
  /**
   * Dispara webhook para cambio de segmento de cliente
   */
  static async triggerSegmentChangeWebhook(customerId, restaurantId, previousSegment, newSegment) {
    try {
      console.log('🔔 Disparando webhook de cambio de segmento:', { customerId, previousSegment, newSegment });
      
      // Obtener datos del cliente
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      
      if (customerError || !customer) {
        throw new Error('Cliente no encontrado');
      }
      
      // Obtener datos del restaurante
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('id, name, email, phone')
        .eq('id', restaurantId)
        .single();
      
      // Preparar payload del webhook
      const webhookPayload = {
        event_type: 'segment_changed',
        event_id: `segment_changed_${customerId}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        restaurant: restaurant,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          total_visits: customer.total_visits,
          total_spent: customer.total_spent,
          last_visit: customer.last_visit,
          previous_segment: previousSegment,
          new_segment: newSegment,
          segment_change_reason: this.getSegmentChangeReason(previousSegment, newSegment)
        }
      };
      
      // Enviar webhook
      await this.sendWebhook(restaurantId, 'customer_segment', webhookPayload);
      
      console.log('✅ Webhook de cambio de segmento enviado exitosamente');
      
    } catch (error) {
      console.error('❌ Error disparando webhook de cambio de segmento:', error);
    }
  }
  
  /**
   * Dispara webhook para mensaje enviado
   */
  static async triggerMessageWebhook(messageId, restaurantId, eventType = 'message_sent') {
    try {
      console.log('🔔 Disparando webhook de mensaje:', { messageId, eventType });
      
      // Obtener datos del mensaje
      const { data: message, error: messageError } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          customer:customer_id(*),
          automation_rule:automation_rule_id(*),
          template:template_id(*)
        `)
        .eq('id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error('Mensaje no encontrado');
      }
      
      // Obtener datos del restaurante
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('id, name, email, phone')
        .eq('id', restaurantId)
        .single();
      
      // Preparar payload del webhook
      const webhookPayload = {
        event_type: eventType,
        event_id: `${eventType}_${messageId}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        restaurant: restaurant,
        message: {
          id: message.id,
          channel: message.channel_final || message.channel_planned,
          status: message.status,
          subject: message.subject_rendered,
          content_preview: message.content_rendered?.substring(0, 100),
          scheduled_for: message.scheduled_for,
          sent_at: message.sent_at,
          delivered_at: message.delivered_at,
          provider_message_id: message.provider_message_id
        },
        customer: message.customer ? {
          id: message.customer.id,
          name: message.customer.name,
          email: message.customer.email,
          phone: message.customer.phone,
          segment: message.customer.preferences?.segment
        } : null,
        automation_rule: message.automation_rule ? {
          id: message.automation_rule.id,
          name: message.automation_rule.name,
          target_segment: message.automation_rule.target_segment
        } : null
      };
      
      // Enviar webhook
      await this.sendWebhook(restaurantId, 'message', webhookPayload);
      
      console.log('✅ Webhook de mensaje enviado exitosamente');
      
    } catch (error) {
      console.error('❌ Error disparando webhook de mensaje:', error);
    }
  }
  
  /**
   * Envía webhook a endpoints configurados
   */
  static async sendWebhook(restaurantId, webhookType, payload) {
    try {
      // Obtener configuración de webhooks para el restaurante
      const { data: webhookConfigs, error } = await supabase
        .from('channel_credentials')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('channel', 'n8n_webhook')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error obteniendo configuración de webhooks:', error);
        return;
      }
      
      if (!webhookConfigs || webhookConfigs.length === 0) {
        console.log('📭 No hay webhooks configurados para este restaurante');
        return;
      }
      
      // Enviar a todos los webhooks configurados
      const promises = webhookConfigs.map(config => 
        this.sendWebhookToEndpoint(config, webhookType, payload)
      );
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.error('Error enviando webhooks:', error);
    }
  }
  
  /**
   * Envía webhook a un endpoint específico
   */
  static async sendWebhookToEndpoint(webhookConfig, webhookType, payload) {
    try {
      const { credentials, config } = webhookConfig;
      const webhookUrl = credentials.webhook_url;
      
      if (!webhookUrl) {
        throw new Error('URL de webhook no configurada');
      }
      
      // Filtrar por tipo de webhook si está configurado
      const allowedTypes = config.webhook_types || ['all'];
      if (!allowedTypes.includes('all') && !allowedTypes.includes(webhookType)) {
        console.log(`⏭️ Webhook filtrado para tipo ${webhookType}`);
        return;
      }
      
      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'La-IA-CRM-Webhook/1.0'
      };
      
      // Agregar autenticación si está configurada
      if (credentials.api_key) {
        headers['Authorization'] = `Bearer ${credentials.api_key}`;
      }
      
      if (credentials.secret_header) {
        headers[credentials.secret_header] = credentials.secret_value;
      }
      
      // Enviar webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ Webhook enviado a ${webhookUrl} - Status: ${response.status}`);
      
      // Actualizar estadísticas de éxito
      await this.updateWebhookStats(webhookConfig.id, true);
      
    } catch (error) {
      console.error('Error enviando webhook a endpoint:', error);
      
      // Actualizar estadísticas de error
      await this.updateWebhookStats(webhookConfig.id, false, error.message);
    }
  }
  
  /**
   * Actualiza estadísticas de webhooks
   */
  static async updateWebhookStats(webhookConfigId, success, errorMessage = null) {
    try {
      const updateData = {
        last_test_at: new Date().toISOString(),
        last_test_success: success,
        last_test_error: success ? null : errorMessage
      };
      
      await supabase
        .from('channel_credentials')
        .update(updateData)
        .eq('id', webhookConfigId);
        
    } catch (error) {
      console.error('Error actualizando estadísticas de webhook:', error);
    }
  }
  
  /**
   * Maneja webhooks entrantes (callbacks de proveedores)
   */
  static async handleIncomingWebhook(provider, payload, headers) {
    try {
      console.log(`📥 Webhook entrante de ${provider}:`, payload);
      
      switch (provider) {
        case 'twilio':
          return await this.handleTwilioWebhook(payload, headers);
        case 'sendgrid':
          return await this.handleSendGridWebhook(payload, headers);
        case 'n8n':
          return await this.handleN8NWebhook(payload, headers);
        default:
          throw new Error(`Proveedor no soportado: ${provider}`);
      }
      
    } catch (error) {
      console.error('Error manejando webhook entrante:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Maneja webhook de Twilio (estados de mensaje)
   */
  static async handleTwilioWebhook(payload, headers) {
    try {
      const { MessageSid, MessageStatus, To, From, ErrorCode } = payload;
      
      // Buscar el mensaje en nuestra base de datos
      const { data: message, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('provider_message_id', MessageSid)
        .single();
      
      if (error || !message) {
        console.log(`⚠️ Mensaje ${MessageSid} no encontrado en nuestra base de datos`);
        return { success: true, message: 'Mensaje no encontrado' };
      }
      
      // Mapear estado de Twilio a nuestro sistema
      let newStatus = message.status;
      let deliveredAt = null;
      
      switch (MessageStatus) {
        case 'delivered':
          newStatus = 'delivered';
          deliveredAt = new Date().toISOString();
          break;
        case 'failed':
        case 'undelivered':
          newStatus = 'failed';
          break;
        case 'sent':
          newStatus = 'sent';
          break;
      }
      
      // Actualizar mensaje en base de datos
      await supabase
        .from('scheduled_messages')
        .update({
          status: newStatus,
          delivered_at: deliveredAt,
          provider_response: payload
        })
        .eq('id', message.id);
      
      // Crear log de interacción
      await supabase
        .from('interaction_logs')
        .insert([{
          restaurant_id: message.restaurant_id,
          customer_id: message.customer_id,
          scheduled_message_id: message.id,
          interaction_type: newStatus === 'delivered' ? 'message_delivered' : 'message_failed',
          channel: 'whatsapp',
          provider_message_id: MessageSid,
          provider_response: payload
        }]);
      
      console.log(`✅ Estado de mensaje actualizado: ${MessageSid} → ${newStatus}`);
      
      return { success: true, message: 'Estado actualizado' };
      
    } catch (error) {
      console.error('Error manejando webhook de Twilio:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Maneja webhook de SendGrid (eventos de email)
   */
  static async handleSendGridWebhook(payload, headers) {
    try {
      // SendGrid envía arrays de eventos
      const events = Array.isArray(payload) ? payload : [payload];
      
      for (const event of events) {
        const { sg_message_id, event: eventType, email, timestamp } = event;
        
        // Buscar el mensaje en nuestra base de datos
        const { data: message, error } = await supabase
          .from('scheduled_messages')
          .select('*')
          .eq('provider_message_id', sg_message_id)
          .single();
        
        if (error || !message) {
          console.log(`⚠️ Mensaje ${sg_message_id} no encontrado`);
          continue;
        }
        
        // Mapear evento de SendGrid a nuestro sistema
        let newStatus = message.status;
        let deliveredAt = null;
        
        switch (eventType) {
          case 'delivered':
            newStatus = 'delivered';
            deliveredAt = new Date(timestamp * 1000).toISOString();
            break;
          case 'bounce':
          case 'dropped':
            newStatus = 'failed';
            break;
        }
        
        // Actualizar mensaje
        await supabase
          .from('scheduled_messages')
          .update({
            status: newStatus,
            delivered_at: deliveredAt,
            provider_response: event
          })
          .eq('id', message.id);
        
        // Crear log de interacción
        await supabase
          .from('interaction_logs')
          .insert([{
            restaurant_id: message.restaurant_id,
            customer_id: message.customer_id,
            scheduled_message_id: message.id,
            interaction_type: newStatus === 'delivered' ? 'message_delivered' : 'message_failed',
            channel: 'email',
            provider_message_id: sg_message_id,
            provider_response: event
          }]);
      }
      
      return { success: true, message: `${events.length} eventos procesados` };
      
    } catch (error) {
      console.error('Error manejando webhook de SendGrid:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Maneja webhook de N8N (acciones personalizadas)
   */
  static async handleN8NWebhook(payload, headers) {
    try {
      const { action, restaurant_id, customer_id, data } = payload;
      
      switch (action) {
        case 'update_customer_consent':
          await this.updateCustomerConsent(restaurant_id, customer_id, data);
          break;
        case 'trigger_custom_message':
          await this.triggerCustomMessage(restaurant_id, customer_id, data);
          break;
        default:
          console.log(`⚠️ Acción no reconocida desde N8N: ${action}`);
      }
      
      return { success: true, message: 'Webhook de N8N procesado' };
      
    } catch (error) {
      console.error('Error manejando webhook de N8N:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Actualiza consentimiento de cliente desde webhook externo
   */
  static async updateCustomerConsent(restaurantId, customerId, consentData) {
    try {
      const updateData = {};
      
      if (consentData.notifications_enabled !== undefined) {
        updateData.notifications_enabled = consentData.notifications_enabled;
      }
      
      if (consentData.consent_whatsapp !== undefined) {
        updateData.consent_whatsapp = consentData.consent_whatsapp;
      }
      
      if (consentData.consent_email !== undefined) {
        updateData.consent_email = consentData.consent_email;
      }
      
      await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId);
      
      console.log(`✅ Consentimientos actualizados para cliente ${customerId}`);
      
    } catch (error) {
      console.error('Error actualizando consentimientos:', error);
    }
  }
  
  /**
   * Obtiene razón del cambio de segmento
   */
  static getSegmentChangeReason(previousSegment, newSegment) {
    const reasons = {
      'nuevo_to_ocasional': 'Primera reserva completada',
      'ocasional_to_regular': 'Aumento en frecuencia de visitas',
      'regular_to_vip': 'Alcanzó umbral VIP por visitas o gasto',
      'any_to_inactivo': 'Período prolongado sin actividad',
      'any_to_en_riesgo': 'Disminución en frecuencia de visitas'
    };
    
    const key = `${previousSegment}_to_${newSegment}`;
    return reasons[key] || reasons[`any_to_${newSegment}`] || 'Cambio automático por reglas de negocio';
  }
  
  /**
   * Obtiene estadísticas de webhooks
   */
  static async getWebhookStats(restaurantId, days = 7) {
    try {
      const { data: configs, error } = await supabase
        .from('channel_credentials')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('channel', 'n8n_webhook');
      
      if (error) throw error;
      
      const stats = {
        totalWebhooks: configs.length,
        activeWebhooks: configs.filter(c => c.is_active).length,
        lastTestSuccess: configs.filter(c => c.last_test_success).length,
        lastTestFailed: configs.filter(c => c.last_test_success === false).length
      };
      
      return stats;
      
    } catch (error) {
      console.error('Error obteniendo estadísticas de webhooks:', error);
      throw error;
    }
  }
}

// Funciones de compatibilidad con el servicio anterior
export const triggerReservationWebhook = CRMWebhookServiceEnhanced.triggerReservationWebhook;
export const triggerSegmentChangeWebhook = CRMWebhookServiceEnhanced.triggerSegmentChangeWebhook;

export default CRMWebhookServiceEnhanced;
