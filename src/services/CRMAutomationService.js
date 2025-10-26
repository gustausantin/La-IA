// ========================================
// CRM AUTOMATION SERVICE - SISTEMA COMPLETO
// Fecha: 28 Enero 2025
// Descripción: Automatizaciones inteligentes para CRM con cooldown y consent
// ========================================

import { supabase } from '../lib/supabase';
import { format, differenceInDays, subDays, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * PROCESADOR DE AUTOMATIZACIONES CRM
 * Sistema central que ejecuta reglas de automatización
 */
export class CRMAutomationProcessor {
    constructor(restaurantId) {
        this.restaurantId = restaurantId;
        this.executionStats = {
            total_processed: 0,
            successful_sends: 0,
            skipped_cooldown: 0,
            skipped_consent: 0,
            errors: 0
        };
    }

    /**
     * EJECUTAR TODAS LAS AUTOMATIZACIONES ACTIVAS
     */
    async executeAllAutomations() {
        try {
            console.log(`🤖 CRM: Iniciando automatizaciones para restaurante ${this.restaurantId}`);
            
            // 1. Obtener reglas activas
            const { data: activeRules, error: rulesError } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('restaurant_id', this.restaurantId)
                .eq('is_active', true);
                
            if (rulesError) {
                console.error('❌ Error obteniendo reglas:', rulesError);
                throw rulesError;
            }
            
            if (!activeRules?.length) {
                console.log('ℹ️ No hay reglas activas para procesar');
                return { success: true, stats: this.executionStats };
            }
            
            // 2. Ejecutar cada regla
            for (const rule of activeRules) {
                await this.executeAutomationRule(rule);
            }
            
            console.log('✅ Automatizaciones completadas:', this.executionStats);
            return { success: true, stats: this.executionStats };
            
        } catch (error) {
            console.error('❌ Error en executeAllAutomations:', error);
            return { success: false, error: error.message, stats: this.executionStats };
        }
    }

    /**
     * EJECUTAR UNA REGLA ESPECÍFICA
     */
    async executeAutomationRule(rule) {
        try {
            console.log(`🎯 Procesando regla: ${rule.name} (${rule.rule_type})`);
            
            // 1. Verificar si es hora de ejecutar
            if (!this.isExecutionTime(rule)) {
                console.log(`⏰ Fuera de horario de ejecución para regla ${rule.name}`);
                return;
            }
            
            // 2. Obtener clientes que cumplen la condición
            const eligibleCustomers = await this.getEligibleCustomers(rule);
            
            if (!eligibleCustomers?.length) {
                console.log(`ℹ️ No hay clientes elegibles para regla ${rule.name}`);
                return;
            }
            
            console.log(`📋 ${eligibleCustomers.length} clientes elegibles para ${rule.name}`);
            
            // 3. Procesar cada cliente elegible
            for (const customer of eligibleCustomers) {
                await this.processCustomerForRule(customer, rule);
            }
            
            // 4. Actualizar estadísticas de la regla
            await this.updateRuleStats(rule);
            
        } catch (error) {
            console.error(`❌ Error ejecutando regla ${rule.name}:`, error);
            this.executionStats.errors++;
        }
    }

    /**
     * VERIFICAR SI ES HORA DE EJECUTAR LA REGLA
     */
    isExecutionTime(rule) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0=Domingo, 1=Lunes, etc.
        
        // Convertir día JS (0=Dom) a formato DB (1=Lun, 7=Dom)
        const currentDayDB = currentDay === 0 ? 7 : currentDay;
        
        // Verificar día de la semana
        if (rule.execution_days_of_week && !rule.execution_days_of_week.includes(currentDayDB)) {
            return false;
        }
        
        // Verificar horario
        if (rule.execution_hours_start && rule.execution_hours_end) {
            const startHour = parseInt(rule.execution_hours_start.split(':')[0]);
            const endHour = parseInt(rule.execution_hours_end.split(':')[0]);
            
            if (currentHour < startHour || currentHour > endHour) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * OBTENER CLIENTES ELEGIBLES PARA UNA REGLA
     */
    async getEligibleCustomers(rule) {
        try {
            // Base query para clientes
            let query = supabase
                .from('customers')
                .select('*')
                .eq('restaurant_id', this.restaurantId);
            
            // Aplicar filtros según el tipo de regla
            switch (rule.rule_type) {
                case 'inactivo':
                    const inactiveDays = rule.trigger_condition?.days_since_last_visit || 60;
                    const cutoffDate = subDays(new Date(), inactiveDays).toISOString();
                    query = query
                        .lt('last_visit_at', cutoffDate)
                        .eq('segment_auto', 'inactivo')
                        .eq('consent_email', true);
                    break;
                    
                case 'vip_upgrade':
                    query = query
                        .eq('segment_auto', 'vip')
                        .eq('consent_email', true);
                    break;
                    
                case 'en_riesgo':
                    query = query
                        .eq('segment_auto', 'en_riesgo')
                        .eq('consent_email', true);
                    break;
                    
                default:
                    console.warn(`Tipo de regla no implementado: ${rule.rule_type}`);
                    return [];
            }
            
            const { data: customers, error } = await query;
            
            if (error) {
                console.error('❌ Error obteniendo clientes elegibles:', error);
                throw error;
            }
            
            // Filtrar por cooldown y límites
            const filteredCustomers = [];
            
            for (const customer of customers || []) {
                // Verificar cooldown
                if (await this.isInCooldown(customer.id, rule)) {
                    this.executionStats.skipped_cooldown++;
                    continue;
                }
                
                // Verificar límites de ejecución
                if (await this.hasExceededExecutionLimit(customer.id, rule)) {
                    console.log(`📊 Cliente ${customer.id} ha excedido límite de ejecuciones`);
                    continue;
                }
                
                filteredCustomers.push(customer);
            }
            
            return filteredCustomers;
            
        } catch (error) {
            console.error('❌ Error en getEligibleCustomers:', error);
            throw error;
        }
    }

    /**
     * VERIFICAR COOLDOWN PARA UN CLIENTE
     */
    async isInCooldown(customerId, rule) {
        try {
            const cooldownDate = subDays(new Date(), rule.cooldown_days || 30);
            
            const { data: recentInteractions, error } = await supabase
                .from('customer_interactions')
                .select('sent_at')
                .eq('customer_id', customerId)
                .eq('interaction_type', rule.rule_type)
                .gte('sent_at', cooldownDate.toISOString())
                .limit(1);
                
            if (error) throw error;
            
            return recentInteractions?.length > 0;
            
        } catch (error) {
            console.error('❌ Error verificando cooldown:', error);
            return true; // En caso de error, asumir que está en cooldown
        }
    }

    /**
     * VERIFICAR LÍMITE DE EJECUCIONES POR CLIENTE
     */
    async hasExceededExecutionLimit(customerId, rule) {
        try {
            if (!rule.max_executions_per_customer) return false;
            
            const windowStart = subDays(new Date(), rule.execution_window_days || 90);
            
            const { data: executions, error } = await supabase
                .from('automation_rule_executions')
                .select('id')
                .eq('customer_id', customerId)
                .eq('rule_id', rule.id)
                .eq('status', 'executed')
                .gte('executed_at', windowStart.toISOString());
                
            if (error) throw error;
            
            return (executions?.length || 0) >= rule.max_executions_per_customer;
            
        } catch (error) {
            console.error('❌ Error verificando límite de ejecuciones:', error);
            return true; // En caso de error, asumir que ha excedido el límite
        }
    }

    /**
     * PROCESAR UN CLIENTE PARA UNA REGLA ESPECÍFICA
     */
    async processCustomerForRule(customer, rule) {
        try {
            this.executionStats.total_processed++;
            
            // 1. Crear registro de ejecución
            const { data: execution, error: executionError } = await supabase
                .from('automation_rule_executions')
                .insert({
                    restaurant_id: this.restaurantId,
                    rule_id: rule.id,
                    customer_id: customer.id,
                    status: 'pending',
                    executed_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (executionError) {
                console.error('❌ Error creando registro de ejecución:', executionError);
                throw executionError;
            }
            
            // 2. Obtener plantilla apropiada
            const template = await this.getTemplateForRule(rule);
            
            if (!template) {
                console.warn(`⚠️ No se encontró plantilla para regla ${rule.name}`);
                await this.updateExecutionStatus(execution.id, 'skipped', 'No template found');
                return;
            }
            
            // 3. Generar contenido personalizado
            const personalizedContent = await this.personalizeTemplate(template, customer);
            
            // 4. Crear interacción pendiente
            const { data: interaction, error: interactionError } = await supabase
                .from('customer_interactions')
                .insert({
                    restaurant_id: this.restaurantId,
                    customer_id: customer.id,
                    channel: this.getChannelForActionType(rule.action_type),
                    template_id: template.id,
                    interaction_type: rule.rule_type,
                    subject: personalizedContent.subject,
                    content: personalizedContent.content,
                    status: 'pending',
                    payload: {
                        automation_rule_id: rule.id,
                        execution_id: execution.id,
                        variables_used: personalizedContent.variables,
                        created_automatically: true
                    }
                })
                .select()
                .single();
                
            if (interactionError) {
                console.error('❌ Error creando interacción:', interactionError);
                await this.updateExecutionStatus(execution.id, 'failed', interactionError.message);
                this.executionStats.errors++;
                return;
            }
            
            // 5. Actualizar registro de ejecución
            await this.updateExecutionStatus(execution.id, 'executed', null, interaction.id);
            
            // 6. Simular envío (en producción aquí iría la integración real)
            await this.simulateSend(interaction, customer);
            
            this.executionStats.successful_sends++;
            console.log(`✅ Interacción creada para ${customer.name}: ${rule.rule_type}`);
            
        } catch (error) {
            console.error(`❌ Error procesando cliente ${customer.id}:`, error);
            this.executionStats.errors++;
        }
    }

    /**
     * OBTENER PLANTILLA PARA UNA REGLA
     */
    async getTemplateForRule(rule) {
        try {
            const channel = this.getChannelForActionType(rule.action_type);
            
            const { data: template, error } = await supabase
                .from('message_templates')
                .select('*')
                .eq('restaurant_id', this.restaurantId)
                .eq('template_type', rule.rule_type)
                .eq('channel', channel)
                .eq('is_active', true)
                .limit(1)
                .single();
                
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                throw error;
            }
            
            return template;
            
        } catch (error) {
            console.error('❌ Error obteniendo plantilla:', error);
            return null;
        }
    }

    /**
     * PERSONALIZAR PLANTILLA CON DATOS DEL CLIENTE
     */
    async personalizeTemplate(template, customer) {
        try {
            let content = template.content || template.body_markdown || '';
            let subject = template.subject || '';
            
            // Variables disponibles
            const variables = {
                first_name: customer.first_name || customer.name?.split(' ')[0] || 'Cliente',
                full_name: customer.name || 'Cliente',
                last_visit_at: customer.last_visit_at 
                    ? format(parseISO(customer.last_visit_at), 'dd \'de\' MMMM yyyy', { locale: es })
                    : 'hace tiempo',
                visits_count: customer.visits_count || 0,
                total_spent: customer.total_spent ? `€${customer.total_spent.toFixed(2)}` : '€0.00',
                days_since_last_visit: customer.last_visit_at 
                    ? differenceInDays(new Date(), parseISO(customer.last_visit_at))
                    : 999,
                restaurant_name: 'Tu Restaurante' // TODO: obtener de configuración
            };
            
            // Reemplazar variables en contenido y asunto
            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                content = content.replace(regex, value);
                subject = subject.replace(regex, value);
            });
            
            return {
                content,
                subject,
                variables: Object.keys(variables)
            };
            
        } catch (error) {
            console.error('❌ Error personalizando plantilla:', error);
            return {
                content: template.content || 'Mensaje automático',
                subject: template.subject || 'Mensaje de tu restaurante',
                variables: []
            };
        }
    }

    /**
     * OBTENER CANAL PARA TIPO DE ACCIÓN
     */
    getChannelForActionType(actionType) {
        const channelMap = {
            'send_email': 'email',
            'send_sms': 'sms',
            'send_whatsapp': 'whatsapp',
            'create_notification': 'web_chat'
        };
        
        return channelMap[actionType] || 'email';
    }

    /**
     * ACTUALIZAR ESTADO DE EJECUCIÓN
     */
    async updateExecutionStatus(executionId, status, errorMessage = null, interactionId = null) {
        try {
            const updateData = {
                status,
                result_data: {
                    completed_at: new Date().toISOString(),
                    error_message: errorMessage
                }
            };
            
            if (interactionId) {
                updateData.interaction_id = interactionId;
            }
            
            if (errorMessage) {
                updateData.error_message = errorMessage;
            }
            
            const { error } = await supabase
                .from('automation_rule_executions')
                .update(updateData)
                .eq('id', executionId);
                
            if (error) {
                console.error('❌ Error actualizando estado de ejecución:', error);
            }
            
        } catch (error) {
            console.error('❌ Error en updateExecutionStatus:', error);
        }
    }

    /**
     * SIMULAR ENVÍO (para desarrollo)
     */
    async simulateSend(interaction, customer) {
        try {
            // En desarrollo: simular el envío
            console.log(`📧 [SIMULADO] Enviando ${interaction.channel} a ${customer.name}:`);
            console.log(`   Asunto: ${interaction.subject}`);
            console.log(`   Contenido: ${interaction.content.substring(0, 100)}...`);
            
            // Simular delay y actualizar estado
            setTimeout(async () => {
                await supabase
                    .from('customer_interactions')
                    .update({
                        status: 'sent',
                        sent_at: new Date().toISOString()
                    })
                    .eq('id', interaction.id);
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error simulando envío:', error);
        }
    }

    /**
     * ACTUALIZAR ESTADÍSTICAS DE LA REGLA
     */
    async updateRuleStats(rule) {
        try {
            const { error } = await supabase
                .from('automation_rules')
                .update({
                    last_executed_at: new Date().toISOString(),
                    total_executions: (rule.total_executions || 0) + 1,
                    successful_executions: (rule.successful_executions || 0) + 1
                })
                .eq('id', rule.id);
                
            if (error) {
                console.error('❌ Error actualizando stats de regla:', error);
            }
            
        } catch (error) {
            console.error('❌ Error en updateRuleStats:', error);
        }
    }
}

/**
 * FUNCIÓN PRINCIPAL PARA EJECUTAR AUTOMATIZACIONES
 * Esta función se llamará desde un cron job o webhook
 */
export async function runCRMAutomations(restaurantId) {
    try {
        console.log(`🚀 Iniciando automatizaciones CRM para restaurante ${restaurantId}`);
        
        const processor = new CRMAutomationProcessor(restaurantId);
        const result = await processor.executeAllAutomations();
        
        console.log(`📊 Resultado automatizaciones:`, result);
        return result;
        
    } catch (error) {
        console.error('❌ Error en runCRMAutomations:', error);
        return { success: false, error: error.message };
    }
}

/**
 * EJECUTAR AUTOMATIZACIONES PARA TODOS LOS RESTAURANTES
 */
export async function runGlobalCRMAutomations() {
    try {
        console.log('🌍 Ejecutando automatizaciones globales CRM');
        
        // Obtener todos los restaurantes activos
        const { data: restaurants, error } = await supabase
            .from('restaurants')
            .select('id, name')
            .eq('active', true);
            
        if (error) {
            console.error('❌ Error obteniendo restaurantes:', error);
            throw error;
        }
        
        const results = [];
        
        // Ejecutar para cada restaurante
        for (const restaurant of restaurants || []) {
            console.log(`🏪 Procesando restaurante: ${restaurant.name} (${restaurant.id})`);
            const result = await runCRMAutomations(restaurant.id);
            results.push({
                restaurant_id: restaurant.id,
                restaurant_name: restaurant.name,
                ...result
            });
        }
        
        console.log('✅ Automatizaciones globales completadas');
        return {
            success: true,
            restaurants_processed: results.length,
            results
        };
        
    } catch (error) {
        console.error('❌ Error en runGlobalCRMAutomations:', error);
        return { success: false, error: error.message };
    }
}

export default {
    CRMAutomationProcessor,
    runCRMAutomations,
    runGlobalCRMAutomations
};
