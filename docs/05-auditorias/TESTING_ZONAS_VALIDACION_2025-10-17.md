# ✅ TESTING Y VALIDACIÓN - SISTEMA DE ZONAS
**Fecha:** 17 de Octubre 2025  
**Objetivo:** Validar que el sistema de zonas funciona correctamente en todos los niveles

---

## 📋 CHECKLIST DE VALIDACIÓN PRE-PRODUCCIÓN

### **FASE 1: BASE DE DATOS** ✅

#### **Test 1.1: Ejecutar migraciones**
```bash
# En Supabase SQL Editor:
1. Ejecutar: supabase/migrations/20251017_001_normalize_table_zones.sql
2. Verificar output de logs (debe mostrar conteos por zona)
3. Ejecutar: supabase/migrations/20251017_002_add_preferred_zone_to_reservations.sql
4. Verificar output de estadísticas
```

**Resultado esperado:**
- ✅ ENUM `zone_type` creado
- ✅ Columna `tables.zone` convertida a ENUM
- ✅ Columna `reservations.preferred_zone` agregada
- ✅ Índices creados
- ✅ No hay errores

#### **Test 1.2: Verificar normalización de datos**
```sql
-- Verificar distribución de zonas en tables
SELECT zone, COUNT(*) as total
FROM tables
WHERE restaurant_id = 'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'
GROUP BY zone
ORDER BY total DESC;

-- Resultado esperado: Solo valores 'interior', 'terraza', 'barra', 'privado'
```

#### **Test 1.3: Probar función RPC actualizada**
```sql
-- Test de create_reservation_validated con zona
SELECT create_reservation_validated(
  'd6b63130-1ebf-4284-98fc-a3b31a85d9d1'::uuid,
  '{
    "reservation_date": "2025-10-20",
    "reservation_time": "20:00",
    "party_size": 4,
    "preferred_zone": "terraza",
    "customer_name": "Test Zona",
    "customer_phone": "+34600000000",
    "special_requests": "Test zona terraza",
    "status": "pending",
    "source": "manual",
    "channel": "web"
  }'::jsonb
);

-- Resultado esperado: success = true, reserva creada con preferred_zone = 'terraza'
```

---

### **FASE 2: FRONTEND** ✅

#### **Test 2.1: Página Mesas - Crear mesa**
**Pasos:**
1. Ir a `/mesas`
2. Clic en "Nueva Mesa"
3. Rellenar formulario:
   - Número de mesa: `T100`
   - Nombre: `Test Zona`
   - Zona: Seleccionar "☀️ Terraza"
   - Capacidad: `4`
4. Guardar

**Resultado esperado:**
- ✅ Dropdown de zona solo muestra 4 opciones
- ✅ Opciones tienen emojis y labels correctos
- ✅ Mesa se guarda con `zone = 'terraza'` (minúsculas)
- ✅ Aparece en lista de mesas

#### **Test 2.2: Wizard de Reservas - Paso 5 (Zona)**
**Pasos:**
1. Ir a `/reservas`
2. Clic en "Nueva Reserva"
3. Completar pasos 1-4 (teléfono, fecha, hora, personas)
4. Llegar al Paso 5 (Zona)

**Resultado esperado:**
- ✅ Muestra tarjetas con zonas disponibles
- ✅ Cada tarjeta muestra icono + nombre
- ✅ Muestra conteo de mesas disponibles por zona
- ✅ Solo muestra zonas con suficiente capacidad
- ✅ Permite seleccionar zona
- ✅ Continua al paso 6

#### **Test 2.3: Wizard de Reservas - Completar reserva con zona**
**Pasos:**
1. Completar wizard completo seleccionando zona "Terraza"
2. Guardar reserva

**Resultado esperado:**
- ✅ Reserva se guarda con `preferred_zone = 'terraza'`
- ✅ Aparece en lista de reservas
- ✅ Detalle de reserva muestra zona seleccionada

---

### **FASE 3: N8N WORKFLOWS** ✅

#### **Test 3.1: Tool check_availability - Con zona**
**Payload de prueba:**
```json
{
  "date": "2025-10-20",
  "time": "20:00",
  "party_size": 4,
  "preferred_zone": "terraza",
  "restaurant_id": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1"
}
```

**Resultado esperado:**
- ✅ Workflow ejecuta sin errores
- ✅ Filtra mesas solo de zona "terraza"
- ✅ Mensaje incluye "Sí tenemos disponibilidad en terraza"
- ✅ `detalles.zona_solicitada` = "terraza"

#### **Test 3.2: Tool check_availability - Sin zona (any)**
**Payload de prueba:**
```json
{
  "date": "2025-10-20",
  "time": "20:00",
  "party_size": 4,
  "preferred_zone": "any",
  "restaurant_id": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1"
}
```

**Resultado esperado:**
- ✅ Busca en todas las zonas
- ✅ Mensaje NO menciona zona específica
- ✅ `detalles.zona_solicitada` = null

#### **Test 3.3: Tool check_availability - Zona sin disponibilidad**
**Payload de prueba:**
```json
{
  "date": "2025-10-20",
  "time": "20:00",
  "party_size": 20,
  "preferred_zone": "barra",
  "restaurant_id": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1"
}
```

