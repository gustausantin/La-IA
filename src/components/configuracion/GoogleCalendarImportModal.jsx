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
                    safeEvents: data.safe,
                    doubtfulEvents: data.doubtful
                });
                
                setSafeEvents(data.safe || []);
                setDoubtfulEvents(data.doubtful || []);
                
                // Si no hay eventos, mostrar información útil
                if ((data.safe?.length || 0) === 0 && (data.doubtful?.length || 0) === 0) {
                    console.warn('⚠️ No se encontraron eventos de todo el día. Verifica que estás usando el calendario correcto y que los eventos sean de "todo el día".');
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
        } else {
            setDoubtfulEvents(prev => prev.map(e => 
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

    const handleImport = async () => {
        const selectedSafe = safeEvents.filter(e => e.selected);
        const selectedDoubtful = doubtfulEvents.filter(e => e.selected);
        const allSelected = [...selectedSafe, ...selectedDoubtful];

        if (allSelected.length === 0) {
            toast.error('Selecciona al menos un evento para importar');
            return;
        }

        try {
            setLoading(true);
            toast.loading('Importando eventos...', { id: 'import-events' });

            const { data, error } = await supabase.functions.invoke('import-google-calendar-initial', {
                body: {
                    business_id: businessId,
                    action: 'import',
                    events: allSelected
                }
            });

            if (error) throw error;

            toast.dismiss('import-events');

            if (data?.success) {
                toast.success(
                    `✅ Se importaron ${data.imported || 0} eventos correctamente`,
                    { duration: 5000 }
                );
                onComplete?.();
                onClose();
            } else {
                throw new Error(data?.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error importando eventos:', error);
            toast.dismiss('import-events');
            toast.error('Error importando eventos: ' + (error.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    const formatEventDate = (event) => {
        const dateStr = event.start?.date || event.start?.dateTime?.split('T')[0];
        if (!dateStr) return 'Fecha desconocida';
        try {
            const date = new Date(dateStr);
            return format(date, 'dd MMM yyyy', { locale: es });
        } catch {
            return dateStr;
        }
    };

    if (!isOpen) return null;

    const totalSelected = safeEvents.filter(e => e.selected).length + doubtfulEvents.filter(e => e.selected).length;

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
                                Solo se importan eventos de todo el día (días cerrados, vacaciones, festivos)
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
                                    <li>• <strong>Solo se importan eventos de TODO EL DÍA</strong> (días cerrados, vacaciones, festivos)</li>
                                    <li>• <strong>Los eventos con HORA específica NO se importan</strong> (reservas, citas)</li>
                                    <li>• <strong>Las reservas deben crearse directamente en LA-IA</strong> para asegurar asignación correcta de empleados y servicios</li>
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

                            {safeEvents.length === 0 && doubtfulEvents.length === 0 && (
                                <div className="text-center py-12">
                                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-600 font-medium mb-2">
                                        No se encontraron eventos de todo el día para importar.
                                    </p>
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 max-w-md mx-auto">
                                        <p className="text-sm text-gray-700 mb-2">
                                            <strong>¿Por qué no hay eventos?</strong>
                                        </p>
                                        <ul className="text-xs text-gray-600 space-y-1 text-left">
                                            <li>• Solo se importan eventos de <strong>TODO EL DÍA</strong> (días cerrados, vacaciones, festivos)</li>
                                            <li>• Los eventos con <strong>HORA específica</strong> (reservas, citas) <strong>NO se importan</strong></li>
                                            <li>• Si tienes eventos con hora, créalos directamente en LA-IA</li>
                                        </ul>
                                        <p className="text-xs text-gray-500 mt-3 italic">
                                            Para importar: Crea eventos de "todo el día" en Google Calendar con palabras como "Cerrado", "Vacaciones", "Festivo"
                                        </p>
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

