# 🤖 PROPUESTA: DASHBOARD "SOCIO VIRTUAL"
## El Jefe de Operaciones Digital para LA-IA

**Fecha**: 23 de Noviembre de 2025  
**Versión**: 1.0 - Propuesta Completa  
**Tiempo estimado de implementación**: 8-10 horas

---

## 📊 CONTEXTO

He realizado una **auditoría completa** de toda la aplicación:

- ✅ 76 migraciones SQL analizadas
- ✅ 20+ componentes React revisados
- ✅ 10+ servicios de backend estudiados
- ✅ Sistema de reservas, equipo, clientes, no-shows, comunicaciones, disponibilidad, Google Calendar: **TODO ENTENDIDO**

**Resultado**: La aplicación ya tiene **TODO lo necesario** para crear el Dashboard "Socio Virtual".

Ver documento completo: `AUDITORIA_COMPLETA_APLICACION_DASHBOARD.md`

---

## 🎯 EL CONCEPTO: "GESTIÓN POR EXCEPCIÓN"

### **Principio fundamental**:

> El Dashboard NO debe decirte lo que ya sabes.  
> Debe decirte lo que se sale de la norma.

### **Filosofía**:

```
Si todo va bien → Dame paz mental y motivación
Si algo va mal → Dame la solución en 1 clic
```

### **El usuario NO quiere**:
- ❌ Ver números ("tienes 12 citas")
- ❌ Analizar gráficos para encontrar problemas
- ❌ Ir a otra página para actuar

### **El usuario SÍ quiere**:
- ✅ Que alguien (Lua) le diga el problema crítico del momento
- ✅ Entender por qué es crítico en 1 frase
- ✅ Resolverlo en 1 click sin salir del dashboard

---

## 🏗️ ARQUITECTURA DEL DASHBOARD

### **Estructura Visual (3 Bloques)**

```
┌──────────────────────────────────────────────────────────────┐
│                    A. EL CEREBRO (40%)                       │
│                                                              │
│   [Avatar Lua]  🚨 Alerta Roja: Pol no viene hoy           │
│                    y tiene 3 citas esta mañana.              │
│                    Andrew está libre en esos horarios.       │
│                                                              │
│   [🔀 Mover citas a Andrew]  [🚫 Cancelar y reagendar]     │
├──────────────────────────────────────────────────────────────┤
│                    B. EL PULSO (40%)                         │
│                                                              │
│   ⏰ AHORA (10:00 - 11:00)                                  │
│                                                              │
│   Silla 1 (Culebra): ✂️ Juan Pérez (Corte) [NUEVO]       │
│   Silla 2 (Pol): 💆‍♀️ Ana García (Tinte) [VIP]            │
│   Box 3 (Andrew): 🟢 LIBRE [Bloquear hueco]                │
├──────────────────────────────────────────────────────────────┤
│                    C. LA SALUD (20%)                         │
│                                                              │
│   [15 Reservas Hoy] [78% Ocupación] [450€ Caja] [2 Alertas]│
└──────────────────────────────────────────────────────────────┘
```

---

## 🧠 LOS 4 ESCENARIOS INTELIGENTES

El backend analiza la situación del negocio en tiempo real y decide qué escenario mostrar.

### **Escenario 1: Crisis de Personal** 🔴🔴 (PRIORIDAD MÁXIMA)

**Cuándo se activa**:
- Un empleado está marcado como ausente (`employee_absences`)
- Tiene citas asignadas HOY que no están canceladas
- Las citas están en el futuro (no han pasado)

**Ejemplo visual**:

```
┌───────────────────────────────────────────────────────────┐
│  [Avatar Lua]                                             │
│                                                           │
│  🚨 Alerta Roja: Pol no viene hoy y tiene 3 citas       │
│  esta mañana. Andrew está libre en esos horarios.        │
│                                                           │
│  [🔀 Mover citas a Andrew y avisar]                      │
│  [🚫 Cancelar y pedir reagendar]                         │
└───────────────────────────────────────────────────────────┘
```

