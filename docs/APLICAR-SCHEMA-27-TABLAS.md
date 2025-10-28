# 🚀 APLICAR SCHEMA DE 27 TABLAS EN SUPABASE

**Fecha:** 28 de octubre de 2025  
**Estado:** ⚠️ PENDIENTE DE APLICAR

---

## ✅ INSTRUCCIONES

### PASO 1: Abrir Supabase SQL Editor

1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr
2. Click en **SQL Editor** (menú izquierdo)
3. Click en **+ New Query**

---

### PASO 2: Copiar y Pegar el SQL

1. Abre el archivo: `docs/01-arquitectura/DATABASE-SCHEMA-AUTONOMOS-2025.sql`
2. Copia **TODO EL CONTENIDO** (930 líneas)
3. Pega en el SQL Editor de Supabase

---

### PASO 3: Ejecutar

1. Click en **RUN** (o `Ctrl + Enter`)
2. Espera a que termine (puede tardar 10-20 segundos)

---

### PASO 4: Verificar

Ejecuta este query para verificar que las 27 tablas se crearon:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'business_verticals',
    'service_templates',
    'businesses',
    'resources',
    'services',
    'appointments',
    'availability_slots',
    'customers',
    'business_operating_hours',
    'business_shifts',
    'calendar_exceptions',
    'agent_conversations',
    'agent_messages',
    'agent_metrics',
    'message_templates',
    'channel_credentials',
    'escalations',
    'customer_confirmations',
    'customer_feedback',
    'crm_interactions',
    'automation_rules',
    'scheduled_messages',
    'analytics',
    'profiles',
    'user_business_mapping',
    'notifications',
    'whatsapp_message_buffer'
)
ORDER BY table_name;
```

**Debe devolver 27 filas.**

---

### PASO 5: Verificar Datos Iniciales

Verifica que los 10 verticales se insertaron:

```sql
SELECT code, name, resource_name_singular, resource_name_plural
FROM business_verticals
ORDER BY code;
```

**Debe devolver 10 filas.**

Verifica que los 48 servicios se insertaron:

```sql
SELECT vertical_type, COUNT(*) as total_services
FROM service_templates
GROUP BY vertical_type
ORDER BY vertical_type;
```

**Debe devolver 10 filas con totales entre 4-5 servicios cada una.**

---

## 🎯 DESPUÉS DE APLICAR

Una vez aplicado, avísame para continuar con:
1. ✅ Crear Edge Function `get-vertical-onboarding-config`
2. ✅ Implementar Steps 3-8 del onboarding mobile

---

## ⚠️ IMPORTANTE

- **NO CERRAR** la pestaña de Supabase hasta que termine la ejecución
- Si da error, copia el mensaje completo y pégalo aquí
- Este script es **idempotente**: puede ejecutarse múltiples veces sin problemas (usa `IF NOT EXISTS`)

---

**¿Listo? Aplica el schema y avísame cuando termine.** 🚀

