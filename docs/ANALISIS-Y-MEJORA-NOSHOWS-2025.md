# 🔍 ANÁLISIS PROFUNDO: SISTEMA NO-SHOWS

**Fecha:** 8 de Noviembre 2025  
**Objetivo:** Simplificar y adaptar a peluquerías, fisios, centros de belleza  
**Estado Actual:** Diseñado para restaurantes (demasiado complejo)

---

## 📊 ESTADO ACTUAL (Lo que tenemos)

### **✅ FORTALEZAS:**

1. **Sistema de confirmaciones automáticas**
   - WhatsApp 24h antes
   - WhatsApp 4h antes
   - Llamada urgente 2h 15min antes
   - ✅ **ESTO ES ORO - MANTENER**

2. **Algoritmo de riesgo dinámico**
   - 7 factores estáticos (0-170 puntos)
   - Ajustes dinámicos según respuestas
   - Recalculación en tiempo real
   - ⚠️ **DEMASIADO COMPLEJO - SIMPLIFICAR**

3. **Workflows N8N automáticos**
   - 5 workflows coordinados
   - Auto-liberación de slots
   - Registro de acciones
   - ✅ **MANTENER (funciona bien)**

4. **UI profesional**
   - Timeline visual del flujo
   - Explicación del algoritmo
   - Historial de acciones
   - ⚠️ **BIEN PERO SE PUEDE MEJORAR**

---

## ❌ PROBLEMAS DETECTADOS:

### **1. DEMASIADOS FACTORES (7 es excesivo)**

**Actual:**
- Historial del cliente (0-40 pts)
- Inactividad (0-25 pts)
- Horario de riesgo (0-15 pts)
- Tamaño de grupo (0-10 pts) ← **NO APLICA a peluquerías**
- Canal de reserva (0-10 pts)
- Antelación (0-20 pts)
- Urgencia temporal (0-50 pts)

**Problema:** 
- "Tamaño de grupo" NO tiene sentido en peluquerías (no hay grupos de 6)
- "Horario de riesgo" (21:00h) es para restaurantes, no peluquerías
- Demasiados números confunden al usuario

---

### **2. NOMENCLATURA DE RESTAURANTES**

**Actual:**
```javascript
restaurant_id
party_size  ← "tamaño de grupo"
```

**Debería ser:**
```javascript
business_id
appointment_duration ← "duración de cita"
```

---

### **3. PÁGINA MUY TÉCNICA**

**Problemas:**
- Muestra "Score: 75 (-30)" ← Nadie entiende qué significa
- Explicación del algoritmo ← Demasiado complejo
- "Factor 1, Factor 2" ← Jerga técnica
- "T-24h, T-4h" ← Notación confusa

---

## 🎯 PROPUESTA: SISTEMA SIMPLIFICADO

### **FILOSOFÍA:**
> "El objetivo NO es ser el más preciso matemáticamente.  
> El objetivo es **que el usuario entienda TODO y tome acción**."

---

## ✨ NUEVO SISTEMA (Súper Simple)

### **1. SOLO 3 NIVELES DE RIESGO**

No más scores de 0-170. Solo:

| Nivel | Color | Descripción | Acción |
|-------|-------|-------------|--------|
| 🟢 **BAJO** | Verde | "Cliente confiable" | Recordatorio estándar |
| 🟡 **MEDIO** | Amarillo | "Necesita confirmación" | WhatsApp reforzado |
| 🔴 **ALTO** | Rojo | "Riesgo de no presentarse" | Llamar obligatoriamente |

---

### **2. FACTORES SIMPLIFICADOS (4 en lugar de 7)**

#### **Factor 1: Historial del Cliente**
```
❌ Tiene no-shows previos → RIESGO ALTO 🔴
✅ Siempre ha venido → RIESGO BAJO 🟢
🆕 Cliente nuevo → RIESGO MEDIO 🟡
```

