// ====================================
// DASHBOARD SOCIO VIRTUAL v7.1 - "EL ESCRITORIO INTERACTIVO"
// Estructura CSS Grid limpia + Bocadillo desbordando desde columna izquierda
// ====================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '../contexts/AuthContext';

// Hooks personalizados
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import { useActionExecutor } from '../hooks/useActionExecutor';

// Componentes del dashboard
import BloqueAcordeon from '../components/dashboard/BloqueAcordeon';

// Configuración de avatares
import { getAvatarById } from '../config/avatars';

// Iconos para botones de acción rápida
import { Calendar, DollarSign, AlertTriangle, Users, BarChart3, RefreshCw } from 'lucide-react';

export default function DashboardSocioVirtual() {
    const { business, user } = useAuthContext();
    const navigate = useNavigate();
    
    const { snapshot, loading, refresh } = useDashboardSnapshot(business?.id);
    const { executeAction, executing } = useActionExecutor();

    // Estado para controlar qué acordeón está expandido
    const [expandedId, setExpandedId] = useState(null);
    
    // Estado para la animación de "typing..."
    const [showTyping, setShowTyping] = useState(true);

    // Obtener configuración del agente desde business.settings
    const agentConfig = React.useMemo(() => {
        if (!business) {
            const defaultAvatar = getAvatarById('elena');
            return {
                name: defaultAvatar.name || 'Lua',
                avatar_url: defaultAvatar.avatar_url,
                avatar_id: 'elena'
            };
        }

        if (business.settings?.agent) {
            const agent = business.settings.agent;
            
            if (agent.avatar_url) {
                return {
                    name: agent.name || 'Lua',
                    avatar_url: agent.avatar_url,
                    avatar_id: agent.avatar_id
                };
            }
            
            if (agent.avatar_id) {
                const avatar = getAvatarById(agent.avatar_id);
                return {
                    name: agent.name || avatar.name || 'Lua',
                    avatar_url: avatar.avatar_url,
                    avatar_id: agent.avatar_id
                };
            }
            
            if (agent.name) {
                const defaultAvatar = getAvatarById('elena');
                return {
                    name: agent.name,
                    avatar_url: defaultAvatar.avatar_url,
                    avatar_id: 'elena'
                };
            }
        }
        
        const defaultAvatar = getAvatarById('elena');
        return {
            name: defaultAvatar.name || 'Lua',
            avatar_url: defaultAvatar.avatar_url,
            avatar_id: 'elena'
        };
    }, [business]);

    const handleAction = async (action) => {
        console.log('🎬 Ejecutando acción:', action);
        
        // TIPO 1: Llamar por teléfono
        if (action.tipo === 'call' && action.payload?.telefono) {
            window.open(`tel:${action.payload.telefono}`, '_self');
            return;
        }
        
        // TIPO 2: Navegar a otra ruta
        if (action.tipo === 'navigate' && action.payload?.route) {
            navigate(action.payload.route);
            return;
        }
        
        // TIPO 3: WhatsApp
        if (action.tipo === 'whatsapp' && action.payload?.telefono) {
            const mensaje = action.payload.mensaje || '';
            window.open(`https://wa.me/${action.payload.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`, '_blank');
            return;
        }
        
        // TIPO 4: Ejecutar endpoint (transferir cita, etc.)
        if (action.tipo === 'endpoint') {
            const result = await executeAction(action);
            if (result?.success) {
                setTimeout(refresh, 2000);
            }
            return;
        }
        
        // Fallback: usar el ejecutor genérico
        const result = await executeAction(action);
        if (result?.success) {
            setTimeout(refresh, 2000);
        }
    };

    // Botones de acción rápida (los "5 sagrados")
    const botonesAccionRapida = [
        {
            id: 'agenda-hoy',
            label: '¿Qué tengo hoy?',
            icon: Calendar,
            onClick: () => navigate('/reservas')
        },
        {
            id: 'caja',
            label: '¿Cómo va la caja?',
            icon: DollarSign,
            onClick: () => navigate('/facturacion')
        },
        {
            id: 'riesgos',
            label: '¿Hay riesgos?',
            icon: AlertTriangle,
            onClick: () => navigate('/no-shows')
        },
        {
            id: 'equipo',
            label: '¿Quién falta?',
            icon: Users,
            onClick: () => navigate('/horario')
        },
        {
            id: 'resumen',
            label: 'Ver resumen',
            icon: BarChart3,
            onClick: () => window.location.reload()
        }
    ];

    // Datos del snapshot
    const mensaje = snapshot?.mensaje || "Analizando tu negocio...";
    const accion = snapshot?.accion || null;
    const mood = snapshot?.mood || "zen";
    const bloques = snapshot?.bloques || [];
    const data = snapshot?.data || {};
    
    // Simular animación de typing (debe estar después de declarar mensaje)
    React.useEffect(() => {
        if (snapshot && mensaje) {
            setShowTyping(true);
            const timer = setTimeout(() => setShowTyping(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [snapshot, mensaje]);

    // Ordenar bloques por prioridad (1 = más urgente)
    const bloquesOrdenados = [...bloques].sort((a, b) => a.prioridad - b.prioridad);

    // No auto-expandir nada - todos cerrados al inicio

    // Obtener URL del avatar en modo "working"
    const getWorkingModeAvatar = (url) => {
        if (!url) return null;
        if (url.includes('_') && url.includes('.1.png')) return url;
        const match = url.match(/Avatar_(\d+)\.png/);
        if (match) {
            const number = match[1];
            return url.replace(`Avatar_${number}.png`, `Avatar_${number}.1.png`);
        }
        return url;
    };

    const workingModeUrl = getWorkingModeAvatar(agentConfig.avatar_url);

    // Colores según el mood para el bocadillo
    const moodConfig = {
        zen: {
            bubbleBg: 'bg-green-50',
            borderColor: 'border-green-300',
            accentColor: 'text-green-700',
            buttonBg: 'bg-green-500 hover:bg-green-600',
            tailBg: '#f0fdf4',
            tailBorder: '#86efac'
        },
        happy: {
            bubbleBg: 'bg-blue-50',
            borderColor: 'border-blue-300',
            accentColor: 'text-blue-700',
            buttonBg: 'bg-blue-500 hover:bg-blue-600',
            tailBg: '#eff6ff',
            tailBorder: '#93c5fd'
        },
        focused: {
            bubbleBg: 'bg-purple-50',
            borderColor: 'border-purple-300',
            accentColor: 'text-purple-700',
            buttonBg: 'bg-purple-500 hover:bg-purple-600',
            tailBg: '#faf5ff',
            tailBorder: '#c4b5fd'
        },
        serious: {
            bubbleBg: 'bg-orange-50',
            borderColor: 'border-orange-300',
            accentColor: 'text-orange-700',
            buttonBg: 'bg-orange-500 hover:bg-orange-600',
            tailBg: '#fff7ed',
            tailBorder: '#fdba74'
        },
        urgent: {
            bubbleBg: 'bg-red-50',
            borderColor: 'border-red-300',
            accentColor: 'text-red-700',
            buttonBg: 'bg-red-500 hover:bg-red-600',
            tailBg: '#fef2f2',
            tailBorder: '#fca5a5'
        }
    };

    const config = moodConfig[mood] || moodConfig.zen;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600 mb-4"></div>
                    <p className="text-gray-700 text-lg font-medium">Analizando el estado de tu negocio...</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="dashboard-container"
            style={{
                display: 'grid',
                gridTemplateColumns: '38% 1fr',
                height: '100vh',
                overflow: 'hidden'
            }}
        >
            {/* COLUMNA IZQUIERDA: Avatar con imagen de fondo */}
            <div 
                className="avatar-column"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%',
                    backgroundColor: '#F3F4F6'
                }}
            >
                {/* Foto del avatar con marco elegante */}
                <div 
                    style={{
                        position: 'relative',
                        height: '75%',
                        width: '100%',
                        flexShrink: 0,
                        padding: '12px',
                        backgroundColor: '#F3F4F6'
                    }}
                >
                    <div
                        style={{
                            backgroundImage: workingModeUrl ? `url(${workingModeUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center 15%',
                            backgroundRepeat: 'no-repeat',
                            backgroundColor: '#F3F4F6',
                            height: '100%',
                            width: '100%',
                            borderRadius: '16px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), inset 0 0 0 3px rgba(255, 255, 255, 0.3)',
                            border: '2px solid rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        {/* Indicador de "en línea" (esquina superior derecha) */}
                        <div className="absolute top-6 right-6 z-30">
                            <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border-2 border-green-200">
                                <div className="relative">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75"></div>
                                </div>
                                <span className="text-xs font-semibold text-green-700">En línea</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* COLUMNA DERECHA: Grid de datos */}
            <div 
                className="data-column"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    gap: '18px',
                    height: '100vh',
                    maxWidth: '1080px',
                    margin: '0 auto',
                    padding: '18px 30px 18px 50px',
                    overflowY: 'auto',
                    backgroundColor: '#F3F4F6',
                    width: '100%'
                }}
            >
                {/* Header con título - ARRIBA */}
                <div className="data-header" style={{ marginTop: 0, position: 'relative' }}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 
                                className="font-black tracking-tight mb-3"
                                style={{ 
                                    marginTop: 0,
                                    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    textShadow: '0 0 30px rgba(102, 126, 234, 0.3)',
                                    lineHeight: '1.2'
                                }}
                            >
                                La Oficina de {agentConfig.name}
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full border-2 border-purple-200 shadow-sm">
                                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                                    <span className="text-sm font-bold text-purple-700">
                                        {business?.name}
                                    </span>
                                </div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
                                    <span className="text-sm font-semibold text-gray-700">
                                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={refresh}
                            className="text-sm text-white font-bold flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualizar
                        </button>
                    </div>

                    {/* BOCADILLO GRANDE Y PROMINENTE */}
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
                        className="speech-bubble"
                    style={{
                        position: 'relative',
                        marginTop: '40px',
                        marginLeft: '0px',
                        marginRight: 'auto',
                        maxWidth: '92%',
                        zIndex: 100
                    }}
                    >
                        {/* Contenido del bocadillo */}
                        <div 
                            className={`
                                ${config.bubbleBg} ${config.borderColor} 
                                backdrop-blur-md rounded-2xl p-6
                                relative
                            `} 
                            style={{ 
                                borderWidth: '3px',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'
                            }}
                        >
                            {/* Triángulo pronunciado que apunta hacia la cara de Lua (estilo cómic) */}
                            <div 
                                className="absolute w-0 h-0"
                                style={{
                                    bottom: '20px',
                                    left: '-40px',
                                    borderStyle: 'solid',
                                    borderWidth: '20px 40px 20px 0',
                                    borderColor: `transparent ${config.tailBg} transparent transparent`,
                                    filter: 'drop-shadow(-2px 0 3px rgba(0,0,0,0.08))',
                                    transform: 'translateY(0)'
                                }}
                            ></div>
                            
                            {/* Borde del triángulo */}
                            <div 
                                className="absolute w-0 h-0"
                                style={{
                                    bottom: '20px',
                                    left: '-42px',
                                    borderStyle: 'solid',
                                    borderWidth: '20px 40px 20px 0',
                                    borderColor: `transparent ${config.tailBorder} transparent transparent`,
                                    zIndex: -1
                                }}
                            ></div>
                            
                            {/* Efecto de brillo sutil */}
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
                            
                            {showTyping ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <motion.div 
                                            className="w-2 h-2 bg-gray-400 rounded-full"
                                            animate={{ scale: [1, 1.3, 1] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                                        />
                                        <motion.div 
                                            className="w-2 h-2 bg-gray-400 rounded-full"
                                            animate={{ scale: [1, 1.3, 1] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                                        />
                                        <motion.div 
                                            className="w-2 h-2 bg-gray-400 rounded-full"
                                            animate={{ scale: [1, 1.3, 1] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                                        />
                                    </div>
                                    <span className={`text-sm font-medium ${config.accentColor}`}>
                                        Analizando...
                                    </span>
                                </div>
                            ) : (
                                <motion.p 
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4 }}
                                    className={`text-base font-semibold ${config.accentColor} leading-relaxed relative z-10`}
                                >
                                    {mensaje}
                                </motion.p>
                            )}
                            {accion && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5, duration: 0.3 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleAction(accion)}
                                            className={`
                                        mt-3 w-full py-2 px-4 rounded-lg font-semibold text-white text-sm
                                        ${config.buttonBg}
                                        shadow-md transition-all duration-200 relative z-10
                                    `}
                                >
                                    {accion.label || 'Acción'}
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Sección Bandeja - Con más espacio arriba */}
                <div className="bottom-section bandeja-container" style={{ marginTop: '48px', paddingBottom: '40px' }}>
                    {/* Contador de informes - Elegante y discreto */}
                    <div className="mb-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 rounded-full border border-purple-200/50">
                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                                {bloquesOrdenados.length} {bloquesOrdenados.length === 1 ? 'Informe' : 'Informes'}
                            </span>
                        </div>
                    </div>

                    {/* Grid de Dossiers (Acordeones) - 2 COLUMNAS exactas */}
                    {bloquesOrdenados.length > 0 ? (
                        <div 
                            className="cards-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '14px',
                                alignItems: 'start'
                            }}
                        >
                            {bloquesOrdenados.map((bloque) => (
                                <BloqueAcordeon
                                    key={bloque.id}
                                    id={bloque.id}
                                    titulo={bloque.id}
                                    textoColapsado={bloque.texto_colapsado}
                                    prioridad={bloque.prioridad}
                                    data={data}
                                    isExpanded={expandedId === bloque.id}
                                    onToggle={() => setExpandedId(expandedId === bloque.id ? null : bloque.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-sm">
                            <p className="text-gray-700 mb-4">No hay información disponible</p>
                            <button
                                onClick={refresh}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
