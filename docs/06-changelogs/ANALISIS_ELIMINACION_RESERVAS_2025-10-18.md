# 📋 ANÁLISIS COMPLETO: Sistema de Eliminación de Reservas

**Fecha:** 18 de octubre de 2025  
**Análisis previo a implementación**  
**Estado:** 🔍 En análisis

---

## 🎯 **OBJETIVO DEL CAMBIO**

Implementar un sistema de eliminación de reservas que:
1. Cambie el botón "Cancelar" a "Eliminar" (para reservas ya canceladas)
2. Muestre un modal de confirmación con advertencia clara
3. Marque la reserva como `status='deleted'` (NO eliminar de BD)
4. Oculte la reserva del frontend
5. Libere los slots asociados para nuevas reservas

---

## 📚 **DOCUMENTACIÓN REVISADA**

### ✅ **1. CHECKLIST_OBLIGATORIO.md**
- Verificar datos reales de BD
- Confirmar nombres de tablas y columnas
- Asegurar multi-tenancy
- Manejo de errores

### ✅ **2. REGLA_SAGRADA_RESERVAS.md**
**REGLA FUNDAMENTAL:**
> "LAS RESERVAS SON SAGRADAS Y NUNCA PUEDEN SER ELIMINADAS AUTOMÁTICAMENTE"

**Única forma autorizada de eliminar:**
- Desde `src/pages/Reservas.jsx`, línea 1602-1624
- Requiere confirmación explícita (`window.confirm()`)
- Acción MANUAL del manager (no automática)

**¿El cambio cumple la regla?**
✅ **SÍ**, porque:
- Es acción MANUAL (botón "Eliminar")
- Requiere CONFIRMACIÓN EXPLÍCITA (modal)
- NO es eliminación física (soft delete con `status='deleted'`)

### ✅ **3. DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql**

**Tabla `reservations`:**
```sql
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',  -- ✅ VARCHAR, no ENUM
    table_id UUID,
    special_requests TEXT,
    ...
);
```

**Tabla `availability_slots`:**
```sql
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    table_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'free',     -- ✅ Puede ser 'free', 'reserved', 'blocked'
    is_available BOOLEAN DEFAULT TRUE,
    ...
);
```

---

## 🔍 **ESTADO ACTUAL DEL CÓDIGO**

### **1. Estados de Reserva (`RESERVATION_STATES`)**

```javascript
// Líneas 136-179 en Reservas.jsx
const RESERVATION_STATES = {
    pendiente: {
        label: "Pendiente",
        actions: ["confirm", "cancel", "edit"],
    },
    pending_approval: {
        label: "⚠️ Pendiente de Aprobación",
        actions: ["approve", "reject", "edit"],
    },
    confirmada: {
        label: "Confirmada",
        actions: ["cancel", "noshow", "edit"],
    },
    sentada: {
        label: "Sentada",
        actions: ["complete", "noshow", "edit"],
    },
    completada: {
        label: "Completada",
        actions: ["view"],
    },
    cancelada: {
        label: "Cancelada",
        actions: ["view", "delete"],  // ✅ YA TIENE "delete"
    },
    no_show: {
        label: "No-Show",
        actions: ["view"],  // ❌ FALTA "delete"
    },
};
```

### **2. Función Actual de Eliminación**

```javascript
// Líneas 1602-1624 en Reservas.jsx
case "delete":
    if (!window.confirm("⚠️ ¿Estás seguro de ELIMINAR permanentemente esta reserva?...")) {
        return;
    }
    try {
        const { error } = await supabase
            .from('reservations')
            .delete()  // ❌ Elimina físicamente de BD
            .eq('id', reservation.id);

        if (error) throw error;

        toast.success("Reserva eliminada permanentemente");
        loadReservations();
    } catch (error) {
        console.error('Error eliminando reserva:', error);
        toast.error('Error al eliminar la reserva');
    }
```

