# ✅ DESPLIEGUE FINAL - CONTROL DE VOZ INTEGRADO

## 🎯 QUÉ SE HA CORREGIDO

### ❌ Problema Original
La Edge Function **NO estaba enviando el objeto `voice`** a VAPI, por lo que:
- VAPI usaba la voz por defecto del Workflow
- Los negocios configurados con avatares específicos (Hugo, Mariana, etc.) no sonaban con su voz
- No había control dinámico de voces según el negocio

### ✅ Solución Implementada
Ahora la Edge Function **SÍ envía el objeto `voice`** con la estructura correcta:

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

---

## 🏗️ ARQUITECTURA IMPLEMENTADA

### 1. Mapa de Voces (Avatar → VoiceId)

```typescript
const AVATAR_VOICES: Record<string, string> = {
  'Lua': 'RgXx32WYOGrd7gFNifSf',      // Voz femenina principal
  'Clara': 'EXAVITQu4vr4xnSDxMaL',    // Voz femenina alternativa
  'Hugo': 'ErXwobaYiN019PkySvjV',     // Voz masculina (Soilua)
  'Álex': 'TxGEqnHWrfWFTfGW9XjX',     // Voz masculina alternativa
  'Mariana': 'RgXx32WYOGrd7gFNifSf',  // Mariana = voz de Lua
  'Default': 'RgXx32WYOGrd7gFNifSf'   // Fallback
};
```

### 2. Flujo de Ejecución

```
1. Llamada entrante → +34 931 204 462 (Soilua)
   ↓
2. VAPI dispara webhook "assistant-request" al Server URL
   ↓
3. Edge Function:
   - Busca negocio por teléfono
   - Encuentra: Soilua (ID: xxx)
   - Lee avatar: "Hugo"
   - Mapea: Hugo → ErXwobaYiN019PkySvjV
   ↓
4. Devuelve JSON a VAPI:
   {
     "workflowId": "5d6025b6-...",
     "workflowOverrides": {
       "variableValues": {
         "BUSINESS_NAME": "Soilua",
         "ASSISTANT_NAME": "Hugo",
         ...
       }
     },
     "voice": {
       "provider": "11labs",
       "voiceId": "ErXwobaYiN019PkySvjV"
     }
   }
   ↓
5. VAPI ejecuta Workflow con:
   - Variables inyectadas ✅
   - Voz de Hugo ✅
   - Modelo configurado en Workflow ✅
```

---

## 📦 CAMBIOS EN EL CÓDIGO

### Añadido: Mapa de Voces
```typescript
// Líneas 20-28 de index.ts
const AVATAR_VOICES: Record<string, string> = {
  'Lua': 'RgXx32WYOGrd7gFNifSf',
  'Clara': 'EXAVITQu4vr4xnSDxMaL',
  'Hugo': 'ErXwobaYiN019PkySvjV',
  'Álex': 'TxGEqnHWrfWFTfGW9XjX',
  'Mariana': 'RgXx32WYOGrd7gFNifSf',
  'Default': 'RgXx32WYOGrd7gFNifSf'
};
```

### Añadido: Selección de VoiceId
```typescript
// Después de determinar selectedAvatarName
const selectedVoiceId: string =
  AVATAR_VOICES[selectedAvatarName] || AVATAR_VOICES['Default'];
```

### Modificado: Respuesta a VAPI
```typescript
const response = {
  workflowId: WORKFLOW_ID,
  workflowOverrides: {
    variableValues,
  },
  // 👇 NUEVO: Forzar voz dinámicamente
  voice: {
    provider: "11labs",
    voiceId: selectedVoiceId
  }
};
```

### Añadido: Logs Mejorados
```typescript
console.log(`✅ Config generada para: ${safeBusiness.name} (Avatar: ${selectedAvatarName})`);
console.log(`🎙️ Voz seleccionada: ${selectedAvatarName} (${selectedVoiceId})`);
console.log(`📦 Variables inyectadas:`, Object.keys(variableValues).join(', '));
```

---

## 🧪 CÓMO VERIFICAR QUE FUNCIONA

### Test 1: Llamada Real
**Llama a `+34 931 204 462` (Soilua)**

**Comportamiento esperado**:
- ✅ Hugo contesta (voz masculina)
- ✅ Dice "Hola, soy Hugo de Soilua"
- ✅ Conoce los servicios del negocio

### Test 2: Logs de Supabase
**Ve a**: [Edge Functions Logs](https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/logs/edge-functions)

**Busca**:
```
📞 assistant-request recibido
📞 Procesando llamada para: +34931204462
✅ Negocio encontrado: Soilua (ID: [...])
✅ Config generada para: Soilua (Avatar: Hugo)
🎙️ Voz seleccionada: Hugo (ErXwobaYiN019PkySvjV)
📦 Variables inyectadas: BUSINESS_NAME, ASSISTANT_NAME, ...
```

### Test 3: Logs de VAPI
**Ve a**: VAPI Dashboard → Calls → Selecciona la última llamada

