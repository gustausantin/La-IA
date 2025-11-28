# 🔍 Diagnóstico Completo del Error CORS

## ✅ Estado Actual

**Variables de Entorno:** ✅ Correctamente configuradas
**Servidor Node.js:** ✅ Funcionando en puerto 3000
**Servidor Vite:** ✅ Funcionando en puerto 5173

## ❌ Problema Detectado

El navegador está bloqueando las peticiones a Supabase con el error:

```
Access to fetch at 'https://zrcsujgurtglyqoqiynr.supabase.co/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🎯 Causa Real

Este error indica que **Supabase no está enviando los headers CORS correctos**. Esto puede ocurrir si:

1. Tu dominio `localhost:5173` no está en la lista de URLs permitidas en Supabase
2. Hay un problema con las credenciales de API
3. El proyecto de Supabase tiene restricciones de CORS activas

## 🛠️ Soluciones (en orden de prioridad)

### ✅ Solución 1: Configurar URLs Permitidas en Supabase

1. Ve a tu dashboard de Supabase:
   https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/auth/url-configuration

2. En **Site URL**, asegúrate que esté configurado:
   ```
   http://localhost:5173
   ```

3. En **Redirect URLs**, agrega:
   ```
   http://localhost:5173
   http://localhost:5173/**
   http://127.0.0.1:5173
   http://127.0.0.1:5173/**
   ```

4. Guarda los cambios

5. **Importante:** Espera 1-2 minutos para que los cambios se propaguen

6. Recarga la aplicación en el navegador

### ✅ Solución 2: Verificar RLS (Row Level Security)

A veces el error de CORS es en realidad un error de permisos disfrazado:

1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/auth/policies

2. Verifica que la tabla `businesses` tenga políticas RLS configuradas para SELECT

3. Si no hay políticas, Supabase puede devolver un error 403 que parece CORS

### ✅ Solución 3: Usar Proxy Local (temporal)

Si las soluciones anteriores no funcionan, podemos usar un proxy local para evitar el problema de CORS:

**Archivo:** `vite.config.js`

Modifica la sección `server` para agregar:

```javascript
server: {
  host: "0.0.0.0",
  port: 5173,
  strictPort: true,
  
  // Proxy para Supabase
  proxy: {
    '/api/supabase': {
      target: 'https://zrcsujgurtglyqoqiynr.supabase.co',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
      secure: false,
      configure: (proxy, options) => {
        proxy.on('error', (err, req, res) => {
          console.log('proxy error', err);
        });
        proxy.on('proxyReq', (proxyReq, req, res) => {
          console.log('Sending Request:', req.method, req.url);
        });
        proxy.on('proxyRes', (proxyRes, req, res) => {
          console.log('Received Response:', proxyRes.statusCode, req.url);
        });
      }
    }
  }
}
```

**Luego modifica:** `src/lib/supabase.js`

```javascript
// Usar proxy en desarrollo
const supabaseUrl = import.meta.env.DEV 
  ? 'http://localhost:5173/api/supabase'  // Proxy local
  : import.meta.env.VITE_SUPABASE_URL;    // URL real en producción
```

**Reinicia el servidor:**
```bash
npm run dev
```

### ✅ Solución 4: Verificar Firewall/Antivirus

Windows Defender o tu antivirus puede estar bloqueando las peticiones:

1. Abre **Windows Security** → **Firewall & network protection**

2. Click en **Allow an app through firewall**

3. Busca **Node.js** y asegúrate que esté permitido en:
   - ✅ Private networks
   - ✅ Public networks

4. Si no está en la lista, click en **Change settings** → **Allow another app**

5. Busca y agrega:
   ```
   C:\Program Files\nodejs\node.exe
   ```

### ✅ Solución 5: Desactivar Extensiones del Navegador

Algunas extensiones pueden interferir:

1. Abre el navegador en **Modo Incógnito** (Ctrl+Shift+N)
2. Navega a `http://localhost:5173`
3. Intenta iniciar sesión

Si funciona en incógnito, el problema es una extensión. Desactiva:
- Ad blockers
- Privacy badger
- NoScript
- Cualquier extensión de seguridad

### ✅ Solución 6: Verificar Headers en Network Tab

1. Abre **DevTools** (F12)
2. Ve a la pestaña **Network**
3. Intenta iniciar sesión
4. Click en la petición fallida (roja)
5. Ve a la pestaña **Headers**

**Busca:**
- **Request Headers**: ¿Tiene `apikey` y `Authorization`?
- **Response Headers**: ¿Tiene `Access-Control-Allow-Origin`?

Si NO tiene `Access-Control-Allow-Origin`, el problema está en Supabase.

### ✅ Solución 7: Resetear Configuración de Supabase

Como último recurso:

1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/settings/api

2. Click en **Reset API Keys** (SOLO SI ESTÁS SEGURO)
   - Esto invalidará todas las keys actuales
   - Tendrás que actualizar el `.env` con las nuevas keys

3. Actualiza tu `.env` con las nuevas credenciales

4. Reinicia el servidor

## 🧪 Test de Conectividad Manual

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Test 1: Verificar variables
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configurada' : 'FALTA');

// Test 2: Petición manual con fetch
const testConnection = async () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  try {
    const response = await fetch(`${url}/rest/v1/businesses?select=count`, {
      method: 'HEAD',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', [...response.headers.entries()]);
    
    if (response.ok || response.status === 401) {
      console.log('✅ Conexión exitosa (CORS funciona)');
    } else {
      console.error('❌ Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error de red:', error.message);
    console.log('Causa probable: CORS o problema de red');
  }
};

await testConnection();
```

## 🔥 Solución Rápida Recomendada

**Paso 1:** Configura las URLs en Supabase Dashboard

**Paso 2:** Espera 2 minutos

**Paso 3:** Reinicia el navegador completamente

**Paso 4:** Reinicia el servidor:
```bash
# Ctrl+C en el terminal
npm run dev
```

**Paso 5:** Recarga la página (Ctrl+Shift+R para hard reload)

## 📊 Checklist de Diagnóstico

- [ ] Variables de entorno configuradas (✅ YA ESTÁ)
- [ ] URLs permitidas en Supabase Dashboard
- [ ] Esperado 2 minutos después de cambiar Supabase
- [ ] Servidor reiniciado
- [ ] Navegador reiniciado (no solo recargado)
- [ ] Probado en modo incógnito
- [ ] Firewall permite Node.js
- [ ] Test de conectividad ejecutado en consola
- [ ] Headers CORS verificados en Network Tab

## 🆘 Si NADA Funciona

El problema puede estar en el proyecto de Supabase. Contacta a soporte de Supabase:

1. Ve a: https://supabase.com/dashboard/support
2. Describe el problema: "CORS error from localhost:5173"
3. Proporciona:
   - Project ID: `zrcsujgurtglyqoqiynr`
   - Error exacto del navegador
   - Screenshot de Network tab mostrando el error

## 📝 Notas Adicionales

- **WebSocket errors** son secundarios y se resolverán cuando CORS funcione
- **React Router warnings** ya fueron corregidos en `App.jsx`
- **CSS warning** de `@import` ya fue corregido en `index.css`

---

**Estado de las correcciones aplicadas:**
- ✅ React Router v7 flags agregados
- ✅ CSS @import movido antes de @tailwind
- ✅ Variables de entorno verificadas
- ⏳ CORS: pendiente configuración en Supabase Dashboard









