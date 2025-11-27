import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Scissors, 
  Coffee, 
  CalendarX, 
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import logger from '../../utils/logger';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * StaffWidget - Widget de Estado del Equipo
 * Muestra empleados REALES con su estado actual:
 * - Ocupado (con cliente X)
 * - Vacaciones / Ausente
 * - Disponible
 * 
 * SIN MOCK - TODO CON DATOS REALES
 */

const EmployeeRow = ({ employee, currentAppointment, absence, nextAppointment }) => {
  // Determinar estado
  let status = 'free';
  let statusLabel = 'Disponible';
  let statusDetail = null;
  let statusConfig = {
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-700',
    icon: CheckCircle2
  };

  // Prioridad 1: Ausencia (vacaciones, médico, etc.)
  if (absence) {
    status = 'absence';
    statusLabel = absence.reason === 'vacation' ? '🏖️ Vacaciones' : 
                  absence.reason === 'medical' ? '🏥 Médico' :
                  absence.reason === 'sick_leave' ? '🤒 Baja médica' :
                  '📅 Ausente';
    statusDetail = absence.reason_label || `Hasta el ${format(parseISO(absence.end_date), 'd MMM', { locale: es })}`;
    statusConfig = {
      color: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-700',
      badgeColor: 'bg-orange-100 text-orange-700',
      icon: CalendarX
    };
  }
  // Prioridad 2: Ocupado con cliente
  else if (currentAppointment) {
    status = 'working';
    statusLabel = '✂️ Con cliente';
    statusDetail = `${currentAppointment.customer_name} (${currentAppointment.time_remaining} min)`;
    statusConfig = {
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
      badgeColor: 'bg-blue-100 text-blue-700',
      icon: Scissors
    };
  }
  // Prioridad 3: Disponible
  else {
    statusDetail = nextAppointment 
      ? `Próx: ${nextAppointment.appointment_time.substring(0, 5)} - ${nextAppointment.customer_name}`
      : 'Sin citas programadas';
  }

  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center justify-between p-4 rounded-xl border-2 ${statusConfig.color} mb-3 last:mb-0 shadow-sm hover:shadow-md transition-all`}
    >
      {/* Empleado info */}
      <div className="flex items-center gap-4 flex-1">
        {/* Avatar con inicial */}
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-md border-2 border-white`}
          style={{ 
            backgroundColor: employee.color || '#6366f1',
            color: 'white'
          }}
        >
          {employee.name.charAt(0).toUpperCase()}
        </div>

        {/* Nombre y rol */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-800 text-base truncate">
            {employee.name}
          </h4>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
            {employee.role === 'owner' ? 'Propietario' : 
             employee.role === 'manager' ? 'Encargado' : 
             employee.role === 'freelance' ? 'Freelance' : 
             'Staff'}
          </p>
        </div>
      </div>

      {/* Estado actual */}
      <div className="flex flex-col items-end gap-1 min-w-0 max-w-[200px]">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusConfig.badgeColor} font-semibold text-xs whitespace-nowrap`}>
          <StatusIcon size={14} />
          <span>{statusLabel}</span>
        </div>
        {statusDetail && (
          <p className={`text-xs ${statusConfig.textColor} text-right truncate w-full`}>
            {statusDetail}
          </p>
        )}
      </div>
    </motion.div>
  );
};

const StaffWidget = ({ businessId }) => {
  const [employees, setEmployees] = useState([]);
  const [employeeStates, setEmployeeStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar empleados y sus estados
  const loadStaffData = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // "21:30"

      logger.info('📊 Cargando datos del equipo...', { businessId, today, currentTime });

      // 1. Cargar empleados activos
      const { data: staffData, error: staffError } = await supabase
        .from('employees')
        .select('id, name, role, color, assigned_resource_id, position_order')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('position_order', { ascending: true });

      if (staffError) throw staffError;

      if (!staffData || staffData.length === 0) {
        logger.warn('⚠️ No hay empleados activos');
        setEmployees([]);
        setEmployeeStates({});
        return;
      }

      logger.info(`✅ Cargados ${staffData.length} empleados`, staffData.map(e => e.name));
      setEmployees(staffData);

      // 2. Para cada empleado, obtener su estado
      const states = {};

      for (const emp of staffData) {
        // A) ¿Está ausente HOY?
        const { data: absences } = await supabase
          .from('employee_absences')
          .select('*')
          .eq('employee_id', emp.id)
          .lte('start_date', today)
          .gte('end_date', today)
          .eq('approved', true)
          .order('start_date', { ascending: false })
          .limit(1);

        // B) ¿Tiene cita AHORA? (dentro de su horario de servicio)
        const { data: currentAppt } = await supabase
          .from('appointments')
          .select('customer_name, appointment_time, duration_minutes, service_id')
          .eq('employee_id', emp.id)
          .eq('appointment_date', today)
          .in('status', ['confirmed', 'pending'])
          .lte('appointment_time', currentTime)
          .order('appointment_time', { ascending: false })
          .limit(1);

        // Verificar si la cita actual todavía está en progreso
        let currentAppointment = null;
        if (currentAppt && currentAppt.length > 0) {
          const appt = currentAppt[0];
          const apptTime = appt.appointment_time;
          const [hours, minutes] = apptTime.split(':').map(Number);
          const apptStart = new Date(now);
          apptStart.setHours(hours, minutes, 0, 0);
          const apptEnd = new Date(apptStart.getTime() + appt.duration_minutes * 60000);

          if (now >= apptStart && now <= apptEnd) {
            const timeRemaining = Math.ceil((apptEnd - now) / 60000);
            currentAppointment = {
              ...appt,
              time_remaining: timeRemaining
            };
          }
        }

        // C) ¿Cuál es su próxima cita?
        const { data: nextAppt } = await supabase
          .from('appointments')
          .select('customer_name, appointment_time')
          .eq('employee_id', emp.id)
          .eq('appointment_date', today)
          .in('status', ['confirmed', 'pending'])
          .gt('appointment_time', currentTime)
          .order('appointment_time', { ascending: true })
          .limit(1);

        states[emp.id] = {
          absence: absences && absences.length > 0 ? absences[0] : null,
          currentAppointment,
          nextAppointment: nextAppt && nextAppt.length > 0 ? nextAppt[0] : null
        };

        logger.info(`👤 ${emp.name}:`, {
          ausente: !!states[emp.id].absence,
          ocupado: !!currentAppointment,
          proxima: !!states[emp.id].nextAppointment
        });
      }

      setEmployeeStates(states);

    } catch (err) {
      logger.error('❌ Error cargando datos del equipo:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadStaffData();
    
    // Auto-refresh cada 2 minutos
    const interval = setInterval(loadStaffData, 120000);
    return () => clearInterval(interval);
  }, [loadStaffData]);

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center"
      >
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-semibold mb-2">Error al cargar el equipo</p>
        <p className="text-red-600 text-sm">{error.message}</p>
        <button
          onClick={loadStaffData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white rounded-xl border-2 border-slate-200 shadow-sm p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <User size={16} className="text-slate-400" />
          Estado del Equipo
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>En tiempo real</span>
        </div>
      </div>

      {/* Lista de empleados */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            <span>Cargando equipo...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay empleados activos</p>
            <p className="text-sm mt-1">Configura tu equipo en Ajustes</p>
          </div>
        ) : (
          <AnimatePresence>
            {employees.map((emp) => (
              <EmployeeRow
                key={emp.id}
                employee={emp}
                currentAppointment={employeeStates[emp.id]?.currentAppointment}
                absence={employeeStates[emp.id]?.absence}
                nextAppointment={employeeStates[emp.id]?.nextAppointment}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default StaffWidget;









