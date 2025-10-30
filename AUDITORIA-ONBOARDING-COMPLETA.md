# 🔍 AUDITORÍA COMPLETA DEL ONBOARDING - ESTADO ACTUAL

**Fecha**: 30 de octubre de 2025  
**Objetivo**: Entender el estado actual antes de implementar el onboarding de 4 pasos WOW-First

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual
- **Onboarding actual**: 5 pasos funcionales
- **Base de datos**: Supabase con ~61 tablas
- **Estructura**: Multi-tenant con `businesses` como entidad principal
- **Store**: Zustand con persistencia en localStorage
- **Componentes**: 5 archivos en `src/components/onboarding/steps/`

### Cambio Propuesto
- **Nuevo onboarding**: 4 pasos ultra-rápidos (3-4 minutos)
- **Filosofía**: "WOW-First" - demostrar valor antes de pedir configuración completa
- **Cambio de estrategia**: Mover configuración pesada al "Copilot" post-onboarding

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### Tabla Principal: `businesses`

```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vertical_type vertical_type,  -- ENUM: 10 verticales
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'España',
    postal_code VARCHAR(20),
    plan VARCHAR(50) DEFAULT 'trial',
    active BOOLEAN DEFAULT TRUE,
    assigned_phone TEXT,  -- Número del pool de LA-IA
    settings JSONB DEFAULT '{}',
    agent_config JSONB DEFAULT '{}',
    business_hours JSONB DEFAULT '{}',
    onboarding_completed BOOLEAN,
    onboarding_step INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columnas Clave para Onboarding:**
- `vertical_type`: Tipo de negocio (fisioterapia, peluqueria_barberia, etc.)
- `agent_config`: Configuración del asistente IA (nombre, voz)
- `business_hours`: Horarios en formato JSONB
- `assigned_phone`: Número telefónico asignado del pool
- `onboarding_completed`: Flag de onboarding terminado
- `onboarding_step`: Paso actual del onboarding

---

### ENUM: `vertical_type`

10 verticales definidos:
```sql
'fisioterapia'
'masajes_osteopatia'
'clinica_dental'
'psicologia_coaching'
'centro_estetica'
'peluqueria_barberia'
'centro_unas'
'entrenador_personal'
'yoga_pilates'
'veterinario'
```

---

### Tabla: `service_templates`

**Propósito**: Plantillas de servicios sugeridos por vertical

```sql
CREATE TABLE service_templates (
    id UUID PRIMARY KEY,
    vertical_type vertical_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    duration_minutes INTEGER,  -- NULLABLE (desde migración 20251029_01)
    suggested_price NUMERIC,   -- NULLABLE (desde migración 20251029_01)
    is_popular BOOLEAN DEFAULT FALSE,
    sort_order INTEGER,
    metadata JSONB DEFAULT '{}'
);
```

**Estado Actual**:
- ✅ Ya tiene ~75 servicios pre-cargados (migración `20251029_02_onboarding_5_steps.sql`)
- ✅ `duration_minutes` y `suggested_price` son OPCIONALES
- ✅ Servicios organizados por `vertical_type`
- ✅ Flag `is_popular` para destacar los más comunes

**Ejemplo de datos:**
```sql
-- Fisioterapia (8 servicios)
('fisioterapia', 'Primera Visita / Valoración', 'Evaluación inicial', 'Consulta', NULL, NULL, true, 1)
('fisioterapia', 'Sesión Seguimiento', 'Sesión de fisioterapia', 'Traumatología', NULL, NULL, true, 2)

-- Peluquería (10 servicios)
('peluqueria_barberia', 'Corte Mujer', 'Corte de pelo femenino', 'Cabello', NULL, NULL, true, 1)
('peluqueria_barberia', 'Corte Hombre', 'Corte de pelo masculino', 'Cabello', NULL, NULL, true, 2)
```

---

### Tabla: `inventario_telefonos`

**Propósito**: Pool de números telefónicos de Vonage/Twilio para asignar a negocios

```sql
CREATE TABLE inventario_telefonos (
    id UUID PRIMARY KEY,
    numero_telefono TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('disponible', 'asignado', 'en_cuarentena')),
    id_negocio_asignado UUID REFERENCES businesses(id),
    fecha_asignacion TIMESTAMPTZ,
    fecha_liberacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Estado Actual**:
- ✅ Tabla creada (`20251029_04_phone_inventory.sql`)
- ✅ Primer número insertado: `+34931204462`
- ✅ Edge Functions creadas:
  - `assign-available-number` (asignar número)
  - `release-business-number` (liberar número)
