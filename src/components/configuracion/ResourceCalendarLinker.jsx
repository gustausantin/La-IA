// ResourceCalendarLinker.jsx - Vincular recursos con calendarios de Google Calendar
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Link as LinkIcon, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResourceCalendarLinker({ 
    businessId, 
    integrationConfig, 
    onUpdate 
}) {
    const [resources, setResources] = useState([]);
    const [calendars, setCalendars] = useState([]);
    const [mapping, setMapping] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (businessId) {
            loadResources();
            loadCalendars();
            loadCurrentMapping();
        }
    }, [businessId, integrationConfig]);

    const loadResources = async () => {
        try {
            const { data, error } = await supabase
                .from('resources')
                .select('id, name, resource_type')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setResources(data || []);
        } catch (error) {
            console.error('Error cargando recursos:', error);
            toast.error('Error cargando recursos');
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

    const loadCurrentMapping = () => {
        const currentMapping = integrationConfig?.resource_calendar_mapping || {};
        setMapping(currentMapping);
    };

    const handleMappingChange = (resourceId, calendarId) => {
        setMapping(prev => ({
            ...prev,
            [resourceId]: calendarId || null
        }));
    };

    const handleSave = async () => {
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

            // Actualizar config con el nuevo mapping
            const updatedConfig = {
                ...integration.config,
                resource_calendar_mapping: mapping
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

    // Si no hay recursos o calendarios, no mostrar nada
    if (resources.length === 0 || calendars.length === 0) {
        return null;
    }

    // Si hay más recursos que calendarios, mostrar advertencia
    const canLinkAll = calendars.length >= resources.length;

    return (
        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-3 mb-4">
                <LinkIcon className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                        Vincular Recursos con Calendarios
                    </h4>
                    <p className="text-sm text-gray-600">
                        {canLinkAll 
                            ? 'Vincula cada recurso con un calendario específico de Google Calendar. Esto permite sincronización independiente por recurso.'
                            : `⚠️ Tienes ${resources.length} recurso(s) pero solo ${calendars.length} calendario(s). Algunos recursos no podrán vincularse.`
                        }
                    </p>
                </div>
            </div>

            {!canLinkAll && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-800">
                            <strong>Recomendación:</strong> Si cada recurso tiene su propio calendario en Google Calendar, 
                            puedes vincularlos uno a uno. Si no, los eventos se sincronizarán sin vinculación específica.
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {resources.map(resource => (
                    <div key={resource.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex-1">
                            <p className="font-medium text-gray-900">{resource.name}</p>
                            <p className="text-xs text-gray-500">{resource.resource_type || 'Recurso'}</p>
                        </div>
                        <select
                            value={mapping[resource.id] || ''}
                            onChange={(e) => handleMappingChange(resource.id, e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">Sin vincular</option>
                            {calendars.map(calendar => (
                                <option key={calendar.id} value={calendar.id}>
                                    {calendar.summary || calendar.id}
                                </option>
                            ))}
                        </select>
                        {mapping[resource.id] && (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : 'Guardar Vinculación'}
                </button>
            </div>
        </div>
    );
}

