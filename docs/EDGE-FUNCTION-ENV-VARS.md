# 🔧 Variables de Entorno para Edge Functions

## Variables Requeridas

Para que la Edge Function `google-calendar-oauth` funcione correctamente, necesitas configurar estas variables de entorno en Supabase:

### En Supabase Dashboard:

1. Ve a **Settings** > **Edge Functions** > **Secrets**
2. Agrega estas variables:

```env
# Google OAuth
GOOGLE_CLIENT_ID=631032685382-cd0cfd524lcg86q9urjhdgn6orbnro0r.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui

# Supabase
SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# URL de tu aplicación (IMPORTANTE para redirecciones)
PUBLIC_SITE_URL=https://tu-dominio.com
# O para desarrollo local:
# PUBLIC_SITE_URL=http://localhost:5173
```

## ⚠️ Variable Crítica: PUBLIC_SITE_URL

Esta variable es **esencial** para que la Edge Function redirija correctamente después de la autorización de Google.

### Para Desarrollo Local:
```env
PUBLIC_SITE_URL=http://localhost:5173
```

### Para Producción:
```env
PUBLIC_SITE_URL=https://tu-dominio.com
```

## 🔍 Cómo Verificar

1. Ve a Supabase Dashboard > Settings > Edge Functions > Secrets
2. Verifica que todas las variables estén configuradas
3. Si falta `PUBLIC_SITE_URL`, la Edge Function usará `http://localhost:5173` como fallback (solo para desarrollo)

## 🚨 Error Común

Si ves este error:
```
/functions/v1/undefined/configuracion
```

Significa que `PUBLIC_SITE_URL` no está configurada. Agrega la variable en Supabase Dashboard.