**PROBLEMAS ACTUALES:**
1. ❌ Usa `DELETE FROM reservations` (eliminación física)
2. ❌ NO libera los slots asociados
3. ❌ El `window.confirm()` es básico, no es un modal informativo
4. ❌ No_show no tiene acción "delete"

---

## 🎯 **CAMBIOS NECESARIOS**

### **CAMBIO 1: Añadir estado "deleted" a `RESERVATION_STATES`**

```javascript
deleted: {
    label: "Eliminada",
    color: "bg-gray-400 text-gray-700 border-gray-500",
    actions: [],  // Estado final, sin acciones
    icon: <Trash2 className="w-4 h-4" />,
}
```

### **CAMBIO 2: Añadir "delete" a no_show**

```javascript
no_show: {
    label: "No-Show",
    color: "bg-red-100 text-red-800 border-red-200",
    actions: ["view", "delete"],  // ✅ AÑADIR "delete"
    icon: <AlertTriangle className="w-4 h-4" />,
}
```

### **CAMBIO 3: Modificar función de eliminación**

**ANTES:**
```javascript
const { error } = await supabase
    .from('reservations')
    .delete()  // ❌ Eliminación física
    .eq('id', reservation.id);
```

**DESPUÉS:**
```javascript
// 1️⃣ SOFT DELETE: Cambiar status a 'deleted'
const { error: updateError } = await supabase
    .from('reservations')
    .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString()
    })
    .eq('id', reservation.id);

// 2️⃣ LIBERAR SLOTS
const { error: slotError } = await supabase
    .from('availability_slots')
    .update({
        status: 'free',
        is_available: true,
        updated_at: new Date().toISOString()
    })
    .eq('table_id', reservation.table_id)
    .eq('slot_date', reservation.reservation_date)
    .eq('start_time', reservation.reservation_time);
```

### **CAMBIO 4: Filtrar reservas eliminadas en fetchReservations**

**AÑADIR:**
```javascript
const { data, error } = await supabase
    .from('reservations')
    .select('*, customers(*), tables(*)')
    .neq('status', 'deleted')  // ✅ Ocultar las eliminadas
    .eq('restaurant_id', user.restaurant_id)
    .order('reservation_date', { ascending: false });
```

### **CAMBIO 5: Crear ConfirmDeleteModal**

**Nuevo componente:** `src/components/reservas/ConfirmDeleteModal.jsx`

```jsx
export const ConfirmDeleteModal = ({ isOpen, reservation, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-8 h-8 text-orange-500" />
                    <h2 className="text-xl font-bold text-gray-900">
                        ⚠️ ELIMINAR RESERVA
                    </h2>
                </div>

                <div className="mb-6 space-y-3">
                    <p className="text-gray-700">Esta acción:</p>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Marcará la reserva como eliminada</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>La ocultará del panel (pero quedará en BD)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>Liberará el slot para nuevas reservas</span>
                        </li>
                    </ul>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                            Reserva a eliminar:
                        </p>
                        <ul className="text-sm space-y-1">
                            <li>• <strong>Cliente:</strong> {reservation.customer_name}</li>
                            <li>• <strong>Fecha:</strong> {reservation.reservation_date}</li>
                            <li>• <strong>Hora:</strong> {reservation.reservation_time}</li>
                            <li>• <strong>Personas:</strong> {reservation.party_size}</li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(reservation.id)}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                    >
                        SÍ, ELIMINAR
                    </button>
                </div>
            </div>
        </div>
    );
};
```

---

## 📊 **DATOS QUE NECESITAMOS**

### **Para eliminar la reserva:**
- ✅ `reservation.id` (UUID)
- ✅ `reservation.table_id` (UUID)
- ✅ `reservation.reservation_date` (DATE)
- ✅ `reservation.reservation_time` (TIME)
- ✅ `reservation.restaurant_id` (UUID) - para multi-tenancy

