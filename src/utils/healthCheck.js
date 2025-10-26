// Health check para verificar el estado de la aplicación
import { supabase } from '../lib/supabase.js';

export const healthCheck = async () => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    services: {}
  };

  try {
    // Check Supabase connection
    const { error: supabaseError } = await supabase
      .from('restaurants')
      .select('count', { count: 'exact', head: true });
    
    checks.services.supabase = {
      status: supabaseError ? 'down' : 'up',
      error: supabaseError?.message
    };

    // Check environment variables
    checks.services.environment = {
      status: (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) ? 'up' : 'down',
      missing: []
    };

    if (!process.env.VITE_SUPABASE_URL) checks.services.environment.missing.push('VITE_SUPABASE_URL');
    if (!process.env.VITE_SUPABASE_ANON_KEY) checks.services.environment.missing.push('VITE_SUPABASE_ANON_KEY');

    // Overall status
    const allUp = Object.values(checks.services).every(service => service.status === 'up');
    checks.status = allUp ? 'healthy' : 'unhealthy';

    return checks;
  } catch (error) {
    checks.status = 'error';
    checks.error = error.message;
    return checks;
  }
};

export default healthCheck;