# 🔄 RESET COMPLETO DE LA APP

## PASO 1: Borrar datos de Supabase ✅ (YA LO HICISTE)

```sql
-- En Supabase SQL Editor:
DELETE FROM user_business_mapping WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@example.com');
DELETE FROM businesses WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'tu-email@example.com');

-- Si quieres borrar el usuario también:
-- (Ve a Authentication > Users > Eliminar usuario)
```

---

## PASO 2: Limpiar AsyncStorage en el móvil

### **Opción A: Desde el código (RECOMENDADO)**

1. **Abre el archivo:** `mobile/app/index.tsx`
2. **Añade esta función temporal al inicio del archivo:**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔥 AÑADIR ESTO AL INICIO DE index.tsx (dentro del useEffect)
useEffect(() => {
  // RESET TEMPORAL - Eliminar después de usar
  AsyncStorage.clear().then(() => {
    console.log('✅ AsyncStorage limpiado');
  });
  
  // ... resto del código
}, []);
```

3. **Reinicia la app** (cierra y abre en el móvil)
4. **ELIMINA esas líneas después** del primer inicio

---

### **Opción B: Reinstalar la app (MÁS FÁCIL)**

1. **Desinstala la app del móvil:**
   - Mantén presionado el ícono de Expo Go
   - Selecciona "Eliminar app" o "Desinstalar"

2. **Reinstala Expo Go:**
   - App Store (iPhone): Busca "Expo Go" y reinstala
   - Play Store (Android): Busca "Expo Go" y reinstala

3. **Escanea de nuevo el QR**

---

### **Opción C: Shake del móvil (RÁPIDO)**

1. **Agita tu móvil** mientras la app está abierta
2. **Se abrirá el menú de Expo**
3. **Click en "Clear AsyncStorage"**
4. **Recargar la app** (botón "Reload")

---

## PASO 3: Limpiar caché del Metro Bundler

Desde PowerShell:

```powershell
cd mobile
npx expo start --clear
```

---

## PASO 4: Verificar que todo está limpio

1. Abre la app
2. Deberías ver la pantalla de **login/registro**
3. Si ves el onboarding directamente, aún hay caché

---

## 🚨 SI NADA FUNCIONA (RESET NUCLEAR)

```powershell
cd mobile

# 1. Matar todos los procesos de Node
taskkill /F /IM node.exe

# 2. Borrar caché completo
Remove-Item .expo -Recurse -Force
Remove-Item node_modules\.cache -Recurse -Force

# 3. Reiniciar Metro
npx expo start --clear
```

---

## ✅ DESPUÉS DEL RESET

1. **Crear nuevo usuario** en Supabase (o usar el mismo email)
2. **Login** en la app
3. **Completar onboarding** desde cero

---

**¿Cuál opción quieres usar? Te recomiendo la Opción C (Shake) es la más rápida.** 🚀

