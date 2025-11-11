
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

// Lazy loading mejorado con preload y error boundaries
const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Confirm = lazy(() => import('./pages/Confirm'));
const Reservas = lazy(() => import('./pages/Reservas'));
const Clientes = lazy(() => import('./pages/Clientes'));
// const PlantillasCRM = lazy(() => import('./pages/PlantillasCRM')); // ❌ ARCHIVO NO EXISTE
// const Mesas = lazy(() => import('./pages/Mesas')); // ⚠️ DEPRECADO - Ahora en Configuración > Mi Negocio > Mis Recursos
const Calendario = lazy(() => import('./pages/Calendario'));
const Comunicacion = lazy(() => import('./pages/Comunicacion'));
// const Analytics = lazy(() => import('./pages/Analytics')); // Deshabilitado temporalmente
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Servicios = lazy(() => import('./pages/configuracion/Servicios'));
const CRMProximosMensajes = lazy(() => import('./pages/CRMProximosMensajes'));

// 🚀 CRM v2 - Nuevas páginas
const Consumos = lazy(() => import('./pages/Consumos'));
// const CRMv2 = lazy(() => import('./pages/CRMSimple')); // ❌ ARCHIVO NO EXISTE
const AvailabilityTester = lazy(() => import('./components/AvailabilityTester'));
const Equipo = lazy(() => import('./pages/Equipo'));
const TuEquipo = Equipo; // Alias para claridad

// 🛡️ Sistema de No-Shows SIMPLIFICADO (Versión 3.0)
const NoShowControl = lazy(() => import('./pages/NoShowsSimple'));

// 🤖 Dashboard del Agente IA
const DashboardAgente = lazy(() => import('./pages/DashboardAgente'));

// 🎯 Dashboard Nuevo - Feed de Acciones Mobile-First (Antiguo)
const DashboardNuevo = lazy(() => import('./pages/DashboardNuevo'));

// 💎 Dashboard VIVO - La Recepcionista IA (Nuevo con Avatar y Chat)
const Dashboard = lazy(() => import('./pages/Dashboard'));

// 🎯 Wizard de Onboarding para nuevos usuarios
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard'));

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

            <Route element={<Layout />}>
              {/* Ruta por defecto: si no tiene negocio → onboarding, si tiene → dashboard */}
              <Route index element={<Navigate to={business ? "/dashboard" : "/onboarding"} replace />} />

              {/* Dashboard principal - NUEVO VIVO */}
              <Route 
                path="/dashboard" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Dashboard />
                  </Suspense>
                } 
              />
              
              {/* Dashboard Agente (antiguo) */}
              <Route 
                path="/dashboard-agente" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <DashboardAgente />
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
              {/* ❌ RUTA DESHABILITADA - ARCHIVO NO EXISTE
              <Route 
                path="/crm-inteligente" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <CRMv2 />
                  </Suspense>
                } 
              />
              */}
              <Route 
                path="/consumos" 
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Consumos />
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
              
              <Route 
                path="/plantillas" 
                element={<Navigate to="/crm-inteligente" state={{ autoOpenPlantillas: true }} replace />}
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

            {/* Redirigir cualquier ruta no válida al dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
