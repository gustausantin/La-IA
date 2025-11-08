# 🔄 ESTRATEGIA: Migración de Mesas → Recursos

## 🎯 OBJETIVO
Eliminar la página `Mesas.jsx` y migrar su funcionalidad a un sistema más simple de gestión de `Recursos` en Configuración, sin romper el sistema de Reservas.

---

## 📊 ANÁLISIS DE DEPENDENCIAS

### **¿Dónde se usa Mesas.jsx?**

1. ✅ **App.jsx** - Línea 23, 214-220
   - Import: `const Mesas = lazy(() => import('./pages/Mesas'));`
   - Ruta: `/mesas`

2. ✅ **Layout.jsx** - Línea 58
   - Menú: `{ name: "Mesas", path: "/mesas", icon: Briefcase, showInBottom: false }`

3. ❌ **Reservas.jsx** - ¿Usa tabla `resources` o `tables`?
   - Línea 625: `const [resources, setResources] = useState([]);`
   - Línea 937, 969: Consulta tabla `resources`
   - **CONCLUSIÓN:** Ya usa `resources`, NO `tables` ✅

### **¿Qué tabla usa actualmente?**

Revisando el código:
- ✅ **Reservas.jsx usa `resources`** (correcto)
- ❌ **Mesas.jsx usa tabla `tables`** (obsoleto para verticales no-restaurante)

**BUENA NOTICIA:** Reservas.jsx ya está desacoplado de Mesas.jsx ✅

---

## ✅ DECISIÓN: ¿DÓNDE CREAR/GESTIONAR RECURSOS?

### **OPCIÓN A: En Configuración > Mi Espacio** ⭐ (RECOMENDADA)

**Ubicación:** Nueva sección en `Configuracion.jsx`

**Por qué:**
- ✅ Es configuración inicial (setup)
- ✅ No es una acción diaria
- ✅ Mantiene Reservas enfocada en operaciones

**Navegación:**
```
Configuración
  ├─ Mi Asistente
  ├─ Mi Negocio
  │  ├─ Información General
  │  ├─ Horarios
  │  └─ 🆕 Mis [Recursos] ← AQUÍ
  ├─ Canales y Alertas
  ├─ Integraciones
  └─ Cuenta
```

**UI propuesta:**
```jsx
<SettingSection
  title={`Mis ${labels.resources}`}
  description={`Configura cuántos ${labels.resources.toLowerCase()} tiene tu negocio`}
  icon={<Briefcase />}
>
  {/* Lista simple de recursos */}
  <div className="space-y-3">
    {resources.map(r => (
      <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-700 font-bold">
            {r.resource_number}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-600">
              {r.is_active ? '✅ Activo' : '❌ Inactivo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-200 rounded">
            <Edit className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-red-100 rounded text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    ))}
    
    {/* Botón añadir */}
    <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
      <Plus className="w-5 h-5 mx-auto mb-1 text-gray-500" />
      <span className="text-sm font-medium text-gray-700">
        Añadir {labels.resource}
      </span>
    </button>
  </div>
</SettingSection>
```

**Ventajas:**
- ✅ Simple y claro
- ✅ Setup una vez, usar siempre
- ✅ No sobrecarga la vista de Reservas

---

### **OPCIÓN B: En Reservas > Configurar Recursos**

**Ubicación:** Pestaña adicional en Reservas.jsx

**Por qué NO:**
- ❌ Sobrecarga de tabs (ya tienes Lista, Calendario, Disponibilidades)
- ❌ Mezcla setup con operaciones
- ❌ Menos intuitivo

---

## 🗑️ PLAN DE ELIMINACIÓN DE MESAS.JSX

### **PASO 1: Validar que no se usa `tables`**

```sql
-- Verificar en Supabase si appointments usa table_id o resource_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN ('table_id', 'resource_id');
```

**Si tiene ambos:**
- ❌ `table_id` → Deprecar, migrar datos a `resource_id`
- ✅ `resource_id` → Usar este

### **PASO 2: Comentar importación (no eliminar aún)**

```javascript
// App.jsx
// const Mesas = lazy(() => import('./pages/Mesas')); // ⚠️ DEPRECADO - Usar Configuración > Recursos

// Layout.jsx
// { name: "Mesas", path: "/mesas", icon: Briefcase, showInBottom: false }, // ⚠️ DEPRECADO
```

### **PASO 3: Crear gestión de recursos en Configuración**

