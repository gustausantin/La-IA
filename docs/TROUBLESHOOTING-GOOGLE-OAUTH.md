# 🔧 Solución de Problemas: Google OAuth redirect_uri_mismatch

## ❌ Error: `redirect_uri_mismatch`

Este error ocurre cuando la URI de redirección que envía tu aplicación **NO coincide exactamente** con la configurada en Google Cloud Console.

## 🔍 Pasos de Diagnóstico

### 1. Verificar la URI que está enviando tu aplicación

1. Abre la consola del navegador (F12)
2. Ve a la pestaña **Console**
3. Haz clic en "Conectar con Google Calendar"
4. Busca los logs que empiezan con `🔍 DEBUG OAuth:`
5. Copia la URI que aparece en `redirectUri completo:`

Deberías ver algo como:
```
🔍 DEBUG OAuth:
  - window.location.origin: http://localhost:5173
  - redirectUri completo: http://localhost:5173/oauth/google/callback
```

### 2. Verificar la URI en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **APIs & Services** > **Credentials**
4. Haz clic en tu OAuth 2.0 Client ID
5. En **"URIs de redireccionamiento autorizados"**, verifica que la URI sea **EXACTAMENTE** igual

### 3. Comparar ambas URIs

Las URIs deben ser **EXACTAMENTE** iguales, carácter por carácter:

✅ **CORRECTO:**
```
Aplicación:  http://localhost:5173/oauth/google/callback
Google:      http://localhost:5173/oauth/google/callback
```

❌ **INCORRECTO (causará error):**
```
Aplicación:  http://localhost:5173/oauth/google/callback
Google:      http://localhost:5173/oauth/google/callback/  ← trailing slash
```

❌ **INCORRECTO:**
```
Aplicación:  http://localhost:5173/oauth/google/callback
Google:      https://localhost:5173/oauth/google/callback  ← https vs http
```

❌ **INCORRECTO:**
```
Aplicación:  http://localhost:5173/oauth/google/callback
Google:      http://localhost:3000/oauth/google/callback   ← puerto diferente
```

## ✅ Soluciones Comunes

### Solución 1: Verificar el puerto

Si estás usando Vite, el puerto por defecto es **5173**. Si cambiaste el puerto:

1. Verifica en qué puerto está corriendo tu aplicación
2. Actualiza la URI en Google Cloud Console para que coincida

**Ejemplo:**
- Si tu app corre en `http://localhost:3000`
- La URI debe ser: `http://localhost:3000/oauth/google/callback`

### Solución 2: Verificar protocolo (http vs https)

- **Desarrollo local:** Usa `http://`
- **Producción:** Usa `https://`

**IMPORTANTE:** La URI en Google Cloud Console debe usar el mismo protocolo que tu aplicación.

### Solución 3: Eliminar trailing slashes y espacios

Asegúrate de que NO haya:
- Espacios al inicio o final
- Trailing slashes (`/` al final)
- Caracteres especiales codificados incorrectamente

### Solución 4: Agregar múltiples URIs (desarrollo y producción)

Puedes agregar múltiples URIs en Google Cloud Console:

```
http://localhost:5173/oauth/google/callback
https://tu-dominio.com/oauth/google/callback
```

Esto te permite usar la misma configuración para desarrollo y producción.

### Solución 5: Esperar a que se propaguen los cambios

Los cambios en Google Cloud Console pueden tardar:
- **Mínimo:** 5 minutos
- **Máximo:** Varias horas

Si acabas de cambiar la URI, espera unos minutos y vuelve a intentar.

## 🧪 Prueba Rápida

1. Abre la consola del navegador (F12)
2. Ejecuta este comando para ver la URI exacta:
```javascript
console.log('URI exacta:', window.location.origin + '/oauth/google/callback');
```

3. Copia esa URI exacta
4. Ve a Google Cloud Console y agrega esa URI exacta
5. Espera 5-10 minutos
6. Intenta de nuevo

## 📋 Checklist de Verificación

Antes de intentar de nuevo, verifica:

- [ ] La URI en Google Cloud Console es **exactamente** igual a la que envía tu app
- [ ] El protocolo coincide (`http://` vs `https://`)
- [ ] El puerto coincide (5173, 3000, etc.)
- [ ] No hay trailing slashes
- [ ] No hay espacios
- [ ] Esperaste al menos 5 minutos después de cambiar la configuración
- [ ] Limpiaste la caché del navegador
- [ ] El Client ID en `.env` es correcto

## 🆘 Si Nada Funciona

1. **Verifica el Client ID:**
   - Asegúrate de que `VITE_GOOGLE_CLIENT_ID` en tu `.env` sea el correcto
   - Debe ser el mismo que aparece en Google Cloud Console

2. **Verifica que la API esté habilitada:**
   - Ve a **APIs & Services** > **Library**
   - Busca "Google Calendar API"
   - Asegúrate de que esté **habilitada**

3. **Verifica el OAuth Consent Screen:**
   - Ve a **APIs & Services** > **OAuth consent screen**
   - Asegúrate de que esté configurado correctamente
   - Si está en modo "Testing", agrega tu email a "Test users"

4. **Revisa los logs de la consola:**
   - Abre la consola del navegador
   - Busca errores adicionales
   - Los logs de debug te mostrarán la URI exacta que se está enviando

## 📞 Información para Soporte

Si necesitas ayuda adicional, proporciona:

1. La URI exacta que aparece en los logs de debug
2. La URI configurada en Google Cloud Console
3. El puerto en el que corre tu aplicación
4. Si estás en desarrollo o producción
5. Captura de pantalla de la configuración en Google Cloud Console

