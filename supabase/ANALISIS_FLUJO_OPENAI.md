# 📊 ANÁLISIS: ¿QUÉ ENVIAMOS A OPENAI Y QUÉ RECIBIMOS?

## 🔄 FLUJO COMPLETO

### 1️⃣ QUÉ SE ENVÍA A OPENAI

#### A. System Prompt (Instrucciones al asistente)
```
Eres Lua, asistente de Pelos Barbaros (peluqueria_barberia). Asistente virtual profesional

MISIÓN: Analiza 6 bloques, detecta lo MÁS IMPORTANTE, ordénalos, genera mensaje 
para Gustavo (máx 60 palabras) y propón 1 acción SI APLICA.

REGLAS:
- SOLO datos del snapshot (no inventes)
- PROHIBIDO: captación, ofertas, descuentos, promociones, "atraer clientes"
- ENFÓCATE: gestionar existente, optimizar recursos, resolver problemas
- Mensaje: máx 60 palabras | Texto colapsado: máx 20 palabras
- accion = null si no hay acción

BLOQUES (6): RESERVAS | EQUIPO | FACTURACION | COMUNICACIONES | NOSHOWS | CLIENTES

PRIORIDADES:
CRISIS (alert): ausentes_hoy>0 CON citas_afectadas | conflictos>0 → EQUIPO
RIESGO (serious): noshows horas_hasta<2 | incidencias_urgentes>0 → NOSHOWS/COMUNICACIONES
ATENCION (focused): VIP/nuevo minutos_hasta<240 → CLIENTES
INFORMATIVO (zen): día normal → RESERVAS/FACTURACION
CELEBRACION (excited): facturacion >150% promedio → FACTURACION
```

#### B. User Prompt (Datos del negocio)
El snapshot que viene de la función SQL `get_unified_dashboard_snapshot()`:

**ACTUALMENTE** (según RESTAURAR_FUNCION_ORIGINAL.sql):
```json
{
  "reservas": {},
  "equipo": {},
  "horarios": {},
  "facturacion": {},
  "comunicaciones": {},
  "noshows": {
    "en_riesgo_hoy": []
  },
  "clientes": {
    "especiales_hoy": []
  }
}
```

⚠️ **PROBLEMA**: La función actual devuelve objetos VACÍOS. No hay datos reales.

---

### 2️⃣ QUÉ RECIBE OpenAI

OpenAI recibe dos cosas:
1. **System Prompt**: 1,200 tokens aproximadamente
2. **User Prompt con datos**: Depende del tamaño del snapshot
   - Con snapshot vacío: ~50 tokens
   - Con snapshot lleno: 500-800 tokens estimados

**TOTAL ENVIADO**: ~1,250-2,000 tokens

---

### 3️⃣ QUÉ DEVUELVE OpenAI

OpenAI debe devolver un JSON con esta estructura:

```json
{
  "prioridad": "INFORMATIVO",
  "mood": "zen",
  "mensaje": "Todo en calma hoy. Sin citas programadas ni alertas activas.",
  "accion": null,
  "bloques": [
    {
      "id": "RESERVAS",
      "prioridad": 1,
      "texto_colapsado": "Sin citas programadas"
    },
    {
      "id": "EQUIPO",
      "prioridad": 2,
      "texto_colapsado": "Equipo completo disponible"
    },
    {
      "id": "FACTURACION",
      "prioridad": 3,
      "texto_colapsado": "Sin facturación registrada"
    },
    {
      "id": "COMUNICACIONES",
      "prioridad": 4,
      "texto_colapsado": "Sin mensajes pendientes"
    },
    {
      "id": "NOSHOWS",
      "prioridad": 5,
      "texto_colapsado": "Sin clientes en riesgo"
    },
    {
      "id": "CLIENTES",
      "prioridad": 6,
      "texto_colapsado": "Sin clientes especiales hoy"
    }
  ]
}
```

**TOKENS DEVUELTOS**: ~200-350 tokens

---

### 4️⃣ CÓMO SE USA EN EL DASHBOARD

El componente `BloqueAcordeon.jsx` renderiza cada uno de los 6 bloques:

#### **BLOQUE: RESERVAS**
- **Texto colapsado**: "Sin citas programadas" (viene de OpenAI)
- **Contenido expandido** (viene del snapshot de SQL):
  - ✅/⚠️ Conflictos (`data.reservas.conflictos`)
  - 🔵 Huecos libres (`data.reservas.huecos_salvables`)
  - 📅 Próxima cita:
    - Cliente (`data.reservas.proxima_cita.cliente`)
    - Hora (`data.reservas.proxima_cita.hora`)
    - Minutos hasta (`data.reservas.proxima_cita.minutos_hasta`)
    - Servicio (`data.reservas.proxima_cita.servicio`)

