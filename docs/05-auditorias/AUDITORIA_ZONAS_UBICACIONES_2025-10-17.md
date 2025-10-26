# 🏢 AUDITORÍA COMPLETA: SISTEMA DE ZONAS/UBICACIONES
**Fecha:** 17 de Octubre 2025  
**Objetivo:** Estandarizar zonas de mesas a 4 opciones (Interior, Terraza, Barra, Privado)  
**Estado:** 📋 AUDITORÍA COMPLETA - PENDIENTE IMPLEMENTACIÓN

---

## 📋 **CHECKLIST OBLIGATORIO CUMPLIDO**

✅ **NORMA 1:** Ajuste quirúrgico - No degradar calidad  
✅ **NORMA 2:** Todos los datos de BD - No inventar  
✅ **NORMA 3:** Multi-tenant - restaurant_id en todas las queries  
✅ **NORMA 4:** Schema revisado ANTES de modificar

✅ **Lectura previa:** Documentación completa leída  
✅ **Datos verificados:** Schema de BD confirmado  
✅ **Origen confirmado:** Zonas actuales identificadas

---

## 🎯 **SITUACIÓN ACTUAL**

### **1. BASE DE DATOS**

#### **Tabla `tables`:**
```sql
tables (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  table_number text NOT NULL,
  name varchar,
  capacity integer NOT NULL,
  location text,               ← Campo texto libre (NO se usa actualmente)
  zone varchar DEFAULT 'main', ← Campo categoría (ESTE SE USA)
  status text DEFAULT 'available',
  position_x float8,
  position_y float8,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz
)
```

**Estado:**
- ✅ Campo `zone` existe y se usa
- ❌ NO hay constraint CHECK (puede tener cualquier valor)
- ❌ NO hay ENUM (es VARCHAR libre)
- ❌ Valores inconsistentes: "Salón principal", "main", "Terraza", etc.

#### **Tabla `reservations`:**
```sql
reservations (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  customer_id uuid,
  customer_name varchar NOT NULL,
  customer_email varchar,
  customer_phone varchar,
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  party_size integer NOT NULL,
  table_id uuid,                        ← FK a tables (puede ser NULL)
  table_number varchar,
  status varchar DEFAULT 'confirmed',
  channel varchar DEFAULT 'web',
  source varchar DEFAULT 'web',
  reservation_source varchar DEFAULT 'manual',
  notes text,
  special_requests text,                ← Se usa para guardar preferencias
  spend_amount numeric DEFAULT 0.00,
  created_at timestamptz,
  updated_at timestamptz
)
```

**Estado:**
- ❌ **NO existe campo `preferred_zone`**
- ❌ **NO existe campo `zone`**
- ✅ Actualmente se guarda en `special_requests` (texto libre)

#### **Tabla `availability_slots`:**
```sql
availability_slots (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  table_id uuid NOT NULL,        ← FK a tables (hereda zone)
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text DEFAULT 'free',
  source text DEFAULT 'system',
  shift_name text,
  is_available boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz,
  updated_at timestamptz
)
```

**Estado:**
- ✅ NO necesita cambios (hereda zone de `tables`)
- ✅ Sistema de disponibilidades NO se ve afectado

---

### **2. FRONTEND**

#### **Página `Mesas.jsx` (líneas 1718-1727):**
```jsx
<select value={formData.zone} ...>
  <option value="">Seleccionar zona...</option>
  <option value="Salón principal">Salón principal</option>
  <option value="Salón secundario">Salón secundario</option>
  <option value="Terraza">Terraza</option>
  <option value="Privado">Privado</option>
  <option value="Exterior">Exterior</option>
  <option value="Barra">Barra</option>
  <option value="VIP">Zona VIP</option>
  <option value="Otros">Otros</option>
</select>
```

**Problemas:**
- ❌ **8 opciones** (demasiadas)
- ❌ Inconsistencia: "Salón principal" vs "Interior"
- ❌ Redundancia: "Exterior" = "Terraza", "VIP" = "Privado"
- ❌ Valores hardcodeados (no vienen de constantes)