**Resultado esperado:**
- ✅ Retorna `disponible: false`
- ✅ Mensaje: "Lo siento, no tenemos mesas con capacidad suficiente para 20 personas en la zona barra. ¿Te iría bien en otra zona?"
- ✅ `accion_sugerida` = "sugerir_otra_zona"

#### **Test 3.4: Tool create_reservation - Con zona**
**Payload de prueba:**
```json
{
  "reservation_date": "2025-10-20",
  "reservation_time": "20:00",
  "party_size": 4,
  "preferred_zone": "terraza",
  "special_requests": "Test desde N8N",
  "restaurant_id": "d6b63130-1ebf-4284-98fc-a3b31a85d9d1"
}
```

**Resultado esperado:**
- ✅ Workflow ejecuta sin errores
- ✅ Reserva se crea con `preferred_zone = 'terraza'`
- ✅ Retorna `success: true`

---

### **FASE 4: SUPER AGENT (PROMPT v4)** ✅

#### **Test 4.1: Conversación normal - Grupo pequeño**
**Simulación:**
```
Cliente: "Quiero reservar para 4 el sábado"
Agente: "¿A qué hora?"
Cliente: "20:00"
Agente: "¿Tienes preferencia de zona? Tenemos interior, terraza o barra."
Cliente: "Terraza"
Agente: [check_availability con preferred_zone="terraza"]
```

**Resultado esperado:**
- ✅ Pregunta por zona DESPUÉS de hora y personas
- ✅ Solo ofrece: interior, terraza, barra (NO privado)
- ✅ Usa zona en check_availability
- ✅ Confirma disponibilidad mencionando zona

#### **Test 4.2: Grupo grande (≥ 8) - Sugerir privado**
**Simulación:**
```
Cliente: "Quiero reservar para 10 personas el sábado a las 20:00"
Agente: "Para grupos grandes tenemos una sala privada disponible. ¿Te interesaría, o prefieres la zona general?"
Cliente: "Sí, la privada"
Agente: [check_availability con preferred_zone="privado"]
```

**Resultado esperado:**
- ✅ Detecta grupo ≥ 8
- ✅ Sugiere sala privada proactivamente
- ✅ Usa zona en check_availability
- ✅ Confirma disponibilidad en privado

#### **Test 4.3: Keywords especiales - Sugerir privado**
**Simulación:**
```
Cliente: "Quiero una mesa tranquila para dos, es nuestro aniversario"
Agente: "¡Enhorabuena! Tenemos una sala más reservada que puede ser perfecta para la ocasión. ¿Te gustaría reservar ahí?"
Cliente: "Sí, por favor"
Agente: [check_availability con preferred_zone="privado"]
```

**Resultado esperado:**
- ✅ Detecta keywords: "tranquila", "aniversario"
- ✅ Sugiere sala privada
- ✅ Usa zona en check_availability

#### **Test 4.4: Cliente especifica zona en mensaje inicial**
**Simulación:**
```
Cliente: "Quiero reservar en la terraza para 4 el sábado a las 20:00"
Agente: "Perfecto, compruebo disponibilidad en terraza..."
Agente: [check_availability con preferred_zone="terraza"]
```

**Resultado esperado:**
- ✅ NO vuelve a preguntar por zona
- ✅ Usa zona especificada directamente
- ✅ Menciona zona en confirmación

#### **Test 4.5: Zona sin disponibilidad - Sugerir alternativa**
**Simulación:**
```
Cliente: "Quiero reservar en la terraza para 4 el sábado a las 20:00"
Agente: [check_availability → NO disponible en terraza]
Agente: "Veo que la terraza está completa a esa hora. ¿Te iría bien en el interior?"
Cliente: "Vale"
Agente: [check_availability con preferred_zone="interior"]
```

**Resultado esperado:**
- ✅ Informa que zona solicitada no tiene disponibilidad
- ✅ Sugiere zona alternativa
- ✅ Re-verifica con nueva zona

#### **Test 4.6: Cliente no especifica zona - Asignación automática**
**Simulación:**
```
Cliente: "Quiero reservar para 4 el sábado a las 20:00"
Agente: "¿Tienes preferencia de zona? Tenemos interior, terraza o barra. Si prefieres, puedo asignarte automáticamente."
Cliente: "Me da igual"
Agente: [check_availability con preferred_zone="any"]
```

**Resultado esperado:**
- ✅ Ofrece opción de asignación automática
- ✅ Usa "any" en check_availability
- ✅ Busca en todas las zonas

---

## 🔧 VALIDACIONES TÉCNICAS

### **Validación 1: Tipos de datos**
```sql
-- Verificar que zone es ENUM
SELECT data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'tables' AND column_name = 'zone';

-- Resultado esperado: USER-DEFINED, zone_type
```

### **Validación 2: Valores válidos del ENUM**
```sql
SELECT unnest(enum_range(NULL::zone_type)) as zona_valida;

-- Resultado esperado:
-- interior
-- terraza
-- barra
-- privado
```

