# 🪑 IMPLEMENTACIÓN: Sistema de Combinación Inteligente de Mesas

## ✅ COMPLETADO - Listos para Implementar

**Fecha:** 22 Octubre 2025  
**Estado:** ✅ Todo el código creado y documentado  
**Siguiente paso:** Ejecutar en Supabase y N8N

---

## 🎯 ¿Qué hemos construido?

Un sistema que permite al agente IA combinar automáticamente varias mesas cuando no hay una mesa individual con capacidad suficiente.

### Ejemplo Real

**ANTES:**
```
Cliente: "Quiero 5 personas en terraza a las 20:00"
Agente: "Lo siento, no hay disponibilidad" ❌
(Aunque hay 3 mesas de 2 personas libres)
```

**AHORA:**
```
Cliente: "Quiero 5 personas en terraza a las 20:00"
Agente: "¡Perfecto! Prepararemos una zona uniendo 3 mesas 
         (Mesa T1, T2, T3) con capacidad de 6 personas" ✅
```

---

## 📦 Archivos Creados

### 1. Migraciones SQL (Supabase)
- ✅ `supabase/migrations/20251022_004_table_combinations_rpc.sql`
  - Función `find_table_combinations()`: Busca mesas individuales o combinaciones
  
- ✅ `supabase/migrations/20251022_005_create_combined_reservation.sql`
  - Función `create_combined_reservation()`: Crea reserva con múltiples mesas

### 2. Workflows N8N
- ✅ `n8n/workflows/Tool-check-availability-CON-COMBINACIONES.json`
  - Versión mejorada de `check_availability` que usa las RPCs
  
- ✅ `n8n/workflows/TOOL-create-reservation-CON-COMBINACIONES.json`
  - Versión mejorada de `create_reservation` que soporta múltiples slots

### 3. Documentación
- ✅ `n8n/workflows/README-COMBINACION-MESAS.md`
  - Guía completa: arquitectura, flujo, componentes, pruebas, troubleshooting

---

## 🚀 Pasos para Implementar

### PASO 1: Ejecutar Migraciones en Supabase (5 minutos)

1. **Accede a Supabase SQL Editor:**
   - https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql

2. **Ejecuta la primera migración:**
   ```
   Abre: supabase/migrations/20251022_004_table_combinations_rpc.sql
   Copia TODO el contenido
   Pega en SQL Editor
   Click "Run"
   ```

3. **Ejecuta la segunda migración:**
   ```
   Abre: supabase/migrations/20251022_005_create_combined_reservation.sql
   Copia TODO el contenido
   Pega en SQL Editor
   Click "Run"
   ```

4. **Verifica que se crearon correctamente:**
   ```sql
   SELECT 
       proname as function_name,
       pg_get_function_identity_arguments(oid) as arguments
   FROM pg_proc
   WHERE proname IN ('find_table_combinations', 'create_combined_reservation');
   ```
   
   ✅ Deberías ver ambas funciones listadas.

---

### PASO 2: Importar Workflows en N8N (5 minutos)

1. **Accede a N8N:**
   - https://gustausantin.app.n8n.cloud/

2. **Importar `check_availability` mejorado:**
   - Click en "➕" (arriba derecha)
   - "Import from File"
   - Seleccionar: `n8n/workflows/Tool-check-availability-CON-COMBINACIONES.json`
   - Click "Import"
   - ⚠️ **IMPORTANTE: Activar el workflow** (toggle arriba derecha)

3. **Importar `create_reservation` mejorado:**
   - Click en "➕"
   - "Import from File"
   - Seleccionar: `n8n/workflows/TOOL-create-reservation-CON-COMBINACIONES.json`
   - Click "Import"
   - ⚠️ **IMPORTANTE: Activar el workflow**

4. **Verificar credenciales:**
   - Abrir cada workflow importado
   - Los nodos de RPC usan **HTTP Request** con credencial "Supabase La-IA"
   - Verificar que los nodos "HTTP Request" tienen la credencial configurada
   - Si falta, seleccionarla del dropdown

**NOTA:** Los workflows usan **HTTP Request POST** para llamar a las funciones RPC de Supabase (no "Execute Query"). Esto es correcto y necesario para llamar a funciones personalizadas.

---

### PASO 3: Actualizar Super Agent (2 minutos)

**OPCIÓN A: Si las tools ya existen (probablemente tu caso)**

1. Abre workflow "Super Agent"
2. Click en nodo `AI Agent`
3. Busca la sección "Tools"
4. Para cada tool:
   - `check_availability` → Cambiar "Execute Workflow" al nuevo workflow
   - `create_reservation` → Cambiar "Execute Workflow" al nuevo workflow
5. Guardar

**OPCIÓN B: Si son tools nuevas**

Las tools ya están configuradas. No necesitas hacer nada más.

---

### PASO 4: Probar el Sistema (10 minutos)

#### Prueba 1: Mesa Individual (debe seguir funcionando como antes)

**Desde SQL Editor de Supabase:**
```sql
SELECT * FROM find_table_combinations(
  'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,  -- TU restaurant_id
  CURRENT_DATE + 1,  -- Mañana
  '20:00:00'::TIME,
  2,  -- 2 personas
  NULL  -- Cualquier zona
);
```

✅ **Resultado esperado:** `type: "single"`, una mesa individual.

---

#### Prueba 2: Combinación de Mesas (nueva funcionalidad)

**Preparar escenario:**
1. Ve a tu app → "Disponibilidad" → "Gestión de Horarios"
2. Asegúrate de tener solo mesas pequeñas (2-4 personas) libres en terraza a las 20:00

