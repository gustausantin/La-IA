import { z } from 'zod';

// Schema de validación para variables de entorno
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  APP_ENV: z.enum(['development', 'staging', 'production']),
  
  // Supabase (required)
  SUPABASE_URL: z.string().url('SUPABASE_URL debe ser una URL válida'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY es requerido'),
  
  // API Configuration
  API_BASE_URL: z.string().url('API_BASE_URL debe ser una URL válida'),
  SERVER_PORT: z.number().int().min(1000).max(65535),
  
  // Debug & Logging
  DEBUG: z.boolean(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  
  // Feature Flags
  ENABLE_DEBUG_PANEL: z.boolean(),
  ENABLE_MOCK_DATA: z.boolean(),
  ENABLE_2FA: z.boolean(),
  
  // Session
  SESSION_TIMEOUT: z.number().int().min(60000), // Mínimo 1 minuto
  
  // Analytics & Monitoring (optional)
  SENTRY_DSN: z.string().url().optional().or(z.literal(null)),
  ANALYTICS_ID: z.string().optional().or(z.literal(null))
});

// Función para validar configuración
export function validateConfig(config) {
  try {
    return envSchema.parse(config);
  } catch (error) {
    throw new Error(`Configuración inválida: ${error.errors.map(e => e.message).join(', ')}`);
  }
}