### **Validación 3: Constraint NOT NULL**
```sql
-- Intentar insertar mesa sin zona (debe fallar)
INSERT INTO tables (restaurant_id, table_number, name, capacity, zone, is_active)
VALUES ('d6b63130-1ebf-4284-98fc-a3b31a85d9d1', 'TEST-NULL', 'Test', 4, NULL, true);

-- Resultado esperado: ERROR: null value in column "zone" of relation "tables" violates not-null constraint
```

### **Validación 4: Índices creados**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('tables', 'reservations')
  AND indexname LIKE '%zone%';

-- Resultado esperado:
-- idx_tables_zone
-- idx_reservations_preferred_zone
```

---

## 📊 CHECKLIST DE APROBACIÓN FINAL

### **Base de Datos**
- [ ] Migraciones ejecutadas sin errores
- [ ] ENUM `zone_type` creado correctamente
- [ ] Todos los valores normalizados (interior, terraza, barra, privado)
- [ ] Columna `preferred_zone` agregada a `reservations`
- [ ] Índices creados y funcionando
- [ ] Función RPC `create_reservation_validated` actualizada

### **Frontend**
- [ ] Dropdown de Mesas solo muestra 4 opciones
- [ ] Wizard de Reservas muestra Paso 5 (Zona) correctamente
- [ ] Iconos y labels se muestran correctamente
- [ ] Zona se guarda en minúsculas ('terraza', no 'Terraza')
- [ ] Constantes importadas y usadas correctamente

### **N8N Workflows**
- [ ] `check_availability` acepta `preferred_zone`
- [ ] `check_availability` filtra correctamente por zona
- [ ] `check_availability` maneja "any" correctamente
- [ ] `create_reservation` acepta `preferred_zone`
- [ ] `create_reservation` guarda zona en BD
- [ ] Mensajes de respuesta mencionan zona cuando corresponde

### **Super Agent (Prompt v4)**
- [ ] Ofrece interior, terraza y barra por defecto
- [ ] Solo sugiere privado cuando grupo ≥ 8
- [ ] Solo sugiere privado cuando detecta keywords
- [ ] No repite pregunta si cliente especificó zona
- [ ] Sugiere zona alternativa si solicitada no tiene disponibilidad
- [ ] Usa "any" cuando cliente dice "me da igual"
- [ ] JSON de tools incluye `preferred_zone`

### **Documentación**
- [ ] VERSION-HISTORY.md actualizado con v4
- [ ] Auditoría completa documentada
- [ ] Testing plan completo
- [ ] Rollback documentado

---

## 🚨 PROBLEMAS CONOCIDOS Y SOLUCIONES

### **Problema 1: Error "column zone does not exist"**
**Causa:** Migración no ejecutada  
**Solución:** Ejecutar `20251017_001_normalize_table_zones.sql`

### **Problema 2: Error "invalid input value for enum zone_type"**
**Causa:** Valor en mayúsculas o no válido  
**Solución:** Usar solo valores: 'interior', 'terraza', 'barra', 'privado' (minúsculas)

### **Problema 3: Frontend no muestra cambios**
**Causa:** Cache del navegador  
**Solución:** Hard refresh (Ctrl+Shift+R) o limpiar cache

### **Problema 4: N8N filter by zone no funciona**
**Causa:** Valor null en `preferred_zone` se interpreta como string "null"  
**Solución:** En nodo Supabase, solo agregar filtro si `zona !== null`

---

## 🎯 CRITERIOS DE ÉXITO

El sistema se considera **EXITOSO** si:

✅ **100% de tests pasan** (BD, Frontend, N8N, Prompt)  
✅ **0 errores en producción** después de 24h  
✅ **Agente menciona zona** correctamente en conversaciones  
✅ **Clientes pueden elegir zona** en reservas manuales  
✅ **Privado solo se sugiere** en casos apropiados  
✅ **Datos se guardan correctamente** en BD  

---

## 🔄 ROLLBACK (EN CASO DE PROBLEMAS CRÍTICOS)

Si hay problemas graves, ejecutar rollback:

```sql
BEGIN;

-- 1. Restaurar columna reservations
ALTER TABLE reservations DROP COLUMN IF EXISTS preferred_zone;
DROP INDEX IF EXISTS idx_reservations_preferred_zone;

-- 2. Restaurar columna tables
ALTER TABLE tables ALTER COLUMN zone TYPE varchar USING zone::varchar;

-- 3. Restaurar valores originales
UPDATE tables t
SET zone = b.zone
FROM tables_zones_backup b
WHERE t.id = b.id;

-- 4. Eliminar ENUM
DROP TYPE zone_type;

-- 5. Eliminar índices
DROP INDEX IF EXISTS idx_tables_zone;

-- 6. Limpiar backup
DROP TABLE IF EXISTS tables_zones_backup;

COMMIT;
```

**Luego:**
- Revertir cambios en frontend (volver a hardcodear opciones)
- Revertir workflows de N8N
- Reactivar PROMPT v3

---

**Última actualización:** 17 de Octubre 2025  
**Estado:** ✅ Listo para testing  
**Aprobado por:** Pendiente de testing

