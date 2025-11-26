# 🧪 DATOS DE PRUEBA - Dashboard Socio Virtual

**Fecha:** 24 Noviembre 2025  
**Propósito:** Crear datos reales para probar los 4 escenarios del dashboard  
**Tiempo estimado:** 20-30 minutos

---

## 📋 PREREQUISITOS

Antes de crear los datos, ejecuta la migración SQL:

```bash
# Desde la raíz del proyecto
supabase db push --file supabase/migrations/20251124_03_dashboard_intelligence_functions.sql
```

O desde Supabase Dashboard:
1. Ve a SQL Editor
2. Copia el contenido del archivo de migración
3. Ejecuta

---

## 🎯 ESCENARIO 1: Crisis de Personal

**Objetivo:** Detectar empleado ausente con citas asignadas

### Datos necesarios:

#### 1. **Crear empleado "Pol"**
- Ir a: Equipo → Añadir empleado
- Nombre: `Pol`
- Recurso asignado: `Silla 1` (o el que tengas)
- Estado: `Activo`

#### 2. **Crear ausencia para Pol HOY**
- Ir a: Equipo → Editar Pol → Ausencias
- Tipo: `Baja médica` (sick)
- Fecha inicio: **HOY**
- Fecha fin: **HOY**
- Todo el día: `SÍ`
- Razón: "Gripe"

#### 3. **Crear 2 citas asignadas a Pol para HOY (FUTURAS)**
- Ir a: Reservas → Nueva reserva
- **Cita 1:**
  - Cliente: "Ana García" (crear cliente nuevo)
  - Empleado: `Pol`
  - Fecha: **HOY**
  - Hora: **14:00** (asegúrate que sea FUTURA)
  - Servicio: Cualquier servicio
  - Estado: `Confirmada`
  
- **Cita 2:**
  - Cliente: "Carlos Ruiz" (crear cliente nuevo)
  - Empleado: `Pol`
  - Fecha: **HOY**
  - Hora: **16:00**
  - Servicio: Cualquier servicio
  - Estado: `Confirmada`

#### 4. **Verificar que tienes otro empleado disponible (alternativa)**
- Asegúrate de tener al menos 1 empleado más activo (ej: "Andrew", "Culebra")
- Este empleado NO debe tener ausencia hoy

---

## ⚠️ ESCENARIO 2: Riesgo de No-Show

**Objetivo:** Detectar cliente con alto riesgo de no aparecer

### Datos necesarios:

#### 1. **Crear cliente "problemático"**
- Ir a: Clientes → Añadir cliente
- Nombre: `Miguel López`
- Teléfono: `+34666123456`
- Email: (opcional)

#### 2. **Darle historial de no-shows**

**OPCIÓN A: Desde SQL (Más rápido)**
```sql
-- Actualizar contador de no-shows del cliente
UPDATE customers 
SET no_show_count = 2,
    last_visit_at = NOW() - INTERVAL '120 days'
WHERE phone = '+34666123456';
```

**OPCIÓN B: Desde UI (Manual)**
- Crear 2 citas pasadas para Miguel
- Marcar ambas como `No-Show`

#### 3. **Crear cita para HOY (sin confirmar)**
- Ir a: Reservas → Nueva reserva
- Cliente: `Miguel López`
- Empleado: Cualquier empleado disponible
- Fecha: **HOY**
- Hora: **Hora actual + 1 hora** (ej: si son las 10:00, pon 11:00)
- Estado: `Confirmada`
- **IMPORTANTE:** NO crear confirmación en `customer_confirmations`

#### 4. **Verificar que NO tiene confirmaciones**
```sql
-- Verificar que la cita NO tiene confirmaciones
SELECT * FROM customer_confirmations 
WHERE appointment_id = 'id-de-la-cita-de-miguel';
-- Debe retornar 0 filas
```

---

## 💰 ESCENARIO 3: Hueco Muerto

**Objetivo:** Detectar slots libres en próximas 2 horas

### Datos necesarios:

#### 1. **Asegúrate de tener slots libres HOY**
- Ir a: Disponibilidad → Ver calendario
- Verificar que hay slots con estado `free` en próximas 2 horas

#### 2. **Si NO hay slots libres, crear uno manualmente**

**OPCIÓN A: Desde SQL (Más rápido)**
```sql
-- Crear slot libre en 30 minutos
INSERT INTO availability_slots (
  id,
  business_id,
  slot_date,
  start_time,
  end_time,
  employee_id,
  resource_id,
  status,
  is_available,
  duration_minutes,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'tu-business-id',
  CURRENT_DATE,
  (CURRENT_TIME + INTERVAL '30 minutes')::TIME,
  (CURRENT_TIME + INTERVAL '90 minutes')::TIME,
  (SELECT id FROM employees WHERE business_id = 'tu-business-id' LIMIT 1),
  (SELECT id FROM resources WHERE business_id = 'tu-business-id' LIMIT 1),
  'free',
  true,
  60,
  NOW(),
  NOW()
);
```

**OPCIÓN B: Desde UI**
- Ir a: Disponibilidad
- Regenerar disponibilidad para HOY
- Verificar que se crean slots libres

#### 3. **Verificar que tienes servicios activos**
```sql
-- Ver servicios disponibles
SELECT id, name, duration_minutes, suggested_price 
FROM business_services 
WHERE business_id = 'tu-business-id' AND is_active = true;
```

