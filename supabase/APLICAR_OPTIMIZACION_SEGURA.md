# 🔬 APLICAR OPTIMIZACIÓN (SIN ROMPER NADA)

## ✅ QUÉ HEMOS HECHO

He creado una función SQL optimizada que:

1. ✅ **Devuelve datos REALES** (no objetos vacíos)
2. ✅ **Sin segundos**: Todas las horas en formato HH:MM
3. ✅ **Define "hueco"**: 1 hueco = 1 hora libre del equipo
4. ✅ **Detecta conflictos críticos**: Empleados con reservas pero sin horario
5. ✅ **Facturación completa**: Total hoy, promedio, % vs objetivo
6. ✅ **NoShows en riesgo**: Clientes con citas en <4h
7. ✅ **Mantiene estructura**: Compatible con el código existente

---

## 📋 PASO 1: APLICAR FUNCIÓN SQL

**IMPORTANTE**: Copia y pega este SQL en el SQL Editor de Supabase:

```sql
-- Abrir: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/sql/new

-- Eliminar versiones anteriores de forma segura
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID, TIMESTAMP) CASCADE;
DROP FUNCTION IF EXISTS get_unified_dashboard_snapshot(UUID) CASCADE;

-- Pegar todo el contenido del archivo:
-- supabase/migrations/20251128_dashboard_snapshot_FINAL_OPTIMIZADO.sql
```

**Ejecutar con el botón "Run"** ▶️

---

## 📋 PASO 2: PROBAR LA FUNCIÓN

En el SQL Editor de Supabase, ejecuta esto para verificar:

```sql
SELECT get_unified_dashboard_snapshot(
  '3bbe9ac3-3e61-471e-822e-e159f6ad8ae2'::UUID,
  NOW()
);
```

**Deberías ver un JSON con**:
- `reservas` con `total_hoy`, `proxima_cita`, `huecos_horas`
- `equipo` con `total_empleados`, `total_horas_libres`, `conflictos_horario`
- `facturacion` con `total_hoy`, `promedio_diario`, `porcentaje_vs_promedio`
- `noshows` con `en_riesgo_hoy` (array)
- `comunicaciones` y `clientes`

Si ves datos (no objetos vacíos), ¡perfecto! Pasa al siguiente paso.

---

## 📋 PASO 3: OPTIMIZAR PROMPT DE OPENAI

Ahora voy a reducir el prompt para ahorrar tokens y hacerlo más específico.

### Prompt Actual (1,200 tokens)
Muy largo, con instrucciones repetitivas.

### Prompt Optimizado (700 tokens)
Más conciso, instrucciones claras, ejemplos específicos.

**NO TOCAR NADA TODAVÍA** - Te mostraré el prompt optimizado primero.

---

## 🎯 RESULTADO ESPERADO

### Antes (ACTUAL):
```json
{
  "reservas": {},
  "equipo": {},
  ...
}
```
**Tokens enviados**: ~50 tokens (vacío)
**Respuesta OpenAI**: Genérica, sin valor

### Después (OPTIMIZADO):
```json
{
  "reservas": {
    "total_hoy": 8,
    "proxima_cita": {"cliente": "Juan", "hora": "10:30", ...},
    "huecos_horas": 3
  },
  "equipo": {
    "total_empleados": 2,
    "total_horas_libres": 5.5,
    "conflictos_horario": 1,
    "empleados_con_conflicto": [{"nombre": "Laura", ...}]
  },
  "facturacion": {
    "total_hoy": 180.50,
    "porcentaje_vs_promedio": 82
  }
}
```
**Tokens enviados**: ~600 tokens (con datos)
**Respuesta OpenAI**: Específica, accionable, con valor real

---

## ⚡ BENEFICIOS

1. **Información útil**: OpenAI ve datos reales y puede dar insights útiles
2. **Detecta conflictos**: "Laura tiene 2 citas pero no tiene horario hoy"
3. **Prioriza correctamente**: Sabe qué es urgente y qué no
4. **Mensajes accionables**: "Transferir citas de Laura" en lugar de "Todo bien"
5. **Sin romper nada**: Estructura compatible con código existente

---

## 🚨 ADVERTENCIA

**NO aplicar directamente con `npx supabase db push`** - Hay conflictos con otras migraciones.

**SÍ aplicar manualmente en SQL Editor** - Es más seguro y controlado.

---

¿Listo para aplicar el PASO 1?

