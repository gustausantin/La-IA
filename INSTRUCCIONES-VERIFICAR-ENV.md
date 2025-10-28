# ✅ VERIFICAR ARCHIVO `.env`

## 🚨 **PROBLEMA ENCONTRADO:**

El archivo `src/config/environment.js` tenía **credenciales ANTIGUAS hardcodeadas** como fallback.

Estas credenciales apuntaban al proyecto viejo de Supabase: `https://ktsqwvhqamedpmzkzjaz.supabase.co`

**Ya lo corregí**, pero ahora necesitas verificar tu `.env` local.

---

## ✅ **PASO 1: VERIFICAR QUE `.env` EXISTE**

En la raíz del proyecto (`C:\Users\Usuario\Desktop\LA-IA\La-IA\`), debe existir un archivo llamado **`.env`** (sin extensión).

Si no existe, **créalo**.

---

## ✅ **PASO 2: CONTENIDO DEL `.env`**

El archivo `.env` debe contener **EXACTAMENTE** esto:

```env
# ===================================
# 🔐 CREDENCIALES DE SUPABASE
# ===================================
# Proyecto NUEVO: zrcsujgurtglyqoqiynr

VITE_SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM

# Service Role Key para backend
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUxNjA5MSwiZXhwIjoyMDc3MDkyMDkxfQ.JrbKaSMbpjVH0RrZqLYaMIxOoR8omNvoi4KWBnCdbdE

# API Base URL
VITE_API_BASE_URL=http://localhost:5000
```

---

## ✅ **PASO 3: REINICIAR EL SERVIDOR**

1. **Detén el servidor** (Ctrl + C en la terminal)
2. **Reinicia** con:
   ```bash
   npm run dev
   ```

---

## ✅ **PASO 4: HARD REFRESH DEL NAVEGADOR**

1. Abre la app: `http://localhost:3000`
2. **Hard refresh:** `Ctrl + Shift + R`
3. O abre DevTools → Application → Clear Storage → Clear site data

---

## ✅ **PASO 5: PROBAR DE NUEVO**

Intenta crear el negocio en el wizard. Ahora debería funcionar.

---

## 🔍 **LOGS ESPERADOS:**

```
🟢 INICIANDO CREACIÓN DE NEGOCIO
📡 Obteniendo usuario con timeout de 5s...
✅ Usuario autenticado: d252c3d7-4fea-4b7d-8252-2295283b819e
📤 Insertando negocio en Supabase...
📋 Payload del negocio: {...}
✅ Negocio creado: {...}
```

---

## 🚨 **SI SIGUE FALLANDO:**

Ejecuta este comando en PowerShell:

```powershell
Get-Content .env
```

Y pégame el resultado (sin las keys completas, solo las primeras letras).


