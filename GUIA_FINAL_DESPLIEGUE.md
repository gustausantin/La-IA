# 🎯 GUÍA FINAL DE DESPLIEGUE - Dashboard "Socio Virtual"

**Estado actual**: ✅ Supabase CLI instalado correctamente (v2.58.5)

---

## 📋 CHECKLIST COMPLETO

### ✅ YA HECHO:
- ✅ Supabase CLI instalado (v2.58.5)
- ✅ Archivos de backend creados (SQL + 4 Edge Functions)

### ⏳ PENDIENTE (3 pasos - 15 minutos):
1. ⏳ Ejecutar migración SQL
2. ⏳ Configurar OpenAI API Key
3. ⏳ Login + Deploy de Edge Functions

---

## 🚀 PASO A PASO (ORDEN CORRECTO)

### **PASO 1: MIGRACIÓN SQL** (5 minutos)

1. Abre Supabase Dashboard: https://supabase.com/dashboard
2. Ve a tu proyecto
3. Click en **SQL Editor** (menú lateral)
4. Click en **"New query"**
5. Abre el archivo: `supabase/migrations/20251124_01_dashboard_intelligence_functions.sql`
6. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
7. **Pega** en el SQL Editor de Supabase
8. Click en **"Run"** ▶️
9. Deberías ver: ✅ **"Success. No rows returned"**

**Verificar**:
```sql
SELECT routine_name 
FROM information_schema.routines
WHERE routine_name IN (
  'detect_employee_absences_with_appointments',
  'get_high_risk_appointments',
  'get_upcoming_free_slots'
);
```
Debes ver **3 filas** ✅

---

### **PASO 2: CONFIGURAR OPENAI API KEY** (5 minutos)

#### **2.1. Obtener API Key de OpenAI**

1. Ve a: https://platform.openai.com/api-keys
2. Click en **"Create new secret key"**
3. Nombre: `LA-IA Dashboard`
4. Click en **"Create secret key"**
5. **Copia la key** (empieza con `sk-proj-...`)
   - ⚠️ Solo se muestra una vez

#### **2.2. Configurar en Supabase**

1. Ve a Supabase Dashboard → **Settings** → **Edge Functions**
2. Busca la sección **"Secrets"** o **"Environment Variables"**
3. Click en **"Add new secret"**
4. Nombre: `OPENAI_API_KEY`
5. Valor: Pega tu key `sk-proj-...`
6. Click en **"Save"**

**Verificar**: Deberías ver `OPENAI_API_KEY = sk-proj-••••••••••••`

---

### **PASO 3: LOGIN Y DEPLOY DE EDGE FUNCTIONS** (10 minutos)

#### **3.1. Obtener Token de Supabase**

1. Ve a: https://supabase.com/dashboard/account/tokens
2. Click en **"Generate new token"**
3. Nombre: `LA-IA CLI`
4. Click en **"Generate token"**
5. **Copia el token** (empieza con `sbp_...`)

#### **3.2. Obtener Project Ref**

1. Ve a: Supabase Dashboard → **Settings** → **General**
2. Busca **"Project URL"**
3. Copia el texto entre `https://` y `.supabase.co`
   - Ejemplo: `https://abc123xyz.supabase.co` → ref es `abc123xyz`

#### **3.3. Ejecutar Comandos**

Abre PowerShell y ejecuta (reemplaza los valores):

```powershell
# Login (reemplaza TU-TOKEN)
supabase login --token sbp_TU-TOKEN-AQUI

# Ir a la carpeta del proyecto
cd C:\Users\Usuario\Desktop\LA-IA\La-IA

# Vincular proyecto (reemplaza TU-PROJECT-REF)
supabase link --project-ref TU-PROJECT-REF-AQUI

# Desplegar las 4 Edge Functions (uno por uno)
supabase functions deploy get-snapshot

supabase functions deploy generate-flash-offer-text

supabase functions deploy transfer-appointments

supabase functions deploy cancel-appointments-batch
```

