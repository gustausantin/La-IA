// NoShowAutomationConfig.jsx - Panel de Configuración de Automatización No-Shows
import React, { useState, useEffect } from 'react';
import { Settings, Save, MessageSquare, Phone, DollarSign, Clock, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

/**
 * Panel para configurar acciones automáticas por nivel de riesgo
 * Guarda configuración en businesses.settings.noshow_automation (JSONB)
 */
export default function NoShowAutomationConfig() {
    const { restaurant } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        enabled: true,
        high: {
            auto_whatsapp: true,
            auto_call: false,
            require_deposit: false,
            hours_before: 4
        },
        medium: {
            auto_whatsapp: true,
            auto_call: false,
            require_deposit: false,
            hours_before: 2
        },
        low: {
            auto_whatsapp: false,
            auto_call: false,
            require_deposit: false,
            hours_before: 0
        }
    });

    // Cargar configuración actual desde Supabase
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

                // Si existe configuración previa, cargarla
                if (data?.settings?.noshow_automation) {
                    setConfig(data.settings.noshow_automation);
                }

            } catch (error) {
                console.error('Error cargando configuración:', error);
                toast.error('Error al cargar configuración');
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [restaurant?.id]);

    // Guardar configuración
    const handleSave = async () => {
        if (!restaurant?.id) return;

        try {
            setSaving(true);
            toast.loading('Guardando configuración...', { id: 'save-config' });

            // Obtener settings actuales
            const { data: currentData } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', restaurant.id)
                .single();

            const currentSettings = currentData?.settings || {};

            // Actualizar solo la sección de noshow_automation
            const updatedSettings = {
                ...currentSettings,
                noshow_automation: config
            };

            // Guardar en Supabase
            const { error } = await supabase
                .from('businesses')
                .update({ settings: updatedSettings })
                .eq('id', restaurant.id);

            if (error) throw error;

            toast.success('Configuración guardada correctamente', { id: 'save-config' });

        } catch (error) {
            console.error('Error guardando configuración:', error);
            toast.error('Error al guardar configuración', { id: 'save-config' });
        } finally {
            setSaving(false);
        }
    };

    // Actualizar configuración por nivel
    const updateLevel = (level, field, value) => {
        setConfig(prev => ({
            ...prev,
            [level]: {
                ...prev[level],
                [field]: value
            }
        }));
    };

    // Toggle global
    const toggleEnabled = () => {
        setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                    <div className="h-24 bg-gray-100 rounded"></div>
                    <div className="h-24 bg-gray-100 rounded"></div>
                    <div className="h-24 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm">
            {/* Header */}
            <div className="p-6 border-b-2 border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Settings className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Configurar Acciones Automáticas
                            </h3>
                            <p className="text-sm text-gray-600">
                                Define qué hacer con cada nivel de riesgo
                            </p>
                        </div>
                    </div>

                    {/* Toggle general */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">Sistema activo:</span>
                        <button
                            onClick={toggleEnabled}
                            className={`
                                relative w-14 h-8 rounded-full transition-colors
                                ${config.enabled ? 'bg-green-600' : 'bg-gray-300'}
                            `}
                        >
                            <div className={`
                                absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform
                                ${config.enabled ? 'translate-x-6' : 'translate-x-0'}
                            `} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Configuración por niveles */}
            <div className="p-6 space-y-6">
                {/* RIESGO ALTO */}
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-6 h-6 text-red-600" />
                        <h4 className="text-lg font-bold text-red-900">Riesgo Alto ({'>'}70%)</h4>
                    </div>

                    <div className="space-y-3">
                        {/* WhatsApp automático */}
                        <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Enviar WhatsApp automático</p>
                                    <p className="text-xs text-gray-600">Confirmación por WhatsApp antes de la reserva</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.high.auto_whatsapp}
                                onChange={(e) => updateLevel('high', 'auto_whatsapp', e.target.checked)}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                        </label>

                        {/* Horas antes */}
                        <div className="p-3 bg-white rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-gray-600" />
                                    <span className="font-medium text-gray-900">Horas antes de reserva:</span>
                                </div>
                                <select
                                    value={config.high.hours_before}
                                    onChange={(e) => updateLevel('high', 'hours_before', parseInt(e.target.value))}
                                    className="px-3 py-2 border-2 border-gray-300 rounded-lg font-semibold"
                                >
                                    <option value={24}>24 horas</option>
                                    <option value={12}>12 horas</option>
                                    <option value={6}>6 horas</option>
                                    <option value={4}>4 horas</option>
                                    <option value={2}>2 horas</option>
                                </select>
                            </div>
                        </div>

                        {/* Llamar si no responde */}
                        <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Llamar si no responde</p>
                                    <p className="text-xs text-gray-600">Seguimiento telefónico manual</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.high.auto_call}
                                onChange={(e) => updateLevel('high', 'auto_call', e.target.checked)}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                        </label>

                        {/* Solicitar señal */}
                        <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Solicitar señal de reserva</p>
                                    <p className="text-xs text-gray-600">Pago anticipado como garantía</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.high.require_deposit}
                                onChange={(e) => updateLevel('high', 'require_deposit', e.target.checked)}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                        </label>
                    </div>
                </div>

                {/* RIESGO MEDIO */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-6 h-6 text-yellow-600" />
                        <h4 className="text-lg font-bold text-yellow-900">Riesgo Medio (40-70%)</h4>
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Enviar WhatsApp automático</p>
                                    <p className="text-xs text-gray-600">Recordatorio amigable</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.medium.auto_whatsapp}
                                onChange={(e) => updateLevel('medium', 'auto_whatsapp', e.target.checked)}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                        </label>

                        <div className="p-3 bg-white rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-gray-600" />
                                    <span className="font-medium text-gray-900">Horas antes de reserva:</span>
                                </div>
                                <select
                                    value={config.medium.hours_before}
                                    onChange={(e) => updateLevel('medium', 'hours_before', parseInt(e.target.value))}
                                    className="px-3 py-2 border-2 border-gray-300 rounded-lg font-semibold"
                                >
                                    <option value={24}>24 horas</option>
                                    <option value={12}>12 horas</option>
                                    <option value={6}>6 horas</option>
                                    <option value={4}>4 horas</option>
                                    <option value={2}>2 horas</option>
                                </select>
                            </div>
                        </div>

                        <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Llamar si no responde</p>
                                    <p className="text-xs text-gray-600">Opcional</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.medium.auto_call}
                                onChange={(e) => updateLevel('medium', 'auto_call', e.target.checked)}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                        </label>
                    </div>
                </div>

                {/* RIESGO BAJO */}
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-6 h-6 text-green-600" />
                        <h4 className="text-lg font-bold text-green-900">Riesgo Bajo ({'<'}40%)</h4>
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-gray-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Enviar recordatorio opcional</p>
                                    <p className="text-xs text-gray-600">Mensaje estándar</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.low.auto_whatsapp}
                                onChange={(e) => updateLevel('low', 'auto_whatsapp', e.target.checked)}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Footer con botón guardar */}
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold transition-all shadow-sm disabled:opacity-50"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
            </div>
        </div>
    );
}

