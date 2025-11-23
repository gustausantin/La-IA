# ✅ IMPLEMENTACIÓN SISTEMA NO-SHOWS - RESUMEN EJECUTIVO

**Fecha**: 2025-11-23  
**Estado**: ✅ Listo para desplegar  
**Nivel de Criticidad**: Alta - Impacto directo en ingresos

---

## 🎯 ¿QUÉ SE HA IMPLEMENTADO?

Se ha creado la **infraestructura completa** para un sistema inteligente de prevención de no-shows que:

1. ✅ **Registra todas las confirmaciones** enviadas y recibidas
2. ✅ **Calcula el riesgo de cada cliente** (0-100) basado en su historial
3. ✅ **Libera slots automáticamente** cuando una cita se cancela (sin depender de N8N)
4. ✅ **Distingue entre clientes de alto y bajo riesgo** para aplicar políticas diferenciadas
5. ✅ **Integra con N8N** para automatizar recordatorios y alertas

---

## 📦 ARCHIVOS CREADOS

### Migraciones SQL (Base de datos)

#### `supabase/migrations/20251123_02_noshows_infrastructure_FIXED.sql`

**Contenido** (⚠️ **VERSIÓN CORREGIDA** - verifica estructura existente):
- ✅ Tabla `customer_confirmations` (registra mensajes enviados/recibidos)
- ✅ Campo `customers.no_show_count` (contador de no-shows históricos)
- ✅ Trigger `increment_customer_noshow_count()` (actualiza contador automáticamente)
- ✅ Trigger `auto_release_slots_on_status_change()` (libera slots al cancelar/no-show)
- ✅ Función `record_customer_confirmation()` (registrar mensaje enviado)
- ✅ Función `process_customer_response()` (procesar respuesta del cliente)

**Garantías**:
- 🔒 **Atomicidad**: Los slots se liberan automáticamente en la misma transacción que el cambio de estado
- 🔒 **Consistencia**: El contador de no-shows siempre está sincronizado
- 🔒 **Auditoría**: Todas las confirmaciones quedan registradas con timestamp y coste

#### `supabase/migrations/20251123_03_noshows_risk_intelligence_FIXED.sql`

**Contenido** (⚠️ **VERSIÓN CORREGIDA** - usa `appointments` no `reservations`):
- ✅ Función `calculate_smart_risk_score()` (scoring inteligente 0-100)
- ✅ Función `get_high_risk_appointments()` (lista citas de riesgo en las próximas N horas)
- ✅ Vista `appointments_with_risk` (appointments + risk_score en tiempo real)
- ✅ Función `get_noshow_stats()` (métricas agregadas de no-shows)

**Algoritmo de Scoring**:
```
risk_score = 
  + Tasa de no-shows histórica (0-40 puntos)
  + No-shows recientes < 30 días (0-25 puntos)
  + Tasa de confirmación baja (0-20 puntos)
  + Cliente nuevo (0-15 puntos)
  - Cliente antiguo fiel (-10 puntos)

Clasificación:
- CRITICAL (70+): Auto-cancelar si no confirma
- HIGH (50-69): Alertar al staff, NO auto-cancelar
- MEDIUM (30-49): Seguimiento normal
- LOW (0-29): Cliente confiable
```

### Documentación

#### `docs/03-workflows/N8N_WORKFLOW_NOSHOWS_V2_CORREGIDO.md`

**Contenido**:
- ✅ Workflow N8N "Recordatorio 24h" (código SQL + nodos)
- ✅ Workflow N8N "Recordatorio 4h" (código SQL + nodos)
- ✅ Workflow N8N "Alertas 2h" (con decisión inteligente según risk_level)
- ✅ Webhook N8N "Procesar respuestas WhatsApp"
- ✅ Test cases para validar los 3 escenarios
- ✅ Métricas a monitorizar (KPIs)

---

## 🚀 CÓMO DESPLEGAR

### Paso 1: Ejecutar migraciones SQL

