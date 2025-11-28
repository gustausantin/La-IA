# ✅ VERIFICACIÓN DE PRODUCCIÓN - LA-IA (WORKFLOW MODE)

## 🎯 ARQUITECTURA CORRECTA

**IMPORTANTE**: Estás usando **VAPI Workflows**, NO Assistants directos.

### Diferencias clave:
- ✅ **Edge Function devuelve**: `workflowId` + `workflowOverrides.variableValues`
- ❌ **NO devuelve**: `assistant`, `model`, `voice`
- 🎙️ **La voz se configura**: DENTRO del Workflow en el panel de VAPI
- 📝 **Las variables se definen**: En el Workflow con sintaxis `{{VARIABLE}}`

---

## 📋 DATOS DE TU SISTEMA

- **Número de teléfono**: `+34 931 204 462` (Soilua - Pelos Barbaros)
- **Workflow ID**: `5d6025b6-45cb-468f-85f0-6b364a882773`
- **Avatar esperado**: Hugo
- **Edge Function URL**: `https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/vapi-inbound-handler`

---

## 🔧 PASO 1: CONFIGURACIÓN EN VAPI DASHBOARD

### 1.1 Phone Number Settings
Ve a **VAPI Dashboard** → **Phone Numbers** → `+34 931 204 462`

**Configuración requerida**:
```
Assistant/Workflow: [VACÍO - No selecciones nada]
Server URL: https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/vapi-inbound-handler
```

### 1.2 HTTP Headers (Seguridad)
En la misma pantalla, añade:
```
Key:   x-vapi-secret
Value: LAIA_SECURE_TOKEN_2025_X99
```

⚠️ **Sin este header, las llamadas serán rechazadas con 401**

### 1.3 Workflow Configuration
Ve a **Workflows** → ID `5d6025b6-45cb-468f-85f0-6b364a882773`

**Asegúrate de que**:
1. Las variables están definidas con `{{VARIABLE}}`:
   - `{{BUSINESS_NAME}}`
   - `{{ASSISTANT_NAME}}`
   - `{{SECTOR_NAME}}`
   - `{{CLIENT_TERM}}`
   - `{{ASSET_TERM}}`
   - `{{SERVICES_LIST}}`
   - `{{TONE_INSTRUCTIONS}}`
   - `{{WEBSITE}}`

2. La **voz está configurada** en el Workflow (ejemplo: ElevenLabs Hugo)

3. El **modelo está configurado** (ejemplo: GPT-4o)

---

## 🧪 PASO 2: PRUEBA REAL

### Llamada de Prueba
**Llama a `+34 931 204 462`** desde tu móvil.

### ✅ Comportamiento Esperado
1. **Hugo contesta** (voz masculina configurada en el Workflow)
2. Dice: **"Hola, soy Hugo de Soilua"** (o similar, usando `{{ASSISTANT_NAME}}` y `{{BUSINESS_NAME}}`)
3. Conoce los servicios: "Ofrecemos corte de pelo, afeitado..." (usando `{{SERVICES_LIST}}`)
4. Usa vocabulario correcto: "Cliente", "Cita" (usando `{{CLIENT_TERM}}`, `{{ASSET_TERM}}`)

### ❌ Señales de Problema
| Síntoma | Causa | Solución |
|---------|-------|----------|
| Dice "Business name Soilua" literalmente | Variables no se inyectan | Verifica Server URL en Phone Number |
| Voz incorrecta (no es Hugo) | Voz hardcoded en Workflow | Cambia voz en Workflow a Hugo |
| Respuestas genéricas sin contexto | Edge Function no se ejecuta | Revisa logs de Supabase |
| Error 401 | Secreto no configurado | Añade header `x-vapi-secret` |

---

## 📊 PASO 3: VERIFICAR LOGS

### 3.1 Logs de Supabase
Ve a: [Edge Functions Logs](https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/logs/edge-functions)

**Logs correctos (durante una llamada)**:
```
📞 assistant-request recibido
📞 Procesando llamada para: +34931204462
✅ Negocio encontrado: Soilua (ID: [...])
✅ Config generada para: Soilua (Avatar: Hugo)
📦 Variables inyectadas: BUSINESS_NAME, ASSISTANT_NAME, SECTOR_NAME, ...
```

**Logs de error**:
```
⛔ Intento de acceso no autorizado - secreto inválido
```
→ Configura `x-vapi-secret` en VAPI

```
❌ Negocio no encontrado para +34931204462 - usando fallback
```
→ Verifica que el número esté en la tabla `businesses` con `active = true`

### 3.2 Logs de VAPI
Ve a **VAPI Dashboard** → **Calls** → Selecciona la llamada reciente

