// Clientes.jsx - CRM con funcionalidad básica
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, parseISO, differenceInDays, subDays } from "date-fns";
import {
    Search, Plus, Users, Mail, Phone, Edit2, X, 
    RefreshCw, Settings, Crown, AlertTriangle,
    Clock, DollarSign, TrendingUp, CheckCircle2, Zap,
    Target, Send, Eye, MessageSquare, Copy, Download, FileText, BarChart3,
    Calendar, StickyNote, XCircle
} from "lucide-react";
import toast from "react-hot-toast";
import CustomerModal from "../components/CustomerModal";
import { getVerticalConfig } from "../config/verticals";

// SEGMENTACIÓN INTELIGENTE - SISTEMA CRM POR VERTICAL (5 SEGMENTOS)
const CUSTOMER_SEGMENTS = {
    vip: { 
        label: "VIP", 
        icon: "👑", 
        color: "purple",
        description: "Cliente prioritario - Alto valor",
        priority: 1
    },
    nuevo: { 
        label: "Nuevo", 
        icon: "👋", 
        color: "blue",
        description: "Primera/segunda visita (< 90 días)",
        priority: 2
    },
    regular: { 
        label: "Regular", 
        icon: "⭐", 
        color: "green",
        description: "Cliente fiel y activo",
        priority: 3
    },
    en_riesgo: { 
        label: "En Riesgo", 
        icon: "⚠️", 
        color: "orange",
        description: "Cliente que puede perderse",
        priority: 4
    },
    inactivo: { 
        label: "Inactivo", 
        icon: "😴", 
        color: "gray",
        description: "Sin visitas recientes - Necesita recuperación",
        priority: 5
    }
};

// 🆕 MVP: FUNCIÓN PARA FORMATEAR TELÉFONO (XXX XX XX XX)
const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Eliminar todos los caracteres no numéricos
    const cleaned = phone.replace(/\D/g, '');
    // Formato español: XXX XX XX XX
    if (cleaned.length === 9) {
        return cleaned.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }
    // Si tiene prefijo internacional +34
    if (cleaned.length === 11 && cleaned.startsWith('34')) {
        return '+34 ' + cleaned.substring(2).replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }
    // Fallback: devolver el original
    return phone;
};

// 🆕 MVP: DETECTAR SI UNA NOTA ES CRÍTICA (palabras clave)
const isNoteCritical = (note) => {
    if (!note) return false;
    const criticalKeywords = ['alergia', 'alergico', 'ojo', 'importante', 'cuidado', 'atencion', 'aviso', 'nunca', 'prohibido'];
    const noteLower = note.toLowerCase();
    return criticalKeywords.some(keyword => noteLower.includes(keyword));
};