**Qué hace cada botón**:

1. **🔀 Mover citas a Andrew y avisar**:
   - Backend: Edge Function `transfer-appointments`
   - Actualiza `appointments.employee_id` a Andrew
   - Actualiza `appointments.resource_id` al recurso de Andrew
   - Envía WhatsApp a cada cliente: "Tu cita será atendida por Andrew"
   - Sincroniza cambios con Google Calendar

2. **🚫 Cancelar y pedir reagendar**:
   - Backend: Edge Function `cancel-appointments-batch`
   - Cambia `appointments.status` a `cancelled`
   - Envía WhatsApp: "Tu cita ha sido cancelada por motivo de fuerza mayor. ¿Podemos reagendar?"
   - Libera los `availability_slots`

**Detección** (SQL):
```sql
-- Ver función completa en AUDITORIA_COMPLETA_APLICACION_DASHBOARD.md
detect_employee_absences_with_appointments(business_id, timestamp)
```

---

### **Escenario 2: Riesgo de No-Show** 🔴 (ALTA PRIORIDAD)

**Cuándo se activa**:
- Una cita tiene `risk_score > 60` (calculado dinámicamente)
- El cliente NO ha confirmado en las últimas 24h
- La cita es en las próximas horas

**Factores del risk_score** (ya implementado en SQL):
```javascript
Historial del cliente:
  - >30% no-shows previos → +40 pts
  - 10-30% no-shows → +20 pts
  
Inactividad:
  - >6 meses sin visitar → +25 pts
  - >3 meses → +15 pts
  
Horario de riesgo:
  - Cita >= 21:00h → +15 pts
  
Tamaño de grupo:
  - >= 6 personas → +10 pts
  
Canal:
  - Teléfono/Manual → +10 pts
  - Online/Widget → 0 pts
  
Antelación:
  - Reserva <24h antes → +20 pts
  
Urgencia temporal:
  - <2h 15min sin confirmar → +50 pts 🔴🔴
  - <4h sin confirmar → +35 pts 🔴
  - <24h sin confirmar → +15 pts 🟡
  
Confirmaciones:
  - Confirmó rápido (<1h) → -30 pts 🟢
  - Confirmó a tiempo (1-6h) → -20 pts
  - No respondió 24h → +20 pts
```

**Ejemplo visual**:

```
┌───────────────────────────────────────────────────────────┐
│  [Avatar Lua]                                             │
│                                                           │
│  ⚠️ Ojo con las 17:00. Viene Carlos (tiene historial    │
│  de plantones) y no ha confirmado. ¿Quieres asegurar     │
│  el tiro?                                                 │
│                                                           │
│  [📞 Llamar ahora]                                        │
│  [💬 Enviar WhatsApp manual]                             │
└───────────────────────────────────────────────────────────┘
```

**Qué hace cada botón**:

1. **📞 Llamar ahora**:
   - Frontend: Abre el marcador del móvil con el número del cliente
   - JavaScript: `window.location.href = 'tel:+34612345678'`

2. **💬 Enviar WhatsApp manual**:
   - Frontend: Abre WhatsApp Web con mensaje pre-rellenado
   - JavaScript: `window.open('https://wa.me/34612345678?text=Hola%20Carlos...')`
   - Mensaje sugerido: "Hola Carlos, ¿sigues viniendo? Tengo lista de espera."

**Detección** (SQL):
```sql
get_high_risk_appointments(business_id, timestamp)
-- Usa función calculate_dynamic_risk_score() ya implementada
```

---

### **Escenario 3: Hueco Muerto** 💰 (MEDIA PRIORIDAD)

**Cuándo se activa**:
- Hay slots libres (`availability_slots.status = 'free'`) en las próximas 2 horas
- NO hay escenarios de mayor prioridad activos

**Ejemplo visual**:

