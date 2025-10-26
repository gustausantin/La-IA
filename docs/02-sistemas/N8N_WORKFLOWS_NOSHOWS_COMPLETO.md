# 📱 N8N - Workflows Completos para Sistema No-Shows Dinámico

## 🎯 RESUMEN EJECUTIVO

Este documento contiene los **5 workflows de N8n** necesarios para automatizar el sistema de prevención de no-shows con **riesgo dinámico**. Cada workflow se conecta con Supabase para registrar confirmaciones y actualizar el riesgo en tiempo real.

---

## 📋 ÍNDICE DE WORKFLOWS

1. **[Workflow 1]** Confirmación 24h Antes (Automático)
2. **[Workflow 2]** Recordatorio 4h Antes (Automático)
3. **[Workflow 3]** Llamada Urgente 2h 15min (Alerta Manual)
4. **[Workflow 4]** Procesador de Respuestas WhatsApp (Webhook)
5. **[Workflow 5]** Auto-Liberación 2h Antes (Cron Job)

---

## 🔧 CONFIGURACIÓN PREVIA

### **1. Credenciales necesarias en N8n:**
- **Supabase:** URL + Service Role Key
- **Twilio/WhatsApp Business API:** Account SID + Auth Token + WhatsApp Number
- **HTTP Webhook:** Para recibir respuestas de WhatsApp

### **2. Variables globales en N8n:**
```javascript
{
  "SUPABASE_URL": "https://tu-proyecto.supabase.co",
  "SUPABASE_SERVICE_KEY": "tu-service-role-key",
  "TWILIO_ACCOUNT_SID": "ACxxxxxxxxxx",
  "TWILIO_AUTH_TOKEN": "tu-auth-token",
  "TWILIO_WHATSAPP_NUMBER": "whatsapp:+34123456789",
  "WEBHOOK_URL": "https://tu-n8n.com/webhook/whatsapp-response"
}
```

---

## 📱 WORKFLOW 1: CONFIRMACIÓN 24 HORAS ANTES

### **Descripción:**
Envía WhatsApp automático 24h antes de cada reserva para solicitar confirmación.

### **Trigger:**
Cron Job: `0 10 * * *` (todos los días a las 10:00 AM)

### **Flujo:**

```
[CRON] → [SUPABASE: Get Reservations] → [FOR EACH] → [SEND WhatsApp] → [RECORD Confirmation]
```

### **Código completo:**

#### **Node 1: Cron Trigger**
```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 10 * * *"
        }
      ]
    }
  },
  "name": "Every day at 10 AM",
  "type": "n8n-nodes-base.cron"
}
```

#### **Node 2: Supabase - Get Reservations Tomorrow**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT r.id as reservation_id, r.customer_name, r.reservation_date, r.reservation_time, r.party_size, c.phone FROM reservations r LEFT JOIN customers c ON r.customer_id = c.id WHERE r.restaurant_id = '{{ $env.RESTAURANT_ID }}' AND r.reservation_date = CURRENT_DATE + INTERVAL '1 day' AND r.status IN ('confirmed', 'pending', 'confirmada', 'pendiente') AND c.phone IS NOT NULL"
  },
  "name": "Get Reservations Tomorrow",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 3: Loop Over Items**
```json
{
  "parameters": {},
  "name": "Loop Over Reservations",
  "type": "n8n-nodes-base.splitInBatches"
}
```

#### **Node 4: Twilio - Send WhatsApp**
```json
{
  "parameters": {
    "resource": "sms",
    "operation": "send",
    "from": "{{ $env.TWILIO_WHATSAPP_NUMBER }}",
    "to": "whatsapp:+34{{ $json.phone }}",
    "message": "Hola {{ $json.customer_name }}! 👋\n\nTe esperamos mañana {{ $json.reservation_date }} a las {{ $json.reservation_time }} para {{ $json.party_size }} personas.\n\n¿Confirmas tu asistencia?\n\n✅ Responde SÍ para confirmar\n❌ Responde NO para cancelar\n\n¡Gracias! 😊"
  },
  "name": "Send WhatsApp Confirmation",
  "type": "n8n-nodes-base.twilio"
}
```

