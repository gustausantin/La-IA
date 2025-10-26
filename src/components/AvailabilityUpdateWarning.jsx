// AvailabilityUpdateWarning.jsx - Componente para avisar sobre actualizaciones de disponibilidad
import React from 'react';
import { AlertTriangle, Calendar, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AvailabilityUpdateWarning = ({ 
    show = false, 
    onDismiss = () => {}, 
    onUpdateAvailability = null,
    message = "Los cambios en las mesas requieren actualizar las disponibilidades"
}) => {
    const navigate = useNavigate();

    if (!show) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-2 shadow-lg max-w-md z-50">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                    <div className="font-medium text-yellow-900 mb-1">
                        ⚠️ Actualización Requerida
                    </div>
                    <div className="text-sm text-yellow-800 mb-3">
                        {message}
                    </div>
                    
                    <div className="flex gap-2">
                        {onUpdateAvailability ? (
                            <button
                                onClick={onUpdateAvailability}
                                className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Actualizar Ahora
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/reservas')}
                                className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                            >
                                <Calendar className="w-3 h-3" />
                                Ir a Disponibilidades
                            </button>
                        )}
                        
                        <button
                            onClick={onDismiss}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                        >
                            Más tarde
                        </button>
                    </div>
                </div>
                
                <button
                    onClick={onDismiss}
                    className="text-gray-400 hover:text-gray-600"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

export default AvailabilityUpdateWarning;
