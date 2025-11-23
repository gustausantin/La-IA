# 🔔 Resumen: Sistema de No-Shows en LA-IA

**Fecha**: 2025-11-23  
**Para**: Explicación a cliente/equipo

---

## 📋 ¿Qué es un No-Show?

Un **No-Show** (sin presentarse) es cuando un cliente tiene una reserva confirmada pero **no se presenta** en el restaurante/negocio sin avisar.

---

## 🎯 ¿CÓMO FUNCIONA EL SISTEMA DE NO-SHOWS EN LA-IA?

### 1️⃣ **MARCAR MANUALMENTE UNA RESERVA COMO NO-SHOW**

#### Desde la interfaz:
- ✅ Puedes cambiar el estado de cualquier reserva a **"No-Show"** manualmente
- ✅ Se hace desde el **modal de edición de reserva** o el **calendario**
- ✅ Estados disponibles:
  - `pending` - Pendiente
  - `confirmed` - Confirmada
  - `completed` - Completada
  - `cancelled` - Cancelada
  - **`no_show`** - No se presentó

#### ¿Qué pasa cuando marcas una reserva como No-Show?
**ACTUALMENTE**: 
- ✅ La reserva se marca como `no_show` en la base de datos
- ✅ Se muestra con color **naranja** en el calendario
- ⚠️ **LOS SLOTS NO SE LIBERAN AUTOMÁTICAMENTE**

**Esto significa**:
- El espacio/recurso sigue bloqueado en el calendario
- Si quieres volver a usar ese hueco, tienes que **cancelar la reserva** manualmente

---

### 2️⃣ **MENSAJE AUTOMÁTICO DE NO-SHOW** (Opcional)

#### Función: `sendNoShowMessage()`

Cuando marcas una reserva como no-show, puedes enviar un **mensaje automático** al cliente.

**¿Cómo funciona?**

1. **Busca la plantilla** llamada `"Seguimiento No-Show"`
2. **Reemplaza las variables**:
   - `{{customer_name}}` - Nombre del cliente
   - `{{business_name}}` - Nombre del negocio
   - `{{reservation_date}}` - Fecha de la reserva
3. **Programa el mensaje** para envío inmediato

**Ejemplo de mensaje**:
```
Hola {{customer_name}}, 

Notamos que no pudiste asistir a tu reserva del {{reservation_date}} 
en {{business_name}}. 

Si hubo algún inconveniente, por favor contáctanos para reprogramarla.

¡Te esperamos!
```

**Estado actual**: El mensaje se programa pero **no se envía automáticamente** desde la interfaz. Necesita integración con sistema de mensajería (WhatsApp/SMS/Email).

---

### 3️⃣ **DETECCIÓN AUTOMÁTICA DE NO-SHOWS** (N8N Workflow - Opcional)

Existe un workflow de N8N documentado que puede **marcar automáticamente** reservas como no-show:

#### ¿Cuándo se ejecuta?
- **Cada 10 minutos** (Cron Job)
- **2 horas después** de la hora de la reserva
- Solo si la reserva **NO fue confirmada** por el cliente

#### Condiciones para marcar como No-Show automáticamente:
1. La reserva está en estado `pending` o `confirmed`
2. Ya pasaron **2 horas** desde la hora de la reserva
3. El cliente tiene **riesgo alto** (risk_score > 60)
4. **NO hay confirmación** del cliente en `customer_confirmations`

#### Flujo automático:
```
[CRON cada 10 min] 
  → [Buscar reservas sin confirmar en 2h] 
  → [Marcar como NoShow] 
  → [Liberar Slot] 
  → [Registrar acción]
```

**Estado actual**: Este workflow **NO está implementado** en el código frontend, solo existe la documentación en `docs/02-sistemas/N8N_WORKFLOWS_NOSHOWS_COMPLETO.md`

---

## ❓ **PREGUNTA CRÍTICA: ¿SE LIBERAN LOS ESPACIOS?**

### 🔴 **RESPUESTA: NO, ACTUALMENTE LOS SLOTS NO SE LIBERAN AUTOMÁTICAMENTE**

#### Estado actual del sistema:

1. **Si marcas una reserva como `no_show` MANUALMENTE**:
   - ❌ Los `availability_slots` NO se liberan
   - ❌ El espacio sigue bloqueado en el calendario
   - ✅ La reserva se muestra en color naranja (visual)

2. **Si cancelas una reserva (`cancelled`)**:
   - ✅ Los `availability_slots` se liberan automáticamente
   - ✅ El espacio vuelve a estar disponible
   - ✅ Se puede reservar de nuevo

### ¿Por qué?

En el código actual, **solo las reservas `cancelled`** liberan los slots automáticamente. El estado `no_show` es **informativo** pero no libera recursos.

