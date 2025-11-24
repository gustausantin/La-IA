# Reconfigurar Watch Channels de Google Calendar

## Problema
Los watch channels están configurados pero no están recibiendo notificaciones de Google Calendar.

## Solución: Reconfigurar Watch Channels

### Opción 1: Desde la aplicación (Recomendado)
1. Ve a **Configuración > Integraciones > Google Calendar**
2. Ve a la sección de **"Vincular Calendarios a Empleados"**
3. **Guarda nuevamente** el mapeo (esto llamará automáticamente a `setup-google-calendar-watch`)

### Opción 2: Manualmente desde el código
Ejecuta esto desde la consola del navegador o desde tu código:

```javascript
// Reemplaza con tu business_id
const businessId = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2';

// Llamar a setup-google-calendar-watch
const { data, error } = await supabase.functions.invoke('setup-google-calendar-watch', {
  body: { business_id: businessId }
});

console.log('Resultado:', data, error);
```

### Opción 3: Verificar logs
1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/functions
2. Revisa los logs de:
   - `setup-google-calendar-watch` - Para ver si se configuraron correctamente
   - `google-calendar-webhook` - Para ver si llegan notificaciones

## Verificar Estado

Ejecuta esta consulta SQL para ver el estado actual:

```sql
-- Ver estado de watch channels
SELECT 
    channel->>'channel_id' as channel_id,
    channel->>'calendar_id' as calendar_id,
    to_timestamp((channel->>'expiration')::bigint / 1000) as expiration_date,
    CASE 
        WHEN (channel->>'expiration')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
        THEN 'EXPIRADO ❌' 
        ELSE 'ACTIVO ✅' 
    END as status
FROM integrations,
     jsonb_array_elements(COALESCE(config->'watch_channels', '[]'::jsonb)) AS channel
WHERE provider = 'google_calendar'
  AND is_active = true
  AND id = '50b41bbf-274c-4c74-a225-a232406b9699';
```


