# 🧹 LIMPIEZA DE ARCHIVOS OBSOLETOS - LA-IA

**Fecha:** 26 de Octubre de 2025  
**Objetivo:** Eliminar archivos obsoletos, redundantes o innecesarios antes del pivot

---

## 📋 ARCHIVOS IDENTIFICADOS PARA ELIMINAR

### 🗑️ CATEGORÍA 1: ARCHIVOS DE BACKUP Y TEMPORALES

```
src/pages/Configuracion.jsx.backup-20251014-230452
src/pages/Configuracion.jsx.backup-20251014-230458
src/pages/ReservasAntigua.jsx
src/pages/CRMSimple.jsx.backup-20251020-090041
src/pages/DashboardAgente.jsx.backup-20251020-092008
```

**Razón:** Archivos de backup antiguos innecesarios

---

### 🗑️ CATEGORÍA 2: ARCHIVOS SQL ESPECÍFICOS DE RESTAURANTES (Root)

```
AUDITORIA_AVAILABILITY_SLOTS.sql
FIX_SLOT_INCONSISTENTE.sql
LIMPIAR_SLOT_INCONSISTENTE.sql
VERIFICAR_DISPONIBILIDAD_DEBUG.sql
VERIFICAR_RESERVA_CON_MESA.sql
VERIFICAR_STATUS_RESERVA.sql
FIX_WORKFLOW_DISPONIBLE.md
VALIDACION_TIEMPO_MINIMO_DINAMICO_COMPLETO.md
```

**Razón:** Scripts de debug específicos de restaurantes, no necesarios para autónomos

---

### 🗑️ CATEGORÍA 3: ARCHIVOS DE DEPLOY ANTIGUOS

```
deploy/REDEPLOY_2025-09-22_02.md
```

**Razón:** Documentación de deploy antigua

---

### 🗑️ CATEGORÍA 4: JAVASCRIPT TEMPORAL/DEBUG

```
combined_node.js
node_clean.js
node_final.js
start-app.js
temp_fix_workflow.cjs
temp_fix_workflow.js
workflow_complete.json
```

**Razón:** Scripts temporales de debugging

---

### 🗑️ CATEGORÍA 5: CARPETA GUARDADO (Completa)

```
guardado/ (toda la carpeta)
```

**Razón:** Carpeta de archivos guardados/backup sin uso

---

### 🗑️ CATEGORÍA 6: CHANGELOGS ANTIGUOS (Consolidar)

```
docs/06-changelogs/*.md (23 archivos)
```

**Acción:** Consolidar en 1-2 archivos finales, eliminar el resto

---

### 🗑️ CATEGORÍA 7: AUDITORÍAS ANTIGUAS (Mantener solo última)

```
docs/05-auditorias/*.md (mantener solo la más reciente)
```

**Acción:** Eliminar auditorías antiguas excepto la última

---

### 🗑️ CATEGORÍA 8: DOCUMENTACIÓN LEGACY DE VOZ

```
docs/02-sistemas/SISTEMA-VOZ-TWILIO-ARQUITECTURA-EMPRESARIAL.md
docs/02-sistemas/RESUMEN-EJECUTIVO-VOZ.md
docs/02-sistemas/RESUMEN-FEEDBACK-IMPLEMENTACION.md
docs/02-sistemas/RESUMEN-SISTEMA-VOZ-FINAL.md
docs/02-sistemas/SISTEMA-VOZ-PROFESIONAL-STREAMING.md
docs/02-sistemas/SISTEMA-VOZ-OPTIMIZADO-RENTABLE.md
```

**Razón:** Documentación obsoleta de sistemas de voz (mantener solo SISTEMA-VOZ-OPENAI-COMPLETO.md)

---

### 🗑️ CATEGORÍA 9: DOCUMENTACIÓN ESPECÍFICA DE RESTAURANTES

```
docs/02-sistemas/SISTEMA-COMBINACION-MESAS.md
docs/02-sistemas/SISTEMA-PROTECCION-RESERVAS-MESAS.md
```

**Razón:** Sistemas específicos de restaurantes que no aplican a autónomos

---

### 🗑️ CATEGORÍA 10: ARCHIVOS DE CONFIGURACIÓN LEGACY

```
postcss.config.js (si no se usa PostCSS adicional)
```

**Verificar:** Si Tailwind funciona sin él, eliminar

---

### 🗑️ CATEGORÍA 11: EMAIL TEMPLATES HTML (Evaluar)

```
email-templates/*.html (3 archivos)
```

**Acción:** Evaluar si se necesitan para autónomos o se usan templates de n8n

---

### 🗑️ CATEGORÍA 12: N8N WORKFLOWS DUPLICADOS/ANTIGUOS

