# 🔧 SOLUCIÓN: Errores 404 en tablas

**Problema:** El código busca tablas antiguas (`restaurants`, `user_restaurant_mapping`) pero Supabase tiene las nuevas (`businesses`, `user_business_mapping`).

**Error típico:**
```
Could not find the table 'public.user_restaurant_mapping' in the schema cache
hint: "Perhaps you meant the table 'public.user_business_mapping'"
```

---

## ✅ SOLUCIÓN APLICADA

### **1. AuthContext actualizado** ✅
- ✅ Cambiadas todas las referencias de `user_restaurant_mapping` → `user_business_mapping`
- ✅ Cambiadas todas las referencias de `restaurants` → `businesses`
- ✅ Campos actualizados: `restaurant_id` → `business_id`

### **2. Crear vistas SQL de compatibilidad** 🚀

Para evitar cambiar 25 archivos manualmente, creamos **vistas SQL** que actúan como alias:

#### **Pasos:**

1. Ve a Supabase SQL Editor: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/sql/new

2. Copia y pega el contenido del archivo `SQL-ALIAS-COMPATIBILIDAD.sql`

3. Ejecuta el script

4. Verifica que las vistas se crearon:
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('restaurants', 'user_restaurant_mapping')
ORDER BY table_name;
```

Deberías ver:
```
table_name              | table_type
-----------------------|------------
restaurants            | VIEW
user_restaurant_mapping| VIEW
```

---

## 🎯 ¿QUÉ HACE ESTE SCRIPT?

Crea 2 vistas que funcionan como **puentes** entre el código antiguo y las nuevas tablas:

### **Vista 1: `restaurants`**
```sql
restaurants (vista) 
    ↓
businesses (tabla real)
```

Cuando el código hace:
```javascript
.from('restaurants').select('*')
```

En realidad está consultando:
```javascript
.from('businesses').select('*')
```

### **Vista 2: `user_restaurant_mapping`**
```sql
user_restaurant_mapping (vista)
    ↓
user_business_mapping (tabla real)
```

---

## ✅ VENTAJAS

1. **Sin cambios masivos** - No necesitas cambiar 25 archivos ahora
2. **Migración gradual** - Puedes ir actualizando archivos poco a poco
3. **Compatibilidad total** - Todo el código antiguo funciona inmediatamente
4. **INSERT/UPDATE funcionan** - Las vistas son actualizables

---

## 📋 PRÓXIMOS PASOS

### **Opción A: Usar las vistas (RÁPIDO)** ✅ Recomendado
1. Ejecuta `SQL-ALIAS-COMPATIBILIDAD.sql` en Supabase
2. Reinicia el servidor: `npm run dev`
3. ✅ Todo funciona inmediatamente

### **Opción B: Migrar todo el código (LENTO)**
Cambiar manualmente 25 archivos para usar las nuevas tablas:
- `businesses` en lugar de `restaurants`
- `user_business_mapping` en lugar de `user_restaurant_mapping`

---

## 🚀 EJECUTA AHORA

```bash
# 1. Ve a Supabase SQL Editor
# 2. Ejecuta SQL-ALIAS-COMPATIBILIDAD.sql
# 3. Reinicia el servidor
npm run dev
```

**¡En 2 minutos todo funcionará!** ⚡

---

## 📊 ARCHIVOS QUE USAN TABLAS ANTIGUAS (25)

Estos archivos pueden seguir usando las tablas antiguas gracias a las vistas:

- src/components/AvailabilityManager.jsx
- src/pages/DashboardAgente.jsx
- src/pages/Reservas.jsx
- src/pages/Configuracion.jsx
- src/utils/businessSetup.js
- src/lib/businessService.js
- src/stores/businessStore.js
- src/lib/supabase.js
- src/components/noshows/*.jsx
- src/stores/reservationStore.js
- src/hooks/useChannelStats.js
- src/services/*.js (múltiples)
- src/api/register.js
- src/utils/healthCheck.js
- Y más...

---

**🎉 Con las vistas SQL, no necesitas tocar ninguno de estos archivos ahora.**

Puedes migrarlos gradualmente cuando tengas tiempo.