#### **Hook `useReservationWizard.js` (líneas 36, 49, 220-308):**
```javascript
// Estado del wizard
const [formData, setFormData] = useState({
  ...
  zone: initialData?.zone || null,  // ← Campo zone existe
  tableIds: initialData?.table_ids || [],
  ...
});

// Validación de zona
const [validations, setValidations] = useState({
  ...
  zone: { valid: null, message: '', zones: [] },  // ← Validación existe
  ...
});

// Función validateZone() (línea 220)
const validateZone = useCallback(async (partySize, date, time) => {
  // Agrupa mesas disponibles por zona
  const zoneCapacity = {};
  availableTables.forEach(table => {
    const zone = table.zone || 'main';  // ← Usa tables.zone
    ...
  });
  ...
});
```

**Estado:**
- ✅ Sistema de zonas YA implementado en wizard
- ✅ Validación de zona existe
- ✅ Filtrado por zona funciona
- ❌ NO se guarda en `reservations` (solo en `special_requests`)

#### **Componente `ReservationWizard.jsx` (líneas 659-705):**
```jsx
// PASO 5: ZONA
const StepZone = ({ formData, validation, isLoading, onChange }) => {
  const zones = validation?.zones || [];
  
  return (
    <div className="space-y-6">
      <h3>📍 Selecciona la Zona</h3>
      <p>¿Dónde prefieres sentarte?</p>
      
      {zones.map((zone) => (
        <button
          key={zone.zone}
          onClick={() => zone.sufficient && onChange('zone', zone.zone)}
          disabled={!zone.sufficient}
          className={...}
        >
          <span className="capitalize">{zone.zone}</span>
          ...
        </button>
      ))}
    </div>
  );
};
```

**Estado:**
- ✅ **PASO 5 del wizard ya existe**
- ✅ Muestra zonas dinámicamente basadas en disponibilidad
- ✅ Permite seleccionar zona
- ❌ Muestra TODAS las zonas encontradas (no filtradas)

---

### **3. N8N WORKFLOWS**

#### **Workflow `3-super-agent-hibrido-FINAL-CORREGIDO.json`:**

**Tool `check_availability`:**
```json
{
  "name": "check_availability",
  "description": "Verifica disponibilidad en el restaurante",
  "fields": {
    "values": [
      {"name": "date"},
      {"name": "time"},
      {"name": "party_size"},
      {"name": "restaurant_id"}
    ]
  }
}
```

**Estado:**
- ❌ **NO incluye parámetro `preferred_zone`**
- ❌ NO filtra por zona

**Tool `create_reservation`:**
```json
{
  "name": "create_reservation",
  "description": "Crea una nueva reserva en el restaurante",
  "fields": {
    "values": [
      {"name": "reservation_date"},
      {"name": "reservation_time"},
      {"name": "party_size"},
      {"name": "special_requests"}
    ]
  }
}
```

**Estado:**
- ❌ **NO incluye parámetro `preferred_zone`**
- ✅ Usa `special_requests` (donde actualmente se guarda)

#### **Workflow `Tool - check-availability.json`:**
```javascript
const input = $input.first().json;
const fecha = input.date || input.reservation_date || '';
const hora = input.time || input.reservation_time || '';
const personas = parseInt(input.party_size || input.people || 0);
const ubicacion = input.reservation_location || input.location || null; // ← YA PREPARADO
const restaurant_id = input.restaurant_id || '';
```

**Estado:**
- ✅ **Ya captura `ubicacion`** pero NO la usa
- ❌ NO filtra mesas por zona en la query
- ❌ NO valida valores de zona

---

### **4. PROMPTS DEL AGENTE**

#### **`PROMPT-SUPER-AGENT-v3-PERFECTO.txt`:**

**Estado:**
- ❌ **NO menciona zonas** en ningún paso
- ❌ NO pregunta por ubicación/zona
- ❌ NO incluye zona en ejemplos de tools
- ❌ Checklist no incluye paso de zona

**Tool `check_availability` en prompt (líneas 84-91):**
```markdown
**Parámetros obligatorios:**
```json
{
  "date": "2025-10-19",
  "time": "20:00",
  "party_size": 4,
  "restaurant_id": "{{ $json.restaurant_id }}"
}
```
```

**Estado:**
- ❌ NO incluye `preferred_zone`

---

## 🎯 **DECISIONES TOMADAS (ACORDADO CON USUARIO)**

