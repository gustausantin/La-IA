// CRMDailyJobEnhanced.js - Job diario mejorado para el sistema CRM
// Evaluación de reglas, creación de mensajes programados y mantenimiento

import { supabase } from '../lib/supabase';
import { recomputeCustomerStats, recomputeSegment } from './CRMService';
import CRMEligibilityService from './CRMEligibilityService';

/**
 * Job diario mejorado para el sistema CRM
 * Ejecuta evaluaciones, limpieza y generación de mensajes automáticos
 */
export class CRMDailyJobEnhanced {
  
  constructor() {
    this.jobId = `job_${Date.now()}`;
    this.stats = {
      customersProcessed: 0,
      segmentsUpdated: 0,
      messagesCreated: 0,
      rulesEvaluated: 0,
      errors: []
    };
  }
  
  /**
   * Ejecuta el job diario completo
   */
  async runDailyJob() {
    console.log(`🚀 Iniciando CRM Daily Job ${this.jobId}...`);
    const startTime = Date.now();
    
    try {
      // 1. Obtener todos los restaurantes activos
      const restaurants = await this.getActiveRestaurants();
      console.log(`📍 Procesando ${restaurants.length} restaurantes activos`);
      
      // 2. Procesar cada restaurante
      for (const restaurant of restaurants) {
        await this.processRestaurant(restaurant);
      }
      
      // 3. Limpieza y mantenimiento global
      await this.performMaintenance();
      
      const duration = Date.now() - startTime;
      console.log(`✅ CRM Daily Job completado en ${duration}ms`);
      console.log('📊 Estadísticas finales:', this.stats);
      
      // 4. Registrar ejecución del job
      await this.logJobExecution(true, duration);
      
      return {
        success: true,
        duration,
        stats: this.stats
      };
      
    } catch (error) {
      console.error(`❌ Error en CRM Daily Job:`, error);
      this.stats.errors.push(error.message);
      
      await this.logJobExecution(false, Date.now() - startTime, error);
      
      return {
        success: false,
        error: error.message,
        stats: this.stats
      };
    }
  }
  
