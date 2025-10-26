// NoShowAlertCard.jsx - Card de Alarma Urgente para No-Shows (T-2h 15min)
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, Clock, User, Users, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

/**
 * Card de alarma urgente para reservas que requieren llamada inmediata
 * Se muestra cuando quedan 2h 15min antes de la reserva y no hay confirmación
 */
export default function NoShowAlertCard({ alert, onResolve, onAutoRelease }) {
    const [timeLeft, setTimeLeft] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    // Calcular tiempo restante hasta auto-liberación
    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const releaseTime = new Date(alert.auto_release_at);
            const diff = releaseTime - now;

            if (diff <= 0) {
                setTimeLeft('¡TIEMPO AGOTADO!');
                setIsUrgent(true);
                return;
            }

            const minutes = Math.floor(diff / 1000 / 60);
            const seconds = Math.floor((diff / 1000) % 60);

            if (minutes < 5) {
                setIsUrgent(true);
            }

            setTimeLeft(`${minutes}m ${seconds}s`);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [alert.auto_release_at]);

    // Marcar como confirmado (después de llamar exitosamente)
    const handleConfirm = async () => {
        try {
            await onResolve(alert.id, 'call_successful', 'Confirmado por llamada telefónica');
            toast.success(`Reserva de ${alert.customer_name} confirmada`);
        } catch (error) {
            toast.error('Error al confirmar reserva');
            console.error(error);
        }
    };

    // Marcar como no contactado (liberar mesa)
    const handleNoContact = async () => {
        try {
            await onResolve(alert.id, 'call_failed', 'No se consiguió contacto - Mesa liberada');
            toast.success('Reserva liberada y disponibilidad restaurada');
        } catch (error) {
            toast.error('Error al liberar reserva');
            console.error(error);
        }
    };

    return (
        <div className={`
            bg-gradient-to-r ${isUrgent ? 'from-red-600 to-orange-600' : 'from-red-500 to-orange-500'}
            rounded-xl p-6 text-white shadow-2xl border-4 
            ${isUrgent ? 'border-yellow-400 animate-pulse' : 'border-red-700'}
            transition-all duration-300
        `}>
            {/* Header con título y tiempo */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold">
                            {isUrgent ? '🚨 URGENTE' : '⚠️ ACCIÓN REQUERIDA'}
                        </h3>
                        <p className="text-sm text-white/90">Llamar AHORA para confirmar</p>
                    </div>
                </div>
                
                {/* Contador regresivo */}
                <div className={`
                    px-4 py-2 rounded-lg font-mono text-xl font-bold
                    ${isUrgent ? 'bg-yellow-400 text-red-900' : 'bg-white/20 backdrop-blur-sm'}
                `}>
                    <Clock className="w-5 h-5 inline mr-2" />
                    {timeLeft}
                </div>
            </div>

            {/* Información de la reserva */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <User className="w-5 h-5" />
                            <div>
                                <p className="text-xs text-white/70">Cliente</p>
                                <p className="font-bold text-lg">{alert.customer_name}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Phone className="w-5 h-5" />
                            <div>
                                <p className="text-xs text-white/70">Teléfono</p>
                                <p className="font-bold text-lg">{alert.customer_phone || 'Sin teléfono'}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-5 h-5" />
                            <div>
                                <p className="text-xs text-white/70">Hora reserva</p>
                                <p className="font-bold text-lg">{alert.reservation_time}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            <div>
                                <p className="text-xs text-white/70">Comensales</p>
                                <p className="font-bold text-lg">{alert.party_size} personas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instrucciones */}
            <div className="bg-yellow-400/20 border border-yellow-400/50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium">
                    📞 <strong>LLAMAR AHORA:</strong> Confirmar la reserva por teléfono. 
                    Si no se consigue contacto, la mesa se liberará automáticamente a las{' '}
                    <strong>{format(new Date(alert.auto_release_at), 'HH:mm', { locale: es })}</strong>
                </p>
            </div>

            {/* Botones de acción */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleConfirm}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all shadow-lg"
                >
                    <CheckCircle className="w-5 h-5" />
                    Confirmado
                </button>
                
                <button
                    onClick={handleNoContact}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold transition-all shadow-lg"
                >
                    <XCircle className="w-5 h-5" />
                    No Contactado
                </button>
            </div>

            {/* Info adicional */}
            <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                <span>Riesgo: <strong className="text-white">{alert.risk_score}%</strong></span>
                <span>ID Reserva: <strong className="text-white font-mono">{alert.reservation_id.slice(0, 8)}</strong></span>
            </div>
        </div>
    );
}

