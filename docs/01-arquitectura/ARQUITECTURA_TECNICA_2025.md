# 🏗️ ARQUITECTURA TÉCNICA - LA-IA APP V1

**Sistema de Gestión de Restaurantes con IA**  
**Versión:** 1.0  
**Última actualización:** 6 de Octubre de 2025

---

## 📋 ÍNDICE

1. [Visión General](#visión-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura de Base de Datos](#arquitectura-de-base-de-datos)
4. [Arquitectura Frontend](#arquitectura-frontend)
5. [Arquitectura Backend](#arquitectura-backend)
6. [Integraciones Externas](#integraciones-externas)
7. [Seguridad y Multi-Tenancy](#seguridad-y-multi-tenancy)
8. [Flujos de Datos Críticos](#flujos-de-datos-críticos)
9. [Performance y Escalabilidad](#performance-y-escalabilidad)
10. [Deployment y DevOps](#deployment-y-devops)

---

## 🎯 VISIÓN GENERAL

### **Propósito**
La-IA App es una plataforma SaaS multi-tenant diseñada para revolucionar la gestión de restaurantes mediante:
- Gestión inteligente de reservas (incluyendo grupos grandes)
- CRM avanzado con segmentación automática
- Agente IA conversacional (WhatsApp, teléfono)
- Analytics en tiempo real
- Sistema de no-shows predictivo

### **Principios de Diseño**
1. **Datos Reales Siempre** - 0% mockups, 100% datos de producción
2. **Multi-Tenant First** - Aislamiento total por restaurante
3. **Performance** - Optimización en cada capa
4. **Seguridad** - RLS en base de datos, validación en frontend/backend
5. **Escalabilidad** - Diseño para soportar miles de restaurantes

---

## 🛠️ STACK TECNOLÓGICO

### **Frontend**
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 18.3.1 | Framework UI |
| Vite | 5.4.8 | Build tool & dev server |
| React Router | 6.26.2 | Routing |
| Tailwind CSS | 3.4.13 | Styling |
| Lucide React | 0.447.0 | Iconos |
| date-fns | 4.1.0 | Manipulación de fechas |
| React Hot Toast | 2.4.1 | Notificaciones |
| Recharts | 2.12.7 | Gráficos |
| Zustand | 4.5.5 | State management |

### **Backend**
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | 20.x | Runtime |
| Express | 4.21.1 | API server |
| Supabase | Latest | BaaS (Auth, DB, Storage, Realtime) |
| Nodemailer | 6.9.15 | Envío de emails |
| PostgreSQL | 15.x | Base de datos (vía Supabase) |

### **Infraestructura**
| Servicio | Propósito |
|----------|-----------|
| Vercel | Hosting frontend + API routes |
| Supabase | Backend as a Service |
| Hostinger | SMTP para emails |
| N8n | Workflow automation (WhatsApp, etc.) |

### **Herramientas de Desarrollo**
| Herramienta | Propósito |
|-------------|-----------|
| ESLint | Linting |
| Vitest | Testing |
| Git | Control de versiones |
| GitHub | Repositorio remoto |

---

## 🗄️ ARQUITECTURA DE BASE DE DATOS

### **Modelo de Datos Principal**

```
┌─────────────────┐
│   restaurants   │ (Tenant principal)
└────────┬────────┘
         │
         ├──────────┬──────────┬──────────┬──────────┐
         │          │          │          │          │
    ┌────▼────┐ ┌──▼───┐ ┌────▼────┐ ┌──▼───┐ ┌────▼────┐
    │ tables  │ │users │ │customers│ │ ... │ │settings │
    └────┬────┘ └──────┘ └────┬────┘ └─────┘ └─────────┘
         │                    │
         │              ┌─────▼─────────┐
         │              │  reservations │
         │              └───────┬───────┘
         │                      │
         └──────────────────────┤
                                │
                    ┌───────────▼────────────┐
                    │  reservation_tables    │ (NEW)
                    │  (many-to-many)        │
                    └────────────────────────┘
```

### **Tablas Principales**

#### **1. `restaurants`**
**Propósito:** Tenant principal, un registro por restaurante

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `owner_id` | UUID | FK a `auth.users` |
| `name` | TEXT | Nombre del restaurante |
| `email` | TEXT | Email de contacto |
| `phone` | TEXT | Teléfono |
| `address` | TEXT | Dirección completa |
| `city` | TEXT | Ciudad |
| `postal_code` | TEXT | Código postal |
| `cuisine_type` | TEXT | Tipo de cocina |
| `settings` | JSONB | Configuración (horarios, agente, etc.) |
| `logo_url` | TEXT | URL del logo en Supabase Storage |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Última actualización |

**Índices:**
- `idx_restaurants_owner_id` en `owner_id`
- `idx_restaurants_email` en `email`

**RLS:** Habilitado - Solo el `owner_id` puede ver/editar

---

#### **2. `tables`**
**Propósito:** Mesas del restaurante

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `restaurant_id` | UUID | FK a `restaurants` |
| `table_number` | INTEGER | Número de mesa |
| `name` | TEXT | Nombre (ej: "Mesa VIP") |
| `capacity` | INTEGER | Capacidad (personas) |
| `zone` | TEXT | Zona (interior, terraza, privado) |
| `is_active` | BOOLEAN | Activa/Inactiva |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Índices:**
- `idx_tables_restaurant_id` en `restaurant_id`
- `idx_tables_zone` en `zone`

**RLS:** Habilitado - Por `restaurant_id`

---

#### **3. `customers`**
**Propósito:** Base de datos de clientes (CRM)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `restaurant_id` | UUID | FK a `restaurants` |
| `first_name` | TEXT | Nombre |
| `last_name1` | TEXT | Primer apellido |
| `last_name2` | TEXT | Segundo apellido (opcional) |
| `phone` | TEXT | Teléfono (único por restaurante) |
| `email` | TEXT | Email (opcional) |
| `birthday` | DATE | Fecha de cumpleaños (opcional) |
| `visits_count` | INTEGER | Número de visitas |
| `total_spent` | DECIMAL | Gasto total acumulado |
| `avg_party_size` | DECIMAL | Tamaño promedio de grupo |
| `segment_auto` | TEXT | Segmento automático (nuevo, habitual, VIP) |
| `segment_manual` | TEXT | Segmento manual (override) |
| `tags` | TEXT[] | Tags personalizados |
| `notes` | TEXT | Notas internas |
| `last_visit` | TIMESTAMPTZ | Última visita |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Índices:**
- `idx_customers_restaurant_id` en `restaurant_id`
- `idx_customers_phone` en `phone`
- `idx_customers_segment` en `segment_auto`

**RLS:** Habilitado - Por `restaurant_id`

**Segmentación Automática:**
- `nuevo`: `visits_count = 1`
- `habitual`: `visits_count >= 2 AND visits_count < 5`
- `vip`: `visits_count >= 5`

---

#### **4. `reservations`**
**Propósito:** Reservas del restaurante

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `restaurant_id` | UUID | FK a `restaurants` |
| `customer_id` | UUID | FK a `customers` (nullable) |
| `table_id` | UUID | FK a `tables` (nullable, legacy) |
| `reservation_date` | DATE | Fecha de la reserva |
| `reservation_time` | TIME | Hora de la reserva |
| `party_size` | INTEGER | Número de personas |
| `status` | TEXT | Estado (ver estados abajo) |
| `channel` | TEXT | Canal (whatsapp, telefono, web, etc.) |
| `source` | TEXT | Fuente (agente_ia, manual, etc.) |
| `special_requests` | TEXT | Peticiones especiales |
| `cancellation_reason` | TEXT | Motivo de cancelación |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Última actualización |

**Estados Posibles:**
- `pending` - Pendiente de confirmación
- `pending_approval` - Grupo grande, requiere aprobación
- `confirmed` - Confirmada
- `seated` - Cliente sentado
- `completed` - Completada
- `cancelled` - Cancelada
- `no_show` - No se presentó

**Índices:**
- `idx_reservations_restaurant_id` en `restaurant_id`
- `idx_reservations_customer_id` en `customer_id`
- `idx_reservations_date` en `reservation_date`
- `idx_reservations_status` en `status`

**RLS:** Habilitado - Por `restaurant_id`

---

#### **5. `reservation_tables` (NEW)**
**Propósito:** Relación many-to-many entre reservas y mesas (grupos grandes)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `reservation_id` | UUID | FK a `reservations` (ON DELETE CASCADE) |
| `table_id` | UUID | FK a `tables` (ON DELETE CASCADE) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Constraint:**
- `UNIQUE(reservation_id, table_id)` - Una mesa no puede estar dos veces en la misma reserva

**Índices:**
- `idx_reservation_tables_reservation` en `reservation_id`
- `idx_reservation_tables_table` en `table_id`

**RLS:** Habilitado - Por `restaurant_id` vía JOIN con `reservations`

**Uso:**
- Reserva normal (1 mesa): 1 fila en `reservation_tables`
- Grupo grande (2-3 mesas): 2-3 filas en `reservation_tables`

---

#### **6. `message_templates`**
**Propósito:** Templates de mensajes para CRM y notificaciones

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `restaurant_id` | UUID | FK a `restaurants` |
| `name` | TEXT | Nombre del template |
| `category` | TEXT | Categoría (recordatorio, marketing, grupo_grande, etc.) |
| `segment` | TEXT | Segmento objetivo (all, nuevo, habitual, vip) |
| `event_trigger` | TEXT | Evento que lo dispara |
| `content_markdown` | TEXT | Contenido con variables |
| `variables` | TEXT[] | Lista de variables disponibles |
| `channel` | TEXT | Canal (whatsapp, email, sms) |
| `is_active` | BOOLEAN | Activo/Inactivo |
| `template_type` | TEXT | Tipo (ver tipos abajo) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Tipos de Template:**
- `bienvenida`, `reactivacion`, `vip_upgrade`, `recordatorio`, `marketing`
- `feedback`, `alto_valor`, `en_riesgo`
- `aprobacion_grupo`, `rechazo_grupo`, `confirmacion_24h` (NEW)

**Variables Comunes:**
- `{{customer_name}}`, `{{restaurant_name}}`, `{{reservation_date}}`
- `{{reservation_time}}`, `{{party_size}}`, `{{zone}}`

**Índices:**
- `idx_message_templates_restaurant_id` en `restaurant_id`
- `idx_message_templates_event_trigger` en `event_trigger`
- `idx_message_templates_category` en `category`

**RLS:** Habilitado - Por `restaurant_id`

---

### **Migraciones Aplicadas (Octubre 2025)**

1. **`20251006_001_reservation_tables.sql`**
   - Crea tabla `reservation_tables`
   - Migra datos existentes de `reservations.table_id`
   - Habilita RLS

2. **`20251006_002_message_templates_grupo_grande.sql`**
   - Añade 3 nuevos tipos de template
   - Inserta templates para grupos grandes
   - Crea índices de performance

3. **`20251006_003_fix_duplicate_customer_fk.sql`**
   - Elimina foreign keys duplicadas
   - Crea FK única y limpia: `reservations_customer_id_fkey`
   - Resuelve error PGRST201

---

## 🎨 ARQUITECTURA FRONTEND

### **Estructura de Carpetas**

```
src/
├── api/                    # API helpers
├── components/             # Componentes reutilizables
│   ├── configuracion/      # Componentes de configuración
│   ├── reservas/           # Componentes de reservas
│   ├── Layout.jsx          # Layout principal con sidebar
│   ├── DashboardRevolutionary.jsx
│   └── ...
├── contexts/               # React Contexts
│   ├── AuthContext.jsx     # Autenticación y restaurant
│   └── ...
├── hooks/                  # Custom hooks
│   ├── useReservationWizard.js
│   ├── useAvailabilityChangeDetection.js
│   └── ...
├── pages/                  # Páginas principales
│   ├── DashboardAgente.jsx # Dashboard del Agente IA
│   ├── Reservas.jsx        # Gestión de reservas
│   ├── Clientes.jsx        # CRM
│   ├── Mesas.jsx           # Gestión de mesas
│   ├── Configuracion.jsx   # Configuración
│   └── ...
├── services/               # Servicios de negocio
│   ├── reservationValidationService.js
│   ├── realtimeEmailService.js
│   ├── AvailabilityService.js
│   └── ...
├── stores/                 # Zustand stores
├── utils/                  # Utilidades
├── App.jsx                 # Router principal
└── index.jsx               # Entry point
```

### **Flujo de Autenticación**

```
1. Usuario → Login.jsx
2. Supabase Auth → signInWithPassword()
3. AuthContext → fetchRestaurantInfo()
4. Query: user_restaurant_mapping → restaurant_id
5. Query: restaurants → restaurant data
6. Context actualizado → App renderiza
7. Redirect → /dashboard-agente
```

### **Gestión de Estado**

#### **Global (AuthContext)**
- `user` - Usuario autenticado
- `restaurant` - Datos del restaurante
- `restaurantId` - ID del tenant
- `isAuthenticated` - Estado de autenticación

#### **Local (useState/useReducer)**
- Estados de formularios
- Modales abiertos/cerrados
- Filtros de tablas

#### **Zustand Stores**
- `useReservationStore` - Estado de reservas
- `useCustomerStore` - Estado de clientes
- `useNotificationStore` - Notificaciones

### **Componentes Clave**

#### **`ReservationWizard.jsx`**
**Propósito:** Wizard paso a paso para crear/editar reservas

**Pasos:**
1. Cliente (búsqueda por teléfono)
2. Fecha (validación contra horarios)
3. Hora (validación de disponibilidad)
4. Personas (validación de capacidad)
5. Zona (selección de zona para grupos grandes)
6. Mesas (selección simple o múltiple)
7. Confirmación (resumen y estado)

**Validaciones:**
- Tiempo mínimo de antelación
- Horarios de apertura/cierre
- Disponibilidad de mesas
- Capacidad suficiente

#### **`AvailabilityManager.jsx`**
**Propósito:** Gestión de disponibilidades y horarios

**Funcionalidades:**
- Configuración de horarios por día
- Regeneración de slots de disponibilidad
- **CRÍTICO:** Validación de reservas existentes antes de cerrar días
- Modal de advertencia con lista de conflictos

---

## 🔧 ARQUITECTURA BACKEND

### **API Routes (Express)**

```
server.js
├── /api/send-email              # Envío de emails
├── /api/agent-heartbeat         # Health check del agente
├── /api/report-error            # Tracking de errores
└── /api/agent-deactivated       # Notificación de desactivación
```

### **Servicios Backend**

#### **`realtimeEmailService.js`**
**Propósito:** Escuchar cambios en Supabase y enviar emails

**Listeners:**
- `INSERT` en `reservations`:
  - Si `status = 'pending_approval'` → Email al restaurante
  - Si `status = 'confirmed'` → Email de confirmación
- `UPDATE` en `reservations`:
  - Si cambió a `cancelled` → Email de cancelación
  - Si cambió de `pending_approval` a `pending` → Log (N8n envía WhatsApp)
  - Si cambió de `pending_approval` to `cancelled` → Log (N8n envía WhatsApp)

**Cache en Memoria:**
- `reservationsCache` - Almacena estado previo de cada reserva
- Usado para detectar cambios precisos (fecha, hora, mesa, etc.)

#### **`reservationValidationService.js`**
**Propósito:** Validaciones de negocio para reservas

**Métodos:**
- `validateCustomer()` - Valida teléfono y nombre
- `validateDate()` - Valida fecha contra horarios del restaurante
- `validateTime()` - Valida hora y disponibilidad
- `validatePartySize()` - Valida número de personas
- `validateTable()` - Valida disponibilidad de mesa específica
- `getAvailableTables()` - Obtiene mesas disponibles (con soporte multi-mesa)
- `findNearestAlternatives()` - Busca horarios alternativos cercanos

**Lógica de Grupos Grandes:**
1. Si `partySize >= 6` → busca combinaciones de 2-3 mesas
2. Filtra por zona (interior, terraza, etc.)
3. Calcula capacidad total
4. Valida que no haya conflictos de tiempo

---

## 🔗 INTEGRACIONES EXTERNAS

### **Supabase**

#### **Auth**
- Autenticación con email/password
- User metadata para datos del registro
- Triggers automáticos para crear restaurante

#### **Database**
- PostgreSQL 15.x
- RLS habilitado en todas las tablas
- Índices optimizados

#### **Realtime**
- Subscripción a cambios en `reservations`
- Envío automático de notificaciones

#### **Storage**
- Bucket `restaurant-logos` para logos
- Bucket `agent-avatars` para avatares del agente

---

### **N8n (Workflow Automation)**

#### **Workflows Implementados:**

1. **Aprobación de Grupo Grande**
   - Trigger: Cambio de `pending_approval` → `pending`
   - Acción: Enviar WhatsApp al cliente con confirmación

2. **Rechazo de Grupo Grande**
   - Trigger: Cambio de `pending_approval` → `cancelled`
   - Acción: Enviar WhatsApp al cliente con motivo

3. **Confirmación 24h Antes**
   - Trigger: Cron job (diario a las 10:00)
   - Query: Reservas para mañana con `status = 'pending'`
   - Acción: Enviar WhatsApp solicitando confirmación

4. **Webhook de Respuestas**
   - Recibe respuestas de WhatsApp ("SÍ" / "NO")
   - Actualiza `status` en Supabase
   - Si "NO" → cambia a `cancelled`

#### **Configuración:**
- **URL Base:** `https://n8n.la-ia-app.com`
- **Webhooks:** `/webhook/group-approval`, `/webhook/confirmation-response`
- **Credenciales:** Supabase API Key (service_role)

---

### **Hostinger SMTP**

**Configuración:**
- Host: `smtp.hostinger.com`
- Port: `465` (SSL)
- Usuario: `noreply@la-ia-app.com`
- Password: Almacenada en `.env`

**Templates de Email:**
- `new_reservation_notification.html`
- `cancelled_reservation_notification.html`
- `pending_approval_notification.html`

---

## 🔒 SEGURIDAD Y MULTI-TENANCY

### **Row Level Security (RLS)**

**Política General:**
```sql
CREATE POLICY "Users can only access their restaurant data"
ON {table_name}
FOR ALL
USING (restaurant_id IN (
  SELECT r.id 
  FROM restaurants r
  WHERE r.owner_id = auth.uid()
));
```

**Tablas con RLS:**
- ✅ `restaurants`
- ✅ `tables`
- ✅ `customers`
- ✅ `reservations`
- ✅ `reservation_tables`
- ✅ `message_templates`
- ✅ `noshow_actions`
- ✅ `crm_interactions`
- ✅ `billing_tickets`

### **Validación en Frontend**

1. **AuthContext** verifica `restaurant_id` en cada request
2. Todos los queries incluyen filtro por `restaurant_id`
3. Formularios validan permisos antes de submit

### **Validación en Backend**

1. Middleware de autenticación en todas las rutas
2. Verificación de `restaurant_id` en servicios
3. Logs de auditoría para acciones críticas

---

## 📊 FLUJOS DE DATOS CRÍTICOS

### **Flujo 1: Crear Reserva de Grupo Grande**

```
1. Usuario → ReservationWizard
2. Selecciona fecha, hora, 10 personas
3. validatePartySize() → Detecta grupo grande
4. validateZone() → Muestra zonas con capacidad suficiente
5. Usuario selecciona "Interior"
6. loadAvailableTables(zone: 'interior')
7. getAvailableTables() → Busca combinaciones de 2-3 mesas
8. Usuario selecciona: Mesa 1 (4 pax) + Mesa 2 (4 pax) + Mesa 3 (4 pax)
9. handleSave() → status: 'pending_approval'
10. INSERT en reservations
11. INSERT en reservation_tables (3 filas)
12. Supabase Realtime → realtimeEmailService
13. sendPendingApprovalEmail() → Email al restaurante
14. Restaurante recibe email con botones "Aprobar" / "Rechazar"
```

### **Flujo 2: Aprobar Reserva de Grupo Grande**

```
1. Restaurante → Reservas.jsx
2. Click en "Aprobar Reserva"
3. handleAction('approve')
4. UPDATE reservations SET status = 'pending'
5. Supabase Realtime → realtimeEmailService
6. Log: "Aprobación detectada, N8n enviará WhatsApp"
7. N8n Workflow detecta cambio
8. Fetch template 'aprobacion_grupo_grande_whatsapp'
9. Reemplaza variables: {{customer_name}}, {{reservation_date}}, etc.
10. Envía WhatsApp al cliente
11. Cliente recibe: "🎉 ¡Tu reserva ha sido APROBADA!"
```

### **Flujo 3: Validación de Horarios (CRÍTICO)**

```
1. Usuario → AvailabilityManager
2. Intenta cerrar "Jueves"
3. smartRegeneration()
4. validateReservationsOnClosedDays()
5. Query: SELECT * FROM reservations WHERE day = 'Thursday' AND status IN (...)
6. Si hay reservas → setConflictData()
7. Modal aparece con lista de reservas
8. Usuario ve: "Jueves 9 Oct - 20:00 - Juan Pérez - 4 personas"
9. Opciones:
   - "Cancelar" → No hace nada
   - "Continuar (Proteger Reservas)" → Cierra otros días, mantiene jueves con reservas
10. Si continúa → Regenera disponibilidades excluyendo días con reservas
```

---

## ⚡ PERFORMANCE Y ESCALABILIDAD

### **Optimizaciones de Base de Datos**

#### **Índices Críticos:**
```sql
-- Reservas por restaurante y fecha (query más común)
CREATE INDEX idx_reservations_restaurant_date 
ON reservations(restaurant_id, reservation_date);

-- Clientes por teléfono (búsqueda en wizard)
CREATE INDEX idx_customers_phone 
ON customers(phone);

-- Mesas por zona (filtrado en grupos grandes)
CREATE INDEX idx_tables_zone 
ON tables(zone);
```

#### **Queries Optimizadas:**
- Uso de `IN` en lugar de múltiples `OR`
- `LIMIT` en todas las queries de listado
- Fetch solo columnas necesarias (no `SELECT *`)

### **Optimizaciones de Frontend**

#### **Code Splitting:**
```javascript
// Lazy loading de páginas
const Clientes = lazy(() => import('./pages/Clientes'));
const Analytics = lazy(() => import('./pages/Analytics'));
```

#### **Memoization:**
```javascript
// useMemo para cálculos pesados
const enrichedReservations = useMemo(() => {
  return todayReservations.map(r => ({
    ...r,
    customer: customersMap.get(r.customer_id)
  }));
}, [todayReservations, customersMap]);
```

#### **Debouncing:**
```javascript
// Búsqueda de clientes con debounce
const debouncedSearch = useDebounce(searchTerm, 300);
```

### **Caching**

#### **Frontend:**
- `AuthContext` cachea `restaurant` en memoria
- Zustand stores persisten en `localStorage`

#### **Backend:**
- `reservationsCache` en `realtimeEmailService` para detectar cambios

### **Escalabilidad**

**Actual:**
- 1 restaurante en producción
- ~50 reservas/día
- ~200 clientes

**Capacidad:**
- Diseñado para 1000+ restaurantes
- 10,000+ reservas/día por restaurante
- 100,000+ clientes totales

**Bottlenecks Identificados:**
- Supabase Realtime (límite de 100 conexiones concurrentes)
- Nodemailer (envío secuencial de emails)

**Soluciones Planificadas:**
- Migrar a queue system (Bull/BullMQ) para emails
- Implementar caching con Redis
- Sharding de base de datos por región

---

## 🚀 DEPLOYMENT Y DEVOPS

### **Entorno de Desarrollo**

```bash
# Instalar dependencias
npm install

# Iniciar dev server
npm run dev

# Ejecutar tests
npm run test

# Build para producción
npm run build
```

### **Entorno de Producción**

**Frontend (Vercel):**
- Repositorio: GitHub
- Branch: `main`
- Auto-deploy en cada push
- Build command: `npm run build`
- Output directory: `dist`

**Backend (Vercel Serverless):**
- API routes en `/api`
- Node.js 20.x
- Variables de entorno en Vercel Dashboard

**Base de Datos (Supabase):**
- Proyecto: `yxsxcjdqbhfqkgqpwcvz`
- Región: `eu-central-1`
- Plan: Pro
- Backups: Diarios automáticos

### **Variables de Entorno**

**Frontend (`.env`):**
```bash
VITE_SUPABASE_URL=https://yxsxcjdqbhfqkgqpwcvz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Backend (`.env`):**
```bash
SUPABASE_URL=https://yxsxcjdqbhfqkgqpwcvz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SMTP_USER=noreply@la-ia-app.com
SMTP_PASS=***
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
```

### **Migraciones de Base de Datos**

**Proceso:**
1. Crear archivo en `supabase/migrations/YYYYMMDD_NNN_descripcion.sql`
2. Ejecutar en Supabase SQL Editor
3. Verificar con queries de prueba
4. Commit y push a GitHub

**Rollback:**
- No hay rollback automático
- Crear migración inversa si es necesario

---

## 📚 DOCUMENTACIÓN ADICIONAL

### **Documentos Relacionados:**
- `docs/DATABASE-SCHEMA-COMPLETO-2025.md` - Esquema completo de DB
- `docs/N8N_WHATSAPP_INTEGRATION.md` - Integración con N8n
- `docs/REGLA_SAGRADA_RESERVAS.md` - Normas de protección de reservas
- `docs/CHANGELOG_2025-10-06_COMPLETO.md` - Cambios de hoy

### **Manuales:**
- `docs/manuales/MANUAL_CONFIGURACION_INICIAL.md` - Setup inicial
- `docs/manuales/INSTRUCCIONES-SQL-SUPABASE.md` - Cómo ejecutar migraciones

### **Auditorías:**
- `docs/auditorias/AUDITORIA-COMPLETA-FINALIZADA-2025.md` - Auditoría completa

---

## 🎯 CONCLUSIÓN

La-IA App V1 es una aplicación robusta, escalable y segura, diseñada con las mejores prácticas de la industria:

✅ **Multi-tenant** desde el diseño  
✅ **Datos reales** en toda la aplicación  
✅ **Performance optimizado** con índices y caching  
✅ **Seguridad** con RLS y validación en todas las capas  
✅ **Escalabilidad** para miles de restaurantes  
✅ **Documentación completa** para onboarding rápido  

**Esta arquitectura está lista para ser la base de la mejor aplicación de gestión de restaurantes del mundo.** 🚀

---

**Documento creado:** 6 de Octubre de 2025  
**Última actualización:** 6 de Octubre de 2025  
**Versión:** 1.0  
**Autor:** Equipo de Desarrollo La-IA
