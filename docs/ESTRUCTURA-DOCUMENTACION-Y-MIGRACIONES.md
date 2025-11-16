# Estructura de documentación y migraciones (versión limpia)

## Documentación

- **docs/** → solo documentos vigentes y de referencia actual:
  - `00-INDICE-MAESTRO.md`, `00-PLAN-MAESTRO-RECEPCIONISTA-IA.md`.
  - Documentos de arquitectura, sistemas y features que representan el diseño o estado actual (no borradores).
- **docs/archive/** → notas históricas, borradores, backups e iteraciones intermedias:
  - Archivos con nombres como `BACKUP-*.md`, `*PROGRESS*`, guías parciales, etc.
  - Se conservan solo por histórico, pero **no se usan como fuente de verdad**.

Regla:  
> Cuando se haga una versión nueva de un documento, se actualiza el documento principal y las versiones antiguas se mueven a `docs/archive/` o se eliminan, nunca se dejan mezcladas.

## Migraciones de Supabase

- **supabase/migrations/** → contiene todas las migraciones que se han aplicado en la base de datos.
  - No se eliminan ni se renombran migraciones con nombre de timestamp (`YYYYMMDD_...`) para no romper el historial de Supabase.
- **supabase/scripts/** → scripts SQL auxiliares que no forman parte del historial oficial de migraciones (por ejemplo, cargas manuales o scripts de reparación puntuales).

Regla:  
> Solo entran en `migrations/` las migraciones que se van a ejecutar vía Supabase CLI. Cualquier script puntual o manual debe ir a `supabase/scripts/` o documentarse en `docs/`.


