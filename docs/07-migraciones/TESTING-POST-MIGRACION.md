# 🧪 TESTING POST-MIGRACIÓN

**Ejecutar DESPUÉS de importar el esquema SQL**

---

## ✅ CHECKLIST DE VERIFICACIÓN

### 1️⃣ **Verificar Tablas en Supabase** (2 min)

1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/editor
2. En el panel izquierdo, verifica que existan estas tablas:

```
☐ agent_conversations
☐ agent_messages
☐ agent_metrics
☐ ai_conversation_insights
☐ availability_slots
☐ calendar_exceptions
☐ confirmation_messages
☐ crm_automation_rules
☐ crm_customers
☐ crm_interactions
☐ crm_message_templates
☐ crm_settings
☐ customers
☐ escalations
☐ knowledge_base
☐ message_templates
☐ noshow_actions
☐ noshow_alerts
☐ noshow_predictions
☐ reservations
☐ reservation_tables
☐ businesses
☐ special_events
☐ tables
☐ user_restaurant_mapping
☐ whatsapp_buffer
... (y 36 más - total 61 tablas)
```

**Si ves todas las tablas**: ✅ Migración exitosa!

---

### 2️⃣ **Crear Usuario de Prueba** (2 min)

1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/auth/users
2. Click en **"Add user"** → **"Create new user"**
3. Rellena:
   - Email: `admin@test.com`
   - Password: `Admin123!`
   - ✅ Auto Confirm User
4. Click en **"Create user"**

---

### 3️⃣ **Crear Restaurante de Prueba** (3 min)

1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/editor
2. Tabla: `businesses`
3. Click en **"Insert"** → **"Insert row"**
4. Rellena:
   ```
   name: "Restaurante Test"
   email: "admin@test.com"
   phone: "+34600000000"
   address: "Calle Test 123"
   city: "Barcelona"
   country: "España"
   timezone: "Europe/Madrid"
   currency: "EUR"
   ```
5. **Save**
6. **Copia el ID del restaurante** (lo necesitarás)

---

### 4️⃣ **Vincular Usuario con Restaurante** (2 min)

1. Tabla: `user_restaurant_mapping`
2. Click en **"Insert"**
3. Rellena:
   ```
   auth_user_id: [ID del usuario creado en paso 2]
   restaurant_id: [ID del restaurante creado en paso 3]
   role: "owner"
   ```
4. **Save**

---

### 5️⃣ **Crear Mesas de Prueba** (2 min)

1. Tabla: `tables`
2. Inserta 3 mesas:

**Mesa 1:**
```
restaurant_id: [ID del restaurante]
name: "Mesa 1"
capacity: 4
zone: "interior"
status: "available"
```

**Mesa 2:**
```
restaurant_id: [ID del restaurante]
name: "Mesa 2"
capacity: 2
zone: "interior"
status: "available"
```

**Mesa 3:**
```
restaurant_id: [ID del restaurante]
name: "Terraza 1"
capacity: 6
zone: "terraza"
status: "available"
```

---

### 6️⃣ **Testing de la Aplicación** (5 min)

```powershell
# 1. Arrancar app
npm run dev

# 2. Abrir navegador
# http://localhost:3000

# 3. Login con:
# Email: admin@test.com
# Password: Admin123!

# 4. Verificaciones:
```

#### ✅ Debe funcionar:
- [ ] Login exitoso
- [ ] Dashboard carga sin errores
- [ ] Se muestra el nombre del restaurante
- [ ] Ver tabla "Mesas" → Aparecen las 3 mesas
- [ ] Intentar crear una reserva
- [ ] Ver calendario

#### ⚠️ Posibles Warnings (normales):
- "No hay reservas" → Normal, acabas de empezar
- "No hay clientes" → Normal
- "Sin disponibilidades" → Normal, hay que configurarlas

---

### 7️⃣ **Crear Reserva de Prueba** (3 min)

En la app (http://localhost:3000):

1. Ve a **Reservas**
2. Click en **"Nueva Reserva"** (botón +)
3. Rellena:
   ```
   Nombre: Juan Pérez
   Teléfono: +34600111222
   Email: juan@test.com
   Fecha: Hoy
   Hora: 20:00
   Personas: 4
   Mesa: Mesa 1
   ```
4. **Guardar**

#### Debe funcionar:
- [ ] Reserva se crea sin errores
- [ ] Aparece en la lista de reservas
- [ ] Puedes verla en el calendario

---

## 🎉 SI TODO FUNCIONA

**¡MIGRACIÓN COMPLETADA EXITOSAMENTE!** ✅

Ahora tienes:
- ✅ Nuevo Supabase funcionando
- ✅ 61 tablas migradas
- ✅ Usuario y restaurante de prueba
- ✅ App conectada y funcionando
- ✅ Mobile-first UI lista para usar

---

## 🚨 TROUBLESHOOTING

### Error: "Invalid API key"
```powershell
# Verificar que las keys están bien en:
# src/config/environment.development.js
# src/lib/supabase.js

# Debe ser:
URL: https://zrcsujgurtglyqoqiynr.supabase.co
Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...ArgosNCVMqlC-4-r6Y_cnUh...
```

### Error: "Table 'businesses' doesn't exist"
→ El esquema SQL no se importó. Vuelve a ejecutarlo en SQL Editor

### Error: "Row Level Security policy violation"
→ El usuario no está vinculado al restaurante. Verifica `user_restaurant_mapping`

### Error: "Failed to fetch"
→ Verifica que el servidor esté corriendo (`npm run dev`)

---

## 📊 MÉTRICAS DE ÉXITO

Si completaste todos los pasos:

- ✅ **Migración**: 100%
- ✅ **Testing**: 100%
- ✅ **App funcionando**: 100%

**Tiempo total**: ~20-30 minutos

---

## 🚀 PRÓXIMOS PASOS

Una vez todo funciona:

1. **Explorar la UI mobile nueva**:
   - Dashboard mobile
   - Reservas mobile (con swipe!)
   - Pull to refresh

2. **Configurar disponibilidades**:
   - Ve a Calendario
   - Configura horarios
   - Genera slots

3. **Continuar desarrollo**:
   - ClientesMobile
   - CalendarioMobile
   - Más componentes mobile

---

**🎊 ¡Felicidades! Tienes el proyecto migrando y funcionando con UI mobile-first!**

