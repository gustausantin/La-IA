# 🧪 TESTING: Parpadeo Rojo en Calendario

**Fecha:** 24 Noviembre 2025  
**Componente:** `CalendarioReservas.jsx`  
**Feature:** Alerta visual de no-shows urgentes

---

## ✅ IMPLEMENTACIÓN COMPLETADA

### Cambios realizados:

1. ✅ **Función `isUrgentNoShow()`** - Detecta urgencia crítica
2. ✅ **Estilos visuales** - Parpadeo rojo + ring + badge
3. ✅ **Prioridad z-index** - Urgentes siempre al frente
4. ✅ **Badge flotante** - Indicador "📞 <2H"

---

## 🎯 CRITERIOS DE URGENCIA

Una reserva parpadea en ROJO cuando cumple **TODOS** estos criterios:

1. ✅ **Fecha:** Es de HOY (mismo día)
2. ✅ **Tiempo:** Faltan menos de 2 horas
3. ✅ **Estado:** Aún no ha pasado (hoursUntil > 0)
4. ✅ **Confirmación:** NO confirmó a 24h NI a 4h
5. ✅ **Status:** Es 'pending' o 'confirmed' (no aplicar a completed/cancelled/no_show)

---

## 🎨 EFECTOS VISUALES

### Cuando una cita ES urgente:
- ✅ **Fondo:** `bg-red-50` (rojo claro)
- ✅ **Borde izquierdo:** 6px rojo (#dc2626)
- ✅ **Animación:** `animate-pulse` (parpadeo suave)
- ✅ **Ring:** `ring-2 ring-red-400` (borde brillante)
- ✅ **Sombra:** `shadow-red-200` (sombra rojiza)
- ✅ **Badge flotante:** "📞 <2H" (esquina superior derecha)
- ✅ **Texto:** Color rojo oscuro (#7f1d1d)
- ✅ **Z-index:** 30 (siempre al frente)

### Cuando NO es urgente:
- ✅ **Fondo:** Según status (azul, amarillo, verde)
- ✅ **Borde:** 5px según status
- ✅ **Sin animación**
- ✅ **Z-index:** 20 (normal)

---

## 🧪 CÓMO PROBAR

### Test 1: Sin citas urgentes (caso normal)

**Escenario:**
- Todas las citas están confirmadas
- O faltan más de 2 horas

**Resultado esperado:**
- ✅ Calendario se ve normal
- ✅ No hay burbujas parpadeando
- ✅ No hay badges "📞 <2H"

---

### Test 2: Cita urgente simulada

**Escenario:**
- Tienes una cita HOY
- Faltan menos de 2 horas
- NO está confirmada

**Cómo crear:**
1. Ve a Reservas o Calendario
2. Crea una cita para HOY
3. Hora: Dentro de 1h 30min desde ahora
4. Status: 'pending' o 'confirmed'
5. NO confirmar (no marcar como confirmada)

**Resultado esperado:**
- ✅ La burbuja de esa cita parpadea en ROJO
- ✅ Tiene el badge "📞 <2H" arriba a la derecha
- ✅ Fondo rojo claro + borde rojo grueso
- ✅ Destaca claramente del resto

---

### Test 3: Cita confirmada (no urgente)

**Escenario:**
- Misma cita del Test 2
- Pero ahora la marcas como confirmada

**Cómo hacerlo:**
En Supabase, ejecuta:
```sql
INSERT INTO customer_confirmations (
    business_id,
    appointment_id,
    customer_id,
    message_type,
    message_channel,
    message_sent,
    sent_at,
    confirmed,
    response_text,
    response_at
) VALUES (
    '<TU_BUSINESS_ID>',
    '<APPOINTMENT_ID>',
    '<CUSTOMER_ID>',
    '24h',
    'whatsapp',
    'Hola, ¿confirmas tu cita?',
    NOW() - INTERVAL '1 hour',
    TRUE,
    'Sí, confirmo',
    NOW() - INTERVAL '50 minutes'
);
```

**Resultado esperado:**
- ✅ La burbuja DEJA de parpadear
- ✅ Ya NO tiene el badge "📞 <2H"
- ✅ Vuelve a colores normales (azul o amarillo según status)

---

### Test 4: Cita que pasa el límite de 2h

**Escenario:**
- Cita HOY a las 18:00
- Hora actual: 15:30 (faltan 2.5h)
- NO confirmada

**Resultado esperado:**
- ✅ NO parpadea (faltan más de 2h)

**Ahora espera o cambia la hora:**
- Hora actual: 16:15 (faltan 1h 45min)

**Resultado esperado:**
- ✅ AHORA SÍ parpadea (faltan menos de 2h)

---

### Test 5: Cita de mañana (no urgente)

**Escenario:**
- Cita para MAÑANA
- Faltan 26 horas
- NO confirmada

**Resultado esperado:**
- ✅ NO parpadea (no es hoy)
- ✅ Se ve con colores normales

---

### Test 6: Múltiples citas urgentes

**Escenario:**
- 3 citas HOY
- Todas faltan <2h
- Ninguna confirmada

**Resultado esperado:**
- ✅ LAS 3 parpadean en rojo
- ✅ Todas tienen badge "📞 <2H"
- ✅ Se distinguen claramente

---

## 🎬 TESTING VISUAL RÁPIDO

### Pasos rápidos:

1. **Abre la aplicación**
   ```bash
   npm run dev
   ```

2. **Ve al Calendario**
   - Navegación → Calendario
   - Vista: DÍA (para ver mejor)

3. **Verifica la hora actual**
   - Debería haber una línea roja horizontal mostrando "ahora"

4. **Busca citas en las próximas 2 horas**
   - Si hay citas sin confirmar → deberían parpadear
   - Si todas están confirmadas → ninguna parpadea

5. **Crea una cita de prueba**
   - Click en un slot dentro de las próximas 2h
   - Llena los datos
   - Guardar
   - **Verificar:** ¿Parpadea en rojo? ✅

6. **Simula confirmación**
   - Ve a Supabase
   - Inserta registro en `customer_confirmations`
   - Refresca calendario
   - **Verificar:** ¿Dejó de parpadear? ✅

---

## 📊 CHECKLIST DE VALIDACIÓN

Marca cada test cuando lo completes:

- [ ] Test 1: Calendario normal sin urgencias ✅
- [ ] Test 2: Cita urgente parpadea correctamente ✅
- [ ] Test 3: Confirmación detiene el parpadeo ✅
- [ ] Test 4: Límite de 2h funciona correctamente ✅
- [ ] Test 5: Citas futuras no parpadean ✅
- [ ] Test 6: Múltiples urgentes se ven correctamente ✅

---

## 🐛 TROUBLESHOOTING

### Problema: No parpadea ninguna cita

**Posibles causas:**
1. No hay citas en las próximas 2h
2. Todas están confirmadas
3. El campo `confirmed_24h` o `confirmed_4h` no se está pasando al componente

**Solución:**
```javascript
// Verificar que las props incluyan estos campos:
console.log('Reserva:', reserva);
console.log('confirmed_24h:', reserva.confirmed_24h);
console.log('confirmed_4h:', reserva.confirmed_4h);
```

---

### Problema: Parpadea pero no debería

**Posibles causas:**
1. La lógica de `hours Until` está mal calculada
2. La fecha no coincide

**Solución:**
```javascript
// Añadir console.log en isUrgentNoShow():
console.log('Checking urgency:', {
    reservationDate,
    today,
    hoursUntil,
    isNotConfirmed
});
```

---

### Problema: El badge no se ve

**Posibles causas:**
1. Z-index bajo
2. Posición absoluta no funciona

**Solución:**
Verificar que el div padre tenga `position: relative`

---

## 🎯 RESULTADO FINAL ESPERADO

**En producción, el trabajador verá:**

1. **Vista normal del calendario**
   - Todas las citas con colores normales
   - Azul (confirmed), Amarillo (pending), etc.

2. **1h 45min antes de una cita sin confirmar**
   - 🚨 La cita empieza a parpadear en ROJO
   - 📞 Aparece badge "<2H" arriba
   - 🔔 Es imposible no verla

3. **El trabajador llama al cliente**
   - Cliente confirma por teléfono
   - Trabajador marca como confirmada en el sistema
   - ✅ La cita DEJA de parpadear inmediatamente

4. **Beneficio:**
   - ⏰ No se olvida ninguna llamada urgente
   - 📉 Reducción de no-shows
   - ⭐ Mejor servicio al cliente

---

## 📞 SIGUIENTE PASO

**Ahora prueba visual con datos reales:**

1. Abre la app: `npm run dev`
2. Ve al calendario
3. Si hay citas urgentes → verifica que parpadean
4. Si no hay → crea una de prueba

**Avísame cuando lo pruebes y dime:**
- ✅ ¿Funciona como esperabas?
- ⚠️ ¿Hay algún detalle visual que ajustar?
- 💡 ¿Quieres que el parpadeo sea más/menos intenso?

---

**Preparado por:** Sistema de Testing de Calidad  
**Estado:** ✅ LISTO PARA PROBAR  
**Confianza:** 95%

🦞 **¡Vamos a ver ese parpadeo rojo en acción!**