Añadir nueva sección en la pestaña "Mi Negocio":
- Información General
- Horarios
- **🆕 Mis [Recursos]** ← NUEVO

### **PASO 4: Testing exhaustivo**

Verificar que:
- ✅ Reservas.jsx carga recursos correctamente
- ✅ CalendarioRecursosView funciona
- ✅ No hay errores 404 en rutas
- ✅ Sistema de bloqueos funciona

### **PASO 5: Eliminar definitivamente**

Solo cuando todo funcione:
```bash
# Eliminar archivo
rm src/pages/Mesas.jsx

# Eliminar imports
# App.jsx - línea 23
# Layout.jsx - línea 58
```

---

## 🔧 IMPLEMENTACIÓN: Gestión de Recursos en Configuración

### **Componente nuevo:** `src/components/configuracion/RecursosContent.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useVertical } from '../../hooks/useVertical';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RecursosContent() {
  const { businessId } = useAuthContext();
  const { labels } = useVertical();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadResources();
  }, [businessId]);

  const loadResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('business_id', businessId)
        .order('resource_number', { ascending: true });

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar recursos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const newNumber = resources.length + 1;
    const newName = `${labels.resource} ${newNumber}`;

    try {
      const { error } = await supabase
        .from('resources')
        .insert({
          business_id: businessId,
          name: newName,
          resource_number: newNumber.toString(),
          is_active: true
        });

      if (error) throw error;

      toast.success(`✅ ${newName} creado`);
      loadResources();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear recurso');
    }
  };

  const handleUpdate = async (id, newName) => {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ name: newName })
        .eq('id', id);

      if (error) throw error;

      toast.success('Actualizado');
      setEditingId(null);
      loadResources();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Eliminar ${name}?`)) return;

    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Eliminado');
      loadResources();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-bold text-sm text-gray-900 mb-2">
          ℹ️ ¿Para qué sirve esto?
        </h3>
        <p className="text-xs text-gray-700">
          Define los {labels.resources.toLowerCase()} de tu negocio. 
          Cada {labels.resource.toLowerCase()} puede tener su propio horario de disponibilidad 
          y bloqueos independientes en el Calendario.
        </p>
      </div>

      {/* Lista de recursos */}
      <div className="space-y-3">
        {resources.map(r => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-purple-300 transition-colors">
            {editingId === r.id ? (
              // Modo edición
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 p-2 border rounded-lg text-sm"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdate(r.id, editingName)}
                  className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // Modo vista
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="font-bold text-purple-700">{r.resource_number}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                    <p className="text-xs text-gray-600">
                      {r.is_active ? '✅ Activo' : '❌ Inactivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingId(r.id);
                      setEditingName(r.name);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id, r.name)}
                    className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Botón crear nuevo */}
        <button
          onClick={handleCreate}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
        >
          <Plus className="w-5 h-5 mx-auto mb-1 text-gray-400 group-hover:text-purple-600 transition-colors" />
          <span className="block text-sm font-medium text-gray-600 group-hover:text-purple-700">
            Añadir {labels.resource}
          </span>
        </button>
      </div>
    </div>
  );
}
```

---

## 🔄 PLAN DE MIGRACIÓN (PASO A PASO)

### **FASE 1: Preparación (AHORA)** ✅

1. ✅ Crear `RecursosContent.jsx` en Configuración
2. ✅ Añadir sección "Mis Recursos" en pestaña "Mi Negocio"
3. ✅ Testing: Crear/editar/eliminar recursos

### **FASE 2: Transición (Después de testing)**

1. ⚠️ Comentar (NO eliminar) página Mesas:
   ```javascript
   // App.jsx
   // const Mesas = lazy(() => import('./pages/Mesas')); // DEPRECADO
   
   // Layout.jsx
   // { name: "Mesas", path: "/mesas", ... }, // DEPRECADO
   ```

2. ✅ Añadir redirect temporal:
   ```javascript
   // App.jsx
   <Route path="/mesas" element={<Navigate to="/configuracion" replace />} />
   ```

3. ✅ Toast informativo:
   ```javascript
   // En Configuracion.jsx, detectar si viene de /mesas
   useEffect(() => {
     if (location.state?.fromMesas) {
       toast.info('La gestión de recursos se ha movido aquí', {
         duration: 5000
       });
     }
   }, []);
   ```

### **FASE 3: Validación (Después de 1 semana sin errores)**

