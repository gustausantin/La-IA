// lib/supabaseAdmin.js - Cliente admin para operaciones críticas
// SOLO para operaciones que requieren bypass completo de RLS
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Cliente con SERVICE ROLE KEY (bypass completo de RLS)
// ⚠️ SOLO usar para operaciones críticas que no pueden fallar
// ⚠️ NUNCA exponer esta key en el frontend en producción
let adminClient = null;

if (supabaseServiceKey && typeof window !== 'undefined') {
  // En desarrollo, podemos usar service role key para debugging
  // En producción, esto debería estar en el backend
  console.warn('⚠️ Usando Service Role Key en frontend - Solo para desarrollo');
  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export const getAdminClient = () => {
  if (!adminClient) {
    console.warn('⚠️ Service Role Key no disponible - usando cliente normal');
    return null;
  }
  return adminClient;
};

export default adminClient;

