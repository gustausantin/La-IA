// CustomerModal.jsx - Ficha de Cliente Unificada WORLD-CLASS
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
// Removed date-fns imports to fix JavaScript errors
import {
    X, Save, Mail, Phone, Calendar, DollarSign, TrendingUp,
    Crown, AlertTriangle, CheckCircle2, Clock, Edit2, User,
    MapPin, Heart, Award, Target, Zap, MessageSquare, Shield,
    Eye, EyeOff, Tag, FileText, Settings, Sparkles, Brain,
    Activity, BarChart3, Percent, Users, Gift, Trash2, RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";

// SEGMENTACIÓN INTELIGENTE - SISTEMA CRM POR VERTICAL (5 SEGMENTOS)
// (Mismo sistema que Clientes.jsx para consistencia)
const CUSTOMER_SEGMENTS = {
    vip: { 
        label: "VIP", 
        icon: "👑", 
        color: "purple",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200",
        textColor: "text-purple-800",
        description: "Cliente prioritario - Alto valor"
    },
    nuevo: { 
        label: "Nuevo", 
        icon: "👋", 
        color: "blue",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        textColor: "text-blue-800",
        description: "Primera/segunda visita (< 90 días)"
    },
    regular: { 
        label: "Regular", 
        icon: "⭐", 
        color: "green",
        bgColor: "bg-green-50",
        borderColor: "border-green-200", 
        textColor: "text-green-800",
        description: "Cliente fiel y activo"
    },
    en_riesgo: { 
        label: "En Riesgo", 
        icon: "⚠️", 
        color: "orange",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        textColor: "text-orange-800",
        description: "Cliente que puede perderse"
    },
    inactivo: { 
        label: "Inactivo", 
        icon: "😴", 
        color: "gray",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        textColor: "text-gray-800",
        description: "Sin visitas recientes - Necesita recuperación"
    }
};

// FUNCIÓN PARA CALCULAR SEGMENTO SEGÚN PARÁMETROS DEL VERTICAL
// (Misma lógica que Clientes.jsx para consistencia)
const calculateSegmentByVertical = (customer, verticalParams) => {
    if (!customer) return 'nuevo';
    if (!verticalParams) return 'nuevo'; // Fallback si no hay parámetros
    
    const lifetimeVisits = customer.total_visits || customer.visits_count || 0;
    const totalSpent = customer.total_spent || 0;
    const daysSinceLastVisit = customer.last_visit_at 
        ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
        : 999;
    const daysSinceFirstVisit = customer.created_at
        ? Math.floor((new Date() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Calcular thresholds
    const riskThreshold = verticalParams.risk_min_days;
    const inactiveThreshold = verticalParams.inactive_days;
    
    // PRIORIDAD 1: VIP (siempre gana, incluso si está inactivo)
    const isVIP = totalSpent >= verticalParams.vip_min_spend_12m || 
                  lifetimeVisits >= verticalParams.vip_min_visits_12m;
    
    if (isVIP) {
        return 'vip';
    }
    
    // PRIORIDAD 2: NUEVO (1-2 visitas en últimos 90 días)
    if (lifetimeVisits <= 2 && daysSinceFirstVisit <= 90) {
        return 'nuevo';
    }
    
    // PRIORIDAD 3: INACTIVO
    if (daysSinceLastVisit > inactiveThreshold) {
        return 'inactivo';
    }
    
    // PRIORIDAD 4: EN RIESGO
    if (daysSinceLastVisit > riskThreshold) {
        return 'en_riesgo';
    }
    
    // PRIORIDAD 5 (DEFAULT): REGULAR
    return 'regular';
};

const CustomerModal = ({ 
    customer, 
    isOpen, 
    onClose, 
    onSave,
    onDelete, 
    businessId,
    verticalType, // 🆕 Tipo de vertical del negocio (opcional)
    mode = 'view' // 'view', 'edit', 'create'
}) => {
    const [formData, setFormData] = useState({
        // Campos básicos
        name: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birthday: '', // Campo de cumpleaños
        
        // Estadísticas (solo lectura)
        visits_count: 0,
        total_spent: 0,
        avg_ticket: 0,
        last_visit_at: null,
        
        // IA Predictiva (solo lectura)
        churn_risk_score: 0,
        predicted_ltv: 0,
        preferred_items: [],
        
        // Consent Management
        consent_email: true,
        consent_sms: true,
        consent_whatsapp: false,
        
        // Otros campos
        preferences: {},
        tags: [],
        notes: '',
        segment_manual: '',
        segment_auto: 'nuevo'
    });
    
    const [activeTab, setActiveTab] = useState('general');
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(mode === 'edit' || mode === 'create');
    const [verticalParams, setVerticalParams] = useState(null); // 🆕 Parámetros del vertical
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // 🆕 Cargar parámetros del vertical desde Supabase (reemplaza crm_settings)
    useEffect(() => {
        const loadVerticalParams = async () => {
            if (!verticalType) {
                // Si no se pasa verticalType, intentar obtenerlo del negocio
                if (!businessId) return;
                
                try {
                    const { data: business, error } = await supabase
                        .from('businesses')
                        .select('vertical_type')
                        .eq('id', businessId)
                        .single();
                    
                    if (error || !business?.vertical_type) {
                        console.log('📊 CRM: Sin vertical_type disponible');
                        return;
                    }
                    
                    // Recursivamente llamar con el vertical_type obtenido
                    const { data, error: paramsError } = await supabase
                        .from('crm_vertical_parameters')
                        .select('*')
                        .eq('vertical_id', business.vertical_type)
                        .single();
                    
                    if (paramsError) {
                        console.warn('⚠️ Error cargando parámetros del vertical:', paramsError);
                        return;
                    }
                    
                    if (data) {
                        setVerticalParams(data);
                    }
                } catch (error) {
                    console.warn('⚠️ Error obteniendo vertical_type:', error);
                }
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('crm_vertical_parameters')
                    .select('*')
                    .eq('vertical_id', verticalType)
                    .single();
                
                if (error) {
                    console.warn('⚠️ Error cargando parámetros del vertical:', error);
                    return;
                }
                
                if (data) {
                    setVerticalParams(data);
                }
            } catch (error) {
                console.warn('⚠️ Error cargando parámetros del vertical:', error);
            }
        };
        
        loadVerticalParams();
    }, [businessId, verticalType]);

    // Inicializar datos del cliente
    useEffect(() => {
        if (customer && isOpen) {
            console.log('=== DEBUGGING CUSTOMER DATA ===');
            console.log('Customer object:', customer);
            console.log('customer.name:', customer.name);
            console.log('customer.first_name:', customer.first_name);
            console.log('customer.last_name:', customer.last_name);
            console.log('customer.segment_manual:', customer.segment_manual);
            console.log('customer.segment_auto:', customer.segment_auto);
            console.log('=== DEBUGGING GDPR CONSENTS ===');
            console.log('customer.consent_email:', customer.consent_email);
            console.log('customer.consent_sms:', customer.consent_sms);
            console.log('customer.consent_whatsapp:', customer.consent_whatsapp);
            
            // ✅ Si el cliente solo tiene 'name' (de WhatsApp), intentar extraer first_name y last_name
            const nameParts = customer.name ? customer.name.trim().split(' ') : [];
            const firstName = customer.first_name || nameParts[0] || '';
            const lastName = customer.last_name || nameParts.slice(1).join(' ') || '';
            
            setFormData({
                name: customer.name || '',
                first_name: firstName,
                last_name: lastName,
                email: customer.email || '',
                phone: customer.phone || '',
                birthday: customer.birthday || '',
                visits_count: customer.visits_count || customer.total_visits || 0,
                total_spent: customer.total_spent || 0,
                avg_ticket: customer.avg_ticket || 0,
                last_visit_at: customer.last_visit_at || customer.last_visit,
                churn_risk_score: customer.churn_risk_score || 0,
                predicted_ltv: customer.predicted_ltv || 0,
                preferred_items: customer.preferred_items || [],
                // 🔧 CORRECCIÓN GDPR: Usar valores exactos de BD con validación estricta
                consent_email: customer.consent_email === true,
                consent_sms: customer.consent_sms === true, 
                consent_whatsapp: customer.consent_whatsapp === true,
                preferences: customer.preferences || {},
                tags: customer.tags || [],
                notes: customer.notes || '',
                segment_manual: customer.segment_manual || '',
                segment_auto: customer.segment_auto || 'nuevo'
            });
        } else if (mode === 'create' && isOpen) {
            // Resetear formulario para nuevo cliente
            setFormData({
                name: '',
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                birthday: '',
                visits_count: 0,
                total_spent: 0,
                avg_ticket: 0,
                last_visit_at: null,
                churn_risk_score: 0,
                predicted_ltv: 0,
                preferred_items: [],
                consent_email: true,
                consent_sms: true,
                consent_whatsapp: false,
                preferences: {},
                tags: [],
                notes: '',
                segment_manual: '',
                segment_auto: 'nuevo'
            });
            // IMPORTANTE: Habilitar edición para nuevo cliente
            setIsEditing(true);
        }
    }, [customer, isOpen, mode]);

    const handleSave = async () => {
        try {
            setSaving(true);
            
            // Validaciones básicas
            if (!formData.first_name?.trim()) {
                toast.error('❌ El nombre es obligatorio');
                setSaving(false);
                return;
            }
            
            // Validar email si se proporciona
            if (formData.email?.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.email.trim())) {
                    toast.error('❌ El email no tiene un formato válido');
                    setSaving(false);
                    return;
                }
            }
            
            if (!businessId) {
                toast.error('❌ Error: No se encontró el ID del restaurante');
                setSaving(false);
                return;
            }
            
            // Generar nombre completo automáticamente
            const fullName = `${formData.first_name} ${formData.last_name || ''}`.trim();
            
            // Preparar datos para guardar - CORRIGIENDO MANEJO DE CAMPOS OPCIONALES
            const dataToSave = {
                business_id: businessId,
                name: fullName,
                first_name: formData.first_name.trim(),
                consent_email: Boolean(formData.consent_email),
                consent_sms: Boolean(formData.consent_sms),
                consent_whatsapp: Boolean(formData.consent_whatsapp),
                preferences: formData.preferences || {},
                tags: formData.tags || []
                // Removido updated_at - Supabase puede manejarlo automáticamente
            };

            // Agregar campos opcionales solo si tienen valor real
            if (formData.last_name?.trim()) {
                dataToSave.last_name = formData.last_name.trim();
            }
            if (formData.email?.trim()) {
                dataToSave.email = formData.email.trim();
            }
            if (formData.phone?.trim()) {
                dataToSave.phone = formData.phone.trim();
            }
            if (formData.birthday?.trim()) {
                dataToSave.birthday = formData.birthday.trim();
            }
            if (formData.notes?.trim()) {
                dataToSave.notes = formData.notes.trim();
            }
            if (formData.segment_manual?.trim()) {
                dataToSave.segment_manual = formData.segment_manual.trim();
            }
            
            console.log('=== DATOS PREPARADOS ===');
            console.log('Data to save:', dataToSave);
            
            // Validaciones adicionales antes de guardar
            if (!dataToSave.business_id) {
                throw new Error('business_id es requerido');
            }
            
            if (!dataToSave.name || dataToSave.name.trim() === '') {
                throw new Error('El nombre generado está vacío');
            }
            
            if (!dataToSave.first_name || dataToSave.first_name.trim() === '') {
                throw new Error('first_name es requerido');
            }
            
            // Validar que preferences y tags sean objetos válidos
            if (typeof dataToSave.preferences !== 'object' || Array.isArray(dataToSave.preferences)) {
                dataToSave.preferences = {};
            }
            
            if (!Array.isArray(dataToSave.tags)) {
                dataToSave.tags = [];
            }

            let result;
            if (mode === 'create') {
                // Crear nuevo cliente
                console.log('=== CREANDO NUEVO CLIENTE ===');
                console.log('Datos para INSERT:', JSON.stringify(dataToSave, null, 2));
                
                const { data, error } = await supabase
                    .from('customers')
                    .insert([dataToSave])
                    .select()
                    .single();
                    
                if (error) {
                    console.error('Error en INSERT:', error);
                    throw error;
                }
                result = data;
                console.log('Cliente creado exitosamente:', result);
                // toast.success('✅ Cliente creado correctamente');
                alert('✅ Cliente creado correctamente');
            } else {
                // Actualizar cliente existente
                if (!customer?.id) {
                    throw new Error('ID del cliente no encontrado. No se puede actualizar.');
                }
                
                console.log('=== ACTUALIZANDO CLIENTE EXISTENTE ===');
                console.log('Customer ID:', customer.id);
                console.log('Datos para UPDATE:', JSON.stringify(dataToSave, null, 2));
                
                const { data, error } = await supabase
                    .from('customers')
                    .update(dataToSave)
                    .eq('id', customer.id)
                    .select()
                    .single();
                    
                if (error) {
                    console.error('Error en UPDATE:', error);
                    console.error('Customer ID usado:', customer.id);
                    console.error('Datos enviados:', JSON.stringify(dataToSave, null, 2));
                    throw error;
                }
                result = data;
                console.log('Cliente actualizado exitosamente:', result);
                // toast.success('✅ Cliente actualizado correctamente');
                alert('✅ Cliente actualizado correctamente');
            }

            // SOLUCIÓN EXTREMA: NO HACER NADA DESPUÉS DEL GUARDADO
            console.log('✅ GUARDADO COMPLETADO - NO SE EJECUTA NADA MÁS');
            
            // NO CAMBIAR ESTADO - PUEDE CAUSAR RE-RENDER PROBLEMÁTICO
            // setIsEditing(false);
            
        } catch (error) {
            console.error('Error saving customer:', error);
            // toast.error('❌ Error al guardar cliente. Intenta de nuevo.');
            alert('❌ Error al guardar cliente: ' + error.message);
        } finally {
            setSaving(false);
        }
        
        // PREVENIR CUALQUIER ERROR ADICIONAL
        return;
    };

    if (!isOpen) return null;

    // Determinar segmento actual - PROTEGIDO CONTRA ERRORES
    // Usa el mismo sistema que Clientes.jsx (vertical params)
    let currentSegment = 'nuevo';
    let segmentInfo = CUSTOMER_SEGMENTS.nuevo;
    
    try {
        currentSegment = customer ? calculateSegmentByVertical(customer, verticalParams) : 'nuevo';
        segmentInfo = CUSTOMER_SEGMENTS[currentSegment] || CUSTOMER_SEGMENTS.nuevo;
    } catch (segmentError) {
        console.error('Error determinando segmento (ignorado):', segmentError);
    }

    // Calcular días desde última visita
    let daysSinceLastVisit = null;
    if (formData.last_visit_at) {
        try {
            const lastVisit = typeof formData.last_visit_at === 'string' 
                ? new Date(formData.last_visit_at) 
                : formData.last_visit_at;
            if (lastVisit && !isNaN(lastVisit.getTime())) {
                daysSinceLastVisit = Math.floor((new Date() - lastVisit) / (1000 * 60 * 60 * 24));
            }
        } catch (error) {
            console.warn('Error calculating days since last visit:', error);
            daysSinceLastVisit = null;
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${segmentInfo.bgColor} ${segmentInfo.borderColor} border`}>
                            <span className="text-lg">{segmentInfo.icon}</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {mode === 'create' ? 'Nuevo Cliente' : formData.name || 'Cliente'}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${segmentInfo.bgColor} ${segmentInfo.textColor} ${segmentInfo.borderColor} border`}>
                                    {segmentInfo.label}
                                </span>
                                {customer && (
                                    <span className="text-sm text-gray-500">
                                        Cliente desde {new Date(customer.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditing && mode !== 'create' && (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Editar
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Desactivar
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                        {[
                            { id: 'general', label: 'General', icon: <User className="w-4 h-4" /> },
                            { id: 'stats', label: 'Estadísticas', icon: <BarChart3 className="w-4 h-4" /> },
                            { id: 'preferences', label: 'Preferencias', icon: <Settings className="w-4 h-4" /> },
                            { id: 'consent', label: 'Permisos', icon: <Shield className="w-4 h-4" /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Tab: General */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Información Personal */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <User className="w-5 h-5 text-purple-600" />
                                        Información Personal
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nombre *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.first_name}
                                                onChange={(e) => {
                                                    const firstName = e.target.value;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        first_name: firstName,
                                                        // Actualizar nombre completo automáticamente
                                                        name: `${firstName} ${prev.last_name || ''}`.trim()
                                                    }));
                                                }}
                                            disabled={!isEditing}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                                            placeholder="Nombre"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Apellidos
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.last_name}
                                                onChange={(e) => {
                                                    const lastName = e.target.value;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        last_name: lastName,
                                                        // Actualizar nombre completo automáticamente
                                                        name: `${prev.first_name || ''} ${lastName}`.trim()
                                                    }));
                                                }}
                                            disabled={!isEditing}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                                            placeholder="Apellidos"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Información de Contacto */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-blue-600" />
                                        Información de Contacto
                                    </h3>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email
                                        </label>
                                        <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        disabled={!isEditing}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                                        placeholder="email@ejemplo.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Teléfono
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            disabled={!isEditing}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                                            placeholder="+34 600 000 000"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            🎂 Fecha de Cumpleaños
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.birthday}
                                            onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
                                            disabled={!isEditing}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Notas
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                            disabled={!isEditing}
                                            rows="3"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                                            placeholder="Notas adicionales sobre el cliente..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab: Estadísticas */}
                    {activeTab === 'stats' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">Total Visitas</span>
                                    </div>
                                    <p className="text-lg font-bold text-blue-900">{formData.visits_count}</p>
                                </div>

                                <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-medium text-green-800">Total Gastado</span>
                                    </div>
                                    <p className="text-lg font-bold text-green-900">{formData.total_spent}€</p>
                                </div>

                                <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target className="w-5 h-5 text-purple-600" />
                                        <span className="text-sm font-medium text-purple-800">Ticket Promedio</span>
                                    </div>
                                    <p className="text-lg font-bold text-purple-900">{formData.avg_ticket}€</p>
                                </div>

                                <div className="bg-orange-50 p-2 rounded-lg border border-orange-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                                        <span className="text-sm font-medium text-orange-800">Riesgo Pérdida</span>
                                    </div>
                                    <p className="text-lg font-bold text-orange-900">{formData.churn_risk_score}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-gray-600" />
                                        Última Actividad
                                    </h4>
                                    {formData.last_visit_at ? (
                                        <div>
                                            <p className="text-sm text-gray-600">Última visita:</p>
                                            <p className="font-medium">
                                                {new Date(formData.last_visit_at).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            {daysSinceLastVisit !== null && (
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Hace {daysSinceLastVisit} días
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">Sin visitas registradas</p>
                                    )}
                                </div>

                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-purple-600" />
                                        IA Predictiva
                                    </h4>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-sm text-gray-600">Valor de Vida Predicho:</p>
                                            <p className="font-medium">{formData.predicted_ltv}€</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Items Preferidos:</p>
                                            <p className="text-sm text-gray-500">
                                                {formData.preferred_items.length > 0 
                                                    ? formData.preferred_items.join(', ')
                                                    : 'Analizando preferencias...'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab: Preferencias */}
                    {activeTab === 'preferences' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-gray-600" />
                                    Preferencias del Cliente
                                </h3>
                                <div className="bg-gray-50 p-2 rounded-lg">
                                    <p className="text-gray-600 text-center">
                                        Las preferencias se actualizarán automáticamente basándose en el historial de pedidos y comportamiento del cliente.
                                    </p>
                                </div>
                            </div>

                            {/* SECCIÓN DE ETIQUETAS ELIMINADA - CAUSABA PROBLEMAS DE GUARDADO */}
                        </div>
                    )}

                    {/* Tab: Permisos */}
                    {activeTab === 'consent' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-green-600" />
                                    Gestión de Consentimientos (GDPR)
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-5 h-5 text-blue-600" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Comunicación por Email</h4>
                                                <p className="text-sm text-gray-600">Autorización para enviar emails promocionales y informativos</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.consent_email}
                                                onChange={(e) => setFormData(prev => ({ ...prev, consent_email: e.target.checked }))}
                                                disabled={!isEditing}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                            />
                                            <span className="text-sm font-medium">
                                                {formData.consent_email ? 'Autorizado' : 'No autorizado'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex items-center gap-3">
                                            <MessageSquare className="w-5 h-5 text-green-600" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Comunicación por SMS</h4>
                                                <p className="text-sm text-gray-600">Autorización para enviar mensajes SMS</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.consent_sms}
                                                onChange={(e) => setFormData(prev => ({ ...prev, consent_sms: e.target.checked }))}
                                                disabled={!isEditing}
                                                className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:opacity-50"
                                            />
                                            <span className="text-sm font-medium">
                                                {formData.consent_sms ? 'Autorizado' : 'No autorizado'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-5 h-5 text-emerald-600" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">Comunicación por WhatsApp</h4>
                                                <p className="text-sm text-gray-600">Autorización para enviar mensajes por WhatsApp</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.consent_whatsapp}
                                                onChange={(e) => setFormData(prev => ({ ...prev, consent_whatsapp: e.target.checked }))}
                                                disabled={!isEditing}
                                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded disabled:opacity-50"
                                            />
                                            <span className="text-sm font-medium">
                                                {formData.consent_whatsapp ? 'Autorizado' : 'No autorizado'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(isEditing || mode === 'create') && (
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                        <button
                            onClick={() => {
                                if (mode === 'create') {
                                    onClose();
                                } else {
                                    setIsEditing(false);
                                }
                            }}
                            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={async () => {
                                if (!formData.first_name?.trim()) return;
                                
                                try {
                                    setSaving(true);
                                    
                                    // GUARDADO COMPLETO - SIN ETIQUETAS - SIN RECARGA
                                    const dataToSave = {
                                        name: `${formData.first_name} ${formData.last_name || ''}`.trim(),
                                        first_name: formData.first_name,
                                        last_name: formData.last_name || null,
                                        email: formData.email || null,
                                        phone: formData.phone || null,
                                        birthday: formData.birthday || null,
                                        notes: formData.notes || null,
                                        preferences: formData.preferences || null,
                                        consent_email: formData.consent_email || false,
                                        consent_sms: formData.consent_sms || false,
                                        consent_whatsapp: formData.consent_whatsapp || false,
                                        segment_manual: formData.segment_manual || null
                                    };
                                    
                                    let result;
                                    
                                    if (mode === 'create') {
                                        // CREAR nuevo cliente
                                        dataToSave.business_id = businessId;
                                        const { data, error } = await supabase
                                            .from('customers')
                                            .insert([dataToSave])
                                            .select()
                                            .single();
                                        
                                        if (error) throw error;
                                        result = data;
                                        
                                    } else {
                                        // ACTUALIZAR cliente existente
                                        const { error } = await supabase
                                            .from('customers')
                                            .update(dataToSave)
                                            .eq('id', customer?.id);
                                        
                                        if (error) throw error;
                                        result = { ...customer, ...dataToSave };
                                    }
                                    
                                    // Actualizar la lista local (esto actualiza la UI sin F5)
                                    if (onSave) {
                                        try {
                                            onSave(result);
                                        } catch (saveError) {
                                            console.error('Error en onSave:', saveError);
                                        }
                                    }
                                    
                                    // CERRAR MODAL
                                    setIsEditing(false);
                                    if (onClose) onClose();
                                    
                                    // Mensaje de éxito
                                    toast.success(mode === 'create' ? '✅ Cliente creado correctamente' : '✅ Cambios guardados');
                                    
                                } catch (error) {
                                    console.error('Error guardando cliente:', error);
                                    toast.error('❌ ERROR: ' + error.message);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving || !formData.first_name?.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {mode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
                        </button>
                    </div>
                )}
            </div>

            {/* Modal de confirmación de eliminación */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Trash2 className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    ⚠️ Desactivar cliente
                                </h3>
                                <p className="text-sm text-gray-600">
                                    El cliente se ocultará pero su histórico se mantendrá
                                </p>
                            </div>
                        </div>
                        
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                            <p className="text-sm text-blue-900">
                                <strong>Si desactivas este cliente:</strong><br />
                                ✓ Ya no aparecerá en búsquedas<br />
                                ✓ No podrá hacer nuevas reservas<br />
                                ✓ Su histórico se mantendrá para auditoría
                            </p>
                        </div>
                        
                        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                            <p className="text-sm text-gray-800">
                                <strong>Cliente:</strong> {formData.first_name} {formData.last_name}<br />
                                {formData.email && <><strong>Email:</strong> {formData.email}<br /></>}
                                {formData.phone && <><strong>Teléfono:</strong> {formData.phone}</>}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        setDeleting(true);
                                        
                                        // 1️⃣ VERIFICAR si tiene reservas ACTIVAS
                                        const { data: activeReservations, error: checkError } = await supabase
                                            .from('appointments')
                                            .select('id, reservation_date, reservation_time, status')
                                            .eq('customer_id', customer.id)
                                            .in('status', ['pending', 'pending_approval', 'confirmed']);

                                        if (checkError) throw checkError;

                                        // 2️⃣ Si tiene reservas ACTIVAS → PROHIBIR
                                        if (activeReservations && activeReservations.length > 0) {
                                            toast.error(
                                                `❌ Este cliente tiene ${activeReservations.length} reserva(s) activa(s). No se puede eliminar.`
                                            );
                                            setShowDeleteConfirm(false);
                                            setDeleting(false);
                                            return;
                                        }

                                        // 3️⃣ SOFT DELETE: Desactivar cliente (no eliminar físicamente)
                                        const { error } = await supabase
                                            .from('customers')
                                            .update({ 
                                                is_active: false,
                                                updated_at: new Date().toISOString()
                                            })
                                            .eq('id', customer.id);
                                        
                                        if (error) throw error;
                                        
                                        // Llamar callback si existe
                                        if (onDelete) {
                                            onDelete(customer.id);
                                        }
                                        
                                        // Cerrar modales
                                        setShowDeleteConfirm(false);
                                        onClose();
                                        
                                        // Mostrar mensaje de éxito
                                        toast.success('✅ Cliente desactivado correctamente');
                                        
                                    } catch (error) {
                                        console.error('Error desactivando cliente:', error);
                                        toast.error('❌ Error al desactivar el cliente: ' + error.message);
                                    } finally {
                                        setDeleting(false);
                                    }
                                }}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Desactivando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        SÍ, DESACTIVAR
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerModal;

