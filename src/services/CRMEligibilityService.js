// CRMEligibilityService.js - Motor de elegibilidad para mensajes automáticos
// Gestiona consentimientos, DND, ventanas horarias, cooldown y límites diarios

import { supabase } from '../lib/supabase';

/**
 * Servicio de elegibilidad para el sistema CRM
 * Determina si un cliente es elegible para recibir un mensaje automático
 */
export class CRMEligibilityService {
  
  /**
   * Verifica si un cliente es elegible para recibir un mensaje
   * @param {string} customerId - ID del cliente
   * @param {string} restaurantId - ID del restaurante
   * @param {string} automationRuleId - ID de la regla de automatización
   * @param {object} options - Opciones adicionales
   * @returns {Promise<{eligible: boolean, reasons: string[], channel: string|null}>}
   */
  static async checkEligibility(customerId, restaurantId, automationRuleId, options = {}) {
    try {
      console.log('🔍 Verificando elegibilidad:', { customerId, restaurantId, automationRuleId });
      
      // 1. Obtener datos del cliente
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('restaurant_id', restaurantId)
        .single();
      
      if (customerError || !customer) {
        return {
          eligible: false,
          reasons: ['customer_not_found'],
          channel: null
        };
      }
      
      // 2. Obtener regla de automatización
      const { data: rule, error: ruleError } = await supabase
        .from('automation_rules')
        .select('*, template:template_id(*)')
        .eq('id', automationRuleId)
        .eq('restaurant_id', restaurantId)
        .single();
      
      if (ruleError || !rule) {
        return {
          eligible: false,
          reasons: ['rule_not_found'],
          channel: null
        };
      }
      
      // 3. Verificar si la regla está activa
      if (!rule.is_active) {
        return {
          eligible: false,
          reasons: ['rule_inactive'],
          channel: null
        };
      }
      
      const reasons = [];
      let eligible = true;
      
      // 4. MASTER SWITCH: Notificaciones habilitadas
      if (!customer.notifications_enabled) {
        eligible = false;
        reasons.push('notifications_disabled');
      }
      
      // 5. Determinar canal preferido y verificar consentimientos
      const preferredChannel = this.determineChannel(customer, rule);
      
      if (!preferredChannel) {
        eligible = false;
        reasons.push('no_valid_channel');
      } else {
        // Verificar consentimientos específicos
        if (preferredChannel === 'whatsapp' && !customer.consent_whatsapp) {
          eligible = false;
          reasons.push('no_whatsapp_consent');
        }
        
        if (preferredChannel === 'email' && !customer.consent_email) {
          eligible = false;
          reasons.push('no_email_consent');
        }
        
        // Verificar que el cliente tenga los datos necesarios para el canal
        if (preferredChannel === 'whatsapp' && !customer.phone) {
          eligible = false;
          reasons.push('no_phone_number');
        }
        
        if (preferredChannel === 'email' && !customer.email) {
          eligible = false;
          reasons.push('no_email_address');
        }
      }
      
      // 6. Verificar cooldown period
      const cooldownCheck = await this.checkCooldownPeriod(customerId, automationRuleId, rule.cooldown_days);
      if (!cooldownCheck.eligible) {
        eligible = false;
        reasons.push('cooldown_active');
      }
      
      // 7. Verificar límite de ejecuciones por cliente
      const executionLimitCheck = await this.checkExecutionLimit(customerId, automationRuleId, rule.max_executions_per_customer);
      if (!executionLimitCheck.eligible) {
        eligible = false;
        reasons.push('max_executions_reached');
      }
      
      // 8. Verificar límite diario del tenant
      const dailyLimitCheck = await this.checkDailyLimit(restaurantId, rule.max_daily_executions);
      if (!dailyLimitCheck.eligible) {
        eligible = false;
        reasons.push('daily_limit_reached');
      }
      
      // 9. Verificar ventana horaria
      const timeWindowCheck = this.checkTimeWindow(rule.execution_hours_start, rule.execution_hours_end);
      if (!timeWindowCheck.eligible) {
        eligible = false;
        reasons.push('outside_time_window');
      }
      
      // 10. Verificar días de la semana
      const dayOfWeekCheck = this.checkDayOfWeek(rule.execution_days_of_week);
      if (!dayOfWeekCheck.eligible) {
        eligible = false;
        reasons.push('outside_allowed_days');
      }
      
      // 11. Verificaciones específicas por tipo de regla
      const specificChecks = await this.checkRuleSpecificConditions(customer, rule, options);
      if (!specificChecks.eligible) {
        eligible = false;
        reasons.push(...specificChecks.reasons);
      }
      
      console.log('✅ Elegibilidad verificada:', { eligible, reasons, channel: preferredChannel });
      
      return {
        eligible,
        reasons,
        channel: preferredChannel,
        customer,
        rule
      };
      
    } catch (error) {
      console.error('❌ Error verificando elegibilidad:', error);
      return {
        eligible: false,
        reasons: ['system_error'],
        channel: null,
        error: error.message
      };
    }
  }
  
