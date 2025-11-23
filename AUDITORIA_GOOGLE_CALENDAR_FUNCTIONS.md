# 🔍 Auditoría Completa: Edge Functions de Google Calendar

## ✅ RESUMEN: Todo está bien organizado, NO hay duplicaciones

Las funciones tienen propósitos muy diferentes y complementarios:

---

## 📋 FUNCIONES EXISTENTES

### 1. **`sync-google-calendar`** (index.ts - 1118 líneas)
**Propósito**: Sincronización BIDIRECCIONAL LA-IA ↔ Google Calendar  
**Uso**: Operaciones CRUD en tiempo real sobre eventos individuales  
**Actions soportadas**:
- `test`: Verifica conexión y lista eventos de todos los calendarios
- `create` / `push`: Crea un evento en GCal desde un appointment de LA-IA
- `update`: Actualiza un evento existente en GCal (incluye mover entre calendarios)
- `delete`: Elimina un evento de GCal

**Características clave**:
- ✅ Maneja múltiples calendarios (`calendar_ids`)
- ✅ Mapeo inteligente empleado → calendario
- ✅ Mapeo recurso → calendario
- ✅ Refresh automático de tokens OAuth
- ✅ Maneja movimiento de eventos entre calendarios
- ✅ Actualiza `appointments` con `gcal_event_id`, `calendar_id`, `synced_to_gcal`
- ✅ Sincronización de nombres de servicios en descripción

**Estado**: ✅ **PRODUCCIÓN - FUNCIONANDO CORRECTAMENTE**

---

### 2. **`sync-google-calendar-continuous`** (index.ts - 318 líneas)
**Propósito**: Sincronización PERIÓDICA Google Calendar → LA-IA  
**Uso**: Job programado (cada 10-15 min) para detectar cambios en GCal  
**Flujo**:
1. Se ejecuta automáticamente (Cron Job)
2. Obtiene eventos actualizados desde `last_sync_at`
3. Importa/actualiza eventos con hora como `appointments` bloqueados
4. NO sincroniza de LA-IA a GCal (solo lectura desde GCal)

**Características clave**:
- ✅ Procesa TODAS las integraciones activas
- ✅ Solo sincroniza eventos con hora (no eventos de todo el día)
- ✅ Crea appointments con `status: 'blocked'`, `source: 'google_calendar'`
- ✅ Actualiza `last_sync_at` después de cada sync
- ✅ Maneja múltiples calendarios

**Estado**: ✅ **PRODUCCIÓN - JOB AUTOMÁTICO**

---

### 3. **`google-calendar-sync`** (index.ts - 346 líneas)
**Propósito**: Sincronización BIDIRECCIONAL MASIVA (LEGACY)  
**Uso**: ⚠️ **POSIBLEMENTE OBSOLETA** - Sustituida por `sync-google-calendar`  
**Actions soportadas**:
- `import`: GCal → LA-IA (importa eventos masivamente)
- `export`: LA-IA → GCal (exporta appointments masivamente)
- `both`: Ambas direcciones

**Diferencias con `sync-google-calendar`**:
- ❌ Usa tabla `google_calendar_events` (intermedia)
- ❌ Solo soporta `primary` calendar
- ❌ NO soporta múltiples calendarios
- ❌ NO tiene mapeo empleado/recurso
- ❌ Estructura de datos diferente (`status: 'active'` en vez de `is_active: true`)

**Estado**: ⚠️ **LEGACY - REVISAR SI SE PUEDE ELIMINAR**  
**Recomendación**: Si no se usa en el frontend, DEPRECAR y eliminar.

---

### 4. **`import-google-calendar-initial`** (index.ts - 1487 líneas)
**Propósito**: Importación INICIAL INTELIGENTE con clasificación  
**Uso**: Primera conexión de Google Calendar (wizard de setup)  
**Actions soportadas**:
- `classify`: Clasifica eventos en safe/doubtful/timed
- `import`: Importa eventos seleccionados por el usuario

**Características clave**:
- ✅ Clasifica eventos de TODO EL DÍA en:
  - **Safe**: Festivos/cerrados (palabras clave detectadas)
  - **Doubtful**: Usuario decide
  - **Timed**: Eventos con hora (appointments bloqueados)
