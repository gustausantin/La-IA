# 📊 ANÁLISIS COMPLETO - Sistema de Recursos y Calendario

## ✅ LO QUE YA EXISTE EN LA BASE DE DATOS

### 1. **Tabla `resources`** ✅ EXISTE
```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    name VARCHAR(100) NOT NULL,          -- "Sillón 1", "Camilla A"
    resource_number VARCHAR(20),         -- "1", "2", "A", "B"
    description TEXT,
    capacity INTEGER DEFAULT 1,
    status VARCHAR DEFAULT 'available',  -- available, occupied, maintenance, reserved
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### 2. **Relación `appointments.resource_id`** ✅ EXISTE
```sql
appointments.resource_id UUID REFERENCES resources(id)
```

### 3. **Relación `availability_slots.resource_id`** ✅ EXISTE
```sql
availability_slots.resource_id UUID NOT NULL REFERENCES resources(id)
```

### 4. **Tabla `calendar_exceptions`** ✅ EXISTE (Para bloqueos globales)
```sql
CREATE TABLE calendar_exceptions (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    exception_date DATE NOT NULL,       -- Día bloqueado (ej: 25 Dic)
    is_open BOOLEAN DEFAULT false,      -- false = cerrado
    reason TEXT,                        -- "Navidad"
    open_time TIME,
    close_time TIME
);
```

**Nota:** Esta tabla es para **bloqueos de todo el negocio** (Navidades, festivos).
**NO sirve** para bloquear un solo recurso (Sillón 1).

---

## ❌ LO QUE FALTA

### **Tabla para bloqueos por recurso individual** ❌

Necesitamos crear:
```sql
CREATE TABLE resource_blockages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  resource_id UUID NOT NULL REFERENCES resources(id), -- Sillón específico
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_resource_blockages_lookup 
ON resource_blockages(resource_id, blocked_date);
```

**Diferencia con `calendar_exceptions`:**
- `calendar_exceptions`: Cierra TODO el negocio (todos los recursos)
- `resource_blockages`: Cierra UN solo recurso (Sillón 1)

---

## ✅ VOCABULARIO DINÁMICO - YA FUNCIONA

**Archivo:** `src/hooks/useVertical.js`

```javascript
// Sistema completo de vocabulario por vertical
peluqueria_barberia: {
  labels: {
    resource: 'Sillón',
    resources: 'Sillones',
    customer: 'Cliente',
    appointment: 'Cita'
  }
},

veterinario: {
  labels: {
    resource: 'Consultorio',
    resources: 'Consultorios',
    customer: 'Cliente',
    appointment: 'Cita'
  }
}
// ... más verticales
```

**✅ Uso en UI:**
```jsx
import { useVertical } from '../hooks/useVertical';

const MiComponente = () => {
  const { labels } = useVertical();
  
  return (
    <h1>Calendario de {labels.resources}</h1>
    // Si vertical = peluqueria → "Calendario de Sillones"
    // Si vertical = veterinario → "Calendario de Consultorios"
  );
};
```

---

## 🛡️ PROTECCIÓN DE RESERVAS - YA FUNCIONA

**Archivo:** `src/components/AvailabilityManager.jsx` (línea 679)

```javascript
// 🔒 REGLA SAGRADA: NUNCA ELIMINAR RESERVAS
// Las reservas son SAGRADAS y solo se eliminan manualmente
```

**Lógica existente:**
1. Antes de cambiar horarios → Validar si hay reservas
2. Si hay reservas en el rango → ❌ BLOQUEAR cambio
3. Si no hay → ✅ PERMITIR y regenerar slots

**✅ SOLO DEBEMOS:**
Usar esta misma lógica para validar bloqueos de recursos.

---

## ⚡ REGENERACIÓN DE SLOTS - CÓMO MEJORARLA

### **Estado actual:**
```javascript
// PROBLEMA: Pide confirmación manual
const smartRegeneration = async () => {
  const userConfirmed = await showModal();
  if (!userConfirmed) return;
  // ...regenerar
};
```

### **Cambio necesario:**
```javascript
// SOLUCIÓN: Automático + toast informativo
const smartRegeneration = async (changeType, affectedDates) => {
  console.log(`⚡ Regenerando slots por: ${changeType}`);
  
  // Regenerar sin pedir confirmación
  const result = await supabase.rpc('regenerate_availability_slots', {
    p_business_id: businessId,
    p_start_date: affectedDates[0],
    p_end_date: affectedDates[affectedDates.length - 1]
  });

  // Toast NO bloqueante
  toast.success(`✅ ${result.slots_updated} slots actualizados`, {
    duration: 2000,
    position: 'bottom-center'
  });

  return result;
};
```

**Triggers que llaman `smartRegeneration`:**
- ✅ Cambio de horarios (ya existe)
- ✅ Creación de recurso (ya existe)
- 🆕 Crear bloqueo de recurso (NUEVO)
- 🆕 Eliminar bloqueo de recurso (NUEVO)

---

## 🎨 PROPUESTA DE UI - MOBILE-FIRST

### **PESTAÑA EN RESERVAS.JSX**

```jsx
// Añadir tabs en Reservas.jsx:

