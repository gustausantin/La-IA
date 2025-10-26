# 🔧 TOOL: `create_reservation` — VERSIÓN FINAL

## 📋 **RESUMEN**

Esta tool crea una reserva en el restaurante. **NO crea clientes** porque ya vienen del Gateway.

---

## ✅ **INPUT (del Super Agent)**

```json
{
  "restaurant_id": "uuid",
  "customer_id": "uuid",          // ✅ YA VIENE DEL GATEWAY
  "customer_phone": "+34...",      // ✅ YA VIENE DEL GATEWAY
  "customer_name": "Nombre",       // ✅ YA VIENE DEL GATEWAY
  "reservation_date": "2025-10-22",
  "reservation_time": "20:00",
  "party_size": 4,
  "preferred_zone": "interior",    // OPCIONAL
  "special_requests": "Ventana"    // OPCIONAL
}
```

---

## 🎯 **FLUJO**

### **1️⃣ Validar Input**
- Verifica campos obligatorios
- Parsea `party_size` a número

### **2️⃣ Buscar Slots Disponibles**
- Query a `availability_slots`:
  - `restaurant_id = X`
  - `slot_date = fecha`
  - `start_time = hora`
  - `status = free`
  - `is_available = true`
  - `zone = zona` (si especificada)

### **3️⃣ Seleccionar Mejor Mesa**
- Filtra por `capacity >= party_size`
- Ordena por capacidad ASC (la más pequeña que cumpla)
- Retorna el mejor slot con:
  - `slot_id`
  - `table_id`
  - `table_name`
  - `capacity`
  - `zone`

### **4️⃣ ¿Disponible?**
- **SI → Crear reserva**
- **NO → Respuesta de error**

### **5️⃣ Crear Reserva**
- Inserta en `reservations`:
  - `restaurant_id`
  - `customer_id` ✅
  - `customer_phone` ✅
  - `customer_name` ✅
  - `reservation_date`
  - `reservation_time`
  - `party_size`
  - `table_id`
  - `status = confirmed`
  - `source = agent_whatsapp`
  - `special_requests`

### **6️⃣ Marcar Slot Reservado**
- Actualiza `availability_slots`:
  - `status = reserved`
  - `is_available = false`

### **7️⃣ Respuesta de Éxito**
```json
{
  "success": true,
  "reservation_id": "uuid",
  "message": "¡Listo, Gustau! Tu reserva está confirmada...",
  "details": {
    "reservation_id": "uuid",
    "date": "2025-10-22",
    "time": "20:00",
    "party_size": 4,
    "table": "Mesa 1",
    "zone": "interior",
    "customer_name": "Gustau",
    "special_requests": "Ventana"
  }
}
```

---

## ❌ **RESPUESTA DE ERROR**

```json
{
  "success": false,
  "message": "No hay mesas disponibles para 4 personas el 2025-10-22 a las 20:00.",
  "details": {
    "date": "2025-10-22",
    "time": "20:00",
    "party_size": 4
  }
}
```

---

## 🔄 **INTEGRACIÓN CON SUPER AGENT**

En el Super Agent, configurar la tool así:

```json
{
  "name": "create_reservation",
  "description": "Crea una nueva reserva. USA SOLO DESPUÉS de verificar disponibilidad con check_availability.",
  "workflowId": "TOOL_CREATE_RESERVATION_ID",
  "fields": [
    { "name": "restaurant_id" },
    { "name": "reservation_date" },
    { "name": "reservation_time" },
    { "name": "party_size" },
    { "name": "preferred_zone" },
    { "name": "special_requests" }
  ]
}
```

**NOTA:** `customer_id`, `customer_phone` y `customer_name` NO se pasan como parámetros porque ya están en el contexto.

---

## 📚 **CUMPLIMIENTO DE NORMAS**

✅ **CHECKLIST_OBLIGATORIO.md:**
- Lee schema de BD (usa `availability_slots` con `capacity` y `table_name`)
- No crea clientes (ya vienen del Gateway)
- Valida antes de ejecutar

✅ **REGLA_SAGRADA_RESERVAS.md:**
- NO borra reservas
- Solo crea reservas con status `confirmed`

✅ **REGLA_ORO_DATOS_REALES.md:**
- NO inventa datos
- Usa solo lo que recibe del Gateway

---

## 🚀 **TESTING**

### **Caso 1: Reserva exitosa**
```json
{
  "restaurant_id": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1",
  "customer_id": "uuid-gustau",
  "customer_phone": "+34671126148",
  "customer_name": "Gustau",
  "reservation_date": "2025-10-22",
  "reservation_time": "20:00",
  "party_size": 4,
  "preferred_zone": "interior"
}
```

**Resultado esperado:**
- ✅ Reserva creada en `reservations`
- ✅ Slot marcado como `reserved` en `availability_slots`
- ✅ Respuesta de éxito con `reservation_id`

### **Caso 2: Sin disponibilidad**
```json
{
  "restaurant_id": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1",
  "customer_id": "uuid-gustau",
  "customer_phone": "+34671126148",
  "customer_name": "Gustau",
  "reservation_date": "2025-10-25",
  "reservation_time": "14:00",
  "party_size": 10
}
```

**Resultado esperado:**
- ❌ No se crea reserva
- ❌ Respuesta de error explicando que no hay mesas para 10 personas

---

## 📝 **CHANGELOG**

### **v2 — 17 Octubre 2025**
- ✅ Eliminada creación de cliente (ya viene del Gateway)
- ✅ Usa `capacity` y `table_name` directamente de `availability_slots`
- ✅ Simplificado: no necesita nodo "Obtener Mesas"
- ✅ Filtrado directo en Supabase node
- ✅ Respuestas más claras y profesionales

---

## 🎯 **PRÓXIMOS PASOS**

1. Importar workflow en N8N
2. Actualizar el Super Agent con el `workflowId` correcto
3. Probar con datos reales
4. Verificar que el slot se marque correctamente como `reserved`


