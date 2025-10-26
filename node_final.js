// ═══════════════════════════════════════════════════════════════
// NODO: 🧹 Limpiar y Estructurar para Prompt
// PROPÓSITO: Combinar datos fusionados y reservas en formato limpio
// ═══════════════════════════════════════════════════════════════

// Obtener datos de nodos anteriores
const fusionarData = $input.first().json;
const reservasData = $('📅 Get Reservas Activas').first().json;

console.log('🧹 Limpiando y estructurando datos para el prompt...');

// Extraer información clave del restaurante
const restaurante = {
  id: fusionarData.restaurant_id,
  nombre: fusionarData.restaurant_name || fusionarData.restaurant_data?.name || fusionarData.nombre,
  telefono: fusionarData.restaurant_data?.phone || fusionarData.business_phone,
  email: fusionarData.restaurant_data?.email,
  direccion: fusionarData.restaurant_data?.address,
  ciudad: fusionarData.restaurant_data?.city,
  tipoCocina: fusionarData.restaurant_data?.cuisine_type
};

// Extraer información del cliente
const cliente = {
  id: fusionarData.customer_id,
  nombre: fusionarData.customer_name,
  email: fusionarData.customer_email,
  telefono: fusionarData.customer_phone
};

// Procesar reservas existentes
const reservasExistentes = reservasData?.items || reservasData || [];

// Estructurar información limpia para el prompt
const informacionLimpia = {
  restaurante: restaurante,
  cliente: cliente,
  reservasExistentes: reservasExistentes.length,
  detalleReservas: reservasExistentes.map(r => ({
    id: r.id,
    fecha: r.reservation_date,
    hora: r.reservation_time,
    personas: r.party_size,
    estado: r.status,
    zona: r.preferred_zone || 'no especificada',
    notas: r.special_requests || 'ninguna',
    mesa: r.table_number,
    gasto: r.spend_amount
  })),
  contexto: {
    hasReservas: reservasExistentes.length > 0,
    esClienteRecurrente: reservasExistentes.length > 0,
    ultimaReserva: reservasExistentes.length > 0 ? {
      fecha: reservasExistentes[reservasExistentes.length - 1].reservation_date,
      hora: reservasExistentes[reservasExistentes.length - 1].reservation_time,
      estado: reservasExistentes[reservasExistentes.length - 1].status
    } : null
  }
};

return informacionLimpia;

