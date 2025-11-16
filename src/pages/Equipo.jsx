// ====================================
// TU EQUIPO - Gestión de Empleados y Horarios
// Sección permanente para administrar el equipo
// ====================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Users, Plus, Edit3, Trash2, Clock, CheckCircle2, 
  X, ArrowRight, ArrowLeft, Loader2, Save, Calendar,
  Palmtree, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Equipo() {
  const { business } = useAuthContext();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [resources, setResources] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAbsencesModal, setShowAbsencesModal] = useState(false);

  useEffect(() => {
    if (business?.id) {
      loadEmployees();
      loadResources();
    }
  }, [business?.id]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          employee_schedules(*)
        `)
        .eq('business_id', business.id)
        .order('position_order', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      toast.error('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error cargando recursos:', error);
    }
  };

  const handleAddEmployee = () => {
    setShowAddModal(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleEditSchedule = (employee) => {
    setSelectedEmployee(employee);
    setShowScheduleModal(true);
  };

  const handleManageAbsences = (employee) => {
    setSelectedEmployee(employee);
    setShowAbsencesModal(true);
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!confirm('¿Seguro que quieres eliminar este empleado?')) return;

    try {
      // 🛡️ PASO 1: Obtener el recurso asignado al empleado
      const { data: employeeData } = await supabase
        .from('employees')
        .select('assigned_resource_id, name')
        .eq('id', employeeId)
        .single();

      const assignedResourceId = employeeData?.assigned_resource_id;

      // 🛡️ PASO 2: Verificar si tiene reservas activas (usando el recurso asignado)
      let activeReservations = [];
      if (assignedResourceId) {
        const { data: reservations, error: reservationsError } = await supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, customer_name, resource_id')
          .eq('business_id', business.id)
          .eq('resource_id', assignedResourceId) // resource_id en appointments apunta al recurso (silla/sillón)
          .not('status', 'in', '(cancelled,completed)');

        if (reservationsError) {
          console.error('Error verificando reservas:', reservationsError);
        } else {
          activeReservations = reservations || [];
        }
      }

      const hasActiveReservations = activeReservations.length > 0;

      // 🛡️ PASO 3: Si tiene reservas, preguntar si transferir
      if (hasActiveReservations) {
        const transfer = confirm(
          `⚠️ Este empleado tiene ${activeReservations.length} reserva(s) activa(s).\n\n` +
          `¿Quieres transferir las reservas a otro empleado?\n\n` +
          `- Aceptar: Abrir selector para transferir\n` +
          `- Cancelar: Eliminar empleado y cancelar reservas`
        );

        if (transfer) {
          // Mostrar modal de transferencia (implementar después)
          // Por ahora, solo informar
          toast.loading('Funcionalidad de transferencia en desarrollo...', { id: 'transfer' });
          
          // Obtener otros empleados disponibles
          const { data: otherEmployees } = await supabase
            .from('employees')
            .select('id, name')
            .eq('business_id', business.id)
            .neq('id', employeeId)
            .eq('is_active', true);

          if (otherEmployees && otherEmployees.length > 0) {
            // Obtener el recurso asignado del empleado destino
            const { data: targetEmployeeData } = await supabase
              .from('employees')
              .select('assigned_resource_id, name')
              .eq('id', otherEmployees[0].id)
              .single();

            const targetResourceId = targetEmployeeData?.assigned_resource_id;

            if (targetResourceId) {
              // Transferir reservas al recurso del nuevo empleado
              const { error: transferError } = await supabase
                .from('appointments')
                .update({ resource_id: targetResourceId })
                .eq('resource_id', assignedResourceId)
                .not('status', 'in', '(cancelled,completed)');

            if (transferError) {
              console.error('Error transfiriendo reservas:', transferError);
              toast.error('Error al transferir reservas');
            } else {
              toast.dismiss('transfer');
              toast.success(`✅ ${activeReservations.length} reserva(s) transferida(s) a ${targetEmployeeData.name}`);
            }
          } else {
            toast.dismiss('transfer');
            toast.error('El empleado destino no tiene recurso asignado');
            return;
          }
        } else {
          toast.dismiss('transfer');
          toast.error('No hay otros empleados disponibles para transferir');
          return; // No eliminar si no hay a quién transferir
        }
        } else {
          // Cancelar todas las reservas activas
          if (assignedResourceId) {
            const { error: cancelError } = await supabase
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('resource_id', assignedResourceId)
              .not('status', 'in', '(cancelled,completed)');

            if (cancelError) {
              console.error('Error cancelando reservas:', cancelError);
            } else {
              toast.info(`⚠️ ${activeReservations.length} reserva(s) cancelada(s)`);
            }
          }
        }
      }

      // 🗑️ PASO 4: Eliminar empleado
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);

      if (error) throw error;

      // 🗑️ PASO 5: Eliminar disponibilidad del empleado (usando el recurso asignado)
      if (assignedResourceId) {
        const { error: slotsError } = await supabase
          .from('availability_slots')
          .delete()
          .eq('business_id', business.id)
          .eq('resource_id', assignedResourceId);

        if (slotsError) {
          console.error('Error eliminando slots:', slotsError);
          // No es crítico, continuar
        } else {
          console.log('✅ Slots de disponibilidad eliminados para el empleado');
        }
      }

      toast.success('Empleado eliminado');
      loadEmployees();
    } catch (error) {
      console.error('Error eliminando empleado:', error);
      toast.error('Error al eliminar empleado');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Cargando tu equipo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pb-24 lg:pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    👥 Tu Equipo
                  </h1>
                  <p className="text-sm text-gray-600">
                    Gestiona profesionales, horarios, ausencias y recursos asignados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* Panel informativo */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                💡 ¿Cómo funciona el sistema de empleados?
              </h3>
              <p className="text-xs text-gray-700 leading-relaxed">
                <strong>1 Empleado = 1 Columna</strong> en el calendario. Cada profesional tiene su propio horario, 
                ausencias y bloqueos. Si trabajas solo, solo verás tu columna. Si tienes equipo, verás varias columnas.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de empleados */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">👥 Tu Equipo ({employees.length})</h2>
              <button
                onClick={handleAddEmployee}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                Añadir Empleado
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {employees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">No hay empleados</p>
                <p className="text-xs text-gray-400 mt-1">Añade al menos uno para continuar</p>
              </div>
            ) : (
              employees.map((emp, idx) => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  onEdit={() => handleEditEmployee(emp)}
                  onEditSchedule={() => handleEditSchedule(emp)}
                  onManageAbsences={() => handleManageAbsences(emp)}
                  onDelete={() => handleDeleteEmployee(emp.id)}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modales */}
      {showAddModal && (
        <AddEmployeeModal
          businessId={business.id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadEmployees();
          }}
        />
      )}

      {showEditModal && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          resources={resources}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {showScheduleModal && selectedEmployee && (
        <EditScheduleModal
          employee={selectedEmployee}
          resources={resources}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowScheduleModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {showAbsencesModal && selectedEmployee && (
        <ManageAbsencesModal
          employee={selectedEmployee}
          businessId={business.id}
          onClose={() => {
            setShowAbsencesModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowAbsencesModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
        />
      )}
    </div>
  );
}

// ====================================
// COMPONENTE: Tarjeta de Empleado
// ====================================
function EmployeeCard({ employee, onEdit, onEditSchedule, onManageAbsences, onDelete }) {
  // ✅ Calcular información precisa del horario a partir de los schedules reales
  const workingDays = (employee.employee_schedules || [])
    .filter((s) => s.is_working && s.shifts && s.shifts.length > 0)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getScheduleSummary = () => {
    if (workingDays.length === 0) {
      return 'Sin horario';
    }

    // Construir rangos horarios por día
    const uniqueSchedules = new Set();
    workingDays.forEach((day) => {
      const shifts = day.shifts || [];
      if (shifts.length > 0) {
        const firstShift = shifts[0];
        const lastShift = shifts[shifts.length - 1];
        uniqueSchedules.add(`${firstShift.start.slice(0, 5)}-${lastShift.end.slice(0, 5)}`);
      }
    });

    // Si todos los días comparten el mismo horario, mostramos rango de días + horario
    if (uniqueSchedules.size === 1) {
      const timeRange = Array.from(uniqueSchedules)[0];
      if (workingDays.length === 1) {
        return `${dayNames[workingDays[0].day_of_week]} ${timeRange}`;
      }
      return `${dayNames[workingDays[0].day_of_week]}-${dayNames[workingDays[workingDays.length - 1].day_of_week]} ${timeRange}`;
    }

    // Si tiene horarios distintos según el día:
    // - Hasta 3 días: listamos los días
    // - Más de 3: mostramos número de días trabajados
    if (workingDays.length <= 3) {
      return workingDays.map((d) => dayNames[d.day_of_week]).join(', ');
    }

    return `${workingDays.length} días/semana`;
  };

  const scheduleText = getScheduleSummary();

  return (
    <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
          style={{ backgroundColor: employee.color || '#6366f1' }}
        >
          {employee.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-gray-900">{employee.name}</h3>
            {employee.is_owner && (
              <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                Propietario
              </span>
            )}
            {!employee.is_active && (
              <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                Inactivo
              </span>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="w-3 h-3" />
              <span>{scheduleText}</span>
            </div>
            {employee.email && (
              <span className="text-xs text-gray-500">{employee.email}</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
            title="Editar empleado"
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
          </button>
          
          <button
            onClick={onEditSchedule}
            className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
            title="Editar horario"
          >
            <Calendar className="w-4 h-4 text-purple-600" />
          </button>
          
          <button
            onClick={onManageAbsences}
            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
            title="Gestionar ausencias"
          >
            <Palmtree className="w-4 h-4 text-green-600" />
          </button>
          
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            title="Eliminar empleado"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================================
// MODAL: Añadir Empleado (UNIFICADO: Info + Horario en una sola pantalla)
// ====================================
function AddEmployeeModal({ businessId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    color: '#6366f1',
    assigned_resource_id: 'auto' // Por defecto: Automático
  });
  
  // Inicializar horario vacío - se cargará dinámicamente desde el horario del negocio
  const [schedules, setSchedules] = useState([]);
  
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const dayNames = [
    { id: 0, name: 'Domingo' },
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' }
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. Cargar recursos
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name');

      if (resourcesError) throw resourcesError;
      setResources(resourcesData || []);
      
      // 2. Cargar horario del negocio
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();
      
      if (businessError) throw businessError;
      
      // 3. Convertir horario del negocio a formato de empleado
      const businessHours = businessData?.settings?.operating_hours || {};
      const dayMapping = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
      };
      
      const initialSchedules = dayNames.map(day => {
        const dayKey = Object.keys(dayMapping).find(key => dayMapping[key] === day.id);
        const businessDay = businessHours[dayKey];
        
        // Si el negocio tiene horario configurado para este día
        if (businessDay && !businessDay.closed && businessDay.shifts && businessDay.shifts.length > 0) {
          return {
            day_of_week: day.id,
            is_working: true,
            shifts: businessDay.shifts.map(shift => ({
              start: shift.start,
              end: shift.end
            }))
          };
        } else {
          // Por defecto: cerrado con un turno vacío
          return {
            day_of_week: day.id,
            is_working: false,
            shifts: [{ start: '09:00', end: '18:00' }]
          };
        }
      });
      
      setSchedules(initialSchedules);
      
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
      toast.error('Error al cargar datos iniciales');
      
      // Fallback: horario por defecto Lun-Vie 9-18h si falla
      setSchedules([
        { day_of_week: 0, is_working: false, shifts: [{ start: '09:00', end: '18:00' }] },
        { day_of_week: 1, is_working: true, shifts: [{ start: '09:00', end: '18:00' }] },
        { day_of_week: 2, is_working: true, shifts: [{ start: '09:00', end: '18:00' }] },
        { day_of_week: 3, is_working: true, shifts: [{ start: '09:00', end: '18:00' }] },
        { day_of_week: 4, is_working: true, shifts: [{ start: '09:00', end: '18:00' }] },
        { day_of_week: 5, is_working: true, shifts: [{ start: '09:00', end: '18:00' }] },
        { day_of_week: 6, is_working: false, shifts: [{ start: '09:00', end: '18:00' }] }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  // Funciones para manejar horarios
  const handleToggleDay = (dayIndex) => {
    setSchedules(prev => prev.map((s, i) => 
      i === dayIndex ? { ...s, is_working: !s.is_working } : s
    ));
  };

  const handleAddShift = (dayIndex) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      return {
        ...s,
        shifts: [...s.shifts, { start: '09:00', end: '18:00' }]
      };
    }));
  };

  const handleRemoveShift = (dayIndex, shiftIndex) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      const newShifts = s.shifts.filter((_, idx) => idx !== shiftIndex);
      return {
        ...s,
        shifts: newShifts.length > 0 ? newShifts : [{ start: '09:00', end: '18:00' }]
      };
    }));
  };

  const handleShiftTimeChange = (dayIndex, shiftIndex, field, value) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      return {
        ...s,
        shifts: s.shifts.map((shift, idx) => 
          idx === shiftIndex ? { ...shift, [field]: value } : shift
        )
      };
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    // Validación de recurso: puede ser 'auto' o un ID específico
    if (!formData.assigned_resource_id || formData.assigned_resource_id === '') {
      toast.error('Debes seleccionar un recurso o dejar en Automático');
      return;
    }
    
    // Validar que al menos 1 día está activo
    const tieneAlgunDiaActivo = schedules.some(s => s.is_working);
    if (!tieneAlgunDiaActivo) {
      toast.error('Debes activar al menos un día de la semana');
      return;
    }

    // 🛡️ VALIDACIÓN CRÍTICA: Horario empleado dentro de horario negocio
    try {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const businessHours = businessData?.settings?.operating_hours || {};
      
      // Mapeo de índices a nombres de días
      const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      // Validar cada día del empleado
      for (const empSchedule of schedules) {
        if (!empSchedule.is_working) continue; // Día cerrado, ok
        
        const dayName = dayMapping[empSchedule.day_of_week];
        const businessDay = businessHours[dayName];
        
        // Si el negocio está cerrado ese día, el empleado NO puede trabajar
        if (!businessDay || businessDay.closed) {
          const dayNameSpanish = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][empSchedule.day_of_week];
          toast.error(`❌ ${dayNameSpanish}: El negocio está cerrado. El empleado no puede trabajar.`);
          return;
        }
        
        // Validar cada turno del empleado contra turnos del negocio
        for (const empShift of empSchedule.shifts) {
          const empStart = empShift.start;
          const empEnd = empShift.end;
          
          // Obtener turnos del negocio (si existen) o usar horario simple
          const businessShifts = businessDay.shifts || [{ start: businessDay.open, end: businessDay.close }];
          
          // Verificar que el turno del empleado está dentro de ALGÚN turno del negocio
          let isValid = false;
          for (const bizShift of businessShifts) {
            if (empStart >= bizShift.start && empEnd <= bizShift.end) {
              isValid = true;
              break;
            }
          }
          
          if (!isValid) {
            const dayNameSpanish = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][empSchedule.day_of_week];
            const businessHoursStr = businessShifts.map(s => `${s.start}-${s.end}`).join(', ');
            toast.error(
              `❌ ${dayNameSpanish}: Horario ${empStart}-${empEnd} fuera del horario del negocio (${businessHoursStr}). ` +
              `El empleado solo puede trabajar dentro del horario del negocio.`,
              { duration: 6000 }
            );
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error validando horarios:', error);
      toast.error('Error al validar horarios contra el negocio');
      return;
    }

    setSaving(true);
    try {
      // 🎯 ASIGNACIÓN AUTOMÁTICA DE RECURSOS
      let finalResourceId = formData.assigned_resource_id;
      
      if (formData.assigned_resource_id === 'auto') {
        // Buscar recursos disponibles
        const { data: availableResources, error: resError } = await supabase
          .from('resources')
          .select('id, name')
          .eq('business_id', businessId)
          .eq('is_active', true);
        
        if (resError) throw resError;
        
        if (!availableResources || availableResources.length === 0) {
          toast.error('❌ No hay recursos disponibles. Crea primero un recurso en Configuración → Recursos');
          setSaving(false);
          return;
        }
        
        // 🎯 ALGORITMO INTELIGENTE: Optimizar uso horario de recursos
        // Obtener empleados actuales con sus horarios
        const { data: currentEmployees, error: empError } = await supabase
          .from('employees')
          .select(`
            id, 
            assigned_resource_id,
            employee_schedules (
              day_of_week,
              is_working,
              shifts
            )
          `)
          .eq('business_id', businessId)
          .eq('is_active', true);
        
        if (empError) throw empError;
        
        // Convertir horarios del nuevo empleado a minutos totales por día
        const newEmployeeMinutes = {};
        schedules.forEach(schedule => {
          if (!schedule.is_working) return;
          
          let totalMinutes = 0;
          schedule.shifts.forEach(shift => {
            const [hStart, mStart] = shift.start.split(':').map(Number);
            const [hEnd, mEnd] = shift.end.split(':').map(Number);
            const startMin = hStart * 60 + mStart;
            const endMin = hEnd * 60 + mEnd;
            totalMinutes += (endMin - startMin);
          });
          
          newEmployeeMinutes[schedule.day_of_week] = {
            totalMinutes,
            shifts: schedule.shifts
          };
        });
        
        // Calcular para cada recurso:
        // 1. Minutos ya ocupados por día
        // 2. Si hay conflictos horarios con el nuevo empleado
        // 3. Puntuación de "fit" (mejor aprovechamiento)
        const resourceAnalysis = availableResources.map(resource => {
          const employeesInResource = (currentEmployees || []).filter(emp => 
            emp.assigned_resource_id === resource.id
          );
          
          let totalConflictMinutes = 0;
          let totalOccupiedMinutes = 0;
          let hasConflict = false;
          
          // Analizar cada día
          for (const [dayOfWeek, newEmpData] of Object.entries(newEmployeeMinutes)) {
            const day = parseInt(dayOfWeek);
            
            // Minutos ocupados por empleados existentes en este día
            let occupiedRanges = [];
            
            employeesInResource.forEach(emp => {
              const schedDay = emp.employee_schedules?.find(s => s.day_of_week === day && s.is_working);
              if (schedDay && schedDay.shifts) {
                schedDay.shifts.forEach(shift => {
                  const [hStart, mStart] = shift.start.split(':').map(Number);
                  const [hEnd, mEnd] = shift.end.split(':').map(Number);
                  occupiedRanges.push({
                    start: hStart * 60 + mStart,
                    end: hEnd * 60 + mEnd
                  });
                });
              }
            });
            
            // Verificar si el nuevo empleado solapa con empleados existentes
            newEmpData.shifts.forEach(newShift => {
              const [hStart, mStart] = newShift.start.split(':').map(Number);
              const [hEnd, mEnd] = newShift.end.split(':').map(Number);
              const newStart = hStart * 60 + mStart;
              const newEnd = hEnd * 60 + mEnd;
              
              occupiedRanges.forEach(occupied => {
                // Verificar solapamiento
                const overlapStart = Math.max(newStart, occupied.start);
                const overlapEnd = Math.min(newEnd, occupied.end);
                
                if (overlapStart < overlapEnd) {
                  hasConflict = true;
                  totalConflictMinutes += (overlapEnd - overlapStart);
                }
              });
              
              totalOccupiedMinutes += occupiedRanges.reduce((sum, range) => 
                sum + (range.end - range.start), 0
              );
            });
          }
          
          // Puntuación de "fit":
          // - Si hay conflicto, puntuación muy baja (no viable)
          // - Si no hay conflicto, puntuación = minutos ya ocupados (queremos llenar recursos)
          const score = hasConflict ? -1000 : totalOccupiedMinutes;
          
          return {
            resource,
            score,
            hasConflict,
            employeeCount: employeesInResource.length,
            occupiedMinutes: totalOccupiedMinutes
          };
        });
        
        // Ordenar por puntuación (mayor = mejor aprovechamiento)
        resourceAnalysis.sort((a, b) => b.score - a.score);
        
        // Seleccionar el mejor recurso sin conflictos
        const bestResource = resourceAnalysis.find(r => !r.hasConflict);
        
        if (bestResource) {
          finalResourceId = bestResource.resource.id;
          console.log(`✅ Asignación inteligente: ${bestResource.resource.name}`);
          console.log(`   - ${bestResource.employeeCount} empleados actuales`);
          console.log(`   - ${bestResource.occupiedMinutes} minutos ocupados`);
          console.log(`   - Aprovechamiento óptimo del recurso`);
          
          window.__lastAutoAssignedResource = bestResource.resource.name;
        } else {
          toast.error('❌ No hay recursos disponibles sin conflictos horarios. Crea un nuevo recurso.');
          setSaving(false);
          return;
        }
      } else {
        window.__lastAutoAssignedResource = null;
      }
      
      // 1. Crear empleado con recurso asignado
      const { data: newEmployee, error: empError } = await supabase
        .from('employees')
        .insert([{
          business_id: businessId,
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          role: formData.role,
          color: formData.color,
          assigned_resource_id: finalResourceId,
          is_active: true,
          is_owner: false,
          position_order: 999
        }])
        .select()
        .single();

      if (empError) throw empError;

      // 2. El trigger ya creó horarios por defecto
      // Ahora los actualizamos con los valores del formulario
      for (const schedule of schedules) {
        const { error: schedError } = await supabase
          .from('employee_schedules')
          .update({
            is_working: schedule.is_working,
            shifts: schedule.is_working ? schedule.shifts : [],
            start_time: schedule.is_working && schedule.shifts.length > 0 ? schedule.shifts[0].start : null,
            end_time: schedule.is_working && schedule.shifts.length > 0 ? schedule.shifts[schedule.shifts.length - 1].end : null,
            breaks: [],
            // ⭐ Asignar el recurso calculado
            resource_id: finalResourceId,
            resource_assignment_type: formData.assigned_resource_id === 'auto' ? 'auto' : 'manual'
          })
          .eq('employee_id', newEmployee.id)
          .eq('day_of_week', schedule.day_of_week);

        if (schedError) {
          // Si falla el horario, eliminar empleado creado
          await supabase.from('employees').delete().eq('id', newEmployee.id);
          throw schedError;
        }
      }

      // Mensaje de éxito con información del recurso asignado
      if (window.__lastAutoAssignedResource) {
        toast.success(`¡${formData.name} añadido! 🎉\n✅ Recurso asignado automáticamente: ${window.__lastAutoAssignedResource}`);
        window.__lastAutoAssignedResource = null;
      } else {
        toast.success(`¡${formData.name} añadido con horario! 🎉`);
      }
      
      // ⚡ GENERAR DISPONIBILIDAD AUTOMÁTICAMENTE
      // Solo si el empleado tiene recurso asignado Y horarios configurados
      const hasResource = finalResourceId !== null;
      const hasSchedules = schedules.some(s => s.is_working && s.shifts.length > 0);
      
      if (hasResource && hasSchedules) {
        console.log('⚡ Empleado con recurso y horarios → Generando disponibilidad automáticamente...');
        try {
          const AutoSlotRegenerationService = (await import('../services/AutoSlotRegenerationService')).default;
          await AutoSlotRegenerationService.regenerate(
            businessId,
            'employee_added_with_resource_and_schedule',
            { silent: true } // Silencioso para no molestar
          );
          console.log('✅ Disponibilidad generada automáticamente para nuevo empleado');
        } catch (regError) {
          console.error('⚠️ Error generando disponibilidad (no crítico):', regError);
          // No bloquear el flujo si falla la generación
        }
      } else {
        console.log('ℹ️ Empleado sin recurso o sin horarios → No se genera disponibilidad aún');
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error añadiendo empleado:', error);
      
      // Mensaje específico si es conflicto de horario
      if (error.message && error.message.includes('Conflicto de horario')) {
        toast.error(error.message);
      } else {
        toast.error('Error al añadir empleado');
      }
    } finally {
      setSaving(false);
    }
  };

  const COLORS = [
    { value: '#6366f1', label: 'Índigo' },
    { value: '#8b5cf6', label: 'Violeta' },
    { value: '#ec4899', label: 'Rosa' },
    { value: '#f59e0b', label: 'Ámbar' },
    { value: '#10b981', label: 'Verde' },
    { value: '#3b82f6', label: 'Azul' },
    { value: '#ef4444', label: 'Rojo' },
    { value: '#14b8a6', label: 'Teal' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">👤 Añadir Empleado Nuevo</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Completa la información y el horario en un solo paso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* COLUMNA IZQUIERDA: Información del empleado */}
            <div className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Macarena"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Email (opcional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="empleado@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+34 600 000 000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Recurso asignado - OBLIGATORIO */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Recurso asignado <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.assigned_resource_id || 'auto'}
              onChange={(e) => setFormData({ ...formData, assigned_resource_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              required
            >
              <option value="auto">✨ Automático (Recomendado)</option>
              {resources.map(resource => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
            {formData.assigned_resource_id === 'auto' && (
              <p className="text-xs text-green-600 mt-1 font-medium">
                ✓ El sistema asignará el mejor recurso disponible según horario
              </p>
            )}
            {resources.length === 0 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                💡 No hay recursos. El modo automático los asignará cuando los crees.
              </p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Color en calendario
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-full h-10 rounded-lg transition-all ${
                    formData.color === color.value
                      ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

            </div>

            {/* COLUMNA DERECHA: Horario semanal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-900">
                  📅 Horario Semanal <span className="text-red-500">*</span>
                </h4>
                {/* Botón copiar semana - Sutil */}
                <button
                  type="button"
                  onClick={() => {
                    // Buscar primer día trabajando (Lunes normalmente)
                    const firstWorkingDay = schedules.find(s => s.is_working && s.shifts.length > 0);
                    if (!firstWorkingDay) {
                      toast.error('Configura primero el horario de un día');
                      return;
                    }
                    
                    const dayName = dayNames.find(d => d.id === firstWorkingDay.day_of_week)?.name || 'primer día';
                    
                    if (!confirm(`¿Copiar el horario de ${dayName} a toda la semana?`)) {
                      return;
                    }
                    
                    // Copiar a todos los días que están trabajando
                    const newSchedules = schedules.map(s => {
                      if (s.day_of_week === firstWorkingDay.day_of_week) return s; // No copiar sobre sí mismo
                      if (!s.is_working) return s; // No copiar a días cerrados
                      
                      return {
                        ...s,
                        shifts: JSON.parse(JSON.stringify(firstWorkingDay.shifts)) // Deep copy
                      };
                    });
                    
                    setSchedules(newSchedules);
                    toast.success(`Horario copiado a toda la semana ✅`);
                  }}
                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] font-semibold rounded transition-all flex items-center gap-1"
                  title="Copiar el horario del primer día a toda la semana"
                >
                  <Copy className="w-2.5 h-2.5" />
                  Copiar semana
                </button>
              </div>
              
              {schedules.map((schedule, idx) => {
                const day = dayNames[idx];
                
                return (
                  <div 
                    key={day.id}
                    className={`flex items-start gap-3 p-2 rounded-lg border transition-all ${
                      schedule.is_working
                        ? 'bg-white border-purple-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Toggle ON/OFF */}
                    <label className="flex items-center cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={schedule.is_working}
                        onChange={() => handleToggleDay(idx)}
                        className="sr-only peer"
                      />
                      <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    </label>

                    {/* Nombre del día */}
                    <div className="w-16">
                      <p className={`text-xs font-bold ${schedule.is_working ? 'text-gray-900' : 'text-gray-400'}`}>
                        {day.name}
                      </p>
                    </div>

                    {/* Turnos */}
                    {schedule.is_working ? (
                      <div className="flex-1 space-y-1">
                        {schedule.shifts.map((shift, shiftIdx) => (
                          <div key={shiftIdx} className="flex items-center gap-1">
                            {schedule.shifts.length > 1 && (
                              <span className="text-xs text-gray-500 font-semibold w-5">
                                T{shiftIdx + 1}
                              </span>
                            )}
                            <input
                              type="time"
                              value={shift.start}
                              onChange={(e) => handleShiftTimeChange(idx, shiftIdx, 'start', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-transparent w-20"
                            />
                            <span className="text-gray-400 text-xs">—</span>
                            <input
                              type="time"
                              value={shift.end}
                              onChange={(e) => handleShiftTimeChange(idx, shiftIdx, 'end', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-transparent w-20"
                            />
                            
                            {schedule.shifts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveShift(idx, shiftIdx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Quitar turno"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => handleAddShift(idx)}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-semibold transition-colors mt-1"
                        >
                          <Plus className="w-3 h-3" />
                          Añadir turno
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 font-medium">Cerrado</p>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                <p className="text-xs text-gray-700">
                  <strong>💡 Turnos partidos:</strong> Usa "Añadir turno" para horarios de mañana y tarde (ej: 9-14h y 16-20h).
                </p>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Crear Empleado
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================
// MODAL: Editar Empleado (Nombre, Email, Recurso)
// ====================================
function EditEmployeeModal({ employee, resources, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: employee.name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    assigned_resource_id: employee.assigned_resource_id || '',
    color: employee.color || '#6366f1'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    if (!formData.assigned_resource_id) {
      toast.error('Debes asignar un recurso');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          assigned_resource_id: formData.assigned_resource_id,
          color: formData.color
        })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('¡Empleado actualizado! ✅');
      onSuccess();
    } catch (error) {
      console.error('Error actualizando empleado:', error);
      toast.error('Error al actualizar empleado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              ✏️ Editar Empleado
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: María García"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="maria@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+34 600 000 000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Recurso asignado */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Recurso asignado <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.assigned_resource_id}
              onChange={(e) => setFormData({ ...formData, assigned_resource_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              required
            >
              <option value="">Selecciona un recurso</option>
              {resources.map(resource => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Color en calendario
            </label>
            <div className="flex gap-2">
              {['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#eab308'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    formData.color === c ? 'ring-2 ring-offset-2 ring-purple-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================
// MODAL: Editar Horario del Empleado
// ====================================
function EditScheduleModal({ employee, onClose, onSuccess, resources = [] }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dayNames = [
    { id: 0, name: 'Domingo', short: 'Dom' },
    { id: 1, name: 'Lunes', short: 'Lun' },
    { id: 2, name: 'Martes', short: 'Mar' },
    { id: 3, name: 'Miércoles', short: 'Mié' },
    { id: 4, name: 'Jueves', short: 'Jue' },
    { id: 5, name: 'Viernes', short: 'Vie' },
    { id: 6, name: 'Sábado', short: 'Sáb' }
  ];

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', employee.id)
        .order('day_of_week', { ascending: true });

      if (error) throw error;

      // Crear array con los 7 días ordenados
      const scheduleMap = {};
      (data || []).forEach(s => {
        scheduleMap[s.day_of_week] = s;
      });

      const orderedSchedules = dayNames.map(day => {
        const existing = scheduleMap[day.id];
        return {
          id: existing?.id,
          day_of_week: day.id,
          is_working: existing?.is_working || false,
          // Convertir shifts de JSONB a array, o crear uno con start_time/end_time legacy
          shifts: existing?.shifts && existing.shifts.length > 0 
            ? existing.shifts 
            : existing?.start_time && existing?.end_time
              ? [{ start: existing.start_time, end: existing.end_time }]
              : [{ start: '09:00', end: '18:00' }],
          // ⭐ Asignación de recurso (automática por defecto, pero respeta lo guardado)
          resource_id: existing?.resource_id !== undefined ? existing.resource_id : null,
          resource_assignment_type: existing?.resource_assignment_type || 'auto'
        };
      });

      setSchedules(orderedSchedules);
    } catch (error) {
      console.error('Error cargando horarios:', error);
      toast.error('Error al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayIndex) => {
    setSchedules(prev => prev.map((s, i) => 
      i === dayIndex ? { ...s, is_working: !s.is_working } : s
    ));
  };

  const handleAddShift = (dayIndex) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      return {
        ...s,
        shifts: [...s.shifts, { start: '09:00', end: '18:00' }]
      };
    }));
  };

  const handleRemoveShift = (dayIndex, shiftIndex) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      const newShifts = s.shifts.filter((_, idx) => idx !== shiftIndex);
      return {
        ...s,
        shifts: newShifts.length > 0 ? newShifts : [{ start: '09:00', end: '18:00' }] // Siempre al menos 1 turno
      };
    }));
  };

  const handleShiftTimeChange = (dayIndex, shiftIndex, field, value) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      return {
        ...s,
        shifts: s.shifts.map((shift, idx) => 
          idx === shiftIndex ? { ...shift, [field]: value } : shift
        )
      };
    }));
  };

  // ⭐ NUEVO: Cambiar recurso asignado
  const handleResourceChange = (dayIndex, resourceId) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      return {
        ...s,
        resource_id: resourceId === 'auto' ? null : resourceId,
        resource_assignment_type: resourceId === 'auto' ? 'auto' : 'manual'
      };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 🛡️ VALIDACIÓN CRÍTICA: Horario empleado dentro de horario negocio
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', employee.business_id)
        .single();

      if (businessError) throw businessError;

      const businessHours = businessData?.settings?.operating_hours || {};
      const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      // Validar cada día del empleado
      for (const empSchedule of schedules) {
        if (!empSchedule.is_working) continue;
        
        const dayName = dayMapping[empSchedule.day_of_week];
        const businessDay = businessHours[dayName];
        
        // Si el negocio está cerrado ese día, el empleado NO puede trabajar
        if (!businessDay || businessDay.closed) {
          const dayNameSpanish = dayNames[empSchedule.day_of_week].name;
          toast.error(`❌ ${dayNameSpanish}: El negocio está cerrado. El empleado no puede trabajar.`);
          setSaving(false);
          return;
        }
        
        // Validar cada turno del empleado
        for (const empShift of empSchedule.shifts) {
          const businessShifts = businessDay.shifts || [{ start: businessDay.open, end: businessDay.close }];
          
          let isValid = false;
          for (const bizShift of businessShifts) {
            if (empShift.start >= bizShift.start && empShift.end <= bizShift.end) {
              isValid = true;
              break;
            }
          }
          
          if (!isValid) {
            const dayNameSpanish = dayNames[empSchedule.day_of_week].name;
            const businessHoursStr = businessShifts.map(s => `${s.start}-${s.end}`).join(', ');
            toast.error(
              `❌ ${dayNameSpanish}: Horario ${empShift.start}-${empShift.end} fuera del horario del negocio (${businessHoursStr}).`,
              { duration: 6000 }
            );
            setSaving(false);
            return;
          }
        }
      }
      
      // Validar que no haya turnos solapados en el mismo día
      for (let i = 0; i < schedules.length; i++) {
        const schedule = schedules[i];
        if (!schedule.is_working) continue;
        
        // Ordenar turnos por hora de inicio
        const sortedShifts = [...schedule.shifts].sort((a, b) => 
          a.start.localeCompare(b.start)
        );
        
        // Verificar solapamiento interno del día
        for (let j = 0; j < sortedShifts.length - 1; j++) {
          const current = sortedShifts[j];
          const next = sortedShifts[j + 1];
          
          if (current.end > next.start) {
            toast.error(`⚠️ Turnos solapados en ${dayNames[i].name}: ${current.start}-${current.end} y ${next.start}-${next.end}`);
            setSaving(false);
            return;
          }
        }
      }

      // Eliminar horarios existentes y crear nuevos
      const { error: deleteError } = await supabase
        .from('employee_schedules')
        .delete()
        .eq('employee_id', employee.id);

      if (deleteError) throw deleteError;

      // Insertar nuevos horarios con shifts
      const schedulesToInsert = schedules.map(s => ({
        business_id: employee.business_id,
        employee_id: employee.id,
        day_of_week: s.day_of_week,
        is_working: s.is_working,
        shifts: s.is_working ? s.shifts : [],
        // Legacy: guardar también start_time/end_time del primer turno (por compatibilidad)
        start_time: s.is_working && s.shifts.length > 0 ? s.shifts[0].start : null,
        end_time: s.is_working && s.shifts.length > 0 ? s.shifts[s.shifts.length - 1].end : null,
        breaks: [],
        // ⭐ NUEVO: Asignación de recurso
        resource_id: s.is_working ? s.resource_id : null,
        resource_assignment_type: s.is_working ? s.resource_assignment_type : 'auto'
      }));

      const { error: insertError } = await supabase
        .from('employee_schedules')
        .insert(schedulesToInsert);

      if (insertError) throw insertError;

      toast.success('¡Horario guardado! ✅');
      
      // ⭐ NUEVO: Auto-regenerar disponibilidades
      try {
        const AutoSlotRegenerationService = (await import('../services/AutoSlotRegenerationService')).default;
        await AutoSlotRegenerationService.regenerateAfterAction(
          employee.business_id,
          'employee_schedule_changed',
          { silent: true }
        );
      } catch (regError) {
        console.error('Error regenerando slots:', regError);
        // No bloquear el guardado por esto
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error guardando horario:', error);
      
      // Si es un error de validación de solapamiento de la función SQL
      if (error.message && error.message.includes('Conflicto de horario')) {
        toast.error(error.message);
      } else {
        toast.error('Error al guardar horario');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md"
                style={{ backgroundColor: employee.color || '#6366f1' }}
              >
                {employee.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  📅 Horario de {employee.name}
                </h3>
                <p className="text-[10px] text-gray-600">
                  Define cuándo trabaja cada día
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">Cargando horarios...</p>
            </div>
          ) : (
            <>
              {/* Botón copiar semana - Sutil y compacto */}
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => {
                    // Buscar primer día trabajando
                    const firstWorkingDay = schedules.find(s => s.is_working && s.shifts.length > 0);
                    if (!firstWorkingDay) {
                      toast.error('Configura primero el horario de un día');
                      return;
                    }
                    
                    const dayName = dayNames.find(d => d.id === firstWorkingDay.day_of_week)?.name || 'primer día';
                    
                    if (!confirm(`¿Copiar el horario de ${dayName} a toda la semana?`)) {
                      return;
                    }
                    
                    // Copiar a todos los días que están trabajando
                    const newSchedules = schedules.map(s => {
                      if (s.day_of_week === firstWorkingDay.day_of_week) return s;
                      if (!s.is_working) return s;
                      
                      return {
                        ...s,
                        shifts: JSON.parse(JSON.stringify(firstWorkingDay.shifts))
                      };
                    });
                    
                    setSchedules(newSchedules);
                    toast.success(`Horario copiado a toda la semana ✅`);
                  }}
                  className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] font-semibold rounded-lg transition-all flex items-center gap-1"
                  title="Copiar el horario del primer día a toda la semana"
                >
                  <Copy className="w-3 h-3" />
                  Copiar semana
                </button>
              </div>
              
              <div className="space-y-2">
              {schedules.map((schedule, idx) => {
                const day = dayNames[idx];
                
                return (
                  <div 
                    key={day.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                      schedule.is_working
                        ? 'bg-white border-purple-200 hover:border-purple-400'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Toggle ON/OFF */}
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedule.is_working}
                        onChange={() => handleToggleDay(idx)}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>

                    {/* Nombre del día */}
                    <div className="w-16">
                      <p className={`text-xs font-bold ${schedule.is_working ? 'text-gray-900' : 'text-gray-400'}`}>
                        {day.name}
                      </p>
                    </div>

                    {/* Turnos (múltiples) */}
                    {schedule.is_working ? (
                      <div className="flex-1 space-y-2">
                        {schedule.shifts.map((shift, shiftIdx) => (
                          <div key={shiftIdx} className="flex items-center gap-2">
                            {schedule.shifts.length > 1 && (
                              <span className="text-xs text-gray-500 font-semibold w-6">
                                T{shiftIdx + 1}
                              </span>
                            )}
                            <input
                              type="time"
                              value={shift.start}
                              onChange={(e) => handleShiftTimeChange(idx, shiftIdx, 'start', e.target.value)}
                              className="px-1.5 py-0.5 border border-gray-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                            />
                            <span className="text-gray-400 text-xs">—</span>
                            <input
                              type="time"
                              value={shift.end}
                              onChange={(e) => handleShiftTimeChange(idx, shiftIdx, 'end', e.target.value)}
                              className="px-1.5 py-0.5 border border-gray-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                            />
                            
                            {/* Botón Quitar (solo si hay más de 1 turno) */}
                            {schedule.shifts.length > 1 && (
                              <button
                                onClick={() => handleRemoveShift(idx, shiftIdx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Quitar turno"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        
                        {/* ⭐ Selector de Recurso - Compacto */}
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">
                            🪑 Sillón:
                          </label>
                          <select
                            value={schedule.resource_id || 'auto'}
                            onChange={(e) => handleResourceChange(idx, e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent bg-white"
                          >
                            <option value="auto">✨ Automático</option>
                            {resources.map(resource => (
                              <option key={resource.id} value={resource.id}>
                                {resource.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Botón Añadir Turno */}
                        <button
                          onClick={() => handleAddShift(idx)}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-semibold transition-colors mt-2"
                        >
                          <Plus className="w-3 h-3" />
                          Añadir turno
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-sm text-gray-400 font-medium">Cerrado</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}

          {/* Nota informativa - Compacta */}
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-[10px] text-gray-700">
              <strong>💡 Tip:</strong> Usa "Añadir turno" para turnos partidos (ej: 9-14h y 16-20h). El sillón automático asigna el mejor disponible.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Horario
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================
// MODAL: Gestionar Ausencias del Empleado
// ====================================
function ManageAbsencesModal({ employee, businessId, onClose, onSuccess }) {
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState(null);
  
  const [formData, setFormData] = useState({
    reason: 'vacation',
    reason_label: '',
    start_date: '',
    end_date: '',
    all_day: true, // ⭐ Por defecto todo el día
    start_time: '09:00',
    end_time: '18:00',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const ABSENCE_TYPES = [
    { value: 'vacation', label: '🏖️ Vacaciones', color: 'bg-blue-100 text-blue-800' },
    { value: 'medical', label: '🤒 Cita médica', color: 'bg-orange-100 text-orange-800' },
    { value: 'sick_leave', label: '🤕 Baja médica', color: 'bg-red-100 text-red-800' },
    { value: 'personal', label: '🏠 Permiso personal', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'other', label: '📋 Otro', color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    loadAbsences();
  }, []);

  const loadAbsences = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_absences')
        .select('*')
        .eq('employee_id', employee.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setAbsences(data || []);
    } catch (error) {
      console.error('Error cargando ausencias:', error);
      toast.error('Error al cargar ausencias');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      reason: 'vacation',
      reason_label: '',
      start_date: '',
      end_date: '',
      all_day: true,
      start_time: '09:00',
      end_time: '18:00',
      notes: ''
    });
    setEditingAbsence(null);
    setShowAddForm(true);
  };

  const handleEdit = (absence) => {
    setFormData({
      reason: absence.reason || 'vacation',
      reason_label: absence.reason_label || '',
      start_date: absence.start_date,
      end_date: absence.end_date,
      all_day: absence.all_day !== undefined ? absence.all_day : true,
      start_time: absence.start_time || '09:00',
      end_time: absence.end_time || '18:00',
      notes: absence.notes || ''
    });
    setEditingAbsence(absence);
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.start_date || !formData.end_date) {
      toast.error('Las fechas son obligatorias');
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('La fecha de fin debe ser posterior a la de inicio');
      return;
    }

    setSaving(true);
    try {
      if (editingAbsence) {
        // Actualizar existente
        const { error } = await supabase
          .from('employee_absences')
          .update({
            reason: formData.reason,
            reason_label: formData.reason_label.trim() || null,
            start_date: formData.start_date,
            end_date: formData.end_date,
            all_day: formData.all_day, // ⭐ Usar valor del formulario
            start_time: !formData.all_day ? formData.start_time : null,
            end_time: !formData.all_day ? formData.end_time : null,
            notes: formData.notes.trim() || null,
            approved: true
          })
          .eq('id', editingAbsence.id);

        if (error) throw error;
        toast.success('Ausencia actualizada ✅');
      } else {
        // Crear nueva
        const { error } = await supabase
          .from('employee_absences')
          .insert([{
            business_id: businessId,
            employee_id: employee.id,
            reason: formData.reason,
            reason_label: formData.reason_label.trim() || null,
            start_date: formData.start_date,
            end_date: formData.end_date,
            all_day: formData.all_day, // ⭐ Usar valor del formulario
            start_time: !formData.all_day ? formData.start_time : null,
            end_time: !formData.all_day ? formData.end_time : null,
            notes: formData.notes.trim() || null,
            approved: true
          }]);

        if (error) throw error;
        toast.success('Ausencia añadida ✅');
      }

      setShowAddForm(false);
      setEditingAbsence(null);
      loadAbsences();
      
      // ⭐ Notificar al calendario que las ausencias han cambiado
      window.dispatchEvent(new CustomEvent('absences-updated'));
    } catch (error) {
      console.error('Error guardando ausencia:', error);
      toast.error('Error al guardar ausencia');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (absenceId) => {
    if (!confirm('¿Eliminar esta ausencia?')) return;

    try {
      const { error } = await supabase
        .from('employee_absences')
        .delete()
        .eq('id', absenceId);

      if (error) throw error;

      toast.success('Ausencia eliminada');
      loadAbsences();
      
      // ⭐ Notificar al calendario que las ausencias han cambiado
      window.dispatchEvent(new CustomEvent('absences-updated'));
    } catch (error) {
      console.error('Error eliminando ausencia:', error);
      toast.error('Error al eliminar ausencia');
    }
  };

  const getTypeInfo = (type) => {
    return ABSENCE_TYPES.find(t => t.value === type) || ABSENCE_TYPES[ABSENCE_TYPES.length - 1];
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysCount = (start, end) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md"
                style={{ backgroundColor: employee.color || '#6366f1' }}
              >
                {employee.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  🏖️ Ausencias de {employee.name}
                </h3>
                <p className="text-xs text-gray-600">
                  Vacaciones, bajas, permisos y otros
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {/* Botón añadir */}
          {!showAddForm && (
            <button
              onClick={handleAdd}
              className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Añadir Ausencia
            </button>
          )}

          {/* Formulario de añadir/editar */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3">
                {editingAbsence ? '✏️ Editar Ausencia' : '➕ Nueva Ausencia'}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Tipo */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tipo de ausencia
                  </label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                    required
                  >
                    {ABSENCE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha inicio */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                    required
                  />
                </div>

                {/* Fecha fin */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                    required
                  />
                </div>

                {/* ⭐ NUEVO: Checkbox Todo el día */}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.all_day}
                      onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Todo el día (vacaciones, baja completa, etc.)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Desmarca si es una cita médica u otra ausencia con horario específico
                  </p>
                </div>

                {/* ⭐ NUEVO: Campos de hora (solo si NO es todo el día) */}
                {!formData.all_day && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Hora inicio
                      </label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Hora fin
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Motivo */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Motivo (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.reason_label}
                    onChange={(e) => setFormData({ ...formData, reason_label: e.target.value })}
                    placeholder="Ej: Vacaciones verano"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>

                {/* Notas */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Notas internas (opcional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Información adicional..."
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm resize-none"
                  />
                </div>
              </div>

              {/* Botones del formulario */}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingAbsence(null);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingAbsence ? 'Actualizar' : 'Guardar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Lista de ausencias */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-600">Cargando ausencias...</p>
              </div>
            ) : absences.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                <Palmtree className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">No hay ausencias registradas</p>
                <p className="text-xs text-gray-400 mt-1">Añade vacaciones, bajas o permisos</p>
              </div>
            ) : (
              absences.map(absence => {
                const typeInfo = getTypeInfo(absence.reason);
                const isActive = new Date(absence.start_date + 'T00:00:00') <= new Date() && 
                                new Date(absence.end_date + 'T00:00:00') >= new Date();
                const isPast = new Date(absence.end_date + 'T00:00:00') < new Date();

                return (
                  <div
                    key={absence.id}
                    className={`bg-white border-2 rounded-xl p-4 transition-all ${
                      isActive 
                        ? 'border-green-300 shadow-md' 
                        : isPast 
                          ? 'border-gray-200 opacity-60' 
                          : 'border-gray-200 hover:border-green-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Indicador visual */}
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${typeInfo.color}`}>
                        {typeInfo.label}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-900">
                            {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                          </p>
                          <span className="text-xs text-gray-500">
                            ({getDaysCount(absence.start_date, absence.end_date)} días)
                          </span>
                          {isActive && (
                            <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded">
                              ACTIVA AHORA
                            </span>
                          )}
                          {isPast && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
                              Pasada
                            </span>
                          )}
                        </div>
                        
                        {/* ⭐ Mostrar horarios si NO es día completo */}
                        {!absence.all_day && absence.start_time && absence.end_time && (
                          <p className="text-sm font-semibold text-blue-600 mb-1">
                            🕐 {absence.start_time.substring(0, 5)} - {absence.end_time.substring(0, 5)}
                          </p>
                        )}
                        
                        {absence.reason_label && (
                          <p className="text-xs text-gray-600 mt-1">
                            📝 {absence.reason_label}
                          </p>
                        )}
                        {absence.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            {absence.notes}
                          </p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(absence)}
                          className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(absence.id)}
                          className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