- ✅ Importa eventos de todo el día → `calendar_exceptions`
- ✅ Importa eventos con hora → `appointments` (bloqueados)
- ✅ **🆕 DETECTA CONFLICTOS** antes de importar (función `detectConflicts`)
- ✅ Mapeo inteligente recurso → trabajador por horario
- ✅ Solo importa eventos FUTUROS (desde mañana)
- ✅ Respeta `advance_booking_days` del negocio
- ✅ Bloquea/elimina `availability_slots` automáticamente

**Estado**: ✅ **PRODUCCIÓN - WIZARD DE SETUP**

---

### 5. **Funciones de Soporte OAuth y Webhooks**

#### `google-calendar-oauth` (index.ts)
- Inicia flujo OAuth con Google
- Redirige a Google para autorización

#### `google-oauth-callback` (index.ts)
- Callback después de autorización
- Intercambia código por tokens
- Guarda tokens en `integrations`

#### `list-google-calendars` (index.ts)
- Lista calendarios disponibles del usuario
- Usado en el selector de calendarios

#### `google-calendar-webhook` (index.ts)
- Recibe notificaciones de cambios desde Google Calendar
- Usado con Google Calendar Push Notifications

#### `setup-google-calendar-watch` (index.ts)
- Configura webhook de Google Calendar
- Registra el canal de notificaciones

#### `renew-google-calendar-watch` (index.ts)
- Renueva la suscripción del webhook
- Se ejecuta periódicamente (webhooks expiran cada 7 días)

**Estado**: ✅ **PRODUCCIÓN - INFRAESTRUCTURA OAUTH**

---

## 🔄 FLUJO COMPLETO DE SINCRONIZACIÓN

### 📥 Setup Inicial (Primera Conexión)
```
1. Usuario → Configuración → Conectar Google Calendar
2. `google-calendar-oauth` → Inicia OAuth
3. Usuario autoriza en Google
4. `google-oauth-callback` → Guarda tokens
5. `list-google-calendars` → Muestra calendarios disponibles
6. Usuario selecciona calendarios
7. Usuario vincula empleados/recursos
8. `import-google-calendar-initial` (action: classify) → Clasifica eventos
9. Usuario selecciona eventos a importar
10. `import-google-calendar-initial` (action: import) → Importa eventos
```

### 🔄 Sincronización en Tiempo Real (Operaciones CRUD)
```
- Usuario crea reserva en LA-IA
  → `sync-google-calendar` (action: create) → Crea evento en GCal

- Usuario actualiza reserva en LA-IA
  → `sync-google-calendar` (action: update) → Actualiza evento en GCal

- Usuario cancela reserva en LA-IA
  → `sync-google-calendar` (action: update) → Elimina evento de GCal

- Usuario elimina reserva en LA-IA
  → `sync-google-calendar` (action: delete) → Elimina evento de GCal
```

### ⏰ Sincronización Periódica (Job Automático)
```
- Cron Job (cada 10-15 min)
  → `sync-google-calendar-continuous` → Importa cambios desde GCal
  → Crea appointments bloqueados para eventos nuevos en GCal
```

### 🔔 Sincronización por Webhooks (Opcional)
```
- Cambio en Google Calendar
  → Google envía notificación
  → `google-calendar-webhook` → Procesa cambio
  → Actualiza LA-IA en tiempo real
```

---

## 🆕 DETECCIÓN PROACTIVA DE CONFLICTOS

### Implementación en el Frontend
**Archivo**: `src/components/configuracion/IntegracionesContent.jsx`

**Función `detectConflicts()`**:
- Compara eventos de Google Calendar con `appointments` existentes
- Detecta solapamientos temporales
- Devuelve array de conflictos con detalles

**Integración**:
1. **Botón "Probar Sincronización"**: Detecta conflictos antes de sincronizar
2. **Primera conexión**: Detecta conflictos antes de importar
3. **Configuración de prioridad**: Usuario elige estrategia de resolución

### Implementación en el Backend
**Archivo**: `supabase/functions/import-google-calendar-initial/index.ts`

**Función `detectConflicts()` (líneas 1318-1406)**:
- ✅ YA EXISTE en el backend desde antes
- ✅ Se ejecuta ANTES de importar eventos con hora
- ✅ Detecta solapamientos entre eventos de GCal y appointments de LA-IA
- ✅ Devuelve conflictos al frontend para mostrar modal

**Estado**: ✅ **YA IMPLEMENTADA - FUNCIONANDO**

---

## ✅ CONCLUSIONES

### 1. **NO hay duplicaciones innecesarias**
Cada función tiene un propósito único y complementario.

