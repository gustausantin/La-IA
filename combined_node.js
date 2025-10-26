// ═══════════════════════════════════════════════════════════════
// NODO: 🧹 Limpiar y Estructurar para Prompt
// PROPÓSITO: Combinar datos fusionados y reservas en formato limpio
// ═══════════════════════════════════════════════════════════════

// Inputs del workflow
const fusionarClientesData = $('🔗 Fusionar Cliente').first().json;
const reservasData = $('📅 Get Reservas Activas').first().json;

console.log('🧹 Limpiando y estructurando datos para el prompt...');

// Extraer información clave
const restaurante = {
  id: fusionarClientesData.restaurant_id,
  nombre: fusionarClientesData.restaurant_name || fusionarClientesData.restaurant_data?.name,
  telefono: fusionarClientesData.restaurant_data?.phone,
  email: fusionarClientesData.restaurant_data?.email,
  direccion: fusionarClientesData.restaurant_data?.address,
  ciudad: fusionarClientesData.restaurant_data?.city
};

const cliente = {
  id: fusionarClientesData.customer_id,
  nombre: fusionarClientesData.customer_name,
  email: fusionarClientesData.customer_email,
  telefono: fusionarClientesData.customer_phone
};

// Procesar reservas existentes
const reservasExistentes = reservasData.items || [];

// Estructurar información para el prompt
const informacionLimpia = {
  restaurante: restaurante,
  cliente: cliente,
  reservasExistentes: reservasExistentes.length,
  detalleReservas: reservasExistentes.map(r => ({
    fecha: r.reservation_date,
    hora: r.reservation_time,
    personas: r.party_size,
    estado: r.status,
    zona: r.preferred_zone || 'no especificada',
    notas: r.special_requests || 'ninguna'
  })),
  contexto: {
    hasReservas: reservasExistentes.length > 0,
    ultimaReserva: reservasExistentes.length > 0 ? {
      fecha: reservasExistentes[reservasExistentes.length - 1].reservation_date,
      estado: reservasExistentes[reservasExistentes.length - 1].status
    } : null
  }
};

// Formatear para salida limpia
return informacionLimpia;

