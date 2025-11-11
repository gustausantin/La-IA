/**
 * CLASIFICADOR DE CONVERSACIONES - Sistema de 2 Niveles
 * 
 * NIVEL 1: TIPOLOGÍA (Quién llama)
 * - Clientes: Personas que quieren recibir un servicio
 * - Proveedores: Comerciales o parte de la cadena de suministro
 * - Incidencias: Requieren atención humana inmediata
 * - Ruido: Sin valor directo, debe filtrarse
 * 
 * NIVEL 2: ACCIÓN (Qué quiere)
 * - Clientes: Reservar, Gestionar, Informarse, Feedback
 * - Proveedores: Venta, Seguimiento, Reclamación
 * - Incidencias: Médica, Servicio
 * - Ruido: Filtrar, Bloquear
 */

// ============================================
// NIVEL 1: TIPOLOGÍA (El "Quién eres")
// ============================================

export const TIPOLOGIAS = {
    CLIENTES: 'clientes',
    PROVEEDORES: 'proveedores',
    INCIDENCIAS: 'incidencias',
    RUIDO: 'ruido'
};

export const TIPOLOGIA_CONFIG = {
    [TIPOLOGIAS.CLIENTES]: {
        label: 'Clientes',
        emoji: '🟢',
        color: 'green',
        bgClass: 'bg-green-50',
        textClass: 'text-green-700',
        borderClass: 'border-green-200',
        prioridad: 2,
        descripcion: 'Personas que quieren recibir un servicio'
    },
    [TIPOLOGIAS.PROVEEDORES]: {
        label: 'Proveedores',
        emoji: '🟡',
        color: 'yellow',
        bgClass: 'bg-yellow-50',
        textClass: 'text-yellow-700',
        borderClass: 'border-yellow-200',
        prioridad: 3,
        descripcion: 'Comerciales o parte de la cadena de suministro'
    },
    [TIPOLOGIAS.INCIDENCIAS]: {
        label: 'Incidencias',
        emoji: '🔴',
        color: 'red',
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        prioridad: 1,
        descripcion: 'Requieren atención humana inmediata'
    },
    [TIPOLOGIAS.RUIDO]: {
        label: 'Ruido',
        emoji: '⚪',
        color: 'gray',
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        prioridad: 4,
        descripcion: 'Sin valor directo, debe filtrarse'
    }
};

// ============================================
// NIVEL 2: ACCIONES (El "Qué quieres")
// ============================================

export const ACCIONES = {
    // Clientes
    RESERVAR: 'Reservar',
    GESTIONAR: 'Gestionar',
    INFORMARSE: 'Informarse',
    FEEDBACK: 'Feedback',
    
    // Proveedores
    VENTA: 'Venta',
    SEGUIMIENTO: 'Seguimiento',
    RECLAMACION: 'Reclamación',
    
    // Incidencias
    MEDICA: 'Médica',
    SERVICIO: 'Servicio',
    
    // Ruido
    FILTRAR: 'Filtrar',
    BLOQUEAR: 'Bloquear',
    
    // Sin clasificar
    SIN_CLASIFICAR: 'Sin clasificar'
};

// ============================================
// MAPEO: interaction_type → TIPOLOGÍA + ACCIÓN
// ============================================

const MAPEO_INTERACTION_TYPE = {
    // CLIENTES (valores actuales)
    'reservation': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.RESERVAR },
    'modification': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.GESTIONAR },
    'cancellation': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.GESTIONAR },
    'inquiry': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.INFORMARSE },
    'feedback': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.FEEDBACK },
    'complaint': { tipologia: TIPOLOGIAS.INCIDENCIAS, accion: ACCIONES.SERVICIO },
    
    // CLIENTES (valores futuros - 2 niveles)
    'client_reservation': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.RESERVAR },
    'client_manage': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.GESTIONAR },
    'client_modify': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.GESTIONAR },
    'client_cancel': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.GESTIONAR },
    'client_info': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.INFORMARSE },
    'client_inquiry': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.INFORMARSE },
    'client_feedback': { tipologia: TIPOLOGIAS.CLIENTES, accion: ACCIONES.FEEDBACK },
    
    // PROVEEDORES
    'provider_commercial': { tipologia: TIPOLOGIAS.PROVEEDORES, accion: ACCIONES.VENTA },
    'provider_sale': { tipologia: TIPOLOGIAS.PROVEEDORES, accion: ACCIONES.VENTA },
    'provider_followup': { tipologia: TIPOLOGIAS.PROVEEDORES, accion: ACCIONES.SEGUIMIENTO },
    'provider_delivery': { tipologia: TIPOLOGIAS.PROVEEDORES, accion: ACCIONES.SEGUIMIENTO },
    'provider_claim': { tipologia: TIPOLOGIAS.PROVEEDORES, accion: ACCIONES.RECLAMACION },
    'provider_invoice': { tipologia: TIPOLOGIAS.PROVEEDORES, accion: ACCIONES.SEGUIMIENTO },
    
    // INCIDENCIAS
    'incident_medical': { tipologia: TIPOLOGIAS.INCIDENCIAS, accion: ACCIONES.MEDICA },
    'incident_allergy': { tipologia: TIPOLOGIAS.INCIDENCIAS, accion: ACCIONES.MEDICA },
    'incident_service': { tipologia: TIPOLOGIAS.INCIDENCIAS, accion: ACCIONES.SERVICIO },
    'incident_urgent': { tipologia: TIPOLOGIAS.INCIDENCIAS, accion: ACCIONES.SERVICIO },
    
    // RUIDO
    'noise_spam': { tipologia: TIPOLOGIAS.RUIDO, accion: ACCIONES.FILTRAR },
    'noise_survey': { tipologia: TIPOLOGIAS.RUIDO, accion: ACCIONES.FILTRAR },
    'noise_wrong': { tipologia: TIPOLOGIAS.RUIDO, accion: ACCIONES.BLOQUEAR },
    'noise_robocall': { tipologia: TIPOLOGIAS.RUIDO, accion: ACCIONES.BLOQUEAR },
    
    // OTROS
    'other': { tipologia: TIPOLOGIAS.RUIDO, accion: ACCIONES.FILTRAR }
};

