# 🚀 INSTRUCCIONES DE DEPLOYMENT: SISTEMA EMPLOYEE-BASED
## Cómo activar el nuevo sistema de disponibilidades

**Fecha:** 12 Noviembre 2025  
**Tiempo estimado:** 15-20 minutos  
**Nivel de riesgo:** BAJO (tiene fallbacks y validaciones)

---

## ⚠️ **ANTES DE EMPEZAR**

### **Checklist previo:**
- [ ] Tienes acceso al **Supabase Dashboard**
- [ ] Tienes backup reciente de la base de datos
- [ ] NO hay usuarios activos creando reservas (ideal hacerlo en horario bajo)
- [ ] Has leído este documento completo

---

## 📝 **PASO 1: Ejecutar Migraciones SQL** (5 minutos)

### **1.1 Abrir Supabase SQL Editor**

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Click en **"SQL Editor"** en el menú lateral

---

### **1.2 Ejecutar Migración 1: Añadir Columnas**

**Copiar y ejecutar:**
```sql
-- Contenido completo de:
-- supabase/migrations/20251112_01_employee_based_availability.sql
```

**Resultado esperado:**
```
✅ Columna resource_id añadida a employee_schedules
✅ Columna resource_assignment_type añadida
✅ Migración 20251112_01_employee_based_availability completada
```

---

### **1.3 Ejecutar Migración 2: Función de Generación**

**Copiar y ejecutar:**
```sql
-- Contenido completo de:
-- supabase/migrations/20251112_02_generate_slots_employee_based.sql
```

**Resultado esperado:**
```
✅ Función generate_availability_slots_employee_based creada
✅ Función find_available_resource creada
✅ Migración 20251112_02_generate_slots_employee_based completada
```

---

### **1.4 Ejecutar Migración 3: Validación de Ausencias**

**Copiar y ejecutar:**
```sql
-- Contenido completo de:
-- supabase/migrations/20251112_03_validate_employee_absences.sql
```

**Resultado esperado:**
```
✅ Función check_absence_conflicts creada
✅ Trigger before_insert_employee_absence_validate creado
✅ Migración 20251112_03_validate_employee_absences completada
```

---

## 🧪 **PASO 2: Verificación de Migraciones** (2 minutos)

### **2.1 Verificar columnas añadidas**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employee_schedules'
AND column_name IN ('resource_id', 'resource_assignment_type');
```

**Resultado esperado:**
```
resource_id                | uuid         | YES
resource_assignment_type   | varchar(10)  | YES
```

---

### **2.2 Verificar funciones creadas**

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%employee%'
ORDER BY routine_name;
```

**Debe incluir:**
- `check_absence_conflicts`
- `find_available_resource`
- `generate_availability_slots_employee_based`
- `generate_employee_slots`
- `get_effective_resource_id`
- `validate_employee_absence_before_insert`

---

## 🎯 **PASO 3: Probar Generación de Slots** (5 minutos)

### **3.1 Generar slots de prueba**

```sql
-- Reemplazar con tu business_id real
SELECT * FROM generate_employee_slots(
    '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'::UUID,
    CURRENT_DATE,
    30 -- 30 días
);
```

**Resultado esperado:**
```
total_slots_generated | days_processed | employees_processed | message
2160                  | 22             | 3                   | Generados 2160 slots para 3 empleados en 22 días laborables
```

---

### **3.2 Verificar slots creados**

```sql
SELECT 
    slot_date,
    COUNT(*) as total_slots,
    COUNT(DISTINCT resource_id) as recursos_usados
FROM availability_slots
WHERE business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
GROUP BY slot_date
ORDER BY slot_date
LIMIT 10;
```

**Verificar:**
- ✅ Hay slots generados
- ✅ Se usan múltiples recursos
- ✅ Cantidad razonable por día

---

## 🖥️ **PASO 4: Probar en la Aplicación** (8 minutos)

### **4.1 Configurar horario con sillón automático**

1. Ve a **Equipo** en la app
2. Click en un empleado → **"Editar Horario"**
3. Configura Lunes: 9-14
4. En "Sillón/Recurso": Selecciona **"✨ Automático (Recomendado)"**
5. Click **"Guardar Horario"**
6. Verificar: ✅ Sin errores

---

### **4.2 Configurar horario con sillón manual**

1. Configura Miércoles: 9-14
2. En "Sillón/Recurso": Selecciona **"Sillón 3"** (manual)
3. Guardar
4. Verificar: ✅ Sin errores

---

### **4.3 Probar rotación de sillones**

1. Mismo empleado: Lunes Sillón 1, Miércoles Sillón 3
2. Guardar
3. Verificar en Calendario: Slots generados correctamente en ambos sillones

---

### **4.4 Probar validación de solapamiento**

