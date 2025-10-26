import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDeleteModal = ({ isOpen, reservation, onConfirm, onCancel }) => {
    if (!isOpen || !reservation) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                {/* HEADER */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 rounded-full">
                        <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                        ⚠️ ELIMINAR RESERVA
                    </h2>
                </div>

                {/* DESCRIPCIÓN */}
                <div className="mb-6 space-y-4">
                    <p className="text-gray-700 font-medium">
                        Esta reserva se <strong>eliminará permanentemente</strong> y no podrá recuperarse.
                    </p>
                    
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-900">
                            ✓ El horario quedará libre para nuevas reservas
                        </p>
                    </div>

                    {/* DETALLES DE LA RESERVA */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3">
                            📋 Reserva a eliminar:
                        </p>
                        <ul className="text-sm space-y-1.5 text-gray-700">
                            <li>
                                <strong>Cliente:</strong> {reservation.customer_name}
                            </li>
                            <li>
                                <strong>Fecha:</strong> {new Date(reservation.reservation_date).toLocaleDateString('es-ES', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </li>
                            <li>
                                <strong>Hora:</strong> {reservation.reservation_time?.slice(0, 5) || 'N/A'}
                            </li>
                            <li>
                                <strong>Personas:</strong> {reservation.party_size}
                            </li>
                            {reservation.tables?.name && (
                                <li>
                                    <strong>Mesa:</strong> {reservation.tables.name}
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* BOTONES */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(reservation)}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-lg"
                    >
                        SÍ, ELIMINAR
                    </button>
                </div>
            </div>
        </div>
    );
};

