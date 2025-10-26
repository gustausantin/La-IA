
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { Bot, RefreshCw, AlertCircle } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const {
    isReady,
    isAuthenticated,
    user,
    loading
  } = useAuthContext();

  // Show loading while initializing
  if (!isReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Bot className="w-12 h-12 text-purple-600 mr-2" />
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-700">
            Cargando La-IA...
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Tu asistente IA está preparando todo
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;
