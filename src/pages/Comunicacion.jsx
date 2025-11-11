// CENTRO DE COMUNICACIÓN - V4.0 CON TIPOLOGÍA
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    MessageSquare, Phone, Search, User, AlertCircle, 
    RefreshCw, Instagram, Facebook, Globe, Bot, X, Send, Clock, 
    ExternalLink, MessageCircle, Users, CheckCheck,
    AlertTriangle, Shield, Check, HelpCircle, Smile, Meh, Frown,
    Star, Tag, TrendingUp, AlertOctagon, Award, ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
    getTipologia, 
    getAccion, 
    calculateTipologiaMetrics, 
    groupByTipologia,
    getBadge,
    TIPOLOGIAS,
    TIPOLOGIA_CONFIG
} from '../utils/conversationClassifier';

const CHANNELS = {
    whatsapp: { name: 'WhatsApp', icon: MessageSquare, bgClass: 'bg-green-50', iconClass: 'text-green-600', borderClass: 'border-green-200' },
    phone: { name: 'Teléfono', icon: Phone, bgClass: 'bg-purple-50', iconClass: 'text-purple-600', borderClass: 'border-purple-200' },
    instagram: { name: 'Instagram', icon: Instagram, bgClass: 'bg-pink-50', iconClass: 'text-pink-600', borderClass: 'border-pink-200' },
    facebook: { name: 'Facebook', icon: Facebook, bgClass: 'bg-blue-50', iconClass: 'text-blue-600', borderClass: 'border-blue-200' },
    webchat: { name: 'Web Chat', icon: Globe, bgClass: 'bg-gray-50', iconClass: 'text-gray-600', borderClass: 'border-gray-200' }
};

const STATUS_CONFIG = {
    active: { label: 'Activa', icon: MessageCircle, bgClass: 'bg-white', textClass: 'text-green-700', borderClass: 'border-gray-300' },
    resolved: { label: 'Resuelta', icon: CheckCheck, bgClass: 'bg-white', textClass: 'text-blue-700', borderClass: 'border-gray-300' }
};

// Helper para determinar el tipo basado en outcome
const getConversationType = (conv) => {
    if (conv.outcome === 'reservation_created') {
        return { label: 'Reserva', bgClass: 'bg-white', textClass: 'text-green-700', borderClass: 'border-gray-300' };
    }
    if (conv.outcome === 'reservation_modified') {
        return { label: 'Modificación', bgClass: 'bg-white', textClass: 'text-blue-700', borderClass: 'border-gray-300' };
    }
    if (conv.outcome === 'reservation_cancelled') {
        return { label: 'Cancelación', bgClass: 'bg-white', textClass: 'text-red-700', borderClass: 'border-gray-300' };
    }
    // Si no hay outcome o es inquiry
    return { label: 'Consulta', bgClass: 'bg-white', textClass: 'text-purple-700', borderClass: 'border-gray-300' };
};

// Helper para determinar completitud
const getCompletionStatus = (conv) => {
    if (conv.outcome && ['reservation_created', 'reservation_modified', 'inquiry_answered'].includes(conv.outcome)) {
        return { label: 'Completada', icon: Check, bgClass: 'bg-white', textClass: 'text-green-600', borderClass: 'border-gray-300' };
    }
    return { label: 'Pendiente', icon: HelpCircle, bgClass: 'bg-orange-50', textClass: 'text-orange-600', borderClass: 'border-orange-300' };
};

// Helper para sentiment badge
const getSentimentBadge = (sentiment) => {
    if (!sentiment) return null;
    
    const configs = {
        positive: { emoji: '😊', label: 'Positivo', icon: Smile, bgClass: 'bg-white', textClass: 'text-green-700', borderClass: 'border-gray-300' },
        neutral: { emoji: '😐', label: 'Neutral', icon: Meh, bgClass: 'bg-white', textClass: 'text-gray-600', borderClass: 'border-gray-300' },
        negative: { emoji: '😞', label: 'Negativo', icon: Frown, bgClass: 'bg-white', textClass: 'text-red-700', borderClass: 'border-gray-300' }
    };
    
    return configs[sentiment] || null;
};

// Helper para satisfaction stars
const getSatisfactionStars = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return 0;
    
    const satisfactionMap = {
        very_satisfied: 5,
        satisfied: 4,
        neutral: 3,
        unsatisfied: 2,
        very_unsatisfied: 1
    };
    
    return satisfactionMap[metadata.satisfaction_level] || 0;
};

