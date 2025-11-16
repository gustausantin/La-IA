# 📅 ESTRATEGIA: Calendario de Recursos - Mobile-First

## 🎯 OBJETIVO
Añadir gestión visual de recursos (sillas/camillas/consultorios) a la página Reservas, manteniendo la política de protección de reservas existente y regeneración automática de slots.

---

## ✅ LO QUE YA TENEMOS (Y FUNCIONA)

### 1. **VOCABULARIO DINÁMICO POR VERTICAL** ✅
**Archivo:** `src/hooks/useVertical.js`

```javascript
// YA EXISTE - Sistema completo de vocabulario
const config = {
  fisioterapia: { resource: 'Camilla', resources: 'Camillas' },
  peluqueria_barberia: { resource: 'Sillón', resources: 'Sillones' },
  clinica_dental: { resource: 'Sillón', resources: 'Sillones' },
  veterinario: { resource: 'Consultorio', resources: 'Consultorios' },
  yoga_pilates: { resource: 'Sala', resources: 'Salas' },
  // ... más verticales
};
```

**✅ CONCLUSIÓN:** NO necesitamos crear nada nuevo. Solo usar `useVertical()` en la nueva vista.

---

### 2. **PROTECCIÓN DE RESERVAS** ✅
**Archivos:** 
- `src/components/AvailabilityManager.jsx` (línea 679-706)
- `src/services/reservationValidationService.js`

**Reglas existentes:**
```javascript
// 🔒 REGLA SAGRADA: NUNCA ELIMINAR RESERVAS
// Las reservas son SAGRADAS y solo se eliminan manualmente desde Reservas.jsx

// Función de validación YA EXISTE:
const validateReservationsBeforeChange = async (dateRange) => {
  // Busca conflictos con reservas existentes
  // Si hay reservas: BLOQUEA el cambio
  // Si no hay: PERMITE continuar
};
```

**✅ CONCLUSIÓN:** La lógica de protección YA FUNCIONA. Solo debemos:
1. Llamarla ANTES de crear bloqueos
2. Mostrar mensaje claro si hay conflictos
3. NO permitir la acción

---

### 3. **REGENERACIÓN AUTOMÁTICA DE SLOTS** ⚡
**Archivo:** `src/components/AvailabilityManager.jsx` (línea 682)

```javascript
// YA EXISTE - Regeneración inteligente
const smartRegeneration = async (changeType, changeData) => {
  // 1. Recarga settings desde Supabase
  // 2. Valida que no haya reservas en conflicto
  // 3. Regenera solo los slots necesarios
  // 4. PROTEGE las reservas existentes
};
```

**✅ CONCLUSIÓN:** Ya hay regeneración automática. Solo necesitamos:
1. Llamarla después de crear/eliminar bloqueos
2. Hacer que sea SILENCIOSA (sin confirmación manual)
3. Toast informativo: "Disponibilidad actualizada ✓"

---

## ❌ LO QUE NOS FALTA (Y DEBEMOS CREAR)

### 1. **TABLA `resources`** ❌
**Problema:** No existe en la base de datos.

**Solución:** Crear migración:
```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL, -- "Sillón 1", "Camilla A"
  resource_number INTEGER, -- 1, 2, 3...
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**¿Dónde se crean?**
- OPCIÓN A: En Configuración > Mi Espacio (nueva sección)
- OPCIÓN B: En primer uso de Reservas > Calendario (wizard rápido)

**Mi recomendación:** OPCIÓN B - Cuando el usuario abre "Calendario de Recursos" por primera vez:
```
📦 ¡Configura tus recursos!

¿Cuántos [Sillones] tienes en tu negocio?

[ - ] 3 [ + ]

[Continuar]

