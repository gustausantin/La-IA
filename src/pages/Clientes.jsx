// Clientes.jsx - CRM con funcionalidad básica
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, parseISO, differenceInDays, subDays } from "date-fns";
import {
    Search, Plus, Users, Mail, Phone, Edit2, X, 
    RefreshCw, Settings, Crown,
    Clock, DollarSign, TrendingUp, CheckCircle2
} from "lucide-react";
import toast from "react-hot-toast";
import CustomerModal from "../components/CustomerModal";

// SEGMENTACIÓN INTELIGENTE - TODOS LOS SEGMENTOS REALES
const CUSTOMER_SEGMENTS = {
    nuevo: { 
        label: "Nuevo", 
        icon: "👋", 
        color: "blue",
        description: "Cliente recién registrado",
        priority: 1
    },
    regular: { 
        label: "Regular", 
        icon: "⭐", 
        color: "green",
        description: "Cliente con visitas regulares",
        priority: 2
    },
    vip: { 
        label: "VIP", 
        icon: "👑", 
        color: "purple",
        description: "Very Important Person - Cliente prioritario",
        priority: 5
    },
    ocasional: { 
        label: "Ocasional", 
        icon: "🕐", 
        color: "yellow",
        description: "Cliente con visitas esporádicas",
        priority: 3
    },
    inactivo: { 
        label: "Inactivo", 
        icon: "😴", 
        color: "gray",
        description: "Sin visitas recientes",
        priority: 4
    },
    en_riesgo: { 
        label: "En Riesgo", 
        icon: "⚠️", 
        color: "orange",
        description: "Cliente que puede perderse",
        priority: 6
    },
    alto_valor: { 
        label: "Alto Valor", 
        icon: "💎", 
        color: "indigo",
        description: "Cliente de alto valor económico",
        priority: 7
    }
};

// FUNCIÓN PARA CALCULAR SEGMENTO EN TIEMPO REAL
const calculateRealTimeSegment = (customer) => {
    if (!customer) return 'nuevo';
    
    const visitsCount = customer.visits_count || 0;
    const totalSpent = customer.total_spent || 0;
    const daysSinceLastVisit = customer.last_visit_at 
        ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
        : 999;
    
    // 1. Nuevo: 0-1 visitas
    if (visitsCount <= 1) return 'nuevo';
    
    // 2. VIP: 10+ visitas O gasto alto
    if (visitsCount >= 10 || totalSpent >= 500) return 'vip';
    
    // 3. Alto valor: Gasto elevado pero pocas visitas
    if (totalSpent >= 300 && visitsCount < 10) return 'alto_valor';
    
    // 4. Regular: 2-9 visitas y activo
    if (visitsCount >= 2 && visitsCount < 10 && daysSinceLastVisit <= 60) return 'regular';
    
    // 5. Ocasional: Pocas visitas, irregular
    if (visitsCount >= 2 && visitsCount < 5) return 'ocasional';
    
    // 6. Inactivo: No viene hace 90+ días
    if (daysSinceLastVisit >= 90) return 'inactivo';
    
    // 7. En riesgo: Entre 60-90 días sin venir
    if (daysSinceLastVisit >= 60 && daysSinceLastVisit < 90) return 'en_riesgo';
    
    return 'nuevo';
};