- ✅ Cron job para reciclar números después de 48h de cuarentena

---

### Tabla: `user_business_mapping`

**Propósito**: Relación many-to-many entre usuarios y negocios

```sql
CREATE TABLE user_business_mapping (
    id UUID PRIMARY KEY,
    auth_user_id UUID NOT NULL,  -- FK a auth.users
    business_id UUID NOT NULL REFERENCES businesses(id),
    role VARCHAR(50) DEFAULT 'owner',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📦 STORE DE ZUSTAND

**Archivo**: `src/stores/onboardingStore.js`

### Estado Actual (5 pasos)

```javascript
{
  // Control
  currentStep: 1,
  isLoading: false,
  error: null,
  
  // Paso 1: Perfil y Vertical
  businessName: '',
  businessPhone: '',
  selectedVertical: null,
  verticalConfig: null,
  businessData: { address, city, postalCode },
  
  // Paso 2: Horario Base
  businessHours: {
    monday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
    // ... resto de días
  },
  
  // Paso 3: Asistente IA
  assistantName: 'María',
  assistantVoice: 'female',  // ID de ElevenLabs
  
  // Paso 4: Conexión
  assignedPhone: null,  // Número del pool
  whatsappNumber: '',
  phoneOperator: '',
  connectionVerified: false,
  
  // Paso 5: Confirmación
  confirmationComplete: false
}
```

### Acciones Disponibles

```javascript
// Navegación
setStep(step)
nextStep()
prevStep()

// Paso 1
setBusinessName(name)
setBusinessPhone(phone)
setSelectedVertical(vertical)
setBusinessData(data)

// Paso 2
updateDayHours(day, hours)
addTimeBlock(day)
removeTimeBlock(day, index)
applyToWeekdays(hours)

// Paso 3
setAssistantName(name)
setAssistantVoice(voiceId)

// Paso 4
setAssignedPhone(phone)
setPhoneOperator(operator)
setConnectionVerified(boolean)

