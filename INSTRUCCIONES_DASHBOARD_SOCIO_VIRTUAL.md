# 🎉 DASHBOARD "SOCIO VIRTUAL" - INSTRUCCIONES DE USO

## ✅ ESTADO DEL PROYECTO

### Backend: **100% DESPLEGADO Y FUNCIONANDO** ✅
- ✅ 3 Funciones SQL creadas y probadas
- ✅ 4 Edge Functions desplegadas (`get-snapshot`, `generate-flash-offer-text`, `transfer-appointments`, `cancel-appointments-batch`)
- ✅ OpenAI API configurada
- ✅ Google Calendar integrado

### Frontend: **CÓDIGO CREADO Y LISTO** ✅
- ✅ 2 Hooks personalizados (`useDashboardSnapshot`, `useActionExecutor`)
- ✅ 3 Componentes nuevos (`LuaAvatar`, `MetricsBar`, `LiveTurnsWidget`)
- ✅ 1 Página de integración (`DashboardSocioVirtual`)

---

## 📂 ARCHIVOS CREADOS

### Hooks (Lógica de negocio)
```
src/hooks/
├── useDashboardSnapshot.js    ← Conecta con get-snapshot cada 2 min
└── useActionExecutor.js       ← Ejecuta acciones (transferir, cancelar, etc.)
```

### Componentes (Vista)
```
src/components/dashboard/
├── LuaAvatar.jsx              ← El Cerebro (avatar + bocadillo + botones)
├── MetricsBar.jsx             ← La Salud (4 KPIs compactos)
├── LiveTurnsWidget.jsx        ← El Pulso (turnos en vivo)
└── index.js                   ← Exports centralizados
```

### Página Principal
```
src/pages/
└── DashboardSocioVirtual.jsx  ← Dashboard completo integrado
```

---

## 🚀 CÓMO ACTIVAR EL NUEVO DASHBOARD

### Opción 1: Reemplazar el Dashboard Actual (Recomendado)

**1. Abre tu archivo de rutas** (probablemente `src/App.jsx` o `src/routes.jsx`)

**2. Busca la ruta del dashboard actual:**
```javascript
// ANTES
import DashboardAgente from './pages/DashboardAgente';

<Route path="/dashboard" element={<DashboardAgente />} />
```

**3. Reemplázala con el nuevo dashboard:**
```javascript
// DESPUÉS
import DashboardSocioVirtual from './pages/DashboardSocioVirtual';

<Route path="/dashboard" element={<DashboardSocioVirtual />} />
```

**¡Listo!** El nuevo dashboard estará activo y el antiguo quedará plegado debajo.

---

### Opción 2: Crear una Ruta Nueva (Para probar primero)

**1. Agrega una ruta nueva:**
```javascript
import DashboardSocioVirtual from './pages/DashboardSocioVirtual';

<Route path="/dashboard-v3" element={<DashboardSocioVirtual />} />
```

**2. Visita:** `http://localhost:3000/dashboard-v3`

**3. Si funciona bien, cambia la ruta principal.**

---

## 🧪 CÓMO PROBAR QUE FUNCIONA

### 1. Verificar que el Backend Responde

Abre la consola del navegador (F12) y busca estos logs:

```
📊 Fetching dashboard snapshot for business: 3bbe9ac3-3e61-471e-822e-e159f6ad8ae2
✅ Snapshot received: PALMADA_ESPALDA
```

Si ves esto, el hook está conectado correctamente.

---

### 2. Verificar los 4 Escenarios

El dashboard mostrará uno de estos 4 escenarios según el estado real:

#### 🚨 ESCENARIO 1: CRISIS DE PERSONAL
- **Cuándo:** Empleado ausente con citas asignadas
- **Color:** Rojo
- **Botones:** "Mover citas a [empleado]" | "Cancelar y reagendar"

#### ⚠️ ESCENARIO 2: RIESGO DE NO-SHOW
- **Cuándo:** Cliente con historial de no-shows sin confirmar
- **Color:** Naranja
- **Botones:** "Llamar ahora" | "Enviar WhatsApp"

#### 💰 ESCENARIO 3: HUECO MUERTO
- **Cuándo:** Slot libre en las próximas 2 horas
- **Color:** Azul
- **Botones:** "Generar Oferta Flash"

#### 👏 ESCENARIO 4: PALMADA EN LA ESPALDA
- **Cuándo:** Todo funcionando correctamente
- **Color:** Verde
- **Botones:** "Ver agenda de mañana" | "Ver desglose de caja"

---

### 3. Probar las Acciones

**Acción Segura (No requiere confirmación):**
- Haz clic en "Ver agenda de mañana" → Debe navegar a `/reservas?date=tomorrow`

**Acción Destructiva (Requiere confirmación):**
1. Haz clic en "Mover citas a [empleado]"
2. Debe aparecer un modal de confirmación
3. Si aceptas → Se ejecuta la Edge Function `transfer-appointments`
4. Debe aparecer un toast: "✅ Citas transferidas y clientes notificados"

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema 1: No se muestra el dashboard
**Error:** Pantalla en blanco o "Loading..." infinito

**Solución:**
1. Abre la consola (F12)
2. Busca errores de import
3. Verifica que tienes `lucide-react` instalado:
   ```bash
   npm install lucide-react
   ```

