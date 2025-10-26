// Simple logger para debugging en producción
const logger = {
  info: (message, data) => // console.log(`[INFO] ${message}`, data || ''),
  warn: (message, data) => // console.warn(`[WARN] ${message}`, data || ''),
  error: (message, data) => // console.error(`[ERROR] ${message}`, data || ''),
  debug: (message, data) => // console.log(`[DEBUG] ${message}`, data || '')
};

export default logger;
export const log = logger;
