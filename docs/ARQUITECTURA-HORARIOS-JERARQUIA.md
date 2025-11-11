# 🏗️ ARQUITECTURA DE HORARIOS - SISTEMA JERÁRQUICO

**Fecha:** 10 Noviembre 2025  
**Estado:** ✅ IMPLEMENTADO  
**Principio:** El horario del NEGOCIO manda sobre TODOS los empleados

---

## 📊 JERARQUÍA DE HORARIOS (3 NIVELES)

```
┌─────────────────────────────────────────────────────┐
│  🏢 NIVEL 1: HORARIO DEL NEGOCIO                    │
│     (Página "Horario/Calendario" → Tab "Horario")   │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│     Define: L-V 9-14h, 16-20h (Turnos partidos)    │
│     → NADIE puede trabajar fuera de estas horas    │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🌍 NIVEL 2: EVENTOS DEL NEGOCIO              │ │
│  │    (Página "Horario/Calendario" → Calendario)│ │
│  │    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │    Tipos:                                     │ │
│  │    • 🔒 Cierres totales (reformas, festivos) │ │
│  │    • 🎉 Eventos especiales (San Valentín)    │ │
│  │    → Afectan a TODOS los empleados           │ │
│  │                                               │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │ 👥 NIVEL 3: AUSENCIAS INDIVIDUALES     │ │ │
│  │  │    (Página "Tu Equipo" → Ausencias)    │ │ │
│  │  │    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │ │
│  │  │    • 🏖️ Vacaciones personales          │ │ │
│  │  │    • 🤒 Bajas médicas                  │ │ │
│  │  │    • 🏠 Permisos                       │ │ │
│  │  │    → Solo afecta al empleado           │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 🛡️ REGLAS DE VALIDACIÓN

### **REGLA 1: El negocio MANDA sobre los empleados**

```javascript
// ❌ BLOQUEADO:
Negocio: Lunes 9-14h, 16-20h
Empleado intenta: Lunes 8-14h
→ ERROR: "Horario 08:00-14:00 fuera del horario del negocio"

// ✅ PERMITIDO:
Negocio: Lunes 9-14h, 16-20h
Empleado: Lunes 10-13h, 16-19h
→ OK: Dentro del horario del negocio
```

**Implementado en:**
- `src/pages/Equipo.jsx` → `handleSubmit()` (crear empleado)
- `src/pages/Equipo.jsx` → `handleSave()` (editar horario)

### **REGLA 2: Negocio cerrado = NADIE trabaja**

```javascript
// ❌ BLOQUEADO:
Negocio: Sábado CERRADO
Empleado intenta: Sábado 10-18h
→ ERROR: "El negocio está cerrado. El empleado no puede trabajar."

// ✅ PERMITIDO:
Negocio: Sábado ABIERTO 10-18h
Empleado: Sábado 11-17h
→ OK
```

### **REGLA 3: Eventos de cierre bloquean a TODOS**

```javascript
// Escenario: Reformas del local
Evento: 1-15 agosto "Reformas" (cerrado)
→ Bloquea automáticamente:
  - Slots de TODOS los empleados
  - Clientes no pueden reservar
  - Calendario muestra: 🔒 CERRADO - Reformas
```

---

## 📅 TIPOS DE EVENTOS

### **1. Cierre Total (🔒)**
- **Ejemplos:** Reformas, festivo, emergencia
- **Comportamiento:** Bloquea TODOS los empleados
- **Visualización:** Día rojo "🔒 CERRADO - [motivo]"
- **Impacto:** No se generan slots, clientes no pueden reservar

### **2. Evento Especial (🎉)**
- **Ejemplos:** San Valentín, Día de la Madre, menú especial
- **Comportamiento:** Negocio ABIERTO pero con horario especial
- **Visualización:** Día verde "🎉 [nombre evento]"
- **Impacto:** Slots normales, puede tener horario diferente

---

## 🔄 FLUJOS COMPLETOS

### **FLUJO 1: Reformas del local (2 semanas)**

```
1. Dueño va a "Horario/Calendario → Calendario"
2. Selecciona día 1 de agosto
3. Click "Nuevo evento"
4. Título: "Reformas del local"
5. Check: "Restaurante cerrado este día" ✅
6. Guarda

7. RESULTADO:
   ✅ Día 1 agosto bloqueado para TODOS
   ✅ Calendario muestra: 🔒 CERRADO - Reformas
   ✅ Clientes no pueden reservar
   ✅ NO hace falta marcar ausencias individuales

8. Repite para días 2-15 agosto (o crear rango de fechas)
```

### **FLUJO 2: María de vacaciones (personal)**

```
1. Dueño va a "Tu Equipo → María → 🏖️ Ausencias"
2. Click "Añadir Ausencia"
3. Tipo: Vacaciones
4. Desde: 10 julio
5. Hasta: 20 julio
6. Guarda

7. RESULTADO:
   ✅ Solo María bloqueada esos días
   ✅ Juan, Pedro siguen disponibles
   ✅ Calendario muestra: "🏖️ María"
   ✅ Clientes pueden reservar con otros empleados
```

### **FLUJO 3: San Valentín (evento especial)**

```
1. Dueño va a "Horario/Calendario → Calendario"
2. Selecciona 14 febrero
3. Click "Nuevo evento"
4. Título: "Menú San Valentín"
5. NO marca "cerrado" ❌
6. Horario: 18:00-24:00 (solo cena)
7. Guarda

8. RESULTADO:
   ✅ Negocio abierto solo por la noche
   ✅ Calendario muestra: 🎉 Menú San Valentín
   ✅ Slots solo de 18:00-24:00
```

---

## 🎨 VISUALIZACIÓN EN CALENDARIO

### **Día normal (sin eventos ni ausencias):**
```
┌─────────────────────────────┐
│ 10 nov                       │
│ Abierto 09:00-21:00         │
└─────────────────────────────┘
```

### **Día con evento de cierre total:**
```
┌─────────────────────────────┐
│ 15 ago                       │
│ 🔒 CERRADO - Reformas       │
└─────────────────────────────┘
```

### **Día con ausencia individual:**
```
┌─────────────────────────────┐
│ 17 nov                       │
│ Abierto 09:00-21:00         │
│ 🏖️ Pol (Vacaciones)        │
└─────────────────────────────┘
```

### **Día con múltiples ausencias:**
```
┌─────────────────────────────┐
│ 20 dic                       │
│ Abierto 09:00-21:00         │
│ 🏖️ María                    │
│ 🏖️ Juan                     │
│ +1 más                       │
└─────────────────────────────┘
```

### **Día con evento especial:**
```
┌─────────────────────────────┐
│ 14 feb                       │
│ 🎉 San Valentín             │
│ Abierto 18:00-24:00         │
└─────────────────────────────┘
```

---

## 🚀 PRÓXIMOS PASOS

Ahora voy a:

1. ✅ Arreglar visualización de ausencias (debug añadido)
2. ✅ Verificar que eventos de cierre bloquean a todos
3. ✅ Mejorar modal de eventos para que sea más claro

---

**PRIMERO: Recarga el navegador y ve a "Horario/Calendario → Calendario", abre la consola (F12) y dime:**

1. ¿Cuántas ausencias dice que cargó?
2. ¿Sale algún log de "📅 2025-11-17: 1 ausencia(s) - Pol"?

Con esa info sabré exactamente dónde está el problema. 🔍



