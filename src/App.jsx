
// App.jsx - Aplicación principal mejorada para La-IA

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { Bot, RefreshCw } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import PWAInstaller from './components/PWAInstaller';
import logger from './utils/logger';

// Debug logging
logger.info('Starting React application...');

// Función helper para lazy loading con manejo de errores y reintentos
const lazyWithRetry = (componentImport, retries = 3, delay = 1000) => {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptImport = (attemptNumber) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            // Si es un error de red o conexión, intentar reintentar
            if (
              (error.message?.includes('Failed to fetch') || 
               error.message?.includes('ERR_CONNECTION_REFUSED') ||
               error.message?.includes('dynamically imported module')) &&
              attemptNumber < retries
            ) {
              logger.warn(`Reintentando carga de módulo (intento ${attemptNumber + 1}/${retries})...`);
              setTimeout(() => attemptImport(attemptNumber + 1), delay * attemptNumber);
            } else {
              logger.error('Error al cargar módulo dinámico:', error);
              reject(error);
            }
          });
      };
      attemptImport(0);
    });
  });
};

// Lazy loading mejorado con preload y error boundaries
const Layout = lazyWithRetry(() => import('./components/Layout'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Confirm = lazyWithRetry(() => import('./pages/Confirm'));
const GoogleOAuthCallback = lazyWithRetry(() => import('./pages/GoogleOAuthCallback'));
const Reservas = lazyWithRetry(() => import('./pages/Reservas'));
const Clientes = lazyWithRetry(() => import('./pages/Clientes'));
// const PlantillasCRM = lazyWithRetry(() => import('./pages/PlantillasCRM')); // ❌ ARCHIVO NO EXISTE
const Calendario = lazyWithRetry(() => import('./pages/Calendario'));
const Comunicacion = lazyWithRetry(() => import('./pages/Comunicacion'));
// const Analytics = lazyWithRetry(() => import('./pages/Analytics')); // Deshabilitado temporalmente
const Configuracion = lazyWithRetry(() => import('./pages/Configuracion'));
const Servicios = lazyWithRetry(() => import('./pages/configuracion/Servicios'));
const CRMProximosMensajes = lazyWithRetry(() => import('./pages/CRMProximosMensajes'));

// 🚀 CRM v2 - Nuevas páginas
const Consumos = lazyWithRetry(() => import('./pages/Consumos'));
const AvailabilityTester = lazyWithRetry(() => import('./components/AvailabilityTester'));
const Disponibilidad = lazyWithRetry(() => import('./pages/Disponibilidad')); // ⚠️ TEMPORAL - Para verificar lógica y métricas
const Equipo = lazyWithRetry(() => import('./pages/Equipo'));
const TuEquipo = Equipo; // Alias para claridad

// 🛡️ Sistema de No-Shows SIMPLIFICADO (Versión 3.0)
const NoShowControl = lazyWithRetry(() => import('./pages/NoShowsSimple'));

// 💎 Dashboard VIVO - La Recepcionista IA (Nuevo con Avatar y Chat)
// const Dashboard = lazyWithRetry(() => import('./pages/Dashboard')); // Dashboard legacy

// 🧠 Dashboard "Socio Virtual" - El COO Inteligente
const Dashboard = lazyWithRetry(() => import('./pages/DashboardSocioVirtual'));

// 🎯 Wizard de Onboarding para nuevos usuarios
const OnboardingWizard = lazyWithRetry(() => import('./components/onboarding/OnboardingWizard'));

// Páginas de prueba eliminadas - funcionalidad migrada al Dashboard original

// Componente de carga mejorado
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
    <div className="text-center">
      <div className="flex items-center justify-center mb-4">
        <Bot className="w-12 h-12 text-purple-600 mr-2" />
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-700">
        Cargando La-IA...
      </h2>
      <p className="text-sm text-gray-500 mt-2">
        Tu asistente IA está preparando todo
      </p>
    </div>
  </div>
);

// Componente de fallback para Suspense
const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
      <p className="text-gray-600">Cargando página...</p>
    </div>
  </div>
);

// ✅ Componente para ruta por defecto - pero NO redirigir si viene de OAuth
const DefaultRouteRedirect = ({ business }) => {
  const location = useLocation();
  
  // ✅ CRÍTICO: Si viene de OAuth redirect, mantener en /configuracion
  if (location.search.includes('integration=google_calendar')) {
    console.log('🛡️ OAuth redirect detectado en ruta index - NO redirigir al dashboard, mantener en /configuracion');
    return <Navigate to={`/configuracion${location.search}`} replace />;
  }
  
  // Redirigir normalmente si NO viene de OAuth
  return <Navigate to={business ? "/dashboard" : "/onboarding"} replace />;
};

// ✅ Componente para redirigir - pero NO si viene de OAuth
const OAuthAwareRedirect = () => {
  const location = useLocation();
  
  // ✅ CRÍTICO: Si viene de OAuth redirect, mantener en /configuracion
  if (location.pathname === '/configuracion' || location.search.includes('integration=google_calendar')) {
    console.log('🛡️ OAuth redirect detectado - NO redirigir al dashboard, mantener en /configuracion');
    return <Navigate to={`/configuracion${location.search}`} replace />;
  }
  
  // Redirigir al dashboard solo si NO viene de OAuth
  return <Navigate to="/dashboard" replace />;
};

