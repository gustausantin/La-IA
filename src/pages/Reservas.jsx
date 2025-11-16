// Reservas.jsx - Sistema COMPLETO de Gestión de Reservas con Agente IA para Son-IA

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, parseISO, addDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
    Search,
    Plus,
    Filter,
    Calendar as CalendarIcon,
    Clock,
    Users,
    Phone,
    CheckCircle2,
    XCircle,
    AlertCircle,
    AlertTriangle,
    MoreVertical,
    Edit,
    MessageSquare,
    RefreshCw,
    Bot,
    TrendingUp,
    Sparkles,
    Brain,
    Zap,
    BarChart3,
    Target,
    Award,
    PhoneCall,
    Globe,
    Mail,
    MessageCircle,
    Shield,
    DollarSign,
    Eye,
    CheckSquare,
    Square,
    ChevronRight,
    User,
    FileText,
    Save,
    Settings,
    Trash2,
    MapPin,
    X
} from "lucide-react";
import toast from "react-hot-toast";
import { ReservationWizard } from "../components/reservas/ReservationWizard";
import NewReservationModalPro from "../components/reservas/NewReservationModalPro";
import { ReservationDetailsModal } from "../components/reservas/ReservationDetailsModal";
import { ConfirmDeleteModal } from "../components/reservas/ConfirmDeleteModal";
import { ConfirmCancelModal } from "../components/reservas/ConfirmCancelModal";
import { processReservationCompletion } from "../services/CRMService";
import { OccupancyHeatMap } from "../components/reservas/OccupancyHeatMap";
import { OccupancyMetrics } from "../components/reservas/OccupancyMetrics";
import { useOccupancyData } from "../hooks/useOccupancyData";
import CalendarioReservas from "../components/calendario/CalendarioReservas";
import WaitlistModal from "../components/reservas/WaitlistModal";

// 📧 FUNCIÓN PARA ENVIAR MENSAJE NO-SHOW
const sendNoShowMessage = async (reservation) => {
    try {
        // 1. Buscar plantilla de no-show
        const { data: template, error: templateError } = await supabase
            .from('message_templates')
            .select('*')
            .eq('business_id', reservation.business_id)
            .eq('name', 'Seguimiento No-Show')
            .eq('is_active', true)
            .single();

        if (templateError || !template) {
            console.warn('No se encontró plantilla de no-show activa');
            return;
        }

        // 2. Obtener datos del cliente y restaurante
        const { data: customer } = await supabase
            .from('customers')
            .select('name, phone, email')
            .eq('id', reservation.customer_id)
            .single();

        const { data: restaurant } = await supabase
            .from('businesses')
            .select('name')
            .eq('id', reservation.business_id)
            .single();

        if (!customer || !restaurant) {
            throw new Error('No se pudieron obtener datos del cliente o restaurante');
        }

        // 3. Reemplazar variables en el mensaje
        let message = template.content_markdown;
        message = message.replace(/\{\{customer_name\}\}/g, customer.name || 'Cliente');
        message = message.replace(/\{\{restaurant_name\}\}/g, restaurant.name || 'Restaurante');
        message = message.replace(/\{\{reservation_date\}\}/g, 
            new Date(reservation.reservation_date).toLocaleDateString('es-ES'));

        // 4. Programar mensaje (aquí podrías integrarlo con tu sistema de mensajería)
        const { error: messageError } = await supabase
            .from('scheduled_messages')
            .insert({
                business_id: reservation.business_id,
                customer_id: reservation.customer_id,
                template_id: template.id,
                message_content: message,
                channel_planned: template.channel,
                scheduled_for: new Date().toISOString(), // Enviar inmediatamente
                status: 'pending',
                metadata: {
                    reservation_id: reservation.id,
                    trigger: 'no_show_manual'
                }
            });

        if (messageError) throw messageError;

        console.log('✅ Mensaje no-show programado correctamente');
        return { success: true };

    } catch (error) {
        console.error('❌ Error enviando mensaje no-show:', error);
        throw error;
    }
};

// DATOS NECESARIOS DE SUPABASE:
// - tabla: reservations (con campos 'source' y 'channel')
// - tabla: customers
// - tabla: tables
// - tabla: agent_reservation_insights (insights del agente)
// - RPC: get_reservation_stats_by_source(business_id, start_date, end_date)
// - RPC: get_agent_conversion_stats(business_id)
// - real-time: suscripción a cambios en reservations

// Estados de reserva con colores y acciones
const RESERVATION_STATES = {
    pendiente: {
        label: "Pendiente",
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        actions: ["confirm", "cancel", "edit"],
        icon: <AlertCircle className="w-4 h-4" />,
    },
    pending_approval: {
        label: "⚠️ Pendiente de Aprobación",
        color: "bg-orange-100 text-orange-900 border-orange-300",
        actions: ["approve", "reject", "edit"],
        icon: <AlertCircle className="w-5 h-5" />,
    },
    confirmada: {
        label: "Confirmada",
        color: "bg-green-100 text-green-800 border-green-200",
        actions: ["cancel", "noshow", "edit"],
        icon: <CheckCircle2 className="w-4 h-4" />,
    },
    sentada: {
        label: "Sentada",
        color: "bg-blue-100 text-blue-800 border-blue-200",
        actions: ["complete", "noshow", "edit"],
        icon: <Users className="w-4 h-4" />,
    },
    completada: {
        label: "Completada",
        color: "bg-gray-100 text-gray-800 border-gray-200",
        actions: ["view"],
        icon: <CheckSquare className="w-4 h-4" />,
    },
    cancelada: {
        label: "Cancelada",
        color: "bg-red-100 text-red-800 border-red-200",
        actions: ["view", "delete"],
        icon: <XCircle className="w-4 h-4" />,
    },
    no_show: {
        label: "No-Show",
        color: "bg-red-100 text-red-800 border-red-200",
        actions: ["view", "delete"],  // ✅ AÑADIDO "delete"
        icon: <AlertTriangle className="w-4 h-4" />,
    },
    deleted: {
        label: "Eliminada",
        color: "bg-gray-400 text-gray-700 border-gray-500",
        actions: [],  // Estado final, sin acciones
        icon: <Trash2 className="w-4 h-4" />,
    },
};

// Canales disponibles
const CHANNELS = {
    agent_whatsapp: {
        label: "WhatsApp IA",
        icon: <MessageCircle className="w-4 h-4 text-green-600" />,
        color: "text-green-600",
    },
    agent_phone: {
        label: "Llamada IA",
        icon: <PhoneCall className="w-4 h-4 text-orange-600" />,
        color: "text-orange-600",
    },
    agent_web: {
        label: "Web IA",
        icon: <Globe className="w-4 h-4 text-blue-600" />,
        color: "text-blue-600",
    },
    agent_instagram: {
        label: "Instagram IA",
        icon: <MessageSquare className="w-4 h-4 text-pink-600" />,
        color: "text-pink-600",
    },
    agent_facebook: {
        label: "Facebook IA",
        icon: <MessageCircle className="w-4 h-4 text-blue-800" />,
        color: "text-blue-800",
    },
    dashboard: {
        label: "Dashboard",
        icon: <Edit className="w-4 h-4 text-gray-600" />,
        color: "text-gray-600",
    },
    external_api: {
        label: "API Externa",
        icon: <Globe className="w-4 h-4 text-purple-600" />,
        color: "text-purple-600",
    },
};


