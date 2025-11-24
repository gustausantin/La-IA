# 📅 GOOGLE CALENDAR: Integración Completa

**Fecha:** 17 Noviembre 2025  
**Estado:** CONFIRMADO - Listo para implementación

---

## 📋 RESUMEN EJECUTIVO

**Estrategia:** Sincronización unidireccional (LA-IA → Google Calendar) + Importación inicial de eventos de todo el día.

**Regla fundamental:** Solo se importan eventos de TODO EL DÍA (excepciones de calendario). Las reservas se crean directamente en LA-IA.

---

## 🎯 ESTRATEGIA DE SINCRONIZACIÓN

### **Unidireccional (LA-IA → Google Calendar)**

**Ventajas:**
- ✅ Control absoluto (LA-IA es fuente única de verdad)
- ✅ Sin conflictos ni duplicados
- ✅ Simple y robusto
- ✅ Profesional (como Calendly, Resy, OpenTable)

**Implementación:**
- Cada reserva creada/modificada/cancelada en LA-IA → Se sincroniza automáticamente a Google Calendar
- Trigger en base de datos que llama a Edge Function `sync-google-calendar`

---

## 📥 IMPORTACIÓN INICIAL

### **Regla Crítica:**

**SOLO eventos de TODO EL DÍA se importan:**
- ✅ Días cerrados ("Cerrado", "Closed")
- ✅ Vacaciones ("Vacaciones", "Vacation", "Holiday")
- ✅ Festivos ("Navidad", "Año Nuevo")
- ✅ Eventos especiales (todo el día)

**NO se importan:**
- ❌ Reservas (eventos con hora específica)
- ❌ Citas (eventos con hora específica)
- ❌ Cualquier evento con hora

**Razón:** Matching automático de empleados/servicios es imposible y arriesgado.

### **Flujo de Importación:**

1. Usuario conecta Google Calendar
2. Sistema pregunta: "¿Importar eventos existentes?"
3. Si dice SÍ → Se cargan eventos de Google Calendar
4. Sistema filtra: Solo eventos de TODO EL DÍA
5. Se muestra modal con dos secciones:
   - ✅ **Eventos Seguros** (días cerrados obvios) - Seleccionados por defecto
   - ⚠️ **Eventos con Dudas** (otros eventos de todo el día) - Usuario selecciona
6. Usuario revisa y confirma
7. Se importan solo los seleccionados
8. Se guardan en `calendar_exceptions`

---

## 🗄️ ESQUEMA DE BASE DE DATOS

### **Tabla: `calendar_exceptions`**

**⚠️ IMPORTANTE: Verificar esquema real antes de implementar**

Según el código, se usa `business_id`:
```typescript
.from('calendar_exceptions')
.eq('business_id', businessId)
```

**Columnas REALES (según código):**
- `id` - UUID PRIMARY KEY
- `business_id` - UUID NOT NULL (FK a businesses) ✅
- `exception_date` - DATE NOT NULL ✅
- `is_open` - BOOLEAN (true = abierto, false = cerrado) ✅
- `open_time` - TIME (horario de apertura, null si cerrado) ✅
- `close_time` - TIME (horario de cierre, null si cerrado) ✅
- `reason` - TEXT (motivo/descripción) ✅
- `created_at` - TIMESTAMPTZ ✅

**⚠️ NOTA:** El código NO usa `exception_type`. Usa `is_open` para determinar si está cerrado.

**Lógica:**
- `is_open = false` → Día cerrado (equivalente a `exception_type: 'closed'`)
- `is_open = true` → Día abierto con horarios especiales (equivalente a `exception_type: 'special_event'`)

**Constraint:** `UNIQUE(business_id, exception_date)`

### **Tabla: `integrations`**

```sql
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'google_calendar'
    is_active BOOLEAN DEFAULT true,
    status TEXT, -- 'active', 'expired', 'revoked'
    
    -- OAuth2 Tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Config
    config JSONB DEFAULT '{}',
    credentials JSONB,
    scopes TEXT[],
    metadata JSONB,
    
    -- Timestamps
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(business_id, provider)
);
```

---

## 💻 IMPLEMENTACIÓN

### **1. Edge Function: `import-google-calendar-initial`**

**Propósito:** Importar eventos de todo el día desde Google Calendar.

**Acciones:**
- `classify` - Clasificar eventos (seguros vs dudosos)
- `import` - Importar eventos seleccionados

### **2. Modificar: `google-calendar-oauth`**

**Después de guardar integración:**
- Detectar si es primera conexión
- Ofrecer importación inicial (opcional)

### **3. Componente UI: `GoogleCalendarImportModal`**

**Funcionalidad:**
- Mostrar eventos seguros (seleccionados por defecto)
- Mostrar eventos dudosos (usuario selecciona)
- Permitir cambiar tipo de evento
- Confirmar importación

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear Edge Function `import-google-calendar-initial`
- [ ] Modificar `google-calendar-oauth` para ofrecer importación
- [ ] Crear componente `GoogleCalendarImportModal`
- [ ] Implementar clasificación de eventos
- [ ] Implementar guardado en `calendar_exceptions`
- [ ] Implementar sincronización unidireccional (triggers)
- [ ] Testing completo

---

## 📝 NOTAS IMPORTANTES

1. **Usar `business_id`** (NO `restaurant_id`) en todas las queries
2. **Validar esquema** antes de insertar en `calendar_exceptions`
3. **Manejar duplicados** con `ON CONFLICT DO UPDATE`
4. **Mensajes claros** al usuario sobre qué se importa y qué no
5. **Error handling robusto** en todas las operaciones

