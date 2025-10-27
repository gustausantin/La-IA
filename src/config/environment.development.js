// DESARROLLO - Configuración para desarrollo local
export const config = {
  NODE_ENV: 'development',
  APP_ENV: 'development',
  
  // Supabase Configuration (Development) - NUEVO PROYECTO
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://zrcsujgurtglyqoqiynr.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM',
  
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  SERVER_PORT: 3001,
  
  // Debug & Logging
  DEBUG: true,
  LOG_LEVEL: 'debug',
  
  // Feature Flags
  ENABLE_DEBUG_PANEL: true,
  ENABLE_MOCK_DATA: true,
  ENABLE_2FA: false,
  
  // Session
  SESSION_TIMEOUT: 3600000, // 1 hour
  
  // Analytics & Monitoring
  SENTRY_DSN: null,
  ANALYTICS_ID: null
};