---

## 👏 ESCENARIO 4: Palmada en la Espalda

**Objetivo:** Mostrar métricas cuando todo va bien

### Datos necesarios:

#### 1. **Crear citas completadas HOY**
- Ir a: Reservas → Crear 2-3 citas para HOY
- Hora: **Pasadas** (ej: 08:00, 09:00, 10:00)
- Estado: `Completada`

#### 2. **Verificar que NO hay:**
- Empleados ausentes con citas
- Citas con alto riesgo de no-show
- Slots libres en próximas 2 horas

**Resultado esperado:** Dashboard mostrará mensaje motivacional y métricas del día.

---

## 🧪 TESTING - Verificar que funciones SQL funcionan

### Test 1: Crisis de Personal
```sql
SELECT * FROM detect_employee_absences_with_appointments(
  'tu-business-id',
  NOW()
);
```

**Resultado esperado:**
- 1 fila con Pol
- `affected_count` = 2
- `affected_appointments` = JSON con las 2 citas
- `alternative_employees` = JSON con empleados disponibles

---

### Test 2: Riesgo de No-Show
```sql
SELECT * FROM get_high_risk_appointments(
  'tu-business-id',
  NOW(),
  60
);
```

**Resultado esperado:**
- 1 fila con la cita de Miguel López
- `risk_score` >= 60
- `risk_level` = 'high'
- `no_show_count` = 2
- `confirmed` = false

---

### Test 3: Hueco Muerto
```sql
SELECT * FROM get_upcoming_free_slots(
  'tu-business-id',
  NOW(),
  2
);
```

**Resultado esperado:**
- 1+ filas con slots libres
- `minutes_until_slot` < 120
- `potential_services` = JSON con servicios que caben

---

## 📊 VERIFICACIÓN FINAL

Una vez creados los datos, prueba el dashboard:

1. **Acceder a:** `http://localhost:5173/dashboard`

2. **Verificar que aparece:**
   - Avatar de Lua grande
   - Bocadillo con mensaje contextual
   - Botones mágicos según el escenario detectado

3. **Probar cada escenario:**
   - **Crisis:** ¿Detecta a Pol? ¿Muestra botones de transferir/cancelar?
   - **No-Show:** ¿Detecta a Miguel? ¿Muestra botones de llamar/WhatsApp?
   - **Hueco:** ¿Detecta slot libre? ¿Muestra botón de generar oferta?
   - **Palmada:** ¿Muestra métricas correctas?

---

## 🔧 TROUBLESHOOTING

### Problema: "No se detecta la crisis de personal"

**Posibles causas:**
1. La ausencia de Pol no está activa HOY
2. Las citas no son futuras (ya pasaron)
3. Las citas están canceladas

**Solución:**
```sql
-- Verificar ausencias activas
SELECT * FROM employee_absences 
WHERE business_id = 'tu-id' 
  AND start_date <= CURRENT_DATE 
  AND end_date >= CURRENT_DATE;

-- Verificar citas futuras de Pol
SELECT * FROM appointments 
WHERE employee_id = 'id-de-pol' 
  AND appointment_date = CURRENT_DATE 
  AND appointment_time >= CURRENT_TIME 
  AND status NOT IN ('cancelled', 'completed');
```

---

### Problema: "No se detecta el riesgo de no-show"

**Posibles causas:**
1. El cliente no tiene historial de no-shows
2. La cita ya pasó
3. La cita tiene confirmación registrada

**Solución:**
```sql
-- Forzar risk score alto
UPDATE customers 
SET no_show_count = 3,
    last_visit_at = NOW() - INTERVAL '180 days'
WHERE phone = '+34666123456';

-- Eliminar confirmaciones si existen
DELETE FROM customer_confirmations 
WHERE appointment_id = 'id-de-la-cita-de-miguel';
```

---

### Problema: "No se detectan huecos libres"

**Posibles causas:**
1. No hay slots con status='free' en próximas 2 horas
2. Todos los slots están ocupados

**Solución:**
```sql
-- Ver slots disponibles
SELECT * FROM availability_slots 
WHERE business_id = 'tu-id' 
  AND slot_date = CURRENT_DATE 
  AND start_time >= CURRENT_TIME 
  AND status = 'free';

-- Si no hay, regenerar disponibilidad desde UI o crear manualmente
```

---

## ✅ CHECKLIST FINAL

Antes de considerar los datos completos:

- [ ] Empleado Pol creado y ausente HOY
- [ ] 2 citas asignadas a Pol (futuras, confirmadas)
- [ ] Al menos 1 empleado alternativo disponible
- [ ] Cliente Miguel López con 2 no-shows históricos
- [ ] 1 cita para Miguel HOY (futura, sin confirmar)
- [ ] Al menos 1 slot libre en próximas 2 horas
- [ ] Al menos 1 servicio activo
- [ ] 2-3 citas completadas HOY (para escenario 4)
- [ ] Las 3 funciones SQL retornan datos correctos

---

## 📞 SOPORTE

Si tienes algún problema creando los datos:
1. Revisa los logs de la consola del navegador
2. Ejecuta las queries SQL de verificación
3. Comparte el error específico para ayudarte

---

**Documento creado:** 24 Noviembre 2025  
**Última actualización:** 24 Noviembre 2025  
**Mantenido por:** CTO Team







