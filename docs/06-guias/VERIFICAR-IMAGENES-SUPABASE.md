# 🔍 VERIFICAR IMÁGENES DE SUPABASE - TROUBLESHOOTING

## ❌ PROBLEMA
Las imágenes de los avatares no se están cargando. Se ven bloques de colores en su lugar.

---

## ✅ SOLUCIÓN - VERIFICAR CONFIGURACIÓN DE SUPABASE

### **1. Verificar que el bucket "Avatar" es PÚBLICO**

Ve a tu dashboard de Supabase:

1. **Ir a Storage** → `https://supabase.com/dashboard/project/[TU_PROJECT_ID]/storage/buckets`
2. **Buscar el bucket "Avatar"**
3. **Verificar que sea PÚBLICO:**
   - Debe tener el icono de "🌐" o "Public"
   - Si es privado, haz clic en los 3 puntos → **"Make public"**

---

### **2. Verificar que las imágenes existen**

En el bucket "Avatar", debes tener estos 4 archivos:
- ✅ `Avatar_1.png` → Clara (mujer con gafas)
- ✅ `Avatar_2.png` → Hugo (hombre con gafas y barba)
- ✅ `Avatar_3.png` → Álex (hombre con barba y camisa azul)
- ✅ `Avatar_4.png` → Lua (mujer joven con chaqueta denim)

---

### **3. Verificar las URLs directamente**

Abre estas URLs en tu navegador para verificar que cargan:

```
https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_1.png
https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_2.png
https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_3.png
https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_4.png
```

**¿Se ven las imágenes?**
- ✅ **SÍ** → El problema es de CORS (ver paso 4)
- ❌ **NO** → El bucket NO es público o las URLs son incorrectas

---

### **4. Verificar CORS (si las URLs funcionan pero no cargan en la app)**

En Supabase Dashboard:
1. Ve a **Settings** → **API**
2. Busca la sección **CORS**
3. Asegúrate de que tu dominio local está permitido:
   ```
   http://localhost:5173
   http://localhost:3000
   ```

---

### **5. Verificar RLS (Row Level Security)**

En **Storage** → **Policies** del bucket "Avatar":

Debe tener una política que permita lectura pública:

```sql
-- Política: Public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'Avatar' );
```

---

## 🔧 SOLUCIÓN RÁPIDA

Si las imágenes no cargan, **copia y pega las URLs correctas** en la consola del navegador (F12):

```javascript
// Abre la consola (F12) y pega esto:
const test = new Image();
test.onload = () => console.log('✅ Imagen carga correctamente');
test.onerror = () => console.log('❌ Error al cargar imagen - Bucket privado o URL incorrecta');
test.src = 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_1.png';
```

---

## 📝 OPCIÓN ALTERNATIVA: USAR URLs EXTERNAS

Si no quieres usar Supabase Storage, puedes:

1. **Subir las imágenes a Imgur, Cloudinary, o cualquier CDN público**
2. **Actualizar las URLs en `src/config/avatars.js`:**

```javascript
avatar_url: 'https://i.imgur.com/TU_IMAGEN_CLARA.png'
avatar_url: 'https://i.imgur.com/TU_IMAGEN_LUA.png'
avatar_url: 'https://i.imgur.com/TU_IMAGEN_ALEX.png'
avatar_url: 'https://i.imgur.com/TU_IMAGEN_HUGO.png'
```

---

## 🚀 VERIFICACIÓN FINAL

Una vez arreglado, recarga la página y deberías ver:
- ✅ Las 4 fotos de los avatares en lugar de bloques de colores
- ✅ En el preview de configuración, la foto circular del avatar seleccionado
- ✅ En el Dashboard, la foto grande del avatar activo

---

## 📞 AYUDA

Si sigues teniendo problemas, dime:
1. ¿Las URLs se abren en el navegador? (✅/❌)
2. ¿El bucket es público? (✅/❌)
3. ¿Qué error aparece en la consola del navegador (F12)?

