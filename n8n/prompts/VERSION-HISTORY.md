# 📝 HISTORIAL DE VERSIONES - SUPER AGENT PROMPT

## 🎯 GUÍA DE USO

**Prompt activo en producción:** `PROMPT-SUPER-AGENT-v4-CON-ZONAS.txt` ✅

Cada versión está documentada con:
- Fecha de creación
- Cambios principales
- Número de líneas
- Optimizaciones aplicadas

---

## 📚 VERSIONES DISPONIBLES

### **VERSIÓN 4 CON ZONAS** ✅ **(ACTUAL)**
**Archivo:** `PROMPT-SUPER-AGENT-v4-CON-ZONAS.txt`  
**Fecha:** 17 de octubre 2025  
**Líneas:** 360+

**Nueva funcionalidad:** Sistema completo de gestión de zonas

**Cambios principales:**
- ✅ Nueva sección "🏢 GESTIÓN DE ZONAS" con 4 zonas estandarizadas
- ✅ Lógica inteligente: Privado solo se sugiere en casos específicos
- ✅ Actualización de `check_availability`: parámetro `preferred_zone`
- ✅ Actualización de `create_reservation`: parámetro `preferred_zone`
- ✅ Checklist ampliada: Paso 3.5 (ZONA opcional)
- ✅ Flujo de conversación: 4 casos (A/B/C/D) para gestión de zona
- ✅ Manejo de disponibilidad por zona: sugerencias de zonas alternativas

**Zonas disponibles:**
- 🏠 Interior (default, siempre ofrecido)
- ☀️ Terraza (siempre ofrecido)
- 🍷 Barra (siempre ofrecido)
- 🚪 Privado (solo sugerido en casos específicos)

**Reglas de Privado:**
- Grupo ≥ 8 personas → Sugerir privado
- Keywords ("tranquilo", "íntimo", "romántico", "especial", "aniversario") → Sugerir privado
- Cliente pregunta explícitamente → Ofrecer privado
- Otros casos → NO mencionar privado

**Por qué usar esta versión:**
- Permite al agente gestionar preferencias de zona de forma natural
- Optimiza experiencia del usuario (puede elegir dónde sentarse)
- Aumenta conversión (clientes eligen su zona preferida)
- Inteligente con sala privada (no la ofrece a todo el mundo)

---

### **VERSIÓN 3 PERFECTO**
**Archivo:** `PROMPT-SUPER-AGENT-v3-PERFECTO.txt`  
**Fecha:** 17 de octubre 2025  
**Líneas:** 238

**Filosofía:** CLARIDAD > BREVEDAD
Optimizado para precisión máxima, no para longitud mínima.

**Cambios principales:**
- ✅ Eliminadas redundancias entre secciones
- ✅ Instrucciones más claras y accionables
- ✅ Regla de oro ampliada con ejemplos más explícitos
- ✅ Protocolo mental reforzado al final
- ✅ Flujo de conversación reorganizado por pasos claros
- ✅ Personalidad fusionada con comportamiento esperado
- ✅ Prohibiciones absolutas listadas explícitamente

**Optimizaciones de precisión:**
- Cada instrucción tiene un "por qué" implícito
- Ejemplos CORRECTO vs PROHIBIDO para claridad
- Checklist numerada y secuencial
- Reglas críticas destacadas con ⚠️
- Parámetros obligatorios explícitos por herramienta

**Por qué usar esta versión:**
- Máxima claridad → Menos errores del LLM
- Instrucciones accionables → Menos ambigüedad
- Ejemplos explícitos → Mejor aprendizaje
- Estructura lógica → Más fácil de seguir

---

### **VERSIÓN 2**
**Archivo:** `PROMPT-SUPER-AGENT-v2.txt`  
**Fecha:** 17 de octubre 2025  
**Líneas:** 287

**Cambios principales:**
- ✅ Simplificación de sección de herramientas
- ✅ JSON explícito para cada tool: "Llama con: [JSON exacto]"
- ✅ Reducción de 364 → 287 líneas (21% más compacto)
- ✅ Eliminación de redundancias en PASO 3 y PASO 5
- ✅ Formato directo y claro: "Oye, aquí tienes la info → Cuando llames, usa este JSON"

**Optimizaciones:**
- Cada herramienta tiene su JSON de ejemplo visible
- Reglas críticas concentradas en 4 bullets al final de herramientas
- Pasos simplificados sin repetir el JSON

**Por qué usar esta versión:**
- Más fácil de leer para el LLM
- Menos tokens consumidos
- Instrucciones más claras y directas

---

### **VERSIÓN 1**
**Archivo:** `PROMPT-SUPER-AGENT-v1.txt`  
**Fecha:** 16 de octubre 2025  
**Líneas:** 287

**Cambios principales:**
- ✅ Primera versión con fecha y hora actual
- ✅ Regla de oro absoluta anti-repetición
- ✅ Sección de conversión de fechas (mañana → YYYY-MM-DD)
- ✅ Protocolo mental antes de responder
- ✅ Formato de parámetros para tools

**Características:**
- Incluye `{{ $now.format('yyyy-MM-dd') }}`
- Ejemplos de conversión de fechas naturales
- Checklist mental antes de usar tools
- Formato YYYY-MM-DD explícito

---

## 🚀 PRÓXIMAS VERSIONES

### **VERSIÓN 3** (Planificada)
**Mejoras propuestas:**
- [ ] Añadir sección de errores comunes y cómo resolverlos
- [ ] Optimizar sección de escalado a humano
- [ ] Añadir ejemplos de conversaciones completas
- [ ] Reducir aún más la extensión si es posible

---

## 📋 CHANGELOG DETALLADO

### v2 → v1
- ➖ Eliminada repetición de JSON en PASO 3 y PASO 5
- ➖ Eliminada sección "FORMATO CRÍTICO PARA LLAMADAS A HERRAMIENTAS" (redundante)
- ✅ JSON de ejemplo movido directamente bajo cada herramienta
- ✅ Simplificado "Llama con: [JSON]"

---

## 🔄 CÓMO CREAR UNA NUEVA VERSIÓN

1. Copia el archivo actual:
   ```powershell
   Copy-Item "PROMPT-SUPER-AGENT-v2.txt" "PROMPT-SUPER-AGENT-v3.txt"
   ```

2. Modifica el header:
   ```
   ═══════════════════════════════════════════════════════════════════
   🤖 SUPER AGENT PROMPT - VERSIÓN 3
   Fecha: [FECHA]
   Cambios: [DESCRIPCIÓN DE CAMBIOS]
   ═══════════════════════════════════════════════════════════════════
   ```

3. Actualiza este archivo (`VERSION-HISTORY.md`)

4. Prueba la nueva versión en N8N

5. Si funciona bien, actualiza "ACTUAL" en este documento

---

## 📊 ESTADÍSTICAS

| Versión | Líneas | Tokens (aprox) | Fecha |
|---------|--------|----------------|-------|
| v1      | 287    | ~2,800        | 16/10/2025 |
| v2      | 287    | ~2,600        | 17/10/2025 |

---

**Última actualización:** 17 de octubre 2025

