// UnassignedAppointmentsReview.jsx - UI de Revisión para Eventos Sin Asignar
// FASE 2: Permite asignar manualmente trabajadores a eventos importados sin employee_id

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { AlertCircle, User, Calendar, Clock, CheckCircle2, XCircle, Save } from 'lucide-react';

export default function UnassignedAppointmentsReview({ 
    businessId, 
    unassignedAppointments = [],
    onComplete 
}) {
    const [employees, setEmployees] = useState([]);
    const [resources, setResources] = useState({});
    const [assignments, setAssignments] = useState({}); // { appointment_id: employee_id }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (businessId && unassignedAppointments.length > 0) {
            loadEmployees();
            loadResources();
        }
    }, [businessId, unassignedAppointments]);

    const loadEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('id, name')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error cargando empleados:', error);
            toast.error('Error cargando empleados');
        }
    };

    const loadResources = async () => {
        try {
            const resourceIds = [...new Set(unassignedAppointments.map(a => a.resource_id).filter(Boolean))];
            
            if (resourceIds.length === 0) {
                setResources({});
                return;
            }

            const { data, error } = await supabase
                .from('resources')
                .select('id, name')
                .in('id', resourceIds);

            if (error) throw error;

            const resourcesMap = (data || []).reduce((acc, r) => {
                acc[r.id] = r.name;
                return acc;
            }, {});

            setResources(resourcesMap);
        } catch (error) {
            console.error('Error cargando recursos:', error);
        }
    };

    const handleAssignmentChange = (appointmentId, employeeId) => {
        setAssignments(prev => ({
            ...prev,
            [appointmentId]: employeeId || null
        }));
    };

    const handleSave = async () => {
        if (Object.keys(assignments).length === 0) {
            toast.error('No hay asignaciones para guardar');
            return;
        }

        try {
            setSaving(true);
            toast.loading('Guardando asignaciones...', { id: 'save-assignments' });

            const updates = Object.entries(assignments).map(([appointmentId, employeeId]) => {
                if (!employeeId) return null;
                return supabase
                    .from('appointments')
                    .update({ 
                        employee_id: employeeId,
                        metadata: {
                            requires_manual_assignment: false,
                            manually_assigned: true,
                        }
                    })
                    .eq('id', appointmentId);
            }).filter(Boolean);

            await Promise.all(updates);

            toast.dismiss('save-assignments');
            toast.success(`✅ ${updates.length} asignación(es) guardada(s) correctamente`);
            
            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error('Error guardando asignaciones:', error);
            toast.dismiss('save-assignments');
            toast.error('Error al guardar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (unassignedAppointments.length === 0) {
        return null;
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const formatTime = (timeStr) => {
        return timeStr ? timeStr.substring(0, 5) : '00:00';
    };

    return (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                        ⚠️ Eventos Sin Asignar ({unassignedAppointments.length})
                    </h4>
                    <p className="text-sm text-gray-600">
                        Estos eventos fueron importados pero no se pudo asignar automáticamente un trabajador. 
                        Por favor, asigna manualmente el trabajador correcto para cada evento.
                    </p>
                </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
                {unassignedAppointments.map((appointment) => (
                    <div 
                        key={appointment.appointment_id} 
                        className="p-3 bg-white rounded-lg border border-gray-200"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-900">
                                        {formatDate(appointment.appointment_date)}
                                    </span>
                                    <Clock className="w-4 h-4 text-gray-400 ml-2" />
                                    <span className="text-sm text-gray-600">
                                        {formatTime(appointment.appointment_time)}
                                    </span>
                                </div>
                                
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                    {appointment.summary || 'Sin título'}
                                </p>
                                
                                {appointment.customer_name && (
                                    <p className="text-xs text-gray-500 mb-2">
                                        Cliente: {appointment.customer_name}
                                    </p>
                                )}
                                
                                {appointment.resource_id && resources[appointment.resource_id] && (
                                    <p className="text-xs text-gray-500 mb-2">
                                        Recurso: {resources[appointment.resource_id]}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={assignments[appointment.appointment_id] || ''}
                                    onChange={(e) => handleAssignmentChange(appointment.appointment_id, e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                >
                                    <option value="">-- Seleccionar trabajador --</option>
                                    {employees.map(employee => (
                                        <option key={employee.id} value={employee.id}>
                                            {employee.name}
                                        </option>
                                    ))}
                                </select>
                                
                                {assignments[appointment.appointment_id] ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-400" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || Object.keys(assignments).length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : `Guardar Asignaciones (${Object.keys(assignments).length})`}
                </button>
            </div>
        </div>
    );
}

