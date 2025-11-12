# 🔍 ANÁLISIS EXHAUSTIVO: SISTEMA DE DISPONIBILIDADES
## La Joya de la Corona de LA-IA

**Fecha:** 12 Noviembre 2025  
**Auditor:** Claude (IA Assistant)  
**Solicitado por:** Gustau  
**Estado:** 📊 ANÁLISIS COMPLETO ANTES DE IMPLEMENTAR

---

## 🎯 OBJETIVO DE ESTE ANÁLISIS

Identificar **TODOS los factores** que afectan las disponibilidades y proponer una estrategia robusta para mantenerlas **siempre actualizadas y 100% precisas**.

---

## 📊 FACTORES QUE AFECTAN LAS DISPONIBILIDADES

### **1. HORARIOS DEL NEGOCIO** 📅

**Dónde se guarda:** `businesses.settings.operating_hours`

**Qué es:** Horario base semanal (Lunes-Domingo)

**Ejemplo:**
```json
{
  "monday": { "open": "09:00", "close": "18:00", "closed": false },
  "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
  "wednesday": { "open": "09:00", "close": "18:00", "closed": false },
  "thursday": { "open": "09:00", "close": "18:00", "closed": false },
  "friday": { "open": "09:00", "close": "18:00", "closed": false },
  "saturday": { "open": "10:00", "close": "14:00", "closed": false },
  "sunday": { "closed": true }
}
```

**Impacto:**
- ✅ Define el horario "por defecto" para cada día de la semana
- ✅ Si cambias Lunes de 9-18 a 10-16, **AFECTA TODOS LOS LUNES** hacia adelante
- ✅ **TRIGGER:** Cambio de horario → Regenerar disponibilidades

---

### **2. CALENDARIO DE EVENTOS ESPECIALES** 📆

**Dónde se guarda:** `businesses.settings.calendar_schedule`

**Qué es:** Días específicos que **SOBRESCRIBEN** el horario base

**Ejemplo:**
```json
[
  {
    "exception_date": "2025-12-25",
    "is_open": false,
    "reason": "Navidad"
  },
  {
    "exception_date": "2025-12-24",
    "is_open": true,
    "open_time": "09:00",
    "close_time": "14:00",
    "reason": "Nochebuena - Horario especial"
  }
]
```

**Impacto:**
- ✅ **PRIORIDAD MÁXIMA:** Calendario SIEMPRE gana sobre horario base
- ✅ Si marcas 25/Dic como cerrado, **NO se generan slots** aunque el horario diga "abierto"
- ✅ Si marcas 24/Dic con horario 9-14, **SOLO genera slots de 9 a 14**
- ✅ **TRIGGER:** Añadir/eliminar evento → Regenerar días afectados

---

### **3. RECURSOS (Sillones/Mesas/Camillas)** 🪑

**Dónde se guarda:** Tabla `resources`

**Qué son:** Los "activos" que se pueden reservar

**Ejemplo:**
```
| id   | name      | is_active | capacity |
|------|-----------|-----------|----------|
| r1   | Sillón 1  | true      | 1        |
| r2   | Sillón 2  | true      | 1        |
| r3   | Sillón 3  | false     | 1        | ← INACTIVO
```

**Impacto:**
- ✅ **Cada recurso activo** genera su propia línea de slots
- ✅ Si tienes 3 sillones activos, cada día genera 3 líneas de slots
- ✅ Si **desactivas un sillón**, dejas de generar slots para él
- ✅ **TRIGGER:** Activar/desactivar recurso → Regenerar disponibilidades

---

### **4. AUSENCIAS DE EMPLEADOS** 👥 **← NUEVO (NO IMPLEMENTADO)**

**Dónde se guarda:** Tabla `employee_absences`

**Qué es:** Vacaciones, citas médicas, ausencias personales del equipo

**Datos actuales del usuario (ejemplo real):**
```json
[
  {
    "employee_id": "a71da5ed-4f78-432c-886d-b0f602d144ae",
    "start_date": "2025-11-12",
    "end_date": "2025-11-12",
    "all_day": false,
    "start_time": "12:00:00",
    "end_time": "14:00:00",
    "reason": "personal",
    "reason_label": "Papeles Papa"
  },
  {
    "employee_id": "af1b1b81-39c2-429b-aca1-46a045a4c88c",
    "start_date": "2025-11-17",
    "end_date": "2025-11-30",
    "all_day": true,
    "reason": "vacation",
    "reason_label": "Vacaciones"
  }
]
```

