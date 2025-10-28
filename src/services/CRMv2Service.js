// CRMv2Service.js - Servicios para el nuevo CRM con AIVI
import { supabase } from '../lib/supabase';

/**
 * SERVICIO CRM v2 - FUNCIONES PRINCIPALES
 */

// 1. MATCHING AUTOMÁTICO DE RESERVAS ↔ TICKETS
export async function suggestReceiptMatches(businessId, reservationId = null) {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_suggest_receipt_matches', {
                p_business_id: businessId,
                p_reservation_id: reservationId
            });

        if (error) throw error;

        return {
            success: true,
            matches: data || []
        };
    } catch (error) {
        console.error('Error suggesting matches:', error);
        return {
            success: false,
            error: error.message,
            matches: []
        };
    }
}

// 2. CREAR VÍNCULO RESERVA ↔ TICKET
export async function linkReservationReceipt(reservationId, receiptId, linkedBy = 'manual', confidence = 1.0, notes = null) {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_link_reservation_receipt', {
                p_reservation_id: reservationId,
                p_receipt_id: receiptId,
                p_linked_by: linkedBy,
                p_confidence: confidence,
                p_notes: notes
            });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error linking reservation-receipt:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 3. REFRESCAR ANALYTICS DE CLIENTES
export async function refreshCustomerAnalytics() {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_refresh_customer_analytics');

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error refreshing analytics:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 4. ACTUALIZAR FEATURES DE UN CLIENTE ESPECÍFICO
export async function updateCustomerFeatures(customerId) {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_update_customer_features', {
                p_customer_id: customerId
            });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error updating customer features:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 5. RENDERIZAR PLANTILLA CON VARIABLES
export async function renderTemplate(templateId, customerId) {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_render_template', {
                p_template_id: templateId,
                p_customer_id: customerId
            });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error rendering template:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 6. CREAR MENSAJE EN COLA
export async function queueMessage(customerId, templateId, ruleId = null, delayMinutes = 0) {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_queue_message', {
                p_customer_id: customerId,
                p_template_id: templateId,
                p_rule_id: ruleId,
                p_delay_minutes: delayMinutes
            });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error queueing message:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 7. EJECUTAR REGLAS DE AUTOMATIZACIÓN
