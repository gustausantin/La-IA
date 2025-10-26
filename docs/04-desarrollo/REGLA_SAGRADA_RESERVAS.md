# 🔒 REGLA SAGRADA: PROTECCIÓN ABSOLUTA DE RESERVAS

## ⚠️ REGLA FUNDAMENTAL INQUEBRANTABLE

**LAS RESERVAS SON SAGRADAS Y NUNCA PUEDEN SER ELIMINADAS AUTOMÁTICAMENTE**

### 🚫 PROHIBICIONES ABSOLUTAS

1. **NINGUNA función automática puede eliminar reservas**
2. **NINGÚN botón puede borrar reservas sin confirmación explícita**
3. **NINGUNA regeneración puede eliminar reservas existentes**
4. **NINGÚN script puede hacer DELETE en la tabla 'reservations' (excepto testing)**

### ✅ ÚNICA FORMA AUTORIZADA DE ELIMINAR RESERVAS

**SOLO** desde `src/pages/Reservas.jsx`, línea 1331-1342:
```javascript
case "delete":
    // 🔒 REGLA SAGRADA: Esta es la ÚNICA función que puede eliminar reservas
    // ⚠️ NUNCA eliminar esta confirmación - las reservas son SAGRADAS
    if (!window.confirm("⚠️ ¿Estás seguro de ELIMINAR permanentemente esta reserva?...")) {
        return;
    }
    // Eliminar permanentemente de la base de datos (ÚNICA FUNCIÓN AUTORIZADA)
```

### 🛡️ PROTECCIONES IMPLEMENTADAS

#### 1. **Frontend - AvailabilityManager.jsx**
- `handleSmartCleanup()` - SOLO limpia UI, NUNCA toca reservations
- `generateAvailability()` - SOLO inserta slots, NUNCA elimina reservations  
- `smartRegeneration()` - PROTEGE reservas existentes, NUNCA las elimina

#### 2. **Backend - SQL Functions**
- `generate_availability_slots()` - SOLO INSERT, NUNCA DELETE reservations
- `regenerate_availability_smart()` - PROTEGE reservas, NUNCA las elimina
- Todas las funciones SQL están diseñadas para PRESERVAR reservas

#### 3. **Store - reservationStore.js**
- `cancelReservation()` - Cambia status a 'cancelled', NO elimina
- Solo actualiza estado, NUNCA elimina registros

### 🔍 AUDITORÍA DE FUNCIONES SEGURAS

| Función | Archivo | Acción | ✅ Segura |
|---------|---------|---------|-----------|
| `handleSmartCleanup()` | AvailabilityManager.jsx | Limpia UI solamente | ✅ |
| `generateAvailability()` | AvailabilityManager.jsx | Inserta slots únicamente | ✅ |
| `smartRegeneration()` | AvailabilityManager.jsx | Protege reservas existentes | ✅ |
| `generate_availability_slots()` | SQL | Solo INSERT slots | ✅ |
| `regenerate_availability_smart()` | SQL | Protege reservas | ✅ |
| `cancelReservation()` | reservationStore.js | Cambia status, no elimina | ✅ |
| **`handleReservationAction("delete")`** | **Reservas.jsx** | **ÚNICA eliminación autorizada** | ✅ |

### 🚨 PROTOCOLO DE EMERGENCIA

Si alguna vez una función elimina reservas accidentalmente:

1. **DETENER inmediatamente** la aplicación
2. **RESTAURAR** desde backup de base de datos
3. **REVISAR** todo el código que tocó la tabla 'reservations'
4. **REFORZAR** las protecciones antes de volver a producción

### 📋 CHECKLIST ANTES DE CUALQUIER DEPLOY

- [ ] ¿Alguna función nueva toca la tabla 'reservations'?
- [ ] ¿Hay algún DELETE en código SQL nuevo?
- [ ] ¿Los botones de limpieza/regeneración están protegidos?
- [ ] ¿Las confirmaciones de eliminación siguen activas?

### 💡 PRINCIPIO RECTOR

> **"Es mejor que la aplicación se rompa antes que eliminar una sola reserva por error"**

---

**Esta regla es INQUEBRANTABLE y debe ser respetada por todos los desarrolladores.**

**Fecha de creación:** 28 de septiembre de 2025  
**Última actualización:** 28 de septiembre de 2025  
**Estado:** ACTIVA Y OBLIGATORIA
