# 🎤 SISTEMA DE VOZ PROFESIONAL - ARQUITECTURA STREAMING BIDIRECCIONAL

**Fecha de creación:** 23 de Octubre de 2025  
**Versión:** 1.0 - Arquitectura Enterprise  
**Estado:** 🏗️ EN DISEÑO  
**Objetivo:** El mejor sistema de voz del mundo para la mejor app de restaurantes del mundo

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura Técnica](#arquitectura-técnica)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Flujo de Datos](#flujo-de-datos)
5. [Workflows N8N](#workflows-n8n)
6. [Adaptaciones al Agente Existente](#adaptaciones-al-agente-existente)
7. [Costos y Rentabilidad](#costos-y-rentabilidad)
8. [Plan de Implementación](#plan-de-implementación)
9. [Configuración Twilio](#configuración-twilio)
10. [Testing y Validación](#testing-y-validación)

---

## 🎯 RESUMEN EJECUTIVO

### **Objetivo**
Crear un sistema de voz conversacional con **streaming bidireccional** que permita a clientes hacer reservas por teléfono con la misma calidad que WhatsApp, pero con una experiencia de voz natural, rápida y profesional.

### **Características Principales**

✅ **Streaming Bidireccional Real-Time** - El agente puede interrumpir y ser interrumpido  
✅ **Ultra-Baja Latencia** - Respuestas en <500ms desde que el cliente termina de hablar  
✅ **Mismo Agente que WhatsApp** - Reutiliza Agent 03 (Super Agent Híbrido)  
✅ **Multi-Idioma** - Español, Catalán, Inglés, Francés automático  
✅ **Rentable** - $0.04/llamada promedio (2 min) vs $0.30 con ElevenLabs  
✅ **Profesional** - Calidad indistinguible de un humano  
✅ **Robusto** - Manejo de errores, reconexiones, timeouts

### **Métricas Objetivo**

| Métrica | Objetivo | Benchmark |
|---------|----------|-----------|
| **Latencia STT** | <300ms | Deepgram Nova-2 |
| **Latencia Agente** | <500ms | GPT-4o-mini optimizado |
| **Latencia TTS** | <300ms | OpenAI TTS-1 |
| **Latencia Total** | <1.1s | Conversación natural |
| **Precisión STT** | >95% | Deepgram líder del mercado |
| **Naturalidad TTS** | 4.5/5 | OpenAI voices (alloy, echo) |
| **Tasa de Éxito** | >85% | Igual que WhatsApp |
| **Costo/Llamada** | <$0.05 | Competitivo vs VAPI ($0.05) |

---

## 🏗️ ARQUITECTURA TÉCNICA

### **Diagrama de Flujo Completo**

```
┌─────────────────────────────────────────────────────────────────┐
│  📞 CLIENTE LLAMA AL RESTAURANTE                                 │
│  +34 XXX XXX XXX (Número Twilio Voice)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  🔊 TWILIO VOICE - Media Streams                                 │
│  • Establece llamada                                             │
│  • Abre WebSocket bidireccional                                  │
│  • Streaming de audio: Cliente ↔ N8N                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  🎙️ N8N WORKFLOW: 01-voz-gateway-streaming.json                 │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 1: WebSocket Server (Twilio)                         │  │
│  │ • Recibe audio chunks (base64)                             │  │
│  │ • Formato: μ-law 8kHz (Twilio standard)                    │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 2: VAD (Voice Activity Detection)                    │  │
│  │ • Detecta pausas en la voz del cliente                     │  │
│  │ • Umbral: 3 segundos de silencio → Procesar               │  │
│  │ • Buffer acumulativo de audio                              │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 3: STT - Deepgram Nova-2                             │  │
│  │ • Convierte audio → texto                                  │  │
│  │ • Streaming mode: on                                       │  │
│  │ • Language: auto-detect (es, ca, en, fr)                   │  │
│  │ • Punctuation: true                                        │  │
│  │ • Latencia: ~300ms                                         │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 4: Normalizar Input                                  │  │
│  │ • customer_phone: +34XXXXXXXXX (Caller ID de Twilio)      │  │
│  │ • customer_name: extraído o "Cliente"                      │  │
│  │ • message_text: transcripción STT                          │  │
│  │ • channel: "voice"                                         │  │
│  │ • restaurant_phone: número llamado (Twilio To)            │  │
│  │ • timestamp: ISO 8601                                      │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 5: Identificar Restaurante                           │  │
│  │ • Query: SELECT id FROM restaurants                        │  │
│  │   WHERE channels->>'voice'->>'phone_number' = $to_number  │  │
│  │ • Obtener restaurant_id                                    │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 6: Pasar a Gateway Unificado                         │  │
│  │ • Execute Workflow: 2-GATEWAY-FINAL-IMPORTAR.json         │  │
│  │ • Input: {customer_phone, message_text, channel, ...}     │  │
│  └───────────────────────┬───────────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  🚪 N8N WORKFLOW: 2-GATEWAY-FINAL-IMPORTAR.json (EXISTENTE)     │
│  • Buscar/crear customer (por phone)                             │
│  • Buscar/crear conversation (agent_conversations)               │
│  • Guardar mensaje inbound (agent_messages)                      │
│  • Enriquecer contexto (restaurant, reservas activas)            │
│  • Pasar a Super Agent                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  🤖 N8N WORKFLOW: 3-super-agent-hibrido-FINAL-CORREGIDO.json    │
│  (ADAPTADO PARA VOZ)                                             │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ PROMPT ADAPTADO PARA VOZ:                                 │  │
│  │ • Respuestas MÁS BREVES (≤50 palabras)                    │  │
│  │ • Lenguaje CONVERSACIONAL ("vale", "perfecto", "genial")  │  │
│  │ • Evitar listas largas (máximo 2-3 opciones)              │  │
│  │ • Confirmaciones EXPLÍCITAS verbales                       │  │
│  │ • Deletrear información crítica (ej: hora "20:30" →       │  │
│  │   "las ocho y media de la noche")                          │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│  • Clasificación (si no hay conversación activa)                 │
│  • Enriquecimiento de contexto                                   │
│  • Llamada a GPT-4o (con memoria de conversación)                │
│  • Uso de herramientas:                                          │
│    - check_availability                                          │
│    - create_reservation                                          │
│    - cancel_reservation                                          │
│    - consultar_informacion_restaurante                           │
│    - escalate_to_human                                           │
│  • Output: TEXTO de respuesta                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  📤 RETORNO A: 01-voz-gateway-streaming.json                     │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 7: Procesar Respuesta del Agente                     │  │
│  │ • Recibe texto de respuesta                                │  │
│  │ • Guardar mensaje outbound (agent_messages)                │  │
│  │ • Detectar idioma de la respuesta                          │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 8: TTS - OpenAI TTS-1                                │  │
│  │ • Modelo: tts-1 (rápido, baja latencia)                    │  │
│  │ • Voice: "alloy" (femenina, profesional, cálida)          │  │
│  │   Alternativas: "echo" (masculina), "nova" (enérgica)     │  │
│  │ • Speed: 1.0 (velocidad normal)                            │  │
│  │ • Response format: mp3 (comprimido)                        │  │
│  │ • Latencia: ~300ms                                         │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 9: Convertir Audio para Twilio                       │  │
│  │ • Convertir MP3 → μ-law 8kHz (ffmpeg)                     │  │
│  │ • Codificar en base64                                      │  │
│  │ • Preparar payload para Media Stream                       │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                        │
│                          ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ NODO 10: Enviar Audio a Twilio                            │  │
│  │ • WebSocket.send(audioPayload)                             │  │
│  │ • Stream audio al cliente                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  🔊 TWILIO VOICE - Reproduce Audio al Cliente                    │
│  • Cliente escucha la respuesta del agente                       │
│  • Puede interrumpir en cualquier momento (streaming bidi)       │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ (LOOP: Cliente responde → VAD → STT → Agent → TTS → Twilio)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ✅ FIN DE CONVERSACIÓN                                          │
│  • Cliente cuelga o timeout (30s sin actividad)                  │
│  • Cerrar WebSocket                                              │
│  • Actualizar conversation (status='resolved', resolved_at)      │
│  • Ejecutar workflow: 04-post-conversation-analyzer.json         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ STACK TECNOLÓGICO

### **Proveedores y Servicios**

| Componente | Proveedor | Versión/Plan | Propósito |
|------------|-----------|--------------|-----------|
| **Telefonía** | Twilio Voice | Pay-as-you-go | Recepción de llamadas, streaming bidireccional |
| **STT** | Deepgram Nova-2 | API REST/WebSocket | Transcripción audio → texto (95% precisión) |
| **LLM** | OpenAI GPT-4o-mini | API REST | Agente conversacional (clasificación, respuestas) |
| **TTS** | OpenAI TTS-1 | API REST | Síntesis texto → audio (natural, rápido) |
| **Orquestación** | N8N | Self-hosted | Workflows, lógica de negocio |
| **Base de Datos** | Supabase PostgreSQL | Hosted | Almacenamiento, RLS, realtime |
| **Audio Processing** | FFmpeg | CLI | Conversión de formatos de audio |

### **Versiones y Configuración**

#### **Twilio Voice**
```json
{
  "account_sid": "ACxxxxxxxxxxxx",
  "auth_token": "xxxxxxxxxxxx",
  "phone_number": "+34XXXXXXXXX",
  "capabilities": {
    "voice": true,
    "media_streams": true,
    "twiml_applications": true
  }
}
```

#### **Deepgram Nova-2**
```json
{
  "model": "nova-2",
  "version": "latest",
  "features": {
    "punctuate": true,
    "diarize": false,
    "utterances": true,
    "language": "multi",
    "detect_language": true
  },
  "streaming": true
}
```

#### **OpenAI TTS-1**
```json
{
  "model": "tts-1",
  "voice": "alloy",
  "response_format": "mp3",
  "speed": 1.0
}
```

---

## 📊 FLUJO DE DATOS DETALLADO

### **1. INICIO DE LLAMADA**

**Cliente marca:** `+34 XXX XXX XXX` (número Twilio del restaurante)

**Twilio recibe llamada:**
```xml
<!-- TwiML: Respuesta inicial de Twilio -->
<Response>
  <Say voice="Polly.Lucia" language="es-ES">
    Bienvenido a [Nombre Restaurante]. Un momento por favor.
  </Say>
  <Connect>
    <Stream url="wss://n8n.tu-dominio.com/webhook/voice-stream" />
  </Connect>
</Response>
```

**Datos capturados por Twilio:**
- `CallSid`: Identificador único de la llamada
- `From`: Número del cliente (`+34XXXXXXXXX`)
- `To`: Número llamado (número del restaurante)
- `CallStatus`: `in-progress`
- `Direction`: `inbound`

---

### **2. STREAMING DE AUDIO (WebSocket)**

**Formato de mensaje Twilio → N8N:**
```json
{
  "event": "media",
  "sequenceNumber": 1234,
  "media": {
    "track": "inbound",
    "chunk": 1,
    "timestamp": 1635789012345,
    "payload": "base64_encoded_audio_data"
  },
  "streamSid": "MZxxxxxxxxxxxx"
}
```

**Procesamiento en N8N:**
1. Acumular chunks en buffer
2. Detectar silencio (VAD):
   - Si silencio > 3 segundos → Procesar buffer completo
3. Decodificar base64 → raw audio (μ-law 8kHz)

---

### **3. STT (Speech-to-Text) con Deepgram**

**Request a Deepgram:**
```bash
curl -X POST "https://api.deepgram.com/v1/listen" \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/mulaw" \
  -d @audio_chunk.mulaw
```

**Response de Deepgram:**
```json
{
  "metadata": {
    "transaction_key": "deprecated",
    "request_id": "uuid",
    "sha256": "hash",
    "created": "2025-10-23T10:30:00.000Z",
    "duration": 2.5,
    "channels": 1,
    "models": ["nova-2"]
  },
  "results": {
    "channels": [
      {
        "alternatives": [
          {
            "transcript": "Hola, quiero hacer una reserva para cuatro personas mañana a las nueve de la noche.",
            "confidence": 0.98,
            "words": [
              {"word": "Hola", "start": 0.0, "end": 0.4, "confidence": 0.99},
              {"word": "quiero", "start": 0.5, "end": 0.8, "confidence": 0.97}
            ]
          }
        ]
      }
    ]
  }
}
```

**Extracción en N8N:**
```javascript
const transcript = $json.results.channels[0].alternatives[0].transcript;
const confidence = $json.results.channels[0].alternatives[0].confidence;
const duration = $json.metadata.duration;

console.log('✅ STT completado:', {
  transcript,
  confidence,
  duration,
  words: transcript.split(' ').length
});

return {
  message_text: transcript,
  stt_confidence: confidence,
  audio_duration_seconds: duration
};
```

---

### **4. NORMALIZACIÓN Y PASO AL GATEWAY**

**Payload enviado a Gateway Unificado:**
```json
{
  "customer_phone": "+34612345678",
  "customer_name": "Cliente",
  "restaurant_phone": "+34987654321",
  "message_text": "Hola, quiero hacer una reserva para cuatro personas mañana a las nueve de la noche.",
  "channel": "voice",
  "timestamp": "2025-10-23T10:30:15.000Z",
  "metadata": {
    "call_sid": "CAxxxxxxxxxxxx",
    "stt_confidence": 0.98,
    "audio_duration": 2.5,
    "detected_language": "es"
  }
}
```

---

### **5. PROCESAMIENTO DEL AGENTE**

**El Agent 03 procesa igual que WhatsApp:**
- Busca/crea customer
- Busca/crea conversation
- Clasifica intención (si es nuevo o >15min sin actividad)
- Enriquece contexto (restaurant, reservas, horarios)
- Llama a GPT-4o con prompt adaptado para voz
- Ejecuta herramientas si necesario (`check_availability`, etc.)
- Devuelve respuesta en texto

**Ejemplo de respuesta del agente:**
```json
{
  "output": "¡Perfecto! Déjame verificar la disponibilidad para mañana a las nueve de la noche para cuatro personas... ¡Sí tenemos disponibilidad! ¿Confirmo tu reserva?",
  "tools_used": ["check_availability"],
  "confidence": 0.95,
  "sentiment": "positive"
}
```

---

### **6. TTS (Text-to-Speech) con OpenAI**

**Request a OpenAI:**
```bash
curl -X POST "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "input": "¡Perfecto! Déjame verificar la disponibilidad para mañana a las nueve de la noche para cuatro personas... ¡Sí tenemos disponibilidad! ¿Confirmo tu reserva?",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1.0
  }' \
  --output response.mp3
```

**Response:** Audio MP3 (binario)

**Conversión para Twilio (N8N):**
```javascript
// NODO: Convertir Audio
const inputAudioBase64 = $binary.data.data; // MP3 de OpenAI
const inputBuffer = Buffer.from(inputAudioBase64, 'base64');

// Convertir MP3 → μ-law 8kHz usando ffmpeg
const { execSync } = require('child_process');
const fs = require('fs');

fs.writeFileSync('/tmp/input.mp3', inputBuffer);

execSync('ffmpeg -i /tmp/input.mp3 -ar 8000 -ac 1 -f mulaw /tmp/output.ulaw');

const outputBuffer = fs.readFileSync('/tmp/output.ulaw');
const outputBase64 = outputBuffer.toString('base64');

console.log('✅ Audio convertido:', {
  input_format: 'mp3',
  output_format: 'mulaw 8kHz',
  size_bytes: outputBuffer.length
});

return {
  audio_payload: outputBase64,
  audio_format: 'mulaw',
  sample_rate: 8000
};
```

---

### **7. ENVÍO A TWILIO (WebSocket)**

**Payload a Twilio Media Stream:**
```json
{
  "event": "media",
  "streamSid": "MZxxxxxxxxxxxx",
  "media": {
    "payload": "base64_encoded_mulaw_audio"
  }
}
```

**Envío desde N8N:**
```javascript
// NODO: Enviar a Twilio
const ws = $workflow.getWebSocket('twilio_stream');
const audioPayload = $json.audio_payload;
const streamSid = $('WebSocket Server').item.json.streamSid;

const payload = {
  event: 'media',
  streamSid: streamSid,
  media: {
    payload: audioPayload
  }
};

ws.send(JSON.stringify(payload));

console.log('✅ Audio enviado a Twilio:', {
  stream_sid: streamSid,
  payload_size: audioPayload.length
});

return {
  sent: true,
  timestamp: new Date().toISOString()
};
```

---

## 🔄 WORKFLOWS N8N

### **Workflow 1: `01-voz-gateway-streaming.json`**

**Propósito:** Manejar llamadas de voz con streaming bidireccional

**Nodos:**

1. **🔊 WebSocket Server (Twilio)**
   - Type: `WebSocket Trigger`
   - Path: `/webhook/voice-stream`
   - Events: `message`, `close`, `error`

2. **🎙️ VAD (Voice Activity Detection)**
   - Type: `Code`
   - Logic: Acumular audio, detectar pausas de 3s

3. **📝 STT (Deepgram)**
   - Type: `HTTP Request`
   - URL: `https://api.deepgram.com/v1/listen`
   - Method: `POST`
   - Body: Audio binario (μ-law)

4. **🔗 Normalizar Input**
   - Type: `Code`
   - Output: Payload estandarizado para Gateway

5. **🏪 Identificar Restaurante**
   - Type: `Supabase`
   - Query: Buscar restaurant por phone number

6. **🚪 Execute Workflow: Gateway Unificado**
   - Type: `Execute Workflow`
   - Workflow: `2-GATEWAY-FINAL-IMPORTAR.json`

7. **📤 Procesar Respuesta**
   - Type: `Code`
   - Logic: Extraer respuesta del agente, guardar mensaje

8. **🔊 TTS (OpenAI)**
   - Type: `HTTP Request`
   - URL: `https://api.openai.com/v1/audio/speech`
   - Method: `POST`
   - Body: JSON con texto

9. **🔄 Convertir Audio**
   - Type: `Code`
   - Logic: MP3 → μ-law 8kHz (ffmpeg)

10. **📡 Enviar a Twilio**
    - Type: `Code`
    - Logic: WebSocket.send()

**Archivo completo:** (Continúa en siguiente sección...)

---

## 📝 ADAPTACIONES AL AGENTE EXISTENTE

### **Cambio 1: Prompt Adaptado para Voz**

**Ubicación:** `3-super-agent-hibrido-FINAL-CORREGIDO.json` → Nodo `🤖 Super Agent (GPT-4o)` → System Message

**Modificaciones necesarias:**

```markdown
## 🎤 REGLAS ADICIONALES PARA CANAL DE VOZ

**⚠️ CRÍTICO: Cuando channel = 'voice', aplica estas reglas:**

### 1. BREVEDAD EXTREMA
- Respuestas ≤50 palabras por turno
- Máximo 2-3 oraciones
- Sin listas largas (máximo 2 opciones)
- Evitar explicaciones detalladas (a menos que lo pidan)

**Ejemplos:**

❌ MAL (muy largo para voz):
"Perfecto, tenemos disponibilidad para cuatro personas. Tenemos varias opciones: podemos ofrecerte una mesa en el interior, que es más tranquilo, o en la terraza, que tiene unas vistas preciosas. También tenemos zona privada si lo prefieres. ¿Qué zona te gustaría?"

✅ BIEN (breve, directo):
"¡Perfecto! Tenemos disponibilidad. ¿Prefieres interior o terraza?"

### 2. LENGUAJE CONVERSACIONAL NATURAL
- Usa: "vale", "perfecto", "genial", "claro"
- Evita: "por supuesto", "efectivamente", "a continuación"
- Habla como humano, NO como chatbot

**Ejemplos:**

❌ MAL (muy formal):
"Procedo a verificar la disponibilidad solicitada para la fecha indicada."

✅ BIEN (natural):
"Dame un segundo que lo miro..."

### 3. CONFIRMACIONES EXPLÍCITAS VERBALES
- Repite información crítica para asegurar comprensión
- Deletrea horas: "20:30" → "las ocho y media de la noche"
- Confirma fechas: "mañana" → "mañana viernes 24 de octubre"

**Ejemplos:**

❌ MAL (asume comprensión):
"Tu reserva para 4 el 24/10 a las 20:30."

✅ BIEN (deletrea, confirma):
"Tu reserva para cuatro personas, mañana viernes 24 de octubre, a las ocho y media de la noche. ¿Correcto?"

### 4. MANEJO DE INTERRUPCIONES
- Si detectas una interrupción, termina tu frase actual
- Responde directamente a la nueva pregunta
- No repitas información ya dicha

### 5. CLARIDAD EN NÚMEROS
- Uno, dos, tres (NO 1, 2, 3)
- "Cuatro personas" (NO "4 personas")
- "Veinte treinta" o "ocho y media de la noche" (NO "20:30")

### 6. ESTRUCTURA DE RESPUESTA ÓPTIMA
```
[Confirmación breve] + [Pregunta/Acción] + [Pausa implícita]
```

**Ejemplo:**
"¡Perfecto! Sí tenemos disponibilidad. ¿Confirmo tu reserva?"
```

---

### **Cambio 2: Gateway Unificado (Mínimo)**

**Ubicación:** `2-GATEWAY-FINAL-IMPORTAR.json`

**Modificación:** Aceptar `channel: 'voice'` como válido

**Nodo:** `📋 Normalizar y Validar Input`

**Cambio en código:**
```javascript
// ANTES:
const validChannels = ['whatsapp', 'instagram', 'facebook', 'web'];

// DESPUÉS:
const validChannels = ['whatsapp', 'instagram', 'facebook', 'web', 'voice'];

// Validar canal
if (!validChannels.includes(inputData.channel)) {
  throw new Error(`❌ Canal no válido: ${inputData.channel}`);
}

// ✅ NUEVO: Detectar si es voz y añadir flag
const isVoiceChannel = inputData.channel === 'voice';

return {
  ...normalizedData,
  is_voice_channel: isVoiceChannel
};
```

---

### **Cambio 3: Super Agent - Detección de Canal**

**Ubicación:** `3-super-agent-hibrido-FINAL-CORREGIDO.json`

**Nodo:** `🔗 Fusionar Contexto Enriquecido`

**Añadir al contexto:**
```javascript
// Detectar si es canal de voz
const isVoice = classifiedData.channel === 'voice';

const enrichedContext = {
  // ... (contexto existente)
  
  // ✅ NUEVO: Flag para el prompt
  is_voice_conversation: isVoice,
  
  // ✅ NUEVO: Instrucciones adicionales para voz
  voice_instructions: isVoice ? `
🎤 MODO VOZ ACTIVO:
- Respuestas BREVES (≤50 palabras)
- Lenguaje CONVERSACIONAL
- Deletrear números y horas
- Confirmar información crítica verbalmente
  `.trim() : ''
};
```

---

## 💰 COSTOS Y RENTABILIDAD

### **Desglose de Costos por Componente**

| Componente | Proveedor | Precio Unitario | Costo/Llamada (2 min) |
|------------|-----------|-----------------|------------------------|
| **Llamada telefónica** | Twilio Voice | $0.013/min | $0.026 |
| **STT (Speech-to-Text)** | Deepgram Nova-2 | $0.0043/min | $0.0086 |
| **LLM Clasificación** | GPT-4o-mini | $0.150/1M input tokens | $0.0008 |
| **LLM Agente** | GPT-4o-mini | $0.150/1M input + $0.600/1M output | $0.0028 |
| **TTS (Text-to-Speech)** | OpenAI TTS-1 | $0.015/1K chars | $0.003 |
| **Total por llamada** | - | - | **$0.041** |

### **Análisis de Llamada Promedio (2 minutos)**

**Supuestos:**
- Duración: 2 minutos (120 segundos)
- Turnos conversacionales: 4 (cliente habla → agente responde × 4)
- Audio STT: 2 minutos totales (cliente habla ~1 min, agente habla ~1 min)
- Tokens LLM:
  - Clasificación: 50 tokens input (solo 1 vez si no hay conversación activa)
  - Agente por turno: 600 tokens input (contexto) + 100 tokens output (respuesta) × 4 turnos = 2,800 tokens
- Caracteres TTS: 200 chars por respuesta × 4 turnos = 800 chars

**Cálculo detallado:**

```
1. Twilio Voice: 2 min × $0.013 = $0.026

2. Deepgram STT: 2 min × $0.0043 = $0.0086

3. GPT-4o-mini:
   - Clasificación: 50 tokens × $0.15/1M = $0.0000075
   - Agente: 2,800 tokens × ($0.15 input + $0.60 output)/1M = $0.0028
   Total LLM: $0.0028

4. OpenAI TTS-1: 800 chars × $0.015/1K = $0.012

──────────────────────────────────
TOTAL: $0.0494 ≈ $0.05 por llamada
```

### **Comparación con Competencia**

| Solución | Costo/Llamada (2 min) | Calidad | Control | Multiidioma |
|----------|------------------------|---------|---------|-------------|
| **Nuestra solución** | **$0.05** | ⭐⭐⭐⭐ | ✅ Total | ✅ Sí |
| VAPI | $0.05 | ⭐⭐⭐⭐ | ❌ Limitado | ✅ Sí |
| ElevenLabs + VAPI | $0.35 | ⭐⭐⭐⭐⭐ | ❌ Limitado | ✅ Sí |
| BAPI | $0.08 | ⭐⭐⭐ | ❌ Limitado | ⚠️ Limitado |
| Humano (empleado) | $5.00 | ⭐⭐⭐⭐⭐ | ✅ Total | ⚠️ Depende |

### **Modelo de Precio al Cliente**

**Opción 1: Pay-per-use**
- Costo: $0.05/llamada
- Margen: 100% (2x)
- **Precio al cliente: €0.10/llamada**

**Opción 2: Plan mensual + uso**
- Fijo: €49/mes (incluye configuración, soporte, 100 llamadas)
- Extra: €0.12/llamada adicional
- Margen fijo: €39/mes + 140% por llamada

**Opción 3: Plan ilimitado**
- Fijo: €149/mes (hasta 500 llamadas)
- Extra: €0.15/llamada adicional
- Break-even: 3,000 llamadas/mes

### **ROI para el Restaurante**

**Escenario promedio: 50 llamadas/mes**

| Concepto | Sin Agente IA | Con Agente IA | Ahorro |
|----------|---------------|---------------|--------|
| **Tiempo empleado** | 25h/mes (30min/llamada) | 0h/mes | 25h/mes |
| **Costo laboral** | €300/mes (€12/h) | €0 | €300/mes |
| **Costo sistema IA** | €0 | €49/mes + €5 (50×€0.10) = €54/mes | - |
| **Ahorro neto** | - | - | **€246/mes** |
| **ROI** | - | **456%** | - |

### **Escalabilidad de Costos**

```
10 llamadas/mes:   €49 + €1   = €50  → €5/llamada
50 llamadas/mes:   €49 + €5   = €54  → €1.08/llamada
100 llamadas/mes:  €49 + €10  = €59  → €0.59/llamada (incluidas)
200 llamadas/mes:  €49 + €22  = €71  → €0.35/llamada
500 llamadas/mes:  €149       = €149 → €0.30/llamada (plan ilimitado)
1000 llamadas/mes: €149 + €75 = €224 → €0.22/llamada
```

**Conclusión:** Extremadamente rentable a partir de 50 llamadas/mes.

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **FASE 1: Configuración e Infraestructura (2-3 días)**

#### **Día 1: Setup Twilio Voice**
- [ ] Crear cuenta Twilio (si no existe)
- [ ] Comprar número de teléfono con capacidades Voice
- [ ] Configurar TwiML Application
- [ ] Configurar Media Streams (WebSocket URL)
- [ ] Testing básico: Llamar y recibir saludo

#### **Día 2: Setup Deepgram + OpenAI**
- [ ] Crear cuenta Deepgram
- [ ] Obtener API Key
- [ ] Testing STT: Audio → Texto
- [ ] Testing TTS: Texto → Audio (OpenAI)
- [ ] Validar latencias

#### **Día 3: Preparar N8N**
- [ ] Instalar/actualizar n8n a última versión
- [ ] Instalar ffmpeg en servidor N8N
- [ ] Configurar credenciales (Twilio, Deepgram, OpenAI, Supabase)
- [ ] Testing de conectividad

---

### **FASE 2: Desarrollo Workflows (3-4 días)**

#### **Día 4: Workflow Voice Gateway (Parte 1)**
- [ ] Crear `01-voz-gateway-streaming.json`
- [ ] Nodo 1: WebSocket Server (Twilio)
- [ ] Nodo 2: VAD (Voice Activity Detection)
- [ ] Nodo 3: STT (Deepgram)
- [ ] Testing: Audio → Texto funciona

#### **Día 5: Workflow Voice Gateway (Parte 2)**
- [ ] Nodo 4: Normalizar Input
- [ ] Nodo 5: Identificar Restaurante
- [ ] Nodo 6: Execute Workflow → Gateway Unificado
- [ ] Testing: Flujo completo hasta el agente

#### **Día 6: Workflow Voice Gateway (Parte 3)**
- [ ] Nodo 7: Procesar Respuesta del Agente
- [ ] Nodo 8: TTS (OpenAI)
- [ ] Nodo 9: Convertir Audio (ffmpeg)
- [ ] Nodo 10: Enviar a Twilio (WebSocket)
- [ ] Testing: Respuesta de audio funciona

#### **Día 7: Adaptaciones Gateway + Agent**
- [ ] Modificar `2-GATEWAY-FINAL-IMPORTAR.json` (añadir 'voice')
- [ ] Adaptar prompt en `3-super-agent-hibrido-FINAL-CORREGIDO.json`
- [ ] Añadir lógica de brevedad para voz
- [ ] Testing end-to-end: Llamada → Reserva creada

---

### **FASE 3: Testing y Optimización (2-3 días)**

#### **Día 8-9: Testing Exhaustivo**
- [ ] Test 1: Reserva nueva (éxito)
- [ ] Test 2: Reserva nueva (no disponible)
- [ ] Test 3: Modificar reserva
- [ ] Test 4: Cancelar reserva
- [ ] Test 5: Consulta información
- [ ] Test 6: Multiidioma (español, catalán, inglés)
- [ ] Test 7: Interrupciones
- [ ] Test 8: Ruido de fondo
- [ ] Test 9: Latencia (medir tiempos)
- [ ] Test 10: Llamadas simultáneas

#### **Día 10: Optimización**
- [ ] Reducir latencia (si >1.5s)
- [ ] Ajustar prompt (si respuestas muy largas)
- [ ] Calibrar VAD (si corta al cliente)
- [ ] Mejorar manejo de errores
- [ ] Logging y monitoreo

---

### **FASE 4: Producción y Monitoreo (Continuo)**

#### **Lanzamiento (Día 11)**
- [ ] Activar workflow en producción
- [ ] Configurar alertas (Twilio, N8N, Supabase)
- [ ] Documentar número de teléfono
- [ ] Comunicar a restaurante

#### **Monitoreo (Ongoing)**
- [ ] Dashboard de métricas (Grafana/Metabase)
- [ ] Revisar logs diarios
- [ ] Analizar conversaciones con problemas
- [ ] Optimización continua del prompt
- [ ] Reporte semanal de performance

---

## ⚙️ CONFIGURACIÓN TWILIO

### **Paso 1: Crear cuenta Twilio**

1. Ir a: https://www.twilio.com/try-twilio
2. Registrarse con email
3. Verificar teléfono
4. Obtener:
   - Account SID: `ACxxxxxxxxxxxx`
   - Auth Token: `xxxxxxxxxxxx`

### **Paso 2: Comprar número de teléfono**

```bash
# Con Twilio CLI
twilio phone-numbers:buy:local \
  --country-code ES \
  --sms-enabled \
  --voice-enabled \
  --area-code 34
```

O desde consola web:
1. Phone Numbers → Buy a Number
2. Filtros:
   - Country: Spain (+34)
   - Capabilities: Voice ✅, SMS ✅
3. Comprar número (€1-2/mes)

### **Paso 3: Configurar TwiML Application**

**Crear TwiML Bin para inicio de llamada:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Lucia" language="es-ES">
        Bienvenido a [NOMBRE_RESTAURANTE]. Un momento mientras te conecto con nuestro asistente virtual.
    </Say>
    <Connect>
        <Stream url="wss://n8n.tu-dominio.com/webhook/voice-stream">
            <Parameter name="restaurant_id" value="RESTAURANT_UUID" />
        </Stream>
    </Connect>
</Response>
```

**Configurar en número de teléfono:**
1. Phone Numbers → Manage → Active Numbers
2. Click en número comprado
3. Voice & Fax → A CALL COMES IN:
   - Webhook: `https://tu-twiml-bin-url` (TwiML Bin creado)
   - HTTP POST
4. Save

### **Paso 4: Testing inicial**

**Llamar al número y verificar:**
- ✅ Suena (no error)
- ✅ Se escucha saludo
- ✅ N8N recibe conexión WebSocket
- ✅ Logs en N8N muestran datos de llamada

---

## 🧪 TESTING Y VALIDACIÓN

### **Scripts de Testing**

#### **Test 1: STT (Deepgram)**

```bash
# test-stt.sh
curl -X POST "https://api.deepgram.com/v1/listen" \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @sample_audio.wav

# Resultado esperado:
# {
#   "results": {
#     "channels": [{
#       "alternatives": [{
#         "transcript": "Hola quiero hacer una reserva...",
#         "confidence": 0.98
#       }]
#     }]
#   }
# }
```

#### **Test 2: TTS (OpenAI)**

```bash
# test-tts.sh
curl -X POST "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "input": "¡Perfecto! Sí tenemos disponibilidad para mañana a las nueve de la noche.",
    "voice": "alloy"
  }' \
  --output test_output.mp3

# Reproducir audio:
ffplay test_output.mp3
```

#### **Test 3: Conversión Audio (ffmpeg)**

```bash
# test-audio-conversion.sh
# MP3 → μ-law 8kHz (formato Twilio)
ffmpeg -i test_output.mp3 -ar 8000 -ac 1 -f mulaw test_output.ulaw

# Verificar:
ffprobe test_output.ulaw
# Debe mostrar: sample_rate=8000, channels=1, codec=pcm_mulaw
```

#### **Test 4: Latencia End-to-End**

```javascript
// test-latency.js (ejecutar en N8N Code node)
const startTime = Date.now();

// 1. STT
const sttStart = Date.now();
const transcript = await callDeepgram(audioBuffer);
const sttDuration = Date.now() - sttStart;

// 2. Agent
const agentStart = Date.now();
const response = await callAgent(transcript);
const agentDuration = Date.now() - agentStart;

// 3. TTS
const ttsStart = Date.now();
const audio = await callOpenAITTS(response);
const ttsDuration = Date.now() - ttsStart;

const totalDuration = Date.now() - startTime;

console.log('🕐 Latencias:', {
  stt: `${sttDuration}ms`,
  agent: `${agentDuration}ms`,
  tts: `${ttsDuration}ms`,
  total: `${totalDuration}ms`,
  objetivo: '<1100ms',
  cumple: totalDuration < 1100 ? '✅' : '❌'
});
```

### **Checklist de Validación**

**Funcionalidad:**
- [ ] Llamada se conecta correctamente
- [ ] STT transcribe con >90% precisión
- [ ] Agente responde coherentemente
- [ ] TTS suena natural (no robótico)
- [ ] Reserva se crea en BD correctamente
- [ ] Multiidioma funciona (es, ca, en, fr)

**Performance:**
- [ ] Latencia total <1.5s
- [ ] No hay cortes de audio
- [ ] WebSocket es estable (no desconecta)
- [ ] Maneja interrupciones correctamente

**Robustez:**
- [ ] Maneja ruido de fondo
- [ ] Maneja acentos regionales
- [ ] Recupera de errores STT/TTS
- [ ] Timeout si cliente no habla (30s)

**Costos:**
- [ ] Costo/llamada <$0.06
- [ ] No hay llamadas de más de $0.10

---

## 📚 DOCUMENTOS RELACIONADOS

- **Sistema N8N Agente IA:** `docs/02-sistemas/SISTEMA-N8N-AGENTE-IA.md`
- **Prompt v12 Agente:** `n8n/prompts/PROMPT-SUPER-AGENT-v12-OPTIMIZADO.txt`
- **Workflows existentes:** `n8n/workflows/`
- **Base de datos:** `docs/01-arquitectura/DATABASE-SCHEMA-SUPABASE-COMPLETO.md`
- **NORMAS SAGRADAS:** `docs/04-desarrollo/NORMAS_SAGRADAS.md`

---

## ✅ PRÓXIMOS PASOS

1. **Confirmar:** ¿Twilio Voice ya configurado? → Si NO, seguir guía de configuración
2. **Crear workflow:** `01-voz-gateway-streaming.json` (siguiente documento)
3. **Adaptar prompts:** Modificar Agent 03 para brevedad en voz
4. **Testing:** Validar cada componente
5. **Producción:** Lanzar y monitorear

---

**Documento creado:** 23 de Octubre de 2025  
**Estado:** ✅ ARQUITECTURA COMPLETA  
**Listo para implementación:** SÍ  
**Próximo paso:** Crear workflow `01-voz-gateway-streaming.json`

**¡VAMOS A CREAR EL MEJOR SISTEMA DE VOZ DEL MUNDO! 🚀🎤**



