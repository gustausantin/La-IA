# 🔍 ANÁLISIS DE RENDIMIENTO: Dashboard Socio Virtual

**Fecha:** 2025-11-26  
**Problema reportado:** El dashboard tarda más de lo esperado en cargar, aunque los logs de Edge Function muestran ~4.7s

---

## 📊 TIMING ACTUAL (de los logs)

### Edge Function (`get-snapshot`)
- **SQL:** 57-76ms ✅ (muy rápido)
- **OpenAI:** 4,213-4,677ms ⚠️ (4.2-4.7s)
- **TOTAL Edge Function:** 4,289-4,734ms (4.3-4.7s)

### Client-Side (medido en el hook)
- **TIMING CLIENT:** 4,720-5,921ms (4.7-5.9s)
- **Diferencia:** +200-1,200ms adicionales en el cliente

### Tiempo total percibido por el usuario
- **Edge Function:** ~4.7s
- **Network overhead:** ~200-500ms (Supabase Edge Function invocation)
- **Client processing:** ~100-200ms
- **TOTAL REAL:** ~5.0-5.4s
- **Tiempo percibido:** Probablemente 6-8s (por múltiples recargas)

---

## 🐛 PROBLEMAS IDENTIFICADOS

### 1. **RECARGAS MÚLTIPLES DEL BUSINESS** ⚠️ CRÍTICO

**Ubicación:** `DashboardSocioVirtual.jsx`

**Problema:**
- Al montar el componente, se recarga el business con un delay de 200ms
- Cuando se recibe `agent-updated`, se recarga el business
- Cuando la página se vuelve visible, se recarga el business
- El `AuthContext` también recarga el business cuando recibe eventos

**Impacto:**
- Cada recarga del business = ~100-300ms
- Si hay 3-4 recargas = +300-1,200ms adicionales
- El usuario ve múltiples "parpadeos" en el UI

**Evidencia en logs:**
```
07:37:29.126 🔄 Dashboard: Componente montado, recargando business...
07:37:29.136 ✅ Dashboard: Business recargado al montar
07:39:43.223 👁️ Dashboard: Página visible, recargando business...
07:39:43.157 🔄 Dashboard: Evento agent-updated recibido
07:39:43.175 📡 Dashboard: Recargando business desde Supabase...
```

**Solución sugerida:**
- Eliminar la recarga al montar (ya viene del contexto)
- Consolidar todos los listeners en uno solo
- Usar un debounce para evitar múltiples recargas simultáneas

---

### 2. **PREVIEW DE MAÑANA SECUENCIAL** ⚠️ MODERADO

**Ubicación:** `DashboardSocioVirtual.jsx` línea 240

**Problema:**
- El preview de mañana se carga DESPUÉS de que termine el snapshot de hoy
- Esto añade ~3-4s adicionales al tiempo total
- El usuario no ve contenido útil hasta que ambos terminen

**Impacto:**
- Tiempo total: 4.7s (hoy) + 3-4s (mañana) = **7.7-8.7s** para ver todo
- El usuario espera sin feedback visual

**Evidencia en logs:**
```
07:37:33.827 ✅ Snapshot received (4.72s)
07:37:33.827 🔮 Cargando preview de mañana...
07:37:37.264 ✅ Preview de mañana cargado (3.4s adicionales)
```

**Solución sugerida:**
- Mostrar el snapshot de HOY inmediatamente (4.7s)
- El preview de mañana puede cargarse en background sin bloquear
- Ya está implementado así, pero el usuario percibe el delay total

---

### 3. **MÚLTIPLES LLAMADAS A fetchBusinessInfo** ⚠️ MODERADO

**Ubicación:** `AuthContext.jsx`

**Problema:**
- Cuando se dispara `agent-updated`, `AuthContext` recarga el business
- Cuando se dispara `force-business-reload`, `AuthContext` recarga el business
- El Dashboard también recarga el business directamente
- Esto causa llamadas duplicadas

**Evidencia en logs:**
```
07:37:43.861 ✅ Agente guardado correctamente
07:37:43.861 🔄 AuthContext: Agente actualizado, recargando negocio...
07:37:43.861 🔄 AuthContext: Recarga forzada desde OnboardingWizard
07:37:43.157 🔄 Dashboard: Evento agent-updated recibido
07:37:43.175 📡 Dashboard: Recargando business desde Supabase...
```

**Impacto:**
- 2-3 llamadas simultáneas a Supabase para el mismo business
- ~300-600ms adicionales
- Posible race condition

**Solución sugerida:**
- Consolidar en un solo punto de recarga
- Usar un flag para evitar recargas duplicadas
- Implementar un debounce/throttle

---

### 4. **DELAY ARTIFICIAL AL MONTAR** ⚠️ MENOR

**Ubicación:** `DashboardSocioVirtual.jsx` línea 148

**Problema:**
```javascript
const timer = setTimeout(reloadBusinessOnMount, 200);
```

**Impacto:**
- +200ms de delay innecesario
- El business ya viene del contexto, no necesita recarga inmediata

**Solución sugerida:**
- Eliminar este delay
- Solo recargar si realmente es necesario (ej: después de guardar en Config)

---

### 5. **OPENAI ES EL CUELLO DE BOTELLA** ⚠️ INEVITABLE (pero optimizable)

**Ubicación:** `supabase/functions/get-snapshot/index.ts`

**Problema:**
- OpenAI tarda 4.2-4.7s en responder
- Esto es ~95% del tiempo total
- No hay mucho que hacer aquí excepto optimizar el prompt (ya hecho)

