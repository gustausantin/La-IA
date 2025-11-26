// ====================================
// DASHBOARD SOCIO VIRTUAL v7.1 - "EL ESCRITORIO INTERACTIVO"
// Estructura CSS Grid limpia + Bocadillo desbordando desde columna izquierda
// ====================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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
    
    // 🔮 Estado para preview de mañana
    const [previewManana, setPreviewManana] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    
    // ✅ Estado para forzar re-render cuando se actualiza el agente
    const [agentUpdateKey, setAgentUpdateKey] = useState(0);
    // ✅ Estado local para el business (para forzar actualización inmediata)
    const [localBusiness, setLocalBusiness] = useState(business);

    // Obtener configuración del agente desde business.settings
    // ✅ Usa localBusiness para actualización inmediata
    const agentConfig = React.useMemo(() => {
        const currentBusiness = localBusiness || business;
        
        console.log('🔄 Dashboard: Recalculando agentConfig', {
            hasBusiness: !!currentBusiness,
            agentId: currentBusiness?.settings?.agent?.avatar_id,
            agentName: currentBusiness?.settings?.agent?.name,
            agentUrl: currentBusiness?.settings?.agent?.avatar_url,
            usingLocal: !!localBusiness
        });
        
        if (!currentBusiness) {
            const defaultAvatar = getAvatarById('elena');
            return {
                name: defaultAvatar.name || 'Lua',
                avatar_url: defaultAvatar.avatar_url,
                avatar_id: 'elena'
            };
        }

        if (currentBusiness.settings?.agent) {
            const agent = currentBusiness.settings.agent;
            
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
    }, [
        localBusiness?.id, // ✅ Usa localBusiness
        localBusiness?.settings?.agent?.avatar_id,
        localBusiness?.settings?.agent?.avatar_url,
        localBusiness?.settings?.agent?.name,
        business?.id, // También depende de business por si acaso
        agentUpdateKey // ✅ Key para forzar recálculo cuando se actualiza el agente
    ]);
    
    // ✅ Sincronizar localBusiness con business del contexto
    useEffect(() => {
        if (business) {
            setLocalBusiness(business);
        }
    }, [business]);
    
    // ✅ Listener OPTIMIZADO para actualización del agente (con debounce)
    useEffect(() => {
        let debounceTimer = null;
        let isReloading = false; // Flag para evitar recargas simultáneas
        
        const handleAgentUpdate = async (event) => {
            // Si ya hay una recarga en progreso, ignorar
            if (isReloading) {
                console.log('⏭️ Dashboard: Recarga ya en progreso, ignorando evento');
                return;
            }
            
            // Debounce: esperar 100ms antes de procesar (consolidar múltiples eventos)
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            
            debounceTimer = setTimeout(async () => {
                const businessIdToUse = business?.id || localBusiness?.id;
                
                if (!businessIdToUse) {
                    console.warn('⚠️ Dashboard: No hay business.id disponible');
                    return;
                }
                
                isReloading = true;
                console.log('🔄 Dashboard: Recargando business después de actualización del agente...');
                
                try {
                    // ✅ RECARGAR DIRECTAMENTE desde Supabase
                    const { data: updatedBusiness, error } = await supabase
                        .from('businesses')
                        .select('*')
                        .eq('id', businessIdToUse)
                        .single();
                    
                    if (error) {
                        console.error('❌ Dashboard: Error al recargar business:', error);
                        isReloading = false;
                        return;
                    }
                    
                    console.log('✅ Dashboard: Business actualizado:', {
                        agentId: updatedBusiness?.settings?.agent?.avatar_id,
                        agentName: updatedBusiness?.settings?.agent?.name
                    });
                    
                    // Actualizar el estado local
                    setLocalBusiness(updatedBusiness);
                    
                    // Forzar re-render
                    setAgentUpdateKey(prev => prev + 1);
                    
                } catch (error) {
                    console.error('❌ Dashboard: Error en handleAgentUpdate:', error);
                } finally {
                    isReloading = false;
                }
            }, 100); // Debounce de 100ms
        };
        
        window.addEventListener('agent-updated', handleAgentUpdate);
        
        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            window.removeEventListener('agent-updated', handleAgentUpdate);
        };
    }, [business?.id, localBusiness?.id]);

    // 🔮 Cargar preview de mañana DESPUÉS de que se cargue el snapshot de hoy
    useEffect(() => {
        const loadPreviewManana = async () => {
            // Solo cargar si el snapshot de hoy ya está cargado
            if (!snapshot || loading || !business?.id) return;
            
            setLoadingPreview(true);
            
            try {
                // Calcular fecha de mañana
                const manana = new Date();
                manana.setDate(manana.getDate() + 1);
                const targetDate = manana.toISOString();
                
                console.log('🔮 Cargando preview de mañana...');
                
                const { data, error } = await supabase.functions.invoke('get-snapshot-preview', {
                    body: {
                        business_id: business.id,
                        target_date: targetDate
                    }
                });
                
                if (error) {
                    console.error('❌ Error cargando preview:', error);
                    return;
                }
                
                console.log('✅ Preview de mañana cargado:', data);
                setPreviewManana(data);
                
            } catch (error) {
                console.error('❌ Error en loadPreviewManana:', error);
            } finally {
                setLoadingPreview(false);
            }
        };
        
        loadPreviewManana();
    }, [snapshot, loading, business?.id]);

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

    // ✅ Skeleton state mientras carga (mejora percepción de velocidad)
    if (loading) {
        return (
            <div 
                className="dashboard-container"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '38% 1fr',
                    height: '100vh',
                    overflow: 'hidden',
                    backgroundColor: '#F3F4F6'
                }}
            >
                {/* Skeleton: Columna izquierda (Avatar) */}
                <div className="animate-pulse" style={{ padding: '20px', backgroundColor: '#F3F4F6' }}>
                    <div className="bg-gray-200 rounded-2xl" style={{ height: '75%', marginBottom: '20px' }}></div>
                    <div className="bg-gray-200 rounded-2xl" style={{ height: '25%' }}></div>
                </div>
                
                {/* Skeleton: Columna derecha (Dashboard) */}
                <div className="animate-pulse" style={{ padding: '30px' }}>
                    <div className="bg-gray-200 rounded-lg h-8 w-64 mb-6"></div>
                    <div className="bg-gray-200 rounded-lg h-6 w-48 mb-8"></div>
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-gray-200 rounded-lg h-24"></div>
                        ))}
                    </div>
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

                    {/* 🔮 SECCIÓN: LO QUE TE ESPERA MAÑANA */}
                    {previewManana && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="mt-8 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-purple-200 shadow-lg"
                        >
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                                    <span className="text-2xl">🔮</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-purple-900">
                                        Lo que te espera mañana
                                    </h3>
                                    <p className="text-sm text-purple-600 font-medium">
                                        {new Date(new Date().setDate(new Date().getDate() + 1)).toLocaleDateString('es-ES', { 
                                            weekday: 'long', 
                                            day: 'numeric', 
                                            month: 'long' 
                                        })}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Mensaje de resumen */}
                            <p className="text-gray-700 text-base mb-5 leading-relaxed font-medium">
                                {previewManana.mensaje}
                            </p>
                            
                            {/* 4 Puntos clave */}
                            <div className="grid grid-cols-2 gap-3">
                                {previewManana.puntos?.map((punto, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.5 + (idx * 0.1), duration: 0.3 }}
                                        className="flex items-start gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow border border-purple-100"
                                    >
                                        <span className="text-3xl flex-shrink-0">{punto.icono}</span>
                                        <span className="text-sm text-gray-700 font-medium leading-snug flex-1">
                                            {punto.texto}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Loading preview */}
                    {loadingPreview && !previewManana && (
                        <div className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 border-2 border-purple-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center animate-pulse">
                                    🔮
                                </div>
                                <div>
                                    <p className="text-purple-700 font-medium">
                                        Analizando el día de mañana...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