// FUNCIÓN PARA CALCULAR SEGMENTO SEGÚN PARÁMETROS DEL VERTICAL
const calculateSegmentByVertical = (customer, verticalParams) => {
    if (!customer) return 'nuevo';
    if (!verticalParams) return 'nuevo'; // Fallback si no hay parámetros
    
    const lifetimeVisits = customer.total_visits || 0;
    const totalSpent = customer.total_spent || 0;
    const daysSinceLastVisit = customer.last_visit_at 
        ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
        : 999;
    const daysSinceFirstVisit = customer.created_at
        ? Math.floor((new Date() - new Date(customer.created_at)) / (1000 * 60 * 60 * 24))
        : 0;
    
    // Calcular thresholds (sin Personal Cadence por ahora - se puede añadir después)
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

// Componente principal
export default function Clientes() {
    const navigate = useNavigate();
    const { business, businessId, isReady } = useAuthContext();
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
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // 🆕 Control de filtros avanzados
    
    // 🆕 NUEVO: Parámetros del vertical para segmentación CRM
    const [verticalParams, setVerticalParams] = useState(null);

    // 🆕 FASE 2: Modal de Campaña
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [campaignData, setCampaignData] = useState({
        segment: '',
        clients: [],
        message: '',
        title: ''
    });

    // 🎨 Configuración del vertical (labels e iconos personalizados)
    const verticalConfig = useMemo(() => {
        return getVerticalConfig(business?.vertical_type);
    }, [business?.vertical_type]);

    // 🆕 Cargar parámetros del vertical desde Supabase
    const loadVerticalParams = useCallback(async () => {
        try {
            if (!business?.vertical_type) {
                console.log('📊 CRM: Sin vertical_type en el negocio');
                return;
            }

            console.log(`📊 CRM: Cargando parámetros para vertical "${business.vertical_type}"`);
            
            const { data, error } = await supabase
                .from('crm_vertical_parameters')
                .select('*')
                .eq('vertical_id', business.vertical_type)
                .single();

            if (error) {
                console.error('❌ Error cargando parámetros del vertical:', error);
                return;
            }

            if (data) {
                console.log('✅ Parámetros del vertical cargados:', data);
                setVerticalParams(data);
            }
        } catch (error) {
            console.error('❌ Error cargando parámetros del vertical:', error);
        }
    }, [business]);

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
            // ✅ EXCLUIR cliente genérico de Google Calendar (no es un cliente real)
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
                .neq("name", "Cliente de Google Calendar") // ✅ NO mostrar cliente genérico del sistema
                .order("created_at", { ascending: false });

            if (error) throw error;

            // 🆕 MVP: Cargar próximas citas por cliente
            const today = format(new Date(), 'yyyy-MM-dd');
            const { data: nextAppointments } = await supabase
                .from("appointments")
                .select("customer_id, appointment_date, appointment_time")
                .eq("business_id", businessId)
                .gte("appointment_date", today)
                .in("status", ["confirmed", "pending", "pending_approval"])
                .order("appointment_date", { ascending: true })
                .order("appointment_time", { ascending: true });

            // 🆕 MVP: Agrupar próximas citas por cliente (tomar solo la primera de cada uno)
            const nextAppointmentByCustomer = {};
            nextAppointments?.forEach(apt => {
                if (!nextAppointmentByCustomer[apt.customer_id]) {
                    nextAppointmentByCustomer[apt.customer_id] = {
                        date: apt.appointment_date,
                        time: apt.appointment_time
                    };
                }
            });

            // 🆕 MVP: Cargar contador de no-shows por cliente
            const { data: noShowData } = await supabase
                .from("appointments")
                .select("customer_id, status")
                .eq("business_id", businessId)
                .eq("status", "no_show");

            // Agrupar no-shows por cliente
            const noShowsByCustomer = {};
            noShowData?.forEach(apt => {
                noShowsByCustomer[apt.customer_id] = (noShowsByCustomer[apt.customer_id] || 0) + 1;
            });

            // Procesar clientes usando ESQUEMA REAL de Supabase
            const processedCustomers = customers?.map(customer => {
                // Calcular días desde última visita
                const daysSinceLastVisit = customer.last_visit_at 
                    ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
                    : null;
                
                // Usar visits_count como alias de total_visits para compatibilidad
                const visitsCount = customer.total_visits || 0;
                
                // 🆕 Calcular segmento usando parámetros del vertical
                let segment = customer.segment_manual || customer.segment_auto || 'nuevo';
                if (verticalParams) {
                    segment = calculateSegmentByVertical(customer, verticalParams);
                }

                // 🆕 MVP: Agregar próxima cita
                const nextAppointment = nextAppointmentByCustomer[customer.id] || null;

                // 🆕 MVP: Agregar contador de no-shows
                const noShowCount = noShowsByCustomer[customer.id] || 0;
                
                return {
                    ...customer,
                    // ✅ Normalizar nombres de campos para compatibilidad con UI
                    visits_count: visitsCount, // UI espera visits_count, BD tiene total_visits
                    segment: segment,
                    daysSinceLastVisit,
                    // 🆕 MVP: Nuevos campos calculados
                    next_appointment: nextAppointment,
                    no_show_count: noShowCount,
                    // Valores por defecto para campos que no existen en BD
                    churn_risk_score: 0,
                    predicted_ltv: 0,
                    is_active: true
                };
            }) || [];

            console.log("✅ Clientes procesados:", processedCustomers.length);
            console.log("📅 Próximas citas cargadas:", Object.keys(nextAppointmentByCustomer).length);
            console.log("🚫 No-shows contabilizados:", Object.keys(noShowsByCustomer).length);
            setCustomers(processedCustomers);

        } catch (error) {
            console.error("❌ Error cargando clientes:", error);
            toast.error("Error al cargar los clientes");
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [businessId, verticalParams]);

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

    // 🆕 FASE 2: Funciones de Campaña
    const handleOpenCampaign = (segment, title, defaultMessage) => {
        const targetClients = customers.filter(c => c.segment === segment);
        setCampaignData({
            segment,
            clients: targetClients,
            message: defaultMessage,
            title
        });
        setShowCampaignModal(true);
    };

    const handleCopyPhones = () => {
        const phones = campaignData.clients
            .filter(c => c.phone)
            .map(c => c.phone)
            .join('\n');
        
        navigator.clipboard.writeText(phones).then(() => {
            toast.success(`✅ ${campaignData.clients.filter(c => c.phone).length} teléfonos copiados al portapapeles`);
        }).catch(() => {
            toast.error('❌ Error al copiar teléfonos');
        });
    };

    const handleDownloadCSV = () => {
        const csvContent = [
            ['Nombre', 'Teléfono', 'Email', 'Última Visita', 'Visitas', 'Gasto Total'].join(','),
            ...campaignData.clients.map(c => [
                c.name || '',
                c.phone || '',
                c.email || '',
                c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : 'Nunca',
                c.visits_count || 0,
                `€${(c.total_spent || 0).toFixed(2)}`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `campana_${campaignData.segment}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        toast.success('✅ CSV descargado correctamente');
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
                    // ✅ Calcular riesgo usando parámetros del VERTICAL (NO hardcoded)
                    const calcRisk = (customer) => {
                        const daysSince = customer.last_visit_at 
                            ? Math.floor((new Date() - new Date(customer.last_visit_at)) / (1000 * 60 * 60 * 24))
                            : null;
                        const visits = customer.visits_count || 0;
                        const totalSpent = customer.total_spent || 0;
                        
                        if (daysSince === null || visits === 0) {
                            return 0; // Cliente nuevo sin visitas = sin riesgo
                        }
                        
                        if (!verticalParams) {
                            return 0; // Sin parámetros del vertical
                        }
                        
                        let risk = 0;
                        const riskThreshold = verticalParams.risk_min_days;
                        const inactiveThreshold = verticalParams.inactive_days;
                        
                        if (daysSince >= inactiveThreshold) {
                            risk = 90;
                        } else if (daysSince >= riskThreshold) {
                            const range = inactiveThreshold - riskThreshold;
                            const position = daysSince - riskThreshold;
                            risk = 30 + Math.round((position / range) * 60);
                        } else {
                            risk = Math.round((daysSince / riskThreshold) * 30);
                        }
                        
                        // Ajustar por lealtad
                        if (visits >= verticalParams.vip_min_visits_12m) risk = Math.max(0, risk - 20);
                        else if (visits >= 5) risk = Math.max(0, risk - 10);
                        
                        if (totalSpent >= verticalParams.vip_min_spend_12m) risk = Math.max(0, risk - 15);
                        else if (totalSpent >= 200) risk = Math.max(0, risk - 5);
                        
                        return Math.max(0, Math.min(100, risk));
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
    }, [customers, filters, sortBy, sortOrder, verticalParams]);

    // Mantener compatibilidad con código existente
    const filteredCustomers = filteredAndSortedCustomers;

    // Effects
    useEffect(() => {
        if (isReady && business) {
            loadVerticalParams();
        }
    }, [isReady, business, loadVerticalParams]);

    useEffect(() => {
        if (isReady && businessId && verticalParams) {
            loadCustomers();
        }
    }, [isReady, businessId, verticalParams, loadCustomers]);

    // Pantallas de carga y error
    if (!isReady) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-4">
                <div className="max-w-[85%] mx-auto">
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                            Cargando información del negocio...
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
                            Para gestionar clientes necesitas completar la configuración de tu negocio.
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
                {/* Header estilo Dashboard - limpio y espacioso */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 mb-2">
                                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" />
                                Gestión de Clientes
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600 ml-10 sm:ml-11">
                                {customers.length} clientes totales
                            </p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                onClick={() => toast('Función de importación próximamente', { icon: '📥' })}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm font-medium text-sm transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="hidden sm:inline">Importar</span>
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 shadow-md font-medium text-sm transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="hidden sm:inline">Nuevo Cliente</span>
                                <span className="sm:hidden">Nuevo</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🆕 PESTAÑAS: Todos los Clientes | Segmentación CRM */}
                {/* 🔴 MVP: Campañas Inteligentes ocultas para V2 */}
                {/* <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5">
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
                            onClick={() => setActiveTab('campaigns')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                activeTab === 'campaigns'
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <Zap className="w-4 h-4" />
                            Campañas Inteligentes
                        </button>
                    </div>
                </div> */}

                {/* 📊 SEGMENTOS VISUALES - REDISEÑADOS (Más grandes, con barra de progreso) */}
                {activeTab === 'todos' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Segmentos de Clientes</h2>
                                <p className="text-xs text-gray-500">Haz clic en un segmento para filtrar</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            <span className="font-semibold text-purple-700">{customers.length}</span> clientes totales
                        </div>
                    </div>

                    {/* Cards de Segmentos - Mobile-first: 1 columna en móvil */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Object.entries(CUSTOMER_SEGMENTS).map(([key, segment]) => {
                            const count = customers.filter(c => c.segment === key).length;
                            const percentage = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0;
                            
                            const colorClasses = {
                                blue: { 
                                    bg: 'from-blue-500 to-blue-600', 
                                    border: 'border-blue-400',
                                    hover: 'hover:shadow-blue-300',
                                    active: 'ring-blue-400 shadow-blue-200'
                                },
                                green: { 
                                    bg: 'from-green-500 to-green-600', 
                                    border: 'border-green-400',
                                    hover: 'hover:shadow-green-300',
                                    active: 'ring-green-400 shadow-green-200'
                                },
                                purple: { 
                                    bg: 'from-purple-500 to-purple-600', 
                                    border: 'border-purple-400',
                                    hover: 'hover:shadow-purple-300',
                                    active: 'ring-purple-400 shadow-purple-200'
                                },
                                orange: { 
                                    bg: 'from-orange-500 to-orange-600', 
                                    border: 'border-orange-400',
                                    hover: 'hover:shadow-orange-300',
                                    active: 'ring-orange-400 shadow-orange-200'
                                },
                                gray: { 
                                    bg: 'from-gray-500 to-gray-600', 
                                    border: 'border-gray-400',
                                    hover: 'hover:shadow-gray-300',
                                    active: 'ring-gray-400 shadow-gray-200'
                                }
                            };

                            const colors = colorClasses[segment.color];
                            const isActive = filters.segment === key;
                            
                            return (
                                <div 
                                    key={key} 
                                    className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 transform ${
                                        isActive 
                                            ? `bg-gradient-to-br ${colors.bg} border-transparent shadow-xl ${colors.active} ring-2 scale-105` 
                                            : `bg-white ${colors.border} ${colors.hover} hover:shadow-lg hover:scale-105 hover:-translate-y-1`
                                    }`}
                                    onClick={() => setFilters({...filters, segment: filters.segment === key ? '' : key})}
                                    title={`Filtrar por ${segment.label}`}
                                >
                                    {/* Icono */}
                                    <div className={`text-2xl mb-1.5 ${isActive ? 'scale-110' : ''} transition-transform duration-300`}>
                                        {segment.icon}
                                    </div>
                                    
                                    {/* Label */}
                                    <div className={`text-xs font-bold mb-1 ${isActive ? 'text-white' : 'text-gray-800'}`}>
                                                {segment.label}
                                            </div>
                                    
                                    {/* Count y Percentage */}
                                    <div className="flex items-baseline gap-1.5 mb-2">
                                        <span className={`text-xl font-extrabold ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                            {count}
                                        </span>
                                        <span className={`text-sm font-bold ${isActive ? 'text-white/90' : 'text-gray-600'}`}>
                                            {percentage}%
                                        </span>
                    </div>

                                    {/* Barra de Progreso */}
                                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isActive ? 'bg-white/30' : 'bg-gray-200'}`}>
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                isActive ? 'bg-white' : `bg-gradient-to-r ${colors.bg}`
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                            </div>
                            
                                    {/* Indicador de "Activo" */}
                                    {isActive && (
                                        <div className="absolute top-2 right-2">
                                            <CheckCircle2 className="w-4 h-4 text-white drop-shadow-lg" />
                                                        </div>
                                                    )}
                                        </div>
                                    );
                        })}
                    </div>
                </div>
                )}

                {/* 📋 CONTENIDO: TODOS LOS CLIENTES */}
                {activeTab === 'todos' && (
                <>
                {/* 🔍 BÚSQUEDA Y FILTROS - SIMPLIFICADOS */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                    <div className="space-y-3">
                        {/* Búsqueda principal y botón de filtros avanzados */}
                        <div className="flex flex-col md:flex-row gap-3">
                            {/* Barra de búsqueda */}
                    <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                                    placeholder="🔍 Buscar cliente por nombre, email o teléfono..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium bg-gray-50 focus:bg-white shadow-sm"
                        />
                        </div>

                            {/* Botón de Filtros Avanzados */}
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                                    showAdvancedFilters || filters.segment || filters.visitCount || filters.spentRange
                                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                                }`}
                            >
                                <Settings className="w-4 h-4" />
                                Filtros
                                {(filters.segment || filters.visitCount || filters.spentRange) && (
                                    <span className="px-2 py-0.5 bg-white/30 rounded-full text-xs font-bold">
                                        {[filters.segment, filters.visitCount, filters.spentRange].filter(Boolean).length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Panel de Filtros Avanzados (Desplegable) */}
                        {showAdvancedFilters && (
                            <div className="pt-3 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {/* Filtro por Tipo de Cliente */}
                            <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                    <Crown className="w-4 h-4 text-purple-500" />
                                    Tipo de Cliente
                                </label>
                                <select
                                    value={filters.segment}
                                    onChange={(e) => setFilters({ ...filters, segment: e.target.value })}
                                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium bg-white"
                                >
                                    <option value="">Todos</option>
                                            <option value="vip">👑 VIP</option>
                                    <option value="nuevo">👋 Nuevo</option>
                                    <option value="regular">⭐ Regular</option>
                                    <option value="en_riesgo">⚠️ En Riesgo</option>
                                            <option value="inactivo">😴 Inactivo</option>
                                </select>
                            </div>

                            {/* Filtro por frecuencia de visitas */}
                            <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    Frecuencia
                                </label>
                                <select
                                    value={filters.visitCount}
                                    onChange={(e) => setFilters({ ...filters, visitCount: e.target.value })}
                                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium bg-white"
                                >
                                    <option value="">Todas</option>
                                    <option value="new">👋 Nuevos (1 visita)</option>
                                    <option value="frequent">🔄 Frecuentes (5+)</option>
                                    <option value="loyal">⭐ Fieles (10+)</option>
                                </select>
                            </div>

                            {/* Filtro por rango de gasto */}
                            <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                    <DollarSign className="w-4 h-4 text-green-500" />
                                    Gasto Total
                                </label>
                                <select
                                    value={filters.spentRange}
                                    onChange={(e) => setFilters({ ...filters, spentRange: e.target.value })}
                                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-sm font-medium bg-white"
                                >
                                    <option value="">Todos</option>
                                    <option value="low">💚 Bajo (&lt;€100)</option>
                                    <option value="medium">💛 Medio (€100-€500)</option>
                                    <option value="high">💜 Alto (€500+)</option>
                                </select>
                            </div>

                            {/* Ordenar por */}
                            <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                                    Ordenar por
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium bg-white"
                                >
                                    <option value="risk">🎯 Riesgo</option>
                                    <option value="ticket">💰 Ticket Promedio</option>
                                    <option value="lastVisit">🕐 Última Visita</option>
                                    <option value="visits">📊 Visitas</option>
                                    <option value="name">📝 Nombre (A-Z)</option>
                                </select>
                            </div>
                        </div>

                                {/* Botón para limpiar filtros */}
                                {(filters.segment || filters.visitCount || filters.spentRange) && (
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={() => setFilters({ ...filters, segment: '', visitCount: '', spentRange: '' })}
                                            className="text-sm text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1"
                                        >
                                            <X className="w-4 h-4" />
                                            Limpiar filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Contador de resultados */}
                        <div className="flex items-center justify-between text-sm">
                            <div className="text-gray-600 font-medium">
                                Mostrando <span className="font-bold text-purple-700">{filteredCustomers.length}</span> de <span className="font-bold text-gray-900">{customers.length}</span> clientes
                            {(filters.search || filters.segment || filters.visitCount || filters.spentRange) && 
                                    <span className="ml-1 text-purple-600">(filtrados)</span>
                            }
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista de clientes - MOBILE-FIRST: CARDS + TABLA */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-6 sm:p-8 text-center">
                            <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                            <p className="text-sm sm:text-base text-gray-600">Cargando clientes...</p>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="text-center py-8 sm:py-12 px-4">
                            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-2" />
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {customers.length === 0 ? "No hay clientes registrados" : "No se encontraron clientes"}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
                                {customers.length === 0 
                                    ? "Comienza creando tu primer cliente"
                                    : "Prueba con un término de búsqueda diferente"
                                }
                            </p>
                            {customers.length === 0 && (
                                <button
                                    onClick={handleCreateCustomer}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Crear primer cliente
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* MOBILE: Cards (visible solo en mobile) */}
                            <div className="block md:hidden divide-y divide-gray-100">
                                {filteredCustomers.map((customer) => {
                                    const segmentInfo = CUSTOMER_SEGMENTS[customer.segment] || CUSTOMER_SEGMENTS.nuevo;
                                    const segmentColor = segmentInfo.color;
                                    const colorClasses = {
                                        blue: 'bg-blue-100 text-blue-700',
                                        green: 'bg-green-100 text-green-700',
                                        purple: 'bg-purple-100 text-purple-700',
                                        yellow: 'bg-yellow-100 text-yellow-700',
                                        gray: 'bg-gray-100 text-gray-700',
                                        orange: 'bg-orange-100 text-orange-700',
                                        indigo: 'bg-indigo-100 text-indigo-700'
                                    };

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

                                    // 🆕 MVP: Formatear próxima cita para mobile
                                    let nextAppointmentTextMobile = 'Sin agendar';
                                    if (customer.next_appointment) {
                                        const aptDate = parseISO(customer.next_appointment.date);
                                        const today = new Date();
                                        const daysUntil = Math.floor((aptDate - today) / (1000 * 60 * 60 * 24));
                                        
                                        if (daysUntil === 0) {
                                            nextAppointmentTextMobile = `Hoy`;
                                        } else if (daysUntil === 1) {
                                            nextAppointmentTextMobile = `Mañana`;
                                        } else if (daysUntil <= 7) {
                                            nextAppointmentTextMobile = format(aptDate, 'dd/MM');
                                        } else {
                                            nextAppointmentTextMobile = format(aptDate, 'dd/MM');
                                        }
                                    }

                                    return (
                                        <div
                                            key={customer.id}
                                            onClick={() => {
                                                setSelectedCustomer(customer);
                                                setModalMode('view');
                                                setShowCustomerModal(true);
                                            }}
                                            className="p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                {/* Nombre y Segmento */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-gray-900 text-sm truncate mb-1">
                                                        {customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Sin nombre'}
                                                    </h3>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorClasses[segmentColor]}`}>
                                                            <span>{segmentInfo.icon}</span>
                                                            {segmentInfo.label}
                                                        </span>
                                                        {customer.phone && (
                                                            <a 
                                                                href={`tel:${customer.phone}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-xs text-blue-600 flex items-center gap-1"
                                                            >
                                                                <Phone className="w-3 h-3" />
                                                                {formatPhoneNumber(customer.phone)}
                                                            </a>
                                                        )}
                                                        {/* 🆕 MVP: Badge de No-Shows */}
                                                        {customer.no_show_count > 0 && (
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                                customer.no_show_count >= 2 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                                <XCircle className="w-3 h-3" />
                                                                {customer.no_show_count} No-Show
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Botón editar */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditCustomer(customer);
                                                    }}
                                                    className="p-2.5 min-w-[44px] min-h-[44px] hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 touch-target flex items-center justify-center"
                                                >
                                                    <Edit2 className="w-4 h-4 text-gray-600" />
                                                </button>
                                            </div>

                                            {/* 🆕 MVP: Métricas simplificadas + Notas + Próxima Cita */}
                                            <div className="space-y-2">
                                                {/* Fila 1: Última visita + Próxima cita */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-gray-50 rounded-lg p-2">
                                                        <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Última Visita
                                                        </div>
                                                        <div className="text-xs font-semibold text-gray-900">{lastVisitText}</div>
                                                    </div>
                                                    <div className={`rounded-lg p-2 ${customer.next_appointment ? 'bg-green-50' : 'bg-gray-50'}`}>
                                                        <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            Próxima Cita
                                                        </div>
                                                        <div className={`text-xs font-semibold ${customer.next_appointment ? 'text-green-700' : 'text-gray-400'}`}>
                                                            {nextAppointmentTextMobile}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Fila 2: Notas (si existen) */}
                                                {customer.notes && (() => {
                                                    const isCritical = isNoteCritical(customer.notes);
                                                    
                                                    if (isCritical) {
                                                        // Nota CRÍTICA: fondo rojo suave
                                                        return (
                                                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                                                <div className="text-xs text-red-700 flex items-center gap-1 mb-1">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    <span className="font-bold">⚠️ Importante:</span>
                                                                </div>
                                                                <div className="text-xs text-red-800 font-medium line-clamp-2">
                                                                    {customer.notes}
                                                                </div>
                                                            </div>
                                                        );
                                                    } else {
                                                        // Nota NORMAL: fondo gris suave
                                                        return (
                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                                                                <div className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                                                                    <StickyNote className="w-3 h-3" />
                                                                    <span className="font-semibold">Nota:</span>
                                                                </div>
                                                                <div className="text-xs text-gray-700 italic line-clamp-2">
                                                                    {customer.notes}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DESKTOP: Tabla (visible solo en desktop) */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Teléfono</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Última Visita</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Próxima Cita</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Notas</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">No-Shows</th>
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

                                        // 🆕 MVP: Variables básicas necesarias
                                        const visits = customer.visits_count || 0;
                                        const totalSpent = customer.total_spent || 0;

                                        // 🆕 MVP: Formatear próxima cita
                                        let nextAppointmentText = 'Sin agendar';
                                        let nextAppointmentColor = 'text-gray-400';
                                        if (customer.next_appointment) {
                                            const aptDate = parseISO(customer.next_appointment.date);
                                            const today = new Date();
                                            const daysUntil = Math.floor((aptDate - today) / (1000 * 60 * 60 * 24));
                                            
                                            if (daysUntil === 0) {
                                                nextAppointmentText = `Hoy ${customer.next_appointment.time.substring(0, 5)}`;
                                                nextAppointmentColor = 'text-green-700 font-semibold';
                                            } else if (daysUntil === 1) {
                                                nextAppointmentText = `Mañana ${customer.next_appointment.time.substring(0, 5)}`;
                                                nextAppointmentColor = 'text-blue-700 font-semibold';
                                            } else if (daysUntil <= 7) {
                                                nextAppointmentText = `${format(aptDate, 'dd/MM')} ${customer.next_appointment.time.substring(0, 5)}`;
                                                nextAppointmentColor = 'text-purple-700';
                                            } else {
                                                nextAppointmentText = `${format(aptDate, 'dd/MM/yy')}`;
                                                nextAppointmentColor = 'text-gray-700';
                                            }
                                        }

                                        return (
                                            <tr 
                                                key={customer.id}
                                                onClick={() => handleViewCustomer(customer)}
                                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            >
                                                {/* Cliente (Avatar + Nombre + Segmento Badge) */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 bg-gradient-to-br ${bgGradients[segmentColor]} rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                                            {customer.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorClasses[segmentColor]} mt-0.5`}>
                                                                <span>{CUSTOMER_SEGMENTS[customer.segment]?.icon}</span>
                                                                {CUSTOMER_SEGMENTS[customer.segment]?.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Teléfono */}
                                                <td className="px-4 py-3">
                                                    {customer.phone ? (
                                                        <a 
                                                            href={`tel:${customer.phone}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                        >
                                                            <Phone className="w-3 h-3" />
                                                            {formatPhoneNumber(customer.phone)}
                                                        </a>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">-</span>
                                                    )}
                                                </td>

                                                {/* Última Visita */}
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-gray-700">{lastVisitText}</span>
                                                </td>

                                                {/* 🆕 Próxima Cita */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        <span className={`text-sm ${nextAppointmentColor}`}>
                                                            {nextAppointmentText}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 🆕 Notas */}
                                                <td className="px-4 py-3 text-center">
                                                    {customer.notes ? (
                                                        (() => {
                                                            const isCritical = isNoteCritical(customer.notes);
                                                            const isShort = customer.notes.length <= 25;
                                                            
                                                            if (isCritical) {
                                                                // Nota CRÍTICA: fondo rojo suave
                                                                return (
                                                                    <div 
                                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-lg cursor-help hover:bg-red-100 transition-colors"
                                                                        title={customer.notes}
                                                                    >
                                                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                                                        <span className="text-xs text-red-700 font-semibold">
                                                                            {customer.notes.length > 20 ? customer.notes.substring(0, 20) + '...' : customer.notes}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            } else if (isShort) {
                                                                // Nota CORTA: texto gris sin fondo
                                                                return (
                                                                    <span className="text-xs text-gray-600 italic">
                                                                        {customer.notes}
                                                                    </span>
                                                                );
                                                            } else {
                                                                // Nota LARGA: solo icono con tooltip
                                                                return (
                                                                    <div 
                                                                        className="inline-flex items-center gap-1 cursor-help text-gray-500 hover:text-gray-700 transition-colors"
                                                                        title={customer.notes}
                                                                    >
                                                                        <StickyNote className="w-4 h-4" />
                                                                    </div>
                                                                );
                                                            }
                                                        })()
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">-</span>
                                                    )}
                                                </td>

                                                {/* 🆕 No-Shows */}
                                                <td className="px-4 py-3 text-center">
                                                    {customer.no_show_count > 0 ? (
                                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                                                            customer.no_show_count >= 3 ? 'bg-red-100 text-red-700' :
                                                            customer.no_show_count >= 2 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                            <XCircle className="w-3 h-3" />
                                                            {customer.no_show_count}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-400 font-medium">0</span>
                                                    )}
                                                </td>

                                                {/* Acciones */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {customer.phone && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`, '_blank');
                                                                }}
                                                                className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                                                                title="WhatsApp"
                                                            >
                                                                <MessageSquare className="w-4 h-4" />
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
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditCustomer(customer);
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </div>
            </>
            )}

            {/* ⚡ CONTENIDO: CAMPAÑAS INTELIGENTES */}
            {activeTab === 'campaigns' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                                <Zap className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Campañas Inteligentes</h2>
                                <p className="text-white/90 text-sm">La IA ha analizado tus {customers.length} clientes y te sugiere estas acciones</p>
                            </div>
                        </div>
                    </div>

                    {/* 🚨 ACCIONES URGENTES */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            Acciones Urgentes
                    </h3>
                        
                        <div className="space-y-4">
                            {/* Card: Clientes En Riesgo */}
                            {(() => {
                                const enRiesgoClients = customers.filter(c => c.segment === 'en_riesgo');
                                const totalValue = enRiesgoClients.reduce((sum, c) => sum + (c.total_spent || 0), 0);
                                const avgTicket = customers.length > 0 
                                    ? customers.reduce((sum, c) => sum + (c.total_spent || 0), 0) / customers.reduce((sum, c) => sum + (c.visits_count || 0), 0)
                                    : 0;
                                const potentialValue = Math.round(enRiesgoClients.length * avgTicket);

                                return enRiesgoClients.length > 0 && (
                                    <div className="bg-white rounded-xl border-2 border-orange-200 shadow-lg p-6 hover:shadow-xl transition-all">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <AlertTriangle className="w-6 h-6 text-orange-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-xl font-bold text-gray-900 mb-2">
                                                    ⚠️ ¡Recupera a tus Clientes en Riesgo!
                                                </h4>
                                                <div className="space-y-2 mb-4">
                                                    <p className="text-gray-700">
                                                        <span className="font-bold text-orange-600">{enRiesgoClients.length} clientes</span> {enRiesgoClients.length === 1 ? 'lleva' : 'llevan'} más de {verticalParams?.risk_min_days || 56} días sin visita
                                                    </p>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="flex items-center gap-1 text-gray-600">
                                                            <DollarSign className="w-4 h-4" />
                                                            <strong>Valor histórico:</strong> €{totalValue.toFixed(0)}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-green-600">
                                                            <Target className="w-4 h-4" />
                                                            <strong>Valor potencial:</strong> €{potentialValue}
                                                        </span>
                        </div>
                        </div>
                                                
                                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <MessageSquare className="w-4 h-4 text-orange-600 mt-0.5" />
                                                        <span className="text-xs font-semibold text-orange-900">Mensaje sugerido:</span>
                        </div>
                                                    <p className="text-sm text-gray-700 italic">
                                                        "¡Hola [Nombre]! Te echamos de menos 😊 Han pasado [X] días desde tu última visita. 
                                                        ¿Qué te parece volver con un <strong>20% de descuento</strong>? ¡Reserva ya!"
                                                    </p>
                    </div>

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setActiveTab('todos');
                                                            setFilters({ ...filters, segment: 'en_riesgo' });
                                                            toast.success(`Mostrando ${enRiesgoClients.length} clientes en riesgo`);
                                                        }}
                                                        className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 transition-all font-semibold"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        Ver Lista ({enRiesgoClients.length})
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenCampaign(
                                                            'en_riesgo',
                                                            '⚠️ Recupera a tus Clientes en Riesgo',
                                                            `¡Hola [Nombre]! Te echamos de menos 😊 Han pasado [X] días desde tu última visita. ¿Qué te parece volver con un 20% de descuento? ¡Reserva ya!`
                                                        )}
                                                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold shadow-md"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                        Preparar Campaña
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* 💎 OPORTUNIDADES DE CRECIMIENTO */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            Oportunidades de Crecimiento
                        </h3>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Card: Clientes Inactivos */}
                            {(() => {
                                const inactivosClients = customers.filter(c => c.segment === 'inactivo');
                                const totalValue = inactivosClients.reduce((sum, c) => sum + (c.total_spent || 0), 0);
                                const avgTicket = customers.length > 0 
                                    ? customers.reduce((sum, c) => sum + (c.total_spent || 0), 0) / customers.reduce((sum, c) => sum + (c.visits_count || 0), 0)
                                    : 0;
                                const potentialValue = Math.round(inactivosClients.length * avgTicket);

                                return inactivosClients.length > 0 && (
                                    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-5 hover:shadow-xl transition-all">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-2xl">😴</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-gray-900 mb-2">
                                                    ¡Reactiva a tus Inactivos!
                                                </h4>
                                                <p className="text-sm text-gray-700 mb-2">
                                                    <span className="font-bold text-gray-900">{inactivosClients.length} clientes</span> sin visita hace más de {verticalParams?.inactive_days || 98} días
                                                </p>
                                                <p className="text-xs text-green-600 font-semibold mb-3">
                                                    💰 Valor potencial: €{potentialValue}
                                                </p>
                                                
                                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                                                    <p className="text-xs text-gray-700 italic">
                                                        "¡[Nombre]! Han pasado [X] meses... 🥺 ¿Volvemos a verte? Te regalamos un servicio adicional."
                                                    </p>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setActiveTab('todos');
                                                            setFilters({ ...filters, segment: 'inactivo' });
                                                            toast.success(`Mostrando ${inactivosClients.length} clientes inactivos`);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-gray-600 text-gray-600 rounded-lg hover:bg-gray-50 transition-all text-sm font-semibold"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        Ver ({inactivosClients.length})
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenCampaign(
                                                            'inactivo',
                                                            '😴 Reactiva a tus Clientes Inactivos',
                                                            `¡[Nombre]! Han pasado [X] meses... 🥺 ¿Volvemos a verte? Te regalamos un servicio adicional en tu próxima visita.`
                                                        )}
                                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm font-semibold"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                        Preparar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Card: Clientes Nuevos */}
                            {(() => {
                                const nuevosClients = customers.filter(c => c.segment === 'nuevo');
                                const avgTicket = customers.length > 0 
                                    ? customers.reduce((sum, c) => sum + (c.total_spent || 0), 0) / customers.reduce((sum, c) => sum + (c.visits_count || 0), 0)
                                    : 0;
                                const potentialValue = Math.round(nuevosClients.length * avgTicket * 5); // Potencial si se fidelizan (5 visitas más)

                                return nuevosClients.length > 0 && (
                                    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-5 hover:shadow-xl transition-all">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <span className="text-2xl">👋</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-gray-900 mb-2">
                                                    ¡Fideliza a tus Nuevos!
                                                </h4>
                                                <p className="text-sm text-gray-700 mb-2">
                                                    <span className="font-bold text-blue-600">{nuevosClients.length} clientes</span> nuevos (1-2 visitas)
                                                </p>
                                                <p className="text-xs text-green-600 font-semibold mb-3">
                                                    💰 Valor potencial: €{potentialValue} (si se fidelizan)
                                                </p>
                                                
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                                    <p className="text-xs text-gray-700 italic">
                                                        "¡Gracias por confiar en nosotros, [Nombre]! 🙌 ¿Qué tal tu experiencia? ¿Reservamos tu próxima cita?"
                                                    </p>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setActiveTab('todos');
                                                            setFilters({ ...filters, segment: 'nuevo' });
                                                            toast.success(`Mostrando ${nuevosClients.length} clientes nuevos`);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-all text-sm font-semibold"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        Ver ({nuevosClients.length})
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenCampaign(
                                                            'nuevo',
                                                            '👋 Fideliza a tus Clientes Nuevos',
                                                            `¡Gracias por confiar en nosotros, [Nombre]! 🙌 ¿Qué tal tu experiencia? Queremos verte pronto. ¿Reservamos tu próxima cita?`
                                                        )}
                                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                        Preparar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* 📊 RESUMEN DE IMPACTO */}
                    {(() => {
                        const enRiesgo = customers.filter(c => c.segment === 'en_riesgo').length;
                        const inactivos = customers.filter(c => c.segment === 'inactivo').length;
                        const nuevos = customers.filter(c => c.segment === 'nuevo').length;
                        const totalAlcance = enRiesgo + inactivos + nuevos;
                        const avgTicket = customers.length > 0 
                            ? customers.reduce((sum, c) => sum + (c.total_spent || 0), 0) / customers.reduce((sum, c) => sum + (c.visits_count || 0), 0)
                            : 0;
                        const potentialRevenue = Math.round(totalAlcance * avgTicket * 0.35); // 35% de conversión estimada
                        const potentialRevenueMax = Math.round(totalAlcance * avgTicket * 0.45); // 45% optimista

                        return totalAlcance > 0 && (
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-green-600" />
                                    Resumen de Impacto Potencial
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-3xl font-bold text-purple-600">{totalAlcance}</div>
                                        <div className="text-sm text-gray-600">Clientes objetivo</div>
                                        <div className="text-xs text-gray-500">{Math.round(totalAlcance / customers.length * 100)}% de tu base</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-green-600">€{Math.round(avgTicket)}</div>
                                        <div className="text-sm text-gray-600">Ticket promedio</div>
                                        <div className="text-xs text-gray-500">Por cliente</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-blue-600">30-40%</div>
                                        <div className="text-sm text-gray-600">Tasa de éxito</div>
                                        <div className="text-xs text-gray-500">Estimada del sector</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-orange-600">€{potentialRevenue}-{potentialRevenueMax}</div>
                                        <div className="text-sm text-gray-600">Ingresos esperados</div>
                                        <div className="text-xs text-gray-500">Si ejecutas las campañas</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 📊 Comparativa con el Sector */}
                    {customers.length >= 10 && (
                        <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-indigo-600" />
                                Comparativa con el Sector ({verticalConfig.name})
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* VIP Percentage */}
                                {(() => {
                                    const vipCount = customers.filter(c => c.segment === 'vip').length;
                                    const myVipPercentage = Math.round((vipCount / customers.length) * 100);
                                    const benchmarkVip = verticalConfig.benchmarks.vipPercentage;
                                    const diff = myVipPercentage - benchmarkVip;
                                    
                                    return (
                                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                                            <div className="text-sm text-gray-700 mb-2 font-semibold">Clientes VIP</div>
                                            <div className="flex items-baseline gap-2">
                                                <div className="text-2xl font-bold text-purple-700">{myVipPercentage}%</div>
                                                {Math.abs(diff) >= 2 && (
                                                    <div className={`text-sm font-semibold ${diff > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {diff > 0 ? '↗' : '↘'} {Math.abs(diff)}%
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Sector: {benchmarkVip}%
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Regular Percentage */}
                                {(() => {
                                    const regularCount = customers.filter(c => c.segment === 'regular').length;
                                    const myRegularPercentage = Math.round((regularCount / customers.length) * 100);
                                    const benchmarkRegular = verticalConfig.benchmarks.regularPercentage;
                                    const diff = myRegularPercentage - benchmarkRegular;
                                    
                                    return (
                                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                                            <div className="text-sm text-gray-700 mb-2 font-semibold">Clientes Regulares</div>
                                            <div className="flex items-baseline gap-2">
                                                <div className="text-2xl font-bold text-green-700">{myRegularPercentage}%</div>
                                                {Math.abs(diff) >= 2 && (
                                                    <div className={`text-sm font-semibold ${diff > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {diff > 0 ? '↗' : '↘'} {Math.abs(diff)}%
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Sector: {benchmarkRegular}%
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Churn Rate */}
                                {(() => {
                                    const inactivoCount = customers.filter(c => c.segment === 'inactivo').length;
                                    const myChurnRate = Math.round((inactivoCount / customers.length) * 100);
                                    const benchmarkChurn = verticalConfig.benchmarks.churnRate;
                                    const diff = myChurnRate - benchmarkChurn;
                                    
                                    return (
                                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                                            <div className="text-sm text-gray-700 mb-2 font-semibold">Tasa de Abandono</div>
                                            <div className="flex items-baseline gap-2">
                                                <div className="text-2xl font-bold text-orange-700">{myChurnRate}%</div>
                                                {Math.abs(diff) >= 2 && (
                                                    <div className={`text-sm font-semibold ${diff < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {diff < 0 ? '✅' : '⚠️'} {Math.abs(diff)}%
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Sector: {benchmarkChurn}% {diff < 0 && '(¡vas mejor!)'}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-xs text-blue-900">
                                    <strong>ℹ️ Comparativa:</strong> Datos basados en promedios del sector de {verticalConfig.name.toLowerCase()}. 
                                    Las diferencias significativas (±2%) se destacan automáticamente.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sin clientes en ningún segmento */}
                    {customers.filter(c => ['en_riesgo', 'inactivo', 'nuevo'].includes(c.segment)).length === 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                                ¡Excelente trabajo! 🎉
                    </h3>
                            <p className="text-gray-600">
                                No hay acciones urgentes en este momento. Tu base de clientes está saludable.
                    </p>
                        </div>
                    )}
                        </div>
            )}

            {/* 🚀 FASE 2: Modal de Campaña */}
            {showCampaignModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                                        <MessageSquare className="w-6 h-6" />
                        </div>
                                    {campaignData.title}
                                </h2>
                                <button
                                    onClick={() => setShowCampaignModal(false)}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                    </div>
                            <p className="text-white/90 text-sm">
                                Prepara tu mensaje y exporta los contactos
                            </p>
                    </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Destinatarios */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-purple-600" />
                                        Destinatarios ({campaignData.clients.length})
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyPhones}
                                            className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all text-sm font-semibold"
                                        >
                                            <Copy className="w-4 h-4" />
                                            Copiar Teléfonos
                                        </button>
                                        <button
                                            onClick={handleDownloadCSV}
                                            className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all text-sm font-semibold"
                                        >
                                            <Download className="w-4 h-4" />
                                            Descargar CSV
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 max-h-60 overflow-y-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {campaignData.clients.map((client) => (
                                            <div key={client.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                                    {client.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900 truncate">{client.name}</div>
                                                    <div className="text-xs text-gray-500">{client.phone || 'Sin teléfono'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {campaignData.clients.filter(c => !c.phone).length > 0 && (
                                    <div className="mt-2 text-sm text-orange-600 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span>{campaignData.clients.filter(c => !c.phone).length} cliente(s) sin teléfono</span>
                                    </div>
                                )}
                            </div>

                            {/* Mensaje */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-purple-600" />
                                        Mensaje de la Campaña
                                    </h3>
                                    <div className="text-sm text-gray-500">
                                        {campaignData.message.length} caracteres
                                    </div>
                                </div>
                                
                                <textarea
                                    value={campaignData.message}
                                    onChange={(e) => setCampaignData({ ...campaignData, message: e.target.value })}
                                    className="w-full h-32 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm resize-none"
                                    placeholder="Escribe tu mensaje aquí..."
                                />

                                <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="text-sm font-semibold text-blue-900 mb-2">💡 Variables disponibles:</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                                        <div><code className="bg-blue-100 px-2 py-1 rounded">[Nombre]</code> → Nombre del cliente</div>
                                        <div><code className="bg-blue-100 px-2 py-1 rounded">[X]</code> → Días desde última visita</div>
                                    </div>
                                    <div className="text-xs text-blue-700 mt-2">
                                        Las variables se reemplazarán automáticamente para cada cliente
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            {campaignData.clients.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-purple-600" />
                                        Vista Previa (Ejemplo)
                                    </h3>
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                                <MessageSquare className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-600">WhatsApp para:</div>
                                                <div className="text-sm font-bold text-gray-900">
                                                    {campaignData.clients[0].name} ({campaignData.clients[0].phone || 'Sin teléfono'})
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                                            {campaignData.message
                                                .replace('[Nombre]', campaignData.clients[0].name)
                                                .replace('[X]', campaignData.clients[0].last_visit_at 
                                                    ? Math.floor((new Date() - new Date(campaignData.clients[0].last_visit_at)) / (1000 * 60 * 60 * 24)).toString()
                                                    : '?')
                                            }
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 p-6 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    <span className="font-semibold text-gray-900">{campaignData.clients.filter(c => c.phone).length}</span> mensajes listos para enviar
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCampaignModal(false)}
                                        className="px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            toast.success('🚀 Próximamente: Envío automático vía N8N + WhatsApp');
                                            setShowCampaignModal(false);
                                        }}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-bold shadow-lg"
                                    >
                                        <Send className="w-4 h-4" />
                                        Enviar Campaña
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Unificado de Cliente */}
            <CustomerModal
                customer={selectedCustomer}
                isOpen={showCustomerModal}
                businessId={businessId}
                verticalType={business?.vertical_type}
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
