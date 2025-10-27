# 🚀 MIGRACIÓN A NUEVO SUPABASE

**Fecha**: 26 de Octubre de 2025  
**Proyecto Origen**: ktsqwvhqamedpmzkzjaz.supabase.co  
**Proyecto Destino**: zrcsujgurtglyqoqiynr.supabase.co  
**Estado**: ✅ LISTO PARA EJECUTAR

---

## ✅ PROGRESO ACTUAL

### FASE 1: MOBILE-FIRST UI ✅ COMPLETADO
- [x] Design System (tokens, colores, tipografía)
- [x] Hooks (useDevice, useGestures)
- [x] Componentes base (Button, Card, Input, Navigation)
- [x] ReservasMobile con swipe gestures
- [x] DashboardMobile con pull-to-refresh
- [x] Bottom Navigation táctil

### FASE 2: MIGRACIÓN BD (EN CURSO)
- [ ] Exportar esquema BD antigua
- [ ] Importar a nuevo Supabase
- [ ] Actualizar credenciales
- [ ] Testing de conectividad

---

## 📋 PASOS PARA MIGRACIÓN

### OPCIÓN 1: Con PostgreSQL instalado (ÓPTIMO)

```powershell
# 1. Exportar esquema (sin datos)
pg_dump --schema-only --no-owner --no-acl \
  -f "schema_migration_$(Get-Date -Format 'yyyy-MM-dd').sql" \
  "postgresql://postgres.ktsqwvhqamedpmzkzjaz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# 2. Importar al nuevo
psql "postgresql://postgres.zrcsujgurtglyqoqiynr:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f "schema_migration_$(Get-Date -Format 'yyyy-MM-dd').sql"
```

### OPCIÓN 2: Desde Supabase Dashboard (MÁS FÁCIL)

#### Proyecto Antiguo:
1. Ve a: https://supabase.com/dashboard/project/ktsqwvhqamedpmzkzjaz
2. SQL Editor → Copia todo el contenido de:
   - `docs/01-arquitectura/DATABASE-SCHEMA-ESTRUCTURA-COMPLETA-2025-10-17.sql`

#### Proyecto Nuevo:
1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr
2. SQL Editor → Pega el esquema completo
3. Ejecuta (Run)

### OPCIÓN 3: Con Supabase CLI (RECOMENDADO SI TIENES NODE.JS)

```powershell
# Ya tienes Node.js instalado (v22.18.0)

# 1. Login en Supabase
npx supabase login

# 2. Link al proyecto antiguo y exportar
npx supabase link --project-ref ktsqwvhqamedpmzkzjaz
npx supabase db dump -f schema_export.sql --schema-only

# 3. Link al proyecto nuevo e importar
npx supabase link --project-ref zrcsujgurtglyqoqiynr
npx supabase db push schema_export.sql
```

---

## 🔑 PASO 3: ACTUALIZAR CREDENCIALES

Después de migrar el esquema, actualiza las credenciales en la app:

### Archivo a Modificar:
`src/config/environment.development.js`

```javascript
// ANTES (proyecto antiguo)
SUPABASE_URL: 'https://ktsqwvhqamedpmzkzjaz.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',

// DESPUÉS (proyecto nuevo)
SUPABASE_URL: 'https://zrcsujgurtglyqoqiynr.supabase.co',
SUPABASE_ANON_KEY: '[NUEVO_ANON_KEY_AQUI]',
```

### Obtener NUEVO_ANON_KEY:
1. Ve a: https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr
2. Settings → API
3. Copia el **anon public** key

---

## ✅ VERIFICACIÓN POST-MIGRACIÓN

```powershell
# 1. Arrancar la app
npm run dev

# 2. Probar login
# 3. Verificar que carga restaurantes
# 4. Crear una reserva de prueba
# 5. Verificar que todo funciona
```

---

## 📊 CHECKLIST COMPLETO

### Pre-Migración
- [x] Auditoría técnica completa
- [x] Mobile-first UI implementada
- [ ] Backup del proyecto antiguo (opcional)

### Migración
- [ ] Exportar esquema BD antigua
- [ ] Importar a zrcsujgurtglyqoqiynr
- [ ] Verificar tablas (61 tablas)
- [ ] Verificar RLS policies (109 policies)
- [ ] Verificar funciones SQL

### Post-Migración
- [ ] Actualizar credenciales en código
- [ ] Actualizar .env files
- [ ] Testing completo
- [ ] Deploy a staging

### Mobile UI
- [x] Design System
- [x] Componentes táctiles
- [x] Navegación mobile
- [x] Gestures (swipe, pull-to-refresh)
- [x] ReservasMobile
- [x] DashboardMobile
- [ ] ClientesMobile (siguiente)
- [ ] CalendarioMobile (siguiente)

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

1. **AHORA**: Ejecutar migración de BD (elige opción 2 o 3)
2. **10 min**: Actualizar credenciales en código
3. **5 min**: Testing de conectividad
4. **Mañana**: Continuar con más vistas mobile

---

## 📞 NOTAS IMPORTANTES

- ✅ NO hay datos en producción aún → Migración segura
- ✅ Esquema ya documentado en `docs/01-arquitectura/`
- ✅ 61 tablas + 109 RLS policies + funciones
- ✅ Multi-tenant verificado y funcionando
- ⚠️ Recordar: El proyecto antiguo puede seguir funcionando en paralelo durante testing

---

**🎉 Una vez completada la migración, tendrás:**
- ✅ BD nueva y limpia en zrcsujgurtglyqoqiynr
- ✅ Mobile-first UI funcionando
- ✅ Listo para continuar desarrollo agresivo (6 semanas)

