# 🔧 APLICAR MIGRATION: Add 'deleted' Status

**Fecha:** 18 de octubre de 2025  
**Migration:** `20251018_001_add_deleted_status.sql`

---

## 🎯 **OBJETIVO**

Añadir el estado `'deleted'` al CHECK CONSTRAINT de la tabla `reservations` para permitir soft delete.

---

## ⚠️ **ERROR QUE SOLUCIONA**

```
new row for relation "reservations" violates check constraint "reservations_status_check"
```

**Causa:** El constraint actual solo permite:
- `'pending'`
- `'pending_approval'`
- `'confirmed'`
- `'seated'`
- `'completed'`
- `'cancelled'`
- `'no_show'`

**NO permite:** `'deleted'`

---

## 📝 **CÓMO APLICAR**

### **OPCIÓN 1: Desde Supabase Dashboard (SQL Editor)**

1. Ir a: https://supabase.com/dashboard/project/[tu-proyecto]/sql
2. Copiar y pegar el contenido de `20251018_001_add_deleted_status.sql`
3. Click "Run" (▶️)
4. Verificar mensaje de éxito

---

### **OPCIÓN 2: Desde terminal (supabase CLI)**

```bash
supabase db push
```

---

## ✅ **VERIFICACIÓN**

Ejecutar en SQL Editor:

```sql
-- Verificar que el constraint permite 'deleted'
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'reservations_status_check';
```

**Resultado esperado:**
```
CHECK (status IN ('pending', 'pending_approval', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show', 'deleted'))
```

---

## 🧪 **PROBAR**

Después de aplicar la migration, ejecutar:

```sql
-- Intentar actualizar una reserva a 'deleted'
UPDATE reservations 
SET status = 'deleted' 
WHERE id = '...' -- UUID de una reserva cancelada
RETURNING *;
```

**Resultado esperado:** ✅ Sin error

---

## 🔙 **ROLLBACK (si es necesario)**

```sql
-- Volver al constraint anterior (sin 'deleted')
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations ADD CONSTRAINT reservations_status_check 
CHECK (status IN (
    'pending', 
    'pending_approval',
    'confirmed', 
    'seated', 
    'completed', 
    'cancelled', 
    'no_show'
));
```

---

## 📌 **NOTAS IMPORTANTES**

- ✅ Esta migration **NO afecta** datos existentes
- ✅ **NO rompe** funcionalidad actual
- ✅ Solo **añade** un valor permitido al constraint
- ✅ Es **reversible** (ver rollback arriba)

---

**Listo para aplicar.** ✅