<div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
  <button 
    onClick={() => setActiveTab('lista')}
    className={`px-4 py-2 rounded-lg whitespace-nowrap ${
      activeTab === 'lista' ? 'bg-purple-600 text-white' : 'bg-gray-200'
    }`}
  >
    📋 Lista de Citas
  </button>
  
  <button 
    onClick={() => setActiveTab('calendario')}
    className={`px-4 py-2 rounded-lg whitespace-nowrap ${
      activeTab === 'calendario' ? 'bg-purple-600 text-white' : 'bg-gray-200'
    }`}
  >
    📅 Calendario de {labels.resources}
  </button>
</div>

{activeTab === 'lista' && <ReservasListaView />}
{activeTab === 'calendario' && <CalendarioRecursosView />}
```

---

### **VISTA MOBILE: Selector + Timeline vertical**

```
┌────────────────────────────┐
│ 📅 Calendario de Sillones │
│                            │
│ [  Sillón 1  ▼ ]          │ ← Dropdown
│                            │
│ ◀  Miércoles 13 Nov  ▶    │ ← Navegador día
│                            │
│ ┌────────────────────────┐ │
│ │ 09:00 │ 🟢 Disponible │ │ ← Tap para bloquear
│ │ 09:30 │ 🟢 Disponible │ │
│ │ 10:00 │ 👤 Ana López  │ │ ← Tap para ver cita
│ │       │ Corte + Tinte │ │
│ │ 11:00 │ 👤 Ana López  │ │
│ │ 11:30 │ 🔴 BLOQUEADO  │ │ ← Tap para desbloquear
│ │       │ Médico        │ │
│ │ 12:00 │ 🔴 BLOQUEADO  │ │
│ │ 12:30 │ 🟢 Disponible │ │
│ │ 13:00 │ 👤 Luis G.    │ │
│ │       │ Corte         │ │
│ │ 13:30 │ 👤 Luis G.    │ │
│ │ 14:00 │ 🟢 Disponible │ │
│ └────────────────────────┘ │
│                            │
│ [ 🚫 Bloquear horario ]   │ ← Botón acción
└────────────────────────────┘
```

**Features:**
- ✅ Timeline vertical (fácil de scrollear)
- ✅ Selector de recurso en dropdown
- ✅ Navegación de día (< >)
- ✅ Colores claros (Verde/Azul/Rojo)
- ✅ Tap en slot → Acción contextual

---

### **VISTA DESKTOP: Multi-columna**

```
┌─────────────────────────────────────────────┐
│ Miércoles 13 Nov  [ Día | Semana | Mes ]   │
│ ◀ ▶                                          │
├──────┬──────────┬──────────┬──────────┬─────┤
│ Hora │ Sillón 1 │ Sillón 2 │ Sillón 3 │ +   │
├──────┼──────────┼──────────┼──────────┼─────┤
│ 09:00│ 🟢       │ Ana L.   │ Luis G.  │     │
│ 09:30│ 🟢       │ Ana L.   │ Luis G.  │     │
│ 10:00│ Mar R.   │ 🟢       │ 🟢       │     │
│ 10:30│ Mar R.   │ 🟢       │ 🟢       │     │
│ 11:00│ 🔴 BLOQ  │ Pedro S. │ Eva M.   │     │
│ 11:30│ 🔴 BLOQ  │ Pedro S. │ Eva M.   │     │
│ 12:00│ 🟢       │ 🟢       │ Clara P. │     │
│ 12:30│ 🟢       │ 🟢       │ Clara P. │     │
└──────┴──────────┴──────────┴──────────┴─────┘
```

---

## 🔄 FLUJO COMPLETO: Bloquear Sillón 1 el Miércoles

### **Paso 1: Usuario abre Calendario**
```
Usuario: Reservas > Calendario de Sillones
Sistema: Carga recursos del negocio
Sistema: Muestra Sillón 1 por defecto (primer recurso activo)
```

### **Paso 2: Navega al Miércoles**
```
Usuario: Tap en ▶ ▶ (hasta llegar al miércoles)
Sistema: Carga citas y bloqueos de Sillón 1 para ese día
```

### **Paso 3: Tap en "Bloquear horario"**
```
Sistema: Abre modal

