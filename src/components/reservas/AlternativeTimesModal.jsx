// ======================================================================
// MODAL DE HORARIOS ALTERNATIVOS - ENTERPRISE GRADE UX
// ======================================================================
// REGLA 1: Ajuste quirúrgico - mejora la UX sin degradar
// REGLA 2: Solo muestra datos REALES de availability_slots
// REGLA 3: Multi-tenant (todas las alternativas son del businessId)
// ======================================================================

import React from 'react';
import { X, Clock, Users, ChevronRight, Sparkles } from 'lucide-react';

/**
 * Modal profesional para mostrar horarios alternativos
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback al cerrar
 * @param {Function} props.onSelectTime - Callback al seleccionar una hora
 * @param {Array} props.alternatives - Array de alternativas con { time, displayTime, availableTables, label }
 * @param {string} props.date - Fecha seleccionada (para mostrar)
 * @param {number} props.partySize - Número de personas
 * @param {string} props.requestedTime - Hora solicitada originalmente
 */
export const AlternativeTimesModal = ({
  isOpen,
  onClose,
  onSelectTime,
  alternatives = [],
  date,
  partySize,
  requestedTime
}) => {
  if (!isOpen) return null;

  // Formatear fecha bonita
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Horarios Disponibles</h2>
              </div>
              <p className="text-purple-100 text-sm">
                No hay disponibilidad a las <span className="font-semibold">{requestedTime?.substring(0, 5)}</span>
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{formatDate(date)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{partySize} persona{partySize > 1 ? 's' : ''}</span>
                </div>
              </div>
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
          {alternatives.length === 0 ? (
            // Sin alternativas
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sin disponibilidad este día
              </h3>
              <p className="text-gray-600 text-sm">
                No hay mesas disponibles para {partySize} persona{partySize > 1 ? 's' : ''} en esta fecha.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Prueba con otra fecha o contacta directamente con el restaurante.
              </p>
            </div>
          ) : (
            // Con alternativas
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  💡 <span className="font-medium">¿Te va alguna de estas opciones?</span> Todas tienen mesas disponibles:
                </p>
              </div>

              <div className="space-y-2">
                {alternatives.map((alternative, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectTime(alternative)}
                    className="w-full flex items-center justify-between p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Hora */}
                      <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-xl font-bold text-lg group-hover:scale-105 transition-transform">
                        {alternative.displayTime}
                      </div>
                      
                      {/* Info */}
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 text-base">
                          {alternative.displayTime}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                          <Users className="w-4 h-4" />
                          <span>
                            {alternative.availableTables} mesa{alternative.availableTables > 1 ? 's' : ''} disponible{alternative.availableTables > 1 ? 's' : ''}
                          </span>
                        </div>
                        {alternative.proximityMinutes !== undefined && (
                          <div className="text-xs text-purple-600 mt-1">
                            {alternative.proximityMinutes === 0 
                              ? '⭐ Hora exacta'
                              : `📍 ${alternative.proximityMinutes} min de diferencia`
                            }
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Volver atrás
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlternativeTimesModal;