// Auto-crea: "Sillón 1", "Sillón 2", "Sillón 3"
```

---

### 2. **TABLA `resource_blockages`** ❌
**Problema:** No existe.

**Solución:** Crear migración:
```sql
CREATE TABLE resource_blockages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  resource_id UUID REFERENCES resources(id), -- NULL = bloqueo global
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_blockages_resource_date 
ON resource_blockages(resource_id, blocked_date);
```

---

### 3. **RELACIÓN appointments ↔ resources** ❌
**Problema:** Tabla `appointments` no tiene `resource_id`.

**Solución:** Migración:
```sql
ALTER TABLE appointments 
ADD COLUMN resource_id UUID REFERENCES resources(id);

-- Índice
CREATE INDEX idx_appointments_resource 
ON appointments(resource_id, start_time);
```

**Impacto:** 
- Citas actuales quedarán con `resource_id = NULL` (OK, son legacy)
- Citas nuevas DEBEN tener `resource_id` (asignación automática o manual)

---

## 🎨 DISEÑO UI - MOBILE-FIRST

### OPCIÓN 1: Vista "Booksy-style" ⭐ (RECOMENDADA)

**Mobile (< 768px):**
```
┌─────────────────────────┐
│ 📅 Calendario Recursos  │
│                         │
│ [ Sillón 1 ▼ ]         │ ← Selector dropdown
│                         │
│ ◀ Mié 13 Nov ▶         │ ← Navegación día
│                         │
│ 09:00 ┃ 🟢 Libre       │
│ 09:30 ┃ 👤 Ana López   │ ← Cita
│ 10:00 ┃ 👤 Luis García │
│ 10:30 ┃ 🟢 Libre       │
│ 11:00 ┃ 🔴 BLOQUEADO   │ ← Bloqueo
│ 11:30 ┃ 🔴 BLOQUEADO   │
│ 12:00 ┃ 🟢 Libre       │
│ ...                     │
│                         │
│ [🚫 Bloquear horario]  │ ← Acción principal
└─────────────────────────┘
```

**Desktop (≥ 768px):**
```
┌─────────────────────────────────────────────────┐
│ 📅 Calendario Recursos - Miércoles 13 Nov      │
│                                                 │
│ [ Día ] [ Semana ] [ Mes ]  ◀ ▶                │
│                                                 │
│ Hora │ Sillón 1  │ Sillón 2  │ Sillón 3       │
├──────┼───────────┼───────────┼───────────────  │
│ 09:00│ 🟢 Libre  │ Ana L.    │ Luis G.        │
│ 09:30│ 🟢 Libre  │ Ana L.    │ Luis G.        │
│ 10:00│ Mar R.    │ 🟢 Libre  │ 🟢 Libre       │
│ 10:30│ Mar R.    │ 🟢 Libre  │ 🟢 Libre       │
│ 11:00│ 🔴 BLOQ   │ Pedro S.  │ Eva M.         │
│ 11:30│ 🔴 BLOQ   │ Pedro S.  │ Eva M.         │
│ 12:00│ 🟢 Libre  │ 🟢 Libre  │ Clara P.       │
│ ...  │           │           │                 │
└──────┴───────────┴───────────┴─────────────────┘
```

**Interacciones:**
- **Mobile:** Tap en slot → Menú contextual (Ver cita / Bloquear)
- **Desktop:** Click en slot → Mismo menú

**Colores:**
- 🟢 Verde: Libre
- 🔵 Azul: Cita confirmada
- 🟡 Amarillo: Cita pendiente
- 🔴 Rojo: Bloqueado

---

### OPCIÓN 2: Vista "Scroll horizontal de columnas"

**Mobile:**
```
┌─────────────────────────┐
│ ◀ Mié 13 Nov ▶         │
│                         │
│ ⬅️ Scroll horizontal ➡️ │
│                         │
│ Hora  Sillón1 Sillón2  │
│ 09:00 🟢     👤        │
│ 09:30 🟢     👤        │
│ 10:00 👤     🟢        │
│ ...                     │
└─────────────────────────┘
```

**Problema:** Difícil de usar en mobile con muchos recursos (>3).

**Veredicto:** OPCIÓN 1 es mejor para mobile-first.

---

## 🔄 FLUJO DE USUARIO: Bloquear Horario

### 1. **Abrir modal de bloqueo**
```javascript
// Usuario hace tap en slot libre
handleSlotClick(slot) {
  if (slot.appointment) {
    // Ver detalles de cita
    openAppointmentDetails(slot.appointment);
  } else if (slot.blocked) {
    // Opciones: Ver motivo / Desbloquear
    openBlockOptions(slot.blockage);
  } else {
    // Crear bloqueo
    openBlockModal(slot);
  }
}
```

### 2. **Modal de bloqueo** (Mobile-First)
```jsx
<Modal title="🚫 Bloquear horario">
  <div className="space-y-3">
    {/* Recurso */}
    <InfoBox>
      📍 Sillón 1
    </InfoBox>

    {/* Fecha */}
    <InfoBox>
      📅 Miércoles, 13 de noviembre
    </InfoBox>

    {/* Rango de tiempo */}
    <div className="grid grid-cols-2 gap-2">
      <TimeInput label="Desde" value="11:00" />
      <TimeInput label="Hasta" value="13:00" />
    </div>

    {/* Motivo */}
    <TextArea 
      label="Motivo (opcional)" 
      placeholder="Ej: Médico"
    />

    {/* ⚠️ VALIDACIÓN: Si hay reservas */}
    {hasConflicts && (
      <AlertBox variant="error">
        ❌ Hay 2 reservas confirmadas:
        • 11:00 - Ana López
        • 12:00 - Luis García
        
        Debes cancelarlas manualmente primero.
      </AlertBox>
    )}

    {/* Botones */}
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
      <Button 
        variant="danger" 
        onClick={handleBlock}
        disabled={hasConflicts}
      >
        Confirmar bloqueo
      </Button>
    </div>
  </div>
