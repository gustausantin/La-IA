# 🔧 Solución: Webhook de Google Calendar No Funciona

## ✅ Diagnóstico
- **Watch channels configurados**: ✅ 3 canales
- **Appointments creados**: ❌ 0 en la última hora
- **Conclusión**: El webhook no está recibiendo notificaciones

## 🔍 Pasos para Solucionar

### 1. Verificar Estado de Watch Channels
Ejecuta esta consulta SQL en Supabase:

```sql
SELECT 
    channel->>'channel_id' as channel_id,
    channel->>'calendar_id' as calendar_id,
    to_timestamp((channel->>'expiration')::bigint / 1000) as expiration_date,
    CASE 
        WHEN (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
        THEN 'EXPIRADO ❌' 
        ELSE 'ACTIVO ✅' 
    END as status,
    ROUND(EXTRACT(EPOCH FROM (to_timestamp((channel->>'expiration')::bigint / 1000) - NOW())) / 86400, 1) as days_until_expiration
FROM integrations,
     jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
WHERE provider = 'google_calendar'
  AND is_active = true
  AND id = '50b41bbf-274c-4c74-a225-a232406b9699';
```

### 2. Reconfigurar Watch Channels

**Opción A: Desde la aplicación (Más fácil)**
1. Ve a **Configuración > Integraciones > Google Calendar**
2. Ve a **"Vincular Calendarios a Empleados"**
3. **Guarda nuevamente** el mapeo (sin cambiar nada)
4. Esto llamará automáticamente a `setup-google-calendar-watch`

**Opción B: Manualmente**
Ejecuta desde la consola del navegador:

```javascript
const { data, error } = await supabase.functions.invoke('setup-google-calendar-watch', {
  body: { business_id: '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2' }
});
console.log('Resultado:', data, error);
```

### 3. Verificar Logs del Webhook
1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions/google-calendar-webhook/logs
2. Busca cualquier entrada reciente
3. Si no hay logs, significa que Google Calendar no está enviando notificaciones

### 4. Probar Manualmente
Crea un evento nuevo en Google Calendar y espera **5-10 minutos**. Google Calendar puede tardar en enviar notificaciones.

### 5. Verificar URL del Webhook
La URL del webhook debe ser:
```
https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-webhook
```

Esta URL debe ser **pública y accesible** desde internet (Google Calendar debe poder hacer POST a esta URL).

## ⚠️ Posibles Problemas

1. **Watch channels expirados**: Aunque los timestamps parecen estar en el futuro, verifica con la consulta SQL
2. **Google Calendar no envía notificaciones**: Puede tardar 5-10 minutos
3. **Webhook no accesible**: Verifica que la URL sea pública
4. **Permisos de Google Calendar**: Verifica que la integración tenga permisos para leer calendarios

## 🚀 Próximos Pasos

1. Ejecuta la consulta SQL para verificar el estado
2. Reconfigura los watch channels (Opción A o B)
3. Crea un evento nuevo en Google Calendar
4. Espera 5-10 minutos
5. Verifica los logs del webhook
6. Ejecuta la consulta SQL de appointments para ver si se creó

