// Logger simple y seguro para el navegador - NO WINSTON
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// Helper para formatear logs
const formatLog = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const service = 'la-ia-app';
  const metaStr = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${service}] ${level.toUpperCase()}: ${message} ${metaStr}`;
};

// Logger simple basado en console
const logger = {
  debug: (message, meta = {}) => {
    if (isDevelopment) {
      console.log(formatLog('debug', message, meta));
    }
  },
  
  info: (message, meta = {}) => {
    console.info(formatLog('info', message, meta));
  },
  
  warn: (message, meta = {}) => {
    console.warn(formatLog('warn', message, meta));
  },
  
  error: (message, meta = {}) => {
    console.error(formatLog('error', message, meta));
  }
};

// Función helper para logging estructurado
export const log = {
  debug: (message, meta = {}) => logger.debug(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  
  // Métodos específicos para eventos de la aplicación
  auth: (message, meta = {}) => logger.info(`[AUTH] ${message}`, meta),
  db: (message, meta = {}) => logger.info(`[DB] ${message}`, meta),
  api: (message, meta = {}) => logger.info(`[API] ${message}`, meta),
  ui: (message, meta = {}) => logger.debug(`[UI] ${message}`, meta),
  
  // Logging de errores críticos
  critical: (message, error, meta = {}) => {
    logger.error(`[CRITICAL] ${message}`, {
      error: error?.message,
      stack: error?.stack,
      ...meta
    });
  }
};

export default logger;