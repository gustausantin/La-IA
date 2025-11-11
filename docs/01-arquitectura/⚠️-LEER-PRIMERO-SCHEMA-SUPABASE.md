# ⚠️ SCHEMA DE SUPABASE - FUENTE DE VERDAD ÚNICA

**Fecha de extracción:** 11 de Noviembre de 2025  
**Fuente:** Supabase Dashboard (SQL queries directas)

---

## 🔴 **REGLA CRÍTICA:**

### **ANTES DE CODIFICAR CUALQUIER QUERY A SUPABASE:**
1. ✅ **REVISAR ESTOS 5 ARCHIVOS PRIMERO**
2. ✅ **NO ADIVINAR NOMBRES DE TABLAS O COLUMNAS**
3. ✅ **NO ASUMIR QUE EXISTEN FOREIGN KEYS SIN VERIFICAR**

---

## 📁 **LOS 5 ARCHIVOS DE REFERENCIA:**

### **1️⃣ SCHEMA-REAL-SUPABASE-2025-11-11.json**
**¿Qué contiene?**
- ✅ Todas las tablas y columnas
- ✅ Tipos de datos de cada columna
- ✅ Valores por defecto
- ✅ Si es nullable o no

**Cuándo usarlo:**
- "¿Existe la tabla X?"
- "¿Qué columnas tiene la tabla Y?"
- "¿El campo se llama `last_name` o `last_name1`?"
- "¿Es `is_active` o `is_available`?"

**Ejemplo:**
```json
{
  "table_name": "employee_absences",
  "column_name": "reason",
  "data_type": "character varying",
  "is_nullable": "NO"
}
```

---

### **2️⃣ FOREIGN-KEYS-2025-11-11.json**
**¿Qué contiene?**
- ✅ Todas las relaciones entre tablas (foreign keys)
- ✅ Tabla origen y destino
- ✅ Columna origen y destino

**Cuándo usarlo:**
- "¿Puedo hacer join de `appointments` con `services`?"
- "¿`employee_absences` tiene FK a `employees`?"
- **CRÍTICO:** Si hay **múltiples FK** entre 2 tablas, Supabase falla el join automático

**Ejemplo:**
```json
{
  "tabla_origen": "employee_absences",
  "columna_origen": "employee_id",
  "tabla_destino": "employees",
  "columna_destino": "id"
},
{
  "tabla_origen": "employee_absences",
  "columna_origen": "approved_by",
  "tabla_destino": "employees",
  "columna_destino": "id"
}
```
⚠️ **2 FK a `employees`** → **Join automático FALLA** → **Hacer join MANUAL**

---

### **3️⃣ ENUMS-2025-11-11.json**
**¿Qué contiene?**
- ✅ Todos los tipos ENUM (appointment_status, channel_type, etc.)
- ✅ Valores válidos de cada enum

**Cuándo usarlo:**
- "¿Qué valores puede tener `status`?"
- "¿Es 'confirmed' o 'CONFIRMED'?"
- "¿Qué verticals existen?"

**Ejemplo:**
```json
{
  "enum_name": "appointment_status",
  "enum_value": "confirmed"
},
{
  "enum_name": "vertical_type",
  "enum_value": "peluqueria_barberia"
}
```

---

### **4️⃣ FUNCTIONS-RPC-2025-11-11.json**
**¿Qué contiene?**
- ✅ Todas las funciones SQL y RPCs disponibles
- ✅ Nombre de la función
- ✅ Tipo de retorno
- ✅ Definición completa

**Cuándo usarlo:**
- "¿Existe una función para calcular segmentos CRM?"
- "¿Cómo se llama la función de no-shows?"
- "¿Qué parámetros necesita?"

**Ejemplo:**
```json
{
  "function_name": "calculate_customer_segment",
  "return_type": "character varying"
},
{
  "function_name": "predict_upcoming_noshows_v2",
  "return_type": "record"
}
```

---

### **5️⃣ INDICES-2025-11-11.json** (Archivo 3 que pasaste)
**¿Qué contiene?**
- ✅ Todos los índices
- ✅ Primary keys
- ✅ Unique constraints

**Cuándo usarlo:**
- "¿Hay un índice que optimice esta query?"
- "¿Qué campos tienen unique constraint?"

---

## 🎯 **CASOS DE USO REALES:**

### **❌ ERROR COMÚN:**
```javascript
// ❌ ASUMIR que existe employees.schedules
const { data } = await supabase
  .from('employees')
  .select('name, schedules');  // ❌ schedules no existe
```