**En "Request/Response", verifica**:
```json
{
  "workflowId": "5d6025b6-45cb-468f-85f0-6b364a882773",
  "workflowOverrides": {
    "variableValues": {
      "BUSINESS_NAME": "Soilua",
      "ASSISTANT_NAME": "Hugo",
      ...
    }
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "ErXwobaYiN019PkySvjV"
  }
}
```

Si ves el objeto `voice`, **la integración funciona correctamente**.

---

## 🔧 CONFIGURACIÓN REQUERIDA EN VAPI

### Phone Number Settings
```
Phone: +34 931 204 462
Assistant/Workflow: [VACÍO]
Server URL: https://zrcsujgurtglyqoqiynr.supabase.co/functions/v1/vapi-inbound-handler

HTTP Headers:
  Key: x-vapi-secret
  Value: LAIA_SECURE_TOKEN_2025_X99
```

⚠️ **Importante**: NO selecciones un Assistant/Workflow en el Phone Number. Debe estar vacío para que VAPI llame al Server URL.

---

## 📊 EJEMPLO COMPLETO: SOILUA

### Datos en la BD
```sql
SELECT 
  business_name,              -- "Soilua"
  vertical_type,              -- "peluqueria_barberia"
  agent_config->'personality'->>'name',  -- "Hugo"
  assigned_phone              -- "+34931204462"
FROM businesses
WHERE name = 'Pelos Bárbaros';
```

### Respuesta de la Edge Function
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
      "SERVICES_LIST": "Corte de pelo, Afeitado, Tinte, Barba",
      "TONE_INSTRUCTIONS": "Sé amable y cercano.",
      "WEBSITE": ""
    }
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "ErXwobaYiN019PkySvjV"
  }
}
```

### Resultado en la Llamada
1. **Voz**: Hugo (masculina, ElevenLabs `ErXwobaYiN019PkySvjV`)
2. **Identidad**: "Hola, soy Hugo de Soilua"
3. **Contexto**: Conoce servicios de peluquería y barbería
4. **Tono**: Amable y cercano

---

## 🆘 TROUBLESHOOTING

### Problema: Voz incorrecta (no es Hugo)

**Diagnóstico**:
```sql
-- 1. Verificar avatar configurado
SELECT name, agent_config->'personality'->>'name' as avatar
FROM businesses
WHERE assigned_phone LIKE '%931204462%';
```

**Posibles causas**:
- ❌ Avatar es `NULL` o no coincide con `AVATAR_VOICES`
- ❌ VoiceId incorrecto en el mapa
- ❌ VAPI está usando una configuración cacheada

**Soluciones**:
1. Actualiza el avatar en la BD:
   ```sql
   UPDATE businesses
   SET agent_config = jsonb_set(
     agent_config, 
     '{personality,name}', 
     '"Hugo"'
   )
   WHERE name = 'Pelos Bárbaros';
   ```

2. Verifica el VoiceId en ElevenLabs Dashboard

3. Haz una llamada de prueba y revisa logs

### Problema: Variables no se inyectan

**Causa**: Evento incorrecto o fallo en la Edge Function

**Solución**:
1. Revisa logs de Supabase (debe mostrar `assistant-request`)
2. Verifica que el header `x-vapi-secret` esté configurado
3. Comprueba que el negocio existe y está activo

### Problema: Error 401 Unauthorized

**Causa**: Header `x-vapi-secret` no configurado o incorrecto

**Solución**:
1. Ve a VAPI Dashboard → Phone Number
2. Añade HTTP Header:
   - Key: `x-vapi-secret`
   - Value: `LAIA_SECURE_TOKEN_2025_X99`
3. Guarda y prueba de nuevo

---

## ✅ CHECKLIST FINAL

- [x] Mapa de voces `AVATAR_VOICES` implementado
- [x] Selección de `voiceId` según avatar
- [x] Objeto `voice` incluido en respuesta
- [x] Logs mejorados con información de voz
- [x] Fallback con voz por defecto
- [x] Código desplegado en producción
- [ ] **Header `x-vapi-secret` configurado en VAPI** ⚠️ (Acción requerida)
- [ ] **Llamada de prueba realizada** ⚠️ (Acción requerida)
- [ ] **Voz de Hugo verificada** ⚠️ (Acción requerida)

---

## 📚 DOCUMENTACIÓN ADICIONAL

- `ARQUITECTURA_WORKFLOW_VS_ASSISTANT.md` - Explicación técnica
- `MAPEO_VOCES_AVATARES.md` - Guía de voces y avatares
- `VERIFICACION_PRODUCCION.md` - Checklist de verificación

---

## 🎯 PRÓXIMO PASO

1. **Configura el header** `x-vapi-secret` en VAPI (si no lo has hecho)
2. **Llama a** `+34 931 204 462`
3. **Verifica** que Hugo contesta con la voz correcta
4. **Revisa logs** en Supabase y VAPI para confirmar

---

**🚀 ¡DESPLIEGUE COMPLETADO! La Edge Function ahora controla dinámicamente las voces según el avatar de cada negocio.**


