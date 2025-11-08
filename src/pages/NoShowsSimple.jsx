// NoShowsSimple.jsx - Control de No-Shows ULTRA SIMPLE
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
    Phone, 
    MessageSquare, 
    CheckCircle, 
    AlertCircle,
    Clock,
    Calendar,
    TrendingDown,
    DollarSign,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NoShowsSimple() {
    const { business, user } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Datos
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [metrics, setMetrics] = useState({
        today_confirmed: 0,
        today_pending: 0,
        today_high_risk: 0,
        this_month_prevented: 0,
        this_month_occurred: 0,
        success_rate: 0,
        estimated_savings: 0
    });

    // UI States
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);

    useEffect(() => {
        if (business?.id) {
            loadData();
        }
    }, [business?.id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Métricas del mes
            const { data: metricsData, error: metricsError } = await supabase
                .rpc('get_simple_noshow_metrics', {
                    p_business_id: business.id
                });

            if (metricsError) {
                console.error('Error cargando métricas:', metricsError);
            } else if (metricsData && metricsData.length > 0) {
                setMetrics(metricsData[0]);
            }

            // 2. Citas de HOY con nivel de riesgo
            const { data: appointmentsData, error: appointmentsError } = await supabase
                .rpc('get_risk_appointments_today', {
                    p_business_id: business.id
                });

            if (appointmentsError) {
                console.error('Error cargando citas:', appointmentsError);
                toast.error('Error al cargar citas de hoy');
            } else {
                setTodayAppointments(appointmentsData || []);
            }

        } catch (error) {
            console.error('Error general:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
        toast.success('Actualizado');
    };

    const handleMarkConfirmed = async (appointmentId) => {
        try {
            // Registrar confirmación manual
            const { error } = await supabase
                .from('customer_confirmations')
                .insert({
                    appointment_id: appointmentId,
                    business_id: business.id,
                    sent_at: new Date().toISOString(),
                    message_type: 'Mensaje manual',
                    message_channel: 'phone',
                    message_content: 'Confirmado por teléfono',
                    responded_at: new Date().toISOString(),
                    response_time_minutes: 0,
                    confirmed: true
                });

            if (error) throw error;

            toast.success('✅ Marcada como confirmada');
            loadData();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al confirmar');
        }
    };

    const handleCall = (phone) => {
        window.open(`tel:${phone}`);
    };

    const handleWhatsApp = (phone, customerName) => {
        const message = encodeURIComponent(
            `Hola ${customerName}! 👋\n\n` +
            `Te recordamos tu cita de hoy. ¿Confirmas tu asistencia?\n\n` +
            `Responde SÍ para confirmar ✅ o NO para cancelar ❌`
        );
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`);
    };

    const getRiskBadge = (riskLevel) => {
        switch (riskLevel) {
            case 'high':
                return (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold flex items-center gap-1">
                        🔴 Riesgo alto
                    </span>
                );
            case 'medium':
                return (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-bold flex items-center gap-1">
                        🟡 Sin confirmar
                    </span>
                );
            case 'low':
            default:
                return (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold flex items-center gap-1">
                        🟢 Confirmada
                    </span>
                );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Separar por nivel de riesgo
    const highRisk = todayAppointments.filter(a => a.risk_level === 'high');
    const mediumRisk = todayAppointments.filter(a => a.risk_level === 'medium');
    const lowRisk = todayAppointments.filter(a => a.risk_level === 'low');

    return (
        <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
            {/* HEADER */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Control de Citas</h1>
                        <p className="text-gray-600 mt-1">Gestiona confirmaciones y evita no-shows</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                    >
                        <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto space-y-6">
                {/* MÉTRICAS DEL MES - MISMO ESTILO QUE RESERVAS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-green-600 text-base">✓</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-green-700 font-semibold">Evitados</p>
                                <p className="text-xl font-black text-green-600 leading-tight">{metrics.this_month_prevented}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-base">%</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-blue-700 font-semibold">Tasa éxito</p>
                                <p className="text-xl font-black text-blue-600 leading-tight">{metrics.success_rate}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-purple-600 text-base">€</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-purple-700 font-semibold">Ahorro</p>
                                <p className="text-xl font-black text-purple-600 leading-tight">€{Math.round(metrics.estimated_savings)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-red-600 text-base">⚠</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-red-700 font-semibold">Ocurridos</p>
                                <p className="text-xl font-black text-red-600 leading-tight">{metrics.this_month_occurred}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TIMELINE (Colapsable) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => setShowTimeline(!showTimeline)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Clock className="w-6 h-6 text-blue-600" />
                            <div className="text-left">
                                <h3 className="font-bold text-gray-900">¿Cómo funciona el sistema?</h3>
                                <p className="text-sm text-gray-600">Ver timeline de confirmaciones automáticas</p>
                            </div>
                        </div>
                        {showTimeline ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    {showTimeline && (
                        <div className="px-6 py-6 border-t border-gray-200 bg-gray-50">
                            <div className="space-y-6">
                                {/* Step 1 */}
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                        1
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-1">Cliente hace reserva</h4>
                                        <p className="text-sm text-gray-600">El sistema registra la cita automáticamente</p>
                                    </div>
                                </div>

                                <div className="ml-6 border-l-2 border-blue-300 h-6"></div>

                                {/* Step 2 */}
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                                        2
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-1">📱 WhatsApp 24 horas antes</h4>
                                        <p className="text-sm text-gray-600">
                                            "Hola! Mañana tienes cita a las 10:00. ¿Confirmas? ✅"
                                        </p>
                                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">Si confirma:</p>
                                            <p className="text-sm font-medium text-green-700">🟢 Riesgo bajo - Todo OK</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="ml-6 border-l-2 border-blue-300 h-6"></div>

                                {/* Step 3 */}
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">
                                        3
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-1">⏰ WhatsApp 4 horas antes</h4>
                                        <p className="text-sm text-gray-600">
                                            Si NO confirmó en el paso 2, enviamos recordatorio
                                        </p>
                                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">Si sigue sin confirmar:</p>
                                            <p className="text-sm font-medium text-yellow-700">🟡 Riesgo medio - Hacer seguimiento</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="ml-6 border-l-2 border-blue-300 h-6"></div>

                                {/* Step 4 */}
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                                        4
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-1">🚨 Alerta 2 horas antes</h4>
                                        <p className="text-sm text-gray-600">
                                            Si NO confirmó → TE AVISAMOS para que llames
                                        </p>
                                        <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                                            <p className="text-sm font-bold text-red-700">🔴 Riesgo alto - LLAMAR OBLIGATORIAMENTE</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="ml-6 border-l-2 border-blue-300 h-6"></div>

                                {/* Step 5 */}
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                                        5
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-1">🔓 Auto-cancelación (opcional)</h4>
                                        <p className="text-sm text-gray-600">
                                            Si no confirma ni por teléfono → cancelamos automáticamente
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            ✅ Así liberamos la hora para otro cliente
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* CITAS DE HOY */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                        <h2 className="font-bold text-xl text-gray-900">Citas de Hoy</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {todayAppointments.length} citas programadas
                        </p>
                    </div>

                    {/* Lista de citas */}
                    <div className="divide-y divide-gray-200">
                        {/* ALTO RIESGO */}
                        {highRisk.length > 0 && (
                            <>
                                <div className="px-6 py-3 bg-red-50">
                                    <h3 className="font-bold text-red-900 flex items-center gap-2">
                                        🔴 Riesgo Alto ({highRisk.length})
                                    </h3>
                                </div>
                                {highRisk.map(appointment => (
                                    <AppointmentRow
                                        key={appointment.appointment_id}
                                        appointment={appointment}
                                        onCall={handleCall}
                                        onWhatsApp={handleWhatsApp}
                                        onMarkConfirmed={handleMarkConfirmed}
                                        onViewDetail={(app) => {
                                            setSelectedAppointment(app);
                                            setShowDetailModal(true);
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* MEDIO RIESGO */}
                        {mediumRisk.length > 0 && (
                            <>
                                <div className="px-6 py-3 bg-yellow-50">
                                    <h3 className="font-bold text-yellow-900 flex items-center gap-2">
                                        🟡 Sin Confirmar ({mediumRisk.length})
                                    </h3>
                                </div>
                                {mediumRisk.map(appointment => (
                                    <AppointmentRow
                                        key={appointment.appointment_id}
                                        appointment={appointment}
                                        onCall={handleCall}
                                        onWhatsApp={handleWhatsApp}
                                        onMarkConfirmed={handleMarkConfirmed}
                                        onViewDetail={(app) => {
                                            setSelectedAppointment(app);
                                            setShowDetailModal(true);
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* BAJO RIESGO */}
                        {lowRisk.length > 0 && (
                            <>
                                <div className="px-6 py-3 bg-green-50">
                                    <h3 className="font-bold text-green-900 flex items-center gap-2">
                                        🟢 Confirmadas ({lowRisk.length})
                                    </h3>
                                </div>
                                {lowRisk.map(appointment => (
                                    <AppointmentRow
                                        key={appointment.appointment_id}
                                        appointment={appointment}
                                        onCall={handleCall}
                                        onWhatsApp={handleWhatsApp}
                                        onMarkConfirmed={handleMarkConfirmed}
                                        onViewDetail={(app) => {
                                            setSelectedAppointment(app);
                                            setShowDetailModal(true);
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* Sin citas */}
                        {todayAppointments.length === 0 && (
                            <div className="px-6 py-12 text-center">
                                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">No hay citas programadas para hoy</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL DE DETALLE */}
            {showDetailModal && selectedAppointment && (
                <DetailModal
                    appointment={selectedAppointment}
                    onClose={() => {
                        setShowDetailModal(false);
                        setSelectedAppointment(null);
                    }}
                    onCall={handleCall}
                    onWhatsApp={handleWhatsApp}
                    onMarkConfirmed={handleMarkConfirmed}
                />
            )}
        </div>
    );
}

// =====================================================
// COMPONENTE: Fila de Cita
// =====================================================
function AppointmentRow({ appointment, onCall, onWhatsApp, onMarkConfirmed, onViewDetail }) {
    const getRiskBadge = (riskLevel) => {
        switch (riskLevel) {
            case 'high':
                return <span className="text-2xl">🔴</span>;
            case 'medium':
                return <span className="text-2xl">🟡</span>;
            case 'low':
            default:
                return <span className="text-2xl">🟢</span>;
        }
    };

    const isUrgent = appointment.risk_level === 'high';

    return (
        <div className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
            isUrgent ? 'bg-red-50/30' : ''
        }`}>
            <div className="flex items-start gap-4">
                {/* Emoji de riesgo */}
                <div className="flex-shrink-0">
                    {getRiskBadge(appointment.risk_level)}
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                            <h4 className="font-bold text-lg text-gray-900">
                                {appointment.appointment_time?.substring(0, 5)} - {appointment.customer_name}
                            </h4>
                            <p className="text-sm text-gray-600">
                                {appointment.service_name} ({appointment.duration_minutes}min)
                            </p>
                        </div>
                    </div>

                    {/* Mensaje de riesgo */}
                    <div className={`text-sm font-medium mb-3 ${
                        isUrgent ? 'text-red-700' : 
                        appointment.risk_level === 'medium' ? 'text-yellow-700' : 
                        'text-green-700'
                    }`}>
                        {appointment.why_risk}
                    </div>

                    {/* Acción recomendada */}
                    {isUrgent && (
                        <div className="mb-3 p-3 bg-red-100 rounded-lg border border-red-300">
                            <p className="text-sm font-bold text-red-900">
                                📞 {appointment.what_to_do}
                            </p>
                        </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex flex-wrap gap-2">
                        {isUrgent && (
                            <button
                                onClick={() => onCall(appointment.customer_phone)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-md"
                            >
                                <Phone className="w-4 h-4" />
                                Llamar ahora
                            </button>
                        )}
                        
                        <button
                            onClick={() => onWhatsApp(appointment.customer_phone, appointment.customer_name)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4" />
                            WhatsApp
                        </button>

                        <button
                            onClick={() => onMarkConfirmed(appointment.appointment_id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Confirmar
                        </button>

                        <button
                            onClick={() => onViewDetail(appointment)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                            Ver detalles
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =====================================================
// COMPONENTE: Modal de Detalle
// =====================================================
function DetailModal({ appointment, onClose, onCall, onWhatsApp, onMarkConfirmed }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className={`p-6 rounded-t-2xl ${
                    appointment.risk_level === 'high' ? 'bg-red-600' :
                    appointment.risk_level === 'medium' ? 'bg-yellow-500' :
                    'bg-green-600'
                }`}>
                    <div className="flex items-start justify-between text-white">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">{appointment.customer_name}</h2>
                            <p className="text-white/90">
                                Hoy, {appointment.appointment_time?.substring(0, 5)} - {appointment.service_name}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Estado */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">Estado actual:</h3>
                        <div className={`p-4 rounded-lg border-2 ${
                            appointment.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                            appointment.risk_level === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                            'bg-green-50 border-green-300'
                        }`}>
                            <p className={`text-lg font-bold mb-2 ${
                                appointment.risk_level === 'high' ? 'text-red-900' :
                                appointment.risk_level === 'medium' ? 'text-yellow-900' :
                                'text-green-900'
                            }`}>
                                {appointment.risk_emoji} {appointment.risk_level === 'high' ? 'RIESGO ALTO' :
                                    appointment.risk_level === 'medium' ? 'SIN CONFIRMAR' :
                                    'CONFIRMADA'}
                            </p>
                        </div>
                    </div>

                    {/* ¿Por qué? */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">¿Por qué tiene este estado?</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-800">{appointment.why_risk}</p>
                            <ul className="mt-3 space-y-2 text-sm text-gray-600">
                                {!appointment.confirmed_24h && !appointment.confirmed_4h && (
                                    <li>• No ha respondido a nuestros mensajes</li>
                                )}
                                {appointment.has_previous_noshows && (
                                    <li>• Tiene no-shows previos en su historial</li>
                                )}
                                {appointment.hours_until < 2 && (
                                    <li>• Faltan menos de 2 horas para la cita</li>
                                )}
                                {appointment.booking_advance_days < 1 && (
                                    <li>• Reservó con muy poca antelación (mismo día)</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* ¿Qué hacer? */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">¿Qué deberías hacer?</h3>
                        <div className={`p-4 rounded-lg border-l-4 ${
                            appointment.risk_level === 'high' ? 'bg-red-50 border-red-600' :
                            appointment.risk_level === 'medium' ? 'bg-yellow-50 border-yellow-600' :
                            'bg-green-50 border-green-600'
                        }`}>
                            <p className="font-bold text-gray-900 mb-2">
                                {appointment.what_to_do}
                            </p>
                        </div>
                    </div>

                    {/* Historial de confirmaciones */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">Historial de mensajes:</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    appointment.confirmed_24h ? 'bg-green-100' : 'bg-gray-200'
                                }`}>
                                    {appointment.confirmed_24h ? '✅' : '📱'}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">WhatsApp 24 horas antes</p>
                                    <p className="text-xs text-gray-600">
                                        {appointment.confirmed_24h ? 'Confirmado ✅' : 'Sin respuesta ⏳'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    appointment.confirmed_4h ? 'bg-green-100' : 'bg-gray-200'
                                }`}>
                                    {appointment.confirmed_4h ? '✅' : '⏰'}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">WhatsApp 4 horas antes</p>
                                    <p className="text-xs text-gray-600">
                                        {appointment.confirmed_4h ? 'Confirmado ✅' : 
                                         appointment.hours_until < 4 ? 'Pendiente de envío' : 'Aún no enviado'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                            onClick={() => {
                                onCall(appointment.customer_phone);
                                onClose();
                            }}
                            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Phone className="w-5 h-5" />
                            Llamar
                        </button>
                        <button
                            onClick={() => {
                                onWhatsApp(appointment.customer_phone, appointment.customer_name);
                                onClose();
                            }}
                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <MessageSquare className="w-5 h-5" />
                            WhatsApp
                        </button>
                        <button
                            onClick={() => {
                                onMarkConfirmed(appointment.appointment_id);
                                onClose();
                            }}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

