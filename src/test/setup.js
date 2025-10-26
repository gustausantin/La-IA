// Test Setup - Configuración global para tests de clase mundial 🧪
import React from 'react';
import '@testing-library/jest-dom';
import { expect, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// === SETUP GLOBAL ===

// Limpiar después de cada test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// === MOCKS GLOBALES ===

// Mock de Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    abortSignal: vi.fn().mockReturnThis(),
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
  rpc: vi.fn((functionName, params) => {
    // Mock específico para create_restaurant_securely
    if (functionName === 'create_restaurant_securely') {
      return Promise.resolve({
        data: {
          success: true,
          restaurant_id: 'test-restaurant-id',
          restaurant_name: params?.restaurant_data?.name || 'Test Restaurant',
          message: 'Restaurant created successfully'
        },
        error: null
      });
    }
    // Mock por defecto para otras RPC
    return Promise.resolve({ data: {}, error: null });
  }),
};

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock de React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
    BrowserRouter: ({ children }) => children,
    MemoryRouter: ({ children }) => children,
  };
});

// Mock de React Hot Toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
  Toaster: () => null,
}));

// ✅ MOCK ULTRA ROBUSTO DEL LOGGER
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock de date-fns
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    format: vi.fn((date, formatStr) => '2025-01-25'),
    addHours: vi.fn((date, hours) => new Date()),
    parseISO: vi.fn((dateStr) => new Date()),
  };
});

// Mock de date-fns/locale
vi.mock('date-fns/locale', () => ({
  es: {},
}));

// ✅ MOCK ULTRA ROBUSTO DE FRAMER-MOTION
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => React.createElement('div', props, children),
    span: ({ children, ...props }) => React.createElement('span', props, children),
    button: ({ children, ...props }) => React.createElement('button', props, children),
    img: ({ children, ...props }) => React.createElement('img', props, children),
    p: ({ children, ...props }) => React.createElement('p', props, children),
    h1: ({ children, ...props }) => React.createElement('h1', props, children),
    h2: ({ children, ...props }) => React.createElement('h2', props, children),
    h3: ({ children, ...props }) => React.createElement('h3', props, children),
    form: ({ children, ...props }) => React.createElement('form', props, children),
    section: ({ children, ...props }) => React.createElement('section', props, children),
    aside: ({ children, ...props }) => React.createElement('aside', props, children),
    nav: ({ children, ...props }) => React.createElement('nav', props, children),
    header: ({ children, ...props }) => React.createElement('header', props, children),
    main: ({ children, ...props }) => React.createElement('main', props, children),
    footer: ({ children, ...props }) => React.createElement('footer', props, children),
    article: ({ children, ...props }) => React.createElement('article', props, children),
    ul: ({ children, ...props }) => React.createElement('ul', props, children),
    li: ({ children, ...props }) => React.createElement('li', props, children),
    a: ({ children, ...props }) => React.createElement('a', props, children),
  },
  AnimatePresence: ({ children }) => children,
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    set: vi.fn(),
  }),
  useMotionValue: () => ({
    get: vi.fn(),
    set: vi.fn(),
    onChange: vi.fn(),
  }),
  useTransform: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
  useSpring: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

// === UTILIDADES DE TESTING ===

// Helper para crear contexto de autenticación mock
export const createMockAuthContext = (overrides = {}) => ({
  user: { id: 'test-user', email: 'test@example.com' },
  restaurant: { id: 'test-restaurant', name: 'Test Restaurant' },
  restaurantId: 'test-restaurant',
  isAuthenticated: true,
  isReady: true,
  loading: false,
  status: 'signed_in',
  login: vi.fn(),
  logout: vi.fn(),
  signOut: vi.fn(),
  forceLogout: vi.fn(),
  restartApp: vi.fn(),
  notifications: [],
  unreadCount: 0,
  agentStatus: {
    active: true,
    activeConversations: 0,
    pendingActions: 0,
    channels: { whatsapp: true, vapi: false }
  },
  addNotification: vi.fn(),
  markNotificationAsRead: vi.fn(),
  clearNotifications: vi.fn(),
  fetchRestaurantInfo: vi.fn(),
  ...overrides,
});

// Helper para wrapper con AuthContext
export const createAuthWrapper = (authContextValue) => {
  return ({ children }) => {
    const { AuthProvider } = require('../contexts/AuthContext');
    return React.createElement(AuthProvider, { value: authContextValue }, children);
  };
};

