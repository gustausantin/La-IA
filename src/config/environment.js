// config/environment.js - Configuración centralizada para La-IA
import { validateConfig as validateConfigSchema } from './schema.js';

const isDevelopment = import.meta.env.NODE_ENV === 'development' || import.meta.env.DEV;
const isProduction = import.meta.env.NODE_ENV === 'production' || import.meta.env.PROD;
const isTest = import.meta.env.NODE_ENV === 'test';

// Detectar el entorno actual con fallback seguro
const getEnvironment = () => {
  const env = import.meta.env.VITE_APP_ENV || import.meta.env.NODE_ENV || 'development';
  return ['development', 'staging', 'production'].includes(env) ? env : 'development';
};

// Cargar configuración específica del entorno
const loadEnvironmentConfig = async () => {
  const environment = getEnvironment();
  
  try {
    const envModule = await import(`./environment.${environment}.js`);
    return envModule.config;
  } catch (error) {
    return {
      SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://ktsqwvhqamedpmzkzjaz.supabase.co',
      SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0c3F3dmhxYW1lZHBtemt6amF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzY3NzEsImV4cCI6MjA2OTk1Mjc3MX0.Y-zMa2F5a7UVT-efldv0sZjLAgmCfeEmhxfP7kgGzNY',
      DEBUG: isDevelopment,
      LOG_LEVEL: isDevelopment ? 'debug' : 'error'
    };
  }
};

// Configuración de Supabase (migrada al sistema por ambiente) - NUEVO PROYECTO
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://zrcsujgurtglyqoqiynr.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3N1amd1cnRnbHlxb3FpeW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTYwOTEsImV4cCI6MjA3NzA5MjA5MX0.ArgosNCVMqlC-4-r6Y_cnUh_CoA2SiX9wayS0N0kyjM',
};

// Configuración de la aplicación
export const APP_CONFIG = {
  name: 'La-IA',
  version: '1.0.0',
  description: 'Sistema de Inteligencia para Restaurantes',
  company: 'La-IA Team',
  supportEmail: 'soporte@la-ia.com',
  website: 'https://la-ia.com'
};

// Configuración de logging
export const LOGGING_CONFIG = {
  level: isDevelopment ? 'debug' : 'error',
  enableConsole: isDevelopment,
  enableFile: isProduction,
  maxFileSize: '10MB',
  maxFiles: 5
};

// Configuración de performance
export const PERFORMANCE_CONFIG = {
  enableMonitoring: isDevelopment,
  slowRenderThreshold: 16, // 16ms = 60fps
  enableMemoryTracking: isDevelopment,
  enableRenderCounting: isDevelopment
};

// Configuración de features
export const FEATURES_CONFIG = {
  enableRealTime: true,
  enableAnalytics: true,
  enableMultiChannel: true,
  enableAIAgent: true,
  enableNotifications: true,
  enableErrorReporting: isProduction
};

// Configuración de UI/UX
export const UI_CONFIG = {
  theme: 'light',
  language: 'es',
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  currency: 'EUR',
  timezone: 'Europe/Madrid'
};

// Configuración de API
export const API_CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Configuración de seguridad
export const SECURITY_CONFIG = {
  enableCORS: true,
  enableRateLimiting: isProduction,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutos
  sessionTimeout: 24 * 60 * 60 * 1000 // 24 horas
};

// Configuración de canales de comunicación
export const CHANNEL_CONFIG = {
  whatsapp: {
    enabled: true,
    name: 'WhatsApp',
    icon: 'whatsapp',
    color: '#25D366',
    priority: 'high'
  },
  vapi: {
    enabled: true,
    name: 'Llamadas',
    icon: 'phone',
    color: '#F59E0B',
    priority: 'high'
  },
  email: {
    enabled: true,
    name: 'Email',
    icon: 'mail',
    color: '#6366F1',
    priority: 'medium'
  },
  instagram: {
    enabled: false,
    name: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    priority: 'low'
  },
  facebook: {
    enabled: false,
    name: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    priority: 'low'
  }
};

// Configuración de métricas
export const METRICS_CONFIG = {
  refreshInterval: 30000, // 30 segundos
  enableRealTimeUpdates: true,
  maxDataPoints: 1000,
  enableExport: true
};

// Función para obtener configuración completa
export const getConfig = () => ({
  environment: process.env.NODE_ENV,
  isDevelopment,
  isProduction,
  isTest,
  supabase: SUPABASE_CONFIG,
  app: APP_CONFIG,
  logging: LOGGING_CONFIG,
  performance: PERFORMANCE_CONFIG,
  features: FEATURES_CONFIG,
  ui: UI_CONFIG,
  api: API_CONFIG,
  security: SECURITY_CONFIG,
  channels: CHANNEL_CONFIG,
  metrics: METRICS_CONFIG
});

// Función para validar configuración (legacy - mantener por compatibilidad)
export const validateConfig = () => {
  const errors = [];
  
  if (!SUPABASE_CONFIG.url) {
    errors.push('SUPABASE_URL is required');
  }
  
  if (!SUPABASE_CONFIG.anonKey) {
    errors.push('SUPABASE_ANON_KEY is required');
  }
  
  if (errors.length > 0) {
    return false;
  }
  
  return true;
};

// Función para validar configuración con schema Zod
export const validateConfigWithSchema = (config) => {
  try {
    return validateConfigSchema(config);
  } catch (error) {
    return null;
  }
};

// Función para obtener configuración específica del entorno
export const getEnvironmentConfig = () => {
  if (isDevelopment) {
    return {
      ...getConfig(),
      debug: true,
      enableHotReload: true,
      enableDevTools: true
    };
  }
  
  if (isProduction) {
    return {
      ...getConfig(),
      debug: false,
      enableHotReload: false,
      enableDevTools: false,
      enableErrorReporting: true
    };
  }
  
  return getConfig();
};

export default getConfig();
