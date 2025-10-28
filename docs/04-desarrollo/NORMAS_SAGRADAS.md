# 🔥 NORMAS SAGRADAS - NUNCA VIOLAR

## ⚠️ ESTAS NORMAS SON ÓRDENES ABSOLUTAS - NO NEGOCIABLES

---

## 🎯 NORMA 1: AJUSTES QUIRÚRGICOS, NUNCA DEGRADAR LA CALIDAD

### ✅ LA APLICACIÓN YA ESTÁ PERFECTA
- Cualquier cambio debe ser: **pequeño, preciso, dirigido**
- **NUNCA** simplificar lógica solo para "hacerlo funcionar"
- **NUNCA** quitar funcionalidades para resolver un problema

### 🎯 ANTE CUALQUIER PROBLEMA:
- Enfrentarlo directamente
- Solucionarlo sin degradar
- Mejorar y escalar

### 🚫 PROHIBIDO:
- Simplificar para reducir funciones
- "Temporal" que se vuelve permanente
- Atajos que comprometen calidad

### 🎯 OBJETIVO:
**Construir la mejor aplicación de reservas del mundo, no un producto mediocre**

### ✅ EXCEPCIÓN:
Solo simplificar si **incrementa** calidad o claridad, nunca para reducir funciones

---

## 📊 NORMA 2: DATOS REALES, NADA INVENTADO

### 🚫 JAMÁS:
- Usar datos ficticios, inventados o "moqueados"
- Hardcodear valores (ej: `slotsMarked: 0`, `daysProtected: 0`)
- Asumir valores por defecto sin consultarlos
- Poner valores "temporales" que nunca se actualizan

### ✅ SIEMPRE:
- **TODOS** los datos deben provenir de tablas reales de Supabase
- **TODOS** los cálculos basados en datos reales
- Consultar BD para **CADA** dato que se muestre al usuario
- Si un dato no existe, consultarlo, **NO** inventarlo

### 📋 EJEMPLOS DE LO QUE NUNCA HACER:
```javascript
// ❌ MAL - Hardcodeado
slotsMarked: 0
daysProtected: 0
duration: 90

// ✅ BIEN - De BD
slotsMarked: realStats?.reserved || 0  // De query real
daysProtected: results?.days_protected || 0  // Del SQL
duration: businessesettings?.reservation_duration || 60  // De settings
```

### 🎯 OBJETIVO:
**Integridad y fiabilidad total del producto**

---

## 🌍 NORMA 3: MULTI-TENANT SIEMPRE

### 🎯 PENSAMIENTO GLOBAL:
- **TODA** funcionalidad debe pensarse para múltiples tenants desde el inicio
- **CADA** dato, consulta y flujo debe respetar aislamiento por tenant

### ✅ SIEMPRE:
- Filtrar por `restaurant_id` en TODAS las queries
- Roles y accesos definidos en contexto multi-tenant
- Escalabilidad y performance validadas globalmente

### 🚫 NUNCA:
- Hardcodear `restaurant_id`
- Asumir "solo hay un restaurante"
- Crear lógica que solo funciona para un caso específico

### 🎯 OBJETIVO:
**Una plataforma mundial, no una app local o monoinquilino**

---

## 🔍 NORMA 4: REVISAR SUPABASE ANTES DE CREAR TABLAS

### ✅ ANTES de crear cualquier tabla, columna o índice:
1. **REVISAR** el esquema existente en Supabase
2. **VERIFICAR** nombres de tablas y columnas
3. **CONFIRMAR** que no existe ya
4. **DOCUMENTAR** y justificar si es nuevo

### 🚫 NUNCA:
- Duplicar información o estructuras
- Asumir que una tabla existe sin verificar
- Crear columnas que ya existen con otro nombre
- Usar nombres de columnas sin confirmarlos

### 📋 PROCESO CORRECTO:
1. Abrir Supabase
2. Verificar esquema actual
3. Si existe → Usar
4. Si no existe → Documentar y justificar
5. SOLO ENTONCES → Crear

### 🎯 OBJETIVO:
**Coherencia, orden y evitar deuda técnica**

---

## 🔥 RECORDATORIO FINAL:

### Estas normas existen porque:
1. ✅ Garantizan calidad profesional
2. ✅ Evitan errores costosos
3. ✅ Mantienen integridad de datos
4. ✅ Aseguran escalabilidad

### Si alguna vez piensas violarlas:
1. 🛑 **DETENTE**
2. 🤔 Pregúntate: "¿Por qué quiero hacer esto?"
3. 📖 Relee la norma
4. ✅ Encuentra la forma correcta

---

**Estas normas son ÓRDENES, no sugerencias.**

**Última actualización:** 2025-10-07
