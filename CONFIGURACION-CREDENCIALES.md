# 🔐 CONFIGURACIÓN DE CREDENCIALES

## ⚠️ IMPORTANTE: SEGURIDAD DE CREDENCIALES

Las credenciales **NUNCA** deben estar en el código. Siempre en variables de entorno.

---

## 📋 PASOS PARA CONFIGURAR

### **1. Editar el archivo `.env`**

Ya existe un archivo `.env` en la raíz del proyecto. Ábrelo y:

1. Busca estas líneas:
```env
VITE_SUPABASE_ANON_KEY=PEGA_AQUI_TU_ANON_KEY_DE_LA_IMAGEN
SUPABASE_SERVICE_KEY=PEGA_AQUI_TU_SERVICE_KEY_DE_LA_IMAGEN
```

2. Reemplaza con tus credenciales reales de las imágenes:

**ANON KEY (de la pestaña "Legacy API Keys"):**
```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0...
```

**SERVICE KEY (la que dice "secret" con •••••):**
```env
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUxNjA5MSwiZXhwIjoyMDc3MDkyMDkxfQ...
```

3. Guarda el archivo (Ctrl+S)

---

### **2. Verificar que `.env` esté en `.gitignore`**

✅ Ya lo agregué. El archivo `.env` **NO se subirá** a GitHub.

---

### **3. Actualizar archivos de configuración**

Ahora voy a actualizar los archivos que usan las credenciales para que lean desde `.env`:

- `src/config/environment.js`
- `src/config/environment.development.js`
- `src/lib/supabase.js`
- `server.js`

---

## 🚨 REGLAS DE ORO

### **✅ HACER:**
- Usar variables de entorno (`.env`)
- Mantener `.env` en `.gitignore`
- Usar `.env.example` como plantilla (sin credenciales reales)

### **❌ NUNCA HACER:**
- Poner credenciales directamente en el código
- Subir `.env` a Git/GitHub
- Compartir credenciales por chat/email
- Hacer commits con credenciales

---

## 🔄 FLUJO CORRECTO

```
Supabase Dashboard
    ↓ (copiar keys)
Archivo .env (LOCAL)
    ↓ (leer en runtime)
Aplicación
```

---

## 📝 PARA VERCEL (MÁS ADELANTE)

Cuando despliegues a Vercel, las variables de entorno se configuran en:
- Vercel Dashboard → Tu Proyecto → Settings → Environment Variables

**NO** uses el archivo `.env` en producción. Vercel tiene su propio sistema.

---

## ✅ CHECKLIST

- [ ] Archivo `.env` editado con credenciales reales
- [ ] Archivo guardado (Ctrl+S)
- [ ] `.gitignore` actualizado (ya lo hice)
- [ ] Verificar que `.env` no aparece en Git (`git status`)

---

**¿Listo? Ahora edita el `.env` con tus credenciales y avísame cuando esté listo.**

