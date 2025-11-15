# Plan de Pruebas - Sistema de Disponibilidad

## Objetivo
Verificar que la lógica de generación y eliminación de slots funciona correctamente cuando se cambian los días de antelación.

## Estado Inicial
- **Fecha actual**: 2025-11-14
- **Slots en Supabase**: 0 (tabla limpia)
- **Reservas**: Ninguna (para pruebas limpias)

---

## CASO 1: Generación Inicial (10 días)
**Acción**: Configurar 10 días de antelación y generar disponibilidad

**Resultado esperado**:
- ✅ Slots generados desde 2025-11-14 hasta 2025-11-24 (10 días)
- ✅ Total de días con slots: 10 días
- ✅ No se eliminan slots (es la primera generación)

**Verificar en Supabase**:
```sql
SELECT 
    COUNT(DISTINCT slot_date) as dias_unicos,
    MIN(slot_date) as primera_fecha,
    MAX(slot_date) as ultima_fecha,
    COUNT(*) as total_slots
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID';
```

**Logs a revisar**:
- `🗑️ PASO 1: Verificando slots fuera del rango`
- `✅ Días aumentaron o se mantuvieron - No se eliminan slots existentes`
- `✅ TOTAL: X slots generados`

---

## CASO 2: Aumento de Días (10 → 20 días)
**Acción**: Cambiar de 10 a 20 días y regenerar

**Resultado esperado**:
- ✅ NO se eliminan slots existentes
- ✅ Se generan slots adicionales desde 2025-11-25 hasta 2025-12-04
- ✅ Total de días con slots: 20 días (14/11 al 04/12)
- ✅ Los slots del 14/11 al 24/11 se mantienen intactos

**Verificar en Supabase**:
```sql
SELECT 
    COUNT(DISTINCT slot_date) as dias_unicos,
    MIN(slot_date) as primera_fecha,
    MAX(slot_date) as ultima_fecha,
    COUNT(*) as total_slots
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID';
```

**Logs a revisar**:
- `🗑️ Días anteriores: 10`
- `🗑️ Días nuevos: 20`
- `🗑️ ¿Días disminuyeron?: false`
- `✅ Días aumentaron o se mantuvieron - No se eliminan slots existentes`
- `✅ TOTAL: 0 slots eliminados` (o mensaje de que no se eliminan)

---

## CASO 3: Reducción de Días (20 → 15 días)
**Acción**: Cambiar de 20 a 15 días y regenerar

**Resultado esperado**:
- ✅ Se eliminan slots sin reservas después del día 15 (desde 2025-11-30 en adelante)
- ✅ Se mantienen slots del 14/11 al 29/11
- ✅ Total de días con slots: 15 días (14/11 al 29/11)
- ✅ Los slots con reservas NO se eliminan

**Verificar en Supabase**:
```sql
SELECT 
    COUNT(DISTINCT slot_date) as dias_unicos,
    MIN(slot_date) as primera_fecha,
    MAX(slot_date) as ultima_fecha,
    COUNT(*) as total_slots
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID';
```

**Logs a revisar**:
- `🗑️ Días anteriores: 20`
- `🗑️ Días nuevos: 15`
- `🗑️ ¿Días disminuyeron?: true`
- `🗑️ Encontrados X slots fuera del rango`
- `✅ TOTAL: X slots eliminados fuera del rango (sin reservas)`

---

## CASO 4: Reducción con Reservas Protegidas (15 → 10 días)
**Acción**: 
1. Crear una reserva para el día 2025-11-25 (fuera del nuevo rango de 10 días)
2. Cambiar de 15 a 10 días y regenerar

**Resultado esperado**:
- ✅ Se eliminan slots sin reservas después del día 10 (desde 2025-11-25 en adelante)
- ✅ NO se eliminan slots del 2025-11-25 que tienen reserva
- ✅ Se mantienen slots del 14/11 al 24/11
- ✅ Total de días con slots: 11 días (14/11 al 24/11 + 25/11 protegido)

**Verificar en Supabase**:
```sql
-- Verificar que el día con reserva sigue existiendo
SELECT 
    slot_date,
    COUNT(*) as slots,
    COUNT(appointment_id) as slots_con_reserva
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID'
    AND slot_date = '2025-11-25'
GROUP BY slot_date;
```

**Logs a revisar**:
- `🗑️ ¿Días disminuyeron?: true`
- `✅ TOTAL: X slots eliminados fuera del rango (sin reservas)`
- `⚠️ X slots no eliminados porque tienen reservas`

---

## CASO 5: Aumento Final (10 → 30 días)
**Acción**: Cambiar de 10 a 30 días y regenerar

**Resultado esperado**:
- ✅ NO se eliminan slots existentes
- ✅ Se generan slots adicionales hasta 2025-12-14
- ✅ Total de días con slots: 30 días

**Verificar en Supabase**:
```sql
SELECT 
    COUNT(DISTINCT slot_date) as dias_unicos,
    MIN(slot_date) as primera_fecha,
    MAX(slot_date) as ultima_fecha
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID';
```

---

## Checklist de Verificación

Para cada caso, verificar:

- [ ] Los logs muestran el comportamiento correcto (aumento/disminución)
- [ ] El número de días en Supabase coincide con la configuración
- [ ] Las fechas mínima y máxima son correctas
- [ ] No se eliminan slots con reservas
- [ ] Los slots sin reservas se eliminan correctamente cuando se reducen los días
- [ ] No se eliminan slots cuando se aumentan los días

---

## Consultas SQL Útiles

### Ver resumen de slots por día
```sql
SELECT 
    slot_date,
    COUNT(*) as total_slots,
    COUNT(appointment_id) as slots_con_reserva,
    COUNT(*) - COUNT(appointment_id) as slots_libres
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID'
GROUP BY slot_date
ORDER BY slot_date;
```

### Ver slots fuera del rango (ejemplo: después del día 15)
```sql
SELECT 
    slot_date,
    COUNT(*) as slots
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID'
    AND slot_date > CURRENT_DATE + INTERVAL '15 days'
GROUP BY slot_date
ORDER BY slot_date;
```

### Verificar que no hay slots huérfanos
```sql
SELECT 
    COUNT(*) as slots_sin_reserva_fuera_rango
FROM availability_slots
WHERE business_id = 'TU_BUSINESS_ID'
    AND slot_date > CURRENT_DATE + INTERVAL '15 days'
    AND appointment_id IS NULL;
```


