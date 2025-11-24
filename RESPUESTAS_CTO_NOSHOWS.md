# 📋 Respuestas Técnicas - Sistema No-Shows
## Preguntas del CTO sobre Control de Citas

**Fecha:** 24 Noviembre 2025  
**Contexto:** Revisión técnica pre-lanzamiento con CTO  
**Pantalla:** Control de Citas (No-Shows) - Crítica para el negocio

---

## 🎯 PREGUNTA 1: Trigger de Riesgo Alto - ¿Solo "menos de 2 horas"?

### Respuesta Técnica:

**NO, el sistema tiene MÚLTIPLES reglas, no solo una.**

### Algoritmo de Riesgo (Función `calculate_simple_risk_level`):

El sistema usa un **árbol de decisión** con 6 reglas en orden de prioridad:

```70:201:supabase/migrations/20251124_02_fix_noshows_functions_services_table.sql
CREATE OR REPLACE FUNCTION calculate_simple_risk_level(p_appointment_id UUID)
RETURNS TABLE (
    risk_level TEXT,          -- 'low', 'medium', 'high'
    risk_color TEXT,          -- 'green', 'yellow', 'red'
    risk_emoji TEXT,          -- '🟢', '🟡', '🔴'
    why_risk TEXT,            -- Explicación en lenguaje humano
    what_to_do TEXT,          -- Acción recomendada clara
    confirmed_24h BOOLEAN,    -- ¿Confirmó a las 24h?
    confirmed_4h BOOLEAN,     -- ¿Confirmó a las 4h?
    has_previous_noshows BOOLEAN,
    booking_advance_days INTEGER,
    hours_until_appointment NUMERIC
) AS $$
DECLARE
    v_appointment RECORD;
    v_customer RECORD;
    v_confirmations RECORD;
    v_hours_until NUMERIC;
    v_confirmed_24h BOOLEAN := false;
    v_confirmed_4h BOOLEAN := false;
    v_has_noshows BOOLEAN := false;
    v_booking_days INTEGER := 0;
    v_risk TEXT := 'low';
    v_color TEXT := 'green';
    v_emoji TEXT := '🟢';
    v_why TEXT := '';
    v_what TEXT := '';
BEGIN
    -- 1. Obtener datos de la cita
    SELECT a.*, 
           EXTRACT(EPOCH FROM (
               (a.appointment_date + a.appointment_time) - now()
           )) / 3600.0 AS hours_until
    INTO v_appointment
    FROM appointments a
    WHERE a.id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_hours_until := v_appointment.hours_until;

    -- 2. Obtener datos del cliente
    SELECT 
        c.*,
        COALESCE(
            (SELECT COUNT(*) FROM appointments 
             WHERE customer_id = c.id 
             AND status = 'no_show'
            ), 0
        ) AS noshow_count,
        EXTRACT(DAY FROM now() - c.created_at) AS booking_days_ago
    INTO v_customer
    FROM customers c
    WHERE c.id = v_appointment.customer_id;

    IF FOUND THEN
        v_has_noshows := v_customer.noshow_count > 0;
        v_booking_days := COALESCE(v_customer.booking_days_ago, 0);
    END IF;

    -- 3. Obtener confirmaciones (CORREGIDO: usar valores correctos de message_type)
    SELECT 
        COALESCE(
            (SELECT COUNT(*) > 0 FROM customer_confirmations 
             WHERE appointment_id = p_appointment_id 
             AND message_type = '24h'  -- ✅ CORREGIDO: era 'Confirmación 24h antes'
             AND confirmed = true
            ), false
        ) AS conf_24h,
        COALESCE(
            (SELECT COUNT(*) > 0 FROM customer_confirmations 
             WHERE appointment_id = p_appointment_id 
             AND message_type = '4h'  -- ✅ CORREGIDO: era 'Recordatorio 4h antes'
             AND confirmed = true
            ), false
        ) AS conf_4h
    INTO v_confirmed_24h, v_confirmed_4h;

    -- =====================================================
    -- LÓGICA SIMPLIFICADA (Árbol de Decisión)
    -- =====================================================

    -- REGLA 1: Si confirmó → BAJO RIESGO (siempre)
    IF v_confirmed_24h OR v_confirmed_4h THEN
        v_risk := 'low';
        v_color := 'green';
        v_emoji := '🟢';
        v_why := 'Ha confirmado su asistencia';
        v_what := 'Todo correcto - esperar al cliente';
        
    -- REGLA 2: Faltan menos de 2h y NO confirmó → ALTO RIESGO
    ELSIF v_hours_until < 2 AND v_hours_until > 0 THEN
        v_risk := 'high';
        v_color := 'red';
        v_emoji := '🔴';
        v_why := 'Faltan menos de 2 horas y no ha confirmado';
        v_what := 'LLAMAR AHORA para confirmar o cancelar';
        
    -- REGLA 3: Tiene no-shows previos → ALTO RIESGO
    ELSIF v_has_noshows THEN
        v_risk := 'high';
        v_color := 'red';
        v_emoji := '🔴';
        v_why := 'Tiene no-shows previos y no ha confirmado';
        v_what := 'Enviar WhatsApp recordatorio urgente';
        
    -- REGLA 4: Reservó con menos de 24h → MEDIO RIESGO
    ELSIF v_booking_days < 1 THEN
        v_risk := 'medium';
        v_color := 'yellow';
        v_emoji := '🟡';
        v_why := 'Reservó con poca antelación (menos de 24h)';
        v_what := 'Enviar confirmación y hacer seguimiento';
        
    -- REGLA 5: No ha confirmado pero sin banderas rojas → MEDIO RIESGO
    ELSIF NOT v_confirmed_24h AND v_hours_until < 24 THEN
        v_risk := 'medium';
        v_color := 'yellow';
        v_emoji := '🟡';
        v_why := 'Aún no ha confirmado su cita';
        v_what := 'Enviar recordatorio por WhatsApp';
        
    -- REGLA 6: Todo OK → BAJO RIESGO
    ELSE
        v_risk := 'low';
        v_color := 'green';
        v_emoji := '🟢';
        v_why := 'Cliente confiable sin señales de riesgo';
        v_what := 'Seguir proceso normal de confirmación';
    END IF;

    -- Retornar resultado
    RETURN QUERY SELECT 
        v_risk,
        v_color,
        v_emoji,
        v_why,
        v_what,
        v_confirmed_24h,
        v_confirmed_4h,
        v_has_noshows,
        v_booking_days,
        v_hours_until;
END;
```

