# 🛡️ PROTECCIÓN DE RESERVAS Y SLOTS AL MODIFICAR MESAS

## 📋 Fecha: 22 Octubre 2025
## 🎯 Objetivo: Proteger integridad de datos cuando se modifican mesas

---

## 🚨 Problemas Resueltos

### Problema 1: Reducir Capacidad con Reservas Activas
**Escenario:** Mesa de 6 personas con reserva de 4 personas → Usuario intenta cambiar a 2 personas.

**❌ ANTES:**
- Sistema permitía el cambio
- Cliente llega y no hay espacio
- Inconsistencia de datos

**✅ AHORA:**
- Sistema **BLOQUEA** el cambio
- Muestra error detallado con las reservas afectadas
- Protege la experiencia del cliente

---

### Problema 2: Cambiar Mesas sin Regenerar Slots
**Escenario:** Usuario cambia capacidad/zona/nombre de mesa pero los slots ya generados siguen con datos antiguos.

**❌ ANTES:**
- Slots mostraban capacity=6 pero la mesa ya es de 2
- Clientes podían reservar online con información incorrecta
- Agente IA reservaba con datos falsos

**✅ AHORA:**
- Sistema **DETECTA** cambios críticos
- Muestra **MODAL DE REGENERACIÓN** (igual que con horarios)
- Protege días con reservas
- Regenera el resto con datos actualizados

---

## 🔧 Implementación

### 1️⃣ Validación de Capacidad (Proteger Reservas)

**Archivo:** `src/pages/Mesas.jsx` → `TableModal` → `handleSubmit`

**Lógica:**
```javascript
// 🛡️ VALIDACIÓN: PROTEGER RESERVAS AL CAMBIAR CAPACIDAD
if (table && parseInt(formData.capacity) < table.capacity) {
    // Si está reduciendo la capacidad, verificar reservas activas
    const { data: activeReservations } = await supabase
        .from('reservations')
        .select('id, customer_name, reservation_date, reservation_time, party_size')
        .eq('table_id', table.id)
        .gte('reservation_date', HOY)
        .in('status', ['pending', 'confirmed', 'seated'])
        .gt('party_size', NUEVA_CAPACIDAD);
    
    if (activeReservations.length > 0) {
        throw new Error(`⚠️ NO PUEDES REDUCIR LA CAPACIDAD...`);
    }
}
```

**Verificaciones:**
- ✅ Solo valida si **reduces** capacidad (6 → 2)
- ✅ NO valida si aumentas (2 → 6) o mantienes (6 → 6)
- ✅ Busca reservas desde **HOY** en adelante
- ✅ Solo estados activos: `pending`, `confirmed`, `seated`
- ✅ Solo reservas con `party_size > nueva_capacidad`

**Mensaje de Error:**
```
⚠️ NO PUEDES REDUCIR LA CAPACIDAD

Esta mesa tiene 1 reserva(s) activa(s) con más personas que la nueva capacidad:

• Gustau - 4 personas (22/10/2025 20:00)

🔒 Las reservas están protegidas. Opciones:
1. Cancela o modifica estas reservas primero
2. Mantén la capacidad actual (6 personas)
3. Aumenta la capacidad en lugar de reducirla
```

---

### 2️⃣ Detección de Cambios Críticos

**Archivo:** `src/pages/Mesas.jsx` → `onSave` callback

**Cambios Críticos Detectados:**
- ✅ **Capacidad:** Afecta a quién puede reservar
- ✅ **Zona:** Afecta ubicación de reservas
- ✅ **Nombre:** Afecta identificación en slots
- ✅ **Estado (activo/inactivo):** Afecta disponibilidad total

