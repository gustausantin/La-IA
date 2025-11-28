# 🎭 AVATARES Y VOCES - IDs COMPLETOS

**Fecha:** 28 de Noviembre 2025  
**Documento:** Lista completa de IDs de avatares y voces en La-IA

---

## 📋 ÍNDICE

1. [Avatares Predefinidos](#avatares-predefinidos)
2. [Voces ElevenLabs (VAPI)](#voces-elevenlabs-vapi)
3. [Voces para Onboarding](#voces-para-onboarding)
4. [Voces Legacy (Configuración)](#voces-legacy-configuración)
5. [Mapeo Avatar → Voz](#mapeo-avatar--voz)

---

## 🎭 AVATARES PREDEFINIDOS

### Avatar 1: Clara (Carlota)
```javascript
{
  id: 'carlota',
  name: 'Clara',
  gender: 'female',
  avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_1.png',
  voice_id: 'femenina_1',
  voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf.mp3.mp3',
  voice_label: 'Cálida y Profesional',
  voice_description: 'Voz cálida, inteligente y que transmite confianza',
  default_role: 'Agente de Reservas'
}
```

**IDs Importantes:**
- **Avatar ID:** `carlota`
- **Voice ID interno:** `femenina_1`
- **ElevenLabs Voice ID:** `RgXx32WYOGrd7gFNifSf` ⭐

---

### Avatar 2: Hugo (Pedro)
```javascript
{
  id: 'pedro',
  name: 'Hugo',
  gender: 'male',
  avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_4.png',
  voice_id: 'masculina_2',
  voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_2_Danny_wnKyx1zkUEUnfURKiuaP.mp3.mp3',
  voice_label: 'Seguro y Profesional',
  voice_description: 'Voz profesional, clara y que inspira seguridad',
  default_role: 'Especialista en Reservas'
}
```

**IDs Importantes:**
- **Avatar ID:** `pedro`
- **Voice ID interno:** `masculina_2`
- **ElevenLabs Voice ID:** `ErXwobaYiN019PkySvjV` ⭐

---

### Avatar 3: Álex (Carlos)
```javascript
{
  id: 'carlos',
  name: 'Álex',
  gender: 'male',
  avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_3.png',
  voice_id: 'masculina_1',
  voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_1_Viraj_iWNf11sz1GrUE4ppxTOL.mp3.mp3',
  voice_label: 'Amigable y Cercano',
  voice_description: 'Voz amigable, accesible y confiable',
  default_role: 'Agente de Atención'
}
```

**IDs Importantes:**
- **Avatar ID:** `carlos`
- **Voice ID interno:** `masculina_1`
- **ElevenLabs Voice ID:** `TxGEqnHWrfWFTfGW9XjX` ⭐

---

### Avatar 4: Lua (Elena)
```javascript
{
  id: 'elena',
  name: 'Lua',
  gender: 'female',
  avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_2.png',
  voice_id: 'femenina_2',
  voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_2_Susi_v3V1d2rk6528UrLKRuy8.mp3.mp3',
  voice_label: 'Joven y Dinámica',
  voice_description: 'Voz joven, enérgica y proactiva',
  default_role: 'Asistente Virtual'
}
```

**IDs Importantes:**
- **Avatar ID:** `elena`
- **Voice ID interno:** `femenina_2`
- **ElevenLabs Voice ID:** `RgXx32WYOGrd7gFNifSf` ⭐

---

## 🎙️ VOCES ELEVENLABS (VAPI)

**Ubicación:** `supabase/functions/vapi-inbound-handler/index.ts`

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

### Tabla Resumen VAPI

| Nombre Avatar | ElevenLabs Voice ID | Género | Descripción |
|---------------|---------------------|---------|-------------|
| **Lua** | `RgXx32WYOGrd7gFNifSf` | Femenino | Voz principal femenina (Eva Dorado) |
| **Clara** | `EXAVITQu4vr4xnSDxMaL` | Femenino | Voz alternativa femenina |
| **Hugo** | `ErXwobaYiN019PkySvjV` | Masculino | Voz masculina profesional |
| **Álex** | `TxGEqnHWrfWFTfGW9XjX` | Masculino | Voz masculina alternativa |
| **Mariana** | `RgXx32WYOGrd7gFNifSf` | Femenino | Usa misma voz que Lua |
| **Default** | `RgXx32WYOGrd7gFNifSf` | Femenino | Fallback (Lua) |

---

## 🎤 VOCES PARA ONBOARDING

**Ubicación:** `src/components/onboarding/steps/Step3Assistant.jsx`

```javascript
const VOICE_OPTIONS = [
  {
    id: 'female-1',
    gender: 'female',
    display_name: 'Voz Femenina 1',
    description: 'Profesional y cálida',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female%201%20Susi.mp3',
    elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL'
  },
  {
    id: 'female-2',
    gender: 'female',
    display_name: 'Voz Femenina 2',
    description: 'Joven y dinámica',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female%202%20Eva.mp3',
    elevenlabs_voice_id: 'ThT5KcBeYPX3keUQqHPh'
  },
  {
    id: 'male-1',
    gender: 'male',
    display_name: 'Voz Masculina 1',
    description: 'Amigable y cercano',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male%201%20Mark.mp3',
    elevenlabs_voice_id: 'TX3LPaxmHKxFdv7VOQHJ'
  },
  {
    id: 'male-2',
    gender: 'male',
    display_name: 'Voz Masculina 2',
    description: 'Seguro y profesional',
    audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male%202%20Viraj.mp3',
    elevenlabs_voice_id: 'pNInz6obpgDQGcFmaJgB'
  }
];
```

### Tabla Resumen Onboarding

| ID Interno | Display Name | ElevenLabs Voice ID | Género | Descripción |
|------------|--------------|---------------------|---------|-------------|
| `female-1` | Voz Femenina 1 | `EXAVITQu4vr4xnSDxMaL` | Femenino | Profesional y cálida |
| `female-2` | Voz Femenina 2 | `ThT5KcBeYPX3keUQqHPh` | Femenino | Joven y dinámica |
| `male-1` | Voz Masculina 1 | `TX3LPaxmHKxFdv7VOQHJ` | Masculino | Amigable y cercano |
| `male-2` | Voz Masculina 2 | `pNInz6obpgDQGcFmaJgB` | Masculino | Seguro y profesional |

---

## 📝 VOCES LEGACY (Configuración)

**Ubicación:** `src/pages/Configuracion.jsx`

```javascript
const VOICE_CATALOG = [
    {
        id: 'Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf',
        display_name: 'Femenina 1',
        description: 'Voz cálida y profesional',
        gender: 'female',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf.mp3.mp3'
    },
    {
        id: 'Female_2_Susi_v3V1d2rk6528UrLKRuy8',
        display_name: 'Femenina 2',
        description: 'Voz joven y dinámica',
        gender: 'female',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_2_Susi_v3V1d2rk6528UrLKRuy8.mp3.mp3'
    },
    {
        id: 'Male_1_Viraj_iWNf11sz1GrUE4ppxTOL',
        display_name: 'Masculina 1',
        description: 'Voz profesional y clara',
        gender: 'male',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_1_Viraj_iWNf11sz1GrUE4ppxTOL.mp3.mp3'
    },
    {
        id: 'Male_2_Danny_wnKyx1zkUEUnfURKiuaP',
        display_name: 'Masculina 2',
        description: 'Voz energética y cercana',
        gender: 'male',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_2_Danny_wnKyx1zkUEUnfURKiuaP.mp3.mp3'
    }
];
```

### Tabla Resumen Legacy

| ID Completo | Display Name | ElevenLabs ID (extraído) | Género |
|-------------|--------------|---------------------------|---------|
| `Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf` | Femenina 1 | `RgXx32WYOGrd7gFNifSf` | Femenino |
| `Female_2_Susi_v3V1d2rk6528UrLKRuy8` | Femenina 2 | `v3V1d2rk6528UrLKRuy8` | Femenino |
| `Male_1_Viraj_iWNf11sz1GrUE4ppxTOL` | Masculina 1 | `iWNf11sz1GrUE4ppxTOL` | Masculino |
| `Male_2_Danny_wnKyx1zkUEUnfURKiuaP` | Masculina 2 | `wnKyx1zkUEUnfURKiuaP` | Masculino |

---

## 🔗 MAPEO AVATAR → VOZ

### Relación Completa

| Avatar ID | Nombre Avatar | Voice ID Interno | ElevenLabs Voice ID | Género |
|-----------|---------------|------------------|---------------------|---------|
| `carlota` | Clara | `femenina_1` | `RgXx32WYOGrd7gFNifSf` | Femenino |
| `pedro` | Hugo | `masculina_2` | `ErXwobaYiN019PkySvjV` | Masculino |
| `carlos` | Álex | `masculina_1` | `TxGEqnHWrfWFTfGW9XjX` | Masculino |
| `elena` | Lua | `femenina_2` | `RgXx32WYOGrd7gFNifSf` | Femenino |

---

## 🎯 IDS ÚNICOS DE ELEVENLABS (PARA PRODUCCIÓN)

**IDs únicos que se usan en VAPI para llamadas telefónicas:**

```
RgXx32WYOGrd7gFNifSf  ← Lua (Femenina principal) / Clara / Mariana / Default
EXAVITQu4vr4xnSDxMaL  ← Clara (alternativa en Onboarding)
ErXwobaYiN019PkySvjV  ← Hugo (Masculina profesional)
TxGEqnHWrfWFTfGW9XjX  ← Álex (Masculina alternativa)
ThT5KcBeYPX3keUQqHPh  ← Onboarding Female 2
TX3LPaxmHKxFdv7VOQHJ  ← Onboarding Male 1
pNInz6obpgDQGcFmaJgB  ← Onboarding Male 2
v3V1d2rk6528UrLKRuy8  ← Legacy Femenina 2
iWNf11sz1GrUE4ppxTOL  ← Legacy Masculina 1
wnKyx1zkUEUnfURKiuaP  ← Legacy Masculina 2
```

---

## 📂 UBICACIÓN DE ARCHIVOS CLAVE

```
src/config/avatars.js                              ← Avatares predefinidos
supabase/functions/vapi-inbound-handler/index.ts   ← Mapa VAPI (AVATAR_VOICES)
src/components/onboarding/steps/Step3Assistant.jsx ← Voces Onboarding
src/pages/Configuracion.jsx                        ← Voces Legacy
```

---

## 🔍 NOTAS IMPORTANTES

1. **Voz más usada:** `RgXx32WYOGrd7gFNifSf` (Lua/Clara/Mariana/Default)
2. **Voz masculina principal:** `ErXwobaYiN019PkySvjV` (Hugo)
3. **Sistema de Fallback:** Si no se encuentra el avatar, usa `Default` → Lua
4. **Inconsistencias detectadas:**
   - Clara (carlota) tiene `voice_id: femenina_1` pero mapea a `RgXx32WYOGrd7gFNifSf`
   - Clara en VAPI mapea a `EXAVITQu4vr4xnSDxMaL` (diferente)
   - Lua (elena) tiene `voice_id: femenina_2` pero también mapea a `RgXx32WYOGrd7gFNifSf`

---

## ✅ VALIDACIÓN

Para verificar que una voz funciona en producción:

1. **Ir a ElevenLabs Dashboard:** https://elevenlabs.io
2. **Voice Library** → Buscar el Voice ID
3. **Probar audio** → Copiar Voice ID si está activo
4. **Actualizar mapeo** en `vapi-inbound-handler/index.ts`

---

**Última actualización:** 28 de Noviembre 2025

