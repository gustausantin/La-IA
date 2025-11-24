# 📊 ANÁLISIS: SISTEMA AUTOMÁTICO DE DISPONIBILIDADES

**Fecha:** 2025-11-17  
**Objetivo:** Analizar el flujo propuesto para hacer el sistema completamente automático

---

## 🎯 REQUISITOS DEL USUARIO

1. ✅ **Eliminar página "Disponibilidades"** - Ya no debe existir regeneración manual
2. ✅ **Todo automático** - Una vez configurado, funciona solo
3. ✅ **Configuración guiada inicial** - Wizard que configure todo la primera vez
4. ✅ **Generación automática después del wizard** - Al completar, se generan disponibilidades
5. ✅ **Sincronización automática** - Cualquier cambio actualiza disponibilidades:
   - Cambios en días de ventana
   - Cambios en horarios de negocio
   - Cambios en horarios de empleados
   - Cambios en ausencias/vacaciones
6. ✅ **Validación inteligente** - Si hay reservas, manejar conflictos inteligentemente

---

## 🔄 FLUJO PROPUESTO

### **FASE 1: CONFIGURACIÓN INICIAL (Wizard)**

```
┌─────────────────────────────────────────────────────────┐
│ PASO 1: Identidad del Negocio                          │
│ - Nombre del negocio                                    │
│ - Tipo de negocio (vertical)                            │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 2: Configuración del Asistente                    │
│ - Nombre del asistente                                  │
│ - Voz del asistente                                     │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 3: Demo Interactiva                                │
│ - Prueba del asistente                                  │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 4: Crear Negocio y Generar Disponibilidades       │
│ ⭐ NUEVO: Al crear el negocio, automáticamente:        │
│   1. Validar que existan requisitos mínimos             │
│   2. Generar disponibilidades iniciales                 │
│   3. Configurar mantenimiento diario                    │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ REDIRECCIÓN AL DASHBOARD                                │
│ - Disponibilidades ya generadas                        │
│ - Sistema listo para usar                               │
└─────────────────────────────────────────────────────────┘
```

### **FASE 2: OPERACIÓN AUTOMÁTICA**