```
n8n/workflows/01-voz-gateway-streaming-google-tts.json
n8n/workflows/01-voz-gateway-streaming.json
n8n/workflows/BAPI-Voice-Gateway-CLEAN.json
n8n/workflows/BAPI-Voice-Gateway-FINAL-SIMPLIFICADO.json
n8n/workflows/BAPI-Voice-Gateway-FINAL.json
n8n/workflows/TOOL-create-reservation-COMPLETO.json
n8n/workflows/TOOL-create-reservation-FINAL-COMPLETO.json
n8n/workflows/TOOL-create-reservation-FINAL-LIMPIO.json
n8n/workflows/TOOL-create-reservation-NATIVO-SIMPLE.json
```

**Razón:** Versiones antiguas/duplicadas de workflows (mantener solo FINAL)

---

### 🗑️ CATEGORÍA 13: PROMPTS ANTIGUOS DE N8N

```
n8n/prompts/PROMPT-SUPER-AGENT-v1.txt hasta v13.txt (mantener solo v14)
n8n/prompts/PROMPT-CLASSIFIER-v2-MEJORADO.txt hasta v4
n8n/prompts/super-agent-CON-FECHA.txt
n8n/prompts/super-agent-prompt.txt
```

**Razón:** Versiones antiguas de prompts (mantener solo la última versión)

---

### 🗑️ CATEGORÍA 14: BACKUPS DE TABLAS

```
tables_zones_backup (tabla en Supabase)
```

**Razón:** Backup pre-migración innecesario

---

## ✅ ARCHIVOS A MANTENER (Críticos)

### Documentación Core:
- ✅ `docs/00-INDICE-MAESTRO.md`
- ✅ `docs/01-arquitectura/ARQUITECTURA_TECNICA_2025.md`
- ✅ `docs/01-arquitectura/DATABASE-SCHEMA-SUPABASE-COMPLETO.md`
- ✅ `docs/04-desarrollo/NORMAS_SAGRADAS.md`
- ✅ `docs/04-desarrollo/CHECKLIST_OBLIGATORIO.md`

### Código Fuente:
- ✅ Todo `/src` (excepto backups)
- ✅ `/supabase/migrations` (todas las migraciones)
- ✅ `/public` (assets)

### Configuración:
- ✅ `package.json`
- ✅ `vite.config.js`
- ✅ `tailwind.config.js`
- ✅ `vercel.json`

---

## 📊 RESUMEN DE LIMPIEZA

| Categoría | Archivos a Eliminar | Espacio Estimado |
|-----------|---------------------|------------------|
| Backups | 5 archivos | ~500 KB |
| SQL Debug | 7 archivos | ~200 KB |
| Deploy Legacy | 1 archivo | ~50 KB |
| Scripts Temp | 7 archivos | ~300 KB |
| Guardado | Carpeta completa | ~2 MB |
| Changelogs | ~20 archivos | ~500 KB |
| Auditorías | ~5 archivos | ~300 KB |
| Docs Voz Legacy | 6 archivos | ~400 KB |
| Docs Restaurante | 2 archivos | ~150 KB |
| N8N Workflows | ~10 archivos | ~1 MB |
| N8N Prompts | ~15 archivos | ~200 KB |
| **TOTAL** | **~78 archivos** | **~5.6 MB** |

---

## 🚀 PLAN DE EJECUCIÓN

### Fase 1: Eliminar Archivos Root (Prioritario)
1. Backups de páginas
2. Scripts SQL de debug
3. Archivos .js temporales
4. Carpeta `guardado/`

### Fase 2: Limpiar Documentación
1. Consolidar changelogs
2. Eliminar auditorías antiguas
3. Eliminar docs de voz legacy
4. Eliminar docs específicos de restaurantes

### Fase 3: Limpiar N8N
1. Eliminar workflows duplicados
2. Eliminar prompts antiguos
3. Mantener solo versiones FINAL

### Fase 4: Verificar y Limpiar
1. Ejecutar tests
2. Verificar que la app funciona
3. Commit de limpieza

---

## ⚠️ PRECAUCIONES

1. ✅ Hacer backup del repo antes de eliminar
2. ✅ Eliminar en fases, no todo de golpe
3. ✅ Verificar que no se rompe nada después de cada fase
4. ✅ Commit después de cada fase

---

## ✅ PROGRESO DE LIMPIEZA

### ✅ FASE 1 COMPLETADA (20 archivos eliminados)

**Archivos eliminados:**
- ✅ 5 archivos de backup (.jsx.backup)
- ✅ 7 scripts temporales (.js, .cjs)
- ✅ 6 scripts SQL de debug
- ✅ 2 documentos MD temporales  
- ✅ 8 documentos legacy de sistemas

**Total eliminado:** ~1.5 MB

---

**Estado:** ✅ Fase 1 completada - Listo para Fase 2
**Siguiente:** Limpiar N8N workflows duplicados

