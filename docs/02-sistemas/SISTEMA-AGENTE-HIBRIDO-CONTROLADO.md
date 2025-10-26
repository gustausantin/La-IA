# 🤖 Sistema de Agente Híbrido Controlado

## 📋 ÍNDICE
1. [Concepto](#concepto)
2. [Arquitectura](#arquitectura)
3. [Herramientas (6 total)](#herramientas)
4. [Lógica Híbrida](#logica-hibrida)
5. [Respuestas Fijas](#respuestas-fijas)
6. [Escalado a Humano](#escalado-a-humano)
7. [Flujo Completo](#flujo-completo)
8. [Implementación](#implementacion)

---

## 🎯 CONCEPTO

### Problema Identificado
El agente LLM (GPT-4o) era **demasiado "libre"** y podía:
- ❌ Prometer "pasar al equipo" sin capacidad real
- ❌ Inventar información no disponible
- ❌ Crear expectativas imposibles de cumplir
- ❌ Continuar conversaciones innecesariamente
- ❌ Preguntar "¿algo más?" abriendo nuevas vías no controladas

### Solución: Sistema Híbrido
**Concepto:** Combinar lo mejor de ambos mundos:
- ✅ **Respuestas fijas** para casos delicados (feedback, quejas)
- ✅ **LLM conversacional** para reservas (necesita naturalidad)
- ✅ **Escalado automático** cuando no puede ayudar

---

## 🏗️ ARQUITECTURA

```
┌─────────────────────────────────────────────────┐
│  1. Cliente envía mensaje                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  2. Clasificador LLM (GPT-4o-mini)              │
│     Detecta: intent + sentiment + entities     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  3. LÓGICA HÍBRIDA (Code Node)                  │
│     ¿Tiene respuesta fija este caso?            │
└─────────────────────────────────────────────────┘
         ↓                              ↓
    ┌──────────┐                  ┌─────────────┐
    │ SÍ       │                  │ NO          │
    │ (Fija)   │                  │ (LLM)       │
    └──────────┘                  └─────────────┘
         ↓                              ↓
┌─────────────────┐         ┌────────────────────┐
│ 4A. Respuesta   │         │ 4B. Super Agent    │
│     Fija        │         │     (GPT-4o)       │
│                 │         │     + 6 Tools      │
└─────────────────┘         └────────────────────┘
         ↓                              ↓
┌─────────────────────────────────────────────────┐
│  5. Enviar WhatsApp al cliente                  │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│  6. ¿Necesita escalado?                         │
│     → Envía alerta a restaurante                │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ HERRAMIENTAS (6 TOTAL)

### Herramientas Actuales (5):
1. ✅ **check_availability** → Verificar disponibilidad
2. ✅ **create_reservation** → Crear reserva
3. ✅ **modify_reservation** → Modificar reserva
4. ✅ **cancel_reservation** → Cancelar reserva
5. ✅ **get_restaurant_info** → Info del restaurante

### Herramienta NUEVA (6):
6. 🆕 **escalate_to_human** → CRÍTICA

#### Parámetros de `escalate_to_human`:
```javascript
{
  restaurant_id: UUID,
  customer_phone: "+34...",
  customer_name: "Nombre",
  customer_message: "Resumen del problema",
  reason: "cliente_solicita" | "situacion_compleja" | "queja_grave" | "informacion_no_disponible" | "error_sistema",
  urgency: "high" | "medium" | "low"
}
```

#### Acciones que realiza:
1. ✅ Envía WhatsApp urgente al teléfono del restaurante
2. ✅ Registra escalado en tabla `escalations`
3. ✅ Devuelve confirmación al cliente
4. ✅ Marca como "pending" para seguimiento

---

## 🔀 LÓGICA HÍBRIDA

### Casos con RESPUESTA FIJA:
```javascript
✅ Feedback positivo → "¡Gracias por tu opinión! Nos alegra..."
✅ Feedback negativo → "Lamentamos tu experiencia. Hemos tomado nota..."
✅ Queja → "El encargado ha sido notificado y te contactará..."
✅ Cliente pide humano → "Te paso con el encargado..."
✅ Saludo → "¡Hola! Soy la asistente virtual de [RESTAURANTE]..."
✅ Agradecimiento → "¡Un placer! Que tengas un excelente día 😊"
✅ Fuera de alcance → "Mi función es ayudarte con reservas..."
✅ Error → "Disculpa, te paso con el encargado..."
```

### Casos con LLM CONVERSACIONAL:
```javascript
🤖 Reserva → LLM con herramientas (natural, conversacional)
🤖 Modificación → LLM con herramientas
🤖 Cancelación → LLM con herramientas
🤖 Consulta → LLM con herramientas
```

---

## 📝 RESPUESTAS FIJAS

### 1. Feedback Positivo
```
¡Muchas gracias por tu opinión! 
Nos alegra mucho que hayas disfrutado tu visita 😊
```
- **Acción:** Cierra conversación
- **Log:** Sí (registro en BD)
- **Escalado:** No

---

### 2. Feedback Negativo
```
Lamentamos que tu experiencia no haya sido la esperada. 
Hemos tomado nota de tus comentarios. 
Gracias por hacérnoslo saber.
```
- **Acción:** Cierra conversación
- **Log:** Sí (registro en BD)
- **Escalado:** No (solo registra)

---

### 3. Queja Grave
```
Lamentamos muchísimo las molestias. 
El encargado ha sido notificado y te contactará en breve 
para resolver esta situación.
```
- **Acción:** Escala automáticamente
- **Reason:** `queja_grave`
- **Urgencia:** `high`
- **Log:** Sí

---

### 4. Cliente Solicita Humano
```
Por supuesto, te paso con el encargado. 
Un momento, por favor.
```
- **Acción:** Escala
- **Reason:** `cliente_solicita`
- **Urgencia:** `medium`
- **Detección:** Palabras clave → "hablar con", "persona", "encargado", "humano", "gerente"

---

### 5. Saludo Simple
```
¡Hola! Soy la asistente virtual de [RESTAURANTE]. 
¿En qué puedo ayudarte? 
Puedo ayudarte con reservas, modificaciones o consultas.
```
- **Acción:** Espera siguiente mensaje
- **Log:** No

---

### 6. Agradecimiento
```
¡Un placer! Que tengas un excelente día 😊
```
- **Acción:** Cierra conversación
- **Log:** No

---

### 7. Fuera de Alcance
```
Lo siento, mi función es ayudarte con reservas y consultas 
sobre el restaurante. 
¿Hay algo relacionado con esto en lo que pueda ayudarte?
```
- **Acción:** Espera respuesta
- **Log:** No

---

### 8. Error / No Reconocido
```
Disculpa, estoy teniendo dificultades para procesar tu solicitud. 
Te paso con el encargado para ayudarte mejor.
```
- **Acción:** Escala
- **Reason:** `error_sistema`
- **Urgencia:** `medium`

---

## 🆘 ESCALADO A HUMANO

### Tabla: `escalations`
```sql
CREATE TABLE escalations (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    customer_phone VARCHAR NOT NULL,
    customer_name VARCHAR,
    customer_message TEXT,
    reason VARCHAR NOT NULL, -- cliente_solicita, queja_grave, etc.
    urgency VARCHAR NOT NULL, -- high, medium, low
    status VARCHAR NOT NULL, -- pending, contacted, resolved, ignored
    escalated_at TIMESTAMPTZ NOT NULL,
    contacted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);
```

### Mensaje de Alerta Enviado al Restaurante:
```
🚨🚨🚨 ALERTA - CLIENTE NECESITA ATENCIÓN

🙋 El cliente solicita hablar con una persona

👤 Cliente: Juan Pérez
📞 Teléfono: +34612345678
⏰ Hora: 14/10/2025, 15:30

💬 Mensaje del cliente:
"Necesito hablar con alguien sobre una reserva"

⚡ Acción requerida: Contactar al cliente URGENTEMENTE

---
Restaurante: La Taverna
```

---

## 🔄 FLUJO COMPLETO

### Ejemplo 1: Feedback Positivo
```
Cliente: "Todo estuvo excelente, muy buena comida!"
    ↓
Clasificador: intent=feedback, sentiment=positive
    ↓
Lógica Híbrida: ✅ Tiene respuesta fija
    ↓
Respuesta: "¡Muchas gracias por tu opinión! Nos alegra..."
    ↓
Registra en BD: feedback positivo
    ↓
FIN (no pregunta más)
```

---

### Ejemplo 2: Queja
```
Cliente: "La comida estaba fría y tardaron mucho"
    ↓
Clasificador: intent=complaint, sentiment=negative
    ↓
Lógica Híbrida: ✅ Tiene respuesta fija + ESCALAR
    ↓
1. Respuesta al cliente: "Lamentamos muchísimo las molestias..."
2. Escalado automático:
   - Envía WhatsApp urgente al restaurante
   - Registra en tabla escalations
    ↓
FIN
```

---

### Ejemplo 3: Reserva (Conversacional)
```
Cliente: "Quiero reservar para mañana"
    ↓
Clasificador: intent=reservation
    ↓
Lógica Híbrida: ❌ No tiene respuesta fija → Usar LLM
    ↓
Super Agent (GPT-4o):
    1. "¿A qué hora prefieres?"
    2. "¿Cuántos seréis?"
    3. Usa check_availability
    4. Usa create_reservation
    5. "¡Listo! Tu reserva está confirmada..."
    ↓
FIN (no pregunta "¿algo más?")
```

---

### Ejemplo 4: Cliente Pide Humano
```
Cliente: "¿Puedo hablar con el encargado?"
    ↓
Lógica Híbrida: Detecta palabra "encargado" → ESCALAR
    ↓
1. Respuesta: "Por supuesto, te paso con el encargado..."
2. Escalado inmediato:
   - Envía alerta al restaurante
   - Reason: cliente_solicita
   - Urgency: medium
    ↓
FIN
```

---

## 💻 IMPLEMENTACIÓN

### Archivos Creados:

1. **`n8n/workflows/TOOL-6-escalate-to-human.json`**
   - Workflow completo de la herramienta 6
   
2. **`supabase/migrations/20251014_007_create_escalations_table.sql`**
   - Tabla para registrar escalados

3. **`n8n/workflows/RESPUESTAS-FIJAS-CONTROLADAS.js`**
   - Definición de todas las respuestas fijas

4. **`n8n/workflows/LOGICA-HIBRIDA-WORKFLOW-3.js`**
   - Lógica para decidir: ¿fija o LLM?

5. **`n8n/prompts/super-agent-ESTRICTO-CONTROLADO.txt`**
   - Prompt actualizado con restricciones estrictas

---

## ✅ VENTAJAS DEL SISTEMA HÍBRIDO

### Control Total:
✅ Respuestas predefinidas en casos delicados
✅ No promete cosas imposibles
✅ Cierra conversaciones limpiamente
✅ Escala automáticamente cuando necesario

### Naturalidad Donde Importa:
✅ Conversacional en reservas (necesita ser humano)
✅ Usa herramientas de forma transparente
✅ Mantiene contexto durante reserva

### Seguridad:
✅ Siempre tiene salida (escalado)
✅ No inventa información
✅ Registra todo en BD
✅ Alertas urgentes funcionan

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Crear tabla `escalations` en Supabase
2. ✅ Crear workflow TOOL-6
3. ⏳ Actualizar Workflow 3 con lógica híbrida
4. ⏳ Añadir Tool 6 al Super Agent
5. ⏳ Actualizar prompt del Super Agent
6. ⏳ Testing exhaustivo

---

**Fecha:** 14 de Octubre 2025  
**Estado:** ✅ Diseño Completo - Listo para Implementar  
**Impacto:** CRÍTICO - Previene problemas graves con clientes