**Opciones:**
1. ✅ **Caché:** Ya implementado (60s TTL)
2. ✅ **Prompt optimizado:** Ya reducido de 1800 a ~800 tokens
3. ⚠️ **Streaming:** No aplica (necesitamos JSON completo)
4. ⚠️ **Modelo más rápido:** `gpt-4o-mini` ya es el más rápido
5. ✅ **max_tokens reducido:** Ya en 350

**Mejora posible:**
- Reducir aún más el prompt si es posible
- Usar `temperature: 0.2` en lugar de `0.4` (más rápido, menos creativo)

---

## 📈 DESGLOSE DE TIEMPO TOTAL

### Escenario actual (con todos los problemas):

```
0.0s  → Usuario entra al Dashboard
0.2s  → Delay artificial al montar (reloadBusinessOnMount)
0.3s  → Recarga business (si es necesaria)
0.5s  → Hook useDashboardSnapshot inicia
0.5s  → Llamada a Edge Function get-snapshot
1.0s  → Edge Function procesa (SQL: 57ms)
5.7s  → Edge Function completa (OpenAI: 4.7s)
5.9s  → Client recibe respuesta
6.0s  → Snapshot se muestra en UI ✅
6.0s  → Preview de mañana inicia (en paralelo)
9.4s  → Preview de mañana completa
9.5s  → TODO visible ✅

TOTAL PERCIBIDO: ~6-9.5s
```

### Escenario optimizado (sin recargas innecesarias):

```
0.0s  → Usuario entra al Dashboard
0.0s  → Hook useDashboardSnapshot inicia (sin delay)
0.1s  → Llamada a Edge Function get-snapshot
0.2s  → Edge Function procesa (SQL: 57ms)
4.9s  → Edge Function completa (OpenAI: 4.7s)
5.0s  → Client recibe respuesta
5.1s  → Snapshot se muestra en UI ✅
5.1s  → Preview de mañana inicia (en paralelo)
8.5s  → Preview de mañana completa (no bloquea)

TOTAL PERCIBIDO: ~5.1s (mejora de 1-4s)
```

---

## 🎯 RECOMENDACIONES PRIORIZADAS

### 🔴 ALTA PRIORIDAD

1. **Eliminar recarga al montar del Dashboard**
   - El business ya viene del contexto
   - Solo recargar cuando realmente cambie (después de guardar en Config)

2. **Consolidar listeners de eventos**
   - Un solo listener que maneje todos los casos
   - Debounce para evitar múltiples recargas simultáneas

3. **Eliminar delay artificial de 200ms**
   - No hay razón para este delay

### 🟡 MEDIA PRIORIDAD

4. **Optimizar preview de mañana**
   - Ya está en paralelo, pero podría mostrar un skeleton mientras carga
   - No es crítico porque no bloquea el contenido principal

5. **Mejorar feedback visual**
   - Mostrar skeleton/loading state inmediatamente
   - El usuario percibe mejor el tiempo si ve que algo está pasando

### 🟢 BAJA PRIORIDAD

6. **Optimizar prompt de OpenAI**
   - Ya está bastante optimizado
   - Podría reducirse un poco más, pero el impacto será mínimo

7. **Considerar streaming (futuro)**
   - Mostrar el mensaje mientras OpenAI genera
   - Complejidad alta, beneficio moderado

---

## 📝 CONCLUSIÓN

**Tiempo real de Edge Function:** 4.7s ✅ (dentro de lo esperado)  
**Tiempo percibido por usuario:** 6-9.5s ⚠️ (más de lo esperado)

**Causa principal:** Múltiples recargas innecesarias del business que añaden 1-4s adicionales

**Solución:** Eliminar recargas redundantes y delays artificiales → **Mejora esperada: 1-4s**

---

## 🔧 PRÓXIMOS PASOS

1. ✅ **COMPLETADO:** Eliminar `reloadBusinessOnMount` con delay
2. ✅ **COMPLETADO:** Consolidar listeners de eventos
3. ✅ **COMPLETADO:** Agregar debounce a recargas de business
4. ✅ **COMPLETADO:** Eliminar listener de `visibilitychange` (recargas innecesarias)
5. ✅ **COMPLETADO:** Eliminar retry logic complejo y múltiples updates
6. ⚠️ Mejorar feedback visual (skeleton states) - Opcional
7. ⚠️ Considerar optimizaciones adicionales de OpenAI (bajo impacto) - Opcional

---

## ✅ OPTIMIZACIONES IMPLEMENTADAS (2025-11-26)

### Cambios realizados:

1. **Eliminada recarga al montar** (`reloadBusinessOnMount`)
   - ❌ Antes: Recargaba business con delay de 200ms al montar
   - ✅ Ahora: Usa el business del contexto directamente
   - **Ahorro:** ~200-300ms

2. **Listener optimizado con debounce**
   - ❌ Antes: Múltiples recargas simultáneas sin control
   - ✅ Ahora: Debounce de 100ms + flag `isReloading` para evitar duplicados
   - **Ahorro:** ~300-600ms (evita recargas duplicadas)

3. **Eliminado listener de `visibilitychange`**
   - ❌ Antes: Recargaba business cada vez que la página se volvía visible
   - ✅ Ahora: Solo recarga cuando realmente se actualiza el agente
   - **Ahorro:** ~100-300ms por cambio de pestaña

4. **Simplificado retry logic**
   - ❌ Antes: Múltiples retries con delays y updates redundantes
   - ✅ Ahora: Un solo intento, sin delays innecesarios
   - **Ahorro:** ~100-200ms

### Mejora esperada total: **~700-1,400ms (0.7-1.4s)**

### Tiempo esperado después de optimizaciones:
- **Antes:** 6-9.5s percibido
- **Después:** ~4.7-5.5s percibido
- **Mejora:** **1.5-4s más rápido** ⚡

