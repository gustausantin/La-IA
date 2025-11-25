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

    // Ordenar bloques por prioridad (1 = más urgente)
    const bloquesOrdenados = [...bloques].sort((a, b) => a.prioridad - b.prioridad);

    // Auto-expandir el primero al inicio
    React.useEffect(() => {
        if (bloquesOrdenados.length > 0 && expandedId === null) {
            setExpandedId(bloquesOrdenados[0].id);
        }
    }, [bloquesOrdenados, expandedId]);

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
                gridTemplateColumns: 'minmax(350px, 32%) 1fr',
                height: '100vh',
                overflow: 'hidden'
            }}
        >
            {/* COLUMNA IZQUIERDA: Avatar con imagen de fondo */}
            <div 
                className="avatar-column"
                style={{
                    position: 'relative',
                    backgroundImage: workingModeUrl ? `url(${workingModeUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center top',
                    backgroundRepeat: 'no-repeat',
                    height: '100%',
                    width: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center top'
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

                {/* BOCADILLO: Dentro de la columna izquierda, desbordando hacia la derecha */}
                <motion.div
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
                    className="speech-bubble"
                    style={{
                        position: 'absolute',
                        top: '15%',
                        left: '105%',
                        width: '90%',
                        maxWidth: 'none',
                        zIndex: 100
                    }}
                >
                    {/* Contenido del bocadillo */}
                    <div 
                        className={`
                            ${config.bubbleBg} ${config.borderColor} 
                            backdrop-blur-md rounded-3xl shadow-2xl p-6
                            relative
                        `} 
                        style={{ 
                            borderWidth: '3px'
                        }}
                    >
                        {/* Triángulo que apunta a la boca (usando ::after) */}
                        <div 
                            className="absolute -left-3 top-6 w-0 h-0"
                            style={{
                                borderTop: '10px solid transparent',
                                borderBottom: '10px solid transparent',
                                borderRight: `15px solid ${config.tailBg}`
                            }}
                        ></div>
                        
                        {/* Borde del triángulo */}
                        <div 
                            className="absolute -left-4 top-6 w-0 h-0"
                            style={{
                                borderTop: '10px solid transparent',
                                borderBottom: '10px solid transparent',
                                borderRight: `15px solid ${config.tailBorder}`,
                                zIndex: -1
                            }}
                        ></div>
                        
                        {/* Efecto de brillo sutil */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
                        
                        <p className={`text-base md:text-lg font-medium ${config.accentColor} leading-relaxed relative z-10`}>
                            {mensaje}
                        </p>
                        {accion && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, duration: 0.3 }}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleAction(accion)}
                                className={`
                                    mt-4 w-full py-3 px-6 rounded-xl font-semibold text-white
                                    ${config.buttonBg}
                                    shadow-lg transition-all duration-200 relative z-10
                                `}
                            >
                                {accion.label || 'Acción'}
                            </motion.button>
                        )}
                    </div>
                </motion.div>

                {/* Nombre del agente (badge en la parte inferior izquierda) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="absolute bottom-24 left-6 z-30"
                >
                    <div className="inline-block bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border-2 border-gray-200">
                        <p className="text-xs text-gray-500 font-medium">Tu Asistente Virtual</p>
                        <p className={`text-xl font-bold ${config.accentColor}`}>{agentConfig.name}</p>
                    </div>
                </motion.div>

                {/* ACCIONES RÁPIDAS: Flotantes en la parte inferior con degradado */}
                <div 
                    className="quick-actions-overlay"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        padding: '20px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                        display: 'flex',
                        gap: '10px',
                        overflowX: 'auto',
                        zIndex: 30
                    }}
                >
                    {botonesAccionRapida.map((boton) => {
                        const IconComponent = boton.icon;
                        return (
                            <button
                                key={boton.id}
                                onClick={boton.onClick}
                                className="action-btn flex flex-col items-center justify-center p-3 bg-white/90 backdrop-blur-md rounded-lg border border-white/50 hover:border-blue-400/50 hover:bg-white transition-all duration-200 group shadow-lg flex-shrink-0"
                                style={{ minWidth: '100px' }}
                            >
                                <IconComponent className="w-6 h-6 text-gray-600 group-hover:text-blue-600 transition-colors mb-1" />
                                <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                                    {boton.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* COLUMNA DERECHA: Grid de datos */}
            <div 
                className="data-column"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    paddingTop: 0,
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    paddingBottom: '40px',
                    overflowY: 'auto',
                    backgroundColor: '#F8FAFC'
                }}
            >
                {/* Header con título */}
                <div className="data-header" style={{ marginTop: 0 }}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-2" style={{ marginTop: 0 }}>
                                La Oficina de {agentConfig.name}
                            </h1>
                            <p className="text-base text-gray-600">
                                {business?.name} • {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                        <button
                            onClick={refresh}
                            className="text-sm text-gray-700 hover:text-gray-900 font-medium flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualizar
                        </button>
                    </div>

                    {/* Título de la sección - Bandeja de Entrada */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">📋 Bandeja de Entrada</h2>
                        <p className="text-sm text-gray-600">
                            {bloquesOrdenados.length} informe(s) • Ordenados por prioridad
                        </p>
                    </div>
                </div>

                {/* Grid de Dossiers (Acordeones) - 2 COLUMNAS exactas */}
                {bloquesOrdenados.length > 0 ? (
                    <div 
                        className="cards-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '20px',
                            alignItems: 'start',
                            flexGrow: 1,
                            alignContent: 'start'
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

                {/* Footer con metadata */}
                {snapshot?.metadata && (
                    <div className="mt-8 text-center text-xs text-gray-500">
                        <p>
                            Última actualización: {new Date(snapshot.metadata.timestamp).toLocaleTimeString('es-ES')} 
                            {' • '}
                            {snapshot.metadata.tokens_used} tokens 
                            {' • '}
                            ${snapshot.metadata.cost_usd.toFixed(6)} USD
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