```bash
# Conectar a Supabase
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Ejecutar migraciones en orden (VERSIONES CORREGIDAS)
\i supabase/migrations/20251123_02_noshows_infrastructure_FIXED.sql
\i supabase/migrations/20251123_03_noshows_risk_intelligence_FIXED.sql
```

**Verificar**:
```sql
-- ¿Se creó la tabla?
SELECT COUNT(*) FROM customer_confirmations;

-- ¿Se añadió el campo?
SELECT no_show_count FROM customers LIMIT 1;

-- ¿Funcionan las funciones?
SELECT * FROM calculate_smart_risk_score('any-customer-id');
```

### Paso 2: Configurar N8N

1. **Crear credenciales Twilio**:
   - Account SID
   - Auth Token
   - WhatsApp Number (ej: `whatsapp:+14155238886`)

2. **Crear credenciales Supabase**:
   - Project URL
   - Service Role Key (para ejecutar SQL)

3. **Importar workflows**:
   - Copiar el código de `N8N_WORKFLOW_NOSHOWS_V2_CORREGIDO.md`
   - Pegar en N8N como nuevos workflows
   - Configurar variables de entorno:
     - `BUSINESS_ID`: ID del negocio en LA-IA
     - `TWILIO_SID`, `TWILIO_AUTH_BASE64`, `TWILIO_NUMBER`
     - `APP_URL`: `https://la-ia.com`
     - `BUSINESS_PHONE`: Teléfono del negocio

4. **Configurar webhook de Twilio**:
   - En Twilio Console → WhatsApp Sandbox → Configure
   - "When a message comes in" → `https://your-n8n.com/webhook/whatsapp-response`
   - Method: POST

### Paso 3: Testing

#### Test 1: Cliente CRITICAL (auto-cancelar)

```sql
-- 1. Crear cliente de prueba con 3 no-shows
INSERT INTO customers (id, business_id, name, phone, no_show_count)
VALUES (
    'test-critical-001',
    'your-business-id',
    'Juan Pérez (TEST)',
    '+34600000000',
    3
);

-- 2. Crear appointment en 2 horas
INSERT INTO appointments (
    business_id, 
    customer_id, 
    appointment_date, 
    appointment_time,
    service_id,
    status
) VALUES (
    'your-business-id',
    'test-critical-001',
    CURRENT_DATE,
    (CURRENT_TIME + INTERVAL '2 hours')::TIME,
    'any-service-id',
    'pending'
);

-- 3. Verificar risk_score
SELECT * FROM calculate_smart_risk_score('test-critical-001');
-- Esperado: risk_level = 'CRITICAL', should_auto_cancel = true

-- 4. Esperar a que el workflow "Alertas 2h" se ejecute
-- 5. Verificar que se auto-canceló
SELECT status FROM appointments WHERE customer_id = 'test-critical-001';
-- Esperado: status = 'no_show'

-- 6. Verificar que los slots se liberaron
SELECT status, is_available FROM availability_slots 
WHERE appointment_id = (SELECT id FROM appointments WHERE customer_id = 'test-critical-001');
-- Esperado: status = 'free', is_available = true
```

#### Test 2: Cliente HIGH (solo alertar)

```sql
-- 1. Crear cliente con 1 no-show hace 2 meses
INSERT INTO customers (id, business_id, name, phone, no_show_count)
VALUES (
    'test-high-001',
    'your-business-id',
    'María López (TEST)',
    '+34600000001',
    1
);

-- 2. Crear appointment en 2 horas
INSERT INTO appointments (
    business_id, 
    customer_id, 
    appointment_date, 
    appointment_time,
    service_id,
    status
) VALUES (
    'your-business-id',
    'test-high-001',
    CURRENT_DATE,
    (CURRENT_TIME + INTERVAL '2 hours')::TIME,
    'any-service-id',
    'pending'
);

-- 3. Verificar risk_score
SELECT * FROM calculate_smart_risk_score('test-high-001');
-- Esperado: risk_level = 'HIGH', should_auto_cancel = false

-- 4. Esperar a que el workflow "Alertas 2h" se ejecute
-- 5. Verificar que NO se canceló
SELECT status FROM appointments WHERE customer_id = 'test-high-001';
-- Esperado: status = 'pending' (sin cambios)

-- 6. Verificar que el staff recibió email de alerta
-- (Revisar bandeja de entrada del email configurado en N8N)
```