```
┌───────────────────────────────────────────────────────────┐
│  [Avatar Lua]                                             │
│                                                           │
│  💰 Se ha quedado libre el hueco de las 12:00.           │
│  Es dinero perdido. ¿Quieres que te redacte una          │
│  oferta para tus Estados de WhatsApp?                     │
│                                                           │
│  [✨ Generar Texto Oferta]                                │
└───────────────────────────────────────────────────────────┘
```

**Qué hace el botón**:

1. **✨ Generar Texto Oferta**:
   - Backend: Edge Function `generate-flash-offer-text`
   - Llama a OpenAI GPT-4o-mini con prompt:
     ```
     Eres un experto en marketing para [vertical_type].
     Genera un texto de máximo 120 caracteres para WhatsApp Status
     anunciando un hueco disponible con descuento flash.
     
     Detalles:
     - Horario: 12:00
     - Servicio: Corte de pelo
     - Descuento: 15%
     - Tono: Urgente pero amigable
     - Emojis: Sí, relevantes al vertical
     ```
   - Frontend: Copia el texto al portapapeles
   - Muestra toast: "Texto copiado. Pégalo en tu Estado de WhatsApp"

**Ejemplo de texto generado**:
```
¡Hueco Flash! Corte de pelo a las 12:00 con 15% dto. Solo hoy. DM para reservar 💈✂️
```

**Detección** (SQL):
```sql
get_upcoming_free_slots(business_id, timestamp, 2) -- próximas 2 horas
```

**⚠️ NOTA IMPORTANTE**:
NO enviamos campaña masiva (peligroso legalmente).
Solo le damos munición al dueño para que él lo publique en sus redes.

---

### **Escenario 4: Palmada en la Espalda** 👏 (BAJA PRIORIDAD)

**Cuándo se activa**:
- NO hay crisis de personal
- NO hay alertas de no-shows con risk_score > 60
- NO hay huecos libres críticos en próximas 2h
- O simplemente todo va bien

**Ejemplo visual**:

```
┌───────────────────────────────────────────────────────────┐
│  [Avatar Lua]                                             │
│                                                           │
│  👏 La maquinaria está perfecta. Llevas 450€ hoy         │
│  y cero retrasos. Tu próxima rotación es a las 11:00.    │
│                                                           │
│  [📅 Ver agenda de mañana]                                │
│  [💰 Ver desglose de caja]                               │
└───────────────────────────────────────────────────────────┘
```

**Qué hace cada botón**:

1. **📅 Ver agenda de mañana**:
   - Frontend: Navega a `/reservas?date=tomorrow`

2. **💰 Ver desglose de caja**:
   - Frontend: Abre modal con desglose por servicio/empleado

**Detección** (lógica):
```javascript
if (no hay crisis && no hay alertas && no hay huecos críticos) {
  return ESCENARIO_4;
}
```

---

## 🎛️ WIDGET "TURNOS EN VIVO" (El Pulso)

### **Propósito**:
Mostrar quién está atendiendo a quién **AHORA MISMO** en formato multi-carril.

### **Diseño**:

```
┌──────────────────────────────────────────────────────────┐
│  ⏰ AHORA (10:00 - 11:00)                                │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Silla 1 (Culebra)                                  │ │
│  │ ✂️ Juan Pérez (Corte)                    [NUEVO]  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Silla 2 (Pol)                                      │ │
│  │ 💆‍♀️ Ana García (Tinte)                      [VIP]  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Box 3 (Andrew)                                     │ │
│  │ 🟢 LIBRE              [Bloquear hueco]            │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### **Etiquetas inteligentes**:

| Etiqueta | Condición | Color | Valor de negocio |
|----------|-----------|-------|------------------|
| `[NUEVO]` | `customer.crm_segment = 'nuevo'` | Verde | Trátale diferente, vende experiencia |
| `[VIP]` | `customer.crm_segment = 'vip'` | Púrpura | Dale prioridad, pide reseña |
| `[⚠️ RIESGO]` | `customer.no_show_count > 1` | Rojo | Vigila que no se vaya antes de pagar |

### **Lógica de Query**:

```javascript
// Obtener citas que están ocurriendo AHORA
const { data: currentAppointments } = await supabase
  .from('appointments')
  .select(`
    *,
    employee:employees(id, name),
    resource:resources(id, name),
    customer:customers(id, name, crm_segment, no_show_count),
    service:business_services(name, category)
  `)
  .eq('business_id', businessId)
  .eq('appointment_date', today)
  .lte('appointment_time', now) // Empezó antes o ahora
  .gte('end_time', now) // Termina después o ahora
  .not('status', 'in', '(cancelled, no_show)');