**⚠️ PROBLEMA ACTUAL:**
- ❌ **NO se consideran en la generación de slots**
- ❌ Si Patricia está de vacaciones, SUS SILLONES siguen generando slots
- ❌ El agente podría asignar citas cuando Patricia no está

**Impacto NECESARIO:**
- ✅ Si un empleado tiene ausencia TODO EL DÍA → **NO generar slots** para sus recursos
- ✅ Si un empleado tiene ausencia PARCIAL (12:00-14:00) → **NO generar slots** en ese rango horario
- ✅ **REGLA SAGRADA:** No se puede crear ausencia si hay reservas confirmadas en ese período
- ✅ **TRIGGER:** Crear/eliminar ausencia → Regenerar días afectados

---

### **5. BLOQUEOS MANUALES DE RECURSOS** 🚫

**Dónde se guarda:** Tabla `resource_blockages`

**Qué son:** Bloqueos puntuales de horas específicas de un recurso

**Ejemplo:**
```
| resource_id | blocked_date | start_time | end_time | reason        |
|-------------|--------------|------------|----------|---------------|
| sillon-1    | 2025-11-15   | 14:00      | 16:00    | Mantenimiento |
```

**Impacto:**
- ✅ **Ya está implementado** y funcionando
- ✅ Validación de conflictos con reservas ✅
- ✅ **TRIGGER:** Crear/eliminar bloqueo → Regenerar día afectado

---

### **6. HORARIOS DE EMPLEADOS** 🕐

**Dónde se guarda:** Tabla `employee_schedules`

**Qué es:** Horarios semanales de cada empleado

**Ejemplo:**
```
| employee_id | day_of_week | is_working | shifts                                    |
|-------------|-------------|------------|-------------------------------------------|
| patricia    | 1 (Lunes)   | true       | [{"start":"09:00","end":"18:00"}]        |
| patricia    | 2 (Martes)  | true       | [{"start":"09:00","end":"18:00"}]        |
| patricia    | 3 (Miércoles)| false      | []                                        |
```

**⚠️ PROBLEMA POTENCIAL:**
- ¿Se usa actualmente en generación de slots? → **NO DOCUMENTADO**
- Si Patricia solo trabaja Lunes-Martes, ¿sus sillones generan slots Miércoles? → **NO CLARO**

**Impacto NECESARIO:**
- ✅ Si un empleado **NO trabaja un día**, sus recursos **NO deben generar slots**
- ✅ Si trabaja solo 9-14, sus recursos solo generan slots 9-14
- ✅ **TRIGGER:** Cambiar horario de empleado → Regenerar disponibilidades

---

### **7. SERVICIOS Y DURACIONES** 🕐

**Dónde se guarda:** Tabla `services` o `business_services`

**Qué es:** Servicios ofrecidos y su duración

**Ejemplo:**
```
| name              | duration_minutes |
|-------------------|------------------|
| Corte y Peinado   | 30               |
| Corte Mujer       | 45               |
| Color Completo    | 120              |
```

**Impacto:**
- ✅ Define **cuántos slots ocupa una reserva**
- ✅ Si un servicio dura 45 min con slots de 15 min → Ocupa 3 slots
- ⚠️ Cambiar la duración de un servicio **NO afecta slots**, solo reservas futuras

---

### **8. RESERVAS CONFIRMADAS** ✅ **← LA MÁS SAGRADA**

**Dónde se guarda:** Tabla `appointments`

**Qué es:** Reservas ya hechas por clientes

**Impacto:**
- 🔒 **BLOQUEAN ABSOLUTAMENTE TODO**
- 🔒 No puedes cerrar un día con reservas
- 🔒 No puedes cambiar horario si afecta reservas
- 🔒 No puedes poner vacaciones si afecta reservas
- 🔒 No puedes desactivar un recurso si tiene reservas futuras
- ✅ **REGLA:** Primero cancelar manualmente la reserva, luego hacer el cambio

---

## 🔗 RELACIONES ENTRE FACTORES

### **JERARQUÍA DE PRIORIDAD:**