**Ejecutar prueba:**
```sql
SELECT * FROM find_table_combinations(
  'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::UUID,
  CURRENT_DATE + 1,
  '20:00:00'::TIME,
  6,  -- 6 personas (más grande que cualquier mesa individual)
  'terraza'
);
```

✅ **Resultado esperado:** `type: "combination"`, múltiples mesas, `num_tables: 2` o `3`.

---

#### Prueba 3: E2E vía WhatsApp (prueba real)

**Envía mensaje de WhatsApp al agente:**
```
Hola, quiero reservar para 6 personas mañana a las 20:00 en terraza
```

**Flujo esperado:**
1. Agente responde: "¡Perfecto! Sí tenemos disponibilidad. Prepararemos una zona uniendo X mesas..."
2. Agente pregunta: "¿Confirmo la reserva?"
3. Tú: "Sí"
4. Agente: "¡Listo! Tu reserva está confirmada..."

**Verificar en Supabase:**
```sql
-- Ver última reserva creada
SELECT 
  id,
  customer_name,
  reservation_date,
  reservation_time,
  party_size,
  special_requests,
  status
FROM reservations
WHERE source = 'agent_whatsapp'
ORDER BY created_at DESC
LIMIT 1;
```

✅ **Verificar:** `special_requests` debe contener "Mesa combinada: Mesa X, Mesa Y, Mesa Z".

---

## 🎓 Cómo Funciona (Resumen)

### Arquitectura

```
Cliente (WhatsApp)
    ↓
Super Agent (N8N)
    ↓
Tool: check_availability (N8N)
    ↓
RPC: find_table_combinations (Supabase) ← 🎯 MAGIA AQUÍ
    ↓
Retorna: mesas individuales O combinaciones
    ↓
Tool: create_reservation (N8N)
    ↓
RPC: create_combined_reservation (Supabase) ← 🎯 CREA RESERVA + MARCA SLOTS
    ↓
Agente confirma al cliente
```

### Lógica de `find_table_combinations`

1. **Busca mesa individual** con `capacity >= party_size`
   - Si encuentra → Retorna inmediatamente (tipo: "single")
   
2. **Si no hay individual, busca combinaciones:**
   - Obtiene todas las mesas libres en la zona
   - Combina hasta encontrar `suma >= party_size`
   - Prueba todas las combinaciones posibles (hasta 4 mesas)
   - Selecciona la mejor: menos mesas, menos capacidad desperdiciada
   - Retorna (tipo: "combination")
   
3. **Si no hay combinaciones posibles:**
   - Retorna `available: false`

### Lógica de `create_combined_reservation`

1. **Valida** que todos los slots estén disponibles
2. **Crea UNA reserva** en `reservations`
3. **Marca TODOS los slots** como `reserved`
4. **Guarda info de combinación** en `special_requests`
5. **Retorna** mensaje de confirmación

---

## 🔍 Monitoreo

### Ver reservas combinadas (últimos 7 días)
```sql
SELECT 
  customer_name,
  reservation_date,
  reservation_time,
  party_size,
  special_requests
FROM reservations
WHERE special_requests LIKE '%Mesa combinada:%'
  AND reservation_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Estadísticas
```sql
SELECT 
  COUNT(*) as total_combinadas,
  AVG(party_size) as personas_promedio
FROM reservations
WHERE special_requests LIKE '%Mesa combinada:%'
  AND reservation_date >= CURRENT_DATE - INTERVAL '30 days';
```

---

## ❓ FAQ

### ¿El agente necesita cambios?
**No.** El agente sigue llamando a las mismas tools (`check_availability` y `create_reservation`). La lógica de combinación es transparente.

### ¿Qué pasa si un cliente cancela una reserva combinada?
Al cancelar la reserva (cambiar status a `cancelled`), debes también liberar los slots:
```sql
-- Esto ya debería estar en tu lógica de cancelación
UPDATE availability_slots
SET status = 'free', is_available = true
WHERE id IN (SELECT slot_id FROM ...) -- IDs de la reserva
```

### ¿Cuántas mesas puede combinar como máximo?
Por defecto, hasta **4 mesas**. Puedes cambiar esto editando la variable `v_max_tables` en la RPC.

### ¿Combina mesas de diferentes zonas?
**No.** Solo combina mesas de la misma zona (terraza con terraza, interior con interior).

### ¿Qué pasa si dos clientes intentan reservar al mismo tiempo?
La RPC `create_combined_reservation` verifica disponibilidad antes de crear. Si otro cliente reservó primero, retorna error y el agente informa al cliente.

---

## 📚 Documentación Completa

Para más detalles, ver:
- **Guía completa:** `n8n/workflows/README-COMBINACION-MESAS.md`
- **Código RPC:** `supabase/migrations/20251022_004_table_combinations_rpc.sql`
- **Workflow check:** `n8n/workflows/Tool-check-availability-CON-COMBINACIONES.json`

---

## ✅ Checklist Final

- [ ] Ejecutar migración `20251022_004_table_combinations_rpc.sql`
- [ ] Ejecutar migración `20251022_005_create_combined_reservation.sql`
- [ ] Verificar funciones RPC en Supabase
- [ ] Importar workflow `check_availability` en N8N
- [ ] Activar workflow `check_availability`
- [ ] Importar workflow `create_reservation` en N8N
- [ ] Activar workflow `create_reservation`
- [ ] Actualizar tools en Super Agent
- [ ] Ejecutar Prueba 1: Mesa Individual
- [ ] Ejecutar Prueba 2: Combinación
- [ ] Ejecutar Prueba 3: E2E vía WhatsApp
- [ ] Monitorear primeras reservas en producción

---

**🎉 Una vez completado, el sistema estará activo y el agente podrá combinar mesas automáticamente!**

