// GoogleCalendarImportModal.jsx - Modal para importar eventos de Google Calendar
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import {
    Calendar,
    X,
    Check,
    AlertCircle,
    Clock,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function GoogleCalendarImportModal({ 
    businessId, 
    isOpen, 
    onClose, 
    onComplete 
}) {
    const [loading, setLoading] = useState(false);
    const [classifying, setClassifying] = useState(true);
    const [safeEvents, setSafeEvents] = useState([]);
    const [doubtfulEvents, setDoubtfulEvents] = useState([]);
    const [timedEvents, setTimedEvents] = useState([]); // Eventos con hora específica

    useEffect(() => {
        if (isOpen && businessId) {
            loadEvents();
        }
    }, [isOpen, businessId]);

    const loadEvents = async () => {
        try {
            setClassifying(true);
            setLoading(true);

            const { data, error } = await supabase.functions.invoke('import-google-calendar-initial', {
                body: {
                    business_id: businessId,
                    action: 'classify'
                }
            });

            if (error) throw error;

            if (data?.success) {
                console.log('📥 Eventos clasificados:', {
                    safe: data.safe?.length || 0,
                    doubtful: data.doubtful?.length || 0,
                    timedEvents: data.timedEvents?.length || 0,
                    safeEvents: data.safe,
                    doubtfulEvents: data.doubtful,
                    timedEventsData: data.timedEvents
                });
                
                setSafeEvents(data.safe || []);
                setDoubtfulEvents(data.doubtful || []);
                setTimedEvents(data.timedEvents || []); // ✅ Cargar eventos con hora
                
                // Si no hay eventos, mostrar información útil
                if ((data.safe?.length || 0) === 0 && (data.doubtful?.length || 0) === 0 && (data.timedEvents?.length || 0) === 0) {
                    console.warn('⚠️ No se encontraron eventos. Verifica que estás usando el calendario correcto.');
                }
            } else {
                throw new Error(data?.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error cargando eventos:', error);
            console.error('❌ Error completo:', JSON.stringify(error, null, 2));
            
            // Intentar obtener más detalles del error
            let errorMessage = 'Error desconocido';
            if (error?.message) {
                errorMessage = error.message;
            } else if (error?.error) {
                errorMessage = error.error;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            // Si hay datos en la respuesta, intentar obtener el mensaje de error
            if (error?.context?.body) {
                try {
                    const errorBody = typeof error.context.body === 'string' 
                        ? JSON.parse(error.context.body) 
                        : error.context.body;
                    if (errorBody?.error) {
                        errorMessage = errorBody.error;
                    }
                    if (errorBody?.details) {
                        console.error('❌ Detalles del error:', errorBody.details);
                    }
                } catch (e) {
                    console.error('❌ Error parseando respuesta:', e);
                }
            }
            
            toast.error('Error cargando eventos de Google Calendar: ' + errorMessage);
        } finally {
            setClassifying(false);
            setLoading(false);
        }
    };

    const toggleEvent = (eventId, category) => {
        if (category === 'safe') {
            setSafeEvents(prev => prev.map(e => 
                e.id === eventId ? { ...e, selected: !e.selected } : e
            ));
        } else if (category === 'doubtful') {
            setDoubtfulEvents(prev => prev.map(e => 
                e.id === eventId ? { ...e, selected: !e.selected } : e
            ));
        } else if (category === 'timed') {
            setTimedEvents(prev => prev.map(e => 
                e.id === eventId ? { ...e, selected: !e.selected } : e
            ));
        }
    };

    const toggleAllSafe = () => {
        const allSelected = safeEvents.every(e => e.selected);
        setSafeEvents(prev => prev.map(e => ({ ...e, selected: !allSelected })));
    };

    const toggleAllDoubtful = () => {
        const allSelected = doubtfulEvents.every(e => e.selected);
        setDoubtfulEvents(prev => prev.map(e => ({ ...e, selected: !allSelected })));
    };

    const toggleAllTimed = () => {
        const allSelected = timedEvents.every(e => e.selected);
        setTimedEvents(prev => prev.map(e => ({ ...e, selected: !allSelected })));
    };

    const handleImport = async () => {
        const selectedSafe = safeEvents.filter(e => e.selected);
        const selectedDoubtful = doubtfulEvents.filter(e => e.selected);
        const selectedTimed = timedEvents.filter(e => e.selected);
        const allSelected = [...selectedSafe, ...selectedDoubtful, ...selectedTimed]; // ✅ Incluir eventos con hora

        if (allSelected.length === 0) {
            toast.error('Selecciona al menos un evento para importar');
            return;
        }

        try {
            setLoading(true);
            
            // ✅ Mostrar estado de carga claro
            toast.loading(
                `⏳ Importando ${allSelected.length} evento(s)... Por favor espera.`,
                { 
                    id: 'import-events',
                    duration: Infinity // No desaparecer hasta que se complete
                }
            );

            // ✅ DEBUG: Verificar que los eventos tengan start y end
            console.log('📤 Eventos a importar:', allSelected.length);
            console.log('📤 Primer evento completo:', JSON.stringify(allSelected[0] || {}, null, 2));
            console.log('📤 Estructura de eventos:', allSelected.map(e => ({
                id: e.id,
                summary: e.summary,
                start: e.start,
                end: e.end,
                type: e.type,
                selected: e.selected,
                hasStartDate: !!e.start?.date,
                hasStartDateTime: !!e.start?.dateTime
            })));

            const { data, error } = await supabase.functions.invoke('import-google-calendar-initial', {
                body: {
                    business_id: businessId,
                    action: 'import',
                    events: allSelected
                }
            });

            console.log('📥 Respuesta del backend:', JSON.stringify(data, null, 2));

            if (error) {
                console.error('❌ Error en la respuesta:', error);
                throw error;
            }

            toast.dismiss('import-events');

            // ✅ Manejar respuesta con conflictos
            if (data?.has_conflicts) {
                console.warn('⚠️ Se detectaron conflictos:', data.conflicts);
                // Mostrar conflicto pero continuar con el resumen
            }

            if (data?.success) {
                const importedCount = data.imported || 0;
                const calendarExceptions = data.calendar_exceptions || 0;
                const appointments = data.appointments || 0;
                const skippedCount = data.skipped || 0;
                
                // ✅ Resumen detallado de la importación
                if (importedCount > 0) {
                    let summaryMessage = `✅ Importación completada: ${importedCount} evento(s) importado(s)`;
                    
                    // Agregar detalles si hay información disponible
                    const details = [];
                    if (calendarExceptions > 0) {
                        details.push(`${calendarExceptions} día(s) cerrado(s)`);
                    }
                    if (appointments > 0) {
                        details.push(`${appointments} cita(s) bloqueada(s)`);
                    }
                    if (skippedCount > 0) {
                        details.push(`${skippedCount} omitido(s)`);
                    }
                    
                    if (details.length > 0) {
                        summaryMessage += ` (${details.join(', ')})`;
                    }
                    
                    toast.success(summaryMessage, { duration: 6000 });
                } else {
                    toast.error('No se importó ningún evento', { duration: 4000 });
                }
                
                // ✅ Mostrar advertencia de conflictos si los hay
                if (data?.has_conflicts && data?.conflicts?.length > 0) {
                    toast.error(
                        `⚠️ ${data.conflicts.length} conflicto(s) detectado(s) - algunos eventos no se importaron`,
                        { duration: 7000 }
                    );
                }
                
                // ✅ FASE 2: Pasar eventos sin asignar al componente padre
                onComplete?.(data.unassigned_appointments || []);
                onClose();
            } else {
                throw new Error(data?.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error importando eventos:', error);
            toast.dismiss('import-events');
            toast.error('Error importando eventos: ' + (error.message || 'Error desconocido'), { duration: 6000 });
        } finally {
            setLoading(false);
        }
    };

    const formatEventDate = (event) => {
        const startDateStr = event.start?.date || event.start?.dateTime?.split('T')[0];
        const endDateStr = event.end?.date || event.end?.dateTime?.split('T')[0];
        
        if (!startDateStr) return 'Fecha desconocida';
        
        try {
            const startDate = new Date(startDateStr);
            const formattedStart = format(startDate, 'dd MMM yyyy', { locale: es });
            
            // ✅ Si hay fecha de fin y es diferente, mostrar rango
            if (endDateStr && endDateStr !== startDateStr) {
                // Google Calendar usa endDate exclusivo, así que restamos 1 día para mostrar el último día real
                const endDate = new Date(endDateStr);
                endDate.setDate(endDate.getDate() - 1);
                const formattedEnd = format(endDate, 'dd MMM yyyy', { locale: es });
                
                // Si es el mismo mes, mostrar formato corto
                if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
                    return `${format(startDate, 'dd', { locale: es })} - ${format(endDate, 'dd MMM yyyy', { locale: es })}`;
                }
                return `${formattedStart} - ${formattedEnd}`;
            }
            
            return formattedStart;
        } catch {
            return startDateStr;
        }
    };

    const formatEventDateTime = (event) => {
        const startDateTime = event.start?.dateTime;
        if (!startDateTime) return 'Hora desconocida';
        
        try {
            const startDate = new Date(startDateTime);
            const formattedDate = format(startDate, 'dd MMM yyyy', { locale: es });
            const formattedTime = format(startDate, 'HH:mm', { locale: es });
            return `${formattedDate} ${formattedTime}`;
        } catch {
            return startDateTime;
        }
    };

    if (!isOpen) return null;

    const totalSelected = safeEvents.filter(e => e.selected).length + 
                         doubtfulEvents.filter(e => e.selected).length + 
                         timedEvents.filter(e => e.selected).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Importar eventos de Google Calendar
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Importa eventos futuros (desde mañana) de todo el día y con hora específica
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Información importante */}
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                                    ⚠️ Importante
                                </h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• <strong>⚠️ Solo se importan eventos FUTUROS</strong> (desde mañana en adelante). Los eventos pasados o de hoy se omiten.</li>
                                    <li>• <strong>Eventos de TODO EL DÍA</strong> se importan como días cerrados o eventos especiales</li>
                                    <li>• <strong>Eventos con HORA específica</strong> se importan como appointments bloqueados (reservas, citas)</li>
                                    <li>• <strong>Los eventos con hora se importan automáticamente</strong> y bloquean la disponibilidad en ese horario</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {classifying ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                            <p className="text-gray-600">Clasificando eventos de Google Calendar...</p>
                        </div>
                    ) : (
                        <>
                            {/* Eventos Seguros */}
                            {safeEvents.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-5 h-5 text-green-600" />
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Eventos Seguros ({safeEvents.length})
                                            </h3>
                                        </div>
                                        <button
                                            onClick={toggleAllSafe}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            {safeEvents.every(e => e.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Estos eventos son claramente días cerrados y se importarán automáticamente:
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                                        {safeEvents.map(event => (
                                            <label
                                                key={event.id}
                                                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={event.selected}
                                                    onChange={() => toggleEvent(event.id, 'safe')}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <span className="flex-1 text-sm">
                                                    <span className="font-medium">{formatEventDate(event)}</span>
                                                    <span className="text-gray-600 ml-2">- {event.summary}</span>
                                                </span>
                                                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                                    Cerrado
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Eventos con Dudas */}
                            {doubtfulEvents.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Eventos con Dudas ({doubtfulEvents.length})
                                            </h3>
                                        </div>
                                        <button
                                            onClick={toggleAllDoubtful}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            {doubtfulEvents.every(e => e.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Selecciona qué eventos quieres importar. Estos pueden ser eventos especiales o días cerrados:
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                                        {doubtfulEvents.map(event => (
                                            <label
                                                key={event.id}
                                                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={event.selected}
                                                    onChange={() => toggleEvent(event.id, 'doubtful')}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <span className="flex-1 text-sm">
                                                    <span className="font-medium">{formatEventDate(event)}</span>
                                                    <span className="text-gray-600 ml-2">- {event.summary}</span>
                                                </span>
                                                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                                    Especial
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Eventos con Hora (Reservas/Citas) */}
                            {timedEvents.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-blue-600" />
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Eventos con Hora ({timedEvents.length})
                                            </h3>
                                        </div>
                                        <button
                                            onClick={toggleAllTimed}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            {timedEvents.every(e => e.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Estos eventos se importarán como appointments bloqueados y bloquearán la disponibilidad en esos horarios:
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                                        {timedEvents.map(event => (
                                            <label
                                                key={event.id}
                                                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={event.selected}
                                                    onChange={() => toggleEvent(event.id, 'timed')}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <Clock className="w-4 h-4 text-blue-500" />
                                                <span className="flex-1 text-sm">
                                                    <span className="font-medium">{formatEventDateTime(event)}</span>
                                                    <span className="text-gray-600 ml-2">- {event.summary}</span>
                                                </span>
                                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                                    Reserva
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {safeEvents.length === 0 && doubtfulEvents.length === 0 && timedEvents.length === 0 && (
                                <div className="text-center py-12">
                                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-600 font-medium mb-2">
                                        No se encontraron eventos para importar.
                                    </p>
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 max-w-md mx-auto">
                                        <p className="text-sm text-gray-700 mb-2">
                                            <strong>¿Por qué no hay eventos?</strong>
                                        </p>
                                        <ul className="text-xs text-gray-600 space-y-1 text-left">
                                            <li>• Se importan eventos de <strong>TODO EL DÍA</strong> (días cerrados, vacaciones, festivos)</li>
                                            <li>• Se importan eventos con <strong>HORA específica</strong> (reservas, citas) como appointments bloqueados</li>
                                            <li>• Verifica que el calendario esté correctamente conectado y tenga eventos</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <div className="flex items-center gap-4">
                        {totalSelected > 0 && (
                            <span className="text-sm text-gray-600">
                                {totalSelected} evento{totalSelected !== 1 ? 's' : ''} seleccionado{totalSelected !== 1 ? 's' : ''}
                            </span>
                        )}
                        <button
                            onClick={handleImport}
                            disabled={loading || totalSelected === 0 || classifying}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Importar seleccionados
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

