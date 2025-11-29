# 🎙️ MAPEO DE VOCES Y AVATARES

## 📊 Configuración Actual

La Edge Function mapea automáticamente los avatares configurados en cada negocio a voces específicas de ElevenLabs:

```typescript
const AVATAR_VOICES: Record<string, string> = {
  'Lua': 'RgXx32WYOGrd7gFNifSf',      // Voz femenina principal
  'Clara': 'EXAVITQu4vr4xnSDxMaL',    // Voz femenina alternativa
  'Hugo': 'ErXwobaYiN019PkySvjV',     // Voz masculina
  'Álex': 'TxGEqnHWrfWFTfGW9XjX',     // Voz masculina alternativa
  'Mariana': 'RgXx32WYOGrd7gFNifSf',  // Mariana usa voz de Lua
  'Default': 'RgXx32WYOGrd7gFNifSf'   // Fallback a Lua
};
```

---

## 🔍 Cómo Funciona

### 1. Detección del Avatar
La Edge Function lee el avatar desde la base de datos:

```sql
SELECT 
  agent_config->'personality'->>'name' as avatar_name,
  agent_config->>'assistant_name' as assistant_name
FROM businesses
WHERE id = [business_id]
```

**Prioridad**:
1. `agent_config.personality.name` (ej: "Hugo")
2. `agent_config.assistant_name` (ej: "Mariana")
3. Fallback: "Lua"

### 2. Mapeo Avatar → VoiceId
```typescript
const selectedAvatarName = personality.name || agent_config.assistant_name || 'Lua';
const selectedVoiceId = AVATAR_VOICES[selectedAvatarName] || AVATAR_VOICES['Default'];
```

### 3. Respuesta a VAPI
```json
{
  "workflowId": "5d6025b6-45cb-468f-85f0-6b364a882773",
  "workflowOverrides": { ... },
  "voice": {
    "provider": "11labs",
    "voiceId": "ErXwobaYiN019PkySvjV"  // ID de Hugo, por ejemplo
  }
}
```

---

## 🧪 Verificación de Voces

### Obtener VoiceId Actual
Para verificar qué voz está usando un negocio:

```sql
SELECT 
  name,
  business_name,
  agent_config->'personality'->>'name' as avatar,
  agent_config->>'assistant_name' as assistant_name
FROM businesses
WHERE active = true;
```

### Logs de Supabase
Durante una llamada, verás:
```
✅ Config generada para: Soilua (Avatar: Hugo)
🎙️ Voz seleccionada: Hugo (ErXwobaYiN019PkySvjV)
```

---

## 📝 Cómo Añadir Nuevas Voces

### Paso 1: Obtener el VoiceId de ElevenLabs
1. Ve a [ElevenLabs Dashboard](https://elevenlabs.io/voices)
2. Selecciona la voz que quieres usar
3. Copia el **Voice ID** (ej: `abc123xyz456`)

### Paso 2: Actualizar el Mapeo
Edita `supabase/functions/vapi-inbound-handler/index.ts`:

```typescript
const AVATAR_VOICES: Record<string, string> = {
  'Lua': 'RgXx32WYOGrd7gFNifSf',
  'Clara': 'EXAVITQu4vr4xnSDxMaL',
  'Hugo': 'ErXwobaYiN019PkySvjV',
  'Álex': 'TxGEqnHWrfWFTfGW9XjX',
  'Mariana': 'RgXx32WYOGrd7gFNifSf',
  'NuevoAvatar': 'ABC123XYZ456',  // <-- NUEVO
  'Default': 'RgXx32WYOGrd7gFNifSf'
};
```

### Paso 3: Desplegar
```bash
npx supabase functions deploy vapi-inbound-handler
```

### Paso 4: Configurar en la BD
```sql
UPDATE businesses
SET agent_config = jsonb_set(
  COALESCE(agent_config, '{}'::jsonb),
  '{personality,name}',
  '"NuevoAvatar"'
)
WHERE id = 'tu-business-id';
```

---

## 🎯 Casos de Uso

### Negocio con Avatar Específico
**Soilua (Pelos Bárbaros)**:
- Avatar configurado: `Hugo`
- VoiceId: `ErXwobaYiN019PkySvjV`
- Resultado: Voz masculina

### Negocio sin Avatar Configurado
**La Central (fallback)**:
- Avatar: `NULL` → Default: `Lua`
- VoiceId: `RgXx32WYOGrd7gFNifSf`
- Resultado: Voz femenina por defecto

### Múltiples Negocios, Misma Voz
**Varios negocios pueden compartir la misma voz**:
```typescript
'Mariana': 'RgXx32WYOGrd7gFNifSf',  // Usa voz de Lua
'Lua': 'RgXx32WYOGrd7gFNifSf',      // Misma voz
```

---

## 🔧 Troubleshooting

### Problema: Voz incorrecta en llamadas

**Diagnóstico**:
1. Verifica el avatar en la BD:
   ```sql
   SELECT name, agent_config FROM businesses WHERE id = 'xxx';
   ```

2. Verifica el mapeo en `index.ts`:
   ```typescript
   AVATAR_VOICES['NombreAvatar']
   ```

3. Revisa logs de Supabase:
   ```
   🎙️ Voz seleccionada: Hugo (ErXwobaYiN019PkySvjV)
   ```

4. Revisa logs de VAPI (Dashboard → Calls):
   ```json
   "voice": {
     "provider": "11labs",
     "voiceId": "ErXwobaYiN019PkySvjV"
   }
   ```

**Soluciones comunes**:
- ❌ Avatar no existe en `AVATAR_VOICES` → Se usa `Default`
- ❌ `agent_config` es `NULL` → Se usa `Lua`
- ❌ VoiceId incorrecto → Verifica el ID en ElevenLabs Dashboard

---

## 📊 Resumen de Voces Actuales

| Avatar | VoiceId | Género | Uso |
|--------|---------|--------|-----|
| Lua | `RgXx32WYOGrd7gFNifSf` | Femenino | Principal/Default |
| Clara | `EXAVITQu4vr4xnSDxMaL` | Femenino | Alternativa |
| Hugo | `ErXwobaYiN019PkySvjV` | Masculino | Soilua/Peluquerías |
| Álex | `TxGEqnHWrfWFTfGW9XjX` | Masculino | Alternativa |
| Mariana | `RgXx32WYOGrd7gFNifSf` | Femenino | Comparte voz con Lua |
| Default | `RgXx32WYOGrd7gFNifSf` | Femenino | Fallback automático |

---

## 🎯 Próximos Pasos

Si necesitas añadir más voces o cambiar el mapeo:
1. **Copia el VoiceId** desde ElevenLabs
2. **Edita** `AVATAR_VOICES` en `index.ts`
3. **Despliega** con `npx supabase functions deploy vapi-inbound-handler`
4. **Prueba** llamando al número configurado

✅ **La voz se aplicará automáticamente según el avatar del negocio**


