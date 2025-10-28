# ✅ SOLUCIÓN: TIMEOUT EN `getUser()`

**Fecha:** 2025-10-27  
**Problema:** `supabase.auth.getUser()` tardaba más de 5 segundos y causaba timeout

---

## 🔍 **CAUSA RAÍZ:**

El problema era **doble**:

1. **Credenciales antiguas hardcodeadas** en `src/config/environment.js`:
   ```javascript
   SUPABASE_URL: 'https://ktsqwvhqamedpmzkzjaz.supabase.co' // ❌ PROYECTO VIEJO
   ```

2. **Llamada innecesaria** a `supabase.auth.getUser()` en el `OnboardingWizard`:
   - El `AuthContext` **ya tiene el usuario autenticado**
   - No necesitábamos hacer otra llamada async

---

## ✅ **SOLUCIÓN APLICADA:**

### 1. **Borrar fallbacks hardcodeados** (`environment.js`)
- Eliminé las credenciales antiguas como fallback
- Ahora **fuerza** el uso de variables de entorno

### 2. **Usar usuario del contexto** (`OnboardingWizard.jsx`)
- **Antes:**
  ```javascript
  const { data: { user }, error } = await supabase.auth.getUser();
  ```
  
- **Después:**
  ```javascript
  const { user } = useAuthContext(); // ✅ Ya autenticado
  ```

---

## 📋 **ARCHIVOS MODIFICADOS:**

1. ✅ `src/config/environment.js` - Borrar fallbacks antiguos
2. ✅ `src/components/onboarding/OnboardingWizard.jsx` - Usar contexto en lugar de `getUser()`

---

## 🎯 **PRÓXIMOS PASOS:**

### **1. Reinicia el servidor** (si no está corriendo)
```bash
npm run dev
```

### **2. Hard refresh del navegador**
`Ctrl + Shift + R`

### **3. Prueba el wizard**
- Login → Debería redirigir a `/onboarding`
- Selecciona "Peluquería / Barbería"
- Rellena "Vaya Pelos"
- Click "¡Crear mi negocio!"

---

## 🔍 **LOGS ESPERADOS:**

```
🟢 INICIANDO CREACIÓN DE NEGOCIO
📡 Obteniendo usuario del contexto...
✅ Usuario autenticado: d252c3d7-4fea-4b7d-8252-2295283b819e
📤 Insertando negocio en Supabase...
📋 Payload del negocio: {...}
✅ Negocio creado: {...}
✅ Relación usuario-negocio creada
✅ Servicios creados: 4
✅ Recursos creados: 3
🎉 NEGOCIO CREADO EXITOSAMENTE
```

---

## 🚨 **SI SIGUE FALLANDO:**

1. **Verifica que el `.env` existe** y tiene las credenciales correctas:
   ```bash
   Get-Content .env
   ```

2. **Limpia caché del navegador:**
   - DevTools → Application → Clear Storage → Clear site data

3. **Borra el negocio de prueba manual:**
   ```sql
   DELETE FROM businesses WHERE name = 'Test Manual';
   DELETE FROM user_business_mapping WHERE auth_user_id = 'd252c3d7-4fea-4b7d-8252-2295283b819e';
   ```

---

**ESTADO FINAL:** ✅ **LISTO PARA PROBAR**


