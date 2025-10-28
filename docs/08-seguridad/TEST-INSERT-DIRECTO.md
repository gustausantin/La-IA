# 🧪 TEST DIRECTO DE INSERT (Sin Timeout)

**Propósito:** Ver el error REAL que está devolviendo Supabase

---

## 📋 **INSTRUCCIONES:**

### **1. Abre la consola del navegador** (F12)

### **2. Pega este código en la consola:**

```javascript
// Test directo de insert SIN timeout
const testInsert = async () => {
  console.log('🧪 TEST: Insertando negocio directamente...');
  
  const { data, error } = await window.supabase
    .from('businesses')
    .insert([{
      name: 'Test Consola',
      vertical_type: 'peluqueria_barberia',
      phone: '+34600000000',
      email: 'test@test.com',
      address: 'Calle Test',
      city: 'Barcelona',
      postal_code: '08027',
      active: true
    }])
    .select()
    .single();

  if (error) {
    console.error('❌ ERROR:', error);
    return;
  }

  console.log('✅ ÉXITO:', data);
};

testInsert();
```

---

### **3. Copia el resultado** (el error o el éxito)

---

## 🔍 **ERRORES COMUNES Y SUS SOLUCIONES:**

### ❌ **Error: "Row level security is enabled"**
- **Causa:** RLS sigue activo
- **Solución:** Ejecutar de nuevo:
  ```sql
  ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
  ```

### ❌ **Error: "violates foreign key constraint"**
- **Causa:** Falta una relación
- **Solución:** Ver qué columna falta

### ❌ **Error: "violates check constraint"**
- **Causa:** Un valor no cumple una regla (ej: email inválido)
- **Solución:** Ver qué constraint falla

### ❌ **Error: "permission denied"**
- **Causa:** El usuario no tiene permisos
- **Solución:** Verificar que RLS está deshabilitado

### ❌ **Error: "invalid input syntax for type"**
- **Causa:** Tipo de dato incorrecto (ej: string en lugar de número)
- **Solución:** Verificar el schema

---

## 🎯 **PRÓXIMO PASO:**

Ejecuta el test en la consola y pégame el resultado.


