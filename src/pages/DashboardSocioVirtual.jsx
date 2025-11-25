// ====================================
// DASHBOARD SOCIO VIRTUAL v5.0 - "EL ESCRITORIO INTERACTIVO"
// Avatar GIGANTE como fondo + Glassmorphism + Dossiers
// ====================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

// Hooks personalizados
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import { useActionExecutor } from '../hooks/useActionExecutor';

// Componentes del dashboard
import LuaAvatarLarge from '../components/dashboard/LuaAvatarLarge';
import BloqueAcordeon from '../components/dashboard/BloqueAcordeon';

// Configuración de avatares
import { getAvatarById } from '../config/avatars';

// Iconos para botones de acción rápida
import { Calendar, DollarSign, AlertTriangle, Users, BarChart3 } from 'lucide-react';

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

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mb-4"></div>
                    <p className="text-white text-lg font-medium">Analizando el estado de tu negocio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header con título dinámico */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 px-6 py-4 shadow-2xl">
                <div className="max-w-[1920px] mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            El Despacho de {agentConfig.name}
                        </h1>
                        <p className="text-sm text-slate-400">
                            {business?.name} • {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <button
                        onClick={refresh}
                        className="text-sm text-slate-300 hover:text-white font-medium flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Actualizar
                    </button>
                </div>
            </div>

            {/* ESCRITORIO INTERACTIVO */}
            <div className="h-screen flex overflow-hidden">
                
                {/* ZONA IZQUIERDA (40%): Avatar GIGANTE como fondo */}
                <div className="w-full lg:w-[40%] relative">
                    <LuaAvatarLarge
                        avatarUrl={agentConfig.avatar_url}
                        agentName={agentConfig.name}
                        mensaje={mensaje}
                        accion={accion}
                        mood={mood}
                        onActionClick={handleAction}
                    />
                </div>

                {/* ZONA DERECHA (60%): Glassmorphism + Pila de Dossiers */}
                <div className="w-full lg:w-[60%] relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl overflow-y-auto">
                    
                    {/* Contenedor de Dossiers con efecto "tablet de cristal" */}
                    <div className="p-6 space-y-4">
                        
                        {/* Título de la sección */}
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <h2 className="text-xl font-bold text-white mb-1">📋 Bandeja de Entrada</h2>
                            <p className="text-sm text-slate-300">
                                {bloquesOrdenados.length} informe(s) • Ordenados por prioridad
                            </p>
                        </div>

                        {/* Pila de Dossiers (Acordeones) */}
                        {bloquesOrdenados.length > 0 ? (
                            <div className="space-y-3">
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
                            <div className="bg-white/5 backdrop-blur-md rounded-xl p-8 text-center border border-white/10">
                                <p className="text-slate-400 mb-4">No hay información disponible</p>
                                <button
                                    onClick={refresh}
                                    className="text-blue-400 hover:text-blue-300 font-medium"
                                >
                                    Intentar de nuevo
                                </button>
                            </div>
                        )}

                        {/* LÍNEA DIVISORIA - "Borde del Escritorio" */}
                        <div className="my-8">
                            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                        </div>

                        {/* BOTONES DE ACCIÓN RÁPIDA */}
                        <div>
                            <h3 className="text-center text-sm font-semibold text-slate-300 mb-4">
                                Acciones Rápidas
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {botonesAccionRapida.map((boton) => {
                                    const IconComponent = boton.icon;
                                    return (
                                        <button
                                            key={boton.id}
                                            onClick={boton.onClick}
                                            className="flex flex-col items-center justify-center p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:border-blue-400/50 hover:bg-white/10 transition-all duration-200 group"
                                        >
                                            <IconComponent className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors mb-2" />
                                            <span className="text-xs font-medium text-slate-300 text-center">
                                                {boton.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer con metadata */}
                        {snapshot?.metadata && (
                            <div className="mt-8 text-center text-xs text-slate-500">
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
            </div>
        </div>
    );
}