```
┌─────────────────────────────────────────────────────────┐
│ CAMBIO EN CONFIGURACIÓN                                 │
│ - Horarios de negocio                                   │
│ - Días de anticipación                                  │
│ - Política de reservas                                  │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ VALIDACIÓN PREVIA                                        │
│ ✅ Verificar requisitos                                 │
│ ✅ Verificar reservas existentes                        │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ REGENERACIÓN AUTOMÁTICA (Background)                    │
│ ⚡ Sin intervención del usuario                          │
│ ⚡ Toast informativo (no bloqueante)                    │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ CAMBIO EN EMPLEADO/HORARIO/AUSENCIA                     │
│ - Crear/modificar/eliminar empleado                     │
│ - Cambiar horario de empleado                           │
│ - Aprobar/rechazar ausencia                             │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ TRIGGER DE BASE DE DATOS                                │
│ 🔔 Detecta cambio automáticamente                       │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ VALIDACIÓN DE RESERVAS                                  │
│ 🛡️ Verificar si hay reservas afectadas                 │
│    - Si NO hay reservas → Regenerar automáticamente    │
│    - Si HAY reservas → Mostrar advertencia y opciones   │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ REGENERACIÓN AUTOMÁTICA (Background)                    │
│ ⚡ Sin intervención del usuario                          │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ MANTENIMIENTO DIARIO (2:00 AM UTC)                      │
│ - Elimina slots libres del pasado                       │
│ - Genera slots para nuevo día al final                  │
│ - Mantiene ventana móvil constante                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 PUNTOS DE ACTIVACIÓN

### **1. Al Completar Wizard de Onboarding**

**Ubicación:** `src/components/onboarding/steps/Step4GoToApp.jsx`

**Proceso:**
1. Crear negocio (ya existe)
2. **NUEVO:** Validar requisitos mínimos
3. **NUEVO:** Generar disponibilidades iniciales
4. Redirigir al dashboard

**Validación mínima requerida:**
- ✅ Horarios de negocio configurados (pueden ser defaults)
- ✅ Al menos 1 empleado activo (puede ser el dueño)
- ✅ Al menos 1 recurso (puede ser default)
- ✅ Horarios de empleado configurados (pueden ser defaults)

**Si falta algo:**
- ⚠️ Mostrar mensaje claro indicando qué falta
- ⚠️ Redirigir a configuración con pasos pendientes resaltados

### **2. Al Guardar Configuración de Reservas**

**Ubicación:** `src/components/configuracion/RestaurantSettings.jsx`

**Estado actual:** ✅ Ya regenera automáticamente

**Mejora necesaria:**
- ✅ Ya funciona correctamente
- ✅ Solo necesita eliminar referencia a "regenerar manualmente"

### **3. Al Cambiar Empleados/Horarios/Ausencias**

**Ubicación:** Triggers en `supabase/migrations/20251117_01_improve_slot_generation_system.sql`

**Estado actual:** ⚠️ Solo notifican (no regeneran automáticamente)

**Mejora necesaria:**
- ❌ Actualmente: `pg_notify()` solo notifica
- ✅ Necesario: Regenerar automáticamente desde el trigger
- ⚠️ Problema: Los triggers no pueden llamar funciones que requieren autenticación del usuario

**Solución propuesta:**
- Opción A: Usar función de Edge Function de Supabase que escuche las notificaciones
- Opción B: Hacer que el frontend escuche cambios en tiempo real y regenere automáticamente
- Opción C: Hacer que los triggers llamen directamente a la función de generación (más simple)

**Recomendación:** Opción C - Modificar triggers para que regeneren directamente

### **4. Mantenimiento Diario**

**Ubicación:** `supabase/migrations/20251117_02_setup_daily_maintenance_cron.sql`

**Estado actual:** ✅ Ya configurado

**No requiere cambios**

---

## 🛡️ VALIDACIÓN DE RESERVAS

### **Escenario 1: Cambio en Horarios de Negocio**

**Proceso:**
1. Usuario cambia horarios (ej: cierra los lunes)
2. Sistema verifica si hay reservas confirmadas en lunes futuros
3. **Si NO hay reservas:**
   - ✅ Regenera automáticamente
   - ✅ Muestra toast: "Disponibilidad actualizada"
4. **Si HAY reservas:**
   - ⚠️ Muestra modal con lista de reservas afectadas
   - ⚠️ Opciones:
     - Cancelar cambio
     - Continuar (con advertencia de que las reservas pueden causar problemas)

### **Escenario 2: Ausencia de Empleado**

**Proceso:**
1. Usuario aprueba ausencia del 20-25 de noviembre
2. Sistema verifica si hay reservas confirmadas con ese empleado en esas fechas
3. **Si NO hay reservas:**
   - ✅ Regenera automáticamente
   - ✅ Elimina slots del empleado en esas fechas
4. **Si HAY reservas:**
   - ⚠️ Muestra advertencia: "Este empleado tiene X reservas en esas fechas"
   - ⚠️ Opciones:
     - Cancelar ausencia
     - Continuar (las reservas se mantienen, pero no se generan nuevos slots)

### **Escenario 3: Cambio en Horario de Empleado**

**Proceso:**
1. Usuario cambia horario de empleado (ej: de 9:00-18:00 a 10:00-19:00)
2. Sistema verifica si hay reservas en el horario antiguo que ya no existe
3. **Si NO hay conflictos:**
   - ✅ Regenera automáticamente
4. **Si HAY conflictos:**
   - ⚠️ Muestra advertencia con reservas afectadas
   - ⚠️ Opciones similares a escenario 1

---

## 🗑️ ELIMINACIÓN DE PÁGINA "DISPONIBILIDADES"

### **Archivos a Eliminar/Modificar:**

1. **`src/pages/Disponibilidad.jsx`** - Eliminar completamente
2. **`src/components/AvailabilityManager.jsx`** - Mantener lógica, eliminar UI de regeneración manual
3. **`src/App.jsx`** - Eliminar ruta `/disponibilidad`
4. **`src/components/Layout.jsx`** - Eliminar enlace en menú (si existe)

### **Funcionalidad a Mantener:**

- ✅ Lógica de regeneración (usada automáticamente)
- ✅ Validación de requisitos previos
- ✅ Protección de reservas
- ✅ Estadísticas (pueden moverse a otra página)

---

## 🔧 IMPLEMENTACIÓN PROPUESTA

### **PASO 1: Modificar Wizard de Onboarding**

**Archivo:** `src/components/onboarding/steps/Step4GoToApp.jsx`

**Cambios:**
```javascript
// Después de crear el negocio
const businessId = result?.business?.id;

// 1. Validar requisitos mínimos
const validation = await AutoSlotRegenerationService.validatePrerequisites(businessId);

if (!validation.valid) {
  // Mostrar mensaje y redirigir a configuración
  toast.error(validation.errorMessage);
  navigate('/configuracion', { state: { missingRequirements: validation.details } });
  return;
}

// 2. Generar disponibilidades iniciales
const generationResult = await AutoSlotRegenerationService.regenerate(businessId, 'initial_setup', {
  advanceDays: 30, // Default
  silent: false
});

if (generationResult.success) {
  toast.success(`✅ ${generationResult.slotsUpdated} slots generados automáticamente`);
} else {
  toast.warning('⚠️ No se pudieron generar disponibilidades. Configúralas manualmente.');
}
```

### **PASO 2: Hacer Triggers Regeneren Automáticamente**

**Archivo:** `supabase/migrations/20251117_01_improve_slot_generation_system.sql`

**Cambios:**
```sql
-- En lugar de solo notificar, regenerar directamente
CREATE OR REPLACE FUNCTION trigger_regenerate_slots_on_employee_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_should_regenerate BOOLEAN := false;
    v_result RECORD;