// Helper para datos de prueba de reservas
export const createMockReservation = (overrides = {}) => ({
  id: 'test-reservation-1',
  customer_name: 'Test Customer',
  reservation_date: '2025-01-25',
  reservation_time: '19:00',
  party_size: 2,
  status: 'confirmada',
  source: 'agent',
  channel: 'whatsapp',
  created_at: '2025-01-25T10:00:00Z',
  restaurant_id: 'test-restaurant',
  ...overrides,
});

// Helper para datos de prueba de conversaciones
export const createMockConversation = (overrides = {}) => ({
  id: 'test-conversation-1',
  customer_name: 'Test Customer',
  channel: 'whatsapp',
  state: 'active',
  last_message: 'Hola, quiero hacer una reserva',
  last_message_at: '2025-01-25T10:00:00Z',
  resulted_in_reservation: false,
  restaurant_id: 'test-restaurant',
  ...overrides,
});

// === CONFIGURACIÓN DE ENVIRONMENT ===

// Variables de entorno para testing
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock de window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      reload: vi.fn(),
      replace: vi.fn(),
    },
    writable: true,
  });

  // Mock de localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  // Mock de sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  });

  // ✅ MOCK ULTRA ROBUSTO DE WEB APIs
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // ✅ INTERSECTION OBSERVER ULTRA ROBUSTO - QUICK WIN
  global.IntersectionObserver = vi.fn().mockImplementation((callback, options) => {
    const mockObserver = {
      observe: vi.fn((element) => {
        // ✅ QUICK WIN: Callback inmediato y síncrono para tests
        if (callback && typeof callback === 'function') {
          // Ejecutar callback inmediatamente
          // Usar setTimeout para evitar problemas síncronos
          setTimeout(() => {
            try {
              callback([{
                target: element,
                isIntersecting: true,
                intersectionRatio: 1,
                boundingClientRect: element?.getBoundingClientRect?.() || { 
                  x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 
                },
                rootBounds: { x: 0, y: 0, width: 1024, height: 768, top: 0, right: 1024, bottom: 768, left: 0 },
                time: Date.now()
              }]);
            } catch (error) {
              console.warn('⚠️ IntersectionObserver callback error (test env):', error);
            }
          }, 0);
        }
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: options?.root || null,
      rootMargin: options?.rootMargin || '0px',
      thresholds: options?.threshold || [0],
    };
    
    return mockObserver;
  });
  
  // Asegurar que también funciona como propiedad global
  window.IntersectionObserver = global.IntersectionObserver;

  // Mock de Navigator APIs
  Object.defineProperty(global, 'navigator', {
    value: {
      ...global.navigator,
      serviceWorker: {
        register: vi.fn(() => Promise.resolve()),
        ready: Promise.resolve({
          showNotification: vi.fn(),
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      userAgent: 'test-user-agent',
      language: 'es-ES',
      languages: ['es-ES', 'es', 'en'],
      onLine: true,
      cookieEnabled: true,
      doNotTrack: null,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
    },
    writable: true,
  });

  // Mock de Performance API
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    navigation: {
      type: 0,
    },
    timing: {
      navigationStart: Date.now(),
      loadEventEnd: Date.now() + 1000,
    },
  };

  // Mock de Window APIs adicionales
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
  global.cancelAnimationFrame = vi.fn();
  global.requestIdleCallback = vi.fn((cb) => setTimeout(cb, 1));
  global.cancelIdleCallback = vi.fn();

  // Mock de Fetch API robusto
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      headers: new Map(),
    })
  );

  // Mock de WebSocket para tiempo real
  global.WebSocket = vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }));
});

// Cleanup después de todos los tests
afterAll(() => {
  vi.clearAllMocks();
});

// === CONFIGURACIÓN DE TIMEOUTS ===

// Aumentar timeouts para tests complejos
vi.setConfig({
  testTimeout: 15000, // Aumentado para AuthContext async
  hookTimeout: 15000,
});

// === MATCHERS PERSONALIZADOS ===

// Matcher personalizado para verificar que un elemento tiene clase de Tailwind
expect.extend({
  toHaveTailwindClass(received, className) {
    const pass = received.classList.contains(className);
    if (pass) {
      return {
        message: () => `expected element not to have Tailwind class "${className}"`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to have Tailwind class "${className}"`,
        pass: false,
      };
    }
  },
});

// === EXPORTS PARA USO EN TESTS ===
export { 
  mockSupabase,
  createMockAuthContext,
  createAuthWrapper,
  createMockReservation,
  createMockConversation,
  vi,
  expect,
  cleanup,
};
