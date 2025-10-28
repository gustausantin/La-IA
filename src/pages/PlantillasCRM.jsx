// PlantillasCRM.jsx - SISTEMA PROFESIONAL DE PLANTILLAS CRM
import React, { useState, useEffect } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
    Mail, Edit2, Save, X, Plus, Copy, Eye, Trash2,
    RefreshCw, CheckCircle2, Target, Power, PowerOff, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";

// CATEGORÍAS DE PLANTILLAS PROFESIONALES
const TEMPLATE_CATEGORIES = {
    bienvenida: {
        name: "Bienvenida",
        description: "Mensajes de bienvenida para nuevos clientes",
        icon: Mail
    },
    confirmacion_24h: {
        name: "Confirmación 24h Antes",
        description: "Confirmación de reserva 24 horas antes",
        icon: CheckCircle2
    },
    confirmacion_4h: {
        name: "Confirmación 4h Antes",
        description: "Recordatorio urgente 4 horas antes",
        icon: CheckCircle2
    },
    vip_upgrade: {
        name: "Cliente VIP",
        description: "Promoción y reconocimiento de clientes VIP",
        icon: Target
    },
    alto_valor: {
        name: "Alto Valor",
        description: "Reconocimiento a clientes de alto valor",
        icon: Target
    },
    reactivacion: {
        name: "Reactivación",
        description: "Recuperación de clientes inactivos",
        icon: RefreshCw
    },
    recuperacion: {
        name: "En Riesgo",
        description: "Atención a clientes en riesgo de pérdida",
        icon: RefreshCw
    },
    noshow: {
        name: "No-Shows",
        description: "Seguimiento tras ausencias",
        icon: X
    },
    grupo_aprobacion: {
        name: "Aprobación Grupo Grande",
        description: "Confirmación de reservas de grupos grandes",
        icon: CheckCircle2
    },
    grupo_rechazo: {
        name: "Rechazo Grupo Grande",
        description: "Rechazo de reservas de grupos grandes",
        icon: X
    }
};