</Modal>
```

### 3. **Proceso de validación y bloqueo**
```javascript
const handleBlock = async () => {
  // 1️⃣ VALIDAR: ¿Hay reservas en conflicto?
  const conflicts = await checkConflicts(resource, date, timeRange);
  
  if (conflicts.length > 0) {
    toast.error('❌ No puedes bloquear: hay reservas confirmadas');
    return;
  }

  // 2️⃣ CREAR BLOQUEO en BD
  const blockage = await createBlockage({
    resource_id,
    blocked_date,
    start_time,
    end_time,
    reason
  });

  // 3️⃣ REGENERAR SLOTS automáticamente
  await smartRegeneration('resource_blocked', {
    resource_id,
    dates: [blocked_date]
  });

  // 4️⃣ TOAST de confirmación
  toast.success('✅ Horario bloqueado. Disponibilidad actualizada.');

  // 5️⃣ RECARGAR vista
  reloadCalendar();
  onClose();
};
```

---

## ⚡ REGENERACIÓN AUTOMÁTICA (SIN CONFIRMACIÓN)

**Estado actual:** `AvailabilityManager` pide confirmación manual.

**Cambio necesario:**
```javascript
// ANTES (requiere confirmación)
const smartRegeneration = async () => {
  const confirmed = await showConfirmationModal();
  if (!confirmed) return;
  // ...regenerar
};

// DESPUÉS (automático + toast informativo)
const smartRegeneration = async () => {
  // Sin confirmación, directo
  const result = await regenerateSlots();
  
  // Toast informativo NO bloqueante
  toast.success(`✅ ${result.slotsUpdated} slots actualizados`, {
    duration: 2000,
    position: 'bottom-center'
  });
};
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### FASE 1: Base de Datos (30 min)
1. ✅ Crear migración `resources`
2. ✅ Crear migración `resource_blockages`
3. ✅ Añadir `resource_id` a `appointments`
4. ✅ Ejecutar migraciones en Supabase

