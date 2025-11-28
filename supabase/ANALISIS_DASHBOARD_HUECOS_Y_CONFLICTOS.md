# 🔍 ANÁLISIS: Problemas del Dashboard y Soluciones

## 📊 PROBLEMAS IDENTIFICADOS

### 1️⃣ **"Huecos" es AMBIGUO**

**Problema Actual:**
- Mensaje: "3 huecos libres"
- ❌ No se especifica: ¿3 horas? ¿3 slots de 30min? ¿3 slots de 15min?

**Solución:**
```javascript
// OPCIÓN A: Especificar unidad
"3 horas libres"
"6 slots de 30min libres"

// OPCIÓN B: Ser más descriptivo
"Pol tiene 3 horas libres, Andrew 1 hora libre"
```

**DECISIÓN REQUERIDA:** ¿Qué es un "hueco"?
- [ ] 1 hora completa
- [ ] 30 minutos
- [ ] 15 minutos
- [ ] Variable según duración del servicio

---

### 2️⃣ **CONFLICTO CRÍTICO NO DETECTADO**

**Escenario Real (según imagen):**
```
Empleado: "X"
- Horario configurado: NINGUNO (sin turno)
- Reservas asignadas: SÍ (tiene citas)
- Resultado: ❌ Clientes llegarán y no habrá nadie
```

**¿Por qué no se detecta?**
El RPC `get_unified_dashboard_snapshot` probablemente NO está verificando:
```sql
-- Query que FALTA:
SELECT 
  e.name as empleado,
  COUNT(a.id) as reservas_asignadas,
  (SELECT COUNT(*) FROM employee_schedules WHERE employee_id = e.id AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE)) as tiene_horario
FROM employees e
LEFT JOIN appointments a ON a.employee_id = e.id AND a.appointment_date = CURRENT_DATE
WHERE e.business_id = $1
GROUP BY e.id
HAVING COUNT(a.id) > 0 AND tiene_horario = 0;
```

**OpenAI debe recibir:**
```json
{
  "equipo": {
    "ausentes_hoy": 0,
    "conflictos_criticos": 1,  // ⚠️ NUEVO
    "empleados_sin_horario_con_reservas": [  // ⚠️ NUEVO
      {
        "nombre": "Empleado X",
        "reservas_asignadas": 2,
        "primera_cita": "16:00",
        "accion_requerida": "reasignar o cancelar"
      }
    ]
  }
}
```

---

### 3️⃣ **ANÁLISIS POR EMPLEADO INCOMPLETO**

**Datos actuales enviados a OpenAI:**
```json
{
  "equipo": {
    "ausentes_hoy": 0,
    "total_empleados": 3
  }
}
```

**Datos NECESARIOS:**
```json
{
  "equipo": {
    "ausentes_hoy": 0,
    "total_empleados": 3,
    "detalle_empleados": [  // ⚠️ NUEVO
      {
        "nombre": "Culebra",
        "sillon": 1,
        "horas_totales": 3,
        "horas_ocupadas": 3,
        "horas_libres": 0,
        "ocupacion_porcentaje": 100,
        "proxima_cita": null  // lleno
      },
      {
        "nombre": "Pol",
        "sillon": 2,
        "horas_totales": 3,
        "horas_ocupadas": 0,
        "horas_libres": 3,
        "ocupacion_porcentaje": 0,
        "proxima_cita": null  // sin reservas
      },
      {
        "nombre": "Andrew",
        "sillon": 3,
        "horas_totales": 3,
        "horas_ocupadas": 2,
        "horas_libres": 1,
        "ocupacion_porcentaje": 66,
        "proxima_cita": "17:00"
      }
    ]
  }
}
```

---

## 🛠️ SOLUCIONES PROPUESTAS

### **SOLUCIÓN 1: Modificar el RPC SQL**

Necesitamos actualizar `get_unified_dashboard_snapshot` para incluir:

1. **Detección de conflictos críticos**
2. **Análisis detallado por empleado**
3. **Definición clara de "huecos"**

**Ubicación del RPC:**
- Buscar en: Supabase Dashboard → SQL Editor
- O ejecutar: `\df get_unified_dashboard_snapshot` en psql

---

### **SOLUCIÓN 2: Actualizar el Prompt de OpenAI**

Modificar `buildSystemPrompt()` en `get-snapshot/index.ts`:

```typescript
CONFLICTOS CRÍTICOS A DETECTAR:

1. EMPLEADO SIN HORARIO CON RESERVAS:
   - Prioridad: CRISIS
   - Mensaje: "⚠️ [Nombre] tiene [N] reservas pero NO está en el horario de hoy"
   - Acción: reasignar_reservas o cancelar_y_avisar

2. EMPLEADO AUSENTE CON RESERVAS:
   - Prioridad: CRISIS
   - Mensaje: "⚠️ [Nombre] está ausente pero tiene [N] reservas"
   - Acción: transferir_citas

3. HUECOS MAL DISTRIBUIDOS:
   - Si un empleado está 100% ocupado y otro 0%, sugerir redistribuir
```

---

### **SOLUCIÓN 3: Mejorar mensajes del dashboard**

**Actual:**
> "Sin conflictos ni ausencias. 3 huecos libres"

**Propuesto (OPCIÓN A - Simple):**
> "Todo fluye bien. Pol y Andrew tienen 4 horas libres en total"

**Propuesto (OPCIÓN B - Detallado):**
> "Culebra lleno, Pol libre (3h), Andrew con 1h libre. Total: 4 horas disponibles"

**Propuesto (OPCIÓN C - Accionable):**
> "4 horas libres hoy. ¿Quieres activar captación para llenarlas?"

---

## ✅ ACCIONES INMEDIATAS

### Para el Usuario (tú):
1. **Decidir qué es un "hueco"**: ¿hora, 30min, 15min?
2. **Confirmar acceso a la BD**: ¿Tienes acceso al SQL Editor de Supabase?
3. **Priorizar qué implementar primero**:
   - [ ] Detección de conflicto crítico (empleado sin horario con reservas)
   - [ ] Análisis detallado por empleado
   - [ ] Mejorar definición de "huecos"

### Para implementar:
1. **Modificar el RPC** (requiere acceso a Supabase SQL Editor)
2. **Actualizar el prompt** (modificar `get-snapshot/index.ts`)
3. **Probar con datos reales**

---

## 📝 NOTAS ADICIONALES

**¿Por qué OpenAI no detecta esto ahora?**
- ❌ No recibe la información necesaria del RPC
- ❌ El prompt no le indica qué buscar
- ❌ Los datos llegan agregados, no detallados por empleado

**¿Qué necesitamos para arreglarlo?**
1. RPC que devuelva datos detallados
2. Prompt que indique a OpenAI qué analizar
3. Frontend que muestre la información correctamente

---

## 🚀 PRÓXIMO PASO

**PREGUNTA PARA EL USUARIO:**
1. ¿Tienes acceso al SQL Editor de Supabase?
2. ¿Puedes compartir un ejemplo de los datos que actualmente devuelve el RPC?
3. ¿Qué prefieres: que cree el SQL nuevo o que te diga qué buscar?


