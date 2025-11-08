# 📞 MEJORA COMUNICACIÓN - CLASIFICACIÓN EN 2 NIVELES

**Fecha:** 8 de Noviembre 2025  
**Objetivo:** Organizar conversaciones por Tipología (Nivel 1) + Acción (Nivel 2)  
**Estado Actual:** Filtros básicos por canal y estado

---

## 🎯 PROPUESTA APROBADA

### **NIVEL 1: Tipología (¿Quién llama?)**

| Tipo | Emoji | Color | Prioridad |
|------|-------|-------|-----------|
| 🙋 **Clientes** | 🙋 | Azul | Alta |
| 📦 **Proveedores** | 📦 | Gris | Media |
| 🚨 **Incidencias** | 🚨 | Rojo | **URGENTE** |
| 🗑️ **Ruido** | 🗑️ | Negro | Baja |

### **NIVEL 2: Acción (¿Qué quiere?)**

#### **Si es CLIENTE:**
- ✅ Reservar → "Nueva cita"
- 🔄 Gestionar → "Modificar/Cancelar cita"
- ℹ️ Informarse → "Precios, horarios, ubicación"
- 💬 Feedback → "Comentario leve"

#### **Si es PROVEEDOR:**
- 💼 Venta → "Comercial nuevo"
- 📋 Seguimiento → "Proveedor habitual"
- 💰 Reclamo → "Reclama pago/servicio"

#### **Si es INCIDENCIA:**
- 🏥 Médica → "Alergia, urgencia médica"
- ⚠️ Servicio → "Queja grave, insatisfacción"

#### **Si es RUIDO:**
- 🚫 Equivocado → "Llamada equivocada"
- 🔇 Spam → "Encuesta, robocall"

---

## 📊 MAPEO CON CAMPOS ACTUALES

### **Tabla: `agent_conversations`**

**Campos existentes:**
```sql
interaction_type VARCHAR  ← Aquí viene la clasificación del agente
outcome VARCHAR           ← Resultado de la conversación
status VARCHAR            ← 'active' o 'resolved'
metadata JSONB            ← Datos adicionales
```

### **Valores actuales de `interaction_type`:**
```
(Vienen del agente IA - VAPI/N8N)

Ejemplos:
- "reservation_inquiry"
- "reservation_request"
- "cancellation_request"
- "information_request"
- "complaint"
- etc.
```

### **Mapeo propuesto:**

```javascript
// NIVEL 1: Tipología
const TIPOLOGIA_MAP = {
    // CLIENTES (todo lo relacionado con servicios)
    'cliente': [
        'reservation_inquiry',
        'reservation_request',
        'cancellation_request',
        'modification_request',
        'information_request',
        'price_inquiry',
        'general_inquiry'
    ],
    
    // PROVEEDORES (comercial, reparto, facturas)
    'proveedor': [
        'supplier_call',
        'commercial_call',
        'delivery_inquiry',
        'invoice_inquiry'
    ],
    
    // INCIDENCIAS (urgencias)
    'incidencia': [
        'complaint',
        'urgent_issue',
        'medical_issue',
        'service_issue',
        'escalation'
    ],
    
    // RUIDO (spam, equivocados)
    'ruido': [
        'wrong_number',
        'spam',
        'survey',
        'unrelated'
    ]
};

// NIVEL 2: Acción (ya viene en interaction_type)
const ACCION_MAP = {
    'reservation_request': 'Reservar',
    'cancellation_request': 'Cancelar',
    'modification_request': 'Modificar',
    'information_request': 'Informarse',
    'complaint': 'Queja',
    // ... etc
};
```

---

## 🎨 NUEVA UI - MOCKUP

### **Vista Principal:**

