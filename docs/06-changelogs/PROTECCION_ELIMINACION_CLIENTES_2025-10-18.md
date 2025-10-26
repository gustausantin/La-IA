# 🔒 PROTECCIÓN: Eliminación de Clientes con Reservas

**Fecha:** 18 de octubre de 2025  
**Estado:** 📝 DOCUMENTADO (Pendiente implementación)  
**Tipo:** Data Integrity

---

## 🎯 **OBJETIVO**

Proteger la integridad de datos evitando que se eliminen clientes que tienen reservas activas o histórico importante.

---

## 🔍 **CASOS DE USO**

### **Caso 1: Cliente con reservas ACTIVAS**
```
Cliente: "Gustavo Santin"
Reservas:
  ✅ 18/10/2025 20:00 (confirmed)
  ✅ 21/10/2025 21:00 (pending)

Acción: Intentar eliminar
Resultado: ❌ PROHIBIDO
Mensaje: "Este cliente tiene reservas activas. No se puede eliminar."
```

### **Caso 2: Cliente con SOLO reservas pasadas**
```
Cliente: "Maria Lopez"
Reservas:
  📅 10/10/2025 19:00 (completed)
  📅 12/10/2025 20:00 (no_show)

Acción: Intentar eliminar
Resultado: ⚠️ ADVERTENCIA + Soft Delete
Mensaje: "Este cliente tiene 2 reservas pasadas. ¿Desactivar en vez de eliminar?"
```

### **Caso 3: Cliente SIN reservas**
```
Cliente: "Pedro Nuevo"
Reservas: (ninguna)

Acción: Intentar eliminar
Resultado: ✅ PERMITIDO (Soft Delete)
```

---

## 🎯 **ESTRATEGIA RECOMENDADA**

### **Soft Delete en vez de DELETE físico**

```sql
-- Tabla customers ya tiene is_active
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- "Eliminar" = Desactivar
UPDATE customers 
SET is_active = FALSE 
WHERE id = '...';
```

**Ventajas:**
- ✅ No rompe Foreign Keys
- ✅ Mantiene histórico de reservas
- ✅ Puedes reactivar si fue error
- ✅ Estadísticas intactas

---

## 🔧 **IMPLEMENTACIÓN PROPUESTA**

### **Función: `handleDeleteCustomer`**

```javascript
const handleDeleteCustomer = async (customerId) => {
    try {
        // 1️⃣ VERIFICAR si tiene reservas ACTIVAS
        const { data: activeReservations, error: checkError } = await supabase
            .from('reservations')
            .select('id, reservation_date, reservation_time, status')
            .eq('customer_id', customerId)
            .in('status', ['pending', 'pending_approval', 'confirmed', 'seated']);

        if (checkError) throw checkError;

        // 2️⃣ Si tiene reservas ACTIVAS → PROHIBIR
        if (activeReservations && activeReservations.length > 0) {
            toast.error(
                `❌ Este cliente tiene ${activeReservations.length} reserva(s) activa(s). No se puede eliminar.`
            );
            return;
        }

        // 3️⃣ Verificar si tiene reservas PASADAS
        const { data: pastReservations, error: pastError } = await supabase
            .from('reservations')
            .select('id, status')
            .eq('customer_id', customerId)
            .in('status', ['completed', 'cancelled', 'no_show', 'deleted']);

        if (pastError) throw pastError;

        // 4️⃣ Si tiene reservas PASADAS → ADVERTENCIA
        if (pastReservations && pastReservations.length > 0) {
            const confirmMsg = `⚠️ Este cliente tiene ${pastReservations.length} reserva(s) pasada(s).\n\n` +
                               `Si lo desactivas, ya no aparecerá en búsquedas, pero su histórico se mantendrá.\n\n` +
                               `¿Desactivar este cliente?`;
            
            if (!window.confirm(confirmMsg)) {
                return;
            }
        }

        // 5️⃣ SOFT DELETE: Desactivar cliente
        const { error: updateError } = await supabase
            .from('customers')
            .update({ 
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', customerId);

        if (updateError) throw updateError;

        toast.success('✅ Cliente desactivado correctamente');
        loadCustomers(); // Recargar lista (filtrar por is_active=true)

    } catch (error) {
        console.error('❌ Error al desactivar cliente:', error);
        toast.error('Error al desactivar el cliente');
    }
};
```

---

## 📊 **LÓGICA DE DECISIÓN**