---

### Problema 2: "Cannot find module '../hooks/useDashboardSnapshot'"
**Error:** El import del hook no se resuelve

**Solución:**
1. Verifica que el archivo existe en `src/hooks/useDashboardSnapshot.js`
2. Verifica que la ruta del import es correcta
3. Reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

### Problema 3: El snapshot siempre muestra "ERROR"
**Error:** Lua muestra "Hubo un problema al analizar el estado"

**Solución:**
1. Verifica que `get-snapshot` está desplegada:
   - Ve a Supabase Dashboard → Edge Functions
   - Confirma que `get-snapshot` está activa

2. Prueba manualmente la función:
   - Ve a Supabase Dashboard → Edge Functions → `get-snapshot`
   - Haz clic en "Invoke"
   - Pega: `{ "business_id": "tu-business-id-aqui" }`
   - Debe retornar un JSON con `scenario`, `lua_message`, `actions`

3. Verifica los permisos RLS:
   - El usuario autenticado debe tener acceso a `appointments`, `employees`, `customers`

---

### Problema 4: Las métricas están en 0
**Error:** La barra de salud muestra "0€ | 0 Citas | 0 VIP | 0 Riesgo"

**Solución:**
1. Esto es **normal si no tienes datos hoy**
2. Para probar con datos reales:
   - Ve a `/reservas` y crea una cita para hoy
   - Refresca el dashboard
   - Las métricas deberían actualizarse

---

### Problema 5: LiveTurnsWidget muestra "No hay recursos configurados"
**Error:** El widget de turnos está vacío

**Solución:**
1. Ve a la tabla `resources` en Supabase
2. Verifica que tienes recursos activos (`is_active = true`)
3. Si no tienes, crea algunos:
   ```sql
   INSERT INTO resources (business_id, name, resource_type, is_active)
   VALUES 
     ('tu-business-id', 'Silla 1', 'chair', true),
     ('tu-business-id', 'Silla 2', 'chair', true),
     ('tu-business-id', 'Box Estética', 'box', true);
   ```

---

## 🎨 PERSONALIZACIÓN

### Cambiar el nombre del agente
Edita `businesses.settings.agent.name` en Supabase:

```sql
UPDATE businesses 
SET settings = jsonb_set(
  settings, 
  '{agent,name}', 
  '"Sofía"'
)
WHERE id = 'tu-business-id';
```

---

### Cambiar el avatar del agente
Sube una imagen a Supabase Storage y actualiza:

```sql
UPDATE businesses 
SET settings = jsonb_set(
  settings, 
  '{agent,avatar_url}', 
  '"https://tu-supabase.co/storage/v1/object/public/avatars/lua.png"'
)
WHERE id = 'tu-business-id';
```

---

### Cambiar el intervalo de auto-refresh
Edita `src/hooks/useDashboardSnapshot.js`:

```javascript
// ANTES: 120000 (2 minutos)
const interval = setInterval(fetchSnapshot, 120000);

// DESPUÉS: 60000 (1 minuto)
const interval = setInterval(fetchSnapshot, 60000);
```

---

## 📊 MÉTRICAS Y MONITOREO

### Logs en Supabase
Para ver los logs de las Edge Functions:

1. Ve a Supabase Dashboard → **Edge Functions**
2. Haz clic en la función que quieres monitorear
3. Haz clic en la pestaña **Logs**
4. Verás todos los `console.log()` que pusimos en el código

Ejemplo de logs esperados:
```
📊 Analizando snapshot para business 3bbe9ac3...
🔍 Verificando crisis de personal...
🔍 Verificando riesgo de no-show...
🔍 Verificando huecos libres...
👏 Todo bien, generando palmada en la espalda...
```

---

## 🎯 PRÓXIMOS PASOS (MEJORAS FUTURAS)

### 1. Añadir más escenarios
- **Pico de demanda:** Muchas citas en poco tiempo
- **Cliente VIP llegando:** Preparar atención especial
- **Inventario bajo:** Alertar de productos agotándose

### 2. Mejorar las etiquetas de LiveTurnsWidget
- Mostrar el servicio que está recibiendo el cliente
- Mostrar el tiempo restante de la cita
- Añadir botón de "Finalizar turno" rápido

### 3. Integrar con notificaciones push
- Alertas en tiempo real cuando hay crisis
- Notificaciones de navegador con `Notification API`

### 4. Dashboard Analytics
- Histórico de escenarios detectados
- Métricas de eficiencia de Lua
- Tiempo promedio de resolución de crisis

---

## 🦞 LA CENA DE MARISCOS

Si todo funciona a la primera, **¡has ganado!** 🎉

Si algo falla, revisa esta guía o déjame un mensaje con el error exacto que ves en la consola.

---

## 📞 SOPORTE

Si necesitas ayuda:
1. Abre la consola del navegador (F12)
2. Copia el error completo
3. Mándamelo junto con lo que estabas haciendo

**Archivos clave para debuggear:**
- `src/hooks/useDashboardSnapshot.js` → Conexión con backend
- `src/components/dashboard/LuaAvatar.jsx` → Renderizado del avatar
- `supabase/functions/get-snapshot/index.ts` → Lógica de escenarios

---

¡A disfrutar del Dashboard "Socio Virtual"! 🚀

