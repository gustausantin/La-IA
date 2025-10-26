/**
 * 🎨 PALETA CORPORATIVA SON-IA
 * Azul → Lila profesional
 * 
 * NORMA: Usar ÚNICAMENTE estos colores en toda la app
 * NO usar: verde, naranja, rojo, amarillo (excepto alerts críticos)
 */

export const CORPORATE_COLORS = {
    // 💙 AZUL PRINCIPAL (Tabs, Botones primarios)
    primary: {
        bg: 'bg-blue-600',
        bgHover: 'bg-blue-700',
        bgActive: 'bg-blue-800',
        text: 'text-blue-600',
        textHover: 'text-blue-700',
        border: 'border-blue-600',
        bgLight: 'bg-blue-50',
        bgGradient: 'bg-gradient-to-r from-blue-600 to-purple-600',
    },

    // 💜 LILA SECUNDARIO (Highlights, Stats importantes)
    secondary: {
        bg: 'bg-purple-600',
        bgHover: 'bg-purple-700',
        bgActive: 'bg-purple-800',
        text: 'text-purple-600',
        textHover: 'text-purple-700',
        border: 'border-purple-600',
        bgLight: 'bg-purple-50',
        bgGradient: 'bg-gradient-to-r from-purple-600 to-blue-600',
    },

    // 🌊 AZUL-LILA DEGRADADO (Headers, Dashboards)
    gradient: {
        blueToPurple: 'bg-gradient-to-r from-blue-600 to-purple-600',
        purpleToBlue: 'bg-gradient-to-r from-purple-600 to-blue-600',
        blueLight: 'bg-gradient-to-br from-blue-500 to-purple-500',
        purpleLight: 'bg-gradient-to-br from-purple-500 to-blue-500',
    },

    // 📊 STATS & CARDS (Variaciones sutiles de azul-lila)
    stats: {
        total: 'bg-blue-500',
        confirmed: 'bg-blue-600',
        pending: 'bg-purple-500',
        special: 'bg-purple-600',
        info: 'bg-blue-400',
    },

    // ⚠️ ESTADOS (Solo para alerts críticos)
    alerts: {
        success: 'bg-green-500',  // Solo para confirmaciones
        warning: 'bg-yellow-500', // Solo para warnings reales
        error: 'bg-red-500',      // Solo para errores críticos
        info: 'bg-blue-500',      // Preferir esto sobre colores vivos
    },

    // 🎨 NEUTROS (Grises para fondos y textos)
    neutral: {
        bg: 'bg-gray-50',
        bgDark: 'bg-gray-100',
        text: 'text-gray-700',
        textDark: 'text-gray-900',
        border: 'border-gray-200',
        borderDark: 'border-gray-300',
    },
};

/**
 * 🎯 COMPONENTES REUTILIZABLES
 */
export const CORPORATE_STYLES = {
    // Tabs principales
    tab: {
        active: 'bg-blue-600 text-white border-2 border-blue-700 shadow-lg scale-105',
        inactive: 'bg-white text-gray-700 border-2 border-gray-200 hover:bg-blue-50 hover:border-blue-300',
    },

    // Tabs secundarios
    tabSecondary: {
        active: 'bg-purple-600 text-white border-2 border-purple-700 shadow-md',
        inactive: 'bg-white text-gray-700 border-2 border-gray-200 hover:bg-purple-50 hover:border-purple-300',
    },

    // Botones
    button: {
        primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg',
        secondary: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300',
        outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
    },

    // Cards
    card: {
        default: 'bg-white border border-gray-200 shadow-sm rounded-xl',
        highlight: 'bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 shadow-md rounded-xl',
    },

    // Headers de sección
    sectionHeader: {
        gradient: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg',
        solid: 'bg-blue-600 text-white rounded-xl shadow-md',
    },
};


