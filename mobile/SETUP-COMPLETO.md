# ✅ SETUP COMPLETO - APP MÓVIL REACT NATIVE

**Fecha:** 28 de octubre de 2025  
**Estado:** ✅ Wizard de Onboarding Completo (Paso 1 funcional + Skeleton 8 pasos)

---

## 🎉 ¿QUÉ HEMOS LOGRADO?

### ✅ BACKEND (Supabase)
1. **Migraciones SQL aplicadas:**
   - `20251027_001_update_create_business_function.sql` → RPC `create_business_securely`
   - `20251027_002_rls_policies_businesses.sql` → Políticas RLS
   - `20251027_003_create_integrations_table.sql` → Tabla de integraciones

2. **Edge Function creada:**
   - `voice-simulate` → Mock de llamada IA (lista para deployment)

### ✅ MOBILE (React Native + Expo)
1. **Stack instalado:**
   - ✅ Expo Router (navegación basada en archivos)
   - ✅ TypeScript (tipado seguro)
   - ✅ Zustand (estado global con persistencia)
   - ✅ React Hook Form (formularios con validación)
   - ✅ Supabase Client (conexión con backend)
   - ✅ AsyncStorage (persistencia local)

2. **Estructura del proyecto:**
```
mobile/
├── app/
│   ├── _layout.tsx                 → Layout principal
│   ├── index.tsx                   → Splash screen
│   └── onboarding/
│       ├── _layout.tsx             → Layout del wizard
│       ├── index.tsx               → Redirigir al paso actual
│       ├── step1.tsx               → ✅ Perfil del negocio (COMPLETO)
│       ├── step2.tsx               → Servicios (skeleton)
│       ├── step3.tsx               → Horarios (skeleton)
│       ├── step4.tsx               → Google Calendar (skeleton)
│       ├── step5.tsx               → Personalidad IA (skeleton)
│       ├── step6.tsx               → Test de llamada (skeleton)
│       ├── step7.tsx               → Desvío de llamadas (skeleton)
│       └── step8.tsx               → Confirmación (skeleton)
├── components/
│   ├── OnboardingHeader.tsx        → Barra de progreso
│   └── OnboardingFooter.tsx        → Botones navegación
├── stores/
│   └── onboardingStore.ts          → Estado del wizard (Zustand)
├── services/
│   └── supabase.ts                 → Cliente Supabase + helpers
└── constants/
    └── verticals.ts                → Verticales del negocio
```

---

## 🚀 CÓMO PROBAR LA APP

### 1. Iniciar Expo
```bash
cd mobile
npx expo start
```

### 2. Escanear QR con Expo Go
- **Android:** Abre Expo Go y escanea el QR
- **iOS:** Abre la cámara y escanea el QR

### 3. Flujo esperado:
1. **Splash screen** (1 segundo)
2. **Onboarding Step 1:**
   - Seleccionar vertical (Fisioterapia, Psicología, etc.)
   - Nombre del negocio
   - Ciudad
   - Teléfono
   - Al pulsar **"Crear negocio y continuar":**
     - Se llama a `create_business_securely` (Supabase RPC)
     - Se crea el negocio en la BBDD
     - Se guarda el `business_id` en Zustand
     - Se navega al Step 2
3. **Steps 2-8:** Pantallas skeleton con navegación funcional

---

## 🔧 CONFIGURACIÓN NECESARIA

### 1. Actualizar Supabase Anon Key
Edita `mobile/app.json` → `extra.supabaseAnonKey`:
```json
"extra": {
  "supabaseUrl": "https://zrcsujgurtglyqoqiynr.supabase.co",
  "supabaseAnonKey": "TU_ANON_KEY_REAL_AQUI"
}
```

### 2. (Opcional) Deploy Edge Function
```bash
# Instalar Supabase CLI (si no está instalado)
# Ver: https://supabase.com/docs/guides/cli

# Desplegar función
npx supabase functions deploy voice-simulate
```

---

## 📝 PRÓXIMOS PASOS

### **Sprint 2: Implementar Steps 2-8**

#### **Paso 2: Servicios y Precios** (Ticket B3)
- Lista de servicios sugeridos según vertical
- Edición manual (nombre, duración, precio)
- Validación: mínimo 1 servicio

#### **Paso 3: Horarios** (Ticket B4)
- Calendario semanal con toggles
- Rango de horas (picker)
- Guardar en `onboardingStore.schedule`

#### **Paso 4: Google Calendar** (Ticket B5)
- OAuth flow con Google
- Guardar refresh_token en tabla `integrations`
- Mostrar nombre del calendario conectado

#### **Paso 5: Personalidad IA** (Ticket B6)
- Selector de voz (Maria, Carlos, etc.)
- Editor de script de bienvenida
- Preview de audio

#### **Paso 6: Test de Llamada** (Ticket B7)
- Botón "Iniciar simulación"
- Llamar a Edge Function `voice-simulate`
- Mostrar transcripción y audio

#### **Paso 7: Desvío de Llamadas** (Ticket B8)
- Selector de operador (Telefónica, Vodafone, etc.)
- Instrucciones personalizadas
- Botón "Verificar desvío"

#### **Paso 8: Confirmación** (Ticket B9)
- Checklist con resumen de configuración
- Navegar al dashboard principal

---

## 🐛 TROUBLESHOOTING

### Error: "Cannot find module 'expo-router'"
```bash
npm install expo-router
npx expo start -c  # Limpiar caché
```

### Error: "Supabase RPC 404"
- Verifica que aplicaste las 3 migraciones SQL
- Verifica que la función `create_business_securely` existe en Supabase

### Error: "Cannot connect to Metro"
```bash
# Reiniciar Metro bundler
npx expo start -c
```

---

## ✅ CHECKLIST DE VALIDACIÓN

- [x] Migraciones SQL aplicadas en Supabase
- [x] Edge Function `voice-simulate` creada
- [x] Stack móvil instalado (Expo Router + Zustand + RHF)
- [x] Estructura de carpetas organizada
- [x] Store de Zustand con persistencia
- [x] Componentes comunes (Header + Footer)
- [x] Step 1 completo con validación y conexión a RPC
- [x] Steps 2-8 con skeleton funcional
- [x] Navegación entre pasos funciona
- [ ] **FALTA:** Actualizar `supabaseAnonKey` en `app.json`
- [ ] **FALTA:** Deploy de Edge Function `voice-simulate`

---

## 📞 SOPORTE

Si algo falla, revisa:
1. Logs de Expo en la terminal
2. Logs de Supabase en Dashboard → Logs
3. Estado del store en pantalla (console.log)

**Próximo paso:** Implementar Step 2 (Servicios y Precios) con lista editable.

---

**¡La base está lista! Ahora a construir los 7 pasos restantes.** 🚀