```
┌─────────────────────────────────────────────────────┐
│  COMUNICACIÓN                                       │
│  Centro de conversaciones con el agente IA         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  MÉTRICAS (mismo estilo que Reservas):             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ 🙋   25  │ │ 📦    3  │ │ 🚨    1  │ │ 🗑️    5  │
│  │ Clientes │ │ Proveedores│ │ Incidencias│ │ Ruido   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘
│                                                      │
├─────────────────────────────────────────────────────┤
│  FILTROS:                                            │
│  [ Todos ] [ 🙋 Clientes ] [ 📦 Proveedores ] etc.  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🚨 INCIDENCIAS (1) - PRIMERO SIEMPRE              │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⚠️ 11:45 - Pedro López                      │   │
│  │ 🏥 Médica: Alergia al tinte                 │   │
│  │ 🔴 Activo - Requiere atención              │   │
│  │ [Ver conversación] [Marcar resuelto]       │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  🙋 CLIENTES (25)                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📞 10:30 - Ana García                       │   │
│  │ ✅ Reservar: Reserva creada para mañana     │   │
│  │ ✓ Resuelto hace 2 horas                    │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ 💬 09:15 - María Sánchez                   │   │
│  │ ℹ️ Informarse: Preguntó precios            │   │
│  │ ✓ Resuelto hace 3 horas                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  📦 PROVEEDORES (3)                                 │
│  🗑️ RUIDO (5)                                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### **Paso 1: Crear función helper en frontend**
```javascript
// utils/conversationClassifier.js
export const classifyConversation = (interactionType) => {
    // NIVEL 1: Tipología
    if (['reservation_', 'cancellation_', 'modification_', 'information_'].some(prefix => 
        interactionType?.startsWith(prefix)
    )) {
        return {
            tipologia: 'cliente',
            emoji: '🙋',
            color: 'blue',
            priority: 1
        };
    }
    
    if (['supplier_', 'commercial_', 'delivery_', 'invoice_'].some(prefix => 
        interactionType?.startsWith(prefix)
    )) {
        return {
            tipologia: 'proveedor',
            emoji: '📦',
            color: 'gray',
            priority: 2
        };
    }
    
    if (['complaint', 'urgent_', 'medical_', 'escalation'].some(keyword => 
        interactionType?.includes(keyword)
    )) {
        return {
            tipologia: 'incidencia',
            emoji: '🚨',
            color: 'red',
            priority: 0 // MÁS ALTA
        };
    }
    
    return {
        tipologia: 'ruido',
        emoji: '🗑️',
        color: 'black',
        priority: 3
    };
};

export const getActionLabel = (interactionType) => {
    const map = {
        'reservation_request': 'Reservar',
        'cancellation_request': 'Cancelar',
        'modification_request': 'Modificar',
        'information_request': 'Informarse',
        'complaint': 'Queja',
        'commercial_call': 'Venta',
        'supplier_call': 'Seguimiento',
        // ... más mapeos
    };
    
    return map[interactionType] || 'Otro';
};
```

### **Paso 2: Actualizar UI de Comunicacion.jsx**
- Tarjetas COMPACTAS (copiar de Reservas)
- Filtros por tipología (4 botones)
- Agrupar visualmente por NIVEL 1
- Mostrar NIVEL 2 como subtítulo

### **Paso 3: Ordenar por prioridad**
```
1. 🚨 Incidencias (PRIMERO SIEMPRE)
2. 🙋 Clientes
3. 📦 Proveedores
4. 🗑️ Ruido
```

---

## ✅ LO QUE YA FUNCIONA (Mantener):

- ✅ Carga de conversaciones desde `agent_conversations`
- ✅ Mensajes en `agent_messages`
- ✅ Vista de detalle con timeline
- ✅ Búsqueda por nombre
- ✅ Filtros por canal (WhatsApp, Phone, etc.)

---

## 🔧 LO QUE VOY A MEJORAR:

1. **Tarjetas de métricas:**
   - ❌ ANTES: Grandes y genéricas
   - ✅ AHORA: Compactas por tipología ([25] Clientes, [3] Proveedores, etc.)

2. **Filtros:**
   - ❌ ANTES: Solo "Canal" y "Estado"
   - ✅ AHORA: + Filtro por "Tipología" (4 botones)

3. **Agrupación:**
   - ❌ ANTES: Todas mezcladas
   - ✅ AHORA: Agrupadas por Nivel 1 (🚨 primero, luego 🙋, luego 📦, luego 🗑️)

4. **Labels claros:**
   - ❌ ANTES: "reservation_request"
   - ✅ AHORA: "🙋 Cliente → ✅ Reservar"

5. **Incidencias destacadas:**
   - ✅ SIEMPRE arriba
   - ✅ Fondo rojo claro
   - ✅ Botón "Resolver" visible

---

## 🚀 ¿EMPIEZO A IMPLEMENTAR?

**Lo que voy a hacer:**

1. ✅ Crear `utils/conversationClassifier.js`
2. ✅ Actualizar `Comunicacion.jsx`:
   - Tarjetas compactas (mismo estilo Reservas)
   - Filtros por tipología
   - Agrupación por prioridad
3. ✅ Mantener funcionalidad actual
4. ✅ Solo mejorar visual + organización

**Tiempo estimado:** 30 minutos

**¿Le meto?** 🔥
