// DESARROLLO - Configuración para desarrollo local
export const config = {
  NODE_ENV: 'development',
  APP_ENV: 'development',
  
  // Supabase Configuration (Development)
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://ktsqwvhqamedpmzkzjaz.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0c3F3dmhxYW1lZHBtemt6amF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzY3NzEsImV4cCI6MjA2OTk1Mjc3MX0.Y-zMa2F5a7UVT-efldv0sZjLAgmCfeEmhxfP7kgGzNY',
  
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
