# 📋 CONTEXTO DEL PROYECTO - La-IA App

## 🎯 SOBRE EL PROYECTO
- **Nombre:** La-IA App
- **Tipo:** Sistema de gestión de reservas para restaurantes
- **Arquitectura:** Multi-tenant (múltiples restaurantes)
- **Stack:** React + Supabase + PostgreSQL
- **Estado:** Producción (8.8/10)

---

## 🔴 ERRORES COMUNES QUE COMETO (Y DEBO EVITAR)

### 1. Hardcodear valores
```javascript
// ❌ MAL - Lo que hago mal
slotsMarked: 0
daysProtected: 0
duration: 90

// ✅ BIEN - Lo que debo hacer
slotsMarked: realStats?.reserved || 0  // De BD
daysProtected: results?.days_protected || 0  // Del SQL
duration: restaurantSettings?.reservation_duration || 60  // De settings
```

### 2. No verificar tablas antes de usar
- ❌ Asumir que una columna existe
- ✅ Verificar en Supabase ANTES de usar

### 3. Asumir datos en lugar de consultarlos
- ❌ "Probablemente son 60 minutos"
- ✅ Consultar `restaurants.settings.reservation_duration`

### 4. Priorizar velocidad sobre calidad
- ❌ "Pongo un 0 para que compile rápido"
- ✅ "Consulto la BD aunque tarde 2 minutos más"

### 5. No anticipar errores
- ❌ Escribir código sin manejo de errores
- ✅ Pensar: "¿Qué pasa si esto falla?"

### 6. Calcular mal slots vs reservas
- ❌ 7 reservas = 7 slots ocupados
- ✅ 7 reservas × (duración/slot_duration) = slots reales
  - Ejemplo: 7 reservas × 60min / 30min = 14 slots

---

## ✅ LO QUE DEBO HACER SIEMPRE

### ANTES de escribir código:
1. 📖 Leer `CHECKLIST_OBLIGATORIO.md`
2. 📖 Leer `NORMAS_SAGRADAS.md`
3. 🔍 Verificar esquema en Supabase
4. 🤔 Anticipar qué puede fallar
5. 📊 Confirmar de dónde vienen los datos

### DURANTE el código:
1. ✅ Consultar BD para CADA dato
2. ✅ Manejar CADA error posible
3. ✅ Seguir las 4 NORMAS
4. ✅ Pensar multi-tenant

### DESPUÉS del código:
1. 🔬 Revisar contra CHECKLIST
2. 🧪 Verificar que NO hay hardcoding
3. 📋 Confirmar que cumple las 4 NORMAS
4. ✅ SOLO ENTONCES entregar

---

## 🗂️ ESTRUCTURA DE DATOS CLAVE

### Tablas principales:
- `restaurants` - Datos del restaurante + settings (JSONB)
- `availability_slots` - Slots de disponibilidad
- `reservations` - Reservas de clientes
- `tables` - Mesas del restaurante
- `calendar_exceptions` - Excepciones de horario

### Settings importantes (restaurants.settings):
```json
{
  "operating_hours": {
    "monday": { "open": "19:00", "close": "22:00", "closed": false },
    ...
  },
  "reservation_duration": 60,
  "advance_booking_days": 30
}
```

### Cálculo de slots:
- **1 reserva de 60min con slots de 30min = 2 slots ocupados**
- **1 reserva de 90min con slots de 30min = 3 slots ocupados**
- **Fórmula:** `slots_ocupados = duración_reserva / duración_slot`

---

## 🎯 OBJETIVOS DEL PROYECTO

1. ✅ Ser la mejor app de reservas del mundo
2. ✅ Datos 100% reales y confiables
3. ✅ Multi-tenant escalable
4. ✅ Código limpio y mantenible
5. ✅ Cero deuda técnica

---

## 🔥 RECORDATORIOS CRÍTICOS

### Cuando el usuario dice:
- **"Los datos están mal"** → Probablemente hardcodeé algo
- **"No funciona multi-tenant"** → Probablemente hardcodeé restaurant_id
- **"Los cálculos no cuadran"** → Probablemente asumí valores
- **"¿Por qué inventas datos?"** → Violé NORMA 2

### Mi respuesta debe ser:
1. 🛑 Parar inmediatamente
2. 🔍 Buscar TODOS los datos hardcodeados
3. 📊 Reemplazarlos con queries reales
4. ✅ Verificar con el usuario

---

## 📊 ESTADO ACTUAL DEL PROYECTO

### Archivos críticos:
- `src/components/AvailabilityManager.jsx` - Gestión de disponibilidades
- `src/pages/Calendario.jsx` - Vista de calendario
- `src/pages/Reservas.jsx` - Gestión de reservas
- `supabase/migrations/20251007_006_no_crear_slots_ocupados.sql` - Protección de reservas

### Funcionalidades clave:
- ✅ Regeneración inteligente de slots
- ✅ Protección de días con reservas
- ✅ Sistema multi-tenant
- ✅ Modales informativos (en lugar de toasts)

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Verificar que NO hay más datos hardcodeados
2. ✅ Asegurar que todos los cálculos son correctos
3. ✅ Validar que el modal muestra datos 100% reales
4. ✅ Confirmar que las estadísticas son precisas

---

## 📅 ÚLTIMA ACTUALIZACIÓN

**Fecha:** 2025-10-07 22:30
**Cambios recientes:**
- Creados archivos de normas y checklist
- Corregidos datos hardcodeados en modales
- Implementado sistema de obtención de datos reales de BD
- Memorizada NORMA 2 como orden absoluta

---

## 🔥 LEER ESTO AL INICIO DE CADA SESIÓN

1. 📖 `NORMAS_SAGRADAS.md` - Las 4 normas
2. 📖 `CHECKLIST_OBLIGATORIO.md` - Verificación antes de codificar
3. 📖 Este archivo - Contexto y errores comunes

**NO EMPEZAR A CODIFICAR SIN LEER ESTOS 3 ARCHIVOS**