```

### **Refresh**:
- Automático cada 30 segundos
- Manual con botón "Actualizar"

---

## 🎨 DISEÑO Y UX

### **Principios de diseño**:

1. **Jerarquía visual clara**:
   - Lo más urgente arriba (Avatar Lua)
   - Lo operativo en medio (Turnos en Vivo)
   - Las métricas abajo (KPIs)

2. **Colores por prioridad**:
   - 🔴 Rojo: Crisis/Crítico
   - 🟠 Naranja: Alerta/Riesgo Alto
   - 🟡 Amarillo: Advertencia/Riesgo Medio
   - 🟢 Verde: Todo bien/Motivación

3. **Botones de acción destacados**:
   - Siempre visibles
   - Texto claro de acción ("Mover citas", NO "Ver más")
   - Iconos que refuerzan el mensaje

4. **Responsive**:
   - En móvil: Bloquesapilados verticalmente
   - En desktop: Grilla de 3 columnas

### **Avatar Lua**:

**Mantenemos la proporción actual** (según tu petición):
- Tamaño: 24-32 w/h en desktop, 16-24 en móvil
- Forma: Circular
- Posición: A la izquierda del bocadillo
- Avatar: Desde `businesses.settings.agent.avatar_url`

**Bocadillo**:
- Fondo: Color según prioridad del escenario
- Border: 2px, color más oscuro que el fondo
- Padding: 16px
- Border-radius: 12px

---

## 🔧 STACK TÉCNICO

### **Backend**:

#### **Edge Functions (Supabase)**:
```typescript
// supabase/functions/get-snapshot/index.ts
export async function getSnapshot(businessId: string, timestamp: string) {
  // 1. Detectar crisis de personal
  const employeeConflicts = await detectEmployeeAbsencesWithAppointments(businessId, timestamp);
  if (employeeConflicts.length > 0) {
    return buildCrisisPersonalScenario(employeeConflicts[0]);
  }
  
  // 2. Detectar riesgo de no-show
  const highRiskAppointments = await getHighRiskAppointments(businessId, timestamp);
  if (highRiskAppointments.length > 0) {
    return buildRiesgoNoShowScenario(highRiskAppointments[0]);
  }
  
  // 3. Detectar hueco muerto
  const upcomingFreeSlots = await getUpcomingFreeSlots(businessId, timestamp, 2);
  if (upcomingFreeSlots.length > 0) {
    return buildHuecoMuertoScenario(upcomingFreeSlots[0]);
  }
  
  // 4. Todo va bien
  return buildPalmadaEspaldaScenario(businessId, timestamp);
}
```

#### **Funciones SQL** (PostgreSQL):
```sql
-- Ver implementación completa en AUDITORIA_COMPLETA_APLICACION_DASHBOARD.md

1. detect_employee_absences_with_appointments(business_id, timestamp)
   → Devuelve empleados ausentes con citas asignadas

2. get_high_risk_appointments(business_id, timestamp)
   → Devuelve citas con risk_score > 60

3. get_upcoming_free_slots(business_id, timestamp, hours_ahead)
   → Devuelve slots libres en próximas X horas

