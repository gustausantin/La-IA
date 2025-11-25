# 🚀 Instrucciones Rápidas - Solución CORS

## ❌ Problema
Tu aplicación no puede conectarse a Supabase desde `localhost:5173`

## ✅ Solución (5 minutos)

### 1️⃣ Abrir Dashboard de Supabase

Ve a esta URL (haz click):

👉 https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/auth/url-configuration

### 2️⃣ Configurar Site URL

En el campo **"Site URL"**, escribe:

```
http://localhost:5173
```

### 3️⃣ Agregar Redirect URLs

En el campo **"Redirect URLs"**, agrega estas líneas (una por línea):

```
http://localhost:5173
http://localhost:5173/**
http://127.0.0.1:5173
http://127.0.0.1:5173/**
```

### 4️⃣ Guardar Cambios

Click en el botón **"Save"** en la parte inferior

### 5️⃣ Esperar

⏱️ Espera **2 minutos** para que los cambios se apliquen

### 6️⃣ Reiniciar el Servidor

En tu terminal (PowerShell), presiona:
- `Ctrl + C` (para detener el servidor)
- Luego ejecuta: `npm run dev`

### 7️⃣ Recargar el Navegador

En Chrome/Edge, presiona:
- `Ctrl + Shift + R` (hard reload)

### 8️⃣ Probar Login

Intenta iniciar sesión de nuevo. ¡Debería funcionar! ✨

---

## 🔍 ¿Cómo sé si funcionó?

Después de iniciar sesión, en la consola del navegador (F12) deberías ver:

✅ `🔐 Inicializando autenticación...`  
✅ `✅ Login exitoso`  

En lugar de:
❌ `Failed to fetch`  
❌ `CORS policy`  

---

## 🆘 ¿Sigue sin funcionar?

### Opción A: Modo Incógnito
1. Abre el navegador en modo incógnito (`Ctrl+Shift+N`)
2. Ve a `http://localhost:5173`
3. Intenta iniciar sesión

Si funciona aquí, el problema es una extensión del navegador. Desactiva ad-blockers o extensiones de privacidad.

### Opción B: Verificar Firewall
1. Abre **Windows Security**
2. Ve a **Firewall & network protection**
3. Click en **Allow an app through firewall**
4. Busca **Node.js** y asegúrate que esté permitido

### Opción C: Leer Diagnóstico Completo
Abre el archivo: `DIAGNOSTICO_CORS_COMPLETO.md`

---

## 📱 Checklist Rápido

- [ ] URLs configuradas en Supabase Dashboard
- [ ] Esperé 2 minutos
- [ ] Reinicié el servidor (`npm run dev`)
- [ ] Recargué el navegador (Ctrl+Shift+R)
- [ ] Probé en modo incógnito
- [ ] Verifiqué que Node.js esté permitido en firewall

---

## 💡 Tip Pro

Si trabajas frecuentemente en desarrollo local, considera agregar también:

```
http://localhost:3000
http://localhost:3000/**
```

Por si en el futuro cambias el puerto de Vite.

---

**Tiempo estimado:** 5 minutos  
**Dificultad:** Fácil 🟢  
**Requiere:** Acceso al Dashboard de Supabase


