# 📅 CUÁNDO SE GENERAN LAS DISPONIBILIDADES

**Documento explicativo:** Cuándo y cómo se activa la generación de slots de disponibilidad

---

## 🎯 RESUMEN RÁPIDO

Las disponibilidades se generan en **6 momentos diferentes**:

1. ✅ **Al guardar configuración de reservas** (si ya existen slots previos)
2. ✅ **Manual desde "Disponibilidades"** (botón "Regenerar")
3. ✅ **Automáticamente por cambios en empleados** (triggers de base de datos)
4. ✅ **Automáticamente por cambios en horarios de empleados** (triggers de base de datos)
5. ✅ **Automáticamente por cambios en ausencias** (triggers de base de datos)
6. ✅ **Mantenimiento diario automático** (2:00 AM UTC todos los días)

---

## 1️⃣ AL GUARDAR CONFIGURACIÓN DE RESERVAS

### **Cuándo se activa:**
Al hacer clic en "Guardar" en la sección **Configuración > Reservas**

### **Condiciones:**
- ✅ Solo se genera **SI ya existen slots previos** (no en primera configuración)
- ✅ Solo si cambias alguno de estos parámetros:
  - Horarios de apertura del negocio (`opening_hours`)
  - Días de anticipación máxima (`advance_booking_days`)
  - Minutos de antelación mínima (`min_advance_minutes`)
  - Política de cancelación u otros ajustes de reservas

### **Código:**
**Archivo:** `src/components/configuracion/RestaurantSettings.jsx`

```javascript
// Detecta cambios en configuración
if (hoursChanged || policyChanged || advanceDaysChanged || minAdvanceChanged) {
  // Verifica si ya existen slots
  changeDetection.checkExistingSlots().then(async (slotsExist) => {
    if (slotsExist) {
      // ⚡ REGENERACIÓN AUTOMÁTICA
      await AutoSlotRegenerationService.regenerate(businessId, reason, {
        advanceDays: settings.booking_settings?.advance_booking_days || 30
      });
    }
  });
}
```

### **¿Qué pasa si NO hay empleados/horarios configurados?**
- ✅ El sistema **valida primero** antes de generar
- ❌ Si falta algo, muestra un mensaje de error claro:
  - "No hay empleados activos configurados"
  - "No se han configurado horarios de apertura"
  - "Los empleados no tienen horarios configurados"
  - "No hay recursos disponibles"

### **Ejemplo:**
1. Vas a **Configuración > Reservas**
2. Cambias "Días de Anticipación Máxima" de 30 a 15 días
3. Haces clic en **"Guardar"**
4. El sistema detecta el cambio
5. Verifica que ya existen slots previos
6. **Regenera automáticamente** los slots con la nueva configuración
7. Muestra toast: "✅ Disponibilidad actualizada: X slots generados"

---

## 2️⃣ MANUAL DESDE "DISPONIBILIDADES"

### **Cuándo se activa:**
Al hacer clic en el botón **"Regenerar Disponibilidades"** en la página de Disponibilidades

### **Condiciones:**
- ✅ Siempre disponible (no requiere condiciones previas)
- ✅ Puedes regenerar cuando quieras
- ✅ Respeta la configuración actual del negocio

### **Código:**
**Archivo:** `src/components/AvailabilityManager.jsx`

```javascript
const smartRegeneration = async (changeType = 'general', changeData = {}) => {
  // Obtiene configuración actual
  // Protege reservas existentes
  // Regenera slots
  await supabase.rpc('generate_availability_slots_employee_based', {
    p_business_id: businessId,
    p_start_date: today,
    p_days_ahead: daysToGenerate,
    p_regenerate: true
  });
}
```

### **Ejemplo:**
1. Vas a **Disponibilidades**
2. Haces clic en **"Regenerar Disponibilidades"**
3. El sistema regenera todos los slots según la configuración actual
4. Muestra resultado: "✅ X slots generados"

---

## 3️⃣ AUTOMÁTICAMENTE POR CAMBIOS EN EMPLEADOS

### **Cuándo se activa:**
Cuando se crea, modifica o elimina un empleado en la base de datos