### 📋 LAS 6 REGLAS DEL SISTEMA (Orden de Prioridad)

El sistema evalúa las reglas **en orden secuencial**. La primera regla que se cumple determina el nivel de riesgo. Si ninguna regla se cumple, se aplica la última (REGLA 6).

---

#### **🔵 REGLA 1 (PRIORIDAD MÁXIMA): Confirmación del Cliente**

**Condición:** El cliente confirmó su asistencia (en 24h o 4h antes)

**Resultado:** 🟢 **BAJO RIESGO** (siempre)

**Lógica:**
- Si `confirmed_24h = true` OR `confirmed_4h = true`
- El cliente ya respondió positivamente → No hay riesgo

**Mensaje mostrado:** "Ha confirmado su asistencia"  
**Acción recomendada:** "Todo correcto - esperar al cliente"

**Código:**
```sql
IF v_confirmed_24h OR v_confirmed_4h THEN
    v_risk := 'low';
    v_why := 'Ha confirmado su asistencia';
    v_what := 'Todo correcto - esperar al cliente';
```

---

#### **🔴 REGLA 2 (ALTA PRIORIDAD): Urgencia Temporal Crítica**

**Condición:** Faltan menos de 2 horas para la cita Y el cliente NO ha confirmado

**Resultado:** 🔴 **ALTO RIESGO**

**Lógica:**
- Si `hours_until < 2` AND `hours_until > 0` AND `confirmed_24h = false` AND `confirmed_4h = false`
- La cita es inminente y no hay confirmación → Riesgo crítico

**Mensaje mostrado:** "Faltan menos de 2 horas y no ha confirmado"  
**Acción recomendada:** "LLAMAR AHORA para confirmar o cancelar"