┌──────────────────────────┐
│ 🚫 Bloquear horario      │
│                          │
│ Recurso: Sillón 1        │
│ Fecha: Miércoles 13 Nov  │
│                          │
│ Desde: [11:00] ▼         │
│ Hasta: [13:00] ▼         │
│                          │
│ Motivo: [Médico_____]    │
│                          │
│ [Cancelar] [Bloquear]    │
└──────────────────────────┘
```

### **Paso 4: Sistema valida**
```javascript
// 1. Buscar citas en conflicto
const conflicts = await supabase
  .from('appointments')
  .select('*')
  .eq('resource_id', sillon1.id)
  .eq('appointment_date', '2025-11-13')
  .gte('appointment_time', '11:00')
  .lt('appointment_time', '13:00')
  .in('status', ['confirmed', 'pending']);

// 2. Si HAY conflictos → ❌ BLOQUEAR
if (conflicts.length > 0) {
  toast.error(`❌ No puedes bloquear: hay ${conflicts.length} cita(s) confirmada(s)`);
  
  // Mostrar lista de citas:
  showConflictsList(conflicts);
  // "• 11:00 - Ana López - Corte + Tinte"
  // "• 12:00 - Luis García - Corte"
  
  return; // SALIR, no permitir
}

// 3. Si NO hay conflictos → ✅ CREAR BLOQUEO
const { data, error } = await supabase
  .from('resource_blockages')
  .insert({
    business_id,
    resource_id: sillon1.id,
    blocked_date: '2025-11-13',
    start_time: '11:00',
    end_time: '13:00',
    reason: 'Médico'
  });

// 4. REGENERAR SLOTS automáticamente (SIN confirmación)
await smartRegeneration('resource_blocked', {
  resource_id: sillon1.id,
  dates: ['2025-11-13']
});

// 5. Toast informativo
toast.success('✅ Horario bloqueado. Disponibilidad actualizada.');
```

---

## 🚨 POLÍTICA DE PROTECCIÓN DE RESERVAS

### **REGLA DE ORO:**
> "Las reservas son SAGRADAS. Solo se cancelan manualmente y con aviso."

### **Casos de uso:**

#### **CASO 1: Bloquear sin conflictos** ✅
```
Bloqueo: Sillón 1, Miércoles 11:00-13:00
Citas existentes: Ninguna
Resultado: ✅ PERMITIDO
Acción: Crear bloqueo + Regenerar slots
```

#### **CASO 2: Bloquear con conflictos** ❌
```
Bloqueo: Sillón 1, Miércoles 11:00-13:00
Citas existentes: 
  • 11:00 - Ana López (confirmada)
  • 12:00 - Luis García (confirmada)
  
Resultado: ❌ BLOQUEADO

Modal:
┌────────────────────────────────┐
│ ⚠️ No puedes bloquear          │
│                                │
│ Hay 2 reservas confirmadas:    │
│ • 11:00 - Ana López            │
│ • 12:00 - Luis García          │
│                                │
│ Debes cancelarlas manualmente  │
│ primero desde la lista.        │
│                                │
│ [ Ir a Lista de Citas ]        │
│ [ Cancelar ]                   │
└────────────────────────────────┘
```

#### **CASO 3: Desbloquear horario** ✅
```
Acción: Eliminar bloqueo de Sillón 1, Miércoles 11:00-13:00
Validación: No requiere (no afecta reservas)
Resultado: ✅ PERMITIDO
Acción: Eliminar bloqueo + Regenerar slots
```

#### **CASO 4: Cambiar horarios del negocio** ⚠️
```
Cambio: Cerrar negocio los domingos
Validación: ¿Hay reservas confirmadas algún domingo?

SI hay → ❌ BLOQUEAR cambio
NO hay → ✅ PERMITIR + Regenerar
```

---

## 🔄 REGENERACIÓN AUTOMÁTICA - NUEVA ESTRATEGIA

### **ANTES (Restaurante):**
```javascript
// Usuario cambia horarios
showModal("¿Regenerar slots?"); // ← Confirmación manual
if (userConfirmed) {
  regenerateSlots();
}
```

**Problema:** Interrumpe el flujo del usuario.

### **DESPUÉS (Mobile-First):**
```javascript
// Usuario cambia horarios / crea bloqueo
// → Regeneración AUTOMÁTICA + Toast informativo

