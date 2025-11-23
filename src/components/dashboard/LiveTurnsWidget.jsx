import React, { useState, useEffect } from 'react';
import { Clock, User, Circle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, addHours } from 'date-fns';
import logger from '../../utils/logger';

/**
 * LiveTurnsWidget - El Pulso del Negocio
 * Muestra los turnos actuales en tiempo real con etiquetas inteligentes
 */

const ResourceCard = ({ resource, appointment }) => {
  const isBusy = appointment !== null;
  
  // Calcular etiqueta inteligente del cliente (simplificada por ahora)
  const getCustomerTag = () => {
    if (!appointment) {
      return null;
    }
    
    // Por ahora solo mostramos el nombre del cliente
    // TODO: Agregar lógica de segmentación cuando esté disponible la FK
    return null;
  };

  const tag = getCustomerTag();
  
  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border-2 mb-2 last:mb-0 
      transition-all duration-200 hover:shadow-md
      ${isBusy ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}
    `}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Indicador de estado */}
        <div className="flex-shrink-0">
          <Circle 
            size={12} 
            className={`${isBusy ? 'text-blue-500 fill-blue-500' : 'text-green-500 fill-green-500'}`}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Nombre del recurso */}
          <h4 className="text-sm font-semibold text-gray-800 truncate">
            {resource.name}
          </h4>
          
          {/* Info del cliente o disponibilidad */}
          <div className="flex items-center gap-2 mt-1">
            {isBusy ? (
              <>
                <User size={12} className="text-gray-500 flex-shrink-0" />
                <p className="text-xs text-gray-600 truncate">
                  {appointment.customer_name}
                </p>
                {tag && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tag.color}`}>
                    {tag.label}
                  </span>
                )}
              </>
            ) : (
              <p className="text-xs text-green-600 font-medium">
                🟢 Disponible
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Badge de estado */}
      {isBusy && (
        <div className="flex-shrink-0">
          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full whitespace-nowrap">
            En curso
          </span>
        </div>
      )}
    </div>
  );
};

const LiveTurnsWidget = ({ business_id }) => {
  const [resources, setResources] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Calcular ventana de tiempo (hora actual ± 1h)
  const getTimeWindow = () => {
    const now = new Date();
    const currentHour = format(now, 'HH:00:00');
    const nextHour = format(addHours(now, 1), 'HH:00:00');
    const today = format(now, 'yyyy-MM-dd');
    
    return { today, currentHour, nextHour };
  };

  // Cargar recursos del negocio
  const loadResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('id, name, is_active')
        .eq('business_id', business_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      setResources(data || []);
    } catch (err) {
      logger.error('Error loading resources:', err);
      // Si falla, mostrar mensaje pero no romper la app
      setResources([]);
      setLoading(false);
    }
  };

  // Cargar citas actuales
  const loadCurrentAppointments = async () => {
    try {
      const { today, currentHour, nextHour } = getTimeWindow();
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          resource_id,
          customer_name,
          customer_phone,
          appointment_time,
          duration_minutes,
          status
        `)
        .eq('business_id', business_id)
        .eq('appointment_date', today)
        .gte('appointment_time', currentHour)
        .lte('appointment_time', nextHour)
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('appointment_time');

      if (error) throw error;
      
      setAppointments(data || []);
      setLoading(false);
    } catch (err) {
      logger.error('Error loading appointments:', err);
      setLoading(false);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (!business_id) return;

    loadResources();
    loadCurrentAppointments();
  }, [business_id]);

  // Real-time updates
  useEffect(() => {
    if (!business_id) return;

    const channel = supabase
      .channel(`live-turns-${business_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${business_id}`
        },
        (payload) => {
          logger.info('Real-time update received:', payload);
          loadCurrentAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business_id]);

  // Actualizar hora actual cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 1 minuto

    return () => clearInterval(interval);
  }, []);

  // Emparejar recursos con citas
  const getResourceWithAppointment = (resource) => {
    const appointment = appointments.find(apt => apt.resource_id === resource.id);
    return appointment || null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const { currentHour, nextHour } = getTimeWindow();

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <Clock size={16} className="text-gray-400" />
          <span className="hidden sm:inline">Ahora en el salón</span>
          <span className="sm:hidden">Turnos</span>
          <span className="text-gray-400 font-normal normal-case">
            ({currentHour.substring(0, 5)} - {nextHour.substring(0, 5)})
          </span>
        </h3>
        
        {/* Indicador de actualización en vivo */}
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </div>
      
      {/* Lista de recursos */}
      <div className="space-y-2">
        {resources.length > 0 ? (
          resources.map(resource => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              appointment={getResourceWithAppointment(resource)}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No hay recursos configurados</p>
            <p className="text-xs mt-1">Configura sillas o boxes en Ajustes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTurnsWidget;