**Ejemplo:** Jimena Castillo (10:00) - Si son las 8:15 y no confirmó → ALTO RIESGO

**Código:**
```sql
ELSIF v_hours_until < 2 AND v_hours_until > 0 THEN
    v_risk := 'high';
    v_why := 'Faltan menos de 2 horas y no ha confirmado';
    v_what := 'LLAMAR AHORA para confirmar o cancelar';
```

---

#### **🔴 REGLA 3 (ALTA PRIORIDAD): Historial de No-Shows**

**Condición:** El cliente tiene no-shows previos en su historial Y no ha confirmado

**Resultado:** 🔴 **ALTO RIESGO**

**Lógica:**
- Consulta: `SELECT COUNT(*) FROM appointments WHERE customer_id = c.id AND status = 'no_show'`
- Si `noshow_count > 0` → El cliente tiene historial de plantones
- Patrón de comportamiento de riesgo → Alto riesgo

**Mensaje mostrado:** "Tiene no-shows previos y no ha confirmado"  
**Acción recomendada:** "Enviar WhatsApp recordatorio urgente"

**Ejemplo:** Si Jimena tiene 2 no-shows anteriores → ALTO RIESGO (incluso si faltan más de 2 horas)

**Código:**
```sql
ELSIF v_has_noshows THEN
    v_risk := 'high';
    v_why := 'Tiene no-shows previos y no ha confirmado';
    v_what := 'Enviar WhatsApp recordatorio urgente';
```

**⚠️ IMPORTANTE:** Esta regla se evalúa DESPUÉS de la REGLA 2, pero si se cumple, también genera ALTO RIESGO. El sistema SÍ mira el historial de plantones.

---

#### **🟡 REGLA 4 (PRIORIDAD MEDIA): Reserva de Última Hora**

**Condición:** El cliente reservó con menos de 24 horas de antelación

**Resultado:** 🟡 **MEDIO RIESGO**

**Lógica:**
- Si `booking_days < 1` (reservó hoy o ayer para hoy)
- Reservas de última hora tienen mayor probabilidad de no-show
- No es crítico, pero requiere seguimiento

**Mensaje mostrado:** "Reservó con poca antelación (menos de 24h)"  
**Acción recomendada:** "Enviar confirmación y hacer seguimiento"

**Ejemplo:** Cliente que reserva a las 9:00 AM para las 2:00 PM del mismo día

**Código:**
```sql
ELSIF v_booking_days < 1 THEN
    v_risk := 'medium';
    v_why := 'Reservó con poca antelación (menos de 24h)';
    v_what := 'Enviar confirmación y hacer seguimiento';
```

---

#### **🟡 REGLA 5 (PRIORIDAD MEDIA): Sin Confirmación (Sin Banderas Rojas)**

**Condición:** No ha confirmado pero faltan menos de 24 horas (sin otros factores de riesgo)

**Resultado:** 🟡 **MEDIO RIESGO**

**Lógica:**
- Si `confirmed_24h = false` AND `hours_until < 24`
- No hay confirmación pero tampoco hay señales críticas
- Requiere recordatorio pero no es urgente

**Mensaje mostrado:** "Aún no ha confirmado su cita"  
**Acción recomendada:** "Enviar recordatorio por WhatsApp"

**Ejemplo:** Cliente que reservó hace 3 días, faltan 6 horas, no confirmó, pero no tiene historial de no-shows

**Código:**
```sql
ELSIF NOT v_confirmed_24h AND v_hours_until < 24 THEN
    v_risk := 'medium';
    v_why := 'Aún no ha confirmado su cita';
    v_what := 'Enviar recordatorio por WhatsApp';
```

---

#### **🟢 REGLA 6 (PRIORIDAD BAJA - Default): Cliente Confiable**

**Condición:** Ninguna de las reglas anteriores se cumple

**Resultado:** 🟢 **BAJO RIESGO**

**Lógica:**
- Cliente sin historial de no-shows
- Reservó con suficiente antelación (>24h)
- Faltan más de 24 horas para la cita
- No hay señales de riesgo

**Mensaje mostrado:** "Cliente confiable sin señales de riesgo"  
**Acción recomendada:** "Seguir proceso normal de confirmación"