#### **Node 5: Supabase - Record Confirmation Sent**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT record_customer_confirmation('{{ $json.reservation_id }}', 'Confirmación 24h antes', 'whatsapp', 'Hola {{ $json.customer_name }}! Te esperamos mañana {{ $json.reservation_date }} a las {{ $json.reservation_time }} para {{ $json.party_size }} personas. ¿Confirmas tu asistencia? ✅ SÍ / ❌ NO')"
  },
  "name": "Record Confirmation Sent",
  "type": "n8n-nodes-base.supabase"
}
```

---

## ⏰ WORKFLOW 2: RECORDATORIO 4 HORAS ANTES

### **Descripción:**
Envía recordatorio 4h antes de la reserva (solo si no ha confirmado o confirmó pero necesita recordatorio).

### **Trigger:**
Cron Job: `*/30 * * * *` (cada 30 minutos)

### **Flujo:**

```
[CRON] → [SUPABASE: Get Reservations in 4h] → [FOR EACH] → [SEND WhatsApp] → [RECORD Confirmation]
```

### **Código completo:**

#### **Node 1: Cron Trigger**
```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "*/30 * * * *"
        }
      ]
    }
  },
  "name": "Every 30 minutes",
  "type": "n8n-nodes-base.cron"
}
```

#### **Node 2: Supabase - Get Reservations in 4-5 Hours**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT r.id as reservation_id, r.customer_name, r.reservation_date, r.reservation_time, r.party_size, c.phone, EXTRACT(EPOCH FROM ((r.reservation_date + r.reservation_time) - NOW())) / 3600 as hours_until FROM reservations r LEFT JOIN customers c ON r.customer_id = c.id WHERE r.restaurant_id = '{{ $env.RESTAURANT_ID }}' AND r.status IN ('confirmed', 'pending', 'confirmada', 'pendiente') AND c.phone IS NOT NULL AND EXTRACT(EPOCH FROM ((r.reservation_date + r.reservation_time) - NOW())) BETWEEN 14400 AND 18000 AND NOT EXISTS (SELECT 1 FROM customer_confirmations WHERE reservation_id = r.id AND message_type = 'Recordatorio 4h antes')"
  },
  "name": "Get Reservations in 4h",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 3: Loop Over Items**
```json
{
  "parameters": {},
  "name": "Loop Over Reservations",
  "type": "n8n-nodes-base.splitInBatches"
}
```

#### **Node 4: Twilio - Send WhatsApp Reminder**
```json
{
  "parameters": {
    "resource": "sms",
    "operation": "send",
    "from": "{{ $env.TWILIO_WHATSAPP_NUMBER }}",
    "to": "whatsapp:+34{{ $json.phone }}",
    "message": "Hola {{ $json.customer_name }}! ⏰\n\nTe esperamos en 4 horas ({{ $json.reservation_time }}) para {{ $json.party_size }} personas.\n\n¿Todo sigue en pie?\n\n✅ SÍ\n❌ NO\n\n¡Nos vemos pronto! 😊"
  },
  "name": "Send WhatsApp Reminder",
  "type": "n8n-nodes-base.twilio"
}
```

#### **Node 5: Supabase - Record Reminder Sent**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT record_customer_confirmation('{{ $json.reservation_id }}', 'Recordatorio 4h antes', 'whatsapp', 'Te esperamos en 4 horas ({{ $json.reservation_time }}) para {{ $json.party_size }} personas. ¿Todo sigue en pie? ✅ SÍ / ❌ NO')"
  },
  "name": "Record Reminder Sent",
  "type": "n8n-nodes-base.supabase"
}
```

---

## 📞 WORKFLOW 3: ALERTA LLAMADA URGENTE (2H 15MIN)

### **Descripción:**
Crea alertas en `noshow_alerts` para que el equipo llame manualmente a reservas de alto riesgo.

### **Trigger:**
Cron Job: `*/15 * * * *` (cada 15 minutos)

### **Flujo:**

```
[CRON] → [SUPABASE: Get High Risk] → [FOR EACH] → [CREATE Alert] → [NOTIFY Staff]
```

### **Código completo:**

#### **Node 1: Cron Trigger**
```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "*/15 * * * *"
        }
      ]
    }
  },
  "name": "Every 15 minutes",
  "type": "n8n-nodes-base.cron"
}
```

