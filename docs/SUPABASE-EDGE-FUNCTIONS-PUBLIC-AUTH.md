# Configuración de Edge Functions Públicas en Supabase

## Problema

Las Edge Functions de Supabase requieren autenticación por defecto. Sin embargo, para callbacks de OAuth (como Google Calendar), necesitamos funciones públicas porque el proveedor externo (Google) redirige directamente a nuestra función sin poder enviar headers de autenticación.

## Error Común

```
{"code":401,"message":"Missing authorization header"}
```

Este error ocurre cuando Supabase rechaza la petición ANTES de que llegue a nuestro código porque no encuentra un header de autorización.

## Solución: Archivo de Configuración

Para hacer una Edge Function pública en Supabase, necesitamos crear un archivo de configuración especial:

### 1. Crear el archivo de configuración

Crea un archivo llamado `supabase.functions.config.json` en el directorio de tu función:

**Ubicación:** `supabase/functions/nombre-de-tu-funcion/supabase.functions.config.json`

**Contenido:**
```json
{
  "auth": false
}
```

### 2. Ejemplo: Función OAuth de Google Calendar

```
supabase/
  functions/
    google-calendar-oauth/
      index.ts
      supabase.functions.config.json  ← Este archivo hace la función pública
```

### 3. Desplegar la función

Después de crear el archivo de configuración, despliega la función:

```bash
supabase functions deploy google-calendar-oauth
```

## Seguridad: Validación Manual del API Key

Aunque la función sea pública, podemos validar manualmente el API key como capa adicional de seguridad:

```typescript
const apikey = url.searchParams.get('apikey')
const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

if (apikey && expectedAnonKey && apikey !== expectedAnonKey) {
  console.error('❌ Apikey inválido')
  // Manejar error según tu lógica
}
```

## Cuándo Usar Funciones Públicas

✅ **Usar funciones públicas para:**
- Callbacks de OAuth (Google, Facebook, etc.)
- Webhooks de servicios externos
- Endpoints que deben ser accesibles sin autenticación

❌ **NO usar funciones públicas para:**
- Operaciones que requieren autenticación de usuario
- Endpoints que manejan datos sensibles
- APIs que deben estar protegidas

## Documentación Oficial

- [Supabase Edge Functions - Development Tips](https://supabase.com/docs/guides/functions/development-tips)
- [Supabase Edge Functions - Authentication](https://supabase.com/docs/guides/functions/auth)

## Ejemplo Completo: Google Calendar OAuth

### Estructura de archivos:
```
supabase/functions/google-calendar-oauth/
├── index.ts
└── supabase.functions.config.json
```

### `supabase.functions.config.json`:
```json
{
  "auth": false
}
```

### `index.ts` (fragmento relevante):
```typescript
serve(async (req) => {
  // La función es pública, Google puede redirigir aquí
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const apikey = url.searchParams.get('apikey')
  
  // Validación opcional del apikey
  if (apikey) {
    const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (expectedAnonKey && apikey !== expectedAnonKey) {
      console.warn('⚠️ Apikey inválido')
    }
  }
  
  // Procesar OAuth callback...
})
```

## Notas Importantes

1. **El archivo de configuración debe estar en el mismo directorio que `index.ts`**
2. **Después de crear el archivo, debes redesplegar la función**
3. **El `apikey` en el query string es opcional pero recomendado para seguridad adicional**
4. **Las funciones públicas son accesibles por cualquiera que conozca la URL**

## Troubleshooting

### Error: "Missing authorization header" persiste

1. Verifica que el archivo `supabase.functions.config.json` existe
2. Verifica que el contenido es `{"auth": false}`
3. Verifica que el archivo está en el directorio correcto
4. Redesplega la función: `supabase functions deploy nombre-funcion`
5. Verifica los logs de Supabase para ver si la función se está ejecutando

### La función no se ejecuta

1. Verifica que la función está desplegada correctamente
2. Revisa los logs en el dashboard de Supabase
3. Verifica que la URL de la función es correcta
4. Asegúrate de que el método HTTP es el correcto (GET para OAuth callbacks)

## Referencias

- [Supabase GitHub - Edge Functions Auth](https://github.com/supabase/supabase/discussions)
- [Supabase Docs - Functions](https://supabase.com/docs/guides/functions)

