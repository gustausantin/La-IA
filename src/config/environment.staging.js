// STAGING - Configuración para testing/staging
export const config = {
  NODE_ENV: 'staging',
  APP_ENV: 'staging',
  
  // Supabase Configuration (Staging)
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'your_staging_supabase_url_here',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your_staging_supabase_anon_key_here',
  
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api-staging.la-ia.com',
  SERVER_PORT: 3001,
  
  // Debug & Logging
  DEBUG: false,
  LOG_LEVEL: 'info',
  
  // Feature Flags
  ENABLE_DEBUG_PANEL: true,
  ENABLE_MOCK_DATA: false,
  ENABLE_2FA: true,
  
  // Session
  SESSION_TIMEOUT: 3600000, // 1 hour
  
  // Analytics & Monitoring
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  ANALYTICS_ID: import.meta.env.VITE_ANALYTICS_ID
};