  /**
   * Obtiene todos los restaurantes activos
   */
  async getActiveRestaurants() {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, email, phone')
        .eq('active', true);
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('Error obteniendo restaurantes activos:', error);
      throw error;
    }
  }
  
  /**
   * Procesa un restaurante específico
   */
  async processRestaurant(restaurant) {
    console.log(`🏪 Procesando restaurante: ${restaurant.name}`);
    
    try {
      // 1. Actualizar estadísticas de todos los clientes
      await this.updateCustomerStats(restaurant.id);
      
      // 2. Recalcular segmentación automática
      await this.updateCustomerSegments(restaurant.id);
      
      // 3. Evaluar reglas de automatización
      await this.evaluateAutomationRules(restaurant.id);
      
      console.log(`✅ Restaurante ${restaurant.name} procesado exitosamente`);
      
    } catch (error) {
      console.error(`❌ Error procesando restaurante ${restaurant.name}:`, error);
      this.stats.errors.push(`${restaurant.name}: ${error.message}`);
    }
  }
  
  /**
   * Actualiza estadísticas de clientes para un restaurante
   */
  async updateCustomerStats(restaurantId) {
    try {
      // Obtener todos los clientes del restaurante
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id')
        .eq('restaurant_id', restaurantId);
      
      if (error) throw error;
      
      console.log(`📊 Actualizando stats de ${customers.length} clientes...`);
      
      // Actualizar stats en lotes para mejor performance
      const batchSize = 20;
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(customer => 
            recomputeCustomerStats(customer.id, restaurantId)
          )
        );
        
        this.stats.customersProcessed += batch.length;
      }
      
      console.log(`✅ Stats actualizados para ${customers.length} clientes`);
      
    } catch (error) {
      console.error('Error actualizando customer stats:', error);
      throw error;
    }
  }
  
  /**
   * Recalcula segmentación automática para todos los clientes
   */
  async updateCustomerSegments(restaurantId) {
    try {
      // Obtener clientes que necesitan recalculo de segmento
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, preferences, total_visits, total_spent, last_visit')
        .eq('restaurant_id', restaurantId);
      
      if (error) throw error;
      
      console.log(`🎯 Recalculando segmentos de ${customers.length} clientes...`);
      
      let segmentsUpdated = 0;
      
      for (const customer of customers) {
        try {
          const previousSegment = customer.preferences?.segment || 'nuevo';
          
          // Recalcular segmento
          await recomputeSegment(customer.id, restaurantId);
          
          // Verificar si cambió el segmento
          const { data: updatedCustomer } = await supabase
            .from('customers')
            .select('preferences')
            .eq('id', customer.id)
            .single();
          
          const newSegment = updatedCustomer?.preferences?.segment;
          
          if (newSegment && newSegment !== previousSegment) {
            segmentsUpdated++;
            
            // Disparar evento de cambio de segmento
            await this.triggerSegmentChangeEvent(
              customer.id, 
              restaurantId, 
              previousSegment, 
              newSegment
            );
          }
          
        } catch (customerError) {
          console.error(`Error procesando cliente ${customer.id}:`, customerError);
          this.stats.errors.push(`Cliente ${customer.id}: ${customerError.message}`);
        }
      }
      
      this.stats.segmentsUpdated += segmentsUpdated;
      console.log(`✅ ${segmentsUpdated} segmentos actualizados`);
      
    } catch (error) {
      console.error('Error recalculando segmentos:', error);
      throw error;
    }
  }
  
  /**
   * Evalúa todas las reglas de automatización para un restaurante
   */
  async evaluateAutomationRules(restaurantId) {
    try {
      // Obtener reglas activas para daily_check
      const { data: rules, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .eq('trigger_event', 'daily_check');
      
      if (error) throw error;
      
      console.log(`📋 Evaluando ${rules.length} reglas de automatización...`);
      
      for (const rule of rules) {
        await this.evaluateRule(rule, restaurantId);
        this.stats.rulesEvaluated++;
      }
      
      console.log(`✅ ${rules.length} reglas evaluadas`);
      
    } catch (error) {
      console.error('Error evaluando reglas de automatización:', error);
      throw error;
    }
  }
  
  /**
   * Evalúa una regla específica
   */
  async evaluateRule(rule, restaurantId) {
    try {
      console.log(`🔍 Evaluando regla: ${rule.name}`);
      
      // 1. Obtener clientes candidatos según el segmento objetivo
      const candidates = await this.getRuleCandidates(rule, restaurantId);
      
      console.log(`👥 ${candidates.length} candidatos para regla ${rule.name}`);
      
      // 2. Evaluar elegibilidad y crear mensajes
      let messagesCreated = 0;
      
      for (const customer of candidates) {
        try {
          // Verificar elegibilidad
          const eligibility = await CRMEligibilityService.checkEligibility(
            customer.id,
            restaurantId,
            rule.id
          );
          
          if (eligibility.eligible) {
            // Crear mensaje programado
            const messageCreated = await this.createScheduledMessage(
              customer,
              rule,
              restaurantId,
              eligibility.channel
            );
            
            if (messageCreated) {
              messagesCreated++;
            }
          } else {
            console.log(`⏭️ Cliente ${customer.name} no elegible:`, eligibility.reasons);
          }
          
        } catch (customerError) {
          console.error(`Error evaluando cliente ${customer.id}:`, customerError);
        }
      }
      
      this.stats.messagesCreated += messagesCreated;
      console.log(`📨 ${messagesCreated} mensajes creados para regla ${rule.name}`);
      
      // 3. Actualizar estadísticas de la regla
      await this.updateRuleStats(rule.id, messagesCreated);
      
    } catch (error) {
      console.error(`Error evaluando regla ${rule.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtiene candidatos para una regla específica
   */
  async getRuleCandidates(rule, restaurantId) {
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('notifications_enabled', true);
      
      // Filtrar por segmento objetivo
      if (rule.target_segment && rule.target_segment !== 'all') {
        query = query.contains('preferences', { segment: rule.target_segment });
      }
      
      // Filtros específicos según el tipo de regla
      const actionConfig = rule.action_config || {};
      
      // Para reactivación: clientes inactivos
      if (rule.target_segment === 'inactivo' && actionConfig.min_days_inactive) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - actionConfig.min_days_inactive);
        
        query = query.or(`last_visit.is.null,last_visit.lt.${cutoffDate.toISOString()}`);
      }
      
      // Para clientes en riesgo: que tenían visitas frecuentes
      if (rule.target_segment === 'en_riesgo') {
        query = query.gte('total_visits', 3);
      }
      
      const { data, error } = await query.limit(100); // Límite de seguridad
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('Error obteniendo candidatos para regla:', error);
      throw error;
    }
  }
  
  /**
   * Crea un mensaje programado
   */
  async createScheduledMessage(customer, rule, restaurantId, channel) {
    try {
      // Obtener la plantilla asociada
      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', rule.template_id)
        .single();
      
      if (templateError || !template) {
        throw new Error('Plantilla no encontrada');
      }
      
      // Renderizar contenido con variables del cliente
      const renderedContent = await this.renderTemplate(template, customer, restaurantId);
      
      // Calcular cuándo enviar (considerando delay)
      const scheduledFor = new Date();
      if (template.send_delay_hours > 0) {
        scheduledFor.setHours(scheduledFor.getHours() + template.send_delay_hours);
      }
      
      // Ajustar a ventana horaria permitida
      this.adjustToTimeWindow(scheduledFor, rule);
      
      // Crear el mensaje programado
      const messageData = {
        restaurant_id: restaurantId,
        customer_id: customer.id,
        automation_rule_id: rule.id,
        template_id: template.id,
        scheduled_for: scheduledFor.toISOString(),
        channel_planned: channel,
        subject_rendered: template.subject ? await this.renderTemplate({ content_markdown: template.subject }, customer, restaurantId) : null,
        content_rendered: renderedContent,
        variables_used: this.extractVariablesUsed(template, customer),
        status: 'planned'
      };
      
      const { error } = await supabase
        .from('scheduled_messages')
        .insert([messageData]);
      
      if (error) throw error;
      
      console.log(`📅 Mensaje programado para ${customer.name} - ${scheduledFor.toLocaleString()}`);
      return true;
      
    } catch (error) {
      console.error('Error creando mensaje programado:', error);
      return false;
    }
  }
  
  /**
   * Renderiza una plantilla con datos del cliente
   */
  async renderTemplate(template, customer, restaurantId) {
    try {
      // Obtener datos del restaurante
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('name, email, phone')
        .eq('id', restaurantId)
        .single();
      
      // Preparar variables
      const customerData = {
        first_name: customer.name?.split(' ')[0] || 'Cliente',
        name: customer.name || 'Cliente',
        email: customer.email,
        phone: customer.phone,
        total_visits: customer.total_visits || 0,
        total_spent: customer.total_spent || 0,
        last_visit: customer.last_visit
      };
      
      const restaurantData = {
        name: restaurant?.name || 'Nuestro Restaurante',
        email: restaurant?.email || '',
        phone: restaurant?.phone || ''
      };
      
      // Renderizar usando función SQL (más eficiente)
      const { data: rendered, error } = await supabase
        .rpc('render_message_template', {
          template_content: template.content_markdown,
          customer_data: customerData,
          restaurant_data: restaurantData
        });
      
      if (error) throw error;
      
      return rendered;
      
    } catch (error) {
      console.error('Error renderizando plantilla:', error);
      return template.content_markdown; // Fallback al contenido original
    }
  }
  
  /**
   * Ajusta la hora programada a la ventana horaria permitida
   */
  adjustToTimeWindow(scheduledDate, rule) {
    const startHour = parseInt(rule.execution_hours_start.split(':')[0]);
    const endHour = parseInt(rule.execution_hours_end.split(':')[0]);
    const currentHour = scheduledDate.getHours();
    
    // Si está fuera de la ventana, mover al inicio de la ventana del siguiente día hábil
    if (currentHour < startHour || currentHour > endHour) {
      scheduledDate.setHours(startHour, 0, 0, 0);
      
      // Si es muy tarde, mover al día siguiente
      if (currentHour > endHour) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }
    }
    
    // Verificar días de la semana permitidos
    const dayOfWeek = scheduledDate.getDay() === 0 ? 7 : scheduledDate.getDay();
    if (!rule.execution_days_of_week.includes(dayOfWeek)) {
      // Mover al siguiente día permitido
      let daysToAdd = 1;
      let nextDay = (dayOfWeek % 7) + 1;
      
      while (!rule.execution_days_of_week.includes(nextDay) && daysToAdd < 7) {
        daysToAdd++;
        nextDay = (nextDay % 7) + 1;
      }
      
      scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);
      scheduledDate.setHours(startHour, 0, 0, 0);
    }
  }
  
  /**
   * Extrae las variables utilizadas en una plantilla
   */
  extractVariablesUsed(template, customer) {
    const variables = {};
    
    if (template.variables && Array.isArray(template.variables)) {
      template.variables.forEach(varName => {
        switch (varName) {
          case 'first_name':
            variables[varName] = customer.name?.split(' ')[0] || 'Cliente';
            break;
          case 'name':
            variables[varName] = customer.name || 'Cliente';
            break;
          case 'visits_count':
            variables[varName] = customer.total_visits || 0;
            break;
          case 'total_spent':
            variables[varName] = customer.total_spent || 0;
            break;
          case 'days_since_last_visit':
            if (customer.last_visit) {
              const days = Math.floor((new Date() - new Date(customer.last_visit)) / (1000 * 60 * 60 * 24));
              variables[varName] = days;
            } else {
              variables[varName] = 'muchos';
            }
            break;
          default:
            variables[varName] = customer[varName] || '';
        }
      });
    }
    
    return variables;
  }
  
  /**
   * Dispara evento de cambio de segmento
   */
  async triggerSegmentChangeEvent(customerId, restaurantId, previousSegment, newSegment) {
    try {
      console.log(`🔄 Cambio de segmento detectado: ${previousSegment} → ${newSegment}`);
      
      // Buscar reglas que se disparen por cambio de segmento
      const { data: rules, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .eq('trigger_event', 'segment_changed')
        .eq('target_segment', newSegment);
      
      if (error) throw error;
      
      // Evaluar cada regla aplicable
      for (const rule of rules) {
        const eligibility = await CRMEligibilityService.checkEligibility(
          customerId,
          restaurantId,
          rule.id,
          { previousSegment }
        );
        
        if (eligibility.eligible) {
          const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();
          
          await this.createScheduledMessage(
            customer,
            rule,
            restaurantId,
            eligibility.channel
          );
          
          this.stats.messagesCreated++;
        }
      }
      
    } catch (error) {
      console.error('Error procesando cambio de segmento:', error);
    }
  }
  
  /**
   * Actualiza estadísticas de una regla
   */
  async updateRuleStats(ruleId, messagesCreated) {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .update({
          last_executed_at: new Date().toISOString(),
          execution_count: supabase.raw('execution_count + 1')
        })
        .eq('id', ruleId);
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error actualizando stats de regla:', error);
    }
  }
  
  /**
   * Realiza mantenimiento y limpieza
   */
  async performMaintenance() {
    console.log('🧹 Realizando mantenimiento...');
    
    try {
      // 1. Limpiar mensajes antiguos fallidos (más de 7 días)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { error: cleanupError } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('status', 'failed')
        .lt('created_at', sevenDaysAgo.toISOString());
      
      if (cleanupError) {
        console.error('Error en limpieza de mensajes:', cleanupError);
      }
      
      // 2. Limpiar logs de interacción antiguos (más de 90 días)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { error: logsCleanupError } = await supabase
        .from('interaction_logs')
        .delete()
        .lt('created_at', ninetyDaysAgo.toISOString());
      
      if (logsCleanupError) {
        console.error('Error en limpieza de logs:', logsCleanupError);
      }
      
      console.log('✅ Mantenimiento completado');
      
    } catch (error) {
      console.error('Error en mantenimiento:', error);
    }
  }
  
  /**
   * Registra la ejecución del job
   */
  async logJobExecution(success, duration, error = null) {
    try {
      // En producción, esto se guardaría en una tabla de logs de jobs
      console.log('📝 Registrando ejecución del job:', {
        jobId: this.jobId,
        success,
        duration,
        stats: this.stats,
        error: error?.message
      });
      
    } catch (logError) {
      console.error('Error registrando ejecución del job:', logError);
    }
  }
}

// Función helper para ejecutar el job diario
export const runCRMDailyJob = async () => {
  const job = new CRMDailyJobEnhanced();
  return await job.runDailyJob();
};

export default CRMDailyJobEnhanced;
