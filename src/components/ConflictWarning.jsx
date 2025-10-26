// =========================================
// CONFLICT WARNING COMPONENT
// Sistema de avisos de conflictos
// =========================================

import React, { useState } from 'react';
import { AlertTriangle, Clock, Users, Calendar, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ConflictWarning = ({ 
    conflicts, 
    onConfirm, 
    onCancel, 
    title = "⚠️ Conflictos Detectados",
    confirmText = "Continuar de todas formas",
    cancelText = "Cancelar cambios"
}) => {
    const [processing, setProcessing] = useState(false);

    if (!conflicts || !conflicts.hasConflicts) return null;

    const handleConfirm = async () => {
        setProcessing(true);
        try {
            await onConfirm();
        } finally {
            setProcessing(false);
        }
    };

    const getConflictIcon = (type) => {
        switch (type) {
            case 'DAY_CLOSED':
            case 'EVENT_CLOSURE_WITH_RESERVATIONS':
                return <Calendar className="w-5 h-5 text-red-500" />;
            case 'OUTSIDE_HOURS':
                return <Clock className="w-5 h-5 text-orange-500" />;
            case 'TABLE_DELETE_WITH_RESERVATIONS':
            case 'CAPACITY_TOO_SMALL':
            case 'TABLE_DEACTIVATE_WITH_RESERVATIONS':
                return <Users className="w-5 h-5 text-red-500" />;
            default:
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getConflictSeverity = (type) => {
        const critical = ['DAY_CLOSED', 'EVENT_CLOSURE_WITH_RESERVATIONS', 'TABLE_DELETE_WITH_RESERVATIONS'];
        const high = ['CAPACITY_TOO_SMALL', 'TABLE_DEACTIVATE_WITH_RESERVATIONS'];
        
        if (critical.includes(type)) return 'critical';
        if (high.includes(type)) return 'high';
        return 'medium';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">
                                {title}
                            </h2>
                            <p className="text-gray-600">
                                Se encontraron {conflicts.conflicts.length} conflictos que requieren atención
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Conflicts List */}
                <div className="p-6">
                    <div className="space-y-4">
                        {conflicts.conflicts.map((conflict, index) => (
                            <div
                                key={index}
                                className={`border rounded-lg p-2 ${
                                    getConflictSeverity(conflict.type) === 'critical'
                                        ? 'border-red-300 bg-red-50'
                                        : getConflictSeverity(conflict.type) === 'high'
                                        ? 'border-orange-300 bg-orange-50'
                                        : 'border-yellow-300 bg-yellow-50'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {getConflictIcon(conflict.type)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                getConflictSeverity(conflict.type) === 'critical'
                                                    ? 'bg-red-200 text-red-800'
                                                    : getConflictSeverity(conflict.type) === 'high'
                                                    ? 'bg-orange-200 text-orange-800'
                                                    : 'bg-yellow-200 text-yellow-800'
                                            }`}>
                                                {getConflictSeverity(conflict.type) === 'critical' ? 'CRÍTICO' :
                                                 getConflictSeverity(conflict.type) === 'high' ? 'ALTO' : 'MEDIO'}
                                            </span>
                                        </div>
                                        
                                        <p className="font-medium text-gray-900 mb-2">
                                            {conflict.reason}
                                        </p>

                                        {/* Reservas afectadas */}
                                        {conflict.affectedReservations && conflict.affectedReservations.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-sm font-medium text-gray-700 mb-2">
                                                    Reservas afectadas ({conflict.affectedReservations.length}):
                                                </p>
                                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                                    {conflict.affectedReservations.slice(0, 5).map((reservation, idx) => (
                                                        <div key={idx} className="text-sm bg-white p-2 rounded border">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-medium">{reservation.customer_name}</span>
                                                                <span className="text-gray-500">
                                                                    {reservation.party_size} personas
                                                                </span>
                                                            </div>
                                                            <div className="text-gray-600 mt-1">
                                                                📅 {format(new Date(reservation.reservation_date), 'dd/MM/yyyy', { locale: es })}
                                                                {' '}⏰ {reservation.reservation_time}
                                                                {reservation.tables && (
                                                                    <span className="ml-2">
                                                                        🪑 {reservation.tables.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {conflict.affectedReservations.length > 5 && (
                                                        <div className="text-sm text-gray-500 text-center py-1">
                                                            ... y {conflict.affectedReservations.length - 5} más
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Reserva individual */}
                                        {conflict.reservation && (
                                            <div className="mt-3 text-sm bg-white p-2 rounded border">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">{conflict.reservation.customer_name}</span>
                                                    <span className="text-gray-500">
                                                        {conflict.reservation.party_size} personas
                                                    </span>
                                                </div>
                                                <div className="text-gray-600 mt-1">
                                                    📅 {format(new Date(conflict.reservation.reservation_date), 'dd/MM/yyyy', { locale: es })}
                                                    {' '}⏰ {conflict.reservation.reservation_time}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Resumen */}
                    <div className="mt-6 p-2 bg-gray-50 rounded-lg">
                        <h3 className="font-medium text-gray-900 mb-2">📊 Resumen del impacto:</h3>
                        <ul className="text-sm text-gray-700 space-y-1">
                            <li>• Total de conflictos: <strong>{conflicts.conflicts.length}</strong></li>
                            <li>• Reservas afectadas: <strong>{conflicts.affectedReservations || 0}</strong></li>
                            <li>• Tipos de conflicto: <strong>{conflicts.conflictTypes?.join(', ') || 'Varios'}</strong></li>
                        </ul>
                    </div>

                    {/* Recomendaciones */}
                    <div className="mt-4 p-2 bg-blue-50 rounded-lg">
                        <h3 className="font-medium text-blue-900 mb-2">💡 Recomendaciones:</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Contacta a los clientes afectados antes de hacer el cambio</li>
                            <li>• Ofrece fechas/horarios alternativos</li>
                            <li>• Considera reprogramar el cambio para una fecha sin reservas</li>
                            <li>• Actualiza las disponibilidades después de confirmar</li>
                        </ul>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={processing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {processing ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-4 h-4" />
                                {confirmText}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConflictWarning;
