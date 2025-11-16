## 🗓️ INTEGRACIÓN GOOGLE CALENDAR - GUÍA COMPLETA

**Fecha:** 8 de Noviembre 2025  
**Estado:** ✅ Implementación completa  
**Tipo:** Sincronización bidireccional

---

## 📋 ¿QUÉ SE IMPLEMENTÓ?

### **✅ Frontend:**
- `GoogleCalendarService.js` - Servicio completo con OAuth y sync
- `GoogleCalendarIntegration.jsx` - UI para conectar/desconectar
- `GoogleCallbackPage.jsx` - Página de callback OAuth

### **✅ Backend (Edge Functions):**
- `google-oauth-callback` - Maneja OAuth 2.0
- `google-calendar-sync` - Sincronización bidireccional

### **✅ Base de Datos:**
- Tabla `integrations` (ya existe en esquema)
- Tabla `google_calendar_events` (ya existe en esquema)

---

## 🚀 CONFIGURACIÓN INICIAL

### **Paso 1: Obtener credenciales de Google**

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto nuevo (o usar uno existente)
3. Activar **Google Calendar API**:
   - APIs & Services → Library → Buscar "Google Calendar API" → Enable
4. Crear credenciales OAuth 2.0:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     http://localhost:5173/auth/google/callback  (desarrollo)
     https://tu-dominio.com/auth/google/callback  (producción)
     ```
5. Copiar **Client ID** y **Client Secret**

---

### **Paso 2: Configurar variables de entorno**

#### **Frontend (.env):**
```bash
VITE_GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
```

#### **Edge Functions (Supabase Dashboard):**
```bash
GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
```

**Dónde configurar:**
1. Supabase Dashboard
2. Edge Functions → Settings
3. Secrets → Add Secret

---

### **Paso 3: Desplegar Edge Functions**

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link a tu proyecto
supabase link --project-ref tu-project-ref

# Deploy functions
supabase functions deploy google-oauth-callback
supabase functions deploy google-calendar-sync
```

---

### **Paso 4: Añadir ruta en el router**

**Archivo:** `src/App.jsx`

```jsx
import GoogleCallbackPage from './pages/GoogleCallbackPage';

// Dentro de <Routes>
<Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
```

---

### **Paso 5: Integrar en Configuración**

**Archivo:** `src/pages/Configuracion.jsx`

```jsx
import GoogleCalendarIntegration from '../components/configuracion/GoogleCalendarIntegration';

// Añadir nueva pestaña
const tabs = [
  // ... otras pestañas
  {
    id: 'integraciones',
    label: 'Integraciones',
    icon: <Plug className="w-5 h-5" />
  }
];

// En el render
{activeTab === 'integraciones' && (
  <GoogleCalendarIntegration businessId={businessId} />
)}
```

---

## 🔄 FLUJO DE FUNCIONAMIENTO

### **1. Conectar (OAuth Flow):**

```
Usuario hace click "Conectar Google Calendar"
    ↓
Redirige a Google OAuth
    ↓
Usuario autoriza permisos
    ↓
Google redirige a /auth/google/callback
    ↓
Edge Function intercambia code por tokens
    ↓
Tokens se guardan en tabla integrations
    ↓
Usuario regresa a Configuración
```

### **2. Sincronización Bidireccional:**

#### **Importar (Google → LA-IA):**
```
1. Fetch events from Google Calendar API
2. Filtrar por rango de fechas
3. Verificar duplicados (por gcal_event_id)
4. Insertar en google_calendar_events
5. Opcionalmente crear appointments
```

#### **Exportar (LA-IA → Google):**
```
1. Query appointments pendientes/confirmadas
2. Verificar duplicados (por appointment_id)
3. Crear evento en Google Calendar API
4. Guardar referencia en google_calendar_events
```

---

## 📊 ESQUEMA DE TABLAS

