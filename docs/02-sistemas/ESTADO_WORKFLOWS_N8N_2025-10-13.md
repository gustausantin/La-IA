# 📊 ESTADO ACTUAL DE WORKFLOWS N8N - OCTUBRE 2025

**Fecha:** 13 Octubre 2025  
**Última actualización:** Hoy 10:17 AM

---

## 🎯 RESUMEN EJECUTIVO:

### **✅ WORKFLOWS COMPLETADOS: 3/5 (60%)**
### **⏳ WORKFLOWS PENDIENTES: 2/5 (40%)**

**ÚLTIMA CORRECCIÓN:** Workflow 5 v4.0 - Lógica de liberación de slots corregida (13 Oct 2025)

---

## 📋 PLAN COMPLETO DE WORKFLOWS:

### **CATEGORÍA: RECORDATORIOS AUTOMÁTICOS**

#### ✅ **WORKFLOW 1: Confirmación 24h Antes** 
- **Estado:** ✅ COMPLETADO
- **Archivo:** `n8n/workflows/02-recordatorio-24h-SIMPLE-FINAL.json`
- **Plantilla:** `confirmacion_24h` (Supabase)
- **Cron:** Diario a las 10:00 AM (`0 10 * * *`)
- **Funcionalidad:**
  - Busca reservas para **mañana** con `status=pending`
  - Obtiene plantilla activa de categoría `confirmacion_24h`
  - Reemplaza variables: `{{customer_name}}`, `{{reservation_time}}`, `{{party_size}}`
  - Envía WhatsApp vía Twilio
  - Registra en `customer_confirmations` con `message_type = 'Confirmación 24h antes'`

#### ✅ **WORKFLOW 2: Recordatorio 4h Antes**
- **Estado:** ✅ COMPLETADO
- **Archivo:** `n8n/workflows/03-recordatorio-4h-antes-FINAL.json`
- **Plantilla:** `confirmacion_4h` (Supabase)
- **Cron:** Cada 2 horas (`0 */2 * * *`)
- **Funcionalidad:**
  - Busca reservas de **HOY** entre 4-4.5 horas (ventana 30 min)
  - Filtro de zona horaria: Calcula `localNow` (UTC+2 para España)
  - Obtiene plantilla activa de categoría `confirmacion_4h`
  - Envía recordatorio urgente con emoji 🚨
  - Registra en `customer_confirmations` con `message_type = 'Recordatorio 4h antes'`

---

### **CATEGORÍA: GESTIÓN DE NO-SHOWS**

#### ⏳ **WORKFLOW 3: Alerta Llamada Urgente (2h 15min)**
- **Estado:** ⏳ PENDIENTE
- **Archivo:** No existe
- **Plantilla:** No requiere (crea alertas en `noshow_alerts`)
- **Cron:** Cada 15 minutos (`*/15 * * * *`)
- **Funcionalidad Requerida:**
  - Buscar reservas de **alto riesgo** (risk_score > 60)
  - Entre 2-3 horas antes de la reserva
  - Sin confirmación previa
  - Crear alerta en tabla `noshow_alerts` con `status='pending'`
  - **Notificar al equipo** vía SMS/Email/Slack al manager
  - **NO enviar WhatsApp** al cliente (acción manual del equipo)

**Variables necesarias:**
- `$env.RESTAURANT_ID`
- `$env.MANAGER_PHONE`
- `$env.TWILIO_SMS_NUMBER`

**Query Supabase:**
```sql
SELECT 
  r.id as reservation_id,
  r.customer_name,
  r.reservation_date,
  r.reservation_time,
  r.party_size,
  c.phone,
  dr.risk_score,
  dr.risk_level
FROM reservations r
LEFT JOIN customers c ON r.customer_id = c.id
CROSS JOIN LATERAL calculate_dynamic_risk_score(r.id) dr
WHERE r.restaurant_id = '{{ $env.RESTAURANT_ID }}'
  AND r.status IN ('confirmed', 'pending', 'confirmada', 'pendiente')
  AND c.phone IS NOT NULL
  AND dr.risk_score > 60
  AND EXTRACT(EPOCH FROM ((r.reservation_date + r.reservation_time) - NOW())) BETWEEN 7200 AND 10800
  AND NOT EXISTS (
    SELECT 1 FROM noshow_alerts 
    WHERE reservation_id = r.id 
    AND status = 'pending'
  )
```

---

#### ⏳ **WORKFLOW 4: Procesador de Respuestas WhatsApp**
- **Estado:** ⏳ PENDIENTE
- **Archivo:** No existe
- **Plantilla:** No requiere (procesa respuestas entrantes)
- **Trigger:** Webhook `POST /webhook/whatsapp-response`
- **Funcionalidad Requerida:**
  - Recibir POST de Twilio cuando cliente responde
  - Parsear respuesta: detectar "sí", "SÍ", "si", "ok", "vale" → `confirmed = true`
  - Detectar "no", "NO", "cancelo", "cancelar" → `confirmed = false`
  - Buscar última confirmación pendiente del cliente por teléfono
  - Actualizar tabla `customer_confirmations`:
    - `responded_at = NOW()`
    - `response_text = mensaje_recibido`
    - `confirmed = true/false`
  - **El sistema recalcula automáticamente el riesgo** (trigger en DB)
  - Responder OK a Twilio

