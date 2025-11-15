import React from 'react';
import { X, Shield, Calendar, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * 🛡️ MODAL INFORMATIVO (NO BLOQUEANTE) - Días Protegidos por Reservas
 * 
 * Muestra información sobre días que fueron protegidos durante la regeneración
 * porque tienen reservas activas.
 */
const ProtectedReservationsInfoModal = ({ 
    isOpen, 
    onClose, 
    protectedReservations = [] // Array de { date, customer_name, appointment_time, resource_name }
}) => {
    if (!isOpen || !protectedReservations || protectedReservations.length === 0) return null;

    // Agrupar por fecha
    const groupedByDate = protectedReservations.reduce((acc, reservation) => {
        const date = reservation.appointment_date || reservation.date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(reservation);
        return acc;
    }, {});

    return (
        <>
            {/* Overlay semi-transparente (NO bloquea, solo oscurece) */}
            <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
                onClick={onClose} // Cerrar al hacer click fuera
                style={{ 
                    animation: 'fadeIn 0.2s ease-out',
                }}
            />
            
            {/* Modal centrado - NO bloqueante */}
            <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                style={{
                    animation: 'slideIn 0.3s ease-out',
                }}
                onClick={(e) => {
                    // Cerrar si se hace click en el contenedor (no en el modal)
                    if (e.target === e.currentTarget) {
                        onClose();
                    }
                }}
            >
                <div 
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border-2 border-blue-300 max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()} // Prevenir cierre al hacer click dentro
                >
                    {/* Header - Azul informativo */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-5 rounded-t-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-full">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">
                                        🛡️ Días Protegidos por Reservas
                                    </h2>
                                    <p className="text-blue-100 text-sm">
                                        {protectedReservations.length} reserva(s) activa(s) protegida(s)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Contenido */}
                    <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                        {/* Mensaje informativo */}
                        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                            <p className="text-sm text-gray-700">
                                <strong>ℹ️ Información:</strong> Durante la actualización de disponibilidad, 
                                estos días fueron <strong>protegidos</strong> porque tienen reservas activas. 
                                Los horarios de estos días no se modificaron para preservar las reservas existentes.
                            </p>
                        </div>

                        {/* Lista de días protegidos */}
                        <div className="space-y-4">
                            {Object.entries(groupedByDate)
                                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                                .map(([date, reservations]) => (
                                    <div 
                                        key={date} 
                                        className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                                    >
                                        {/* Fecha */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <Calendar className="w-5 h-5 text-blue-600" />
                                            <h3 className="font-bold text-gray-900">
                                                {format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: es })}
                                            </h3>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                {reservations.length} reserva(s)
                                            </span>
                                        </div>

                                        {/* Reservas de ese día */}
                                        <div className="space-y-2 ml-7">
                                            {reservations.map((reservation, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                                                >
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <User className="w-4 h-4 text-gray-500" />
                                                        <div>
                                                            <p className="font-medium text-gray-900">
                                                                {reservation.customer_name || 'Cliente'}
                                                            </p>
                                                            {reservation.resource_name && (
                                                                <p className="text-xs text-gray-500">
                                                                    {reservation.resource_name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {reservation.appointment_time && (
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Clock className="w-4 h-4" />
                                                            {reservation.appointment_time}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* Nota final */}
                        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-800">
                                <strong>💡 Nota:</strong> Si necesitas modificar o cancelar estas reservas, 
                                puedes hacerlo manualmente desde la sección de Reservas.
                            </p>
                        </div>
                    </div>

                    {/* Footer con botón de cierre */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>

            {/* Estilos de animación */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { 
                        opacity: 0;
                        transform: scale(0.95) translateY(-10px);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </>
    );
};

export default ProtectedReservationsInfoModal;

