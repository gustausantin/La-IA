# 📋 N8N WORKFLOWS - LA-IA APP

**Última actualización:** 22 Octubre 2025  
**Estado:** 🟢 LIMPIEZA COMPLETA - SOLO VERSIONES FINALES

---

## 📁 WORKFLOWS ACTIVOS:

### **🤖 SISTEMA DE IA Y AGENTE:**

#### **1. `1-whatsapp-buffer-UNIFICADO-FINAL.json`**
- **Función:** Buffer de mensajes WhatsApp con gestión de audio
- **Descripción:** Recibe mensajes WhatsApp, gestiona buffer temporal y procesa audio con Whisper
- **Trigger:** Webhook WhatsApp
- **Estado:** ✅ ACTIVO

#### **2. `2-GATEWAY-FINAL-IMPORTAR.json`**
- **Función:** Gateway unificado de entrada
- **Descripción:** Punto de entrada unificado para todos los canales de comunicación
- **Trigger:** Múltiples fuentes (WhatsApp, Web, etc.)
- **Estado:** ✅ ACTIVO

#### **3. `3-super-agent-hibrido-FINAL-CORREGIDO.json`**
- **Función:** Agente de IA híbrido inteligente
- **Descripción:** Usa IA para clasificar, enrutar y responder mensajes de forma controlada
- **Trigger:** Desde gateway
- **Estado:** ✅ ACTIVO

#### **4. `04-post-conversation-analyzer.json`**
- **Función:** Análisis post-conversación
- **Descripción:** Analiza conversaciones terminadas para extraer insights y sentimiento
- **Trigger:** Automático tras finalizar conversación
- **Estado:** ✅ ACTIVO

---

### **🔧 TOOLS DEL AGENTE:**

#### **T1. `01-check-availability-OPTIMIZADO.json`**
- **Función:** Verificar disponibilidad de mesas
- **Descripción:** Consulta slots disponibles con soporte para zonas y combinaciones de mesas
- **Trigger:** Llamada desde Super Agent
- **Estado:** ✅ ACTIVO

#### **T2. `TOOL-create-reservation-COMPLETO.json`**
- **Función:** Crear nueva reserva
- **Descripción:** Crea reserva, asigna mesa y marca slots como reservados. NO crea clientes (vienen del Gateway)
- **Trigger:** Llamada desde Super Agent
- **Estado:** ✅ ACTIVO
- **Documentación:** Ver `README-TOOL-CREATE-RESERVATION-v2.md`

#### **T3. `TOOL-modify-reservation-COMPLETO.json`**
- **Función:** Modificar reserva existente
- **Descripción:** Actualiza fecha, hora, número de personas o mesa de una reserva
- **Trigger:** Llamada desde Super Agent
- **Estado:** ✅ ACTIVO

#### **T4. `TOOL-cancel-reservation.json`**
- **Función:** Cancelar reserva
- **Descripción:** Marca reserva como cancelada y libera los slots asociados
- **Trigger:** Llamada desde Super Agent
- **Estado:** ✅ ACTIVO

#### **T5. `07-rag-search-tool-FINAL.json`**
- **Función:** Búsqueda RAG en base de conocimiento
- **Descripción:** Busca información relevante en la base de conocimiento del restaurante
- **Trigger:** Llamada desde Super Agent
- **Estado:** ✅ ACTIVO

---

### **📱 SISTEMA DE RECORDATORIOS Y CRM:**

#### **4. `02-recordatorio-24h-SIMPLE-FINAL.json`**
- **Función:** Recordatorio 24h antes de reserva
- **Cron:** Diario a las 10:00 AM
- **Plantilla:** `confirmacion_24h` (desde Supabase)
- **Envío:** WhatsApp vía Twilio
- **Descripción:** Envía confirmación anticipada a clientes con reservas para mañana

**Flujo:**
```
Cron 10:00 AM
  ↓
Buscar reservas para mañana (status=pending)
  ↓
Por cada reserva:
  ↓
Obtener plantilla activa (confirmacion_24h)
  ↓
Reemplazar variables (nombre, hora, personas)
  ↓
Enviar WhatsApp
  ↓
Registrar en customer_confirmations
```

#### **5. `03-recordatorio-4h-antes-FINAL.json`**
- **Función:** Recordatorio urgente 4h antes de reserva
- **Cron:** Cada 2 horas
- **Plantilla:** `confirmacion_4h` (desde Supabase)
- **Envío:** WhatsApp vía Twilio
- **Descripción:** Recordatorio urgente para reservas de hoy

**Flujo:**
```
Cron cada 2h
  ↓
Buscar reservas HOY entre 4-4.5h (ventana de 30 min)
  ↓
Por cada reserva:
  ↓
Obtener plantilla activa (confirmacion_4h)
  ↓
Reemplazar variables (nombre, hora, personas)
  ↓
Enviar WhatsApp urgente 🚨
  ↓
Registrar en customer_confirmations
```

---

## 🔧 CONFIGURACIÓN NECESARIA:

### **Credenciales en N8N:**

1. **Supabase La-IA**
   - URL: `https://ktsqwvhqamedpmzkzjaz.supabase.co`
   - Key: Anon key