```
1️⃣ RESERVAS CONFIRMADAS (Sagradas - Intocables)
        ↓
2️⃣ CALENDARIO DE EVENTOS (Sobrescribe horario base)
        ↓
3️⃣ AUSENCIAS DE EMPLEADOS (Afecta recursos específicos)
        ↓
4️⃣ BLOQUEOS MANUALES (Afecta horas específicas)
        ↓
5️⃣ HORARIOS DE EMPLEADOS (Limita cuándo trabajan)
        ↓
6️⃣ HORARIOS DEL NEGOCIO (Horario base por defecto)
        ↓
7️⃣ RECURSOS ACTIVOS (Cuántos "canales" hay disponibles)
```

---

## 🚨 CASO EXTREMO 1: Poner Ausencia con Reservas

**Escenario:**
- Patricia quiere ir al médico el Martes 19/Nov de 12:00 a 14:00
- **PERO** ya tiene una reserva confirmada a las 13:00

**Comportamiento ACTUAL:**
- ❌ El sistema **PERMITE** crear la ausencia
- ❌ La disponibilidad **NO se actualiza** automáticamente
- ❌ El agente **PODRÍA asignar** más reservas a Patricia ese día
- ❌ **CONFLICTO**: Patricia tiene ausencia + reserva al mismo tiempo

**Comportamiento ESPERADO:**
```
Sistema: ❌ No puedes crear esta ausencia.
         Tienes 1 reserva confirmada el 19/Nov a las 13:00.
         
Opciones:
1. Cancela manualmente la reserva primero
2. Elige otra fecha/hora para tu ausencia
```

---

## 🚨 CASO EXTREMO 2: Poner Vacaciones con Reservas

**Escenario:**
- Patricia quiere vacaciones del 1 al 15 de Agosto
- **PERO** ya tiene 8 reservas confirmadas en ese período

**Comportamiento ESPERADO:**
```
Sistema: ❌ No puedes cogerte vacaciones en estas fechas.
         Tienes 8 reservas confirmadas del 1 al 15 de Agosto:
         
         - 3/Ago a las 10:00 (Corte Mujer - Cliente: Ana García)
         - 5/Ago a las 11:30 (Color - Cliente: María López)
         - ...
         
Opciones:
1. Cancela manualmente todas las reservas afectadas
2. Elige otras fechas para tus vacaciones
```

---

## 🚨 CASO EXTREMO 3: Cambiar Horario del Negocio

**Escenario:**
- El negocio actualmente abre a las 9:00
- Quieres cambiar a abrir a las 10:00
- **PERO** hay 3 reservas a las 9:00 y 9:30 en los próximos 30 días

**Comportamiento ESPERADO:**
```
Sistema: ⚠️ ADVERTENCIA
         
         Este cambio afecta 3 reservas confirmadas:
         - 14/Nov a las 9:00 (Cliente: Juan Pérez)
         - 18/Nov a las 9:30 (Cliente: Laura Gómez)
         - 25/Nov a las 9:00 (Cliente: Carlos Ruiz)
         
Opciones:
1. Mantener horario actual
2. Contacta a estos clientes y reprograma manualmente
3. Cambiar horario SOLO para fechas futuras sin reservas
```

---

## 🚨 CASO EXTREMO 4: Desactivar un Recurso

**Escenario:**
- Quieres desactivar "Sillón 3" (en mantenimiento)
- **PERO** tiene 5 reservas futuras asignadas

**Comportamiento ESPERADO:**
```
Sistema: ❌ No puedes desactivar este recurso.
         Tiene 5 reservas confirmadas:
         
         - 13/Nov a las 11:00
         - 15/Nov a las 14:30
         - ...
         
Opciones:
1. Reasigna manualmente estas reservas a otros recursos
2. Cancela las reservas (con aviso a clientes)
3. Espera a que se completen todas las reservas
```

---

## ✅ SISTEMA ACTUAL - LO QUE YA FUNCIONA

### **Implementado y funcionando perfectamente:**

1. ✅ **Generación de slots** basada en horarios del negocio
2. ✅ **Calendario sobrescribe horario base** (prioridad correcta)
3. ✅ **Bloqueos manuales de recursos** (con validación)
4. ✅ **Protección de reservas** al regenerar slots (NO se tocan slots con status != 'free')
5. ✅ **Mantenimiento automático diario** (ventana móvil)
6. ✅ **Multi-recurso** (funciona con mesas, sillones, camillas, boxes)

