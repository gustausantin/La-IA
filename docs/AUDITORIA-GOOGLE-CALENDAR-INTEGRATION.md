# 🔍 AUDITORÍA COMPLETA: Integración Google Calendar

**Fecha:** 2025-11-18  
**Objetivo:** Revisar toda la aplicación antes de implementar verificación de disponibilidad unificada con Google Calendar

---

## 📋 ÍNDICE

1. [Tablas Principales](#tablas-principales)
2. [Funciones Existentes](#funciones-existentes)
3. [Flujos Actuales](#flujos-actuales)
4. [Gaps Identificados](#gaps-identificados)
5. [Recomendaciones](#recomendaciones)
6. [Plan de Implementación](#plan-de-implementación)

---

## 📊 TABLAS PRINCIPALES

### 1. `appointments` (Reservas/Citas)

**Propósito:** Almacena todas las reservas/citas del negocio

**Columnas Identificadas:**
- `id` (UUID, PK)
- `business_id` (UUID, FK a businesses)
- `resource_id` (UUID, FK a resources) - Recurso asignado
- `employee_id` (UUID, FK a employees) - Empleado asignado
- `customer_id` (UUID, FK a customers) - Cliente (puede ser null)
- `service_id` (UUID, FK a services) - Servicio (puede ser null)
- `appointment_date` / `reservation_date` (DATE)
- `appointment_time` / `reservation_time` (TIME)
- `start_time` (TIMESTAMPTZ) - Hora de inicio completa
- `end_time` (TIMESTAMPTZ) - Hora de fin completa
- `duration_minutes` (INTEGER)
- `status` (TEXT) - 'pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'blocked'
- `source` (TEXT) - 'manual', 'whatsapp', 'call', 'agent_*', 'google_calendar'
- `synced_to_gcal` (BOOLEAN) - Si ya está sincronizado con Google Calendar
- `gcal_event_id` (TEXT) - ID del evento en Google Calendar (para evitar duplicados)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Estado Actual:**
- ✅ Tabla existe
- ✅ Tiene campos para Google Calendar (`source`, `synced_to_gcal`, `gcal_event_id`)
- ⚠️ **FALTA:** Campo `status: 'blocked'` para eventos bloqueados de Google Calendar
- ⚠️ **FALTA:** Verificación de disponibilidad antes de crear

**Índices:**
- Necesita índices en: `business_id`, `resource_id`, `start_time`, `end_time`, `status`, `source`

---

### 2. `resources` (Recursos/Mesas/Camillas)

**Propósito:** Recursos físicos del negocio (mesas, camillas, sillas, etc.)

**Columnas Identificadas:**
- `id` (UUID, PK)
- `business_id` (UUID, FK a businesses)
- `name` (TEXT) - Nombre del recurso
- `resource_type` (TEXT) - Tipo de recurso
- `capacity` (INTEGER) - Capacidad
- `is_active` (BOOLEAN)
- `assigned_employee_id` (UUID, FK a employees) - Empleado asignado
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Estado Actual:**
- ✅ Tabla existe
- ✅ Relación con employees
- ⚠️ **FALTA:** Campo para vincular con calendario de Google Calendar

**Necesita:**
- Campo `linked_calendar_id` (TEXT) - ID del calendario de Google Calendar vinculado

---

### 3. `calendar_exceptions` (Excepciones de Calendario)

**Propósito:** Días cerrados o con horarios especiales

**Columnas Identificadas:**
- `id` (UUID, PK)
- `business_id` (UUID, FK a businesses)
- `exception_date` (DATE) - Fecha de la excepción
- `is_open` (BOOLEAN) - false = cerrado, true = abierto con horarios especiales
- `open_time` (TIME) - Hora de apertura (si is_open = true)
- `close_time` (TIME) - Hora de cierre (si is_open = true)
- `reason` (TEXT) - Razón (ej: "Vacaciones", "Navidad")
- `created_by` (UUID, FK a users)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Estado Actual:**
- ✅ Tabla existe
- ✅ Se usa para días cerrados (todo el día)
- ✅ Se verifica antes de generar availability_slots
- ⚠️ **FALTA:** Soporte para rangos de horas bloqueadas (no solo todo el día)

**Constraint:**
- `UNIQUE(business_id, exception_date)` - Una excepción por fecha

---

### 4. `integrations` (Integraciones Externas)

**Propósito:** Almacena tokens OAuth y configuración de integraciones

**Columnas Identificadas:**
- `id` (UUID, PK)
- `business_id` (UUID, FK a businesses)
- `provider` (TEXT) - 'google_calendar', 'outlook_calendar', etc.
- `is_active` (BOOLEAN)
- `access_token` (TEXT) - Token de acceso OAuth
- `refresh_token` (TEXT) - Token de refresco OAuth
- `token_expires_at` (TIMESTAMPTZ) - Expiración del token
- `config` (JSONB) - Configuración específica del proveedor
  - `calendar_id` - ID del calendario principal
  - `calendar_name` - Nombre del calendario
  - `selected_calendars` - Array de IDs de calendarios seleccionados
  - `calendar_selection_completed` - Si se completó la selección
  - `initial_import_completed` - Si se completó la importación inicial
  - `sync_direction` - 'bidirectional', 'to_provider', 'from_provider'
- `last_sync_at` (TIMESTAMPTZ) - Última sincronización
- `connected_at` (TIMESTAMPTZ)
- `disconnected_at` (TIMESTAMPTZ)
- `error_log` (JSONB) - Log de errores
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Estado Actual:**
- ✅ Tabla existe
- ✅ Tiene todos los campos necesarios para OAuth
- ✅ Config almacena selección de calendarios
- ⚠️ **FALTA:** Campo para vincular recursos con calendarios específicos

**Necesita:**
- Campo `resource_calendar_mapping` (JSONB) - Mapeo de recursos a calendarios
  ```json
  {
    "resource_id_1": "calendar_id_1",
    "resource_id_2": "calendar_id_2"
  }
  ```

---

### 5. `availability_slots` (Slots de Disponibilidad)

**Propósito:** Slots de tiempo disponibles para reservas

**Columnas Identificadas:**
- `id` (UUID, PK)
- `business_id` (UUID, FK a businesses)
- `resource_id` (UUID, FK a resources)
- `employee_id` (UUID, FK a employees)
- `slot_date` (DATE)
- `start_time` (TIME)
- `end_time` (TIME)
- `status` (TEXT) - 'free', 'reserved', 'blocked', 'occupied'
- `source` (TEXT) - 'system', 'manual'
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Estado Actual:**
- ✅ Tabla existe
- ✅ Se genera automáticamente
- ✅ Se verifica antes de crear reservas
- ⚠️ **FALTA:** Verificación de Google Calendar antes de generar slots

---

## 🔧 FUNCIONES EXISTENTES

### Edge Functions

1. **`google-calendar-oauth`**
   - ✅ Maneja callback OAuth de Google
   - ✅ Intercambia code por tokens
   - ✅ Guarda en `integrations`
   - ✅ Función pública (no requiere JWT)

2. **`sync-google-calendar`**
   - ✅ Sincronización bidireccional
   - ✅ Push: LA-IA → Google Calendar
   - ✅ Pull: Google Calendar → LA-IA
   - ⚠️ **FALTA:** Verificación en tiempo real antes de crear/modificar

3. **`import-google-calendar-initial`**
   - ✅ Importa eventos de todo el día → `calendar_exceptions`
   - ✅ Clasifica eventos (cerrado vs especial)
   - ⚠️ **FALTA:** Importar eventos con hora → `appointments` con `status: 'blocked'`
   - ⚠️ **FALTA:** Manejo correcto de rangos de fechas (ya corregido parcialmente)

4. **`list-google-calendars`**
   - ✅ Lista calendarios disponibles
   - ✅ Permite selección de calendarios

### Funciones de Base de Datos (RPC)

1. **`check_availability`**
   - ✅ Verifica disponibilidad en `availability_slots`
   - ⚠️ **FALTA:** Verificar Google Calendar en tiempo real

2. **`create_reservation_validated`**
   - ✅ Crea reserva con validación de conflictos
   - ✅ Verifica `availability_slots`
   - ⚠️ **FALTA:** Verificar Google Calendar antes de crear

3. **`generate_availability_slots_employee_based`**
   - ✅ Genera slots de disponibilidad
   - ✅ Verifica `calendar_exceptions` (días cerrados)
   - ⚠️ **FALTA:** Verificar bloqueos de Google Calendar

### Servicios Frontend

1. **`AvailabilityService.checkAvailability()`**
   - ✅ Consulta RPC `check_availability`
   - ⚠️ **FALTA:** Llamar a función unificada que incluya Google Calendar

2. **`ConflictDetectionService.validateReservationAvailability()`**
   - ✅ Verifica conflictos en `availability_slots`
   - ⚠️ **FALTA:** Verificar Google Calendar

3. **`ReservationValidationService.validateTable()`**
   - ✅ Valida mesa y capacidad
   - ✅ Verifica conflictos en `appointments`
   - ⚠️ **FALTA:** Verificar Google Calendar

---

## 🔄 FLUJOS ACTUALES

### Flujo 1: Crear Reserva desde Frontend

```
1. Usuario selecciona fecha/hora/recurso
   ↓
2. Frontend llama a AvailabilityService.checkAvailability()
   ↓
3. Se consulta RPC check_availability
   ↓
4. Se verifica availability_slots (local)
   ↓
5. Si disponible → Se muestra formulario
   ↓
6. Usuario completa formulario
   ↓
7. Frontend llama a create_reservation_validated
   ↓
8. RPC valida conflictos en availability_slots
   ↓
9. Si válido → Crea appointment
   ↓
10. Si hay integración Google Calendar → Sincroniza (push)
```

**Problemas Identificados:**
- ❌ No verifica Google Calendar antes de crear
- ❌ Puede crear conflicto si Google Calendar tiene bloqueo

---

### Flujo 2: Importar Eventos de Google Calendar

```
1. Usuario conecta Google Calendar
   ↓
2. Selecciona calendarios
   ↓
3. Importa eventos iniciales
   ↓
4. Eventos de todo el día → calendar_exceptions
   ↓
5. Eventos con hora → ❌ NO SE IMPORTAN (GAP)
```

**Problemas Identificados:**
- ❌ Eventos con hora no se importan como `appointments` bloqueados
- ❌ No hay sincronización continua

---

### Flujo 3: Agente VAPI (CheckAvailability)

```
1. Cliente llama
   ↓
2. Agente usa herramienta CheckAvailability
   ↓
3. ❌ NO EXISTE función unificada
   ↓
4. Solo verifica availability_slots (local)
   ↓
5. ❌ No verifica Google Calendar
```

**Problemas Identificados:**
- ❌ No verifica Google Calendar
- ❌ Puede confirmar cita que está bloqueada en Google Calendar

---

## ⚠️ GAPS IDENTIFICADOS

### Críticos (Bloquean funcionalidad)

1. **❌ No hay verificación de Google Calendar en tiempo real**
   - Al crear reserva desde frontend
   - Al crear reserva desde agente VAPI
   - Al modificar reserva existente

2. **❌ Eventos con hora de Google Calendar no se importan**
   - Solo se importan eventos de todo el día
   - Eventos con hora deberían crear `appointments` con `status: 'blocked'`

3. **❌ No hay sincronización continua**
   - Solo importación inicial
   - Cambios en Google Calendar no se reflejan automáticamente

4. **❌ No hay vinculación recursos ↔ calendarios**
   - No se puede asignar un calendario a un recurso específico
   - Todos los calendarios se tratan igual

### Importantes (Mejoran UX)

5. **⚠️ No hay función unificada de disponibilidad**
   - Cada servicio verifica por separado
   - No hay punto único de verdad

6. **⚠️ No hay prevención de duplicados robusta**
   - `gcal_event_id` existe pero no se usa consistentemente

7. **⚠️ No hay manejo de conflictos**
   - Si hay conflicto, no se muestra advertencia clara

---

## ✅ RECOMENDACIONES

### Prioridad 1: Funcionalidad Crítica

1. **Crear función `check-availability-unified`**
   - Consulta `availability_slots` (local)
   - Consulta Google Calendar (tiempo real)
   - Combina resultados
   - Retorna disponibilidad unificada

2. **Modificar `import-google-calendar-initial`**
   - Importar eventos con hora → `appointments` con `status: 'blocked'`
   - Manejar correctamente rangos de fechas (ya corregido)

3. **Crear función `sync-google-calendar-continuous`**
   - Sincronización periódica (cada 15 minutos)
   - Detecta cambios desde última sincronización
   - Actualiza `appointments` bloqueados

4. **Integrar verificación en flujos existentes**
   - Frontend: Antes de crear/modificar reserva
   - Agente VAPI: En herramienta CheckAvailability
   - RPC: En `create_reservation_validated`

### Prioridad 2: Mejoras de UX

5. **Agregar campo `resource_calendar_mapping` en `integrations.config`**
   - Permitir vincular recursos con calendarios específicos

6. **Mejorar manejo de conflictos**
   - Mostrar advertencia clara si hay conflicto
   - Permitir continuar si usuario lo decide

7. **Agregar campo `gcal_event_id` en validaciones**
   - Prevenir duplicados consistentemente

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Base (Semana 1)

1. ✅ **Modificar `import-google-calendar-initial`**
   - Importar eventos con hora → `appointments` bloqueados
   - Manejar rangos de fechas correctamente

2. ✅ **Crear función `check-availability-unified`**
   - Consulta local + Google Calendar
   - Retorna disponibilidad combinada

3. ✅ **Integrar en frontend**
   - Llamar antes de crear/modificar reserva
   - Mostrar advertencia si hay conflicto

### Fase 2: Sincronización (Semana 2)

4. ✅ **Crear función `sync-google-calendar-continuous`**
   - Sincronización periódica
   - Actualizar bloqueos

5. ✅ **Configurar cron job**
   - Ejecutar cada 15 minutos

### Fase 3: Agente VAPI (Semana 2)

6. ✅ **Integrar en agente VAPI**
   - Modificar herramienta CheckAvailability
   - Usar función unificada

### Fase 4: Vinculación Recursos (Semana 3)

7. ✅ **Agregar `resource_calendar_mapping`**
   - UI para vincular recursos con calendarios
   - Usar mapeo en verificaciones

---

## 📝 NOTAS TÉCNICAS

### Estructura de `appointments` para Google Calendar

```typescript
{
  business_id: uuid,
  resource_id: uuid | null,  // null si no está vinculado
  employee_id: uuid | null,
  customer_id: null,  // Siempre null para bloqueos de Google Calendar
  service_id: null,   // Siempre null para bloqueos de Google Calendar
  start_time: timestamptz,
  end_time: timestamptz,
  status: 'blocked',  // Nuevo estado para bloqueos
  source: 'google_calendar',
  synced_to_gcal: false,  // No se sincroniza de vuelta (es bloqueo)
  gcal_event_id: text,    // ID del evento en Google Calendar
  notes: text,             // Summary del evento de Google Calendar
  created_at: timestamptz,
  updated_at: timestamptz
}
```

### Función Unificada de Disponibilidad

```typescript
// Input
{
  business_id: uuid,
  resource_id: uuid | null,
  start_time: timestamptz,
  end_time: timestamptz
}

// Output
{
  available: boolean,
  conflicts: [
    {
      type: 'local' | 'google_calendar',
      start_time: timestamptz,
      end_time: timestamptz,
      reason: string
    }
  ],
  source: 'unified'
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Modificar `import-google-calendar-initial` para importar eventos con hora
- [ ] Crear función `check-availability-unified`
- [ ] Integrar verificación en frontend (crear/modificar reserva)
- [ ] Integrar verificación en agente VAPI
- [ ] Crear función `sync-google-calendar-continuous`
- [ ] Configurar cron job para sincronización periódica
- [ ] Agregar `resource_calendar_mapping` en `integrations.config`
- [ ] UI para vincular recursos con calendarios
- [ ] Mejorar manejo de conflictos (advertencias)
- [ ] Testing completo de todos los flujos
- [ ] Documentación de uso

---

**Fin de Auditoría**

