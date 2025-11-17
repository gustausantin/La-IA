# 🔐 Arquitectura Multi-Usuario: Google Calendar OAuth

## ✅ Cómo Funciona (Ya Configurado)

Tu aplicación **YA está configurada** para que cada usuario pueda conectar su propia cuenta de Google Calendar. Aquí te explico cómo funciona:

## 🏗️ Arquitectura Actual

### 1. **Un Solo Client ID de Google OAuth** (Compartido)
- Toda la aplicación usa el mismo `GOOGLE_CLIENT_ID`
- Este Client ID está configurado en Google Cloud Console
- Es el mismo para todos los usuarios de tu aplicación

### 2. **Tokens Únicos por Usuario/Negocio**
- Cada usuario autoriza **su propia cuenta de Google**
- Los tokens se guardan en la tabla `integrations` con `business_id` como identificador
- Cada negocio tiene sus propios tokens (access_token, refresh_token)

### 3. **Aislamiento por Business ID**
```sql
-- Cada negocio tiene su propia integración
UNIQUE(business_id, provider)
```

Esto significa:
- Negocio A → Conecta su Google Calendar → Tokens guardados con `business_id = A`
- Negocio B → Conecta su Google Calendar → Tokens guardados con `business_id = B`
- Negocio C → Conecta su Google Calendar → Tokens guardados con `business_id = C`

## 📊 Flujo Completo

### Cuando un Usuario Conecta Google Calendar:

1. **Usuario hace clic en "Conectar"**
   - El frontend envía el `business_id` como parámetro `state` en la URL de OAuth

2. **Google muestra la pantalla de autorización**
   - El usuario ve: "Selecciona una cuenta"
   - El usuario elige **SU PROPIA cuenta de Google**
   - Google pide permisos para acceder a **SU calendario**

3. **Google redirige a la Edge Function**
   - La Edge Function recibe el `code` y el `state` (business_id)
   - Intercambia el código por tokens de **ESA cuenta específica de Google**

4. **Tokens guardados por business_id**
   ```typescript
   await supabaseClient
     .from('integrations')
     .upsert({
       business_id: businessId,  // ← Identificador único del negocio
       provider: 'google_calendar',
       access_token: tokens.access_token,  // ← Tokens de SU cuenta
       refresh_token: tokens.refresh_token,
       // ...
     })
   ```

5. **Cada negocio usa sus propios tokens**
   - Cuando el Negocio A sincroniza → Usa tokens del Negocio A → Accede al calendario del Negocio A
   - Cuando el Negocio B sincroniza → Usa tokens del Negocio B → Accede al calendario del Negocio B

## 🔒 Seguridad y Privacidad

### ✅ Lo que está bien configurado:

1. **Aislamiento de datos**
   - Cada negocio solo puede ver/editar sus propias integraciones (RLS policies)
   - Los tokens están asociados a `business_id`, no se pueden mezclar

2. **Autorización individual**
   - Cada usuario autoriza su propia cuenta de Google
   - Google muestra claramente qué cuenta está autorizando

3. **Tokens únicos**
   - Cada negocio tiene sus propios `access_token` y `refresh_token`
   - Si un negocio desconecta, solo afecta a ese negocio

### ⚠️ Lo que debes verificar:

1. **Políticas RLS** (Ya corregidas)
   - Las políticas aseguran que cada negocio solo vea sus propias integraciones
   - Verifica que la migración `20251117_01_fix_integrations_rls.sql` esté aplicada

2. **Client ID compartido**
   - El mismo Client ID funciona para todos los usuarios
   - No necesitas crear un Client ID por usuario
   - Esto es el comportamiento estándar y correcto

## 🧪 Prueba Multi-Usuario

Para verificar que funciona con múltiples usuarios:

1. **Crea dos cuentas de prueba:**
   - Usuario A: `usuario-a@test.com` → Negocio A
   - Usuario B: `usuario-b@test.com` → Negocio B

2. **Conecta Google Calendar en cada una:**
   - Usuario A conecta su cuenta de Google (ej: `usuario-a@gmail.com`)
   - Usuario B conecta su cuenta de Google (ej: `usuario-b@gmail.com`)

3. **Verifica en la base de datos:**
   ```sql
   SELECT business_id, provider, 
          LEFT(access_token, 20) as token_preview,
          config->>'calendar_name' as calendar_name
   FROM integrations 
   WHERE provider = 'google_calendar';
   ```

   Deberías ver:
   ```
   business_id (A) | google_calendar | token_A... | Calendario de Usuario A
   business_id (B) | google_calendar | token_B... | Calendario de Usuario B
   ```

4. **Verifica que cada uno ve solo su integración:**
   - Usuario A → Ve solo su Google Calendar conectado
   - Usuario B → Ve solo su Google Calendar conectado

## 📝 Resumen

✅ **Ya está configurado para múltiples usuarios**
- Un Client ID compartido (correcto)
- Tokens únicos por negocio (correcto)
- Aislamiento por business_id (correcto)
- RLS policies (corregidas)

✅ **Cada usuario puede:**
- Conectar su propia cuenta de Google Calendar
- Ver solo sus propias integraciones
- Sincronizar solo con su propio calendario

✅ **No necesitas:**
- Crear un Client ID por usuario
- Configurar nada adicional
- Cambiar la arquitectura actual

## 🚀 Siguiente Paso

Solo asegúrate de que:
1. ✅ La migración RLS esté aplicada (`20251117_01_fix_integrations_rls.sql`)
2. ✅ El Client ID esté configurado en Google Cloud Console
3. ✅ Las variables de entorno estén configuradas en Supabase

¡Y listo! Tu aplicación ya soporta múltiples usuarios conectando sus propias cuentas de Google Calendar.

