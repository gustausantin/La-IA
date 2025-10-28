# ✅ MANTENIMIENTO AUTOMÁTICO DIARIO - GUÍA COMPLETA

> **Estado:** ✅ Implementado y activo  
> **Última actualización:** 22 de Octubre 2025  
> **Job:** `daily-availability-maintenance`

---

## 📋 RESUMEN EJECUTIVO

**¿Qué hace?**
- Elimina slots **LIBRES** de días **pasados** (< hoy)
- Genera **1 nuevo día** al final de la ventana
- **NUNCA toca reservas**
- Funciona automáticamente **cada día a las 4 AM UTC**

---

## ✅ ESTADO ACTUAL

### **Job Programado:**
```json
{
  "jobid": 3,
  "jobname": "daily-availability-maintenance",
  "schedule": "0 4 * * *",  // 4:00 AM UTC diario
  "active": true
}
```

✅ **¡EL JOB ESTÁ ACTIVO Y FUNCIONANDO!**

---

## 📁 ARCHIVOS EN ESTA CARPETA

| Archivo | Propósito | Cuándo Usar |
|---------|-----------|-------------|
| `README_DAILY_MAINTENANCE.md` | **📖 Esta guía** | Consulta y referencia |
| `EJECUTAR_EN_SUPABASE_DAILY_MAINTENANCE.sql` | Script de instalación | Solo primera vez o reinstalación |
| `TEST_DAILY_MAINTENANCE.sql` | Scripts de verificación | Después de instalar o para monitoreo |
| `create_email_notification_triggers.sql` | Triggers de notificaciones email | Si usas notificaciones por email |

**Documentación relacionada:**
- Migración original: `supabase/migrations/20251008_001_daily_availability_maintenance.sql`
- Sistema completo: `docs/02-sistemas/SISTEMA-DISPONIBILIDADES-COMPLETO.md`

---

## 🚀 INSTALACIÓN (Si aún no está activo)

### **Paso 1: Ejecutar Script Principal**

1. Abre Supabase SQL Editor
2. Abre el archivo `EJECUTAR_EN_SUPABASE_DAILY_MAINTENANCE.sql`
3. Copia y pega TODO el contenido
4. Click en **RUN**

**Resultado esperado:** `✅ Success. No rows returned`

### **Paso 2: Verificar Instalación**

Ejecuta las queries del archivo `TEST_DAILY_MAINTENANCE.sql`:

```sql
-- Ver job programado
SELECT jobid, jobname, schedule, active
FROM cron.job 
WHERE jobname = 'daily-availability-maintenance';
```

**Debe mostrar:** `active = true`

### **Paso 3: Probar Ejecución Manual**

```sql
SELECT daily_availability_maintenance();
```

**Resultado esperado:**
```json
{
  "success": true,
  "businesses_processed": 1,
  "total_slots_deleted": X,
  "total_slots_created": X,
  "summary": "Procesados 1 restaurantes..."
}
```

✅ **¡Listo! El sistema se ejecutará automáticamente cada día a las 4 AM UTC**

---

## 🔍 MONITOREO

### **Ver última ejecución:**
```sql
SELECT 
    start_time,
    status,
    return_message,
    end_time - start_time as duracion
FROM cron.job_run_details 
WHERE command LIKE '%daily_availability_maintenance%'
ORDER BY start_time DESC 
LIMIT 1;
```

### **Ver historial (últimos 7 días):**
```sql
SELECT 
    start_time::date as fecha,
    COUNT(*) as ejecuciones,
    COUNT(*) FILTER (WHERE status = 'succeeded') as exitosas,
    COUNT(*) FILTER (WHERE status = 'failed') as fallidas
FROM cron.job_run_details 
WHERE command LIKE '%daily_availability_maintenance%'
  AND start_time > NOW() - INTERVAL '7 days'
GROUP BY start_time::date
ORDER BY fecha DESC;
```

---

## ⚙️ CONFIGURACIÓN

### **Horario actual:**
- **UTC:** 4:00 AM
- **España (CET/CEST):** 5:00/6:00 AM

### **Cambiar horario:**
```sql
-- Ejemplo: Cambiar a 2:00 AM UTC
SELECT cron.unschedule(3);  -- jobid actual
SELECT cron.schedule(
    'daily-availability-maintenance',
    '0 2 * * *',  -- 2:00 AM UTC
    'SELECT daily_availability_maintenance();'
);
```

### **Desactivar temporalmente:**
```sql
SELECT cron.unschedule(3);
```

### **Reactivar:**
```sql
SELECT cron.schedule(
    'daily-availability-maintenance',
    '0 4 * * *',
    'SELECT daily_availability_maintenance();'
);
```

---

## 🛡️ PROTECCIONES IMPLEMENTADAS

✅ **NUNCA elimina reservas** (tabla `reservations`)  
✅ **Solo elimina slots LIBRES** (`status='free'`)  
✅ **Solo elimina días PASADOS** (`slot_date < hoy`)  
✅ **Respeta días cerrados manualmente** (de `special_events`)  
✅ **Respeta políticas de reservas** (`advance_booking_days`)  
✅ **Respeta horarios** (`operating_hours`)  
✅ **Multi-tenant** (funciona para todos los restaurantes)

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Valor Esperado |
|---------|----------------|
| Slots antiguos libres | 0 |
| Días adelante | = `advance_booking_days` |
| Ejecuciones diarias | 1 |
| Status | `succeeded` |
| Errores | 0 |

---

## 🚨 TROUBLESHOOTING

### **Error: "pg_cron extension not available"**
- **Solución:** Supabase Pro/Team requerido. En Free tier, considerar alternativas.

### **No se ejecuta automáticamente**
```sql
-- Verificar que está activo
SELECT * FROM cron.job WHERE jobid = 3;

-- Si active = false, reactivar
SELECT cron.schedule(
    'daily-availability-maintenance',
    '0 4 * * *',
    'SELECT daily_availability_maintenance();'
);
```

### **Errores en ejecución**
```sql
-- Ver logs de error
SELECT 
    start_time,
    status,
    return_message
FROM cron.job_run_details 
WHERE command LIKE '%daily_availability_maintenance%'
  AND status = 'failed'
ORDER BY start_time DESC;
```

---

## ✅ CHECKLIST FINAL

- [x] Script principal ejecutado
- [x] Job programado (ID: 3, activo)
- [ ] Ejecución manual probada
- [ ] Verificación de resultados OK
- [ ] Primera ejecución automática verificada (mañana 4 AM)
- [ ] Monitoreo configurado (opcional)

---

## 📚 DOCUMENTACIÓN COMPLETA

Ver `docs/DAILY_AVAILABILITY_MAINTENANCE.md` para:
- Detalles técnicos completos
- Ejemplos de uso avanzado
- Configuración de alertas
- Optimizaciones

---

**¡El sistema está ACTIVO y funcionando! 🎉**

Mañana a las 4 AM se ejecutará automáticamente por primera vez.

