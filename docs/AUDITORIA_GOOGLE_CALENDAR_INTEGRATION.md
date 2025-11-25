# 🔍 AUDITORÍA COMPLETA - Google Calendar Integration

**Fecha**: 24 de noviembre de 2025  
**Status**: ANÁLISIS PRE-REFACTOR  
**Objetivo**: Documentar arquitectura actual y proponer mejoras estratégicas

---

## 📋 ÍNDICE

1. [Estado Actual del Sistema](#estado-actual)
2. [Funciones Edge Implementadas](#funciones-edge)
3. [Flujo de Usuario Actual](#flujo-usuario)
4. [Problemas Identificados](#problemas)
5. [Propuesta de Arquitectura Nueva](#propuesta)
6. [Plan de Migración](#plan-migracion)

---

## 1. ESTADO ACTUAL DEL SISTEMA {#estado-actual}

### ✅ Lo que FUNCIONA

1. **Conexión OAuth con Google** ✅
   - Función: `google-calendar-oauth`
   - Usuario puede autenticar su cuenta de Google
   - Tokens se guardan en tabla `integrations`
   - Refresh token funciona correctamente

2. **Listado de Calendarios** ✅
   - Función: `list-google-calendars`
   - Se obtienen todos los calendarios del usuario
   - Se puede seleccionar qué calendarios sincronizar

3. **Selección de Calendarios** ✅
   - Usuario puede elegir uno o varios calendarios
   - Se guarda en `integrations.config.calendar_ids`

4. **Mapeo a Empleados/Recursos** ✅
   - Usuario puede elegir entre:
     - **Por Trabajador**: 1 Calendar → 1 Empleado
     - **Por Recurso**: 1 Calendar → 1 Silla/Sala
   - Se guarda en `integrations.config.employee_calendar_mapping`

5. **Sincronización Básica (Push LA-IA → Google)** ✅
   - Función: `sync-google-calendar` (action: 'create', 'update', 'delete')
   - Cuando se crea una cita en LA-IA, se envía a Google Calendar
   - Se guarda `gcal_event_id` en la tabla `appointments`

6. **Webhooks de Google** ✅
   - Función: `google-calendar-webhook`
   - Google notifica cambios en tiempo real
   - Función: `setup-google-calendar-watch` configura los webhooks

### 🚨 FUNCIONES EDGE EXISTENTES (Total: 10)

```
📁 supabase/functions/
  ├── google-calendar-oauth          [OAuth 2.0 - Autenticación]
  ├── list-google-calendars           [Listar calendarios del usuario]
  ├── sync-google-calendar            [Sync bidireccional - FUNCIÓN PRINCIPAL]
  ├── import-google-calendar-initial  [Primera importación masiva]
  ├── sync-google-calendar-continuous [Sync continua en background]
  ├── google-calendar-webhook         [Recibir notificaciones push de Google]
  ├── setup-google-calendar-watch     [Configurar notificaciones push]
  ├── renew-google-calendar-watch     [Renovar canal de notificaciones]
  └── check-availability-unified      [Verificar disponibilidad considerando Google]
```

---

## 2. FUNCIONES EDGE IMPLEMENTADAS {#funciones-edge}

### 📌 **sync-google-calendar** (Función Principal)

**Acciones soportadas**:
- `test`: Verificar conexión y contar eventos
- `list`: Listar eventos de Google Calendar (sin sincronizar)
- `sync`: Sincronización bidireccional automática
- `create`/`push`: Crear evento en Google Calendar desde LA-IA
- `update`: Actualizar evento existente
- `delete`: Eliminar evento de Google Calendar

**Flujo actual**:
1. Verifica token de acceso (refresca si está expirado)
2. Obtiene calendarios seleccionados
3. Para cada calendario:
   - Busca eventos en rango de ±90 días
   - Mapea eventos a empleados/recursos
4. Ejecuta acción solicitada

**Lógica de mapeo actual**:
```
Si appointment tiene employee_id:
  → Buscar en employee_calendar_mapping[employee_id]
  → Si no existe mapping, NO SINCRONIZAR

Si appointment tiene resource_id pero no employee_id:
  → Intentar inferir employee desde assigned_resource_id
  → Si se encuentra, usar su calendario
  → Si no, NO SINCRONIZAR
```

---

## 3. FLUJO DE USUARIO ACTUAL {#flujo-usuario}

### 🎯 Pasos del Usuario (Estado Actual)

```
1. Usuario hace clic en "Conectar con Google"
   ├─→ OAuth redirect
   ├─→ Callback guarda tokens
   └─→ Vuelve a /configuracion?tab=integraciones

2. Sistema detecta conexión exitosa
   ├─→ Muestra "✅ Conectado"
   ├─→ Carga automáticamente calendarios disponibles
   └─→ Pregunta: "¿Cómo quieres configurar?"

3. Usuario elige tipo de mapeo:
   ├─→ OPCIÓN A: "Por Trabajador" (cada persona su calendario)
   └─→ OPCIÓN B: "Por Recurso" (cada silla/sala su calendario)

4. Usuario hace clic en "Seleccionar Calendarios"
   ├─→ Modal muestra lista de calendarios de Google
   ├─→ Usuario marca los que quiere sincronizar
   └─→ Guarda calendar_ids[]

5. Usuario mapea calendarios a empleados/recursos
   ├─→ Componente <EmployeeCalendarLinker /> o <ResourceCalendarLinker />
   ├─→ Asigna: "Calendario Pepe → Empleado Pepe"
   └─→ Guarda employee_calendar_mapping{}

6. Usuario hace clic en "Detectar Conflictos" 🚨 [PROBLEMA]
   ├─→ Sistema llama detectConflicts()
   ├─→ Compara eventos de Google vs appointments de LA-IA
   ├─→ Si hay conflictos:
   │    ├─→ Muestra modal rojo con opciones destructivas
   │    ├─→ "Priorizar Google" → Borra appointments de LA-IA
   │    ├─→ "Priorizar LA-IA" → Ignora eventos de Google
   │    └─→ "Omitir conflictos" → No importa nada
   └─→ Usuario DEBE resolver conflictos para continuar

7. Usuario hace clic en "Importar Eventos"
   ├─→ Función import-google-calendar-initial
   ├─→ Importa eventos de Google como appointments
   └─→ Marca como synced_to_gcal = true
```

---

## 4. PROBLEMAS IDENTIFICADOS {#problemas}

### 🔴 **PROBLEMA 1: Modal de Conflictos Destructivo**

**Situación actual**:
```jsx
// src/components/configuracion/GoogleCalendarConflictModal.jsx
<Modal title="⚠️ Conflictos Detectados">
  <RadioButton value="priorizar_google">
    Cancelar los appointments de LA-IA e importar todos los eventos de Google
    ❌ 1 appointment(s) serán cancelado(s)
  </RadioButton>
  
  <RadioButton value="priorizar_laia">
    Mantener appointments de LA-IA y omitir eventos conflictivos de Google
    ⚠️ 1 evento(s) serán omitido(s)
  </RadioButton>
  
  <RadioButton value="omitir">
    Importar solo eventos sin conflictos
  </RadioButton>
</Modal>
```

**Por qué es problemático**:
- ❌ **Destructivo**: Borra datos sin posibilidad de recuperación
- ❌ **Falsa dicotomía**: Asume que un conflicto = error
- ❌ **Fricción cognitiva**: Usuario no sabe qué elegir (miedo a equivocarse)
- ❌ **No contempla doble reserva intencional**: En salones, 2 personas pueden trabajar simultáneamente

**Casos reales donde "conflicto" NO es error**:
1. Barbería con 2 empleados trabajando en paralelo
2. Tinte (90 min) + Corte (30 min) solapados (tinte se deja actuar solo)
3. Usuario anotó "Reunión personal" en Google pero puede atender si es urgente
4. Error humano que se resuelve moviendo la tarjeta, no borrando

---

### 🔴 **PROBLEMA 2: Sincronización Unidireccional Frágil**

**Situación actual**:
- LA-IA → Google: ✅ Funciona bien
- Google → LA-IA: ⚠️ Solo en importación inicial o al "Detectar Conflictos"
- No hay sincronización continua automática de Google → LA-IA

**Escenario problemático**:
```
1. Usuario conecta Google Calendar
2. Importa eventos (una vez)
3. Al día siguiente, anota "Comida 14:00" en Google
4. LA-IA NO SE ENTERA
5. Cliente llama y la IA reserva a las 14:15
6. ❌ CONFLICTO REAL: Usuario tiene "Comida" pero LA-IA reservó cita
```

**Causa raíz**:
- Webhooks de Google están configurados pero no se procesan correctamente
- `google-calendar-webhook` recibe notificación pero NO actualiza tabla `appointments`
- Solo actualiza `integrations.last_sync_at`

---

### 🔴 **PROBLEMA 3: Modelo de Datos Confuso**

**Estado actual de la tabla `appointments`**:
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL,
  employee_id UUID,           -- ❓ A veces NULL
  resource_id UUID,            -- ❓ A veces NULL  
  gcal_event_id TEXT,          -- ID del evento en Google
  calendar_id TEXT,            -- ID del calendario de Google
  synced_to_gcal BOOLEAN,      -- ¿Ya se envió a Google?
  source TEXT,                 -- 'manual', 'vapi', 'online', 'google_calendar'
  status TEXT,                 -- 'confirmed', 'pending', 'cancelled'
  -- ... otros campos
)
```

**Problema**:
- ❌ **Mezcla conceptos**: Una cita de LA-IA y un "evento externo" de Google NO son lo mismo
- ❌ **Bloqueos personales se convierten en appointments**: "Comida" no es una cita con cliente
- ❌ **Dificulta queries**: ¿Cómo saber si un appointment es "real" o es un bloqueo externo?

---

### 🔴 **PROBLEMA 4: UX Confuso - Demasiadas Opciones**

**Pantalla actual** (ver screenshot):
```
[✅ Conectado]

┌─ Calendario(s): 1 calendario(s)
├─ Calendarios activos: 1
├─ Última Sync: 24/11/2025 12:30:04
└─ Eventos Sincronizados: 0

┌─ ¿Cómo quieres configurar los calendarios?
├─ 🧑 Por Trabajador
└─ 📦 Por Recurso

┌─ ⚡ Resolución Automática de Conflictos  🚨 [ELIMINAR]
├─ ⚪ Preguntarme siempre (Recomendado)
├─ ⚪ LA-IA es la fuente de verdad
└─ ⚪ Google Calendar es la fuente de verdad
    ⚠️ Las reservas de LA-IA se cancelarán si hay conflictos

[Seleccionar Calendarios] [Probar Sincronización] [Importar Eventos] [Desconectar]
```

**Problemas UX**:
- ❌ **Sobrecarga de opciones**: 4 botones principales + 3 opciones de conflictos
- ❌ **Lenguaje técnico**: "Resolución Automática de Conflictos" asusta
- ❌ **No explica qué pasa**: Usuario no entiende diferencia entre "Probar" vs "Importar"
- ❌ **Estado oculto**: "0 eventos sincronizados" pero en realidad hay 100 en Google

---

## 5. PROPUESTA DE ARQUITECTURA NUEVA {#propuesta}

### 🎯 **FILOSOFÍA: "Single Source of Truth per Entity"**

**Regla de oro**:
> Cada evento tiene UN DUEÑO. El dueño es la plataforma donde nació.

### 🔄 **Modelo Bidireccional Asimétrico**

```
┌─────────────────────────────────────────────────────────────┐
│                    DIRECCIONALIDAD                          │
└─────────────────────────────────────────────────────────────┘

LA-IA → Google Calendar (ESPEJO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Qué:   Citas generadas por IA, reservas online, bookings manuales
🎨 Cómo:  Aparecen en Google Calendar como eventos normales
🔒 Regla: LA-IA es el dueño. Si usuario borra en Google, LA-IA LO RESTAURA
📝 Firma: Evento lleva descripción: "🤖 Gestionado por LA-IA"


Google Calendar → LA-IA (BLOQUEOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Qué:   Eventos personales, reuniones, comidas, vacaciones
🎨 Cómo:  Aparecen en LA-IA como BLOQUES GRISES (no editables)
🔒 Regla: Google es el dueño. LA-IA solo los RESPETA (no puede modificarlos)
🚫 UX:    Al hacer clic: "Este evento vive en Google Calendar. Edítalo allí."
```

### 📊 **Nuevo Modelo de Datos**

#### Crear nueva tabla: `external_calendar_blocks`
```sql
CREATE TABLE external_calendar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  
  -- Identificación
  external_event_id TEXT NOT NULL,      -- ID del evento en Google
  calendar_id TEXT NOT NULL,            -- ID del calendario de Google
  employee_id UUID REFERENCES employees(id), -- Empleado bloqueado
  resource_id UUID REFERENCES resources(id), -- Recurso bloqueado
  
  -- Datos del evento (solo lectura)
  title TEXT NOT NULL,                  -- "Comida", "Reunión colegio"
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  
  -- Metadata
  source TEXT DEFAULT 'google_calendar', -- Para futuras integraciones
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB,                       -- Evento completo de Google
  
  -- Índices
  UNIQUE(business_id, external_event_id),
  INDEX idx_blocks_time (business_id, start_time, end_time),
  INDEX idx_blocks_employee (employee_id, start_time),
  INDEX idx_blocks_resource (resource_id, start_time)
);
```

#### Mantener tabla `appointments` limpia:
```sql
-- appointments SOLO para citas REALES de LA-IA
-- NUNCA mezclar con eventos externos
```

---

### ⚙️ **Lógica de Sincronización Nueva**

#### **1. Push: LA-IA → Google (Sin cambios, funciona bien)**
```javascript
// Al crear appointment en LA-IA
async function createAppointment(appointmentData) {
  // 1. Crear en BD local
  const appointment = await db.appointments.create(appointmentData)
  
  // 2. Enviar a Google Calendar
  const gcalEvent = await syncToGoogle({
    action: 'create',
    reservation_id: appointment.id
  })
  
  // 3. Guardar referencia
  await db.appointments.update(appointment.id, {
    gcal_event_id: gcalEvent.id,
    calendar_id: gcalEvent.calendar_id,
    synced_to_gcal: true
  })
  
  return appointment
}
```

#### **2. Pull: Google → LA-IA (REDISEÑO COMPLETO)**
```javascript
// Al recibir webhook de Google o en sync periódica
async function syncExternalBlocks(businessId) {
  // 1. Obtener eventos de Google Calendar
  const gcalEvents = await getGoogleCalendarEvents()
  
  // 2. FILTRAR: Ignorar eventos que YA son de LA-IA
  const externalEvents = gcalEvents.filter(event => {
    // Si tiene extendedProperties.la_ia_appointment_id, es NUESTRO
    return !event.extendedProperties?.private?.la_ia_appointment_id
  })
  
  // 3. Para cada evento externo, crear/actualizar bloqueo
  for (const event of externalEvents) {
    await db.external_calendar_blocks.upsert({
      external_event_id: event.id,
      calendar_id: event.calendar_id,
      employee_id: getEmployeeFromCalendar(event.calendar_id),
      title: event.summary,
      start_time: event.start.dateTime || event.start.date,
      end_time: event.end.dateTime || event.end.date,
      is_all_day: !!event.start.date,
      raw_data: event
    })
  }
  
  // 4. Eliminar bloqueos que ya no existen en Google
  await cleanupDeletedBlocks()
}
```

#### **3. Detección de Disponibilidad (Motor de Reservas)**
```javascript
// Al buscar slots disponibles
async function checkAvailability(employeeId, date, time) {
  // 1. Verificar appointments de LA-IA
  const hasAppointment = await db.appointments.exists({
    employee_id: employeeId,
    appointment_date: date,
    appointment_time: time,
    status: ['confirmed', 'pending']
  })
  
  // 2. Verificar bloqueos externos (Google Calendar)
  const hasExternalBlock = await db.external_calendar_blocks.exists({
    employee_id: employeeId,
    start_time: { $lte: requestedTime },
    end_time: { $gte: requestedTime }
  })
  
  // 3. Respuesta
  return {
    available: !hasAppointment && !hasExternalBlock,
    reason: hasAppointment ? 'Ya hay una cita' : 
            hasExternalBlock ? 'Bloqueado por evento personal' : null
  }
}
```

---

### 🎨 **Nueva UX (Interfaz Simplificada)**

#### **Pantalla de Configuración**
```
┌──────────────────────────────────────────────────────────────┐
│  Google Calendar                            ✅ Conectado     │
├──────────────────────────────────────────────────────────────┤
│  Sincroniza automáticamente tus reservas con Google Calendar │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  📊 Resumen de Sincronización                                │
├──────────────────────────────────────────────────────────────┤
│  Última sincronización: Hace 2 minutos                       │
│  • Citas en Google Calendar: 8 eventos                       │
│  • Eventos personales detectados: 12 bloqueos               │
│  • Calendarios vinculados: Empleado 1                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ¿Cómo quieres configurar los calendarios?                   │
├──────────────────────────────────────────────────────────────┤
│  ⚪ Por Trabajador                                            │
│     Cada calendario corresponde a un trabajador específico   │
│     ✓ Ideal si cada trabajador tiene su propio calendario   │
│     ✓ Asignación directa trabajador ↔ calendario            │
│                                                               │
│  ⚪ Por Recurso                                              │
│     Cada calendario corresponde a un recurso físico (ej: Silla 1)│
│     ✓ El sistema asignará trabajadores por horario          │
│     ⚠️ Requiere que los recursos tengan trabajadores asignados│
└──────────────────────────────────────────────────────────────┘

[Continuar con esta opción]

┌──────────────────────────────────────────────────────────────┐
│  🔄 Sincronización Inteligente Activada                      │
├──────────────────────────────────────────────────────────────┤
│  🤖 Lo que pasa en LA-IA...                                  │
│     Aparece en tu Google Calendar automáticamente            │
│                                                               │
│  📅 Lo que anotas en Google...                               │
│     Bloquea tu agenda aquí. Respetamos tus eventos personales│
└──────────────────────────────────────────────────────────────┘

[Seleccionar Calendarios]  [Ver Configuración Avanzada]  [Desconectar]
```

#### **Vista de Calendario (Tarjetas diferenciadas)**
```
Lunes 25 Nov 2025
┌─────────────────────────────────────┐
│ 09:00 - 09:45  María López          │ ← Cita LA-IA (Blanca, editable)
│ Corte + Tinte                       │
│ 📞 612 345 678                      │
│ [Editar] [Cancelar] [WhatsApp]      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 11:00 - 12:00  🔒 Reunión Colegio   │ ← Bloqueo Google (Gris, solo lectura)
│ 📅 Evento de Google Calendar        │
│ [Ver en Google]                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 14:00 - 14:30  Juan Pérez           │ ← Cita LA-IA
│ Barba                                │
│ [Editar] [Cancelar]                  │
└─────────────────────────────────────┘
```

---

## 6. PLAN DE MIGRACIÓN {#plan-migracion}

### 📝 **FASE 1: Preparación (No toca código existente)**
- ✅ [COMPLETADO] Auditoría del sistema actual
- ⏳ [PENDIENTE] Revisión con CTO externo
- ⏳ [PENDIENTE] Documentar casos edge
- ⏳ [PENDIENTE] Crear tests E2E del flujo actual

### 📝 **FASE 2: Base de Datos**
- Crear tabla `external_calendar_blocks`
- Migrar datos existentes (si los hay) de appointments con source='google_calendar'
- Crear índices optimizados
- Crear función SQL `get_availability_with_blocks()`

### 📝 **FASE 3: Backend (Edge Functions)**
- Modificar `sync-google-calendar`:
  - Separar lógica de pull (crear bloqueos)
  - Mantener lógica de push (funciona bien)
- Modificar `google-calendar-webhook`:
  - Procesar cambios en tiempo real
  - Actualizar tabla `external_calendar_blocks`
- Crear función `cleanup-deleted-blocks` (cron job)

### 📝 **FASE 4: Frontend**
- Eliminar `GoogleCalendarConflictModal.jsx` 🗑️
- Simplificar `IntegracionesContent.jsx`:
  - Eliminar sección "Resolución de Conflictos"
  - Agregar tarjeta informativa
- Modificar vista de calendario:
  - Diferenciar visualmente appointments vs blocks
  - Deshabilitar edición en bloqueos externos

### 📝 **FASE 5: Testing**
- Test: Crear cita en LA-IA → Aparece en Google
- Test: Crear evento en Google → Aparece como bloqueo en LA-IA
- Test: Borrar evento de Google → Bloqueo desaparece en LA-IA
- Test: Borrar cita de LA-IA en Google → LA-IA la restaura
- Test: Motor de reservas respeta bloqueos externos

### 📝 **FASE 6: Deploy Gradual**
- Feature flag: `enable_new_google_sync`
- Activar para 1 negocio piloto
- Monitorizar logs y errores
- Rollout progresivo

---

## 💡 DECISIONES CLAVE PARA DISCUTIR

### 🤔 **PREGUNTA 1: ¿Qué hacemos si el usuario borra una cita de LA-IA desde Google Calendar?**

**ESTADO ACTUAL**: ✅ **YA ESTÁ IMPLEMENTADO** - No restauramos, marcamos como cancelada.

**Implementación en `google-calendar-webhook/index.ts` líneas 274-332**:
```typescript
// ✅ Detectar eventos eliminados
const receivedEventIds = new Set<string>()
// ... procesar eventos ...

// ✅ Buscar appointments que ya no están en Google Calendar
const existingAppointments = await supabaseClient
  .from('appointments')
  .select('*')
  .eq('source', 'google_calendar')  // ← SOLO los que vinieron de Google
  .not('gcal_event_id', 'is', null)
  
for (const appointment of existingAppointments) {
  if (!receivedEventIds.has(appointment.gcal_event_id)) {
    // ✅ CANCELAR el appointment porque se eliminó de Google
    await supabaseClient
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)
  }
}
```

**DECISIÓN CORRECTA**: Respetamos Google como fuente de verdad para eventos QUE VINIERON DE GOOGLE.  
**NO** borramos citas creadas en LA-IA si se borran en Google (tienen `source != 'google_calendar'`).

---

### 🤔 **PREGUNTA 2: ¿Sincronización continua o manual?**

**ESTADO ACTUAL**: ✅ **YA ESTÁ IMPLEMENTADO** - Sistema Híbrido (Webhooks + Polling)

**Implementación completa**:

1. **Webhooks en tiempo real** (`google-calendar-webhook/index.ts`):
   - Google envía notificaciones push cuando hay cambios
   - Latencia < 1 segundo
   - Canales expiran cada 7 días
   - `setup-google-calendar-watch` los renueva automáticamente

2. **Polling de respaldo** (`sync-google-calendar-continuous/index.ts`):
   - Se ejecuta periódicamente (configurable)
   - Sincroniza desde `last_sync_at` hasta ahora
   - Detecta cambios que los webhooks pudieron perder

**DECISIÓN CORRECTA**: Sistema robusto con redundancia. Si fallan los webhooks, el polling los cubre.

---

### 🤔 **PREGUNTA 3: ¿Importamos eventos pasados de Google o solo futuros?**

**ESTADO ACTUAL**: ✅ **YA ESTÁ IMPLEMENTADO** - Configurable por negocio usando `advance_booking_days`

**Implementación en `import-google-calendar-initial/index.ts` líneas 141-308**:
```typescript
// ✅ Obtener configuración del negocio
const { data: businessData } = await supabaseClient
  .from('businesses')
  .select('settings')
  .eq('id', business_id)
  .single()

// ✅ Usar días de anticipación configurados
const advanceBookingDays = businessData?.settings?.booking_settings?.advance_booking_days || 90

// ✅ Solo eventos FUTUROS (desde mañana)
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
tomorrow.setHours(0, 0, 0, 0)

const timeMin = tomorrow.toISOString()  // ← Desde mañana
const timeMax = new Date(tomorrow)
timeMax.setDate(timeMax.getDate() + advanceBookingDays)  // ← Hasta X días configurados
```

**DECISIÓN CORRECTA**: 
- **NO importa eventos pasados** (ni siquiera de hoy)
- **Respeta configuración del negocio** (`advance_booking_days`)
- Si el negocio tiene 30 días de anticipación, solo importa hasta 30 días futuros

---

## 📌 RESUMEN EJECUTIVO

### ✅ Lo que hay que MANTENER:
1. OAuth con Google ✅
2. Selección de calendarios ✅
3. Mapeo a empleados/recursos ✅
4. Push LA-IA → Google ✅
5. Webhooks de Google ✅

### 🔄 Lo que hay que CAMBIAR:
1. ❌ **Eliminar modal de conflictos destructivo**
2. ✅ **Crear tabla `external_calendar_blocks`**
3. ✅ **Separar lógica: appointments (LA-IA) vs blocks (Google)**
4. ✅ **Simplificar UX: tarjeta informativa en vez de opciones**
5. ✅ **Sincronización pull continua y automática**

### 🎯 Resultado Final:
- ✨ **Experiencia sin fricción**: Usuario conecta Google y "just works"
- 🔒 **Datos protegidos**: Nunca se borran appointments automáticamente
- 🎨 **Visual claro**: Diferencia obvia entre citas y bloqueos
- ⚡ **Tiempo real**: Cambios en Google aparecen al instante en LA-IA
- 💪 **Robusto**: Overbooking permitido, se resuelve visualmente

---

## 🚀 PRÓXIMOS PASOS

1. **Validar con equipo**: Revisar esta auditoría con CTO externo y tu amigo
2. **Priorizar**: ¿Hacemos todo o empezamos por eliminar modal de conflictos?
3. **Estimar tiempo**: FASE 2-4 = ~3-4 días de desarrollo
4. **Crear tickets**: Dividir en tareas pequeñas
5. **Testing**: Plan de QA robusto

---

**FIN DE LA AUDITORÍA**

_Documento vivo - Se actualizará según decisiones del equipo_