// ============================================
// FUNCIONES PÚBLICAS
// ============================================

/**
 * Obtiene la tipología de una conversación
 * @param {string} interaction_type - El tipo de interacción
 * @param {object} conversation - Objeto completo de la conversación (opcional)
 * @returns {object} { tipologia, emoji, color, prioridad, label, config }
 */
export const getTipologia = (interaction_type, conversation = null) => {
    const mapeo = MAPEO_INTERACTION_TYPE[interaction_type];
    const tipologia = mapeo?.tipologia || TIPOLOGIAS.RUIDO;
    const config = TIPOLOGIA_CONFIG[tipologia];
    
    return {
        tipologia,
        emoji: config.emoji,
        color: config.color,
        prioridad: config.prioridad,
        label: config.label,
        config
    };
};

/**
 * Obtiene la acción de una conversación
 * @param {string} interaction_type - El tipo de interacción
 * @returns {string} Nombre de la acción
 */
export const getAccion = (interaction_type) => {
    const mapeo = MAPEO_INTERACTION_TYPE[interaction_type];
    return mapeo?.accion || ACCIONES.SIN_CLASIFICAR;
};

/**
 * Calcula métricas por tipología
 * @param {array} conversations - Array de conversaciones
 * @returns {object} { clientes, proveedores, incidencias, ruido }
 */
export const calculateTipologiaMetrics = (conversations) => {
    const metrics = {
        [TIPOLOGIAS.CLIENTES]: 0,
        [TIPOLOGIAS.PROVEEDORES]: 0,
        [TIPOLOGIAS.INCIDENCIAS]: 0,
        [TIPOLOGIAS.RUIDO]: 0
    };
    
    conversations.forEach(conv => {
        const { tipologia } = getTipologia(conv.interaction_type, conv);
        metrics[tipologia] = (metrics[tipologia] || 0) + 1;
    });
    
    return metrics;
};

/**
 * Agrupa conversaciones por tipología
 * @param {array} conversations - Array de conversaciones
 * @returns {object} { incidencias: [...], clientes: [...], proveedores: [...], ruido: [...] }
 */
export const groupByTipologia = (conversations) => {
    const grouped = {
        [TIPOLOGIAS.INCIDENCIAS]: [],
        [TIPOLOGIAS.CLIENTES]: [],
        [TIPOLOGIAS.PROVEEDORES]: [],
        [TIPOLOGIAS.RUIDO]: []
    };
    
    conversations.forEach(conv => {
        const { tipologia } = getTipologia(conv.interaction_type, conv);
        grouped[tipologia].push(conv);
    });
    
    return grouped;
};

/**
 * Verifica si una conversación es una incidencia urgente
 * @param {object} conversation - Objeto de conversación
 * @returns {boolean}
 */
export const isUrgente = (conversation) => {
    const { tipologia } = getTipologia(conversation.interaction_type, conversation);
    
    // Todas las incidencias son urgentes
    if (tipologia === TIPOLOGIAS.INCIDENCIAS) return true;
    
    // También si tiene metadata de escalación
    if (conversation.metadata?.escalation_needed === true) return true;
    
    // O si tiene sentiment negativo y es queja
    if (conversation.sentiment === 'negative' && conversation.interaction_type === 'complaint') return true;
    
    return false;
};

/**
 * Obtiene el badge para una conversación
 * @param {object} conversation - Objeto de conversación
 * @returns {object|null} { text, icon, bgClass, textClass } o null
 */
export const getBadge = (conversation) => {
    if (!isUrgente(conversation)) return null;
    
    const { accion } = MAPEO_INTERACTION_TYPE[conversation.interaction_type] || {};
    
    if (accion === ACCIONES.MEDICA) {
        return {
            text: '🚨 URGENTE - MÉDICA',
            bgClass: 'bg-red-100',
            textClass: 'text-red-800',
            borderClass: 'border-red-300'
        };
    }
    
    return {
        text: '⚠️ REQUIERE ATENCIÓN',
        bgClass: 'bg-orange-100',
        textClass: 'text-orange-800',
        borderClass: 'border-orange-300'
    };
};