### **Servicios existentes:**

- `AutoSlotRegenerationService.js` ✅
- `BlockageService.js` ✅
- Función SQL `generate_availability_slots_simple()` ✅

---

## ❌ SISTEMA ACTUAL - LO QUE FALTA

### **NO implementado (CRÍTICO para negocio real):**

1. ❌ **Ausencias de empleados** (`employee_absences`) **NO afectan** la generación de slots
2. ❌ **Horarios de empleados** (`employee_schedules`) **NO se consideran**
3. ❌ **Validación de conflictos** al crear ausencias (permite crear ausencia aunque haya reservas)
4. ❌ **Triggers de regeneración** al crear/eliminar ausencias
5. ❌ **Relación employee → resources** para saber qué sillones gestiona cada uno

---

## 🏗️ ARQUITECTURA NECESARIA

### **PIEZA QUE FALTA: Relación Employee ↔ Resources**

**Problema actual:**
```
employees tabla existe ✅
resources tabla existe ✅
¿Cómo sabemos QUÉ sillones gestiona CADA empleado? ❌
```

**Opciones:**

**Opción A:** Añadir `employee_id` a tabla `resources`
```sql
resources:
  - id
  - business_id
  - name
  - employee_id ← NUEVO (FK a employees)
  - is_active
```

**Ventajas:**
- ✅ Simple y directo
- ✅ 1 empleado = N recursos
- ✅ Fácil de consultar

**Desventajas:**
- ❌ Un recurso solo puede tener 1 empleado asignado
- ❌ Si quieres rotación (Lunes-Patricia, Martes-Miguel en el mismo sillón), no funciona

---

**Opción B:** Tabla intermedia `employee_resource_assignments`
```sql
employee_resource_assignments:
  - id
  - employee_id (FK a employees)
  - resource_id (FK a resources)
  - day_of_week (0-6) opcional
  - is_active
  - created_at
```

**Ventajas:**
- ✅ Máxima flexibilidad
- ✅ Rotación de empleados por recurso
- ✅ Horarios específicos por empleado-recurso

**Desventajas:**
- ❌ Más complejo de gestionar
- ❌ Más queries

---

### **MI RECOMENDACIÓN: Opción A (Simple)**

Para un negocio típico (peluquería, fisio):
- ✅ Cada empleado tiene "sus" sillones/camillas asignados fijos
- ✅ Si Patricia gestiona Sillón 1 y 2, siempre son de ella
- ✅ Más fácil de entender para el usuario

---

## 🔄 LÓGICA DE GENERACIÓN MEJORADA

### **NUEVA LÓGICA CON AUSENCIAS:**

```sql
PARA cada día desde start_date hasta end_date:
  
  1. ¿Hay excepción en calendar_schedule?
     SÍ → Usar horario especial (o saltar si cerrado)
     NO → Usar horario base de operating_hours
  
  2. ¿El día está cerrado?
     SÍ → Saltar día completo
     NO → Continuar
  
  3. PARA cada recurso activo:
     
     4. ¿Este recurso tiene un employee_id asignado?
        SÍ → employee_id = recurso.employee_id
        NO → employee_id = NULL (recurso sin asignar)
     
     5. SI employee_id existe:
        
        6. ¿El empleado tiene ausencia este día?
           SÍ (todo el día) → SALTAR este recurso completamente
           SÍ (parcial 12:00-14:00) → Generar slots EXCEPTO 12:00-14:00
           NO → Continuar normal
        
        7. ¿El empleado trabaja este día? (employee_schedules)
           NO → SALTAR este recurso
           SÍ → Continuar
     
     8. PARA cada slot de 30 minutos:
        
        9. ¿Ya existe este slot?
           SÍ → Saltar (no duplicar)
           NO → Crear slot
```

---

## 🎯 ESTRATEGIA DE IMPLEMENTACIÓN

### **FASE 1: Añadir Relación Employee ↔ Resource** ⭐ **PRIMERO**

**Tarea:** Añadir campo `employee_id` a tabla `resources`

```sql
ALTER TABLE resources
ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX idx_resources_employee ON resources(employee_id);
```

**UI necesaria:**
- Al configurar un recurso (Sillón 1), selector de "Empleado asignado"
- Campo opcional (puede estar sin asignar)

---

### **FASE 2: Modificar Función de Generación** ⭐ **SEGUNDO**

