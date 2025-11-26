# 📍 DÓNDE CONFIGURAR WEBSOCKETS EN SUPABASE

**Estás en:** API Settings (Data API)  
**Necesitas ir a:** Authentication → URL Configuration

---

## 🎯 PASOS EXACTOS

### **Paso 1: Salir de "API Settings"**

En el menú izquierdo, busca la sección **"CONFIGURATION"**

### **Paso 2: Ir a "Authentication"**

En la sección **"CONFIGURATION"**, haz click en:
```
Authentication
```

(Debería tener un ícono de enlace externo 🔗)

### **Paso 3: Ir a "URL Configuration"**

Dentro de Authentication, busca y haz click en:
```
URL Configuration
```

O busca en el menú lateral de Authentication:
- URL Configuration
- Redirect URLs
- Site URL

---

## 🔍 QUÉ BUSCAR

En **Authentication → URL Configuration** deberías ver:

### **1. Site URL**
```
http://localhost:5173
```

### **2. Redirect URLs**
Debería incluir:
```
http://localhost:5173
http://localhost:5173/**
http://127.0.0.1:5173
http://127.0.0.1:5173/**
```

### **3. Additional Redirect URLs** (si existe)
Agrega las mismas URLs aquí también.

---

## ⚠️ IMPORTANTE SOBRE REALTIME

**Realtime/WebSockets en Supabase:**
- ✅ Está **habilitado por defecto** en todos los proyectos
- ✅ **NO necesita configuración especial** en la mayoría de casos
- ✅ Funciona automáticamente si las URLs están configuradas en Authentication

**El problema NO es que Realtime esté deshabilitado.**  
**El problema es que las URLs de localhost no están permitidas.**

---

## 🎯 SOLUCIÓN COMPLETA

### **Opción A: Configurar URLs en Authentication (RECOMENDADO)**

1. Ve a: **Authentication → URL Configuration**
2. Configura Site URL: `http://localhost:5173`
3. Agrega Redirect URLs (las 4 URLs mencionadas arriba)
4. Guarda
5. Espera 2 minutos
6. Reinicia servidor: `npm run dev`

### **Opción B: Verificar si Realtime está habilitado (OPCIONAL)**

Si quieres verificar que Realtime esté habilitado:

1. Ve a: **Project Settings → General**
2. Busca "Realtime" o "WebSocket"
3. Debería estar habilitado por defecto

**Nota:** Si no ves esta opción, no te preocupes. Realtime está habilitado por defecto.

---

## 📊 RESUMEN

| Dónde Estás | Dónde Necesitas Ir |
|-------------|-------------------|
| ❌ API Settings | ✅ Authentication → URL Configuration |
| ❌ Data API | ✅ Authentication → URL Configuration |
| ❌ Project Settings → General | ✅ Authentication → URL Configuration |

---

## 🚀 RUTA COMPLETA

```
Dashboard → 
  CONFIGURATION (menú izquierdo) → 
    Authentication → 
      URL Configuration
```

---

**La configuración de WebSockets NO está en API Settings. Está en Authentication.**