const handleChange = async () => {
  // 1. Validar (sin tocar reservas)
  const valid = await validateChange();
  if (!valid) return;

  // 2. Aplicar cambio
  await applyChange();

  // 3. Regenerar AUTOMÁTICAMENTE (sin confirmación)
  const result = await smartRegeneration('auto', dates);

  // 4. Toast NO bloqueante
  toast.success(`✅ Actualizado. ${result.slots} slots regenerados.`, {
    duration: 2000,
    icon: '⚡'
  });
};
```

**Ventajas:**
- ✅ Flujo rápido
- ✅ Sin interrupciones
- ✅ Usuario informado (toast)
- ✅ Slots siempre sincronizados

---

## 📱 DISEÑO MOBILE-FIRST - INSPIRACIÓN BOOKSY

### **Booksy hace esto bien:**

1. **Vista de recurso individual** (no scroll horizontal)
2. **Timeline vertical** con horas del día
3. **Colores claros:** Verde (libre), Azul (ocupado), Rojo (bloqueado)
4. **Tap simple** (no drag & drop en mobile)
5. **Bottom sheet** para acciones (no modales centrados)

### **Nuestra implementación:**

```jsx
// MOBILE: Vista de recurso único
<div className="space-y-3 p-3">
  {/* Selector de recurso */}
  <select className="w-full p-3 rounded-lg border">
    <option>Sillón 1</option>
    <option>Sillón 2</option>
    <option>Sillón 3</option>
  </select>

  {/* Navegador de día */}
  <div className="flex items-center justify-between bg-white p-3 rounded-lg">
    <button><ChevronLeft /></button>
    <span className="font-bold">Miércoles 13 Nov</span>
    <button><ChevronRight /></button>
  </div>

  {/* Timeline de slots */}
  <div className="space-y-1">
    {slots.map(slot => (
      <div
        key={slot.time}
        onClick={() => handleSlotClick(slot)}
        className={`flex items-center p-3 rounded-lg border ${
          slot.blocked ? 'bg-red-50 border-red-300' :
          slot.appointment ? 'bg-blue-50 border-blue-300' :
          'bg-green-50 border-green-300'
        }`}
      >
        <span className="w-16 font-mono text-sm">{slot.time}</span>
        <div className="flex-1">
          {slot.blocked && (
            <span className="text-sm font-semibold text-red-900">
              🔴 BLOQUEADO - {slot.reason}
            </span>
          )}
          {slot.appointment && (
            <div>
              <p className="text-sm font-semibold text-blue-900">
                👤 {slot.appointment.customer_name}
              </p>
              <p className="text-xs text-blue-700">
                {slot.appointment.service_name}
              </p>
            </div>
          )}
          {!slot.blocked && !slot.appointment && (
            <span className="text-sm text-green-700">🟢 Disponible</span>
          )}
        </div>
      </div>
    ))}
  </div>

  {/* Botón de acción */}
  <button className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold">
    🚫 Bloquear horario
  </button>
</div>
```

---

## ✅ RESUMEN - QUÉ HACER

### **MIGRACIONES DE BD (1):**
```sql
-- SOLO FALTA ESTA TABLA:
CREATE TABLE resource_blockages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  resource_id UUID NOT NULL REFERENCES resources(id),
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### **CÓDIGO FRONTEND (5 componentes):**

1. ✅ **Pestaña en Reservas.jsx** (añadir tab "Calendario")
2. ✅ **CalendarioRecursosView.jsx** (vista principal mobile-first)
3. ✅ **ResourceSelector.jsx** (dropdown de recursos)
4. ✅ **TimelineSlots.jsx** (timeline vertical con slots)
5. ✅ **BlockageModal.jsx** (modal con validación)

### **SERVICIOS (2 funciones):**

1. ✅ **BlockageService.js** (crear/eliminar bloqueos)
2. ✅ Modificar **AvailabilityManager.jsx** (regeneración automática)

---

## 🎯 PREGUNTA FINAL

¿Quieres que implemente esto **AHORA** con este enfoque Mobile-First?

**Incluye:**
- ✅ Migración de BD
- ✅ Pestaña en Reservas
- ✅ Vista mobile selector + timeline
- ✅ Modal de bloqueo con validación
- ✅ Regeneración automática
- ✅ Protección de reservas

**Tiempo estimado:** 2 horas

**¿Procedemos?** 🚀



