# 🏆 REGLA DE ORO #2: DATOS REALES ÚNICAMENTE

## ⚠️ REGLA FUNDAMENTAL INQUEBRANTABLE

**TODOS LOS DATOS DEBEN SER REALES O CALCULADOS - PROHIBIDO MOCKEAR/INVENTAR**

### 🚫 PROHIBICIONES ABSOLUTAS

1. **NO datos hardcodeados** fijos en el código
2. **NO datos ficticios** inventados para testing
3. **NO datos mockeados** para que "se vea bien"
4. **NO valores por defecto** que no reflejen la realidad
5. **NO estadísticas falsas** para impresionar

### ✅ ORÍGENES AUTORIZADOS DE DATOS

#### 1. **Base de Datos (Supabase)**
```javascript
// ✅ CORRECTO: Leer de tabla real
const { data } = await supabase.from('reservations').select('*');
const totalReservations = data?.length || 0;

// ❌ INCORRECTO: Inventar datos
const totalReservations = 150; // ← PROHIBIDO
```

#### 2. **Cálculos Matemáticos Reales**
```javascript
// ✅ CORRECTO: Calcular desde datos reales
const occupancyRate = (occupiedSlots / totalSlots) * 100;

// ❌ INCORRECTO: Inventar porcentaje
const occupancyRate = 85; // ← PROHIBIDO
```

#### 3. **Configuración del Usuario**
```javascript
// ✅ CORRECTO: Leer configuración real
const duration = businessesettings?.reservation_duration || 90;

// ❌ INCORRECTO: Hardcodear valor
const duration = 90; // ← PROHIBIDO (debe leerse de settings)
```

#### 4. **APIs y Servicios Externos**
```javascript
// ✅ CORRECTO: Respuesta real de API
const weatherData = await fetch('/api/weather').then(r => r.json());

// ❌ INCORRECTO: Simular respuesta
const weatherData = { temp: 25, status: 'sunny' }; // ← PROHIBIDO
```

### 🔍 AUDITORÍA DE CÓDIGO ACTUAL

#### ✅ **EJEMPLOS CORRECTOS EN LA APLICACIÓN:**

| Componente | Dato | Origen | Estado |
|------------|------|---------|---------|
| AvailabilityManager | `businessesettings` | `businesses.settings` | ✅ REAL |
| Reservas | `policySettings` | `businesses.settings` | ✅ REAL |
| Dashboard | `reservationCount` | `COUNT(reservations)` | ✅ REAL |
| Mesas | `tableStats` | `tables + reservations` | ✅ REAL |

#### ⚠️ **VIGILAR CONSTANTEMENTE:**

| Tipo de Dato | Riesgo | Verificación |
|--------------|--------|--------------|
| Estadísticas | Alto | ¿Viene de COUNT/SUM real? |
| Configuraciones | Medio | ¿Se lee de settings? |
| Fechas/Horas | Medio | ¿Usa Date() real o hardcoded? |
| Métricas | Alto | ¿Cálculo real o inventado? |

### 🚨 SEÑALES DE ALERTA

#### **Frases PROHIBIDAS en el código:**
- `// TODO: usar datos reales`
- `// Datos de prueba`
- `// Mock data`
- `const fakeData = ...`
- `// Hardcoded for now`

#### **Patrones PROHIBIDOS:**
```javascript
// ❌ PROHIBIDO: Arrays inventados
const mockReservations = [
    { id: 1, name: 'Test User' }
];

// ❌ PROHIBIDO: Valores fijos
const TOTAL_CAPACITY = 100;

// ❌ PROHIBIDO: Estadísticas inventadas
const conversionRate = 23.5;
```

### 🛡️ PROTECCIONES IMPLEMENTADAS

#### 1. **Validación en Tiempo de Desarrollo**
- Revisar que todos los datos vengan de fuentes reales
- Verificar que los cálculos usen datos de BD
- Confirmar que las configuraciones se lean de settings

#### 2. **Logging para Auditoría**
```javascript
// ✅ CORRECTO: Log del origen de datos
console.log('📊 Datos cargados desde:', {
    source: 'supabase.reservations',
    count: data.length,
    timestamp: new Date()
});
```

#### 3. **Comentarios Obligatorios**
```javascript
// ✅ CORRECTO: Documentar origen
// Datos reales desde businesses.settings.reservation_duration
const duration = businessesettings?.reservation_duration || 90;
```

### 📋 CHECKLIST ANTES DE CUALQUIER COMMIT

- [ ] ¿Todos los datos vienen de BD o cálculos reales?
- [ ] ¿No hay valores hardcodeados que deberían ser configurables?
- [ ] ¿Las estadísticas se calculan desde datos reales?
- [ ] ¿Los valores por defecto son razonables y documentados?
- [ ] ¿No hay arrays o objetos "mock" en el código?

### 💡 PRINCIPIO RECTOR

> **"Prefiero mostrar 0 datos reales que 1000 datos falsos"**

### 🎯 OBJETIVO

**Construir confianza absoluta del usuario en que TODOS los datos que ve son 100% reales y precisos.**

---

**Esta regla es INQUEBRANTABLE y debe ser respetada por todos los desarrolladores.**

**Fecha de creación:** 28 de septiembre de 2025  
**Última actualización:** 28 de septiembre de 2025  
**Estado:** ACTIVA Y OBLIGATORIA
