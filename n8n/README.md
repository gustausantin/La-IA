# 🤖 N8N WORKFLOWS - LA-IA

Esta carpeta contiene todos los workflows de n8n para el Super Agente IA.

---

## 📁 ESTRUCTURA

```
n8n/
├── README.md                          # Este archivo
├── workflows/                         # Workflows exportados (JSON)
│   ├── super-agent-main.json         # Workflow principal del Super Agente
│   ├── vapi-integration.json         # Integración VAPI (existente)
│   └── whatsapp-integration.json     # Integración WhatsApp (nuevo)
├── functions/                         # Funciones reutilizables (JavaScript)
│   ├── cleaners/                     # Sub-agentes de limpieza
│   │   ├── voice-cleaner.js
│   │   ├── whatsapp-cleaner.js
│   │   └── generic-cleaner.js
│   ├── validators/                   # Validadores de datos
│   │   ├── reservation-validator.js
│   │   └── availability-checker.js
│   └── generators/                   # Generadores de respuestas
│       └── response-generator.js
├── prompts/                          # Prompts de OpenAI
│   ├── super-agent-classifier.txt
│   ├── reservation-agent.txt
│   ├── modification-agent.txt
│   ├── cancellation-agent.txt
│   └── faq-agent.txt
├── credentials/                      # Credenciales (NO SUBIR A GIT)
│   └── .gitkeep
└── docs/                             # Documentación específica
    ├── SETUP.md                      # Guía de instalación
    ├── TESTING.md                    # Guía de testing
    └── TROUBLESHOOTING.md            # Solución de problemas

```

---

## 🚀 QUICK START

### 1. Importar Workflows

1. Abre n8n en tu navegador
2. Ve a `Workflows` > `Import from File`
3. Selecciona el archivo JSON del workflow que quieras importar
4. Configura las credenciales necesarias

### 2. Configurar Credenciales

Necesitas configurar:

- **Supabase**
  - URL: `https://xxx.supabase.co`
  - API Key: `eyJxxx...`
  - Service Key (opcional): Para operaciones admin

- **OpenAI**
  - API Key: `sk-xxx...`
  - Modelo: `gpt-4-turbo`
  - Temperature: `0.3`

- **VAPI** (si aplica)
  - API Key: `xxx`
  - Assistant ID: `xxx`

- **WhatsApp** (si aplica)
  - API URL: `https://api.whatsapp.com/...`
  - Token: `xxx`
  - Phone Number ID: `xxx`

---

## 📝 WORKFLOWS DISPONIBLES

### 1. Super Agent Main (PRÓXIMAMENTE)
**Archivo:** `workflows/super-agent-main.json`

**Descripción:** Workflow principal que orquesta todos los sub-agentes.

**Entradas:**
- Webhook VAPI
- Webhook WhatsApp
- Webhook Instagram (futuro)
- Webhook Facebook (futuro)

**Salidas:**
- Respuesta por el canal original
- Registro en `agent_conversations` y `agent_messages`

---

### 2. VAPI Integration (EXISTENTE)
**Archivo:** `workflows/vapi-integration.json`

**Descripción:** Tu workflow actual de VAPI.

**Cómo importar:**
Copia tu JSON existente de VAPI aquí.

---

### 3. WhatsApp Integration (NUEVO)
**Archivo:** `workflows/whatsapp-integration.json`

**Descripción:** Webhook para recibir mensajes de WhatsApp.

**Endpoints:**
- `POST /webhook/whatsapp` - Recibir mensajes
- `GET /webhook/whatsapp` - Verificación de webhook

---

## 🛠️ FUNCIONES REUTILIZABLES

### Voice Cleaner
**Archivo:** `functions/cleaners/voice-cleaner.js`

Normaliza inputs de VAPI para el formato unificado.

**Input:** Raw VAPI webhook
**Output:** Mensaje limpio y normalizado

---

### WhatsApp Cleaner
**Archivo:** `functions/cleaners/whatsapp-cleaner.js`

Normaliza inputs de WhatsApp (texto y audio).

**Input:** Raw WhatsApp webhook
**Output:** Mensaje limpio y normalizado

---

## 📚 PROMPTS

Todos los prompts de OpenAI están en `prompts/` para fácil mantenimiento.

**Editar prompts:**
1. Abre el archivo `.txt` correspondiente
2. Modifica el prompt
3. Copia el contenido actualizado
4. Pégalo en el nodo OpenAI de n8n

---

## 🧪 TESTING

Ver guía completa en: `docs/TESTING.md`

**Test rápido:**
```bash
# Test VAPI
curl -X POST https://tu-n8n.com/webhook/vapi \
  -H "Content-Type: application/json" \
  -d @test-data/vapi-sample.json

# Test WhatsApp
curl -X POST https://tu-n8n.com/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d @test-data/whatsapp-sample.json
```

---

## 🔒 SEGURIDAD

**IMPORTANTE:**
- ❌ NO subas credenciales a Git
- ❌ NO compartas API keys
- ✅ Usa variables de entorno
- ✅ Usa webhooks con auth headers

**Archivos ignorados por Git:**
```
n8n/credentials/*
!n8n/credentials/.gitkeep
n8n/.env
```

---

## 📖 DOCUMENTACIÓN ADICIONAL

- **Arquitectura completa:** Ver `/docs/AUDITORIA_Y_ARQUITECTURA_SUPER_AGENTE_N8N.md`
- **Setup detallado:** Ver `docs/SETUP.md`
- **Troubleshooting:** Ver `docs/TROUBLESHOOTING.md`

---

## 🤝 CONTRIBUIR

Si mejoras un workflow o función:

1. Exporta el workflow desde n8n
2. Guarda el JSON en `workflows/`
3. Actualiza este README si es necesario
4. Documenta los cambios

---

## 📞 SOPORTE

¿Problemas con n8n? Consulta:
1. `docs/TROUBLESHOOTING.md`
2. Documentación oficial: https://docs.n8n.io
3. Comunidad n8n: https://community.n8n.io

---

**Última actualización:** 2 Octubre 2025  
**Versión:** 1.0

