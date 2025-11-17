// NoShowControlNuevo.jsx - Página Profesional de Control de No-Shows
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
    AlertTriangle, 
    TrendingDown, 
    DollarSign, 
    Clock,
    Shield,
    CheckCircle,
    Phone,
    MessageSquare,
    Calendar,
    Users,
    Activity,
    Settings,
    ChevronRight,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Info,
    Brain,
    Target,
    History,
    PhoneCall
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import NoShowTrendChart from '../components/noshows/NoShowTrendChart';
import NoShowReservationDetail from '../components/noshows/NoShowReservationDetail';
import NoShowAutomationConfigSimple from '../components/noshows/NoShowAutomationConfigSimple';

export default function NoShowControlNuevo() {
    const { business } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, config, history
    
    // Estados para secciones colapsables
    const [showFlowExplanation, setShowFlowExplanation] = useState(false);
    const [showAlgorithmExplanation, setShowAlgorithmExplanation] = useState(false);
    
    const [stats, setStats] = useState({
        evitadosEsteMes: 0,
        tasaNoShow: 0,
        roiMensual: 0,
        reservasRiesgo: 0
    });
    
    const [riskReservations, setRiskReservations] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [recentActions, setRecentActions] = useState([]);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        if (business?.id) {
            loadNoShowData();
        }
    }, [business?.id]);

    const loadNoShowData = async () => {
        try {
            setLoading(true);

            // 1. Obtener métricas generales
            const { data: metrics, error: metricsError } = await supabase
                .rpc('get_business_noshow_metrics', {
                    p_business_id: business.id
                });

            if (metricsError) {
                console.error('❌ Error en get_business_noshow_metrics:', metricsError);
                console.error('❌ Error message:', metricsError.message);
            } else {
                console.log('📊 Métricas cargadas:', metrics);
            }

            if (metrics && metrics.length > 0) {
                const metricsData = metrics[0]; // La función retorna un array con 1 elemento
                setStats({
                    evitadosEsteMes: metricsData.prevented_this_month || 0,
                    tasaNoShow: metricsData.noshow_rate || 0,
                    roiMensual: metricsData.monthly_roi || 0,
                    reservasRiesgo: metricsData.high_risk_today || 0
                });
            }

            // 2. Obtener reservas con riesgo HOY (VERSIÓN DINÁMICA)
            const { data: predictions, error: predError } = await supabase
                .rpc('predict_upcoming_noshows_v2', {
                    p_business_id: business.id,
                    p_days_ahead: 0  // 0 = solo HOY, 1 = HOY + MAÑANA
                });
            
            if (predError) {
                console.error('❌ Error en predict_upcoming_noshows_v2:', predError);
                console.error('❌ Error message:', predError.message);
                console.error('❌ Error details:', predError.details);
                console.error('❌ Error hint:', predError.hint);
                toast.error('Error al cargar predicciones: ' + predError.message);
            } else {
                console.log('🔮 Predicciones cargadas (HOY):', predictions?.length || 0, predictions);
            }

            setRiskReservations(predictions || []);

            // 3. Obtener datos de tendencia (últimos 30 días)
            const { data: actions, error: actionsError } = await supabase
                .from('noshow_actions')
                .select('*')
                .eq('business_id', business.id)
                .gte('created_at', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
                .order('created_at', { ascending: true });
            
            if (actionsError) {
                console.error('❌ Error cargando noshow_actions:', actionsError);
            }
            console.log('📊 Acciones cargadas (últimos 30 días):', actions?.length || 0, actions);

            // Agrupar por día
            const grouped = (actions || []).reduce((acc, action) => {
                const date = format(parseISO(action.created_at), 'yyyy-MM-dd');
                if (!acc[date]) {
                    acc[date] = { date, prevented: 0, occurred: 0 };
                }
                if (action.final_outcome === 'prevented' || action.prevented_noshow) acc[date].prevented++;
                if (action.final_outcome === 'noshow') acc[date].occurred++;
                return acc;
            }, {});

            setTrendData(Object.values(grouped));

            // 4. Obtener acciones recientes (últimas 10)
            const { data: recentActionsData, error: recentActionsError } = await supabase
                .from('noshow_actions')
                .select('*')
                .eq('business_id', business.id)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (recentActionsError) {
                console.error('❌ Error cargando acciones recientes:', recentActionsError);
            }
            console.log('📋 Acciones recientes cargadas:', recentActionsData?.length || 0, recentActionsData);

            setRecentActions(recentActionsData || []);

        } catch (error) {
            console.error('Error cargando datos de No-Shows:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (level) => {
        switch (level) {
            case 'high': return 'bg-red-100 text-red-800 border-red-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-green-100 text-green-800 border-green-300';
        }
    };

    const getRiskLabel = (level) => {
        switch (level) {
            case 'high': return 'Alto Riesgo';
            case 'medium': return 'Riesgo Medio';
            default: return 'Bajo Riesgo';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <Activity className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando sistema de No-Shows...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-4 md:px-4 md:py-4">
            <div className="max-w-[85%] mx-auto">
                
                {/* Header */}
                <div className="mb-3">
                    <h1 className="text-sm font-bold text-gray-900 mb-1">Sistema Anti No-Shows</h1>
                    <p className="text-xs text-gray-600">Prevención inteligente con IA y automatización</p>
                </div>

                {/* KPIs Principales - Compactas como Reservas */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                    <div className="bg-white rounded-lg shadow-sm border p-2">
                        <div className="flex items-center justify-between mb-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-[9px] text-gray-500">Este mes</span>
                        </div>
                        <p className="text-base font-bold text-gray-900">{stats.evitadosEsteMes}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">No-Shows evitados</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border p-2">
                        <div className="flex items-center justify-between mb-1">
                            <TrendingDown className="w-4 h-4 text-blue-600" />
                            <span className="text-[9px] text-gray-500">Tasa actual</span>
                        </div>
                        <p className="text-base font-bold text-gray-900">{stats.tasaNoShow.toFixed(1)}%</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">Tasa de No-Show</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border p-2">
                        <div className="flex items-center justify-between mb-1">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-[9px] text-gray-500">ROI mensual</span>
                        </div>
                        <p className="text-base font-bold text-gray-900">{stats.roiMensual}€</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">Ingresos protegidos</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border p-2">
                        <div className="flex items-center justify-between mb-1">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-[9px] text-gray-500">Hoy</span>
                        </div>
                        <p className="text-base font-bold text-gray-900">{stats.reservasRiesgo}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">Reservas de riesgo</p>
                    </div>
                </div>

                {/* Sección Colapsable: Cómo Prevenimos los No-Shows */}
                <div className="bg-white rounded-lg shadow-sm border mb-4">
                    <button
                        onClick={() => setShowFlowExplanation(!showFlowExplanation)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-purple-600" />
                            <div>
                                <h2 className="text-sm font-bold text-gray-900">¿Cómo Prevenimos los No-Shows?</h2>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Sistema automático de prevención en 5 pasos</p>
                            </div>
                        </div>
                        {showFlowExplanation ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                    </button>

                    {showFlowExplanation && (
                        <div className="px-3 pb-3 border-t">
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-3 mt-2">
                                {/* Timeline Visual */}
                                <div className="relative">
                                    {/* Línea vertical */}
                                    <div className="absolute left-8 top-8 bottom-8 w-1 bg-gradient-to-b from-blue-400 via-yellow-400 via-orange-400 to-red-400"></div>
                                    
                                    {/* Paso 1: RESERVA CREADA */}
                                    <div className="relative pl-16 pb-6">
                                        <div className="absolute left-3.5 top-0 w-5 h-5 rounded-full bg-purple-500 border-4 border-white shadow-lg flex items-center justify-center">
                                            <Calendar className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="bg-white rounded-lg p-2 shadow-md border border-purple-200">
                                            <h3 className="font-bold text-purple-900 mb-1 text-xs">RESERVA CREADA</h3>
                                            <p className="text-xs text-gray-600">Cliente hace una reserva (cualquier día, cualquier hora)</p>
                                            <p className="text-[10px] text-purple-600 font-medium mt-1">Estado: Pendiente</p>
                                        </div>
                                    </div>

                                    {/* Paso 2: 24 HORAS ANTES */}
                                    <div className="relative pl-16 pb-6">
                                        <div className="absolute left-3.5 top-0 w-5 h-5 rounded-full bg-blue-500 border-4 border-white shadow-lg flex items-center justify-center">
                                            <MessageSquare className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="bg-white rounded-lg p-2 shadow-md border border-blue-200">
                                            <h3 className="font-bold text-blue-900 mb-1 text-xs">📱 CONFIRMACIÓN 24 HORAS ANTES</h3>
                                            <p className="text-xs text-gray-700 mb-2">WhatsApp automático: <span className="font-semibold">"Confirma tu reserva para mañana"</span></p>
                                            <div className="flex gap-1.5 text-xs flex-wrap">
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">✅ Responde → Confirmada</span>
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">❌ No responde → Riesgo BAJO</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Paso 3: 4 HORAS ANTES */}
                                    <div className="relative pl-16 pb-6">
                                        <div className="absolute left-3.5 top-0 w-5 h-5 rounded-full bg-yellow-500 border-4 border-white shadow-lg flex items-center justify-center">
                                            <MessageSquare className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="bg-white rounded-lg p-2 shadow-md border border-yellow-200">
                                            <h3 className="font-bold text-yellow-900 mb-1 text-xs">⏰ RECORDATORIO 4 HORAS ANTES</h3>
                                            <p className="text-xs text-gray-700 mb-2">WhatsApp recordatorio: <span className="font-semibold">"Te esperamos en 4 horas"</span></p>
                                            <div className="flex gap-1.5 text-xs flex-wrap">
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">✅ Responde → Confirmada</span>
                                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-medium">❌ No responde → Riesgo MEDIO</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Paso 4: 2h 15min ANTES - ALARMA */}
                                    <div className="relative pl-16 pb-6">
                                        <div className="absolute left-3.5 top-0 w-5 h-5 rounded-full bg-orange-500 border-4 border-white shadow-lg flex items-center justify-center animate-pulse">
                                            <Phone className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="bg-orange-50 rounded-lg p-2 shadow-md border border-orange-300">
                                            <h3 className="font-bold text-orange-900 mb-1 text-xs">🚨 LLAMADA URGENTE (2h 15min antes)</h3>
                                            <p className="text-xs text-gray-700 mb-2"><span className="font-bold text-orange-600">ALARMA EN DASHBOARD</span> → Personal del negocio LLAMA al cliente</p>
                                            <div className="flex gap-1.5 text-xs flex-wrap">
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">✅ Confirma → Resolver alarma</span>
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">❌ No contesta → Esperar T-2h</span>
                                            </div>
                                            <p className="text-xs text-orange-600 font-semibold mt-1.5">Riesgo: ALTO</p>
                                        </div>
                                    </div>

                                    {/* Paso 5: 2h ANTES (1h 59min) - AUTO-LIBERACIÓN */}
                                    <div className="relative pl-16">
                                        <div className="absolute left-3.5 top-0 w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow-lg flex items-center justify-center">
                                            <AlertCircle className="w-3 h-3 text-white" />
                                        </div>
                                        <div className="bg-red-50 rounded-lg p-2 shadow-md border border-red-300">
                                            <h3 className="font-bold text-red-900 mb-1 text-xs">⚠️ AUTO-LIBERACIÓN (2 horas antes)</h3>
                                            <p className="text-xs text-gray-700 mb-2 font-semibold">Si no confirmó en 1h 59min:</p>
                                            <ul className="text-xs space-y-1 text-gray-700">
                                                <li>• Estado de reserva: <span className="font-semibold text-red-600">no-show</span></li>
                                                <li>• Slot de mesa: <span className="font-semibold text-green-600">LIBERADO</span> (disponible para otros)</li>
                                                <li>• Reserva: <span className="font-semibold">NO se elimina</span> (queda en historial)</li>
                                            </ul>
                                            <p className="text-xs text-gray-500 mt-1.5 italic">Si el cliente aparece después, se resuelve manualmente</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sección Colapsable: Algoritmo de Riesgo */}
                <div className="bg-white rounded-lg shadow-sm border mb-4">
                    <button
                        onClick={() => setShowAlgorithmExplanation(!showAlgorithmExplanation)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-blue-600" />
                            <div>
                                <h2 className="text-sm font-bold text-gray-900">Algoritmo Inteligente de Riesgo</h2>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">7 factores estáticos + ajustes dinámicos en tiempo real</p>
                            </div>
                        </div>
                        {showAlgorithmExplanation ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                    </button>

                    {showAlgorithmExplanation && (
                        <div className="px-3 pb-3 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-2">
                                {/* Factor 1 */}
                                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-2 border border-red-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Target className="w-3.5 h-3.5 text-red-600" />
                                        <h3 className="font-bold text-red-900 text-xs">Historial del Cliente</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-0.5">0-40 puntos según no-shows previos</p>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Si &gt;30% no-shows → +40pts</p>
                                </div>

                                {/* Factor 2 */}
                                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-2 border border-orange-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Clock className="w-3.5 h-3.5 text-orange-600" />
                                        <h3 className="font-bold text-orange-900 text-xs">Inactividad</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-0.5">0-25 puntos según última visita</p>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Si &gt;6 meses sin venir → +25pts</p>
                                </div>

                                {/* Factor 3 */}
                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-2 border border-yellow-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Clock className="w-3.5 h-3.5 text-yellow-600" />
                                        <h3 className="font-bold text-yellow-900 text-xs">Horario de Riesgo</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-0.5">0-15 puntos según hora</p>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Cenas tardías (≥21h) → +15pts</p>
                                </div>

                                {/* Factor 4 */}
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2 border border-blue-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Users className="w-3.5 h-3.5 text-blue-600" />
                                        <h3 className="font-bold text-blue-900 text-xs">Tamaño de Grupo</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-0.5">0-10 puntos según personas</p>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Grupos ≥6 personas → +10pts</p>
                                </div>

                                {/* Factor 5 */}
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2 border border-purple-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                                        <h3 className="font-bold text-purple-900 text-xs">Canal de Reserva</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-0.5">0-10 puntos según origen</p>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Teléfono/Walk-in → +10pts</p>
                                </div>

                                {/* Factor 6 */}
                                <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-2 border border-pink-200">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Calendar className="w-3.5 h-3.5 text-pink-600" />
                                        <h3 className="font-bold text-pink-900 text-xs">Antelación</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-0.5">0-20 puntos según cuándo reservó</p>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Reserva &lt;4h antes → +20pts</p>
                                </div>

                                {/* Factor 7: Urgencia Temporal */}
                                <div className="bg-gradient-to-br from-red-50 to-orange-100 rounded-lg p-2 border border-red-300 shadow-md">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                                        <h3 className="font-bold text-red-900 text-xs">⚠️ Urgencia Temporal</h3>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-1 font-semibold">0-50 puntos según proximidad sin confirmar</p>
                                    <div className="space-y-0.5 text-xs text-gray-700 font-medium">
                                        <p>• &lt;2h 15min sin confirmar → <span className="text-red-700 font-bold">+50pts 🔴</span></p>
                                        <p>• &lt;4h sin confirmar → <span className="text-orange-700 font-bold">+35pts ⚠️</span></p>
                                        <p>• &lt;24h sin confirmar → <span className="text-yellow-700 font-bold">+15pts</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* Clasificación con Ejemplos */}
                            <div className="mt-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-300">
                                <h3 className="text-xs font-bold text-gray-900 mb-2">Clasificación de Riesgo con Ejemplos:</h3>
                                
                                <div className="space-y-3">
                                    {/* RIESGO ALTO */}
                                    <div className="bg-white rounded-lg p-2 border border-red-300 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-bold text-xs">🔴 ALTO</span>
                                            <span className="text-gray-700 font-semibold text-xs">≥80 puntos → Llamada URGENTE obligatoria</span>
                                        </div>
                                        <div className="ml-16 bg-red-50 rounded-lg p-2 border border-red-200">
                                            <p className="font-bold text-red-900 mb-1 text-xs">Ejemplo: Lucía (hoy a las 19:00)</p>
                                            <ul className="text-xs text-gray-700 space-y-0.5">
                                                <li>• Historial: 20% no-shows → <span className="font-semibold text-red-600">+20 pts</span></li>
                                                <li>• Horario: Cena tardía (19h) → <span className="font-semibold text-red-600">+15 pts</span></li>
                                                <li>• <strong>⚠️ URGENCIA: &lt;2h 15min sin confirmar</strong> → <span className="font-semibold text-red-700">+50 pts</span></li>
                                                <li>• NO respondió WhatsApp 24h → <span className="font-semibold text-orange-600">+20 pts (dinámico)</span></li>
                                            </ul>
                                            <p className="mt-2 pt-2 border-t border-red-300 font-bold text-red-700 text-xs">
                                                TOTAL: 105 puntos → 🚨 ¡LLAMAR AHORA MISMO!
                                            </p>
                                        </div>
                                    </div>

                                    {/* RIESGO MEDIO */}
                                    <div className="bg-white rounded-lg p-2 border border-yellow-300 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg font-bold text-xs">🟡 MEDIO</span>
                                            <span className="text-gray-700 font-semibold text-xs">40-79 puntos → Monitorear de cerca</span>
                                        </div>
                                        <div className="ml-16 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                                            <p className="font-bold text-yellow-900 mb-1 text-xs">Ejemplo: María López</p>
                                            <ul className="text-xs text-gray-700 space-y-0.5">
                                                <li>• Historial: 15% no-shows → <span className="font-semibold text-yellow-600">+20 pts</span></li>
                                                <li>• Horario: Reserva a las 22h → <span className="font-semibold text-yellow-600">+15 pts</span></li>
                                                <li>• Canal: Reserva por teléfono → <span className="font-semibold text-yellow-600">+10 pts</span></li>
                                                <li>• Menos de 24h sin confirmar → <span className="font-semibold text-yellow-600">+15 pts</span></li>
                                            </ul>
                                            <p className="mt-2 pt-2 border-t border-yellow-300 font-bold text-yellow-700 text-xs">
                                                TOTAL: 60 puntos → Enviar WhatsApp recordatorio 4h antes
                                            </p>
                                        </div>
                                    </div>

                                    {/* RIESGO BAJO */}
                                    <div className="bg-white rounded-lg p-2 border border-green-300 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-xs">🟢 BAJO</span>
                                            <span className="text-gray-700 font-semibold text-xs">&lt;40 puntos → Recordatorio estándar (24 horas antes)</span>
                                        </div>
                                        <div className="ml-16 bg-green-50 rounded-lg p-2 border border-green-200">
                                            <p className="font-bold text-green-900 mb-1 text-xs">Ejemplo: Ana Martínez</p>
                                            <ul className="text-xs text-gray-700 space-y-0.5">
                                                <li>• Historial: 0% no-shows (cliente fiable) → <span className="font-semibold text-green-600">0 pts</span></li>
                                                <li>• Última visita: Hace 1 mes → <span className="font-semibold text-green-600">0 pts</span></li>
                                                <li>• Grupo: 2 personas → <span className="font-semibold text-green-600">0 pts</span></li>
                                                <li>• Horario: 20h (normal) → <span className="font-semibold text-green-600">0 pts</span></li>
                                            </ul>
                                            <p className="mt-2 pt-2 border-t border-green-300 font-bold text-green-700 text-xs">
                                                TOTAL: 0 puntos → Solo recordatorio amigable 24 horas antes ✅
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Nota explicativa */}
                                <div className="mt-3 bg-blue-50 rounded-lg p-2 border border-blue-200">
                                    <p className="text-xs text-blue-900 mb-1.5">
                                        <span className="font-bold">💡 Cómo funciona:</span> El sistema calcula un <strong>Score Base</strong> sumando 7 factores estáticos (hasta 135 puntos). Luego aplica <strong>Ajustes Dinámicos</strong> según las confirmaciones del cliente (±50 puntos). El Score Final determina automáticamente qué acción tomar y cuándo.
                                    </p>
                                    <p className="text-xs text-blue-800 bg-blue-100 rounded p-1.5 mt-1.5">
                                        <span className="font-bold">📊 Lógica de puntos:</span> <strong className="text-red-700">Rojo = SUMA puntos</strong> (sube riesgo) • <strong className="text-green-700">Verde = RESTA puntos</strong> (baja riesgo)
                                    </p>
                                    <div className="mt-2 pt-2 border-t border-blue-200">
                                        <p className="text-xs text-blue-900 font-bold mb-1.5">
                                            🔄 Sistema Dinámico - El riesgo se ajusta en tiempo real:
                                        </p>
                                        <ul className="mt-1.5 space-y-1 text-xs text-blue-900">
                                            <li className="bg-green-50 border border-green-200 rounded p-1.5">
                                                ✅ <strong>Cliente confirma rápido</strong> (&lt;1h después del mensaje) → <strong className="text-green-700">-30 puntos</strong> (baja riesgo mucho)
                                            </li>
                                            <li className="bg-green-50 border border-green-200 rounded p-1.5">
                                                ✅ <strong>Cliente confirma a las 4h</strong> → <strong className="text-green-700">-20 puntos</strong> (doble confirmación, baja riesgo)
                                            </li>
                                            <li className="bg-red-50 border border-red-200 rounded p-1.5">
                                                ⚠️ <strong>Cliente NO responde a las 24h</strong> → <strong className="text-orange-700">+20 puntos</strong> (sube riesgo)
                                            </li>
                                            <li className="bg-red-50 border border-red-200 rounded p-1.5">
                                                🔴 <strong>Cliente NO responde a las 4h</strong> → <strong className="text-red-700">+30 puntos</strong> (sube riesgo mucho)
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs - Compactos y homogéneos como Reservas */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'overview'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Reservas de riesgo
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'actions'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" />
                                Acciones tomadas
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('trends')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'trends'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5" />
                                Tendencias
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'config'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <Settings className="w-3.5 h-3.5" />
                                Configuración
                            </span>
                        </button>
                    </div>
                </div>

                {/* Contenido según tab */}
                {activeTab === 'overview' && (
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Reservas HOY con Riesgo</h3>
                        
                        {riskReservations.length === 0 ? (
                            <div className="text-center py-12">
                                <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <p className="text-gray-600 font-medium">¡Sin riesgo detectado!</p>
                                <p className="text-sm text-gray-500 mt-1">Todas las reservas están confirmadas</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {riskReservations.map(reservation => {
                                    // Calcular tiempo hasta reserva
                                    const now = new Date();
                                    const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
                                    const minutesUntil = Math.floor((reservationDateTime - now) / (1000 * 60));
                                    const isUrgent = minutesUntil <= 135 && reservation.risk_level === 'high'; // Menos de 2h 15min y alto riesgo
                                    
                                    return (
                                    <div
                                        key={reservation.reservation_id}
                                        className={`relative flex items-center justify-between p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer ${
                                            isUrgent ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                        }`}
                                        onClick={() => {
                                            setSelectedReservation(reservation);
                                            setShowDetailModal(true);
                                        }}
                                    >
                                        {/* Banner urgente si aplica */}
                                        {isUrgent && (
                                            <div className="absolute -top-3 left-4 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                                                <PhoneCall className="w-3 h-3" />
                                                🚨 LLAMAR URGENTE
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2">
                                            <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${getRiskColor(reservation.risk_level)}`}>
                                                {getRiskLabel(reservation.risk_level)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{reservation.customer_name}</p>
                                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                                    {reservation.reservation_time?.slice(0, 5) || reservation.reservation_time} • {reservation.party_size} personas
                                                </p>
                                                {/* Estado de confirmación dinámico */}
                                                {reservation.confirmation_status && (
                                                    <p className="text-xs mt-1 flex items-center gap-1">
                                                        {reservation.confirmation_status === 'Doble confirmación' && (
                                                            <>
                                                                <CheckCircle className="w-3 h-3 text-green-600" />
                                                                <span className="text-green-600 font-medium">✓ {reservation.confirmation_status}</span>
                                                            </>
                                                        )}
                                                        {reservation.confirmation_status === 'Confirmado 24h antes' && (
                                                            <>
                                                                <CheckCircle className="w-3 h-3 text-blue-600" />
                                                                <span className="text-blue-600 font-medium">✓ {reservation.confirmation_status}</span>
                                                            </>
                                                        )}
                                                        {reservation.confirmation_status === 'Sin respuesta' && (
                                                            <>
                                                                <AlertCircle className="w-3 h-3 text-orange-600" />
                                                                <span className="text-orange-600 font-medium">⚠ {reservation.confirmation_status}</span>
                                                            </>
                                                        )}
                                                        {reservation.confirmation_status === 'Pendiente confirmación' && (
                                                            <>
                                                                <Clock className="w-3 h-3 text-gray-500" />
                                                                <span className="text-gray-500">{reservation.confirmation_status}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <p className="font-bold text-purple-600">
                                                    Score: {reservation.risk_score}
                                                    {reservation.dynamic_adjustment !== 0 && (
                                                        <span className={`ml-2 text-xs ${reservation.dynamic_adjustment < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            ({reservation.dynamic_adjustment > 0 ? '+' : ''}{reservation.dynamic_adjustment})
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500">Base: {reservation.base_score}</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'actions' && (
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <History className="w-5 h-5 text-purple-600" />
                            Acciones Tomadas Recientemente
                        </h3>
                        
                        {recentActions.length === 0 ? (
                            <div className="text-center py-12">
                                <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600">No hay acciones registradas aún</p>
                                <p className="text-sm text-gray-500 mt-1">Las acciones preventivas aparecerán aquí</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentActions.map(action => (
                                    <div
                                        key={action.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            {action.action_type === 'call' && (
                                                <Phone className="w-5 h-5 text-blue-600" />
                                            )}
                                            {action.action_type === 'whatsapp' && (
                                                <MessageSquare className="w-5 h-5 text-green-600" />
                                            )}
                                            {action.action_type === 'auto_release' && (
                                                <AlertCircle className="w-5 h-5 text-red-600" />
                                            )}
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {action.customer_name || 'Cliente'}
                                                </p>
                                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                                    {format(parseISO(action.created_at), "d 'de' MMM", { locale: es })} • 
                                                    {action.action_type === 'call_made' && ' Llamada realizada'}
                                                    {action.action_type === 'confirmation_sent_24h' && ' Confirmación 24h enviada'}
                                                    {action.action_type === 'confirmation_sent_4h' && ' Recordatorio 4h enviado'}
                                                    {action.action_type === 'auto_release' && ' Auto-liberación'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {action.outcome === 'prevented' && (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                                    ✅ Evitado
                                                </span>
                                            )}
                                            {action.outcome === 'occurred' && (
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                                    ❌ No-Show
                                                </span>
                                            )}
                                            {action.outcome === 'pending' && (
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                                                    ⏳ Pendiente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'trends' && (
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Tendencia últimos 30 días</h3>
                        <NoShowTrendChart data={trendData} />
                    </div>
                )}

                {activeTab === 'config' && (
                    <div>
                        <NoShowAutomationConfigSimple />
                    </div>
                )}

                {/* Modal de detalle */}
                {showDetailModal && selectedReservation && (
                    <NoShowReservationDetail
                        reservation={selectedReservation}
                        onClose={() => {
                            setShowDetailModal(false);
                            setSelectedReservation(null);
                        }}
                        onSendWhatsApp={async (reservation) => {
                            // Función para enviar WhatsApp manual
                            try {
                                toast.loading('Enviando WhatsApp...');
                                // Aquí iría la lógica de envío (por ahora, solo simulamos)
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                toast.dismiss();
                                toast.success('WhatsApp enviado correctamente');
                                setShowDetailModal(false);
                                setSelectedReservation(null);
                                loadNoShowData();
                            } catch (error) {
                                toast.dismiss();
                                toast.error('Error al enviar WhatsApp');
                            }
                        }}
                        onMarkConfirmed={async (reservation) => {
                            // Función para marcar como confirmado (después de llamada manual)
                            try {
                                toast.loading('Marcando como confirmado...');
                                
                                // 1. Actualizar estado de la reserva
                                const { error: updateError } = await supabase
                                    .from('appointments')
                                    .update({ status: 'confirmed' })
                                    .eq('id', reservation.reservation_id);
                                
                                if (updateError) throw updateError;
                                
                                // 2. Registrar confirmación manual en customer_confirmations
                                const { error: confirmError } = await supabase
                                    .from('customer_confirmations')
                                    .insert({
                                        business_id: business.id,
                                        reservation_id: reservation.reservation_id,
                                        message_type: 'Llamada urgente',
                                        sent_at: new Date().toISOString(),
                                        responded_at: new Date().toISOString(),
                                        confirmed: true,
                                        response_time_minutes: 0 // Confirmación inmediata por llamada
                                    });
                                
                                if (confirmError) throw confirmError;
                                
                                toast.dismiss();
                                toast.success('✅ Reserva confirmada correctamente');
                                setShowDetailModal(false);
                                setSelectedReservation(null);
                                loadNoShowData(); // Recargar datos
                            } catch (error) {
                                toast.dismiss();
                                console.error('Error al confirmar reserva:', error);
                                toast.error('Error al confirmar: ' + error.message);
                            }
                        }}
                    />
                )}

            </div>
        </div>
    );
}

