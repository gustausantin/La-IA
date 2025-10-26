// lib/supabase.js - Configuración avanzada para La-IA
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { log } from "../utils/logger.js";
// Configuración directa y simple
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ktsqwvhqamedpmzkzjaz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0c3F3dmhxYW1lZHBtemt6amF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzY3NzEsImV4cCI6MjA2OTk1Mjc3MX0.Y-zMa2F5a7UVT-efldv0sZjLAgmCfeEmhxfP7kgGzNY';

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