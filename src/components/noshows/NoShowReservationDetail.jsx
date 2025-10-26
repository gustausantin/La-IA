// NoShowReservationDetail.jsx - Modal con detalles de riesgo por reserva v2
import React, { useMemo } from 'react';
import { X, AlertTriangle, User, Phone, Clock, Users, Calendar, MessageSquare, TrendingUp, Shield, PhoneCall } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Modal que muestra detalles completos de una reserva en riesgo
 * Incluye factores de riesgo, acciones recomendadas y botones de acción
 */
export default function NoShowReservationDetail({ reservation, onClose, onSendWhatsApp, onMarkConfirmed }) {
    if (!reservation) return null;

    // Calcular tiempo restante hasta la reserva
    const timeUntilReservation = useMemo(() => {
        try {
            const now = new Date();
            const reservationDateTime = parseISO(`${reservation.reservation_date}T${reservation.reservation_time}`);
            const minutesUntil = differenceInMinutes(reservationDateTime, now);
            return minutesUntil;
        } catch (error) {
            console.error('Error calculando tiempo hasta reserva:', error);
            return 999; // Si hay error, asumimos que hay mucho tiempo
        }
    }, [reservation.reservation_date, reservation.reservation_time]);

    // Determinar si es urgente basado en el risk_level y tiempo
    const isUrgentCallWindow = (reservation.risk_level === 'high' || reservation.risk_score >= 80) && timeUntilReservation <= 135;

    // Determinar color según nivel de riesgo
    const getRiskColor = (score) => {
        if (score >= 70) return 'text-red-600 bg-red-50 border-red-200';
        if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-green-600 bg-green-50 border-green-200';
    };

    const getRiskLabel = (score) => {
        if (score >= 70) return 'Alto Riesgo';
        if (score >= 40) return 'Riesgo Medio';
        return 'Riesgo Bajo';
    };

    // Interpretar factores de riesgo desde JSONB
    const interpretRiskFactors = (factors) => {
        if (!factors || !Array.isArray(factors)) return [];
        
        const interpretations = {
            'historial_noshows': {
                icon: '🔴',
                label: 'Cliente con historial de no-shows',
                severity: 'high'
            },
            'cliente_nuevo': {
                icon: '🔴',
                label: 'Cliente nuevo (primera visita)',
                severity: 'high'
            },
            'reserva_reciente': {
                icon: '🔴',
                label: 'Reserva realizada hace menos de 2 horas',
                severity: 'high'
            },
            'grupo_grande': {
                icon: '🟡',
                label: 'Grupo grande sin señal',
                severity: 'medium'
            },
            'horario_pico': {
                icon: '🟡',
                label: 'Horario de alta demanda',
                severity: 'medium'
            },
            'canal_whatsapp': {
                icon: '🟢',
                label: 'Reserva por WhatsApp (media confianza)',
                severity: 'low'
            },
            'canal_telefono': {
                icon: '🟡',
                label: 'Reserva por teléfono',
                severity: 'medium'
            }
        };

        return factors.map(factor => interpretations[factor] || {
            icon: '⚪',
            label: factor,
            severity: 'unknown'
        });
    };

    const riskFactors = interpretRiskFactors(reservation.riskFactors || reservation.risk_factors);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Detalles de Riesgo</h2>
                            <p className="text-white/90">{reservation.customer_name}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Score de Riesgo */}
                    <div className={`mb-6 p-4 rounded-xl border-2 ${getRiskColor(reservation.riskScore || reservation.risk_score)}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold opacity-70 uppercase">Score de Riesgo</p>
                                <p className="text-3xl font-bold">{reservation.riskScore || reservation.risk_score}%</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold">{getRiskLabel(reservation.riskScore || reservation.risk_score)}</p>
                                <Shield className="w-8 h-8 ml-auto mt-1" />
                            </div>
                        </div>
                    </div>

                    {/* Información de la reserva */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-700 mb-2">
                                <User className="w-5 h-5" />
                                <span className="text-sm font-semibold">Cliente</span>
                            </div>
                            <p className="font-bold text-gray-900">{reservation.customer_name}</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-700 mb-2">
                                <Phone className="w-5 h-5" />
                                <span className="text-sm font-semibold">Teléfono</span>
                            </div>
                            {reservation.customer_phone ? (
                                <a 
                                    href={`tel:${reservation.customer_phone}`}
                                    className="font-bold text-2xl text-blue-600 hover:text-blue-800 underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {reservation.customer_phone}
                                </a>
                            ) : (
                                <p className="font-bold text-gray-400">Sin teléfono</p>
                            )}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-700 mb-2">
                                <Clock className="w-5 h-5" />
                                <span className="text-sm font-semibold">Hora</span>
                            </div>
                            <p className="font-bold text-gray-900">{reservation.reservation_time?.slice(0, 5) || reservation.reservation_time}</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-700 mb-2">
                                <Users className="w-5 h-5" />
                                <span className="text-sm font-semibold">Comensales</span>
                            </div>
                            <p className="font-bold text-gray-900">{reservation.party_size} personas</p>
                        </div>

                        {reservation.reservation_date && (
                            <div className="bg-gray-50 rounded-lg p-4 col-span-2">
                                <div className="flex items-center gap-2 text-gray-700 mb-2">
                                    <Calendar className="w-5 h-5" />
                                    <span className="text-sm font-semibold">Fecha</span>
                                </div>
                                <p className="font-bold text-gray-900">
                                    {format(new Date(reservation.reservation_date), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Factores de Riesgo */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Factores de Riesgo Detectados
                        </h3>
                        <div className="space-y-2">
                            {riskFactors.length > 0 ? (
                                riskFactors.map((factor, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                                            factor.severity === 'high' ? 'bg-red-50 border-red-200' :
                                            factor.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                                            'bg-green-50 border-green-200'
                                        }`}
                                    >
                                        <span className="text-2xl">{factor.icon}</span>
                                        <span className="text-sm font-medium text-gray-900">{factor.label}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm">No se detectaron factores de riesgo específicos</p>
                            )}
                        </div>
                    </div>

                    {/* Acciones Recomendadas */}
                    <div className={`border-2 rounded-lg p-4 ${
                        isUrgentCallWindow 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-blue-50 border-blue-200'
                    }`}>
                        <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${
                            isUrgentCallWindow ? 'text-red-900' : 'text-blue-900'
                        }`}>
                            {isUrgentCallWindow ? (
                                <>
                                    <PhoneCall className="w-5 h-5 animate-pulse" />
                                    🚨 ACCIÓN URGENTE REQUERIDA
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="w-5 h-5" />
                                    Acciones Recomendadas
                                </>
                            )}
                        </h3>
                        <ul className={`space-y-2 text-sm ${isUrgentCallWindow ? 'text-red-800' : 'text-blue-800'}`}>
                            {isUrgentCallWindow ? (
                                <>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600 font-bold">📞</span>
                                        <span className="font-bold">LLAMAR AHORA AL CLIENTE por teléfono</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">✓</span>
                                        <span>Si confirma → Clic en "Marcar Confirmado"</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">✓</span>
                                        <span>Si no contesta → Esperar hasta T-2h (auto-liberación)</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    {(reservation.riskScore || reservation.risk_score) >= 70 && (
                                        <>
                                            <li className="flex items-start gap-2">
                                                <span className="text-blue-600">✓</span>
                                                <span>Enviar confirmación por WhatsApp <strong>inmediatamente</strong></span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-blue-600">✓</span>
                                                <span>Llamar 2 horas antes si no responde al WhatsApp</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-blue-600">✓</span>
                                                <span>Considerar solicitar señal de reserva</span>
                                            </li>
                                        </>
                                    )}
                                    {(reservation.riskScore || reservation.risk_score) >= 40 && (reservation.riskScore || reservation.risk_score) < 70 && (
                                        <>
                                            <li className="flex items-start gap-2">
                                                <span className="text-blue-600">✓</span>
                                                <span>Enviar WhatsApp de recordatorio 2 horas antes</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-blue-600">✓</span>
                                                <span>Monitorear respuesta del cliente</span>
                                            </li>
                                        </>
                                    )}
                                    {(reservation.riskScore || reservation.risk_score) < 40 && (
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-600">✓</span>
                                            <span>Enviar recordatorio estándar (opcional)</span>
                                        </li>
                                    )}
                                </>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Footer con acciones */}
                <div className="bg-gray-50 p-6 border-t border-gray-200 flex gap-3">
                    {/* Solo mostrar "Enviar WhatsApp" si NO estamos en ventana crítica */}
                    {!isUrgentCallWindow && (
                        <button
                            onClick={() => onSendWhatsApp(reservation)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all shadow-sm"
                        >
                            <MessageSquare className="w-5 h-5" />
                            Enviar WhatsApp
                        </button>
                    )}
                    
                    <button
                        onClick={() => onMarkConfirmed(reservation)}
                        className={`${isUrgentCallWindow ? 'flex-1' : 'flex-1'} flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all shadow-sm`}
                    >
                        <Shield className="w-5 h-5" />
                        Marcar Confirmado
                    </button>
                    
                    <button
                        onClick={onClose}
                        className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

