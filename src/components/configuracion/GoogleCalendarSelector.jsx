// GoogleCalendarSelector.jsx - Selector de calendarios de Google Calendar
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Calendar, Loader2, Check, X, RefreshCw, AlertCircle } from 'lucide-react';

export default function GoogleCalendarSelector({ businessId, onCalendarSelected, currentCalendarId }) {
    const [calendars, setCalendars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCalendarIds, setSelectedCalendarIds] = useState(
        currentCalendarId ? (Array.isArray(currentCalendarId) ? currentCalendarId : [currentCalendarId]) : []
    );
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (businessId) {
            loadCalendars();
        }
    }, [businessId]);

    // Si hay un calendario actual seleccionado, marcarlo
    useEffect(() => {
        if (currentCalendarId && calendars.length > 0) {
            const currentIds = Array.isArray(currentCalendarId) ? currentCalendarId : [currentCalendarId];
            setSelectedCalendarIds(currentIds.filter(id => calendars.some(cal => cal.id === id)));
        }
    }, [currentCalendarId, calendars]);

    const loadCalendars = async () => {
        try {
            setLoading(true);
            
            const { data, error } = await supabase.functions.invoke('list-google-calendars', {
                body: { business_id: businessId }
            });

            if (error) throw error;

            if (data?.success) {
                setCalendars(data.calendars || []);
            } else {
                throw new Error(data?.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('❌ Error cargando calendarios:', error);
            toast.error('Error cargando calendarios de Google: ' + (error.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    const toggleCalendar = (calendarId) => {
        setSelectedCalendarIds(prev => {
            if (prev.includes(calendarId)) {
                return prev.filter(id => id !== calendarId);
            } else {
                return [...prev, calendarId];
            }
        });
    };

    const handleSave = async () => {
        if (selectedCalendarIds.length === 0) {
            toast.error('Selecciona al menos un calendario para sincronizar');
            return;
        }

        try {
            setSaving(true);

            // Obtener la integración actual
            const { data: integration, error: fetchError } = await supabase
                .from('integrations')
                .select('*')
                .eq('business_id', businessId)
                .eq('provider', 'google_calendar')
                .eq('is_active', true)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (!integration) {
                throw new Error('Integración de Google Calendar no encontrada');
            }

            // Actualizar configuración con calendarios seleccionados
            const selectedCalendars = calendars.filter(cal => selectedCalendarIds.includes(cal.id));
            const calendarNames = selectedCalendars.map(cal => cal.summary).join(', ');
            
            // Si solo hay un calendario seleccionado, mantener compatibilidad con el formato anterior
            const calendarId = selectedCalendarIds.length === 1 
                ? selectedCalendarIds[0] 
                : selectedCalendarIds; // Array si hay múltiples
            
            const { error: updateError } = await supabase
                .from('integrations')
                .update({
                    config: {
                        ...integration.config,
                        calendar_id: calendarId,
                        calendar_ids: selectedCalendarIds, // Array completo para futuras referencias
                        calendar_name: calendarNames,
                        calendars_selected: selectedCalendars.map(cal => ({
                            id: cal.id,
                            name: cal.summary,
                            primary: cal.primary,
                        })),
                        calendar_selection_completed: true,
                        // ✅ CRÍTICO: Preservar initial_import_completed si ya existe
                        // Si no existe, dejarlo como undefined (no establecerlo en false)
                        // para que el botón de importar siga apareciendo
                        initial_import_completed: integration.config?.initial_import_completed,
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', integration.id);

            if (updateError) throw updateError;

            toast.success(`✅ ${selectedCalendarIds.length} calendario(s) seleccionado(s) correctamente`);
            
            // ✅ Cerrar el modal y actualizar el estado en el componente padre
            // NO recargar la página para mantener al usuario en la misma página
            if (onCalendarSelected) {
                onCalendarSelected(selectedCalendarIds);
            }
        } catch (error) {
            console.error('❌ Error guardando calendarios:', error);
            toast.error('Error guardando calendarios: ' + (error.message || 'Error desconocido'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-600">Cargando calendarios...</span>
            </div>
        );
    }

    if (calendars.length === 0) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No se encontraron calendarios</p>
                <button
                    onClick={loadCalendars}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">
                            Selecciona los calendarios a sincronizar
                        </h4>
                        <ul className="text-xs text-blue-800 space-y-1">
                            <li>• Selecciona los calendarios que quieres sincronizar con LA-IA</li>
                            <li>• Puedes seleccionar uno o varios calendarios</li>
                            <li>• Solo se sincronizarán los eventos creados en LA-IA</li>
                            <li>• Los eventos existentes en Google Calendar no se sincronizarán automáticamente</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-96 overflow-y-auto shadow-sm">
                {calendars.map((calendar) => {
                    const isSelected = selectedCalendarIds.includes(calendar.id);
                    const isPrimary = calendar.primary;
                    
                    return (
                        <label
                            key={calendar.id}
                            className={`flex items-center gap-4 p-4 cursor-pointer transition-all ${
                                isSelected 
                                    ? 'bg-blue-50 border-l-4 border-l-blue-600' 
                                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCalendar(calendar.id)}
                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                            />
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div 
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        backgroundColor: calendar.backgroundColor || '#4285f4',
                                        color: calendar.foregroundColor || '#ffffff'
                                    }}
                                >
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-base font-semibold ${
                                            isSelected ? 'text-blue-900' : 'text-gray-900'
                                        }`}>
                                            {calendar.summary || 'Sin nombre'}
                                        </span>
                                        {isPrimary && (
                                            <span className="px-2.5 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                                                Principal
                                            </span>
                                        )}
                                        {isSelected && (
                                            <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                        )}
                                    </div>
                                    {calendar.description && (
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                            {calendar.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </label>
                    );
                })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                    {selectedCalendarIds.length > 0 ? (
                        <span className="font-medium text-blue-600">
                            {selectedCalendarIds.length} calendario(s) seleccionado(s)
                        </span>
                    ) : (
                        <span className="text-gray-400">Ningún calendario seleccionado</span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || selectedCalendarIds.length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Guardar Selección
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

