// NoShowAutomationConfigSimple.jsx - Configuración Simple del Sistema No-Shows
import React, { useState, useEffect } from 'react';
import { Shield, Save, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

/**
 * Configuración ultra-simple: Un solo switch ON/OFF
 * El sistema decide automáticamente todo lo demás
 */
export default function NoShowAutomationConfigSimple() {
    const { restaurant } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(true);

    // Cargar estado actual
    useEffect(() => {
        const loadConfig = async () => {
            if (!restaurant?.id) return;

            try {
                setLoading(true);
                
                const { data, error } = await supabase
                    .from('businesses')
                    .select('settings')
                    .eq('id', restaurant.id)
                    .single();

                if (error) throw error;

                // Leer el estado del sistema
                if (data?.settings?.noshow_automation) {
                    setEnabled(data.settings.noshow_automation.enabled ?? true);
                }

            } catch (error) {
                console.error('Error cargando configuración:', error);
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [restaurant?.id]);

    // Guardar configuración
    const handleToggle = async (newState) => {
        if (!restaurant?.id) return;

        try {
            setSaving(true);
            setEnabled(newState);
            toast.loading('Guardando...', { id: 'save-config' });

            // Obtener settings actuales
            const { data: currentData } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', restaurant.id)
                .single();

            const currentSettings = currentData?.settings || {};

            // Actualizar solo el estado enabled
            const updatedSettings = {
                ...currentSettings,
                noshow_automation: {
                    ...(currentSettings.noshow_automation || {}),
                    enabled: newState
                }
            };

            // Guardar en Supabase
            const { error } = await supabase
                .from('businesses')
                .update({ settings: updatedSettings })
                .eq('id', restaurant.id);

            if (error) throw error;

            toast.success(
                newState 
                    ? '✅ Sistema activado correctamente' 
                    : '⏸️ Sistema pausado',
                { id: 'save-config' }
            );

        } catch (error) {
            console.error('Error guardando configuración:', error);
            toast.error('Error al guardar', { id: 'save-config' });
            // Revertir el estado en caso de error
            setEnabled(!newState);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando configuración...</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm p-3 border border-purple-200">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-gray-900">Sistema Anti No-Shows</h2>
                    <p className="text-xs text-gray-600">Configuración del sistema inteligente</p>
                </div>
            </div>

            {/* Main Switch */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            {enabled ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                                <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <h3 className="text-sm font-bold text-gray-900">
                                Sistema {enabled ? 'Activo' : 'Pausado'}
                            </h3>
                        </div>
                        <p className="text-xs text-gray-600 ml-6">
                            {enabled 
                                ? 'El sistema está funcionando automáticamente'
                                : 'El sistema está pausado temporalmente'
                            }
                        </p>
                    </div>
                    
                    {/* Toggle Switch */}
                    <button
                        onClick={() => handleToggle(!enabled)}
                        disabled={saving}
                        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 ${
                            enabled ? 'bg-green-600' : 'bg-gray-300'
                        } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                                enabled ? 'translate-x-8' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Información del Sistema */}
            <div className="mt-3 bg-blue-50 rounded-lg p-2.5 border border-blue-200">
                <h4 className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    ¿Qué hace el sistema cuando está activo?
                </h4>
                <ul className="space-y-1.5 text-xs text-blue-800">
                    <li className="flex items-start gap-1.5">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Recordatorio 24h antes:</strong> Envía mensaje automático a todos los clientes</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Recordatorio 4h antes:</strong> Segundo mensaje de confirmación</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Detección de riesgo:</strong> Calcula automáticamente el riesgo de cada reserva</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Alertas inteligentes:</strong> Te avisa solo cuando hay riesgo alto</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Auto-liberación:</strong> Libera automáticamente reservas sin confirmar 2h antes</span>
                    </li>
                </ul>
            </div>

            {/* Nota importante */}
            <div className="mt-2 bg-purple-50 rounded-lg p-2.5 border border-purple-200">
                <p className="text-xs text-purple-900">
                    <span className="font-bold">💡 Sistema 100% automático:</span> No necesitas configurar nada más. 
                    El algoritmo inteligente decide automáticamente cuándo y cómo contactar a cada cliente según su perfil de riesgo.
                </p>
            </div>

            {/* Estado visual compacto */}
            <div className={`mt-3 rounded-lg p-3 text-center ${
                enabled 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
            }`}>
                <p className="text-white text-sm font-bold">
                    {enabled ? '🛡️ Sistema Protegiendo tu Restaurante' : '⏸️ Sistema en Pausa'}
                </p>
                <p className="text-white/90 text-xs mt-0.5">
                    {enabled 
                        ? 'Todas las reservas están siendo monitoreadas' 
                        : 'Las automatizaciones están desactivadas temporalmente'
                    }
                </p>
            </div>
        </div>
    );
}