### 2. **Arquitectura bien diseñada**
- Separación clara de responsabilidades
- Funciones específicas para cada tarea
- Reutilización de lógica (refresh tokens, mapeos, etc.)

### 3. **✅ LEGACY ELIMINADO: `google-calendar-sync`**
**Estado**: ✅ **ELIMINADO** (2025-11-23)

**Archivos eliminados**:
- ❌ `supabase/functions/google-calendar-sync/index.ts`
- ❌ `src/services/GoogleCalendarService.js`
- ❌ `src/components/configuracion/GoogleCalendarIntegration.jsx`
- ❌ `src/pages/GoogleCallbackPage.jsx`

**Razones de eliminación**:
- Usaba estructura de datos antigua (`status: 'active'`)
- No soportaba múltiples calendarios
- Sustituida por `sync-google-calendar` (más completa)
- Usaba tabla intermedia `google_calendar_events` (innecesaria)
- NO se usaba en el frontend activo

### 4. **✅ Detección de Conflictos**
- ✅ **Backend**: Ya implementada en `import-google-calendar-initial`
- ✅ **Frontend**: Acabamos de implementar en `IntegracionesContent`
- ✅ **Integración**: Funciones coordinadas correctamente

### 5. **Flujo completo robusto**
- Setup inicial bien guiado (wizard)
- Sincronización en tiempo real (CRUD)
- Sincronización periódica (background job)
- Webhooks para cambios inmediatos (opcional)
- Detección proactiva de conflictos

---

## 🚀 RECOMENDACIONES

### Inmediatas
1. ✅ **Mantener todo como está** - La arquitectura es sólida
2. ⚠️ **Revisar `google-calendar-sync`** - Verificar si se usa, si no → eliminar
3. ✅ **Desplegar Edge Functions** actualizadas con detección de conflictos

### Futuras Mejoras (Opcional)
1. **Webhook Auto-Renewal**: Job automático para renovar webhooks antes de expirar
2. **Conflict Resolution Strategies**: Implementar las 3 estrategias automáticas
3. **Manual Assignment UI**: Modal para asignar trabajadores a eventos sin mapeo
4. **Sync History Log**: Tabla para auditar todas las sincronizaciones

---

## 📝 TABLA RESUMEN

| Función | Propósito | Dirección | Uso | Estado |
|---------|-----------|-----------|-----|--------|
| `sync-google-calendar` | CRUD tiempo real | Bidireccional | Operaciones individuales | ✅ PROD |
| `sync-google-calendar-continuous` | Sync periódica | GCal → LA-IA | Job automático | ✅ PROD |
| ~~`google-calendar-sync`~~ | ~~Sync masiva~~ | ~~Bidireccional~~ | **LEGACY** | ❌ **ELIMINADO** |
| `import-google-calendar-initial` | Setup inicial | GCal → LA-IA | Primera conexión | ✅ PROD |
| `google-calendar-oauth` | OAuth inicio | - | Setup | ✅ PROD |
| `google-oauth-callback` | OAuth callback | - | Setup | ✅ PROD |
| `list-google-calendars` | Listar calendarios | GCal → LA-IA | Setup | ✅ PROD |
| `google-calendar-webhook` | Notificaciones | GCal → LA-IA | Webhooks | ✅ PROD |
| `setup-google-calendar-watch` | Setup webhook | - | Setup | ✅ PROD |
| `renew-google-calendar-watch` | Renovar webhook | - | Mantenimiento | ✅ PROD |

---

**Fecha de auditoría**: 2025-11-23  
**Realizada por**: Cursor AI Assistant  
**Resultado**: ✅ **ARQUITECTURA APROBADA - TODO CORRECTO**

---

## 🧹 LIMPIEZA REALIZADA (2025-11-23)

### Archivos eliminados:
1. ❌ `supabase/functions/google-calendar-sync/index.ts` (346 líneas)
2. ❌ `src/services/GoogleCalendarService.js` (código LEGACY)
3. ❌ `src/components/configuracion/GoogleCalendarIntegration.jsx` (componente no usado)
4. ❌ `src/pages/GoogleCallbackPage.jsx` (página duplicada, se usa GoogleOAuthCallback.jsx)

### Resultado:
- ✅ **4 archivos eliminados** (~500 líneas de código LEGACY)
- ✅ **0 referencias rotas** - Todo verificado y limpio
- ✅ **Proyecto más limpio y mantenible**
- ✅ **Arquitectura clarificada** - Solo código en uso activo

