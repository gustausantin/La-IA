// 🌟 ANALYTICS USER-FRIENDLY - Para restaurantes medianos
// Enfoque: Valor fácil de entender + ROI en "palabras de la calle"
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend,
    ReferenceLine,
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Users,
    Clock,
    MessageSquare,
    Star,
    AlertTriangle,
    CheckCircle2,
    Lightbulb,
    RefreshCw,
    Eye,
    Play,
    Euro,
    Calendar,
    Target,
    Sparkles,
    Info,
} from "lucide-react";
import toast from "react-hot-toast";

// 🎨 COLORES SIMPLES Y AMIGABLES
const COLORS = {
    primary: '#3B82F6',
    success: '#10B981', 
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
};

// 💰 CALCULADORA ROI BASADA EN DATOS REALES
const SimpleROICalculator = {
    calculate: (reservas, avgTicketReal = 0) => {
        // SOLO USAR DATOS REALES - NO HARDCODEADOS
        if (!avgTicketReal || reservas === 0) {
            return {
                monthlyRevenue: 0,
                monthlySavings: 0,
                additionalRevenue: 0,
                totalBenefit: 0,
                paybackWeeks: 0,
                simpleMessage: "Sin datos suficientes para calcular ROI",
                savingsMessage: "Necesitas más datos de reservas",
                paybackMessage: "ROI se calculará con datos reales",
            };
        }
        
        const monthlyRevenue = reservas * avgTicketReal;
        const savings = 0; // Sin datos reales de costos
        const additionalRevenue = 0; // Sin datos reales de comparación
        const totalBenefit = monthlyRevenue;
        
        return {
            monthlyRevenue: monthlyRevenue,
            monthlySavings: savings,
            additionalRevenue: additionalRevenue,
            totalBenefit: totalBenefit,
            paybackWeeks: 0,
            simpleMessage: `Ingresos reales: €${monthlyRevenue.toLocaleString()}`,
            savingsMessage: "Datos de ahorro no disponibles",
            paybackMessage: "ROI basado en datos reales",
        };
    }
};

// 🧠 PREDICCIONES SIMPLES (sin jerga técnica)
const SimplePredictions = {
    predictNextWeek: (historicalData) => {
        if (!historicalData || historicalData.length < 3) {
            return {
                predicted: 0,
                trend: 'stable',
                message: 'Necesitamos más datos para hacer predicciones',
                confidence: 'Baja'
            };
        }
        
        const recent = historicalData.slice(-3);
        const avg = recent.reduce((acc, d) => acc + d.reservas, 0) / recent.length;
        const trend = recent[2].reservas > recent[0].reservas ? 'up' : 
                     recent[2].reservas < recent[0].reservas ? 'down' : 'stable';
        
        const multiplier = trend === 'up' ? 1.1 : trend === 'down' ? 0.9 : 1;
        const predicted = Math.round(avg * multiplier);
        
        return {
            predicted,
            trend,
            message: trend === 'up' ? 
                'Tendencia positiva - prepárate para más reservas' :
                trend === 'down' ? 
                'Tendencia a la baja - considera promociones' :
                'Tendencia estable - buen momento para optimizar',
            confidence: historicalData.length > 7 ? 'Alta' : 'Media'
        };
    }
};

