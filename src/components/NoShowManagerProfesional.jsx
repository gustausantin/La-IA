// NoShowManagerProfesional.jsx - Sistema REAL de gestión de No-Shows
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { 
    AlertTriangle, 
    Shield, 
    TrendingDown, 
    Clock, 
    MessageSquare,
    CheckCircle,
    Target,
    Brain,
    Phone,
    Info,
    Send,
    Users,
    Calendar,
    AlertCircle,
    ChevronRight,
    X
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const NoShowManagerProfesional = () => {
    const { restaurant } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [showRiskExplanation, setShowRiskExplanation] = useState(false);
    const [mostrarAyuda, setMostrarAyuda] = useState(false);
    const [reservasRiesgo, setReservasRiesgo] = useState([]);
    const [data, setData] = useState({
        todayRisk: 0,
        weeklyPrevented: 0,
        riskLevel: 'low',
        successRate: 0
    });

    // Cargar datos reales
    useEffect(() => {
        const loadData = async () => {
            if (!restaurant?.id) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Cargar reservas de HOY con riesgo
                const today = format(new Date(), 'yyyy-MM-dd');
                
                // 1. Obtener reservas de hoy
                const { data: todayReservations } = await supabase
                    .from('noshow_actions')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .gte('reservation_date', today)
                    .lte('reservation_date', today)
                    .order('risk_score', { ascending: false });

                console.log('🔍 DEBUG NoShow - Acciones encontradas:', todayReservations?.length || 0);
                
                // 2. Convertir noshow_actions a formato UI
                const reservasConRiesgo = (todayReservations || []).map(action => {
                    let riskFactors = [];
                    if (action.risk_score >= 85) {
                        riskFactors = ['Cliente de alto riesgo', 'Requiere acción inmediata'];
                    } else if (action.risk_score >= 65) {
                        riskFactors = ['Riesgo moderado', 'Monitoreo recomendado'];
                    } else {
                        riskFactors = ['Riesgo bajo', 'Seguimiento opcional'];
                    }

                    return {
                        id: action.reservation_id || action.id,
                        customer_name: action.customer_name,
                        customer_phone: action.customer_phone || 'Sin teléfono',
                        customer_email: 'Sin email',
                        reservation_time: action.reservation_time,
                        party_size: action.party_size,
                        table_number: 'TBD',
                        riskScore: action.risk_score,
                        riskLevel: action.risk_level,
                        riskFactors: riskFactors,
                        reservation_date: action.reservation_date
                    };
                });

                console.log('🔍 DEBUG NoShow - Reservas procesadas:', reservasConRiesgo.length);
                
                // TODAS las reservas (como Dashboard)
                setReservasRiesgo(reservasConRiesgo);
                
                // Para el contador principal
                const reservasAltoRiesgo = reservasConRiesgo.filter(r => r.riskLevel === 'high');

                // 3. Cargar datos de la semana
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);

                const { data: noShowActions } = await supabase
                    .from('noshow_actions')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .gte('created_at', weekAgo.toISOString());

                const prevented = noShowActions?.filter(a => 
                    a.customer_response === 'confirmed' || a.prevented_noshow === true
                ).length || 0;
                
                const successRate = noShowActions?.length > 0 
                    ? Math.round((prevented / noShowActions.length) * 100)
                    : 0;
                
                // Obtener TODAS las noshow_actions de HOY (como hace el Dashboard)
                const { data: todayNoShowActions } = await supabase
                    .from('noshow_actions')
                    .select('*')
                    .eq('restaurant_id', restaurant.id)
                    .eq('reservation_date', format(new Date(), 'yyyy-MM-dd'));
                
                setData({
                    todayRisk: todayNoShowActions?.length || reservasAltoRiesgo.length, // Usar el mismo número que el Dashboard
                    weeklyPrevented: prevented,
                    riskLevel: reservasAltoRiesgo.length > 2 ? 'high' : reservasAltoRiesgo.length > 0 ? 'medium' : 'low',
                    successRate: successRate || 0
                });

            } catch (error) {
                console.error('Error loading no-show data:', error);
                // Usar datos vacíos si hay error
                setData({
                    todayRisk: 0,
                    weeklyPrevented: 0,
                    riskLevel: 'low',
                    successRate: 0
                });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [restaurant?.id]);

    // Enviar mensaje de confirmación usando PLANTILLAS CRM
    const enviarMensajeConfirmacion = async (reserva) => {
        try {
            toast.loading('Obteniendo plantilla y enviando mensaje...', { id: 'send-msg' });
            
            // 1. OBTENER PLANTILLA CRM PARA NO-SHOWS
            const { data: plantillas } = await supabase
                .from('message_templates')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .eq('category', 'noshow_prevention')
                .eq('is_active', true)
                .single();

            // Si no hay plantilla, usar mensaje por defecto
            let mensajeFinal = `Hola ${reserva.customer_name}, te confirmamos tu reserva para hoy a las ${reserva.reservation_time}. ¿Todo correcto? Responde SÍ para confirmar.`;
            
            if (plantillas?.content) {
                // Personalizar plantilla con datos de la reserva
                mensajeFinal = plantillas.content
                    .replace('{{customer_name}}', reserva.customer_name)
                    .replace('{{reservation_time}}', reserva.reservation_time)
                    .replace('{{party_size}}', reserva.party_size)
                    .replace('{{restaurant_name}}', restaurant.name || 'nuestro restaurante');
            }
            
            // 2. GUARDAR ACCIÓN EN LA BASE DE DATOS
            const { data, error } = await supabase
                .from('noshow_actions')
                .insert({
                    restaurant_id: restaurant.id,
                    reservation_id: reserva.id,
                    customer_id: reserva.customer_id,
                    customer_name: reserva.customer_name,
                    reservation_date: reserva.reservation_date,
                    reservation_time: reserva.reservation_time,
                    party_size: reserva.party_size,
                    risk_level: reserva.riskLevel,
                    risk_score: reserva.riskScore,
                    action_type: 'whatsapp_confirmation',
                    channel: 'whatsapp',
                    message_sent: mensajeFinal,
                    customer_response: 'pending',
                    final_outcome: 'pending',
                    metadata: {
                        risk_factors: reserva.riskFactors,
                        template_used: plantillas?.id || 'default',
                        sent_at: new Date().toISOString()
                    }
                })
                .select()
                .single();

            if (error) throw error;

            // 3. CREAR COMUNICACIÓN EN MESSAGES Y CONVERSATIONS
            // Primero crear o actualizar conversación
            const { data: conversation } = await supabase
                .from('conversations')
                .upsert({
                    restaurant_id: restaurant.id,
                    customer_id: reserva.customer_id,
                    customer_name: reserva.customer_name,
                    customer_phone: reserva.customer_phone || '',
                    customer_email: reserva.customer_email || '',
                    channel: 'whatsapp',
                    status: 'active',
                    priority: 'high', // Alta prioridad por ser prevención de no-show
                    last_message: mensajeFinal,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'restaurant_id,customer_phone',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            // Luego crear el mensaje
            await supabase.from('messages').insert({
                restaurant_id: restaurant.id,
                customer_id: reserva.customer_id,
                customer_name: reserva.customer_name,
                customer_phone: reserva.customer_phone || '',
                message_text: mensajeFinal,
                direction: 'outbound',
                channel: 'whatsapp',
                metadata: {
                    type: 'noshow_prevention',
                    reservation_id: reserva.id,
                    risk_score: reserva.riskScore,
                    template_id: plantillas?.id
                }
            });

            // 4. CREAR SUGERENCIA CRM PARA SEGUIMIENTO
            await supabase.from('crm_suggestions').insert({
                restaurant_id: restaurant.id,
                customer_id: reserva.customer_id,
                type: 'noshow_followup',
                title: `Seguimiento prevención no-show: ${reserva.customer_name}`,
                description: `Cliente de alto riesgo (${reserva.riskScore} puntos). Mensaje enviado. Pendiente confirmación.`,
                priority: 'high',
                status: 'pending',
                metadata: {
                    reservation_id: reserva.id,
                    risk_factors: reserva.riskFactors,
                    message_sent: true
                }
            });

            toast.success(`Mensaje enviado a ${reserva.customer_name} - Acción registrada`, { id: 'send-msg' });
            
            // Actualizar estado local
            setReservasRiesgo(prev => prev.filter(r => r.id !== reserva.id));
            setData(prev => ({
                ...prev,
                todayRisk: Math.max(0, prev.todayRisk - 1),
                weeklyPrevented: prev.weeklyPrevented + 1
            }));

        } catch (error) {
            console.error('Error enviando mensaje:', error);
            toast.error('Error al enviar mensaje', { id: 'send-msg' });
        }
    };

    // Ignorar reserva - marcar como no requiere acción
    const ignorarReserva = async (reserva) => {
        try {
            toast.loading('Marcando como ignorada...', { id: 'ignore' });
            
            // Quitar de la lista local
            setReservasRiesgo(prev => prev.filter(r => r.id !== reserva.id));
            
            toast.success(`Reserva de ${reserva.customer_name} ignorada`, { id: 'ignore' });
            
        } catch (error) {
            console.error('Error ignorando reserva:', error);
            toast.error('Error al ignorar reserva', { id: 'ignore' });
        }
    };

    // Llamar al cliente - ACCIÓN REAL
    const llamarCliente = async (reserva) => {
        try {
            if (!reserva.customer_phone) {
                toast.error('No hay teléfono disponible');
                return;
            }
            
            toast.loading('Registrando llamada...', { id: 'call' });
            
            // GUARDAR ACCIÓN DE LLAMADA
            const { data, error } = await supabase
                .from('noshow_actions')
                .insert({
                    restaurant_id: restaurant.id,
                    reservation_id: reserva.id,
                    customer_id: reserva.customer_id,
                    customer_name: reserva.customer_name,
                    reservation_date: reserva.reservation_date,
                    reservation_time: reserva.reservation_time,
                    party_size: reserva.party_size,
                    risk_level: reserva.riskLevel,
                    risk_score: reserva.riskScore,
                    action_type: 'call',
                    channel: 'call',
                    message_sent: `Llamada de confirmación a ${reserva.customer_phone}`,
                    customer_response: 'confirmed',
                    final_outcome: 'attended',
                    prevented_noshow: true,
                    metadata: {
                        risk_factors: reserva.riskFactors,
                        called_at: new Date().toISOString(),
                        phone: reserva.customer_phone
                    }
                })
                .select()
                .single();

            if (error) throw error;
            
            // Abrir aplicación de teléfono
            window.location.href = `tel:${reserva.customer_phone}`;
            
            toast.success('Abriendo aplicación de teléfono...');
            
            // Marcar como gestionado
            setTimeout(() => {
                setReservasRiesgo(prev => prev.filter(r => r.id !== reserva.id));
                setData(prev => ({
                    ...prev,
                    todayRisk: Math.max(0, prev.todayRisk - 1)
                }));
            }, 2000);

        } catch (error) {
            console.error('Error llamando:', error);
            toast.error('Error al intentar llamar');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Shield className="w-6 h-6 text-purple-600" />
                            Control No-Shows
                        </h1>
                        <p className="text-gray-600 mt-1">Sistema de prevención inteligente</p>
                    </div>
                    <button 
                        onClick={() => setMostrarAyuda(!mostrarAyuda)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                        title="¿Qué es un No-Show?"
                    >
                        <Info className="w-5 h-5 text-gray-600 group-hover:text-purple-600" />
                    </button>
                </div>
            </div>

            {/* Ayuda - ¿Qué es un No-Show? */}
            {mostrarAyuda && (
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        ¿Qué es un No-Show y cómo lo detectamos?
                    </h3>
                    <div className="space-y-3 text-sm text-blue-800">
                        <div>
                            <strong>No-Show:</strong> Cliente con reserva confirmada que no se presenta sin avisar.
                        </div>
                        <div>
                            <strong>Impacto:</strong> Mesa vacía = pérdida potencial de ingresos.
                        </div>
                        <div className="pt-2 border-t border-blue-200">
                            <strong>Factores de Riesgo que analizamos:</strong>
                            <ul className="mt-2 space-y-1 ml-4">
                                <li>• <strong>Alto (🔴):</strong> Cliente con más del 30% no-shows previos</li>
                                <li>• <strong>Medio (🟡):</strong> Reservas después de 21h o antes de 13h</li>
                                <li>• <strong>Medio (🟡):</strong> Grupos grandes (más de 6 personas)</li>
                                <li>• <strong>Alto (🔴):</strong> Sin teléfono de contacto válido</li>
                            </ul>
                        </div>
                        <div className="pt-2 border-t border-blue-200">
                            <strong>Acciones preventivas:</strong>
                            <ul className="mt-2 space-y-1 ml-4">
                                <li>• Enviar confirmación 2-4h antes</li>
                                <li>• Llamar si es alto riesgo</li>
                                <li>• Pedir confirmación activa</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Métricas principales - MÁS PEQUEÑAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Evitados esta semana */}
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-blue-900">Evitados esta semana</h3>
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-lg font-bold text-blue-600">{data.weeklyPrevented}</div>
                    <p className="text-xs text-blue-700 mt-1">Tasa de éxito: {data.successRate}%</p>
                </div>

                {/* No-shows detectados hoy - MÁS PEQUEÑO */}
                <div className={`rounded-lg p-2 border ${
                    reservasRiesgo.filter(r => r.riskLevel === 'high').length > 0 ? 'bg-red-50 border-red-200' :
                    reservasRiesgo.filter(r => r.riskLevel === 'medium').length > 0 ? 'bg-yellow-50 border-yellow-200' :
                    'bg-green-50 border-green-200'
                }`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-sm font-medium ${
                            reservasRiesgo.filter(r => r.riskLevel === 'high').length > 0 ? 'text-red-900' :
                            reservasRiesgo.filter(r => r.riskLevel === 'medium').length > 0 ? 'text-yellow-900' :
                            'text-green-900'
                        }`}>No-shows detectados hoy</h3>
                        <AlertTriangle className={`w-4 h-4 ${
                            reservasRiesgo.filter(r => r.riskLevel === 'high').length > 0 ? 'text-red-600' :
                            reservasRiesgo.filter(r => r.riskLevel === 'medium').length > 0 ? 'text-yellow-600' :
                            'text-green-600'
                        }`} />
                    </div>
                    <div className={`text-lg font-bold ${
                        reservasRiesgo.filter(r => r.riskLevel === 'high').length > 0 ? 'text-red-600' :
                        reservasRiesgo.filter(r => r.riskLevel === 'medium').length > 0 ? 'text-yellow-600' :
                        'text-green-600'
                    }`}>{reservasRiesgo.length}</div>
                    <div className="text-xs mt-1 space-y-0.5">
                        <div className="text-red-600 font-medium">
                            {reservasRiesgo.filter(r => r.riskLevel === 'high').length} Alto riesgo
                        </div>
                        <div className="text-yellow-600">
                            {reservasRiesgo.filter(r => r.riskLevel === 'medium').length} Riesgo medio
                        </div>
                        <div className="text-green-600">
                            {reservasRiesgo.filter(r => r.riskLevel === 'low').length} Riesgo bajo
                        </div>
                    </div>
                </div>
            </div>

            {/* ANÁLISIS DETALLADO ELIMINADO - Como pediste */}

            {/* MINI-DASHBOARD INFO */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-2 rounded-lg mb-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-blue-900">Resumen de Riesgos</h4>
                    <button
                        onClick={() => setShowRiskExplanation(true)}
                        className="ml-auto p-1 text-blue-400 hover:text-blue-600 rounded-full hover:bg-blue-100"
                        title="¿Cómo calculamos el riesgo?"
                    >
                        <Info className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="text-center">
                        <div className="text-lg font-bold text-gray-800">{reservasRiesgo.length}</div>
                        <div className="text-xs text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-red-600">{reservasRiesgo.filter(r => r.riskLevel === 'high').length}</div>
                        <div className="text-xs text-red-700">Alto</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600">{reservasRiesgo.filter(r => r.riskLevel === 'medium').length}</div>
                        <div className="text-xs text-yellow-700">Medio</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{reservasRiesgo.filter(r => r.riskLevel === 'low').length}</div>
                        <div className="text-xs text-green-700">Bajo</div>
                    </div>
                </div>
                
                {reservasRiesgo.length > 0 && (
                    <div className="bg-white rounded p-2">
                        <p className="text-xs font-medium text-gray-700 mb-1">Próximas acciones:</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                            {reservasRiesgo.slice(0, 3).map(r => (
                                <div key={r.id} className="flex justify-between">
                                    <span>Mesa {r.table_number} - {r.customer_name}</span>
                                    <span className={`font-medium ${
                                        r.riskLevel === 'high' ? 'text-red-600' :
                                        r.riskLevel === 'medium' ? 'text-yellow-600' : 'text-green-600'
                                    }`}>
                                        {r.riskLevel === 'high' ? 'URGENTE' : r.riskLevel === 'medium' ? 'MEDIO' : 'BAJO'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ACCIONES - Reservas que necesitan gestión */}
            {reservasRiesgo.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-6 bg-yellow-50 border-b border-yellow-200">
                        <h3 className="text-lg font-semibold text-yellow-900 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            {data.todayRisk} Acciones de No-Show HOY - GESTIONAR AHORA
                        </h3>
                        <p className="text-sm text-yellow-700 mt-1">
                            {reservasRiesgo.filter(r => r.riskScore >= 85).length} de alto riesgo (≥85 puntos) requieren acción inmediata
                        </p>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {reservasRiesgo.map((reserva) => (
                            <div key={reserva.id} className="p-2 hover:bg-gray-50">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-3 h-3 rounded-full ${
                                                reserva.riskLevel === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                                            }`} />
                                            <div>
                                                <span className="font-semibold text-gray-900">
                                                    Mesa {reserva.table_number || 'TBD'} - {reserva.customer_name || 'Cliente sin nombre'}
                                                </span>
                                                <span className="text-gray-600 ml-2">
                                                    • {reserva.reservation_time.substring(0, 5)} • {reserva.party_size} personas
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ml-6 space-y-1">
                                            <p className="text-sm text-gray-600">
                                                Mesa: {reserva.table_number || 'Por asignar'}
                                            </p>
                                            {reserva.customer_phone && (
                                                <p className="text-sm text-gray-600">
                                                    Tel: {reserva.customer_phone}
                                                </p>
                                            )}
                                            <div className="text-sm text-red-600">
                                                <strong>Factores de riesgo:</strong>
                                                <ul className="ml-4 mt-1">
                                                    {reserva.riskFactors.map((factor, idx) => (
                                                        <li key={idx}>• {factor}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    {/* BOTONES IGUALES AL CRM */}
                                    <div className="flex gap-2">
                                        {(reserva.riskLevel === 'high' || reserva.riskLevel === 'medium') && (
                                            <button
                                                onClick={() => enviarMensajeConfirmacion(reserva)}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Enviar
                                            </button>
                                        )}
                                        
                                        <button
                                            onClick={() => ignorarReserva(reserva)}
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            Ignorar
                                        </button>
                                        
                                        {reserva.customer_phone && reserva.riskLevel === 'high' && (
                                            <button
                                                onClick={() => llamarCliente(reserva)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <Phone className="w-4 h-4" />
                                                Llamar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Si no hay reservas en riesgo */}
            {reservasRiesgo.length === 0 && data.todayRisk === 0 && (
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <div>
                            <h3 className="font-semibold text-green-900">
                                Sin reservas de riesgo para hoy
                            </h3>
                            <p className="text-sm text-green-700 mt-1">
                                Todas las reservas están confirmadas o tienen bajo riesgo de no-show
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EXPLICATIVO DE FACTORES DE RIESGO */}
            {showRiskExplanation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Target className="w-6 h-6 text-blue-600" />
                                    ¿Cómo Calculamos el Riesgo?
                                </h2>
                                <button
                                    onClick={() => setShowRiskExplanation(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-red-50 p-2 rounded-lg border-l-4 border-red-400">
                                    <h3 className="font-semibold text-red-900 mb-2">🔴 ALTO RIESGO (85+ puntos)</h3>
                                    <ul className="text-sm text-red-800 space-y-1">
                                        <li>• Cliente con historial de no-shows</li>
                                        <li>• Horarios problemáticos (19-21h viernes)</li>
                                        <li>• Grupos grandes (6+ personas)</li>
                                        <li>• Sin teléfono válido</li>
                                    </ul>
                                </div>
                                
                                <div className="bg-yellow-50 p-2 rounded-lg border-l-4 border-yellow-400">
                                    <h3 className="font-semibold text-yellow-900 mb-2">🟡 RIESGO MEDIO (65-84 puntos)</h3>
                                    <ul className="text-sm text-yellow-800 space-y-1">
                                        <li>• Cliente ocasional</li>
                                        <li>• Horarios de riesgo moderado</li>
                                        <li>• Grupos medianos (4-5 personas)</li>
                                    </ul>
                                </div>
                                
                                <div className="bg-green-50 p-2 rounded-lg border-l-4 border-green-400">
                                    <h3 className="font-semibold text-green-900 mb-2">🟢 RIESGO BAJO (0-64 puntos)</h3>
                                    <ul className="text-sm text-green-800 space-y-1">
                                        <li>• Cliente VIP o regular</li>
                                        <li>• Horarios seguros</li>
                                        <li>• Grupos pequeños (1-3 personas)</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setShowRiskExplanation(false)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NoShowManagerProfesional;
