# 📍 Almacenamiento de Configuración de Reservas

## 🗄️ Ubicación en la Base de Datos

La configuración de reservas se almacena en la tabla `businesses` en **dos ubicaciones posibles**:

### 1. **Columna `booking_settings` (JSONB)** - ⭐ **RECOMENDADO**
```sql
SELECT booking_settings 
FROM businesses 
WHERE id = 'business_id';
```

**Estructura:**
```json
{
  "advance_booking_days": 30,
  "min_booking_hours": 2,
  "min_advance_minutes": 120,
  "max_party_size": 12,
  "require_confirmation": true,
  "allow_modifications": true,
  "cancellation_policy": "24h"
}
```

### 2. **Columna `settings.booking_settings` (JSONB anidado)** - Fallback
```sql
SELECT settings->'booking_settings' 
FROM businesses 
WHERE id = 'business_id';
```

## 📋 Campos Disponibles

| Campo | Tipo | Descripción | Valores Posibles |
|-------|------|-------------|------------------|
| `advance_booking_days` | `integer` | Días máximos de anticipación para reservar | 7-365 |
| `min_advance_minutes` | `integer` | Minutos mínimos antes de la cita para permitir reservas | 0-1440 |
| `min_booking_hours` | `integer` | Horas mínimas de antelación (legacy) | 0-24 |
| `max_party_size` | `integer` | Tamaño máximo de grupo (solo restaurantes/yoga) | 1-100 |
| `require_confirmation` | `boolean` | Requiere confirmación manual de reservas | `true`/`false` |
| `allow_modifications` | `boolean` | Permite modificar reservas después de crear | `true`/`false` |
| `cancellation_policy` | `string` | Política de cancelación | `"1h"`, `"2h"`, `"4h"`, `"24h"`, `"48h"`, `"none"` |

## 🔍 Cómo Consultar desde Código

### **Opción 1: Desde Supabase Client (Frontend/Backend)**
```javascript
import { supabase } from '../lib/supabase';

// Obtener configuración completa
const { data, error } = await supabase
  .from('businesses')
  .select('booking_settings')
  .eq('id', businessId)
  .single();

const bookingSettings = data?.booking_settings || {};

// Acceder a campos específicos
const cancellationPolicy = bookingSettings.cancellation_policy; // "24h"
const requiresConfirmation = bookingSettings.require_confirmation; // true
const minAdvanceMinutes = bookingSettings.min_advance_minutes; // 120
```

### **Opción 2: Desde PostgreSQL (Funciones/Triggers)**
```sql
-- En una función o trigger
SELECT booking_settings->>'cancellation_policy' as policy,
       (booking_settings->>'require_confirmation')::boolean as needs_confirmation,
       (booking_settings->>'min_advance_minutes')::integer as min_minutes
FROM businesses
WHERE id = p_business_id;
```

### **Opción 3: Desde Contexto React (Frontend)**
```javascript
import { useAuthContext } from '../contexts/AuthContext';

function MyComponent() {
  const { business } = useAuthContext();
  
  const bookingSettings = business?.booking_settings || {};
  const cancellationPolicy = bookingSettings.cancellation_policy;
  const requiresConfirmation = bookingSettings.require_confirmation;
}
```

## 🔔 Uso en Workflows y Notificaciones

### **Ejemplo: Workflow de Confirmación de Reserva**
```javascript
// services/notificationService.js
export async function sendConfirmationNotification(appointment, businessId) {
  // 1. Obtener configuración
  const { data } = await supabase
    .from('businesses')
    .select('booking_settings')
    .eq('id', businessId)
    .single();
  
  const settings = data?.booking_settings || {};
  
  // 2. Verificar si requiere confirmación
  if (settings.require_confirmation) {
    // Enviar notificación al negocio para confirmar
    await sendBusinessNotification({
      type: 'reservation_pending_confirmation',
      appointment: appointment,
      message: 'Nueva reserva pendiente de confirmación'
    });
  } else {
    // Confirmación automática
    await sendCustomerConfirmation(appointment);
  }
}
```

### **Ejemplo: Workflow de Cancelación**
```javascript
// services/cancellationService.js
export async function checkCancellationPolicy(appointment, businessId) {
  const { data } = await supabase
    .from('businesses')
    .select('booking_settings')
    .eq('id', businessId)
    .single();
  
  const policy = data?.booking_settings?.cancellation_policy;
  
  if (policy === 'none') {
    return { allowed: true, message: 'Cancelación libre' };
  }
  
  // Calcular tiempo restante
  const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
  const now = new Date();
  const hoursUntil = (appointmentDate - now) / (1000 * 60 * 60);
  
  const policyHours = {
    '1h': 1,
    '2h': 2,
    '4h': 4,
    '24h': 24,
    '48h': 48
  }[policy] || 24;
  
  if (hoursUntil < policyHours) {
    return { 
      allowed: false, 
      message: `Debes cancelar con al menos ${policyHours} horas de antelación` 
    };
  }
  
  return { allowed: true };
}
```

### **Ejemplo: Validación de Modificaciones**
```javascript
// services/modificationService.js
export async function canModifyReservation(appointment, businessId) {
  const { data } = await supabase
    .from('businesses')
    .select('booking_settings')
    .eq('id', businessId)
    .single();
  
  const allowModifications = data?.booking_settings?.allow_modifications ?? true;
  
  if (!allowModifications) {
    return { 
      allowed: false, 
      message: 'Las modificaciones de reservas no están permitidas' 
    };
  }
  
  // Verificar tiempo mínimo de antelación
  const minAdvanceMinutes = data?.booking_settings?.min_advance_minutes || 120;
  const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
  const now = new Date();
  const minutesUntil = (appointmentDate - now) / (1000 * 60);
  
  if (minutesUntil < minAdvanceMinutes) {
    return { 
      allowed: false, 
      message: `No se pueden modificar reservas con menos de ${minAdvanceMinutes} minutos de antelación` 
    };
  }
  
  return { allowed: true };
}
```

## 📝 Notas Importantes

1. **Fallback**: Si `booking_settings` no existe, buscar en `settings.booking_settings`
2. **Valores por defecto**: Siempre usar valores por defecto si el campo no existe
3. **Tipo de negocio**: Algunos campos como `max_party_size` solo aplican a ciertos verticales
4. **Actualización**: Los cambios se guardan automáticamente cuando el usuario guarda en la UI

## 🔄 Migración de Datos

Si necesitas migrar datos de `settings.booking_settings` a `booking_settings`:

```sql
UPDATE businesses
SET booking_settings = COALESCE(
  booking_settings,
  settings->'booking_settings',
  '{}'::jsonb
)
WHERE booking_settings IS NULL 
  AND settings->'booking_settings' IS NOT NULL;
```

## 📚 Referencias

- **Tabla**: `businesses`
- **Columna principal**: `booking_settings` (JSONB)
- **Columna alternativa**: `settings->'booking_settings'` (JSONB anidado)
- **Componente de configuración**: `src/components/configuracion/RestaurantSettings.jsx`
- **Página de configuración**: `src/pages/Configuracion.jsx` (pestaña "Reservas")