### **✅ CORRECTO:**
```javascript
// 1. REVISAR: SCHEMA-REAL-SUPABASE-2025-11-11.json
// Buscar "employees" → Ver columnas disponibles
// Resultado: NO hay columna "schedules"

// 2. REVISAR: FOREIGN-KEYS-2025-11-11.json
// Buscar employee_schedules → employees
// Resultado: Hay FK employee_schedules.employee_id → employees.id

// 3. CODIFICAR CORRECTAMENTE:
const { data: employees } = await supabase
  .from('employees')
  .select('id, name, is_active');

const { data: schedules } = await supabase
  .from('employee_schedules')
  .select('*')
  .eq('employee_id', employeeId);

// JOIN MANUAL
```

---

## 🔥 **REGLAS DE ORO:**

### **1. NOMBRES DE TABLAS:**
- ✅ `employee_absences` (NO `absences`, NO `employee_absence`)
- ✅ `availability_slots` (NO `available_slots`, NO `slots`)
- ✅ `appointments` (NO `reservations`, NO `bookings`)
- ✅ `customers` (NO `clients`, NO `clientes`)

### **2. NOMBRES DE COLUMNAS:**
- ✅ `is_available` (servicios/slots)
- ✅ `is_active` (employees/business_services)
- ✅ `appointment_date` + `appointment_time` (NO `reservation_date`, NO `start_time`)
- ✅ `customer_name` (NO `name` en appointments)
- ✅ `last_name` (NO `last_name1`, NO `last_name2`)

### **3. FOREIGN KEYS MÚLTIPLES:**
Si ves **2+ FK entre las mismas tablas** → **JOIN MANUAL OBLIGATORIO**

Ejemplo: `employee_absences` tiene 2 FK a `employees`:
- `employee_id` → employees.id
- `approved_by` → employees.id

**Solución:**
```javascript
// ❌ NO hacer:
.select('*, employees(name)')  // Supabase no sabe qué FK usar

// ✅ Hacer:
const absences = await supabase.from('employee_absences').select('employee_id, approved_by');
const employees = await supabase.from('employees').select('id, name');
// Join manual en código
```

---

## 📋 **CHECKLIST ANTES DE CODIFICAR:**

- [ ] ¿Revisé `SCHEMA-REAL-SUPABASE-2025-11-11.json` para ver si la tabla existe?
- [ ] ¿Verifiqué los nombres exactos de las columnas?
- [ ] ¿Revisé `FOREIGN-KEYS-2025-11-11.json` para ver si puedo hacer join automático?
- [ ] ¿Hay múltiples FK? → Hacer join manual
- [ ] ¿Revisé `ENUMS-2025-11-11.json` para valores válidos?
- [ ] ¿Existe una función RPC que haga lo que necesito?

---

## 🚨 **SI APARECE ERROR DE SUPABASE:**

### **Error típico 1:**
```
"Could not find the table 'X' in the schema cache"
```
**Solución:** Revisar **archivo 1** (SCHEMA) para ver el nombre correcto

### **Error típico 2:**
```
"Could not find the 'X' column in the schema cache"
```
**Solución:** Revisar **archivo 1** (SCHEMA) para ver las columnas de esa tabla

### **Error típico 3:**
```
"Could not find a relationship between 'A' and 'B'"
```
**Solución:** Revisar **archivo 2** (FOREIGN-KEYS). Si no hay FK o hay múltiples, hacer **join manual**

### **Error típico 4:**
```
"More than one relationship was found for 'A' and 'B'"
```
**Solución:** Revisar **archivo 2** (FOREIGN-KEYS). Si hay 2+ FK, **join manual OBLIGATORIO**

---

## 💾 **UBICACIÓN DE LOS ARCHIVOS:**

```
docs/01-arquitectura/
  ├── ⚠️-LEER-PRIMERO-SCHEMA-SUPABASE.md  ← ESTE ARCHIVO
  ├── SCHEMA-REAL-SUPABASE-2025-11-11.json  ← 1️⃣ TABLAS Y COLUMNAS
  ├── FOREIGN-KEYS-2025-11-11.json         ← 2️⃣ RELACIONES
  ├── ENUMS-2025-11-11.json                ← 3️⃣ TIPOS ENUM
  ├── INDICES-2025-11-11.json              ← 4️⃣ ÍNDICES
  └── FUNCTIONS-RPC-2025-11-11.json        ← 5️⃣ FUNCIONES
```

---

## 🔄 **CUÁNDO ACTUALIZAR:**

- ✅ Después de ejecutar una migración SQL
- ✅ Después de crear/modificar tablas en Supabase
- ✅ Después de añadir foreign keys
- ✅ Si aparecen errores de schema que no deberían existir

**Comando para actualizar:**
```sql
-- Ejecutar las 5 queries en Supabase SQL Editor
-- Exportar resultados a JSON
-- Reemplazar estos 5 archivos
```

---

## ✅ **SIEMPRE CONSULTAR AQUÍ PRIMERO**

**NO CODIFICAR SIN REVISAR** 🚫  
**REVISAR → VERIFICAR → CODIFICAR** ✅