#### **Node 2: Supabase - Get High Risk in 2-3 Hours**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT r.id as reservation_id, r.customer_name, r.reservation_date, r.reservation_time, r.party_size, c.phone, dr.risk_score, dr.risk_level FROM reservations r LEFT JOIN customers c ON r.customer_id = c.id CROSS JOIN LATERAL calculate_dynamic_risk_score(r.id) dr WHERE r.restaurant_id = '{{ $env.RESTAURANT_ID }}' AND r.status IN ('confirmed', 'pending', 'confirmada', 'pendiente') AND c.phone IS NOT NULL AND dr.risk_score > 60 AND EXTRACT(EPOCH FROM ((r.reservation_date + r.reservation_time) - NOW())) BETWEEN 7200 AND 10800 AND NOT EXISTS (SELECT 1 FROM noshow_alerts WHERE reservation_id = r.id AND status = 'pending')"
  },
  "name": "Get High Risk Reservations",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 3: Loop Over Items**
```json
{
  "parameters": {},
  "name": "Loop Over High Risk",
  "type": "n8n-nodes-base.splitInBatches"
}
```

#### **Node 4: Supabase - Create Alert**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT create_noshow_alert('{{ $json.reservation_id }}', {{ $json.risk_score }}, 'call', 'Llamada urgente recomendada - Riesgo alto sin confirmar')"
  },
  "name": "Create NoShow Alert",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 5: Send Notification (Email/Slack/SMS)**
```json
{
  "parameters": {
    "resource": "sms",
    "operation": "send",
    "from": "{{ $env.TWILIO_SMS_NUMBER }}",
    "to": "+34{{ $env.MANAGER_PHONE }}",
    "message": "🔴 ALERTA NO-SHOW\n\nReserva: {{ $json.customer_name }}\nHora: {{ $json.reservation_time }}\nPersonas: {{ $json.party_size }}\nRiesgo: {{ $json.risk_score }} pts\n\n¡LLAMAR AHORA!"
  },
  "name": "Notify Manager",
  "type": "n8n-nodes-base.twilio"
}
```

---

## 🔄 WORKFLOW 4: PROCESADOR DE RESPUESTAS WHATSAPP

### **Descripción:**
Webhook que recibe respuestas de WhatsApp y actualiza el sistema dinámicamente.

### **Trigger:**
Webhook: `POST /webhook/whatsapp-response`

### **Flujo:**

```
[WEBHOOK] → [PARSE Response] → [FIND Confirmation] → [UPDATE Response] → [RETURN OK]
```

### **Código completo:**

#### **Node 1: Webhook Trigger**
```json
{
  "parameters": {
    "path": "whatsapp-response",
    "method": "POST",
    "responseMode": "onReceived"
  },
  "name": "WhatsApp Webhook",
  "type": "n8n-nodes-base.webhook"
}
```

#### **Node 2: Function - Parse Twilio Webhook**
```javascript
// Node: Parse Twilio Data
const body = $input.item.json.body;

// Extract data from Twilio webhook
const from = body.From; // whatsapp:+34XXXXXXXXX
const message = body.Body.toLowerCase().trim();
const phone = from.replace('whatsapp:', '').replace('+34', '');

// Determine if confirmed
let confirmed = false;
if (message.includes('si') || message.includes('sí') || message.includes('confirmo') || message.includes('ok') || message.includes('vale')) {
  confirmed = true;
} else if (message.includes('no') || message.includes('cancelo') || message.includes('cancelar')) {
  confirmed = false;
}

return {
  phone: phone,
  message: body.Body,
  confirmed: confirmed,
  timestamp: new Date().toISOString()
};
```

#### **Node 3: Supabase - Find Latest Confirmation**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT cc.id FROM customer_confirmations cc LEFT JOIN customers c ON cc.customer_id = c.id WHERE c.phone = '{{ $json.phone }}' AND cc.responded_at IS NULL ORDER BY cc.sent_at DESC LIMIT 1"
  },
  "name": "Find Pending Confirmation",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 4: IF - Confirmation Found**
