# 🚀 INSTRUCCIONES DE DESPLIEGUE - Dashboard "Socio Virtual"

**Para**: Equipo LA-IA  
**Tiempo estimado**: 30-45 minutos  
**Requisitos**: Acceso a Supabase y cuenta de OpenAI

---

## 📋 ARCHIVOS CREADOS

Ya están listos en tu proyecto:

### **Backend**:
1. ✅ `supabase/migrations/20251124_01_dashboard_intelligence_functions.sql` (Funciones SQL)
2. ✅ `supabase/functions/get-snapshot/index.ts` (Cerebro del dashboard)
3. ✅ `supabase/functions/generate-flash-offer-text/index.ts` (OpenAI integration)
4. ✅ `supabase/functions/transfer-appointments/index.ts` (Transferir citas)
5. ✅ `supabase/functions/cancel-appointments-batch/index.ts` (Cancelar citas)

---

## ✅ PASO 1: OBTENER API KEY DE OPENAI (5 minutos)

### **1.1. Ir a OpenAI**
Ve a: https://platform.openai.com/api-keys

### **1.2. Crear nueva API Key**
1. Click en **"Create new secret key"**
2. Nombre: `LA-IA Dashboard`
3. Permisos: **All** (o solo "Model capabilities")
4. Click en **"Create secret key"**

### **1.3. Copiar la key**
- Se verá así: `sk-proj-...`
- ⚠️ **CÓPIALA AHORA** (solo se muestra una vez)
- Guárdala temporalmente en un lugar seguro

### **1.4. Añadir créditos (si es necesario)**
- Ve a **Billing** → **Add payment method**
- Añade tarjeta de crédito
- Añade créditos: $5 USD es suficiente (durará meses)

---

## ✅ PASO 2: CONFIGURAR API KEY EN SUPABASE (5 minutos)

### **2.1. Ir a tu proyecto Supabase**
Ve a: https://supabase.com/dashboard/project/[tu-proyecto-id]

### **2.2. Ir a Settings → Edge Functions**
1. En el menú lateral: **Settings** (⚙️)
2. Click en **Edge Functions**

### **2.3. Añadir Secret**
1. Busca la sección **"Secrets"** o **"Environment Variables"**
2. Click en **"Add new secret"**
3. Nombre: `OPENAI_API_KEY`
4. Valor: Pega tu key `sk-proj-...`
5. Click en **"Save"** o **"Add"**

### **2.4. Verificar que se guardó**
- Deberías ver: `OPENAI_API_KEY` = `sk-proj-••••••••••••` (oculta)
- ✅ Listo, la key está segura

---

## ✅ PASO 3: EJECUTAR MIGRACIÓN SQL (5 minutos)

### **3.1. Opción A: Desde Supabase Dashboard (RECOMENDADO)**

1. Ve a tu proyecto Supabase
2. En el menú lateral: **SQL Editor**
3. Click en **"New query"**
4. Abre el archivo: `supabase/migrations/20251124_01_dashboard_intelligence_functions.sql`
5. **Copia TODO el contenido** del archivo
6. **Pega** en el editor SQL de Supabase
7. Click en **"Run"** (▶️)
8. Espera a que termine (~10 segundos)
9. Deberías ver: ✅ **"Success. No rows returned"**

### **3.2. Opción B: Desde terminal (si tienes Supabase CLI)**

```bash
# Desde la raíz de tu proyecto
supabase db push
```

### **3.3. Verificar que funcionó**

Ejecuta esta query en el SQL Editor:

```sql
-- Test 1: Verificar que las funciones existen
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'detect_employee_absences_with_appointments',
  'get_high_risk_appointments',
  'get_upcoming_free_slots'
);
```

Deberías ver 3 filas (las 3 funciones).

---

## ✅ PASO 4: DESPLEGAR EDGE FUNCTIONS (10-15 minutos)

### **4.1. Verificar que tienes Supabase CLI instalado**

```bash
supabase --version
```

Si no está instalado:
```bash
npm install -g supabase
```

### **4.2. Login en Supabase CLI**

```bash
supabase login
```

Te abrirá el navegador para autenticarte.

### **4.3. Vincular tu proyecto**

```bash
# Desde la raíz de tu proyecto LA-IA
supabase link --project-ref [tu-project-ref]
```

- El `project-ref` lo encuentras en: Settings → General → Project URL
- Ejemplo: `https://[project-ref].supabase.co`

### **4.4. Desplegar las 4 Edge Functions**

```bash
# Desplegar get-snapshot (cerebro principal)
supabase functions deploy get-snapshot

# Desplegar generate-flash-offer-text (OpenAI)
supabase functions deploy generate-flash-offer-text

# Desplegar transfer-appointments
supabase functions deploy transfer-appointments

# Desplegar cancel-appointments-batch
supabase functions deploy cancel-appointments-batch
```

Cada deploy toma ~30 segundos.

### **4.5. Verificar que están desplegadas**

Ve a: **Edge Functions** en tu dashboard de Supabase

Deberías ver:
- ✅ `get-snapshot`
- ✅ `generate-flash-offer-text`
- ✅ `transfer-appointments`
- ✅ `cancel-appointments-batch`

Todas con estado **"Deployed"** 🟢

---

## ✅ PASO 5: TESTING (10 minutos)

### **5.1. Test de OpenAI Connection**

En el SQL Editor, ejecuta:

```sql
-- Crear una cita de prueba con empleado ausente
INSERT INTO employee_absences (
  id,
  business_id,
  employee_id,
  absence_type,
  start_date,
  end_date,
  reason
) VALUES (
  gen_random_uuid(),
  'tu-business-id-aqui', -- REEMPLAZA
  'tu-employee-id-aqui', -- REEMPLAZA
  'sick_leave',
  CURRENT_DATE,
  CURRENT_DATE,
  'Prueba para dashboard'
);
```

