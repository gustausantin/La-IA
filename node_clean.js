// ═══════════════════════════════════════════════════════════════
// NODO: 🧹 Limpiar y Estructurar para Prompt
// PROPÓSITO: Combinar datos fusionados y reservas en formato limpio
// ═══════════════════════════════════════════════════════════════

// Obtener datos de los nodos anteriores
const fusionarCliente = $('🔗 Fusionar Cliente').first().json;
const reservas = $('📅 Get Reservas Activas').first().json;

console.log('🧹 Limpiando datos para el prompt...');

// Extraer información del restaurante
const restaurante = {
  id: fusionarCliente.restaurant_id,
  nombre: fusionarCliente.restaurant_name,
  telefono: fusionarCliente.restaurant_data?.phone,
  email: fusionarCliente.restaurant_data?.email,
  direccion: fusionarCliente.restaurant_data?.address,
  ciudad: fusionarCliente.restaurant_data?.city
};

// Extraer información del cliente
const cliente = {
  id: fusionarCliente.customer_id,
  nombre: fusionarCliente.customer_name,
  email: fusionarCliente.customer_email,
  telefono: fusionarCliente.customer_phone
};

// Procesar reservas
const reservasItems = reservas.items || [];
const reservasLimpias = reservasItems.map(r => ({
  fecha: r.reservation_date,
  hora: r.reservation_time,
  personas: r.party_size,
  estado: r.status,
  zona: r.preferred_zone || 'no especificada'
}));

// Devolver información limpia y estructurada
return {
  restaurante,
  cliente,
  reservasCount: reservasItems.length,
  reservas: reservasLimpias,
  tieneReservas: reservasItems.length > 0
};