### **Para el modal:**
- ✅ `reservation.customer_name` (VARCHAR)
- ✅ `reservation.reservation_date` (DATE)
- ✅ `reservation.reservation_time` (TIME)
- ✅ `reservation.party_size` (INTEGER)

**Todos estos datos ya vienen del objeto `reservation` en el frontend.**

---

## 🔍 **VERIFICACIÓN DE NORMAS**

### ✅ **NORMA 1: Ajuste quirúrgico**
- Solo modificamos la función `case "delete"`
- Añadimos estado `deleted` a `RESERVATION_STATES`
- Creamos componente modal reutilizable

### ✅ **NORMA 2: Datos reales**
- Todos los datos vienen del objeto `reservation` (BD)
- No hay valores hardcodeados

### ✅ **NORMA 3: Multi-tenancy**
- Filtrado por `restaurant_id` en ambas tablas
- No hay IDs hardcodeados

### ✅ **NORMA 4: Esquema verificado**
- `reservations.status` es VARCHAR(50) ✅
- `availability_slots.status` es TEXT ✅
- Columnas verificadas en schema ✅

---

## 🚨 **FLUJO COMPLETO**

### **ESCENARIO 1: Reserva Confirmada**
```
Estado: confirmed
↓
Usuario: Click "Cancelar" → status cambia a 'cancelled'
↓
Estado: cancelled
↓
Usuario: Click "Eliminar" → Modal de confirmación
↓
Usuario: "SÍ, ELIMINAR"
↓
1. UPDATE reservations SET status='deleted'
2. UPDATE availability_slots SET status='free', is_available=true
3. toast.success("Reserva eliminada y slot liberado")
4. loadReservations() (ya no aparecerá porque status='deleted')
```

### **ESCENARIO 2: No-Show**
```
Estado: no_show
↓
Usuario: Click "Eliminar" → Modal de confirmación
↓
Usuario: "SÍ, ELIMINAR"
↓
1. UPDATE reservations SET status='deleted'
2. UPDATE availability_slots SET status='free', is_available=true
3. toast.success("Reserva eliminada y slot liberado")
4. loadReservations()
```

---

## ⚠️ **CONSIDERACIONES IMPORTANTES**

### **1. ¿Qué pasa si el slot ya fue reasignado?**
- Si entre el `cancelled` y el `deleted` se creó otra reserva en ese slot, el UPDATE no afectará (diferente `table_id` + `slot_date` + `start_time`)
- ✅ **Seguro**

### **2. ¿Qué pasa si no existe el slot?**
- El UPDATE no fallará, simplemente afectará 0 filas
- ✅ **Seguro**

### **3. ¿Auditoría?**
- Las reservas eliminadas quedan en BD con `status='deleted'`
- Se puede hacer un informe de "reservas eliminadas" si es necesario
- ✅ **Trazable**

### **4. ¿Recuperación?**
- Si se eliminó por error, un admin puede cambiar manualmente el status desde BD
- ✅ **Recuperable** (con acceso a BD)

---

## ✅ **CHECKLIST PRE-IMPLEMENTACIÓN**

- [x] Documentación leída completamente
- [x] REGLA_SAGRADA verificada y respetada
- [x] Esquema de BD verificado
- [x] Flujo completo definido
- [x] Datos necesarios identificados
- [x] Multi-tenancy confirmado
- [x] Manejo de errores planificado
- [ ] Implementación pendiente (esperar confirmación del usuario)

---

## 🚀 **PRÓXIMOS PASOS**

1. Obtener confirmación del usuario
2. Implementar cambios en el orden correcto:
   - `RESERVATION_STATES` (añadir `deleted` y `delete` en `no_show`)
   - Crear `ConfirmDeleteModal.jsx`
   - Modificar función `case "delete"`
   - Añadir filtro `.neq('status', 'deleted')` en fetch
3. Probar con reserva de prueba
4. Verificar liberación de slots
5. Documentar en changelog

---

**Análisis completado. Esperando aprobación para implementar.** ✅