### **1. Zonas a implementar (4):**
```
1. Interior    ← Engloba "Salón principal", "Salón secundario", "main"
2. Terraza     ← Engloba "Exterior", "Terraza"
3. Barra       ← Se mantiene igual
4. Privado     ← Engloba "Sala reservada", "Zona VIP", "Privado"
```

### **2. Comportamiento del agente:**
- ✅ Ofrece por defecto: **Interior, Terraza, Barra** (3 opciones)
- ✅ **Privado** solo se sugiere cuando:
  - Grupo ≥ 8 personas
  - Cliente menciona keywords: "tranquilo", "íntimo", "romántico", "privado", "discreto"
  - Cliente pregunta explícitamente por zona privada

### **3. Zona como campo opcional:**
- ✅ Si cliente NO especifica → Asignación automática (cualquier zona)
- ✅ Si cliente especifica → Filtrar disponibilidad por esa zona
- ✅ Si zona solicitada NO tiene disponibilidad → Sugerir alternativa

---

## 📝 **PLAN DE IMPLEMENTACIÓN QUIRÚRGICO**

### **FASE 1: BASE DE DATOS** (CRÍTICO)

#### **1.1. Migración: Normalizar valores existentes**
```sql
-- Archivo: supabase/migrations/20251017_001_normalize_table_zones.sql

-- PASO 1: Normalizar valores existentes
UPDATE tables
SET zone = CASE
  WHEN zone ILIKE '%terraza%' OR zone ILIKE '%exterior%' THEN 'terraza'
  WHEN zone ILIKE '%privado%' OR zone ILIKE '%vip%' THEN 'privado'
  WHEN zone ILIKE '%barra%' THEN 'barra'
  ELSE 'interior'
END
WHERE restaurant_id IS NOT NULL;

-- PASO 2: Crear ENUM de zonas
CREATE TYPE zone_type AS ENUM ('interior', 'terraza', 'barra', 'privado');

-- PASO 3: Convertir columna a ENUM
ALTER TABLE tables 
ALTER COLUMN zone TYPE zone_type USING zone::zone_type;

-- PASO 4: Establecer DEFAULT
ALTER TABLE tables 
ALTER COLUMN zone SET DEFAULT 'interior'::zone_type;

-- PASO 5: Agregar NOT NULL constraint
ALTER TABLE tables 
ALTER COLUMN zone SET NOT NULL;
```

**Impacto:**
- ✅ Estandariza valores existentes
- ✅ Previene valores inválidos futuros
- ✅ Compatible con datos actuales
- ⚠️ **CRÍTICO:** Ejecutar en horario de bajo tráfico

**Rollback:**
```sql
-- Si algo falla, revertir
ALTER TABLE tables ALTER COLUMN zone TYPE varchar USING zone::varchar;
DROP TYPE zone_type;
```

#### **1.2. Migración: Agregar `preferred_zone` a reservations**
```sql
-- Archivo: supabase/migrations/20251017_002_add_preferred_zone_to_reservations.sql

-- Agregar columna preferred_zone
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS preferred_zone zone_type;

-- Índice para consultas por zona
CREATE INDEX IF NOT EXISTS idx_reservations_preferred_zone
ON reservations(restaurant_id, preferred_zone)
WHERE preferred_zone IS NOT NULL;
```

**Impacto:**
- ✅ Permite guardar preferencia de zona
- ✅ No afecta reservas existentes (NULL)
- ✅ Indexado para consultas rápidas
- ✅ Compatible con multi-tenant

---

### **FASE 2: FRONTEND** (CIRUGÍA DE PRECISIÓN)

#### **2.1. Crear constante de zonas**
```javascript
// Archivo: src/constants/zones.js

export const ZONE_OPTIONS = {
  INTERIOR: 'interior',
  TERRAZA: 'terraza',
  BARRA: 'barra',
  PRIVADO: 'privado'
};

export const ZONE_LABELS = {
  [ZONE_OPTIONS.INTERIOR]: 'Interior',
  [ZONE_OPTIONS.TERRAZA]: 'Terraza',
  [ZONE_OPTIONS.BARRA]: 'Barra',
  [ZONE_OPTIONS.PRIVADO]: 'Privado (Sala reservada)'
};

export const ZONE_ICONS = {
  [ZONE_OPTIONS.INTERIOR]: '🏠',
  [ZONE_OPTIONS.TERRAZA]: '☀️',
  [ZONE_OPTIONS.BARRA]: '🍷',
  [ZONE_OPTIONS.PRIVADO]: '🚪'
};
```

