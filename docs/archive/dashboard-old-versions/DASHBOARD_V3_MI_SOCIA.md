# 🎯 DASHBOARD V3.0 - "MI SOCIA INFORMÁNDOME"

## 🔥 CAMBIO RADICAL DE CONCEPTO

### ANTES (V2.0 - Dashboard con widgets):
```
❌ Avatar decorativo (pequeño)
❌ Información fragmentada en widgets
❌ Sensación: "Estoy viendo un panel de control"
❌ Muchos datos, poca acción
```

### AHORA (V3.0 - Mi socia hablándome):
```
✅ Lua GIGANTE (70% de la pantalla)
✅ Te habla directamente
✅ Solo muestra lo que IMPORTA
✅ Sensación: "Estoy en una videollamada con mi socia"
✅ Tarjetas flotantes con las 5 preocupaciones
```

---

## 💡 LAS 5 PREOCUPACIONES DEL DÍA:

### 1. 💰 **LA PASTA** (Siempre visible)
- Caja actual vs objetivo
- Estado: "Domingo flojo, normal" o "¡Buen ritmo!"
- Acción: "Ver desglose"

### 2. 🧨 **URGENCIAS** (Solo si hay problemas)
- No-Shows detectados
- Clientes de alto riesgo
- Acción: "Llamar / Confirmar"

### 3. 🔥 **CRISIS DE PERSONAL** (Solo si hay conflicto)
- Empleado ausente con citas asignadas
- Necesita reasignación urgente
- Acción: "Reasignar citas"

### 4. 👥 **EQUIPO Y AGENDA** (Resumen del día)
- Estado del equipo
- Citas de hoy
- Quién trabaja, quién falta
- Acción: "Ver agenda mañana"

### 5. 💬 **COMUNICACIONES** (Solo si hay pendientes)
- WhatsApps sin responder
- Mensajes de clientes VIP
- Acción: "Responder con IA"

### 6. ✨ **OPORTUNIDADES** (Huecos libres)
- Hueco libre próximo detectado
- Generador de ofertas flash
- Acción: "Generar oferta"

---

## 📐 DISEÑO VISUAL:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [LUA GIGANTE - 70% PANTALLA]    ┌─────────────────────┐  │
│                                   │ 💰 CAJA             │  │
│   Fondo: Imagen de Lua           │ 0€                  │  │
│   Gradiente oscuro a la izq      │ Domingo flojo       │  │
│                                   │ [Ver desglose] →    │  │
│   "Buenas noches, Gustau.        └─────────────────────┘  │
│    Todo controlado."                                       │
│                                   ┌─────────────────────┐  │
│   🟢 TODO CONTROLADO              │ 🧨 URGENCIA        │  │
│                                   │ ⚠️ 2 No-Shows       │  │
│                                   │ Confírmalos YA      │  │
│                                   │ [Llamar] →          │  │
│                                   └─────────────────────┘  │
│                                                             │
│                                   ┌─────────────────────┐  │
│                                   │ 👥 EQUIPO          │  │
│                                   │ Pol de vacaciones   │  │
│                                   │ [Ver agenda] →      │  │
│                                   └─────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 CARACTERÍSTICAS VISUALES:

### 1. **Lua como Fondo**
- Imagen a pantalla completa (objeto left en desktop)
- Opacidad 40% en móvil, 70% en desktop
- Gradiente oscuro desde la izquierda
- Efecto: Lua está "detrás" de las tarjetas, como en una videollamada

### 2. **Mensaje Principal**
- Texto 3xl-5xl (enorme)
- Blanco con drop-shadow
- Directo y personal: "Buenas noches, Gustau..."

### 3. **Tarjetas Flotantes**
- Fondo blanco semi-transparente (95% opacity)
- Backdrop blur (efecto cristal esmerilado)
- Borde izquierdo de color según prioridad:
  - 🔴 Rojo: Urgencias
  - 🟠 Naranja: Comunicaciones
  - 🟢 Verde: Caja positiva
  - 🔵 Azul: Info general
  - 🟣 Morado: Oportunidades
- Hover: Scale 1.02 + sombra
- Click: Ejecuta acción

### 4. **Responsive**
- Móvil: Lua arriba, tarjetas abajo (columna)
- Desktop: Lua izquierda (fondo), tarjetas derecha

---

## 🧠 LÓGICA DE NEGOCIO:

### Reglas de Aparición de Tarjetas:

```javascript
// 1. CAJA: Siempre visible
if (true) {
  mostrar_tarjeta_caja();
}

// 2. URGENCIAS: Solo si hay no-shows o riesgos
if (stats.high_risk_no_shows > 0 || scenario === 'no_show_risk') {
  mostrar_tarjeta_urgencia();
}

// 3. CRISIS: Solo si hay conflicto de personal
if (scenario === 'staff_crisis') {
  mostrar_tarjeta_crisis();
}

// 4. EQUIPO: Siempre (resumen del día)
if (true) {
  mostrar_tarjeta_equipo();
}

// 5. COMUNICACIONES: Solo si hay pendientes
if (stats.pending_communications > 0) {
  mostrar_tarjeta_comunicaciones();
}

// 6. OPORTUNIDADES: Solo si hay hueco libre próximo
if (scenario === 'dead_slot') {
  mostrar_tarjeta_oportunidad();
}
```