#### **Factor 2: Respuesta a Confirmaciones**
```
✅ Confirmó 24h antes → RIESGO BAJO 🟢
⏳ No ha respondido → RIESGO MEDIO 🟡
❌ No respondió ni a 24h ni a 4h → RIESGO ALTO 🔴
```

#### **Factor 3: Antelación de la Reserva**
```
📅 Reservó con >1 semana → RIESGO BAJO 🟢
📆 Reservó con 1-7 días → RIESGO MEDIO 🟡
⚡ Reservó con <24h → RIESGO ALTO 🔴
```

#### **Factor 4: Urgencia Temporal**
```
⏰ Falta <2h y NO confirmó → RIESGO ALTO 🔴
✅ Todo OK → usar factores anteriores
```

---

### **3. LÓGICA SIMPLE (Árbol de Decisión)**

```
1. ¿Confirmó en 24h o 4h?
   → SÍ: RIESGO BAJO 🟢 (fin)
   
2. NO confirmó → ¿Tiene historial de no-shows?
   → SÍ: RIESGO ALTO 🔴
   → NO: continuar...
   
3. ¿Reservó con menos de 24h?
   → SÍ: RIESGO ALTO 🔴
   → NO: RIESGO MEDIO 🟡
```

**Resultado:** En 3 preguntas sabemos el riesgo. FÁCIL.

---

## 🎨 NUEVA UI (Súper Intuitiva)

### **Panel Principal (Vista Hoy)**

```
┌─────────────────────────────────────────────────────┐
│  📊 NO-SHOWS HOY                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [4] 🟢 Confirmadas      [2] 🟡 Sin confirmar       │
│  [1] 🔴 Riesgo alto      [0] ❌ No se presentaron   │
│                                                      │
├─────────────────────────────────────────────────────┤
│  CITAS DE HOY                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🔴 10:00 - Ana García                              │
│     ⚠️ LLAMAR AHORA - No ha confirmado              │
│     [📞 Llamar] [✅ Marcar confirmada]              │
│                                                      │
│  🟡 12:00 - Pedro López                             │
│     📱 Enviar recordatorio                          │
│     [💬 WhatsApp] [✅ Confirmar]                    │
│                                                      │
│  🟢 15:00 - María Sánchez                           │
│     ✅ Confirmada ayer                              │
│     [👁️ Ver detalles]                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

### **Detalle de Cita (Modal)**

```
┌─────────────────────────────────────────────┐
│  👤 ANA GARCÍA                              │
│  ⏰ Hoy, 10:00 AM - Corte + Tinte (1h 30min)│
├─────────────────────────────────────────────┤
│                                              │
│  Estado: 🔴 RIESGO ALTO                     │
│                                              │
│  ¿Por qué?                                  │
│  • No ha confirmado (enviamos 2 mensajes)   │
│  • Tiene 1 no-show previo (hace 2 meses)    │
│  • Faltan menos de 2 horas                  │
│                                              │
│  ¿Qué hacer?                                │
│  📞 Llámala AHORA para confirmar            │
│                                              │
│  Historial de mensajes:                     │
│  ✅ 📱 Ayer 10:00 - WhatsApp enviado        │
│  ❌ Sin respuesta                           │
│  ✅ 📱 Hoy 08:00 - WhatsApp recordatorio    │
│  ❌ Sin respuesta                           │
│                                              │
│  [📞 Llamar ahora] [✅ Confirmar] [❌ Cancelar]│
└─────────────────────────────────────────────┘
```

---

## 🔄 FLUJO SIMPLIFICADO

### **Timeline Visual (Fácil de Entender)**

```
RESERVA CREADA
    ↓
    📅 Automático
    ↓
📱 WHATSAPP 24H ANTES
"Hola Ana! Mañana a las 10:00 tienes cita. ¿Confirmas?"
    ↓
    ⏳ Esperar respuesta
    ↓
✅ SÍ CONFIRMÓ               ❌ NO CONFIRMÓ
    ↓                            ↓