**Tarea:** Actualizar `generate_availability_slots_simple()` para considerar:
- Employee absences
- Employee schedules

**Archivo:** Nueva migración SQL

---

### **FASE 3: Validar Ausencias** ⭐ **TERCERO**

**Tarea:** Al crear `employee_absence`, verificar conflictos con `appointments`

**Dónde:** Trigger SQL o validación en frontend

```sql
CREATE OR REPLACE FUNCTION validate_employee_absence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Buscar reservas del empleado en el rango de fechas
  IF EXISTS (
    SELECT 1
    FROM appointments a
    JOIN resources r ON a.resource_id = r.id
    WHERE r.employee_id = NEW.employee_id
      AND a.appointment_date >= NEW.start_date
      AND a.appointment_date <= NEW.end_date
      AND a.status IN ('confirmed', 'pending')
  ) THEN
    RAISE EXCEPTION 'No puedes crear esta ausencia. Tienes reservas confirmadas.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_employee_absence
BEFORE INSERT ON employee_absences
FOR EACH ROW
EXECUTE FUNCTION validate_employee_absence();
```

---

### **FASE 4: Auto-Regeneración** ⭐ **CUARTO**

**Tarea:** Añadir triggers al `AutoSlotRegenerationService`:

```javascript
const TRIGGERS = [
  'resource_blockage_created',
  'resource_blockage_removed',
  'business_hours_changed',
  'resource_created',
  'resource_deactivated',
  'service_duration_changed',
  'calendar_exception_created',
  'calendar_exception_removed',
  // ⭐ NUEVOS
  'employee_absence_created',      // ← Añadir
  'employee_absence_removed',      // ← Añadir
  'employee_schedule_changed',     // ← Añadir
  'resource_employee_assigned',    // ← Añadir
  'resource_employee_unassigned'   // ← Añadir
];
```

---

## 📋 TODOS LOS FACTORES - TABLA RESUMEN

| Factor | Tabla/Campo | Implementado | Trigger Regeneración | Validación Reservas |
|--------|-------------|--------------|----------------------|---------------------|
| **Horarios del negocio** | `businesses.settings.operating_hours` | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| **Calendario eventos** | `businesses.settings.calendar_schedule` | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| **Recursos activos** | `resources.is_active` | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| **Bloqueos manuales** | `resource_blockages` | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| **Ausencias empleados** | `employee_absences` | ❌ NO | ❌ NO | ❌ NO |
| **Horarios empleados** | `employee_schedules` | ❌ NO | ❌ NO | ❌ NO |
| **Employee → Resource** | `resources.employee_id` | ❌ NO | ❌ NO | N/A |

---

## 💡 MI PROPUESTA FINAL

### **LO QUE HAY QUE HACER:**

1. **Añadir `employee_id` a `resources`** (migración SQL)
2. **Modificar UI de Recursos** para asignar empleados
3. **Actualizar función SQL de generación** para considerar absences + schedules
4. **Crear trigger de validación** para employee_absences
5. **Añadir triggers de regeneración** en AutoSlotRegenerationService
6. **Testing exhaustivo** con casos reales

---

## ⏱️ ESTIMACIÓN DE TRABAJO

| Fase | Complejidad | Tiempo Estimado |
|------|-------------|-----------------|
| Fase 1 (Relación Employee-Resource) | Baja | 1 hora |
| Fase 2 (Modificar generación SQL) | Media | 2-3 horas |
| Fase 3 (Validación absences) | Media | 1-2 horas |
| Fase 4 (Auto-regeneración) | Baja | 30 minutos |
| Testing | Alta | 2 horas |
| **TOTAL** | **Media-Alta** | **6-8 horas** |

---

## 🎯 PRÓXIMOS PASOS

**ANTES DE IMPLEMENTAR, necesito tu confirmación:**

1. ✅ ¿Confirmas que cada recurso tiene UN empleado asignado fijo?
2. ✅ ¿O necesitas rotación (mismo sillón, empleados diferentes por día)?
3. ✅ ¿Prioridad: Employee absences o employee schedules primero?
4. ✅ ¿Quieres implementar TODO ahora o por fases?

---

**FIN DEL ANÁLISIS**

**Estado:** ⏸️ ESPERANDO DECISIONES  
**Próximo paso:** Tu aprobación para implementar

