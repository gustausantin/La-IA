# 🎯 SISTEMA CRM: SEGMENTACIÓN INTELIGENTE POR VERTICAL

**Fecha:** 2025-11-11  
**Estado:** ✅ IMPLEMENTADO  
**Versión:** 1.0

---

## 📋 **ÍNDICE**

1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Parámetros por Vertical](#parámetros-por-vertical)
4. [Reglas de Segmentación](#reglas-de-segmentación)
5. [Acciones y Tonos](#acciones-y-tonos)
6. [Personal Cadence](#personal-cadence)
7. [Implementación Técnica](#implementación-técnica)
8. [Uso en Frontend](#uso-en-frontend)
9. [Roadmap](#roadmap)

---

## 🎯 **VISIÓN GENERAL**

### **¿Qué es?**

Un sistema de **segmentación automática de clientes** que adapta sus reglas según el **tipo de negocio** (vertical).

### **¿Por qué?**

Cada negocio tiene ciclos de visita diferentes:
- **Peluquería:** Clientes cada 42 días
- **Dental:** Clientes cada 365 días (anual)
- **Entrenador Personal:** Clientes cada 7 días

**NO podemos usar las mismas reglas para todos.**

### **¿Cómo funciona?**

```
1. Onboarding → Negocio elige su vertical (peluqueria_barberia, clinica_dental, etc.)
2. Sistema carga parámetros del vertical desde Supabase
3. Frontend/Backend calcula segmentos usando esos parámetros
4. Cada cliente se clasifica en: VIP, Nuevo, Inactivo, En Riesgo, Ocasional, Regular
5. Sistema propone acciones personalizadas según vertical y segmento
```

---

## 🏗️ **ARQUITECTURA**

### **3 Capas:**

```
┌─────────────────────────────────────────────┐
│ CAPA 1: PARÁMETROS POR VERTICAL             │
│ - cycle_days, risk_min_days, etc.           │
│ - 10 verticales predefinidos                │
│ - Tabla: crm_vertical_parameters            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ CAPA 2: REGLAS DE SEGMENTACIÓN UNIVERSALES  │
│ - VIP: spend >= X OR visits >= Y            │
│ - Nuevo: lifetime_visits <= 2 AND < 90 days │
│ - Inactivo, En Riesgo, Regular, Ocasional   │
│ - Tabla: crm_segment_rules                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ CAPA 3: ACCIONES Y TONOS PERSONALIZADOS     │
│ - Mensajes automáticos según vertical       │
│ - Tono adaptado (Colega vs Profesional)     │
│ - Tabla: crm_actions_by_vertical            │
└─────────────────────────────────────────────┘
```

---

## 📊 **PARÁMETROS POR VERTICAL**

### **Tabla: `crm_vertical_parameters`**

| vertical_id | cycle_days | risk_min_days | inactive_days | vip_min_visits_12m | vip_min_spend_12m |
|------------|------------|---------------|---------------|-------------------|-------------------|
| peluqueria_barberia | 42 | 56 | 98 | 10 | 500€ |
| centro_unas | 21 | 24 | 60 | 15 | 400€ |
| entrenador_personal | 7 | 14 | 45 | 50 | 1500€ |
| yoga_pilates | 7 | 21 | 60 | 50 | 1200€ |
| fisioterapia | 30 | 45 | 180 | 12 | 600€ |
| masajes_osteopatia | 28 | 35 | 120 | 12 | 600€ |
| psicologia_coaching | 7 | 21 | 90 | 20 | 1200€ |
| centro_estetica | 42 | 56 | 180 | 8 | 700€ |
| clinica_dental | 365 | 335 | 540 | 3 | 800€ |
| veterinario | 365 | 365 | 540 | 3 | 600€ |

### **Descripción de Parámetros:**

- **`cycle_days`:** Días esperados entre visitas (ciclo natural del cliente)
- **`risk_min_days`:** Días sin visita para considerarse "En Riesgo"
- **`inactive_days`:** Días sin visita para considerarse "Inactivo"
- **`vip_min_visits_12m`:** Visitas mínimas en 12 meses para ser VIP
- **`vip_min_spend_12m`:** Gasto mínimo en 12 meses para ser VIP (condición OR)
- **`lookback_months`:** Meses hacia atrás para analizar métricas (default: 12)

---

## 🎯 **REGLAS DE SEGMENTACIÓN**

### **5 Segmentos (Prioridad de Evaluación):**

```javascript
// PRIORIDAD 1: VIP (siempre gana, incluso si está inactivo)
if (spend_12m >= vip_min_spend OR visits_12m >= vip_min_visits) {
  return 'vip';
}

// PRIORIDAD 2: NUEVO (1-2 visitas en últimos 90 días)
if (lifetime_visits <= 2 AND days_since_first_visit <= 90) {
  return 'nuevo';
}

// PRIORIDAD 3: INACTIVO
if (last_visit_days > inactive_threshold) {
  return 'inactivo';
}

// PRIORIDAD 4: EN RIESGO
if (last_visit_days > risk_threshold) {
  return 'en_riesgo';
}

// PRIORIDAD 5 (DEFAULT): REGULAR
return 'regular';
```

### **Personal Cadence (Opcional):**

Si el cliente tiene suficiente historial (≥2 visitas), calculamos su **cadencia personal**:

```javascript
personal_cadence = mediana(últimos 3 intervalos entre visitas)

risk_threshold = personal_cadence * 1.5
inactive_threshold = personal_cadence * 2.5
```

**Si NO hay suficiente historial, usamos los parámetros del vertical.**

---

## 💬 **ACCIONES Y TONOS**

### **Tabla: `crm_actions_by_vertical`**

Cada vertical tiene acciones personalizadas por segmento y trigger.

#### **Ejemplo: Peluquería - Cliente "En Riesgo"**

```json
{
  "vertical_id": "peluqueria_barberia",
  "segment": "en_riesgo",
  "trigger": "al_activar_regla",
  "action_type": "auto",
  "action_text": "¡[Cliente]! Soy [ASSISTANT_NAME]. Han pasado [X] días... ese flow tiene que estar perdiéndose ;) ¿Te busco hueco?",
  "offer": null,
  "tone": "Seductor / Colega"
}
```

#### **Ejemplo: Psicología - Cliente "En Riesgo"**

```json
{
  "vertical_id": "psicologia_coaching",
  "segment": "en_riesgo",
  "trigger": "al_activar_regla",
  "action_type": "auto",
  "action_text": "Hola [Cliente], soy [ASSISTANT_NAME]. Han pasado [X] días desde nuestra última sesión. Solo quería recordarte que tu espacio aquí sigue disponible. Sin presiones. Un saludo.",
  "offer": null,
  "tone": "Muy suave / Respetuoso"
}
```

### **Tipos de Acciones:**

- **`auto`:** Se envía automáticamente (WhatsApp, email)
- **`proposal`:** LA-IA lo propone, el dueño lo aprueba
- **`notification`:** Solo notifica al dueño

### **Triggers:**

- **`cliente_contacta`:** Cliente llama o escribe
- **`24h_tras_visita`:** 24h después de completar una cita
- **`al_activar_regla`:** Cuando el cliente entra en ese segmento

### **Variables Dinámicas:**

- `[Cliente]` → Nombre del cliente
- `[ASSISTANT_NAME]` → Nombre del asistente IA
- `[Negocio]` → Nombre del negocio
- `[Servicio Favorito]` → Servicio más reservado
- `[X]` → Días sin visita
- `[Mascota]` → Nombre de la mascota (veterinario)
- `[molestia]` → Motivo de consulta (fisio)
- `[Hora VIP]` → Hora prioritaria guardada

---

## 🧠 **PERSONAL CADENCE**

### **¿Qué es?**

La **cadencia personal** es el **ritmo natural** con el que un cliente específico viene al negocio.

### **¿Cómo se calcula?**

```sql
-- Obtener los últimos 4 appointment_date
-- Calcular los 3 intervalos entre ellos
-- Retornar la MEDIANA de esos 3 intervalos
```

### **Ejemplo:**

```
Cliente Juan:
- Visita 1: 01/01/2025
- Visita 2: 20/01/2025 → Intervalo: 19 días
- Visita 3: 15/02/2025 → Intervalo: 26 días
- Visita 4: 05/03/2025 → Intervalo: 18 días

Intervalos: [19, 26, 18]
Ordenados: [18, 19, 26]
Mediana: 19 días ← Personal Cadence de Juan

→ Risk Threshold: 19 * 1.5 = 28.5 días
→ Inactive Threshold: 19 * 2.5 = 47.5 días
```

### **Ventajas:**

✅ Más preciso que promedios genéricos  
✅ Se adapta a cada cliente individual  
✅ Usa mediana (resistente a outliers)  
✅ Fallback automático si no hay datos suficientes

---

## 💻 **IMPLEMENTACIÓN TÉCNICA**

### **1. Tablas Supabase**

```sql
-- Parámetros por vertical
crm_vertical_parameters

-- Reglas universales
crm_segment_rules

-- Acciones personalizadas
crm_actions_by_vertical

-- Overrides por negocio (opcional)
crm_business_overrides
```

### **2. Funciones SQL**

```sql
-- Calcular cadencia personal de un cliente
calculate_personal_cadence(customer_id UUID) → INT

-- Calcular segmento de un cliente
calculate_customer_segment(customer_id UUID, business_id UUID) → VARCHAR(50)
```

### **3. Frontend (React)**

```javascript
// En AuthContext o hook dedicado
const loadVerticalParams = async () => {
  const { data } = await supabase
    .from('crm_vertical_parameters')
    .select('*')
    .eq('vertical_id', business.vertical_type)
    .single();
  
  setVerticalParams(data);
};

// En Clientes.jsx
const calculateSegment = (customer) => {
  const visitsCount = customer.total_visits || 0;
  const spend12m = customer.spend_12m || 0;
  const daysSinceLastVisit = customer.days_since_last_visit || 999;
  
  // Aplicar reglas usando verticalParams...
  if (spend12m >= verticalParams.vip_min_spend_12m || 
      visits12m >= verticalParams.vip_min_visits_12m) {
    return 'vip';
  }
  // ... resto de reglas
};
```

---

## 🚀 **USO EN FRONTEND**

### **Página Clientes:**

```jsx
// Cargar parámetros del vertical al montar
useEffect(() => {
  loadVerticalParams();
}, [businessId]);

// Calcular segmento en tiempo real para cada cliente
const clientesConSegmento = clientes.map(cliente => ({
  ...cliente,
  segment: calculateSegment(cliente, verticalParams)
}));

// Filtrar por segmento
<button onClick={() => setFilter('vip')}>
  VIP ({clientes.filter(c => c.segment === 'vip').length})
</button>
```

### **Sistema de Comunicación (Voz/WhatsApp):**

```javascript
// Cuando el cliente contacta
const cliente = await getCustomerByPhone(phone);
const segment = await calculateSegment(cliente.id, businessId);

// Cargar acción del vertical
const action = await supabase
  .from('crm_actions_by_vertical')
  .select('action_text, tone')
  .eq('vertical_id', business.vertical_type)
  .eq('segment', segment)
  .eq('trigger', 'cliente_contacta')
  .single();

// Usar el tono y mensaje en la respuesta de la IA
const prompt = `
  Eres ${assistantName}.
  Cliente: ${cliente.name} (Segmento: ${segment}).
  Tono: ${action.tone}.
  Mensaje base: ${action.action_text}.
  
  Responde al cliente de manera natural.
`;
```

---

## 🗺️ **ROADMAP**

### **✅ Fase 1: CORE (COMPLETADO)**
- [x] Crear tablas en Supabase
- [x] Insertar 10 verticales con parámetros
- [x] Insertar reglas de segmentación
- [x] Insertar 80+ acciones personalizadas
- [x] Función SQL `calculate_personal_cadence()`
- [x] Función SQL `calculate_customer_segment()`
- [x] RLS policies

### **🚧 Fase 2: FRONTEND (EN PROGRESO)**
- [ ] Modificar `Clientes.jsx` para usar nuevo sistema
- [ ] Cargar parámetros del vertical en AuthContext
- [ ] Calcular segmentos en tiempo real
- [ ] Actualizar filtros y visualización
- [ ] Añadir segmentos: `vip_inactivo`, `ocasional`

### **📅 Fase 3: AUTOMATIZACIÓN**
- [ ] Trigger en `appointments` para actualizar métricas de cliente
- [ ] Columna `segment_auto` calculada automáticamente
- [ ] N8N: Workflow de campañas automáticas
- [ ] N8N: Envío de mensajes según triggers
- [ ] N8N: Notificaciones proactivas al dueño

### **🎯 Fase 4: AVANZADO**
- [ ] UI para editar overrides por negocio
- [ ] Histórico de cambios de segmento
- [ ] Dashboard de salud de CRM
- [ ] Predicción de churn con ML
- [ ] A/B testing de mensajes
- [ ] Integración con sistema de voz (tono dinámico)

---

## 📊 **EJEMPLOS REALES**

### **Caso 1: Peluquería "El Corte Perfecto"**

**Negocio:** `peluqueria_barberia`  
**Cliente:** María (30 años)

**Histórico:**
- 15 visitas en los últimos 12 meses
- Gasto total: 450€
- Última visita: Hace 20 días
- Personal Cadence: 24 días (mediana de sus visitas)

**Segmento:** `regular` (no VIP porque no alcanza 500€, no en riesgo porque 20 < 24*1.5)

**Acción cuando contacta:**
```
¡Hola María! ¡Qué bien tenerte de vuelta! ¿Vienes para tu Corte + Tinte de siempre?
```

---

### **Caso 2: Clínica Dental "Sonrisas Sanas"**

**Negocio:** `clinica_dental`  
**Cliente:** Carlos (45 años)

**Histórico:**
- 3 visitas en los últimos 13 meses
- Gasto total: 1200€
- Última visita: Hace 350 días

**Segmento:** `vip_inactivo` (es VIP por gasto, pero inactivo porque 350 > 335)

**Acción automática (al activar regla):**
```
Campaña "Sonrisa Sana".
Sabemos que ha pasado tiempo. Vuelve y te hacemos la Revisión + Limpieza a un precio especial.
```

---

### **Caso 3: Entrenador Personal "FitLife"**

**Negocio:** `entrenador_personal`  
**Cliente:** Laura (28 años)

**Histórico:**
- 55 visitas en los últimos 12 meses
- Gasto total: 1800€
- Última visita: Ayer

**Segmento:** `vip` (55 >= 50 visitas)

**Acción cuando contacta:**
```
¡Laura! Eres una campeona. ¿Buscamos tu próxima sesión?
```

---

## 🎓 **CONCLUSIÓN**

Este sistema permite:

✅ **Segmentación automática** sin intervención manual  
✅ **Adaptación por vertical** (cada negocio es diferente)  
✅ **Personalización avanzada** (Personal Cadence)  
✅ **Tonos contextuales** (formal vs colega)  
✅ **Escalabilidad** (nuevos verticales fácil de añadir)  
✅ **Acciones proactivas** (recuperación de clientes)  
✅ **Sin dependencia de N8N** (todo en Supabase + Frontend)

---

**🚀 Próximo paso:** Modificar `Clientes.jsx` para usar este sistema.

---

**Autor:** LA-IA Team  
**Última actualización:** 2025-11-11

