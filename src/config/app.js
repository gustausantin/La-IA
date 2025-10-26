# Environment configuration helper
export const config = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Logging
  enableConsoleLog: process.env.NODE_ENV !== 'production',
  
  // API URLs
  apiUrl: process.env.VITE_API_URL || 'http://localhost:5001',
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY,
  
  // Features flags
  enableDebugMode: process.env.VITE_DEBUG === 'true',
  enableAnalytics: process.env.VITE_ENABLE_ANALYTICS === 'true',
};

// Helper para logs condicionales
export const conditionalLog = (...args) => {
  if (config.enableConsoleLog) {
  }
};

export default config;