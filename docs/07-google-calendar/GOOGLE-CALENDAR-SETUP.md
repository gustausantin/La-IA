# 🔧 Configuración de Google Calendar Integration

## 📋 Requisitos Previos

1. **Cuenta de Google Cloud Platform** con un proyecto creado
2. **Google Calendar API** habilitada en tu proyecto
3. **Credenciales OAuth 2.0** configuradas

## 🚀 Pasos de Configuración

### 1. Configurar OAuth 2.0 en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Navega a **APIs & Services** > **Credentials**
4. Haz clic en **Create Credentials** > **OAuth client ID**
5. Si es la primera vez, configura la **OAuth consent screen**:
   - Tipo de aplicación: **External** (o Internal si usas Google Workspace)
   - Información de la aplicación: nombre, email de soporte, etc.
   - Scopes: Agrega los siguientes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
   - Usuarios de prueba: Agrega tu email (si la app está en modo testing)

### 2. Crear OAuth Client ID

1. Tipo de aplicación: **Web application**
2. Nombre: `LA-IA Google Calendar Integration`
3. **URIs de redirección autorizadas**: ⚠️ **CRÍTICO**

   Agrega EXACTAMENTE esta URI (la Edge Function de Supabase):

   ```
   https://{tu-project-ref}.supabase.co/functions/v1/google-calendar-oauth
   ```

   **Para encontrar tu project-ref:**
   - Ve a tu proyecto en Supabase Dashboard
   - La URL será: `https://[PROJECT-REF].supabase.co`
   - Reemplaza `[PROJECT-REF]` con tu referencia real
   - Ejemplo: Si tu URL es `https://zrcsujgurtglyqoqiynr.supabase.co`
   - La URI será: `https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/google-calendar-oauth`

   **Importante:**
   - La URI debe ser EXACTAMENTE igual (incluyendo https, sin trailing slash)
   - Esta es la URL de tu Edge Function de Supabase
   - No uses `localhost` - siempre usa la URL de producción de Supabase

4. Haz clic en **Create**
5. Copia el **Client ID** y **Client Secret**

### 3. Configurar Variables de Entorno

**En tu archivo `.env` local:**

```env
VITE_GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
VITE_SUPABASE_URL=https://tu-project-ref.supabase.co
```

**En Supabase Dashboard (Settings > Edge Functions > Secrets):**

Agrega estas variables de entorno para la Edge Function:

```env
GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
SUPABASE_URL=https://tu-project-ref.supabase.co
PUBLIC_SITE_URL=https://tu-dominio.com  # O http://localhost:5173 para desarrollo
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 4. Desplegar Edge Function

La Edge Function `google-calendar-oauth` debe estar desplegada en Supabase:

```bash
npx supabase functions deploy google-calendar-oauth
```

O desde Supabase Dashboard: **Edge Functions** > **google-calendar-oauth** > **Deploy**

## ✅ Verificación

Después de configurar todo:

1. Ve a la página de Configuración > Integraciones
2. Haz clic en "Conectar con Google Calendar"
3. Deberías ser redirigido a Google para autorizar
4. Después de autorizar, deberías ser redirigido de vuelta a la aplicación
5. Deberías ver "✅ Google Calendar conectado"

## 🔄 Flujo Completo

1. Usuario hace clic en "Conectar con Google Calendar"
2. Aplicación redirige a Google OAuth con:
   - `client_id`: Tu Client ID
   - `redirect_uri`: `{supabase-url}/functions/v1/google-calendar-oauth`
   - `scope`: `calendar` y `calendar.events`
   - `state`: `businessId` (para identificar el negocio)
3. Usuario autoriza en Google
4. Google redirige a la Edge Function con `code` y `state`
5. La Edge Function:
   - Intercambia el código por tokens
   - Obtiene información del calendario
   - Guarda los tokens en la tabla `integrations`
6. Usuario es redirigido a Configuración con mensaje de éxito

## 📝 Estructura de la Integración

Una vez conectado, la integración se guarda en la tabla `integrations` con esta estructura:

```json
{
  "id": "uuid",
  "business_id": "uuid",
  "provider": "google_calendar",
  "is_active": true,
  "status": "active",
  "access_token": "token...",
  "refresh_token": "token...",
  "token_expires_at": "2025-11-18T...",
  "config": {
    "calendar_id": "primary",
    "calendar_name": "LA-IA Reservas",
    "sync_direction": "bidirectional",
    "events_synced": 0
  },
  "connected_at": "2025-11-17T...",
  "last_sync_at": null
}
```

## 🔒 Seguridad

- Los tokens se almacenan de forma segura en la base de datos
- La Edge Function usa `SERVICE_ROLE_KEY` para bypass RLS al guardar
- Las políticas RLS aseguran que solo el dueño del negocio pueda ver/modificar sus integraciones
- Los tokens se refrescan automáticamente cuando expiran

## 🚨 Solución de Problemas

### Error: `redirect_uri_mismatch`

**Causa:** El `redirect_uri` en Google Cloud Console no coincide exactamente con el que usa la Edge Function.

**Solución:**
1. Verifica que el `redirect_uri` en Google Cloud Console sea exactamente:
   ```
   https://{tu-project-ref}.supabase.co/functions/v1/google-calendar-oauth
   ```
2. Asegúrate de que no tenga trailing slash (`/` al final)
3. Asegúrate de que use `https://` (no `http://`)

### Error: `invalid_client`

**Causa:** El Client ID o Client Secret son incorrectos.

**Solución:**
1. Verifica que las variables de entorno estén configuradas correctamente
2. Asegúrate de que el Client ID y Secret sean del mismo proyecto de Google Cloud

### La integración no aparece como "Activa"

**Causa:** Puede haber un problema con las políticas RLS o con la carga de datos.

**Solución:**
1. Verifica que la migración `20251117_FINAL_integrations_rls_optimized.sql` esté aplicada
2. Recarga la página
3. Revisa los logs de la Edge Function para ver si hubo errores al guardar