#### **BLOQUE: EQUIPO**
- **Texto colapsado**: "Equipo completo disponible" (OpenAI)
- **Contenido expandido** (SQL):
  - ✅/⚠️ Ausencias (`data.horarios.ausentes_hoy`)
  - Por cada ausente:
    - 👤 Nombre (`ausente.empleado`)
    - Tipo y razón (`ausente.tipo_ausencia`, `ausente.razon`)
    - 🔴 Citas afectadas (`ausente.citas_afectadas`)

#### **BLOQUE: FACTURACIÓN**
- **Texto colapsado**: "Sin facturación registrada" (OpenAI)
- **Contenido expandido** (SQL):
  - 💰 Total hoy (`data.facturacion.total_hoy`)
  - 🟢 Citas completadas (`data.facturacion.citas_completadas`)
  - 🟡 Citas pendientes (`data.facturacion.citas_pendientes`)
  - 📊 % vs Promedio (`data.facturacion.porcentaje_vs_promedio`)

#### **BLOQUE: COMUNICACIONES**
- **Texto colapsado**: "Sin mensajes pendientes" (OpenAI)
- **Contenido expandido** (SQL):
  - 📨 Mensajes pendientes (`data.comunicaciones.mensajes_pendientes`)
  - ⚠️ Incidencias urgentes (`data.comunicaciones.incidencias_urgentes`)

#### **BLOQUE: NOSHOWS**
- **Texto colapsado**: "Sin clientes en riesgo" (OpenAI)
- **Contenido expandido** (SQL):
  - Por cada cliente en riesgo:
    - Nombre (`cliente.cliente`)
    - Hora y servicio (`cliente.hora`, `cliente.servicio`)
    - Risk score (`cliente.risk_score`)

#### **BLOQUE: CLIENTES**
- **Texto colapsado**: "Sin clientes especiales hoy" (OpenAI)
- **Contenido expandido** (SQL):
  - Por cada cliente especial:
    - Nombre y badge (`cliente.cliente`, `cliente.badge`)
    - Hora (`cliente.hora`)
    - Motivo especial (`cliente.motivo`)

---

## 🔍 ANÁLISIS DE CALIDAD

### ✅ LO QUE ESTÁ BIEN

1. **Estructura clara de 6 bloques**: RESERVAS, EQUIPO, FACTURACIÓN, COMUNICACIONES, NOSHOWS, CLIENTES
2. **Separación de responsabilidades**:
   - OpenAI decide PRIORIDAD y ordena bloques
   - OpenAI genera MENSAJE corto para el dueño
   - SQL provee los DATOS detallados
3. **System Prompt bien definido**: Le dice a OpenAI qué hacer y qué NO hacer
4. **Límite de tokens claro**: 60 palabras mensaje, 20 palabras por texto colapsado

### ❌ PROBLEMAS ACTUALES

#### 1. **FUNCIÓN SQL DEVUELVE DATOS VACÍOS**
```sql
-- ACTUAL: Devuelve objetos vacíos sin información
v_reservas := '{}'::jsonb;
v_equipo := '{}'::jsonb;
v_facturacion := '{}'::jsonb;
```

**IMPACTO**: OpenAI recibe un snapshot vacío, por lo que:
- No puede detectar conflictos reales
- No puede priorizar correctamente
- Genera mensajes genéricos sin valor
- El dashboard muestra "Sin datos" en todo

#### 2. **INFORMACIÓN AMBIGUA: "huecos_salvables"**
- ¿Qué es un "hueco"? ¿1 hora? ¿30 minutos?
- ¿"Salvables" significa qué? ¿Que se pueden llenar?
- No es información accionable

#### 3. **FALTA INFORMACIÓN CRÍTICA POR EMPLEADO**
El snapshot NO incluye:
- Horas trabajadas por empleado
- Horas libres por empleado
- Conflictos específicos por empleado (ej: empleado con citas pero sin horario)

#### 4. **DATOS NO ENVIADOS A OPENAI**
El contenido expandido usa campos que NO están en el snapshot:
- `data.reservas.proxima_cita` ❌
- `data.horarios.ausentes_hoy` ❌
- `data.facturacion.total_hoy` ❌
- `data.comunicaciones.mensajes_pendientes` ❌
- `data.noshows.en_riesgo_hoy` ❌
- `data.clientes.especiales_hoy` ❌

