# 🎙️ SISTEMA DE VOZ - OPENAI 100% (PROFESIONAL & RENTABLE)

**Fecha:** 23 de Octubre 2025  
**Versión:** 2.0  
**Estado:** ✅ LISTO PARA PRODUCCIÓN

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Configuración de Voces](#configuración-de-voces)
5. [Flujo de Datos](#flujo-de-datos)
6. [Costos y Rentabilidad](#costos-y-rentabilidad)
7. [Configuración Twilio](#configuración-twilio)
8. [Base de Datos](#base-de-datos)
9. [Testing y Validación](#testing-y-validación)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 RESUMEN EJECUTIVO

### **¿Qué es?**
Sistema de voz conversacional para La-IA App que permite a los clientes **llamar por teléfono** y hablar directamente con el agente IA para:
- ✅ Hacer reservas
- ✅ Consultar disponibilidad
- ✅ Modificar/cancelar reservas
- ✅ Información del restaurante

### **Stack 100% OpenAI:**
- **STT:** OpenAI Whisper-1
- **Agent:** GPT-4o-mini (Agent 03 existente)
- **TTS:** OpenAI TTS-1 (6 voces profesionales)
- **Telefonía:** Twilio Voice

### **Ventajas Clave:**
- 🔥 **Rentable:** $0.08 USD por llamada (3 min)
- 🔥 **Profesional:** Calidad empresarial
- 🔥 **Escalable:** Integración con agente existente
- 🔥 **Rápido:** Latencia < 1.2s
- 🔥 **Multi-tenant:** Soporte para múltiples restaurantes

---

## 🛠️ STACK TECNOLÓGICO

| **Componente** | **Proveedor** | **Modelo/Servicio** | **Costo** | **Latencia** |
|----------------|---------------|---------------------|-----------|--------------|
| **STT** | OpenAI | Whisper-1 | $0.006/min | ~500ms |
| **Agent** | OpenAI | GPT-4o-mini | $0.15/1M tokens | ~400ms |
| **TTS** | OpenAI | TTS-1 | $0.015/1K chars | ~300ms |
| **Telefonía** | Twilio | Voice Stream | $0.014/min | ~50ms |
| **TOTAL** | - | - | **$0.08/llamada** | **~1.2s** |

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### **Diagrama de Flujo:**

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE LLAMA                             │
│                    +34 XXX XXX XXX                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  TWILIO VOICE                                │
│  • Recibe llamada                                           │
│  • TwiML → WebSocket N8N                                    │
│  • Stream bidireccional (μ-law 8kHz)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         01 - VOZ GATEWAY STREAMING (N8N)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. 🔊 WebSocket Server (recibe audio)                │  │
│  │ 2. 🎙️ VAD + Buffer (acumula chunks)                  │  │
│  │ 3. ⏱️ Detector Silencio (3s)                          │  │
│  │ 4. 🔄 Convertir μ-law → WAV 16kHz                    │  │
│  │ 5. 🎤 STT Whisper (transcripción)                    │  │
│  │ 6. 🏪 Get Restaurant + Voice Config                  │  │
│  │ 7. 🔗 Preparar Gateway                               │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         02 - GATEWAY UNIFICADO (N8N)                        │
│  • Buscar/crear cliente                                     │
│  • Buscar/crear conversación                                │
│  • Ejecutar Agent 03 (GPT-4o-mini)                         │
│  • Devolver respuesta                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         01 - VOZ GATEWAY (continuación)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 8. 📤 Procesar Respuesta Agente                      │  │
│  │ 9. 🎙️ Seleccionar Voz (nova/onyx)                   │  │
│  │ 10. 🔊 TTS OpenAI (MP3)                              │  │
│  │ 11. 🔄 Convertir MP3 → μ-law 8kHz                   │  │
│  │ 12. 📡 Enviar a Twilio WebSocket                     │  │
│  │ 13. 💾 Guardar mensaje en BD                         │  │
│  │ 14. ✅ Log métricas                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              CLIENTE ESCUCHA RESPUESTA                       │
│              (Audio streaming bidireccional)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎙️ CONFIGURACIÓN DE VOCES

### **Voces Disponibles (OpenAI TTS-1):**

| **Nombre** | **Género** | **Características** | **Uso Recomendado** |
|------------|------------|---------------------|---------------------|
| **nova** ✅ | Femenino | Joven, amigable, clara | **Default Mujer** - Restaurantes casual/moderno |
| **onyx** ✅ | Masculino | Profesional, cálido, profundo | **Default Hombre** - Restaurantes formal/elegante |
| alloy | Neutro | Versátil, equilibrado | Multiuso |
| echo | Masculino | Cálido, cercano | Restaurantes familiares |
| fable | Neutro/Fem | Narrativo, elegante | Restaurantes premium |
| shimmer | Femenino | Suave, sofisticado | Restaurantes de lujo |

### **Cómo Configurar:**

#### **Opción 1: Por Género (Automático)**
```sql
-- Voz femenina (usa "nova")
UPDATE restaurant_settings 
SET voice_gender = 'female'
WHERE restaurant_id = 'tu-restaurant-id';

-- Voz masculina (usa "onyx")
UPDATE restaurant_settings 
SET voice_gender = 'male'
WHERE restaurant_id = 'tu-restaurant-id';
```

#### **Opción 2: Voz Específica**
```sql
-- Usar voz personalizada
UPDATE restaurant_settings 
SET voice_id = 'shimmer'  -- O cualquier otra: alloy, echo, fable
WHERE restaurant_id = 'tu-restaurant-id';
```

---

## 🔄 FLUJO DE DATOS DETALLADO

### **1. Recepción de Llamada (Twilio → N8N)**

**Input:**
```json
{
  "event": "start",
  "start": {
    "streamSid": "MZ...",
    "callSid": "CA...",
    "customParameters": {
      "restaurant_id": "uuid-del-restaurante"
    }
  }
}
```

**Procesamiento:**
- Inicializar buffer de audio
- Guardar `stream_sid`, `call_sid`, `restaurant_id` en `$globalState`

---

### **2. Streaming de Audio (Cliente → N8N)**

**Input (cada 20ms):**
```json
{
  "event": "media",
  "streamSid": "MZ...",
  "media": {
    "payload": "base64-mulaw-audio",
    "timestamp": 1234567890
  }
}
```

**Procesamiento:**
- Acumular chunks en buffer
- Actualizar `last_audio_time` en `$globalState`
- **NO procesar todavía** (esperar silencio)

---

### **3. Detección de Silencio (3 segundos)**

**Trigger:** Schedule cada 3s

**Lógica:**
```javascript
const now = Date.now();
const lastAudioTime = $globalState.get('last_audio_time_' + streamSid);
const timeSinceLastAudio = now - lastAudioTime;

if (timeSinceLastAudio >= 3000) {
  // ✅ Procesar buffer → STT
  const audioBuffer = $globalState.get('audio_buffer_' + streamSid);
  const concatenatedAudio = audioBuffer.map(chunk => chunk.payload).join('');
  
  return {
    audio_base64_mulaw: concatenatedAudio,
    ready_for_stt: true
  };
}
```

---

### **4. STT (Whisper)**

**Input:**
- Audio en formato WAV 16kHz (convertido desde μ-law)

**Output:**
```json
{
  "text": "Hola, quiero hacer una reserva para esta noche"
}
```

---

### **5. Obtener Configuración de Voz**

**Query SQL:**
```sql
SELECT 
  r.id,
  r.name,
  r.phone,
  rs.voice_provider,
  rs.voice_id,
  rs.voice_gender
FROM businesses r
LEFT JOIN restaurant_settings rs ON r.id = rs.restaurant_id
WHERE r.id = 'restaurant-id'
  AND r.active = true;
```

**Lógica de Selección:**
```javascript
const voiceConfig = {
  provider: restaurantData.voice_provider || 'openai',
  voice_id: restaurantData.voice_id || null,
  voice_gender: restaurantData.voice_gender || 'female'
};

// Si no hay voice_id, usar género
if (!voiceConfig.voice_id) {
  voiceConfig.voice_id = voiceConfig.voice_gender === 'male' ? 'onyx' : 'nova';
}

// Guardar en globalState para TTS
$globalState.set('voice_config', voiceConfig);
```

---

### **6. Gateway + Agent 03**

**Input al Gateway:**
```json
{
  "customer_phone": "+34612345678",
  "customer_name": "Cliente",
  "restaurant_id": "uuid",
  "message_text": "Hola, quiero hacer una reserva para esta noche",
  "channel": "voice",
  "call_metadata": {
    "call_sid": "CA...",
    "stream_sid": "MZ...",
    "stt_provider": "openai",
    "voice_config": {
      "provider": "openai",
      "voice_id": "nova",
      "voice_gender": "female"
    }
  }
}
```

**Output del Gateway:**
```json
{
  "success": true,
  "agent_response": {
    "output": "¡Hola! Claro, con gusto. ¿Para cuántas personas sería la reserva?"
  },
  "conversation_id": "uuid"
}
```

---

### **7. TTS (OpenAI)**

**Input:**
```json
{
  "text_to_speak": "¡Hola! Claro, con gusto. ¿Para cuántas personas sería la reserva?",
  "voice": "nova",
  "model": "tts-1",
  "speed": 1.0
}
```

**Output:**
- Audio MP3 (binary)

---

### **8. Envío a Twilio**

**Conversión:** MP3 → μ-law 8kHz

**Payload WebSocket:**
```json
{
  "event": "media",
  "streamSid": "MZ...",
  "media": {
    "payload": "base64-mulaw-audio"
  }
}
```

---

## 💰 COSTOS Y RENTABILIDAD

### **Desglose de Costos (Llamada de 3 min):**

| **Servicio** | **Cálculo** | **Costo** |
|--------------|-------------|-----------|
| **Whisper STT** | 3 min × $0.006/min | $0.018 |
| **GPT-4o-mini** | ~500 tokens × $0.15/1M | $0.000075 |
| **OpenAI TTS** | ~150 chars × $0.015/1K | $0.00225 |
| **Twilio Voice** | 3 min × $0.014/min | $0.042 |
| **TOTAL** | - | **$0.062** |

### **Modelo de Negocio:**

| **Concepto** | **Valor** |
|--------------|-----------|
| **Costo real** | $0.062/llamada |
| **Precio al cliente** | $0.15/llamada |
| **Margen** | **$0.088 (142%)** 🔥 |

### **Proyección Mensual (100 llamadas):**

- **Costo:** $6.20
- **Ingreso:** $15.00
- **Ganancia:** **$8.80/mes por restaurante** 💰

---

## 📞 CONFIGURACIÓN TWILIO

### **Paso 1: Crear TwiML Bin**

1. Ir a: https://console.twilio.com/us1/develop/runtime/twiml-bins
2. Crear nuevo TwiML Bin: `voice-agent-[restaurant-name]`
3. Pegar el siguiente código:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://tu-n8n-domain.com/webhook/voice-stream">
      <Parameter name="restaurant_id" value="UUID-DEL-RESTAURANTE" />
    </Stream>
  </Connect>
</Response>
```

**⚠️ IMPORTANTE:** Reemplazar:
- `tu-n8n-domain.com` → Tu dominio de N8N
- `UUID-DEL-RESTAURANTE` → ID real del restaurante

### **Paso 2: Configurar Número de Twilio**

1. Ir a: https://console.twilio.com/us1/develop/phone-numbers/manage/active
2. Seleccionar número del restaurante
3. En **"A CALL COMES IN"**:
   - Tipo: **TwiML**
   - TwiML: Seleccionar el Bin creado
4. Guardar cambios

### **Paso 3: Verificar Configuración**

```bash
# Test de conectividad WebSocket
wscat -c wss://tu-n8n-domain.com/webhook/voice-stream

# Debería responder:
# Connected (press CTRL+C to quit)
```

---

## 🗄️ BASE DE DATOS

### **Migración SQL:**

Ejecutar: `scripts/sql/add_voice_config_columns.sql`

```sql
-- Agregar columnas de configuración de voz
ALTER TABLE restaurant_settings 
ADD COLUMN IF NOT EXISTS voice_provider TEXT DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voice_gender TEXT DEFAULT 'female';
```

### **Tablas Involucradas:**

1. **`businesses`** - Datos del restaurante
2. **`restaurant_settings`** - Configuración de voz
3. **`customers`** - Clientes que llaman
4. **`agent_conversations`** - Historial de llamadas
5. **`agent_messages`** - Mensajes (transcripción + audio)

---

## 🧪 TESTING Y VALIDACIÓN

### **Test 1: Llamada de Prueba**

```bash
# Llamar al número configurado
# Esperar mensaje del agente
# Hablar: "Hola, quiero hacer una reserva"
# Verificar respuesta
```

### **Test 2: Verificar Logs N8N**

```javascript
// En el workflow "01-voz-gateway-streaming"
// Buscar en logs:
console.log('✅ Transcripción completada:', transcript);
console.log('🎙️ Configuración de voz:', { voice: selectedVoice });
console.log('✅ Audio enviado exitosamente a Twilio');
```

### **Test 3: Verificar Base de Datos**

```sql
-- Ver últimas conversaciones por voz
SELECT 
  c.id,
  c.customer_phone,
  c.channel,
  c.created_at,
  COUNT(m.id) as message_count
FROM agent_conversations c
LEFT JOIN agent_messages m ON c.id = m.conversation_id
WHERE c.channel = 'voice'
  AND c.created_at > NOW() - INTERVAL '1 hour'
GROUP BY c.id
ORDER BY c.created_at DESC;

-- Ver mensajes de una conversación
SELECT 
  sender,
  message_text,
  created_at,
  metadata->>'voice' as voice_used
FROM agent_messages
WHERE conversation_id = 'conversation-uuid'
ORDER BY created_at;
```

---

## 🔧 TROUBLESHOOTING

### **Problema 1: No se transcribe el audio**

**Síntomas:**
- Llamada se conecta pero no hay respuesta
- Logs: "Transcripción vacía"

**Solución:**
```javascript
// Verificar formato de audio
// En nodo "🔄 Convertir para Whisper"
console.log('Audio formato:', {
  input: 'mulaw 8kHz',
  output: 'wav 16kHz',
  size: outputBuffer.length
});

// Si size = 0 → problema con ffmpeg
// Instalar: apt-get install ffmpeg
```

---

### **Problema 2: Voz incorrecta**

**Síntomas:**
- Se usa siempre la misma voz
- No respeta configuración del restaurante

**Solución:**
```sql
-- Verificar configuración
SELECT 
  r.name,
  rs.voice_provider,
  rs.voice_id,
  rs.voice_gender
FROM businesses r
LEFT JOIN restaurant_settings rs ON r.id = rs.restaurant_id
WHERE r.id = 'restaurant-id';

-- Si es NULL, ejecutar migración:
-- scripts/sql/add_voice_config_columns.sql
```

---

### **Problema 3: Latencia alta (> 2s)**

**Checklist:**
- ✅ N8N en servidor cercano al cliente
- ✅ ffmpeg instalado y optimizado
- ✅ Conexión Twilio estable
- ✅ Gateway Unificado sin bloqueos

**Medir latencias:**
```javascript
// En nodo "✅ Log Éxito"
const totalLatency = gatewayTime + ttsTime + conversionTime;
console.log('⏱️ Latencias:', {
  gateway_ms: gatewayTime,
  tts_ms: ttsTime,
  conversion_ms: conversionTime,
  total_ms: totalLatency,
  objetivo_ms: 1200
});
```

---

### **Problema 4: WebSocket desconectado**

**Síntomas:**
- Error: "WebSocket connection lost"
- Llamada se cuelga

**Solución:**
```javascript
// Verificar estado del WebSocket
const ws = $workflow.getWebSocket('voice-stream-twilio');
console.log('WebSocket state:', {
  exists: !!ws,
  ready: ws ? ws.readyState === 1 : false
});

// Reiniciar N8N si persiste:
// systemctl restart n8n
```

---

## 📊 MÉTRICAS Y MONITOREO

### **Queries de Métricas:**

```sql
-- 1. Llamadas por día
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM agent_conversations
WHERE channel = 'voice'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. Restaurantes más activos por voz
SELECT 
  r.name,
  COUNT(c.id) as total_calls,
  rs.voice_id,
  rs.voice_gender
FROM agent_conversations c
JOIN businesses r ON c.restaurant_id = r.id
LEFT JOIN restaurant_settings rs ON r.id = rs.restaurant_id
WHERE c.channel = 'voice'
  AND c.created_at > NOW() - INTERVAL '30 days'
GROUP BY r.name, rs.voice_id, rs.voice_gender
ORDER BY total_calls DESC;

-- 3. Tasa de éxito (conversaciones con > 2 mensajes)
SELECT 
  restaurant_id,
  COUNT(*) as total_conversations,
  SUM(CASE WHEN message_count > 2 THEN 1 ELSE 0 END) as successful_conversations,
  ROUND(100.0 * SUM(CASE WHEN message_count > 2 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM (
  SELECT 
    conversation_id,
    restaurant_id,
    COUNT(*) as message_count
  FROM agent_messages
  WHERE conversation_id IN (
    SELECT id FROM agent_conversations WHERE channel = 'voice'
  )
  GROUP BY conversation_id, restaurant_id
) sub
GROUP BY restaurant_id;
```

---

## 🚀 FUTURAS MEJORAS (Premium)

### **Opción 1: ElevenLabs (TTS Premium)**
- ✅ 160+ voces personalizadas
- ✅ Clonación de voz
- ❌ Costo: $0.30/1K chars (20x más caro)
- **Uso:** Solo para clientes premium que paguen extra

### **Opción 2: Interrupciones en tiempo real**
- Detectar cuando el cliente interrumpe al agente
- Detener TTS inmediatamente
- Implementar VAD más sensible

### **Opción 3: Análisis de sentimiento**
- Detectar tono de voz (frustración, satisfacción)
- Ajustar respuesta del agente
- Alertas para el restaurante

---

## ✅ CHECKLIST PRE-PRODUCCIÓN

- [ ] Ejecutar migración SQL (`add_voice_config_columns.sql`)
- [ ] Importar workflow `01-voz-gateway-streaming.json` en N8N
- [ ] Verificar credenciales OpenAI en N8N
- [ ] Configurar TwiML Bin en Twilio
- [ ] Asignar TwiML a número de teléfono
- [ ] Configurar voz por defecto para cada restaurante
- [ ] Test de llamada completa
- [ ] Verificar logs y métricas
- [ ] Documentar número de teléfono en `restaurant_settings`

---

## 📞 SOPORTE

**Documentos relacionados:**
- `docs/02-sistemas/SISTEMA-AGENTE-HIBRIDO-CONTROLADO.md`
- `n8n/workflows/01-voz-gateway-streaming.json`
- `n8n/workflows/2-GATEWAY-FINAL-IMPORTAR.json`
- `scripts/sql/add_voice_config_columns.sql`

**Contacto:** La-IA Team

---

**🎉 ¡SISTEMA LISTO PARA PRODUCCIÓN!**



