// lib/supabase.js - Configuración avanzada para La-IA
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { log } from "../utils/logger.js";
// Configuración desde variables de entorno (SEGURO)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación de credenciales
if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ Faltan credenciales de Supabase. Revisa tu archivo .env');
}

log.debug('🔍 Configuración Supabase:');
log.debug('URL:', supabaseUrl ? '✅ Configurada' : '❌ Falta');
log.debug('Key:', supabaseKey ? '✅ Configurada' : '❌ Falta');

// Cliente con ANON KEY (para auth y queries normales)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-client-info': 'la-ia-app@1.0.0'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Verificación silenciosa de conexión
supabase
  .from('businesses')
  .select('count', { count: 'exact', head: true })
  .then(() => {
    if (typeof window !== 'undefined') {
      log.info('🚀 Supabase conectado correctamente');
    }
  })
  .catch((error) => {
    if (typeof window !== 'undefined') {
      log.error('❌ Error conectando Supabase:', error.message);
    }
  });

export default supabase;
