# 📊 ANÁLISIS TÉCNICO: Dashboard "Socio Virtual" - Frontend

## 🎯 OBJETIVO
Crear un dashboard inteligente que actúe como "Jefe de Operaciones" (COO), mostrando solo **excepciones** y acciones críticas, no datos.

---

## 🧠 ESTADO ACTUAL DEL BACKEND

### ✅ SQL Functions Desplegadas (100% Funcional)
1. **`detect_employee_absences_with_appointments`**
   - Detecta empleados ausentes con citas asignadas
   - Encuentra empleados alternativos disponibles
   - Retorna JSON con citas afectadas

2. **`get_high_risk_appointments`**
   - Calcula risk_score de no-show por cliente
   - Factores: `no_show_count`, `confirmed`, `customer_segment`
   - Threshold configurable (default: 60)

3. **`get_upcoming_free_slots`**
   - Encuentra huecos libres en las próximas 2 horas
   - Agrupa por recurso y tiempo

### ✅ Edge Functions Desplegadas (100% Funcional)
1. **`get-snapshot`** - Cerebro del Dashboard
   - Analiza 4 escenarios en orden de prioridad
   - Retorna escenario actual con mensaje y acciones

2. **`generate-flash-offer-text`** - OpenAI Integration
   - Genera texto de oferta para huecos muertos
   - Usa GPT-4o-mini

3. **`transfer-appointments`** - Acción de Crisis
   - Mueve citas de un empleado a otro
   - Sincroniza con Google Calendar
   - Envía WhatsApp a clientes

4. **`cancel-appointments-batch`** - Acción de Cancelación
   - Cancela múltiples citas
   - Libera slots
   - Envía mensaje de reagendado

---

## 📋 ESQUEMA DE DATOS REAL

### Tablas Principales

#### `businesses`
```sql
- id: UUID
- name: TEXT
- settings: JSONB
  - operating_hours: {...}
  - agent: { name, avatar_url, ... }
  - contact_name: TEXT
  - avg_ticket: NUMERIC
```

#### `appointments`
```sql
- id: UUID
- business_id: UUID
- customer_id: UUID
- employee_id: UUID
- resource_id: UUID
- appointment_date: DATE
- appointment_time: TIME
- status: TEXT (pending, confirmed, completed, cancelled, no_show)
- duration_minutes: INTEGER
- customer_name: TEXT
- customer_phone: TEXT
- source: TEXT (agent_whatsapp, dashboard, manual)
- spend_amount: NUMERIC
```

#### `customers`
```sql
- id: UUID
- business_id: UUID
- name: TEXT
- phone: TEXT
- email: TEXT
- segment_auto: TEXT (nuevo, habitual, vip, inactivo, riesgo)
- visits_count: INTEGER
- no_show_count: INTEGER
- last_visit_at: TIMESTAMPTZ
```

#### `employees`
```sql
- id: UUID
- business_id: UUID
- name: TEXT
- avatar_url: TEXT
- is_active: BOOLEAN
- assigned_resource_id: UUID
```

#### `employee_absences`
```sql
- id: UUID
- business_id: UUID
- employee_id: UUID
- start_date: DATE
- end_date: DATE
- absence_type: TEXT (sick, vacation, other)
- reason: TEXT
```

#### `resources`
```sql
- id: UUID
- business_id: UUID
- name: TEXT (Silla 1, Box 2, etc.)
- resource_type: TEXT (chair, box, room)
- capacity: INTEGER
- is_active: BOOLEAN
```

#### `availability_slots`
```sql
- id: UUID
- business_id: UUID
- resource_id: UUID
- slot_date: DATE
- start_time: TIME
- end_time: TIME
- status: TEXT (free, reserved, blocked)
- duration_minutes: INTEGER
```

---

## 🎨 ARQUITECTURA DE COMPONENTES

### Estructura de Archivos
```
src/
├── components/
│   └── dashboard/
│       ├── LuaAvatar.jsx          (Avatar inteligente + bocadillo + botones)
│       ├── LiveTurnsWidget.jsx    (Turnos en vivo multi-carril)
│       └── MetricsBar.jsx          (Métricas del día)
├── hooks/
│   ├── useDashboardSnapshot.js    (Hook para get-snapshot)
│   └── useActionExecutor.js       (Hook para ejecutar acciones)
├── pages/
│   └── DashboardAgente.jsx         (Página principal - integración)
└── services/
    └── dashboardActions.js         (Service para llamar Edge Functions)
```

---

## 🧩 COMPONENTE 1: LuaAvatar.jsx

