// =====================================================
// CALENDARIO DE RECURSOS - MOBILE-FIRST 100%
// Vista de gestión de disponibilidad por recurso individual
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useVertical } from '../../hooks/useVertical';
import { supabase } from '../../lib/supabase';
import { format, addDays, subDays, parseISO, isToday, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Users, 
  RefreshCw, AlertTriangle, Plus, X, Eye, Trash2,
  CheckCircle2, Ban, Info, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import BlockageService from '../../services/BlockageService';
import AutoSlotRegenerationService from '../../services/AutoSlotRegenerationService';

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export default function CalendarioRecursosView() {
  const { business, businessId } = useAuthContext();
  const { labels } = useVertical();
  
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedResource, setSelectedResource] = useState(null);
  const [resources, setResources] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // =====================================================
  // CARGA DE DATOS
  // =====================================================

  // Cargar recursos del negocio
  const loadResources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('resource_number', { ascending: true });

      if (error) throw error;

      setResources(data || []);
      
      // Seleccionar el primer recurso por defecto
      if (data && data.length > 0 && !selectedResource) {
        setSelectedResource(data[0]);
      }

      return data || [];

    } catch (error) {
      console.error('❌ Error cargando recursos:', error);
      toast.error('Error al cargar recursos');
      return [];
    }
  }, [businessId, selectedResource]);

  // Cargar citas del día y recurso seleccionado
  const loadDayData = useCallback(async (resourceId, date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');

      // Cargar citas
      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select(`
          id, customer_name, appointment_time, end_time, 
          duration_minutes, status, 
          services(name, duration_minutes)
        `)
        .eq('business_id', businessId)
        .eq('resource_id', resourceId)
        .eq('appointment_date', dateStr)
        .in('status', ['confirmed', 'pending', 'completed'])
        .order('appointment_time', { ascending: true });

      if (apptsError) throw apptsError;

      // Cargar bloqueos
      const { data: blocks, error: blocksError } = await supabase
        .from('resource_blockages')
        .select('*')
        .eq('resource_id', resourceId)
        .eq('blocked_date', dateStr)
        .order('start_time', { ascending: true });

      if (blocksError) throw blocksError;

      setAppointments(appts || []);
      setBlockages(blocks || []);

      // Generar time slots combinando citas y bloqueos
      generateTimeSlots(appts || [], blocks || []);

    } catch (error) {
      console.error('❌ Error cargando datos del día:', error);
      toast.error('Error al cargar información');
    }
  }, [businessId]);

  // Generar slots de tiempo (09:00 - 20:00 cada 30 min)
  const generateTimeSlots = (appts, blocks) => {
    const slots = [];
    const businessHours = business?.business_hours || {};
    
    // Obtener día de la semana (0 = Domingo, 1 = Lunes, etc.)
    const dayOfWeek = selectedDate.getDay();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
    
    // Horarios del día (desde business_hours o defaults)
    const daySchedule = businessHours[dayName] || { open: '09:00', close: '20:00', is_open: true };
    
    if (!daySchedule.is_open) {
      setTimeSlots([]);
      return;
    }

    const startHour = parseInt(daySchedule.open?.split(':')[0] || '09');
    const endHour = parseInt(daySchedule.close?.split(':')[0] || '20');

    // Generar slots cada 30 minutos
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Buscar si hay cita en este slot
        const appointment = appts.find(apt => {
          const aptTime = apt.appointment_time;
          const aptEndTime = apt.end_time;
          return timeStr >= aptTime && timeStr < aptEndTime;
        });

        // Buscar si está bloqueado
        const blockage = blocks.find(b => {
          return timeStr >= b.start_time && timeStr < b.end_time;
        });

        slots.push({
          time: timeStr,
          appointment,
          blockage,
          status: blockage ? 'blocked' : appointment ? 'occupied' : 'free'
        });
      }
    }

    setTimeSlots(slots);
  };

  // Recargar todo
  const reload = async () => {
    if (selectedResource) {
      await loadDayData(selectedResource.id, selectedDate);
    }
  };

  // =====================================================
  // EFECTOS
  // =====================================================

  useEffect(() => {
    if (businessId) {
      loadResources();
    }
  }, [businessId, loadResources]);

  useEffect(() => {
    if (selectedResource && selectedDate) {
      loadDayData(selectedResource.id, selectedDate);
    }
  }, [selectedResource, selectedDate, loadDayData]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleSlotClick = (slot) => {
    if (slot.appointment) {
      // Ver detalles de la cita
      toast('Ver detalles de cita - Por implementar');
    } else if (slot.blockage) {
      // Opciones de bloqueo
      setSelectedSlot(slot);
      // Podría abrir un menú contextual
    } else {
      // Crear bloqueo en este slot
      setSelectedSlot(slot);
      setShowBlockModal(true);
    }
  };

  const handleRemoveBlock = async (blockageId) => {
    if (!confirm('¿Eliminar este bloqueo?')) return;

    const result = await BlockageService.removeBlockage(blockageId, businessId);
    
    if (result.success) {
      // Regenerar slots automáticamente (SIN confirmación)
      await triggerSlotRegeneration('resource_blockage_removed');
      reload();
    }
  };

  const triggerSlotRegeneration = async (actionType) => {
    try {
      console.log(`⚡ Regeneración automática iniciada: ${actionType}`);
      
      // Regeneración automática y silenciosa
      await AutoSlotRegenerationService.regenerateAfterAction(
        businessId, 
        actionType,
        {
          affectedDates: [format(selectedDate, 'yyyy-MM-dd')],
          silent: false // Mostrar toast informativo
        }
      );

    } catch (error) {
      console.error('❌ Error en regeneración:', error);
      toast.error('Error al actualizar disponibilidad');
    }
  };

  // =====================================================
  // RENDERIZADO
  // =====================================================

  if (loading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  // Si no hay recursos creados
  if (resources.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Configura tus {labels.resources}
          </h3>
          
          <p className="text-sm text-gray-600 mb-6">
            Para usar el calendario, primero debes configurar cuántos {labels.resources.toLowerCase()} tiene tu negocio.
          </p>

          <button
            onClick={() => {
              // TODO: Navegar a configuración o abrir wizard
              toast('Wizard de configuración - Por implementar');
            }}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
          >
            Configurar {labels.resources}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
      
      {/* =====================================================
          HEADER CON INFO
          ===================================================== */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
              📅 Calendario de {labels.resources}
            </h2>
            <p className="text-xs sm:text-sm text-gray-700">
              Gestiona la disponibilidad de cada {labels.resource.toLowerCase()} de forma independiente
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          SELECTOR DE RECURSO - MOBILE-FIRST
          ===================================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
          📍 {labels.resource} seleccionado
        </label>
        
        {/* MOBILE: Dropdown */}
        <select
          value={selectedResource?.id || ''}
          onChange={(e) => {
            const resource = resources.find(r => r.id === e.target.value);
            setSelectedResource(resource);
          }}
          className="w-full lg:hidden p-3 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500"
        >
          {resources.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} {!r.is_active && '(Inactivo)'}
            </option>
          ))}
        </select>
        
        {/* DESKTOP: Chips */}
        <div className="hidden lg:flex gap-2 flex-wrap">
          {resources.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedResource(r)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedResource?.id === r.id
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          NAVEGADOR DE FECHA - MOBILE-FIRST
          ===================================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-2 sm:p-2.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          
          <div className="flex-1 text-center">
            <p className="text-sm sm:text-base font-bold text-gray-900 capitalize">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
            </p>
            {isToday(selectedDate) && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                Hoy
              </span>
            )}
          </div>
          
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 sm:p-2.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Botón volver a hoy */}
        {!isToday(selectedDate) && (
          <button
            onClick={() => setSelectedDate(new Date())}
            className="w-full mt-2 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Volver a Hoy
          </button>
        )}
      </div>

      {/* =====================================================
          TIMELINE DE HORARIOS - MOBILE-FIRST
          ===================================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-gray-900">
              Horario de {selectedResource?.name}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              {appointments.length} cita(s) • {blockages.length} bloqueo(s)
            </p>
          </div>
          <button
            onClick={reload}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Timeline de slots */}
        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {timeSlots.length === 0 ? (
            <div className="p-6 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                No hay horarios configurados para este día
              </p>
            </div>
          ) : (
            timeSlots.map((slot, idx) => {
              const isBlocked = slot.status === 'blocked';
              const isOccupied = slot.status === 'occupied';
              const isFree = slot.status === 'free';

              return (
                <div
                  key={idx}
                  onClick={() => isFree && handleSlotClick(slot)}
                  className={`flex items-stretch transition-colors ${
                    isFree ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100' : ''
                  }`}
                >
                  {/* HORA */}
                  <div className="w-16 sm:w-20 flex-shrink-0 p-3 border-r bg-gray-50 flex items-center justify-center">
                    <p className="text-xs sm:text-sm font-mono font-bold text-gray-900">
                      {slot.time}
                    </p>
                  </div>

                  {/* CONTENIDO DEL SLOT */}
                  <div className="flex-1 p-3">
                    {isBlocked && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Ban className="w-4 h-4 text-red-600 flex-shrink-0" />
                            <p className="text-xs sm:text-sm font-bold text-red-900">
                              BLOQUEADO
                            </p>
                          </div>
                          {slot.blockage?.reason && (
                            <p className="text-xs text-red-700 ml-6">
                              {slot.blockage.reason}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBlock(slot.blockage.id);
                          }}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors flex-shrink-0"
                          title="Eliminar bloqueo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {isOccupied && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <p className="text-xs sm:text-sm font-bold text-blue-900 truncate">
                            {slot.appointment.customer_name}
                          </p>
                        </div>
                        <p className="text-xs text-blue-700 ml-6 truncate">
                          {slot.appointment.services?.name || 'Servicio'}
                        </p>
                        <div className="flex items-center gap-1 ml-6 mt-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span className="text-xs text-blue-600">
                            {slot.appointment.duration_minutes || slot.appointment.services?.duration_minutes || 60} min
                          </span>
                        </div>
                      </div>
                    )}

                    {isFree && (
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs sm:text-sm font-medium">
                          Disponible
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer con botón de acción */}
        {selectedResource && (
          <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => {
                setSelectedSlot(null);
                setShowBlockModal(true);
              }}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Ban className="w-5 h-5" />
              Bloquear horario de {selectedResource.name}
            </button>
          </div>
        )}
      </div>

      {/* =====================================================
          MODAL DE BLOQUEO
          ===================================================== */}
      {showBlockModal && (
        <BlockageModal
          resource={selectedResource}
          date={selectedDate}
          preselectedTime={selectedSlot?.time}
          onClose={() => {
            setShowBlockModal(false);
            setSelectedSlot(null);
          }}
          onSuccess={() => {
            setShowBlockModal(false);
            setSelectedSlot(null);
            reload();
            triggerSlotRegeneration('resource_blockage_created');
          }}
        />
      )}
    </div>
  );
}

// =====================================================
// MODAL: CREAR BLOQUEO - MOBILE-FIRST
// =====================================================
function BlockageModal({ resource, date, preselectedTime, onClose, onSuccess }) {
  const { businessId } = useAuthContext();
  const [timeRange, setTimeRange] = useState({
    start: preselectedTime || '09:00',
    end: preselectedTime ? addMinutesToTime(preselectedTime, 60) : '10:00'
  });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  // Validar conflictos al cambiar horario
  useEffect(() => {
    validateBlockage();
  }, [timeRange.start, timeRange.end]);

  const validateBlockage = async () => {
    setValidating(true);
    const result = await BlockageService.validateBlockage(
      resource.id,
      format(date, 'yyyy-MM-dd'),
      timeRange.start,
      timeRange.end
    );
    setConflicts(result.conflicts || []);
    setValidating(false);
  };

  const handleSubmit = async () => {
    setLoading(true);

    const result = await BlockageService.createBlockage({
      businessId,
      resourceId: resource.id,
      blockedDate: format(date, 'yyyy-MM-dd'),
      startTime: timeRange.start,
      endTime: timeRange.end,
      reason
    });

    setLoading(false);

    if (result.success) {
      toast.success('✅ Horario bloqueado correctamente');
      onSuccess();
    } else if (result.conflicts && result.conflicts.length > 0) {
      setConflicts(result.conflicts);
    }
  };

  const hasConflicts = conflicts.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-lg rounded-t-2xl lg:rounded-2xl max-h-[90vh] overflow-auto shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex items-center justify-between z-10">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            🚫 Bloquear horario
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          
          {/* Recurso */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Recurso
            </label>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-bold text-purple-900">
                {resource.name}
              </p>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Fecha
            </label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 capitalize">
                {format(date, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </div>

          {/* Rango de tiempo */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Horario a bloquear
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Desde</label>
                <input
                  type="time"
                  value={timeRange.start}
                  onChange={(e) => setTimeRange({ ...timeRange, start: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                <input
                  type="time"
                  value={timeRange.end}
                  onChange={(e) => setTimeRange({ ...timeRange, end: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Motivo (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Médico, Descanso, Mantenimiento..."
              className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500"
              rows="2"
            />
          </div>

          {/* VALIDACIÓN EN TIEMPO REAL */}
          {validating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <p className="text-xs text-blue-700">Verificando disponibilidad...</p>
            </div>
          )}

          {/* ADVERTENCIA: Conflictos con reservas */}
          {hasConflicts && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-red-900 mb-2">
                    ❌ No se puede bloquear
                  </p>
                  <p className="text-xs sm:text-sm text-red-800 mb-2">
                    Hay {conflicts.length} reserva(s) confirmada(s) en este horario:
                  </p>
                  <ul className="space-y-1.5 mb-3">
                    {conflicts.map(apt => (
                      <li key={apt.id} className="flex items-center gap-2 text-xs text-red-700 bg-white p-2 rounded border border-red-200">
                        <Users className="w-3 h-3 flex-shrink-0" />
                        <span className="font-semibold">{apt.appointment_time}</span>
                        <span className="truncate">- {apt.customer_name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="bg-white border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-800 font-semibold flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Las reservas son sagradas
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Debes cancelar estas reservas manualmente desde la lista antes de bloquear.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS: Sin conflictos */}
          {!hasConflicts && !validating && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-green-800 font-medium">
                ✅ No hay conflictos. Puedes bloquear este horario.
              </p>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || hasConflicts || validating}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2 shadow-lg disabled:shadow-none"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Bloqueando...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                Confirmar bloqueo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// HELPERS
// =====================================================

function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

