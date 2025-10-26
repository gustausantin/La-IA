// Middleware de seguridad empresarial para La-IA App
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * CONTENT SECURITY POLICY (CSP) HEADERS
 * Protección contra XSS, clickjacking, y code injection
 */
export const cspHeaders = {
  // CSP Principal - Política estricta
  'Content-Security-Policy': [
    // Scripts: Solo desde el mismo origen y CDNs confiables
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    
    // Estilos: Mismo origen + inline necesario para Tailwind
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    
    // Imágenes: Mismo origen + data URIs + CDNs confiables
    "img-src 'self' data: https: blob:",
    
    // Fonts: Google Fonts y mismo origen
    "font-src 'self' https://fonts.gstatic.com",
    
    // Conexiones: APIs permitidas
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
    
    // Frames: Solo mismo origen (anti-clickjacking)
    "frame-src 'self'",
    
    // Objetos: Ninguno permitido
    "object-src 'none'",
    
    // Media: Mismo origen
    "media-src 'self'",
    
    // Workers: Mismo origen
    "worker-src 'self'",
    
    // Formularios: Solo mismo origen
    "form-action 'self'",
    
    // Base URI: Solo mismo origen
    "base-uri 'self'",
    
    // Upgrade insecure requests
    "upgrade-insecure-requests"
  ].join('; '),

  // Headers adicionales de seguridad
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=(self)',
    'payment=(self)'
  ].join(', ')
};

/**
 * RATE LIMITING CONFIGURATIONS
 * Protección contra ataques de fuerza bruta y spam
 */

// Rate limit general para toda la API
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: {
    error: 'Demasiadas solicitudes',
    details: 'Límite de 100 requests por 15 minutos excedido',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      details: 'Too many requests from this IP',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limit estricto para autenticación
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Solo 5 intentos de login
  message: {
    error: 'Demasiados intentos de autenticación',
    details: 'Límite de 5 intentos por 15 minutos excedido',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // No contar requests exitosos
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit para registro de usuarios
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 registros por hora por IP
  message: {
    error: 'Límite de registro excedido',
    details: 'Máximo 3 registros por hora por IP',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit para reset de contraseñas
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 intentos por hora
  message: {
    error: 'Límite de reset de contraseña excedido',
    details: 'Máximo 3 intentos por hora',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * MIDDLEWARE DE SEGURIDAD COMPLETO
 * Aplica todas las políticas de seguridad
 */
export const securityMiddleware = (app) => {
  // Helmet para headers básicos de seguridad
  app.use(helmet({
    contentSecurityPolicy: false, // Usamos nuestro CSP custom
    crossOriginEmbedderPolicy: false // Para compatibilidad
  }));

  // Aplicar CSP headers custom
  app.use((req, res, next) => {
    Object.entries(cspHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
    next();
  });

  // Rate limiting general
  app.use('/api/', generalRateLimit);
  
  // Rate limiting específico para autenticación
  app.use('/api/auth/', authRateLimit);
  app.use('/api/login', authRateLimit);
  
  // Rate limiting para registro
  app.use('/api/register', registerRateLimit);
  
  // Rate limiting para reset de contraseñas
  app.use('/api/password-reset', passwordResetRateLimit);
  
  console.log('🛡️ Security middleware initialized');
};

/**
 * VALIDADOR DE CSP
 * Verifica que los headers CSP están aplicados
 */
export const validateCSP = (req, res, next) => {
  const csp = res.getHeader('Content-Security-Policy');
  if (!csp) {
    console.warn('⚠️ CSP header missing on route:', req.path);
  }
  next();
};

/**
 * LOGGER DE SEGURIDAD
 * Registra intentos de violación de seguridad
 */
export const securityLogger = (req, res, next) => {
  // Log de requests sospechosos
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /<.*>/,
    /eval\(/i,
    /expression\(/i
  ];
  
  const userInput = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
  
  if (suspiciousPatterns.some(pattern => pattern.test(userInput))) {
    console.warn('🚨 Suspicious request detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

export default {
  cspHeaders,
  generalRateLimit,
  authRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  securityMiddleware,
  validateCSP,
  securityLogger
};
