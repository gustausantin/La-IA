# ============================================
# COMANDOS PARA DESPLEGAR DASHBOARD - COPIAR Y PEGAR
# ============================================

# PASO 1: Login en Supabase (reemplaza TU-TOKEN por el token real)
supabase login --token sbp_TU-TOKEN-AQUI

# PASO 2: Ir a la carpeta del proyecto
cd C:\Users\Usuario\Desktop\LA-IA\La-IA

# PASO 3: Vincular tu proyecto (reemplaza TU-PROJECT-REF)
# Encuentra tu project-ref en: Supabase Dashboard -> Settings -> General -> Project URL
# Ejemplo: si tu URL es https://abc123xyz.supabase.co, el ref es "abc123xyz"
supabase link --project-ref TU-PROJECT-REF-AQUI

# PASO 4: Desplegar las 4 Edge Functions
supabase functions deploy get-snapshot
supabase functions deploy generate-flash-offer-text
supabase functions deploy transfer-appointments
supabase functions deploy cancel-appointments-batch

# ============================================
# ¡LISTO! Las 4 funciones estarán desplegadas
# ============================================