Cada deploy toma ~30 segundos.

---

## ✅ VERIFICAR QUE TODO FUNCIONÓ

### **1. Verificar Edge Functions**

Ve a Supabase Dashboard → **Edge Functions**

Deberías ver:
- ✅ `get-snapshot` (deployed)
- ✅ `generate-flash-offer-text` (deployed)
- ✅ `transfer-appointments` (deployed)
- ✅ `cancel-appointments-batch` (deployed)

### **2. Test de OpenAI**

En el SQL Editor, ejecuta:

```sql
-- Este test NO hace llamadas a OpenAI, solo verifica la estructura
SELECT 1 as test;
```

Para probar OpenAI realmente, tendrías que llamar a la Edge Function (lo haremos en el frontend).

---

## 📊 RESUMEN DE COSTOS

### **OpenAI**:
- Modelo: `gpt-4o-mini`
- Costo por oferta: ~$0.000033 USD (~€0.00003)
- 1000 ofertas = ~$0.03 USD (~€0.03)
- **Límite recomendado**: $5 USD/mes (más que suficiente)

### **Supabase**:
- Edge Functions: Gratis hasta 500k requests/mes
- Storage: Gratis hasta 1GB

**Costo total estimado**: <$1 USD/mes para 100 negocios

---

## 🎯 DESPUÉS DE ESTO

Una vez completados los 3 pasos:

### **✅ BACKEND COMPLETO** (Fase 1)
- ✅ 3 funciones SQL desplegadas
- ✅ 4 Edge Functions desplegadas
- ✅ OpenAI conectado

### **⏳ PRÓXIMA FASE: FRONTEND** (Fase 2)
1. Crear `LuaAvatar.jsx` (bocadillo inteligente)
2. Crear `LiveTurnsWidget.jsx` (turnos en vivo)
3. Crear modales de confirmación
4. Integrar en `DashboardAgente.jsx`

**Tiempo estimado Fase 2**: 3-4 horas

---

## 🚨 SI ALGO FALLA

### **Error en migración SQL**:
- Copia el error completo
- Ejecuta el script de limpieza manual de `FIX_MIGRACION_SQL.md`
- Reintenta

### **Error en deploy de Edge Functions**:
```bash
# Ver logs detallados
supabase functions deploy get-snapshot --debug
```

### **Error de OpenAI "Unauthorized"**:
- Verifica que la key empiece con `sk-proj-`
- Verifica que esté en Supabase Secrets como `OPENAI_API_KEY`
- Redespliega la función: `supabase functions deploy generate-flash-offer-text`

---

## 📞 AYUDA RÁPIDA

**¿Dónde está mi Project Ref?**
- Dashboard → Settings → General → Project URL
- Es el texto entre `https://` y `.supabase.co`

**¿Dónde está mi token de Supabase?**
- https://supabase.com/dashboard/account/tokens
- Generate new token

**¿Dónde está mi OpenAI API Key?**
- https://platform.openai.com/api-keys
- Create new secret key

---

## ✅ ESTADO FINAL

Cuando completes los 3 pasos:

```
✅ Backend Intelligence (Fase 1) - COMPLETA
   ✅ SQL Functions desplegadas
   ✅ Edge Functions desplegadas
   ✅ OpenAI conectado
   
⏳ Frontend Widgets (Fase 2) - PENDIENTE
   ⏳ LuaAvatar component
   ⏳ LiveTurnsWidget component
   ⏳ Dashboard integration
```

**Total invertido hasta ahora**: 4 horas de análisis + desarrollo backend

**Próximo paso**: Cuando confirmes que el backend funciona, empezamos con el frontend (Fase 2).

---

**Fecha**: 24 de Noviembre de 2025  
**Versión**: 1.0 Final  
**Estado**: ✅ Listo para ejecutar

¡Adelante! 🚀