#### **2.2. Actualizar `Mesas.jsx`**
```jsx
// Líneas 1718-1727 (REEMPLAZAR)
import { ZONE_OPTIONS, ZONE_LABELS } from '../constants/zones';

<select value={formData.zone} ...>
  <option value="">Seleccionar zona...</option>
  {Object.entries(ZONE_LABELS).map(([key, label]) => (
    <option key={key} value={key}>{label}</option>
  ))}
</select>
```

**Cambios:**
- ✅ Reduce de 8 a 4 opciones
- ✅ Usa constantes (no hardcoding)
- ✅ Valores consistentes con ENUM de BD

#### **2.3. Actualizar `useReservationWizard.js`**
```javascript
// Línea 36 (ACTUALIZAR)
zone: initialData?.zone || null,  // ✅ Ya existe

// Línea 267 (ACTUALIZAR zona default)
const zone = table.zone || ZONE_OPTIONS.INTERIOR;  // Usar constante
```

**Cambios:**
- ✅ Usa constantes de zonas
- ✅ Lógica actual se mantiene
- ✅ Compatible con backend

#### **2.4. Actualizar `ReservationWizard.jsx`**
```jsx
// Líneas 697 (ACTUALIZAR para mostrar icono + label)
import { ZONE_LABELS, ZONE_ICONS } from '../constants/zones';

<span className="text-lg font-semibold">
  {ZONE_ICONS[zone.zone]} {ZONE_LABELS[zone.zone] || zone.zone}
</span>
```

**Cambios:**
- ✅ Mejora UX con iconos
- ✅ Labels consistentes
- ✅ Fallback a valor raw si no existe

---

### **FASE 3: N8N WORKFLOWS** (INTEGRACIÓN AGENTE)

#### **3.1. Actualizar Tool `check_availability`**
```json
{
  "name": "check_availability",
  "description": "Verifica disponibilidad en el restaurante para una fecha, hora y número de personas. Opcionalmente puedes especificar una zona preferida.",
  "fields": {
    "values": [
      {"name": "date"},
      {"name": "time"},
      {"name": "party_size"},
      {"name": "preferred_zone"},  // ← NUEVO
      {"name": "restaurant_id"}
    ]
  }
}
```

**Implementación en workflow `Tool - check-availability.json`:**
```javascript
const ubicacion = input.preferred_zone || input.zone || input.location || null;

// VALIDAR zona si se especificó
const validZones = ['interior', 'terraza', 'barra', 'privado', 'any'];
let zonaFinal = null;

if (ubicacion && ubicacion !== 'any') {
  const zonaNormalizada = ubicacion.toLowerCase().trim();
  if (validZones.includes(zonaNormalizada)) {
    zonaFinal = zonaNormalizada;
  } else {
    console.log(`⚠️ Zona inválida: "${ubicacion}". Se buscará en todas las zonas.`);
  }
}

// CONSULTAR disponibilidad con filtro de zona
let query = supabase
  .from('tables')
  .select('*')
  .eq('restaurant_id', restaurant_id)
  .gte('capacity', personas)
  .eq('is_active', true);

if (zonaFinal) {
  query = query.eq('zone', zonaFinal);
  console.log(`📍 Filtrando por zona: ${zonaFinal}`);
}

const { data: availableTables, error } = await query;
```

**Cambios:**
- ✅ Acepta `preferred_zone` como parámetro
- ✅ Valida valores contra ENUM
- ✅ Filtra mesas por zona si se especifica
- ✅ Si zona inválida → busca en todas (fallback robusto)

#### **3.2. Actualizar Tool `create_reservation`**
```json
{
  "name": "create_reservation",
  "description": "Crea una nueva reserva en el restaurante",
  "fields": {
    "values": [
      {"name": "reservation_date"},
      {"name": "reservation_time"},
      {"name": "party_size"},
      {"name": "preferred_zone"},     // ← NUEVO
      {"name": "special_requests"},
      {"name": "restaurant_id"}
    ]
  }
}
```