BEGIN
    -- Obtener business_id
    IF TG_OP = 'DELETE' THEN
        v_business_id := OLD.business_id;
    ELSE
        v_business_id := NEW.business_id;
    END IF;
    
    -- Determinar si se debe regenerar
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_active = true THEN
            v_should_regenerate := true;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) OR
           (OLD.assigned_resource_id IS DISTINCT FROM NEW.assigned_resource_id) THEN
            v_should_regenerate := true;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_active = true THEN
            v_should_regenerate := true;
        END IF;
    END IF;
    
    -- Regenerar directamente (en background, no bloquea)
    IF v_should_regenerate THEN
        BEGIN
            -- Validar primero
            SELECT * INTO v_result
            FROM validate_slot_generation_prerequisites(v_business_id);
            
            IF v_result.is_valid THEN
                -- Regenerar automáticamente
                PERFORM generate_availability_slots_employee_based(
                    v_business_id,
                    CURRENT_DATE,
                    30, -- Default, se puede obtener de settings
                    TRUE -- Regenerar
                );
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- No fallar si hay error, solo log
                RAISE WARNING 'Error regenerando slots: %', SQLERRM;
        END;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;
```

### **PASO 3: Eliminar Página de Disponibilidades**

**Archivos:**
- Eliminar `src/pages/Disponibilidad.jsx`
- Eliminar ruta en `src/App.jsx`
- Eliminar enlaces en menú (si existen)

### **PASO 4: Mejorar Validación de Reservas**

**Archivo:** Nueva función SQL para validar reservas antes de cambios

```sql
CREATE OR REPLACE FUNCTION validate_reservations_before_change(
    p_business_id UUID,
    p_change_type TEXT, -- 'business_hours', 'employee_absence', 'employee_schedule'
    p_change_data JSONB
)
RETURNS TABLE(
    has_conflicts BOOLEAN,
    affected_reservations JSONB,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
-- Validar si hay reservas que se verían afectadas por el cambio
-- Retornar lista de reservas afectadas
$$;
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Fase 1: Configuración Inicial**
- [ ] Modificar `Step4GoToApp.jsx` para generar disponibilidades automáticamente
- [ ] Agregar validación de requisitos mínimos
- [ ] Mostrar mensajes claros si falta algo
- [ ] Redirigir a configuración si faltan requisitos

### **Fase 2: Sincronización Automática**
- [ ] Modificar triggers para regenerar directamente (no solo notificar)
- [ ] Agregar validación de reservas en triggers
- [ ] Manejar errores en triggers (no deben fallar la transacción)

### **Fase 3: Eliminación de Página Manual**
- [ ] Eliminar `src/pages/Disponibilidad.jsx`
- [ ] Eliminar ruta en `src/App.jsx`
- [ ] Eliminar enlaces en menú
- [ ] Mantener lógica de regeneración para uso automático

### **Fase 4: Validación de Reservas**
- [ ] Crear función `validate_reservations_before_change()`
- [ ] Integrar validación en triggers
- [ ] Crear componente de advertencia para conflictos
- [ ] Integrar en flujo de cambios

---

## 🎯 RESPUESTA A TUS PREGUNTAS

### **"¿Cuándo tendrá impacto y las tablas se generarán a su propio ritmo?"**

**Respuesta:**

1. **Primera vez (Wizard):**
   - Al completar el paso 4 del wizard
   - Se generan automáticamente las disponibilidades iniciales
   - **Impacto inmediato:** Disponibilidades listas al entrar al dashboard

2. **Cambios posteriores:**
   - **Horarios de negocio:** Al guardar configuración → Regenera automáticamente
   - **Días de anticipación:** Al guardar configuración → Regenera automáticamente
   - **Empleados:** Al crear/modificar/eliminar → Regenera automáticamente (trigger)
   - **Horarios de empleados:** Al cambiar → Regenera automáticamente (trigger)
   - **Ausencias:** Al aprobar/rechazar → Regenera automáticamente (trigger)
   - **Mantenimiento diario:** Cada día a las 2:00 AM → Mantiene ventana móvil

3. **A su propio ritmo:**
   - ✅ Todo automático, sin intervención manual
   - ✅ Validación previa antes de regenerar
   - ✅ Protección de reservas existentes
   - ✅ Manejo inteligente de conflictos

---

## 📝 CONCLUSIÓN

El sistema propuesto es **completamente factible** y mejora significativamente la experiencia del usuario:

✅ **Ventajas:**
- Sin intervención manual requerida
- Sincronización automática de cambios
- Validación inteligente de conflictos
- Experiencia más fluida

⚠️ **Consideraciones:**
- Los triggers deben manejar errores sin fallar la transacción
- La validación de reservas debe ser rápida
- Los mensajes de error deben ser claros

**¿Procedo con la implementación?**

