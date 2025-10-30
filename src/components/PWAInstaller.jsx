import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

/**
 * Componente PWA Installer
 * Maneja la instalación y registro del Service Worker
 */
const PWAInstaller = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Registrar Service Worker
    registerServiceWorker();
    
    // Detectar evento de instalación PWA
    const handleBeforeInstallPrompt = (e) => {
      console.log('📱 PWA: Evento beforeinstallprompt detectado');
      // NO llamar e.preventDefault() inmediatamente para evitar warning
      // Solo prevenir si vamos a usar el prompt
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Detectar cuando la app se instala
    const handleAppInstalled = () => {
      console.log('✅ PWA: App instalada exitosamente');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      
      toast.success('¡La-IA instalada exitosamente! 🎉', {
        duration: 4000,
        position: 'bottom-center'
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Registrar Service Worker
  const registerServiceWorker = async () => {
    // 🔥 NO registrar Service Worker en desarrollo (localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('⚠️ PWA: Service Worker deshabilitado en modo desarrollo');
      return;
    }
    
    if ('serviceWorker' in navigator) {
      try {
        console.log('🔧 PWA: Registrando Service Worker...');
        
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        setSwRegistration(registration);
        console.log('✅ PWA: Service Worker registrado:', registration.scope);

        // Detectar actualizaciones
        registration.addEventListener('updatefound', () => {
          console.log('🔄 PWA: Actualización disponible');
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('📦 PWA: Nueva versión disponible');
              setUpdateAvailable(true);
              
              toast((t) => (
                <div className="flex flex-col gap-2">
                  <div className="font-semibold">¡Nueva versión disponible! 🆕</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        window.location.reload();
                        toast.dismiss(t.id);
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                    >
                      Actualizar
                    </button>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
                    >
                      Después
                    </button>
                  </div>
                </div>
              ), {
                duration: 8000,
                position: 'bottom-center'
              });
            }
          });
        });

        // Mensaje de instalación exitosa
        if (registration.active) {
          console.log('🚀 PWA: Service Worker activo y funcionando');
        }

      } catch (error) {
        console.error('❌ PWA: Error registrando Service Worker:', error);
      }
    } else {
      console.warn('⚠️ PWA: Service Workers no soportados en este navegador');
    }
  };

  // Instalar PWA
  const installPWA = async () => {
    if (!deferredPrompt) {
      console.log('❌ PWA: No hay prompt de instalación disponible');
      return;
    }

    try {
      console.log('📱 PWA: Mostrando prompt de instalación...');
      
      // Prevenir comportamiento por defecto y mostrar prompt
      deferredPrompt.preventDefault();
      deferredPrompt.prompt();
      
      // Esperar respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('👤 PWA: Respuesta del usuario:', outcome);
      
      if (outcome === 'accepted') {
        console.log('✅ PWA: Usuario aceptó instalar');
        toast.success('¡Instalando La-IA...! 📱');
      } else {
        console.log('❌ PWA: Usuario rechazó instalar');
        toast('Puedes instalar La-IA más tarde desde el menú del navegador', {
          icon: '💡',
          duration: 4000
        });
      }
      
      // Limpiar prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      
    } catch (error) {
      console.error('❌ PWA: Error en instalación:', error);
      toast.error('Error al instalar la app');
    }
  };

  // Actualizar Service Worker
  const updateServiceWorker = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  // No renderizar nada visible (solo funcionalidad)
  return (
    <>
      {/* Banner de instalación PWA */}
      {isInstallable && (
        <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-2 rounded-lg shadow-lg z-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg">📱</div>
            <div>
              <div className="font-semibold">¡Instala La-IA!</div>
              <div className="text-sm opacity-90">Acceso rápido desde tu pantalla de inicio</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={installPWA}
              className="px-4 py-2 bg-white text-blue-600 rounded font-medium hover:bg-gray-100 transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={() => setIsInstallable(false)}
              className="px-3 py-2 text-white hover:bg-white/20 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Indicador de app instalada */}
      {isInstalled && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span className="font-medium">App instalada</span>
        </div>
      )}
    </>
  );
};

export default PWAInstaller;