**Lógica:**
```javascript
onSave={(savedTable) => {
    if (!isNew) {
        // 🔍 DETECTAR QUÉ HA CAMBIADO
        const changes = [];
        let criticalChange = false;
        
        if (selectedTable.capacity !== savedTable.capacity) {
            changes.push(`Capacidad: ${selectedTable.capacity} → ${savedTable.capacity} personas`);
            criticalChange = true;
        }
        
        if (selectedTable.zone !== savedTable.zone) {
            changes.push(`Zona: ${selectedTable.zone} → ${savedTable.zone}`);
            criticalChange = true;
        }
        
        // ... más validaciones
        
        if (criticalChange) {
            showRegenerationModal('table_modified', `Mesa modificada:\n${changes.join('\n')}`);
        }
    }
}}
```

**Modal de Regeneración:**
```
🔄 REGENERACIÓN RECOMENDADA

Has modificado la mesa "Terraza 2":
- Capacidad: 6 → 2 personas

Esto afecta a los slots ya generados.

📍 Ve a "Gestión de Horarios de Reserva"
🗑️ Usa "Borrar Disponibilidades" para limpiar
🎯 Luego "Generar Disponibilidades" para actualizar

⚠️ Los días con reservas activas están protegidos y no se borrarán.
```

---

## 📊 Flujo Completo

### Caso 1: Cambiar Capacidad CON Reservas Activas

```
Usuario intenta: Terraza 2 de 6 → 2 personas
    ↓
Sistema verifica: ¿Hay reservas activas con party_size > 2?
    ↓
Encuentra: 1 reserva de 4 personas para hoy
    ↓
BLOQUEA el cambio
    ↓
Muestra error con detalles de la reserva
    ↓
❌ NO SE GUARDA EL CAMBIO
```

---

### Caso 2: Cambiar Capacidad SIN Reservas Activas

```
Usuario intenta: Terraza 2 de 6 → 2 personas
    ↓
Sistema verifica: ¿Hay reservas activas con party_size > 2?
    ↓
NO encuentra reservas
    ↓
✅ PERMITE el cambio
    ↓
Guarda en tabla `tables`
    ↓
Detecta cambio crítico (capacidad)
    ↓
Muestra MODAL DE REGENERACIÓN
    ↓
Usuario regenera slots con nueva capacidad
```

---

## 🔍 Queries SQL Ejecutadas

### Validar Reservas Activas
```sql
SELECT 
    id, 
    customer_name, 
    reservation_date, 
    reservation_time, 
    party_size
FROM reservations
WHERE table_id = 'uuid-terraza-2'
  AND reservation_date >= CURRENT_DATE
  AND status IN ('pending', 'confirmed', 'pendiente', 'confirmada', 'seated')
  AND party_size > 2  -- Mayor que nueva capacidad
```

### Verificar Existencia de Slots
```sql
SELECT EXISTS(
    SELECT 1 
    FROM availability_slots 
    WHERE restaurant_id = 'uuid-restaurant' 
    LIMIT 1
) as has_slots;
```

---

## ✅ Protecciones Implementadas

| Acción | Validación | Resultado |
|--------|-----------|-----------|
| **Reducir capacidad** | ¿Hay reservas con más personas? | ❌ BLOQUEA si hay / ✅ PERMITE si no hay |
| **Aumentar capacidad** | Ninguna | ✅ SIEMPRE PERMITE |
| **Cambiar zona** | ¿Existen slots generados? | 🔄 PIDE REGENERACIÓN si existen |
| **Cambiar nombre** | ¿Existen slots generados? | 🔄 PIDE REGENERACIÓN si existen |
| **Desactivar mesa** | ¿Existen slots generados? | 🔄 PIDE REGENERACIÓN si existen |
| **Cambiar notas** | Ninguna | ✅ SIEMPRE PERMITE (cambio menor) |

---

## 🎯 Casos de Uso

### ✅ Caso 1: Reducir Capacidad (Sin Reservas)
**Escenario:** Mesa de 6 personas, sin reservas activas, quieres cambiar a 4.

**Resultado:**
1. ✅ Sistema permite el cambio
2. 🔄 Muestra modal de regeneración
3. Usuario regenera slots
4. Slots actualizados con capacity=4

---

