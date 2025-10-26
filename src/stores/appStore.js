import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { log } from '../utils/logger.js';

// Store principal de la aplicación
export const useAppStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === ESTADO GENERAL ===
        isLoading: false,
        error: null,
        theme: 'light',
        language: 'es',
        sidebarCollapsed: false,
        
        // === CONFIGURACIÓN UI ===
        accessibility: {
          reducedMotion: false,
          highContrast: false,
          largeText: false,
          screenReaderOptimized: false,
        },
        
        // === ESTADO DE CONECTIVIDAD ===
        isOnline: navigator.onLine,
        lastSync: null,
        
        // === ACCIONES GENERALES ===
        setLoading: (loading) => {
          log.debug(`🔄 App loading state: ${loading}`);
          set({ isLoading: loading });
        },
        
        setError: (error) => {
          log.error('❌ App error:', error);
          set({ error });
        },
        
        clearError: () => {
          set({ error: null });
        },
        
        // === ACCIONES DE TEMA ===
        setTheme: (theme) => {
          log.info(`🎨 Theme changed to: ${theme}`);
          set({ theme });
          
          // Aplicar tema al DOM
          document.documentElement.setAttribute('data-theme', theme);
        },
        
        toggleTheme: () => {
          const { theme } = get();
          const newTheme = theme === 'light' ? 'dark' : 'light';
          get().setTheme(newTheme);
        },
        
        // === ACCIONES DE IDIOMA ===
        setLanguage: (language) => {
          log.info(`🌍 Language changed to: ${language}`);
          set({ language });
          
          // Aplicar idioma al DOM
          document.documentElement.setAttribute('lang', language);
        },
        
        // === ACCIONES DE UI ===
        toggleSidebar: () => {
          const { sidebarCollapsed } = get();
          set({ sidebarCollapsed: !sidebarCollapsed });
        },
        
        setSidebarCollapsed: (collapsed) => {
          set({ sidebarCollapsed: collapsed });
        },
        
        // === ACCIONES DE ACCESIBILIDAD ===
        updateAccessibility: (setting, value) => {
          log.info(`♿ Accessibility setting ${setting}: ${value}`);
          set((state) => ({
            accessibility: {
              ...state.accessibility,
              [setting]: value,
            },
          }));
          
          // Aplicar configuración al DOM
          const root = document.documentElement;
          root.classList.toggle(`accessibility-${setting}`, value);
        },
        
        // === ACCIONES DE CONECTIVIDAD ===
        setOnline: (online) => {
          set({ isOnline: online });
          if (online) {
            log.info('🌐 App back online');
            get().sync();
          } else {
            log.warn('📱 App offline');
          }
        },
        
        sync: async () => {
          try {
            log.info('🔄 Starting app sync...');
            set({ lastSync: new Date().toISOString() });
            
            // Sincronizar datos críticos
            // TODO: Implementar lógica de sincronización
            
            log.info('✅ App sync completed');
          } catch (error) {
            log.error('❌ App sync failed:', error);
            get().setError('Error de sincronización');
          }
        },
        
        // === UTILIDADES ===
        reset: () => {
          log.info('🔄 Resetting app state');
          set({
            isLoading: false,
            error: null,
            sidebarCollapsed: false,
          });
        },
        
        // === MÉTRICAS Y ANALYTICS ===
        trackEvent: (event, data = {}) => {
          log.info(`📊 Event tracked: ${event}`, data);
          
          // TODO: Integrar con sistema de analytics
          try {
            // Enviar evento a analytics
            if (window.gtag) {
              window.gtag('event', event, data);
            }
          } catch (error) {
            log.error('❌ Failed to track event:', error);
          }
        },
        
        // === GESTIÓN DE PERFORMANCE ===
        performance: {
          pageLoadTime: null,
          apiResponseTimes: {},
          renderTime: null,
        },
        
        updatePerformance: (metric, value) => {
          set((state) => ({
            performance: {
              ...state.performance,
              [metric]: value,
            },
          }));
        },
        
        recordApiResponse: (endpoint, time) => {
          set((state) => ({
            performance: {
              ...state.performance,
              apiResponseTimes: {
                ...state.performance.apiResponseTimes,
                [endpoint]: time,
              },
            },
          }));
        },
      }),
      {
        name: 'la-ia-app-store',
        partialize: (state) => ({
          theme: state.theme,
          language: state.language,
          sidebarCollapsed: state.sidebarCollapsed,
          accessibility: state.accessibility,
        }),
      }
    ),
    {
      name: 'AppStore',
    }
  )
);

// Listener para eventos de conectividad
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnline(true);
  });
  
  window.addEventListener('offline', () => {
    useAppStore.getState().setOnline(false);
  });
}
