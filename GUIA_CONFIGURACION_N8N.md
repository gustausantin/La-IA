# 🚀 GUÍA COMPLETA: Configuración N8N para No-Shows

**Fecha**: 2025-11-23  
**Tiempo estimado**: 30-45 minutos

---

## 📋 PRE-REQUISITOS

Antes de empezar, necesitas tener:

- ✅ Migraciones SQL ejecutadas en Supabase
- ✅ Cuenta de Twilio con WhatsApp Business API habilitado
- ✅ Instancia de N8N (cloud o self-hosted)
- ✅ Cuenta de email (Gmail, SendGrid, etc.) para alertas

---

## 🔧 PASO 1: CONFIGURAR CREDENCIALES EN N8N

### 1.1 Supabase API

1. En N8N, ve a **Settings** → **Credentials**
2. Click **Add Credential** → Busca **Supabase**
3. Llena los datos:
   - **Name**: `Supabase LA-IA`
   - **Host**: `https://zrcsujgurtglyqoqiynr.supabase.co` (tu project URL)
   - **Service Role Key**: `eyJhbGc...` (cópialo de Supabase → Settings → API → service_role key)

4. Click **Save**

### 1.2 Twilio (HTTP Basic Auth)

1. En N8N, ve a **Settings** → **Credentials**
2. Click **Add Credential** → Busca **HTTP Basic Auth**
3. Llena los datos:
   - **Name**: `Twilio Auth`
   - **Username**: Tu Twilio Account SID (ej: `AC1234567890abcdef...`)
   - **Password**: Tu Twilio Auth Token (desde Twilio Console)

4. Click **Save**

