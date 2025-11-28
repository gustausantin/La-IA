# 🚀 INSTRUCCIONES: Aplicar Mejoras al Dashboard

## ✅ LO QUE HE HECHO

1. ✅ **Creada migración SQL**: `20251128_dashboard_snapshot_mejorado.sql`
2. ✅ **Actualizado prompt de OpenAI**: `get-snapshot/index.ts`
3. ✅ **Eliminados segundos de las horas**: Frontend (BloqueAcordeon.jsx)

---

## 📝 LO QUE TÚ DEBES HACER

### **PASO 1: Aplicar la Migración SQL**

Ve a **Supabase Dashboard** → **SQL Editor** → **New Query**

Copia y pega el contenido de:
```
supabase/migrations/20251128_dashboard_snapshot_mejorado.sql
```

Haz clic en **RUN** ▶️

**Resultado esperado:**
```
Success: Function created successfully
```

---

### **PASO 2: Desplegar la Edge Function Actualizada**

Abre la terminal y ejecuta:

```bash
cd supabase
npx supabase functions deploy get-snapshot
```

**Resultado esperado:**
```
✓ Deployed function get-snapshot
```

---

### **PASO 3: Verificar que Funciona**

1. Abre tu dashboard en el navegador
2. Espera 2 minutos (o refresca)
3. Deberías ver:
   - ✅ Horas SIN segundos (16:00 en vez de 16:00:00)
   - ✅ Mensajes más específicos: "Pol tiene 3 horas libres"
   - ✅ Detección de conflictos: "⚠️ X tiene reservas pero NO está en el horario"

---

## 🔍 VERIFICAR LOGS

Ve a **Supabase** → **Edge Functions** → **get-snapshot** → **Logs**

Busca líneas como:
```
✅ Snapshot obtenido en XXms: {
  "equipo": {
    "detalle_empleados": [
      {"nombre": "Culebra", "horas_libres": 0, "estado": "lleno"},
      {"nombre": "Pol", "horas_libres": 3, "estado": "sin_reservas"},
      {"nombre": "Andrew", "horas_libres": 1, "estado": "ocupado"}
    ],
    "conflictos_horario": 0  // o >0 si hay conflictos
  }
}
```

---

## 🎯 QUÉ HACE LA NUEVA FUNCIÓN

### **ANTES** (lo que tenías):
```json
{
  "equipo": {
    "ausentes_hoy": []
  },
  "reservas": {
    "proxima_cita": {
      "hora": "16:00:00"  // ❌ Con segundos
    }
  }
}
```

### **DESPUÉS** (lo nuevo):
```json
{
  "equipo": {
    "total_horas_libres": 4,
    "ocupacion_promedio": 66,
    "conflictos_horario": 0,  // 🚨 Detecta empleados sin horario con reservas
    "detalle_empleados": [
      {
        "nombre": "Culebra",
        "horas_totales": 3,
        "horas_ocupadas": 3,
        "horas_libres": 0,
        "ocupacion_porcentaje": 100,
        "num_reservas": 3,
        "proxima_cita": "16:00",  // ✅ Sin segundos
        "estado": "lleno"
      },
      {
        "nombre": "Pol",
        "horas_totales": 3,
        "horas_ocupadas": 0,
        "horas_libres": 3,
        "ocupacion_porcentaje": 0,
        "num_reservas": 0,
        "proxima_cita": null,
        "estado": "sin_reservas"
      },
      {
        "nombre": "Andrew",
        "horas_totales": 3,
        "horas_ocupadas": 2,
        "horas_libres": 1,
        "ocupacion_porcentaje": 66,
        "num_reservas": 2,
        "proxima_cita": "17:00",  // ✅ Sin segundos
        "estado": "ocupado"
      }
    ]
  },
  "reservas": {
    "proxima_cita": {
      "hora": "16:00"  // ✅ Sin segundos
    }
  }
}
```

---

## 🎨 MENSAJES MEJORADOS QUE VERÁS

### **Antes:**
> "Sin conflictos ni ausencias. 3 huecos libres"

### **Después (ejemplos):**

#### Escenario 1: Todo bien
> "Culebra lleno (3h), Pol libre (3h), Andrew ocupado (2/3h). Total: 4 horas disponibles"

#### Escenario 2: Conflicto detectado
> "⚠️ URGENTE: Juan tiene 2 reservas pero NO está en el horario de hoy. Debes reasignarlas o cancelar"

#### Escenario 3: Desequilibrio
> "Culebra al 100% mientras Pol está sin reservas. ¿Redistribuir carga?"

---

## ❓ PREGUNTAS FRECUENTES

### ¿Qué es un "hueco" ahora?
**1 hueco = 1 hora libre**. El sistema ahora dice "horas libres" en lugar de "huecos".

### ¿Detecta empleados sin horario con reservas?
**SÍ**. Es el campo `conflictos_horario` en la respuesta.

### ¿Puedo ver el detalle por empleado en el frontend?
**Todavía NO**. Por ahora OpenAI lo analiza y genera el mensaje. Si quieres mostrarlo visualmente en el dashboard, necesitamos crear un nuevo componente.

---

## 🐛 SI ALGO FALLA

### Error: "Function does not exist"
- La migración no se aplicó correctamente
- Vuelve a copiar el SQL y ejecútalo de nuevo

### Error: "column does not exist"
- Tu tabla `employees` o `employee_schedules` no tiene las columnas esperadas
- Comparte el error exacto y lo arreglo

### Los mensajes no cambian
- La Edge Function no se desplegó
- Ejecuta de nuevo: `npx supabase functions deploy get-snapshot`
- Limpia la caché del navegador (Ctrl+Shift+R)

---

## 📞 SIGUIENTE PASO

Después de aplicar esto, dime:
1. ¿Se aplicó la migración correctamente?
2. ¿Qué mensaje muestra ahora el dashboard?
3. ¿Detecta algún conflicto?

¡Y seguimos mejorando! 🚀

