/**
 * 🏢 CONSTANTES DE ZONAS
 * 
 * Sistema estandarizado de 4 zonas para mesas y reservas
 * Fecha: 17 Octubre 2025
 * 
 * IMPORTANTE: Estos valores DEBEN coincidir exactamente con el ENUM zone_type en Supabase
 */

// ===== VALORES DE ZONA (sync con BD) =====
export const ZONE_OPTIONS = {
  INTERIOR: 'interior',
  TERRAZA: 'terraza',
  BARRA: 'barra',
  PRIVADO: 'privado'
};

// ===== LABELS HUMANIZADOS =====
export const ZONE_LABELS = {
  [ZONE_OPTIONS.INTERIOR]: 'Interior',
  [ZONE_OPTIONS.TERRAZA]: 'Terraza',
  [ZONE_OPTIONS.BARRA]: 'Barra',
  [ZONE_OPTIONS.PRIVADO]: 'Privado'
};

// ===== LABELS EXTENDIDOS (para formularios) =====
export const ZONE_LABELS_EXTENDED = {
  [ZONE_OPTIONS.INTERIOR]: 'Interior / Salón',
  [ZONE_OPTIONS.TERRAZA]: 'Terraza / Exterior',
  [ZONE_OPTIONS.BARRA]: 'Barra',
  [ZONE_OPTIONS.PRIVADO]: 'Privado / Sala reservada'
};

// ===== ICONOS POR ZONA =====
export const ZONE_ICONS = {
  [ZONE_OPTIONS.INTERIOR]: '🏠',
  [ZONE_OPTIONS.TERRAZA]: '☀️',
  [ZONE_OPTIONS.BARRA]: '🍷',
  [ZONE_OPTIONS.PRIVADO]: '🚪'
};

// ===== DESCRIPCIONES (para tooltips) =====
export const ZONE_DESCRIPTIONS = {
  [ZONE_OPTIONS.INTERIOR]: 'Zona interior del restaurante',
  [ZONE_OPTIONS.TERRAZA]: 'Zona al aire libre o exterior',
  [ZONE_OPTIONS.BARRA]: 'Mesas en la zona de barra',
  [ZONE_OPTIONS.PRIVADO]: 'Sala privada o reservada'
};

// ===== COLORES POR ZONA (para UI) =====
export const ZONE_COLORS = {
  [ZONE_OPTIONS.INTERIOR]: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    hover: 'hover:bg-blue-100'
  },
  [ZONE_OPTIONS.TERRAZA]: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-700',
    hover: 'hover:bg-green-100'
  },
  [ZONE_OPTIONS.BARRA]: {
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
    hover: 'hover:bg-purple-100'
  },
  [ZONE_OPTIONS.PRIVADO]: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    hover: 'hover:bg-amber-100'
  }
};

// ===== HELPERS =====

/**
 * Obtener label de una zona
 * @param {string} zone - Valor de zona ('interior', 'terraza', etc.)
 * @param {boolean} extended - Si true, usa labels extendidos
 * @returns {string} Label humanizado
 */
export const getZoneLabel = (zone, extended = false) => {
  if (!zone) return 'Sin zona';
  const labels = extended ? ZONE_LABELS_EXTENDED : ZONE_LABELS;
  return labels[zone] || zone;
};

/**
 * Obtener icono de una zona
 * @param {string} zone - Valor de zona
 * @returns {string} Emoji del icono
 */
export const getZoneIcon = (zone) => {
  if (!zone) return '📍';
  return ZONE_ICONS[zone] || '📍';
};

/**
 * Obtener clase de color para una zona
 * @param {string} zone - Valor de zona
 * @param {string} type - Tipo de color ('bg', 'border', 'text', 'hover')
 * @returns {string} Clase de Tailwind
 */
export const getZoneColor = (zone, type = 'bg') => {
  if (!zone || !ZONE_COLORS[zone]) return '';
  return ZONE_COLORS[zone][type] || '';
};

/**
 * Validar si un valor es una zona válida
 * @param {string} zone - Valor a validar
 * @returns {boolean} true si es válida
 */
export const isValidZone = (zone) => {
  return Object.values(ZONE_OPTIONS).includes(zone);
};

/**
 * Obtener array de opciones para select/dropdown
 * @param {boolean} extended - Si true, usa labels extendidos
 * @param {boolean} includeEmpty - Si true, incluye opción vacía
 * @returns {Array<{value: string, label: string}>}
 */
export const getZoneOptions = (extended = false, includeEmpty = true) => {
  const labels = extended ? ZONE_LABELS_EXTENDED : ZONE_LABELS;
  const options = Object.entries(labels).map(([value, label]) => ({
    value,
    label: `${ZONE_ICONS[value]} ${label}`
  }));
  
  if (includeEmpty) {
    options.unshift({ value: '', label: 'Seleccionar zona...' });
  }
  
  return options;
};

/**
 * Normalizar valor de zona (por si viene de BD antigua)
 * @param {string} zone - Valor a normalizar
 * @returns {string} Valor normalizado o 'interior' por defecto
 */
export const normalizeZone = (zone) => {
  if (!zone) return ZONE_OPTIONS.INTERIOR;
  
  const normalized = zone.toLowerCase().trim();
  
  // Mapeo de valores legacy
  const legacyMap = {
    'main': ZONE_OPTIONS.INTERIOR,
    'salón principal': ZONE_OPTIONS.INTERIOR,
    'salón secundario': ZONE_OPTIONS.INTERIOR,
    'salon': ZONE_OPTIONS.INTERIOR,
    'otros': ZONE_OPTIONS.INTERIOR,
    'exterior': ZONE_OPTIONS.TERRAZA,
    'vip': ZONE_OPTIONS.PRIVADO,
    'zona vip': ZONE_OPTIONS.PRIVADO,
    'sala': ZONE_OPTIONS.PRIVADO,
    'reservado': ZONE_OPTIONS.PRIVADO
  };
  
  // Si es legacy, convertir
  if (legacyMap[normalized]) {
    return legacyMap[normalized];
  }
  
  // Si es válido, retornar
  if (isValidZone(normalized)) {
    return normalized;
  }
  
  // Default
  return ZONE_OPTIONS.INTERIOR;
};

// ===== EXPORT DEFAULT =====
export default {
  ZONE_OPTIONS,
  ZONE_LABELS,
  ZONE_LABELS_EXTENDED,
  ZONE_ICONS,
  ZONE_DESCRIPTIONS,
  ZONE_COLORS,
  getZoneLabel,
  getZoneIcon,
  getZoneColor,
  isValidZone,
  getZoneOptions,
  normalizeZone
};