```json
{
  "parameters": {
    "conditions": {
      "boolean": [
        {
          "value1": "={{ $json.id }}",
          "value2": ""
        }
      ]
    }
  },
  "name": "Has Confirmation?",
  "type": "n8n-nodes-base.if"
}
```

#### **Node 5: Supabase - Update Response**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT update_confirmation_response('{{ $('Find Pending Confirmation').item.json.id }}', '{{ $('Parse Twilio Data').item.json.message }}', {{ $('Parse Twilio Data').item.json.confirmed }})"
  },
  "name": "Update Confirmation Response",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 6: Respond to Webhook**
```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ { \"success\": true, \"message\": \"Response recorded\" } }}"
  },
  "name": "Respond OK",
  "type": "n8n-nodes-base.respondToWebhook"
}
```

---

## 🔓 WORKFLOW 5: AUTO-LIBERACIÓN 2 HORAS ANTES

### **Descripción:**
Marca como no-show y libera slot de reservas sin confirmar a 2h del evento.

### **Trigger:**
Cron Job: `*/10 * * * *` (cada 10 minutos)

### **Flujo:**

```
[CRON] → [SUPABASE: Get Unconfirmed in 2h] → [FOR EACH] → [MARK NoShow] → [RELEASE Slot] → [RECORD Action]
```

### **Código completo:**

#### **Node 1: Cron Trigger**
```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "*/10 * * * *"
        }
      ]
    }
  },
  "name": "Every 10 minutes",
  "type": "n8n-nodes-base.cron"
}
```

#### **Node 2: Supabase - Get Unconfirmed in 2h**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT r.id as reservation_id, r.customer_name, r.reservation_date, r.reservation_time, r.party_size, dr.risk_score FROM reservations r CROSS JOIN LATERAL calculate_dynamic_risk_score(r.id) dr WHERE r.restaurant_id = '{{ $env.RESTAURANT_ID }}' AND r.status IN ('confirmed', 'pending', 'confirmada', 'pendiente') AND dr.risk_score > 60 AND EXTRACT(EPOCH FROM ((r.reservation_date + r.reservation_time) - NOW())) BETWEEN 0 AND 7200 AND NOT EXISTS (SELECT 1 FROM customer_confirmations WHERE reservation_id = r.id AND confirmed = TRUE)"
  },
  "name": "Get Unconfirmed Reservations",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 3: Loop Over Items**
```json
{
  "parameters": {},
  "name": "Loop Over Unconfirmed",
  "type": "n8n-nodes-base.splitInBatches"
}
```

