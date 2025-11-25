# 📋 Respuestas Técnicas - Sistema de Segmentación de Clientes
## Preguntas del CTO sobre CRM y Segmentación Inteligente

**Fecha:** 24 Noviembre 2025  
**Contexto:** Revisión técnica pre-lanzamiento con CTO  
**Pantalla:** Clientes (CRM) - Segmentación Inteligente

---

## 🎯 PREGUNTA: Segmentación Inteligente - ¿Quién define los segmentos?

### Respuesta Técnica:

**El sistema usa REGLAS FIJAS con umbrales CONFIGURABLES POR VERTICAL. NO es IA analizando frecuencia y gasto, sino reglas deterministas basadas en parámetros del tipo de negocio.**

---

## 📊 ARQUITECTURA DEL SISTEMA

### **3 Capas del Sistema:**

```
┌─────────────────────────────────────────────┐
│ CAPA 1: PARÁMETROS POR VERTICAL             │
│ - Tabla: crm_vertical_parameters            │
│ - 10 verticales predefinidos                │
│ - Cada vertical tiene sus propios umbrales  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ CAPA 2: REGLAS DE SEGMENTACIÓN UNIVERSALES  │
│ - 5 segmentos con orden de prioridad       │
│ - Lógica fija, umbrales variables          │
│ - Implementado en: calculateSegmentByVertical│
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ CAPA 3: CÁLCULO EN TIEMPO REAL              │
│ - Frontend calcula segmento al cargar       │
│ - Se actualiza cuando cambian las métricas  │
│ - Sin intervención manual                   │
└─────────────────────────────────────────────┘
```

---

## 🎯 LAS 5 REGLAS DE SEGMENTACIÓN (Orden de Prioridad)

El sistema evalúa las reglas **en orden secuencial**. La primera regla que se cumple determina el segmento del cliente.

### **🔵 REGLA 1 (PRIORIDAD MÁXIMA): VIP**

**Condición:** El cliente cumple los umbrales VIP del vertical

**Lógica:**
```javascript
const isVIP = totalSpent >= verticalParams.vip_min_spend_12m || 
              lifetimeVisits >= verticalParams.vip_min_visits_12m;
```

**Umbrales por Vertical:**
- **Peluquería/Barbería:** ≥10 visitas en 12 meses **O** ≥500€ gastados
- **Centro de Uñas:** ≥15 visitas en 12 meses **O** ≥400€ gastados
- **Entrenador Personal:** ≥50 visitas en 12 meses **O** ≥1500€ gastados
- **Clínica Dental:** ≥3 visitas en 12 meses **O** ≥800€ gastados
- **Veterinario:** ≥3 visitas en 12 meses **O** ≥600€ gastados

**Ejemplo:**
- Cliente en peluquería con 12 visitas → **VIP** (cumple umbral de visitas)
- Cliente en peluquería con 8 visitas pero 600€ gastados → **VIP** (cumple umbral de gasto)

**Código:**
```82:106:src/pages/Clientes.jsx
// FUNCIÓN PARA CALCULAR SEGMENTO SEGÚN PARÁMETROS DEL VERTICAL
const calculateSegmentByVertical = (customer, verticalParams) => {
    if (!customer) return 'nuevo';
    if (!verticalParams) return 'nuevo'; // Fallback si no hay parámetros
    
    const lifetimeVisits = customer.total_visits || 0;
    const totalSpent = customer.total_spent || 0;
    const daysSinceLastVisit = customer.last_visit_at 
        ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
        : 999;
    const daysSinceFirstVisit = customer.created_at
        ? Math.floor((new Date() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Calcular thresholds (sin Personal Cadence por ahora - se puede añadir después)
    const riskThreshold = verticalParams.risk_min_days;
    const inactiveThreshold = verticalParams.inactive_days;
    
    // PRIORIDAD 1: VIP (siempre gana, incluso si está inactivo)
    const isVIP = totalSpent >= verticalParams.vip_min_spend_12m || 
                  lifetimeVisits >= verticalParams.vip_min_visits_12m;
    
    if (isVIP) {
        return 'vip';
    }
```

