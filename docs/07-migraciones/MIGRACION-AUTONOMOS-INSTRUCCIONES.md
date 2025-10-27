# 🚀 MIGRACIÓN A SISTEMA DE AUTÓNOMOS

## ✅ ESQUEMA NUEVO CREADO

He creado el **esquema completamente nuevo** optimizado para autónomos multi-vertical:

📄 **Archivo:** `docs/01-arquitectura/DATABASE-SCHEMA-AUTONOMOS-2025.sql`

---

## 📊 QUÉ INCLUYE

### **✅ 27 TABLAS CORE**

#### **Tablas Principales:**
- ✅ `business_verticals` - Catálogo de 10 sectores
- ✅ `service_templates` - 38 servicios predefinidos
- ✅ `businesses` - Negocios (antes "restaurants")
- ✅ `resources` - Recursos (antes "tables" - sillas/camillas/consultorios)
- ✅ `services` - Servicios del negocio (antes "menu_items")
- ✅ `appointments` - Citas (antes "reservations")
- ✅ `customers` - Clientes
- ✅ `availability_slots` - Disponibilidad

#### **Tablas de Soporte:**
- ✅ `business_operating_hours` - Horarios
- ✅ `business_shifts` - Turnos
- ✅ `calendar_exceptions` - Días especiales
- ✅ `agent_conversations` - Conversaciones IA
- ✅ `agent_messages` - Mensajes IA
- ✅ `message_templates` - Plantillas
- ✅ `customer_confirmations` - Confirmaciones
- ✅ `customer_feedback` - Feedback
- ✅ `analytics` - Métricas
- ✅ `profiles` - Usuarios
- ✅ `user_business_mapping` - Multi-tenancy
- ✅ `notifications` - Notificaciones

### **✅ 10 VERTICALES INCLUIDOS:**

```
1. 💇 Peluquerías (5 servicios)
2. 💅 Centros de Uñas (4 servicios)
3. 🏥 Fisioterapia (3 servicios)
4. 💆 Masajes (3 servicios)
5. 🦷 Clínicas Dentales (4 servicios)
6. 🧠 Psicología (3 servicios)
7. 💪 Entrenadores Personales (2 servicios)
8. 🧘 Yoga/Pilates (3 servicios)
9. 💄 Maquilladores (2 servicios)
10. 🎨 Tatuadores (3 servicios)
```

### **✅ 5 ENUMs:**
- `vertical_type` - Tipos de negocio
- `appointment_status` - Estados de citas
- `resource_status` - Estados de recursos
- `channel_type` - Canales de comunicación
- `user_role` - Roles de usuario

---

## 🎯 CAMBIOS PRINCIPALES vs RESTAURANTES

| Concepto Anterior | Concepto Nuevo | Descripción |
|------------------|----------------|-------------|
| `restaurants` | `businesses` | Negocios de autónomos |
| `tables` | `resources` | Sillas/Camillas/Consultorios |
| `menu_items` | `services` | Servicios ofrecidos |
| `reservations` | `appointments` | Citas/Sesiones |
| `capacity` | `capacity` (1) | Normalmente 1 persona |
| - | `vertical_type` | **NUEVO:** Tipo de negocio |
| - | `business_verticals` | **NUEVO:** Catálogo de sectores |
| - | `service_templates` | **NUEVO:** Servicios predefinidos |

---

## 📋 INSTRUCCIONES DE MIGRACIÓN

### **PASO 1: Limpiar Supabase actual**

1. Ve a SQL Editor: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/sql

2. **Borrar todas las tablas** (si las importaste):
```sql
-- CUIDADO: Esto borra TODAS las tablas
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### **PASO 2: Importar esquema nuevo**

3. Abre el archivo: `docs/01-arquitectura/DATABASE-SCHEMA-AUTONOMOS-2025.sql`

4. Copia **TODO el contenido** (Ctrl+A, Ctrl+C)

5. Pega en SQL Editor de Supabase

6. Click **RUN** 🚀

7. Espera 1-2 minutos ⏳

### **PASO 3: Verificar**

8. Ve a **Table Editor** (panel izquierdo)

9. Deberías ver **27 tablas**:
```
✅ business_verticals (10 filas - los 10 sectores)
✅ service_templates (38 filas - servicios predefinidos)
✅ businesses
✅ resources
✅ services
✅ appointments
✅ customers
✅ availability_slots
✅ ... (19 tablas más)
```

10. Verifica datos iniciales:
```sql
-- Ver verticales
SELECT * FROM business_verticals;

-- Ver servicios predefinidos
SELECT * FROM service_templates ORDER BY vertical_type, category;
```

---

## ✅ RESULTADO ESPERADO

Si todo va bien, verás:

```
✅ 27 tablas creadas
✅ 5 ENUMs creados
✅ 10 verticales insertados
✅ 38 servicios predefinidos insertados
✅ Sin errores
```

---

## 🎨 CARACTERÍSTICAS DEL NUEVO ESQUEMA

### **1. Multi-Vertical desde el Inicio**
- Campo `vertical_type` en `businesses`
- Cada negocio tiene su tipo (peluquería, clínica, etc.)
- UI se adapta según el vertical

### **2. Recursos Genéricos**
- `resources` reemplaza `tables`
- Nombre adaptable: "Sillas", "Camillas", "Consultorios"
- Más simple que el sistema de mesas de restaurantes

### **3. Servicios Flexibles**
- `services` reemplaza `menu_items`
- Con duración, precio, categoría
- Plantillas predefinidas por vertical

### **4. Onboarding Integrado**
- Campo `onboarding_completed` en `businesses`
- Campo `onboarding_step` para wizard
- Wizard guiará al usuario según su vertical

### **5. Sin Complejidad de Restaurantes**
- ❌ No hay combinación de mesas
- ❌ No hay zonas complejas
- ❌ No hay menús ni cocina
- ✅ Sistema más simple y directo

---

## 🚀 PRÓXIMOS PASOS (DESPUÉS DE MIGRAR BD)

### **1. Adaptar Frontend** (2-3 días)
- Renombrar stores (`restaurantStore` → `businessStore`)
- Adaptar servicios API
- Cambiar terminología en UI

### **2. Crear Wizard de Onboarding** (1-2 días)
- Selector de vertical
- Configuración de servicios
- Configuración de recursos
- Horarios

### **3. UI Adaptativa** (1-2 días)
- Componentes que cambian según vertical
- Labels dinámicos
- Iconos por sector

---

## ⚠️ IMPORTANTE

**Este esquema es LIMPIO y NUEVO**, sin referencias a restaurantes.

**Ventajas:**
- ✅ Sin deuda técnica
- ✅ Optimizado para autónomos
- ✅ Escalable a más verticales
- ✅ Más simple de mantener

---

## 🆘 SI HAY PROBLEMAS

**Error típico:** `type "vertical_type" already exists`

**Solución:** Ejecuta primero el `DROP SCHEMA` del PASO 1 para limpiar todo.

---

**¿Listo para ejecutar?** 🚀

1. Copia `DATABASE-SCHEMA-AUTONOMOS-2025.sql`
2. Pega en Supabase SQL Editor
3. RUN
4. ¡Listo! Base de datos lista para autónomos