export default function PlantillasCRM() {
    const { restaurant, businessId } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [templateToActivate, setTemplateToActivate] = useState(null);

    // Cargar plantillas desde Supabase
    const loadTemplates = async () => {
        if (!businessId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("message_templates")
                .select("*")
                .eq("business_id", businessId)
                .order("category", { ascending: true })
                .order("name", { ascending: true});

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error("Error cargando plantillas:", error);
            toast.error("Error al cargar las plantillas");
        } finally {
            setLoading(false);
        }
    };

    // Cambiar estado de plantilla (activar/desactivar)
    const handleToggleActive = async (template) => {
        try {
            if (template.is_active) {
                // DESACTIVAR: Simplemente actualizar a false
                const { error } = await supabase
                    .from('message_templates')
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq('id', template.id);

                if (error) throw error;
                toast.success(`❌ "${template.name}" desactivada`);
                loadTemplates();
            } else {
                // ACTIVAR: Verificar si ya hay otra plantilla de la MISMA CATEGORÍA activa
                const activeTemplate = templates.find(t => 
                    t.category === template.category && 
                    t.id !== template.id && 
                    t.is_active
                );

                if (activeTemplate) {
                    // Mostrar modal de confirmación
                    setTemplateToActivate(template);
                    setShowConfirmModal(true);
                } else {
                    // No hay conflicto, activar directamente
                    await activateTemplate(template);
                }
            }
        } catch (error) {
            console.error("Error al cambiar estado de plantilla:", error);
            toast.error("Error al cambiar el estado");
        }
    };

    // Función para activar plantilla (con desactivación automática de otras)
    const activateTemplate = async (template) => {
        try {
            const { error } = await supabase.rpc('set_active_template', {
                p_template_id: template.id,
                p_business_id: businessId
            });

            if (error) throw error;
            toast.success(`✅ "${template.name}" activada`);
            loadTemplates();
        } catch (error) {
            console.error("Error al activar plantilla:", error);
            toast.error("Error al activar la plantilla");
        }
    };

    // Confirmar activación de plantilla (desactivará la otra automáticamente)
    const confirmActivation = async () => {
        if (!templateToActivate) return;
        
        await activateTemplate(templateToActivate);
        setShowConfirmModal(false);
        setTemplateToActivate(null);
    };

    // Cancelar activación
    const cancelActivation = () => {
        setShowConfirmModal(false);
        setTemplateToActivate(null);
    };

    // Guardar plantilla
    const saveTemplate = async (templateData) => {
        try {
            const { error } = await supabase
                .from("message_templates")
                .update({
                    name: templateData.name,
                    subject: templateData.subject,
                    content_markdown: templateData.content_markdown,
                    updated_at: new Date().toISOString()
                })
                .eq("id", templateData.id);

            if (error) throw error;

            toast.success("✅ Plantilla guardada correctamente");
            setShowModal(false);
            setEditingTemplate(null);
            loadTemplates();
        } catch (error) {
            console.error("Error guardando plantilla:", error);
            toast.error("Error al guardar la plantilla");
        }
    };

    // Duplicar plantilla (SIEMPRE desactivada)
    const duplicateTemplate = async (template) => {
        try {
            const { error } = await supabase
                .from("message_templates")
                .insert({
                    business_id: businessId,
                    name: `${template.name} (Copia)`,
                    category: template.category,
                    subject: template.subject,
                    content_markdown: template.content_markdown,
                    channel: template.channel,
                    is_active: false, // ✅ SIEMPRE desactivada al duplicar
                    segment: 'all',
                    event_trigger: 'manual'
                });

            if (error) throw error;

            toast.success("✅ Plantilla duplicada (desactivada)");
            loadTemplates();
        } catch (error) {
            console.error("Error duplicando plantilla:", error);
            toast.error("Error al duplicar la plantilla");
        }
    };

    // Eliminar plantilla
    const deleteTemplate = async (templateId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta plantilla?")) return;

        try {
            const { error } = await supabase
                .from("message_templates")
                .delete()
                .eq("id", templateId);

            if (error) throw error;

            toast.success("✅ Plantilla eliminada correctamente");
            loadTemplates();
        } catch (error) {
            console.error("Error eliminando plantilla:", error);
            toast.error("Error al eliminar la plantilla");
        }
    };

    // Abrir modal de edición
    const openEditModal = (template) => {
        setEditingTemplate({ ...template });
        setPreviewMode(false);
        setShowModal(true);
    };

    // Abrir modal de vista previa
    const openPreviewModal = (template) => {
        setEditingTemplate({ ...template });
        setPreviewMode(true);
        setShowModal(true);
    };

    useEffect(() => {
        loadTemplates();
    }, [businessId]);

    // Agrupar plantillas por categoría
    const templatesByCategory = templates.reduce((acc, template) => {
        const cat = template.category || 'otros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(template);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/20 to-blue-50/20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <RefreshCw className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <p className="text-gray-600 font-medium">Cargando plantillas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-[85%] mx-auto px-4 py-4">
                {/* Header Principal - REDUCIDO A LA MITAD */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-3 mb-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-xl rounded-lg flex items-center justify-center">
                                <Mail className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                                    Plantillas CRM
                                </h1>
                                <p className="text-xs text-white/80">
                                    Gestiona y personaliza las plantillas de mensajes para cada tipo de cliente
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={loadTemplates}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white text-xs rounded-lg transition-all duration-200 shadow-sm"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* Estadísticas - MÁS PEQUEÑAS Y PROFESIONALES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                                <Mail className="w-4 h-4 text-white" />
                            </div>
                            <div className="ml-3">
                                <p className="text-[10px] font-medium text-gray-600">Total Plantillas</p>
                                <p className="text-base font-bold text-gray-900">{templates.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="ml-3">
                                <p className="text-[10px] font-medium text-gray-600">Activas</p>
                                <p className="text-base font-bold text-gray-900">
                                    {templates.filter(t => t.is_active).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                                <Target className="w-4 h-4 text-white" />
                            </div>
                            <div className="ml-3">
                                <p className="text-[10px] font-medium text-gray-600">Categorías</p>
                                <p className="text-base font-bold text-gray-900">
                                    {Object.keys(templatesByCategory).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plantillas por Categoría */}
                <div className="space-y-3">
                    {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => {
                        const categoryInfo = TEMPLATE_CATEGORIES[category] || {
                            name: category,
                            description: "Plantillas personalizadas",
                            icon: Mail
                        };
                        const IconComponent = categoryInfo.icon;

                        return (
                            <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                {/* Header de categoría - MÁS COMPACTO */}
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                                                <IconComponent className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-semibold text-gray-900">
                                                    {categoryInfo.name}
                                                </h3>
                                                <p className="text-[10px] text-gray-600">
                                                    {categoryInfo.description} · {categoryTemplates.length} plantilla{categoryTemplates.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3">
                                    <div className="space-y-2">
                                        {categoryTemplates.map(template => (
                                            <div 
                                                key={template.id} 
                                                className={`border rounded-lg p-2 transition-all duration-200 ${
                                                    template.is_active 
                                                        ? 'border-green-300 bg-green-50/50 shadow-sm' 
                                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-semibold text-xs text-gray-900">{template.name}</h4>
                                                            {template.is_active && (
                                                                <span className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-semibold rounded-md flex items-center gap-1 shadow-sm">
                                                                    <Power className="w-2.5 h-2.5" />
                                                                    Activa
                                                                </span>
                                                            )}
                                                        </div>
                                                        {template.subject && (
                                                            <p className="text-[10px] text-gray-600 mb-1">
                                                                <strong>Asunto:</strong> {template.subject}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-gray-500 line-clamp-2">
                                                            {(template.content_markdown || '').substring(0, 100)}...
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                <Mail className="w-2.5 h-2.5" />
                                                                {template.channel || 'email'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 ml-3">
                                        <button
                                            onClick={() => handleToggleActive(template)}
                                            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                                                template.is_active
                                                    ? 'text-green-700 bg-green-100 hover:bg-green-200 shadow-sm'
                                                    : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                                            }`}
                                            title={template.is_active ? "Desactivar plantilla" : "Activar plantilla"}
                                        >
                                            {template.is_active ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                                        </button>
                                                        <button
                                                            onClick={() => openPreviewModal(template)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                                            title="Vista previa"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditModal(template)}
                                                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => duplicateTemplate(template)}
                                                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                                                            title="Duplicar"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteTemplate(template.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Modal de Confirmación de Activación */}
                {showConfirmModal && templateToActivate && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-t-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-white/20 backdrop-blur-xl rounded-lg flex items-center justify-center">
                                        <Power className="w-4 h-4 text-white" />
                                    </div>
                                    <h3 className="text-sm font-bold text-white">
                                        Confirmar Activación
                                    </h3>
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="mb-4">
                                    <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                                        Ya existe otra plantilla <strong>"{templateToActivate.name}"</strong> activa.
                                    </p>
                                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                                        <p className="text-gray-800 text-xs font-medium flex items-start gap-2">
                                            <span className="text-sm">⚠️</span>
                                            <span>
                                                Al activar esta plantilla, la otra será desactivada automáticamente. 
                                                Solo puede haber una plantilla activa de cada tipo.
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={cancelActivation}
                                        className="px-4 py-1.5 text-xs text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmActivation}
                                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-sm font-medium"
                                    >
                                        <Power className="w-3.5 h-3.5" />
                                        Activar de todos modos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Edición/Vista Previa */}
                {showModal && editingTemplate && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                            {/* Header del modal */}
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-t-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        {previewMode ? <Eye className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                        {previewMode ? 'Vista Previa' : 'Editar'} Plantilla
                                    </h3>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                {previewMode ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                Nombre de la Plantilla
                                            </label>
                                            <p className="text-gray-900 text-sm">{editingTemplate.name}</p>
                                        </div>
                                        {editingTemplate.subject && (
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                    Asunto del Mensaje
                                                </label>
                                                <p className="text-gray-900 text-xs">{editingTemplate.subject}</p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                Contenido del Mensaje
                                            </label>
                                            <div className="bg-gray-50 p-3 rounded-lg whitespace-pre-wrap border border-gray-200 text-xs">
                                                {editingTemplate.content_markdown}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                Nombre de la Plantilla
                                            </label>
                                            <input
                                                type="text"
                                                value={editingTemplate.name}
                                                onChange={(e) => setEditingTemplate(prev => ({
                                                    ...prev,
                                                    name: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                        {editingTemplate.channel === 'email' && (
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                    Asunto del Mensaje
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingTemplate.subject || ''}
                                                    onChange={(e) => setEditingTemplate(prev => ({
                                                        ...prev,
                                                        subject: e.target.value
                                                    }))}
                                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                Contenido del Mensaje
                                            </label>
                                            <textarea
                                                value={editingTemplate.content_markdown || ''}
                                                onChange={(e) => setEditingTemplate(prev => ({
                                                    ...prev,
                                                    content_markdown: e.target.value
                                                }))}
                                                rows={12}
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                                            />
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <h4 className="font-semibold text-xs text-gray-900 mb-2 flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-gray-600" />
                                                Variables Disponibles:
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5 text-xs">
                                                <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                    {'{{customer_name}}'}
                                                </span>
                                                <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                    {'{{restaurant_name}}'}
                                                </span>
                                                <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                    {'{{reservation_time}}'}
                                                </span>
                                                <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                    {'{{reservation_date}}'}
                                                </span>
                                                <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                    {'{{party_size}}'}
                                                </span>
                                                <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                    {'{{restaurant_phone}}'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-700 mt-2 font-medium">
                                                💡 Usa estas variables en tus mensajes. Se reemplazarán automáticamente con los datos reales.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-1.5 text-xs text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    {!previewMode && (
                                        <button
                                            onClick={() => saveTemplate(editingTemplate)}
                                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-sm font-medium"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                            Guardar Plantilla
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