4. calculate_dynamic_risk_score(appointment_id)
   → Calcula risk score 0-100 (YA EXISTE)
```

### **Frontend**:

#### **Componentes React**:
```
src/components/dashboard/
  ├── LuaAvatar.jsx          (NUEVO) - Avatar con bocadillo inteligente
  ├── LiveTurnsWidget.jsx    (NUEVO) - Vista multi-carril de turnos
  ├── MagicActionButton.jsx  (NUEVO) - Botón que ejecuta acción mágica
  └── DashboardMetrics.jsx   (EXISTENTE) - KPIs actuales (mantener)
```

#### **Hooks personalizados**:
```javascript
// src/hooks/useDashboardSnapshot.js
export function useDashboardSnapshot(businessId) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const loadSnapshot = useCallback(async () => {
    // Llamar a Edge Function get-snapshot
  }, [businessId]);
  
  useEffect(() => {
    loadSnapshot();
    const interval = setInterval(loadSnapshot, 60000); // Cada 1 min
    return () => clearInterval(interval);
  }, [businessId]);
  
  return { snapshot, loading, refresh: loadSnapshot };
}
```

### **Integraciones Externas**:

1. **OpenAI API** (para generar textos de ofertas):
   - Endpoint: `https://api.openai.com/v1/chat/completions`
   - Modelo: `gpt-4o-mini`
   - Costo: ~$0.0001 por oferta generada

2. **WhatsApp API** (ya integrado con Twilio):
   - Reutilizar función existente `sendWhatsAppMessage()`
   - Usada por botón "Mover citas a Andrew"

---

## 📊 MÉTRICAS DE ÉXITO

### **KPIs para medir impacto**:

1. **Tiempo de resolución de crisis**:
   - Antes: Usuario va a Equipo → ve ausencia → va a Reservas → mueve cita manualmente → envía WhatsApp manual
   - Después: 1 click en "Mover citas a Andrew"
   - **Target**: Reducir de 5 minutos a 30 segundos

2. **Prevención de no-shows**:
   - Antes: No hay alertas proactivas
   - Después: Sistema alerta cuando risk_score > 60
   - **Target**: Reducir no-shows en 30%

3. **Aprovechamiento de huecos**:
   - Antes: Huecos libres pasan desapercibidos
   - Después: Sistema genera oferta flash automática
   - **Target**: Llenar 20% más de huecos de última hora

4. **Satisfacción del usuario**:
   - Encuesta NPS después de 1 semana de uso
   - **Target**: NPS > 8/10

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Backend Intelligence** (4 horas)

**Tareas**:
1. ✅ Crear migración SQL con funciones auxiliares:
   - `detect_employee_absences_with_appointments()`
   - `get_high_risk_appointments()`
   - `get_upcoming_free_slots()`

2. ✅ Crear Edge Function `get-snapshot`:
   - Implementar lógica de priorización
   - Conectar con funciones SQL
   - Generar mensajes contextuales

3. ✅ Crear Edge Functions de acción:
   - `transfer-appointments`
   - `cancel-appointments-batch`
   - `generate-flash-offer-text`

**Criterio de éxito**:
- Llamada a `get-snapshot` devuelve escenario correcto
- Llamada a `transfer-appointments` mueve citas y envía WhatsApp
- Llamada a `generate-flash-offer-text` genera texto coherente

---

### **Fase 2: Frontend Widgets** (3-4 horas)

**Tareas**:
1. ✅ Crear componente `LuaAvatar.jsx`:
   - Hook `useDashboardSnapshot` que llama a `get-snapshot` cada 1 min
   - Renderizar bocadillo con color según prioridad
   - Renderizar botones de acción
   - Ejecutar acciones al hacer clic

2. ✅ Crear componente `LiveTurnsWidget.jsx`:
   - Hook `useCurrentTurns` que obtiene citas actuales cada 30s
   - Renderizar vista multi-carril
   - Mostrar etiquetas inteligentes (NUEVO, VIP, RIESGO)
   - Botón "Bloquear hueco" en recursos libres