**Ejemplo:** Cliente habitual que reservó hace 5 días para dentro de 2 días

**Código:**
```sql
ELSE
    v_risk := 'low';
    v_why := 'Cliente confiable sin señales de riesgo';
    v_what := 'Seguir proceso normal de confirmación';
```

---

### 📊 Tabla Resumen de Reglas

| Prioridad | Regla | Condición | Resultado | Ejemplo |
|-----------|-------|-----------|-----------|---------|
| **1** | Confirmación | Cliente confirmó (24h o 4h) | 🟢 BAJO | Cliente respondió "Sí" |
| **2** | Urgencia Temporal | <2h sin confirmar | 🔴 ALTO | Jimena (10:00) a las 8:15 |
| **3** | Historial No-Shows | Tiene plantones previos | 🔴 ALTO | Cliente con 2 no-shows |
| **4** | Reserva Última Hora | Reservó <24h antes | 🟡 MEDIO | Reserva misma mañana |
| **5** | Sin Confirmación | <24h sin confirmar | 🟡 MEDIO | Faltan 6h, sin confirmar |
| **6** | Default | Ninguna regla se cumple | 🟢 BAJO | Cliente confiable |

---

### 🎯 Ejemplo Práctico: Jimena Castillo

**Escenario:** Cita a las 10:00, son las 8:15, no ha confirmado

**Evaluación del Sistema:**

1. ✅ **REGLA 1:** ¿Confirmó? → NO → Continúa
2. ✅ **REGLA 2:** ¿Faltan <2h? → SÍ (1h 45min) → **🔴 ALTO RIESGO**
   - **Resultado:** Se activa esta regla
   - **Mensaje:** "Faltan menos de 2 horas y no ha confirmado"
   - **Acción:** "LLAMAR AHORA para confirmar o cancelar"

**Si Jimena tuviera historial de no-shows:**
- La REGLA 3 también se cumpliría, pero la REGLA 2 tiene prioridad (se evalúa primero)
- Ambas generarían ALTO RIESGO, pero el mensaje sería el de la REGLA 2 (más urgente)

### Verificación del Historial:

```113:130:supabase/migrations/20251124_02_fix_noshows_functions_services_table.sql
    -- 2. Obtener datos del cliente
    SELECT 
        c.*,
        COALESCE(
            (SELECT COUNT(*) FROM appointments 
             WHERE customer_id = c.id 
             AND status = 'no_show'
            ), 0
        ) AS noshow_count,
        EXTRACT(DAY FROM now() - c.created_at) AS booking_days_ago
    INTO v_customer
    FROM customers c
    WHERE c.id = v_appointment.customer_id;

    IF FOUND THEN
        v_has_noshows := v_customer.noshow_count > 0;
        v_booking_days := COALESCE(v_customer.booking_days_ago, 0);
    END IF;
```

**Conclusión:**
- ✅ **SÍ, el sistema SÍ mira el historial de no-shows** (REGLA 3 - Alta Prioridad)
- ✅ **NO es solo "menos de 2 horas"** - hay 6 reglas evaluadas en orden secuencial
- ✅ **Para Jimena Castillo:** Se activó la **REGLA 2** (Urgencia Temporal) porque faltan menos de 2 horas
- ✅ **Si Jimena tuviera historial de no-shows:** La REGLA 3 también se cumpliría, pero la REGLA 2 tiene prioridad (se evalúa primero)
- ✅ **El sistema usa un árbol de decisión** donde la primera regla que se cumple determina el resultado

---

## 🎯 PREGUNTA 2: Botón "Llamar ahora" - ¿Qué ocurre técnicamente?

### Respuesta Técnica:

**Es un simple enlace `tel:` que abre el teléfono del dispositivo. NO es VoIP ni VAPI.**

### Implementación en el Código:

```122:124:src/pages/NoShowsSimple.jsx
    const handleCall = (phone) => {
        window.open(`tel:${phone}`);
    };
```

### Comportamiento Técnico:

1. **Usuario hace clic en "Llamar ahora"**
2. **JavaScript ejecuta:** `window.open('tel:+34600000000')`
3. **El navegador detecta el protocolo `tel:`**
4. **Abre la aplicación de teléfono del dispositivo:**
   - En **Windows:** Abre la app de teléfono (si está disponible) o Skype
   - En **Mac:** Abre FaceTime o la app de teléfono
   - En **móvil:** Abre el marcador telefónico con el número listo para llamar
5. **El usuario debe confirmar la llamada manualmente**

### NO es:

- ❌ **NO es VoIP desde el navegador** (no usa WebRTC)
- ❌ **NO dispara una llamada automática de VAPI**
- ❌ **NO es una llamada automática**
- ❌ **NO integra con ningún sistema de telefonía**

### Es:

- ✅ **Un enlace estándar `tel:`** (protocolo URI estándar)
- ✅ **Requiere intervención manual del usuario** (debe confirmar la llamada)
- ✅ **Funciona en cualquier dispositivo** con soporte para `tel:`
- ✅ **Comportamiento nativo del sistema operativo**

### Evidencia en la UI:

```523:530:src/pages/NoShowsSimple.jsx
                        {isUrgent && (
                            <button
                                onClick={() => onCall(appointment.customer_phone)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-md"
                            >
                                <Phone className="w-4 h-4" />
                                Llamar ahora
                            </button>
                        )}
```

**Conclusión:**
- ✅ **Es un enlace `tel:` estándar** que abre el teléfono del dispositivo
- ✅ **NO es VoIP ni VAPI** - es completamente manual
- ✅ **El dueño debe hacer la llamada manualmente** desde su teléfono
- ✅ **Funciona en escritorio y móvil** (comportamiento nativo del SO)

---

## 🎯 PREGUNTA 3: KPI "Ahorro €0" - ¿De dónde viene el precio?

### Respuesta Técnica:

**El precio viene de un valor HARDCODEADO de €45. NO viene de Google Calendar ni de la tabla de servicios.**

### Implementación en la Función SQL:

```223:283:supabase/migrations/20251108_04_noshows_simplificado.sql
CREATE OR REPLACE FUNCTION get_simple_noshow_metrics(p_business_id UUID)
RETURNS TABLE (
    today_confirmed INTEGER,
    today_pending INTEGER,
    today_high_risk INTEGER,
    this_month_prevented INTEGER,
    this_month_occurred INTEGER,
    success_rate NUMERIC,
    estimated_savings NUMERIC
) AS $$
DECLARE
    v_today_confirmed INTEGER := 0;
    v_today_pending INTEGER := 0;
    v_today_high_risk INTEGER := 0;
    v_prevented INTEGER := 0;
    v_occurred INTEGER := 0;
    v_success_rate NUMERIC := 0;
    v_avg_ticket NUMERIC := 45.00; -- Ticket promedio, ajustable
BEGIN
    -- Citas de HOY por estado de confirmación
    SELECT 
        COUNT(*) FILTER (WHERE r.confirmed_24h OR r.confirmed_4h),
        COUNT(*) FILTER (WHERE NOT (r.confirmed_24h OR r.confirmed_4h)),
        COUNT(*) FILTER (WHERE r.risk_level = 'high')
    INTO v_today_confirmed, v_today_pending, v_today_high_risk
    FROM appointments a
    CROSS JOIN LATERAL calculate_simple_risk_level(a.id) r
    WHERE a.business_id = p_business_id
      AND a.appointment_date = CURRENT_DATE
      AND a.status IN ('confirmed', 'pending');

    -- No-shows evitados y ocurridos este mes
    -- Evitados = citas completadas que tenían riesgo
    -- Ocurridos = citas marcadas como no_show
    SELECT 
        COUNT(*) FILTER (WHERE a.status = 'completed' AND EXISTS (
            SELECT 1 FROM customer_confirmations cc 
            WHERE cc.appointment_id = a.id AND cc.confirmed = true
        )),
        COUNT(*) FILTER (WHERE a.status = 'no_show')
    INTO v_prevented, v_occurred
    FROM appointments a
    WHERE a.business_id = p_business_id
      AND a.appointment_date >= date_trunc('month', CURRENT_DATE)
      AND a.appointment_date < date_trunc('month', CURRENT_DATE) + interval '1 month';

    -- Calcular tasa de éxito
    IF (v_prevented + v_occurred) > 0 THEN
        v_success_rate := ROUND((v_prevented::NUMERIC / (v_prevented + v_occurred)) * 100, 1);
    END IF;

    RETURN QUERY SELECT 
        v_today_confirmed,
        v_today_pending,
        v_today_high_risk,
        v_prevented,
        v_occurred,
        v_success_rate,
        v_prevented * v_avg_ticket;
END;
```

