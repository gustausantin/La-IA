// Service Worker para La-IA PWA
// Versión del cache - cambiar para forzar actualización
const CACHE_NAME = 'la-ia-pwa-v1.0.3-fixed';
const OFFLINE_URL = '/offline.html';

// Archivos esenciales para funcionalidad offline
const ESSENTIAL_FILES = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Archivos de la app para cache
const APP_SHELL_FILES = [
  '/dashboard',
  '/reservas', 
  '/mesas',
  '/clientes',
  '/analytics'
];

// API endpoints para cache
const API_CACHE = [
  '/api/health'
];

// ===== INSTALACIÓN DEL SERVICE WORKER =====
self.addEventListener('install', (event) => {
  console.log('🚀 PWA: Service Worker instalándose...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 PWA: Cache abierto, guardando archivos esenciales...');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('✅ PWA: Archivos esenciales cacheados');
        // Forzar activación inmediata
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ PWA: Error en instalación:', error);
      })
  );
});

// ===== ACTIVACIÓN DEL SERVICE WORKER =====
self.addEventListener('activate', (event) => {
  console.log('🔄 PWA: Service Worker activándose...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Eliminar caches antiguos
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ PWA: Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ PWA: Service Worker activado');
        // Tomar control inmediato de todas las páginas
        return self.clients.claim();
      })
  );
});

// ===== INTERCEPTAR REQUESTS (CACHE STRATEGY) - TEMPORALMENTE DESACTIVADO =====
// COMENTADO TEMPORALMENTE PARA DEBUGGING - ESTABA BLOQUEANDO REQUESTS DE SUPABASE
/*
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia para diferentes tipos de requests
  if (request.method === 'GET') {
    event.respondWith(handleGetRequest(request));
  }
});
*/

// ===== ESTRATEGIAS DE CACHE =====

async function handleGetRequest(request) {
  const url = new URL(request.url);
  
  try {
    // 1. ARCHIVOS ESTÁTICOS - Cache First
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request);
    }
    
    // 2. API CALLS - Network First con fallback
    if (url.pathname.startsWith('/api/')) {
      return await networkFirstWithFallback(request);
    }
    
    // 3. PÁGINAS DE LA APP - Stale While Revalidate
    if (isAppRoute(url.pathname)) {
      return await staleWhileRevalidate(request);
    }
    
    // 4. DEFAULT - Network First
    return await networkFirst(request);
    
  } catch (error) {
    console.error('❌ PWA: Error en fetch strategy:', error);
    return await getOfflineFallback(request);
  }
}

// Cache First - Para assets estáticos
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ PWA: Asset no disponible offline:', request.url);
    throw error;
  }
}

// Network First - Para contenido dinámico
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network First con Fallback específico para APIs
async function networkFirstWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Solo cachear respuestas exitosas
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Intentar respuesta cacheada
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback para APIs críticas
    return new Response(
      JSON.stringify({
        error: 'Servicio no disponible offline',
        offline: true,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale While Revalidate - Para páginas de la app
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Fetch en background para actualizar cache con manejo de errores
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.warn('SW: Network fetch failed, using cache if available');
    return cachedResponse;
  });
  
  // Devolver cache inmediatamente si existe, sino esperar network
  return cachedResponse || fetchPromise;
}

// Fallback offline
async function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // Para páginas HTML, mostrar página offline
  if (request.destination === 'document') {
    return caches.match(OFFLINE_URL);
  }
  
  // Para imágenes, devolver imagen placeholder
  if (request.destination === 'image') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" fill="#6b7280">Sin conexión</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  return new Response('Contenido no disponible offline', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// ===== UTILIDADES =====

function isStaticAsset(pathname) {
  return pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf)$/);
}

function isAppRoute(pathname) {
  const appRoutes = ['/dashboard', '/reservas', '/mesas', '/clientes', '/analytics', '/configuracion'];
  return appRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
}

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
  console.log('🔔 PWA: Push notification recibida');
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación de La-IA',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver en La-IA',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('La-IA Restaurant', options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 PWA: Click en notificación');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

console.log('🚀 PWA: Service Worker de La-IA cargado correctamente');
