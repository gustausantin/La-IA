// GoogleCalendarConflictModal.jsx - Modal para resolver conflictos entre Google Calendar y appointments existentes
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { AlertTriangle, X, CheckCircle2, Calendar, Clock, User } from 'lucide-react';

export default function GoogleCalendarConflictModal({ 
    conflicts, 
    businessId, 
    events, 
    onResolve, 
    onCancel 
}) {
    const [resolving, setResolving] = useState(false);
    const [resolutionStrategy, setResolutionStrategy] = useState('ask'); // 'ask', 'gcal', 'laia', 'skip'

    if (!conflicts || conflicts.length === 0) {
        return null;
    }

    const handleResolve = async (strategy) => {
        setResolving(true);
        try {
            if (strategy === 'skip') {
                // Saltar eventos con conflictos
                const conflictedEventIds = conflicts.map(c => c.gcal_event_id);
                const eventsToImport = events.filter(e => !conflictedEventIds.includes(e.id));
                
                toast.loading('Importando eventos sin conflictos...', { id: 'resolve-conflicts' });
                
                const { data, error } = await supabase.functions.invoke('import-google-calendar-initial', {
                    body: {
                        business_id: businessId,
                        action: 'import',
                        events: eventsToImport
                    }
                });

                if (error) throw error;

                toast.dismiss('resolve-conflicts');
                toast.success(`✅ Se importaron ${data?.imported || 0} eventos (${conflicts.length} eventos con conflictos omitidos)`);
                
                if (onResolve) {
                    onResolve({ strategy: 'skip', imported: data?.imported || 0, skipped: conflicts.length });
                }
            } else if (strategy === 'gcal') {
                // Priorizar Google Calendar: cancelar appointments existentes y importar eventos
                toast.loading('Cancelando appointments existentes e importando desde Google Calendar...', { id: 'resolve-conflicts' });
                
                // Cancelar appointments existentes
                const appointmentIdsToCancel = conflicts.map(c => c.existing_appointment_id).filter(Boolean);
                if (appointmentIdsToCancel.length > 0) {
                    const { error: cancelError } = await supabase
                        .from('appointments')
                        .update({ status: 'cancelled', cancellation_reason: 'Cancelado por conflicto con Google Calendar' })
                        .in('id', appointmentIdsToCancel);

                    if (cancelError) {
                        console.error('Error cancelando appointments:', cancelError);
                        toast.error('Error cancelando algunos appointments existentes');
                    }
                }

                // Importar todos los eventos
                const { data, error } = await supabase.functions.invoke('import-google-calendar-initial', {
                    body: {
                        business_id: businessId,
                        action: 'import',
                        events: events
                    }
                });

                if (error) throw error;

                toast.dismiss('resolve-conflicts');
                toast.success(
                    `✅ Se importaron ${data?.imported || 0} eventos desde Google Calendar. ${appointmentIdsToCancel.length} appointment(s) existente(s) cancelado(s).`,
                    { duration: 7000 }
                );
                
                if (onResolve) {
                    onResolve({ strategy: 'gcal', imported: data?.imported || 0, cancelled: appointmentIdsToCancel.length });
                }
            } else if (strategy === 'laia') {
                // Priorizar LA-IA: no importar eventos con conflictos
                const conflictedEventIds = conflicts.map(c => c.gcal_event_id);
                const eventsToImport = events.filter(e => !conflictedEventIds.includes(e.id));
                
                toast.loading('Importando eventos sin conflictos (manteniendo appointments existentes)...', { id: 'resolve-conflicts' });
                
                const { data, error } = await supabase.functions.invoke('import-google-calendar-initial', {
                    body: {
                        business_id: businessId,
                        action: 'import',
                        events: eventsToImport
                    }
                });

                if (error) throw error;

                toast.dismiss('resolve-conflicts');
                toast.success(
                    `✅ Se importaron ${data?.imported || 0} eventos. ${conflicts.length} evento(s) omitido(s) para mantener appointments existentes.`,
                    { duration: 7000 }
                );
                
                if (onResolve) {
                    onResolve({ strategy: 'laia', imported: data?.imported || 0, skipped: conflicts.length });
                }
            }
        } catch (error) {
            console.error('Error resolviendo conflictos:', error);
            toast.dismiss('resolve-conflicts');
            toast.error('Error al resolver conflictos: ' + (error.message || 'Error desconocido'));
        } finally {
            setResolving(false);
        }
    };

    const formatDateTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8" />
                            <div>
                                <h2 className="text-2xl font-bold">Conflictos Detectados</h2>
                                <p className="text-red-100 text-sm mt-1">
                                    Se encontraron {conflicts.length} conflicto(s) entre Google Calendar y appointments existentes
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                            disabled={resolving}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Lista de conflictos */}
                    <div className="space-y-4 mb-6">
                        {conflicts.map((conflict, index) => (
                            <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Google Calendar Event */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="w-5 h-5 text-blue-600" />
                                            <h3 className="font-semibold text-blue-900">Google Calendar</h3>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 mb-1">
                                            {conflict.gcal_summary}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Clock className="w-4 h-4" />
                                            <span>{formatDateTime(conflict.gcal_start)}</span>
                                        </div>
                                    </div>

                                    {/* LA-IA Appointment */}
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-5 h-5 text-orange-600" />
                                            <h3 className="font-semibold text-orange-900">LA-IA (Existente)</h3>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 mb-1">
                                            {conflict.existing_customer_name}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Clock className="w-4 h-4" />
                                            <span>
                                                {conflict.existing_appointment_date} {conflict.existing_appointment_time?.substring(0, 5)}
                                            </span>
                                        </div>
                                        <div className="mt-1">
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                conflict.existing_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                conflict.existing_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {conflict.existing_status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Opciones de resolución */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-3">¿Cómo quieres resolver estos conflictos?</h3>
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="radio"
                                    name="resolution"
                                    value="gcal"
                                    checked={resolutionStrategy === 'gcal'}
                                    onChange={(e) => setResolutionStrategy(e.target.value)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">Priorizar Google Calendar</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        Cancelar los appointments existentes e importar todos los eventos de Google Calendar.
                                        <span className="text-red-600 font-medium"> {conflicts.length} appointment(s) será(n) cancelado(s).</span>
                                    </div>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="radio"
                                    name="resolution"
                                    value="laia"
                                    checked={resolutionStrategy === 'laia'}
                                    onChange={(e) => setResolutionStrategy(e.target.value)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">Priorizar LA-IA</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        Mantener los appointments existentes y omitir los eventos conflictivos de Google Calendar.
                                        <span className="text-orange-600 font-medium"> {conflicts.length} evento(s) será(n) omitido(s).</span>
                                    </div>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="radio"
                                    name="resolution"
                                    value="skip"
                                    checked={resolutionStrategy === 'skip'}
                                    onChange={(e) => setResolutionStrategy(e.target.value)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">Omitir eventos con conflictos</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        Importar solo los eventos sin conflictos. Los appointments existentes se mantienen.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={resolving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => handleResolve(resolutionStrategy)}
                        disabled={resolving || !resolutionStrategy}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {resolving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Procesando...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                <span>Resolver Conflictos</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

