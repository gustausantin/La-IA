# Ejecutar setup-google-calendar-watch manualmente

## Opción 1: Desde la consola del navegador (Frontend)

Abre la consola del navegador (F12) en la página de Configuración > Integraciones y ejecuta:

```javascript
const { data, error } = await supabase.functions.invoke('setup-google-calendar-watch', {
  body: {
    business_id: '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'
  }
});

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Watch channels configurados:', data);
}
```

## Opción 2: Desde la terminal (Supabase CLI)

```bash
npx supabase functions invoke setup-google-calendar-watch \
  --project-ref zrcsujgurtglyqoqiynr \
  --body '{"business_id": "3bbe9ac3-3e61-471e-822e-e159f6ad8ae2"}'
```

## Opción 3: Desde Supabase Dashboard

1. Ve a Supabase Dashboard > Edge Functions
2. Selecciona `setup-google-calendar-watch`
3. Haz clic en "Invoke"
4. En el body, pega:
```json
{
  "business_id": "3bbe9ac3-3e61-471e-822e-e159f6ad8ae2"
}
```

## Verificar después de ejecutar

```sql
SELECT 
  id,
  business_id,
  jsonb_array_length(COALESCE(config->'watch_channels', '[]'::jsonb)) as channels_count,
  config->'watch_channels' as watch_channels,
  config->'calendar_ids' as calendar_ids
FROM integrations
WHERE provider = 'google_calendar' 
  AND is_active = true
  AND business_id = '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2';
```

Deberías ver `channels_count` = 3 (uno por cada calendario vinculado).

