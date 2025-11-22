# Cómo Probar el Webhook Manualmente

## 1. Verificar que los Watch Channels están Activos

Los timestamps de expiración que tienes son:
- `1764353444000` = **2025-11-28** (aprox)
- `1764353445000` = **2025-11-28** (aprox)  
- `1764353446000` = **2025-11-28** (aprox)

Estos están en el futuro, así que **deberían estar activos**.

## 2. Verificar la URL del Webhook

La URL del webhook debería ser:
```
https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-webhook
```

## 3. Probar Manualmente

Puedes probar el webhook manualmente enviando una notificación de prueba:

```bash
curl -X POST https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "la-ia-3bbe9ac3-3e61-47-8beba0732ff6873927c9-1763748645274",
    "resource_id": "9Nlrxp2aAqsR3EtjAjWCyshSPjo",
    "resource_state": "exists",
    "resource_uri": "https://www.googleapis.com/calendar/v3/calendars/8beba0732ff6873927c9d3fa4a698c55566a549c7636b503dd3020c0ef83d237@group.calendar.google.com/events"
  }'
```

## 4. Verificar Logs

Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions/google-calendar-webhook/logs

## 5. Posibles Problemas

1. **Google Calendar no está enviando notificaciones**: Puede tardar unos minutos
2. **El webhook no está accesible**: Verifica que la URL sea pública
3. **Los watch channels expiraron**: Aunque parecen estar activos, verifica la fecha actual