1. Empleado A: Lunes 9-14 → Sillón 1
2. Empleado B: Lunes 12-18 → Sillón 1
3. Intentar guardar Empleado B
4. Verificar: ❌ **ERROR** "Conflicto de horarios"

---

### **4.5 Probar ausencia CON reservas**

1. Crear una reserva para un empleado (ej: 19/Nov 10:00)
2. Ir a **Equipo → Empleado → Gestionar Ausencias**
3. Intentar poner vacaciones 17-30 Nov
4. Verificar: ❌ **ERROR** "Tienes 1 reserva confirmada en 19/Nov..."

---

### **4.6 Probar ausencia SIN reservas**

1. Poner vacaciones en un rango futuro sin reservas (ej: 1-15 Agosto)
2. Guardar
3. Verificar: ✅ Ausencia creada
4. Ir a Calendario → Verificar: Empleado NO aparece disponible esos días

---

## 🔍 **PASO 5: Verificación Final** (2 minutos)

### **5.1 Query de salud del sistema**

```sql
-- Ver estado general de disponibilidades
SELECT 
    e.name as empleado,
    COUNT(DISTINCT es.day_of_week) as dias_trabajando,
    COUNT(DISTINCT es.resource_id) FILTER (WHERE es.resource_id IS NOT NULL) as sillones_manuales,
    COUNT(DISTINCT ea.id) as ausencias_activas
FROM employees e
LEFT JOIN employee_schedules es ON e.id = es.employee_id AND es.is_working = true
LEFT JOIN employee_absences ea ON e.id = ea.employee_id 
    AND ea.end_date >= CURRENT_DATE 
    AND ea.approved = true
WHERE e.business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
AND e.is_active = true
GROUP BY e.id, e.name;
```

**Interpretación:**
- `dias_trabajando`: Cuántos días a la semana trabaja
- `sillones_manuales`: Cuántos sillones tiene asignados manualmente
- `ausencias_activas`: Cuántas ausencias futuras tiene

---

### **5.2 Verificar auto-regeneración**

1. Crear una ausencia para mañana
2. Ir a SQL Editor y verificar:

```sql
SELECT COUNT(*) 
FROM availability_slots
WHERE business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
AND slot_date = (CURRENT_DATE + 1)
AND resource_id IN (
    SELECT resource_id FROM employee_schedules WHERE employee_id = 'ID_DEL_EMPLEADO_CON_AUSENCIA'
);
```

3. **Antes de crear ausencia:** X slots
4. **Después de crear ausencia:** 0 slots (o menos)
5. Verificar: ✅ Se eliminaron los slots del empleado ausente

---

## ⚠️ **ROLLBACK (Si algo sale mal)**

### **Deshacer cambios:**

```sql
-- 1. Eliminar triggers
DROP TRIGGER IF EXISTS before_insert_employee_absence_validate ON employee_absences;
DROP TRIGGER IF EXISTS after_employee_absence_change_regenerate_slots ON employee_absences;

-- 2. Eliminar funciones nuevas
DROP FUNCTION IF EXISTS generate_employee_slots;
DROP FUNCTION IF EXISTS generate_availability_slots_employee_based;
DROP FUNCTION IF EXISTS check_absence_conflicts;
DROP FUNCTION IF EXISTS find_available_resource;
DROP FUNCTION IF EXISTS get_effective_resource_id;

-- 3. Eliminar columnas (CUIDADO - solo si no hay datos)
ALTER TABLE employee_schedules DROP COLUMN IF EXISTS resource_id;
ALTER TABLE employee_schedules DROP COLUMN IF EXISTS resource_assignment_type;
```

**⚠️ IMPORTANTE:** Solo ejecutar rollback si es absolutamente necesario y NO hay datos en producción.

---

## 📊 **MÉTRICAS DE ÉXITO**

Después del deployment, verificar:

- [ ] Slots se generan correctamente ✅
- [ ] Ausencias bloquean creación si hay reservas ✅
- [ ] Auto-regeneración funciona al crear/eliminar ausencias ✅
- [ ] Selector de sillones aparece en UI ✅
- [ ] Asignación automática funciona ✅
- [ ] Asignación manual funciona ✅
- [ ] Validación de solapamientos funciona ✅

---

## 🎉 **¡DEPLOYMENT COMPLETADO!**

Una vez completados todos los pasos, el sistema estará **100% operativo** con:

✅ Disponibilidades basadas en empleados  
✅ Respeto total de ausencias  
✅ Validación sagrada de reservas  
✅ Asignación flexible de recursos  
✅ Auto-regeneración automática  

**¡Listo para producción!** 🍷✨

---

**Última actualización:** 12 Noviembre 2025  
**Autor:** La-IA Team  
**Soporte:** docs/IMPLEMENTACION-EMPLOYEE-BASED-AVAILABILITY-2025-11-12.md