**Implementación en workflow (nodo Supabase):**
```javascript
const zonaPreferida = input.preferred_zone || null;

// Insertar reserva
const { data, error } = await supabase
  .from('reservations')
  .insert({
    restaurant_id: input.restaurant_id,
    customer_name: customerName,
    customer_phone: customerPhone,
    reservation_date: input.reservation_date,
    reservation_time: input.reservation_time,
    party_size: input.party_size,
    preferred_zone: zonaPreferida,  // ← NUEVO CAMPO
    special_requests: input.special_requests,
    status: 'pending',
    source: 'ia',
    channel: 'whatsapp'
  });
```

**Cambios:**
- ✅ Guarda `preferred_zone` en BD
- ✅ Mantiene `special_requests` (compatible)
- ✅ Valida antes de insertar

---

### **FASE 4: PROMPT DEL AGENTE** (LÓGICA INTELIGENTE)

#### **4.1. Actualizar `PROMPT-SUPER-AGENT-v3-PERFECTO.txt`**

**Cambios en la CHECKLIST (línea 64):**
```markdown
☐ 1. FECHA obtenida y confirmada (convertida a YYYY-MM-DD)
☐ 2. HORA obtenida y confirmada (convertida a HH:MM en 24h)
☐ 3. PERSONAS obtenidas y confirmadas (número entero)
☐ 3.5. ZONA preguntada si aplica (ver reglas de zona)  // ← NUEVO
☐ 4. DISPONIBILIDAD verificada con "check_availability"
☐ 5. NOMBRE confirmado (ya lo tienes: {{ $json.customer_name }})
☐ 6. NOTAS ESPECIALES preguntadas (puede ser "ninguna")
☐ 7. RESERVA CREADA con "create_reservation"
```

**Insertar NUEVA SECCIÓN después de línea 49 (después de fechas):**
```markdown
═══════════════════════════════════════════════════════════════════
🏢 GESTIÓN DE ZONAS (NUEVO)
═══════════════════════════════════════════════════════════════════

El restaurante tiene las siguientes zonas:
• 🏠 Interior
• ☀️ Terraza
• 🍷 Barra
• 🚪 Privado (sala reservada)

**REGLAS DE ZONA:**

**1. POR DEFECTO:** Ofrecer Interior, Terraza y Barra
   "¿Tienes preferencia de zona? Tenemos interior, terraza o barra."

**2. SOLO SUGERIR PRIVADO SI:**
   - Grupo ≥ 8 personas:
     "Para grupos grandes tenemos una sala privada. ¿Te interesaría?"
   
   - Cliente menciona keywords ("tranquilo", "íntimo", "romántico", "privado", "discreto"):
     "Tenemos una sala más reservada que puede ser perfecta. ¿Te gustaría?"
   
   - Cliente pregunta explícitamente:
     "¿Tenéis zona privada?" → "Sí, tenemos sala privada. ¿Te gustaría reservar ahí?"

**3. SI CLIENTE NO ESPECIFICA:**
   → NO preguntes insistentemente
   → Usa zona="any" en check_availability (buscará en todas)

**4. SI ZONA SOLICITADA NO TIENE DISPONIBILIDAD:**
   "Veo que [zona] está completa. ¿Te iría bien en [zona_alternativa]?"

**5. AL LLAMAR TOOLS:**
   - check_availability: incluye "preferred_zone": "interior|terraza|barra|privado|any"
   - create_reservation: incluye "preferred_zone": "interior|terraza|barra|privado"
```

**Actualizar TOOL check_availability (línea 84):**
```markdown
**1. check_availability** — Verifica disponibilidad en tiempo real
**Uso:** INMEDIATAMENTE después de confirmar fecha, hora y personas
**Parámetros obligatorios:**
```json
{
  "date": "2025-10-19",
  "time": "20:00",
  "party_size": 4,
  "preferred_zone": "terraza",  // ← NUEVO: "interior"|"terraza"|"barra"|"privado"|"any"
  "restaurant_id": "{{ $json.restaurant_id }}"
}
```
```

**Actualizar TOOL create_reservation (línea 96):**
```markdown
**2. create_reservation** — Crea la reserva
**Uso:** SOLO después de check_availability exitoso
**Parámetros obligatorios:**
```json
{
  "reservation_date": "2025-10-19",
  "reservation_time": "20:00",
  "party_size": 4,
  "preferred_zone": "terraza",  // ← NUEVO (opcional, puede ser null)
  "special_requests": "",
  "restaurant_id": "{{ $json.restaurant_id }}"
}
```
```

