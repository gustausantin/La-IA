# ✅ ERROR SOLUCIONADO

## ❌ Error Original

```
ERROR: 42P17: generation expression is not immutable
```

---

## 🔍 Causa del Error

La columna `end_time` en la tabla `appointments` estaba definida como:

```sql
end_time TIME GENERATED ALWAYS AS (appointment_time + (duration_minutes || ' minutes')::INTERVAL) STORED
```

**Problema:** PostgreSQL no permite usar conversiones de tipo (`||` y `::INTERVAL`) en columnas generadas porque no son "inmutables" (pueden cambiar según la configuración del servidor).

---

## ✅ Solución Aplicada

He cambiado el approach de **columna generada** a **trigger automático**:

### **1. Columna normal (no generada):**

```sql
end_time TIME, -- Se calculará mediante trigger
```

### **2. Función que calcula el end_time:**

```sql
CREATE OR REPLACE FUNCTION calculate_appointment_end_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.end_time := NEW.appointment_time + (NEW.duration_minutes || ' minutes')::INTERVAL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **3. Trigger que se ejecuta automáticamente:**

```sql
CREATE TRIGGER trigger_calculate_appointment_end_time
    BEFORE INSERT OR UPDATE OF appointment_time, duration_minutes
    ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_appointment_end_time();
```

---

## 🎯 Ventajas de Esta Solución

✅ **Automático:** El `end_time` se calcula solo cuando insertas/actualizas  
✅ **Sin errores:** No hay problemas de inmutabilidad  
✅ **Eficiente:** Solo se recalcula cuando cambian `appointment_time` o `duration_minutes`  
✅ **Transparente:** Desde la aplicación se ve como si fuera automático  

---

## 🚀 Ahora Puedes Ejecutar

El archivo `DATABASE-SCHEMA-AUTONOMOS-2025.sql` ya está corregido y listo para ejecutar.

### **Pasos:**

1. Abre: `docs/01-arquitectura/DATABASE-SCHEMA-AUTONOMOS-2025.sql`
2. Copia TODO (Ctrl+A, Ctrl+C)
3. Pega en Supabase SQL Editor
4. Click **RUN** 🚀

**Resultado esperado:**
```
✅ Success. No rows returned
✅ 27 tablas creadas
✅ 10 verticales insertados
✅ 48 servicios insertados
✅ 1 trigger creado
```

---

## 📝 Ejemplo de Uso

Cuando insertes una cita:

```sql
INSERT INTO appointments (
    business_id,
    customer_id,
    service_id,
    appointment_date,
    appointment_time,
    duration_minutes
    -- NO necesitas especificar end_time
) VALUES (
    'uuid-business',
    'uuid-customer',
    'uuid-service',
    '2025-11-01',
    '10:00',
    60
);
```

El trigger calculará automáticamente:
```sql
end_time = '11:00'  -- 10:00 + 60 minutos
```

---

**¡Error corregido!** ✅ Ahora ejecuta el script sin problemas.

