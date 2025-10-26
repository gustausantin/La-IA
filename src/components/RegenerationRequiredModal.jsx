import React from 'react';
import { AlertTriangle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * 🚨 MODAL BLOQUEANTE DE REGENERACIÓN OBLIGATORIA
 * 
 * Este modal aparece INMEDIATAMENTE cuando el usuario hace cambios
 * que requieren regenerar disponibilidades.
 * 
 * CARACTERÍSTICAS:
 * - ✋ Bloquea toda la pantalla
 * - 🚫 No se puede cerrar sin tomar acción
 * - 🎯 Botón directo "Regenerar Ahora" (lleva a Disponibilidades)
 * - ⚠️ Botón "Más Tarde" (con advertencia seria)
 */
const RegenerationRequiredModal = ({ 
    isOpen, 
    onClose, 
    changeReason,
    changeDetails 
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleRegenerateNow = () => {
        onClose();
        // Navegar a la página de disponibilidades
        navigate('/reservas', { 
            state: { 
                autoOpenAvailability: true,
                needsRegeneration: true,
                reason: changeReason 
            } 
        });
    };

    const handleLater = () => {
        // Confirmar que realmente quiere postergar
        const confirmed = window.confirm(
            '⚠️ ADVERTENCIA SERIA\n\n' +
            'Si no regeneras ahora:\n' +
            '• Los clientes verán horarios INCORRECTOS\n' +
            '• Pueden reservar en horarios que NO existen\n' +
            '• Pueden perder reservas en horarios cerrados\n\n' +
            '🚨 Esto puede causar PROBLEMAS GRAVES con tus clientes.\n\n' +
            '¿Estás SEGURO de que quieres hacerlo más tarde?'
        );

        if (confirmed) {
            onClose();
        }
    };

    const getReasonText = () => {
        switch(changeReason) {
            case 'table_created':
                return '🆕 Has CREADO una nueva mesa';
            case 'table_deleted':
                return '🗑️ Has ELIMINADO una mesa';
            case 'table_modified':
                return '✏️ Has MODIFICADO una mesa';
            case 'schedule_changed':
                return '📅 Has CAMBIADO el horario del restaurante';
            case 'special_event_created':
                return '🎉 Has CREADO un evento especial';
            case 'special_event_closed':
                return '❌ Has CERRADO un día';
            case 'policy_changed':
                return '⚙️ Has CAMBIADO la política de reservas';
            default:
                return '⚠️ Has hecho cambios en la configuración';
        }
    };

    return (
        <>
            {/* Overlay que bloquea todo */}
            <div 
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]"
                style={{ 
                    animation: 'fadeIn 0.2s ease-out',
                }}
            />
            
            {/* Modal centrado */}
            <div 
                className="fixed inset-0 z-[10000] flex items-center justify-center p-2"
                style={{
                    animation: 'slideIn 0.3s ease-out',
                }}
            >
                <div 
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border-4 border-red-500"
                    style={{
                        animation: 'pulse 2s ease-in-out infinite',
                    }}
                >
                    {/* Header - Rojo brillante */}
                    <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-xl">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2 rounded-full animate-bounce">
                                <AlertTriangle className="w-10 h-10 text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-white mb-1">
                                    🚨 REGENERACIÓN OBLIGATORIA
                                </h2>
                                <p className="text-red-100 font-medium">
                                    Acción requerida antes de continuar
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contenido */}
                    <div className="p-8">
                        {/* Razón del cambio */}
                        <div className="mb-6 p-2 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                            <p className="text-lg font-semibold text-gray-900 mb-2">
                                {getReasonText()}
                            </p>
                            {changeDetails && (
                                <p className="text-gray-700">
                                    {changeDetails}
                                </p>
                            )}
                        </div>

                        {/* Explicación del problema */}
                        <div className="mb-6 space-y-3">
                            <p className="text-gray-800 font-medium text-lg">
                                ⚠️ <strong>PROBLEMA:</strong>
                            </p>
                            <ul className="space-y-2 text-gray-700 ml-6">
                                <li className="flex items-start gap-2">
                                    <span className="text-red-600 font-bold">❌</span>
                                    <span>Las disponibilidades actuales <strong>NO reflejan</strong> este cambio</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-600 font-bold">❌</span>
                                    <span>Los clientes pueden ver horarios <strong>INCORRECTOS</strong></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-600 font-bold">❌</span>
                                    <span>Pueden reservar en horarios que <strong>NO EXISTEN</strong></span>
                                </li>
                            </ul>
                        </div>

                        {/* Solución */}
                        <div className="mb-6 p-2 bg-green-50 border-l-4 border-green-500 rounded">
                            <p className="text-gray-800 font-medium text-lg mb-2">
                                ✅ <strong>SOLUCIÓN:</strong>
                            </p>
                            <p className="text-gray-700">
                                Actualiza los horarios de reserva <strong>AHORA</strong> para que los cambios se reflejen correctamente en el calendario de reservas.
                            </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex flex-col gap-3">
                            {/* Botón principal - REGENERAR AHORA */}
                            <button
                                onClick={handleRegenerateNow}
                                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-5 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3"
                                style={{
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }}
                            >
                                <RefreshCw className="w-6 h-6" />
                                ACTUALIZAR HORARIOS DE RESERVA AHORA
                                <ArrowRight className="w-6 h-6" />
                            </button>

                            {/* Botón secundario - Más tarde */}
                            <button
                                onClick={handleLater}
                                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                Hacerlo más tarde
                                <span className="text-xs text-red-600">(⚠️ No recomendado)</span>
                            </button>
                        </div>

                        {/* Advertencia final */}
                        <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800 text-center">
                                <strong>⏰ IMPORTANTE:</strong> Hasta que actualices, tus clientes verán horarios incorrectos
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estilos de animación */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { 
                        opacity: 0;
                        transform: scale(0.9) translateY(-20px);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @keyframes pulse {
                    0%, 100% { 
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
                    }
                    50% { 
                        transform: scale(1.02);
                        box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                    }
                }
            `}</style>
        </>
    );
};

export default RegenerationRequiredModal;
