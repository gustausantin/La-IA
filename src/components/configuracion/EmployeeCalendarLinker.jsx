// EmployeeCalendarLinker.jsx - Vincular empleados con calendarios de Google Calendar (OBLIGATORIO)
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Users, Save, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function EmployeeCalendarLinker({ 
    businessId, 
    integrationConfig, 
    onUpdate 
}) {
    const [employees, setEmployees] = useState([]);
    const [calendars, setCalendars] = useState([]);
    const [mapping, setMapping] = useState({}); // calendar_id -> employee_id (inverso del config)
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (businessId) {
            loadEmployees();
            loadCalendars();
            loadCurrentMapping();
        }
    }, [businessId, integrationConfig]);

    // ✅ Cargar empleados activos desde BD cada vez (información actualizada)
    const loadEmployees = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('employees')
                .select('id, name')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setEmployees(data || []);
            console.log(`👥 Empleados cargados: ${(data || []).length}`);
        } catch (error) {
            console.error('Error cargando empleados:', error);
            toast.error('Error cargando empleados');
        } finally {
            setLoading(false);
        }
    };

    const loadCalendars = async () => {
        try {
            // Obtener calendarios seleccionados desde la configuración
            const calendarIds = integrationConfig?.calendar_ids || 
                               (integrationConfig?.calendar_id ? [integrationConfig.calendar_id] : []);
            
            if (calendarIds.length === 0) {
                setCalendars([]);
                return;
            }

            // Obtener información de la integración para hacer llamada a Google Calendar API
            const { data: integration } = await supabase
                .from('integrations')
                .select('access_token, refresh_token, token_expires_at')
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar')
                .eq('is_active', true)
                .single();

            if (!integration) {
                setCalendars([]);
                return;
            }

            // Llamar a la función para listar calendarios
            const { data: calendarsData, error } = await supabase.functions.invoke('list-google-calendars', {
                body: { business_id: businessId }
            });

            if (error) throw error;

            // Filtrar solo los calendarios seleccionados
            const selectedCalendars = (calendarsData?.calendars || []).filter(cal => 
                calendarIds.includes(cal.id)
            );

            setCalendars(selectedCalendars);
        } catch (error) {
            console.error('Error cargando calendarios:', error);
            toast.error('Error cargando calendarios de Google Calendar');
        }
    };

    // Cargar mapeo actual y convertirlo a formato inverso (calendar_id -> employee_id)
    const loadCurrentMapping = () => {
        const employeeMapping = integrationConfig?.employee_calendar_mapping || {};
        // Convertir de { employee_id: calendar_id } a { calendar_id: employee_id }
        const inverseMapping = {};
        Object.keys(employeeMapping).forEach(employeeId => {
            const calendarId = employeeMapping[employeeId];
            if (calendarId) {
                inverseMapping[calendarId] = employeeId;
            }
        });
        setMapping(inverseMapping);
    };

    const handleMappingChange = (calendarId, employeeId) => {
        setMapping(prev => ({
            ...prev,
            [calendarId]: employeeId || null
        }));
        // Limpiar error de validación cuando el usuario hace cambios
        setValidationError('');
    };

    // ✅ Calcular si el mapeo es válido (sin efectos secundarios)
    const isValidMapping = React.useMemo(() => {
        const calendarIds = integrationConfig?.calendar_ids || 
                           (integrationConfig?.calendar_id ? [integrationConfig.calendar_id] : []);
        
        const unassignedCalendars = calendarIds.filter(calId => !mapping[calId]);
        return unassignedCalendars.length === 0;
    }, [mapping, integrationConfig]);

    // ✅ Actualizar mensaje de error cuando cambie la validación
    React.useEffect(() => {
        if (!isValidMapping) {
            const calendarIds = integrationConfig?.calendar_ids || 
                               (integrationConfig?.calendar_id ? [integrationConfig.calendar_id] : []);
            const unassignedCalendars = calendarIds.filter(calId => !mapping[calId]);
            const unassignedNames = unassignedCalendars.map(calId => {
                const calendar = calendars.find(c => c.id === calId);
                return calendar?.summary || calId;
            });
            const errorMessage = `Todos los calendarios deben tener un trabajador asignado. Faltan: ${unassignedNames.join(', ')}`;
            setValidationError(errorMessage);
        } else {
            setValidationError('');
        }
    }, [isValidMapping, mapping, calendars, integrationConfig]);

    // Función para validar antes de guardar (sin efectos secundarios en render)
    const validateMapping = () => {
        const calendarIds = integrationConfig?.calendar_ids || 
                           (integrationConfig?.calendar_id ? [integrationConfig.calendar_id] : []);
        
        const unassignedCalendars = calendarIds.filter(calId => !mapping[calId]);
        
        if (unassignedCalendars.length > 0) {
            const unassignedNames = unassignedCalendars.map(calId => {
                const calendar = calendars.find(c => c.id === calId);
                return calendar?.summary || calId;
            });
            setValidationError(`Todos los calendarios deben tener un trabajador asignado. Faltan: ${unassignedNames.join(', ')}`);
            return false;
        }
        
        setValidationError('');
        return true;
    };

    const handleSave = async () => {
        // ✅ Validar antes de guardar
        if (!validateMapping()) {
            toast.error('Por favor, asigna un trabajador a todos los calendarios');
            return;
        }

        try {
            setSaving(true);
            toast.loading('Guardando vinculación...', { id: 'save-mapping' });

            // Obtener integración actual
            const { data: integration, error: integrationError } = await supabase
                .from('integrations')
                .select('id, config')
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar')
                .eq('is_active', true)
                .single();

            if (integrationError || !integration) {
                throw new Error('No se encontró la integración de Google Calendar');
            }

            // Convertir de { calendar_id: employee_id } a { employee_id: calendar_id }
            const employeeMapping = {};
            Object.keys(mapping).forEach(calendarId => {
                const employeeId = mapping[calendarId];
                if (employeeId) {
                    employeeMapping[employeeId] = calendarId;
                }
            });

            // Actualizar config con el nuevo mapping
            const updatedConfig = {
                ...integration.config,
                employee_calendar_mapping: employeeMapping
            };

            const { error: updateError } = await supabase
                .from('integrations')
                .update({ config: updatedConfig })
                .eq('id', integration.id);

            if (updateError) throw updateError;

            toast.dismiss('save-mapping');
            toast.success('✅ Vinculación guardada correctamente');
            
            if (onUpdate) {
                onUpdate();
            }
        } catch (error) {
            console.error('Error guardando vinculación:', error);
            toast.dismiss('save-mapping');
            toast.error('Error al guardar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Si no hay empleados o calendarios, no mostrar nada
    if (employees.length === 0 || calendars.length === 0) {
        return null;
    }

    return (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3 mb-4">
                <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                        Vincular Calendarios con Trabajadores <span className="text-red-600">*</span>
                    </h4>
                    <p className="text-sm text-gray-600">
                        Cada calendario debe estar vinculado a un trabajador. Si un calendario tiene reservas de múltiples trabajadores, asigna el trabajador principal.
                    </p>
                </div>
            </div>

            {/* ✅ Mensaje de advertencia si hay calendarios sin asignar */}
            {validationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-800">
                            <strong>Error de validación:</strong> {validationError}
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ Advertencia si hay más calendarios que empleados */}
            {calendars.length > employees.length && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-800">
                            <strong>Advertencia:</strong> Tienes {calendars.length} calendario(s) pero solo {employees.length} trabajador(es). 
                            Algunos calendarios pueden quedar sin asignar. Considera crear más trabajadores o seleccionar menos calendarios.
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {calendars.map(calendar => (
                    <div key={calendar.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex-1">
                            <p className="font-medium text-gray-900">{calendar.summary || calendar.id}</p>
                            <p className="text-xs text-gray-500">Calendario de Google</p>
                        </div>
                        <select
                            value={mapping[calendar.id] || ''}
                            onChange={(e) => handleMappingChange(calendar.id, e.target.value)}
                            className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                mapping[calendar.id] 
                                    ? 'border-green-300 bg-green-50' 
                                    : 'border-red-300 bg-red-50'
                            }`}
                            required
                        >
                            <option value="">-- Selecciona trabajador * --</option>
                            {employees.map(employee => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.name}
                                </option>
                            ))}
                        </select>
                        {mapping[calendar.id] ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || !isValidMapping}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : 'Guardar Vinculación'}
                </button>
            </div>
        </div>
    );
}