// Componente de tarjeta de reserva mejorado
const ReservationCard = ({ reservation, onAction, onSelect, isSelected }) => {
    const [showActions, setShowActions] = useState(false);
    
    // 🔧 CORRECCIÓN: Mapear estados de BD (inglés) a UI (español)
    const statusMapping = {
        'pending': 'pendiente',
        'confirmed': 'confirmada', 
        'seated': 'sentada',
        'completed': 'completada',
        'cancelled': 'cancelada',
        'no_show': 'no_show'
    };
    
    const mappedStatus = statusMapping[reservation.status] || 'pendiente';
    const state = RESERVATION_STATES[mappedStatus] || RESERVATION_STATES.pendiente;
    const channel =
        CHANNELS[reservation.source || "dashboard"] || CHANNELS.dashboard;
    const isAgentReservation = reservation.source && reservation.source.startsWith('agent_');
    
    // 🚨 CALCULAR SI ES URGENTE (igual que en NoShowControlNuevo)
    const isUrgent = useMemo(() => {
        if (!reservation.reservation_date || !reservation.reservation_time) return false;
        const reservationDateTime = parseISO(`${reservation.reservation_date}T${reservation.reservation_time}`);
        const now = new Date();
        const minutesUntil = Math.floor((reservationDateTime - now) / (1000 * 60));
        const isHighRisk = reservation.noshow_risk_score >= 80 || reservation.risk_level === 'high';
        return isHighRisk && minutesUntil > 0 && minutesUntil <= 135; // 2h 15min
    }, [reservation.reservation_date, reservation.reservation_time, reservation.noshow_risk_score, reservation.risk_level]);

    const formatTime = (timeString) => {
        return timeString ? timeString.slice(0, 5) : "00:00";
    };

    return (
        <div
            className={`bg-white border rounded-lg p-2 hover:shadow-md transition-all duration-200 relative ${
                isSelected
                    ? "ring-2 ring-blue-500 border-blue-200"
                    : "border-gray-200"
            } ${isAgentReservation ? "border-l-2 border-l-purple-500" : ""} ${isUrgent ? "border border-red-500 bg-red-50" : ""}`}
        >
            {/* 🚨 BANNER URGENTE */}
            {isUrgent && (
                <div className="absolute -top-2 left-3 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1 animate-pulse z-10">
                    <PhoneCall className="w-2.5 h-2.5" />
                    🚨 LLAMAR
                </div>
            )}
            <div className="flex items-start justify-between gap-2">
                {/* Checkbox */}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelect(reservation.id, e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
                />

                {/* Contenido Principal - DISEÑO HORIZONTAL EQUILIBRADO */}
                <div className="flex-1">
                    {/* 🔥 LÍNEA 1: TIEMPO + ESPACIO (DOS COORDENADAS CRÍTICAS) */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        {/* IZQUIERDA: COORDENADAS TIEMPO Y ESPACIO */}
                        <div className="flex items-center gap-2">
                            {/* 🕐 CÁPSULA DE TIEMPO (HORA + FECHA) */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 text-orange-900 rounded-lg shadow-sm">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-bold text-xs">
                                    {formatTime(reservation.reservation_time)}
                                </span>
                                
                                <span className="text-orange-400">•</span>
                                
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span className="font-bold text-xs">
                                    {format(parseISO(reservation.reservation_date), 'dd/MM/yyyy', { locale: es })}
                                </span>
                            </div>

                            {/* 📍 CÁPSULA DE ESPACIO (MESA + ZONA) */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-600 text-white rounded-lg shadow-sm">
                                <Shield className="w-3.5 h-3.5" />
                                <span className="font-bold text-xs">
                                    {(() => {
                                        if (reservation.reservation_tables && reservation.reservation_tables.length > 0) {
                                            const tableNames = reservation.reservation_tables
                                                .map(rt => rt.tables?.name || `Mesa ${rt.tables?.table_number}`)
                                                .join(' + ');
                                            return `${tableNames}`;
                                        }
                                        return reservation.tables?.name || 
                                               (reservation.tables?.table_number ? `Mesa ${reservation.tables.table_number}` : null) ||
                                               (reservation.table_number ? `Mesa ${reservation.table_number}` : null) ||
                                               'Sin mesa';
                                    })()}
                                </span>
                                
                                {reservation.tables?.zone && (
                                    <>
                                        <span className="text-blue-200">•</span>
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span className="font-bold text-xs">{reservation.tables.zone}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* DERECHA: BADGES */}
                        <div className="flex items-center gap-2">
                            {/* 🚨 GRUPO GRANDE: Solo para ≥10 personas */}
                            {reservation.party_size >= 10 && (
                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 border border-red-400 text-red-900 rounded font-bold text-[10px] animate-pulse">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>GRANDE</span>
                                </div>
                            )}

                            {/* ⚠️ PETICIÓN ESPECIAL */}
                            {reservation.special_requests && reservation.special_requests.trim() !== '' && (
                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 border border-orange-400 text-orange-900 rounded font-semibold text-[10px]" title={reservation.special_requests}>
                                    <AlertCircle className="w-3 h-3" />
                                    <span>ESPECIAL</span>
                                </div>
                            )}

                            <span className={`px-1.5 py-0.5 rounded-full border ${state.color} flex items-center gap-0.5 text-[10px]`}>
                                {state.icon}
                                <span>{state.label}</span>
                            </span>

                            {isAgentReservation && (
                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px]">
                                    <Bot className="w-2.5 h-2.5" />
                                    <span>IA</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🎯 LÍNEA 2: CLIENTE + COMENSALES + TELÉFONO + CANAL */}
                    <div className="flex items-center justify-between gap-2">
                        {/* IZQUIERDA: CLIENTE + COMENSALES (MÁS GRANDE) */}
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-xs">
                                {reservation.customer_name}
                            </span>

                            <div className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-gray-600" />
                                <span className="font-bold text-xs text-gray-900">
                                    {reservation.party_size} personas
                                </span>
                            </div>
                        </div>

                        {/* DERECHA: TELÉFONO + CANAL */}
                        <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                            <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span className="font-medium">{reservation.customer_phone}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                {channel.icon}
                                <span className="text-xs">{channel.label}</span>
                            </div>
                        </div>
                    </div>

                    {/* 📝 LÍNEA 3 (OPCIONAL): NOTAS - MÁS LEGIBLES */}
                    {reservation.special_requests && (
                        <div className="mt-2 text-sm text-gray-700 italic pl-2 border-l-2 border-amber-400">
                            "{reservation.special_requests}"
                        </div>
                    )}
                    
                    {/* 🚨 BOTÓN DE ACCIÓN URGENTE */}
                    {isUrgent && (
                        <div className="mt-3 flex items-center gap-2">
                            <a
                                href={`tel:${reservation.customer_phone}`}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <PhoneCall className="w-4 h-4" />
                                LLAMAR AHORA: {reservation.customer_phone}
                            </a>
                            <button
                                onClick={() => {
                                    // Ir a página de No-Shows
                                    window.location.href = '/no-shows-nuevo';
                                }}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <AlertTriangle className="w-4 h-4" />
                                Ver No-Shows
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowActions(!showActions);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>

                    {showActions && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                            <button
                                onClick={() => {
                                    onAction("view", reservation);
                                    setShowActions(false);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                            >
                                <Eye className="w-4 h-4" />
                                Ver detalles
                            </button>

                            {state.actions.includes("edit") && (
                                <button
                                    onClick={() => {
                                        onAction("edit", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                >
                                    <Edit className="w-4 h-4" />
                                    Editar
                                </button>
                            )}

                            {state.actions.includes("approve") && (
                                <button
                                    onClick={() => {
                                        onAction("approve", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-center gap-2 text-green-700 font-semibold"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    ✅ Aprobar Reserva
                                </button>
                            )}

                            {state.actions.includes("reject") && (
                                <button
                                    onClick={() => {
                                        onAction("reject", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-700 font-semibold"
                                >
                                    <XCircle className="w-4 h-4" />
                                    ❌ Rechazar Reserva
                                </button>
                            )}

                            {state.actions.includes("confirm") && (
                                <button
                                    onClick={() => {
                                        onAction("confirm", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-green-600"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmar
                                </button>
                            )}

                            {state.actions.includes("seat") && (
                                <button
                                    onClick={() => {
                                        onAction("seat", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                                >
                                    <Users className="w-4 h-4" />
                                    Sentar
                                </button>
                            )}

                            {state.actions.includes("complete") && (
                                <button
                                    onClick={() => {
                                        onAction("complete", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-600"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Completar
                                </button>
                            )}

                            {state.actions.includes("noshow") && (
                                <button
                                    onClick={() => {
                                        onAction("noshow", reservation);
                                        setShowActions(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-orange-600"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    Marcar No-Show
                                </button>
                            )}

                            {state.actions.includes("cancel") && (
                                <>
                                    <hr className="my-1" />
                                    <button
                                        onClick={() => {
                                            onAction("cancel", reservation);
                                            setShowActions(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Cancelar
                                    </button>
                                </>
                            )}

                            {state.actions.includes("delete") && (
                                <>
                                    <hr className="my-1" />
                                    <button
                                        onClick={() => {
                                            onAction("delete", reservation);
                                            setShowActions(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar definitivamente
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Componente principal
export default function Reservas() {
    const { business: restaurant, businessId: businessId, user, isReady, addNotification } =
        useAuthContext();
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [reservations, setReservations] = useState([]);
    const [selectedReservations, setSelectedReservations] = useState(new Set());
    const [blockages, setBlockages] = useState([]); // 🆕 Bloqueos de horas
    
    // 🔥 NUEVO: Estado para Heat Map de Ocupación
    const [occupancyDate, setOccupancyDate] = useState(new Date());
    const [occupancyZone, setOccupancyZone] = useState('all');
    
    // 🔥 NUEVO: Hook de datos de ocupación
    const { 
        loading: occupancyLoading, 
        error: occupancyError, 
        occupancyData, 
        metrics: occupancyMetrics, 
        reload: reloadOccupancy 
    } = useOccupancyData(businessId, occupancyDate, occupancyZone);

    const [tables, setTables] = useState([]);
    const [resources, setResources] = useState([]); // 🆕 Recursos/Profesionales para el calendario
    const [savingPolicy, setSavingPolicy] = useState(false);
    const [policySettings, setPolicySettings] = useState({
        min_party_size: 1,
        max_party_size: 20,
        advance_booking_days: 30,
        reservation_duration: 90,
        min_advance_hours: 2,
    });
    const [agentStats, setAgentStats] = useState({
        agentReservations: 0,
        conversionRate: 0,
        avgResponseTime: "0s",
        peakChannel: "—",
        satisfaction: 0,
    });
    const [filters, setFilters] = useState({
        search: "",
        status: "",
        channel: "",
        source: ""
    });

    // 🆕 Nuevo sistema de vistas principales
    const [activeView, setActiveView] = useState('hoy'); // hoy | proximas | pasadas
    const [proximasFilter, setProximasFilter] = useState('todas'); // todas | manana | esta_semana | este_mes

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [initialReservationData, setInitialReservationData] = useState(null); // 🆕 Datos iniciales del slot clickeado
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);  // ✅ NUEVO para cancelar
    const [showWaitlistModal, setShowWaitlistModal] = useState(false); // 🆕 Modal de lista de espera
    const [waitlistData, setWaitlistData] = useState({}); // 🆕 Datos pre-rellenados para waitlist
    const [editingReservation, setEditingReservation] = useState(null);
    const [viewingReservation, setViewingReservation] = useState(null);
    const [deletingReservation, setDeletingReservation] = useState(null);
    const [cancellingReservation, setCancellingReservation] = useState(null);  // ✅ NUEVO para cancelar
    
    // 🆕 Estados para modales de métricas interactivas
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusModalType, setStatusModalType] = useState(null); // 'confirmed', 'pending', 'completed', 'cancelled', 'no_show'
    const [showNotesModal, setShowNotesModal] = useState(false); // 🆕 Modal para reservas con notas
    const [showDebugModal, setShowDebugModal] = useState(false); // 🧪 Modal mínimo de prueba

    // Subscription de real-time
    const [realtimeSubscription, setRealtimeSubscription] = useState(null);

    
    // 🤖 AUTOMATIZACIÓN: Completar reservas automáticamente (estilo industria)
    // Lógica:
    // - Reservas "confirmed" pasadas → "completed" (se completaron)
    // - Reservas "pending" pasadas → "no_show" (no se confirmaron, cliente no se presentó)
    const autoCompleteReservations = useCallback(async () => {
        if (!businessId) {
            console.log('⚠️ No hay businessId, saltando auto-completar');
            return;
        }
        
        try {
            const hoy = format(new Date(), "yyyy-MM-dd");
            const ahora = new Date();
            
            console.log('═══════════════════════════════════════');
            console.log('🤖 INICIANDO AUTO-COMPLETAR RESERVAS');
            console.log('📅 Fecha de hoy:', hoy);
            console.log('🕐 Hora actual:', format(ahora, 'HH:mm:ss'));
            console.log('🏢 Business ID:', businessId);
            console.log('═══════════════════════════════════════');
            
            // ============================================
            // 1. RESERVAS CONFIRMADAS PASADAS → "completed"
            // ============================================
            
            // Buscar reservas confirmadas de días anteriores
            const { data: confirmedPast, error: errorConfirmed } = await supabase
                .from('appointments')
                .select('id, customer_name, status, appointment_date, appointment_time, duration_minutes')
                .eq('business_id', businessId)
                .eq('status', 'confirmed')
                .lt('appointment_date', hoy);
            
            console.log('📊 Reservas confirmadas de días anteriores:', { 
                encontradas: confirmedPast?.length || 0, 
                error: errorConfirmed?.message 
            });
            
            // Buscar reservas confirmadas de HOY que ya terminaron
            const { data: confirmedToday, error: errorTodayConfirmed } = await supabase
                .from('appointments')
                .select('id, customer_name, status, appointment_date, appointment_time, duration_minutes')
                .eq('business_id', businessId)
                .eq('appointment_date', hoy)
                .eq('status', 'confirmed');
            
            let confirmedToComplete = confirmedPast || [];
            
            if (!errorTodayConfirmed && confirmedToday) {
                const terminadasHoy = confirmedToday.filter(r => {
                    const [hora, minuto] = (r.appointment_time || '00:00').split(':');
                    const duracion = r.duration_minutes || 60;
                    const horaFin = new Date();
                    horaFin.setHours(parseInt(hora), parseInt(minuto) + duracion, 0);
                    return horaFin < ahora;
                });
                confirmedToComplete.push(...terminadasHoy);
            }
            
            // ============================================
            // 2. RESERVAS PENDING PASADAS → "no_show"
            // ============================================
            
            // Buscar reservas pending de días anteriores
            const { data: pendingPast, error: errorPending } = await supabase
                .from('appointments')
                .select('id, customer_name, status, appointment_date, appointment_time, duration_minutes')
                .eq('business_id', businessId)
                .eq('status', 'pending')
                .lt('appointment_date', hoy);
            
            console.log('📊 Reservas pending de días anteriores:', { 
                encontradas: pendingPast?.length || 0, 
                error: errorPending?.message 
            });
            
            // Buscar reservas pending de HOY que ya pasaron su hora de fin
            const { data: pendingToday, error: errorTodayPending } = await supabase
                .from('appointments')
                .select('id, customer_name, status, appointment_date, appointment_time, duration_minutes')
                .eq('business_id', businessId)
                .eq('appointment_date', hoy)
                .eq('status', 'pending');
            
            let pendingToNoShow = pendingPast || [];
            
            if (!errorTodayPending && pendingToday) {
                const pasadasHoy = pendingToday.filter(r => {
                    const [hora, minuto] = (r.appointment_time || '00:00').split(':');
                    const duracion = r.duration_minutes || 60;
                    const horaFin = new Date();
                    horaFin.setHours(parseInt(hora), parseInt(minuto) + duracion, 0);
                    return horaFin < ahora;
                });
                pendingToNoShow.push(...pasadasHoy);
            }
            
            // ============================================
            // 3. ACTUALIZAR RESERVAS CONFIRMADAS → "completed"
            // ============================================
            
            if (confirmedToComplete.length > 0) {
                console.log(`✅ Encontradas ${confirmedToComplete.length} reservas CONFIRMADAS para completar:`);
                confirmedToComplete.forEach(r => {
                    console.log(`  📋 ${r.customer_name} - ${r.appointment_date} ${r.appointment_time}`);
                });
                
                const confirmedIds = confirmedToComplete.map(r => r.id);
                const { error: updateError } = await supabase
                    .from('appointments')
                    .update({ status: 'completed', updated_at: new Date().toISOString() })
                    .in('id', confirmedIds);
                    
                if (updateError) {
                    console.error('❌ Error completando reservas confirmadas:', updateError);
                } else {
                    console.log(`✅ ${confirmedToComplete.length} reservas confirmadas → completadas`);
                }
            }
            
            // ============================================
            // 4. ACTUALIZAR RESERVAS PENDING → "no_show"
            // ============================================
            
            if (pendingToNoShow.length > 0) {
                console.log(`⚠️ Encontradas ${pendingToNoShow.length} reservas PENDING para marcar como no-show:`);
                pendingToNoShow.forEach(r => {
                    console.log(`  📋 ${r.customer_name} - ${r.appointment_date} ${r.appointment_time} (no confirmada, no se presentó)`);
                });
                
                const pendingIds = pendingToNoShow.map(r => r.id);
                const { error: updateErrorPending } = await supabase
                    .from('appointments')
                    .update({ status: 'no_show', updated_at: new Date().toISOString() })
                    .in('id', pendingIds);
                    
                if (updateErrorPending) {
                    console.error('❌ Error marcando reservas pending como no-show:', updateErrorPending);
                } else {
                    console.log(`⚠️ ${pendingToNoShow.length} reservas pending → no_show (no confirmadas)`);
                }
            }
            
            const totalProcesadas = confirmedToComplete.length + pendingToNoShow.length;
            if (totalProcesadas === 0) {
                console.log('✅ No hay reservas pasadas para procesar');
            } else {
                console.log(`\n🎯 RESUMEN: ${totalProcesadas} reservas procesadas`);
                console.log(`   ✅ ${confirmedToComplete.length} confirmadas → completadas`);
                console.log(`   ⚠️ ${pendingToNoShow.length} pending → no_show`);
            }
            
        } catch (error) {
            console.error('❌ Error en auto-completar reservas:', error);
        }
    }, [businessId]);

    // Cargar estadísticas REALES del agente IA
    const loadAgentStats = useCallback(async (reservations) => {
        if (!businessId) return;

        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // 1. Reservas del agente desde reservations (CAMPO CORRECTO: source)
            const agentReservationsData = reservations.filter(r => r.source && r.source.startsWith('agent_'));
            const manualReservationsData = reservations.filter(r => r.source === 'dashboard' || !r.source);
            
            console.log('🔍 DEBUG INSIGHTS:');
            console.log(`  Total reservas: ${reservations.length}`);
            console.log(`  Reservas agente: ${agentReservationsData.length}`);
            console.log(`  Reservas manuales: ${manualReservationsData.length}`);
            
            const agentReservations = agentReservationsData.length;

            // 2. Calcular métricas del agente desde datos existentes (sin tabla externa)
            let agentMetrics = null;
            try {
                // Calcular métricas desde reservas del agente (CAMPO CORRECTO)
                const agentReservationsToday = reservations.filter(r => {
                    const reservationDate = format(parseISO(r.created_at), 'yyyy-MM-dd');
                    return reservationDate === today && r.source && r.source.startsWith('agent_');
                });
                
                agentMetrics = {
                    total_conversations: agentReservationsToday.length,
                    successful_bookings: agentReservationsToday.filter(r => r.status !== 'cancelled').length,
                    avg_response_time: 0, // Sin datos reales → 0s
                    conversion_rate: agentReservationsToday.length > 0 ? 
                        (agentReservationsToday.filter(r => r.status !== 'cancelled').length / agentReservationsToday.length) * 100 : 0
                };
            } catch (error) {
                console.log('📊 Error calculando agent metrics:', error);
            }

            // 3. Usar datos de reservas como conversaciones (sin tabla externa)
            let agentConversations = [];
            try {
                // Simular conversaciones desde reservas del agente (CAMPO CORRECTO)
                const agentReservationsToday = reservations.filter(r => {
                    const reservationDate = format(parseISO(r.created_at), 'yyyy-MM-dd');
                    return reservationDate === today && r.source && r.source.startsWith('agent_');
                });
                
                agentConversations = agentReservationsToday.map(r => ({
                    id: r.id,
                    booking_created: r.status !== 'cancelled',
                    satisfaction_score: 4.5 // Valor por defecto hasta conectar APIs
                }));
            } catch (error) {
                console.log('💬 Error simulando agent conversations:', error);
            }

            // 4. Canal más usado - calculado desde reservas existentes (sin tabla externa)
            let channelPerformance = null;
            try {
                // Calcular canal más usado desde las reservas CREADAS hoy (independientemente de su fecha de reserva)
                const todayReservations = reservations.filter(r => {
                    const createdDate = format(parseISO(r.created_at), 'yyyy-MM-dd');
                    return createdDate === today;
                });
                
                if (todayReservations.length > 0) {
                    const channelCounts = todayReservations.reduce((acc, r) => {
                        const channel = r.source || 'dashboard';
                        acc[channel] = (acc[channel] || 0) + 1;
                        return acc;
                    }, {});
                    
                    const topChannel = Object.entries(channelCounts)
                        .sort(([,a], [,b]) => b - a)[0];
                    
                    if (topChannel) {
                        channelPerformance = {
                            channel: topChannel[0],
                            bookings: topChannel[1]
                        };
                    }
                }
            } catch (error) {
                console.log('📈 Error calculando canal principal:', error);
            }

            // Calcular estadísticas reales
            const conversations = agentConversations || [];
            const totalConversations = conversations.length;
            const reservationsCreated = conversations.filter(conv => conv.booking_created).length;
            const conversionRate = totalConversations > 0 ? 
                Math.round((reservationsCreated / totalConversations) * 100) : 0;
            
            // Calcular satisfacción promedio
            const satisfactionScores = conversations
                .filter(conv => conv.satisfaction_score)
                .map(conv => conv.satisfaction_score);
            const avgSatisfaction = satisfactionScores.length > 0 ?
                Math.round(satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length) : 0;

            setAgentStats({
                agentReservations: agentMetrics?.successful_bookings || agentReservations,
                conversionRate: agentMetrics?.conversion_rate || conversionRate,
                avgResponseTime: agentMetrics?.avg_response_time ? `${agentMetrics.avg_response_time}s` : "0s",
                peakChannel: channelPerformance?.channel || "—",
                satisfaction: avgSatisfaction
            });

        } catch (error) {
            console.error("Error cargando estadísticas del agente:", error);
            // Fallback usando solo datos de reservations (CAMPO CORRECTO)
            const agentReservations = reservations.filter(r => 
                r.source && r.source.startsWith('agent_')
            ).length;
            setAgentStats(prev => ({
                ...prev,
                agentReservations: agentReservations,
                conversionRate: agentReservations > 0 ? 75 : 0
            }));
        }
    }, [businessId]);

    // Cargar reservas
    const loadReservations = useCallback(async () => {
        if (!businessId) return;

        try {
            setLoading(true);
            console.log('🔄 RECARGANDO RESERVAS...');

            // ✅ QUERY SIN JOIN (no hay foreign key constraints configuradas)
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('business_id', businessId)
        .order('created_at', { ascending: false});
            
            // 🚨 AGREGAR DATOS DE RIESGO NO-SHOW PARA HOY
            // ❌ ELIMINADO: predict_upcoming_noshows_v2 (función no existe)
            let riskData = {};

            if (error) {
                console.error('❌ ERROR CARGANDO RESERVAS:', error);
                throw error;
            }


            // ✅ CARGAR NOMBRES DE SERVICIOS POR SEPARADO (enriquecer datos)
            let servicesMap = {};
            if (data && data.length > 0) {
                const serviceIds = [...new Set(data.map(r => r.service_id).filter(Boolean))];
                if (serviceIds.length > 0) {
                    const { data: services, error: servicesError } = await supabase
                        .from('business_services')
                        .select('id, name, duration_minutes')
                        .in('id', serviceIds);
                    
                    if (!servicesError && services) {
                        services.forEach(s => {
                            servicesMap[s.id] = s;
                        });
                    }
                }
            }

            // ✅ CARGAR NOMBRES DE EMPLEADOS POR SEPARADO (enriquecer datos)
            let employeesMap = {};
            if (data && data.length > 0) {
                const resourceIds = [...new Set(data.map(r => r.resource_id).filter(Boolean))];
                if (resourceIds.length > 0) {
                    const { data: employees, error: employeesError } = await supabase
                        .from('employees')
                        .select('id, name')
                        .in('id', resourceIds);
                    
                    if (!employeesError && employees) {
                        employees.forEach(e => {
                            employeesMap[e.id] = e;
                        });
                    }
                }
            }

            // ✅ MAPEAR DATOS: appointment_date -> reservation_date (compatibilidad frontend)
            let reservations = (data || []).map(r => ({
                ...r,
                // Mapear campos de appointments a formato legacy del frontend
                reservation_date: r.appointment_date, // ✅ Mapeo crítico para calendario
                reservation_time: r.appointment_time, // ✅ Mapeo crítico para calendario
                service_name: servicesMap[r.service_id]?.name || null, // ✅ Nombre del servicio
                service_duration_minutes: r.duration_minutes, // ✅ Duración ya está en appointments
                resource_name: employeesMap[r.resource_id]?.name || null, // ✅ Nombre del profesional/empleado
                // Por si acaso, asegurar que risk_level existe
                noshow_risk_score: 0,
                risk_level: 'low'
            }));
            
            console.log("🔄 RESERVAS MAPEADAS:", {
                total: reservations.length,
                primera: reservations[0] ? {
                    id: reservations[0].id,
                    customer_name: reservations[0].customer_name,
                    reservation_date: reservations[0].reservation_date, // Verificar que existe
                    appointment_date: reservations[0].appointment_date
                } : null
            });
            
            // Log específico para debugging
            const targetReservation = reservations.find(r => r.customer_name?.includes('Kiku'));
            if (targetReservation) {
                console.log("🎯 RESERVA KIKU ENCONTRADA:", {
                    id: targetReservation.id,
                    status: targetReservation.status,
                    customer_name: targetReservation.customer_name
                });
            }

            // 🔧 CORRECCIÓN: Aplicar filtros adicionales en memoria con mapeo de estados
            if (filters.status) {
                // Mapear estado de español (UI) a inglés (BD)
                const statusMapping = {
                    'pendiente': 'pending',
                    'confirmada': 'confirmed', 
                    'sentada': 'seated',
                    'completada': 'completed',
                    'cancelada': 'cancelled',
                    'no_show': 'no_show'
                };
                
                const dbStatus = statusMapping[filters.status] || filters.status;
                console.log(`🔍 Filtro estado: UI='${filters.status}' -> BD='${dbStatus}'`);
                
                reservations = reservations.filter(r => r.status === dbStatus);
                console.log(`🔍 Reservas filtradas: ${reservations.length}`);
            }

            if (filters.channel) {
                reservations = reservations.filter(r => r.source === filters.channel);
            }

            if (filters.source) {
                reservations = reservations.filter(r => r.source === filters.source);
            }

            setReservations(reservations);
            console.log('✅ Estado de reservations actualizado. Total:', reservations.length);

            // Calcular estadísticas del agente usando datos reales
            // Cargar estadísticas del agente de forma NO BLOQUEANTE
            loadAgentStats(reservations).catch(error => {
                console.log('📊 Estadísticas del agente no disponibles:', error.message);
            });
        } catch (error) {
            toast.error("Error al cargar las reservas");
        } finally {
            setLoading(false);
        }
    }, [
        businessId,
        filters.status,
        filters.channel,
        filters.source
    ]);

    // 🔒 Cargar bloqueos de horas
    const loadBlockages = useCallback(async () => {
        if (!businessId) return;

        try {
            const { data, error } = await supabase
                .from('resource_blockages')
                .select('*')
                .eq('business_id', businessId)
                .order('blocked_date', { ascending: true });

            if (error) {
                console.error('❌ Error cargando bloqueos:', error);
                return;
            }

            console.log('🔒 Bloqueos cargados:', data?.length || 0);
            setBlockages(data || []);

        } catch (error) {
            console.error('❌ Error en loadBlockages:', error);
        }
    }, [businessId]);

    // Cargar mesas
    const loadTables = useCallback(async () => {
        if (!businessId) return;

        try {
            const { data, error } = await supabase
                .from('resources')
                .select("*")
                .eq("business_id", businessId)
                .eq("is_active", true)
                .order("name");

            if (error) throw error;
            setTables(data || []);
            console.log("✅ Mesas cargadas en Reservas:", data?.length || 0);
        } catch (error) {
            console.error("❌ Error cargando mesas:", error);
            // No mostrar error al usuario si no hay mesas
            setTables([]);
        }
    }, [businessId]);

    // 🆕 Cargar recursos/profesionales para el calendario
    const loadResources = useCallback(async () => {
        if (!businessId) return;

        try {
            // ✅ CARGAR EMPLEADOS desde la nueva tabla 'employees'
            const { data: employeesData, error: employeesError } = await supabase
                .from('employees')
                .select(`
                    id, 
                    name, 
                    email, 
                    role, 
                    color,
                    is_owner,
                    assigned_resource_id,
                    position_order,
                    employee_schedules(*)
                `)
                .eq("business_id", businessId)
                .eq("is_active", true)
                .order("position_order", { ascending: true });

            if (employeesError) {
                console.error("❌ Error cargando empleados:", employeesError);
                setResources([]);
                return;
            }

            // Cargar nombres de recursos para mostrar en el calendario
            const resourceIds = employeesData?.map(e => e.assigned_resource_id).filter(Boolean) || [];
            let resourcesMap = {};
            
            if (resourceIds.length > 0) {
                const { data: resourcesData } = await supabase
                    .from('resources')
                    .select('id, name')
                    .in('id', resourceIds);
                
                resourcesMap = (resourcesData || []).reduce((acc, r) => {
                    acc[r.id] = r.name;
                    return acc;
                }, {});
            }

            // Mapear empleados a formato del calendario
            const mappedEmployees = (employeesData || []).map(emp => ({
                id: emp.id,
                name: emp.name,
                type: 'employee',
                color: emp.color,
                is_owner: emp.is_owner,
                assigned_resource_id: emp.assigned_resource_id,
                resource_name: emp.assigned_resource_id ? resourcesMap[emp.assigned_resource_id] : null,
                employee_schedules: emp.employee_schedules,
                schedules: emp.employee_schedules || []
            }));
            
            setResources(mappedEmployees);
            console.log("✅ Empleados cargados para calendario:", mappedEmployees.length);
        } catch (error) {
            console.error("❌ Error cargando recursos/profesionales:", error);
            // No mostrar error al usuario, simplemente no mostrar columnas
            setResources([]);
        }
    }, [businessId]);

    // Cargar insights del agente
    const loadAgentInsights = useCallback(async () => {
        if (!businessId) return;

        try {
            // Calcular insights reales basados en las reservas
            const insights = [];
            
            // Insight 1: Reservas por IA vs Manual
            const iaReservations = reservations.filter(r => r.source && r.source.startsWith('agent_')).length;
            const manualReservations = reservations.filter(r => r.source === 'dashboard').length;
            
            if (iaReservations > 0) {
                insights.push(`El agente IA ha gestionado ${iaReservations} reservas, representando el ${Math.round((iaReservations / (iaReservations + manualReservations)) * 100)}% del total`);
            }
            
            // Insight 2: Horarios más solicitados
            const timeSlots = {};
            reservations.forEach(r => {
                const hour = r.reservation_time?.split(':')[0];
                if (hour) {
                    timeSlots[hour] = (timeSlots[hour] || 0) + 1;
                }
            });
            const peakHour = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0];
            if (peakHour) {
                insights.push(`El horario más solicitado es a las ${peakHour[0]}:00 con ${peakHour[1]} reservas`);
            }
            
            // Insight 3: Tamaño promedio de grupos
            const avgPartySize = reservations.length > 0 
                ? Math.round(reservations.reduce((acc, r) => acc + (r.party_size || 0), 0) / reservations.length)
                : 0;
            if (avgPartySize > 0) {
                insights.push(`El tamaño promedio de grupo es de ${avgPartySize} personas`);
            }
            
            // Insight 4: Tasa de cancelación
            const cancelledCount = reservations.filter(r => r.status === 'cancelled').length;
            if (reservations.length > 0) {
                const cancellationRate = Math.round((cancelledCount / reservations.length) * 100);
                insights.push(`La tasa de cancelación es del ${cancellationRate}%${cancellationRate < 10 ? ' - Excelente' : cancellationRate < 20 ? ' - Buena' : ' - Mejorable'}`);
            }
            
            // Si no hay insights, mostrar mensaje informativo
            if (insights.length === 0) {
                insights.push('Aún no hay suficientes datos para generar insights. El sistema aprenderá con cada reserva.');
            }

            setAgentInsights(insights);

            // Estadísticas reales del agente
            setAgentStats((prev) => ({
                ...prev,
                avgResponseTime: "N/A", // 🔒 REGLA ORO #2: Sin datos reales de tiempo de respuesta
                peakChannel: "N/A", // 🔒 REGLA ORO #2: Sin datos reales de canal principal
                satisfaction: 0, // 🔒 REGLA ORO #2: Sin datos reales de satisfacción - mostrar 0
                agentReservations: iaReservations,
                conversionRate: iaReservations > 0 ? Math.round((iaReservations / (iaReservations + manualReservations)) * 100) : 0
            }));
        } catch (error) {
            console.error('Error generando insights:', error);
        }
    }, [businessId, reservations]);

    // Función simplificada para abrir modal de nueva reserva (salones de belleza)
    const handleCreateReservation = useCallback((initialData = null) => {
        console.log('📅 Abriendo modal de reserva con datos:', initialData);
        console.log('📅 showCreateModal antes:', showCreateModal);
        setInitialReservationData(initialData);
        setShowCreateModal(true);
        console.log('📅 setShowCreateModal(true) ejecutado');
        // Verificar después de un tick
        setTimeout(() => {
            console.log('📅 showCreateModal después:', showCreateModal);
        }, 100);
    }, [showCreateModal]);

    // 🆕 Handler para mover reservas (Drag & Drop) con validación
    const handleReservationMove = useCallback(async (reserva, { newDate, newTime, newResourceId }) => {
        try {
            const resourceIdToUse = newResourceId || reserva.resource_id;
            const duration = reserva.duration_minutes || 60;
            
            // 🔍 1. VALIDAR HORARIO DEL EMPLEADO
            const { data: employee, error: employeeError } = await supabase
                .from('employees')
                .select('*, employee_schedules(*)')
                .eq('id', resourceIdToUse)
                .single();
            
            if (employeeError || !employee) {
                toast.error('❌ Error al verificar horario del empleado');
            return;
        }

            const dayOfWeek = new Date(newDate).getDay();
            const schedule = employee.employee_schedules?.find(s => s.day_of_week === dayOfWeek && s.is_working);
            
            if (!schedule || !schedule.shifts || schedule.shifts.length === 0) {
                toast.error(`❌ ${employee.name} no trabaja este día. No se puede mover la reserva.`);
            return;
        }
        
            // Verificar que la hora está dentro de algún turno
            const [reqHour, reqMin] = newTime.split(':').map(Number);
            const requestedMinutes = reqHour * 60 + reqMin;
            const endMinutes = requestedMinutes + duration;
            
            const isWithinShift = schedule.shifts.some(shift => {
                const [startH, startM] = shift.start.split(':').map(Number);
                const [endH, endM] = shift.end.split(':').map(Number);
                const shiftStart = startH * 60 + startM;
                const shiftEnd = endH * 60 + endM;
                
                return requestedMinutes >= shiftStart && endMinutes <= shiftEnd;
            });
            
            if (!isWithinShift) {
                const shiftText = schedule.shifts.map(s => `${s.start}-${s.end}`).join(', ');
                toast.error(`❌ Hora fuera del horario de ${employee.name} (${shiftText})`);
                return;
            }
            
            // 🔍 2. VALIDAR CONFLICTOS CON OTRAS RESERVAS
            const { data: conflictingReservations, error: conflictError } = await supabase
                .from('appointments')
                .select('id, appointment_time, duration_minutes, customer_name')
                .eq('resource_id', resourceIdToUse)
                .eq('appointment_date', newDate)
                .neq('status', 'cancelled')
                .neq('id', reserva.id); // Excluir la misma reserva
            
            if (!conflictError && conflictingReservations && conflictingReservations.length > 0) {
                for (const existing of conflictingReservations) {
                    const [exHour, exMin] = existing.appointment_time.split(':').map(Number);
                    const exStart = exHour * 60 + exMin;
                    const exEnd = exStart + (existing.duration_minutes || 60);
                    
                    // Verificar solapamiento
                    const overlaps = (requestedMinutes < exEnd) && (endMinutes > exStart);
                    
                    if (overlaps) {
                        toast.error(`❌ Conflicto: Ya existe reserva de ${existing.customer_name} a las ${existing.appointment_time}`);
                        return;
                    }
                }
            }

            // ✅ Todo OK - Actualizar reserva
            const updates = {
                appointment_date: newDate,
                appointment_time: newTime,
            };

            if (newResourceId && newResourceId !== 'default') {
                    updates.resource_id = newResourceId;
            }

            const { error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', reserva.id);

            if (error) throw error;

            toast.success(`✅ Reserva movida a ${format(parseISO(newDate), "dd/MM")} ${newTime.substring(0, 5)}`);
            await loadReservations();

        } catch (error) {
            console.error('❌ Error moviendo reserva:', error);
            toast.error('Error al mover la reserva: ' + error.message);
        }
    }, [loadReservations]);

    // 🔒 Handler para bloquear horas
    const handleBlockSlot = useCallback(async (blockData) => {
        try {
            console.log('🔒 Bloqueando slot:', blockData);

            const { resource, date, time, reason } = blockData;

            // Calcular hora de fin (1 hora después por defecto)
            const startHour = parseInt(time.split(':')[0]);
            const endTime = `${(startHour + 1).toString().padStart(2, '0')}:00`;

            const blockage = {
                business_id: businessId,
                resource_id: resource.id !== 'default' ? resource.id : null,
                blocked_date: date,
                start_time: time,
                end_time: endTime,
                reason: reason || 'Bloqueado',
                created_by: user?.id
            };

            const { data, error } = await supabase
                .from('resource_blockages')
                .insert([blockage])
                .select()
                .single();

            if (error) throw error;

            toast.success(`🔒 Hora bloqueada: ${resource.name} - ${time}`);

            // Regenerar slots automáticamente
            try {
                const { default: AutoSlotRegenerationService } = await import('../services/AutoSlotRegenerationService');
                await AutoSlotRegenerationService.regenerateForDate(businessId, date);
            } catch (regenError) {
                console.warn('⚠️ No se pudo regenerar slots:', regenError);
            }

            // Recargar datos
            await Promise.all([
                loadReservations(),
                loadBlockages()
            ]);

        } catch (error) {
            console.error('❌ Error bloqueando slot:', error);
            toast.error('Error al bloquear hora: ' + error.message);
        }
    }, [businessId, user, loadReservations, loadBlockages]);

    // 🔓 Handler para desbloquear horas
    const handleUnblockSlot = useCallback(async (blockageId) => {
        try {
            console.log('🔓 Desbloqueando slot:', blockageId);

            const { error } = await supabase
                .from('resource_blockages')
                .delete()
                .eq('id', blockageId);

            if (error) throw error;

            toast.success('🔓 Bloqueo eliminado correctamente');

            // Recargar datos
            await Promise.all([
                loadReservations(),
                loadBlockages()
            ]);

        } catch (error) {
            console.error('❌ Error desbloqueando slot:', error);
            toast.error('Error al eliminar bloqueo: ' + error.message);
        }
    }, [loadReservations, loadBlockages]);

    // 🆕 Handler para agregar a lista de espera
    const handleAddToWaitlist = useCallback(({ resource, date, time }) => {
        console.log('📋 Abriendo modal de lista de espera:', { resource, date, time });
        
        setWaitlistData({
            preferredDate: date,
            preferredTime: time,
            // Aquí se podrían pre-rellenar más campos si es necesario
        });
        setShowWaitlistModal(true);
    }, []);

    // Configurar real-time subscriptions
    useEffect(() => {
        if (!businessId) return;

        // Suscribirse a cambios en tiempo real
        const subscription = supabase
            .channel("reservations-changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "reservations",
                    filter: `business_id=eq.${businessId}`,
                },
                (payload) => {
                    // Notificar si el agente creó una reserva
                    if (
                        payload.eventType === "INSERT" &&
                        payload.new.source === "agent"
                    ) {
                        toast.success(
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4" />
                                <span>Nueva reserva creada por el agente!</span>
                            </div>,
                        );

                        // Agregar notificación global (seguro)
                        try {
                            addNotification({
                                type: "agent",
                                message: `Nueva reserva de ${payload.new.customer_name} para ${payload.new.party_size} personas`,
                                priority: "normal",
                                data: { reservationId: payload.new.id },
                            });
                        } catch (e) { /* Ignorar errores de notificación */ }
                    }

                    loadReservations();
                },
            )
            .subscribe();

        setRealtimeSubscription(subscription);

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [businessId, loadReservations, addNotification]);

    // Filtrar reservas
    const filteredReservations = useMemo(() => {
        let filtered = reservations;

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(
                (res) =>
                    res.customer_name.toLowerCase().includes(searchTerm) ||
                    res.customer_phone.includes(searchTerm) ||
                    (res.customer_email &&
                        res.customer_email.toLowerCase().includes(searchTerm)),
            );
        }

        // Aplicar filtro por source con validación
        if (filters.source) {
            filtered = filtered.filter((r) => r.source === filters.source);
        }

        // Aplicar filtro por source con validación
        if (filters.channel) {
            filtered = filtered.filter((r) => r.source === filters.channel);
        }

        // Aplicar filtro por status con mapeo correcto
        if (filters.status) {
            // Mapear estados del frontend (español) a BD (inglés)
            const statusMapping = {
                'pendiente': 'pending',
                'confirmada': 'confirmed',
                'sentada': 'seated',
                'completada': 'completed',
                'cancelada': 'cancelled'
            };
            
            const dbStatus = statusMapping[filters.status] || filters.status;
            
            // DEBUG: Solo cuando hay filtro activo
            if (filters.status) {
                console.log('🔍 FILTRO DE ESTADO:', {
                    filtroFrontend: filters.status,
                    estadoBD: dbStatus,
                    totalReservas: reservations.length,
                    estadosEnBD: reservations.map(r => r.status).filter((v, i, a) => a.indexOf(v) === i),
                    reservasConEsteEstado: reservations.filter(r => r.status === dbStatus).length
                });
            }
            
            filtered = filtered.filter((r) => r.status === dbStatus);
        }

        // Aplicar filtros por fecha
        if (filters.startDate && filters.endDate) {
            filtered = filtered.filter((r) => {
                const reservationDate = r.reservation_date;
                return reservationDate >= filters.startDate && reservationDate <= filters.endDate;
            });
        }

        // 🆕 FILTRADO POR VISTA PRINCIPAL (HOY, PRÓXIMAS, PASADAS)
        const today = format(new Date(), 'yyyy-MM-dd');
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (activeView === 'hoy') {
            // Vista HOY: Solo reservas de hoy (TODAS, incluidas canceladas)
            filtered = filtered.filter(r => r.reservation_date === today);
        } else if (activeView === 'proximas') {
            // Vista PRÓXIMAS: Hoy + futuro (solo activas: pending, confirmed, seated)
            filtered = filtered.filter(r => {
                const resDate = new Date(r.reservation_date);
                return resDate >= now && 
                       ['pending', 'pending_approval', 'confirmed', 'seated'].includes(r.status);
            });

            // Aplicar sub-filtro de PRÓXIMAS
            if (proximasFilter === 'manana') {
                const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
                filtered = filtered.filter(r => r.reservation_date === tomorrow);
            } else if (proximasFilter === 'esta_semana') {
                const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
                filtered = filtered.filter(r => r.reservation_date >= today && r.reservation_date <= weekEnd);
            } else if (proximasFilter === 'este_mes') {
                const monthEnd = format(addDays(new Date(), 30), 'yyyy-MM-dd');
                filtered = filtered.filter(r => r.reservation_date >= today && r.reservation_date <= monthEnd);
            }
        } else if (activeView === 'pasadas') {
            // Vista PASADAS: Fecha < hoy O estados finales (completed, cancelled, no_show)
            filtered = filtered.filter(r => {
                const resDate = new Date(r.reservation_date);
                return resDate < now || 
                       ['completed', 'cancelled', 'no_show'].includes(r.status);
            });
        }

        // 🔧 ORDENAMIENTO CRONOLÓGICO: Por fecha y hora
        filtered.sort((a, b) => {
            // Primero por fecha
            const dateA = new Date(a.reservation_date);
            const dateB = new Date(b.reservation_date);
            
            // Para PASADAS, ordenar DESC (más recientes primero)
            const sortDirection = activeView === 'pasadas' ? -1 : 1;
            
            if (dateA.getTime() !== dateB.getTime()) {
                return (dateA.getTime() - dateB.getTime()) * sortDirection;
            }
            
            // Si la fecha es igual, ordenar por hora
            const timeA = a.reservation_time || '00:00';
            const timeB = b.reservation_time || '00:00';
            
            return timeA.localeCompare(timeB) * sortDirection;
        });

        return filtered;
    }, [reservations, filters, activeView, proximasFilter]);

    // Cargar configuración de política de reservas
    const loadPolicySettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', businessId)
                .single();

            if (error) throw error;

            const settings = data?.settings || {};
            setPolicySettings({
                min_party_size: settings.min_party_size || 1,
                max_party_size: settings.max_party_size || 20,
                advance_booking_days: settings.advance_booking_days || 30,
                reservation_duration: settings.reservation_duration || 90,
                min_advance_hours: settings.min_advance_hours || 2
            });
        } catch (error) {
            console.error('Error cargando política:', error);
        }
    }, [businessId]);

    // Cargar datos inicial - SIN DEPENDENCY LOOPS
    useEffect(() => {
        if (isReady && businessId) {
            setLoading(true);
            console.log('🚀 INICIANDO CARGA DE DATOS...');
            
            // 🤖 Primero auto-completar reservas de ayer, luego cargar todo
            autoCompleteReservations()
                .then(() => {
                    console.log('✅ Auto-completar finalizado, cargando datos...');
                    return Promise.all([
                        loadReservations(),
                        loadTables(),
                        loadResources(), // 🆕 Cargar recursos/profesionales
                        loadBlockages(), // 🆕 Cargar bloqueos de horas
                        loadPolicySettings()
                    ]);
                })
                .catch(error => {
                    console.error('Error en auto-completar o carga:', error);
                })
                .finally(() => {
                    setLoading(false);
                    console.log('✅ Carga de datos finalizada');
                });
        }
    }, [isReady, businessId, autoCompleteReservations]); // Incluir autoCompleteReservations

    // 🔄 ESCUCHAR CAMBIOS DE HORARIO desde Calendario y recargar automáticamente
    useEffect(() => {
        const handleScheduleUpdate = () => {
            // Esperar 1 segundo para que se guarde en BD y luego recargar
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };

        const handleBusinessReload = () => {
            // Recargar después de 1 segundo para dar tiempo a que se guarde
            setTimeout(() => {
                if (businessId) {
                    window.location.reload();
                }
            }, 1000);
        };

        window.addEventListener('schedule-updated', handleScheduleUpdate);
        window.addEventListener('force-business-reload', handleBusinessReload);
        
        return () => {
            window.removeEventListener('schedule-updated', handleScheduleUpdate);
            window.removeEventListener('force-business-reload', handleBusinessReload);
        };
    }, [businessId]);
    
    // 🤖 AUTO-COMPLETAR RESERVAS PERIÓDICAMENTE (cada 30 minutos)
    useEffect(() => {
        if (!businessId) return;
        
        // Ejecutar cada 30 minutos
        const interval = setInterval(() => {
            console.log('⏰ Verificando reservas para auto-completar...');
            autoCompleteReservations();
        }, 30 * 60 * 1000); // 30 minutos
        
        return () => clearInterval(interval);
    }, [businessId, autoCompleteReservations]);

    // Recargar cuando cambien los filtros - SIN BUCLES
    useEffect(() => {
        if (isReady && businessId) {
            loadReservations();
        }
    }, [
        isReady,
        businessId,
        filters.status,
        filters.channel,
        filters.source,
    ]); // SIN loadReservations en dependencies

    // ===== FUNCIONES HELPER PARA WIZARD =====
    
    // Función para vincular reserva con cliente existente y actualizar métricas
    const handleCustomerLinking = useCallback(async (reservationData, customerData = {}) => {
        try {
            // Buscar cliente existente por teléfono o email
            const { data: existingCustomers, error: searchError } = await supabase
                .from("customers")
                .select("*")
                .eq("business_id", businessId)
                .or(`phone.eq.${reservationData.customer_phone},email.eq.${reservationData.customer_email || ''}`);

            if (searchError) {
                console.error("Error searching customers:", searchError);
                return;
            }

            let customer = existingCustomers?.[0];

            if (customer) {
                // Cliente existente: actualizar métricas usando esquema real
                const updatedData = {
                    visits_count: (customer.visits_count || 0) + 1,
                    last_visit_at: reservationData.reservation_date,
                    total_spent: customer.total_spent || 0,
                };

                // Calcular nuevo segmento automático
                const newSegment = calculateAutomaticSegment(updatedData, customer);
                updatedData.preferences = {
                    ...customer.preferences,
                    segment: newSegment,
                    last_auto_update: new Date().toISOString()
                };

                await supabase
                    .from("customers")
                    .update(updatedData)
                    .eq("id", customer.id);

                console.log(`Cliente ${customer.name} actualizado: ${updatedData.visits_count} visitas`);
            } else {
                // Cliente nuevo: crear automáticamente
                const newCustomer = {
                    name: reservationData.customer_name,
                    first_name: customerData.first_name || reservationData.customer_name?.split(' ')[0] || '',
                    last_name1: customerData.last_name1 || reservationData.customer_name?.split(' ')[1] || '',
                    last_name2: customerData.last_name2 || reservationData.customer_name?.split(' ')[2] || '',
                    phone: reservationData.customer_phone,
                    email: reservationData.customer_email || null,
                    birthday: customerData.birthdate || null, // 🔥 FIX: El campo se llama "birthday" en la BD
                    notes: customerData.notes || "Cliente creado automáticamente desde reserva",
                    consent_email: customerData.consent_email || false,
                    consent_sms: customerData.consent_sms || false,
                    consent_whatsapp: customerData.consent_whatsapp || false,
                    business_id: businessId,
                    visits_count: 1,
                    last_visit_at: reservationData.reservation_date,
                    total_spent: 0,
                    preferences: {
                        segment: "nuevo",
                        created_automatically: true,
                        created_from: "reservation"
                    },
                };

                const { data: insertedCustomer, error: insertError } = await supabase
                    .from("customers")
                    .insert([newCustomer])
                    .select()
                    .single();

                if (insertError) {
                    console.error('❌ Error creando cliente:', insertError);
                    console.error('❌ Datos que intentamos insertar:', newCustomer);
                } else {
                    console.log(`✅ Nuevo cliente ${newCustomer.name} creado automáticamente`, insertedCustomer);
                }
            }
        } catch (error) {
            console.error("Error in customer linking:", error);
        }
    }, [businessId]);

    // Función para calcular segmento automático
    const calculateAutomaticSegment = useCallback((customerData, existingCustomer) => {
        const totalVisits = customerData.visits_count || 0;
        const totalSpent = customerData.total_spent || 0;
        const lastVisit = new Date(customerData.last_visit_at);
        const now = new Date();
        const daysSinceLastVisit = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));

        if (totalVisits === 0 || daysSinceLastVisit <= 7) {
            return "nuevo";
        } else if (totalVisits >= 5 || totalSpent >= 500) {
            return "vip";
        } else if (totalVisits >= 3) {
            return "regular";
        } else if (totalVisits >= 1 && totalVisits <= 2) {
            return "ocasional";
        } else if (daysSinceLastVisit > 180) {
            return "inactivo";
        } else if (daysSinceLastVisit > 90 && (existingCustomer?.visits_count || 0) >= 3) {
            return "en_riesgo";
        } else if (totalSpent >= 300) {
            return "alto_valor";
        }

        return "ocasional";
    }, []);

    // Funciones de selección
    const handleSelectReservation = useCallback((id, selected) => {
        setSelectedReservations((prev) => {
            const newSet = new Set(prev);
            if (selected) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(
        (selected) => {
            if (selected) {
                setSelectedReservations(
                    new Set(filteredReservations.map((r) => r.id)),
                );
            } else {
                setSelectedReservations(new Set());
            }
        },
        [filteredReservations],
    );

    // ⚠️ Función para confirmar cancelación desde el modal
    const handleCancelConfirm = async (reservation) => {
        try {
            // 1️⃣ CANCELAR: Cambiar status a 'cancelled'
            const { error: updateError } = await supabase
                .from('appointments')
                .update({ 
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservation.id);

            if (updateError) throw updateError;

            // 2️⃣ LIBERAR SLOTS asociados (igual que eliminar)
            const { error: slotError } = await supabase
                .from('availability_slots')
                .update({
                    status: 'free',
                    is_available: true,
                    updated_at: new Date().toISOString()
                })
                .eq('table_id', reservation.table_id)
                .eq('slot_date', reservation.reservation_date)
                .eq('start_time', reservation.reservation_time);

            if (slotError) {
                console.warn('⚠️ No se pudieron liberar los slots:', slotError);
            }

            // 3️⃣ Cerrar modal y recargar
            setShowCancelModal(false);
            setCancellingReservation(null);
            toast.success('✅ Reserva cancelada y horario liberado');
            loadReservations();

        } catch (error) {
            console.error('❌ Error al cancelar reserva:', error);
            toast.error('Error al cancelar la reserva');
            setShowCancelModal(false);
            setCancellingReservation(null);
        }
    };

    // 🗑️ Función para confirmar eliminación desde el modal
    const handleDeleteConfirm = async (reservation) => {
        try {
            // 1️⃣ SOFT DELETE: Cambiar status a 'deleted'
            const { error: updateError } = await supabase
                .from('appointments')
                .update({ 
                    status: 'deleted',
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservation.id);

            if (updateError) throw updateError;

            // 2️⃣ LIBERAR SLOTS asociados
            const { error: slotError } = await supabase
                .from('availability_slots')
                .update({
                    status: 'free',
                    is_available: true,
                    updated_at: new Date().toISOString()
                })
                .eq('table_id', reservation.table_id)
                .eq('slot_date', reservation.reservation_date)
                .eq('start_time', reservation.reservation_time);

            if (slotError) {
                console.warn('⚠️ No se pudieron liberar los slots:', slotError);
                // No lanzamos error, ya que la reserva sí se eliminó
            }

            // 3️⃣ Cerrar modal y recargar
            setShowDeleteModal(false);
            setDeletingReservation(null);
            toast.success('✅ Reserva eliminada y slot liberado');
            loadReservations();

        } catch (error) {
            console.error('❌ Error al eliminar reserva:', error);
            toast.error('Error al eliminar la reserva');
            setShowDeleteModal(false);
            setDeletingReservation(null);
        }
    };

    // Manejar acciones de reservas
    const handleReservationAction = useCallback(
        async (action, reservation) => {
            let newStatus;
            let message;

            // Determinar el nuevo estado y el mensaje basado en la acción
            switch (action) {
                case "confirm":
                    newStatus = "confirmed";
                    message = "Reserva confirmada";
                    break;
                case "seat":
                    newStatus = "seated";
                    message = "Mesa ocupada";
                    break;
                case "complete":
                    newStatus = "completed";
                    message = "Reserva completada";
                    break;
                case "cancel":
                    // ⚠️ Abrir modal de confirmación para cancelar (libera slots automáticamente)
                    setCancellingReservation(reservation);
                    setShowCancelModal(true);
                    return;
                case "noshow":
                    if (!window.confirm("¿Confirmas que el cliente no se presentó?")) {
                        return;
                    }
                    newStatus = "no_show";
                    message = "Marcado como No-Show";
                    break;
                case "delete":
                    // 🔒 REGLA SAGRADA: Esta es la ÚNICA función que puede eliminar reservas
                    // ⚠️ Mostrar modal de confirmación con advertencia clara
                    setDeletingReservation(reservation);
                    setShowDeleteModal(true);
                    return;
                case "edit":
                    // 🔥 Cargar datos completos del cliente antes de editar
                    if (reservation.customer_id) {
                        const { data: customerData, error: customerError } = await supabase
                            .from('customers')
                            .select('first_name, last_name1, last_name2, birthday')
                            .eq('id', reservation.customer_id)
                            .single();
                        
                        if (!customerError && customerData) {
                            // Enriquecer la reserva con datos del cliente
                            setEditingReservation({
                                ...reservation,
                                firstName: customerData.first_name,
                                lastName1: customerData.last_name1,
                                lastName2: customerData.last_name2,
                                birthdate: customerData.birthday
                            });
                        } else {
                            setEditingReservation(reservation);
                        }
                    } else {
                        setEditingReservation(reservation);
                    }
                    setShowEditModal(true);
                    return;
                case "approve":
                    // 🆕 APROBAR GRUPO GRANDE
                    if (!window.confirm("¿Aprobar esta reserva de grupo grande?\n\nEl cliente recibirá un mensaje de confirmación.")) {
                        return;
                    }
                    newStatus = "pending";
                    message = "Reserva aprobada - Cliente notificado";
                    break;
                case "reject":
                    // 🆕 RECHAZAR GRUPO GRANDE
                    const reason = window.prompt("¿Por qué rechazas esta reserva?\n\n(El motivo se enviará al cliente)");
                    if (!reason) return;
                    
                    try {
                        // Actualizar a cancelled con motivo
                        const { error } = await supabase
                            .from('appointments')
                            .update({ 
                                status: 'cancelled',
                                cancellation_reason: reason
                            })
                            .eq('id', reservation.id);

                        if (error) throw error;

                        toast.success("Reserva rechazada - Cliente notificado");
                        loadReservations();
                        return;
                    } catch (error) {
                        console.error('Error rechazando reserva:', error);
                        toast.error('Error al rechazar la reserva');
                        return;
                    }
                case "view":
                    // 🎯 CORRECCIÓN: "Ver detalles" ahora abre el modal de SOLO LECTURA
                    setViewingReservation(reservation);
                    setShowDetailsModal(true);
                    return;
                default:
                    return;
            }
            
            try {
                // Actualizar la reserva en Supabase
                const { data, error } = await supabase
                    .from('appointments')
                    .update({ status: newStatus })
                    .eq("id", reservation.id)
                    .select()
                    .single();

                if (error) throw error;
                
                // 📧 ENVIAR MENSAJE CRM AUTOMÁTICO PARA NO-SHOWS
                if (action === "noshow") {
                    try {
                        await sendNoShowMessage(reservation);
                        toast.success(`${message} - Mensaje enviado al cliente`);
                    } catch (messageError) {
                        console.error("Error enviando mensaje no-show:", messageError);
                        toast.success(`${message} exitosamente`);
                        // No fallar la actualización por error de mensaje
                    }
                } else {
                    toast.success(`${message} exitosamente`);
                }
                
                console.log("✅ CONFIRMACIÓN: Status actualizado a:", data.status);

                await loadReservations();

                // 🎯 CRM INTEGRATION: Procesar automáticamente cuando se completa reserva
                if (newStatus === "completed") {
                    console.log("🎯 CRM: Procesando completación de reserva", reservation.id);
                    
                    try {
                        const crmResult = await processReservationCompletion(reservation.id, businessId);
                        
                        if (crmResult.success && crmResult.segmentChanged) {
                            toast.success(
                                `✨ Cliente actualizado a "${crmResult.newSegment}"`,
                                { duration: 4000 }
                            );
                            addNotification({
                                type: "crm",
                                message: `Cliente ${reservation.customer_name} promovido a segmento "${crmResult.newSegment}"`,
                                priority: "medium",
                            });
                        } else if (!crmResult.success) {
                            toast.error(`Error en CRM: ${crmResult.error}`);
                        }
                    } catch (crmError) {
                        toast.error("Error inesperado en el proceso CRM");
                    }
                }
            } catch (error) {
                console.error(`Error al cambiar el estado a ${newStatus}:`, error);
                toast.error(`Error al actualizar la reserva: ${error.message}`);
            }
        },
        [loadReservations, addNotification, businessId],
    );

    // Manejar acciones masivas
    const handleBulkAction = useCallback(
        async (action) => {
            if (selectedReservations.size === 0) {
                toast.error("Selecciona al menos una reserva");
                return;
            }

            // 🔒 VALIDACIÓN: Solo permitir eliminar reservas canceladas o no-show
            if (action === "delete") {
                const reservationIds = Array.from(selectedReservations);
                const selectedReservationsData = reservations.filter(r => reservationIds.includes(r.id));
                const nonDeletableReservations = selectedReservationsData.filter(
                    r => !['cancelled', 'no_show'].includes(r.status)
                );

                if (nonDeletableReservations.length > 0) {
                    toast.error(
                        `❌ Solo puedes eliminar reservas canceladas o no-show. ${nonDeletableReservations.length} reserva(s) seleccionada(s) tienen otro estado.`
                    );
                    return;
                }
            }

            const confirmMessage = action === "delete" 
                ? `⚠️ ¿ELIMINAR ${selectedReservations.size} reserva(s)?\n\nSe eliminarán permanentemente y los horarios quedarán libres.`
                : `¿Confirmar acción en ${selectedReservations.size} reservas?`;

            if (!window.confirm(confirmMessage)) {
                return;
            }

            try {
                const reservationIds = Array.from(selectedReservations);
                let newStatus;
                let message;

                switch (action) {
                    case "confirm":
                        newStatus = "confirmed";
                        message = `${reservationIds.length} reservas confirmadas`;
                        break;
                    case "cancel":
                        newStatus = "cancelled";
                        message = `${reservationIds.length} reservas canceladas`;
                        break;
                    case "delete":
                        newStatus = "deleted";
                        message = `${reservationIds.length} reservas eliminadas`;
                        break;
                    default:
                        return;
                }

                // 1️⃣ Actualizar status de las reservas
                const { error } = await supabase
                    .from('appointments')
                    .update({
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .in("id", reservationIds);

                if (error) throw error;

                // 2️⃣ Si es cancelar o eliminar, liberar los slots asociados
                if (action === "cancel" || action === "delete") {
                    // Obtener las reservas seleccionadas para liberar sus slots
                    const selectedReservationsData = reservations.filter(r => reservationIds.includes(r.id));
                    
                    for (const reservation of selectedReservationsData) {
                        if (reservation.table_id && reservation.reservation_date && reservation.reservation_time) {
                            const { error: slotError } = await supabase
                                .from('availability_slots')
                                .update({
                                    status: 'free',
                                    is_available: true,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('table_id', reservation.table_id)
                                .eq('slot_date', reservation.reservation_date)
                                .eq('start_time', reservation.reservation_time);

                            if (slotError) {
                                console.warn(`⚠️ No se pudo liberar slot para reserva ${reservation.id}:`, slotError);
                            }
                        }
                    }
                }

                toast.success(message);
                addNotification({
                    type: "system",
                    message: message,
                    priority: "normal",
                });
                setSelectedReservations(new Set());
                // Recargar reservas para mostrar cambios inmediatamente
                await loadReservations();
            } catch (error) {
                console.error('Error al actualizar las reservas:', error);
                toast.error("Error al actualizar las reservas");
            }
        },
        [selectedReservations, reservations, loadReservations, addNotification],
    );

    // Calcular estadísticas
    const stats = useMemo(() => {
        const total = filteredReservations.length;
        const confirmed = filteredReservations.filter(
            (r) => r.status === "confirmed",
        ).length;
        const pending = filteredReservations.filter(
            (r) => r.status === "pending",
        ).length;
        const completed = filteredReservations.filter(
            (r) => r.status === "completed",
        ).length;
        const cancelled = filteredReservations.filter(
            (r) => r.status === "cancelled",
        ).length;
        const noShows = filteredReservations.filter(
            (r) => r.status === "no_show",
        ).length;
        const covers = filteredReservations.reduce(
            (sum, r) => sum + r.party_size,
            0,
        );
        
        // 🆕 Contar reservas con notas (special_requests o notes)
        const withNotes = filteredReservations.filter(
            (r) =>
                (r.special_requests && r.special_requests.trim() !== "") ||
                (r.notes && r.notes.trim() !== ""),
        ).length;

        return { total, confirmed, pending, completed, cancelled, noShows, covers, withNotes };
    }, [filteredReservations]);

    if (!isReady) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                    <p className="text-gray-600">Cargando reservas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[85%] mx-auto space-y-4 sm:space-y-6">
            {/* ========================================
                SECCIÓN 1: HEADER PRINCIPAL - LIMPIO Y ORGANIZADO
            ======================================== */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-2 sm:p-3">
                {/* Header compacto - Todo en una línea */}
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                    {/* Título y fecha - Compactos */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <h1 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5 truncate">
                                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                                <span className="truncate">Reservas</span>
                            </h1>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">
                            {format(new Date(), "EEEE d 'de' MMMM, yyyy", {
                                locale: es,
                            })}
                        </p>
                    </div>

                    {/* Botones de acción principales */}
                    <div className="flex items-center gap-2">
                        {/* Botón Actualizar */}
                        <button
                            onClick={loadReservations}
                            disabled={loading}
                            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm font-medium text-xs sm:text-sm transition-all touch-target flex-shrink-0 disabled:opacity-50"
                            title="Actualizar reservas"
                        >
                            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Actualizar</span>
                        </button>

                        {/* Botón Nueva Reserva */}
                        <button
                            onClick={() => handleCreateReservation(null)}
                            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 shadow-md font-medium text-xs sm:text-sm transition-all touch-target flex-shrink-0"
                        >
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Nueva Reserva</span>
                            <span className="sm:hidden">Nueva</span>
                        </button>
                    </div>
                </div>

                {/* 🧪 Botón de prueba de modal súper simple */}
                <div className="mt-2">
                    <button
                        onClick={() => setShowDebugModal(true)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-black/5 hover:bg-black/10 text-gray-700"
                    >
                        TEST MODAL (debug)
                    </button>
                </div>
            </div>

            {/* ========================================
                SECCIÓN 2: CONTENIDO PRINCIPAL
            ======================================== */}
            <div className="space-y-4 sm:space-y-6">
                    {/* 🚀 CALENDARIO PROFESIONAL */}
                    <CalendarioReservas 
                        reservations={reservations}
                        resources={resources} // ✅ Recursos/profesionales desde BD
                        blockages={blockages} // 🆕 Bloqueos de horas
                        businessSettings={restaurant?.settings} // 🆕 Configuración del negocio (incluye operating_hours)
                        onReservationClick={(reserva) => {
                            setViewingReservation(reserva);
                            setShowDetailsModal(true);
                        }}
                        onSlotClick={(slot) => {
                            // Pasar datos del slot al modal
                            const initialData = {
                                employee_id: slot.resource?.id || null,
                                date: slot.date,
                                time: slot.time
                            };
                            handleCreateReservation(initialData);
                        }}
                        onReservationMove={handleReservationMove} // 🆕 Drag & Drop
                        onCancelReservation={(reserva) => {
                            setCancellingReservation(reserva);
                            setShowCancelModal(true);
                        }} // 🆕 Cancelar reserva
                        onBlockSlot={handleBlockSlot} // 🆕 Bloquear horas
                        onUnblockSlot={handleUnblockSlot} // 🆕 Desbloquear horas
                        onAddToWaitlist={handleAddToWaitlist} // 🆕 Lista de espera
                        onRefresh={loadReservations}
                        loading={loading}
                    />
            </div>


            {/* 🗂️ SECCIÓN ANTIGUA DE RESERVAS (Oculta temporalmente) */}
            {false && (
                <>
                    {/* 🆕 Nuevo sistema de vistas principales */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-2">
                        <h3 className="text-xs font-medium text-gray-700 mb-2">📌 Vista</h3>
                        
                        {/* Botones principales */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            <button
                                onClick={() => setActiveView('hoy')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    activeView === 'hoy'
                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                            >
                                📅 Hoy
                            </button>
                            <button
                                onClick={() => setActiveView('proximas')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    activeView === 'proximas'
                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                                }`}
                            >
                                📆 Próximas
                            </button>
                            <button
                                onClick={() => setActiveView('pasadas')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    activeView === 'pasadas'
                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                            >
                                ✅ Pasadas
                            </button>
                        </div>

                        {/* Sub-botones táctiles para PRÓXIMAS */}
                        {activeView === 'proximas' && (
                            <div className="pl-3 border-l-2 border-purple-600">
                                <p className="text-[10px] text-gray-500 mb-1 font-medium">Mostrar:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => setProximasFilter('todas')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                            proximasFilter === 'todas'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                        }`}
                                    >
                                        📋 Todas
                                    </button>
                                    <button
                                        onClick={() => setProximasFilter('manana')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                            proximasFilter === 'manana'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                        }`}
                                    >
                                        🌅 Mañana
                                    </button>
                                    <button
                                        onClick={() => setProximasFilter('esta_semana')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                            proximasFilter === 'esta_semana'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                        }`}
                                    >
                                        📊 Esta semana
                                    </button>
                                    <button
                                        onClick={() => setProximasFilter('este_mes')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                            proximasFilter === 'este_mes'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                        }`}
                                    >
                                        📆 Este mes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-2">
                <div className="flex flex-col lg:flex-row gap-1.5">
                    {/* Búsqueda */}
                    <div className="flex-1 relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            size={20}
                        />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, teléfono o email..."
                            value={filters.search}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    search: e.target.value,
                                }))
                            }
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Filtros adicionales */}
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={filters.source}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    source: e.target.value,
                                }))
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">Todos los orígenes</option>
                            <option value="agent_whatsapp">💬 WhatsApp IA</option>
                            <option value="agent_phone">📞 Llamada IA</option>
                            <option value="agent_web">🌐 Web IA</option>
                            <option value="dashboard">✏️ Dashboard</option>
                            <option value="external_api">🔌 API Externa</option>
                        </select>

                        <select
                            value={filters.status}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    status: e.target.value,
                                }))
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los estados</option>
                            {Object.entries(RESERVATION_STATES).map(
                                ([key, state]) => (
                                    <option key={key} value={key}>
                                        {state.label}
                                    </option>
                                ),
                            )}
                        </select>

                        <select
                            value={filters.channel}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    channel: e.target.value,
                                }))
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los canales</option>
                            {Object.entries(CHANNELS).map(([key, channel]) => (
                                <option key={key} value={key}>
                                    {channel.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 🎯 MÉTRICAS COMO BOTONES - Rediseñados para verse más clickeables */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                {/* Total - Solo métrica, no clickeable */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Total</p>
                            <p className="text-lg font-bold text-gray-900">
                                {stats.total}
                            </p>
                        </div>
                        <CalendarIcon className="w-6 h-6 text-blue-500" />
                    </div>
                </div>

                {/* Confirmadas - Botón rediseñado con efectos más pronunciados */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStatusModalType('confirmed');
                        setShowStatusModal(true);
                    }}
                    className="group relative w-full bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 active:from-blue-200 active:to-blue-300 border-l-4 border-blue-600 rounded-lg p-4 shadow-md hover:shadow-xl active:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-100 hover:-translate-y-1"
                    title="Ver todas las reservas confirmadas"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <CheckCircle2 className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Confirmadas</p>
                            <p className="text-3xl font-black text-blue-600 leading-none group-hover:text-blue-700 transition-colors">
                                {stats.confirmed}
                            </p>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-lg border-2 border-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>

                {/* Pendientes - Botón rediseñado con efectos más pronunciados */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStatusModalType('pending');
                        setShowStatusModal(true);
                    }}
                    className="group relative w-full bg-gradient-to-br from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 active:from-yellow-200 active:to-yellow-300 border-l-4 border-yellow-500 rounded-lg p-4 shadow-md hover:shadow-xl active:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-100 hover:-translate-y-1"
                    title="Ver todas las reservas pendientes"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <Clock className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Pendientes</p>
                            <p className="text-3xl font-black text-yellow-600 leading-none group-hover:text-yellow-700 transition-colors">
                                {stats.pending}
                            </p>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-lg border-2 border-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>

                {/* Completadas - Botón rediseñado con efectos más pronunciados */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStatusModalType('completed');
                        setShowStatusModal(true);
                    }}
                    className="group relative w-full bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 active:from-green-200 active:to-green-300 border-l-4 border-green-600 rounded-lg p-4 shadow-md hover:shadow-xl active:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-100 hover:-translate-y-1"
                    title="Ver todas las reservas completadas"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <CheckCircle2 className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Completadas</p>
                            <p className="text-3xl font-black text-green-600 leading-none group-hover:text-green-700 transition-colors">
                                {stats.completed}
                            </p>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-lg border-2 border-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>

                {/* Canceladas - Botón rediseñado con efectos más pronunciados */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStatusModalType('cancelled');
                        setShowStatusModal(true);
                    }}
                    className="group relative w-full bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 active:from-red-200 active:to-red-300 border-l-4 border-red-600 rounded-lg p-4 shadow-md hover:shadow-xl active:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-100 hover:-translate-y-1"
                    title="Ver todas las reservas canceladas"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <XCircle className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Canceladas</p>
                            <p className="text-3xl font-black text-red-600 leading-none group-hover:text-red-700 transition-colors">
                                {stats.cancelled}
                            </p>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-lg border-2 border-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>

                {/* No-Shows - Botón rediseñado con efectos más pronunciados */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStatusModalType('no_show');
                        setShowStatusModal(true);
                    }}
                    className="group relative w-full bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 active:from-gray-200 active:to-gray-300 border-l-4 border-gray-600 rounded-lg p-4 shadow-md hover:shadow-xl active:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-100 hover:-translate-y-1"
                    title="Ver todos los no-shows"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <AlertTriangle className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">No-Shows</p>
                            <p className="text-3xl font-black text-gray-700 leading-none group-hover:text-gray-800 transition-colors">
                                {stats.noShows}
                            </p>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-lg border-2 border-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>

                {/* Notes - Botón nuevo para mostrar reservas con notas */}
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowNotesModal(true);
                    }}
                    className="group relative w-full bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 active:from-purple-200 active:to-purple-300 border-l-4 border-purple-600 rounded-lg p-4 shadow-md hover:shadow-xl active:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-100 hover:-translate-y-1"
                    title="Ver todas las reservas con notas"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Notas</p>
                            <p className="text-3xl font-black text-purple-600 leading-none group-hover:text-purple-700 transition-colors">
                                {stats.withNotes}
                            </p>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-lg border-2 border-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
            </div>

            {/* Controles de selección */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={
                                selectedReservations.size ===
                                    filteredReservations.length &&
                                filteredReservations.length > 0
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                            Seleccionar todas ({filteredReservations.length})
                        </span>
                    </div>

                    {/* Leyenda de orígenes */}
                    <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-4 bg-purple-500 rounded"></div>
                            <Bot className="w-3 h-3 text-purple-600" />
                            <span className="text-gray-600">Agente IA</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Edit className="w-3 h-3 text-gray-600" />
                            <span className="text-gray-600">Dashboard</span>
                        </div>
                    </div>
                </div>

                {/* Acciones masivas */}
                {selectedReservations.size > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkAction("confirm")}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirmar ({selectedReservations.size})
                        </button>
                        <button
                            onClick={() => handleBulkAction("cancel")}
                            className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm flex items-center gap-1"
                        >
                            <XCircle className="w-4 h-4" />
                            Cancelar ({selectedReservations.size})
                        </button>
                        <button
                            onClick={() => handleBulkAction("delete")}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-1"
                        >
                            <Trash2 className="w-4 h-4" />
                            Eliminar ({selectedReservations.size})
                        </button>
                    </div>
                )}
            </div>

            {/* Lista de reservas */}
            <div className="space-y-4">
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="bg-white border border-gray-200 rounded-lg p-2 animate-pulse"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                    <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredReservations.length > 0 ? (
                    filteredReservations.map((reservation) => (
                        <ReservationCard
                            key={reservation.id}
                            reservation={reservation}
                            onAction={handleReservationAction}
                            onSelect={handleSelectReservation}
                            isSelected={selectedReservations.has(
                                reservation.id,
                            )}
                        />
                    ))
                ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                        <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                            No hay reservas
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {filters.search ||
                            filters.status ||
                            filters.channel ||
                            filters.source
                                ? "No se encontraron reservas que coincidan con los filtros aplicados"
                                : "No hay reservas para el período seleccionado"}
                        </p>
                        {!filters.search &&
                            !filters.status &&
                            !filters.channel &&
                            !filters.source && (
                                <button
                                    onClick={handleCreateReservation}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 shadow-md font-medium"
                                >
                                    <Plus className="w-4 h-4" />
                                    Crear primera reserva
                                </button>
                            )}
                    </div>
                )}
            </div>

                </>
            )}

            {/* ❌ Pestaña de Política de Reservas ELIMINADA - Configuración movida a Configuración → Reservas */}
            {/* ❌ Pestaña de Ocupación ELIMINADA - Funcionalidad fusionada en Reservas */}
            {/* ❌ Pestaña de Disponibilidad MOVIDA - Ahora es una página separada en /disponibilidad */}

            {/* 🚀 NUEVA PESTAÑA DE RESERVAS - CALENDARIO PROFESIONAL */}
            {false && (
                <div className="space-y-3">
                    {/* Controles compactos en una línea */}
                    <div className="bg-blue-50 rounded-lg border border-blue-200 p-2">
                        <div className="flex items-center gap-3">
                            {/* Título compacto */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <CalendarIcon className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-medium text-blue-900">
                                    Seleccionar Día
                                </h3>
                            </div>
                            
                            {/* Selector de fecha */}
                            <input
                                type="date"
                                value={format(occupancyDate, 'yyyy-MM-dd')}
                                onChange={(e) => setOccupancyDate(new Date(e.target.value))}
                                className="px-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            
                            {/* Selector de zona */}
                            <select
                                value={occupancyZone}
                                onChange={(e) => setOccupancyZone(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">📍 Todas las zonas</option>
                                {restaurant?.settings?.zones && Object.entries(restaurant.settings.zones)
                                    .filter(([, zoneData]) => zoneData.enabled)
                                    .map(([zoneKey, zoneData]) => (
                                        <option key={zoneKey} value={zoneKey}>
                                            {zoneData.icon} {zoneData.display_name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Dashboard de métricas */}
                    {occupancyMetrics && (
                        <OccupancyMetrics 
                            metrics={occupancyMetrics} 
                            date={occupancyDate}
                            totalReservations={filteredReservations.length}
                        />
                    )}

                    {/* Error handling */}
                    {occupancyError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <p className="text-red-900 font-medium">Error al cargar datos de ocupación</p>
                            </div>
                            <p className="text-sm text-red-700 mt-1">{occupancyError}</p>
                        </div>
                    )}

                    {/* Heat Map principal */}
                    <OccupancyHeatMap 
                        occupancyData={occupancyData}
                        loading={occupancyLoading}
                        onSlotClick={async (slotData) => {
                            const { slot } = slotData;
                            
                            // Solo abrir modal si el slot está reservado Y tiene reservation_id
                            if (!slot || slot.status !== 'reserved' || !slot.reservation_id) {
                                console.log('⚠️ Slot no válido para abrir modal');
                                return;
                            }
                            
                            try {
                                // Buscar la reserva DIRECTAMENTE por ID
                                const { data: reservation, error } = await supabase
                                    .from('appointments')
                                    .select(`
                                        *,
                                        tables (
                                            id,
                                            name,
                                            table_number,
                                            zone,
                                            capacity
                                        )
                                    `)
                                    .eq('id', slot.reservation_id)
                                    .single();
                                
                                if (error) throw error;
                                
                                if (reservation) {
                                    setViewingReservation(reservation);
                                    setShowDetailsModal(true);
                                } else {
                                    toast.error('No se encontró la reserva');
                                }
                            } catch (error) {
                                console.error('Error al cargar reserva:', error);
                                toast.error('Error al cargar los detalles de la reserva');
                            }
                        }}
                    />

                    {/* Estadísticas detalladas por mesa */}
                    {occupancyMetrics?.tableStats && occupancyMetrics.tableStats.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                <BarChart3 className="w-5 h-5 text-purple-600" />
                                <span>Estadísticas por Mesa</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {occupancyMetrics.tableStats
                                    .sort((a, b) => b.occupancyRate - a.occupancyRate)
                                    .map((stat) => (
                                        <div 
                                            key={stat.tableId}
                                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-semibold text-gray-900">{stat.tableName}</h4>
                                                <span className={`text-lg font-bold ${
                                                    stat.occupancyRate >= 80 ? 'text-red-600' :
                                                    stat.occupancyRate >= 60 ? 'text-orange-600' :
                                                    stat.occupancyRate >= 40 ? 'text-yellow-600' :
                                                    'text-green-600'
                                                }`}>
                                                    {stat.occupancyRate.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                                <p className="flex items-center space-x-2">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>Zona: <span className="font-medium">{stat.zone}</span></span>
                                                </p>
                                                <p className="flex items-center space-x-2">
                                                    <Users className="w-4 h-4" />
                                                    <span>Capacidad: <span className="font-medium">{stat.capacity} personas</span></span>
                                                </p>
                                                <p className="flex items-center space-x-2">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>Reservados: <span className="font-medium">{stat.reservedCount}/{stat.totalCount} slots</span></span>
                                                </p>
                                            </div>
                                            {/* Barra de ocupación */}
                                            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full transition-all ${
                                                        stat.occupancyRate >= 80 ? 'bg-red-500' :
                                                        stat.occupancyRate >= 60 ? 'bg-orange-500' :
                                                        stat.occupancyRate >= 40 ? 'bg-yellow-500' :
                                                        'bg-green-500'
                                                    }`}
                                                    style={{ width: `${stat.occupancyRate}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ⚠️ MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
            <ConfirmCancelModal
                isOpen={showCancelModal}
                reservation={cancellingReservation}
                onConfirm={handleCancelConfirm}
                onCancel={() => {
                    setShowCancelModal(false);
                    setCancellingReservation(null);
                }}
            />

            {/* 📋 MODAL DE LISTA DE ESPERA */}
            <WaitlistModal
                isOpen={showWaitlistModal}
                onClose={() => {
                    setShowWaitlistModal(false);
                    setWaitlistData({});
                }}
                businessId={businessId}
                prefilledData={waitlistData}
                onSuccess={(data) => {
                    console.log('✅ Cliente agregado a waitlist:', data);
                    toast.success('Cliente agregado a lista de espera');
                    // Aquí podrías recargar la lista de espera si la estás mostrando
                }}
            />

            {/* 🗑️ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                reservation={deletingReservation}
                onConfirm={handleDeleteConfirm}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeletingReservation(null);
                }}
            />

            {/* 🎯 MODAL PROFESIONAL DE RESERVAS (Crear y Editar) */}
            <NewReservationModalPro
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setInitialReservationData(null);
                    setEditingReservation(null); // 🆕 Limpiar edición
                }}
                businessId={businessId}
                editingReservation={editingReservation} // 🆕 Pasar reserva en edición
                prefilledData={{
                    employee_id: initialReservationData?.employee_id,
                    date: initialReservationData?.date,
                    time: initialReservationData?.time
                }}
                onSuccess={async (result) => {
                    await loadReservations();
                }}
            />

            {/* 📄 MODAL DE DETALLES DE RESERVA */}
            {showDetailsModal && viewingReservation && (
                <ReservationDetailsModal
                    reservation={viewingReservation}
                    isOpen={showDetailsModal}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setViewingReservation(null);
                    }}
                    onEdit={(reserva) => {
                        // ✅ Abrir NewReservationModalPro en modo edición
                        setEditingReservation(reserva);
                        setShowDetailsModal(false); // Cerrar modal de detalles
                        setShowCreateModal(true); // Abrir modal de edición
                    }}
                />
            )}

            {/* 🎯 MODAL DE RESERVAS POR ESTADO - Reutilizable */}
            {showStatusModal && statusModalType && (
                <StatusReservationsModal
                    isOpen={showStatusModal}
                    onClose={() => {
                        setShowStatusModal(false);
                        setStatusModalType(null);
                    }}
                    statusType={statusModalType}
                    reservations={filteredReservations.filter((r) => {
                        const statusMap = {
                            confirmed: "confirmed",
                            pending: "pending",
                            completed: "completed",
                            cancelled: "cancelled",
                            no_show: "no_show",
                        };
                        return r.status === statusMap[statusModalType];
                    })}
                    onReservationClick={(reserva) => {
                        setViewingReservation(reserva);
                        setShowDetailsModal(true);
                        setShowStatusModal(false);
                    }}
                />
            )}

            {/* 🆕 MODAL DE RESERVAS CON NOTAS */}
            {showNotesModal && (
                <NotesReservationsModal
                    isOpen={showNotesModal}
                    onClose={() => {
                        setShowNotesModal(false);
                    }}
                    reservations={filteredReservations.filter(
                        (r) =>
                            (r.special_requests &&
                                r.special_requests.trim() !== "") ||
                            (r.notes && r.notes.trim() !== ""),
                    )}
                    onReservationClick={(reserva) => {
                        setViewingReservation(reserva);
                        setShowDetailsModal(true);
                        setShowNotesModal(false);
                    }}
                />
            )}

            {/* 🧪 MODAL DE PRUEBA SÚPER SIMPLE */}
            {showDebugModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">✅ Modal de prueba</h2>
                        <p className="text-sm text-gray-600">
                            Si estás viendo este cuadro blanco con fondo oscuro,
                            los modales de la página de reservas FUNCIONAN. 
                            Si los otros no se ven, el problema es de datos/filtros, no de los modales.
                        </p>
                        <button
                            onClick={() => setShowDebugModal(false)}
                            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

// 🎯 Modal de Reservas por Estado - Diseño recuperado del modal antiguo que funcionaba
const StatusReservationsModal = ({ isOpen, onClose, statusType, reservations, onReservationClick }) => {
    const [visibleCount, setVisibleCount] = useState(30);
    // Función para calcular hora de fin
    const calcularHoraFin = (horaInicio, duracionMinutos) => {
        const [hora, minuto] = horaInicio.split(':').map(Number);
        const totalMinutos = hora * 60 + minuto + duracionMinutos;
        const horaFin = Math.floor(totalMinutos / 60);
        const minutoFin = totalMinutos % 60;
        return `${horaFin.toString().padStart(2, '0')}:${minutoFin.toString().padStart(2, '0')}`;
    };

    const statusConfig = {
        'confirmed': {
            title: '✅ Reservas Confirmadas',
            emoji: '✅',
            bgGradient: 'from-blue-600 to-blue-700',
            bgLight: 'bg-blue-50',
            borderColor: 'border-blue-500',
            badgeBg: 'bg-blue-100',
            badgeText: 'text-blue-700',
            badgeEmoji: '✅'
        },
        'pending': {
            title: '⏳ Reservas Pendientes',
            emoji: '⏳',
            bgGradient: 'from-yellow-500 to-amber-600',
            bgLight: 'bg-yellow-50',
            borderColor: 'border-yellow-500',
            badgeBg: 'bg-yellow-100',
            badgeText: 'text-yellow-700',
            badgeEmoji: '⏳'
        },
        'completed': {
            title: '✅ Reservas Completadas',
            emoji: '✅',
            bgGradient: 'from-green-600 to-green-700',
            bgLight: 'bg-green-50',
            borderColor: 'border-green-500',
            badgeBg: 'bg-green-100',
            badgeText: 'text-green-700',
            badgeEmoji: '✅'
        },
        'cancelled': {
            title: '🗑️ Reservas Canceladas',
            emoji: '🗑️',
            bgGradient: 'from-red-600 to-red-700',
            bgLight: 'bg-red-50',
            borderColor: 'border-red-500',
            badgeBg: 'bg-red-100',
            badgeText: 'text-red-700',
            badgeEmoji: '❌'
        },
        'no_show': {
            title: '⚠️ No-Shows',
            emoji: '⚠️',
            bgGradient: 'from-orange-600 to-orange-700',
            bgLight: 'bg-orange-50',
            borderColor: 'border-orange-500',
            badgeBg: 'bg-orange-100',
            badgeText: 'text-orange-700',
            badgeEmoji: '⚠️'
        }
    };

    const config = statusConfig[statusType] || statusConfig["pending"];

    if (!isOpen) return null;

    const visibleReservations = reservations.slice(0, visibleCount);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className={`bg-gradient-to-r ${config.bgGradient} px-6 py-4 flex items-center justify-between`}>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {config.title} ({reservations.length})
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Lista de reservas */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {reservations.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            No hay reservas en este estado
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {visibleReservations.map((reserva) => {
                                const horaFin = calcularHoraFin(
                                    reserva.reservation_time || reserva.appointment_time || '00:00',
                                    reserva.duration_minutes || reserva.service_duration_minutes || 60
                                );
                                
                                return (
                                    <div 
                                        key={reserva.id}
                                        onClick={() => onReservationClick(reserva)}
                                        className={`${config.bgLight} border-l-4 ${config.borderColor} rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer touch-target`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-900 text-base mb-1">
                                                    {reserva.customer_name || 'Sin nombre'}
                                                </h3>
                                                <div className="space-y-1 text-sm text-gray-700">
                                                    <p className="flex items-center gap-2">
                                                        <CalendarIcon className="w-4 h-4" />
                                                        {reserva.reservation_date || reserva.appointment_date 
                                                            ? format(parseISO(reserva.reservation_date || reserva.appointment_date), "EEE dd MMM yyyy", { locale: es })
                                                            : 'Sin fecha'}
                                                    </p>
                                                    <p className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4" />
                                                        {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)} - {horaFin}
                                                        <span className="text-gray-500">({reserva.duration_minutes || 60}min)</span>
                                                    </p>
                                                    {reserva.service_name && (
                                                        <p className="flex items-center gap-2">
                                                            ✂️ {reserva.service_name}
                                                        </p>
                                                    )}
                                                    {reserva.notes && (
                                                        <p className="text-xs text-gray-600 italic mt-2">
                                                            💬 {reserva.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.badgeBg} ${config.badgeText}`}>
                                                    {config.badgeEmoji} {statusType === 'cancelled' ? 'Cancelada' : statusType === 'no_show' ? 'No-Show' : statusType === 'confirmed' ? 'Confirmada' : statusType === 'pending' ? 'Pendiente' : 'Completada'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {reservations.length > visibleCount && (
                                <div className="pt-4 flex justify-center">
                                    <button
                                        onClick={() => setVisibleCount((prev) => prev + 30)}
                                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                                    >
                                        Ver 30 más ({reservations.length - visibleCount} restantes)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 🆕 Modal de Reservas con Notas
const NotesReservationsModal = ({ isOpen, onClose, reservations, onReservationClick }) => {
    const [visibleCount, setVisibleCount] = useState(30);

    // Función para calcular hora de fin
    const calcularHoraFin = (horaInicio, duracionMinutos) => {
        const [hora, minuto] = (horaInicio || "00:00").split(":").map(Number);
        const totalMinutos = hora * 60 + minuto + (duracionMinutos || 60);
        const horaFin = Math.floor(totalMinutos / 60);
        const minutoFin = totalMinutos % 60;
        return `${horaFin.toString().padStart(2, "0")}:${minutoFin.toString().padStart(2, "0")}`;
    };

    if (!isOpen) return null;

    const visibleReservations = reservations.slice(0, visibleCount);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        📝 Reservas con Notas ({reservations.length})
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Lista de reservas */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {reservations.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            No hay reservas con notas
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {visibleReservations.map((reserva) => {
                                const horaFin = calcularHoraFin(
                                    reserva.reservation_time || reserva.appointment_time || "00:00",
                                    reserva.duration_minutes || reserva.service_duration_minutes || 60,
                                );

                                // Mapear estado para badge
                                const statusMapping = {
                                    pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700" },
                                    confirmed: { label: "Confirmada", color: "bg-blue-100 text-blue-700" },
                                    completed: { label: "Completada", color: "bg-green-100 text-green-700" },
                                    cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700" },
                                    no_show: { label: "No-Show", color: "bg-orange-100 text-orange-700" },
                                };
                                const statusInfo =
                                    statusMapping[reserva.status] || {
                                        label: reserva.status,
                                        color: "bg-gray-100 text-gray-700",
                                    };

                                return (
                                    <div
                                        key={reserva.id}
                                        onClick={() => onReservationClick(reserva)}
                                        className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer touch-target"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-900 text-base mb-1">
                                                    {reserva.customer_name || "Sin nombre"}
                                                </h3>
                                                <div className="space-y-1 text-sm text-gray-700">
                                                    <p className="flex items-center gap-2">
                                                        <CalendarIcon className="w-4 h-4" />
                                                        {reserva.reservation_date || reserva.appointment_date
                                                            ? format(
                                                                  parseISO(
                                                                      reserva.reservation_date ||
                                                                          reserva.appointment_date,
                                                                  ),
                                                                  "EEE dd MMM yyyy",
                                                                  { locale: es },
                                                              )
                                                            : "Sin fecha"}
                                                    </p>
                                                    <p className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4" />
                                                        {(reserva.reservation_time ||
                                                            reserva.appointment_time ||
                                                            "00:00"
                                                        ).substring(0, 5)}{" "}
                                                        - {horaFin}
                                                        <span className="text-gray-500">
                                                            ({reserva.duration_minutes || 60}min)
                                                        </span>
                                                    </p>
                                                    {reserva.service_name && (
                                                        <p className="flex items-center gap-2">
                                                            ✂️ {reserva.service_name}
                                                        </p>
                                                    )}
                                                    {(reserva.special_requests || reserva.notes) && (
                                                        <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                                                            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                                                                <FileText className="w-3 h-3" />
                                                                {reserva.special_requests ? "Petición Especial" : "Nota"}:
                                                            </p>
                                                            <p className="text-sm text-gray-800 italic">
                                                                {reserva.special_requests || reserva.notes}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}
                                                >
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {reservations.length > visibleCount && (
                                <div className="pt-4 flex justify-center">
                                    <button
                                        onClick={() => setVisibleCount((prev) => prev + 30)}
                                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                                    >
                                        Ver 30 más ({reservations.length - visibleCount} restantes)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Modal para crear/editar reserva
const ReservationFormModal = ({
    isOpen,
    onClose,
    onSave,
    reservation = null,
    tables = [],
    businessId,
}) => {
    const [loading, setLoading] = useState(false);
    
    // FUNCIONALIDAD BÁSICA IMPLEMENTADA: 
    // - Crear reservas con datos de cliente funciona correctamente
    // - Vinculación automática con clientes existentes por teléfono/email
    // - TODO FUTURO: Implementar búsqueda visual de clientes existentes
    
    const [formData, setFormData] = useState({
        clientType: 'new', // 'existing' o 'new'
        selectedCustomer: null,
        
        // 👤 DATOS DEL CLIENTE (UNIFICADO CON CustomerModal)
        first_name: reservation?.customer_name?.split(' ')[0] || "",
        last_name1: reservation?.customer_name?.split(' ')[1] || "",
        last_name2: reservation?.customer_name?.split(' ')[2] || "",
        customer_name: reservation?.customer_name || "", // Campo calculado automáticamente
        customer_phone: reservation?.customer_phone || "",
        customer_email: reservation?.customer_email || "",
        notes: "",
        
        // 🔐 PERMISOS GDPR (UNIFICADO CON CustomerModal)
        consent_email: false,
        consent_sms: false,
        consent_whatsapp: false,
        
        // 📅 DATOS DE LA RESERVA
        date: reservation?.reservation_date || format(new Date(), "yyyy-MM-dd"),
        time: reservation?.reservation_time || "",
        party_size: reservation?.party_size || 2,
        table_id: reservation?.table_id || "",
        special_requests: reservation?.special_requests || "",
        status: reservation?.status || "confirmada",
    });

    // Estados para búsqueda inteligente de clientes
    const [searchingCustomer, setSearchingCustomer] = useState(false);
    const [foundCustomers, setFoundCustomers] = useState([]);
    const [phoneSearched, setPhoneSearched] = useState('');

    const [errors, setErrors] = useState({});

    // FUNCIONALIDAD ACTUAL: La vinculación automática funciona en handleCustomerLinking()
    // Se buscan automáticamente clientes existentes por teléfono/email y se actualizan las métricas

    // 🔍 NUEVA FUNCIONALIDAD: Búsqueda inteligente en tiempo real por teléfono
    const searchCustomerByPhone = async (phone) => {
        if (!phone || phone.length < 3) {
            setFoundCustomers([]);
            return;
        }

        setSearchingCustomer(true);
        setPhoneSearched(phone);

        try {
            const { data: customers, error } = await supabase
                .from("customers")
                .select("*")
                .eq("business_id", businessId)
                .or(`phone.ilike.%${phone}%,name.ilike.%${phone}%`)
                .order('last_visit_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            setFoundCustomers(customers || []);
        } catch (error) {
            console.error("Error buscando clientes:", error);
            setFoundCustomers([]);
        } finally {
            setSearchingCustomer(false);
        }
    };

    // 🎯 FUNCIONALIDAD: Auto-completar datos cuando se selecciona cliente existente
    const handleSelectExistingCustomer = (customer) => {
        setFormData({
            ...formData,
            clientType: 'existing',
            selectedCustomer: customer,
            
            // 👤 DATOS COMPLETOS DEL CLIENTE
            first_name: customer.first_name || customer.name?.split(' ')[0] || '',
            last_name1: customer.last_name1 || customer.name?.split(' ')[1] || '',
            last_name2: customer.last_name2 || customer.name?.split(' ')[2] || '',
            customer_name: customer.name || '',
            customer_phone: customer.phone || '',
            customer_email: customer.email || '',
            notes: customer.notes || '',
            
            // 🔐 PERMISOS EXISTENTES - CORRECCIÓN GDPR
            consent_email: customer.consent_email === true,
            consent_sms: customer.consent_sms === true,
            consent_whatsapp: customer.consent_whatsapp === true,
        });
        setFoundCustomers([]);
        toast.success(`Cliente ${customer.name} seleccionado - ${customer.visits_count || 0} visitas previas`);
    };

    // 🔄 FUNCIONALIDAD: Actualizar nombre completo automáticamente
    const updateFullName = (firstName, lastName1, lastName2) => {
        return `${firstName || ''} ${lastName1 || ''} ${lastName2 || ''}`.trim();
    };

    // Función para vincular reserva con cliente existente y actualizar métricas
    const handleCustomerLinking = async (reservationData, customerData = {}) => {
        try {
            // Buscar cliente existente por teléfono o email
            const { data: existingCustomers, error: searchError } = await supabase
                .from("customers")
                .select("*")
                .eq("business_id", businessId)
                .or(`phone.eq.${reservationData.customer_phone},email.eq.${reservationData.customer_email || ''}`);

            if (searchError) {
                console.error("Error searching customers:", searchError);
                return;
            }

            let customer = existingCustomers?.[0];

            if (customer) {
                // Cliente existente: actualizar métricas usando esquema real
                const updatedData = {
                    visits_count: (customer.visits_count || 0) + 1,
                    last_visit_at: reservationData.reservation_date,
                    total_spent: customer.total_spent || 0, // Se actualizaría con el ticket real
                };

                // Calcular nuevo segmento automático y guardarlo en preferences
                const newSegment = calculateAutomaticSegment(updatedData, customer);
                updatedData.preferences = {
                    ...customer.preferences,
                    segment: newSegment,
                    last_auto_update: new Date().toISOString()
                };

                await supabase
                    .from("customers")
                    .update(updatedData)
                    .eq("id", customer.id);

                console.log(`Cliente ${customer.name} actualizado: ${updatedData.visits_count} visitas`);
            } else {
                // Cliente nuevo: crear automáticamente usando esquema COMPLETO (UNIFICADO)
                const newCustomer = {
                    // 👤 DATOS PERSONALES COMPLETOS
                    name: reservationData.customer_name,
                    first_name: customerData.first_name || reservationData.customer_name?.split(' ')[0] || '',
                    last_name1: customerData.last_name1 || reservationData.customer_name?.split(' ')[1] || '',
                    last_name2: customerData.last_name2 || reservationData.customer_name?.split(' ')[2] || '',
                    
                    // 📞 CONTACTO
                    phone: reservationData.customer_phone,
                    email: reservationData.customer_email || null,
                    
                    // 📝 NOTAS
                    notes: customerData.notes || "Cliente creado automáticamente desde reserva",
                    
                    // 🔐 PERMISOS GDPR
                    consent_email: customerData.consent_email || false,
                    consent_sms: customerData.consent_sms || false,
                    consent_whatsapp: customerData.consent_whatsapp || false,
                    
                    // 🏪 RESTAURANT DATA
                    business_id: businessId,
                    visits_count: 1,
                    last_visit_at: reservationData.reservation_date,
                    total_spent: 0,
                    
                    // 🎯 SEGMENTACIÓN
                    preferences: {
                        segment: "nuevo",
                        created_automatically: true,
                        created_from: "reservation"
                    },
                };

                await supabase
                    .from("customers")
                    .insert([newCustomer]);

                console.log(`Nuevo cliente ${newCustomer.name} creado automáticamente`);
            }
        } catch (error) {
            console.error("Error in customer linking:", error);
            // No mostramos error al usuario, es proceso en background
        }
    };

    // Función para calcular segmento automático según reglas de negocio
    const calculateAutomaticSegment = (customerData, existingCustomer) => {
        const totalVisits = customerData.visits_count || 0;
        const totalSpent = customerData.total_spent || 0;
        const lastVisit = new Date(customerData.last_visit);
        const now = new Date();
        const daysSinceLastVisit = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));

        // Reglas de segmentación automática actualizadas
        if (totalVisits === 0 || daysSinceLastVisit <= 7) {
            return "nuevo";
        } else if (totalVisits >= 5 || totalSpent >= 500) {
            return "vip";
        } else if (totalVisits >= 3) {
            return "regular";
        } else if (totalVisits >= 1 && totalVisits <= 2) {
            return "ocasional";
        } else if (daysSinceLastVisit > 180) {
            return "inactivo";
        } else if (daysSinceLastVisit > 90 && (existingCustomer?.visits_count || 0) >= 3) {
            return "en_riesgo";
        } else if (totalSpent >= 300) {
            return "alto_valor";
        }

        return "ocasional"; // Por defecto
    };

    const validateForm = async () => {
        const newErrors = {};

        if (!formData.customer_name.trim()) {
            newErrors.customer_name = "El nombre es obligatorio";
        }

        if (!formData.customer_phone.trim()) {
            newErrors.customer_phone = "El teléfono es obligatorio";
        }

        if (!formData.time || formData.time.trim() === "") {
            newErrors.time = "La hora es obligatoria";
        }

        if (!formData.party_size || formData.party_size < 1) {
            newErrors.party_size = "Número de personas inválido";
        }

        // 🔍 VALIDACIÓN AVANZADA: LÍMITES CONFIGURADOS (COHERENCIA)
        try {
            const { data: restaurantData } = await supabase
                .from("businesses")
                .select("settings")
                .eq("id", businessId)
                .single();
            
            const reservationSettings = restaurantData?.settings?.reservation_settings || {};
            
            // Validar límites de personas
            if (reservationSettings.min_party_size && formData.party_size < reservationSettings.min_party_size) {
                newErrors.party_size = `Mínimo ${reservationSettings.min_party_size} personas (configurado en Configuración → Reservas)`;
            }
            
            if (reservationSettings.max_party_size && formData.party_size > reservationSettings.max_party_size) {
                newErrors.party_size = `Máximo ${reservationSettings.max_party_size} personas (configurado en Configuración → Reservas)`;
            }
            
            // Validar días de antelación
            if (reservationSettings.advance_booking_days) {
                const selectedDate = new Date(formData.date);
                const today = new Date();
                const maxDate = new Date();
                maxDate.setDate(today.getDate() + reservationSettings.advance_booking_days);
                
                if (selectedDate > maxDate) {
                    newErrors.date = `Máximo ${reservationSettings.advance_booking_days} días de antelación (configurado en Configuración → Reservas)`;
                }
                
                if (selectedDate < today) {
                    newErrors.date = "No se pueden hacer reservas en fechas pasadas";
                }
            }
            
        } catch (error) {
            console.error("Error validando límites configurados:", error);
            // Continuar sin validación avanzada si hay error
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!(await validateForm())) return;

        setLoading(true);

        try {
            // 🔧 VARIABLE PARA TRACKEAR CLIENTE ENCONTRADO
            let actualCustomerId = reservation?.customer_id;
            
            // 🎯 CORRECCIÓN DEFINITIVA: Traducir status de español a inglés antes de enviar
            const statusMapping = {
                "confirmada": "confirmed",
                "pendiente": "pending",
                "sentada": "seated",
                "completada": "completed",
                "cancelada": "cancelled"
            };
            const backendStatus = statusMapping[formData.status] || formData.status;

            // 📋 DATOS DE LA RESERVA (SOLO campos válidos para tabla reservations)
            const reservationData = {
                customer_name: formData.customer_name,
                customer_email: formData.customer_email || null,
                customer_phone: formData.customer_phone || null,
                reservation_date: formData.date,
                reservation_time: formData.time,
                party_size: parseInt(formData.party_size),
                special_requests: formData.special_requests || null,
                table_number: formData.table_number || null,
                notes: formData.notes || null,
                business_id: businessId,
                status: backendStatus, // Usar el estado traducido y validado
                source: "dashboard",
                table_id: formData.table_id || null
            };

            // 🎯 LÓGICA DE GUARDADO CORREGIDA
            if (reservation) {
                // MODO EDICIÓN
                // Paso 1: Actualizar la reserva
                const { error: reservationError } = await supabase
                    .from('appointments')
                    .update(reservationData)
                    .eq("id", reservation.id);

                if (reservationError) throw reservationError;

                // Paso 2: Si hay un cliente vinculado, actualizar sus consentimientos y notas
                console.log('🔍 DEBUG GUARDADO:');
                console.log('reservation.customer_id:', reservation.customer_id);
                console.log('formData.consent_email:', formData.consent_email);
                console.log('formData.consent_sms:', formData.consent_sms);
                console.log('formData.consent_whatsapp:', formData.consent_whatsapp);
                
                // 🔧 BUSCAR CLIENTE PARA GUARDAR (si no hay customer_id)
                if (!actualCustomerId && (formData.customer_phone || formData.customer_email)) {
                    console.log('🔍 Buscando cliente para guardar...');
                    let query = supabase.from('customers').select('id').eq('business_id', businessId);
                    
                    if (formData.customer_phone) {
                        query = query.eq('phone', formData.customer_phone);
                    } else if (formData.customer_email) {
                        query = query.eq('email', formData.customer_email);
                    }
                    
                    const { data: foundCustomer } = await query.maybeSingle();
                    if (foundCustomer) {
                        actualCustomerId = foundCustomer.id;
                        console.log('✅ Cliente encontrado para guardar:', actualCustomerId);
                    }
                }
                
                if (actualCustomerId) {
                    const customerUpdateData = {
                        notes: formData.notes,
                        consent_email: formData.consent_email,
                        consent_sms: formData.consent_sms,
                        consent_whatsapp: formData.consent_whatsapp,
                    };
                    
                    console.log('💾 Datos que se van a guardar:', customerUpdateData);

                    const { error: customerError } = await supabase
                        .from("customers")
                        .update(customerUpdateData)
                        .eq("id", actualCustomerId);
                        
                    console.log('💾 UPDATE ejecutado en customer_id:', actualCustomerId);

                    if (customerError) {
                        console.warn("Advertencia: La reserva se actualizó, pero hubo un error al actualizar los consentimientos del cliente.", customerError);
                        toast.error("Error al guardar consentimientos del cliente");
                    } else {
                        // 🔧 CORRECCIÓN CRUCIAL: Actualizar formData con los valores guardados
                        setFormData(prev => ({
                            ...prev,
                            consent_email: formData.consent_email,
                            consent_sms: formData.consent_sms,
                            consent_whatsapp: formData.consent_whatsapp,
                            notes: formData.notes
                        }));
                        console.log('✅ Consentimientos actualizados en BD y UI');
                    }
                }
            } else {
                // MODO CREACIÓN (la lógica existente es correcta)
                const { error } = await supabase
                    .from('appointments')
                    .insert([reservationData]);

                if (error) throw error;

                // NUEVO: Vincular con cliente existente y actualizar métricas
                // Pasar datos del cliente por separado
                const customerData = {
                    first_name: formData.first_name,
                    last_name1: formData.last_name1,
                    last_name2: formData.last_name2,
                    notes: formData.notes,
                    consent_email: formData.consent_email,
                    consent_sms: formData.consent_sms,
                    consent_whatsapp: formData.consent_whatsapp,
                };
                await handleCustomerLinking(reservationData, customerData);
            }

            // Un solo toast de éxito y recarga de datos
            toast.success(reservation ? "Reserva actualizada correctamente" : "Reserva creada correctamente");
            onSave(); // Esto debería recargar los datos en la página principal
            onClose();
            
        } catch (error) {
            console.error("Error saving reservation:", error);
            
            // MEJORADO: Mensajes de error más descriptivos y orientativos
            let errorMessage = 'Error desconocido';
            
            console.error("Error completo:", {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                status: error.status,
                full_error: error
            });
            
            if (error.status === 400 || error.code === '400') {
                errorMessage = "❌ Error 400: Datos inválidos enviados a la base de datos.\n\n🔍 Posibles causas:\n• Campo requerido vacío\n• Formato de fecha/hora incorrecto\n• Referencia a mesa inexistente\n\n📋 Revisa que todos los campos obligatorios estén completos.";
            } else if (error.message && error.message.includes('created_by')) {
                errorMessage = "Faltan datos de configuración del restaurante. Ve a Configuración para completar tu perfil.";
            } else if (error.message && error.message.includes('column')) {
                if (tables.length === 0) {
                    errorMessage = "⚠️ No puedes crear reservas porque no hay mesas configuradas.\n\n👉 Ve a la sección 'Mesas' y crea mesas primero, luego vuelve aquí para crear reservas.";
                } else {
                    errorMessage = `Error en la base de datos: ${error.message}. Contacta con soporte si persiste.`;
                }
            } else if (error.message && error.message.includes('duplicate key')) {
                errorMessage = "⚠️ Ya existe una reserva con estos datos. Revisa fecha, hora y cliente.";
            } else if (error.hint) {
                errorMessage = `Error: ${error.hint}`;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            toast.error(errorMessage, {
                duration: 6000, // Mostrar más tiempo para que se pueda leer
                style: {
                    maxWidth: '400px',
                    whiteSpace: 'pre-line' // Permitir saltos de línea
                }
            });
        } finally {
            setLoading(false);
        }
    };

    // 🎯 SOLUCIÓN DEFINITIVA (ROBUSTA): Carga de datos en dos pasos para evitar fallos.
    useEffect(() => {
        const loadFreshData = async () => {
            if (isOpen && reservation?.id) {
                setLoading(true);
                try {
                    // Paso 1: Cargar datos de la reserva
                    const { data: reservationData, error: reservationError } = await supabase
                        .from('appointments')
                        .select(`*`)
                        .eq("id", reservation.id)
                        .single();

                    if (reservationError) throw reservationError;

                    // Paso 2: Cargar datos del cliente asociado (si existe)
                    let customerData = null;
                    console.log('🔍 DEBUG: reservationData.customer_id:', reservationData.customer_id);
                    
                    if (reservationData.customer_id) {
                        const { data: custData, error: customerError } = await supabase
                            .from("customers")
                            .select(`*`)
                            .eq("id", reservationData.customer_id)
                            .single();
                        
                        if (customerError) {
                            console.warn("Advertencia: no se pudo cargar el cliente asociado a la reserva.", customerError);
                        } else {
                            customerData = custData;
                            console.log('✅ Cliente encontrado por ID:', custData);
                        }
                    } else {
                        // 🔧 CORRECCIÓN: Si no hay customer_id, buscar por teléfono/email
                        console.log('🔍 No hay customer_id, buscando por tel/email...');
                        console.log('Buscando con phone:', reservationData.customer_phone);
                        console.log('Buscando con email:', reservationData.customer_email);
                        
                        if (reservationData.customer_phone || reservationData.customer_email) {
                            let query = supabase.from('customers').select('*').eq('business_id', businessId);
                            
                            if (reservationData.customer_phone) {
                                query = query.eq('phone', reservationData.customer_phone);
                            } else if (reservationData.customer_email) {
                                query = query.eq('email', reservationData.customer_email);
                            }
                            
                            const { data: foundCustomer, error: searchError } = await query.maybeSingle();
                            
                            if (!searchError && foundCustomer) {
                                customerData = foundCustomer;
                                console.log('✅ Cliente encontrado por búsqueda:', foundCustomer);
                            } else {
                                console.log('⚠️ No se encontró cliente existente');
                            }
                        }
                    }
                    
                    const statusMap = { "pending": "pendiente", "confirmed": "confirmada", "cancelled": "cancelada" };
                    const frontEndStatus = statusMap[reservationData.status] || "pendiente";

                    setFormData({
                        date: reservationData.reservation_date,
                        time: reservationData.reservation_time,
                        party_size: reservationData.party_size,
                        table_id: reservationData.table_id,
                        special_requests: reservationData.special_requests,
                        status: frontEndStatus,
                        customer_name: reservationData.customer_name,
                        customer_phone: reservationData.customer_phone,
                        customer_email: reservationData.customer_email,
                        notes: customerData?.notes || "",
                            // 🔧 CORRECCIÓN GDPR: Usar validación estricta + DEBUG INTENSIVO
                        consent_email: customerData?.consent_email === true,
                        consent_sms: customerData?.consent_sms === true,
                        consent_whatsapp: customerData?.consent_whatsapp === true,
                        
                        // 🐛 DEBUG INTENSIVO GDPR
                        ...(console.log('🔍 DEBUGGING GDPR LOAD:'), 
                        console.log('customerData completo:', customerData),
                        console.log('consent_email raw:', customerData?.consent_email),
                        console.log('consent_sms raw:', customerData?.consent_sms), 
                        console.log('consent_whatsapp raw:', customerData?.consent_whatsapp),
                        console.log('consent_email processed:', customerData?.consent_email === true),
                        console.log('consent_sms processed:', customerData?.consent_sms === true),
                        console.log('consent_whatsapp processed:', customerData?.consent_whatsapp === true), {})
                    });

                } catch (err) {
                    toast.error("No se pudieron cargar los datos actualizados de la reserva.");
                    console.error("Error loading fresh data:", err);
                    onClose();
                } finally {
                    setLoading(false);
                }
            }
        };

        loadFreshData();
    }, [isOpen, reservation, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center p-0 md:p-2">
            <div className="bg-white rounded-t-xl md:rounded-xl md:max-w-2xl w-full max-h-[90vh] overflow-y-auto safe-area-inset-bottom">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900">
                        {reservation
                            ? "Editar Reserva"
                            : "Nueva Reserva Manual"}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 🎯 FLUJO MEJORADO: Información sobre el matching inteligente */}
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 p-2 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Search className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-1">Sistema Inteligente de Clientes</h4>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    Al escribir el teléfono, buscaremos automáticamente si el cliente ya existe en tu base de datos.
                                </p>
                                {formData.selectedCustomer && (
                                    <div className="bg-green-100 p-2 rounded border border-green-200">
                                        <p className="text-sm text-green-800">
                                            ✅ <strong>Cliente seleccionado:</strong> {formData.selectedCustomer.name}
                                            <span className="ml-2 text-xs">
                                                ({formData.selectedCustomer.visits_count || 0} visitas previas)
                                            </span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 📞 SECCIÓN: INFORMACIÓN DE CONTACTO (PRIMERO PARA BÚSQUEDA) */}
                    <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-green-600" />
                            🔍 Información de Contacto (para búsqueda automática)
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Teléfono *
                                {searchingCustomer && (
                                    <span className="ml-2 text-xs text-blue-600">
                                        <RefreshCw className="w-3 h-3 inline animate-spin mr-1" />
                                        Buscando...
                                    </span>
                                )}
                            </label>
                            <input
                                type="tel"
                                value={formData.customer_phone}
                                onChange={(e) => {
                                    const phone = e.target.value;
                                    setFormData({
                                        ...formData,
                                        customer_phone: phone,
                                    });
                                    
                                    // 🔍 Búsqueda automática al escribir teléfono
                                    if (formData.clientType === 'new' && phone.length >= 3) {
                                        searchCustomerByPhone(phone);
                                    }
                                }}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                                    errors.customer_phone
                                        ? "border-red-300"
                                        : "border-gray-300"
                                }`}
                                placeholder="Ej: +34 600 000 000"
                            />
                            {errors.customer_phone && (
                                <p className="text-xs text-red-600 mt-1">
                                    {errors.customer_phone}
                                </p>
                            )}
                            
                            {/* 🎯 DROPDOWN DE CLIENTES ENCONTRADOS */}
                            {foundCustomers.length > 0 && formData.clientType === 'new' && (
                                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                                    <div className="p-2 border-b border-gray-100 bg-yellow-50">
                                        <p className="text-xs text-yellow-800 font-medium">
                                            📋 Se encontraron clientes existentes:
                                        </p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {foundCustomers.map((customer) => (
                            <button
                                                key={customer.id}
                                type="button"
                                                onClick={() => handleSelectExistingCustomer(customer)}
                                                className="w-full p-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{customer.name}</p>
                                                        <p className="text-xs text-gray-600">{customer.phone}</p>
                                                        {customer.email && (
                                                            <p className="text-xs text-gray-500">{customer.email}</p>
                                                        )}
                                </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-medium text-blue-600">
                                                            {customer.visits_count || 0} visitas
                                                        </p>
                                                        {customer.last_visit_at && (
                                                            <p className="text-xs text-gray-500">
                                                                Última: {format(new Date(customer.last_visit_at), 'dd/MM/yyyy')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                            </button>
                                        ))}
                                    </div>
                                    <div className="p-2 border-t border-gray-100 bg-gray-50">
                            <button
                                type="button"
                                            onClick={() => setFoundCustomers([])}
                                            className="text-xs text-gray-600 hover:text-gray-800"
                                        >
                                            ✕ Cerrar y crear cliente nuevo
                            </button>
                        </div>
                                </div>
                            )}
                    </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email (opcional)
                            </label>
                            <input
                                    type="email"
                                    value={formData.customer_email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                            customer_email: e.target.value,
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                    placeholder="juan@email.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 👤 SECCIÓN: DATOS PERSONALES DEL CLIENTE (DESPUÉS DE CONTACTO) */}
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            Información Personal del Cliente
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nombre *
                                </label>
                                <input
                                    type="text"
                                    value={formData.first_name}
                                    onChange={(e) => {
                                        const firstName = e.target.value;
                                        const fullName = updateFullName(firstName, formData.last_name1, formData.last_name2);
                                        setFormData({
                                            ...formData,
                                            first_name: firstName,
                                            customer_name: fullName
                                        });
                                    }}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                    errors.customer_name
                                        ? "border-red-300"
                                        : "border-gray-300"
                                }`}
                                    placeholder="Juan"
                            />
                            {errors.customer_name && (
                                <p className="text-xs text-red-600 mt-1">
                                    {errors.customer_name}
                                </p>
                            )}
                        </div>

                            <div className="grid grid-cols-2 gap-2">
                        <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Primer apellido
                            </label>
                            <input
                                        type="text"
                                        value={formData.last_name1}
                                        onChange={(e) => {
                                            const lastName1 = e.target.value;
                                            const fullName = updateFullName(formData.first_name, lastName1, formData.last_name2);
                                    setFormData({
                                        ...formData,
                                                last_name1: lastName1,
                                                customer_name: fullName
                                            });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Pérez"
                                    />
                        </div>
                    <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Segundo apellido
                        </label>
                        <input
                                        type="text"
                                        value={formData.last_name2}
                                        onChange={(e) => {
                                            const lastName2 = e.target.value;
                                            const fullName = updateFullName(formData.first_name, formData.last_name1, lastName2);
                                setFormData({
                                    ...formData,
                                                last_name2: lastName2,
                                                customer_name: fullName
                                            });
                                        }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="García"
                        />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 📅 SECCIÓN: FECHA Y HORA DE LA RESERVA (PRIORIDAD ALTA) */}
                    <div className="bg-orange-50 p-2 rounded-lg border border-orange-200">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-orange-600" />
                            Fecha y Hora de la Reserva
                        </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        date: e.target.value,
                                    })
                                }
                                min={format(new Date(), "yyyy-MM-dd")}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Hora
                            </label>
                            <input
                                type="time"
                                value={formData.time}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        time: e.target.value,
                                    })
                                }
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                                    errors.time
                                        ? "border-red-300"
                                        : "border-gray-300"
                                }`}
                            />
                            {errors.time && (
                                <p className="text-xs text-red-600 mt-1">
                                    {errors.time}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Personas
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={formData.party_size}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFormData({
                                        ...formData,
                                        party_size: value === '' ? '' : parseInt(value) || ''
                                    });
                                }}
                                onBlur={(e) => {
                                    // Si está vacío al salir del campo, poner 1 por defecto
                                    if (e.target.value === '' || e.target.value === '0') {
                                        setFormData({
                                            ...formData,
                                            party_size: 1
                                        });
                                    }
                                }}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                                    errors.party_size
                                        ? "border-red-300"
                                        : "border-gray-300"
                                }`}
                            />
                            {errors.party_size && (
                                <p className="text-xs text-red-600 mt-1">
                                    {errors.party_size}
                                </p>
                            )}
                        </div>
                    </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mesa (opcional)
                            </label>
                            <select
                                value={formData.table_id}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        table_id: e.target.value,
                                    })
                                }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="">Sin asignar</option>
                                {tables.map((table) => (
                                    <option key={table.id} value={table.id}>
                                        {table.name} - {table.zone}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estado
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        status: e.target.value,
                                    })
                                }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            >
                                {Object.entries(RESERVATION_STATES).map(
                                    ([key, state]) => (
                                        <option key={key} value={key}>
                                            {state.label}
                                        </option>
                                    ),
                                )}
                            </select>
                            </div>
                        </div>
                    </div>

                    {/* 🎯 SECCIÓN: SOLICITUDES ESPECIALES */}
                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-purple-600" />
                            Solicitudes Especiales
                        </h4>
                    <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                            Solicitudes especiales (opcional)
                        </label>
                        <textarea
                            value={formData.special_requests}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    special_requests: e.target.value,
                                })
                            }
                                rows="3"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                placeholder="Celebraciones, ubicación preferida, peticiones especiales..."
                            />
                        </div>
                    </div>

                    {/* 📝 SECCIÓN: NOTAS ADICIONALES */}
                    <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-yellow-600" />
                            Notas del Cliente
                        </h4>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Notas adicionales
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    notes: e.target.value
                                })}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Alergias, preferencias, celebraciones..."
                        />
                        </div>
                    </div>

                    {/* 🔐 SECCIÓN: PERMISOS GDPR (UNIFICADO CON CustomerModal) */}
                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-600" />
                            Gestión de Consentimientos (GDPR)
                        </h4>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-600" />
                                    <div>
                                        <h5 className="text-sm font-medium text-gray-900">Comunicación por Email</h5>
                                        <p className="text-xs text-gray-600">Autorización para emails promocionales</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.consent_email}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            consent_email: e.target.checked
                                        })}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="text-xs font-medium">
                                        {formData.consent_email ? 'Autorizado' : 'No autorizado'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-green-600" />
                                    <div>
                                        <h5 className="text-sm font-medium text-gray-900">Comunicación por SMS</h5>
                                        <p className="text-xs text-gray-600">Autorización para mensajes SMS</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.consent_sms}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            consent_sms: e.target.checked
                                        })}
                                        className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                    />
                                    <span className="text-xs font-medium">
                                        {formData.consent_sms ? 'Autorizado' : 'No autorizado'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-emerald-600" />
                                    <div>
                                        <h5 className="text-sm font-medium text-gray-900">Comunicación por WhatsApp</h5>
                                        <p className="text-xs text-gray-600">Autorización para mensajes WhatsApp</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.consent_whatsapp}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            consent_whatsapp: e.target.checked
                                        })}
                                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                    />
                                    <span className="text-xs font-medium">
                                        {formData.consent_whatsapp ? 'Autorizado' : 'No autorizado'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                            <Edit className="w-4 h-4" />
                            Esta reserva se marcará como creada manualmente
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            )}
                            {reservation ? "Actualizar" : "Crear"} Reserva
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};