### **Condiciones:**
- ✅ Se activa automáticamente (triggers de PostgreSQL)
- ✅ Solo si el cambio afecta la disponibilidad:
  - Crear empleado activo
  - Activar/desactivar empleado
  - Cambiar asignación de recurso

### **Código:**
**Archivo:** `supabase/migrations/20251117_01_improve_slot_generation_system.sql`

```sql
CREATE TRIGGER trigger_employee_change_slots
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_on_employee_change();
```

### **Notificación:**
El trigger usa `pg_notify()` para notificar que se necesita regeneración. Actualmente, esto requiere implementación adicional en el frontend para escuchar en tiempo real.

### **Ejemplo:**
1. Vas a **Equipo**
2. Agregas un nuevo empleado y le asignas horarios
3. Guardas el empleado
4. El trigger detecta el cambio
5. Notifica que se necesita regeneración
6. (Requiere implementación para regenerar automáticamente desde el frontend)

---

## 4️⃣ AUTOMÁTICAMENTE POR CAMBIOS EN HORARIOS DE EMPLEADOS

### **Cuándo se activa:**
Cuando se crea, modifica o elimina un horario de empleado (`employee_schedules`)

### **Condiciones:**
- ✅ Se activa automáticamente (triggers de PostgreSQL)
- ✅ Cualquier cambio en horarios activa la regeneración

### **Código:**
**Archivo:** `supabase/migrations/20251117_01_improve_slot_generation_system.sql`

```sql
CREATE TRIGGER trigger_schedule_change_slots
    AFTER INSERT OR UPDATE OR DELETE ON employee_schedules
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_on_schedule_change();
```

### **Ejemplo:**
1. Vas a **Equipo**
2. Modificas el horario de un empleado (cambias de 9:00-18:00 a 10:00-19:00)
3. Guardas el cambio
4. El trigger detecta el cambio
5. Notifica que se necesita regeneración

---

## 5️⃣ AUTOMÁTICAMENTE POR CAMBIOS EN AUSENCIAS

### **Cuándo se activa:**
Cuando se crea, modifica o elimina una ausencia de empleado (`employee_absences`)

### **Condiciones:**
- ✅ Se activa automáticamente (triggers de PostgreSQL)
- ✅ Cualquier cambio en ausencias activa la regeneración

### **Código:**
**Archivo:** `supabase/migrations/20251117_01_improve_slot_generation_system.sql`

```sql
CREATE TRIGGER trigger_absence_change_slots
    AFTER INSERT OR UPDATE OR DELETE ON employee_absences
    FOR EACH ROW
    EXECUTE FUNCTION trigger_regenerate_slots_on_absence_change();
```

### **Ejemplo:**
1. Un empleado solicita vacaciones del 20 al 25 de noviembre
2. Aprobas la ausencia
3. El trigger detecta el cambio
4. Notifica que se necesita regeneración
5. Los slots del 20-25 se eliminan automáticamente (si no tienen reservas)

---

## 6️⃣ MANTENIMIENTO DIARIO AUTOMÁTICO

### **Cuándo se activa:**
**Todos los días a las 2:00 AM UTC** (configurado con pg_cron)

### **Condiciones:**
- ✅ Se ejecuta automáticamente sin intervención
- ✅ Para todos los negocios activos
- ✅ Mantiene la ventana móvil de disponibilidades

### **Código:**
**Archivo:** `supabase/migrations/20251117_02_setup_daily_maintenance_cron.sql`

```sql
SELECT cron.schedule(
    'daily-availability-maintenance',
    '0 2 * * *', -- 2:00 AM todos los días (hora UTC)
    $$ SELECT daily_availability_maintenance(); $$
);
```

### **Proceso:**
1. **Elimina slots libres del pasado** (solo `status = 'free'`)
2. **Calcula el nuevo día al final del rango**
3. **Genera slots para ese nuevo día** (solo 1 día)
4. **Mantiene la ventana móvil constante**

### **Ejemplo:**
**Configuración:** 10 días de anticipación

- **Día 1 (17 Nov):** Tienes slots del 17 al 26 (10 días)
- **Día 2 (18 Nov) - 2:00 AM:**
  - Elimina slots libres del 17 (pasado)
  - Genera slots del 27 (nuevo día)
  - Ahora tienes slots del 18 al 27 (10 días)