// Componente principal
export default function Clientes() {
    const navigate = useNavigate();
    const { restaurant, businessId, isReady } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState([]);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [modalMode, setModalMode] = useState('view'); // 'view', 'edit', 'create'
    const [filters, setFilters] = useState({ 
        search: "", 
        segment: "", 
        visitCount: "",
        spentRange: ""
    });
    const [sortBy, setSortBy] = useState('risk'); // 'risk', 'ticket', 'lastVisit', 'visits', 'trend'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' o 'desc'
    const [activeTab, setActiveTab] = useState('todos'); // 'todos', 'noshows', 'crm'

    // Cargar clientes
    const loadCustomers = useCallback(async () => {
        try {
            setLoading(true);
            
            if (!businessId) {
                console.log('📋 Clientes: Sin businessId');
                setCustomers([]);
                setLoading(false);
                return;
            }

            // ✅ Query con ESQUEMA REAL de Supabase (extraído 2025-11-08)
            // 📋 Ver: docs/01-arquitectura/SCHEMA-REAL-SUPABASE-2025.sql
            const { data: customers, error } = await supabase
                .from("customers")
                .select(`
                    id, business_id, name, first_name, last_name,
                    phone, email, birthday, notes,
                    consent_email, consent_sms, consent_whatsapp,
                    total_visits, last_visit_at, total_spent, avg_ticket,
                    segment_manual, segment_auto,
                    preferences, tags,
                    last_contacted_at, notifications_enabled, preferred_channel,
                    created_at, updated_at
                `)
                .eq("business_id", businessId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Procesar clientes usando ESQUEMA REAL de Supabase
            const processedCustomers = customers?.map(customer => {
                // Calcular días desde última visita
                const daysSinceLastVisit = customer.last_visit_at 
                    ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
                    : null;
                
                // Usar visits_count como alias de total_visits para compatibilidad
                const visitsCount = customer.total_visits || 0;
                
                return {
                    ...customer,
                    // ✅ Normalizar nombres de campos para compatibilidad con UI
                    visits_count: visitsCount, // UI espera visits_count, BD tiene total_visits
                    segment: customer.segment_manual || customer.segment_auto || 'nuevo',
                    daysSinceLastVisit,
                    // Valores por defecto para campos que no existen en BD
                    churn_risk_score: 0,
                    predicted_ltv: 0,
                    is_active: true
                };
            }) || [];

            console.log("✅ Clientes procesados:", processedCustomers.length);
            setCustomers(processedCustomers);

        } catch (error) {
            console.error("❌ Error cargando clientes:", error);
            toast.error("Error al cargar los clientes");
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    // Editar cliente
    const handleEditCustomer = (customer) => {
        setSelectedCustomer(customer);
        setModalMode('edit');
        setShowCustomerModal(true);
    };

    // Crear nuevo cliente
    const handleCreateCustomer = () => {
        setSelectedCustomer(null);
        setModalMode('create');
        setShowCustomerModal(true);
    };

    // Ver cliente
    const handleViewCustomer = (customer) => {
        setSelectedCustomer(customer);
        setModalMode('view');
        setShowCustomerModal(true);
    };

    // Filtrar y ordenar clientes
    const filteredAndSortedCustomers = useMemo(() => {
        // Primero filtrar
        let filtered = customers.filter(customer => {
            // Filtro por búsqueda de texto
            if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
                const matchesSearch = (
                customer.name.toLowerCase().includes(searchTerm) ||
                customer.email?.toLowerCase().includes(searchTerm) ||
                customer.phone?.includes(searchTerm)
            );
                if (!matchesSearch) return false;
            }

            // Filtro por segmento (usa el ya calculado)
            if (filters.segment) {
                if (customer.segment !== filters.segment) return false;
            }

            // Filtro por número de visitas
            if (filters.visitCount) {
                const visits = customer.visits_count || 0;
                if (filters.visitCount === 'new' && visits > 1) return false;
                if (filters.visitCount === 'frequent' && visits < 3) return false;
                if (filters.visitCount === 'loyal' && visits < 10) return false;
            }

            // Filtro por rango de gasto
            if (filters.spentRange) {
                const spent = customer.total_spent || 0;
                if (filters.spentRange === 'low' && spent >= 100) return false;
                if (filters.spentRange === 'medium' && (spent < 100 || spent >= 500)) return false;
                if (filters.spentRange === 'high' && spent < 500) return false;
            }

            return true;
        });

        // Luego ordenar
        return filtered.sort((a, b) => {
            let valueA, valueB;

            switch(sortBy) {
                case 'risk':
                    // Calcular riesgo para ambos
                    const calcRisk = (customer) => {
                        const daysSince = customer.last_visit_at 
                            ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
                            : null;
                        const visits = customer.visits_count || 0;
                        const totalSpent = customer.total_spent || 0;
                        
                        let risk = 0;
                        if (daysSince === null) {
                            risk = 10;
                        } else {
                            if (daysSince >= 90) risk += 60;
                            else if (daysSince >= 60) risk += 40;
                            else if (daysSince >= 30) risk += 20;
                            else if (daysSince >= 14) risk += 10;
                            
                            if (visits >= 10) risk -= 15;
                            else if (visits >= 5) risk -= 10;
                            
                            if (totalSpent >= 500) risk -= 10;
                            else if (totalSpent >= 200) risk -= 5;
                            
                            risk = Math.max(0, Math.min(100, risk));
                        }
                        return risk;
                    };
                    valueA = calcRisk(a);
                    valueB = calcRisk(b);
                    break;

                case 'ticket':
                    // Ticket promedio
                    const visitsA = a.visits_count || 0;
                    const visitsB = b.visits_count || 0;
                    valueA = visitsA > 0 ? (a.total_spent || 0) / visitsA : 0;
                    valueB = visitsB > 0 ? (b.total_spent || 0) / visitsB : 0;
                    break;

                case 'lastVisit':
                    // Última visita (más reciente = menor número de días)
                    const daysA = a.last_visit_at 
                        ? Math.floor((new Date() - new Date(a.last_visit_at)) / (1000 * 60 * 60 * 24))
                        : 999999;
                    const daysB = b.last_visit_at 
                        ? Math.floor((new Date() - new Date(b.last_visit_at)) / (1000 * 60 * 60 * 24))
                        : 999999;
                    valueA = daysA;
                    valueB = daysB;
                    break;

                case 'visits':
                    // Total de visitas
                    valueA = a.visits_count || 0;
                    valueB = b.visits_count || 0;
                    break;

                case 'name':
                    // Nombre alfabético
                    return sortOrder === 'asc' 
                        ? a.name.localeCompare(b.name)
                        : b.name.localeCompare(a.name);

                default:
                    valueA = 0;
                    valueB = 0;
            }

            // Aplicar orden ascendente o descendente
            if (sortOrder === 'asc') {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        });
    }, [customers, filters, sortBy, sortOrder]);

    // Mantener compatibilidad con código existente
    const filteredCustomers = filteredAndSortedCustomers;

    // Effects
    useEffect(() => {
        if (isReady && businessId) {
            loadCustomers();
        }
    }, [isReady, businessId, loadCustomers]);

    // Pantallas de carga y error
    if (!isReady) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-4">
                <div className="max-w-[85%] mx-auto">
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                            Cargando información del restaurante...
                        </h3>
                    </div>
                </div>
            </div>
        );
    }

    if (!businessId) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-4">
                <div className="max-w-[85%] mx-auto">
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-2" />
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                            Configuración Pendiente
                        </h3>
                        <p className="text-gray-600 mb-2">
                            Para gestionar clientes necesitas completar la configuración de tu restaurante.
                        </p>
                        <button
                            onClick={() => navigate('/configuracion')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <Settings className="w-4 h-4" />
                            Ir a Configuración
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-4">
            <div className="max-w-[85%] mx-auto space-y-3">
                {/* Header con gradiente corporativo */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg p-3 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white">Gestión de Clientes</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={loadCustomers}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur text-white border border-white/30 rounded-lg hover:bg-white/20 transition-all text-sm font-medium"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Actualizar
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-all text-sm font-bold shadow-md"
                            >
                                <Plus className="w-4 h-4" />
                                Nuevo Cliente
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🆕 PESTAÑAS: Todos los Clientes | Segmentación CRM */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('todos')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                activeTab === 'todos'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            Todos los Clientes
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                            }`}>
                                {customers.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('crm')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                activeTab === 'crm'
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <TrendingUp className="w-4 h-4" />
                            Segmentación CRM
                        </button>
                    </div>
                </div>

                {/* Dashboard de Clientes - Métricas por Segmento (solo si activeTab === 'todos' o 'crm') */}
                {(activeTab === 'todos' || activeTab === 'crm') && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">Estado de la Base de Clientes</h2>
                    </div>

                    {/* Desglose por segmentos con porcentajes */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {Object.entries(CUSTOMER_SEGMENTS).map(([key, segment]) => {
                            const count = customers.filter(c => c.segment === key).length;
                            const percentage = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0;
                            
                            const colorClasses = {
                                blue: 'from-blue-400 to-blue-600 border-blue-300 bg-blue-50',
                                green: 'from-green-400 to-green-600 border-green-300 bg-green-50',
                                purple: 'from-purple-400 to-purple-600 border-purple-300 bg-purple-50',
                                yellow: 'from-yellow-400 to-yellow-600 border-yellow-300 bg-yellow-50',
                                gray: 'from-gray-400 to-gray-600 border-gray-300 bg-gray-50',
                                orange: 'from-orange-400 to-orange-600 border-orange-300 bg-orange-50',
                                indigo: 'from-indigo-400 to-indigo-600 border-indigo-300 bg-indigo-50'
                            };
                            
                            return (
                                <div 
                                    key={key} 
                                    className={`p-2 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-102 ${
                                        filters.segment === key 
                                            ? `${colorClasses[segment.color]} border-2 shadow-md` 
                                            : 'border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50'
                                    }`}
                                    onClick={() => setFilters({...filters, segment: filters.segment === key ? '' : key})}
                                    title={`Filtrar por ${segment.label} (click para filtrar)`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-base">{segment.icon}</div>
                                        <div className="flex flex-col items-center flex-1">
                                            <div className="text-base font-bold text-gray-900">{count}</div>
                                            <div className="text-sm font-semibold text-gray-700">
                                                {segment.label}
                                            </div>
                                        </div>
                                        <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${colorClasses[segment.color]} text-white`}>
                                            {percentage}%
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Indicador de salud general - COMPACTO */}
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                            {/* Estado de salud */}
                            <div className="flex-shrink-0">
                                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Salud de la Base de Clientes</div>
                                <div className="text-sm font-semibold text-gray-900">
                                    {(() => {
                                        const regularCount = customers.filter(c => c.segment === 'regular').length;
                                        const activePercentage = customers.length > 0 ? (regularCount / customers.length) * 100 : 0;
                                        
                                        if (activePercentage >= 60) return "🟢 Excelente";
                                        if (activePercentage >= 40) return "🟡 Buena";
                                        if (activePercentage >= 20) return "🟠 Regular";
                                        return "🔴 Necesita atención";
                                    })()}
                                </div>
                            </div>
                            
                            {/* Análisis compacto */}
                            <div className="flex-1 text-sm text-gray-700">
                                {(() => {
                                    const regularCount = customers.filter(c => c.segment === 'regular').length;
                                    const riskCount = customers.filter(c => c.segment === 'en_riesgo').length;
                                    const inactiveCount = customers.filter(c => c.segment === 'inactivo').length;
                                    const newCount = customers.filter(c => c.segment === 'nuevo').length;
                                    const activePercentage = customers.length > 0 ? (regularCount / customers.length) * 100 : 0;
                                    const riskPercentage = customers.length > 0 ? (riskCount / customers.length) * 100 : 0;
                                    const inactivePercentage = customers.length > 0 ? (inactiveCount / customers.length) * 100 : 0;
                                    
                                    const issues = [];
                                    const recommendations = [];
                                    
                                    // Reglas de análisis
                                    if (activePercentage < 20) {
                                        issues.push(`Muy pocos clientes activos (${activePercentage.toFixed(0)}%)`);
                                        recommendations.push("Implementar estrategias de reactivación");
                                    }
                                    
                                    if (riskPercentage > 30) {
                                        issues.push(`Muchos clientes en riesgo (${riskPercentage.toFixed(0)}%)`);
                                        recommendations.push("Contactar clientes en riesgo urgentemente");
                                    }
                                    
                                    if (inactivePercentage > 40) {
                                        issues.push(`Demasiados clientes inactivos (${inactivePercentage.toFixed(0)}%)`);
                                        recommendations.push("Crear campañas de recuperación");
                                    }
                                    
                                    if (newCount > regularCount && customers.length > 5) {
                                        issues.push("Los clientes nuevos no se están fidelizando");
                                        recommendations.push("Mejorar experiencia de primeras visitas");
                                    }
                                    
                                    if (customers.length < 10) {
                                        issues.push("Base de clientes muy pequeña");
                                        recommendations.push("Enfocar en captación de nuevos clientes");
                                    }
                                    
                                    // Mostrar resultado COMPACTO
                                    if (issues.length === 0) {
                                        return (
                                            <div className="text-green-700">
                                                <span className="font-medium">✅ Excelente estado</span> - {activePercentage.toFixed(0)}% clientes activos
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                            <div>
                                                <div className="font-medium text-orange-700 mb-2">⚠️ Problemas detectados:</div>
                                                <div className="space-y-1">
                                                    {issues.slice(0, 3).map((issue, index) => (
                                                        <div key={index} className="text-xs text-gray-700">• {issue}</div>
                                                    ))}
                                                    {issues.length > 3 && (
                                                        <div className="text-xs text-gray-500 italic">
                                                            y {issues.length - 3} problema{issues.length - 3 > 1 ? 's' : ''} adicional{issues.length - 3 > 1 ? 'es' : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-blue-700 mb-2">💡 Recomendaciones:</div>
                                                <div className="space-y-1">
                                                    {recommendations.slice(0, 3).map((rec, index) => (
                                                        <div key={index} className="text-xs text-gray-700">• {rec}</div>
                                                    ))}
                                                    {recommendations.length > 3 && (
                                                        <div className="text-xs text-gray-500 italic">
                                                            y {recommendations.length - 3} acción{recommendations.length - 3 > 1 ? 'es' : ''} adicional{recommendations.length - 3 > 1 ? 'es' : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* 📋 CONTENIDO: TODOS LOS CLIENTES */}
                {activeTab === 'todos' && (
                <>
                {/* Filtros Avanzados */}
                <div className="bg-gray-100 rounded-xl shadow-lg border border-gray-300 p-3">
                    <div className="space-y-3">
                        {/* Búsqueda por texto */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" size={18} />
                        <input
                            type="text"
                            placeholder="🔍 Buscar por nombre, email o teléfono..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium bg-white shadow-sm"
                        />
                        </div>

                        {/* Filtros adicionales */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            {/* Filtro por Tipo de Cliente */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <Crown className="w-4 h-4 text-purple-500" />
                                    Tipo de Cliente
                                </label>
                                <select
                                    value={filters.segment}
                                    onChange={(e) => setFilters({ ...filters, segment: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-xs font-medium bg-white"
                                >
                                    <option value="">Todos</option>
                                    <option value="nuevo">👋 Nuevo</option>
                                    <option value="regular">⭐ Regular</option>
                                    <option value="vip">👑 VIP</option>
                                    <option value="ocasional">🕐 Ocasional</option>
                                    <option value="inactivo">😴 Inactivo</option>
                                    <option value="en_riesgo">⚠️ En Riesgo</option>
                                    <option value="alto_valor">💎 Alto Valor</option>
                                </select>
                            </div>

                            {/* Filtro por frecuencia de visitas */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    Frecuencia
                                </label>
                                <select
                                    value={filters.visitCount}
                                    onChange={(e) => setFilters({ ...filters, visitCount: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-medium bg-white"
                                >
                                    <option value="">Todas</option>
                                    <option value="new">👋 Nuevos (1 visita)</option>
                                    <option value="frequent">🔄 Frecuentes (5+)</option>
                                    <option value="loyal">⭐ Fieles (10+)</option>
                                </select>
                            </div>

                            {/* Filtro por rango de gasto */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <DollarSign className="w-4 h-4 text-green-500" />
                                    Gasto Total
                                </label>
                                <select
                                    value={filters.spentRange}
                                    onChange={(e) => setFilters({ ...filters, spentRange: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs font-medium bg-white"
                                >
                                    <option value="">Todos</option>
                                    <option value="low">💚 Bajo (&lt;€100)</option>
                                    <option value="medium">💛 Medio (€100-€500)</option>
                                    <option value="high">💜 Alto (€500+)</option>
                                </select>
                            </div>

                            {/* Ordenar por */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    Ordenar por
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-medium bg-white"
                                >
                                    <option value="risk">🎯 Riesgo</option>
                                    <option value="ticket">💰 Ticket Promedio</option>
                                    <option value="lastVisit">🕐 Última Visita</option>
                                    <option value="visits">📊 Visitas</option>
                                    <option value="name">📝 Nombre (A-Z)</option>
                                </select>
                            </div>
                        </div>

                        {/* Contador de resultados */}
                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                            Mostrando {filteredCustomers.length} de {customers.length} clientes
                            {(filters.search || filters.segment || filters.visitCount || filters.spentRange) && 
                                " (filtrados)"
                            }
                        </div>
                    </div>
                </div>

                {/* Lista de clientes - TABLA COMPACTA */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                            <p className="text-gray-600">Cargando clientes...</p>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {customers.length === 0 ? "No hay clientes registrados" : "No se encontraron clientes"}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {customers.length === 0 
                                    ? "Comienza creando tu primer cliente"
                                    : "Prueba con un término de búsqueda diferente"
                                }
                            </p>
                            {customers.length === 0 && (
                                <button
                                    onClick={handleCreateCustomer}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Crear primer cliente
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Segmento</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Última Visita</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Visitas</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Ticket Promedio</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Tendencia</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Riesgo</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Contacto</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCustomers.map((customer) => {
                                        const segmentColor = CUSTOMER_SEGMENTS[customer.segment]?.color || 'gray';
                                        const colorClasses = {
                                            blue: 'bg-blue-100 text-blue-700',
                                            green: 'bg-green-100 text-green-700',
                                            purple: 'bg-purple-100 text-purple-700',
                                            yellow: 'bg-yellow-100 text-yellow-700',
                                            gray: 'bg-gray-100 text-gray-700',
                                            orange: 'bg-orange-100 text-orange-700',
                                            indigo: 'bg-indigo-100 text-indigo-700'
                                        };
                                        const bgGradients = {
                                            blue: 'from-blue-500 to-blue-600',
                                            green: 'from-green-500 to-green-600',
                                            purple: 'from-purple-500 to-purple-600',
                                            yellow: 'from-yellow-500 to-yellow-600',
                                            gray: 'from-gray-500 to-gray-600',
                                            orange: 'from-orange-500 to-orange-600',
                                            indigo: 'from-indigo-500 to-indigo-600'
                                        };

                                        // Calcular "hace cuánto"
                                        const daysSince = customer.last_visit_at 
                                            ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
                                            : null;
                                        const lastVisitText = daysSince === null 
                                            ? 'Nunca' 
                                            : daysSince === 0 
                                            ? 'Hoy' 
                                            : daysSince === 1 
                                            ? 'Ayer' 
                                            : `Hace ${daysSince}d`;

                                        // Calcular Ticket Promedio
                                        const visits = customer.visits_count || 0;
                                        const totalSpent = customer.total_spent || 0;
                                        const avgTicket = visits > 0 ? (totalSpent / visits).toFixed(0) : 0;

                                        // Calcular Tendencia (basada en última visita vs promedio de frecuencia)
                                        let trend = '➡️'; // Estable por defecto
                                        let trendColor = 'text-gray-500';
                                        let trendTooltip = 'Estable';
                                        
                                        if (daysSince !== null && visits > 2) {
                                            // Si viene más frecuente que su promedio = subiendo
                                            if (daysSince < 30) {
                                                trend = '📈';
                                                trendColor = 'text-green-600';
                                                trendTooltip = 'Mejorando';
                                            } else if (daysSince > 60) {
                                                trend = '📉';
                                                trendColor = 'text-red-600';
                                                trendTooltip = 'Empeorando';
                                            }
                                        } else if (visits <= 2 && daysSince !== null && daysSince < 7) {
                                            trend = '📈';
                                            trendColor = 'text-green-600';
                                            trendTooltip = 'Cliente nuevo activo';
                                        }

                                        // Calcular Riesgo de Pérdida (0-100%)
                                        let riskScore = 0;
                                        let riskColor = 'text-green-600';
                                        let riskBgColor = 'bg-green-100';
                                        
                                        if (daysSince === null) {
                                            riskScore = 10; // Nunca vino = riesgo bajo (aún no lo perdimos)
                                        } else {
                                            // Aumenta con días sin venir
                                            if (daysSince >= 90) riskScore += 60;
                                            else if (daysSince >= 60) riskScore += 40;
                                            else if (daysSince >= 30) riskScore += 20;
                                            else if (daysSince >= 14) riskScore += 10;
                                            
                                            // Disminuye con frecuencia alta
                                            if (visits >= 10) riskScore -= 15;
                                            else if (visits >= 5) riskScore -= 10;
                                            
                                            // Disminuye con gasto alto
                                            if (totalSpent >= 500) riskScore -= 10;
                                            else if (totalSpent >= 200) riskScore -= 5;
                                            
                                            riskScore = Math.max(0, Math.min(100, riskScore));
                                        }
                                        
                                        if (riskScore <= 30) {
                                            riskColor = 'text-green-700';
                                            riskBgColor = 'bg-green-100';
                                        } else if (riskScore <= 60) {
                                            riskColor = 'text-yellow-700';
                                            riskBgColor = 'bg-yellow-100';
                                        } else {
                                            riskColor = 'text-red-700';
                                            riskBgColor = 'bg-red-100';
                                        }

                                        return (
                                            <tr 
                                                key={customer.id}
                                                onClick={() => handleViewCustomer(customer)}
                                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            >
                                                {/* Cliente (Avatar + Nombre) */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 bg-gradient-to-br ${bgGradients[segmentColor]} rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                                            {customer.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Segmento */}
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${colorClasses[segmentColor]}`}>
                                                        {CUSTOMER_SEGMENTS[customer.segment]?.icon} {CUSTOMER_SEGMENTS[customer.segment]?.label}
                                                    </span>
                                                </td>

                                                {/* Última Visita */}
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-gray-700">{lastVisitText}</span>
                                                </td>

                                                {/* Visitas */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-sm font-semibold text-gray-900">{visits}</span>
                                                </td>

                                                {/* Ticket Promedio */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-sm font-semibold text-purple-700">
                                                        {visits > 0 ? `€${avgTicket}` : '-'}
                                                    </span>
                                                </td>

                                                {/* Tendencia */}
                                                <td className="px-4 py-3 text-center">
                                                    <span 
                                                        className={`text-lg ${trendColor}`}
                                                        title={trendTooltip}
                                                    >
                                                        {trend}
                                                    </span>
                                                </td>

                                                {/* Riesgo de Pérdida */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${riskBgColor} ${riskColor}`}>
                                                        {riskScore}%
                                                    </span>
                                                </td>

                                                {/* Contacto */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {customer.phone && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`tel:${customer.phone}`, '_blank');
                                                                }}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                                title={customer.phone}
                                                            >
                                                                <Phone className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {customer.email && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`mailto:${customer.email}`, '_blank');
                                                                }}
                                                                className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                                                                title={customer.email}
                                                            >
                                                                <Mail className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Acciones */}
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditCustomer(customer);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>
            )}

            {/* 💼 CONTENIDO: SEGMENTACIÓN CRM */}
            {activeTab === 'crm' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
                    <TrendingUp className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Análisis y Segmentación CRM
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Vista estratégica con análisis avanzado, segmentación automática y predicciones de comportamiento.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-6">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-2xl mb-2">📊</div>
                            <div className="font-semibold text-gray-900">Dashboards Ejecutivos</div>
                            <div className="text-xs text-gray-600 mt-1">Métricas clave y KPIs</div>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="text-2xl mb-2">🎯</div>
                            <div className="font-semibold text-gray-900">Segmentación Automática</div>
                            <div className="text-xs text-gray-600 mt-1">Basada en comportamiento</div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="text-2xl mb-2">📈</div>
                            <div className="font-semibold text-gray-900">Predicciones ML</div>
                            <div className="text-xs text-gray-600 mt-1">LTV y riesgo de churn</div>
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg font-medium mt-6">
                        🚧 En desarrollo - Próximamente
                    </div>
                </div>
            )}

            {/* Modal Unificado de Cliente */}
            <CustomerModal
                customer={selectedCustomer}
                isOpen={showCustomerModal}
                businessId={businessId}
                mode={modalMode}
                    onClose={() => {
                    setShowCustomerModal(false);
                    setSelectedCustomer(null);
                    setModalMode('view');
                }}
                onDelete={(customerId) => {
                    // Eliminar cliente de la lista
                    setCustomers(prev => prev.filter(c => c.id !== customerId));
                }}
                onSave={(updatedCustomer) => {
                    try {
                        // Actualizar cliente en la lista
                        setCustomers(prev => {
                            if (modalMode === 'create') {
                                return [...prev, updatedCustomer];
                            } else {
                                return prev.map(c => 
                                    c.id === updatedCustomer.id ? updatedCustomer : c
                                );
                            }
                        });
                        // NO recargar datos - ya tenemos los datos actualizados
                        console.log('Cliente actualizado en la lista local');
                    } catch (error) {
                        console.error('Error actualizando lista de clientes:', error);
                        // Si hay error, intentar recargar datos
                        setTimeout(() => {
                            loadCustomers();
                        }, 1000);
                    }
                }}
            />
            </div>
        </div>
    );
}