// Utils
isStepValid(step)
getAllData()
reset()
```

---

## 🎨 COMPONENTES ACTUALES

### 1. `Step1ProfileVertical.jsx`

**Propósito**: Selección de vertical y datos básicos del negocio

**Funcionalidad**:
- ✅ Cuadrícula de 10 verticales con iconos
- ✅ Formulario con: nombre, teléfono, dirección, ciudad, CP
- ✅ Llama a `getVerticalOnboardingConfig()` Edge Function
- ✅ Guarda `selectedVertical` y `verticalConfig` en store

**UI**:
- Cuadrícula responsive (1/2/3 columnas)
- Iconos con gradientes de color
- Animaciones hover
- Validación de campos obligatorios

---

### 2. `Step2Schedule.jsx`

**Propósito**: Configuración de horarios de atención

**Funcionalidad**:
- ✅ 7 días de la semana con toggle abierto/cerrado
- ✅ Múltiples bloques horarios por día (ej: 9-14h y 16-20h)
- ✅ Función "Copiar horario de lunes a todos los laborables"
- ✅ Selector de horas con intervalos de 15 minutos

**Estructura de datos**:
```javascript
{
  monday: {
    isOpen: true,
    timeBlocks: [
      { openTime: '09:00', closeTime: '14:00' },
      { openTime: '16:00', closeTime: '20:00' }
    ]
  }
}
```

---

### 3. `Step3Assistant.jsx`

**Propósito**: Personalización del asistente de IA

**Funcionalidad**:
- ✅ Input para nombre del asistente (ej: "Laia", "Carlos")
- ✅ 4 opciones de voz con preview (2 femeninas, 2 masculinas)
- ✅ Audio demos desde Supabase Storage (`voice-demos` bucket)
- ✅ Reproducción inline con `<audio>` HTML5

**Voces disponibles**:
```javascript
[
  { id: 'female-1', display_name: 'Voz Femenina 1', elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL' },
  { id: 'female-2', display_name: 'Voz Femenina 2', elevenlabs_voice_id: 'ThT5KcBeYPX3keUQqHPh' },
  { id: 'male-1', display_name: 'Voz Masculina 1', elevenlabs_voice_id: 'TX3LPaxmHKxFdv7VOQHJ' },
  { id: 'male-2', display_name: 'Voz Masculina 2', elevenlabs_voice_id: 'pNInz6obpgDQGcFmaJgB' }
]
```

---

### 4. `Step4Connection.jsx`

**Propósito**: Activación del desvío telefónico

**Funcionalidad**:
- ✅ Asigna número del pool automáticamente (`assignAvailableNumber()`)
- ✅ Selector de operador (Movistar, Vodafone, Orange, etc.)
- ✅ Genera código de desvío incondicional (`**21*+34...#`)
- ✅ Botón "Copiar código"
- ✅ Checkbox obligatorio "He activado el desvío"
- ✅ Input opcional para WhatsApp de alertas

**Estados**:
- Loading: Asignando número del pool
- Error: No hay números disponibles
- Success: Número asignado + instrucciones

---

### 5. `Step5Confirmation.jsx`

**Propósito**: Resumen y confirmación final

**Funcionalidad**:
- ✅ 4 tarjetas con resumen:
  1. Tu Negocio (nombre, vertical, teléfono)
  2. Horario Configurado (días y horas agrupados)
  3. Tu Asistente IA (nombre, voz)
  4. Conexiones Activas (desvío + WhatsApp)
- ✅ Botones "Editar" para volver a pasos anteriores
- ✅ Botón final "Confirmar y Activar"

**Lógica al confirmar** (`handleConfirm`):
1. Crea el registro en `businesses`
2. Reasigna el número telefónico al `business_id` real
3. Crea el mapping en `user_business_mapping`
4. Crea servicios (desde `verticalConfig`)
5. Crea recursos
6. Crea horarios en `business_operating_hours`
7. Guarda WhatsApp en `channel_credentials`
8. Marca `onboarding_completed: true`
9. Redirige a `/dashboard`

---

## 🔧 SERVICIOS Y EDGE FUNCTIONS

### `onboardingService.js`

**Funciones**:
1. `getVerticalOnboardingConfig(verticalType)`
   - Llama a Edge Function `get-vertical-onboarding-config`
   - Retorna: nombres de recursos, servicios sugeridos, duración por defecto
   - Tiene fallback estático si Edge Function falla

2. `createBusinessWithOnboarding(businessData, verticalConfig)`
   - Crea negocio, mapping, servicios, recursos, horarios
   - Función completa para finalizar onboarding

---

### `phoneInventoryService.js`

**Funciones**:
1. `assignAvailableNumber(businessId)`
   - Llama a `assign-available-number` Edge Function
   - Asigna número del pool de forma atómica (con `FOR UPDATE`)
   - Tiene fallback temporal para desarrollo

2. `releaseBusinessNumber(businessId)`
   - Llama a `release-business-number` Edge Function
   - Libera número y lo pone en cuarentena de 48h

---

### Edge Functions Desplegadas

1. **`assign-available-number`** (`supabase/functions/`)
   - Busca número `disponible` con `FOR UPDATE`
   - Actualiza `inventario_telefonos` y `businesses`
   - Retorna `NO_INVENTORY` si no hay números

2. **`release-business-number`** (`supabase/functions/`)
   - Pone número en `en_cuarentena`
   - Registra `fecha_liberacion`
   - Limpia `assigned_phone` en `businesses`

3. **`get-vertical-onboarding-config`** (mencionada, pero no revisada)
   - Retorna configuración dinámica por vertical

---

## 📋 MIGRACIONES APLICADAS

### Orden cronológico:

1. **`20251027_001_update_create_business_function.sql`**
   - Función `create_business_securely()`
   - Función `get_user_business_info()`

2. **`20251027_002_rls_policies_businesses.sql`**
   - RLS para `businesses`

3. **`20251028_fix_vertical_enum.sql`**
   - Añade los 10 valores al ENUM `vertical_type`

4. **`20251029_01_alter_service_templates.sql`**
   - Hace `duration_minutes` y `suggested_price` NULLABLE

5. **`20251029_02_onboarding_5_steps.sql`**
   - Inserta ~75 servicios en `service_templates`

6. **`20251029_03_voice_demos_bucket.sql`**
   - Crea bucket `voice-demos` en Supabase Storage

7. **`20251029_04_phone_inventory.sql`**
   - Crea `inventario_telefonos`
   - Añade `assigned_phone` a `businesses`
   - Inserta primer número: `+34931204462`

8. **`20251029_05_cron_recycle_numbers.sql`**
   - Crea función `reciclar_numeros_cuarentena()`
   - Cron job cada hora para reciclar números

9. **`20251029_06_fix_invalid_vertical.sql`**
   - Corrige negocios con `vertical_type = 'otros'` → `'fisioterapia'`

---

## 🎯 LO QUE FALTA / NO EXISTE

### ❌ Tablas que NO existen (pero se mencionan en código):
- `services` o `business_services` (para servicios reales del negocio)
- `resources` o `business_resources` (para camillas, sillas, etc.)
- `business_operating_hours` (para horarios)

**Nota**: El esquema actual usa `tables` (mesas de restaurante). Necesitamos adaptar para autónomos.

---

### ❌ Edge Function `get-vertical-onboarding-config`
- **Estado**: Mencionada en `onboardingService.js` pero no existe en `supabase/functions/`
- **Workaround**: Fallback estático funciona correctamente

---

### ❌ Sistema de "Demo Interactiva" (Paso 3 del nuevo onboarding)
- **Estado**: No existe
- **Requiere**:
  - Tabla `demo_sessions` (sesiones temporales de demo)
  - Mini-calendario de disponibilidad
  - Integración con sistema de voz (n8n + Vapi/OpenAI)
  - Polling/websocket para detectar llamada completada

---

### ❌ Sistema "Copilot" (Configuración Guiada Post-Onboarding)
- **Estado**: No existe
- **Requiere**:
  - Componente `CopilotBanner.jsx` en Dashboard
  - 5 pasos de configuración guiada
  - Sistema de tracking de progreso

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. Nomenclatura inconsistente
- La app original era para **restaurantes** (`restaurants`, `tables`, `reservations`)
- Estamos migrando a **autónomos** (`businesses`, `resources`, `appointments`)
- Algunos archivos/funciones aún tienen nombres legacy

### 2. Tablas críticas no documentadas
- No hay claridad sobre dónde se guardan los **servicios reales** del negocio
- No hay claridad sobre dónde se guardan los **recursos** (camillas, sillas, etc.)
- El schema exportado (`DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql`) es legacy de restaurantes

### 3. Desvío telefónico: UX confusa
- El actual `Step4Connection.jsx` pide desvío **incondicional** (`**21*`)
- Esto genera pánico en usuarios (pierden control del teléfono)
- **Solución**: Cambiar a desvío **condicional** (`**61*` / `**67*`) en el Copilot

### 4. Edge Functions
- `get-vertical-onboarding-config` no está desplegada
- El código frontend depende de ella pero tiene fallback

---

## ✅ LO QUE FUNCIONA BIEN

1. **Store de Zustand**: Bien estructurado, con persistencia
2. **Componentes de UI**: Responsive, accesibles, bien diseñados
3. **Pool de números telefónicos**: Sistema robusto con cuarentena
4. **Selector de voces**: Previews de audio funcionan correctamente
5. **Validaciones**: Cada paso valida correctamente antes de avanzar
6. **Service templates**: 75 servicios pre-cargados y bien organizados

---

## 📝 RECOMENDACIONES PARA EL NUEVO ONBOARDING (4 PASOS)

### Cambios a Nivel de Base de Datos

#### 1. Crear tablas que faltan:

```sql
-- Servicios reales del negocio
CREATE TABLE business_services (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recursos (camillas, sillas, etc.)
CREATE TABLE business_resources (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    name TEXT NOT NULL,
    resource_type TEXT,  -- 'camilla', 'silla', 'sala', etc.
    capacity INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para demo sessions
CREATE TABLE demo_sessions (
    id UUID PRIMARY KEY,
    business_name TEXT,
    vertical_type TEXT,
    assistant_name TEXT,
    voice_id TEXT,
    demo_slots JSONB,
    whatsapp TEXT,
    demo_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
    completed BOOLEAN DEFAULT FALSE
);
```

#### 2. Añadir columnas a `businesses`:

```sql
ALTER TABLE businesses
ADD COLUMN agent_status TEXT DEFAULT 'OFF' CHECK (agent_status IN ('OFF', 'DEMO', 'ACTIVE')),
ADD COLUMN copilot_step INTEGER DEFAULT 0,
ADD COLUMN copilot_completed BOOLEAN DEFAULT FALSE;
```

---

### Cambios a Nivel de Componentes

#### **Paso 1: Identity** (nuevo)
- Reutilizar parte de `Step1ProfileVertical.jsx`
- Simplificar: solo vertical + nombre del negocio
- Remover: dirección, teléfono, ciudad (moverlo al Copilot)

#### **Paso 2: Assistant** (ya existe)
- Reutilizar `Step3Assistant.jsx` completo
- Sin cambios mayores

#### **Paso 3: Demo** (nuevo - el más complejo)
- Crear desde cero `Step3Demo.jsx`
- 3 fases:
  - Fase A: Configurar demo (mini-calendario, WhatsApp)
  - Fase B: Llamar al número de demo
  - Fase C: Confirmación de éxito
- **Desafío técnico**: Integración con sistema de voz

#### **Paso 4: GoToApp** (nuevo)
- Crear desde cero `Step4GoToApp.jsx`
- UI motivacional: "¡Vamos a configurarlo!"
- Preview de los pasos del Copilot
- Botón "Ir a mi Panel"

---

### Cambios a Nivel de Store

```javascript
// Nuevo estado para 4 pasos
{
  currentStep: 1,
  
  // Paso 1
  vertical: null,
  businessName: '',
  
  // Paso 2
  assistantName: '',
  assistantVoice: null,
  
  // Paso 3 (Demo)
  demoConfig: {
    defaultServiceName: '',
    defaultServiceDuration: 60,
    demoSlots: {},
    whatsappForDemo: ''
  },
  demoCompleted: false,
  
  // Paso 4 (no requiere datos, solo UI)
}
```

---

### Cambios a Nivel de Backend

#### Edge Function: `complete-onboarding`

```typescript
// Input:
{
  businessName: string,
  vertical: string,
  assistantName: string,
  assistantVoice: string
}

// Acciones:
// 1. Crear businesses (con agent_status: 'OFF')
// 2. Crear user_business_mapping
// 3. Pre-crear 1 servicio genérico (desde service_templates)
// 4. Pre-crear 1 recurso genérico
// 5. Pre-crear horario por defecto (L-V 9-20h)
// 6. Retornar business_id

// Output:
{
  success: true,
  business_id: UUID
}
```

---

## 🎯 PLAN DE ACCIÓN PROPUESTO

### FASE 1: PREPARACIÓN (1-2 horas)
1. ✅ Crear migraciones SQL:
   - `business_services`
   - `business_resources`
   - `demo_sessions`
   - Columnas nuevas en `businesses`

2. ✅ Actualizar `onboardingStore.js` para 4 pasos

3. ✅ Crear carpeta `src/components/copilot/` para el sistema guiado

---

### FASE 2: ONBOARDING (6-8 horas)
1. ✅ Adaptar `Step1Identity.jsx` (simplificar `Step1ProfileVertical.jsx`)
2. ✅ Renombrar `Step3Assistant.jsx` → `Step2Assistant.jsx`
3. ✅ Crear `Step3Demo.jsx` (El más complejo)
   - Mini-calendario de disponibilidad
   - Integración con demo phone
   - Polling para detectar llamada completada
4. ✅ Crear `Step4GoToApp.jsx`
5. ✅ Actualizar `OnboardingWizard.jsx`

---

### FASE 3: BACKEND (3-4 horas)
1. ✅ Crear Edge Function `complete-onboarding`
2. ✅ Actualizar `onboardingService.js`
3. ✅ Crear servicio `demoService.js`

---

### FASE 4: COPILOT (10-12 horas) - Post-Onboarding
1. ✅ Crear `CopilotBanner.jsx`
2. ✅ Crear 5 pasos del Copilot:
   - Paso 1: Horario Real
   - Paso 2: Servicios y Precios
   - Paso 3: Recursos
   - Paso 4: Bloquear Citas Existentes
   - Paso 5: Conectar Línea Telefónica (desvío condicional)

---

## 🏁 CONCLUSIÓN

### Estado Actual: ✅ Sólido pero orientado a restaurantes
- La base está bien construida
- Hay trabajo de migración de nomenclatura pendiente
- Falta claridad en algunas tablas críticas

### Nuevo Onboarding: 🚀 Factible y bien pensado
- **Tiempo estimado total**: 20-26 horas de desarrollo
- **Complejidad alta**: Paso 3 (Demo Interactiva)
- **Complejidad media**: Copilot (5 pasos guiados)
- **Impacto en conversión**: Potencialmente +40-50%

### Priorización:
1. **CRÍTICO**: Crear tablas `business_services` y `business_resources`
2. **CRÍTICO**: Edge Function `complete-onboarding`
3. **ALTO**: Paso 3 (Demo Interactiva)
4. **MEDIO**: Copilot (puede ser fase 2)

---

**FIN DE LA AUDITORÍA** ✅