### Props
```typescript
interface LuaAvatarProps {
  scenario: 'CRISIS_PERSONAL' | 'RIESGO_NOSHOW' | 'HUECO_MUERTO' | 'PALMADA_ESPALDA' | 'ERROR';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  actions: Action[];
  avatar_url: string | null;
  agent_name: string;
  onActionClick: (action: Action) => void;
}

interface Action {
  id: string;
  label: string;
  endpoint: string | null;
  type: 'destructive' | 'safe';
  payload: any;
}
```

### Estados Visuales por Escenario

#### 🚨 CRISIS_PERSONAL (Prioridad CRITICAL)
- **Color:** Rojo (#EF4444)
- **Ícono:** AlertTriangle parpadeante
- **Borde:** Rojo grueso (4px)
- **Animación:** Pulso constante
- **Botones:** 
  - Transferir → Rojo sólido
  - Cancelar → Gris outline

#### ⚠️ RIESGO_NOSHOW (Prioridad HIGH)
- **Color:** Naranja (#F97316)
- **Ícono:** AlertCircle
- **Borde:** Naranja medio (3px)
- **Animación:** Balanceo suave
- **Botones:**
  - Llamar → Verde (link externo)
  - WhatsApp → Verde (link externo)

#### 💰 HUECO_MUERTO (Prioridad MEDIUM)
- **Color:** Azul (#3B82F6)
- **Ícono:** Zap
- **Borde:** Azul fino (2px)
- **Animación:** Ninguna
- **Botones:**
  - Generar Oferta → Azul sólido

#### 👏 PALMADA_ESPALDA (Prioridad LOW)
- **Color:** Verde (#10B981)
- **Ícono:** CheckCircle
- **Borde:** Verde fino (1px)
- **Animación:** Ninguna
- **Botones:**
  - Ver Agenda → Gris outline
  - Ver Caja → Gris outline

### Lógica Interna

1. **Renderizado del Avatar:**
   - Si `avatar_url` existe → `<img src={avatar_url} />`
   - Si no → `<Bot className="w-16 h-16" />` (gradiente)

2. **Bocadillo Inteligente:**
   - Posición: Superior derecha del avatar
   - Cola apuntando al avatar
   - Fondo según escenario
   - Tipografía: Font-medium, tamaño dinámico

3. **Botones Mágicos:**
   - Renderizado condicional según `action.type`
   - Confirmación modal si `type === 'destructive'`
   - Loading state durante ejecución

---

## 🧩 COMPONENTE 2: LiveTurnsWidget.jsx

### Props
```typescript
interface LiveTurnsWidgetProps {
  business_id: string;
  current_timestamp: string;
}
```

### Lógica de Datos

1. **Query a appointments:**
```javascript
const { data: currentTurns } = await supabase
  .from('appointments')
  .select(`
    id,
    customer_name,
    customer_phone,
    appointment_time,
    duration_minutes,
    status,
    employee:employee_id (name, avatar_url),
    resource:resource_id (name, resource_type),
    customer:customer_id (segment_auto, visits_count, no_show_count)
  `)
  .eq('business_id', business_id)
  .eq('appointment_date', today)
  .gte('appointment_time', currentHour)
  .lte('appointment_time', nextHour)
  .in('status', ['pending', 'confirmed', 'completed'])
  .order('appointment_time');
```

2. **Cálculo de etiquetas inteligentes:**
```javascript
const getCustomerTag = (customer) => {
  if (!customer) return { label: 'SIN DATOS', color: 'gray' };
  if (customer.visits_count === 1) return { label: 'NUEVO', color: 'green' };
  if (customer.segment_auto === 'vip') return { label: 'VIP', color: 'purple' };
  if (customer.no_show_count > 1) return { label: '⚠️ RIESGO', color: 'red' };
  return { label: 'HABITUAL', color: 'blue' };
};
```

3. **Agrupación por recurso:**
```javascript
const groupByResource = (turns) => {
  const grouped = {};
  turns.forEach(turn => {
    const resourceName = turn.resource?.name || 'Sin asignar';
    if (!grouped[resourceName]) {
      grouped[resourceName] = [];
    }
    grouped[resourceName].push(turn);
  });
  return grouped;
};
```

### Diseño Visual

#### Desktop (>768px):
```
┌─────────────────────────────────────────┐
│  ⏰ AHORA (10:00 - 11:00)               │
├─────────────────────────────────────────┤
│  Silla 1 (Culebra):                     │
│  ✂️ Juan Pérez (Corte) [NUEVO]          │
│  [10:00 - 11:30] ━━━━━━━━━━━━ 60%      │
├─────────────────────────────────────────┤
│  Silla 2 (Pol):                         │
│  💆‍♀️ Ana García (Tinte) [VIP]            │
│  [10:15 - 12:00] ━━━━━━━━━━━━ 75%      │
├─────────────────────────────────────────┤
│  Box 3 (Andrew):                        │
│  🟢 LIBRE [Botón: Bloquear hueco]       │
└─────────────────────────────────────────┘
```

#### Mobile (<768px):
```
┌───────────────────────┐
│ ⏰ 10:00 - 11:00      │
├───────────────────────┤
│ ▼ Silla 1 (Culebra)   │ <- Accordion
│   Juan P. [NUEVO]     │
│   ━━━━━━━━━ 60%       │
├───────────────────────┤
│ ▼ Silla 2 (Pol)       │
│   Ana G. [VIP]        │
│   ━━━━━━━━━━━ 75%     │
└───────────────────────┘
```

### Real-time Updates

```javascript
useEffect(() => {
  const channel = supabase
    .channel(`live-turns-${business_id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'appointments',
      filter: `business_id=eq.${business_id}`
    }, (payload) => {
      // Actualizar solo si afecta a ventana actual
      if (isWithinCurrentWindow(payload.new.appointment_time)) {
        refreshTurns();
      }
    })
    .subscribe();
    
  return () => supabase.removeChannel(channel);
}, [business_id]);
```

---

## 🧩 HOOK: useDashboardSnapshot.js

### Responsabilidad
Llamar a `get-snapshot` cada 2 minutos y gestionar el estado del escenario.

### Interface
```typescript
interface UseDashboardSnapshotReturn {
  scenario: Scenario | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface Scenario {
  scenario: string;
  priority: string;
  lua_message: string;
  actions: Action[];
  data: any;
}
```

### Implementación
```javascript
export const useDashboardSnapshot = (businessId) => {
  const [scenario, setScenario] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchSnapshot = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-snapshot', {
        body: { business_id: businessId }
      });
      
      if (error) throw error;
      setScenario(data);
    } catch (err) {
      setError(err);
      console.error('Error fetching snapshot:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto-refresh cada 2 minutos
  useEffect(() => {
    if (!businessId) return;
    
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 120000); // 2 min
    
    return () => clearInterval(interval);
  }, [businessId]);
  
  return {
    scenario,
    isLoading,
    error,
    refresh: fetchSnapshot
  };
};
```

---

## 🧩 HOOK: useActionExecutor.js

### Responsabilidad
Ejecutar acciones del dashboard (transferir, cancelar, generar oferta).

### Implementación
```javascript
export const useActionExecutor = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const executeAction = async (action) => {
    setIsExecuting(true);
    setError(null);
    
    try {
      // Validar acción destructiva
      if (action.type === 'destructive') {
        const confirmed = await showConfirmationModal(action);
        if (!confirmed) {
          setIsExecuting(false);
          return { cancelled: true };
        }
      }
      
      // Ejecutar según endpoint
      if (action.endpoint) {
        const { data, error } = await supabase.functions.invoke(
          action.endpoint.replace('/functions/v1/', ''),
          { body: action.payload }
        );
        
        if (error) throw error;
        setResult(data);
        return data;
      } else {
        // Acción de navegación
        if (action.payload?.route) {
          window.location.href = action.payload.route;
        }
      }
    } catch (err) {
      setError(err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };
  
  return {
    executeAction,
    isExecuting,
    result,
    error
  };
};
```

---

## 📊 INTEGRACIÓN EN DashboardAgente.jsx

### Layout Propuesto

```
┌──────────────────────────────────────────────┐
│ [HEADER con Avatar + Saludo + Botón Refresh] │
├──────────────────────────────────────────────┤
│                                              │
│  🧠 EL CEREBRO (40% altura)                  │
│  ┌──────────────────────────────────────┐   │
│  │ [LuaAvatar Component]                │   │
│  │  - Avatar + Bocadillo + Botones      │   │
│  └──────────────────────────────────────┘   │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  💓 EL PULSO (40% altura)                    │
│  ┌──────────────────────────────────────┐   │
│  │ [LiveTurnsWidget Component]          │   │
│  │  - Carriles multi-recurso            │   │
│  │  - Etiquetas inteligentes            │   │
│  └──────────────────────────────────────┘   │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  🏥 LA SALUD (20% altura)                    │
│  ┌─────┬─────┬─────┬─────┐                  │
│  │ 0€  │ 0   │ 0   │ 0   │ KPIs compactos   │
│  │Caja │Citas│VIP  │Risk │                  │
│  └─────┴─────┴─────┴─────┘                  │
│                                              │
└──────────────────────────────────────────────┘
```

### Código de Integración

```jsx
export default function DashboardAgenteV2() {
  const { business, user } = useAuthContext();
  const { scenario, isLoading, error, refresh } = useDashboardSnapshot(business?.id);
  const { executeAction, isExecuting } = useActionExecutor();
  
  // ... resto del código existente ...
  
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4">
      <div className="max-w-[85%] mx-auto space-y-3">
        
        {/* HEADER (Ya existe) */}
        <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-white rounded-xl shadow-sm border border-purple-100 p-4">
          {/* ... código existente ... */}
        </div>
        
        {/* 🧠 EL CEREBRO - Lua Inteligente */}
        {!isLoading && scenario && (
          <LuaAvatar
            scenario={scenario.scenario}
            priority={scenario.priority}
            message={scenario.lua_message}
            actions={scenario.actions}
            avatar_url={business?.settings?.agent?.avatar_url}
            agent_name={business?.settings?.agent?.name || 'Lua'}
            onActionClick={executeAction}
            isExecutingAction={isExecuting}
          />
        )}
        
        {/* 💓 EL PULSO - Turnos en Vivo */}
        <LiveTurnsWidget
          business_id={business?.id}
          current_timestamp={new Date().toISOString()}
        />
        
        {/* 🏥 LA SALUD - Métricas Compactas */}
        <MetricsBar
          caja={dashboardData.weeklyValue || 0}
          citas={dashboardData.reservationsToday || 0}
          vip={dashboardData.vipCustomers || 0}
          riesgo={dashboardData.highRiskNoShows || 0}
        />
        
        {/* Resto del dashboard existente (oculto por defecto) */}
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            📊 Ver métricas detalladas
          </summary>
          <div className="mt-4 space-y-3">
            {/* ... código existente de métricas ... */}
          </div>
        </details>
        
      </div>
    </div>
  );
}
```

---

## 🎯 PLAN DE IMPLEMENTACIÓN

### Fase 1: Hooks (30 min)
1. ✅ Crear `useDashboardSnapshot.js`
2. ✅ Crear `useActionExecutor.js`
3. ✅ Testear llamadas a `get-snapshot`

### Fase 2: Componentes Básicos (1h)
1. ✅ Crear `LuaAvatar.jsx` (estructura base)
2. ✅ Crear `LiveTurnsWidget.jsx` (estructura base)
3. ✅ Crear `MetricsBar.jsx`

### Fase 3: Lógica Avanzada (1h)
1. ✅ Implementar estados visuales por escenario
2. ✅ Implementar modal de confirmación
3. ✅ Implementar real-time en LiveTurnsWidget
4. ✅ Implementar etiquetas inteligentes

### Fase 4: Integración (30 min)
1. ✅ Integrar en `DashboardAgente.jsx`
2. ✅ Ajustar layout responsive
3. ✅ Testing en móvil

### Fase 5: Pulido (30 min)
1. ✅ Animaciones suaves
2. ✅ Loading states
3. ✅ Error handling
4. ✅ Toast notifications

---

## ✅ CHECKLIST FINAL

- [ ] Hooks funcionan correctamente
- [ ] LuaAvatar muestra los 4 escenarios
- [ ] Botones ejecutan acciones reales
- [ ] Modal de confirmación funciona
- [ ] LiveTurnsWidget muestra turnos reales
- [ ] Etiquetas inteligentes correctas
- [ ] Real-time updates funcionan
- [ ] Responsive en móvil
- [ ] Animaciones suaves
- [ ] Sin errores en consola

---

## 🎨 CONSIDERACIONES DE DISEÑO

### Tipografía
- Mensaje de Lua: `font-medium text-base md:text-lg`
- Etiquetas: `font-bold text-xs uppercase`
- Métricas: `font-bold text-2xl`

### Espaciado
- Entre secciones: `space-y-3`
- Padding interno: `p-4` (desktop), `p-3` (mobile)
- Border radius: `rounded-xl` (secciones), `rounded-lg` (cards)

### Colores (Tailwind)
- Crisis: `red-600`, `red-50`
- Riesgo: `orange-600`, `orange-50`
- Oportunidad: `blue-600`, `blue-50`
- Éxito: `green-600`, `green-50`
- Neutral: `gray-600`, `gray-50`

### Animaciones
- Crisis: `animate-pulse`
- Riesgo: `animate-bounce` (suave)
- Loading: `animate-spin`
- Botones: `transition-all duration-200 ease-in-out`

---

## 🚀 ¡LISTO PARA CODIFICAR!

Este documento es la **biblia técnica** para implementar el dashboard.
Cada decisión está basada en el código existente y las capacidades reales del backend.

**Próximo paso:** Empezar a crear los hooks y componentes con calidad de producción.


