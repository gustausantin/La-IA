
// Mesas.jsx - Sistema COMPLETO de Gestión de Mesas con Agente IA para Son-IA

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";
import {
    Grid3X3,
    List,
    Plus,
    Search,
    Filter,
    MapPin,
    Edit,
    Trash2,
    Eye,
    Users,
    Clock,
    Bot,
    Target,
    Brain,
    Sparkles,
    TrendingUp,
    AlertTriangle,
    BarChart3,
    RefreshCw,
    Activity,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Info,
    Calendar,
    Coffee,
    Wine,
    DollarSign,
    Shield,
    Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import ConflictDetectionService from '../services/ConflictDetectionService';
import ConflictWarning from '../components/ConflictWarning';
import { useAvailabilityChangeDetection } from '../hooks/useAvailabilityChangeDetection';
import { useRegenerationModal } from '../hooks/useRegenerationModal';
import RegenerationRequiredModal from '../components/RegenerationRequiredModal';

// DATOS NECESARIOS DE SUPABASE:
// - tabla: tables (id, business_id, table_number, name, zone, min_capacity, max_capacity, status, notes)
// - tabla: reservations (con campos 'source' y 'channel' para identificar origen)
// - tabla: agent_table_preferences (table_id, score, reason, updated_at)
// - RPC: get_table_statistics(table_id, date_range)
// - RPC: get_agent_table_insights(business_id)
// - real-time: suscripción a cambios en tables y reservations

// ✅ Estados de mesa SIMPLIFICADOS (solo activa/inactiva)
const TABLE_STATES = {
    available: {
        label: "Activa",
        icon: "✅",
        color: "border-green-400",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
    },
    inactive: {
        label: "Inactiva",
        icon: "❌",
        color: "border-gray-400",
        bgColor: "bg-gray-50",
        textColor: "text-gray-700",
    },
};

// Componente de estadísticas del agente
const AgentInsightsPanel = ({ stats, suggestions }) => {
    return (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Optimización IA de Mesas
                </h3>
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                    Agente Activo
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div>
                    <p className="text-lg font-bold">
                        {stats.agentAssignments || 0}
                    </p>
                    <p className="text-sm text-purple-100">Asignaciones hoy</p>
                </div>
                <div>
                    <p className="text-lg font-bold">
                        {stats.efficiency || 0}%
                    </p>
                    <p className="text-sm text-purple-100">Eficiencia</p>
                </div>
                <div>
                    <p className="text-lg font-bold">
                        {stats.avgTurnover || "0h"}
                    </p>
                    <p className="text-sm text-purple-100">Rotación promedio</p>
                </div>
                <div>
                    <p className="text-lg font-bold">
                        {stats.optimization || 0}%
                    </p>
                    <p className="text-sm text-purple-100">
                        Optimización espacial
                    </p>
                </div>
            </div>

            {suggestions && suggestions.length > 0 && (
                <div className="mt-4 p-2 bg-white/10 rounded-lg">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Sugerencias actuales
                    </p>
                    <ul className="space-y-1 text-sm">
                        {suggestions.slice(0, 3).map((sug, idx) => (
                            <li key={idx} className="text-purple-100">
                                • {sug.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// Badge de sugerencia del agente
const AgentSuggestionBadge = ({ suggestion }) => {
    if (!suggestion) return null;

    const getBadgeColor = (score) => {
        if (score >= 90) return "bg-purple-100 text-purple-700";
        if (score >= 70) return "bg-blue-100 text-blue-700";
        if (score >= 50) return "bg-yellow-100 text-yellow-700";
        return "bg-gray-100 text-gray-700";
    };

    return (
        <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${getBadgeColor(
                suggestion.score,
            )}`}
        >
            <Bot className="w-3 h-3" />
            <span>{suggestion.score}%</span>
        </div>
    );
};

// Componente de tarjeta de mesa visual mejorado
// ✅ TableCard SIMPLIFICADO (sin reservas ni agente)
const TableCard = ({
    table,
    onAction,
    viewMode = "grid",
}) => {
    const [showActions, setShowActions] = useState(false);

    // ✅ Determinar el estado de la mesa SIMPLIFICADO
    const getTableStatus = () => {
        const isActive = table.is_active !== false;
        return isActive ? "available" : "inactive";
    };

    const status = getTableStatus();
    const stateInfo = TABLE_STATES[status];

    const formatTime = (timeString) => {
        return timeString ? timeString.slice(0, 5) : "";
    };

    // ✅ Ya no se muestra info del agente (sin reservas)

    if (viewMode === "list") {
        return (
            <div
                className={`bg-white border rounded-xl p-2 shadow-sm hover:shadow-md transition-all duration-200 ${stateInfo.color}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-12 h-12 ${stateInfo.bgColor} rounded-lg flex items-center justify-center text-lg border`}
                        >
                            {stateInfo.icon}
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">
                                    {table.name} ({table.table_number})
                                </h4>
                            </div>
                            <p className="text-sm text-gray-600 capitalize">
                                {table.zone} • {table.capacity} personas
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${stateInfo.bgColor} ${stateInfo.textColor}`}
                        >
                            {stateInfo.label}
                        </span>

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
                                            onAction("edit", table);
                                            setShowActions(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Editar mesa
                                    </button>

                                    <button
                                        onClick={() => {
                                            onAction("viewStats", table);
                                            setShowActions(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-purple-600"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        Ver estadísticas
                                    </button>

                                    {reservation && (
                                        <button
                                            onClick={() => {
                                                onAction(
                                                    "viewReservation",
                                                    reservation,
                                                );
                                                setShowActions(false);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Ver reserva
                                        </button>
                                    )}

                                    <hr className="my-1" />

                                    <button
                                        onClick={() => {
                                            onAction("delete", table);
                                            setShowActions(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ✅ Vista de grid SIMPLIFICADA (tarjetas compactas)
    return (
        <div
            className={`relative bg-white border-2 rounded-lg p-1.5 transition-all duration-200 hover:shadow-lg cursor-pointer ${stateInfo.color}`}
            onClick={() => onAction("edit", table)}
        >

            <div className="flex flex-col items-center justify-center space-y-1">
                <div
                    className={`w-10 h-10 ${stateInfo.bgColor} rounded-full flex items-center justify-center text-base`}
                >
                    {stateInfo.icon}
                </div>

                <div className="text-center">
                    <h4 className="font-bold text-xs text-gray-900">{table.name}</h4>
                    <p className="text-[10px] text-gray-600 capitalize">{table.zone}</p>
                    <p className="text-[10px] text-gray-500">
                        {table.capacity} pax
                    </p>
                </div>

                <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${stateInfo.bgColor} ${stateInfo.textColor}`}
                >
                    {stateInfo.label}
                </span>
            </div>

            {/* Botón de acciones */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowActions(!showActions);
                }}
                className="absolute top-1 right-1 p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
                <MoreVertical className="w-3 h-3 text-gray-600" />
            </button>

            {showActions && (
                <div className="absolute right-2 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction("edit", table);
                            setShowActions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-xs text-gray-700"
                    >
                        <Edit className="w-3 h-3" />
                        Editar
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction("viewStats", table);
                            setShowActions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-xs text-purple-600"
                    >
                        <BarChart3 className="w-3 h-3" />
                        Stats
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction("delete", table);
                            setShowActions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-xs text-red-600"
                    >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                    </button>
                </div>
            )}
        </div>
    );
};

// Componente principal
export default function Mesas() {
    const { business: restaurant, businessId: businessId, isReady, addNotification, user, fetchBusinessInfo: fetchRestaurantInfo } =
        useAuthContext();
    const changeDetection = useAvailabilityChangeDetection(businessId);
    const { isModalOpen, modalChangeReason, modalChangeDetails, showRegenerationModal, closeModal } = useRegenerationModal();

    // Estados principales
    const [activeTab, setActiveTab] = useState("mesas"); // 'zonas' | 'mesas'
    const [loading, setLoading] = useState(true);
    const [tables, setTables] = useState([]);
    const [zones, setZones] = useState([]);
    const [agentStats, setAgentStats] = useState({
        agentAssignments: 0,
        efficiency: 0,
        avgTurnover: "0h",
        optimization: 0,
    });
    const [agentSuggestions, setAgentSuggestions] = useState([]);
    const [tablePreferences, setTablePreferences] = useState({});

    // Estados de filtros y vista
    const [selectedZone, setSelectedZone] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
    const [showAgentView, setShowAgentView] = useState(false);
    
    // Estados para gestión de zonas
    const [zonesConfig, setZonesConfig] = useState({
        zones: {
            interior: { enabled: false },
            terraza: { enabled: false },
            barra: { enabled: false },
            privado: { enabled: false }
        },
        default_zone: 'interior'
    });
    const [savingZones, setSavingZones] = useState(false);

    // Estados de modales
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReservationModal, setShowReservationModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [selectedReservation, setSelectedReservation] = useState(null);
    
    // Estados de conflictos
    const [conflictData, setConflictData] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);

    // Subscription de real-time
    const [realtimeSubscription, setRealtimeSubscription] = useState(null);

    // Función para refrescar datos
    const handleRefresh = useCallback(async () => {
        setLoading(true);
        await loadTables();
        toast.success("Datos de mesas actualizados");
    }, []);

    // Función para cargar mesas
    const loadTables = useCallback(async () => {
        if (!businessId) return;

        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('resources')
                .select("*")
                .eq("business_id", businessId)
                .order("zone")
                .order("table_number");

            if (error) throw error;

            setTables(data || []);

            // Extraer zonas únicas
            const uniqueZones = [
                ...new Set((data || []).map((table) => table.zone)),
            ].filter(Boolean);
            setZones(uniqueZones);
        } catch (error) {
            toast.error("Error al cargar las mesas");
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    // ✅ Función eliminada: loadTodayReservations
    // La página Mesas es SOLO para configuración, no muestra reservas

    // ✅ Función simplificada: Solo estadísticas básicas de mesas
    // NO se muestran reservas ni métricas del agente
    const loadTableStats = useCallback(async () => {
        if (!businessId) return;

        try {
            // Estadísticas simples de mesas
            const activeTables = tables.filter(t => t.is_active !== false).length;
            const inactiveTables = tables.filter(t => t.is_active === false).length;
            
            // Agrupar por zona
            const zoneStats = {};
            tables.forEach(table => {
                const zone = table.zone || 'Sin zona';
                if (!zoneStats[zone]) {
                    zoneStats[zone] = { active: 0, inactive: 0, totalCapacity: 0 };
                }
                if (table.is_active !== false) {
                    zoneStats[zone].active++;
                    zoneStats[zone].totalCapacity += table.capacity || 0;
                } else {
                    zoneStats[zone].inactive++;
                }
            });

            // Actualizar stats básicos
            setAgentStats({
                agentAssignments: 0, // Ya no aplica
                efficiency: activeTables > 0 ? Math.round((activeTables / (activeTables + inactiveTables)) * 100) : 0,
                avgTurnover: "N/A", // Ya no aplica
                optimization: activeTables > 0 ? 100 : 0
            });
            
            // Limpiar sugerencias del agente (ya no se usan)
            setAgentSuggestions([]);
            setTablePreferences({});
            
        } catch (error) {
            console.error("Error calculating table stats:", error);
        }
    }, [businessId, tables]);

    // Configurar real-time subscriptions
    useEffect(() => {
        if (!businessId) return;

        // ✅ Suscribirse SOLO a cambios en tables (no reservations)
        const subscription = supabase
            .channel("tables-changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tables",
                    filter: `business_id=eq.${businessId}`,
                },
                (payload) => {
                    loadTables();
                },
            )
            .subscribe();

        setRealtimeSubscription(subscription);

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [businessId, addNotification]); // SIN funciones de carga en dependencies

    // Cargar datos inicial - SIN DEPENDENCY LOOPS
    useEffect(() => {
        if (isReady && businessId) {
            setLoading(true);
            loadTables().finally(() => setLoading(false));
        }
    }, [isReady, businessId]); // SOLO dependencies estables
    
    // Cargar configuración de zonas desde restaurant.settings
    useEffect(() => {
        const loadZonesConfig = async () => {
            if (!restaurant || !restaurant.settings) return;
            
            const settings = restaurant.settings;
            if (settings.zones) {
                setZonesConfig({
                    zones: settings.zones,
                    default_zone: settings.default_zone || 'interior'
                });
            }
        };
        
        loadZonesConfig();
    }, [restaurant]);

    // Recalcular métricas del agente cuando cambien datos
    // ✅ Efecto eliminado: Ya no se calculan métricas del agente basadas en reservas
    useEffect(() => {
        if (tables.length > 0) {
            loadTableStats();
        }
    }, [tables, loadTableStats]);

    // ✅ Función eliminada: getTableReservation
    // Ya no se muestran reservas en la página Mesas

    // Filtrar mesas
    const filteredTables = useMemo(() => {
        let filtered = tables;

        // Filtro por zona
        if (selectedZone !== "all") {
            filtered = filtered.filter((table) => table.zone === selectedZone);
        }

        // ✅ Filtro por estado SIMPLIFICADO (solo active/inactive)
                if (selectedStatus !== "all") {
                    filtered = filtered.filter((table) => {
                        const isActive = table.is_active !== false;

                        if (selectedStatus === "available") {
                    return isActive;
                        }
                        if (selectedStatus === "inactive") {
                            return !isActive;
                        }

                        return true;
                    });
                }

        // Filtro por búsqueda
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (table) =>
                    table.name.toLowerCase().includes(term) ||
                    table.table_number.toLowerCase().includes(term) ||
                    table.zone.toLowerCase().includes(term),
            );
        }

        // Si está activada la vista del agente, ordenar por preferencia
        if (showAgentView) {
            filtered = filtered.sort((a, b) => {
                const prefA = tablePreferences[a.id]?.score || 0;
                const prefB = tablePreferences[b.id]?.score || 0;
                return prefB - prefA;
            });
        }

        return filtered;
    }, [
        tables,
        selectedZone,
        selectedStatus,
        searchTerm,
        showAgentView,
        tablePreferences,
    ]);

    // Agrupar mesas por zona para vista de grid
    const tablesByZone = useMemo(() => {
        const grouped = {};

        filteredTables.forEach((table) => {
            const zone = table.zone || "Sin zona";
            if (!grouped[zone]) {
                grouped[zone] = [];
            }
            grouped[zone].push(table);
        });

        return grouped;
    }, [filteredTables]);

    // ✅ Estadísticas SIMPLIFICADAS (solo total, activas, inactivas)
    const stats = useMemo(() => {
        const total = tables.length;
        
        // Activas: mesas que están operativas (no inactivas)
        const active = tables.filter((t) => 
            t.is_active !== false
        ).length;
        
        // Inactivas
        const inactive = total - active;

        return { total, active, available: active, reserved: 0, occupied: 0, inactive };
    }, [tables]);

    // Funciones de acciones
    const handleTableAction = useCallback((action, data) => {
        switch (action) {
            case "edit":
                setSelectedTable(data);
                setShowEditModal(true);
                break;
            case "delete":
                handleDeleteTableWithValidation(data);
                break;
            case "viewReservation":
                setSelectedReservation(data);
                setShowReservationModal(true);
                break;
            case "viewStats":
                setSelectedTable(data);
                setShowStatsModal(true);
                break;
            default:
                break;
        }
    }, []);

    // Función para validar eliminación de mesa
    const handleDeleteTableWithValidation = useCallback(async (table) => {
        try {
            // Detectar conflictos antes de eliminar
            const conflicts = await ConflictDetectionService.detectTableConflicts(
                businessId,
                table.id,
                'DELETE'
            );
            
            if (conflicts.hasConflicts) {
                // Mostrar modal de conflictos
                setConflictData(conflicts);
                setPendingAction({
                    type: 'DELETE_TABLE',
                    data: table
                });
            } else {
                // No hay conflictos, eliminar directamente
                if (window.confirm(`¿Estás seguro de que quieres eliminar la mesa "${table.name}"?`)) {
                    await deleteTable(table.id);
                }
            }
        } catch (error) {
            console.error('Error validando eliminación de mesa:', error);
            toast.error('Error al validar la eliminación');
        }
    }, [businessId]);

    // Función para eliminar mesa (sin validación)
    const deleteTable = useCallback(
        async (tableId) => {
            try {
                const { error } = await supabase
                    .from('resources')
                    .delete()
                    .eq("id", tableId);

                if (error) throw error;

                // Guardar referencia ANTES de actualizar
                const deletedTable = tables.find(t => t.id === tableId);
                const tableName = deletedTable?.name || 'Mesa';
                
                toast.success("Mesa eliminada correctamente");
                if (addNotification) {
                    addNotification({
                        type: "system",
                        message: "Mesa eliminada del sistema",
                        priority: "low",
                    });
                }

                loadTables();
                
                // 🚨 VERIFICAR SLOTS Y MOSTRAR MODAL
                console.log('🔍 Verificando slots después de eliminar mesa...');
                const slotsExist = await changeDetection.checkExistingSlots();
                console.log('🔍 ¿Existen slots?', slotsExist);
                
                if (slotsExist) {
                    console.log('🚨 HAY SLOTS - Guardando estado y mostrando modal...');
                    
                    // 🎯 GUARDAR ESTADO EN LOCALSTORAGE (igual que Calendario)
                    await changeDetection.onTableChange('removed', {
                        id: tableId,
                        name: tableName
                    });
                    
                    // Mostrar modal
                    setTimeout(() => {
                        showRegenerationModal('table_deleted', `Mesa "${tableName}" eliminada`);
                    }, 500);
                } else {
                    console.log('✅ No hay slots - No se muestra modal');
                }
            } catch (error) {
                toast.error("Error al eliminar la mesa");
            }
        },
        [loadTables, addNotification, tables, changeDetection, showRegenerationModal],
    );

    // Función para confirmar acción con conflictos
    const handleConfirmWithConflicts = useCallback(async () => {
        if (!pendingAction) return;
        
        try {
            switch (pendingAction.type) {
                case 'DELETE_TABLE':
                    await deleteTable(pendingAction.data.id);
                    toast.warning('⚠️ Mesa eliminada a pesar de tener reservas. Contacta a los clientes afectados.');
                    break;
            }
        } catch (error) {
            toast.error('Error ejecutando la acción');
        } finally {
            setConflictData(null);
            setPendingAction(null);
        }
    }, [pendingAction, deleteTable]);

    // Función para cancelar acción con conflictos
    const handleCancelConflictAction = useCallback(() => {
        setConflictData(null);
        setPendingAction(null);
    }, []);

    if (!isReady) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="max-w-[85%] mx-auto space-y-6">
            {/* Header mejorado con estadísticas */}
            {/* Header con estadísticas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2">
                    <div>
                        <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            Zonas y Mesas
                            <Bot className="w-4 h-4 text-purple-600" />
                        </h1>
                        <p className="text-xs text-gray-600 mt-0.5">
                            {stats.total} mesas • {stats.active} activas •{" "}
                            {stats.available} disponibles
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    await loadTables();
                                    
                                    // ✅ RECARGAR RESTAURANT DEL CONTEXTO TAMBIÉN
                                    if (user?.id) {
                                        await fetchRestaurantInfo(user.id, true);
                                    }
                                    
                                    toast.success("✅ Datos actualizados");
                                } catch (error) {
                                    console.error("Error al actualizar:", error);
                                    toast.error("Error al actualizar datos");
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-medium text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>

                        {/* Botón Nueva Mesa - SOLO EN TAB MESAS */}
                        {activeTab === "mesas" && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 shadow-md font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Mesa
                        </button>
                        )}
                    </div>
                </div>

                {/* ✅ Estadísticas de CONFIGURACIÓN (Simplificadas) */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                    {/* Total de Mesas */}
                    <div className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">
                                    {stats.total}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Total
                                </p>
                            </div>
                            <Grid3X3 className="w-8 h-8 text-gray-500" />
                        </div>
                    </div>

                    {/* Mesas Activas */}
                    <div className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">
                                    {stats.active}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Activas
                                </p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                    </div>

                    {/* Mesas Inactivas */}
                    <div className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">
                                    {stats.inactive}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Inactivas
                                </p>
                            </div>
                            <XCircle className="w-8 h-8 text-gray-400" />
                        </div>
                    </div>

                    {/* Capacidad Total */}
                    <div className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">
                                    {tables.filter(t => t.is_active !== false).reduce((sum, t) => sum + (t.capacity || 0), 0)}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Capacidad
                                </p>
                            </div>
                            <Users className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>

                    {/* Zonas Configuradas */}
                    <div className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">
                                    {Object.keys(tablesByZone).length}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Zonas
                                </p>
                            </div>
                            <MapPin className="w-8 h-8 text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs: Zonas y Mesas - Estilo homogéneo compacto */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setActiveTab("zonas")}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm ${
                            activeTab === "zonas"
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300"
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Zonas
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("mesas")}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm ${
                            activeTab === "mesas"
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300"
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Grid3X3 className="w-4 h-4" />
                            Mesas
                        </span>
                    </button>
                </div>
            </div>


            {/* ============================================ */}
            {/* TAB: ZONAS */}
            {/* ============================================ */}
            {activeTab === "zonas" && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                    <div className="mb-3">
                        <h2 className="text-sm font-semibold text-gray-900 mb-1">
                            🗺️ Configuración de Zonas Disponibles
                        </h2>
                        <p className="text-xs text-gray-600">
                            Activa solo las zonas que tu restaurante ofrece. Estas serán las únicas opciones que el agente de IA ofrecerá a los clientes.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {/* Interior */}
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🏠</span>
                                <div>
                                    <p className="font-medium text-gray-900">Interior</p>
                                    <p className="text-sm text-gray-500">Zona principal del restaurante</p>
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={zonesConfig.zones.interior?.enabled || false}
                                    onChange={(e) => {
                                        const newConfig = {
                                            ...zonesConfig,
                                            zones: {
                                                ...zonesConfig.zones,
                                                interior: {
                                                    ...zonesConfig.zones.interior,
                                                    enabled: e.target.checked,
                                                    display_name: "Interior",
                                                    description: "Zona principal del restaurante",
                                                    icon: "🏠",
                                                    sort_order: 1
                                                }
                                            }
                                        };
                                        setZonesConfig(newConfig);
                                    }}
                                    className="w-5 h-5 text-purple-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Activa</span>
                            </label>
                        </div>

                        {/* Terraza */}
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">☀️</span>
                                <div>
                                    <p className="font-medium text-gray-900">Terraza</p>
                                    <p className="text-sm text-gray-500">Zona al aire libre</p>
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={zonesConfig.zones.terraza?.enabled || false}
                                    onChange={(e) => {
                                        const newConfig = {
                                            ...zonesConfig,
                                            zones: {
                                                ...zonesConfig.zones,
                                                terraza: {
                                                    ...zonesConfig.zones.terraza,
                                                    enabled: e.target.checked,
                                                    display_name: "Terraza",
                                                    description: "Zona al aire libre",
                                                    icon: "☀️",
                                                    sort_order: 2
                                                }
                                            }
                                        };
                                        setZonesConfig(newConfig);
                                    }}
                                    className="w-5 h-5 text-purple-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Activa</span>
                            </label>
                        </div>

                        {/* Barra */}
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🍷</span>
                                <div>
                                    <p className="font-medium text-gray-900">Barra</p>
                                    <p className="text-sm text-gray-500">Mesas en la zona de barra</p>
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={zonesConfig.zones.barra?.enabled || false}
                                    onChange={(e) => {
                                        const newConfig = {
                                            ...zonesConfig,
                                            zones: {
                                                ...zonesConfig.zones,
                                                barra: {
                                                    ...zonesConfig.zones.barra,
                                                    enabled: e.target.checked,
                                                    display_name: "Barra",
                                                    description: "Mesas en la zona de barra",
                                                    icon: "🍷",
                                                    sort_order: 3
                                                }
                                            }
                                        };
                                        setZonesConfig(newConfig);
                                    }}
                                    className="w-5 h-5 text-purple-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Activa</span>
                            </label>
                        </div>

                        {/* Privado */}
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🚪</span>
                                <div>
                                    <p className="font-medium text-gray-900">Sala Privada</p>
                                    <p className="text-sm text-gray-500">Sala privada o reservada</p>
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={zonesConfig.zones.privado?.enabled || false}
                                    onChange={(e) => {
                                        const newConfig = {
                                            ...zonesConfig,
                                            zones: {
                                                ...zonesConfig.zones,
                                                privado: {
                                                    ...zonesConfig.zones.privado,
                                                    enabled: e.target.checked,
                                                    display_name: "Sala Privada",
                                                    description: "Sala privada o reservada",
                                                    icon: "🚪",
                                                    sort_order: 4
                                                }
                                            }
                                        };
                                        setZonesConfig(newConfig);
                                    }}
                                    className="w-5 h-5 text-purple-600 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Activa</span>
                            </label>
                        </div>
                    </div>

                    {/* Botón Guardar */}
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={async () => {
                                setSavingZones(true);
                                try {
                                    const { data: currentRestaurant, error: fetchError } = await supabase
                                        .from("businesses")
                                        .select("settings")
                                        .eq("id", businessId)
                                        .single();

                                    if (fetchError) throw fetchError;

                                    const currentSettings = currentRestaurant?.settings || {};
                                    const updatedSettings = {
                                        ...currentSettings,
                                        zones: zonesConfig.zones,
                                        default_zone: zonesConfig.default_zone
                                    };

                                    const { error: updateError } = await supabase
                                        .from("businesses")
                                        .update({
                                            settings: updatedSettings,
                                            updated_at: new Date().toISOString()
                                        })
                                        .eq("id", businessId);

                                    if (updateError) throw updateError;

                                    // ✅ RECARGAR EL RESTAURANT DEL CONTEXTO
                                    // Esto actualiza el objeto `restaurant` en el contexto global
                                    // para que cuando vuelvas a esta página, el useEffect cargue los datos correctos
                                    if (user?.id) {
                                        await fetchRestaurantInfo(user.id, true); // true = force refresh
                                    }
                                    
                                    toast.success("✅ Configuración de zonas guardada correctamente");
                                } catch (error) {
                                    console.error("Error saving zones:", error);
                                    toast.error("Error al guardar la configuración de zonas");
                                } finally {
                                    setSavingZones(false);
                                }
                            }}
                            disabled={savingZones}
                            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {savingZones && <RefreshCw className="w-4 h-4 animate-spin" />}
                            Guardar Configuración
                        </button>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* TAB: MESAS */}
            {/* ============================================ */}
            {activeTab === "mesas" && (
                <>
            {/* Filtros y controles */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
                <div className="flex flex-col lg:flex-row gap-2">
                    {/* Búsqueda */}
                    <div className="flex-1 relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            size={20}
                        />
                        <input
                            type="text"
                            placeholder="Buscar mesa por nombre, número o zona..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Todas las zonas</option>
                            {zones.map((zone) => (
                                <option key={zone} value={zone}>
                                    {zone}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="available">Activas</option>
                            <option value="inactive">Inactivas</option>
                        </select>

                        {/* Toggle vista */}
                        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`px-2 py-1.5 flex items-center gap-1.5 text-xs ${viewMode === "grid" ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-50"}`}
                            >
                                <Grid3X3 className="w-3.5 h-3.5" />
                                Grid
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`px-2 py-1.5 flex items-center gap-1.5 border-l border-gray-300 text-xs ${viewMode === "list" ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-50"}`}
                            >
                                <List className="w-3.5 h-3.5" />
                                Lista
                            </button>
                        </div>
                    </div>
                </div>

                {/* Leyenda de estados */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200 text-xs">
                    {Object.entries(TABLE_STATES).map(([key, state]) => (
                        <div key={key} className="flex items-center gap-1.5">
                            <span className="text-xs">{state.icon}</span>
                            <span className="text-gray-600 text-xs">{state.label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-gray-600 text-xs">Asignada por IA</span>
                    </div>
                </div>
            </div>

            {/* Vista de mesas */}
            {loading ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="bg-white border border-gray-200 rounded-xl p-2 animate-pulse"
                        >
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                                    </div>
                                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                                </div>
                                <div className="h-16 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : viewMode === "grid" ? (
                <div className="space-y-8">
                    {Object.keys(tablesByZone).length > 0 ? (
                        Object.entries(tablesByZone).map(
                            ([zone, zoneTables]) => (
                                <div key={zone}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <MapPin className="w-5 h-5 text-blue-600" />
                                        <h3 className="text-sm font-semibold text-gray-900 capitalize">
                                            {zone}
                                        </h3>
                                        <span className="text-sm text-gray-500">
                                            ({zoneTables.length} mesas)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                                        {zoneTables.map((table) => (
                                            <TableCard
                                                key={table.id}
                                                table={table}
                                                onAction={handleTableAction}
                                                viewMode="grid"
                                            />
                                        ))}
                                    </div>
                                </div>
                            ),
                        )
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                            <Grid3X3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                No hay mesas
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {searchTerm ||
                                selectedZone !== "all" ||
                                selectedStatus !== "all"
                                    ? "No se encontraron mesas con los filtros aplicados"
                                    : "Comienza creando tu primera mesa"}
                            </p>
                            {!searchTerm &&
                                selectedZone === "all" &&
                                selectedStatus === "all" && (
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Crear primera mesa
                                    </button>
                                )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTables.length > 0 ? (
                        filteredTables.map((table) => (
                            <TableCard
                                key={table.id}
                                table={table}
                                onAction={handleTableAction}
                                viewMode="list"
                            />
                        ))
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                            <List className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                No hay mesas para mostrar
                            </h3>
                            <p className="text-gray-600">
                                Intenta ajustar los filtros o crear una nueva
                                mesa
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de crear/editar mesa */}
            {(showCreateModal || showEditModal) && (
                <TableModal
                    isOpen={showCreateModal || showEditModal}
                    onClose={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        setSelectedTable(null);
                    }}
                    zonesConfig={zonesConfig}
                    onSave={(savedTable) => {
                        // 🚨 MOSTRAR MODAL BLOQUEANTE DE REGENERACIÓN (solo si existen slots)
                        const isNew = !selectedTable;
                        
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        
                        loadTables();
                        
                        // Verificar si existen slots antes de mostrar modal
                        changeDetection.checkExistingSlots().then(slotsExist => {
                            if (slotsExist) {
                                if (isNew) {
                                    changeDetection.onTableChange('added', savedTable || { name: 'Nueva mesa' });
                                    showRegenerationModal('table_created', `Mesa "${savedTable?.name || 'nueva'}" creada`);
                                } else {
                                    // 🔍 DETECTAR QUÉ HA CAMBIADO EXACTAMENTE
                                    const changes = [];
                                    let criticalChange = false;
                                    
                                    if (selectedTable.capacity !== savedTable.capacity) {
                                        changes.push(`Capacidad: ${selectedTable.capacity} → ${savedTable.capacity} personas`);
                                        criticalChange = true;
                                    }
                                    
                                    if (selectedTable.zone !== savedTable.zone) {
                                        changes.push(`Zona: ${selectedTable.zone} → ${savedTable.zone}`);
                                        criticalChange = true;
                                    }
                                    
                                    if (selectedTable.name !== savedTable.name) {
                                        changes.push(`Nombre: ${selectedTable.name} → ${savedTable.name}`);
                                        criticalChange = true; // Nombre también afecta a slots
                                    }
                                    
                                    if (selectedTable.is_active !== savedTable.is_active) {
                                        changes.push(`Estado: ${selectedTable.is_active ? 'Activa' : 'Inactiva'} → ${savedTable.is_active ? 'Activa' : 'Inactiva'}`);
                                        criticalChange = true; // Desactivar/activar afecta disponibilidad
                                    }
                                    
                                    if (criticalChange) {
                                        console.log('🚨 Cambios críticos detectados:', changes);
                                    changeDetection.onTableChange('modified', selectedTable);
                                        showRegenerationModal(
                                            'table_modified', 
                                            `Mesa "${selectedTable?.name}" modificada:\n${changes.join('\n')}`
                                        );
                                    } else {
                                        console.log('ℹ️ Cambios menores (no afectan slots):', changes);
                                    }
                                }
                            } else {
                                console.log('✅ No se muestra aviso: usuario está configurando el sistema por primera vez');
                            }
                        });
                        
                        setSelectedTable(null);
                        
                        toast.success(
                            selectedTable
                                ? "Mesa actualizada correctamente"
                                : "Mesa creada correctamente",
                        );
                        if (addNotification) {
                            addNotification({
                                type: "system",
                                message: selectedTable
                                    ? "Mesa actualizada"
                                    : "Nueva mesa creada",
                                priority: "low",
                            });
                        }
                    }}
                    businessId={businessId}
                    table={selectedTable}
                />
            )}

            {/* Modal de vista de reserva */}
            {showReservationModal && selectedReservation && (
                <ReservationModal
                    isOpen={showReservationModal}
                    onClose={() => {
                        setShowReservationModal(false);
                        setSelectedReservation(null);
                    }}
                    reservation={selectedReservation}
                />
            )}

            {/* Modal de conflictos */}
            {conflictData && (
                <ConflictWarning
                    conflicts={conflictData}
                    onConfirm={handleConfirmWithConflicts}
                    onCancel={handleCancelConflictAction}
                    title="⚠️ No se puede eliminar la mesa"
                    confirmText="Eliminar de todas formas"
                    cancelText="Cancelar eliminación"
                />
            )}

            {/* Modal de estadísticas de mesa */}
            {showStatsModal && selectedTable && (
                <TableStatsModal
                    isOpen={showStatsModal}
                    onClose={() => {
                        setShowStatsModal(false);
                        setSelectedTable(null);
                    }}
                    table={selectedTable}
                    businessId={businessId}
                />
            )}

            {/* 🚨 MODAL BLOQUEANTE DE REGENERACIÓN */}
            <RegenerationRequiredModal
                isOpen={isModalOpen}
                onClose={closeModal}
                changeReason={modalChangeReason}
                changeDetails={modalChangeDetails}
            />
                </>
            )}
        </div>
    );
}

// Componente modal para crear/editar mesas
const TableModal = ({
    isOpen,
    onClose,
    onSave,
    businessId,
    table = null,
    zonesConfig = { zones: {}, default_zone: 'interior' }, // ✅ AÑADIDO
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        table_number: table?.table_number || "",
        name: table?.name || "",
        zone: table?.zone || "",
        capacity: table?.capacity || 4,
        status: table ? (table.is_active === false ? "inactive" : "available") : "available",
        notes: table?.notes || "",
    });

    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!formData.table_number.trim()) {
            newErrors.table_number = "El número de mesa es obligatorio";
        }

        if (!formData.name.trim()) {
            newErrors.name = "El nombre de la mesa es obligatorio";
        }

        if (!formData.zone.trim()) {
            newErrors.zone = "La zona es obligatoria";
        } else {
            // ✅ VALIDAR QUE LA ZONA ESTÉ ACTIVA
            const zoneKey = formData.zone;
            const isZoneActive = zonesConfig.zones[zoneKey]?.enabled;
            
            if (!isZoneActive) {
                newErrors.zone = `⚠️ La zona "${formData.zone}" no está activa. Actívala en la pestaña Zonas primero.`;
            }
        }

        if (!formData.capacity || formData.capacity < 1) {
            newErrors.capacity = "La capacidad debe ser al menos 1";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);

        try {
            // 🔍 VALIDACIÓN CAPACIDAD MÁXIMA (COHERENCIA CON CONFIGURACIÓN)
            if (!table) { // Solo validar al crear nueva mesa
                // Obtener capacidad máxima configurada
                const { data: restaurantData } = await supabase
                    .from("businesses")
                    .select("settings")
                    .eq("id", businessId)
                    .single();
                
                const maxCapacity = restaurantData?.settings?.capacity_total || 0;
                
                if (maxCapacity > 0) {
                    // Calcular capacidad actual de todas las mesas
                    const { data: existingTables } = await supabase
                        .from('resources')
                        .select("capacity")
                        .eq("business_id", businessId)
                        .eq("is_active", true);
                    
                    const currentCapacity = existingTables?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0;
                    const newCapacity = currentCapacity + parseInt(formData.capacity);
                    
                    if (newCapacity > maxCapacity) {
                        throw new Error(`⚠️ Capacidad máxima excedida: ${newCapacity}/${maxCapacity} comensales. Ajusta la capacidad máxima en Configuración → General o reduce la capacidad de esta mesa.`);
                    }
                    
                    // Mostrar advertencia si está cerca del límite
                    if (newCapacity > maxCapacity * 0.9) {
                        toast(`⚠️ Cerca del límite: ${newCapacity}/${maxCapacity} comensales`, {
                            icon: "🚨",
                            duration: 4000
                        });
                    }
                }
            }

            // 🛡️ VALIDACIÓN: PROTEGER RESERVAS AL CAMBIAR CAPACIDAD
            if (table && parseInt(formData.capacity) < table.capacity) {
                // Si está reduciendo la capacidad, verificar reservas activas
                console.log('🔍 Verificando reservas activas antes de reducir capacidad...');
                
                const { data: activeReservations, error: reservationsError } = await supabase
                    .from('appointments')
                    .select('id, customer_name, reservation_date, reservation_time, party_size')
                    .eq('table_id', table.id)
                    .gte('reservation_date', new Date().toISOString().split('T')[0])
                    .in('status', ['pending', 'confirmed', 'pendiente', 'confirmada', 'seated'])
                    .gt('party_size', parseInt(formData.capacity)); // Reservas con más personas que la nueva capacidad
                
                if (reservationsError) {
                    console.error('Error verificando reservas:', reservationsError);
                    throw new Error('Error al verificar reservas activas');
                }
                
                if (activeReservations && activeReservations.length > 0) {
                    console.log('🚨 Reservas activas encontradas:', activeReservations);
                    
                    // Construir mensaje detallado
                    const reservasList = activeReservations.map(r => 
                        `• ${r.customer_name} - ${r.party_size} personas (${new Date(r.reservation_date).toLocaleDateString('es-ES')} ${r.reservation_time})`
                    ).join('\n');
                    
                    throw new Error(
                        `⚠️ NO PUEDES REDUCIR LA CAPACIDAD\n\n` +
                        `Esta mesa tiene ${activeReservations.length} reserva(s) activa(s) con más personas que la nueva capacidad:\n\n` +
                        `${reservasList}\n\n` +
                        `🔒 Las reservas están protegidas. Opciones:\n` +
                        `1. Cancela o modifica estas reservas primero\n` +
                        `2. Mantén la capacidad actual (${table.capacity} personas)\n` +
                        `3. Aumenta la capacidad en lugar de reducirla`
                    );
                }
                
                console.log('✅ No hay conflictos con reservas activas');
            }

            const tableData = {
                table_number: formData.table_number,
                name: formData.name,
                zone: formData.zone,
                capacity: parseInt(formData.capacity),
                notes: formData.notes,
                business_id: businessId,
                is_active: formData.status !== "inactive",
                status: "available",
            };

            if (table) {
                // Actualizar
                const { error } = await supabase
                    .from('resources')
                    .update(tableData)
                    .eq("id", table.id);

                if (error) throw error;
                
                console.log('✅ Mesa actualizada correctamente');
                
                // Pasar los datos actualizados al callback
                onSave({
                    ...table,
                    ...tableData
                });
            } else {
                // Crear
                const { error } = await supabase
                    .from('resources')
                    .insert([tableData]);

                if (error) throw error;
                
                // Pasar los nuevos datos al callback
                onSave(tableData);
            }

            // Toast movido al componente principal para evitar duplicados
        } catch (error) {
            console.error("Error saving table:", error);
            toast.error(`Error al guardar la mesa: ${error.message || error.hint || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900">
                        {table ? "Editar Mesa" : "Nueva Mesa"}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Número de Mesa
                            </label>
                            <input
                                type="text"
                                value={formData.table_number}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        table_number: e.target.value,
                                    })
                                }
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                    errors.table_number
                                        ? "border-red-300"
                                        : "border-gray-300"
                                }`}
                                placeholder="T1, M01, etc."
                            />
                            {errors.table_number && (
                                <p className="text-xs text-red-600 mt-1">
                                    {errors.table_number}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        name: e.target.value,
                                    })
                                }
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                    errors.name
                                        ? "border-red-300"
                                        : "border-gray-300"
                                }`}
                                placeholder="Mesa 1, Terraza 2, etc."
                            />
                            {errors.name && (
                                <p className="text-xs text-red-600 mt-1">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Zona
                        </label>
                        <select
                            value={formData.zone}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    zone: e.target.value,
                                })
                            }
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                errors.zone
                                    ? "border-red-300"
                                    : "border-gray-300"
                            }`}
                        >
                            <option value="">Seleccionar zona...</option>
                            {/* ✅ SOLO MOSTRAR ZONAS ACTIVAS */}
                            {zonesConfig.zones.interior?.enabled && (
                                <option value="interior">🏠 Interior</option>
                            )}
                            {zonesConfig.zones.terraza?.enabled && (
                                <option value="terraza">☀️ Terraza</option>
                            )}
                            {zonesConfig.zones.barra?.enabled && (
                                <option value="barra">🍷 Barra</option>
                            )}
                            {zonesConfig.zones.privado?.enabled && (
                                <option value="privado">🚪 Privado</option>
                            )}
                        </select>
                        {errors.zone && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.zone}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Capacidad (personas)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={formData.capacity}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Permitir campo vacío mientras escribe
                                setFormData({
                                    ...formData,
                                    capacity: value === '' ? '' : parseInt(value)
                                });
                            }}
                            onBlur={(e) => {
                                // Si está vacío al salir del campo, poner 1 por defecto
                                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                                    setFormData({
                                        ...formData,
                                        capacity: 1
                                    });
                                }
                            }}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                errors.capacity
                                    ? "border-red-300"
                                    : "border-gray-300"
                            }`}
                            placeholder="Ej: 4"
                        />
                        {errors.capacity && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.capacity}
                            </p>
                        )}
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="available">Activa</option>
                            <option value="inactive">Inactiva</option>

                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas (opcional)
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    notes: e.target.value,
                                })
                            }
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Información adicional sobre la mesa..."
                        />
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
                            {table ? "Actualizar" : "Crear"} Mesa
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Componente modal para ver reserva
const ReservationModal = ({ isOpen, onClose, reservation }) => {
    if (!isOpen || !reservation) return null;

    const formatTime = (timeString) => {
        return timeString ? timeString.slice(0, 5) : "";
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        Detalles de la Reserva
                        {reservation.source === "agent" && (
                            <Bot className="w-5 h-5 text-purple-600" />
                        )}
                    </h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className="text-sm text-gray-600">Cliente</p>
                            <p className="font-medium text-gray-900">
                                {reservation.customer_name}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Teléfono</p>
                            <p className="font-medium text-gray-900">
                                {reservation.customer_phone}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Fecha</p>
                            <p className="font-medium text-gray-900">
                                {format(
                                    new Date(reservation.date),
                                    "dd/MM/yyyy",
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Hora</p>
                            <p className="font-medium text-gray-900">
                                {formatTime(reservation.time)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Personas</p>
                            <p className="font-medium text-gray-900">
                                {reservation.party_size}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Estado</p>
                            <p className="font-medium text-gray-900">
                                {reservation.status === "confirmed"
                                    ? "Confirmada"
                                    : reservation.status === "seated"
                                      ? "Sentada"
                                      : reservation.status === "pending"
                                      ? "Pendiente"
                                      : reservation.status === "cancelled"
                                      ? "Cancelada"
                                      : reservation.status}
                            </p>
                        </div>
                    </div>

                    {reservation.special_requests && (
                        <div>
                            <p className="text-sm text-gray-600">
                                Solicitudes especiales
                            </p>
                            <p className="font-medium text-gray-900">
                                {reservation.special_requests}
                            </p>
                        </div>
                    )}

                    {reservation.source === "agent" && (
                        <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm font-medium text-purple-900">
                                Reserva creada por el Agente IA
                            </p>
                            {reservation.channel && (
                                <p className="text-xs text-purple-700 mt-1">
                                    Canal: {reservation.channel}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente modal para estadísticas de mesa
const TableStatsModal = ({ isOpen, onClose, table, businessId }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (isOpen && table) {
            loadTableStats();
        }
    }, [isOpen, table]);

    const loadTableStats = async () => {
        setLoading(true);
        try {
            // LIMPIO: Estadísticas vacías hasta tener datos reales
            const emptyStats = {
                totalReservations: 0,
                avgOccupancy: 0,
                avgTurnover: "0h 0min",
                peakHours: [],
                avgPartySize: 0,
                revenue: 0,
                agentAssignments: 0,
                agentPercentage: 0,
            };

            setStats(emptyStats);
        } catch (error) {
            toast.error("Error al cargar estadísticas");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !table) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        Estadísticas de {table.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Últimos 30 días
                    </p>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-24 bg-gray-200 rounded-lg animate-pulse"
                                />
                            ))}
                        </div>
                    ) : stats ? (
                        <div className="space-y-6">
                            {/* Métricas principales */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="bg-gray-50 rounded-lg p-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">
                                                {stats.totalReservations}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Reservas totales
                                            </p>
                                        </div>
                                        <Calendar className="w-8 h-8 text-blue-500" />
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">
                                                {stats.avgOccupancy}%
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Ocupación promedio
                                            </p>
                                        </div>
                                        <Activity className="w-8 h-8 text-green-500" />
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">
                                                {stats.avgTurnover}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Rotación promedio
                                            </p>
                                        </div>
                                        <Clock className="w-8 h-8 text-orange-500" />
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">
                                                €{stats.revenue}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Ingresos estimados
                                            </p>
                                        </div>
                                        <DollarSign className="w-8 h-8 text-yellow-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Estadísticas del agente */}
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
                                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-purple-600" />
                                    Rendimiento del Agente IA
                                </h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-xl font-bold text-purple-600">
                                            {stats.agentAssignments}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Asignaciones IA
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-purple-600">
                                            {stats.agentPercentage}%
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Tasa de IA
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-purple-600">
                                            {stats.avgPartySize}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Tamaño promedio
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Horas punta */}
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">
                                    Horas de Mayor Demanda
                                </h4>
                                <div className="flex gap-2">
                                    {stats.peakHours.map((hour, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                        >
                                            {hour}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Recomendación del agente */}
                            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-purple-900">
                                            Recomendación del Agente IA
                                        </p>
                                        <p className="text-sm text-purple-700 mt-1">
                                            Esta mesa tiene un excelente
                                            rendimiento. Considera promocionarla
                                            para horarios no punta (15:00-17:00)
                                            para maximizar su uso.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600">
                                No se pudieron cargar las estadísticas
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};


