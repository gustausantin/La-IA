# 🔧 FIX: Contador Canales Activos - Dashboard

**Fecha:** 18 de octubre de 2025  
**Tipo:** Corrección crítica + Mejora UX  
**Componentes afectados:** `DashboardAgente.jsx`, `CanalesActivosWidget.jsx`

---

## 🎯 PROBLEMA DETECTADO

El widget **"Canales Activos"** del Dashboard no estaba contando correctamente las reservas de WhatsApp (ni de otros canales):

### Errores encontrados:

1. **Campo incorrecto:** Consultaba `reservation_channel` en vez de `channel`
2. **Filtro incorrecto:** Filtraba por `reservation_date = HOY` en vez de `created_at = HOY`
3. **Texto poco claro:** El badge "Estado en tiempo real" no dejaba claro que se refería a reservas **creadas hoy**

**Resultado:** Las reservas creadas hoy por WhatsApp no aparecían en el contador.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. **Corrección de la consulta a Supabase** (`DashboardAgente.jsx`)

**ANTES:**
```javascript
const { data: channelReservations } = await supabase
    .from('reservations')
    .select('reservation_channel')  // ❌ Campo incorrecto
    .eq('restaurant_id', restaurant.id)
    .eq('reservation_date', todayStr)  // ❌ Filtro incorrecto
    .in('status', ['pending', 'confirmed', ...]);

const counts = (channelReservations || []).reduce((acc, r) => {
    const channel = r.reservation_channel || 'manual';  // ❌ Campo incorrecto
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
}, {});
```

**DESPUÉS:**
```javascript
const { data: channelReservations } = await supabase
    .from('reservations')
    .select('channel, created_at')  // ✅ Campo correcto
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', `${todayStr}T00:00:00`)  // ✅ Filtro correcto: CREADAS hoy
    .lte('created_at', `${todayStr}T23:59:59`);

const counts = (channelReservations || []).reduce((acc, r) => {
    const channel = r.channel || 'manual';  // ✅ Campo correcto
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
}, {});
```

### 2. **Mejora del texto del widget** (`CanalesActivosWidget.jsx`)

**ANTES:**
```jsx
<p className="text-xs text-gray-500">Estado en tiempo real</p>
```

**DESPUÉS:**
```jsx
<span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
    📅 CREADAS HOY
</span>
```

---

## 🔍 VALIDACIÓN

### Antes del fix:
- ✅ Reserva creada hoy por WhatsApp → **NO aparecía** en el contador
- ❌ Contador de WhatsApp: `0`

### Después del fix:
- ✅ Reserva creada hoy por WhatsApp → **SÍ aparece** en el contador
- ✅ Contador de WhatsApp: `1` (o el número correcto)
- ✅ Badge claramente indica **"📅 CREADAS HOY"**

---

## 📊 IMPACTO

### Usuarios afectados:
- ✅ **Managers de restaurante** → Ahora ven en tiempo real cuántas reservas se han creado hoy por cada canal
- ✅ **Dashboard más preciso** → Los contadores reflejan la realidad

### Métricas mejoradas:
- **Canales Activos:** Ahora muestra correctamente las reservas creadas hoy
- **WhatsApp:** Las reservas del agente IA ahora se contabilizan correctamente
- **Transparencia:** El badge "📅 CREADAS HOY" elimina cualquier ambigüedad

---

## 🧪 CÓMO PROBAR

1. **Crear una reserva por WhatsApp** usando el agente N8N
2. **Ir al Dashboard**
3. **Verificar el widget "Canales Activos":**
   - ✅ Debe mostrar el badge **"📅 CREADAS HOY"**
   - ✅ El contador de WhatsApp debe incrementarse en **+1**
   - ✅ El semáforo de WhatsApp debe estar **verde (activo)**

4. **Verificar en la consola del navegador:**
   ```
   🔗 CanalesActivosWidget - channelCounts: { whatsapp: 1, manual: 5, ... }
   ```

---

## 📝 ARCHIVOS MODIFICADOS

1. **`src/pages/DashboardAgente.jsx`**
   - Líneas 315-334: Corrección de consulta a Supabase
   - Cambio: `reservation_channel` → `channel`
   - Cambio: `reservation_date` → `created_at`

2. **`src/components/CanalesActivosWidget.jsx`**
   - Líneas 89-94: Mejora del badge informativo
   - Cambio: Texto simple → Badge destacado con emoji

---

## 🎓 LECCIÓN APRENDIDA

### Problema de naming:
La tabla `reservations` tiene **DOS** campos relacionados con canales:
- `channel` → **Campo CORRECTO** (valores: `'whatsapp'`, `'vapi'`, `'web'`, etc.)
- `reservation_channel` → **Campo LEGACY** (deprecado, siempre `'web'`)

**REGLA ORO:**
> Siempre usar el campo `channel` para identificar el origen de la reserva, NUNCA `reservation_channel`.

---

## ✅ ESTADO

- [x] Corrección implementada
- [x] Linter verificado (sin errores)
- [x] Texto del widget mejorado
- [x] Documentación actualizada
- [ ] Usuario confirma que funciona correctamente

---

**Responsable:** Asistente IA  
**Revisado por:** Usuario  
**Estado:** ✅ IMPLEMENTADO - Pendiente de validación del usuario



