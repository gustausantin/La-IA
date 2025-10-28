# 🎯 PLAN MAESTRO: RECEPCIONISTA IA

**Fecha de inicio:** 27 de octubre de 2025  
**Objetivo:** Construir la mejor aplicación de gestión para profesionales del mundo  
**Principio fundamental:** CALIDAD ANTES QUE VELOCIDAD

---

## 📊 ESTADO ACTUAL (Checkpoint 27-Oct-2025)

### ✅ Completado (Fase 0 - Limpieza)

- ✅ **Migración completa del modelo de datos**
  - `restaurants` → `businesses` (50+ archivos)
  - `reservations` → `appointments`
  - `tables` → `resources`
  - `user_restaurant_mapping` → `user_business_mapping`

- ✅ **Base de datos limpia y consistente**
  - Función RPC: `create_business_securely` ✅
  - Políticas RLS configuradas ✅
  - Build exitoso sin errores ✅

- ✅ **Onboarding base implementado**
  - 10 verticales profesionales definidos
  - Wizard de 8 pasos (estructura)
  - Servicios por defecto según vertical

### 📋 Tablas Confirmadas en Supabase (27 tablas)

```sql
✅ business_verticals           -- Catálogo de verticales
✅ service_templates             -- Templates de servicios
✅ businesses                    -- Negocio principal (tenant)
✅ resources                     -- Camillas, sillas, cabinas
✅ services                      -- Servicios del negocio
✅ appointments                  -- Citas/reservas
✅ availability_slots            -- Disponibilidad calculada
✅ customers                     -- Clientes (CRM básico)
✅ business_operating_hours      -- Horarios de apertura
✅ business_shifts               -- Turnos de empleados
✅ calendar_exceptions           -- Días festivos, cierres
✅ agent_conversations           -- Conversaciones con IA
✅ agent_messages                -- Mensajes individuales de IA
✅ message_templates             -- Plantillas de mensajes
✅ customer_confirmations        -- Confirmaciones de citas
✅ customer_feedback             -- Feedback post-visita (NPS)
✅ analytics                     -- Métricas agregadas
✅ profiles                      -- Perfiles de usuario
✅ user_business_mapping         -- Relación usuario-negocio
✅ notifications                 -- Notificaciones in-app
✅ agent_metrics                 -- Métricas de IA
✅ channel_credentials           -- Credenciales WhatsApp, etc
✅ escalations                   -- Escalaciones a humano
✅ crm_interactions              -- Interacciones CRM
✅ automation_rules              -- Reglas de automatización
✅ scheduled_messages            -- Mensajes programados
✅ whatsapp_message_buffer       -- Buffer de WhatsApp
```

### ⚠️ Tablas Faltantes (Nuevas Features)

```sql
❌ integrations                  -- OAuth tokens (Google Calendar)
❌ ai_agents                     -- Agentes IA por negocio
❌ call_logs                     -- Logs de llamadas telefónicas
❌ voice_recordings              -- Grabaciones de voz
❌ google_calendar_events        -- Caché de eventos GCal
```

---

## 🎯 MISIÓN Y VISIÓN

### Nuestra Verdad

**NO somos un "Booksy más barato".**

Somos una **capa de inteligencia artificial por voz** que se integra de forma invisible en las herramientas que nuestros usuarios ya utilizan (su teléfono y su Google Calendar).

**Solucionamos el dolor de la interrupción y la pérdida de reservas.**

### Usuario Objetivo

- **Perfil:** Autónomos y negocios pequeños (1-5 empleados)
- **Sin:** Recepcionista dedicado
- **Dolor:** Interrupciones constantes mientras atienden clientes
- **Pérdida:** Cada llamada perdida = dinero perdido

### Verticales Iniciales (España)