3. ✅ Modificar `DashboardAgente.jsx`:
   - Integrar `LuaAvatar` en bloque A (parte superior)
   - Integrar `LiveTurnsWidget` en bloque B (centro)
   - Mantener métricas existentes en bloque C (inferior)

**Criterio de éxito**:
- Dashboard muestra escenario crítico actual en <3 segundos
- Botones de acción funcionan sin recargar página
- Widget de turnos se actualiza automáticamente cada 30s

---

### **Fase 3: Testing y Refinamiento** (2 horas)

**Tareas**:
1. ✅ Crear datos de prueba:
   ```sql
   -- Crisis de personal
   INSERT INTO employee_absences (employee_id, absence_type, start_date, end_date)
   VALUES ('pol-uuid', 'sick_leave', CURRENT_DATE, CURRENT_DATE);
   
   INSERT INTO appointments (employee_id, appointment_date, appointment_time, ...)
   VALUES ('pol-uuid', CURRENT_DATE, '11:00', ...);
   ```

2. ✅ Probar cada escenario:
   - Escenario 1: Crear ausencia + citas asignadas → Verificar alerta roja
   - Escenario 2: Crear cliente con no_show_count > 1 + cita sin confirmar → Verificar alerta naranja
   - Escenario 3: Dejar slot libre en próximas 2h → Verificar oferta flash
   - Escenario 4: Todo limpio → Verificar palmada en espalda

3. ✅ Ajustar textos según feedback:
   - Mensajes de Lua más naturales
   - Labels de botones más claros
   - Colores de bocadillo más sutiles

**Criterio de éxito**:
- Todos los escenarios se detectan correctamente
- Acciones se ejecutan sin errores
- UX es fluida y sin confusión

---

### **Fase 4: Documentación y Deploy** (1 hora)

**Tareas**:
1. ✅ Documentar en README:
   - Cómo funciona el sistema de escenarios
   - Cómo añadir nuevos escenarios
   - Cómo personalizar mensajes de Lua

2. ✅ Deploy:
   - Ejecutar migración SQL en Supabase
   - Desplegar Edge Functions
   - Desplegar frontend a Vercel

**Criterio de éxito**:
- Dashboard nuevo es la ruta por defecto (`/`)
- Dashboard antiguo sigue disponible en `/dashboard-legacy` (backup)

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### **Base de Datos**:
- [ ] Migración SQL con funciones auxiliares ejecutada en Supabase
- [ ] Función `calculate_dynamic_risk_score()` validada (ya existe)
- [ ] Tabla `customer_confirmations` confirmada (ya existe)
- [ ] Tabla `employee_absences` confirmada (ya existe)

### **Backend (Edge Functions)**:
- [ ] `get-snapshot` desplegada y probada
- [ ] `transfer-appointments` desplegada y probada
- [ ] `cancel-appointments-batch` desplegada y probada
- [ ] `generate-flash-offer-text` desplegada y probada
- [ ] OpenAI API key configurada en Supabase secrets

### **Frontend**:
- [ ] Componente `LuaAvatar` creado y funcional
- [ ] Componente `LiveTurnsWidget` creado y funcional
- [ ] Componente `MagicActionButton` creado y funcional
- [ ] `DashboardAgente.jsx` actualizado con nuevos widgets
- [ ] Hook `useDashboardSnapshot` implementado
- [ ] Hook `useCurrentTurns` implementado

### **Testing**:
- [ ] Escenario 1 (Crisis Personal) detectado y resuelto
- [ ] Escenario 2 (Riesgo No-Show) detectado y alertado
- [ ] Escenario 3 (Hueco Muerto) detectado y oferta generada
- [ ] Escenario 4 (Todo Bien) muestra motivación
- [ ] Acciones mágicas funcionan en 1 click
- [ ] Widget de turnos muestra etiquetas correctas
- [ ] Refresh automático funciona