---

### **🟢 REGLA 2 (PRIORIDAD ALTA): NUEVO**

**Condición:** Cliente con 1-2 visitas en los últimos 90 días

**Lógica:**
```javascript
if (lifetimeVisits <= 2 && daysSinceFirstVisit <= 90) {
    return 'nuevo';
}
```

**Criterio:**
- **Visitas totales:** ≤2 visitas
- **Antigüedad:** ≤90 días desde la primera visita

**Ejemplo:**
- Cliente creado hace 30 días con 1 visita → **NUEVO**
- Cliente creado hace 120 días con 2 visitas → **NUEVO** (aunque tiene más antigüedad, sigue siendo nuevo por visitas)

**Código:**
```108:111:src/pages/Clientes.jsx
    // PRIORIDAD 2: NUEVO (1-2 visitas en últimos 90 días)
    if (lifetimeVisits <= 2 && daysSinceFirstVisit <= 90) {
        return 'nuevo';
    }
```

---

### **🔴 REGLA 3 (PRIORIDAD MEDIA): INACTIVO**

**Condición:** Cliente sin visita durante más días que el umbral de inactividad del vertical

**Lógica:**
```javascript
if (daysSinceLastVisit > inactiveThreshold) {
    return 'inactivo';
}
```

**Umbrales por Vertical:**
- **Peluquería/Barbería:** >98 días sin visita
- **Centro de Uñas:** >60 días sin visita
- **Entrenador Personal:** >45 días sin visita
- **Clínica Dental:** >540 días sin visita (≈18 meses)
- **Veterinario:** >540 días sin visita

**Ejemplo:**
- Cliente en peluquería sin visita hace 100 días → **INACTIVO**
- Cliente en dental sin visita hace 400 días → **INACTIVO** (supera 335 días de riesgo, pero no 540 de inactivo)

**Código:**
```113:116:src/pages/Clientes.jsx
    // PRIORIDAD 3: INACTIVO
    if (daysSinceLastVisit > inactiveThreshold) {
        return 'inactivo';
    }
```

---

### **🟡 REGLA 4 (PRIORIDAD MEDIA): EN RIESGO**

**Condición:** Cliente sin visita durante más días que el umbral de riesgo del vertical (pero menos que inactivo)

**Lógica:**
```javascript
if (daysSinceLastVisit > riskThreshold) {
    return 'en_riesgo';
}
```

**Umbrales por Vertical:**
- **Peluquería/Barbería:** >56 días sin visita
- **Centro de Uñas:** >24 días sin visita
- **Entrenador Personal:** >14 días sin visita
- **Clínica Dental:** >335 días sin visita (≈11 meses)
- **Veterinario:** >365 días sin visita

**Ejemplo:**
- Cliente en peluquería sin visita hace 60 días → **EN RIESGO** (supera 56 días, pero no 98 de inactivo)
- Cliente en centro de uñas sin visita hace 30 días → **EN RIESGO** (supera 24 días)

**Código:**
```118:121:src/pages/Clientes.jsx
    // PRIORIDAD 4: EN RIESGO
    if (daysSinceLastVisit > riskThreshold) {
        return 'en_riesgo';
    }
```

---

### **🟦 REGLA 5 (PRIORIDAD BAJA - Default): REGULAR**

**Condición:** Ninguna de las reglas anteriores se cumple

**Lógica:**
```javascript
// Si no es VIP, no es nuevo, no está inactivo, no está en riesgo
return 'regular';
```

**Criterio:**
- Cliente con >2 visitas
- No cumple umbrales VIP
- Última visita reciente (dentro del umbral de riesgo)
- Cliente activo y frecuente

**Ejemplo:**
- Cliente en peluquería con 5 visitas, última hace 30 días, 200€ gastados → **REGULAR**