#### **Node 4: Supabase - Mark as NoShow**
```json
{
  "parameters": {
    "operation": "update",
    "table": "reservations",
    "updateKey": "id",
    "updateKeyValue": "={{ $json.reservation_id }}",
    "fieldsToUpdate": [
      {
        "field": "status",
        "value": "noshow"
      }
    ]
  },
  "name": "Mark as NoShow",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 5: Supabase - Release Slot**
```json
{
  "parameters": {
    "operation": "executeQuery",
    "query": "UPDATE availability_slots SET current_bookings = current_bookings - {{ $json.party_size }} WHERE restaurant_id = '{{ $env.RESTAURANT_ID }}' AND date = '{{ $json.reservation_date }}' AND time_slot = '{{ $json.reservation_time }}'"
  },
  "name": "Release Slot",
  "type": "n8n-nodes-base.supabase"
}
```

#### **Node 6: Supabase - Record Action**
```json
{
  "parameters": {
    "operation": "insert",
    "table": "noshow_actions",
    "fieldsToSend": "defineFields",
    "fields": [
      {
        "fieldName": "restaurant_id",
        "fieldValue": "={{ $env.RESTAURANT_ID }}"
      },
      {
        "fieldName": "reservation_id",
        "fieldValue": "={{ $json.reservation_id }}"
      },
      {
        "fieldName": "customer_name",
        "fieldValue": "={{ $json.customer_name }}"
      },
      {
        "fieldName": "action_type",
        "fieldValue": "auto_release"
      },
      {
        "fieldName": "action_date",
        "fieldValue": "={{ $now.toISODate() }}"
      },
      {
        "fieldName": "outcome",
        "fieldValue": "occurred"
      },
      {
        "fieldName": "notes",
        "fieldValue": "Auto-liberado por sistema - No confirmó (Score: {{ $json.risk_score }})"
      }
    ]
  },
  "name": "Record NoShow Action",
  "type": "n8n-nodes-base.supabase"
}
```

---

## 📊 TESTING Y VALIDACIÓN

### **Checklist de prueba para cada workflow:**

#### **Workflow 1 (24h):**
- [ ] Cron se ejecuta a las 10:00 AM
- [ ] Obtiene reservas del día siguiente
- [ ] Envía WhatsApp a cada cliente
- [ ] Registra en `customer_confirmations`
- [ ] No envía duplicados

#### **Workflow 2 (4h):**
- [ ] Cron se ejecuta cada 30 minutos
- [ ] Detecta reservas en ventana 4-5 horas
- [ ] No envía si ya se envió antes
- [ ] Registra correctamente

#### **Workflow 3 (2h 15min):**
- [ ] Detecta solo score > 60
- [ ] Crea alerta en `noshow_alerts`
- [ ] Notifica al equipo
- [ ] No duplica alertas

#### **Workflow 4 (Respuestas):**
- [ ] Webhook recibe POST de Twilio
- [ ] Parsea respuesta correctamente
- [ ] Detecta "sí", "no", variantes
- [ ] Actualiza `customer_confirmations`
- [ ] Recalcula riesgo automáticamente

#### **Workflow 5 (Auto-liberación):**
- [ ] Detecta solo reservas < 2h sin confirmar
- [ ] Marca status = 'noshow'
- [ ] Libera slot correctamente
- [ ] Registra acción

---

## 🔐 SEGURIDAD

### **Recomendaciones:**

1. **Webhook de WhatsApp:**
   - Validar firma de Twilio: `X-Twilio-Signature`
   - Usar HTTPS obligatorio
   - Rate limiting

2. **Credenciales:**
   - Usar variables de entorno
   - Nunca hardcodear keys
   - Rotar periódicamente

3. **Supabase:**
   - Service Role Key solo en backend
   - RLS habilitado en todas las tablas
   - Auditoría de queries

---

## 📈 MONITORIZACIÓN

### **KPIs a trackear en N8n:**

| Métrica | Objetivo |
|---------|----------|
| Tasa envío 24h | >95% |
| Tasa envío 4h | >90% |
| Tasa respuesta WhatsApp | >60% |
| Tiempo respuesta medio | <2 horas |
| Alertas generadas/día | <10 |
| Auto-liberaciones/día | <5 |

---

## 🚀 DESPLIEGUE

### **Orden de implementación:**

1. ✅ Crear credenciales en N8n (Supabase + Twilio)
2. ✅ Importar Workflow 4 (Webhook) primero
3. ✅ Configurar webhook en Twilio Console
4. ✅ Probar recepción de respuestas
5. ✅ Importar Workflows 1 y 2 (envíos automáticos)
6. ✅ Probar con reservas de prueba
7. ✅ Importar Workflow 3 (alertas)
8. ✅ Importar Workflow 5 (auto-liberación)
9. ✅ Activar todos los workflows
10. ✅ Monitorizar durante 7 días

---

## 📞 CONFIGURACIÓN TWILIO WEBHOOK

### **En Twilio Console:**

1. Ir a: `Messaging > Settings > WhatsApp Sandbox` (o tu número productivo)
2. En "When a message comes in":
   - URL: `https://tu-n8n.com/webhook/whatsapp-response`
   - Method: `HTTP POST`
3. Guardar

---

## 🎉 RESULTADO FINAL

Con estos 5 workflows configurados, tendrás:

- ✅ **Sistema 100% automatizado** de prevención de no-shows
- ✅ **Riesgo dinámico** que se ajusta en tiempo real
- ✅ **0 intervención manual** para bajo/medio riesgo
- ✅ **Alertas inteligentes** solo para alto riesgo
- ✅ **Auto-liberación** de slots sin confirmar
- ✅ **Tracking completo** de todas las acciones

---

**📅 Fecha:** 09 Octubre 2025  
**👤 Autor:** Sistema La-IA App  
**📍 Versión:** 2.0 (Dinámico)  
**✅ Estado:** Listo para producción

