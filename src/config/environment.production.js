// PRODUCCIÓN - Configuración para producción
export const config = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  
  // Supabase Configuration (Production)
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'your_production_supabase_url_here',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your_production_supabase_anon_key_here',
  
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.la-ia.com',
  SERVER_PORT: 3001,
  
  // Debug & Logging
  DEBUG: false,
  LOG_LEVEL: 'error',
  
  // Feature Flags
  ENABLE_DEBUG_PANEL: false,
  ENABLE_MOCK_DATA: false,
  ENABLE_2FA: true,
  
  // Session
  SESSION_TIMEOUT: 1800000, // 30 minutes for production
  
  // Analytics & Monitoring
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  ANALYTICS_ID: import.meta.env.VITE_ANALYTICS_ID
};