2. **Twilio account**
   - Account SID
   - Auth Token
   - WhatsApp From: `whatsapp:+14155238886`

---

## 📊 PLANTILLAS CRM (Supabase):

Los workflows 02 y 03 usan plantillas dinámicas desde `message_templates`:

| Categoría | Nombre | Uso |
|-----------|--------|-----|
| `confirmacion_24h` | "Confirmación 24h Antes" | Workflow 02 |
| `confirmacion_4h` | "Recordatorio Urgente" | Workflow 03 |

**Variables disponibles:**
- `{{customer_name}}` - Nombre del cliente
- `{{restaurant_name}}` - Nombre del restaurante
- `{{reservation_time}}` - Hora de reserva
- `{{party_size}}` - Número de personas

---

## 🚀 CÓMO IMPORTAR:

1. Abrir N8N: `http://localhost:5678`
2. Click en **"+"** → **"Import from File"**
3. Seleccionar el `.json` correspondiente
4. Verificar credenciales (Supabase + Twilio)
5. Activar workflow

---

## ⚠️ IMPORTANTE:

- **Solo una plantilla activa** por categoría (`is_active = true`)
- **Ventana de 4h:** Entre 4h y 4.5h para evitar duplicados
- **Multi-tenant:** Cada restaurante sus plantillas
- **Fallback:** Si falla plantilla, usa mensaje por defecto

---

#### **6. `05-auto-liberacion-2h-antes-FINAL.json`**
- **Función:** Auto-liberación de slots sin confirmar
- **Cron:** Cada 10 minutos (`*/10 * * * *`)
- **Descripción:** Marca como no_show y libera slots automáticamente (versión simplificada v4.0)
- **Estado:** ✅ ACTIVO

**Flujo:**
```
Cron cada 10 min
  ↓
Buscar reservas <2h sin confirmar
  ↓
Por cada reserva:
  ↓
Marcar como 'no_show'
  ↓
Obtener todas las mesas de reservation_tables
  ↓
Liberar TODOS los slots (OVERLAPS)
  ↓
Actualizar status='free', is_available=TRUE
  ↓
Registrar en noshow_actions
```

#### **99. `99-error-notifier-FINAL.json`**
- **Función:** Notificador de errores
- **Descripción:** Captura y notifica errores críticos del sistema
- **Trigger:** Webhook de errores
- **Estado:** ✅ ACTIVO

---

## 📈 PRÓXIMOS WORKFLOWS (Roadmap):

- [ ] **Procesador de Respuestas WhatsApp** - Webhook para capturar respuestas de confirmación
- [ ] **Alertas de Alto Riesgo** - Notificación al manager para reservas de riesgo
- [ ] **Bienvenida Cliente VIP** - Mensaje automático para clientes VIP
- [ ] **Reactivación Clientes Inactivos** - Campaña automática de reactivación

---

## 🎯 RESUMEN DE ESTADO:

### **✅ SISTEMA IA Y AGENTE: 100% OPERATIVO**
- Buffer WhatsApp con audio ✅
- Gateway unificado ✅
- Super Agent híbrido ✅
- Analizador post-conversación ✅

### **✅ TOOLS: 100% OPERATIVAS**
- Check availability ✅
- Create reservation ✅
- Modify reservation ✅
- Cancel reservation ✅
- RAG Search ✅

### **✅ SISTEMA CRM: 75% OPERATIVO**
- Recordatorio 24h ✅
- Recordatorio 4h ✅
- Auto-liberación 2h ✅
- Procesador respuestas ⏳
- Alertas alto riesgo ⏳

### **✅ SISTEMA DE ERRORES: 100% OPERATIVO**
- Error notifier ✅

---

## 📊 ARCHIVOS LIMPIADOS:

**Eliminados (22/10/2025):**
- ❌ Versiones duplicadas de recordatorios (CON-VERIFICACION)
- ❌ Versiones antiguas de confirmation handler
- ❌ Versiones obsoletas de error notifier
- ❌ Versiones duplicadas de check-availability
- ❌ Versiones antiguas de create/modify reservation
- ❌ READMEs obsoletos y duplicados (14 archivos)
- ❌ Archivos de código JS sueltos (3 archivos)

**TOTAL ELIMINADO:** 30+ archivos obsoletos

---

## 📚 DOCUMENTACIÓN RELACIONADA:

- **Sistema completo N8N:** `docs/02-sistemas/SISTEMA-N8N-AGENTE-IA.md`
- **Estado workflows:** `docs/02-sistemas/ESTADO_WORKFLOWS_N8N_2025-10-13.md`
- **Sistema No-Shows:** `docs/02-sistemas/SISTEMA-NOSHOWS-COMPLETO.md`
- **Sistema CRM:** `docs/02-sistemas/SISTEMA-CRM-COMPLETO.md`
- **Tool Create Reservation:** `README-TOOL-CREATE-RESERVATION-v2.md` (en esta carpeta)

---

**Última limpieza:** 22 Octubre 2025 - Limpieza profesional completa  
**Mantenimiento:** Mantener solo versiones FINAL de cada workflow