**Resultado**: El dashboard muestra campos vacíos o `undefined`

---

## 🎯 RESUMEN EJECUTIVO

### QUÉ SE ENVÍA A OPENAI (ACTUALMENTE)
```json
{
  "reservas": {},
  "equipo": {},
  "horarios": {},
  "facturacion": {},
  "comunicaciones": {},
  "noshows": {"en_riesgo_hoy": []},
  "clientes": {"especiales_hoy": []}
}
```
**Tokens**: ~50 tokens (casi vacío)

### QUÉ DEVUELVE OPENAI
```json
{
  "prioridad": "INFORMATIVO",
  "mood": "zen",
  "mensaje": "Todo en calma, sin alertas",
  "accion": null,
  "bloques": [6 bloques con textos genéricos]
}
```
**Tokens**: ~250 tokens

### COSTO POR LLAMADA
- Input: 50 tokens × $0.15/1M = $0.0000075
- Output: 250 tokens × $0.60/1M = $0.00015
- **TOTAL**: $0.0001575 (~$0.00016 USD)

### ⚠️ PROBLEMA PRINCIPAL
**La función SQL está devolviendo objetos vacíos**, por lo que:
1. OpenAI no tiene datos reales que analizar
2. El dashboard no puede mostrar información útil
3. Los 6 bloques están siempre vacíos o con mensajes genéricos
4. Estás pagando por llamadas a OpenAI que no aportan valor

---

## 🚀 QUÉ DEBERÍA ENVIARSE (IDEAL)

### Ejemplo con datos REALES:

```json
{
  "reservas": {
    "total_hoy": 8,
    "proxima_cita": {
      "cliente": "Juan Pérez",
      "hora": "10:30",
      "minutos_hasta": 15,
      "servicio": "Corte + Barba",
      "empleado": "Carlos"
    },
    "conflictos": 0,
    "huecos_horas": 3
  },
  "equipo": {
    "empleados": [
      {
        "nombre": "Carlos",
        "horas_programadas": 8,
        "horas_ocupadas": 5,
        "horas_libres": 3,
        "tiene_horario": true,
        "tiene_reservas": true
      },
      {
        "nombre": "Laura",
        "horas_programadas": 0,
        "horas_ocupadas": 0,
        "horas_libres": 0,
        "tiene_horario": false,
        "tiene_reservas": true,
        "conflicto": "Tiene 2 citas pero no tiene horario hoy"
      }
    ],
    "ausentes_hoy": []
  },
  "facturacion": {
    "total_hoy": 180.50,
    "promedio_diario": 220.00,
    "porcentaje_vs_promedio": 82,
    "citas_completadas": 3,
    "citas_pendientes": 5
  },
  "noshows": {
    "en_riesgo_hoy": [
      {
        "cliente": "María López",
        "hora": "11:00",
        "servicio": "Mechas",
        "risk_score": 85,
        "telefono": "+34666777888"
      }
    ]
  },
  "comunicaciones": {
    "mensajes_pendientes": 2,
    "incidencias_urgentes": 0
  },
  "clientes": {
    "especiales_hoy": [
      {
        "cliente": "Pedro Gómez",
        "badge": "VIP",
        "hora": "12:00",
        "motivo": "Cliente premium - 15 visitas"
      }
    ]
  }
}
```

**Tokens**: ~600 tokens (con datos reales)

**BENEFICIO**: 
- OpenAI puede detectar conflictos reales
- Puede priorizar acciones (ej: "Laura tiene citas sin horario")
- Genera mensajes útiles ("Atención: conflicto con horario de Laura")
- El dashboard muestra información relevante

---

## 💡 CONCLUSIÓN

**SITUACIÓN ACTUAL**: La función SQL está rota y devuelve datos vacíos.

**IMPACTO**:
- OpenAI recibe información vacía → Respuestas genéricas
- Dashboard muestra bloques vacíos → Sin valor para el usuario
- Estás pagando ~$0.00016 por llamada que no aporta nada

**ACCIÓN NECESARIA**:
1. Restaurar o reemplazar la función `get_unified_dashboard_snapshot()` 
2. Asegurarse de que devuelve datos REALES de la base de datos
3. Incluir información por empleado (horas, conflictos)
4. Clarificar qué es un "hueco" (definir: 1 hueco = 1 hora libre)