#### Test 3: Cliente LOW que confirma

```sql
-- 1. Crear cliente nuevo sin historial
INSERT INTO customers (id, business_id, name, phone, no_show_count)
VALUES (
    'test-low-001',
    'your-business-id',
    'Pedro García (TEST)',
    '+34600000002',
    0
);

-- 2. Crear appointment para mañana
INSERT INTO appointments (
    business_id, 
    customer_id, 
    appointment_date, 
    appointment_time,
    service_id,
    status
) VALUES (
    'your-business-id',
    'test-low-001',
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    'any-service-id',
    'pending'
);

-- 3. Esperar a que el workflow "Recordatorio 24h" envíe WhatsApp
-- 4. Simular respuesta del cliente
SELECT process_customer_response(
    (SELECT id FROM appointments WHERE customer_id = 'test-low-001'),
    '24h',
    'Sí, confirmo'
);
-- Esperado: retorna true

-- 5. Verificar que el appointment se confirmó
SELECT status FROM appointments WHERE customer_id = 'test-low-001';
-- Esperado: status = 'confirmed'

-- 6. Verificar que se registró la confirmación
SELECT * FROM customer_confirmations WHERE customer_id = 'test-low-001';
-- Esperado: confirmed = true, response_text = 'Sí, confirmo'
```

---

## 📊 MÉTRICAS Y MONITORIZACIÓN

### Dashboard SQL (ejecutar mensualmente)

```sql
-- KPIs del mes
SELECT * FROM get_noshow_stats(
    'your-business-id', 
    DATE_TRUNC('month', CURRENT_DATE), 
    CURRENT_DATE
);
```

**Objetivos**:
| Métrica | Objetivo | Crítico |
|---------|----------|---------|
| Tasa de no-shows | < 10% | > 15% |
| Tasa de respuesta a confirmaciones | > 70% | < 50% |
| No-shows prevenidos (confirmaron tras recordatorio) | > 5/mes | < 2/mes |
| Risk score promedio | < 30 | > 50 |

### Alertas N8N (configurar)

```javascript
// Workflow "Monitor No-Shows Diario"
// Trigger: Cron (9:00 AM diariamente)

const stats = await supabase.rpc('get_noshow_stats', {
  p_business_id: businessId,
  p_date_from: '7 days ago',
  p_date_to: 'today'
});

if (stats.noshow_rate > 15) {
  // Enviar email urgente al gerente
  await sendEmail({
    to: 'gerente@negocio.com',
    subject: '🚨 Alerta: Tasa de no-shows > 15%',
    body: `
      La tasa de no-shows de la última semana es ${stats.noshow_rate}%.
      
      Acciones recomendadas:
      1. Revisar copy de mensajes de confirmación
      2. Llamar personalmente a clientes de alto riesgo
      3. Considerar política de depósito previo
    `
  });
}
```

---

## 🎯 PRÓXIMOS PASOS (FUTURO)

### Fase 2: Integración en LA-IA Frontend

**Objetivo**: Mostrar alertas de alto riesgo en el panel de reservas.

**Componentes a crear**:

1. **Modal de Alto Riesgo** (en `src/pages/Reservas.jsx`):
```jsx
// Cuando se carga la vista del día, consultar appointments de riesgo
useEffect(() => {
  const fetchRiskAppointments = async () => {
    const { data } = await supabase.rpc('get_high_risk_appointments', {
      p_business_id: businessId,
      p_hours_ahead: 24
    });
    
    setRiskAppointments(data);
    
    // Mostrar badge en appointments de riesgo HIGH/CRITICAL
    data.forEach(apt => {
      if (apt.risk_level === 'CRITICAL') {
        // Añadir badge rojo "🔴 RIESGO CRÍTICO"
      } else if (apt.risk_level === 'HIGH') {
        // Añadir badge amarillo "⚠️ RIESGO ALTO"
      }
    });
  };
  
  fetchRiskAppointments();
}, [currentDate]);
```

