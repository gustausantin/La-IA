# 🔐 SETUP DE CREDENCIALES - PASO A PASO

## ✅ LO QUE YA ESTÁ HECHO

1. ✅ `.gitignore` actualizado (archivos `.env` no se subirán a Git)
2. ✅ Archivos de configuración actualizados para usar variables de entorno
3. ✅ Archivo `.env` creado (con plantilla)
4. ✅ Archivo `.env.example` creado (plantilla pública sin secretos)

---

## 📋 LO QUE TIENES QUE HACER (5 MINUTOS)

### **PASO 1: Editar el archivo `.env`**

1. Abre el archivo `.env` en la raíz del proyecto
2. Verás algo como esto:

```env
VITE_SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
SUPABASE_SERVICE_KEY=TU_SERVICE_KEY_AQUI
VITE_API_BASE_URL=http://localhost:3001
```

3. **Reemplaza** las credenciales con las de tus imágenes:

#### **De la imagen "Legacy API Keys":**

Busca la línea `anon` `public` y copia la key completa:

```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0...
```

#### **De la imagen "API Keys" (la pestaña nueva):**

En la sección "Secret keys" hay un campo que dice `sb_secret_...` con puntos. 
Click en el ícono del ojo 👁️ para revelarla y cópiala:

```env
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUxNjA5MSwiZXhwIjoyMDc3MDkyMDkxfQ...
```

4. **Guarda el archivo** (Ctrl+S)

---

### **PASO 2: Verificar que `.env` no se sube a Git**

Ejecuta en la terminal:

```bash
git status
```

**Resultado esperado:**
- ✅ `.env` NO debe aparecer en la lista
- ✅ `.env.example` SÍ puede aparecer (es seguro, no tiene credenciales reales)

---

### **PASO 3: Probar que funciona**

```bash
npm run dev
```

**Si todo está bien:**
- ✅ La app arranca sin errores
- ✅ En la consola NO aparece: "❌ Faltan credenciales de Supabase"
- ✅ Puedes conectarte a Supabase

**Si hay error:**
- ❌ Revisa que copiaste bien las keys (sin espacios extras)
- ❌ Verifica que el archivo `.env` esté en la raíz del proyecto
- ❌ Reinicia el servidor (`Ctrl+C` y `npm run dev` otra vez)

---

## 🚨 IMPORTANTE: SEGURIDAD

### **✅ Archivos SEGUROS (se pueden subir a Git):**
- `.env.example` (plantilla sin secretos reales)
- `CONFIGURACION-CREDENCIALES.md` (documentación)
- Código fuente con `import.meta.env.VITE_...`

### **❌ Archivos PRIVADOS (NUNCA subir a Git):**
- `.env` (contiene tus credenciales reales)
- Cualquier archivo con keys expuestas

---

## 🔄 PARA VERCEL (MÁS ADELANTE)

Cuando despliegues a producción:

1. Ve a: https://vercel.com/dashboard
2. Tu proyecto → Settings → Environment Variables
3. Agrega cada variable:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

**NO** uses el archivo `.env` en Vercel. Usa su interfaz web.

---

## ✅ CHECKLIST

- [ ] Archivo `.env` editado con credenciales reales
- [ ] Archivo guardado
- [ ] `git status` NO muestra `.env` en la lista
- [ ] `npm run dev` funciona sin errores

---

## 🆘 SI HAY PROBLEMAS

**Error: "Faltan credenciales de Supabase"**
- Verifica que el archivo `.env` esté en la raíz (junto a `package.json`)
- Reinicia el servidor de desarrollo

**Error: ".env not found"**
- El archivo puede estar en otra ubicación
- Usa `ls .env` (Mac/Linux) o `dir .env` (Windows) para verificar

---

**¿Listo?** Edita el `.env`, guarda y prueba con `npm run dev` 🚀