**Obtener credenciales Twilio**:
- Ve a [https://console.twilio.com](https://console.twilio.com)
- En el Dashboard verás:
  - **Account SID**: Empieza con `AC...`
  - **Auth Token**: Click en "Show" para verlo

### 1.3 Email (SMTP)

1. En N8N, ve a **Settings** → **Credentials**
2. Click **Add Credential** → Busca **SMTP**
3. Para Gmail:
   - **Name**: `Gmail SMTP`
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **User**: `tu-email@gmail.com`
   - **Password**: [App Password de Gmail](https://myaccount.google.com/apppasswords)
   - **Secure**: No

4. Click **Test Connection** → Debe decir "Success"
5. Click **Save**

---

## 🌍 PASO 2: CONFIGURAR VARIABLES DE ENTORNO

En N8N, ve a **Settings** → **Environments** y añade:

```bash
# Supabase
BUSINESS_ID=3bbe9ac3-3e61-471e-822e-e159f6ad8ae2  # Tu business_id

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886  # Tu número de WhatsApp Business

# Negocio
BUSINESS_PHONE=+34600000000  # Teléfono de tu negocio
BUSINESS_EMAIL=hola@tunegocio.com
STAFF_EMAIL=staff@tunegocio.com  # Email para recibir alertas
APP_URL=https://la-ia.com  # URL de tu app LA-IA
```

**¿Cómo obtener tu `BUSINESS_ID`?**
```sql
-- Ejecutar en Supabase SQL Editor:
SELECT id, name FROM businesses WHERE owner_id = auth.uid();
```

---

## 📥 PASO 3: IMPORTAR WORKFLOWS

### Opción A: Importar archivos JSON (Recomendado)

1. En N8N, ve a **Workflows** → Click **Import from File**
2. Selecciona cada archivo JSON en este orden:
   - `n8n/workflows/1_recordatorio_24h.json`
   - `n8n/workflows/2_recordatorio_4h.json`
   - `n8n/workflows/3_alertas_2h_inteligente.json`
   - `n8n/workflows/4_webhook_respuestas_whatsapp.json`

3. Para cada workflow:
   - Click **Import**
   - Verifica que todas las credenciales estén asignadas (iconos verdes)
   - Click **Save**
   - Click **Activate** (toggle en la esquina superior derecha)

### Opción B: Crear manualmente

Si prefieres crear desde cero, sigue la documentación completa en:
`docs/03-workflows/N8N_WORKFLOW_NOSHOWS_V2_CORREGIDO.md`

---

## 🔗 PASO 4: CONFIGURAR WEBHOOK DE TWILIO

### 4.1 Obtener URL del Webhook

1. En N8N, abre el workflow **"No-Shows: Webhook Respuestas WhatsApp"**
2. Click en el nodo **"Webhook: Twilio Incoming"**
3. Copia la **Production URL** (ej: `https://tu-n8n.com/webhook/whatsapp-response`)

### 4.2 Configurar en Twilio

1. Ve a [Twilio Console → WhatsApp → Sandbox](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox)
2. En **"When a message comes in"**:
   - Pega la URL del webhook de N8N
   - Method: **POST**
3. Click **Save**

**⚠️ IMPORTANTE**: Si usas WhatsApp Business (no sandbox), configura el webhook en:
- Twilio Console → Messaging → Services → [Tu servicio] → Integration → Inbound Webhooks

---

## ✅ PASO 5: TESTING

### Test 1: Verificar que los workflows están activos

En N8N, ve a **Workflows**:
- ✅ **No-Shows: Recordatorio 24h** → Verde (activo)
- ✅ **No-Shows: Recordatorio 4h** → Verde (activo)
- ✅ **No-Shows: Alertas 2h (Inteligente)** → Verde (activo)
- ✅ **No-Shows: Webhook Respuestas WhatsApp** → Verde (activo)

### Test 2: Crear appointment de prueba

```sql
-- En Supabase SQL Editor:
INSERT INTO appointments (
    business_id,
    customer_id,
    customer_name,
    customer_phone,
    appointment_date,
    appointment_time,
    service_id,
    duration_minutes,
    status
) VALUES (
    '{{TU-BUSINESS-ID}}'::UUID,
    (SELECT id FROM customers WHERE phone = '+34600000000' LIMIT 1), -- Tu teléfono
    'Test Cliente',
    '+34600000000', -- Tu teléfono
    CURRENT_DATE + INTERVAL '1 day', -- Mañana
    (CURRENT_TIME + INTERVAL '15 minutes')::TIME, -- En 24h (aprox)
    (SELECT id FROM services LIMIT 1),
    60,
    'pending'
);
```

### Test 3: Esperar mensaje 24h

**Esperado**:
- Dentro de 15 minutos, deberías recibir un WhatsApp:
  ```
  Hola Test Cliente! 👋

  Recordatorio de tu cita mañana:
  📅 [fecha]
  🕐 [hora]
  ✂️ [servicio]

  ¿Confirmas tu asistencia? Responde SÍ para confirmar.
  ```

### Test 4: Responder "Sí"

**Escribe en WhatsApp**: `Sí, confirmo`

**Esperado**:
- Deberías recibir:
  ```
  ✅ ¡Perfecto, Test Cliente!

  Tu cita está confirmada:
  📅 [fecha]
  🕐 [hora]

  ¡Te esperamos! 😊
  ```

- En Supabase, verifica:
  ```sql
  SELECT * FROM customer_confirmations 
  WHERE appointment_id = (SELECT id FROM appointments WHERE customer_name = 'Test Cliente');
  ```
  
  Debería tener `confirmed = true`

### Test 5: Verificar triggers

```sql
-- Cambiar appointment a no_show
UPDATE appointments
SET status = 'no_show'
WHERE customer_name = 'Test Cliente';

-- Verificar que los slots se liberaron automáticamente
SELECT * FROM availability_slots
WHERE slot_date = (SELECT appointment_date FROM appointments WHERE customer_name = 'Test Cliente')
AND start_time = (SELECT appointment_time FROM appointments WHERE customer_name = 'Test Cliente');

-- Esperado: status = 'free', is_available = true
```

---

## 🐛 TROUBLESHOOTING

### Problema 1: No recibo mensajes de WhatsApp

**Solución**:
1. Verifica que el workflow esté **activo** (toggle verde)
2. Ve a N8N → Workflow → **Executions**
3. Click en la última ejecución → Revisa los errores
4. Verifica que `BUSINESS_ID` en variables de entorno sea correcto:
   ```sql
   SELECT id, name FROM businesses;
   ```

### Problema 2: Error "Credentials not found"

**Solución**:
1. Ve a cada nodo del workflow
2. En **Credentials**, selecciona la credencial correcta del dropdown
3. Si no aparece, créala en **Settings** → **Credentials**

### Problema 3: Error de Twilio "Invalid Number"

**Solución**:
- El número debe incluir código de país: `+34600000000`
- Si usas Sandbox, solo funcionan números verificados en Twilio Console

### Problema 4: No se ejecutan los workflows automáticamente

**Solución**:
1. Verifica que N8N esté en **production mode** (no development)
2. Los workflows deben estar **activos** (toggle verde)
3. Revisa logs de N8N: `docker logs n8n` (si usas Docker)

### Problema 5: Error SQL "column does not exist"

**Solución**:
- Verifica que las migraciones se ejecutaron correctamente:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'customer_confirmations';
  ```
- Si falta alguna columna, re-ejecuta las migraciones

---

## 📊 MONITORIZACIÓN

### Dashboard N8N

1. Ve a **Workflows**
2. Click en cada workflow → **Executions**
3. Verás:
   - ✅ Ejecuciones exitosas (verde)
   - ❌ Ejecuciones fallidas (rojo)
   - ⏸️ Ejecuciones en espera (amarillo)

### Métricas en Supabase

```sql
-- KPIs del último mes
SELECT * FROM get_noshow_stats(
    '{{TU-BUSINESS-ID}}'::UUID,
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE
);
```

**Output esperado**:
```json
{
  "total_appointments": 120,
  "total_noshows": 6,
  "noshow_rate": 5.0,  // ✅ < 10% = BIEN
  "total_confirmations_sent": 120,
  "confirmations_responded": 95,
  "confirmation_response_rate": 79.2,  // ✅ > 70% = BIEN
  "prevented_noshows": 8,
  "avg_risk_score": 28.5
}
```

---

## 🎯 CHECKLIST FINAL

- [ ] Credenciales de Supabase configuradas en N8N
- [ ] Credenciales de Twilio configuradas en N8N
- [ ] Credenciales de Email configuradas en N8N
- [ ] Variables de entorno configuradas (BUSINESS_ID, TWILIO_*, etc.)
- [ ] 4 workflows importados y activos (toggle verde)
- [ ] Webhook de Twilio configurado con URL de N8N
- [ ] Test 1: Appointment de prueba creado
- [ ] Test 2: Mensaje 24h recibido
- [ ] Test 3: Respuesta "Sí" procesada correctamente
- [ ] Test 4: Trigger auto_release_slots funciona
- [ ] Monitorización de ejecuciones activada

---

## 📞 SOPORTE

**Logs de N8N**:
```bash
# Si usas Docker:
docker logs n8n --tail 100 -f

# Si usas npm:
cd n8n
npm run start -- --tunnel
```

**Logs de Supabase**:
- Ve a Supabase Dashboard → Logs → Postgres logs

**Documentación completa**:
- [Análisis del sistema](./ANALISIS_WORKFLOW_N8N_NOSHOWS.md)
- [Workflows detallados](./docs/03-workflows/N8N_WORKFLOW_NOSHOWS_V2_CORREGIDO.md)
- [Resumen ejecutivo](./IMPLEMENTACION_NOSHOWS_RESUMEN.md)

---

**Autor**: LA-IA Development Team  
**Versión**: 1.0  
**Última actualización**: 2025-11-23

---

## 🎉 ¡LISTO!

Tu sistema de no-shows está configurado. Ahora:
1. Monitoriza las primeras ejecuciones en N8N → Executions
2. Verifica que los clientes reciban mensajes
3. Revisa las métricas semanalmente
4. Ajusta los textos de los mensajes según feedback

**Impacto esperado**:
- 📉 No-shows: -50% en el primer mes
- 💰 Ingresos: +300€/mes
- ⏱️ Tiempo: -2h/semana del staff

