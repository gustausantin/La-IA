# 🏗️ Arquitectura: Workflow vs Assistant en VAPI

## 🎯 Diferencia Fundamental

### ❌ LO QUE ESTÁBAMOS HACIENDO MAL (Assistant Mode)

**Estructura incorrecta**:
```json
{
  "assistant": {
    "model": {
      "provider": "vapi",
      "model": "custom-1",
      "workflowId": "..."
    },
    "voice": {
      "provider": "11labs",
      "voiceId": "ErXwobaYiN019PkySvjV"
    },
    "assistantOverrides": {
      "variableValues": {
        "BUSINESS_NAME": "Soilua"
      }
    }
  }
}
```

**Problema**: Esta estructura es para cuando usas **Assistants** directos, NO Workflows.

---

### ✅ LO CORRECTO (Workflow Mode)

**Estructura correcta**:
```json
{
  "workflowId": "5d6025b6-45cb-468f-85f0-6b364a882773",
  "workflowOverrides": {
    "variableValues": {
      "BUSINESS_NAME": "Soilua",
      "ASSISTANT_NAME": "Hugo",
      "SECTOR_NAME": "Peluquería y Barbería",
      "CLIENT_TERM": "Cliente",
      "ASSET_TERM": "Cita",
      "SERVICES_LIST": "Corte de pelo, Afeitado, ...",
      "TONE_INSTRUCTIONS": "Sé amable y profesional."
    }
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "ErXwobaYiN019PkySvjV"
  }
}
```

**Claves**:
- ✅ `workflowId` + `workflowOverrides` (estructura base)
- ✅ Variables en `workflowOverrides.variableValues` (NO `assistantOverrides`)
- ✅ **La voz se puede forzar con el objeto `voice`** (opcional pero recomendado)
- ✅ El modelo se configura EN EL WORKFLOW (no se puede override desde el Server)

---

## 📊 Tabla Comparativa

| Aspecto | Assistant Mode | Workflow Mode (✅ CORRECTO) |
|---------|----------------|----------------------------|
| **Estructura JSON** | `assistant` + `model` + `voice` | `workflowId` + `workflowOverrides` |
| **Variables** | `assistantOverrides.variableValues` | `workflowOverrides.variableValues` |
| **Voz** | Se devuelve en el JSON | Se puede forzar con `voice` object |
| **Modelo** | Se devuelve en el JSON | Se configura en el Workflow (no override) |
| **Prompt** | Se construye dinámicamente | Se define en el Workflow con `{{}}` |
| **Uso típico** | Assistants simples, sin flujos complejos | Flujos complejos, multi-step, condicionales |

---

## 🔄 Flujo de Ejecución (Workflow Mode)

```
1. VAPI recibe llamada a +34931204462
   ↓
2. VAPI NO encuentra Assistant/Workflow configurado en Phone Number
   ↓
3. VAPI hace POST al Server URL con event "assistant-request"
   ↓
4. Edge Function (Supabase):
   - Extrae el teléfono
   - Busca el negocio en la BD
   - Prepara variables personalizadas
   - Devuelve: { workflowId, workflowOverrides }
   ↓
5. VAPI carga el Workflow especificado
   ↓
6. VAPI inyecta las variables en los bloques del Workflow
   ↓
7. VAPI ejecuta el Workflow con:
   - Voz configurada EN EL WORKFLOW
   - Modelo configurado EN EL WORKFLOW
   - Variables personalizadas desde la Edge Function
   ↓
8. Hugo responde: "Hola, soy Hugo de Soilua..."
```

---

## 🧩 Ejemplo Real: Variable Injection

### En el Workflow de VAPI:

**Bloque de System Prompt**:
```
Eres {{ASSISTANT_NAME}}, asistente virtual de {{BUSINESS_NAME}}.
Tu negocio es del sector {{SECTOR_NAME}}.
Los {{CLIENT_TERM}}s pueden agendar {{ASSET_TERM}}s.
Servicios disponibles: {{SERVICES_LIST}}.
{{TONE_INSTRUCTIONS}}
```

### Edge Function devuelve:
```json
{
  "workflowOverrides": {
    "variableValues": {
      "ASSISTANT_NAME": "Hugo",
      "BUSINESS_NAME": "Soilua",
      "SECTOR_NAME": "Peluquería y Barbería",
      "CLIENT_TERM": "Cliente",
      "ASSET_TERM": "Cita",
      "SERVICES_LIST": "Corte de pelo, Afeitado, Tinte",
      "TONE_INSTRUCTIONS": "Sé amable y cercano."
    }
  }
}
```

### Resultado Final (Prompt que ve la IA):
```
Eres Hugo, asistente virtual de Soilua.
Tu negocio es del sector Peluquería y Barbería.
Los Clientes pueden agendar Citas.
Servicios disponibles: Corte de pelo, Afeitado, Tinte.
Sé amable y cercano.
```

---

## 🎙️ Control de Voz

### ✅ Control Dinámico de Voz (CORRECTO)

**Puedes forzar la voz desde la Edge Function** incluso con Workflows:

```json
{
  "workflowId": "5d6025b6-45cb-468f-85f0-6b364a882773",
  "workflowOverrides": {
    "variableValues": { ... }
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "ErXwobaYiN019PkySvjV"
  }
}
```

**Cómo funciona**:
1. La Edge Function detecta el avatar configurado (ej: "Hugo", "Mariana", "Lua")
2. Mapea el avatar a un `voiceId` de ElevenLabs
3. Devuelve el objeto `voice` junto con `workflowId` y `workflowOverrides`
4. VAPI usa la voz especificada, ignorando la configuración por defecto del Workflow

**Ventaja**: Un solo Workflow puede usar múltiples voces dinámicamente según el negocio

---

## 🔍 Cómo Verificar Que Funciona

### 1. Logs de Supabase (Edge Function)
```
✅ Config generada para: Soilua (Avatar: Hugo)
📦 Variables inyectadas: BUSINESS_NAME, ASSISTANT_NAME, SECTOR_NAME, ...
```

### 2. Logs de VAPI (Dashboard → Calls)
En "Request/Response" deberías ver:
```json
{
  "workflowId": "5d6025b6-45cb-468f-85f0-6b364a882773",
  "workflowOverrides": {
    "variableValues": {
      "BUSINESS_NAME": "Soilua",
      ...
    }
  }
}
```

### 3. Comportamiento del Asistente
- ✅ Dice "Hola, soy Hugo de Soilua" (variables inyectadas)
- ❌ Dice "Hola, soy {{ASSISTANT_NAME}} de {{BUSINESS_NAME}}" (variables NO inyectadas)

---

## 📚 Referencias

- **Documentación VAPI**: [Workflows](https://docs.vapi.ai/workflows)
- **Hilo del error**: "Unable to set dynamic customer name in workflow"
- **Confirmación de VAPI**: Las variables van en `workflowOverrides.variableValues` para Workflows

---

## ✅ Resumen Ultra-Corto

| ¿Qué? | ¿Cómo? |
|-------|--------|
| **Estructura JSON** | `{ workflowId, workflowOverrides }` |
| **Variables** | `workflowOverrides.variableValues` |
| **Voz** | Configurada EN EL WORKFLOW (no en JSON) |
| **Modelo** | Configurado EN EL WORKFLOW (no en JSON) |
| **Prompt** | Definido en Workflow con `{{VARIABLE}}` |
| **Event relevante** | `assistant-request` (otros devolver `{ok: true}`) |

---

**🎯 Siguiente paso**: Llama a `+34 931 204 462` y verifica que Hugo responda correctamente con el contexto de Soilua.