1. Fisioterapeutas ⭐ (Prioridad #1)
2. Psicólogos / Terapeutas
3. Masajistas / Osteópatas
4. Clínicas dentales pequeñas
5. Centros de estética (uñas, pestañas, depilación)
6. Peluquerías / Barberías
7. Centros de uñas
8. Entrenadores personales
9. Yoga / Pilates
10. Veterinarios

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Confirmado

**Frontend:**
- React 18.3.1 + Vite 5.4.8
- React Router 6.26.2
- Tailwind CSS 3.4.13
- Zustand 4.5.5 (state management)
- React Hook Form (formularios)
- Supabase Client

**Backend:**
- Node.js 20.x + Express 4.21.1
- Supabase (PostgreSQL 15.x)
- Edge Functions (Deno)
- N8n (workflows externos)

**Integraciones Clave:**
- Google Calendar API (OAuth 2.0)
- VAPI.ai (IA de voz conversacional)
- WhatsApp Business API (Meta)
- OpenAI Assistants API

**Infraestructura:**
- Vercel (hosting + API routes)
- Supabase (BaaS completo)
- Hostinger (SMTP)

---

## 📱 ROADMAP EJECUTIVO (12 Semanas)

### SPRINT 1-2: Onboarding World-Class + Google Calendar (Semanas 1-4)

**Objetivo:** Usuario puede registrarse, configurar su negocio y conectar Google Calendar.

#### Tickets Backend

**B-001: Crear tabla `integrations`**
```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google_calendar', 'whatsapp', etc
  credentials JSONB NOT NULL, -- Cifrado: refresh_token, etc
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
  scopes TEXT[], -- Permisos OAuth
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, provider)
);
```

**B-002: Edge Function `/api/integrations/google/oauth`**
- Endpoint: `POST /api/integrations/google/oauth`
- Body: `{ code, business_id }`
- Acción:
  1. Intercambiar `code` por `access_token` + `refresh_token`
  2. Cifrar `refresh_token` (AES-256)
  3. INSERT en `integrations`
  4. Return: `{ success: true, calendar_connected: true }`

**B-003: Edge Function `/api/integrations/google/sync`**
- Endpoint: `POST /api/integrations/google/sync`
- Body: `{ business_id, action: 'pull' | 'push' }`
- Acción Pull:
  1. Consultar `integrations` para obtener `refresh_token`
  2. Llamar a Google Calendar API (listar eventos)
  3. Hacer UPSERT en tabla `appointments` con `source = 'google_calendar'`
- Acción Push:
  1. Consultar `appointments` con `source = 'manual'` y `synced_to_gcal = false`
  2. Crear eventos en Google Calendar
  3. Actualizar `synced_to_gcal = true`

**B-004: Tabla `google_calendar_events` (caché)**
```sql
CREATE TABLE google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  gcal_event_id TEXT NOT NULL, -- ID del evento en GCal
  appointment_id UUID REFERENCES appointments(id),
  summary TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT, -- 'confirmed', 'cancelled'
  raw_data JSONB, -- Evento completo de GCal
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, gcal_event_id)
);
```

#### Tickets Frontend

**F-001: Pantalla 3 - Horarios**
- Componente: `<BusinessHoursEditor />`
- UI: Calendario semanal con pickers de rango
- Lógica:
  - Cada día puede tener múltiples rangos (ej. 09:00-13:00, 15:00-19:00)
  - Opción "Cerrado" para días no laborables
  - Guardar en `business_operating_hours`

**F-002: Pantalla 4 - Conectar Google Calendar** ⭐
- Botón "Conectar con Google"
- Flujo OAuth (Expo Auth Session o Web OAuth)
- Scopes necesarios:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.readonly`
- Al recibir `code`:
  1. Llamar a `/api/integrations/google/oauth`
  2. Mostrar "✅ Calendar conectado"
  3. Trigger sync inicial (pull)

**F-003: Pantalla 5 - Personalidad IA (Mock)**
- Selector de voz: "María", "David", "Ana"
- Campo editable: Script de bienvenida
- Guardar en `businesses.settings.ai_config`

**F-004: Pantalla 6 - Test de IA (Mock)** ⭐
- Botón "Iniciar simulación"
- Llamar a `/api/voice/simulate` (mock)
- Mostrar transcripción + reproductor de audio

**F-005: Pantalla 7 - Desvío de Llamadas** 🔥
- Selector de operador (Telefónica, Vodafone, Orange, Movistar)
- Mostrar instrucciones específicas por operador
- Botón "Copiar código" (ej. `*21*+34612345678#`)
- Botón "Enviar guía por WhatsApp"
- Estado: "Verificando..." → "¡Activo!" (cuando llega primera llamada)

**F-006: Pantalla 8 - Checklist Final**
- Resumen con checks:
  - ✅ Negocio creado
  - ✅ Servicios configurados
  - ✅ Horarios definidos
  - ✅ Google Calendar conectado
  - ✅ IA personalizada
  - ✅ Desvío activado
- Botón "Ir a mi panel"
- Marca `businesses.onboarding_completed = true`

---

### SPRINT 3-4: IA de Voz MVP (Semanas 5-8)

**Objetivo:** Usuario recibe llamadas, la IA las gestiona y crea/cancela citas automáticamente.

#### Tickets Backend

**B-005: Tabla `ai_agents`**
```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  provider TEXT DEFAULT 'openai', -- 'openai', 'vapi'
  provider_agent_id TEXT, -- ID del Assistant en OpenAI
  config JSONB NOT NULL, -- { voice, greeting_script, tools, etc }
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**B-006: Edge Function `/api/agents/create`** ⭐
- Trigger: Cuando `businesses.onboarding_completed = true`
- Acción:
  1. Consultar datos del negocio (servicios, horarios, etc)
  2. Crear OpenAI Assistant con:
     - Instrucciones (system prompt personalizado)
     - Tools: `check_availability`, `create_booking`, `cancel_booking`
     - Modelo: `gpt-4-turbo`
  3. INSERT en `ai_agents` con `provider_agent_id`

**B-007: Edge Function `/api/voice/incoming`** 🔥
- Endpoint: `POST /api/voice/incoming`
- Trigger: Cuando VAPI recibe llamada
- Body: `{ phone_number, business_number }`
- Acción:
  1. Identificar `business_id` por número IA
  2. Consultar `ai_agents` para obtener `provider_agent_id`
  3. Iniciar conversación con OpenAI Assistant
  4. INSERT en `call_logs`
  5. Retornar config de voz para VAPI

**B-008: Tabla `call_logs`**
```sql
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  direction TEXT DEFAULT 'inbound', -- 'inbound', 'outbound'
  duration_seconds INTEGER,
  status TEXT, -- 'answered', 'missed', 'voicemail'
  outcome TEXT, -- 'appointment_created', 'appointment_cancelled', 'info_query', 'escalated'
  transcript TEXT,
  recording_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_logs_business ON call_logs(business_id, created_at DESC);
CREATE INDEX idx_call_logs_phone ON call_logs(phone_number);
```

**B-009: RPC Tool `check_availability`**
```sql
CREATE OR REPLACE FUNCTION check_availability(
  p_business_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_duration_minutes INT DEFAULT 60
)
RETURNS JSONB AS $$
DECLARE
  available_slots JSONB;
BEGIN
  -- Lógica:
  -- 1. Consultar business_operating_hours para ese día
  -- 2. Consultar appointments existentes
  -- 3. Consultar calendar_exceptions
  -- 4. Calcular slots libres
  -- 5. Retornar array de { start_time, end_time }
  
  -- (Implementación completa en ticket)
  RETURN available_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**B-010: RPC Tool `create_booking`**
```sql
CREATE OR REPLACE FUNCTION create_booking(
  p_business_id UUID,
  p_service_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_start_time TIMESTAMPTZ,
  p_source TEXT DEFAULT 'ia_phone'
)
RETURNS JSONB AS $$
DECLARE
  new_appointment_id UUID;
  customer_id UUID;
BEGIN
  -- 1. Upsert en customers
  INSERT INTO customers (business_id, name, phone)
  VALUES (p_business_id, p_customer_name, p_customer_phone)
  ON CONFLICT (business_id, phone) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO customer_id;
  
  -- 2. Insert en appointments
  INSERT INTO appointments (business_id, service_id, customer_id, start_time, status, source)
  VALUES (p_business_id, p_service_id, customer_id, p_start_time, 'confirmed', p_source)
  RETURNING id INTO new_appointment_id;
  
  -- 3. Trigger sync a Google Calendar (async)
  -- (Edge Function webhook)
  
  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', new_appointment_id,
    'customer_id', customer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Tickets Frontend

**F-007: Dashboard - Vista de Agenda Unificada** ⭐
- Componente: `<UnifiedCalendar />`
- Fuente: `appointments` + `google_calendar_events`
- UI:
  - Vista día/semana/mes
  - Color diferente para citas "IA" vs "Manual" vs "GCal"
  - Click → Ver detalles / Editar / Cancelar

**F-008: Dashboard - Timeline de Llamadas**
- Componente: `<CallTimeline />`
- Fuente: `call_logs`
- UI:
  - Lista cronológica de llamadas
  - Badge de outcome (✅ Reservó, ❌ Canceló, ℹ️ Info)
  - Click → Mostrar transcripción + player audio

**F-009: CRM Automático - Lista de Clientes**
- Componente: `<CustomerList />`
- Fuente: `customers` + historial de `appointments`
- UI:
  - Tabla: Nombre, Teléfono, Última visita, Total visitas
  - Click → Ver ficha completa

---

### SPRINT 5-6: Refinamiento + Lanzamiento Beta (Semanas 9-12)

**Objetivo:** App pulida, testeada con 10 usuarios reales y lista para soft launch.

#### Tickets Finales

**F-010: Botón "Pausar IA"**
- Toggle en dashboard
- Acción:
  - `ai_agents.status = 'paused'`
  - Desvía llamadas a buzón de voz
  - Notificación: "IA pausada. Tus llamadas van a buzón."

**F-011: Editar Servicios / Horarios**
- Modal de configuración post-onboarding
- Al guardar:
  1. UPDATE en `services` / `business_operating_hours`
  2. Trigger update del contexto del Agent IA
  3. Re-sync de herramientas

**F-012: Analytics Básicos**
- Cards de métricas:
  - "X llamadas gestionadas hoy"
  - "X nuevas reservas creadas"
  - "X cancelaciones"
  - "Tasa de éxito IA: XX%"

**B-011: Sistema de Logs y Monitoreo**
- Sentry (errores frontend/backend)
- PostHog (analytics de producto)
- Supabase Logs (queries lentos)

**B-012: Tests Automatizados**
- Vitest: Tests unitarios (funciones críticas)
- Playwright: Tests E2E (onboarding completo)

---

## 🎯 ENTREGABLES POR SPRINT

### Sprint 1-2 ✅
- [ ] Onboarding completo (8 pantallas funcionales)
- [ ] Google Calendar OAuth + Sync bidireccional
- [ ] Base de datos con tablas `integrations`, `google_calendar_events`
- [ ] Edge Functions: OAuth, Sync
- [ ] 5 usuarios beta testeando onboarding

### Sprint 3-4 ⏳
- [ ] IA de voz funcional (VAPI + OpenAI)
- [ ] Agent creation automático
- [ ] Tools: check_availability, create_booking, cancel_booking
- [ ] Tabla `ai_agents`, `call_logs`
- [ ] Dashboard con agenda unificada + timeline
- [ ] 10 usuarios beta recibiendo llamadas reales

### Sprint 5-6 🎯
- [ ] CRM automático funcional
- [ ] Pausar/Reanudar IA
- [ ] Edición de config post-onboarding
- [ ] Analytics básicos
- [ ] Tests automatizados (Vitest + Playwright)
- [ ] Soft launch: 100 usuarios

---

## 📊 MÉTRICAS DE ÉXITO

### Product-Market Fit

- **Activación:** ≥60% completan onboarding en ≤72h
- **Retención M2:** ≥80% siguen activos después de 60 días
- **Tasa de éxito IA:** ≥75% de llamadas terminan en acción correcta
- **Valor entregado:** ≥10 reservas/semana creadas por IA

### Operacionales

- **Tiempo de respuesta API:** <500ms (p95)
- **Uptime:** ≥99.5%
- **Errores frontend:** <1% de sesiones con error
- **Sync GCal:** <5 minutos de latencia

---

## 🚨 PRINCIPIOS SAGRADOS

### 1. Calidad ante Todo
- ✅ Tests antes de deploy
- ✅ Code review obligatorio
- ✅ Documentación actualizada
- ❌ NO shortcuts que generen deuda técnica

### 2. Datos Reales Siempre
- ✅ 0% mockups en producción
- ✅ Validación de datos de Supabase
- ✅ Logs detallados de errores

### 3. Experiencia de Usuario Impecable
- ✅ Onboarding <5 minutos
- ✅ Respuestas instantáneas (optimistic UI)
- ✅ Feedback claro en cada acción
- ✅ Modo offline graceful

### 4. Seguridad y Privacidad
- ✅ RLS activo en todas las tablas
- ✅ Cifrado de tokens sensibles (refresh_token)
- ✅ HTTPS everywhere
- ✅ Auditoría de accesos

---

## 📞 SIGUIENTE PASO INMEDIATO

**SPRINT 1 - SEMANA 1 - DÍA 1:**

1. ✅ Aplicar migraciones SQL corregidas en Supabase
2. ✅ Verificar que onboarding base funciona (pasos 1-2)
3. 🔄 **Ticket B-001:** Crear tabla `integrations`
4. 🔄 **Ticket F-001:** Implementar pantalla 3 (Horarios)

**Herramientas de Tracking:**
- Jira / Linear para tickets
- GitHub Projects para roadmap
- Notion para documentación viva

---

## 🎯 COMPROMISO

**Vamos a construir la mejor app de gestión para profesionales del mundo.**

No es una carrera, es una maratón. Cada línea de código cuenta. Cada detalle importa.

**Calidad. Siempre.**

---

**Última actualización:** 27 de octubre de 2025  
**Próxima revisión:** Fin de Sprint 1 (semana 4)



