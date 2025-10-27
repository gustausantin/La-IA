// lib/supabase.js - Configuración avanzada para La-IA
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { log } from "../utils/logger.js";
// Configuración directa y simple - NUEVO PROYECTO
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zrcsujgurtglyqoqiynr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM';

log.debug('🔍 Configuración Supabase:');
log.debug('URL:', supabaseUrl ? '✅ Configurada' : '❌ Falta');
log.debug('Key:', supabaseKey ? '✅ Configurada' : '❌ Falta');

// Cliente SIMPLE que funciona
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Verificación silenciosa de conexión
supabase
  .from('restaurants')
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