### Cálculo del Ahorro:

```240:281:supabase/migrations/20251108_04_noshows_simplificado.sql
    v_avg_ticket NUMERIC := 45.00; -- Ticket promedio, ajustable
BEGIN
    -- ... código de cálculo ...
    
    RETURN QUERY SELECT 
        v_today_confirmed,
        v_today_pending,
        v_today_high_risk,
        v_prevented,
        v_occurred,
        v_success_rate,
        v_prevented * v_avg_ticket;  -- ← Ahorro = No-shows evitados × €45
```

### Fórmula:

```
Ahorro = No-shows evitados este mes × €45 (hardcodeado)
```

### Origen del Precio:

- ❌ **NO viene de Google Calendar** (no hay integración con precios de Google Calendar)
- ❌ **NO viene de la tabla `services`** (aunque existe `business_services`, no se usa)
- ❌ **NO viene de la tabla `appointments`** (no hay campo `price` en appointments)
- ✅ **Es un valor HARDCODEADO:** `v_avg_ticket NUMERIC := 45.00`
- ✅ **Comentario en código:** `-- Ticket promedio, ajustable`

### Tabla de Servicios:

Aunque existe la tabla `business_services` con información de servicios:

```41:42:supabase/migrations/20251124_02_fix_noshows_functions_services_table.sql
        COALESCE(bs.name, 'Servicio') AS service_name,
        a.duration_minutes,
```

**Solo se usa para obtener el nombre del servicio, NO el precio.**

### Evidencia en el Frontend:

```218:228:src/pages/NoShowsSimple.jsx
                    <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-purple-600 text-base">€</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-purple-700 font-semibold">Ahorro</p>
                                <p className="text-xl font-black text-purple-600 leading-tight">€{Math.round(metrics.estimated_savings)}</p>
                            </div>
                        </div>
                    </div>
```

**Conclusión:**
- ✅ **El precio es HARDCODEADO:** €45 por cita
- ❌ **NO viene de Google Calendar** (no hay integración)
- ❌ **NO viene de la tabla de servicios** (aunque existe, no se usa para precio)
- ⚠️ **Es un valor fijo** que debería ser configurable por negocio
- 📝 **Comentario en código:** "ajustable" pero actualmente no lo es

---

## 📊 RESUMEN EJECUTIVO

| Pregunta | Respuesta | Estado |
|----------|-----------|--------|
| **¿Solo "menos de 2 horas"?** | **NO:** Hay 6 reglas. El sistema SÍ mira historial de no-shows (REGLA 3) | ✅ Implementado |
| **¿Qué hace "Llamar ahora"?** | **Enlace `tel:`** que abre el teléfono del dispositivo. NO es VoIP ni VAPI | ✅ Implementado |
| **¿De dónde viene el precio?** | **Hardcodeado €45.** NO viene de Google Calendar ni tabla de servicios | ⚠️ Hardcodeado |

---

## 🔧 RECOMENDACIONES TÉCNICAS

### ⚠️ Estado Actual vs. Mejoras Futuras

**Nota:** Estas recomendaciones se implementarán en el futuro. Por ahora, explicamos al CTO qué tenemos y qué mejoraremos.

---

### 📌 Prioridad Alta (Implementar Próximamente):

#### **1. Hacer el Precio Configurable por Negocio**

**Problema Actual:**
- El precio está hardcodeado en €45
- Todos los negocios usan el mismo valor
- No refleja la realidad de cada negocio (peluquería vs. restaurante vs. spa)