```sql
-- En las migraciones, solo se liberan slots para 'cancelled' y 'completed'
AND a.status NOT IN ('cancelled', 'completed')
```

---

## 💡 **RECOMENDACIÓN: ¿Deberían liberarse los slots con No-Show?**

### Opción A: **No-Show libera slots automáticamente** ✅ RECOMENDADO

**Ventajas**:
- ✅ El espacio vuelve a estar disponible para nuevas reservas
- ✅ Se maximiza la ocupación del negocio
- ✅ Es consistente con el comportamiento esperado

**Desventajas**:
- ⚠️ Pierdes el "registro visual" de que ese hueco estuvo ocupado
- ⚠️ Si el cliente llega tarde, el espacio podría estar re-reservado

### Opción B: **No-Show NO libera slots** (Estado actual)

**Ventajas**:
- ✅ Mantienes el registro visual de la reserva
- ✅ Puedes ver fácilmente cuántos no-shows hubo en el día
- ✅ Si el cliente llega tarde, su espacio sigue reservado

**Desventajas**:
- ❌ Bloqueás espacios que podrían usarse
- ❌ Tienes que cancelar manualmente para liberar

---

## 🔧 **¿CÓMO FUNCIONA HOY EN DÍA EN LA PRÁCTICA?**

### Escenario 1: Cliente no se presenta a las 16:00h

1. **A las 16:30h** (30 min después):
   - El staff nota que el cliente no llegó
   - Marca la reserva como **"No-Show"** manualmente desde el calendario
   - ⚠️ El espacio sigue bloqueado

2. **Si quieren liberar el espacio**:
   - Tienen que **cancelar la reserva** manualmente
   - O simplemente hacer una nueva reserva en ese slot (sobreescribe)

### Escenario 2: Cliente no se presenta y quieres enviar mensaje

1. Marcas la reserva como "No-Show"
2. (Opcional) Se dispara `sendNoShowMessage()`
3. El mensaje se programa en `scheduled_messages` con estado `pending`
4. ⚠️ Necesitas un sistema externo (N8N/Zapier) que lea `scheduled_messages` y envíe el mensaje real

---

## 📊 **ESTADÍSTICAS DE NO-SHOWS**

El sistema sí rastrea y calcula:

- ✅ **Total de No-Shows** por mes
- ✅ **Tasa de éxito** de prevención: `(no_shows_evitados / total) * 100`
- ✅ **Clientes con historial de no-shows** (se usa para calcular risk_score)

Esto se ve en:
- **Dashboard del Agente IA** (`DashboardAgente.jsx`)
- **Función `calculate_dynamic_risk_score()`** en la base de datos

---

## 🎯 **RESUMEN EJECUTIVO**

| Característica | Estado Actual | ¿Funciona? |
|----------------|---------------|------------|
| Marcar no-show manualmente | ✅ Implementado | ✅ SÍ |
| Liberar slots al marcar no-show | ❌ NO implementado | ❌ NO |
| Enviar mensaje al marcar no-show | ⚠️ Medio implementado | ⚠️ Parcial |
| Detectar no-shows automáticamente | ❌ NO implementado | ❌ NO |
| Estadísticas de no-shows | ✅ Implementado | ✅ SÍ |

---

## 🚀 **MEJORAS SUGERIDAS**

### 1. **Liberar slots automáticamente al marcar no-show**
**Esfuerzo**: Bajo (1-2 horas)  
**Impacto**: Alto

Modificar el comportamiento para que cuando se marca `no_show`, se liberen los `availability_slots` automáticamente (igual que con `cancelled`).

### 2. **Implementar workflow automático de detección**
**Esfuerzo**: Medio (4-6 horas)  
**Impacto**: Alto

Implementar el workflow de N8N que detecta no-shows automáticamente después de 2 horas sin confirmación.

### 3. **Integrar sistema de mensajería real**
**Esfuerzo**: Alto (8-12 horas)  
**Impacto**: Medio

Conectar `scheduled_messages` con WhatsApp/SMS/Email para envío real de mensajes.

---

## ❓ **PREGUNTAS FRECUENTES**

### P: ¿Puedo programar mensajes a las 16:00h para reservas sin confirmar?
**R**: Sí, pero necesitas implementar el workflow automático de N8N o un sistema similar. Actualmente solo se programan manualmente.

### P: ¿Los espacios se liberan solos si marco no-show?
**R**: NO. Actualmente tienes que cancelar manualmente la reserva para liberar el espacio.

### P: ¿Se puede revertir un no-show?
**R**: Sí, simplemente editas la reserva y cambias el estado a `confirmed` o `completed`.

### P: ¿Los clientes con no-shows previos tienen penalización?
**R**: Sí, se usa en el cálculo de `risk_score` para priorizar confirmaciones.

---

**¿Necesitas que implemente alguna de estas mejoras?** 🚀

