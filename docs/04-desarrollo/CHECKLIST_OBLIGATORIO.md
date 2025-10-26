# ✅ CHECKLIST OBLIGATORIO ANTES DE ENTREGAR CÓDIGO

## 🔴 VERIFICAR ANTES DE CADA RESPUESTA:

### 📊 DATOS REALES (NORMA 2)
- [ ] ¿Todos los datos vienen de BD? (NO hardcoding)
- [ ] ¿He consultado las tablas reales de Supabase?
- [ ] ¿Los cálculos usan datos reales? (ej: 7 reservas = 14 slots si duración = 2 slots)
- [ ] ¿He verificado que NO hay valores inventados? (0, null por defecto, etc.)

### 🔍 VERIFICACIÓN DE ESQUEMA (NORMA 4)
- [ ] ¿He verificado nombres de tablas en Supabase?
- [ ] ¿He verificado nombres de columnas?
- [ ] ¿He verificado tipos de datos?
- [ ] ¿Existe la función/RPC que voy a usar?

### 🛡️ CALIDAD Y ROBUSTEZ
- [ ] ¿Hay manejo de errores para CADA query?
- [ ] ¿He anticipado qué puede fallar?
- [ ] ¿Qué pasa si la BD no responde?
- [ ] ¿Qué pasa si los datos están vacíos?

### 🎯 RESPETO A LAS 4 NORMAS
- [ ] NORMA 1: ¿Es un ajuste quirúrgico? (NO degradar calidad)
- [ ] NORMA 2: ¿TODOS los datos son reales? (NO inventados)
- [ ] NORMA 3: ¿Funciona multi-tenant? (NO hardcodear restaurant_id)
- [ ] NORMA 4: ¿He revisado Supabase ANTES de crear/modificar?

### 📖 LECTURA PREVIA
- [ ] ¿He leído el código existente ANTES de modificar?
- [ ] ¿Entiendo qué hace el código actual?
- [ ] ¿Mi cambio respeta la arquitectura existente?

### 🧪 VALIDACIÓN DE LÓGICA
- [ ] ¿Los cálculos matemáticos son correctos?
- [ ] ¿Las condiciones lógicas tienen sentido?
- [ ] ¿He probado mentalmente casos extremos?

---

## 🚨 SI ALGUNA RESPUESTA ES "NO" → **NO ENTREGAR CÓDIGO**

## 🎯 PROCESO CORRECTO:
1. Leer CHECKLIST
2. Verificar CADA punto
3. Si falta algo → Investigar/Consultar BD
4. SOLO ENTONCES → Escribir código
5. Revisar código contra CHECKLIST
6. Entregar

---

**Última actualización:** 2025-10-07