- **Día 3 (19 Nov) - 2:00 AM:**
  - Elimina slots libres del 18 (pasado)
  - Genera slots del 28 (nuevo día)
  - Ahora tienes slots del 19 al 28 (10 días)

---

## ⚠️ VALIDACIÓN PREVIA

**IMPORTANTE:** Antes de generar slots, el sistema **siempre valida** que existan:

1. ✅ Negocio activo
2. ✅ Horarios de apertura configurados (`operating_hours`)
3. ✅ Empleados activos
4. ✅ Empleados con horarios de trabajo configurados
5. ✅ Recursos disponibles (mesas, salones, etc.)

**Si falta algo:**
- ❌ No se generan slots
- ✅ Se muestra un mensaje de error claro indicando qué falta
- ✅ Se sugiere cómo solucionarlo

**Función de validación:**
```sql
validate_slot_generation_prerequisites(p_business_id UUID)
```

---

## 🔄 FLUJO COMPLETO DE GENERACIÓN

```
┌─────────────────────────────────────────────────────────┐
│ 1. USUARIO: Guarda configuración / Cambia empleado      │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. SISTEMA: Detecta cambio                               │
│    - Cambio en configuración?                           │
│    - Cambio en empleado/horario/ausencia?                │
│    - Trigger de base de datos?                           │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. VALIDACIÓN: Verifica requisitos previos              │
│    ✅ Negocio activo?                                    │
│    ✅ Horarios configurados?                             │
│    ✅ Empleados con horarios?                            │
│    ✅ Recursos disponibles?                              │
└─────────────────────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ✅ VÁLIDO            ❌ INVÁLIDO
         │                     │
         │                     └──> Muestra error claro
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. PROTECCIÓN: Verifica reservas existentes             │
│    🛡️ No elimina slots con reservas                     │
│    🛡️ Protege slots reservados/bloqueados               │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 5. GENERACIÓN: Crea slots                               │
│    - Lee horarios de empleados                          │
│    - Considera ausencias                                │
│    - Asigna recursos                                     │
│    - Genera slots de 15 minutos                         │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 6. RESULTADO: Muestra confirmación                      │
│    ✅ "X slots generados"                               │
│    🛡️ "Y reservas protegidas" (si aplica)              │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 TABLA RESUMEN

| Momento | Automático | Requiere Configuración | Validación Previa |
|---------|-----------|------------------------|-------------------|
| **1. Guardar configuración** | ✅ Sí | ✅ Sí (debe haber slots previos) | ✅ Sí |
| **2. Manual desde Disponibilidades** | ❌ No | ❌ No | ✅ Sí |
| **3. Cambio en empleados** | ✅ Sí (trigger) | ❌ No | ⚠️ Pendiente* |
| **4. Cambio en horarios** | ✅ Sí (trigger) | ❌ No | ⚠️ Pendiente* |
| **5. Cambio en ausencias** | ✅ Sí (trigger) | ❌ No | ⚠️ Pendiente* |
| **6. Mantenimiento diario** | ✅ Sí (cron) | ✅ Sí (pg_cron habilitado) | ✅ Sí |

\* *Los triggers notifican pero requieren implementación adicional en frontend para regenerar automáticamente*

---

## 🎯 RECOMENDACIONES

### **Para Primera Configuración:**
1. Configura horarios de negocio
2. Agrega empleados activos
3. Configura horarios de empleados
4. Agrega recursos (mesas, salones)
5. Configura política de reservas
6. **Genera slots manualmente** desde Disponibilidades

### **Para Uso Diario:**
- ✅ El mantenimiento diario se encarga automáticamente
- ✅ Si cambias configuración, se regenera automáticamente
- ✅ Si cambias empleados/horarios, los triggers notifican (requiere implementación adicional)

---

## ⚙️ CONFIGURACIÓN NECESARIA

### **Para que funcione completamente:**
1. ✅ Migraciones ejecutadas:
   - `20251117_01_improve_slot_generation_system.sql`
   - `20251117_02_setup_daily_maintenance_cron.sql`
2. ✅ pg_cron habilitado en Supabase (para mantenimiento diario)
3. ⚠️ Implementación de listener en frontend (para triggers 3, 4, 5)

---

**Última actualización:** 2025-11-17