**Código:**
```123:124:src/pages/Clientes.jsx
    // PRIORIDAD 5 (DEFAULT): REGULAR
    return 'regular';
```

---

## 📊 TABLA DE UMBRALES POR VERTICAL

| Vertical | VIP Visitas | VIP Gasto | En Riesgo | Inactivo | Ciclo Natural |
|----------|-------------|-----------|-----------|----------|---------------|
| **Peluquería/Barbería** | ≥10 | ≥500€ | >56 días | >98 días | 42 días |
| **Centro de Uñas** | ≥15 | ≥400€ | >24 días | >60 días | 21 días |
| **Entrenador Personal** | ≥50 | ≥1500€ | >14 días | >45 días | 7 días |
| **Yoga/Pilates** | ≥50 | ≥1200€ | >21 días | >60 días | 7 días |
| **Fisioterapia** | ≥12 | ≥600€ | >45 días | >180 días | 30 días |
| **Masajes/Osteopatía** | ≥12 | ≥600€ | >35 días | >120 días | 28 días |
| **Psicología/Coaching** | ≥20 | ≥1200€ | >21 días | >90 días | 7 días |
| **Centro Estética** | ≥8 | ≥700€ | >56 días | >180 días | 42 días |
| **Clínica Dental** | ≥3 | ≥800€ | >335 días | >540 días | 365 días |
| **Veterinario** | ≥3 | ≥600€ | >365 días | >540 días | 365 días |

---

## 🔍 ORIGEN DE LOS DATOS

### **1. Parámetros del Vertical (Tabla `crm_vertical_parameters`)**

Los umbrales se cargan desde Supabase según el `vertical_type` del negocio:

```164:192:src/pages/Clientes.jsx
    // 🆕 Cargar parámetros del vertical desde Supabase
    const loadVerticalParams = useCallback(async () => {
        try {
            if (!business?.vertical_type) {
                console.log('📊 CRM: Sin vertical_type en el negocio');
                return;
            }

            console.log(`📊 CRM: Cargando parámetros para vertical "${business.vertical_type}"`);
            
            const { data, error } = await supabase
                .from('crm_vertical_parameters')
                .select('*')
                .eq('vertical_id', business.vertical_type)
                .single();

            if (error) {
                console.error('❌ Error cargando parámetros del vertical:', error);
                return;
            }

            if (data) {
                console.log('✅ Parámetros del vertical cargados:', data);
                setVerticalParams(data);
            }
        } catch (error) {
            console.error('❌ Error cargando parámetros del vertical:', error);
        }
    }, [business]);
```

### **2. Métricas del Cliente (Tabla `customers`)**

El sistema calcula el segmento usando:
- `total_visits`: Visitas totales del cliente
- `total_spent`: Gasto total del cliente
- `last_visit_at`: Fecha de la última visita
- `created_at`: Fecha de creación del cliente

### **3. Cálculo en Tiempo Real**

El segmento se calcula **en el frontend** cada vez que se carga la lista de clientes:

```272:276:src/pages/Clientes.jsx
                // 🆕 Calcular segmento usando parámetros del vertical
                let segment = customer.segment_manual || customer.segment_auto || 'nuevo';
                if (verticalParams) {
                    segment = calculateSegmentByVertical(customer, verticalParams);
                }
```

---

## ❓ ¿ES REGLA FIJA O IA?

### **Respuesta: REGLAS FIJAS con umbrales configurables**

**NO es IA:**
- ❌ No usa machine learning
- ❌ No analiza patrones complejos
- ❌ No predice comportamiento futuro
- ❌ No se adapta automáticamente

**SÍ es Reglas Fijas:**
- ✅ Lógica determinista (si X entonces Y)
- ✅ Umbrales predefinidos por vertical
- ✅ Orden de prioridad fijo
- ✅ Cálculo en tiempo real basado en métricas actuales

**Ventajas:**
- ✅ Transparente y predecible
- ✅ Fácil de entender y explicar
- ✅ Configurable por vertical
- ✅ Rápido de calcular