```
┌─────────────────────────────────┐
│ Intentar eliminar cliente       │
└────────────┬────────────────────┘
             │
             ▼
   ┌─────────────────────┐
   │ ¿Tiene reservas     │
   │ ACTIVAS?            │
   └─────┬───────────┬───┘
         │ SÍ        │ NO
         ▼           ▼
    ❌ PROHIBIR   ┌────────────────┐
    Mostrar error│ ¿Tiene reservas│
                 │ PASADAS?       │
                 └─────┬──────┬───┘
                       │ SÍ   │ NO
                       ▼      ▼
                  ⚠️ ADVERTIR  ✅ PERMITIR
                  + Confirmar  Soft Delete
                  ↓
                  Soft Delete
```

---

## 🔒 **REGLAS DE PROTECCIÓN**

### **NUNCA permitir si:**
- ❌ Tiene reservas con status: `pending`, `confirmed`, `seated`, `pending_approval`

### **ADVERTIR si:**
- ⚠️ Tiene reservas con status: `completed`, `cancelled`, `no_show`, `deleted`

### **SIEMPRE:**
- ✅ Usar soft delete (`is_active=FALSE`)
- ✅ NO usar `DELETE FROM customers`
- ✅ Mantener relaciones intactas

---

## 📁 **ARCHIVOS A MODIFICAR**

### **1. Filtrar clientes inactivos en frontend**

```javascript
// En loadCustomers() o equivalente
const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)  // ✅ Solo clientes activos
    .order('created_at', { ascending: false });
```

### **2. Añadir columna `is_active` si no existe**

```sql
-- Migration: 20251018_002_customers_soft_delete.sql
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_customers_is_active 
ON customers(is_active) 
WHERE is_active = TRUE;
```

---

## 🧪 **TESTING**

### **✅ Test 1: Cliente con reserva activa**
```
1. Cliente con reserva confirmed para mañana
2. Intentar eliminar
3. ✅ Mensaje: "Este cliente tiene 1 reserva activa. No se puede eliminar."
4. ✅ Cliente NO se desactiva
```

### **✅ Test 2: Cliente con solo reservas pasadas**
```
1. Cliente con 2 reservas completed de hace 1 mes
2. Intentar eliminar
3. ✅ Modal: "¿Desactivar este cliente? Tiene 2 reservas pasadas"
4. Click "Aceptar"
5. ✅ Cliente desactivado (is_active=false)
6. ✅ Ya no aparece en lista
7. ✅ Reservas pasadas intactas en BD
```

### **✅ Test 3: Cliente sin reservas**
```
1. Cliente nuevo sin reservas
2. Intentar eliminar
3. ✅ Desactiva directamente (is_active=false)
4. ✅ Ya no aparece en lista
```

---

## 💡 **VENTAJAS DEL SOFT DELETE**

### **1. Integridad Referencial**
- ✅ No rompe FK en `reservations`
- ✅ No rompe FK en otras tablas que referencien `customers`

### **2. Auditoría y Trazabilidad**
- ✅ Historial completo de reservas
- ✅ Estadísticas de no-shows intactas
- ✅ Facturación histórica disponible

### **3. Recuperación**
```sql
-- Si fue un error, se puede reactivar
UPDATE customers 
SET is_active = TRUE 
WHERE id = '...';
```

### **4. Reportes**
- ✅ Análisis de clientes VIP (aunque desactivados)
- ✅ Estadísticas de comportamiento histórico
- ✅ No-show rate por cliente

---

## 📝 **MENSAJE AL USUARIO**

### **Reservas activas:**
```
❌ No se puede eliminar este cliente

Este cliente tiene 2 reservas activas:
• 18/10/2025 a las 20:00 (Confirmada)
• 21/10/2025 a las 21:00 (Pendiente)

Cancela o completa las reservas antes de eliminar el cliente.

[Entendido]
```

### **Reservas pasadas:**
```
⚠️ Desactivar cliente

Este cliente tiene 5 reservas pasadas en el sistema.

Si lo desactivas:
✓ Ya no aparecerá en búsquedas
✓ No podrá hacer nuevas reservas
✓ Su histórico se mantendrá para auditoría

¿Desactivar este cliente?

[Cancelar]  [SÍ, DESACTIVAR]
```

---

## ✅ **ESTADO**

📝 Documentado  
⏳ Pendiente de implementación  
🎯 Prioridad: Media (buena práctica, no crítico)

---

## 🚀 **PRÓXIMOS PASOS**

1. Crear migration para `is_active`
2. Implementar `handleDeleteCustomer` con verificaciones
3. Añadir filtro `is_active=true` en `loadCustomers`
4. Crear modales de confirmación
5. Testing completo

---

**¿Quieres que implemente esto ahora o lo dejamos para después?** 🤔
