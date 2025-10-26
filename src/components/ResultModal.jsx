import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Trash2, Calendar, Shield, Clock, X } from 'lucide-react';

/**
 * Modal Unificado para Mostrar Resultados de Disponibilidades
 * Terminología: DÍAS y RESERVAS (no slots)
 */
const ResultModal = ({ 
    isOpen, 
    onClose, 
    type = 'delete', // 'delete' | 'regenerate'
    result = {}
}) => {
    if (!isOpen) return null;

    const {
        totalDays = 0,
        daysProtected = 0,
        daysAvailable = 0, // Para borrado: días eliminados | Para regeneración: días regenerados
        activeReservations = 0,
        period = '',
        duration = ''
    } = result;

    const config = {
        delete: {
            icon: Trash2,
            iconColor: 'text-white',
            iconBg: 'bg-red-600',
            title: '🗑️ Borrado Completado',
            subtitle: 'Las disponibilidades se han eliminado',
            gradient: 'from-red-500 to-red-600'
        },
        regenerate: {
            icon: Calendar,
            iconColor: 'text-green-600',
            iconBg: 'bg-green-100',
            title: '✅ Regeneración Completada',
            subtitle: 'Las disponibilidades se han actualizado correctamente',
            gradient: 'from-green-50 to-green-100'
        }
    };

    const currentConfig = config[type];
    const Icon = currentConfig.icon;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="bg-white rounded-xl max-w-xl w-full shadow-2xl overflow-hidden"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header con ícono de éxito */}
                    <div className={`bg-gradient-to-r ${currentConfig.gradient} px-6 py-6`}>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                                <div className={`p-3 rounded-xl ${currentConfig.iconBg} shadow-lg`}>
                                    <Icon className={`w-8 h-8 ${currentConfig.iconColor}`} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        {currentConfig.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {currentConfig.subtitle}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Estadísticas principales */}
                    <div className="px-6 py-6">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {/* Total días */}
                            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                                <div className="text-3xl font-bold text-blue-600 mb-1">
                                    {totalDays}
                                </div>
                                <div className="text-xs font-medium text-blue-900">
                                    Días Total
                                </div>
                            </div>

                            {/* Días protegidos */}
                            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                                <div className="text-3xl font-bold text-green-600 mb-1">
                                    {daysProtected}
                                </div>
                                <div className="text-xs font-medium text-green-900">
                                    Días Protegidos
                                </div>
                            </div>

                            {/* Días eliminados/regenerados */}
                            <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                                <div className="text-3xl font-bold text-purple-600 mb-1">
                                    {daysAvailable}
                                </div>
                                <div className="text-xs font-medium text-purple-900">
                                    {type === 'delete' ? 'Días Eliminados' : 'Días Regenerados'}
                                </div>
                            </div>
                        </div>

                        {/* Detalle de la operación */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex items-center space-x-2 mb-3">
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                                <h4 className="font-semibold text-gray-900">
                                    📊 Detalle de la operación:
                                </h4>
                            </div>
                            <div className="space-y-2 text-sm text-gray-700">
                                <p>
                                    <span className="font-medium">Total de días en el período:</span>{' '}
                                    {totalDays} días
                                </p>
                                <p>
                                    <span className="font-medium">Días protegidos:</span>{' '}
                                    {daysProtected} días con reservas activas se mantuvieron intactos
                                </p>
                                <p>
                                    <span className="font-medium">{type === 'delete' ? 'Días eliminados:' : 'Días regenerados:'}</span>{' '}
                                    {daysAvailable} días {type === 'delete' ? 'tuvieron sus horarios eliminados' : 'fueron actualizados con nuevos horarios'}
                                </p>
                                {activeReservations > 0 && (
                                    <p>
                                        <span className="font-medium">Reservas activas:</span>{' '}
                                        {activeReservations} reservas (cualquier status) están 100% protegidas
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Protección de reservas */}
                        {daysProtected > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                <div className="flex items-start space-x-3">
                                    <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-green-900 mb-1">
                                            🛡️ Días con reservas protegidos:
                                        </p>
                                        <p className="text-sm text-green-700">
                                            Los {daysProtected} días con reservas (cualquier status) mantienen sus horarios 
                                            originales y NO fueron modificados. Las reservas están 100% protegidas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Configuración aplicada */}
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-purple-900 mb-2">
                                        ⚙️ Configuración aplicada:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-purple-700 font-medium">Período:</span>
                                            <div className="text-purple-900">{period}</div>
                                        </div>
                                        <div>
                                            <span className="text-purple-700 font-medium">Duración:</span>
                                            <div className="text-purple-900">{duration}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-md"
                        >
                            ✓ Perfecto, entendido
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ResultModal;

