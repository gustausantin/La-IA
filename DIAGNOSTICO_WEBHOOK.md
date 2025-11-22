# 🔍 Diagnóstico: Webhook No Recibe Notificaciones

## ✅ Estado Actual
- **Watch Channels**: ✅ 3 canales ACTIVOS (expiran 28 nov 2025)
- **Última Sincronización**: 22 nov 2025 16:15:05
- **Appointments Creados**: ❌ 0 desde Google Calendar

## 🔍 Posibles Causas

### 1. Google Calendar Tarda en Enviar Notificaciones
Google Calendar puede tardar **5-10 minutos** en enviar notificaciones push después de crear/modificar un evento.

### 2. El Webhook No Está Recibiendo Notificaciones
- Verifica los logs: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions/google-calendar-webhook/logs
- Si NO hay logs recientes, Google Calendar no está enviando notificaciones

### 3. Problema con la URL del Webhook
La URL debe ser:
```
https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-webhook
```

## 🧪 Prueba Manual

### Paso 1: Crear Evento en Google Calendar
1. Ve a Google Calendar
2. Crea un evento nuevo en uno de los calendarios vinculados
3. **Espera 5-10 minutos**

### Paso 2: Verificar Logs del Webhook
1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions/google-calendar-webhook/logs
2. Busca logs con timestamp reciente (últimos 10-15 minutos)
3. Si hay logs, verifica si hay errores

### Paso 3: Verificar Appointments
Ejecuta esta consulta SQL:

```sql
SELECT * FROM appointments 
WHERE business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
  AND source = 'google_calendar'
  AND created_at > NOW() - INTERVAL '15 minutes'
ORDER BY created_at DESC;
```

## 🔧 Soluciones

### Si NO hay logs en el webhook:
1. **Reconfigurar watch channels** (desde la app o manualmente)
2. **Verificar que la URL del webhook sea pública y accesible**
3. **Verificar permisos de Google Calendar API**

### Si hay logs pero hay errores:
1. Revisa el error específico en los logs
2. Verifica que el `employee_id` esté correctamente mapeado
3. Verifica que exista el cliente genérico "Cliente de Google Calendar"

### Si hay logs pero no se crean appointments:
1. Verifica que el evento tenga fecha/hora (no todo el día)
2. Verifica que el calendario esté correctamente mapeado a un empleado
3. Revisa los logs para ver qué error específico está ocurriendo

## 📊 Próximos Pasos

1. ✅ **Crear evento nuevo en Google Calendar**
2. ✅ **Esperar 5-10 minutos**
3. ✅ **Revisar logs del webhook**
4. ✅ **Ejecutar consulta SQL de appointments**
5. ✅ **Compartir resultados para diagnóstico**