  /**
   * Determina el canal óptimo para enviar el mensaje
   */
  static determineChannel(customer, rule) {
    const actionConfig = rule.action_config || {};
    const preferredChannel = actionConfig.channel || customer.preferred_channel;
    const fallbackToEmail = actionConfig.fallback_to_email;
    
    // Prioridad 1: WhatsApp (si tiene consentimiento y teléfono)
    if (preferredChannel === 'whatsapp' && customer.consent_whatsapp && customer.phone) {
      return 'whatsapp';
    }
    
    // Prioridad 2: Email (si tiene consentimiento y email)
    if (preferredChannel === 'email' && customer.consent_email && customer.email) {
      return 'email';
    }
    
    // Fallback a email si está configurado
    if (fallbackToEmail && customer.consent_email && customer.email) {
      return 'email';
    }
    
    // Fallback a WhatsApp si está configurado
    if (customer.consent_whatsapp && customer.phone) {
      return 'whatsapp';
    }
    
    return null; // No hay canal válido
  }
  
  /**
   * Verifica el período de cooldown
   */
  static async checkCooldownPeriod(customerId, automationRuleId, cooldownDays) {
    try {
      const { data: lastMessage, error } = await supabase
        .from('scheduled_messages')
        .select('created_at')
        .eq('customer_id', customerId)
        .eq('automation_rule_id', automationRuleId)
        .in('status', ['sent', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (!lastMessage || lastMessage.length === 0) {
        return { eligible: true }; // No hay mensajes previos
      }
      
      const lastMessageDate = new Date(lastMessage[0].created_at);
      const cooldownEndDate = new Date(lastMessageDate);
      cooldownEndDate.setDate(cooldownEndDate.getDate() + cooldownDays);
      
      const now = new Date();
      const eligible = now >= cooldownEndDate;
      
      return {
        eligible,
        lastMessageDate,
        cooldownEndDate,
        daysRemaining: eligible ? 0 : Math.ceil((cooldownEndDate - now) / (1000 * 60 * 60 * 24))
      };
      
    } catch (error) {
      console.error('Error checking cooldown period:', error);
      return { eligible: false, error: error.message };
    }
  }
  
  /**
   * Verifica el límite de ejecuciones por cliente
   */
  static async checkExecutionLimit(customerId, automationRuleId, maxExecutions) {
    try {
      const { data, error, count } = await supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('automation_rule_id', automationRuleId)
        .in('status', ['sent', 'delivered']);
      
      if (error) throw error;
      
      const executionCount = count || 0;
      const eligible = executionCount < maxExecutions;
      
      return {
        eligible,
        executionCount,
        maxExecutions,
        remainingExecutions: eligible ? maxExecutions - executionCount : 0
      };
      
    } catch (error) {
      console.error('Error checking execution limit:', error);
      return { eligible: false, error: error.message };
    }
  }
  
  /**
   * Verifica el límite diario del tenant
   */
  static async checkDailyLimit(restaurantId, maxDailyExecutions) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error, count } = await supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`)
        .in('status', ['planned', 'processing', 'sent', 'delivered']);
      
      if (error) throw error;
      
      const dailyCount = count || 0;
      const eligible = dailyCount < maxDailyExecutions;
      
      return {
        eligible,
        dailyCount,
        maxDailyExecutions,
        remainingToday: eligible ? maxDailyExecutions - dailyCount : 0
      };
      
    } catch (error) {
      console.error('Error checking daily limit:', error);
      return { eligible: false, error: error.message };
    }
  }
  
  /**
   * Verifica ventana horaria
   */
  static checkTimeWindow(startTime, endTime) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    const eligible = currentTime >= startTime && currentTime <= endTime;
    
    return {
      eligible,
      currentTime,
      windowStart: startTime,
      windowEnd: endTime
    };
  }
  
  /**
   * Verifica días de la semana permitidos
   */
  static checkDayOfWeek(allowedDays) {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7
    
    const eligible = allowedDays.includes(currentDay);
    
    return {
      eligible,
      currentDay,
      allowedDays
    };
  }
  
  /**
   * Verificaciones específicas por tipo de regla
   */
  static async checkRuleSpecificConditions(customer, rule, options) {
    const actionConfig = rule.action_config || {};
    const reasons = [];
    let eligible = true;
    
    // Para reglas de reactivación: verificar días mínimos de inactividad
    if (rule.trigger_event === 'daily_check' && rule.target_segment === 'inactivo') {
      const minDaysInactive = actionConfig.min_days_inactive || 60;
      const daysSinceLastVisit = customer.last_visit 
        ? Math.floor((new Date() - new Date(customer.last_visit)) / (1000 * 60 * 60 * 24))
        : 999;
      
      if (daysSinceLastVisit < minDaysInactive) {
        eligible = false;
        reasons.push('not_inactive_enough');
      }
    }
    
    // Para cambios de segmento: verificar segmento anterior
    if (rule.trigger_event === 'segment_changed' && actionConfig.from_segment) {
      const fromSegment = options.previousSegment;
      if (fromSegment !== actionConfig.from_segment) {
        eligible = false;
        reasons.push('wrong_previous_segment');
      }
    }
    
    // Para clientes en riesgo: verificar que realmente eran frecuentes antes
    if (rule.target_segment === 'en_riesgo') {
      if ((customer.total_visits || 0) < 3) {
        eligible = false;
        reasons.push('not_frequent_enough_for_risk');
      }
    }
    
    return { eligible, reasons };
  }
  
  /**
   * Obtiene estadísticas de elegibilidad para un restaurante
   */
  static async getEligibilityStats(restaurantId, dateRange = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);
      
      // Mensajes enviados en el período
      const { data: sentMessages, error: sentError } = await supabase
        .from('scheduled_messages')
        .select('status, channel_final, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString())
        .in('status', ['sent', 'delivered', 'failed', 'skipped']);
      
      if (sentError) throw sentError;
      
      // Clientes elegibles por segmento
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('notifications_enabled, consent_whatsapp, consent_email, phone, email, preferences')
        .eq('restaurant_id', restaurantId);
      
      if (customersError) throw customersError;
      
      const stats = {
        totalCustomers: customers.length,
        eligibleCustomers: customers.filter(c => c.notifications_enabled).length,
        withWhatsAppConsent: customers.filter(c => c.consent_whatsapp && c.phone).length,
        withEmailConsent: customers.filter(c => c.consent_email && c.email).length,
        messagesSent: sentMessages.filter(m => m.status === 'sent' || m.status === 'delivered').length,
        messagesFailed: sentMessages.filter(m => m.status === 'failed').length,
        messagesSkipped: sentMessages.filter(m => m.status === 'skipped').length,
        whatsappMessages: sentMessages.filter(m => m.channel_final === 'whatsapp').length,
        emailMessages: sentMessages.filter(m => m.channel_final === 'email').length,
        period: `${dateRange} días`
      };
      
      return stats;
      
    } catch (error) {
      console.error('Error getting eligibility stats:', error);
      throw error;
    }
  }
}

export default CRMEligibilityService;
