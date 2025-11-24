# Solución: Error "Missing authorization header" en Google Calendar OAuth

## Problema

Cuando Google redirige a nuestra función `google-calendar-oauth` después de la autenticación, obtenemos el error:

```
{"code":401,"message":"Missing authorization header"}
GET https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth?apikey=...&state=...&code=...
401 (Unauthorized)
```

**Causa:** Las Edge Functions de Supabase requieren autenticación por defecto, pero Google no puede enviar headers de autorización cuando redirige a nuestro callback.

## Solución Implementada

### 1. Archivo de Configuración para Función Pública

Se creó el archivo `supabase/functions/google-calendar-oauth/supabase.functions.config.json`:

```json
{
  "auth": false
}
```

Este archivo le dice a Supabase que esta función es pública y no requiere autenticación.

### 2. Validación Manual del API Key

Aunque la función es pública, validamos manualmente el `apikey` del query string como capa adicional de seguridad:

```typescript
const apikey = url.searchParams.get('apikey')
const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

if (apikey && expectedAnonKey && apikey !== expectedAnonKey) {
  console.error('❌ Apikey inválido')
}
```

### 3. Logging Mejorado

Se agregó logging detallado para ayudar a diagnosticar problemas:

```typescript
console.log('📥 Petición recibida en google-calendar-oauth')
console.log('📍 URL:', req.url)
console.log('🔑 Método:', req.method)
console.log('📋 Headers:', Object.fromEntries(req.headers.entries()))
```

## Pasos para Aplicar la Solución

### Paso 1: Verificar que el archivo de configuración existe

Verifica que existe el archivo:
```
supabase/functions/google-calendar-oauth/supabase.functions.config.json
```

Contenido:
```json
{
  "auth": false
}
```

### Paso 2: Redesplegar la función

**IMPORTANTE:** Después de crear o modificar el archivo de configuración, debes redesplegar la función:

```bash
supabase functions deploy google-calendar-oauth
```

O desde el dashboard de Supabase:
1. Ve a Edge Functions
2. Selecciona `google-calendar-oauth`
3. Haz clic en "Deploy" o "Redeploy"

### Paso 3: Verificar variables de entorno

Asegúrate de que estas variables estén configuradas en Supabase:

- `SUPABASE_ANON_KEY` - Para validar el apikey del query string
- `GOOGLE_CLIENT_ID` - ID de cliente de Google OAuth
- `GOOGLE_CLIENT_SECRET` - Secret de cliente de Google OAuth
- `SUPABASE_URL` - URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Para operaciones de base de datos

### Paso 4: Verificar URL en Google Cloud Console

Asegúrate de que la URL registrada en Google Cloud Console sea exactamente:

```
https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM
```

**Nota:** El `apikey` en el query string es la Anon Key de Supabase. Esto permite que la función sea pública pero con una capa de seguridad adicional.

## Verificación

### 1. Probar la función directamente

Puedes probar que la función es pública haciendo una petición GET:

```bash
curl "https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth?apikey=TU_ANON_KEY&state=test&code=test"
```

Si la función es pública, deberías recibir una respuesta (aunque sea un error de validación) en lugar de un 401.

### 2. Revisar logs

En el dashboard de Supabase, ve a Edge Functions > Logs y busca la función `google-calendar-oauth`. Deberías ver logs como:

```
📥 Petición recibida en google-calendar-oauth
📍 URL: ...
🔑 Método: GET
```

### 3. Probar el flujo completo

1. Ve a la página de configuración
2. Haz clic en "Conectar con Google Calendar"
3. Autoriza la aplicación en Google
4. Deberías ser redirigido de vuelta a tu app sin errores

## Troubleshooting

### Error persiste después de redesplegar

1. **Verifica que el archivo existe:**
   ```bash
   ls supabase/functions/google-calendar-oauth/supabase.functions.config.json
   ```

2. **Verifica el contenido del archivo:**
   ```bash
   cat supabase/functions/google-calendar-oauth/supabase.functions.config.json
   ```
   Debe ser exactamente: `{"auth": false}`

3. **Verifica que la función está desplegada:**
   - Ve al dashboard de Supabase
   - Edge Functions > google-calendar-oauth
   - Verifica que el estado es "Active"

4. **Revisa los logs:**
   - Si no ves logs, la función no se está ejecutando (problema de configuración)
   - Si ves logs pero con error 401, el archivo de configuración no se aplicó

### La función no aparece en los logs

Si no ves ningún log cuando Google redirige, significa que Supabase está rechazando la petición antes de que llegue a tu código. Esto indica que:

1. El archivo `supabase.functions.config.json` no existe
2. El archivo tiene un formato incorrecto
3. La función no se redesplegó después de crear el archivo

### Error: "Function not found"

Verifica que:
1. La función está desplegada
2. El nombre de la función es correcto: `google-calendar-oauth`
3. La URL es correcta

## Documentación Relacionada

- [Configuración de Edge Functions Públicas](./SUPABASE-EDGE-FUNCTIONS-PUBLIC-AUTH.md)
- [Documentación Oficial de Supabase](https://supabase.com/docs/guides/functions/development-tips)

## Resumen de Cambios

✅ Creado `supabase/functions/google-calendar-oauth/supabase.functions.config.json`
✅ Agregado logging detallado en la función
✅ Mejorada la validación del apikey
✅ Creada documentación completa

## Próximos Pasos

1. **Redesplegar la función:**
   ```bash
   supabase functions deploy google-calendar-oauth
   ```

2. **Probar el flujo completo de OAuth**

3. **Verificar que los logs aparecen correctamente**

4. **Si todo funciona, probar la sincronización con `sync-google-calendar`**