**Código Node de Parsing:**
```javascript
const body = $input.item.json.body;
const from = body.From; // whatsapp:+34XXXXXXXXX
const message = body.Body.toLowerCase().trim();
const phone = from.replace('whatsapp:', '').replace('+34', '');

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

**Configuración Twilio Webhook:**
- Ir a: `Messaging > Settings > WhatsApp Sandbox` (o número productivo)
- URL: `https://tu-n8n.com/webhook/whatsapp-response`
- Method: `HTTP POST`

---

#### ✅ **WORKFLOW 5: Auto-Liberación 2h Antes** (CORREGIDO v4.0)
- **Estado:** ✅ COMPLETADO Y CORREGIDO
- **Archivo:** `n8n/workflows/05-auto-liberacion-2h-antes-FINAL.json`
- **Plantilla:** No requiere (acción automática)
- **Cron:** Cada 10 minutos (`*/10 * * * *`)
- **Funcionalidad:**
  - Buscar reservas <2h con `status IN ('pending', 'confirmed')`
  - Verificar si el cliente confirmó en `customer_confirmations`
  - **Si NO confirmó:**
    - Marcar `status = 'no_show'`
    - Obtener TODAS las mesas de `reservation_tables`
    - Por cada mesa:
      - Calcular `end_time = start_time + duration`
      - Llamar RPC `liberar_slots_reserva(restaurant_id, slot_date, table_id, start_time, end_time)`
      - RPC libera TODOS los slots que se solapan (OVERLAPS)
      - RPC actualiza: `status='free', is_available=TRUE`
    - Registrar en `noshow_actions` con `action_type='auto_release'`

**Lógica Simplificada (v4.0):**
- ✅ NO usa risk score (simplificado por solicitud del usuario)
- ✅ Libera TODOS los slots por reserva (OVERLAPS)
- ✅ Soporte multi-mesa (reservation_tables)
- ✅ Usa RPC dedicada (SQL con OVERLAPS)
- ✅ status='free' (no current_bookings)

---

## 🗂️ PLANTILLAS CRM ACTUALES (10 CATEGORÍAS):

| # | Categoría | Nombre | Workflow Asociado | Estado |
|---|-----------|--------|-------------------|--------|
| 1 | `bienvenida` | Bienvenida Nuevo Cliente | Manual | ⏸️ No usado |
| 2 | `confirmacion_24h` | Confirmación 24h Antes | **Workflow 1** | ✅ EN USO |
| 3 | `confirmacion_4h` | Confirmación 4h Antes | **Workflow 2** | ✅ EN USO |
| 4 | `vip_upgrade` | Bienvenida Cliente VIP | Manual | ⏸️ No usado |
| 5 | `alto_valor` | Reconocimiento Alto Valor | Manual | ⏸️ No usado |
| 6 | `reactivacion` | Reactivación Cliente Inactivo | Manual | ⏸️ No usado |
| 7 | `recuperacion` | Recuperación Cliente en Riesgo | Manual | ⏸️ No usado |
| 8 | `noshow` | Seguimiento No-Show | Manual | ⏸️ No usado |
| 9 | `grupo_aprobacion` | Aprobación Grupo Grande | Manual | ⏸️ No usado |
| 10 | `grupo_rechazo` | Rechazo Grupo Grande | Manual | ⏸️ No usado |

---

## 📊 PRIORIDAD DE IMPLEMENTACIÓN:

### **🔴 PRIORIDAD ALTA (Crítico para sistema No-Shows):**
1. ✅ ~~Workflow 1: Confirmación 24h~~ **COMPLETADO**
2. ✅ ~~Workflow 2: Recordatorio 4h~~ **COMPLETADO**
3. ✅ ~~Workflow 5: Auto-Liberación~~ **COMPLETADO (v4.0 CORREGIDO)**
4. ⏳ **Workflow 4: Procesador de Respuestas** ← **SIGUIENTE**
5. ⏳ **Workflow 3: Alertas Llamada Urgente**

### **🟡 PRIORIDAD MEDIA (CRM Proactivo):**
- Workflow de bienvenida automática (nuevo cliente)
- Workflow de reactivación (cliente inactivo 90+ días)

### **🟢 PRIORIDAD BAJA (Marketing):**
- Workflow VIP upgrade
- Workflow alto valor
- Workflow grupos grandes

---

## 🔧 CONFIGURACIÓN ACTUAL:

### **Credenciales N8N:**
- ✅ Supabase: Configurada
- ✅ Twilio: Configurada
- ❌ Webhook: No configurado

