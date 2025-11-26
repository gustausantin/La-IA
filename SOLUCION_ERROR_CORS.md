# 🔧 Solución al Error de CORS con Supabase

## ❌ Problema Detectado

Tu aplicación está mostrando los siguientes errores:

```
Access to fetch at 'https://zrcsujgurtglyqoqiynr.supabase.co/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

## 🎯 Causas Posibles

1. **Variables de entorno no configuradas correctamente**
2. **Supabase bloqueando peticiones de localhost** (poco probable)
3. **Problemas de red/firewall**
4. **API Key inválida o expirada**

## ✅ Soluciones

### Solución 1: Verificar Variables de Entorno

Asegúrate de que tu archivo `.env` existe y tiene el siguiente formato:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

# Backend Server (solo para server.js)
SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# SMTP Config (opcional)
SMTP_USER=noreply@la-ia.site
SMTP_PASSWORD=tu_smtp_password
```

**IMPORTANTE:** 
- Las variables que empiezan con `VITE_` son accesibles en el navegador
- Las que NO tienen `VITE_` solo están en el servidor Node.js

### Solución 2: Verificar Configuración de Supabase

Ve a tu panel de Supabase y verifica:

1. **Settings → API**
   - Copia la URL del proyecto
   - Copia el `anon` public key
   - Copia el `service_role` secret key (solo para backend)

2. **Authentication → URL Configuration**
   - Agrega `http://localhost:5173` a la lista de URLs permitidas
   - Agrega `http://127.0.0.1:5173` también

3. **Authentication → Site URL**
   - Configura: `http://localhost:5173`

### Solución 3: Reiniciar el Servidor

Después de cambiar las variables de entorno:

```powershell
# Detener el servidor (Ctrl+C en el terminal)
# Luego reiniciar:
npm run dev
```

### Solución 4: Verificar Firewall/Antivirus

A veces Windows Defender o tu antivirus puede bloquear WebSockets:

1. Abre **Windows Defender Firewall**
2. Click en **Permitir una aplicación o característica**
3. Busca **Node.js** y asegúrate que está permitido en redes privadas

### Solución 5: Usar un Proxy Local (alternativa)

Si nada funciona, podemos configurar un proxy en Vite que redirija las peticiones:

Edita `vite.config.js` y agrega:

```javascript
server: {
  proxy: {
    '/supabase': {
      target: 'https://zrcsujgurtglyqoqiynr.supabase.co',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/supabase/, ''),
      secure: false,
    }
  }
}
```

## 🧪 Testing

Para verificar que la conexión funciona, abre la consola del navegador y ejecuta:

```javascript
// Test 1: Verificar que las variables están disponibles
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configurada ✅' : 'Falta ❌');

// Test 2: Verificar conectividad
fetch('https://zrcsujgurtglyqoqiynr.supabase.co/rest/v1/', {
  headers: {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
  }
})
  .then(r => console.log('✅ Conexión exitosa:', r.status))
  .catch(e => console.error('❌ Error:', e));
```

## 🚨 Error Específico Detectado

En tu caso, veo que:

1. ✅ El servidor Node.js **SÍ** tiene las variables configuradas
2. ❌ El navegador **NO** puede conectarse a Supabase
3. ❌ Los WebSockets también fallan

**Causa probable:** Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` no están en tu archivo `.env`

## 🔥 Solución Rápida

Ejecuta esto en PowerShell desde la raíz del proyecto:

```powershell
# Crear archivo .env si no existe
if (!(Test-Path .env)) {
    Write-Host "Creando archivo .env..."
    @"
VITE_SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI

SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY_AQUI
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "✅ Archivo .env creado. IMPORTANTE: Reemplaza TU_ANON_KEY_AQUI con tu clave real"
} else {
    Write-Host "El archivo .env ya existe"
    Write-Host "Verifica que contenga VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY"
}
```

Luego:
1. Edita `.env` y reemplaza `TU_ANON_KEY_AQUI` con tus claves reales
2. Reinicia el servidor: `npm run dev`
3. Recarga la página del navegador

## 📋 Checklist

- [ ] Archivo `.env` existe y tiene `VITE_SUPABASE_URL`
- [ ] Archivo `.env` tiene `VITE_SUPABASE_ANON_KEY`
- [ ] URLs en Supabase Dashboard incluyen `http://localhost:5173`
- [ ] Servidor reiniciado después de cambiar `.env`
- [ ] Navegador recargado (F5 o Ctrl+Shift+R)
- [ ] Firewall no está bloqueando Node.js

## 🆘 Si Nada Funciona

Contacta conmigo y proporciona:

1. Salida de `npm run dev` (primeras 50 líneas)
2. Errores completos de la consola del navegador
3. Resultado del test de conectividad (ver arriba)
4. Captura de la configuración de URLs en Supabase Dashboard

---

**Nota:** Este error es común en desarrollo local y generalmente se soluciona con las variables de entorno correctas.