// Componente principal de contenido
function AppContent() {
  const { isReady, isAuthenticated, user, business, loadingBusiness } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Debug logging
  useEffect(() => {
    logger.debug('AppContent render', {
      isAuthenticated,
      isReady,
      hasUser: !!user,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, isReady, user]);

  // ✅ Redirección automática a onboarding si no tiene negocio
  useEffect(() => {
    // ⚠️ NO redirigir si aún estamos cargando el negocio
    if (loadingBusiness) {
      console.log('⏳ Esperando a que termine de cargar el negocio...');
      return;
    }
    
    // ✅ CRÍTICO: NO redirigir si estamos en /configuracion (puede venir de OAuth redirect)
    if (location.pathname === '/configuracion') {
      console.log('📍 En /configuracion - NO redirigir (puede venir de OAuth)');
      return;
    }
    
    if (isReady && isAuthenticated && user && !business && location.pathname !== '/onboarding') {
      console.log('🎯 Redirigiendo a onboarding (usuario sin negocio)');
      navigate('/onboarding', { replace: true });
    }
  }, [isReady, isAuthenticated, user, business, loadingBusiness, location.pathname, navigate]);

  // Mostrar pantalla de carga mientras se verifica la autenticación
  if (!isReady) {
    logger.warn('App not ready, showing loading...');
    return <LoadingScreen />;
  }

  logger.info('App ready, rendering router...');

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/confirm" element={<Confirm />} />
            {/* Callback de OAuth de Google (accesible sin autenticación para el redirect) */}
            <Route path="/oauth/google/callback" element={<GoogleOAuthCallback />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {/* Wizard de Onboarding (fuera del Layout, sin sidebar) */}
            <Route 
              path="/onboarding" 
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <OnboardingWizard />
                </Suspense>
              } 
            />

            {/* Callback de OAuth de Google (también accesible cuando está autenticado) */}
            <Route path="/oauth/google/callback" element={<GoogleOAuthCallback />} />

            <Route element={<Layout />}>
              {/* ✅ Ruta por defecto: si no tiene negocio → onboarding, si tiene → dashboard */}
              {/* ⚠️ PERO: NO redirigir si hay parámetros de OAuth en la URL */}
              <Route index element={<DefaultRouteRedirect business={business} />} />

              {/* Dashboard principal - ÚNICO dashboard vivo */}
              <Route 
                path="/dashboard" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Dashboard />
                  </Suspense>
                } 
              />
              <Route 
                path="/reservas" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Reservas />
                  </Suspense>
                } 
              />
              <Route 
                path="/no-shows" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <NoShowControl />
                  </Suspense>
                } 
              />
              <Route 
                path="/clientes" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Clientes />
                  </Suspense>
                } 
              />
              <Route 
                path="/consumos" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Consumos />
                  </Suspense>
                } 
              />
              {/* ⚠️ TEMPORAL - Página de Disponibilidad para verificar lógica y métricas */}
              <Route 
                path="/disponibilidad" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Disponibilidad />
                  </Suspense>
                } 
              />
              <Route 
                path="/availability-test" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <AvailabilityTester />
                  </Suspense>
                } 
              />
              
              {/* Tu Equipo - Gestión de Empleados */}
              <Route 
                path="/equipo" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <TuEquipo />
                  </Suspense>
                } 
              />
              
              {/* ⚠️ RUTA TEMPORAL: /plantillas → /clientes (PlantillasCRM se creará próximamente) */}
              <Route 
                path="/plantillas" 
                element={<Navigate to="/clientes" state={{ autoOpenPlantillas: true }} replace />}
              />
              {/* ⚠️ REDIRECT: /mesas → /configuracion (Gestión movida a Configuración) */}
              <Route 
                path="/mesas" 
                element={<Navigate to="/configuracion?tab=negocio" state={{ fromMesas: true }} replace />}
              />
              <Route 
                path="/calendario"
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Calendario />
                  </Suspense>
                } 
              />
              {/* Analytics deshabilitado temporalmente */}
              {/* <Route 
                path="/analytics" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Analytics />
                  </Suspense>
                } 
              /> */}
              <Route 
                path="/comunicacion" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Comunicacion />
                  </Suspense>
                } 
              />
              <Route 
                path="/configuracion" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Configuracion />
                  </Suspense>
                }
              />
              <Route 
                path="/configuracion/servicios" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Servicios />
                  </Suspense>
                }
              />
              <Route 
                path="/crm/mensajes" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <CRMProximosMensajes />
                  </Suspense>
                } 
              />
              
            </Route>

            {/* ✅ Redirigir cualquier ruta no válida al dashboard - PERO NO si viene de OAuth */}
            <Route path="*" element={<OAuthAwareRedirect />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
}

function App() {
  logger.info('App component rendering...');

  useEffect(() => {
    logger.info('React app rendered');
    
    // Cleanup en unmount
    return () => {
      logger.info('React application unmounting...');
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
        <ToastContainer />
        <PWAInstaller />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