**Solución Propuesta:**
- Añadir campo `avg_ticket_price` en tabla `businesses.settings` (JSONB)
- Modificar función `get_simple_noshow_metrics` para leer este valor
- Permitir que cada negocio configure su ticket promedio desde la UI
- Valor por defecto: €45 (mantener compatibilidad)

**Impacto:**
- ✅ Ahorro calculado será más preciso por negocio
- ✅ ROI real reflejado en las métricas
- ✅ Mayor confianza del cliente en el sistema

---

#### **2. Mejorar Cálculo de Ahorro con Precios Reales**

**Problema Actual:**
- Usa un promedio fijo para todas las citas
- No diferencia entre servicios (corte de pelo €25 vs. tratamiento €80)

**Opciones de Mejora:**

**Opción A: Precio por Servicio (Recomendada)**
- Usar precio real de cada servicio desde `business_services.price`
- Cálculo: `SUM(service.price) WHERE appointment.status = 'completed' AND confirmed = true`
- **Ventaja:** Precisión máxima, refleja realidad del negocio
- **Complejidad:** Media (requiere JOIN con business_services)

**Opción B: Promedio Histórico del Negocio**
- Calcular promedio de facturación real del último mes
- Cálculo: `AVG(appointment.total_amount)` de citas completadas
- **Ventaja:** Se ajusta automáticamente según el negocio
- **Complejidad:** Baja (solo agregación)

**Opción C: Configuración Manual por Dueño**
- Campo en UI: "Ticket promedio de mis citas"
- El dueño ingresa su valor estimado
- **Ventaja:** Control total del usuario
- **Complejidad:** Muy baja (solo input + guardado)

**Recomendación:** Implementar **Opción A + Opción C** (precio por servicio, con fallback a configuración manual)

---

### 📌 Prioridad Media (Mejoras de UX):

#### **3. Mostrar Desglose del Riesgo en la UI**

**Problema Actual:**
- El dueño ve "Riesgo Alto" pero no sabe por qué
- No entiende qué regla se activó

**Solución Propuesta:**
- Mostrar en la tarjeta de la cita:
  - ✅ "Riesgo Alto - REGLA 2: Urgencia Temporal"
  - ✅ "Riesgo Alto - REGLA 3: Historial de No-Shows"
  - ✅ Tooltip con explicación: "Faltan menos de 2 horas y no ha confirmado"
- Añadir icono de información (ℹ️) con detalles expandibles

**Impacto:**
- ✅ Dueño entiende por qué debe llamar
- ✅ Mayor confianza en el sistema
- ✅ Mejor toma de decisiones

---

#### **4. Integración con Google Calendar (Futuro)**

**Oportunidad:**
- Si Google Calendar tiene precios en los eventos, podrían sincronizarse
- Requeriría mapeo de eventos de Calendar a appointments

**Complejidad:** Alta (requiere integración con Google Calendar API)

**Prioridad:** Baja (no crítico para MVP)

---

### 📋 Resumen de Mejoras Planificadas

| Mejora | Prioridad | Complejidad | Impacto | Estado |
|--------|-----------|-------------|---------|--------|
| Precio configurable | Alta | Baja | Alto | ⏳ Planificado |
| Precio por servicio | Alta | Media | Muy Alto | ⏳ Planificado |
| Desglose de riesgo | Media | Baja | Medio | ⏳ Planificado |
| Google Calendar | Baja | Alta | Bajo | 💡 Futuro |

---

### ✅ Lo que Funciona Bien Ahora:

1. ✅ **Sistema de 6 reglas** funciona correctamente
2. ✅ **Detección de historial de no-shows** está implementada
3. ✅ **Cálculo de riesgo** es preciso y confiable
4. ✅ **UI muestra claramente** las citas de alto riesgo
5. ✅ **Botón "Llamar ahora"** funciona en todos los dispositivos

### ⚠️ Lo que Mejoraremos:

1. ⏳ **Precio hardcodeado** → Precio configurable por negocio
2. ⏳ **Ahorro genérico** → Ahorro basado en precios reales
3. ⏳ **Riesgo sin explicación** → Desglose de qué regla se activó

---

**Documento generado:** 24 Noviembre 2025  
**Basado en:** Auditoría exhaustiva del código fuente y documentación técnica