### **Deploy**:
- [ ] Edge Functions desplegadas en Supabase
- [ ] Frontend desplegado en Vercel
- [ ] Migración SQL ejecutada en producción
- [ ] Dashboard nuevo es la ruta por defecto
- [ ] Dashboard antiguo disponible en `/dashboard-legacy`

---

## 💰 VALOR DEL ESFUERZO

### **Comparación con la competencia**:

| Herramienta | Dashboard | Alertas proactivas | Acciones 1-click | Precio/mes |
|-------------|-----------|-------------------|------------------|------------|
| **Booksy** | ✅ Informativo | ❌ Solo notificaciones | ❌ No | 29€ |
| **Treatwell** | ✅ Informativo | ❌ Solo notificaciones | ❌ No | 39€ |
| **Fresha** | ✅ Informativo | ⚠️ Alertas básicas | ❌ No | 0€ (comisión) |
| **LA-IA (actual)** | ✅ Informativo | ⚠️ Listas básicas | ❌ No | - |
| **LA-IA (nuevo)** | ✅ Operativo | ✅ Inteligencia contextual | ✅ Sí | - |

### **Factor diferenciador**:

> LA-IA deja de ser "una agenda digital" y se convierte en **"el encargado que vigila mi negocio"**.

### **Casos de uso reales**:

1. **Lunes 10:00 AM**:
   - Usuario abre LA-IA
   - Ve: "🚨 Pol está enfermo y tiene 3 citas"
   - Click: "Mover a Andrew"
   - **Resultado**: Crisis resuelta en 30 segundos

2. **Martes 16:00 PM**:
   - Usuario abre LA-IA
   - Ve: "⚠️ Carlos (2 plantones) no confirmó cita de las 18:00"
   - Click: "Llamar ahora"
   - **Resultado**: Llamada hecha, cliente confirma

3. **Miércoles 11:00 AM**:
   - Usuario abre LA-IA
   - Ve: "💰 Hueco libre a las 12:00"
   - Click: "Generar oferta"
   - Copia texto, publica en WhatsApp Status
   - **Resultado**: 2 clientes reservan el hueco

4. **Jueves 09:00 AM**:
   - Usuario abre LA-IA
   - Ve: "👏 Todo perfecto. Llevas 380€ hoy"
   - **Resultado**: Paz mental, motivación

---

## 🎯 CONCLUSIÓN

### **¿Por qué vale la pena esta semana extra?**

Porque el dashboard actual es **informativo**.  
El dashboard nuevo es **operativo**.

La diferencia es como:
- Ver el marcador del partido vs. Jugar el partido
- Leer un informe médico vs. Recibir tratamiento
- Mirar un mapa vs. Tener GPS con navegación

### **El "WOW" Factor**:

Usuario abre la app y en **5 segundos**:
1. Ve el problema más crítico (si lo hay)
2. Entiende por qué es crítico
3. Tiene la solución en 1 click

**Eso NO lo hace ninguna otra herramienta del mercado.**

### **Próximo paso**:

Si estás de acuerdo con esta propuesta, podemos empezar con:

**Fase 1: Backend Intelligence** (4 horas)
- Crear funciones SQL auxiliares
- Crear Edge Function `get-snapshot`
- Crear Edge Functions de acción

**¿Empezamos? 🚀**

---

**FIN DE LA PROPUESTA**

Este documento es la hoja de ruta completa para implementar el Dashboard "Socio Virtual".

**Archivos relacionados**:
- `AUDITORIA_COMPLETA_APLICACION_DASHBOARD.md` - Análisis técnico detallado
- `NOTAS_MIGRACION_NOSHOWS.md` - Estado del sistema de no-shows
- `ANALISIS_WORKFLOW_N8N_NOSHOWS.md` - Integración con workflows

**Tiempo estimado total**: 8-10 horas  
**Impacto esperado**: 🚀 Game Changer