**Busca en "Request/Response"**:
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
      "SERVICES_LIST": "Corte de pelo, Afeitado, ..."
    }
  }
}
```

Si ves esto, **la Edge Function funciona correctamente**.

Si las variables están vacías o no aparecen, el Workflow no las está leyendo.

---

## 🧰 PASO 4: PRUEBA CON CURL (Opcional)

### Test 1: Simular evento `assistant-request`
```bash
curl -X POST https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/vapi-inbound-handler \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: LAIA_SECURE_TOKEN_2025_X99" \
  -d '{
    "message": {
      "type": "assistant-request",
      "phoneNumber": {
        "number": "+34931204462"
      }
    }
  }'
```

**Respuesta esperada (200 OK)**:
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
      "SERVICES_LIST": "Corte de pelo, Afeitado, Tinte, ...",
      "TONE_INSTRUCTIONS": "Sé amable, cercano y cálido.",
      "WEBSITE": ""
    }
  }
}
```

### Test 2: Evento NO assistant-request (debe devolver `{ok: true}`)
```bash
curl -X POST https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/vapi-inbound-handler \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: LAIA_SECURE_TOKEN_2025_X99" \
  -d '{
    "message": {
      "type": "speech-update"
    }
  }'
```

**Respuesta esperada**:
```json
{"ok": true}
```

### Test 3: Sin secreto (debe fallar con 401)
```bash
curl -X POST https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/vapi-inbound-handler \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "phoneNumber": {"number": "+34931204462"}
    }
  }'
```

**Respuesta esperada (401)**:
```json
{"error": "Unauthorized"}
```

---

## 🎯 CHECKLIST FINAL

- [ ] Phone Number en VAPI configurado con Server URL (sin Assistant/Workflow seleccionado)
- [ ] Header `x-vapi-secret` añadido en VAPI Phone Number
- [ ] Workflow contiene las variables con sintaxis `{{VARIABLE}}`
- [ ] Voz configurada EN EL WORKFLOW (no en la Edge Function)
- [ ] Llamada de prueba realizada a `+34 931 204 462`
- [ ] Hugo responde correctamente (no voz femenina)
- [ ] Dice "Soilua" o "Pelos Barbaros" (no "Business name Soilua")
- [ ] Conoce los servicios del negocio
- [ ] Logs de Supabase muestran éxito sin errores
- [ ] Logs de VAPI muestran las variables inyectadas

---

## 🚨 TROUBLESHOOTING AVANZADO

### Problema: Variables aparecen literales ("{{BUSINESS_NAME}}")

**Causa**: El Workflow no está recibiendo las variables o no las está usando.

**Solución**:
1. Ve al Workflow en VAPI Dashboard
2. Verifica que en el prompt uses `{{BUSINESS_NAME}}` (con llaves dobles)
3. Verifica que en "Variables" del Workflow estén definidas
4. Haz una llamada de prueba y revisa los logs de VAPI (pestaña Calls → detalles de la llamada)

### Problema: Voz incorrecta (no es Hugo)

**Causa**: La voz está hardcodeada en el Workflow.

**Solución**:
1. Ve al Workflow → "Voice" settings
2. Cambia a la voz "Hugo" (ElevenLabs: `ErXwobaYiN019PkySvjV`)
3. Guarda y prueba de nuevo

⚠️ **Nota**: La Edge Function ya NO controla la voz. Eso se hace en el Workflow.

### Problema: "No oye bien" / "No transcribe bien"

**Causa**: Posiblemente no es un problema de transcripción, sino de contexto.

**Solución**:
1. Verifica que las variables se inyecten correctamente
2. Asegúrate de que el prompt del Workflow tenga contexto suficiente
3. Revisa los logs de la llamada en VAPI para ver qué transcribió realmente

---

## 📞 ESTRUCTURA JSON FINAL

**Lo que la Edge Function DEBE devolver** (solo en `assistant-request`):

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
      "TONE_INSTRUCTIONS": "...",
      "WEBSITE": ""
    }
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "ErXwobaYiN019PkySvjV"
  }
}
```

**Componentes**:
- ✅ `workflowId` - ID del Workflow a ejecutar
- ✅ `workflowOverrides.variableValues` - Variables dinámicas
- ✅ `voice` - Fuerza la voz de ElevenLabs según el avatar
- ❌ `assistant` - NO (solo para Assistant mode)
- ❌ `model` - NO (se configura en el Workflow)

---

## ✅ SIGUIENTE PASO

1. **Configura el header** `x-vapi-secret` en VAPI (si no lo has hecho)
2. **Llama a** `+34 931 204 462`
3. **Revisa los logs** en Supabase y VAPI
4. **Comparte los resultados** para diagnosticar si hay algún problema

¡Ahora sí debería funcionar correctamente! 🎯