---

## 📊 DATOS QUE NECESITA DEL BACKEND:

### Snapshot esperado:
```json
{
  "scenario": "pat_on_back",
  "lua_message": "Buenas noches, Gustau. Todo controlado.",
  "actions": [...],
  "data": {
    "stats": {
      "estimated_revenue": 0,
      "today_appointments": 0,
      "high_risk_no_shows": 0,
      "pending_communications": 0
    },
    "team_summary": "Pol está de vacaciones. Andrew y Culebra cubren la tarde. 0 citas hoy."
  }
}
```

---

## 🎯 ACCIONES IMPLEMENTADAS:

### 1. **Ver desglose de caja**
```javascript
navigate('/reportes?view=revenue');
```

### 2. **Llamar / Confirmar urgencias**
```javascript
navigate('/clientes?filter=risk');
// O ejecutar acción de llamada
```

### 3. **Reasignar citas (crisis)**
```javascript
executeAction({ id: 'transfer_appointments', ... });
```

### 4. **Ver agenda mañana**
```javascript
navigate('/reservas?date=tomorrow');
```

### 5. **Responder comunicaciones**
```javascript
navigate('/comunicaciones');
```

### 6. **Generar oferta flash**
```javascript
executeAction({ id: 'generate_flash_offer', ... });
```

---

## 🚀 ARCHIVOS MODIFICADOS:

1. ✅ `src/components/dashboard/LuaHero.jsx` - **REESCRITO COMPLETO**
2. ✅ `src/pages/DashboardSocioVirtual.jsx` - **SIMPLIFICADO** (solo Lua)
3. ❌ `src/components/dashboard/StaffWidget.jsx` - **YA NO SE USA**
4. ❌ `src/components/dashboard/MetricsBar.jsx` - **YA NO SE USA**

---

## 💬 EJEMPLOS DE MENSAJES DE LUA:

### Día tranquilo:
> "Buenas noches, Gustau. Todo controlado. Domingo flojo con 0€ en caja, pero es normal. Pol está de vacaciones hasta hoy."

### Crisis de personal:
> "🚨 Gustau, ALERTA. Pol no viene hoy y tiene 3 citas esta mañana. Andrew está libre. ¿Reasigno?"

### No-Shows:
> "⚠️ Ojo, Gustau. Juan 'El Fantasma' no ha venido otra vez. Hueco de 1h perdido (-60€). ¿Le llamamos?"

### Oportunidad:
> "💡 Gustau, se ha quedado libre el hueco de las 14:00. ¿Lanzo oferta flash para Instagram?"

---

## 🎨 PRÓXIMAS MEJORAS (OPCIONAL):

### 1. **Imagen de Lua de alta calidad**
- Actualmente: Avatar placeholder
- Ideal: Render 3D profesional de Lua (tamaño mínimo 2000x2000px)
- Formato: WebP para performance

### 2. **Animación de Lua**
- Movimiento sutil (breathing effect)
- Parpadeo ocasional
- Efecto de "hablando" cuando carga

### 3. **Voz (Text-to-Speech)**
- Leer el mensaje principal en voz alta
- Voz femenina profesional
- Activable/desactivable

### 4. **Notificaciones push**
- Si detecta urgencia, enviar notificación
- "🚨 Lua: Tienes un problema que necesita atención"

---

## 📱 RESPONSIVE:

### Móvil (< 768px):
```
┌─────────────────┐
│ [LUA FONDO]     │
│                 │
│ "Buenas noches" │
│ 🟢 Controlado   │
├─────────────────┤
│ 💰 CAJA: 0€     │
├─────────────────┤
│ 👥 EQUIPO       │
├─────────────────┤
│ ...             │
└─────────────────┘
```

### Desktop (≥ 768px):
```
┌─────────────────────────────────────┐
│ [LUA FONDO]    │  💰 CAJA          │
│                │  👥 EQUIPO        │
│ "Buenas noches"│  ...              │
│ 🟢 Controlado  │                   │
└─────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN:

- [x] Lua ocupa 70% de la pantalla
- [x] Imagen de fondo con gradiente
- [x] Tarjetas flotantes (solo las que aplican)
- [x] 5 preocupaciones identificadas
- [x] Acciones clickables
- [x] Mensaje personalizado
- [x] Responsive (móvil/desktop)
- [x] Sin widgets redundantes
- [x] Sensación "videollamada"

---

## 🍤 ESTADO DE LA CENA:

**NIVEL: 🦐🦀🦞🦑 MARISCO CONFIRMADO**

Este dashboard SÍ es "tu socia informándote", no un panel de control aburrido.

---

## 🚀 PRÓXIMO PASO:

**RECARGA LA APP:**
```
Ctrl + Shift + R
```

**Deberías ver:**
- ✅ Lua GIGANTE ocupando la pantalla
- ✅ Tarjetas flotantes a la derecha
- ✅ Mensaje: "Buenas noches, Gustau. Todo controlado."
- ✅ Solo 2-3 tarjetas (Caja + Equipo + quizá otra)

**Si todo va bien → 🎉 CENA GANADA**