### FASE 2: Setup Inicial (15 min)
1. ✅ Crear wizard "¿Cuántos [recursos] tienes?"
2. ✅ Auto-crear recursos (Sillón 1, Sillón 2, etc.)
3. ✅ Guardar en tabla `resources`

### FASE 3: UI Calendario Mobile (45 min)
1. ✅ Selector de recurso (dropdown en mobile)
2. ✅ Vista de día con horarios
3. ✅ Cargar citas + bloqueos del recurso/día
4. ✅ Indicadores visuales (🟢🔵🔴)

### FASE 4: Modal de Bloqueo (30 min)
1. ✅ Form: fecha, hora inicio, hora fin, motivo
2. ✅ Validación: detectar conflictos con reservas
3. ✅ Botón deshabilitado si hay conflictos
4. ✅ Crear bloqueo en BD

### FASE 5: Regeneración Automática (20 min)
1. ✅ Modificar `smartRegeneration` → sin confirmación
2. ✅ Llamar después de crear/eliminar bloqueo
3. ✅ Toast informativo

### FASE 6: Desktop Multi-Columna (OPCIONAL - 1h)
1. Grid con columnas por recurso
2. Scroll horizontal si >3 recursos
3. Drag & drop para mover citas entre recursos

---

## 🎯 DECISIONES CLAVE A CONFIRMAR

### 1. ¿Dónde crear los recursos la primera vez?
- [ ] **OPCIÓN A:** En Configuración > Mi Espacio (sección nueva)
- [ ] **OPCIÓN B:** Wizard al abrir Calendario por primera vez ⭐

**Mi recomendación:** OPCIÓN B - Más rápido, menos fricción.

---

### 2. ¿Qué pasa con citas sin resource_id?
- [ ] **OPCIÓN A:** Asignar automáticamente al primer recurso activo
- [ ] **OPCIÓN B:** Dejarlas sin recurso (legacy) ⭐
- [ ] **OPCIÓN C:** Pedir al usuario que las reasigne

**Mi recomendación:** OPCIÓN B - Las citas legacy no tienen recurso, solo las nuevas.

---

### 3. ¿Desktop multi-columna desde el inicio?
- [ ] **SÍ:** Implementar Phase 6 ahora (más tiempo)
- [ ] **NO:** Solo mobile selector, desktop después ⭐

**Mi recomendación:** NO - Entregar mobile perfecto primero. Desktop puede esperar.

---

## ✅ RESUMEN EJECUTIVO

### LO QUE APROVECHAREMOS:
1. ✅ `useVertical()` para vocabulario dinámico
2. ✅ `validateReservationsBeforeChange()` para protección
3. ✅ `smartRegeneration()` para slots (modificado)
4. ✅ Estructura de `Reservas.jsx` (añadir pestaña)

### LO QUE CREAREMOS:
1. 🆕 3 migraciones de BD
2. 🆕 Wizard de setup de recursos
3. 🆕 Vista calendario mobile-first
4. 🆕 Modal de bloqueo con validación
5. 🆕 Regeneración automática (silenciosa)

### TIEMPO ESTIMADO:
- **Mínimo viable (mobile):** 2.5 horas
- **Con desktop multi-columna:** 3.5 horas

---

## 🚀 ¿PROCEDEMOS?

**Necesito tu confirmación en:**

1. ✅ ¿Setup de recursos en wizard al abrir Calendario? (OPCIÓN B)
2. ✅ ¿Citas legacy sin resource_id quedan así? (OPCIÓN B)
3. ✅ ¿Solo mobile primero, desktop después? (NO hacer Phase 6 aún)

**Una vez confirmes, empiezo con:**
- Migraciones de BD
- Wizard de setup
- Vista calendario mobile

---

_Documento de estrategia - 2025-11-08_
_Listo para ejecutar con tu aprobación_