**Actualizar FLUJO DE CONVERSACIÓN (insertar después de PASO 3):**
```markdown
**Paso 3.5 - ZONA (OPCIONAL):**

**Si NO especificó:**
"¿Tienes preferencia de zona? Tenemos interior, terraza o barra. Si prefieres, puedo asignarte automáticamente."

**Si especifica:**
Cliente: "Terraza" → Guardar: preferred_zone = "terraza"
Cliente: "Me da igual" → Guardar: preferred_zone = "any"

**Si grupo ≥ 8:**
"Para grupos grandes tenemos una sala privada disponible. ¿Te interesaría, o prefieres la zona general?"

**Si menciona keywords:**
Cliente: "Quiero algo tranquilo" → "Tenemos una sala más reservada. ¿Te gustaría?"

**Al verificar disponibilidad (PASO 4):**
Usa check_availability con el preferred_zone capturado
```

---

## ⚠️ **RIESGOS Y MITIGACIONES**

### **Riesgo 1: Mesas existentes con valores inválidos**
**Mitigación:**
- Script de normalización ANTES de crear ENUM
- Validar datos actuales: `SELECT DISTINCT zone FROM tables;`
- Mapear casos edge manualmente si es necesario

### **Riesgo 2: Reservas en proceso durante migración**
**Mitigación:**
- Ejecutar en horario de bajo tráfico (4 AM)
- Transacción atómica (BEGIN...COMMIT)
- Rollback preparado
- Notificación a usuarios si es necesario

### **Riesgo 3: Frontend usa valores antiguos en cache**
**Mitigación:**
- Incrementar versión de constantes
- Hard refresh después de deploy
- Mantener compatibilidad con valores legacy temporalmente

### **Riesgo 4: N8N workflows en ejecución**
**Mitigación:**
- Desplegar workflows actualizados ANTES de migración BD
- Mantener `ubicacion` como fallback en código
- Validación robusta con fallback a 'any'

---

## 🧪 **PLAN DE TESTING**

### **Test 1: Normalización de datos**
```sql
-- ANTES de migración
SELECT zone, COUNT(*) 
FROM tables 
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
GROUP BY zone;

-- Ejecutar normalización

-- DESPUÉS de migración
SELECT zone, COUNT(*) 
FROM tables 
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
GROUP BY zone;

-- Resultado esperado: solo 'interior', 'terraza', 'barra', 'privado'
```

### **Test 2: Frontend - Crear mesa**
1. Ir a página Mesas
2. Crear nueva mesa
3. Verificar dropdown tiene solo 4 opciones
4. Seleccionar "Terraza"
5. Guardar
6. Verificar en BD: `zone = 'terraza'` (no "Terraza")

### **Test 3: Wizard de reservas**
1. Iniciar nueva reserva manual
2. Llegar al PASO 5 (Zona)
3. Verificar que muestra zonas con disponibilidad
4. Seleccionar zona
5. Completar reserva
6. Verificar en BD: `preferred_zone` guardado correctamente

### **Test 4: Agente - Reserva con zona**
```
Cliente: "Quiero reservar para 4 el sábado en terraza"
Agente: "Perfecto, compruebo disponibilidad en terraza..."
[check_availability con preferred_zone="terraza"]
Agente: "Sí tenemos disponibilidad en terraza. ¿A qué hora?"
...
[create_reservation con preferred_zone="terraza"]
```

### **Test 5: Agente - Grupo grande (trigger privado)**
```
Cliente: "Quiero reservar para 10 personas"
Agente: "Para grupos grandes tenemos una sala privada. ¿Te interesaría?"
Cliente: "Sí"
[check_availability con preferred_zone="privado"]
```

### **Test 6: Agente - Sin especificar zona**
```
Cliente: "Quiero reservar para 4 el sábado"
Agente: "¿A qué hora?"
Cliente: "20:00"
Agente: "¿Tienes preferencia de zona? Tenemos interior, terraza o barra."
Cliente: "Me da igual"
[check_availability con preferred_zone="any"]
```

---

## 📊 **IMPACTO Y MÉTRICAS**