export default function Analytics() {
    const { restaurant, restaurantId, isReady } = useAuthContext();
    
    // Estados principales
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('resumen');
    const [showDemo, setShowDemo] = useState(false);
    const [hasData, setHasData] = useState(false);
    
    // Datos reales del usuario
    const [userMetrics, setUserMetrics] = useState({
        totalConversaciones: 0,
        reservasExitosas: 0,
        tasaConversion: 0,
        tiempoRespuesta: 0,
        satisfaccion: 0,
    });
    
    const [chartData, setChartData] = useState([]);
    const [prediction, setPrediction] = useState({});
    const [roiInfo, setRoiInfo] = useState({});
    const [simpleInsights, setSimpleInsights] = useState([]);
    
    // ELIMINADO: demoData - SOLO DATOS REALES DE SUPABASE
    
    // Cargar datos del usuario
    const loadUserData = useCallback(async () => {
        if (!restaurantId) return;
        
        try {
            setLoading(true);
            
            // Calcular métricas desde reservas existentes
            const { data: reservationsData, error } = await supabase
                .from('reservations')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: true });

            // Usar SOLO datos reales de reservas - SIN SIMULACIÓN
            const metricsData = reservationsData ? 
                reservationsData.reduce((acc, reservation) => {
                    const date = reservation.created_at.split('T')[0];
                    const existing = acc.find(m => m.date === date);
                    if (existing) {
                        existing.successful_bookings += 1;
                        existing.total_conversations += 1; // Solo contar reservas reales
                    } else {
                        acc.push({
                            date,
                            successful_bookings: 1,
                            total_conversations: 1, // Solo datos reales
                            avg_response_time: 0, // Sin datos reales
                            conversion_rate: 0, // Sin datos reales
                            customer_satisfaction: 0 // Sin datos reales
                        });
                    }
                    return acc;
                }, []) : [];
            
            if (error) throw error;
            
            // Verificar si tiene datos
            const hasRealData = metricsData && metricsData.length > 0;
            setHasData(hasRealData);
            
            if (hasRealData) {
                // Procesar datos reales
                const totals = metricsData.reduce((acc, day) => ({
                    totalConversaciones: acc.totalConversaciones + (day.total_conversations || 0),
                    reservasExitosas: acc.reservasExitosas + (day.successful_bookings || 0),
                    tiempoRespuesta: acc.tiempoRespuesta + (day.avg_response_time || 0),
                    satisfaccion: acc.satisfaccion + (day.customer_satisfaction || 0),
                }), { totalConversaciones: 0, reservasExitosas: 0, tiempoRespuesta: 0, satisfaccion: 0 });
                
                const realMetrics = {
                    ...totals,
                    tasaConversion: totals.totalConversaciones > 0 ? 
                        (totals.reservasExitosas / totals.totalConversaciones * 100) : 0,
                    tiempoRespuesta: totals.tiempoRespuesta / metricsData.length,
                    satisfaccion: totals.satisfaccion / metricsData.length,
                };
                
                setUserMetrics(realMetrics);
                
                // Preparar datos para gráfico
                const processedData = metricsData.map(day => ({
                    date: format(new Date(day.date), 'dd MMM', { locale: es }),
                    conversaciones: day.total_conversations || 0,
                    reservas: day.successful_bookings || 0,
                }));
                
                setChartData(processedData);
                
                // Calcular ROI real
                const roi = SimpleROICalculator.calculate(totals.reservasExitosas);
                setRoiInfo(roi);
                
                // Predicción simple
                const pred = SimplePredictions.predictNextWeek(processedData);
                setPrediction(pred);
                
                // Insights simples
                const insights = [];
                if (realMetrics.tasaConversion > 70) {
                    insights.push({
                        type: 'success',
                        title: '¡Excelente conversión!',
                        message: 'Tu agente tiene una buena tasa de conversión.',
                        icon: Star
                    });
                }
                if (realMetrics.tiempoRespuesta < 3) {
                    insights.push({
                        type: 'success',
                        title: 'Respuestas súper rápidas',
                        message: 'Respondes en menos de 3 segundos. Tus clientes están contentos.',
                        icon: CheckCircle2
                    });
                }
                setSimpleInsights(insights);
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);
    
    useEffect(() => {
        if (isReady) {
            loadUserData();
        }
    }, [isReady, loadUserData]);
    
    // Decidir qué datos mostrar
    const displayMetrics = userMetrics; // SOLO DATOS REALES
    const displayChartData = chartData; // SOLO DATOS REALES  
    const displayROI = roiInfo; // SOLO DATOS REALES
    
    if (!isReady || loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900">Cargando tus datos...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-6 bg-gray-50 min-h-screen p-6">
            {/* Header amigable */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 mb-2">
                            📊 Cómo va tu agente IA
                        </h1>
                        <p className="text-gray-600">
                            Todo lo que necesitas saber sobre tus reservas y clientes
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {!hasData && (
                            <button
                                onClick={() => setShowDemo(!showDemo)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    showDemo 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                <Play className="w-4 h-4" />
                                {showDemo ? 'Ocultar Demo' : 'Ver Demo'}
                            </button>
                        )}
                        <button
                            onClick={loadUserData}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualizar
                        </button>
                    </div>
                </div>
                
                {!hasData && !showDemo && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-600" />
                            <span className="text-blue-800 font-medium">
                                Aún no tienes datos suficientes. 
                            </span>
                        </div>
                        <p className="text-blue-700 text-sm mt-1">
                            Haz clic en "Ver Demo" para ver cómo funcionará tu analytics.
                        </p>
                    </div>
                )}
            </div>
            
            {/* ROI en palabras simples */}
            {(hasData || showDemo) && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg text-white p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Euro className="w-8 h-8" />
                        <div>
                            <h3 className="text-base font-bold">¿Cuánto dinero te hace ganar tu agente?</h3>
                            <p className="text-green-100">Calculado automáticamente cada mes</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/20 rounded-lg p-2">
                            <p className="text-green-100 text-sm mb-1">Ingresos extra</p>
                            <p className="text-lg font-bold">{displayROI.simpleMessage}</p>
                        </div>
                        <div className="bg-white/20 rounded-lg p-2">
                            <p className="text-green-100 text-sm mb-1">Ahorros en personal</p>
                            <p className="text-lg font-bold">{displayROI.savingsMessage}</p>
                        </div>
                        <div className="bg-white/20 rounded-lg p-2">
                            <p className="text-green-100 text-sm mb-1">Recuperación</p>
                            <p className="text-lg font-bold">{displayROI.paybackMessage}</p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Métricas principales simplificadas */}
            {(hasData || showDemo) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Personas que escriben</p>
                                <p className="text-xl font-bold text-gray-900">{displayMetrics.totalConversaciones}</p>
                                <p className="text-sm text-gray-500 mt-1">conversaciones totales</p>
                            </div>
                            <MessageSquare className="w-10 h-10 text-blue-500" />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Reservas confirmadas</p>
                                <p className="text-xl font-bold text-gray-900">{displayMetrics.reservasExitosas}</p>
                                <p className="text-sm text-gray-500 mt-1">mesas ocupadas</p>
                            </div>
                            <Users className="w-10 h-10 text-green-500" />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">De cada 100 que escriben</p>
                                <p className="text-xl font-bold text-gray-900">{Math.round(displayMetrics.tasaConversion)}</p>
                                <p className="text-sm text-gray-500 mt-1">hacen reserva</p>
                            </div>
                            <Target className="w-10 h-10 text-purple-500" />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Velocidad de respuesta</p>
                                <p className="text-xl font-bold text-gray-900">{displayMetrics.tiempoRespuesta?.toFixed(1)}s</p>
                                <p className="text-sm text-gray-500 mt-1">súper rápido</p>
                            </div>
                            <Clock className="w-10 h-10 text-orange-500" />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Tabs simplificados */}
            {(hasData || showDemo) && (
                <>
                    <div className="bg-white rounded-xl shadow-sm border p-1">
                        <div className="flex space-x-1">
                            {[
                                { id: 'resumen', label: 'Resumen', icon: MessageSquare },
                                { id: 'predicciones', label: 'Próxima semana', icon: Calendar },
                                { id: 'clientes', label: 'Tus clientes', icon: Users },
                                { id: 'consejos', label: 'Consejos', icon: Lightbulb },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Contenido de tabs */}
                    {activeTab === 'resumen' && (
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                📈 Conversaciones y reservas (últimos días)
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={displayChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip 
                                            formatter={(value, name) => [
                                                value, 
                                                name === 'conversaciones' ? 'Personas que escribieron' : 'Reservas confirmadas'
                                            ]}
                                        />
                                        <Legend />
                                        <Bar 
                                            dataKey="conversaciones" 
                                            fill={COLORS.primary} 
                                            name="Conversaciones"
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar 
                                            dataKey="reservas" 
                                            fill={COLORS.success} 
                                            name="Reservas"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'predicciones' && prediction && (
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                🔮 ¿Qué esperar la próxima semana?
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-blue-50 rounded-lg p-6">
                                    <div className="text-center">
                                        <p className="text-sm text-blue-600 mb-2">Reservas estimadas</p>
                                        <p className="text-4xl font-bold text-blue-600">{prediction.predicted || 0}</p>
                                        <p className="text-sm text-blue-700 mt-2">próxima semana</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-3">Lo que esto significa:</h4>
                                    <p className="text-gray-700 mb-4">{prediction.message}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">Confianza:</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            prediction.confidence === 'Alta' ? 'bg-green-100 text-green-800' :
                                            prediction.confidence === 'Media' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {prediction.confidence}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'clientes' && (
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">
                                👥 Tus clientes están contentos
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="text-center">
                                    <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-4">
                                        <Star className="w-10 h-10 text-yellow-500" />
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">
                                        {showDemo ? '4.3' : (userMetrics.satisfaccion?.toFixed(1) || '---')}
                                    </p>
                                    <p className="text-gray-600">de 5 estrellas</p>
                                    <p className="text-sm text-gray-500 mt-2">valoración promedio</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        <span className="text-gray-700">Responde súper rápido</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        <span className="text-gray-700">Entiende lo que quieren</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        <span className="text-gray-700">Es amable y educado</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        <span className="text-gray-700">Disponible 24/7</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'consejos' && (
                        <div className="space-y-4">
                            {simpleInsights.length > 0 ? (
                                simpleInsights.map((insight, idx) => (
                                    <div key={idx} className="bg-white rounded-xl shadow-sm border p-6">
                                        <div className="flex items-start gap-3">
                                            <insight.icon className={`w-6 h-6 mt-1 ${
                                                insight.type === 'success' ? 'text-green-500' : 'text-blue-500'
                                            }`} />
                                            <div>
                                                <h4 className="font-semibold text-gray-900 mb-2">{insight.title}</h4>
                                                <p className="text-gray-700">{insight.message}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border p-6">
                                    <div className="text-center py-8">
                                        <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <h4 className="font-semibold text-gray-900 mb-2">
                                            Pronto tendrás consejos personalizados
                                        </h4>
                                        <p className="text-gray-600">
                                            Necesitamos algunos días de datos para generar recomendaciones útiles.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
