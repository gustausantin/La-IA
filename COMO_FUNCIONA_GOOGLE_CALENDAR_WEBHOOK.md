# 🔔 Cómo Funciona el Sistema de Notificaciones Push de Google Calendar

## 📖 Explicación Simple

### 1. **Nosotros le decimos a Google Calendar dónde avisarnos**

Cuando ejecutamos `setup-google-calendar-watch`, le decimos a Google Calendar:

> "Hola Google Calendar, cuando algo cambie en este calendario, **envía una notificación a esta URL**: 
> `https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-webhook`"

Esto se hace mediante la **API de Google Calendar Watch**:

```javascript
// Esto es lo que hacemos en setup-google-calendar-watch
await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/watch`,
  {
    method: 'POST',
    body: JSON.stringify({
      id: channelId,                    // ID único del canal
      type: 'web_hook',                 // Tipo: webhook (notificación HTTP)
      address: webhookUrl,              // ✅ AQUÍ le decimos la URL donde enviar notificaciones
      expiration: Date.now() + 7 días,  // Expira en 7 días
      token: business_id                // Token para identificar el negocio
    })
  }
)
```

### 2. **Google Calendar guarda esta información**

Google Calendar guarda internamente:
- **Qué calendario monitorear**: `calendar_id`
- **Dónde enviar notificaciones**: `webhookUrl` (nuestra función)
- **Cuándo expira**: 7 días después

### 3. **Cuando algo cambia en Google Calendar**

Cuando creas/modificas/eliminas un evento en Google Calendar:

1. **Google Calendar detecta el cambio** automáticamente
2. **Google Calendar busca** si hay algún "watch channel" configurado para ese calendario
3. **Google Calendar envía una notificación HTTP POST** a la URL que le dimos (`webhookUrl`)
4. **Nuestro webhook recibe la notificación** y procesa el cambio

### 4. **Nuestro webhook procesa la notificación**

Cuando nuestro webhook (`google-calendar-webhook`) recibe la notificación:

1. **Recibe la notificación** con información básica:
   ```json
   {
     "channel_id": "la-ia-...",
     "resource_uri": "https://www.googleapis.com/calendar/v3/calendars/.../events",
     "resource_state": "exists"
   }
   ```

2. **Llama a la API de Google Calendar** para obtener los eventos modificados:
   ```javascript
   // Obtener eventos desde la última sincronización
   const events = await fetch(
     `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?updatedMin=${lastSyncAt}`
   )
   ```

3. **Crea/actualiza appointments** en nuestra base de datos

## 🔄 Flujo Completo

```
1. setup-google-calendar-watch
   ↓
   "Google Calendar, avísame cuando cambie este calendario"
   ↓
   Google Calendar guarda: "OK, cuando cambie, enviaré POST a esta URL"
   
2. Usuario crea evento en Google Calendar
   ↓
   Google Calendar detecta el cambio
   ↓
   Google Calendar busca watch channels configurados
   ↓
   Google Calendar envía POST a: https://.../google-calendar-webhook
   ↓
   google-calendar-webhook recibe la notificación
   ↓
   google-calendar-webhook llama a Google Calendar API para obtener eventos
   ↓
   google-calendar-webhook crea/actualiza appointments en nuestra BD
```

## ⚠️ Puntos Importantes

### 1. **Google Calendar NO sabe automáticamente**
- Google Calendar **NO sabe** por sí solo dónde enviar notificaciones
- **NOSOTROS** le decimos explícitamente mediante `setup-google-calendar-watch`

### 2. **Los watch channels expiran**
- Los watch channels expiran después de **7 días**
- Por eso tenemos `renew-google-calendar-watch` que los renueva automáticamente

### 3. **Google Calendar puede tardar**
- Google Calendar puede tardar **5-10 minutos** en enviar notificaciones
- No es instantáneo, pero es mucho mejor que hacer polling cada minuto

### 4. **La URL del webhook debe ser pública**
- Google Calendar debe poder hacer POST a nuestra URL
- Por eso usamos la URL pública de Supabase: `https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-webhook`

## 🔍 Verificar que Está Configurado

### 1. Ver watch channels en la BD:
```sql
SELECT config->'watch_channels' 
FROM integrations 
WHERE id = '50b41bbf-274c-4c74-a225-a232406b9699';
```

### 2. Ver logs de setup-google-calendar-watch:
- Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions/setup-google-calendar-watch/logs
- Busca logs recientes que muestren: `✅ Watch configurado para calendario...`

### 3. Ver logs del webhook:
- Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions/google-calendar-webhook/logs
- Si hay logs, significa que Google Calendar está enviando notificaciones

## 🚀 Resumen

**Nosotros le decimos a Google Calendar:**
- "Cuando cambie este calendario, envía una notificación a esta URL"

**Google Calendar:**
- Guarda esta información
- Cuando detecta un cambio, envía POST a nuestra URL automáticamente

**Nuestro webhook:**
- Recibe la notificación
- Obtiene los eventos modificados
- Crea/actualiza appointments en nuestra BD