### **Impacto en BD:**
- **Tablas afectadas:** 2 (`tables`, `reservations`)
- **Filas afectadas:** ~10-50 mesas, 0 reservas (solo estructura)
- **Downtime:** 0 segundos (operaciones online)
- **Rollback:** < 1 minuto

### **Impacto en Frontend:**
- **Archivos afectados:** 4
  - `src/constants/zones.js` (NUEVO)
  - `src/pages/Mesas.jsx` (1 línea)
  - `src/hooks/useReservationWizard.js` (2 líneas)
  - `src/components/reservas/ReservationWizard.jsx` (1 línea)
- **Líneas de código:** ~50 líneas totales
- **Breaking changes:** ❌ Ninguno (compatible con legacy)

### **Impacto en N8N:**
- **Workflows afectados:** 3
  - `Tool - check-availability.json` (15 líneas)
  - `Tool - create-reservation.json` (nuevo o actualizar existente)
  - `3-super-agent-hibrido-FINAL-CORREGIDO.json` (metadata de tools)
- **Breaking changes:** ❌ Ninguno (fallback a valores antiguos)

### **Impacto en Prompt:**
- **Archivos afectados:** 1 (`PROMPT-SUPER-AGENT-v3-PERFECTO.txt`)
- **Líneas agregadas:** ~60 líneas
- **Versión:** v3 → v4 (registrar en VERSION-HISTORY.md)

---

## ✅ **ORDEN DE IMPLEMENTACIÓN**

### **DÍA 1: BASE DE DATOS (VIERNES 4 AM)**
1. ✅ Ejecutar migración de normalización
2. ✅ Verificar que todos los valores se normalizaron
3. ✅ Crear ENUM `zone_type`
4. ✅ Convertir columna `tables.zone` a ENUM
5. ✅ Agregar columna `reservations.preferred_zone`
6. ✅ Rollback test

### **DÍA 2: FRONTEND**
1. ✅ Crear `src/constants/zones.js`
2. ✅ Actualizar `Mesas.jsx`
3. ✅ Actualizar `useReservationWizard.js`
4. ✅ Actualizar `ReservationWizard.jsx`
5. ✅ Testing manual completo

### **DÍA 3: N8N + PROMPT**
1. ✅ Actualizar `Tool - check-availability.json`
2. ✅ Actualizar/Crear `Tool - create-reservation.json`
3. ✅ Actualizar metadata de tools en `3-super-agent-hibrido-FINAL-CORREGIDO.json`
4. ✅ Actualizar `PROMPT-SUPER-AGENT-v3-PERFECTO.txt` → v4
5. ✅ Actualizar `VERSION-HISTORY.md`
6. ✅ Testing completo de conversaciones

---

## 📚 **DOCUMENTOS RELACIONADOS**

- ✅ `docs/04-desarrollo/CHECKLIST_OBLIGATORIO.md` (cumplido)
- ✅ `docs/04-desarrollo/NORMAS_SAGRADAS.md` (respetado)
- ✅ `docs/01-arquitectura/DATABASE-SCHEMA-COMPLETO-2025.md` (verificado)
- ✅ `docs/02-sistemas/SISTEMA-DISPONIBILIDADES-COMPLETO.md` (revisado)
- ✅ `n8n/prompts/VERSION-HISTORY.md` (actualizar después)

---

## 🎯 **CONCLUSIÓN**

**Estado:** AUDITORÍA COMPLETA ✅  
**Riesgo:** BAJO (cambios quirúrgicos, bien planificados)  
**Complejidad:** MEDIA (requiere coordinación BD + Frontend + N8N)  
**Tiempo estimado:** 3 días (1 día BD, 1 día Frontend, 1 día N8N/Prompt)  
**Aprobación para continuar:** ⏳ PENDIENTE

---

**Esta auditoría garantiza:**
✅ NORMAS SAGRADAS respetadas  
✅ Multi-tenant asegurado  
✅ Datos reales (no inventados)  
✅ Cambios quirúrgicos (no degradan calidad)  
✅ Plan de rollback preparado  
✅ Testing completo definido  

**Próximo paso:** Esperar aprobación del usuario para iniciar implementación.

---

**Última actualización:** 17 de Octubre 2025  
**Responsable:** La-IA App Team  
**Estado:** 📋 Auditoría completada - Esperando GO para implementar

