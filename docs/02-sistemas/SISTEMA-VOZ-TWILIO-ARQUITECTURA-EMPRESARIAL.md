# 🎙️ ARQUITECTURA EMPRESARIAL - SISTEMA DE VOZ TWILIO

> **Fecha:** 22 Octubre 2025  
> **Versión:** 1.0  
> **Objetivo:** La mejor plataforma de gestión de reservas por voz del mundo  
> **Estado:** 🎯 Diseño Arquitectónico

---

## 📋 ÍNDICE

1. [Visión Estratégica](#visión-estratégica)
2. [Arquitectura de Alto Nivel](#arquitectura-de-alto-nivel)
3. [Decisiones Arquitectónicas Clave](#decisiones-arquitectónicas-clave)
4. [Stack Tecnológico](#stack-tecnológico)
5. [Workflows N8N](#workflows-n8n)
6. [Flujo de Datos Completo](#flujo-de-datos-completo)
7. [Gestión de Conversaciones](#gestión-de-conversaciones)
8. [Latencia y Performance](#latencia-y-performance)
9. [Escalabilidad](#escalabilidad)
10. [Monitorización y Observabilidad](#monitorización-y-observabilidad)
11. [Plan de Implementación](#plan-de-implementación)

---

## 🎯 VISIÓN ESTRATÉGICA

### Objetivo Principal

Crear un **agente de voz unificado** que:
- ✅ Comparte la **misma lógica de negocio** que WhatsApp
- ✅ Mantiene **conversaciones naturales** sin latencias perceptibles
- ✅ Es **multi-tenant** desde el origen
- ✅ Escala a **millones de llamadas/mes**
- ✅ Proporciona **observabilidad completa**

### Principios de Diseño

1. **Un Único Agente** - La misma IA para todos los canales
2. **Conversaciones Naturales** - El usuario no debe notar que habla con IA
3. **Arquitectura Modular** - Cada componente con responsabilidad única
4. **Datos Reales Siempre** - Sin mocks, sin hardcoded values
5. **Observabilidad Total** - Cada llamada trazable end-to-end
6. **Performance Primero** - Latencia < 2 segundos total

---

## 🏗️ ARQUITECTURA DE ALTO NIVEL

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENTE (LLAMADA)                            │
│                    Marca: +34 XXX XXX XXX                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TWILIO VOICE                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  1. Voice API (TwiML)                                   │    │
│  │  2. Media Streams (WebSocket bidireccional)            │    │
│  │  3. Speech Recognition (Google/Deepgram)               │    │
│  │  4. Text-to-Speech (ElevenLabs/Google)                │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              N8N: WORKFLOW 04 - VOICE ORCHESTRATOR              │
│                    (Orquestador de Voz)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RESPONSABILIDADES:                                      │   │
│  │  • Gestionar stream de audio bidireccional              │   │
│  │  • Speech-to-Text (STT) en tiempo real                  │   │
│  │  • Detección de pausas (VAD)                            │   │
│  │  • Text-to-Speech (TTS)                                 │   │
│  │  • Manejo de interrupciones                             │   │
│  │  • Gestión de sesión de llamada                         │   │
│  │  • Logging y telemetría                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              N8N: WORKFLOW 05 - VOICE PREPROCESSOR              │
│                    (Preprocesador de Voz)                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RESPONSABILIDADES:                                      │   │
│  │  • Normalización de transcripciones                     │   │
│  │  • Corrección de errores STT                            │   │
│  │  • Detección de idioma                                  │   │
│  │  • Traducción (si necesario)                            │   │
│  │  • Extracción de metadatos de llamada                   │   │
│  │  • Formateo para Gateway                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              N8N: WORKFLOW 02 - GATEWAY UNIFICADO               │
│                    (EXISTENTE - SIN CAMBIOS)                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Obtener/Crear Cliente                                │   │
│  │  • Crear Conversación                                   │   │
│  │  • Guardar Mensaje                                      │   │
│  │  • Enriquecer Contexto                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           N8N: WORKFLOW 03 - SUPER AGENT HÍBRIDO                │
│                    (EXISTENTE - SIN CAMBIOS)                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Procesamiento IA (GPT-4o)                            │   │
│  │  • Lógica de negocio de reservas                        │   │
│  │  • Tools: check_availability, create_reservation        │   │
│  │  • Memoria conversacional                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              N8N: WORKFLOW 06 - VOICE POSTPROCESSOR             │
│                    (Postprocesador de Voz)                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RESPONSABILIDADES:                                      │   │
│  │  • Adaptar respuesta para voz                           │   │
│  │  • Simplificar lenguaje (quitar emojis, markdown)       │   │
│  │  • Añadir pausas naturales (SSML)                       │   │
│  │  • Optimizar longitud de respuesta                      │   │
│  │  • Preparar para TTS                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              N8N: WORKFLOW 04 - VOICE ORCHESTRATOR              │
│                    (Regreso al orquestador)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Convierte texto → audio (TTS)                        │   │
│  │  • Envía audio a Twilio                                 │   │
│  │  • Actualiza estado de conversación                     │   │
│  │  • Espera siguiente input del cliente                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│                                                                   │
│  Tablas:                                                         │
│  • agent_conversations (source_channel: 'voice')                │
│  • agent_messages (mensajes de la llamada)                      │
│  • voice_call_sessions (NUEVA - metadata de llamadas)           │
│  • voice_transcripts (NUEVA - transcripciones completas)        │
│  • customers (clientes)                                          │
│  • reservations (reservas)                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 DECISIONES ARQUITECTÓNICAS CLAVE

### 1. ¿Un Workflow o Múltiples?

**DECISIÓN: 4 Workflows Especializados**

#### Workflow 04: Voice Orchestrator (Orquestador Principal)
- **Responsabilidad única:** Gestión de conexión Twilio + Audio I/O
- **Entrada:** Llamada telefónica de Twilio
- **Salida:** Audio de respuesta a Twilio
- **Estado:** Mantiene sesión de llamada activa

#### Workflow 05: Voice Preprocessor (Preprocesador)
- **Responsabilidad única:** Limpieza y normalización de voz → texto
- **Entrada:** Transcripción cruda de STT
- **Salida:** Texto limpio formateado para Gateway
- **Sin estado:** Procesa y pasa al siguiente

#### Workflow 02: Gateway Unificado (EXISTENTE)
- **Sin cambios:** Ya maneja WhatsApp, añadimos `source_channel: 'voice'`
- **Responsabilidad:** Gestión de clientes y conversaciones

#### Workflow 03: Super Agent Híbrido (EXISTENTE)
- **Sin cambios:** La misma lógica de negocio
- **Responsabilidad:** IA conversacional y tools de reservas

#### Workflow 06: Voice Postprocessor (Postprocesador)
- **Responsabilidad única:** Adaptar respuestas texto → audio natural
- **Entrada:** Respuesta del agente (texto)
- **Salida:** Texto optimizado para TTS con SSML

### 2. ¿WebSocket o Request-Response?

**DECISIÓN: Híbrido - WebSocket para Audio, HTTP para Lógica**

#### WebSocket (Twilio Media Streams)
```
CLIENTE ←→ TWILIO ←→ N8N (WS Server)
         Audio            Audio chunks
    (bidireccional)   (tiempo real)
```

**Ventajas:**
- ✅ Latencia ultra-baja (<500ms)
- ✅ Permite interrupciones del usuario
- ✅ Stream continuo sin reconectar

**Desventajas:**
- ⚠️ Más complejo de implementar
- ⚠️ Requiere gestión de estado de conexión

#### HTTP (Lógica de Negocio)
```
Voice Preprocessor → Gateway → Agent → Postprocessor
         (HTTP)        (HTTP)   (HTTP)      (HTTP)
```

**Ventajas:**
- ✅ Stateless (más fácil de escalar)
- ✅ Workflows N8N existentes funcionan sin cambios
- ✅ Más fácil de debuggear

### 3. ¿Qué proveedor de STT/TTS?

**DECISIÓN: Twilio + ElevenLabs (Tier 1) / Google (Tier 2)**

#### Speech-to-Text (STT)

**Opción A: Twilio STT (Powered by Google)**
- Latencia: ~1-1.5s
- Precisión: Alta (90-95%)
- Coste: $0.006/15s = ~$1.44/hora
- ✅ **RECOMENDADO para MVP**

**Opción B: Deepgram**
- Latencia: ~0.3-0.5s (MÁS RÁPIDO)
- Precisión: Muy alta (93-97%)
- Coste: $0.0043/min = ~$0.26/hora
- 🎯 **RECOMENDADO para producción**

#### Text-to-Speech (TTS)

**Opción A: ElevenLabs**
- Calidad: ⭐⭐⭐⭐⭐ (Más natural del mercado)
- Latencia: ~1-2s
- Coste: $0.30/1000 chars = ~$9/hora (conversación intensiva)
- 🎯 **RECOMENDADO para experiencia premium**

**Opción B: Google Cloud TTS (Neural2)**
- Calidad: ⭐⭐⭐⭐ (Muy buena)
- Latencia: ~0.5-1s
- Coste: $16/1M chars = ~$1.20/hora
- ✅ **RECOMENDADO para volumen alto**

**Opción C: Twilio TTS (Amazon Polly)**
- Calidad: ⭐⭐⭐ (Aceptable)
- Latencia: ~0.3s
- Coste: Incluido en Twilio
- ⚠️ **Solo para testing**

### 4. ¿Cómo manejar pausas y turnos?

**DECISIÓN: VAD (Voice Activity Detection) con Timeout Inteligente**

```javascript
// Configuración de pausas
const PAUSE_CONFIG = {
  // Tiempo de silencio para considerar que el usuario terminó
  speech_timeout: 1.2,  // segundos
  
  // Tiempo máximo esperando input del usuario
  input_timeout: 5,     // segundos
  
  // Si detecta inicio de habla, permite interrumpir al agente
  barge_in: true,
  
  // Modelo de detección
  vad_model: 'silero-v4'  // Estado del arte
};
```

#### Flujo de Detección de Pausas

```
CLIENTE HABLA: "Hola quiero hacer una reserva..."
              ↓
┌─────────────────────────────────────┐
│ VAD detecta voz activa              │
│ → Sigue escuchando                  │
└─────────────────────────────────────┘
              ↓
CLIENTE PAUSA: [silencio 1.2s]
              ↓
┌─────────────────────────────────────┐
│ VAD detecta pausa > 1.2s            │
│ → Envía audio a STT                 │
│ → Procesa mensaje                   │
└─────────────────────────────────────┘
              ↓
AGENTE RESPONDE: "¡Perfecto! ¿Para cuántas personas?"
              ↓
┌─────────────────────────────────────┐
│ TTS genera audio                    │
│ → Envía a Twilio                    │
│ → Cliente escucha                   │
└─────────────────────────────────────┘
              ↓
CLIENTE INTERRUMPE: "Espera, mejor..."
              ↓
┌─────────────────────────────────────┐
│ VAD detecta voz (barge_in: true)   │
│ → PARA reproducción del agente      │
│ → Escucha al cliente                │
└─────────────────────────────────────┘
```

---

## 🛠️ STACK TECNOLÓGICO

### Infraestructura de Voz

| Componente | Tecnología | Propósito |
|-----------|-----------|----------|
| **Voice Gateway** | Twilio Programmable Voice | Recepción de llamadas |
| **Media Streaming** | Twilio Media Streams (WebSocket) | Audio bidireccional |
| **Speech-to-Text** | Deepgram Nova-2 | Transcripción tiempo real |
| **Text-to-Speech** | ElevenLabs Multilingual v2 | Síntesis de voz natural |
| **VAD** | Silero VAD v4 | Detección de actividad de voz |

### Orquestación y Lógica

| Componente | Tecnología | Propósito |
|-----------|-----------|----------|
| **Workflow Engine** | N8N (self-hosted) | Orquestación de workflows |
| **AI Agent** | OpenAI GPT-4o | Lógica conversacional |
| **Memory** | Langchain Buffer Window | Contexto conversacional |
| **Database** | Supabase (PostgreSQL) | Persistencia de datos |
| **Cache** | Redis (opcional Fase 2) | Cache de sessiones activas |

### Monitorización

| Componente | Tecnología | Propósito |
|-----------|-----------|----------|
| **Logging** | N8N Execution Logs | Debugging de workflows |
| **APM** | Sentry (opcional) | Error tracking |
| **Metrics** | Custom Supabase queries | KPIs de negocio |
| **Call Recording** | Twilio Recording API | Auditoría y calidad |

---

## 📝 WORKFLOWS N8N

### Workflow 04: Voice Orchestrator

**Archivo:** `n8n/workflows/04-voice-orchestrator-FINAL.json`

#### Nodos Principales

```
1. 📞 Webhook: Incoming Call (Twilio)
   ↓
2. 🔍 Identify Restaurant (by phone number)
   ↓
3. 🎙️ WebSocket Server (Start Media Stream)
   ↓
4. 🔊 STT Stream (Deepgram/Google)
   ↓
5. ⏸️ VAD: Detect Pause
   ↓
6. 📝 Accumulate Speech Segments
   ↓
7. ✅ When Pause Detected → Execute Voice Preprocessor
   ↓
8. 🔄 Loop: Listen → Process → Respond
   ↓
9. 🔚 Call Ended → Save Call Summary
```

#### Código Clave: Gestión de Stream

```javascript
// NODO: WebSocket Server (Start Media Stream)
const WebSocket = require('ws');
const callSid = $input.first().json.CallSid;

// Crear server WebSocket para esta llamada
const wss = new WebSocket.Server({ 
  port: 0,  // Puerto dinámico
  clientTracking: true
});

let audioChunks = [];
let isClientSpeaking = false;
let silenceTimeout = null;

wss.on('connection', (ws) => {
  console.log(`📞 Stream conectado para ${callSid}`);
  
  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    
    switch(msg.event) {
      case 'media':
        // Audio del cliente (base64)
        const audioData = msg.media.payload;
        audioChunks.push(audioData);
        
        // Enviar a Deepgram para STT en tiempo real
        deepgramStream.write(Buffer.from(audioData, 'base64'));
        
        // Resetear timeout de silencio
        clearTimeout(silenceTimeout);
        isClientSpeaking = true;
        
        silenceTimeout = setTimeout(() => {
          // Usuario dejó de hablar
          isClientSpeaking = false;
          processSpeech(audioChunks);
          audioChunks = [];
        }, 1200); // 1.2s de silencio
        break;
        
      case 'start':
        console.log('▶️ Stream iniciado');
        break;
        
      case 'stop':
        console.log('⏹️ Stream terminado');
        break;
    }
  });
});

return {
  wsUrl: `ws://localhost:${wss.address().port}`,
  callSid,
  sessionId: `voice_${callSid}_${Date.now()}`
};
```

#### TwiML de Respuesta Inicial

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lucia-Neural" language="es-ES">
    Bienvenido a {{ restaurant.name }}. Soy {{ agent_name }}, tu asistente virtual. 
    ¿En qué puedo ayudarte?
  </Say>
  <Connect>
    <Stream url="{{ wsUrl }}">
      <Parameter name="restaurant_id" value="{{ restaurant_id }}" />
      <Parameter name="session_id" value="{{ sessionId }}" />
    </Stream>
  </Connect>
</Response>
```

---

### Workflow 05: Voice Preprocessor

**Archivo:** `n8n/workflows/05-voice-preprocessor-FINAL.json`

#### Nodos Principales

```
1. ▶️ Start (from Voice Orchestrator)
   ↓
2. 📝 Extract Transcription
   ↓
3. 🧹 Clean Transcription
   ↓
4. 🌍 Detect Language
   ↓
5. 🔧 Normalize Text (números, fechas, horas)
   ↓
6. 📊 Add Voice Metadata
   ↓
7. ✅ Format for Gateway
   ↓
8. 🚀 Execute Gateway Workflow
```

#### Código Clave: Limpieza de Transcripción

```javascript
// NODO: 🧹 Clean Transcription
const raw = $input.first().json.transcription;

console.log('🎤 Transcripción cruda:', raw);

// 1. Eliminar muletillas comunes en español
let cleaned = raw
  .replace(/\b(eh|um|uh|mm|ah|este|pues|bueno|o sea)\b/gi, '')
  .replace(/\s+/g, ' ')
  .trim();

// 2. Corregir errores comunes de STT en español
const STT_CORRECTIONS = {
  // Números
  'dos personas': '2 personas',
  'tres personas': '3 personas',
  'cuatro personas': '4 personas',
  'cinco personas': '5 personas',
  'seis personas': '6 personas',
  'siete personas': '7 personas',
  'ocho personas': '8 personas',
  
  // Horas
  'ocho de la mañana': '08:00',
  'nueve de la mañana': '09:00',
  'diez de la mañana': '10:00',
  'once de la mañana': '11:00',
  'doce del mediodía': '12:00',
  'una del mediodía': '13:00',
  'dos de la tarde': '14:00',
  'tres de la tarde': '15:00',
  'cuatro de la tarde': '16:00',
  'cinco de la tarde': '17:00',
  'seis de la tarde': '18:00',
  'siete de la tarde': '19:00',
  'ocho de la tarde': '20:00',
  'nueve de la noche': '21:00',
  'diez de la noche': '22:00',
  'once de la noche': '23:00',
  
  // Horas con "y media"
  'ocho y media de la noche': '20:30',
  'nueve y media de la noche': '21:30',
  'ocho y media de la tarde': '20:30',
  
  // Días
  'boy': 'hoy',  // Error común STT
  'mallana': 'mañana',  // Error común STT
  'pasado mallana': 'pasado mañana',
  
  // Palabras confusas
  'desear': 'cenar',
  'reservación': 'reserva',
  'persona': 'personas'  // singular → plural
};

for (const [error, correcto] of Object.entries(STT_CORRECTIONS)) {
  const regex = new RegExp(`\\b${error}\\b`, 'gi');
  cleaned = cleaned.replace(regex, correcto);
}

// 3. Capitalizar primera letra
cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

console.log('✅ Transcripción limpia:', cleaned);

return {
  original_transcription: raw,
  cleaned_transcription: cleaned,
  corrections_applied: Object.keys(STT_CORRECTIONS).filter(key => 
    raw.toLowerCase().includes(key)
  )
};
```

#### Código Clave: Formateo para Gateway

```javascript
// NODO: ✅ Format for Gateway
const input = $input.first().json;

// Formato exacto que espera el Gateway
const formatted = {
  // Identificadores
  channel: 'voice',
  restaurant_id: input.restaurant_id,
  customer_phone: input.customer_phone,
  customer_name: input.customer_name || 'Cliente',
  
  // Mensaje procesado
  aggregated_messages: input.cleaned_transcription,
  
  // Metadata de voz
  voice_metadata: {
    call_sid: input.call_sid,
    session_id: input.session_id,
    language_detected: input.language || 'es',
    transcription_confidence: input.confidence || 0.85,
    duration_seconds: input.duration || 0,
    corrections_applied: input.corrections_applied || []
  },
  
  // Timestamp
  timestamp: new Date().toISOString()
};

console.log('📦 Enviando al Gateway:', formatted);

return formatted;
```

---

### Workflow 06: Voice Postprocessor

**Archivo:** `n8n/workflows/06-voice-postprocessor-FINAL.json`

#### Nodos Principales

```
1. ▶️ Start (from Agent Response)
   ↓
2. 📝 Extract Agent Response
   ↓
3. 🧹 Clean for Voice (remove emojis, markdown)
   ↓
4. ✂️ Simplify Language (más directo para voz)
   ↓
5. ⏸️ Add Natural Pauses (SSML)
   ↓
6. 📏 Optimize Length (max 200 caracteres por chunk)
   ↓
7. 🔊 Prepare for TTS
   ↓
8. ↩️ Return to Voice Orchestrator
```

#### Código Clave: Adaptación Texto → Voz

```javascript
// NODO: 🧹 Clean for Voice
const agentResponse = $input.first().json.response;

console.log('💬 Respuesta original:', agentResponse);

// 1. Eliminar emojis
let cleaned = agentResponse.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');

// 2. Eliminar markdown
cleaned = cleaned
  .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
  .replace(/\*(.*?)\*/g, '$1')      // *italic* → italic
  .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // [link](url) → link
  .replace(/`(.*?)`/g, '$1')        // `code` → code
  .replace(/#{1,6}\s/g, '');        // # headers → sin #

// 3. Reemplazar "WhatsApp" por "mensaje"
cleaned = cleaned.replace(/WhatsApp/gi, 'mensaje');

// 4. Acortar frases largas
cleaned = cleaned
  .replace('⚠️ IMPORTANTE:', 'Importante:')
  .replace('Por favor, respóndenos para mantener tu reserva', 'Respóndenos para confirmar')
  .replace('Si necesitas algo más, aquí estoy', '¿Algo más en lo que pueda ayudarte?');

console.log('✅ Texto limpio:', cleaned);

return {
  original: agentResponse,
  cleaned: cleaned
};
```

#### Código Clave: SSML con Pausas Naturales

```javascript
// NODO: ⏸️ Add Natural Pauses (SSML)
const text = $input.first().json.cleaned;

// Añadir pausas naturales con SSML
const ssml = `<speak>
  ${text
    .replace(/\. /g, '.<break time="500ms"/> ')  // Pausa después de punto
    .replace(/\? /g, '?<break time="600ms"/> ')  // Pausa después de pregunta
    .replace(/! /g, '!<break time="500ms"/> ')   // Pausa después de exclamación
    .replace(/: /g, ':<break time="300ms"/> ')   // Pausa después de dos puntos
    .replace(/; /g, ';<break time="400ms"/> ')   // Pausa después de punto y coma
  }
</speak>`;

// Énfasis en palabras clave
const enhanced = ssml
  .replace(/(\d+ de \w+)/g, '<emphasis level="moderate">$1</emphasis>')  // Fechas
  .replace(/(\d{1,2}:\d{2})/g, '<emphasis level="moderate">$1</emphasis>')  // Horas
  .replace(/(confirmad[oa])/gi, '<emphasis level="strong">$1</emphasis>');  // "confirmado"

console.log('🎙️ SSML generado:', enhanced);

return {
  plain_text: text,
  ssml: enhanced,
  estimated_duration: text.length / 15  // ~15 caracteres por segundo
};
```

---

## 🔄 FLUJO DE DATOS COMPLETO

### Ejemplo Real: "Quiero reservar para 4 personas mañana a las 9 de la noche"

#### Fase 1: Recepción de Llamada (Workflow 04)

```
00:00 - Cliente marca +34 XXX XXX XXX
      ↓
00:01 - Twilio recibe llamada
      - Webhook → N8N Workflow 04
      ↓
00:02 - Workflow 04:
      - Identifica restaurante por número
      - Inicia WebSocket para Media Stream
      - Responde TwiML con saludo
      ↓
00:03 - Twilio reproduce:
      "Bienvenido a La Toscana. Soy María, tu asistente virtual. ¿En qué puedo ayudarte?"
      ↓
00:06 - Cliente habla: "Quiero reservar para 4 personas mañana a las 9 de la noche"
```

#### Fase 2: Procesamiento de Voz (Workflows 04 + 05)

```
00:06 - Audio stream → Deepgram STT
      ↓
00:07.5 - Deepgram retorna (1.5s latencia):
        "quiero reservar para cuatro personas mallana a las nueve de la noche"
      ↓
00:07.6 - Workflow 05 (Voice Preprocessor):
        - Limpia: "Quiero reservar para 4 personas mañana a las 21:00"
        - Detecta idioma: es
        - Formatea para Gateway
      ↓
00:07.8 - Ejecuta Gateway (Workflow 02):
        - Busca/crea cliente
        - Crea conversación (source_channel: 'voice')
        - Guarda mensaje
```

#### Fase 3: Lógica de Negocio (Workflow 03)

```
00:08 - Super Agent recibe:
      {
        "user_message": "Quiero reservar para 4 personas mañana a las 21:00",
        "channel": "voice",
        "customer_name": "Cliente",
        ...
      }
      ↓
00:08.5 - Agent procesa con GPT-4o:
        - Extrae: party_size=4, date=mañana, time=21:00
        - Falta: zona
        - Genera respuesta
      ↓
00:09.5 - Agent responde:
        "¡Perfecto! Para 4 personas mañana viernes 18 de octubre a las 21:00. 
        ¿Tienes preferencia de zona? Tenemos interior, terraza o sala privada."
```

#### Fase 4: Síntesis de Voz (Workflows 06 + 04)

```
00:09.6 - Workflow 06 (Voice Postprocessor):
        - Limpia respuesta (sin emojis)
        - Añade SSML con pausas
        - Optimiza para voz
      ↓
00:10 - Workflow 04:
      - Envía texto a ElevenLabs TTS
      ↓
00:11.5 - ElevenLabs retorna audio (1.5s)
      ↓
00:11.6 - Twilio reproduce audio al cliente
      ↓
00:15 - Cliente escucha la respuesta completa
```

#### Timing Total: **00:00 → 00:15 = 15 segundos**

**Desglose:**
- Saludo inicial: 3s
- Cliente habla: 3s
- STT + Procesamiento: 1.5s
- Lógica IA: 1.5s
- TTS + Reproducción: 6s
- **Latencia percibida por el usuario: ~3s** (desde que termina de hablar hasta que escucha respuesta)

---

## ⚡ LATENCIA Y PERFORMANCE

### Objetivos de Latencia

| Componente | Target | Máximo Aceptable |
|-----------|--------|------------------|
| **STT (Deepgram)** | 0.5s | 1.5s |
| **Preprocessing** | 0.1s | 0.3s |
| **Gateway + Agent** | 1.0s | 2.0s |
| **Postprocessing** | 0.1s | 0.3s |
| **TTS (ElevenLabs)** | 1.0s | 2.0s |
| **TOTAL (Percibido)** | **2.7s** | **6.0s** |

### Optimizaciones de Performance

#### 1. Streaming TTS
```javascript
// En lugar de esperar todo el audio:
// ❌ MAL: Esperar respuesta completa → TTS → reproducir
// ✅ BIEN: Streaming TTS

const stream = await elevenLabs.textToSpeechStream({
  text: agentResponse,
  voice_id: 'Rachel',  // Voz natural
  model_id: 'eleven_multilingual_v2',
  stream: true  // ← CRÍTICO
});

// Enviar chunks de audio a Twilio sin esperar
stream.on('data', (chunk) => {
  twilioStream.write(chunk);  // Cliente empieza a escuchar ANTES
});
```

**Reducción de latencia percibida: 2s → 0.5s**

#### 2. Parallel Processing
```javascript
// ❌ MAL: Secuencial
const cleaned = await preprocess(text);
const response = await agent(cleaned);
const voiced = await postprocess(response);

// ✅ BIEN: Gateway y preparación de TTS en paralelo
const [response, ttsPrep] = await Promise.all([
  agent(cleaned),
  prepareTTSConfig(restaurant)  // Pre-cargar config mientras IA procesa
]);
```

#### 3. Caché de Respuestas Comunes
```javascript
// Preguntas frecuentes: caché de audio pre-generado
const CACHED_RESPONSES = {
  'horarios': 'audio_horarios_es.mp3',
  'ubicacion': 'audio_ubicacion_es.mp3',
  'menu': 'audio_menu_es.mp3'
};

if (intent === 'consulta_horarios') {
  // Servir audio pre-generado (latencia: 50ms)
  return getCachedAudio('horarios');
}
```

---

## 📈 ESCALABILIDAD

### Arquitectura Escalable

```
┌─────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                        │
│                   (Twilio - Built-in)                   │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  N8N Node 1  │ │  N8N Node 2  │ │  N8N Node 3  │
│  (Workflow)  │ │  (Workflow)  │ │  (Workflow)  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                ┌──────────────┐
                │   Supabase   │
                │  (Managed)   │
                └──────────────┘
```

### Capacidad por Fase

#### Fase 1: MVP (Single Node)
- **Llamadas simultáneas:** 10-20
- **Llamadas/día:** 500-1,000
- **Llamadas/mes:** 15,000-30,000
- **Coste mensual:** ~$500-1,000

#### Fase 2: Crecimiento (3 Nodes)
- **Llamadas simultáneas:** 50-100
- **Llamadas/día:** 3,000-5,000
- **Llamadas/mes:** 90,000-150,000
- **Coste mensual:** ~$2,500-5,000

#### Fase 3: Escala (Auto-scaling)
- **Llamadas simultáneas:** 500+
- **Llamadas/día:** 50,000+
- **Llamadas/mes:** 1,500,000+
- **Coste mensual:** ~$25,000-50,000

### Límites y Cuellos de Botella

| Componente | Límite | Solución |
|-----------|--------|----------|
| **Deepgram** | 1000 req/s | Sin problema (muy alto) |
| **ElevenLabs** | 100 req/s | Usar Google TTS como fallback |
| **OpenAI GPT-4o** | 10,000 TPM | Suficiente (cada llamada ~500 tokens) |
| **N8N Workflow** | ~50 ejecuciones simultáneas/node | Horizontal scaling (más nodes) |
| **Supabase** | 200 conexiones | Connection pooling |
| **Twilio** | Sin límite (pago por uso) | Sin problema |

---

## 📊 MONITORIZACIÓN Y OBSERVABILIDAD

### Métricas Clave

#### 1. Métricas de Performance

```sql
-- Dashboard: Latencias por componente
CREATE VIEW voice_performance_metrics AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  AVG((metadata->'timings'->>'stt_latency_ms')::int) as avg_stt_ms,
  AVG((metadata->'timings'->>'agent_latency_ms')::int) as avg_agent_ms,
  AVG((metadata->'timings'->>'tts_latency_ms')::int) as avg_tts_ms,
  AVG((metadata->'timings'->>'total_latency_ms')::int) as avg_total_ms,
  COUNT(*) as total_calls
FROM voice_call_sessions
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

#### 2. Métricas de Negocio

```sql
-- Dashboard: Conversión de llamadas
SELECT 
  COUNT(*) FILTER (WHERE outcome = 'reservation_created') as reservations,
  COUNT(*) FILTER (WHERE outcome = 'inquiry_answered') as inquiries,
  COUNT(*) FILTER (WHERE outcome = 'escalated') as escalated,
  COUNT(*) FILTER (WHERE outcome = 'abandoned') as abandoned,
  COUNT(*) as total_calls,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'reservation_created')::decimal / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as conversion_rate
FROM agent_conversations
WHERE source_channel = 'voice'
  AND created_at >= NOW() - INTERVAL '7 days';
```

#### 3. Métricas de Calidad

```sql
-- Dashboard: Calidad de transcripciones
SELECT 
  AVG((metadata->'stt'->'confidence')::float) as avg_confidence,
  COUNT(*) FILTER (WHERE (metadata->'stt'->'confidence')::float < 0.7) as low_confidence_count,
  AVG(ARRAY_LENGTH((metadata->'corrections_applied')::text[], 1)) as avg_corrections
FROM agent_messages
WHERE direction = 'inbound'
  AND metadata->>'channel' = 'voice'
  AND timestamp >= NOW() - INTERVAL '24 hours';
```

### Alertas Críticas

```javascript
// Configurar en N8N (Workflow 99: Error Notifier)

const ALERTS = {
  // Latencia alta
  high_latency: {
    condition: 'total_latency_ms > 6000',
    severity: 'warning',
    action: 'notify_ops'
  },
  
  // Tasa de error alta
  high_error_rate: {
    condition: 'error_rate > 0.05',  // >5%
    severity: 'critical',
    action: 'escalate_to_human'
  },
  
  // Transcripciones de baja confianza
  low_stt_confidence: {
    condition: 'stt_confidence < 0.6',
    severity: 'warning',
    action: 'log_for_review'
  },
  
  // Llamadas abandonadas
  high_abandonment: {
    condition: 'abandonment_rate > 0.20',  // >20%
    severity: 'critical',
    action: 'investigate_immediately'
  }
};
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: MVP Funcional (2 semanas)

#### Semana 1: Infraestructura Base
- [ ] Configurar cuenta Twilio
- [ ] Comprar número telefónico
- [ ] Configurar Deepgram API
- [ ] Configurar ElevenLabs API
- [ ] Crear tabla `voice_call_sessions` en Supabase
- [ ] Crear tabla `voice_transcripts` en Supabase

#### Semana 2: Workflows Core
- [ ] Workflow 04: Voice Orchestrator (básico)
  - Webhook Twilio
  - Media Stream WebSocket
  - STT con Deepgram
  - TTS con ElevenLabs
- [ ] Workflow 05: Voice Preprocessor
  - Limpieza de transcripciones
  - Normalización de texto
  - Formateo para Gateway
- [ ] Workflow 06: Voice Postprocessor
  - Adaptación texto → voz
  - SSML básico
- [ ] Integración con Gateway (Workflow 02) - modificación mínima
- [ ] Testing end-to-end

**Entregable:** Llamar al número → Reservar con IA por voz

---

### Fase 2: Optimización (2 semanas)

#### Semana 3: Performance
- [ ] Implementar Streaming TTS
- [ ] Parallel processing (Gateway + TTS prep)
- [ ] Caché de respuestas comunes
- [ ] Optimizar prompts para voz
- [ ] Reducir latencia a <3s

#### Semana 4: UX y Calidad
- [ ] VAD con Silero v4
- [ ] Barge-in (interrupciones)
- [ ] SSML avanzado (pausas naturales)
- [ ] Manejo de errores graceful
- [ ] Fallbacks inteligentes

**Entregable:** Conversaciones naturales <3s latencia

---

### Fase 3: Escala y Producción (2 semanas)

#### Semana 5: Observabilidad
- [ ] Dashboard de métricas en tiempo real
- [ ] Alertas automáticas
- [ ] Call recording y auditoría
- [ ] Logs estructurados
- [ ] Tracing end-to-end

#### Semana 6: Escalabilidad
- [ ] N8N clustering (3 nodes)
- [ ] Connection pooling Supabase
- [ ] Redis cache para sesiones
- [ ] Load testing (100 llamadas simultáneas)
- [ ] Disaster recovery plan

**Entregable:** Sistema listo para producción

---

## 📋 TABLAS NUEVAS EN SUPABASE

### Tabla: `voice_call_sessions`

```sql
-- Metadata de cada llamada telefónica
CREATE TABLE voice_call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    conversation_id UUID REFERENCES agent_conversations(id),
    
    -- Twilio data
    call_sid VARCHAR NOT NULL UNIQUE,
    from_number VARCHAR NOT NULL,
    to_number VARCHAR NOT NULL,
    
    -- Timing
    call_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    call_ended_at TIMESTAMPTZ,
    call_duration_seconds INTEGER,
    
    -- STT/TTS providers
    stt_provider VARCHAR NOT NULL DEFAULT 'deepgram',
    tts_provider VARCHAR NOT NULL DEFAULT 'elevenlabs',
    
    -- Quality metrics
    avg_stt_confidence DECIMAL(3,2),
    total_stt_corrections INTEGER DEFAULT 0,
    
    -- Performance
    timings JSONB DEFAULT '{}',
    -- {
    --   "stt_latency_ms": 1200,
    --   "agent_latency_ms": 1500,
    --   "tts_latency_ms": 1000,
    --   "total_latency_ms": 3700
    -- }
    
    -- Recording
    recording_url TEXT,
    recording_duration_seconds INTEGER,
    
    -- Status
    call_status VARCHAR NOT NULL DEFAULT 'in_progress',
    -- in_progress, completed, failed, abandoned
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_voice_call_sessions_restaurant ON voice_call_sessions(restaurant_id);
CREATE INDEX idx_voice_call_sessions_call_sid ON voice_call_sessions(call_sid);
CREATE INDEX idx_voice_call_sessions_conversation ON voice_call_sessions(conversation_id);
CREATE INDEX idx_voice_call_sessions_started ON voice_call_sessions(call_started_at DESC);
CREATE INDEX idx_voice_call_sessions_status ON voice_call_sessions(call_status);
```

### Tabla: `voice_transcripts`

```sql
-- Transcripciones completas de llamadas
CREATE TABLE voice_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    call_session_id UUID NOT NULL REFERENCES voice_call_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES agent_messages(id),
    
    -- Transcripción
    speaker VARCHAR NOT NULL,  -- 'customer', 'agent'
    raw_transcription TEXT NOT NULL,
    cleaned_transcription TEXT NOT NULL,
    
    -- Timing
    start_time_seconds DECIMAL(10,2),  -- Segundos desde inicio de llamada
    end_time_seconds DECIMAL(10,2),
    duration_seconds DECIMAL(10,2),
    
    -- Quality
    confidence DECIMAL(3,2),
    language_detected VARCHAR(5) DEFAULT 'es',
    corrections_applied TEXT[],
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_voice_transcripts_session ON voice_transcripts(call_session_id);
CREATE INDEX idx_voice_transcripts_restaurant ON voice_transcripts(restaurant_id);
CREATE INDEX idx_voice_transcripts_speaker ON voice_transcripts(speaker);
```

---

## 🎯 CRITERIOS DE ÉXITO

### MVP (Fase 1)
- ✅ Cliente puede llamar y hacer una reserva completa por voz
- ✅ Transcripciones con >80% precisión
- ✅ Conversaciones completas guardadas en DB
- ✅ Mismo agente que WhatsApp (lógica unificada)

### Optimización (Fase 2)
- ✅ Latencia percibida <3 segundos
- ✅ Conversaciones naturales (con interrupciones)
- ✅ Tasa de error <5%
- ✅ Cliente no distingue que habla con IA

### Producción (Fase 3)
- ✅ 100 llamadas simultáneas sin degradación
- ✅ 99.9% uptime
- ✅ Monitorización en tiempo real
- ✅ Tasa de conversión >60% (llamada → reserva)

---

## 💰 ESTIMACIÓN DE COSTES

### Fase 1: MVP (100 llamadas/día)

| Servicio | Coste Unitario | Volumen/mes | Coste/mes |
|---------|---------------|-------------|-----------|
| **Twilio Voice** | $0.013/min | 3,000 llamadas × 3 min | $117 |
| **Deepgram STT** | $0.0043/min | 9,000 min | $39 |
| **ElevenLabs TTS** | $0.30/1K chars | 1.5M chars | $450 |
| **OpenAI GPT-4o** | $5/1M tokens | 3M tokens | $15 |
| **N8N** | Self-hosted | - | $0 |
| **Supabase** | Plan Pro | - | $25 |
| **TOTAL** | | | **~$650/mes** |

### Fase 3: Producción (1,000 llamadas/día)

| Servicio | Coste/mes |
|---------|-----------|
| **Twilio Voice** | $1,170 |
| **Deepgram STT** | $387 |
| **Google TTS** (reemplazo ElevenLabs) | $240 |
| **OpenAI GPT-4o** | $150 |
| **N8N (3 nodes)** | $0 |
| **Supabase Pro** | $25 |
| **TOTAL** | **~$2,000/mes** |

**Coste por llamada:** ~$2.00  
**Coste por reserva (60% conversión):** ~$3.30

---

## 🎓 DOCUMENTACIÓN ADICIONAL

### Referencias Técnicas
- [Twilio Media Streams](https://www.twilio.com/docs/voice/twiml/stream)
- [Deepgram Streaming API](https://developers.deepgram.com/docs/streaming)
- [ElevenLabs API](https://elevenlabs.io/docs/api-reference/overview)
- [SSML Reference](https://www.w3.org/TR/speech-synthesis11/)

### Ejemplos de Código
- `n8n/examples/voice-orchestrator-example.js`
- `n8n/examples/stt-preprocessing-example.js`
- `n8n/examples/tts-ssml-examples.xml`

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Pre-requisitos
- [ ] Cuenta Twilio verificada
- [ ] Número telefónico comprado
- [ ] API Keys: Deepgram, ElevenLabs, OpenAI
- [ ] N8N actualizado a última versión
- [ ] Supabase con tablas migradas

### Testing
- [ ] Test unitario: STT accuracy >80%
- [ ] Test unitario: TTS calidad subjective >4/5
- [ ] Test integración: Flujo completo end-to-end
- [ ] Test carga: 10 llamadas simultáneas
- [ ] Test latencia: <3s percibida

### Producción
- [ ] Monitoring dashboard configurado
- [ ] Alertas configuradas
- [ ] Call recording habilitado
- [ ] Disaster recovery plan documentado
- [ ] Runbook de incidentes

---

**Última actualización:** 22 Octubre 2025  
**Autor:** La-IA Team  
**Estado:** 🎯 Listo para implementación


