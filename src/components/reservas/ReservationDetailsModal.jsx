// ======================================================================
// MODAL DE DETALLES DE RESERVA - SOLO LECTURA
// ======================================================================
// Modal profesional para ver el resumen completo de una reserva
// ======================================================================

import React from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  UtensilsCrossed,
  Tag,
  User
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Modal de detalles de reserva (solo lectura con opción de editar)
 */
export const ReservationDetailsModal = ({ reservation, onClose, onEdit, isOpen }) => {
  if (!isOpen || !reservation) return null;

  // Formatear fecha
  const formattedDate = reservation.reservation_date 
    ? format(parseISO(reservation.reservation_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
    : 'N/A';

  // Estado de la reserva
  const statusConfig = {
    confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-300' },
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-300' },
    completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    no_show: { label: 'No Show', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  };

  const status = statusConfig[reservation.status] || statusConfig.confirmed;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">Detalles de la Reserva</h2>
              <p className="text-blue-100 text-xs font-mono">
                ID: {reservation.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">

            {/* Estado */}
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Estado de la Reserva</h3>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${status.color}`}>
                {status.label}
              </span>
            </div>

            {/* Información del Cliente */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Información del Cliente
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Nombre</p>
                    <p className="font-semibold text-gray-900">{reservation.customer_name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Teléfono</p>
                    <p className="font-semibold text-gray-900">{reservation.customer_phone || 'N/A'}</p>
                  </div>
                </div>
                {reservation.customer_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold text-gray-900">{reservation.customer_email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de la Reserva */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Detalles de la Reserva
              </h3>
              <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold text-gray-900">{formattedDate}</p>
                  </div>
                </div>
                
                {/* Servicio */}
                {reservation.service_name && (
                  <div className="flex items-center gap-3">
                    <Tag className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Servicio</p>
                      <p className="font-semibold text-gray-900">{reservation.service_name}</p>
                    </div>
                  </div>
                )}
                
                {/* Profesional/Empleado */}
                {reservation.resource_name && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Profesional</p>
                      <p className="font-semibold text-gray-900">{reservation.resource_name}</p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Hora Inicio</p>
                      <p className="font-semibold text-gray-900">{reservation.reservation_time?.substring(0, 5) || reservation.appointment_time?.substring(0, 5) || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Hora Fin</p>
                      <p className="font-semibold text-gray-900">
                        {(() => {
                          const startTime = reservation.reservation_time || reservation.appointment_time;
                          const duration = reservation.duration_minutes || reservation.service_duration_minutes || 60;
                          if (!startTime) return 'N/A';
                          
                          const [hours, minutes] = startTime.split(':').map(Number);
                          const endMinutes = hours * 60 + minutes + duration;
                          const endHours = Math.floor(endMinutes / 60);
                          const endMins = endMinutes % 60;
                          return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Duración */}
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Duración</p>
                    <p className="font-semibold text-gray-900">{reservation.duration_minutes || reservation.service_duration_minutes || 60} minutos</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Peticiones Especiales */}
            {reservation.special_requests && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                  Peticiones Especiales
                </h3>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-gray-900">{reservation.special_requests}</p>
                </div>
              </div>
            )}

            {/* Información Adicional */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-gray-600" />
                Información Adicional
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Canal</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {reservation.channel === 'whatsapp' ? 'WhatsApp' :
                     reservation.channel === 'web' ? 'Web' :
                     reservation.channel === 'instagram' ? 'Instagram' :
                     reservation.channel === 'facebook' ? 'Facebook' :
                     reservation.channel === 'phone' ? 'Llamada' :
                     reservation.channel === 'vapi' ? 'Llamada' :
                     reservation.channel || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Creada el</span>
                  <span className="font-semibold text-gray-900">
                    {reservation.created_at 
                      ? format(parseISO(reservation.created_at), "dd/MM/yyyy HH:mm", { locale: es })
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Cerrar
          </button>
          {onEdit && (
            <button
              onClick={() => {
                onEdit(reservation);
                onClose();
              }}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-colors font-medium shadow-md"
            >
              Editar Reserva
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReservationDetailsModal;