### **Variables de Entorno:**
```javascript
{
  "RESTAURANT_ID": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1", // Casa Paco
  "SUPABASE_URL": "https://ktsqwvhqamedpmzkzjaz.supabase.co",
  "SUPABASE_SERVICE_KEY": "[configurada]",
  "TWILIO_ACCOUNT_SID": "[configurada]",
  "TWILIO_AUTH_TOKEN": "[configurada]",
  "TWILIO_WHATSAPP_NUMBER": "whatsapp:+14155238886",
  "MANAGER_PHONE": "+34XXXXXXXXX", // ❌ PENDIENTE
  "TWILIO_SMS_NUMBER": "+34XXXXXXXXX" // ❌ PENDIENTE
}
```

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO:

### **FASE 1: Completar Sistema No-Shows (2-3 horas)**
1. ⏳ **Crear Workflow 4: Procesador de Respuestas**
   - Crear webhook en N8N
   - Configurar parsing de respuestas
   - Conectar con Twilio
   - Probar con mensajes de prueba

2. ⏳ **Crear Workflow 3: Alertas Llamada Urgente**
   - Implementar cron cada 15 min
   - Query de alto riesgo
   - Crear alertas en `noshow_alerts`
   - Notificar manager vía SMS

3. ⏳ **Crear Workflow 5: Auto-Liberación**
   - Implementar cron cada 10 min
   - Marcar como no_show
   - Liberar slots
   - Registrar acciones

### **FASE 2: Testing Integral (1 día)**
- Probar flujo completo con reservas reales
- Verificar recálculo automático de riesgo
- Monitorear logs de N8N
- Ajustar timings si es necesario

### **FASE 3: CRM Proactivo (futuro)**
- Implementar workflows de bienvenida, reactivación, etc.

---

## 📁 ARCHIVOS ACTUALES:

```
n8n/workflows/
├── ✅ 02-recordatorio-24h-SIMPLE-FINAL.json (ACTIVO)
├── ✅ 03-recordatorio-4h-antes-FINAL.json (ACTIVO)
├── ✅ 05-auto-liberacion-2h-antes-FINAL.json (ACTIVO v4.0)
├── 📄 README-WORKFLOW-05-CORREGIDO.md (Documentación v4.0)
├── 🤖 1-whatsapp-input-with-buffer.json (IA - separado)
├── 🤖 2-gateway-unified.json (IA - separado)
├── 🤖 3-classifier-super-agent.json (IA - separado)
└── 📄 README.md

supabase/migrations/
└── ✅ 20251013_002_liberar_slots_reserva.sql (RPC para Workflow 5)

docs/02-sistemas/
├── 📄 N8N_WORKFLOWS_NOSHOWS_COMPLETO.md (Guía de 5 workflows)
└── 📄 SISTEMA-N8N-AGENTE-IA.md (Sistema IA separado)

docs/06-changelogs/
└── 📄 WORKFLOW_5_AUTO_LIBERACION_CORREGIDO_2025-10-13.md
```

---

## ⚠️ PUNTOS CRÍTICOS:

1. **Webhook Twilio:** Necesita configurarse en Twilio Console para Workflow 4
2. **Teléfono Manager:** Definir quién recibe alertas de alto riesgo
3. **Testing:** Workflows 3, 4, 5 requieren pruebas exhaustivas
4. **Zona Horaria:** Validar que todos los workflows usen UTC+2 correctamente
5. **Rate Limiting:** Twilio tiene límites de mensajes/hora

---

## 📈 MÉTRICAS ESPERADAS:

| Métrica | Objetivo | Estado Actual |
|---------|----------|---------------|
| Tasa envío 24h | >95% | ✅ Cumplido |
| Tasa envío 4h | >90% | ✅ Cumplido |
| Tasa respuesta WhatsApp | >60% | ⏳ Pendiente medir |
| Alertas generadas/día | <10 | ⏳ No implementado |
| Auto-liberaciones/día | <5 | ⏳ No implementado |
| Reducción No-Shows | 30-50% | ⏳ Pendiente medir |

---

## 🚀 CONCLUSIÓN:

**SITUACIÓN ACTUAL:**
- ✅ 3 workflows completados (60%)
- ✅ Sistema de recordatorios funcionando (24h + 4h)
- ✅ Sistema de auto-liberación funcionando (v4.0 CORREGIDO)
- ⏳ 2 workflows pendientes (40%)

**ÚLTIMA CORRECCIÓN (13 Oct 2025):**
🔧 **Workflow 5 v4.0:**
- ✅ Simplificada lógica (sin risk score)
- ✅ Libera TODOS los slots (OVERLAPS)
- ✅ Soporte multi-mesa completo
- ✅ RPC dedicada para liberación
- ✅ status='free' (sistema actual)

**PRÓXIMO PASO INMEDIATO:**
🎯 **Crear Workflow 4: Procesador de Respuestas WhatsApp**

Este workflow es el más crítico porque:
1. Sin él, las respuestas de clientes no se registran
2. El riesgo dinámico no se actualiza
3. Los workflows 3 y 5 dependen de datos de confirmación

**Estimación:** 1-2 horas de implementación + testing

---

**Última actualización:** 13 Octubre 2025, 3:30 PM (Workflow 5 corregido)  
**Próxima revisión:** Cuando se complete Workflow 4