2. **Botón "Llamar Cliente"** (acción rápida):
```jsx
<Button
  onClick={() => window.open(`tel:${appointment.customer_phone}`)}
  variant="outline"
  size="sm"
>
  📞 Llamar cliente
</Button>
```

3. **Historial de Confirmaciones** (en modal de detalles):
```jsx
// Mostrar timeline de confirmaciones
{confirmations.map(conf => (
  <div key={conf.id}>
    <span>{conf.message_type}</span>
    <span>{conf.sent_at}</span>
    {conf.confirmed ? '✅ Confirmado' : '⏳ Sin respuesta'}
  </div>
))}
```

### Fase 3: Machine Learning (Q1 2026)

- Predecir probabilidad de no-show basado en:
  - Día de la semana
  - Hora del día
  - Clima
  - Servicio solicitado
  - Comportamiento histórico

---

## 🔐 SEGURIDAD Y PRIVACIDAD

### RGPD / Protección de Datos

✅ **Cumplimiento**:
- Los mensajes se registran con consentimiento implícito (al reservar, el cliente acepta recibir recordatorios)
- Los datos se almacenan cifrados en Supabase (AES-256)
- El cliente puede solicitar borrado de sus datos (`DELETE FROM customers WHERE id = '...'`)

### Costes y Límites

**WhatsApp Business (Twilio)**:
- ~5 céntimos/mensaje
- ~450 mensajes/mes = 22,50€/mes
- Límite: 1.000 mensajes/día (sobrado para un negocio mediano)

**SMS (fallback)**:
- ~8 céntimos/mensaje
- Usar solo si WhatsApp falla

---

## 📞 SOPORTE

**Documentación completa**:
- [Análisis del problema](./ANALISIS_WORKFLOW_N8N_NOSHOWS.md)
- [Workflows N8N](./docs/03-workflows/N8N_WORKFLOW_NOSHOWS_V2_CORREGIDO.md)
- [Resumen del sistema](./RESUMEN_NOSHOWS_LAIA.md)

**Contacto**:
- Email: dev@la-ia.com
- Issues: GitHub repo

---

## ✅ CHECKLIST FINAL

### Pre-Despliegue
- [ ] Migración SQL 02 ejecutada sin errores
- [ ] Migración SQL 03 ejecutada sin errores
- [ ] Verificado que `customer_confirmations` tiene 0 registros
- [ ] Verificado que `customers.no_show_count` existe
- [ ] Credenciales Twilio configuradas en N8N
- [ ] Credenciales Supabase configuradas en N8N

### Post-Despliegue
- [ ] Test 1 (CRITICAL) pasado ✅
- [ ] Test 2 (HIGH) pasado ✅
- [ ] Test 3 (LOW) pasado ✅
- [ ] Webhook de Twilio configurado y funcionando
- [ ] Cliente de prueba recibió mensaje 24h
- [ ] Cliente de prueba respondió y se procesó correctamente
- [ ] Slots se liberaron automáticamente al cancelar

### Monitorización (primera semana)
- [ ] Revisar logs de N8N diariamente
- [ ] Verificar que no hay errores en workflows
- [ ] Monitorizar tasa de respuesta de clientes
- [ ] Ajustar copy de mensajes si respuesta < 60%
- [ ] Verificar costes de Twilio (no superar 30€/semana)

---

**🎉 ¡SISTEMA LISTO PARA PRODUCCIÓN!**

**Impacto esperado**:
- 📉 Reducción de no-shows: 10% → 5% (50% de mejora)
- 💰 Ingresos recuperados: ~300€/mes (6 citas/mes x 50€/cita)
- ⏱️ Tiempo ahorrado: ~2h/semana (staff no tiene que llamar)
- 😊 Satisfacción del cliente: Mayor (recordatorios automáticos)

---

**Autor**: LA-IA Development Team  
**Fecha**: 2025-11-23  
**Versión**: 1.0

