// QuickActionModal.jsx - Modal Contextual para Acciones Rápidas en Celdas del Calendario
import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    X,
    Calendar,
    Lock,
    Unlock,
    Edit2,
    Trash2,
    Phone,
    MessageSquare,
    Clock,
    User,
    FileText,
    Save,
    UserPlus,
    UserX
} from 'lucide-react';

/**
 * Modal que aparece al hacer click en una celda del calendario
 * Muestra acciones contextuales según el estado de la celda
 */
export default function QuickActionModal({ 
    isOpen,
    onClose,
    cellData, // { resource, date, time, reservation, blockage }
    onAction // Callback para ejecutar acciones
}) {
    const [blockReason, setBlockReason] = useState('');
    const [showBlockForm, setShowBlockForm] = useState(false);

    if (!isOpen || !cellData) return null;

    const { resource, date, time, reservation, blockage } = cellData;

    // Formatear la información de la celda
    const formattedDate = format(new Date(date), "EEEE d 'de' MMMM", { locale: es });
    const formattedTime = time;

    // 🎯 ACCIONES DISPONIBLES SEGÚN EL TIPO DE CELDA
    const getActions = () => {
        // Si hay una reserva existente
        if (reservation) {
            return [
                {
                    id: 'view',
                    icon: <FileText className="w-5 h-5" />,
                    label: 'Ver Detalles',
                    color: 'text-blue-600',
                    bgHover: 'hover:bg-blue-50',
                    action: () => onAction('view', { reservation })
                },
                {
                    id: 'edit',
                    icon: <Edit2 className="w-5 h-5" />,
                    label: 'Editar Reserva',
                    color: 'text-purple-600',
                    bgHover: 'hover:bg-purple-50',
                    action: () => onAction('edit', { reservation })
                },
                {
                    id: 'contact',
                    icon: <Phone className="w-5 h-5" />,
                    label: 'Contactar Cliente',
                    color: 'text-green-600',
                    bgHover: 'hover:bg-green-50',
                    action: () => onAction('contact', { reservation })
                },
                {
                    id: 'cancel',
                    icon: <Trash2 className="w-5 h-5" />,
                    label: 'Cancelar Reserva',
                    color: 'text-red-600',
                    bgHover: 'hover:bg-red-50',
                    action: () => onAction('cancel', { reservation })
                }
            ];
        }

        // Si hay un bloqueo existente
        if (blockage) {
            return [
                {
                    id: 'view_block',
                    icon: <FileText className="w-5 h-5" />,
                    label: 'Ver Bloqueo',
                    color: 'text-gray-600',
                    bgHover: 'hover:bg-gray-50',
                    action: () => onAction('view_block', { blockage })
                },
                {
                    id: 'edit_block',
                    icon: <Edit2 className="w-5 h-5" />,
                    label: 'Editar Motivo',
                    color: 'text-purple-600',
                    bgHover: 'hover:bg-purple-50',
                    action: () => onAction('edit_block', { blockage })
                },
                {
                    id: 'remove_block',
                    icon: <Unlock className="w-5 h-5" />,
                    label: 'Quitar Bloqueo',
                    color: 'text-green-600',
                    bgHover: 'hover:bg-green-50',
                    action: () => onAction('remove_block', { blockage })
                }
            ];
        }

        // Celda vacía - permitir crear reserva, bloquear, ausencia o lista de espera
        return [
            {
                id: 'new_reservation',
                icon: <Calendar className="w-5 h-5" />,
                label: 'Nueva Reserva',
                color: 'text-blue-600',
                bgHover: 'hover:bg-blue-50',
                action: () => onAction('new_reservation', { resource, date, time })
            },
            {
                id: 'add_to_waitlist',
                icon: <UserPlus className="w-5 h-5" />,
                label: 'Lista de Espera',
                color: 'text-purple-600',
                bgHover: 'hover:bg-purple-50',
                action: () => onAction('add_to_waitlist', { resource, date, time })
            },
            {
                id: 'block_slot',
                icon: <Lock className="w-5 h-5" />,
                label: 'Bloquear Hora',
                color: 'text-orange-600',
                bgHover: 'hover:bg-orange-50',
                action: () => setShowBlockForm(true)
            },
            {
                id: 'add_absence',
                icon: <UserX className="w-5 h-5" />,
                label: 'Añadir Ausencia',
                color: 'text-red-600',
                bgHover: 'hover:bg-red-50',
                action: () => onAction('add_absence', { resource, date, time })
            }
        ];
    };

    const actions = getActions();

    // Manejar el bloqueo con motivo
    const handleBlockWithReason = () => {
        onAction('block_slot', { 
            resource, 
            date, 
            time, 
            reason: blockReason || 'Sin especificar'
        });
        setShowBlockForm(false);
        setBlockReason('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div 
                    className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="text-xl font-bold mb-2">
                                    {resource?.name || 'Recurso'}
                                </h3>
                                <div className="flex items-center gap-2 text-blue-100 text-sm">
                                    <Clock className="w-4 h-4" />
                                    <span>{formattedDate}</span>
                                </div>
                                <div className="flex items-center gap-2 text-blue-100 text-sm mt-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formattedTime}</span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Info de reserva/bloqueo si existe */}
                        {reservation && (
                            <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-white">
                                    <User className="w-4 h-4" />
                                    <span className="font-medium">{reservation.customer_name}</span>
                                </div>
                                {reservation.service_name && (
                                    <div className="text-blue-100 text-sm mt-1">
                                        {reservation.service_name}
                                    </div>
                                )}
                            </div>
                        )}

                        {blockage && (
                            <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-white">
                                    <Lock className="w-4 h-4" />
                                    <span className="font-medium">Bloqueado</span>
                                </div>
                                {blockage.reason && (
                                    <div className="text-blue-100 text-sm mt-1">
                                        {blockage.reason}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Body - Acciones */}
                    <div className="p-6">
                        {!showBlockForm ? (
                            <div className="space-y-2">
                                {actions.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => {
                                            action.action();
                                            if (action.id !== 'block_slot') {
                                                onClose();
                                            }
                                        }}
                                        className={`w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 transition-all ${action.bgHover} group`}
                                    >
                                        <div className={`${action.color} group-hover:scale-110 transition-transform`}>
                                            {action.icon}
                                        </div>
                                        <span className="font-medium text-gray-900 text-left flex-1">
                                            {action.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // Formulario de bloqueo
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Motivo del bloqueo (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={blockReason}
                                        onChange={(e) => setBlockReason(e.target.value)}
                                        placeholder="Ej: Médico, Descanso, etc."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowBlockForm(false);
                                            setBlockReason('');
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleBlockWithReason}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Bloquear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