### **5.2. Test de get-snapshot**

Desde terminal o Postman:

```bash
curl -X POST 'https://[tu-project-ref].supabase.co/functions/v1/get-snapshot' \
  -H "Authorization: Bearer [tu-anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "tu-business-id-aqui",
    "timestamp": "2025-11-24T10:00:00Z"
  }'
```

Deberías recibir JSON con:
```json
{
  "scenario": "CRISIS_PERSONAL" | "RIESGO_NOSHOW" | "HUECO_MUERTO" | "PALMADA_ESPALDA",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "lua_message": "...",
  "actions": [...]
}
```

### **5.3. Test de OpenAI (generate-flash-offer-text)**

```bash
curl -X POST 'https://[tu-project-ref].supabase.co/functions/v1/generate-flash-offer-text' \
  -H "Authorization: Bearer [tu-anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "tu-business-id",
    "slot_time": "12:00",
    "service_name": "Corte de pelo",
    "discount_percent": 15,
    "vertical_type": "barbershop"
  }'
```

Deberías recibir:
```json
{
  "success": true,
  "offer_text": "¡Hueco Flash! Corte a las 12:00 con 15% dto. Solo hoy. DM para reservar 💈✂️",
  "metadata": {
    "tokens_used": 45,
    "cost_usd": 0.000033
  }
}
```

✅ **Si esto funciona, OpenAI está conectado correctamente!**

---

## ✅ PASO 6: VERIFICAR COSTOS DE OPENAI (2 minutos)

### **6.1. Ir a OpenAI Dashboard**
Ve a: https://platform.openai.com/usage

### **6.2. Verificar uso**
- Deberías ver una llamada reciente
- Modelo: `gpt-4o-mini`
- Costo: ~$0.000033 USD

### **6.3. Configurar límite de gasto (RECOMENDADO)**
1. Ve a: **Settings** → **Billing** → **Usage limits**
2. Configura: **Monthly budget = $5 USD**
3. Activa: **Email notification at 75% and 100%**

Así evitas sorpresas si algo sale mal.

---

## ✅ PASO 7: INTEGRAR CON FRONTEND (Próximo paso)

Ahora que el backend funciona, el siguiente paso es:

1. Crear componente `LuaAvatar.jsx` que llame a `get-snapshot`
2. Crear componente `LiveTurnsWidget.jsx`
3. Modificar `DashboardAgente.jsx` para integrar todo

**Esto lo hacemos en la Fase 2** (Frontend Widgets).

---

## 🔧 TROUBLESHOOTING

### **Problema 1: "OPENAI_API_KEY no está configurada"**

**Solución**:
1. Verifica que la añadiste en: Settings → Edge Functions → Secrets
2. El nombre debe ser EXACTAMENTE: `OPENAI_API_KEY` (mayúsculas)
3. Redespliega la función: `supabase functions deploy generate-flash-offer-text`

### **Problema 2: "Error 401 Unauthorized de OpenAI"**

**Solución**:
1. Verifica que tu API Key es válida
2. Ve a: https://platform.openai.com/api-keys
3. Si dice "Revoked", genera una nueva
4. Actualiza el secret en Supabase
5. Redespliega la función

### **Problema 3: "Function not found"**

**Solución**:
1. Verifica que desplegaste las funciones: `supabase functions deploy [nombre]`
2. Verifica que el nombre es correcto (con guiones, no underscores)
3. Espera 30 segundos y reintenta

### **Problema 4: "Error en migración SQL"**

**Solución**:
1. Verifica que la función `calculate_dynamic_risk_score()` ya existe
2. Si no existe, primero ejecuta la migración de no-shows: `20251123_03_noshows_risk_intelligence_FIXED.sql`
3. Luego ejecuta esta migración

---

## 📊 MÉTRICAS DE ÉXITO

Después de desplegar, verifica:

### **✅ Backend desplegado**:
- [ ] 3 funciones SQL creadas
- [ ] 4 Edge Functions desplegadas
- [ ] OpenAI API Key configurada
- [ ] Test de `get-snapshot` exitoso
- [ ] Test de `generate-flash-offer-text` exitoso

### **✅ Costos bajo control**:
- [ ] Costo de test <$0.01 USD
- [ ] Límite mensual configurado en $5 USD
- [ ] Notificaciones de email activadas

### **✅ Listo para Fase 2**:
- [ ] Backend funciona correctamente
- [ ] Puedes llamar a las funciones desde frontend
- [ ] Logs en Supabase muestran ejecuciones exitosas

---

## 🎯 PRÓXIMOS PASOS

Una vez completados estos 7 pasos, estarás listo para:

**Fase 2: Frontend Widgets** (3-4 horas)
1. Crear `LuaAvatar.jsx` con bocadillo inteligente
2. Crear `LiveTurnsWidget.jsx` con turnos en vivo
3. Crear modales de confirmación para acciones destructivas
4. Integrar todo en `DashboardAgente.jsx`

---

## 📞 AYUDA

Si encuentras algún problema:

1. **Revisa los logs** en: Supabase Dashboard → Edge Functions → Logs
2. **Busca errores** en el SQL Editor después de ejecutar queries
3. **Verifica costos** en: OpenAI Dashboard → Usage

---

**¡ÉXITO! 🚀**

Cuando completes estos 7 pasos, tendrás el backend del Dashboard "Socio Virtual" completamente funcional.

**Tiempo total**: ~40 minutos  
**Costo de testing**: ~$0.01 USD  
**Costo mensual estimado** (100 negocios): ~$1 USD

---

**Fecha**: 24 de Noviembre de 2025  
**Versión**: 1.0  
**Estado**: ✅ Listo para ejecutar