🟢 BAJO RIESGO              ⏰ WHATSAPP 4H ANTES
Todo OK                     "Recordatorio: hoy a las 10:00"
    ↓                            ↓
🎉 CLIENTE LLEGA            ✅ CONFIRMÓ    ❌ NO CONFIRMÓ
                                ↓              ↓
                            🟡 MEDIO      🔴 ALTO RIESGO
                               RIESGO          ↓
                                           📞 LLAMAR AHORA
                                                ↓
                                           ✅ CONFIRMÓ  ❌ NO CONFIRMA
                                               ↓            ↓
                                           TODO OK     AUTO-CANCELAR
                                                       (liberar hora)
```

**Explicación en texto simple:**
1. Cliente reserva
2. Le enviamos WhatsApp 1 día antes
3. Si confirma → todo bien ✅
4. Si no confirma → enviamos recordatorio 4h antes
5. Si sigue sin confirmar → te avisamos para que llames
6. Si no confirma por teléfono → cancelamos automáticamente

---

## 📊 MÉTRICAS SIMPLES (KPIs Visuales)

### **Vista Principal**

```
Este mes:

  [15] 🎉 Evitados          [2] ❌ Ocurrieron
  
  Tasa de éxito: 88%
  
  Ahorro estimado: €675
```

**Explicación simple:**
- **Evitados:** Clientes que confirmaron después de nuestros mensajes
- **Ocurrieron:** Clientes que no vinieron
- **Tasa de éxito:** % de citas confirmadas
- **Ahorro:** Citas que salvamos × ticket promedio

---

## 🛠️ CONFIGURACIÓN SIMPLIFICADA

```
┌────────────────────────────────────────────┐
│  ⚙️ CONFIGURACIÓN NO-SHOWS                 │
├────────────────────────────────────────────┤
│                                             │
│  Confirmaciones automáticas:               │
│  ✅ WhatsApp 24 horas antes                │
│  ✅ WhatsApp 4 horas antes                 │
│  ✅ Aviso urgente si no confirman          │
│                                             │
│  Auto-cancelación:                         │
│  ✅ Cancelar si no confirma 2h antes       │
│     (libera la hora automáticamente)       │
│                                             │
│  Ticket promedio: €45                      │
│  (para calcular ahorros)                   │
│                                             │
│  [💾 Guardar cambios]                      │
└────────────────────────────────────────────┘
```

---

## 💡 DIFERENCIAS CLAVE: RESTAURANTES vs PELUQUERÍAS

| Factor | Restaurantes | Peluquerías/Fisios |
|--------|--------------|-------------------|
| **Tamaño grupo** | Importante (2-10 personas) | ❌ NO APLICA (1 persona) |
| **Horario riesgo** | 21:00h+ (cenas tardías) | ❌ NO APLICA (no hay "horario tardío") |
| **Duración** | 1-2 horas fijas | ✅ Variable (corte 30min, tinte 2h) |
| **Antelación** | Mismo día OK | ✅ Mismo día = MÁS RIESGO |
| **Confirmación** | Opcional | ✅ CRÍTICO (1 no-show = hora perdida) |
| **Grupo familiar** | Común | ❌ Individual siempre |

---

## 🎯 PLAN DE ACCIÓN

### **Fase 1: Simplificar Algoritmo (2h)**

1. **Eliminar factores innecesarios:**
   - ❌ Tamaño de grupo
   - ❌ Horario de riesgo (21:00h)
   
2. **Reducir a 4 factores:**
   - ✅ Historial
   - ✅ Confirmaciones
   - ✅ Antelación
   - ✅ Urgencia temporal

3. **Cambiar de números a colores:**
   - ❌ "Score: 75 (-30)"
   - ✅ "🔴 RIESGO ALTO"

---

### **Fase 2: Rediseñar UI (3h)**

1. **Vista principal:**
   - Grid de citas del día
   - Solo mostrar citas con riesgo 🟡🔴
   - Botones de acción claros

2. **Modal de detalle:**
   - Explicación en lenguaje humano
   - "¿Por qué tiene riesgo?" con bullets
   - "¿Qué hacer?" con acción clara

3. **Timeline visual:**
   - Diagrama de flujo simple
   - Sin jerga técnica ("T-24h" → "24 horas antes")

---

### **Fase 3: Adaptar Base de Datos (1h)**

1. **Renombrar campos:**
   ```sql
   ALTER TABLE appointments RENAME COLUMN party_size TO appointment_duration;
   -- O mejor: agregar campo nuevo si party_size no existe
   ```

2. **Actualizar RPC functions:**
   - `calculate_dynamic_risk_score()` → simplificar lógica
   - Eliminar factores de restaurante

---

### **Fase 4: Testing (30min)**

1. Probar con citas reales
2. Verificar que los 3 niveles funcionen
3. Confirmar que textos sean claros

---

## ✅ CHECKLIST DE MEJORAS

- [ ] Eliminar "tamaño de grupo" del algoritmo
- [ ] Eliminar "horario de riesgo 21:00h"
- [ ] Cambiar scores numéricos por colores (🟢🟡🔴)
- [ ] Reescribir textos en lenguaje humano
- [ ] Simplificar timeline a 5 pasos claros
- [ ] Añadir explicación "¿Por qué?" en cada cita
- [ ] Añadir acción clara "¿Qué hacer?"
- [ ] Mostrar solo citas con riesgo (no todas)
- [ ] Botones grandes y claros: [📞 Llamar] [✅ Confirmar]
- [ ] Métricas simples: Evitados vs Ocurridos
- [ ] Configuración en 1 pantalla (no tabs complicados)

---

## 📝 TEXTOS SUGERIDOS (Lenguaje Humano)

### **Antes (Técnico):**
> "Score de riesgo: 75 (-30 ajuste dinámico)"  
> "Factor 1: Historial 40 pts"  
> "T-24h: Confirmación enviada"

### **Después (Humano):**
> "🔴 **Riesgo alto** - Llamar ahora"  
> "¿Por qué? No ha confirmado y tiene 1 no-show previo"  
> "Ayer le enviamos WhatsApp y no respondió"

---

## 🎉 RESULTADO ESPERADO

### **Usuario ve:**
```
HOY TENGO:
- 4 citas confirmadas ✅
- 1 cita sin confirmar 🟡 → Enviar recordatorio
- 1 cita de riesgo 🔴 → LLAMAR AHORA
```

**EN 3 SEGUNDOS entiende:**
- Qué pasa hoy
- Qué tiene que hacer
- Cómo hacerlo

**SIN necesidad de:**
- Entender "scores"
- Leer documentación
- Saber qué es "T-24h"
- Calcular nada

---

## 💪 MANTENER (Lo que funciona bien)

✅ **WhatsApp automático 24h antes**  
✅ **WhatsApp automático 4h antes**  
✅ **Auto-cancelación 2h antes**  
✅ **Workflows N8N**  
✅ **Historial de acciones**  
✅ **Métricas de ROI**  

---

## ❌ ELIMINAR (Lo que confunde)

❌ **"Score: 75 (-30)"** → Cambiar a colores  
❌ **"Factor 1, Factor 2"** → Cambiar a explicación humana  
❌ **"T-24h, T-4h"** → Cambiar a "24 horas antes"  
❌ **Tamaño de grupo** → No aplica a peluquerías  
❌ **Horario de riesgo 21:00h** → No aplica  
❌ **Tabs complicados** → Todo en 1 vista  

---

## 🚀 ¿EMPEZAMOS?

**Orden recomendado:**

1. ✅ Aprobar esta propuesta
2. 🔧 Simplificar algoritmo (backend)
3. 🎨 Rediseñar UI (frontend)
4. 🧪 Testing con datos reales
5. 🎉 Desplegar

**Tiempo total estimado:** 6-7 horas

---

**¿Te gusta esta propuesta? ¿Algún cambio?** 💬