### **Tabla: integrations**
```sql
CREATE TABLE integrations (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    provider TEXT NOT NULL, -- 'google_calendar'
    credentials JSONB NOT NULL, -- { access_token, refresh_token, ... }
    status TEXT DEFAULT 'active',
    scopes TEXT[],
    metadata JSONB, -- { autoSync: true, intervalMinutes: 15 }
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### **Tabla: google_calendar_events**
```sql
CREATE TABLE google_calendar_events (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    integration_id UUID REFERENCES integrations(id),
    gcal_event_id TEXT NOT NULL, -- ID del evento en Google
    appointment_id UUID REFERENCES appointments(id), -- NULL si solo importado
    summary TEXT,
    description TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT,
    attendees JSONB,
    location TEXT,
    raw_data JSONB,
    last_synced_at TIMESTAMPTZ,
    sync_status TEXT, -- 'synced', 'pending', 'error'
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## 🎯 FUNCIONALIDADES

### **✅ Ya implementadas:**

1. **OAuth 2.0 Flow**
   - Autorización con Google
   - Refresh token automático
   - Manejo de expiración

2. **Sincronización Manual**
   - Importar eventos de Google
   - Exportar citas a Google
   - Sincronizar todo (bidireccional)

3. **Auto-Sync**
   - Configurar intervalo (default: 15 min)
   - Activar/desactivar desde UI

4. **Estadísticas**
   - Total eventos sincronizados
   - Eventos pendientes
   - Eventos con error
   - Última sincronización

5. **UI Profesional**
   - Estado de conexión visual
   - Botones de sincronización
   - Estadísticas en tiempo real

### **⏳ Pendientes (opcional):**

6. **Webhooks en tiempo real**
   - Push notifications de Google
   - Sincronización instantánea

7. **Detección de conflictos**
   - Alertar si hay solapamiento
   - Sugerir horarios alternativos

8. **Sincronización selectiva**
   - Elegir qué calendarios importar
   - Filtrar por tipo de evento

---

## 🧪 TESTING

### **Test manual:**

1. **Conectar:**
```
1. Ir a Configuración → Integraciones
2. Click "Conectar Google Calendar"
3. Autorizar en Google
4. Verificar que aparece "Conectado"
```

2. **Sincronizar:**
```
1. Click "Sincronizar todo"
2. Verificar en consola: "X imported, Y exported"
3. Verificar en Google Calendar que aparecen las citas
4. Verificar en LA-IA que aparecen los eventos
```

3. **Desconectar:**
```
1. Click en botón X rojo
2. Confirmar
3. Verificar que aparece "No conectado"
```

### **Verificar en BD:**

```sql
-- Ver integraciones
SELECT * FROM integrations WHERE provider = 'google_calendar';

-- Ver eventos sincronizados
SELECT * FROM google_calendar_events ORDER BY created_at DESC LIMIT 10;

-- Ver estadísticas
SELECT 
    sync_status, 
    COUNT(*) 
FROM google_calendar_events 
GROUP BY sync_status;
```

---

## 🔐 SEGURIDAD

### **✅ Implementado:**

- ✅ OAuth 2.0 (estándar de Google)
- ✅ Tokens encriptados en BD (JSONB)
- ✅ Refresh token automático
- ✅ RLS en tablas (user_business_mapping)
- ✅ State validation en OAuth flow
- ✅ HTTPS required para producción

### **⚠️ Recomendaciones:**

- 🔒 Nunca exponer Client Secret en frontend
- 🔒 Usar HTTPS en producción
- 🔒 Revisar permisos OAuth periódicamente
- 🔒 Implementar rate limiting en Edge Functions

---

## 🐛 TROUBLESHOOTING

### **Error: "redirect_uri_mismatch"**
**Solución:** Añadir URI exacta en Google Cloud Console

### **Error: "invalid_grant"**
**Solución:** Token expirado, reconectar desde UI

### **Error: "insufficient_permissions"**
**Solución:** Re-autorizar con permisos completos

### **Error: "quota_exceeded"**
**Solución:** Aumentar quota en Google Cloud Console

### **Error: "Edge function timeout"**
**Solución:** Reducir dateRange en sync, o procesar en batches

---

## 📈 PRÓXIMAS MEJORAS

1. **Webhooks de Google** (push notifications)
2. **Sync incremental** (solo cambios recientes)
3. **Mapeo de recursos** (asignar eventos a sillones/camillas)
4. **Conflictos automáticos** (detectar y resolver)
5. **Multi-calendario** (sincronizar varios calendarios)

---

## 📚 RECURSOS

- [Google Calendar API Docs](https://developers.google.com/calendar/api/v3/reference)
- [OAuth 2.0 Google](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

**✅ Implementación completada el 8 de Noviembre 2025**  
**🚀 Lista para producción con configuración de variables de entorno**

