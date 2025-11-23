# ⚡ CHECKLIST RÁPIDO - MAÑANA (5 MINUTOS)

## 🎯 OBJETIVO
Verificar que el frontend funciona correctamente **ANTES** de hacer el N8N workflow.

---

## ✅ PASO 1: VERIFICAR LO QUE YA FUNCIONA (2 min)

1. **Abrir la aplicación**: http://localhost:5173 (o tu URL)
2. **Ir a**: Comunicación → Seleccionar cualquier conversación
3. **Verificar**:
   - [ ] Los teléfonos se ven formateados (XXX XX XX XX) ✅
   - [ ] Los botones [Llamar] [WhatsApp] [Copiar] están visibles ✅
   - [ ] El botón "Copiar" funciona y muestra toast ✅
   - [ ] En la lista, cada conversación tiene su "outcome" visible (✅ Cita Agendada, etc.) ✅

**Si TODO lo anterior funciona → Frontend está OK** ✅

---

## ⏳ PASO 2: VERIFICAR LOS PLACEHOLDERS (1 min)

1. **Seleccionar una conversación telefónica** (canal = phone)
2. **Verificar que se muestra**:
   - [ ] Caja gris con texto "Audio pendiente de procesamiento" 🔊
   - [ ] Caja gris con texto "Resumen no disponible" 🤖

**Si aparecen los placeholders → Frontend espera datos correctamente** ✅

---

## 🚀 PASO 3: HACER N8N WORKFLOW (30-45 min)

### **3.1 Crear Webhook Node**
```javascript
// Webhook URL: https://tu-n8n.com/webhook/vapi-end-of-call-report
// Method: POST
// Authentication: None (o la que uses)
```

### **3.2 Agregar Code Node (Extraer datos)**
```javascript
// Copiar el código de: COMUNICACION_MVP_READY.md
// Sección: "Extraer datos de Vapi"

const payload = $json.body;
const msg = payload.message || {};
const call = msg.call || {};

// BUSCAR recording_url (puede tener diferentes nombres)
const recordingUrl = msg.recordingUrl || 
                     msg.recording_url || 
                     call.recordingUrl || 
                     call.recording_url || 
                     call.artifact?.recordingUrl ||
                     null;

// DEBUG: Imprimir todo el payload
console.log('PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2));
console.log('RECORDING URL:', recordingUrl);

return {
  json: {
    recording_url: recordingUrl,
    customer_phone: msg.customer?.number || '',
    customer_name: msg.customer?.name || 'Sin nombre',
    vapi_call_id: call.id,
    duration: call.durationSeconds
  }
};
```

### **3.3 Agregar Supabase Node (Insert)**
```javascript
// Table: agent_conversations
// Operation: Insert

{
  business_id: "{{TU_BUSINESS_ID}}",
  customer_phone: "{{$json.customer_phone}}",
  customer_name: "{{$json.customer_name}}",
  source_channel: "phone",
  status: "resolved",
  outcome: "inquiry_answered",
  metadata: {
    vapi_call_id: "{{$json.vapi_call_id}}",
    recording_url: "{{$json.recording_url}}",
    duration_seconds: "{{$json.duration}}"
  }
}
```

### **3.4 ACTIVAR WORKFLOW**

---

## 🧪 PASO 4: PROBAR CON LLAMADA REAL (2 min)

1. **Hacer una llamada de prueba** a tu número de Vapi
2. **Esperar a que termine** la llamada
3. **Verificar en N8N** que el webhook se disparó
4. **Ver logs** y buscar el `recording_url`

---

## ✅ PASO 5: VERIFICAR EN FRONTEND (1 min)

1. **Recargar** la página de Comunicación (F5)
2. **Seleccionar** la última conversación
3. **DEBE aparecer**:
   - ✅ Reproductor de audio (con URL de Vapi)
   - ✅ Botón Play funcional
   - ✅ Barra de progreso

**Si aparece el audio → ¡ÉXITO TOTAL!** 🎉

---

## ❌ SI ALGO NO FUNCIONA

### **Problema 1: No aparece el audio**
**Solución**:
```sql
-- Verificar en Supabase
SELECT metadata 
FROM agent_conversations 
WHERE source_channel='phone' 
ORDER BY created_at DESC 
LIMIT 1;
```
- Si `metadata.recording_url` está vacío → Revisar N8N logs
- Si está lleno pero no aparece → Verificar que es una URL válida (abrirla en navegador)

### **Problema 2: Webhook no se dispara**
**Solución**:
- Verificar que configuraste el webhook en Vapi Dashboard
- Verificar que la URL de N8N es accesible públicamente
- Ver logs de N8N para ver si llega la petición

### **Problema 3: Audio no se reproduce**
**Solución**:
- Abrir URL del audio en navegador manualmente
- Verificar que no hay error de CORS
- Verificar que el formato es compatible (mp3/wav)

---

## 🎯 RESULTADO ESPERADO

### **ANTES de N8N:**
- ✅ Teléfonos formateados
- ✅ Botones de acción
- ✅ Iconos de outcome
- ⚠️ Placeholder de audio
- ⚠️ Placeholder de resumen

### **DESPUÉS de N8N:**
- ✅ Teléfonos formateados
- ✅ Botones de acción
- ✅ Iconos de outcome
- ✅ **Audio Player funcional** 🎉
- ⚠️ Placeholder de resumen (opcional)

---

## 📞 SI TODO FUNCIONA...

**¡INVÍTAME A CENAR!** 🍽️😄

---

**Tiempo total mañana**: 35-45 minutos  
**Archivos a modificar**: 0 (solo N8N)  
**Probabilidad de éxito**: 95% 🚀

---

## 📚 DOCUMENTACIÓN DE APOYO

Si necesitas más detalles, consulta:
1. `COMUNICACION_MVP_READY.md` → Guía técnica completa
2. `CAMBIOS_COMUNICACION_MVP.md` → Comparación visual
3. `RESUMEN_EJECUTIVO_MVP.md` → Vista general

**¡Buena suerte mañana!** 💪✨