export async function executeAutomationRules(businessId, segment = null) {
    try {
        const { data, error } = await supabase
            .rpc('crm_v2_execute_automation_rules', {
                p_business_id: businessId,
                p_segment: segment
            });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error executing automation rules:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 8. OBTENER RESUMEN DE SEGMENTACIÓN
export async function getSegmentOverview(businessId) {
    try {
        const { data, error } = await supabase
            .from('crm_segment_overview')
            .select('*')
            .eq('business_id', businessId);

        if (error) throw error;

        return {
            success: true,
            segments: data || []
        };
    } catch (error) {
        console.error('Error getting segment overview:', error);
        return {
            success: false,
            error: error.message,
            segments: []
        };
    }
}

// 9. OBTENER FEATURES DE CLIENTES
export async function getCustomerFeatures(businessId, limit = 100) {
    try {
        const { data, error } = await supabase
            .from('analytics_customer_features')
            .select('*')
            .eq('business_id', businessId)
            .order('calculated_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return {
            success: true,
            customers: data || []
        };
    } catch (error) {
        console.error('Error getting customer features:', error);
        return {
            success: false,
            error: error.message,
            customers: []
        };
    }
}

// 10. GESTIÓN DE CONFIGURACIÓN CRM
export async function getCRMSettings(businessId) {
    try {
        const { data, error } = await supabase
            .from('crm_settings')
            .select('*')
            .eq('business_id', businessId)
            .maybeSingle();

        if (error) throw error;

        return {
            success: true,
            settings: data || null
        };
    } catch (error) {
        console.error('Error getting CRM settings:', error);
        return {
            success: false,
            error: error.message,
            settings: null
        };
    }
}

export async function updateCRMSettings(businessId, settings) {
    try {
        const { data, error } = await supabase
            .from('crm_settings')
            .upsert({
                business_id: businessId,
                ...settings,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            settings: data
        };
    } catch (error) {
        console.error('Error updating CRM settings:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 11. UTILIDADES DE SEGMENTACIÓN
export function calculateSegment(customer, settings = {}) {
    const {
        factor_activo = 0.8,
        factor_riesgo = 1.5,
        dias_inactivo_min = 90,
        dias_nuevo = 14
    } = settings;

    const recencyDays = customer.recency_days || 999;
    const aiviDays = customer.aivi_days || 30;
    const visitsTotal = customer.visits_total || 0;
    const daysSinceCreated = customer.created_at ? 
        Math.floor((new Date() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24)) : 999;

    // Lógica de segmentación AIVI
    if (visitsTotal <= 2 && daysSinceCreated <= dias_nuevo) {
        return 'nuevo';
    }
    
    if (recencyDays <= (factor_activo * aiviDays)) {
        return 'activo';
    }
    
    if (recencyDays <= (factor_riesgo * aiviDays)) {
        return 'riesgo';
    }
    
    if (recencyDays >= dias_inactivo_min) {
        return 'inactivo';
    }
    
    return 'inactivo'; // Fallback
}

export function isVIP(customer, settings = {}) {
    const { vip_percentil = 90 } = settings;
    
    // TODO: Implementar cálculo de percentil real
    // Por ahora, criterio simple: >1000€ en 12 meses o >10 visitas
    return (customer.total_spent_12m >= 1000) || (customer.visits_12m >= 10);
}

// 12. PLANTILLAS POR DEFECTO
export const DEFAULT_TEMPLATES = {
    nuevo: {
        email: {
            subject: '¡Bienvenido a {restaurante}, {nombre}!',
            body: '¡Gracias por visitarnos, {nombre}! Esperamos verte pronto de nuevo. Tu día favorito parece ser {fav_weekday} - ¡te esperamos! Reserva fácil: {link_reserva}'
        },
        whatsapp: {
            body: '¡Hola {nombre}! 👋 Gracias por venir a {restaurante}. ¿Te gustó {top_dish}? ¡Reserva para {fav_weekday}! {link_reserva}'
        }
    },
    activo: {
        email: {
            subject: '{nombre}, tu mesa en {restaurante} te espera',
            body: 'Hola {nombre}, este {fav_weekday} sobre las {fav_hour_block}:00 suele ser tu horario perfecto. ¿Reservamos tu mesa? {link_reserva}'
        },
        whatsapp: {
            body: '¡Hola {nombre}! 🍽️ {fav_weekday} a las {fav_hour_block}:00 es tu momento. ¿La mesa de siempre? {link_reserva}'
        }
    },
    riesgo: {
        email: {
            subject: 'Te echamos de menos, {nombre}',
            body: 'Hace tiempo que no coincidimos, {nombre}. Tenemos preparado un detalle especial de la casa para ti. {link_reserva}'
        },
        whatsapp: {
            body: '¡Hola {nombre}! 😊 Hace tiempo que no vienes... ¡Te echamos de menos! Tenemos una sorpresa para ti. {link_reserva}'
        }
    },
    inactivo: {
        email: {
            subject: '¡Vuelve a {restaurante}, {nombre}!',
            body: 'Te echamos mucho de menos, {nombre}. Vuelve esta semana y disfruta de un 20% de descuento (válido hasta el domingo). {link_reserva}'
        },
        whatsapp: {
            body: '¡{nombre}! 🎉 Te echamos de menos. 20% OFF esta semana (caduca domingo). ¡Vuelve! {link_reserva}'
        }
    },
    vip: {
        email: {
            subject: '{nombre}, tu experiencia VIP te espera',
            body: 'Estimado {nombre}, tu mesa preferida en {restaurante} está lista cuando tú digas. Como siempre, a las {fav_hour_block}:00. {link_reserva}'
        },
        whatsapp: {
            body: '👑 {nombre}, tu mesa VIP te espera. {fav_weekday} a las {fav_hour_block}:00 como siempre. {link_reserva}'
        }
    }
};

export default {
    suggestReceiptMatches,
    linkReservationReceipt,
    refreshCustomerAnalytics,
    updateCustomerFeatures,
    renderTemplate,
    queueMessage,
    executeAutomationRules,
    getSegmentOverview,
    getCustomerFeatures,
    getCRMSettings,
    updateCRMSettings,
    calculateSegment,
    isVIP,
    DEFAULT_TEMPLATES
};

