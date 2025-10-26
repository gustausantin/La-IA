# 📚 SISTEMA RAG - BASE DE CONOCIMIENTO

**Fecha**: 2025-10-20  
**Versión**: 1.0  
**Estado**: ✅ COMPLETADO (Backend + Frontend listos)

---

## 🎯 **OBJETIVO:**

Permitir que el Agente IA responda preguntas sobre:
- 🍽️ **Menú y Carta** del restaurante
- 🏢 **Servicios** (Wi-Fi, parking, admite perros, etc.)
- ℹ️ **Información adicional** (historia, eventos, promociones)

---

## 📦 **COMPONENTES CREADOS:**

### **1. MIGRACIONES SQL:**
- ✅ `supabase/migrations/20251020_001_knowledge_base_system.sql`
  - Tabla `restaurant_knowledge_files` (tracking de archivos)
  - Tabla `restaurant_knowledge_vectors` (vectores para RAG)
  - Función `match_restaurant_knowledge()` (búsqueda semántica)
  - RLS policies (multi-tenant)

- ✅ `supabase/migrations/20251020_002_knowledge_storage_bucket.sql`
  - Configuración del bucket `restaurant-knowledge`
  - Políticas de acceso a Storage

### **2. FRONTEND:**
- ✅ `src/pages/BaseConocimiento.jsx` (página completa)
  - Upload de archivos por categoría
  - Lista de archivos con estado (processing/completed/failed)
  - Reprocesamiento de archivos fallidos
  - Eliminación de archivos
  - Validaciones (tamaño, tipo, límites)

- ✅ Routing en `src/App.jsx`
- ✅ Menú en `src/components/Layout.jsx`

### **3. WORKFLOW N8N:**
- ✅ `n8n/workflows/05-rag-knowledge-processor-FINAL.json`
- ✅ `n8n/workflows/README-WORKFLOW-05-RAG.md`

---

## 📂 **ESTRUCTURA DE ARCHIVOS:**

```
Base de Conocimiento
│
├── 🍽️ Menú y Carta (max 2 archivos)
│   ├── Carta_Primavera_2025.pdf
│   └── Menú_Día.docx
│
├── 🏢 Servicios (max 1 archivo)
│   └── Servicios_Restaurante.pdf
│
└── ℹ️ Información Adicional (max 1 archivo)
    └── Historia_Eventos.docx
```

**TOTAL: 4 archivos máx, 20MB total**

---

## 🔍 **LÓGICA DE BÚSQUEDA:**

El Agente IA detectará automáticamente qué tipo de pregunta es:

```javascript
// Ejemplo: "¿Tenéis opciones veganas?"
// → Detecta categoría: "menu"
// → Busca SOLO en archivos de "Menú y Carta"
// → Si no encuentra → busca en TODAS las categorías

// Ejemplo: "¿Hay Wi-Fi?"
// → Detecta categoría: "services"
// → Busca SOLO en "Servicios"
```

---

## 🗂️ **FORMATOS SOPORTADOS:**

| Formato | MIME Type | Límite |
|---------|-----------|--------|
| PDF | `application/pdf` | 5MB |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 5MB |
| DOC | `application/msword` | 5MB |
| TXT | `text/plain` | 5MB |

---

## 🚀 **FLUJO COMPLETO:**

```
1. Usuario → Upload PDF desde BaseConocimiento.jsx
       ↓
2. Frontend → Supabase Storage (/{restaurant_id}/{category}/{file})
       ↓
3. Frontend → INSERT en restaurant_knowledge_files (status: processing)
       ↓
4. Frontend → POST a N8N Webhook
       ↓
5. N8N → Descarga, extrae texto, vectoriza con OpenAI
       ↓
6. N8N → Guarda vectores en restaurant_knowledge_vectors
       ↓
7. N8N → UPDATE restaurant_knowledge_files (status: completed)
       ↓
8. Frontend → Muestra "✅ Procesado"
```

---

## 💾 **TABLAS SUPABASE:**

### **restaurant_knowledge_files:**
```sql
- id (uuid)
- restaurant_id (uuid) → Multi-tenant
- category (text) → menu, services, other
- file_name (text)
- file_path (text)
- file_size (integer)
- file_type (text)
- status (text) → processing, completed, failed
- error_message (text)
- created_at (timestamptz)
- processed_at (timestamptz)
```

### **restaurant_knowledge_vectors:**
```sql
- id (uuid)
- restaurant_id (uuid) → Multi-tenant
- content (text) → Chunk de texto
- embedding (vector(1536)) → Embedding de OpenAI
- metadata (jsonb) → {category, file_name, file_id, ...}
- created_at (timestamptz)
```

---

## 🔧 **CONFIGURACIÓN PENDIENTE:**

### **SUPABASE:**
1. **Ejecutar migraciones:**
   ```bash
   # En Supabase Dashboard > SQL Editor
   # Ejecutar: 20251020_001_knowledge_base_system.sql
   # Ejecutar: 20251020_002_knowledge_storage_bucket.sql
   ```

2. **Crear bucket:**
   ```
   Supabase Dashboard > Storage > New Bucket
   Nombre: restaurant-knowledge
   Public: YES
   File size limit: 5MB
   ```

### **N8N:**
1. **Importar workflow:**
   ```
   N8N > Import Workflow
   Archivo: 05-rag-knowledge-processor-FINAL.json
   ```

2. **Configurar webhook:**
   ```
   URL: https://tu-n8n.app.n8n.cloud/webhook/process-knowledge
   ```

3. **Actualizar URL en frontend:**
   ```javascript
   // src/pages/BaseConocimiento.jsx
   const n8nWebhook = 'TU_URL_AQUI';
   ```

---

## 📊 **COSTES ESTIMADOS:**

| Servicio | Uso | Coste/mes |
|----------|-----|-----------|
| Supabase Storage | 20MB (4 archivos × 5MB) | $0.0004 |
| OpenAI Embeddings | 100 archivos × 5,000 tokens | $0.01 |
| Supabase Vector DB | Incluido en plan | $0 |

**COSTE TOTAL: ~$0.01/mes** 🎉

---

## ✅ **PRÓXIMOS PASOS:**

1. ⏳ Ejecutar migraciones en Supabase
2. ⏳ Crear bucket en Supabase Storage
3. ⏳ Importar workflow en N8N
4. ⏳ Actualizar URL del webhook en frontend
5. ⏳ **INTEGRAR CON SUPER AGENT (Workflow 3)**

---

## 🧪 **TESTING:**

### **Test 1: Upload**
1. Ve a `/base-conocimiento`
2. Sube un PDF de menú
3. Verifica estado "Procesando..."
4. Espera 1-2 minutos
5. Verifica estado "✅ Procesado"

### **Test 2: Búsqueda**
1. Ve a `/comunicacion`
2. Envía mensaje: "¿Tenéis opciones veganas?"
3. El agente debería responder con info del menú subido

---

**Creado por**: IA Assistant  
**Revisado por**: Gustau  
**Estado**: ✅ Backend + Frontend completados, pendiente integración


