// ========================================
// CRM SERVICE - LÓGICA DE NEGOCIO COMPLETA
// Fecha: 28 Enero 2025
// Descripción: Servicios para CRM avanzado con segmentación automática
// ========================================

import { supabase } from '../lib/supabase';
import { format, differenceInDays, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { triggerSegmentChangeWebhook, triggerReservationWebhook } from './CRMWebhookService';

/**
 * CONFIGURACIÓN DE UMBRALES CRM
 * Estos valores pueden configurarse desde la UI
 */
export const CRM_THRESHOLDS = {
    INACTIVO_DAYS: 60,        // Días sin visita para considerar inactivo
    VIP_VISITS: 5,            // Visitas mínimas para VIP en 90 días
    VIP_SPEND: 500,           // Gasto mínimo para VIP
    ALTO_VALOR_SPEND: 1000,   // Gasto para alto valor
    EN_RIESGO_DROP: 50,       // % caída en visitas para riesgo
    REGULAR_VISITS_MIN: 3,    // Visitas mínimas para regular
    REGULAR_VISITS_MAX: 4,    // Visitas máximas para regular
    PERIOD_DAYS: 90           // Período de evaluación en días
};

/**
 * REGLAS DE SEGMENTACIÓN AUTOMÁTICA
 */
export const SEGMENTATION_RULES = {
    nuevo: (customer, reservations, daysSinceLastVisit) => {
        return customer.visits_count === 0;
    },
    
    ocasional: (customer, reservations, daysSinceLastVisit) => {
        const recentVisits = reservations.filter(r => 
            differenceInDays(new Date(), parseISO(r.created_at)) <= CRM_THRESHOLDS.PERIOD_DAYS
        ).length;
        return recentVisits >= 1 && recentVisits <= 2 && customer.visits_count > 0;
    },
    
    regular: (customer, reservations, daysSinceLastVisit) => {
        const recentVisits = reservations.filter(r => 
            differenceInDays(new Date(), parseISO(r.created_at)) <= CRM_THRESHOLDS.PERIOD_DAYS
        ).length;
        return recentVisits >= CRM_THRESHOLDS.REGULAR_VISITS_MIN && 
               recentVisits <= CRM_THRESHOLDS.REGULAR_VISITS_MAX;
    },
    
    vip: (customer, reservations, daysSinceLastVisit) => {
        const recentVisits = reservations.filter(r => 
            differenceInDays(new Date(), parseISO(r.created_at)) <= CRM_THRESHOLDS.PERIOD_DAYS
        ).length;
        return recentVisits >= CRM_THRESHOLDS.VIP_VISITS || 
               customer.total_spent >= CRM_THRESHOLDS.VIP_SPEND;
    },
    
    inactivo: (customer, reservations, daysSinceLastVisit) => {
        return daysSinceLastVisit >= CRM_THRESHOLDS.INACTIVO_DAYS && customer.visits_count > 0;
    },
    
    en_riesgo: (customer, reservations, daysSinceLastVisit) => {
        if (customer.visits_count < 3) return false;
        
        const last90Days = reservations.filter(r => 
            differenceInDays(new Date(), parseISO(r.created_at)) <= 90
        ).length;
        
        const previous90Days = reservations.filter(r => {
            const daysDiff = differenceInDays(new Date(), parseISO(r.created_at));
            return daysDiff > 90 && daysDiff <= 180;
        }).length;
        
        if (previous90Days === 0) return false;
        
        const dropPercentage = ((previous90Days - last90Days) / previous90Days) * 100;
        return dropPercentage >= CRM_THRESHOLDS.EN_RIESGO_DROP;
    },
    
    alto_valor: (customer, reservations, daysSinceLastVisit) => {
        return customer.total_spent >= CRM_THRESHOLDS.ALTO_VALOR_SPEND;
    }
};

/**
 * RECOMPUTAR ESTADÍSTICAS DE CLIENTE
 * Recalcula visits_count, total_spent, avg_ticket, last_visit_at
 */
export async function recomputeCustomerStats(customerId, businessId) {
    try {
        console.log(`🔄 Recomputando stats para cliente ${customerId}`);
        
        // 1. Obtener reservas completadas del cliente
        const { data: reservations, error: reservationsError } = await supabase
            .from('appointments')
            .select('*')
            .eq('customer_id', customerId)
            .eq('business_id', businessId)
            .in('status', ['confirmed', 'completed'])
            .order('created_at', { ascending: false });
            
        if (reservationsError) {
            console.error('❌ Error obteniendo reservas:', reservationsError);
            throw reservationsError;
        }
        
        // 2. Calcular estadísticas
        const visits_count = reservations?.length || 0;
        const total_spent = reservations?.reduce((sum, r) => sum + (parseFloat(r.spend_amount) || 0), 0) || 0;
        const avg_ticket = visits_count > 0 ? (total_spent / visits_count) : 0;
        const last_visit_at = reservations?.length > 0 ? reservations[0].created_at : null;
        
        // 3. Calcular items preferidos (simulado por ahora)
        const preferred_items = reservations?.slice(0, 3).map(r => r.special_requests).filter(Boolean) || [];
        
        // 4. Actualizar customer
        const { data: updatedCustomer, error: updateError } = await supabase
            .from('customers')
            .update({
                visits_count,
                total_spent,
                avg_ticket: Math.round(avg_ticket * 100) / 100, // Redondear a 2 decimales
                last_visit_at,
                preferred_items,
                updated_at: new Date().toISOString()
            })
            .eq('id', customerId)
            .eq('business_id', businessId)
            .select()
            .single();
            
        if (updateError) {
            console.error('❌ Error actualizando cliente:', updateError);
            throw updateError;
        }
        
        console.log(`✅ Stats actualizadas: ${visits_count} visitas, €${total_spent}`);
        return {
            success: true,
            customer: updatedCustomer,
            stats: { visits_count, total_spent, avg_ticket, last_visit_at }
        };
        
    } catch (error) {
        console.error('❌ Error en recomputeCustomerStats:', error);
        return { success: false, error: error.message };
    }
}

/**
 * RECOMPUTAR SEGMENTO DE CLIENTE
 * Aplica reglas de segmentación automática
 */
export async function recomputeSegment(customerId, businessId) {
    try {
        console.log(`🎯 Recomputando segmento para cliente ${customerId}`);
        
        // 1. Obtener datos del cliente
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .eq('business_id', businessId)
            .single();
            
        if (customerError || !customer) {
            console.error('❌ Error obteniendo cliente:', customerError);
            throw customerError || new Error('Cliente no encontrado');
        }
        
        // 2. Obtener reservas del cliente
        const { data: reservations, error: reservationsError } = await supabase
            .from('appointments')
            .select('*')
            .eq('customer_id', customerId)
            .eq('business_id', businessId)
            .in('status', ['confirmed', 'completed'])
            .order('created_at', { ascending: false });
            
        if (reservationsError) {
            console.error('❌ Error obteniendo reservas:', reservationsError);
            throw reservationsError;
        }
        
        // 3. Calcular días desde última visita
        const daysSinceLastVisit = customer.last_visit_at 
            ? differenceInDays(new Date(), parseISO(customer.last_visit_at))
            : 999;
        
        // 4. Aplicar reglas de segmentación (orden de prioridad)
        let newSegment = 'nuevo';
        
        const segmentPriority = ['alto_valor', 'vip', 'en_riesgo', 'inactivo', 'regular', 'ocasional', 'nuevo'];
        
        for (const segment of segmentPriority) {
            if (SEGMENTATION_RULES[segment](customer, reservations || [], daysSinceLastVisit)) {
                newSegment = segment;
                break;
            }
        }
        
        // 5. Solo actualizar si hay cambio y no hay override manual
        const previousSegment = customer.segment_auto;
        let shouldUpdate = newSegment !== previousSegment;
        
        // Respetar segment_manual si existe
        const finalSegment = customer.segment_manual || newSegment;
        
        if (shouldUpdate) {
            const { data: updatedCustomer, error: updateError } = await supabase
                .from('customers')
                .update({
                    segment_auto: newSegment,
                    churn_risk_score: calculateChurnRisk(customer, reservations || [], daysSinceLastVisit),
                    predicted_ltv: calculatePredictedLTV(customer, reservations || []),
                    updated_at: new Date().toISOString()
                })
                .eq('id', customerId)
                .eq('business_id', businessId)
                .select()
                .single();
                
            if (updateError) {
                console.error('❌ Error actualizando segmento:', updateError);
                throw updateError;
            }
            
            console.log(`✅ Segmento actualizado: ${previousSegment} → ${newSegment}`);
            
            // 6. Verificar si necesita crear interacción automática
            await checkAndCreateAutomaticInteraction(customerId, businessId, previousSegment, newSegment);
            
            // 7. 🔗 WEBHOOK: Notificar cambio de segmento
            try {
                await triggerSegmentChangeWebhook(customerId, previousSegment, newSegment, updatedCustomer);
            } catch (webhookError) {
                console.error('❌ Error en webhook de cambio de segmento:', webhookError);
                // No fallar el proceso principal por error de webhook
            }
            
            return {
                success: true,
                customer: updatedCustomer,
                segmentChanged: true,
                previousSegment,
                newSegment,
                finalSegment
            };
        }
        
        console.log(`ℹ️ Segmento sin cambios: ${newSegment}`);
        return {
            success: true,
            customer,
            segmentChanged: false,
            newSegment,
            finalSegment
        };
        
    } catch (error) {
        console.error('❌ Error en recomputeSegment:', error);
        return { success: false, error: error.message };
    }
}

/**
 * CALCULAR RIESGO DE CHURN (0-100)
 */
function calculateChurnRisk(customer, reservations, daysSinceLastVisit) {
    let riskScore = 0;
    
    // Factor 1: Días sin visita (40% del score)
    if (daysSinceLastVisit > 90) riskScore += 40;
    else if (daysSinceLastVisit > 60) riskScore += 25;
    else if (daysSinceLastVisit > 30) riskScore += 10;
    
    // Factor 2: Tendencia de visitas (30% del score)
    const last90Days = reservations.filter(r => 
        differenceInDays(new Date(), parseISO(r.created_at)) <= 90
    ).length;
    
    const previous90Days = reservations.filter(r => {
        const daysDiff = differenceInDays(new Date(), parseISO(r.created_at));
        return daysDiff > 90 && daysDiff <= 180;
    }).length;
    
    if (previous90Days > 0) {
        const dropPercentage = ((previous90Days - last90Days) / previous90Days) * 100;
        if (dropPercentage > 50) riskScore += 30;
        else if (dropPercentage > 25) riskScore += 15;
    }
    
    // Factor 3: Valor histórico (20% del score)
    if (customer.total_spent < 100) riskScore += 20;
    else if (customer.total_spent < 300) riskScore += 10;
    
    // Factor 4: Frecuencia histórica (10% del score)
    if (customer.visits_count < 3) riskScore += 10;
    else if (customer.visits_count < 6) riskScore += 5;
    
    return Math.min(100, Math.max(0, riskScore));
}

/**
 * CALCULAR LTV PREDICHO
 */
function calculatePredictedLTV(customer, reservations) {
    if (customer.visits_count === 0) return 0;
    
    const avgTicket = customer.avg_ticket || 0;
    const visitFrequency = customer.visits_count / Math.max(1, differenceInDays(new Date(), parseISO(customer.created_at)) / 30);
    const monthlyValue = avgTicket * visitFrequency;
    
    // Predicción simple: valor mensual * 12 meses
    return Math.round(monthlyValue * 12 * 100) / 100;
}

/**
 * VERIFICAR Y CREAR INTERACCIÓN AUTOMÁTICA
 */
async function checkAndCreateAutomaticInteraction(customerId, businessId, previousSegment, newSegment) {
    try {
        // Solo crear interacciones para ciertos cambios
        const interactionRules = {
            'vip': { type: 'vip_upgrade', channel: 'whatsapp', priority: 'high' },
            'inactivo': { type: 'reactivacion', channel: 'email', priority: 'medium' },
            'en_riesgo': { type: 'retention', channel: 'email', priority: 'high' },
            'alto_valor': { type: 'vip_upgrade', channel: 'email', priority: 'high' }
        };
        
        if (interactionRules[newSegment] && previousSegment !== newSegment) {
            const rule = interactionRules[newSegment];
            
            // Crear interacción pendiente
            const { error } = await supabase
                .from('customer_interactions')
                .insert({
                    business_id: businessId,
                    customer_id: customerId,
                    channel: rule.channel,
                    interaction_type: rule.type,
                    subject: `Cambio de segmento: ${newSegment}`,
                    content: `Cliente cambió de ${previousSegment} a ${newSegment}`,
                    status: 'pending',
                    payload: {
                        segment_change: { from: previousSegment, to: newSegment },
                        priority: rule.priority,
                        created_automatically: true
                    }
                });
                
            if (error) {
                console.error('❌ Error creando interacción automática:', error);
            } else {
                console.log(`✅ Interacción automática creada: ${rule.type} por ${rule.channel}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error en checkAndCreateAutomaticInteraction:', error);
    }
}

/**
 * PROCESAR FINALIZACIÓN DE RESERVA
 * Trigger principal cuando se completa una reserva
 */
export async function processReservationCompletion(reservationId, businessId) {
    try {
        console.log(`🎯 Procesando completación de reserva ${reservationId}`);
        
        // 1. Obtener datos de la reserva
        const { data: reservation, error: reservationError } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', reservationId)
            .eq('business_id', businessId)
            .single();
            
        if (reservationError || !reservation) {
            console.error('❌ Reserva no encontrada:', reservationError);
            return { success: false, error: 'Reserva no encontrada' };
        }
        
        // 2. Buscar o crear cliente
        let customerId = reservation.customer_id;
        
        if (!customerId) {
            // Buscar cliente por teléfono o email
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('business_id', businessId)
                .or(`phone.eq.${reservation.customer_phone},email.eq.${reservation.customer_email}`)
                .single();
                
            if (existingCustomer) {
                customerId = existingCustomer.id;
                
                // Actualizar reserva con customer_id
                await supabase
                    .from('appointments')
                    .update({ customer_id: customerId })
                    .eq('id', reservationId);
                    
            } else {
                // Crear nuevo cliente
                const names = reservation.customer_name?.split(' ') || [];
                const { data: newCustomer, error: createError } = await supabase
                    .from('customers')
                    .insert({
                        business_id: businessId,
                        name: reservation.customer_name,
                        first_name: names[0] || '',
                        last_name1: names[1] || '',
                        last_name2: names[2] || '',
                        email: reservation.customer_email,
                        phone: reservation.customer_phone,
                        segment_auto: 'nuevo',
                        notes: 'Cliente creado automáticamente desde reserva'
                    })
                    .select()
                    .single();
                    
                if (createError) {
                    console.error('❌ Error creando cliente:', createError);
                    return { success: false, error: 'Error creando cliente' };
                }
                
                customerId = newCustomer.id;
                
                // Actualizar reserva con customer_id
                await supabase
                    .from('appointments')
                    .update({ customer_id: customerId })
                    .eq('id', reservationId);
            }
        }
        
        // 3. Recomputar estadísticas del cliente
        const statsResult = await recomputeCustomerStats(customerId, businessId);
        if (!statsResult.success) {
            console.error('❌ Error recomputando stats:', statsResult.error);
            return statsResult;
        }
        
        // 4. Recomputar segmento del cliente
        const segmentResult = await recomputeSegment(customerId, businessId);
        if (!segmentResult.success) {
            console.error('❌ Error recomputando segmento:', segmentResult.error);
            return segmentResult;
        }
        
        console.log(`✅ Reserva ${reservationId} procesada correctamente`);
        
        // 5. 🔗 WEBHOOK: Notificar reserva completada
        try {
            await triggerReservationWebhook(reservation, statsResult.customer, {
                stats: statsResult.stats,
                segmentChanged: segmentResult.segmentChanged,
                newSegment: segmentResult.newSegment
            });
        } catch (webhookError) {
            console.error('❌ Error en webhook de reserva completada:', webhookError);
            // No fallar el proceso principal por error de webhook
        }
        
        return {
            success: true,
            customerId,
            stats: statsResult.stats,
            segmentChanged: segmentResult.segmentChanged,
            newSegment: segmentResult.newSegment
        };
        
    } catch (error) {
        console.error('❌ Error en processReservationCompletion:', error);
        return { success: false, error: error.message };
    }
}

/**
 * OBTENER ESTADÍSTICAS CRM DEL NEGOCIO
 */
export async function getCRMStats(businessId) {
    try {
        // Estadísticas de clientes por segmento
        const { data: segments, error: segmentsError } = await supabase
            .from('customers')
            .select('segment_auto, segment_manual')
            .eq('business_id', businessId);
            
        if (segmentsError) throw segmentsError;
        
        // Contar por segmentos
        const segmentCounts = {};
        segments?.forEach(customer => {
            const segment = customer.segment_manual || customer.segment_auto || 'nuevo';
            segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
        });
        
        // Estadísticas de interacciones
        const { data: interactions, error: interactionsError } = await supabase
            .from('customer_interactions')
            .select('status, channel, created_at')
            .eq('business_id', businessId)
            .gte('created_at', subDays(new Date(), 30).toISOString());
            
        if (interactionsError) throw interactionsError;
        
        const interactionStats = {
            total: interactions?.length || 0,
            sent: interactions?.filter(i => i.status === 'sent').length || 0,
            delivered: interactions?.filter(i => i.status === 'delivered').length || 0,
            opened: interactions?.filter(i => i.status === 'opened').length || 0
        };
        
        return {
            success: true,
            segments: segmentCounts,
            interactions: interactionStats,
            totalCustomers: segments?.length || 0
        };
        
    } catch (error) {
        console.error('❌ Error obteniendo stats CRM:', error);
        return { success: false, error: error.message };
    }
}

/**
 * NUEVA FUNCIÓN: Evalúa reglas de automatización en tiempo real
 */
export const evaluateAutomationRules = async (customerId, businessId, triggerEvent, context = {}) => {
  try {
    console.log('🔄 Evaluando reglas de automatización:', { customerId, triggerEvent, context });
    
    // Obtener reglas activas para el evento
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .eq('trigger_event', triggerEvent);
    
    if (rulesError) {
      console.error('Error obteniendo reglas:', rulesError);
      return;
    }
    
    if (!rules || rules.length === 0) {
      console.log('📭 No hay reglas activas para el evento:', triggerEvent);
      return;
    }
    
    console.log(`📋 Evaluando ${rules.length} reglas para evento ${triggerEvent}`);
    
    // Importar servicios de elegibilidad dinámicamente para evitar dependencias circulares
    const { CRMEligibilityService } = await import('./CRMEligibilityService');
    
    for (const rule of rules) {
      try {
        // Verificar elegibilidad
        const eligibility = await CRMEligibilityService.checkEligibility(
          customerId,
          businessId,
          rule.id,
          context
        );
        
        if (eligibility.eligible) {
          // Crear mensaje programado
          await createScheduledMessageFromRule(
            customerId,
            businessId,
            rule,
            eligibility.channel,
            context
          );
          
          console.log(`✅ Mensaje creado para regla: ${rule.name}`);
        } else {
          console.log(`⏭️ Cliente no elegible para regla ${rule.name}:`, eligibility.reasons);
        }
        
      } catch (ruleError) {
        console.error(`❌ Error evaluando regla ${rule.name}:`, ruleError);
      }
    }
    
  } catch (error) {
    console.error('❌ Error evaluando reglas de automatización:', error);
  }
};

/**
 * Crea un mensaje programado desde una regla de automatización
 */
const createScheduledMessageFromRule = async (customerId, businessId, rule, channel, context) => {
  try {
    // Obtener datos del cliente
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    
    if (customerError || !customer) {
      throw new Error('Cliente no encontrado');
    }
    
    // Obtener plantilla
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', rule.template_id)
      .single();
    
    if (templateError || !template) {
      throw new Error('Plantilla no encontrada');
    }
    
    // Renderizar contenido
    const renderedContent = await renderMessageTemplate(template, customer, businessId);
    
    // Calcular cuándo enviar
    const scheduledFor = new Date();
    if (template.send_delay_hours > 0) {
      scheduledFor.setHours(scheduledFor.getHours() + template.send_delay_hours);
    }
    
    // Crear mensaje programado
    const messageData = {
      business_id: businessId,
      customer_id: customerId,
      automation_rule_id: rule.id,
      template_id: template.id,
      scheduled_for: scheduledFor.toISOString(),
      channel_planned: channel,
      subject_rendered: template.subject ? await renderMessageTemplate({ content_markdown: template.subject }, customer, businessId) : null,
      content_rendered: renderedContent,
      variables_used: extractTemplateVariables(template, customer),
      status: 'planned'
    };
    
    const { error } = await supabase
      .from('scheduled_messages')
      .insert([messageData]);
    
    if (error) throw error;
    
    console.log(`📅 Mensaje programado creado para ${customer.name}`);
    
  } catch (error) {
    console.error('Error creando mensaje programado:', error);
    throw error;
  }
};

/**
 * Renderiza una plantilla de mensaje con variables del cliente
 */
const renderMessageTemplate = async (template, customer, businessId) => {
  try {
    // Obtener datos del negocio
    const { data: business } = await supabase
      .from('businesses')
      .select('name, email, phone')
      .eq('id', businessId)
      .single();
    
    let content = template.content_markdown || '';
    
    // Variables del cliente
    content = content.replace(/\{\{first_name\}\}/g, customer.name?.split(' ')[0] || 'Cliente');
    content = content.replace(/\{\{name\}\}/g, customer.name || 'Cliente');
    content = content.replace(/\{\{email\}\}/g, customer.email || '');
    content = content.replace(/\{\{phone\}\}/g, customer.phone || '');
    content = content.replace(/\{\{visits_count\}\}/g, customer.total_visits || 0);
    content = content.replace(/\{\{total_spent\}\}/g, customer.total_spent || 0);
    
    // Variables del negocio (soporta tanto {{business_name}} como {{restaurant_name}} para compatibilidad)
    content = content.replace(/\{\{business_name\}\}/g, business?.name || 'Nuestro Negocio');
    content = content.replace(/\{\{restaurant_name\}\}/g, business?.name || 'Nuestro Negocio'); // Legacy
    content = content.replace(/\{\{business_phone\}\}/g, business?.phone || '');
    content = content.replace(/\{\{restaurant_phone\}\}/g, business?.phone || ''); // Legacy
    content = content.replace(/\{\{business_email\}\}/g, business?.email || '');
    content = content.replace(/\{\{restaurant_email\}\}/g, business?.email || ''); // Legacy
    
    // Variables calculadas
    if (customer.last_visit) {
      const daysSince = Math.floor((new Date() - new Date(customer.last_visit)) / (1000 * 60 * 60 * 24));
      content = content.replace(/\{\{days_since_last_visit\}\}/g, daysSince.toString());
    } else {
      content = content.replace(/\{\{days_since_last_visit\}\}/g, 'muchos');
    }
    
    return content;
    
  } catch (error) {
    console.error('Error renderizando plantilla:', error);
    return template.content_markdown || '';
  }
};

/**
 * Extrae variables utilizadas en una plantilla
 */
const extractTemplateVariables = (template, customer) => {
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
};

export default {
    recomputeCustomerStats,
    recomputeSegment,
    processReservationCompletion,
    getCRMStats,
    evaluateAutomationRules,
    CRM_THRESHOLDS,
    SEGMENTATION_RULES
};