1. ✅ Verificar logs: ¿Alguien intentó acceder a /mesas?
2. ✅ Verificar: ¿Reservas funciona correctamente?
3. ✅ Verificar: ¿Calendario de Recursos funciona?

### **FASE 4: Eliminación definitiva (Solo si todo OK)**

1. 🗑️ Eliminar archivo `src/pages/Mesas.jsx`
2. 🗑️ Eliminar imports en `App.jsx`
3. 🗑️ Eliminar menú en `Layout.jsx`
4. 🗑️ Eliminar redirect temporal

---

## ⚠️ RIESGOS Y MITIGACIONES

### **RIESGO 1: Reservas.jsx rompe sin Mesas.jsx**

**Probabilidad:** BAJA (ya usa `resources`, no `tables`)

**Mitigación:**
- ✅ Reservas.jsx ya consulta tabla `resources` (línea 937, 969)
- ✅ No tiene dependencia de `Mesas.jsx` como componente

### **RIESGO 2: Usuarios buscan "Mesas" y no encuentran**

**Probabilidad:** MEDIA

**Mitigación:**
- ✅ Redirect temporal `/mesas` → `/configuracion`
- ✅ Toast informativo
- ✅ Renombrar sección en Config según vertical:
  - Peluquería: "Mis Sillones"
  - Fisioterapia: "Mis Camillas"
  - Veterinario: "Mis Consultorios"

### **RIESGO 3: Funcionalidad perdida de Mesas.jsx**

**Análisis:** Mesas.jsx tiene 2222 líneas con:
- ❌ Vista grid 3x3 (complejo, no necesario)
- ❌ Estadísticas por mesa (poco valor)
- ❌ Asignación automática del agente (se hace en Reservas)
- ✅ CRUD básico de recursos (lo necesitamos)

**Mitigación:**
- ✅ Mantener solo CRUD simple en Configuración
- ✅ Estadísticas → Ver en Calendario de Recursos (futuro)

---

## ✅ PROPUESTA FINAL

### **IMPLEMENTAR AHORA:**

1. ✅ Crear `RecursosContent.jsx` (componente simple)
2. ✅ Añadir sección en `Configuracion.jsx` > "Mi Negocio"
3. ✅ Testing completo

### **DESPUÉS DE TESTING (1-2 días):**

4. ⚠️ Comentar Mesas.jsx en imports
5. ✅ Redirect `/mesas` → `/configuracion`
6. ✅ Toast informativo

### **DESPUÉS DE VALIDACIÓN (1 semana):**

7. 🗑️ Eliminar definitivamente Mesas.jsx

---

## 🎯 CÓDIGO PARA AÑADIR EN CONFIGURACION.JSX

### **Ubicación:** Dentro de `{activeTab === "negocio" && (...)}`

```jsx
{/* SECCIÓN 3: MIS RECURSOS */}
<SettingSection
  title={`Mis ${labels?.resources || 'Recursos'}`}
  description={`Gestiona los ${labels?.resources?.toLowerCase() || 'recursos'} de tu negocio`}
  icon={<Briefcase />}
>
  <RecursosContent />
</SettingSection>
```

### **Import necesario:**

```javascript
import RecursosContent from '../components/configuracion/RecursosContent';
import { Briefcase } from 'lucide-react'; // Si no está ya
```

---

## ✅ RESUMEN EJECUTIVO

**¿Dónde crear recursos?** → **Configuración > Mi Negocio > Mis Recursos** ⭐

**¿Eliminar Mesas.jsx?** → **Sí, pero gradualmente:**
1. Crear alternativa primero (RecursosContent)
2. Comentar imports (no eliminar)
3. Testing (1 semana)
4. Eliminar definitivamente

**¿Se rompe algo?** → **NO, si seguimos este plan:**
- Reservas.jsx ya usa `resources` ✅
- Creamos alternativa antes de eliminar ✅
- Testing exhaustivo antes de borrar ✅

---

## 🚀 ¿PROCEDEMOS?

**Necesito tu confirmación:**

1. ✅ ¿Crear RecursosContent en Configuración > Mi Negocio?
2. ✅ ¿Comentar (no eliminar aún) Mesas.jsx?
3. ✅ ¿Testing antes de eliminar definitivamente?

**Una vez confirmes, implemento:**
- RecursosContent.jsx
- Integración en Configuracion.jsx
- Comentar Mesas en App.jsx y Layout.jsx
- Redirect temporal

---

_Estrategia de migración segura - 2025-11-08_



