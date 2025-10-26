
import { useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { RefreshCw, LogOut, X, AlertTriangle } from 'lucide-react';

export default function EmergencyActions() {
  const [showModal, setShowModal] = useState(false);
  const { restartApp, forceLogout } = useAuthContext();

  // Detectar combinación de teclas Ctrl+Shift+R para mostrar acciones de emergencia
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        setShowModal(true);
      }
      
      // ESC para cerrar
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Acciones de Emergencia
            </h3>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Usa estas acciones si la aplicación no responde correctamente.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              setShowModal(false);
              restartApp();
            }}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reiniciar Aplicación Completa</span>
          </button>

          <button
            onClick={() => {
              setShowModal(false);
              forceLogout();
            }}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesión Forzado</span>
          </button>

          <button
            onClick={() => setShowModal(false)}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Presiona Ctrl+Shift+R para abrir este panel
        </div>
      </div>
    </div>
  );
}
