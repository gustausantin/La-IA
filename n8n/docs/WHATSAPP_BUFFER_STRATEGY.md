# 🕐 ESTRATEGIA DE BUFFER PARA WHATSAPP

**Problema:** Los usuarios de WhatsApp envían mensajes fragmentados en ráfagas rápidas.

**Ejemplo real:**
```
[10:00:00] "Hola"
[10:00:03] "Que tal"
[10:00:07] "Quiero una reserva"
[10:00:12] "Para hoy"
[10:00:15] "A las 21h"
[10:00:18] "Somos 4"
```

Si respondemos a cada mensaje individualmente, sería caótico y costoso (cada llamada a OpenAI cuesta).

---

## 🎯 SOLUCIÓN: MESSAGE AGGREGATOR CON BUFFER TEMPORAL

### **FLUJO:**

```
┌─────────────────────────────────────────────────────────────┐
│  Usuario envía mensajes fragmentados                        │
│  "Hola" → "Que tal" → "Quiero reserva" → "Para hoy" → ...  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │  Webhook recibe mensaje     │
         │  Responde ACK inmediatamente│  ← WhatsApp recibe 200 OK en <1seg
         └──────────────┬──────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │  Guardar en Buffer (Supabase)        │
         │  - Clave: whatsapp_buffer_+34600...  │
         │  - Concatenar mensaje                │
         │  - Actualizar timestamp               │
         └──────────────┬───────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │  Esperar 8 segundos                  │  ← DELAY configurable
         └──────────────┬───────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │  Leer buffer completo                │
         │  Verificar: ¿Han pasado >= 7 seg?   │
         └──────────────┬───────────────────────┘
                        │
                   ┌────┴────┐
                   │         │
            SÍ ────┤         ├──── NO (alguien sigue escribiendo)
                   │         │      → Descarta ejecución
                   └────┬────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │  Procesar todos los mensajes juntos  │
         │  Enviar al Super Agente              │
         └──────────────┬───────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │  Limpiar buffer                      │
         │  Responder al usuario                │
         └──────────────────────────────────────┘
```

---

## ⚙️ CONFIGURACIÓN

### **Parámetros ajustables:**

| Parámetro | Valor por defecto | Descripción |
|-----------|-------------------|-------------|
| `BUFFER_DELAY_SECONDS` | 8 segundos | Tiempo de espera desde el último mensaje |
| `CHECK_DELAY_SECONDS` | 7 segundos | Tiempo mínimo para considerar "listo" |
| `BUFFER_CLEANUP_MINUTES` | 30 minutos | Tiempo para limpiar buffers abandonados |

### **¿Por qué 8 segundos?**

- ⏱️ **Usuario rápido:** Escribe 3-5 mensajes en 5-10 segundos
- ⏱️ **Usuario pensativo:** Puede tardar hasta 15 segundos entre mensajes
- ⏱️ **Balance óptimo:** 8 segundos es suficiente para el 90% de usuarios

---

## 🗄️ TABLA EN SUPABASE: `whatsapp_message_buffer`

```sql
CREATE TABLE whatsapp_message_buffer (
    id UUID PRIMARY KEY,
    buffer_key VARCHAR UNIQUE,           -- 'whatsapp_buffer_+34600000000'
    customer_phone VARCHAR NOT NULL,     -- '+34600000000'
    customer_name VARCHAR,               -- 'Juan Pérez'
    messages TEXT NOT NULL,              -- Mensajes concatenados
    message_count INTEGER DEFAULT 1,     -- Contador de mensajes
    last_message_at TIMESTAMPTZ,         -- Timestamp del último mensaje
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 CASOS DE USO

### **Caso 1: Usuario escribe 3 mensajes rápidos**

```
[10:00:00] "Hola"          → Buffer creado, espera 8seg
[10:00:03] "Quiero reserva" → Buffer actualizado, espera resetea a 8seg
[10:00:05] "Para 4 personas" → Buffer actualizado, espera resetea a 8seg
[10:00:13] (nada)          → ✅ Pasan 8 segundos, procesa todo junto
```

**Resultado:** 1 sola llamada al agente con:
```
"Hola
Quiero reserva
Para 4 personas"
```

---

### **Caso 2: Usuario escribe muy lento**

```
[10:00:00] "Hola"          → Buffer creado, espera 8seg
[10:00:08] (nada)          → ✅ Pasan 8 segundos, procesa "Hola"
[10:00:20] "Quiero reserva" → Nuevo buffer, espera 8seg
[10:00:28] (nada)          → ✅ Pasan 8 segundos, procesa "Quiero reserva"
```

**Resultado:** 2 llamadas al agente (normal, son conversaciones separadas)

---

### **Caso 3: Usuario escribe, pausa, y continúa**

```
[10:00:00] "Hola"          → Buffer creado
[10:00:03] "Quiero reserva" → Buffer actualizado
[10:00:11] (nada - ¡procesando!)
[10:00:12] "Para hoy"      → ❌ Demasiado tarde, buffer ya fue procesado
```

**Resultado:** 
- 1ª llamada: "Hola\nQuiero reserva"
- 2ª llamada: "Para hoy" (nuevo buffer)

---

## 🎛️ AJUSTES FINOS

### **¿Cómo cambiar el delay?**

Edita el nodo "Preparar Delay" en n8n:

```javascript
const BUFFER_DELAY_SECONDS = 10; // Cambia a 10 segundos
```

### **¿Cómo limpiar buffers antiguos?**

Cron job en Supabase (cada hora):

```sql
SELECT cleanup_old_whatsapp_buffers();
-- Elimina buffers con más de 30 minutos sin actividad
```

---

## 📊 MÉTRICAS A MONITOREAR

| Métrica | Objetivo | Cómo medirlo |
|---------|----------|--------------|
| Tiempo promedio de respuesta | < 10 segundos | `resolved_at - created_at` en `agent_conversations` |
| Mensajes agregados por buffer | 3-5 mensajes | `AVG(message_count)` de `whatsapp_message_buffer` |
| Buffers abandonados | < 5% | Buffers que no se procesan |
| Precisión de agregación | > 95% | ¿El agente entiende el contexto completo? |

---

## ⚠️ CONSIDERACIONES

### **Ventajas:**
- ✅ Reduce costos (menos llamadas a OpenAI)
- ✅ Mejor contexto para el agente
- ✅ Experiencia más natural para el usuario

### **Desventajas:**
- ⚠️ Delay de 8 segundos antes de responder
- ⚠️ Puede perder mensajes si el usuario escribe muy lento y luego rápido

### **Mitigación:**
- Mostrar "typing..." en WhatsApp (si la API lo permite)
- Ajustar delay según comportamiento de usuarios (A/B testing)

---

## 🔧 TROUBLESHOOTING

**Problema:** Buffers no se limpian
- **Solución:** Ejecutar manualmente `SELECT cleanup_old_whatsapp_buffers();`

**Problema:** Mensajes duplicados
- **Solución:** Verificar que `buffer_key` sea único

**Problema:** Delay muy largo
- **Solución:** Reducir `BUFFER_DELAY_SECONDS` a 5-6 segundos

---

**Última actualización:** 2 Octubre 2025  
**Versión:** 1.0