### ❌ Caso 2: Reducir Capacidad (Con Reservas)
**Escenario:** Mesa de 6 personas, reserva de 5 personas para mañana, quieres cambiar a 4.

**Resultado:**
1. ❌ Sistema BLOQUEA el cambio
2. Muestra error: "Reserva de 5 personas..."
3. NO se guarda el cambio
4. Usuario debe cancelar/modificar la reserva primero

---

### ✅ Caso 3: Cambiar Zona
**Escenario:** Mover mesa de "interior" a "terraza".

**Resultado:**
1. ✅ Sistema permite el cambio (no afecta reservas activas)
2. 🔄 Muestra modal de regeneración
3. Usuario regenera slots
4. Slots actualizados con zone="terraza"

---

### ✅ Caso 4: Cambiar Solo Notas
**Escenario:** Añadir nota "Cerca de la ventana".

**Resultado:**
1. ✅ Sistema permite el cambio
2. NO muestra modal (cambio menor)
3. NO requiere regeneración
4. Solo se actualiza la nota

---

## 🛡️ Niveles de Protección

### Nivel 1: Validación de Reservas Activas
**Cuándo:** Al intentar REDUCIR capacidad  
**Qué hace:** Busca reservas con más personas que la nueva capacidad  
**Resultado:** BLOQUEA el cambio si encuentra conflictos

### Nivel 2: Detección de Cambios Críticos
**Cuándo:** Al guardar cualquier cambio  
**Qué hace:** Compara datos antiguos vs nuevos  
**Resultado:** Marca si el cambio afecta a slots

### Nivel 3: Modal de Regeneración
**Cuándo:** Si hay cambios críticos Y existen slots generados  
**Qué hace:** Informa al usuario que debe regenerar  
**Resultado:** Protege días con reservas, regenera el resto

---

## 📈 Impacto

### ANTES
- ❌ Usuario podía romper reservas activas
- ❌ Slots con datos desactualizados
- ❌ Clientes reservando con información incorrecta
- ❌ Inconsistencia total

### AHORA
- ✅ Reservas 100% protegidas
- ✅ Slots siempre actualizados (tras regeneración)
- ✅ Información coherente en toda la app
- ✅ Experiencia del cliente garantizada

---

## 🧪 Cómo Probar

### Test 1: Reducir Capacidad con Reservas
1. Ve a "Mesas"
2. Selecciona una mesa con reservas activas (ej: Terraza 2)
3. Intenta reducir capacidad de 6 → 2
4. ✅ Debería mostrar error y NO permitir el cambio

### Test 2: Reducir Capacidad sin Reservas
1. Ve a "Mesas"
2. Selecciona una mesa SIN reservas activas
3. Reduce capacidad de 6 → 2
4. ✅ Debería permitir el cambio
5. 🔄 Debería mostrar modal de regeneración

### Test 3: Cambiar Zona
1. Ve a "Mesas"
2. Selecciona cualquier mesa
3. Cambia zona de "interior" → "terraza"
4. ✅ Debería permitir el cambio
5. 🔄 Debería mostrar modal de regeneración

### Test 4: Cambiar Solo Notas
1. Ve a "Mesas"
2. Selecciona cualquier mesa
3. Cambia solo el campo "Notas"
4. ✅ Debería permitir el cambio
5. ❌ NO debería mostrar modal (cambio menor)

---

## 🔗 Archivos Modificados

1. ✅ `src/pages/Mesas.jsx`
   - Validación de reservas activas al cambiar capacidad
   - Detección de cambios críticos
   - Integración con modal de regeneración

---

## 📝 Notas Técnicas

- La validación de reservas usa queries optimizadas con índices
- El modal de regeneración es el mismo usado para cambios de horarios
- Los cambios menores (notas) no requieren regeneración
- La protección es a nivel de aplicación (no a nivel de BD)
- Se pueden añadir más validaciones en el futuro

---

**✅ Sistema de Protección Completo Implementado**  
**Fecha:** 22 Octubre 2025  
**Versión:** 1.0

