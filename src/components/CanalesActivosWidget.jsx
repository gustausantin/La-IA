// CanalesActivosWidget.jsx - Widget de Canales Activos para Dashboard (COMPACTO)
import React, { useEffect } from 'react';
import { Link as LinkIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Widget que muestra el estado de los 5 canales de comunicación
 * y el número de reservas recibidas por cada canal HOY
 * 
 * @param {Object} channelStats - Estadísticas de canales desde useChannelStats
 * @param {Object} channelCounts - Contador de reservas por canal HOY
 */
export const CanalesActivosWidget = ({ channelStats, channelCounts = {} }) => {
    const navigate = useNavigate();
    
    // 🔍 DEBUG: Ver qué canales están activos
    useEffect(() => {
        console.log('🔗 CanalesActivosWidget - channelStats:', channelStats);
        console.log('🔗 CanalesActivosWidget - channelCounts:', channelCounts);
    }, [channelStats, channelCounts]);
    
    // Iconos para cada canal
    const getChannelIcon = (key) => {
        switch(key) {
            case 'vapi': return '📞';
            case 'whatsapp': return '💬';
            case 'instagram': return '📷';
            case 'facebook': return '👥';
            case 'webchat': return '💻';
            case 'manual': return '✍️';
            default: return '📡';
        }
    };
    
    // ✅ 6 canales del sistema (5 automáticos + Manual)
    const channels = [
        { 
            key: 'vapi', 
            name: 'VAPI', 
            active: channelStats?.validChannels?.includes('vapi') || false,
            countKey: 'vapi'
        },
        { 
            key: 'whatsapp', 
            name: 'WhatsApp', 
            active: channelStats?.validChannels?.includes('whatsapp') || false,
            countKey: 'whatsapp'
        },
        { 
            key: 'instagram', 
            name: 'Instagram', 
            active: channelStats?.validChannels?.includes('instagram') || false,
            countKey: 'instagram'
        },
        { 
            key: 'facebook', 
            name: 'Facebook', 
            active: channelStats?.validChannels?.includes('facebook') || false,
            countKey: 'facebook'
        },
        { 
            key: 'webchat', 
            name: 'Web Chat', 
            active: channelStats?.validChannels?.includes('webchat') || channelStats?.validChannels?.includes('web_chat') || false,
            countKey: 'webchat'
        },
        { 
            key: 'manual', 
            name: 'Manual', 
            active: true, // Manual siempre activo (reservas desde Dashboard)
            countKey: 'manual'
        }
    ];

    // Navegación directa a pestaña de canales
    const handleManageChannels = () => {
        navigate('/configuracion', { state: { activeTab: 'channels' } });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border p-4">
            {/* Header compacto */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <LinkIcon className="w-4 h-4 text-white" />
                    </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900">Canales Activos</h3>
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                            📅 CREADAS HOY
                        </span>
                    </div>
                </div>
                </div>
            </div>

            {/* Contador principal compacto - SIEMPRE sobre 6 (5 automáticos + Manual) */}
            <div className="text-center mb-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg py-1.5">
                <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                    {channels.filter(ch => ch.active).length}/6
                </p>
                <p className="text-xs text-gray-600 font-medium">canales operativos</p>
            </div>

            {/* Lista de canales MÁS COMPACTA */}
            <div className="space-y-1 mb-2">
                {channels.map(channel => {
                    // ✅ Obtener contador REAL desde channelCounts
                    let count = channelCounts[channel.countKey] || 0;
                    
                    // Para webchat, buscar también 'webchat' además de 'web'
                    if (channel.key === 'webchat' && count === 0) {
                        count = channelCounts['webchat'] || 0;
                    }
                    
                    // 🚨 IMPORTANTE: Si el canal NO está activo, mostrar 0
                    // (las reservas con ese canal son huérfanas de cuando estaba activo)
                    if (!channel.active) {
                        count = 0;
                    }
                    
                    return (
                        <div 
                            key={channel.key} 
                            className="flex items-center justify-between py-1 px-2 rounded border"
                            style={{
                                backgroundColor: channel.active ? '#f0fdf4' : '#f9fafb',
                                borderColor: channel.active ? '#bbf7d0' : '#e5e7eb'
                            }}
                        >
                            <div className="flex items-center gap-2">
                                {/* Semáforo */}
                                <div 
                                    className={`w-3 h-3 rounded-full ${
                                        channel.active 
                                            ? 'bg-green-500 animate-pulse' 
                                            : 'bg-red-500'
                                    }`}
                                    title={channel.active ? 'Operativo' : 'Inactivo'}
                                />
                                {/* Icono + Nombre MÁS COMPACTO */}
                                <span className="text-sm leading-none">{getChannelIcon(channel.key)}</span>
                                <span className={`text-xs font-semibold ${
                                    channel.active ? 'text-gray-900' : 'text-gray-500'
                                }`}>
                                    {channel.name}
                                </span>
                            </div>
                            {/* Contador con label */}
                            <div className="text-right">
                                <span className={`text-base font-bold tabular-nums block ${
                                    count > 0 ? 'text-blue-600' : 'text-gray-400'
                                }`}>
                                    {count}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {count === 1 ? 'reserva' : 'reservas'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Botón con MISMO ancho que botones de arriba */}
            <button 
                onClick={handleManageChannels}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all text-sm font-semibold shadow-md hover:shadow-lg"
            >
                Gestionar Canales <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    );
};

export default CanalesActivosWidget;

