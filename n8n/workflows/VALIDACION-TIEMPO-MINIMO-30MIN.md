# ✅ VALIDACIÓN DE TIEMPO MÍNIMO DE ANTELACIÓN (30 MINUTOS)

**Fecha:** 22 Octubre 2025  
**Problema identificado:** Cliente podía reservar con menos de 30 minutos de antelación  
**Solución:** Doble validación (workflow + RPC)

---

## 🎯 ESTRATEGIA: DOBLE SEGURIDAD

### 1️⃣ **Primera línea de defensa: WORKFLOW** ⚡
- **Archivo:** `01-check-availability-OPTIMIZADO.json`
- **Ubicación:** Nodo `🔍 Validar Input`
- **Ventajas:**
  - ✅ Respuesta rápida al cliente (sin llamar a BD)
  - ✅ Ahorra recursos (no ejecuta RPC innecesarias)
  - ✅ Mensaje de error claro e inmediato

### 2️⃣ **Segunda línea de defensa: RPC (Backend)** 🛡️
- **Archivo:** `supabase/migrations/20251022_008_add_minimum_advance_validation.sql`
- **Funciones actualizadas:**
  - `find_table_combinations()` → Valida antes de buscar disponibilidad
  - `create_combined_reservation()` → Valida antes de crear reserva
- **Ventajas:**
  - ✅ Protege contra llamadas directas a BD (bypass del workflow)
  - ✅ Garantía de integridad de datos
  - ✅ Seguridad robusta

---

## 📋 CONFIGURACIÓN ACTUAL

```javascript
// Tiempo mínimo requerido
const MIN_ADVANCE_MINUTES = 30;
```

**Esto significa:**
- ✅ Cliente puede reservar para las 12:30 siendo las 11:55 (35 min)
- ❌ Cliente NO puede reservar para las 12:30 siendo las 12:05 (25 min)

---

## 🔄 FLUJO COMPLETO

```
1️⃣ CLIENTE SOLICITA RESERVA
   "Quiero reservar para hoy a las 13:00 para 4 personas"
   (Hora actual: 12:50)
   ↓
2️⃣ WORKFLOW: 01-check-availability
   ↓
3️⃣ NODO: 🔍 Validar Input
   ⏰ Calcula tiempo: 13:00 - 12:50 = 10 minutos
   ❌ RECHAZA: 10 < 30 minutos
   ↓
4️⃣ RESPUESTA AL CLIENTE (vía Super Agent):
   "Lo sentimos, necesitamos al menos 30 minutos de 
   antelación para preparar tu mesa. La reserva sería 
   en 10 minutos."
   ↓
5️⃣ CLIENTE NO VE LA RESERVA RECHAZADA EN BD
   (Protección exitosa)
```

---

## 💾 VALIDACIÓN EN SUPABASE (Backup)

Si alguien intenta llamar directamente a la RPC:

```sql
SELECT find_table_combinations(
  'restaurant-uuid',
  '2025-10-22',
  '13:00:00',
  4,
  'interior'
);
```

**Hora actual:** 12:50  
**Respuesta de la RPC:**

```json
{
  "available": false,
  "type": "error",
  "message": "Lo sentimos, necesitamos al menos 30 minutos de antelación para preparar tu mesa. La reserva sería en 10 minutos.",
  "minutes_until": 10,
  "min_required": 30
}
```

---

## 🧮 CÁLCULO DE TIEMPO

### En el WORKFLOW (JavaScript):
```javascript
const now = new Date();
const reservationDateTime = new Date(`${fecha}T${hora}:00`);
const minutesUntil = (reservationDateTime - now) / (1000 * 60);

if (minutesUntil < MIN_ADVANCE_MINUTES) {
  throw new Error(`Lo sentimos, necesitamos al menos ${MIN_ADVANCE_MINUTES} minutos...`);
}
```

### En la RPC (PostgreSQL):
```sql
v_now := NOW();
v_reservation_datetime := (p_date || ' ' || p_time)::TIMESTAMP;
v_minutes_until := EXTRACT(EPOCH FROM (v_reservation_datetime - v_now)) / 60;

IF v_minutes_until < v_min_advance_minutes THEN
  RETURN json_build_object(
    'available', false,
    'type', 'error',
    'message', format('Lo sentimos, necesitamos al menos %s minutos...', v_min_advance_minutes)
  );
END IF;
```