export default function Comunicacion() {
    const { restaurant } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterChannel, setFilterChannel] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTipologia, setFilterTipologia] = useState('all'); // 🆕 Filtro por tipología
    const [stats, setStats] = useState({ 
        total: 0, 
        active: 0, 
        resolved: 0,
        // Estadísticas enriquecidas
        avgSatisfaction: 0,
        positivePercent: 0,
        escalations: 0,
        avgQuality: 0,
        // 🆕 Por tipología
        clientes: 0,
        proveedores: 0,
        incidencias: 0,
        ruido: 0
    });

    const loadConversations = useCallback(async () => {
        if (!restaurant?.id) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('agent_conversations')
                .select(`*, customers(id, name, email, phone), appointments(id, appointment_date, appointment_time)`)
                .eq('business_id', restaurant.id)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false });
            if (error) throw error;
            setConversations(data || []);
            
            // 🆕 Calcular métricas por tipología
            const tipologiaMetrics = calculateTipologiaMetrics(data || []);
            
            // Calcular estadísticas enriquecidas
            const conversationsWithAnalysis = (data || []).filter(c => c.metadata && typeof c.metadata === 'object');
            const totalAnalyzed = conversationsWithAnalysis.length;
            
            // % Positivos
            const positiveCount = conversationsWithAnalysis.filter(c => c.sentiment === 'positive').length;
            const positivePercent = totalAnalyzed > 0 ? Math.round((positiveCount / totalAnalyzed) * 100) : 0;
            
            // Escalaciones
            const escalations = conversationsWithAnalysis.filter(c => c.metadata?.escalation_needed === true).length;
            
            // Satisfacción promedio (1-5)
            const satisfactionScores = conversationsWithAnalysis
                .map(c => getSatisfactionStars(c.metadata))
                .filter(score => score > 0);
            const avgSatisfaction = satisfactionScores.length > 0 
                ? (satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length).toFixed(1)
                : 0;
            
            // Calidad promedio (1-5)
            const qualityScores = conversationsWithAnalysis
                .map(c => c.metadata?.resolution_quality)
                .filter(q => typeof q === 'number' && q > 0);
            const avgQuality = qualityScores.length > 0
                ? (qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(1)
                : 0;
            
            setStats({
                total: (data || []).length,
                active: (data || []).filter(c => c.status === 'active').length,
                resolved: (data || []).filter(c => c.status === 'resolved').length,
                avgSatisfaction: parseFloat(avgSatisfaction),
                positivePercent,
                escalations,
                avgQuality: parseFloat(avgQuality),
                // 🆕 Métricas por tipología
                clientes: tipologiaMetrics[TIPOLOGIAS.CLIENTES] || 0,
                proveedores: tipologiaMetrics[TIPOLOGIAS.PROVEEDORES] || 0,
                incidencias: tipologiaMetrics[TIPOLOGIAS.INCIDENCIAS] || 0,
                ruido: tipologiaMetrics[TIPOLOGIAS.RUIDO] || 0
            });
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al cargar conversaciones');
        } finally {
            setLoading(false);
        }
    }, [restaurant?.id]);

    const loadMessages = useCallback(async (conversationId) => {
        if (!conversationId) return;
        try {
            const { data, error } = await supabase
                .from('agent_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('timestamp', { ascending: true });
            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al cargar mensajes');
        }
    }, []);

    // 🆕 FUNCIÓN: Resolver conversación manualmente
    const closeConversation = async (conversationId) => {
        if (!confirm('¿Marcar esta conversación como resuelta?')) return;
        
        try {
            const { error } = await supabase
                .from('agent_conversations')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString()
                })
                .eq('id', conversationId)
                .eq('business_id', restaurant.id);
            
            if (error) throw error;
            
            toast.success('Conversación resuelta correctamente');
            loadConversations();
            setSelectedConversation(null);
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al cerrar conversación');
        }
    };

    // 🆕 FUNCIÓN: Calcular tiempo de inactividad
    const getInactivityTime = (conversation) => {
        if (!conversation.created_at) return null;
        
        const now = new Date();
        const lastActivity = new Date(conversation.created_at);
        const diffMs = now - lastActivity;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Ahora mismo';
        if (diffMins === 1) return 'Hace 1 minuto';
        if (diffMins < 60) return `Hace ${diffMins} minutos`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return 'Hace 1 hora';
        return `Hace ${diffHours} horas`;
    };

    const getFilteredConversations = useCallback(() => {
        let filtered = conversations;
        if (searchTerm) {
            filtered = filtered.filter(c => 
                c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                c.customer_phone?.includes(searchTerm) || 
                c.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (filterChannel !== 'all') filtered = filtered.filter(c => c.source_channel === filterChannel);
        if (filterStatus !== 'all') filtered = filtered.filter(c => c.status === filterStatus);
        
        // 🆕 Filtro por tipología
        if (filterTipologia !== 'all') {
            filtered = filtered.filter(c => {
                const { tipologia } = getTipologia(c.interaction_type, c);
                return tipologia === filterTipologia;
            });
        }
        
        return filtered;
    }, [conversations, searchTerm, filterChannel, filterStatus, filterTipologia]);

    // 🆕 Agrupar conversaciones por tipología y ordenar por prioridad
    const groupedConversations = useMemo(() => {
        const filtered = getFilteredConversations();
        
        // Si hay filtro de tipología, no agrupar (mostrar lista simple)
        if (filterTipologia !== 'all') {
            return { [filterTipologia]: filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
        }
        
        // Agrupar por tipología
        const grouped = groupByTipologia(filtered);
        
        // Ordenar cada grupo por fecha (más reciente primero)
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
        
        return grouped;
    }, [getFilteredConversations, filterTipologia]);

    useEffect(() => { loadConversations(); }, [loadConversations]);
    useEffect(() => { if (selectedConversation) loadMessages(selectedConversation.id); }, [selectedConversation, loadMessages]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
                <div className="text-center">
                    <RefreshCw className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-700">Cargando conversaciones...</p>
                    <p className="text-sm text-gray-500 mt-2">Conectando con el sistema IA</p>
                </div>
            </div>
        );
    }

    const filteredConversations = getFilteredConversations();

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 pb-20 lg:pb-0">
            {/* HEADER - MOBILE-FIRST */}
            <div className="bg-white">
                <div className="max-w-[85%] mx-auto px-3 sm:px-4 py-3 sm:py-4">
                    {/* Título + Badge - MOBILE-FIRST */}
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex-shrink-0">
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                                <span className="truncate">Centro de Comunicación</span>
                                <span className="text-[10px] sm:text-xs font-normal text-purple-600 bg-purple-100 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                                    IA Activa
                                </span>
                            </h1>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 hidden sm:block">
                                Todas las conversaciones gestionadas por tu asistente inteligente
                            </p>
                        </div>
                    </div>

                    {/* Panel Informativo COMPACTO */}
                    <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-bold text-xs text-gray-900 mb-1">
                                    ¿Qué es el Centro de Comunicación?
                                </h3>
                                <p className="text-xs text-gray-700 leading-relaxed mb-2">
                                    Aquí ves <strong>todas las conversaciones</strong> que tu asistente IA mantiene con clientes. 
                                    Se agrupan en ventanas de <strong>10 minutos</strong>. Color <strong className="text-purple-600">lila</strong> = agente, <strong>blanco</strong> = cliente.
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white p-1.5 rounded border border-green-200">
                                        <span className="font-semibold text-green-900">🟢 Activa:</span> En curso
                                    </div>
                                    <div className="bg-white p-1.5 rounded border border-blue-200">
                                        <span className="font-semibold text-blue-900">🔵 Resuelta:</span> Cerrada (auto 10min)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 📊 MÉTRICAS POR TIPOLOGÍA - COMPACTAS (igual que No-Shows) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-3">
                        {/* 🔴 Incidencias */}
                        <div 
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                filterTipologia === TIPOLOGIAS.INCIDENCIAS 
                                    ? 'bg-red-50 border-red-500 shadow-md' 
                                    : 'bg-white border-red-200 hover:border-red-400'
                            }`}
                            onClick={() => setFilterTipologia(filterTipologia === TIPOLOGIAS.INCIDENCIAS ? 'all' : TIPOLOGIAS.INCIDENCIAS)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-2xl">🔴</span>
                                <span className="text-2xl font-bold text-red-600">{stats.incidencias}</span>
                                    </div>
                            <p className="text-xs font-semibold text-red-700">Incidencias</p>
                            <p className="text-[10px] text-red-600">Requieren atención</p>
                                </div>

                        {/* 🟢 Clientes */}
                        <div 
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                filterTipologia === TIPOLOGIAS.CLIENTES 
                                    ? 'bg-green-50 border-green-500 shadow-md' 
                                    : 'bg-white border-green-200 hover:border-green-400'
                            }`}
                            onClick={() => setFilterTipologia(filterTipologia === TIPOLOGIAS.CLIENTES ? 'all' : TIPOLOGIAS.CLIENTES)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-2xl">🟢</span>
                                <span className="text-2xl font-bold text-green-600">{stats.clientes}</span>
                            </div>
                            <p className="text-xs font-semibold text-green-700">Clientes</p>
                            <p className="text-[10px] text-green-600">Reservas e info</p>
                                    </div>

                        {/* 🟡 Proveedores */}
                        <div 
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                filterTipologia === TIPOLOGIAS.PROVEEDORES 
                                    ? 'bg-yellow-50 border-yellow-500 shadow-md' 
                                    : 'bg-white border-yellow-200 hover:border-yellow-400'
                            }`}
                            onClick={() => setFilterTipologia(filterTipologia === TIPOLOGIAS.PROVEEDORES ? 'all' : TIPOLOGIAS.PROVEEDORES)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-2xl">🟡</span>
                                <span className="text-2xl font-bold text-yellow-600">{stats.proveedores}</span>
                                </div>
                            <p className="text-xs font-semibold text-yellow-700">Proveedores</p>
                            <p className="text-[10px] text-yellow-600">Comercial y gestión</p>
                            </div>

                        {/* ⚪ Ruido */}
                        <div 
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                filterTipologia === TIPOLOGIAS.RUIDO 
                                    ? 'bg-gray-50 border-gray-500 shadow-md' 
                                    : 'bg-white border-gray-200 hover:border-gray-400'
                            }`}
                            onClick={() => setFilterTipologia(filterTipologia === TIPOLOGIAS.RUIDO ? 'all' : TIPOLOGIAS.RUIDO)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-2xl">⚪</span>
                                <span className="text-2xl font-bold text-gray-600">{stats.ruido}</span>
                                    </div>
                            <p className="text-xs font-semibold text-gray-700">Ruido</p>
                            <p className="text-[10px] text-gray-600">Spam y equivocados</p>
                            </div>
                        </div>
                        
                    {/* 📊 MÉTRICAS GENERALES - COMPACTAS */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white p-2 rounded-md border border-gray-200">
                            <p className="text-[10px] font-medium text-gray-500 uppercase">Total</p>
                            <p className="text-base font-bold text-gray-900">{stats.total}</p>
                                    </div>
                        <div className="bg-white p-2 rounded-md border border-gray-200">
                            <p className="text-[10px] font-medium text-gray-500 uppercase">Activas</p>
                            <p className="text-base font-bold text-green-600">{stats.active}</p>
                                </div>
                        <div className="bg-white p-2 rounded-md border border-gray-200">
                            <p className="text-[10px] font-medium text-gray-500 uppercase">Resueltas</p>
                            <p className="text-base font-bold text-blue-600">{stats.resolved}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL - MOBILE-FIRST: SINGLE COLUMN */}
            <div className="max-w-[85%] mx-auto px-3 sm:px-4 py-3 sm:py-4">
                {/* MOBILE: Si hay conversación seleccionada, ocultar lista */}
                {/* DESKTOP: Mostrar ambos (grid) */}
                <div className={`grid grid-cols-1 ${!selectedConversation ? 'lg:grid-cols-3' : 'lg:grid-cols-3'} gap-3 sm:gap-6 lg:h-[calc(100vh-380px)]`}>
                    {/* LISTA DE CONVERSACIONES - MOBILE-FIRST */}
                    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Filtros Modernos */}
                        <div className="p-3 bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
                            {/* 🆕 Header con contador y botón actualizar */}
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-sm text-gray-900">
                                    Conversaciones ({filteredConversations.length})
                                </h2>
                                
                                {/* 🆕 Botón actualizar */}
                                <button
                                    onClick={() => loadConversations()}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200 transition-colors"
                                    title="Actualizar lista de conversaciones"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Actualizar</span>
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente, teléfono..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white transition-all"
                                    />
                                </div>
                                <select
                                    value={filterChannel}
                                    onChange={(e) => setFilterChannel(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white font-medium cursor-pointer hover:border-purple-400 transition-colors"
                                >
                                    <option value="all">📱 Todos los canales</option>
                                    {Object.entries(CHANNELS).map(([key, ch]) => (
                                        <option key={key} value={key}>{ch.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white font-medium cursor-pointer hover:border-purple-400 transition-colors"
                                >
                                    <option value="all">🔍 Todos los estados</option>
                                    <option value="active">✅ Activas</option>
                                    <option value="resolved">✔️ Resueltas</option>
                                </select>
                            </div>
                        </div>

                        {/* Lista Agrupada por Tipología */}
                        <div className="overflow-y-auto flex-1 p-2 space-y-3">
                            {Object.keys(groupedConversations).every(key => groupedConversations[key].length === 0) ? (
                                <div className="p-8 text-center text-gray-500">
                                    <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-20" />
                                    <p className="font-semibold">No hay conversaciones</p>
                                    <p className="text-sm mt-1">Las conversaciones aparecerán aquí</p>
                                </div>
                            ) : (
                                // Ordenar por prioridad: Incidencias → Clientes → Proveedores → Ruido
                                [TIPOLOGIAS.INCIDENCIAS, TIPOLOGIAS.CLIENTES, TIPOLOGIAS.PROVEEDORES, TIPOLOGIAS.RUIDO]
                                    .filter(tipologia => groupedConversations[tipologia]?.length > 0)
                                    .map(tipologia => {
                                        const config = TIPOLOGIA_CONFIG[tipologia];
                                        const conversations = groupedConversations[tipologia];
                                        
                                        return (
                                            <div key={tipologia} className="space-y-2">
                                                {/* Header de grupo */}
                                                <div className={`sticky top-0 px-3 py-2 ${config.bgClass} ${config.borderClass} border rounded-lg shadow-sm`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">{config.emoji}</span>
                                                            <h3 className={`text-sm font-bold ${config.textClass}`}>
                                                                {config.label} ({conversations.length})
                                                            </h3>
                                                        </div>
                                                        {tipologia === TIPOLOGIAS.INCIDENCIAS && (
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-200 text-red-800 rounded">
                                                                PRIORIDAD ALTA
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-600 mt-0.5">{config.descripcion}</p>
                                                </div>
                                                
                                                {/* Conversaciones del grupo */}
                                                <div className="space-y-2 pl-2">
                                                    {conversations.map((conv) => {
                                    const channel = CHANNELS[conv.source_channel] || CHANNELS.webchat;
                                    const status = STATUS_CONFIG[conv.status] || STATUS_CONFIG.resolved;
                                    const Icon = channel.icon;
                                    const StatusIcon = status.icon;
                                    const isSelected = selectedConversation?.id === conv.id;
                                    
                                    // Determinar tipo y completitud dinámicamente
                                    const conversationType = getConversationType(conv);
                                    const completionStatus = getCompletionStatus(conv);
                                    const CompletionIcon = completionStatus.icon;

                                    return (
                                        <div
                                            key={conv.id}
                                            onClick={() => setSelectedConversation(conv)}
                                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                                                isSelected
                                                    ? 'bg-purple-50 border-purple-500 shadow-md'
                                                    : 'bg-white border-gray-300 hover:border-purple-400'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Icono de canal */}
                                                <div className={`p-2 rounded-lg ${channel.bgClass} border ${channel.borderClass}`}>
                                                    <Icon className={`w-4 h-4 ${channel.iconClass}`} />
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    {/* Nombre + Tiempo */}
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="font-bold text-sm text-gray-900 truncate">
                                                            {conv.customer_name || 'Sin nombre'}
                                                        </h3>
                                                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                                            {formatDistanceToNow(parseISO(conv.created_at), { addSuffix: true, locale: es })}
                                                        </span>
                                                    </div>

                                                    {/* Teléfono */}
                                                    <p className="text-xs text-gray-600 mb-2">{conv.customer_phone}</p>

                                                    {/* Badges */}
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {/* Estado (Activa/Resuelta) */}
                                                        <span className={`text-xs px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${status.bgClass} ${status.textClass} border ${status.borderClass}`}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {status.label}
                                                        </span>

                                                        {/* Tipo (Reserva/Consulta/etc) */}
                                                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${conversationType.bgClass} ${conversationType.textClass} border ${conversationType.borderClass}`}>
                                                            {conversationType.label}
                                                        </span>

                                                        {/* Completitud (Completada/Pendiente) */}
                                                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${completionStatus.bgClass} ${completionStatus.textClass} border ${completionStatus.borderClass}`}>
                                                            <CompletionIcon className="w-3 h-3" />
                                                            {completionStatus.label}
                                                        </span>
                                                        
                                                        {/* NUEVO: Sentiment Badge */}
                                                        {(() => {
                                                            const sentimentBadge = getSentimentBadge(conv.sentiment);
                                                            if (!sentimentBadge) return null;
                                                            const SentimentIcon = sentimentBadge.icon;
                                                            return (
                                                                <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1 ${sentimentBadge.bgClass} ${sentimentBadge.textClass} border ${sentimentBadge.borderClass}`}>
                                                                    <span>{sentimentBadge.emoji}</span>
                                                                    <span className="hidden sm:inline">{sentimentBadge.label}</span>
                                                                </span>
                                                            );
                                                        })()}
                                                        
                                                        {/* NUEVO: Satisfaction Stars */}
                                                        {(() => {
                                                            const stars = getSatisfactionStars(conv.metadata);
                                                            if (stars === 0) return null;
                                                            return (
                                                                <span className="text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-0.5 bg-white text-purple-700 border border-gray-300">
                                                                    {[...Array(stars)].map((_, i) => (
                                                                        <Star key={i} className="w-3 h-3 fill-purple-500 text-purple-500" />
                                                                    ))}
                                                                </span>
                                                            );
                                                        })()}
                                                        
                                                        {/* 🆕 BADGE DE URGENCIA (solo para incidencias) */}
                                                        {(() => {
                                                            const badge = getBadge(conv);
                                                            if (!badge) return null;
                                                            return (
                                                                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${badge.bgClass} ${badge.textClass} border ${badge.borderClass} animate-pulse`}>
                                                                    {badge.text}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                                    })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* PANEL DE MENSAJES */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                        {selectedConversation ? (
                            <>
                                {/* Header del chat */}
                                <div className="p-3 border-b bg-gradient-to-r from-purple-50 to-blue-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                            {/* Botón VOLVER (solo mobile) */}
                                            <button
                                                onClick={() => setSelectedConversation(null)}
                                                className="lg:hidden p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                                            </button>
                                            
                                            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex-shrink-0">
                                                <User className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                                                    {selectedConversation.customer_name || 'Sin nombre'}
                                                </h3>
                                                <p className="text-[10px] sm:text-xs text-gray-600 truncate">{selectedConversation.customer_phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                            {selectedConversation.reservation_id && (
                                                <button
                                                    onClick={() => window.open(`/reservas?id=${selectedConversation.reservation_id}`, '_blank')}
                                                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow hover:shadow-md transition-all"
                                                >
                                                    <ExternalLink className="w-3 h-3 inline mr-1" />
                                                    Ver reserva
                                                </button>
                                            )}
                                            
                                            {/* 🆕 NUEVO: Botón "Resolver conversación" */}
                                            {selectedConversation.status === 'active' && (
                                                <button
                                                    onClick={() => closeConversation(selectedConversation.id)}
                                                    className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold shadow hover:shadow-md transition-all"
                                                    title="Marcar conversación como resuelta"
                                                >
                                                    <CheckCheck className="w-3 h-3 inline mr-1" />
                                                    Resolver
                                                </button>
                                            )}
                                            
                                            <button
                                                onClick={() => setSelectedConversation(null)}
                                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                                <X className="w-4 h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Meta información */}
                                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                Iniciada {format(parseISO(selectedConversation.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                                            </span>
                                        </div>
                                        
                                        {/* 🆕 NUEVO: Indicador de inactividad */}
                                        {selectedConversation.status === 'active' && (
                                            <div className="flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 text-orange-500" />
                                                <span className="text-orange-600 font-medium">
                                                    {getInactivityTime(selectedConversation)}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {selectedConversation.resolved_at && (
                                            <div className="flex items-center gap-1">
                                                <CheckCheck className="w-3 h-3 text-green-600" />
                                                <span>Resuelta en {Math.round(selectedConversation.resolution_time_seconds / 60)} min</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* NUEVO: Panel de Análisis IA (si existe metadata) */}
                                {selectedConversation.metadata && typeof selectedConversation.metadata === 'object' && Object.keys(selectedConversation.metadata).length > 0 && (
                                    <div className="border-b bg-gradient-to-br from-purple-50 via-blue-50 to-purple-50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Bot className="w-4 h-4 text-purple-600" />
                                            <h4 className="font-bold text-sm text-gray-900">Análisis IA</h4>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {/* Resumen */}
                                            {selectedConversation.metadata.conversation_summary && (
                                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-600 font-semibold mb-1">📝 Resumen:</p>
                                                    <p className="text-xs text-gray-800">{selectedConversation.metadata.conversation_summary}</p>
                                                </div>
                                            )}
                                            
                                            {/* Grid de métricas */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Calidad de resolución */}
                                                {typeof selectedConversation.metadata.resolution_quality === 'number' && (
                                                    <div className="bg-white p-2 rounded-lg border border-purple-200">
                                                        <p className="text-xs text-gray-600 font-semibold mb-1 flex items-center gap-1">
                                                            <Award className="w-3 h-3 text-purple-600" />
                                                            Calidad:
                                                        </p>
                                                        <div className="flex items-center gap-1">
                                                            {[...Array(5)].map((_, i) => (
                                                                <Star 
                                                                    key={i} 
                                                                    className={`w-3 h-3 ${i < selectedConversation.metadata.resolution_quality ? 'fill-purple-400 text-purple-400' : 'text-gray-300'}`} 
                                                                />
                                                            ))}
                                                            <span className="text-xs text-gray-700 ml-1">{selectedConversation.metadata.resolution_quality}/5</span>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Escalación */}
                                                {typeof selectedConversation.metadata.escalation_needed === 'boolean' && (
                                                    <div className={`p-2 rounded-lg border ${selectedConversation.metadata.escalation_needed ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                                        <p className="text-xs text-gray-600 font-semibold mb-1 flex items-center gap-1">
                                                            <AlertOctagon className={`w-3 h-3 ${selectedConversation.metadata.escalation_needed ? 'text-red-600' : 'text-green-600'}`} />
                                                            Escalación:
                                                        </p>
                                                        <p className={`text-xs font-bold ${selectedConversation.metadata.escalation_needed ? 'text-red-700' : 'text-green-700'}`}>
                                                            {selectedConversation.metadata.escalation_needed ? '⚠️ Requerida' : '✅ No necesaria'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Temas clave */}
                                            {selectedConversation.metadata.key_topics && Array.isArray(selectedConversation.metadata.key_topics) && selectedConversation.metadata.key_topics.length > 0 && (
                                                <div className="bg-white p-2 rounded-lg border border-blue-200">
                                                    <p className="text-xs text-gray-600 font-semibold mb-1 flex items-center gap-1">
                                                        <Tag className="w-3 h-3 text-blue-600" />
                                                        Temas tratados:
                                                    </p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedConversation.metadata.key_topics.map((topic, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                                                {topic}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Peticiones especiales */}
                                            {selectedConversation.metadata.special_requests && Array.isArray(selectedConversation.metadata.special_requests) && selectedConversation.metadata.special_requests.length > 0 && (
                                                <div className="bg-white p-2 rounded-lg border border-amber-200">
                                                    <p className="text-xs text-gray-600 font-semibold mb-1">🎯 Peticiones especiales:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedConversation.metadata.special_requests.map((request, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                                                                {request}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Notas */}
                                            {selectedConversation.metadata.notes && (
                                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-600 font-semibold mb-1">💡 Notas:</p>
                                                    <p className="text-xs text-gray-700 italic">{selectedConversation.metadata.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Mensajes */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-br from-gray-50 to-white">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-gray-500 py-12">
                                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="font-semibold">No hay mensajes</p>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[75%] rounded-xl px-4 py-2 shadow ${
                                                        msg.direction === 'outbound'
                                                            ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                                                            : 'bg-white border border-gray-200 text-gray-900'
                                                    }`}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                        {msg.message_text}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-1 gap-2">
                                                        <p
                                                            className={`text-xs font-medium ${
                                                                msg.direction === 'outbound' ? 'text-purple-200' : 'text-gray-500'
                                                            }`}
                                                        >
                                                            {format(parseISO(msg.timestamp), 'HH:mm')}
                                                        </p>
                                                        {msg.sender === 'agent' && (
                                                            <Bot className={`w-3 h-3 ${msg.direction === 'outbound' ? 'text-white opacity-60' : 'text-purple-600'}`} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
                                <div className="text-center">
                                    <MessageSquare className="w-20 h-20 mx-auto mb-4 opacity-10" />
                                    <p className="font-bold text-xl text-gray-900">Selecciona una conversación</p>
                                    <p className="text-gray-500 mt-2">Elige una conversación de la lista para ver los mensajes</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

