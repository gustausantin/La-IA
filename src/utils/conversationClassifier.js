// conversationClassifier.js - Clasificador de conversaciones en 2 niveles
// NIVEL 1: Tipología (¿Quién llama?)
// NIVEL 2: Acción (¿Qué quiere?)

/**
 * NIVEL 1: Determinar TIPOLOGÍA de la conversación
 * @param {string} interactionType - Tipo de interacción del agente
 * @param {object} conversation - Objeto completo de conversación (opcional)
 * @returns {object} { tipologia, emoji, color, priority, label }
 */
export const getTipologia = (interactionType, conversation = {}) => {
    const type = (interactionType || '').toLowerCase();
    
    // 🚨 INCIDENCIAS (Prioridad 0 - MÁS ALTA)
    if (
        type.includes('complaint') ||
        type.includes('urgent') ||
        type.includes('medical') ||
        type.includes('escalation') ||
        type.includes('issue') ||
        type.includes('emergency') ||
        conversation.outcome === 'escalated'
    ) {
        return {
            tipologia: 'incidencia',
            emoji: '🚨',
            color: 'red',
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-300',
            priority: 0,
            label: 'Incidencia'
        };
    }
    
    // 🙋 CLIENTES (Prioridad 1)
    if (
        type.includes('reservation') ||
        type.includes('booking') ||
        type.includes('appointment') ||
        type.includes('cancellation') ||
        type.includes('modification') ||
        type.includes('information') ||
        type.includes('inquiry') ||
        type.includes('price') ||
        type.includes('service') ||
        type.includes('schedule')
    ) {
        return {
            tipologia: 'cliente',
            emoji: '🙋',
            color: 'blue',
            bgClass: 'bg-blue-50',
            textClass: 'text-blue-700',
            borderClass: 'border-blue-300',
            priority: 1,
            label: 'Cliente'
        };
    }
    
    // 📦 PROVEEDORES (Prioridad 2)
    if (
        type.includes('supplier') ||
        type.includes('commercial') ||
        type.includes('vendor') ||
        type.includes('delivery') ||
        type.includes('invoice') ||
        type.includes('payment') ||
        type.includes('provider')
    ) {
        return {
            tipologia: 'proveedor',
            emoji: '📦',
            color: 'gray',
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-700',
            borderClass: 'border-gray-300',
            priority: 2,
            label: 'Proveedor'
        };
    }
    
    // 🗑️ RUIDO (Prioridad 3 - MÁS BAJA)
    if (
        type.includes('wrong') ||
        type.includes('spam') ||
        type.includes('survey') ||
        type.includes('unrelated') ||
        type.includes('noise')
    ) {
        return {
            tipologia: 'ruido',
            emoji: '🗑️',
            color: 'black',
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-500',
            borderClass: 'border-gray-300',
            priority: 3,
            label: 'Ruido'
        };
    }
    
    // DEFAULT: Cliente (si no matchea nada)
    return {
        tipologia: 'cliente',
        emoji: '🙋',
        color: 'blue',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-300',
        priority: 1,
        label: 'Cliente'
    };
};

/**
 * NIVEL 2: Determinar ACCIÓN específica
 * @param {string} interactionType - Tipo de interacción
 * @param {object} conversation - Conversación completa
 * @returns {object} { accion, emoji, label, description }
 */
export const getAccion = (interactionType, conversation = {}) => {
    const type = (interactionType || '').toLowerCase();
    const outcome = (conversation.outcome || '').toLowerCase();
    
    // ACCIONES DE CLIENTES
    if (type.includes('reservation') && type.includes('request')) {
        return {
            accion: 'reservar',
            emoji: '✅',
            label: 'Reservar',
            description: outcome.includes('created') ? 'Reserva creada' : 'Solicitó reserva'
        };
    }
    
    if (type.includes('cancellation')) {
        return {
            accion: 'cancelar',
            emoji: '❌',
            label: 'Cancelar',
            description: 'Cancelación de cita'
        };
    }
    
    if (type.includes('modification')) {
        return {
            accion: 'modificar',
            emoji: '🔄',
            label: 'Modificar',
            description: 'Cambio de cita'
        };
    }
    
    if (type.includes('information') || type.includes('inquiry')) {
        return {
            accion: 'informarse',
            emoji: 'ℹ️',
            label: 'Informarse',
            description: 'Consulta de información'
        };
    }
    
    // ACCIONES DE PROVEEDORES
    if (type.includes('commercial')) {
        return {
            accion: 'venta',
            emoji: '💼',
            label: 'Venta',
            description: 'Llamada comercial'
        };
    }
    
    if (type.includes('supplier') || type.includes('delivery')) {
        return {
            accion: 'seguimiento',
            emoji: '📋',
            label: 'Seguimiento',
            description: 'Proveedor habitual'
        };
    }
    
    if (type.includes('invoice') || type.includes('payment')) {
        return {
            accion: 'reclamo',
            emoji: '💰',
            label: 'Reclamo',
            description: 'Reclamo de pago'
        };
    }
    
    // ACCIONES DE INCIDENCIAS
    if (type.includes('medical') || type.includes('allergy')) {
        return {
            accion: 'medica',
            emoji: '🏥',
            label: 'Médica',
            description: 'Urgencia médica'
        };
    }
    
    if (type.includes('complaint')) {
        return {
            accion: 'queja',
            emoji: '⚠️',
            label: 'Queja',
            description: 'Queja de servicio'
        };
    }
    
    // ACCIONES DE RUIDO
    if (type.includes('wrong')) {
        return {
            accion: 'equivocado',
            emoji: '🚫',
            label: 'Equivocado',
            description: 'Llamada equivocada'
        };
    }
    
    if (type.includes('spam')) {
        return {
            accion: 'spam',
            emoji: '🔇',
            label: 'Spam',
            description: 'Spam o robocall'
        };
    }
    
    // DEFAULT
    return {
        accion: 'otro',
        emoji: '💬',
        label: 'Otro',
        description: 'Conversación general'
    };
};

/**
 * Agrupar conversaciones por tipología
 * @param {Array} conversations - Array de conversaciones
 * @returns {object} { incidencias: [], clientes: [], proveedores: [], ruido: [] }
 */
export const groupByTipologia = (conversations) => {
    const grouped = {
        incidencias: [],
        clientes: [],
        proveedores: [],
        ruido: []
    };
    
    conversations.forEach(conv => {
        const { tipologia } = getTipologia(conv.interaction_type, conv);
        grouped[tipologia + 's'] = grouped[tipologia + 's'] || [];
        grouped[tipologia + 's'].push(conv);
    });
    
    return grouped;
};

/**
 * Calcular métricas por tipología
 * @param {Array} conversations - Array de conversaciones
 * @returns {object} { clientes: 25, proveedores: 3, incidencias: 1, ruido: 5 }
 */
export const calculateTipologiaMetrics = (conversations) => {
    const metrics = {
        clientes: 0,
        proveedores: 0,
        incidencias: 0,
        ruido: 0
    };
    
    conversations.forEach(conv => {
        const { tipologia } = getTipologia(conv.interaction_type, conv);
        metrics[tipologia + 's'] = (metrics[tipologia + 's'] || 0) + 1;
    });
    
    return metrics;
};