---

## 🧪 CASOS DE PRUEBA

### ✅ CASO 1: Reserva con 35 minutos (OK)
```
Hora actual: 11:55
Reserva para: 12:30
Diferencia: 35 minutos
Resultado: ✅ ACEPTADA
```

### ❌ CASO 2: Reserva con 25 minutos (RECHAZADA)
```
Hora actual: 12:05
Reserva para: 12:30
Diferencia: 25 minutos
Resultado: ❌ RECHAZADA
Mensaje: "Lo sentimos, necesitamos al menos 30 minutos de antelación..."
```

### ✅ CASO 3: Reserva para mañana (OK)
```
Hora actual: 12:00 (hoy)
Reserva para: 13:00 (mañana)
Diferencia: 1440 minutos (24 horas)
Resultado: ✅ ACEPTADA
```

### ❌ CASO 4: Reserva con 5 minutos (RECHAZADA)
```
Hora actual: 12:55
Reserva para: 13:00
Diferencia: 5 minutos
Resultado: ❌ RECHAZADA
```

---

## 📊 VENTAJAS DE LA DOBLE VALIDACIÓN

| Aspecto | Solo Workflow | Solo RPC | **Ambos** |
|---------|--------------|----------|-----------|
| **Velocidad** | ⚡ Rápido | ⏳ Más lento | ⚡ Rápido |
| **Seguridad** | ⚠️ Bypass posible | ✅ Seguro | ✅ **Muy seguro** |
| **Recursos** | ✅ Bajo consumo | ⚠️ Más llamadas BD | ✅ Óptimo |
| **Mensaje de error** | ✅ Personalizado | ✅ Detallado | ✅ **Mejor UX** |
| **Protección BD** | ❌ No protege | ✅ Protege | ✅ **Máxima protección** |

---

## 🚀 IMPLEMENTACIÓN

### PASO 1: Ejecutar migración SQL
```bash
# En Supabase SQL Editor:
supabase/migrations/20251022_008_add_minimum_advance_validation.sql
```

### PASO 2: Importar workflow actualizado
```
N8N → Import → 01-check-availability-OPTIMIZADO.json
```

### PASO 3: Verificar
```sql
-- Ver funciones actualizadas
SELECT 
  proname, 
  pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname IN ('find_table_combinations', 'create_combined_reservation');
```

---

## 🎯 RESULTADO FINAL

✅ **Cliente NUNCA puede reservar con menos de 30 minutos**  
✅ **Validación en 2 capas (workflow + BD)**  
✅ **Mensaje de error claro y profesional**  
✅ **Protección contra bypass**  
✅ **Sin impacto en rendimiento**

---

## 🔧 MANTENIMIENTO FUTURO

Si necesitas cambiar el tiempo mínimo (ej: de 30 a 60 minutos):

### En el workflow:
```javascript
// Línea ~44 del nodo 🔍 Validar Input
const MIN_ADVANCE_MINUTES = 60; // Cambiar aquí
```

### En las RPCs:
```sql
-- En ambas funciones (find_table_combinations y create_combined_reservation)
v_min_advance_minutes INTEGER := 60; -- Cambiar aquí
```

**⚠️ IMPORTANTE:** Cambiar en AMBOS lados para mantener consistencia.

---

## 📚 ARCHIVOS RELACIONADOS

- `n8n/workflows/01-check-availability-OPTIMIZADO.json` (validación workflow)
- `supabase/migrations/20251022_008_add_minimum_advance_validation.sql` (validación RPC)
- `n8n/workflows/TOOL-create-reservation-COMPLETO.json` (usa check_availability)
- `n8n/prompts/PROMPT-SUPER-AGENT-v11-MULTIIDIOMA-REFORZADO.txt` (mensajes al cliente)

---

**✅ SISTEMA ROBUSTO, ESCALABLE Y PROFESIONAL** 🚀