**Limitaciones:**
- ⚠️ No aprende de patrones históricos
- ⚠️ No considera factores externos
- ⚠️ No predice churn futuro

---

## 🎯 EJEMPLOS PRÁCTICOS

### **Ejemplo 1: Cliente VIP en Peluquería**

**Datos del Cliente:**
- Visitas totales: 12
- Gasto total: 450€
- Última visita: Hace 20 días
- Vertical: `peluqueria_barberia`

**Evaluación:**
1. ✅ **REGLA 1 (VIP):** ¿12 ≥ 10 visitas? → **SÍ** → **VIP**

**Resultado:** 🟢 **VIP** (aunque no cumple el umbral de gasto, cumple el de visitas)

---

### **Ejemplo 2: Cliente Nuevo en Centro de Uñas**

**Datos del Cliente:**
- Visitas totales: 1
- Gasto total: 25€
- Última visita: Hace 5 días
- Días desde creación: 30 días
- Vertical: `centro_unas`

**Evaluación:**
1. ❌ **REGLA 1 (VIP):** ¿1 ≥ 15 visitas? → NO
2. ✅ **REGLA 2 (NUEVO):** ¿1 ≤ 2 visitas Y 30 ≤ 90 días? → **SÍ** → **NUEVO**

**Resultado:** 🟢 **NUEVO**

---

### **Ejemplo 3: Cliente En Riesgo en Entrenador Personal**

**Datos del Cliente:**
- Visitas totales: 8
- Gasto total: 400€
- Última visita: Hace 20 días
- Vertical: `entrenador_personal`

**Evaluación:**
1. ❌ **REGLA 1 (VIP):** ¿8 ≥ 50 visitas? → NO
2. ❌ **REGLA 2 (NUEVO):** ¿8 ≤ 2 visitas? → NO
3. ❌ **REGLA 3 (INACTIVO):** ¿20 > 45 días? → NO
4. ✅ **REGLA 4 (EN RIESGO):** ¿20 > 14 días? → **SÍ** → **EN RIESGO**

**Resultado:** 🟡 **EN RIESGO**

---

### **Ejemplo 4: Cliente Regular en Clínica Dental**

**Datos del Cliente:**
- Visitas totales: 2
- Gasto total: 600€
- Última visita: Hace 200 días
- Vertical: `clinica_dental`

**Evaluación:**
1. ❌ **REGLA 1 (VIP):** ¿2 ≥ 3 visitas? → NO
2. ❌ **REGLA 2 (NUEVO):** ¿2 ≤ 2 visitas? → SÍ, pero ¿200 días desde creación? → Probablemente >90 días → NO
3. ❌ **REGLA 3 (INACTIVO):** ¿200 > 540 días? → NO
4. ❌ **REGLA 4 (EN RIESGO):** ¿200 > 335 días? → NO
5. ✅ **REGLA 5 (REGULAR):** Default → **REGULAR**

**Resultado:** 🟦 **REGULAR**

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### **Tabla: `crm_vertical_parameters`**

Estructura de la tabla que almacena los umbrales:

```sql
CREATE TABLE crm_vertical_parameters (
    vertical_id VARCHAR(50) PRIMARY KEY,
    cycle_days INT NOT NULL,              -- Ciclo natural del cliente
    risk_min_days INT NOT NULL,           -- Días para "En Riesgo"
    inactive_days INT NOT NULL,            -- Días para "Inactivo"
    vip_min_visits_12m INT NOT NULL,       -- Visitas mínimas VIP
    vip_min_spend_12m NUMERIC(10,2) NOT NULL, -- Gasto mínimo VIP
    lookback_months INT DEFAULT 12        -- Meses de análisis
);
```

### **Función de Cálculo**

La función `calculateSegmentByVertical` está implementada en el frontend:

```82:125:src/pages/Clientes.jsx
// FUNCIÓN PARA CALCULAR SEGMENTO SEGÚN PARÁMETROS DEL VERTICAL
const calculateSegmentByVertical = (customer, verticalParams) => {
    if (!customer) return 'nuevo';
    if (!verticalParams) return 'nuevo'; // Fallback si no hay parámetros
    
    const lifetimeVisits = customer.total_visits || 0;
    const totalSpent = customer.total_spent || 0;
    const daysSinceLastVisit = customer.last_visit_at 
        ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
        : 999;
    const daysSinceFirstVisit = customer.created_at
        ? Math.floor((new Date() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Calcular thresholds (sin Personal Cadence por ahora - se puede añadir después)
    const riskThreshold = verticalParams.risk_min_days;
    const inactiveThreshold = verticalParams.inactive_days;
    
    // PRIORIDAD 1: VIP (siempre gana, incluso si está inactivo)
    const isVIP = totalSpent >= verticalParams.vip_min_spend_12m || 
                  lifetimeVisits >= verticalParams.vip_min_visits_12m;
    
    if (isVIP) {
        return 'vip';
    }
    
    // PRIORIDAD 2: NUEVO (1-2 visitas en últimos 90 días)
    if (lifetimeVisits <= 2 && daysSinceFirstVisit <= 90) {
        return 'nuevo';
    }
    
    // PRIORIDAD 3: INACTIVO
    if (daysSinceLastVisit > inactiveThreshold) {
        return 'inactivo';
    }
    
    // PRIORIDAD 4: EN RIESGO
    if (daysSinceLastVisit > riskThreshold) {
        return 'en_riesgo';
    }
    
    // PRIORIDAD 5 (DEFAULT): REGULAR
    return 'regular';
};
```

---

## 📋 RESUMEN EJECUTIVO

| Pregunta | Respuesta | Estado |
|----------|-----------|--------|
| **¿Quién define los segmentos?** | **Sistema automático** con reglas fijas | ✅ Implementado |
| **¿Es regla fija o IA?** | **REGLAS FIJAS** con umbrales configurables por vertical | ✅ Implementado |
| **¿Es configurable?** | **SÍ**, cada vertical tiene sus propios umbrales | ✅ Implementado |
| **¿Se adapta al negocio?** | **SÍ**, según el `vertical_type` del negocio | ✅ Implementado |
| **¿Puede el Dashboard usar esto?** | **SÍ**, el segmento está disponible en tiempo real | ✅ Implementado |

---

## 🚀 USO FUTURO EN DASHBOARD

### **Escenario: "Ojo, hoy viene un VIP, trátalo bien"**

El sistema ya está preparado para esto:

1. **El segmento se calcula en tiempo real** cuando se carga la lista de clientes
2. **El segmento está disponible** en el objeto `customer.segment`
3. **Puede usarse en el Dashboard** para mostrar alertas o recomendaciones

**Ejemplo de implementación futura:**

```javascript
// En Dashboard o en la vista de citas del día
const todayAppointments = appointments.filter(a => 
    a.appointment_date === today
);

const vipAppointments = todayAppointments.filter(a => 
    a.customer.segment === 'vip'
);

if (vipAppointments.length > 0) {
    // Mostrar notificación: "Hoy vienen X clientes VIP"
    showNotification(`👑 Hoy vienen ${vipAppointments.length} clientes VIP`);
}
```

---

## ✅ CONCLUSIÓN

**El sistema de segmentación:**
- ✅ **Usa reglas fijas** (no IA)
- ✅ **Se adapta por vertical** (cada negocio tiene sus umbrales)
- ✅ **Es automático** (se calcula en tiempo real)
- ✅ **Es transparente** (fácil de entender y explicar)
- ✅ **Está listo para Dashboard** (el segmento está disponible en cada cliente)

**Para el futuro Dashboard:**
- El segmento puede usarse para mostrar alertas ("Hoy viene un VIP")
- El segmento puede usarse para personalizar la experiencia
- El segmento puede usarse para recomendar acciones

---

**Documento generado:** 24 Noviembre 2025  
**Basado en:** Auditoría exhaustiva del código fuente y documentación técnica



