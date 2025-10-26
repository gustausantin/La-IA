// CRM SIMPLE - Una sola página con todo claro
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
    Bell, 
    Send, 
    X, 
    AlertTriangle, 
    TrendingUp,
    Users,
    MessageSquare,
    DollarSign,
    Info,
    CheckCircle,
    Mail,
    LayoutDashboard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import PlantillasCRM from './PlantillasCRM'; // Importar componente de Plantillas

const CRMSimple = () => {
    const { restaurant } = useAuthContext();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [alertas, setAlertas] = useState([]);
    const [stats, setStats] = useState({
        mensajesEnviados: 0,
        clientesRecuperados: 0,
        valorGenerado: 0
    });
    const [mostrarInfo, setMostrarInfo] = useState(false);
    
    // Estado para tabs
    const [activeTab, setActiveTab] = useState('dashboard');

    // Detectar si viene de /plantillas para abrir el tab correcto
    useEffect(() => {
        if (location.state?.autoOpenPlantillas) {
            setActiveTab('plantillas');
        }
    }, [location.state]);

    useEffect(() => {
        if (restaurant?.id) {
            cargarDatos();
        }
    }, [restaurant]);
    
    // Definir tabs
    const tabs = [
        { id: 'dashboard', label: 'Dashboard CRM', icon: LayoutDashboard },
        { id: 'plantillas', label: 'Plantillas', icon: Mail }
    ];

    const cargarDatos = async () => {
        try {
            setLoading(true);

            // Cargar alertas pendientes
            const { data: sugerencias } = await supabase
                .from('crm_suggestions')
                .select(`
                    *,
                    customers (
                        name,
                        phone,
                        email,
                        visits_count,
                        total_spent
                    )
                `)
                .eq('restaurant_id', restaurant.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(10);

            // Formatear alertas con mensajes automáticos
            const alertasFormateadas = (sugerencias || []).map(s => ({
                id: s.id,
                tipo: s.type,
                cliente: s.customers?.name || 'Cliente',
                telefono: s.customers?.phone,
                email: s.customers?.email,
                titulo: getTituloAlerta(s.type, s.customers?.name),
                descripcion: getDescripcionAlerta(s.type, s.customers),
                mensaje: getMensajeAutomatico(s.type, s.customers?.name),
                valor: s.customers?.total_spent || 0,
                prioridad: s.priority || 'normal',
                metadata: s.metadata || {}
            }));

            setAlertas(alertasFormateadas);

            // Cargar estadísticas de la semana
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const { data: interacciones } = await supabase
                .from('customer_interactions')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .gte('created_at', weekAgo.toISOString());

            const mensajesEnviados = interacciones?.length || 0;
            const clientesRecuperados = interacciones?.filter(i => i.status === 'replied').length || 0;
            const valorGenerado = clientesRecuperados * 45; // Ticket medio estimado

            setStats({
                mensajesEnviados,
                clientesRecuperados,
                valorGenerado
            });

        } catch (error) {
            console.error('Error cargando CRM:', error);
            toast.error('Error al cargar datos del CRM');
        } finally {
            setLoading(false);
        }
    };

    const getTituloAlerta = (tipo, nombre) => {
        switch(tipo) {
            case 'welcome': return `🎉 Dar bienvenida a ${nombre}`;
            case 'vip': return `⭐ ${nombre} es ahora VIP`;
            case 'risk': return `⚠️ ${nombre} en riesgo de pérdida`;
            case 'reactivation': return `🔄 Reactivar a ${nombre}`;
            case 'birthday': return `🎂 Cumpleaños de ${nombre}`;
            default: return `📢 Acción para ${nombre}`;
        }
    };

    const getDescripcionAlerta = (tipo, cliente) => {
        switch(tipo) {
            case 'welcome': 
                return 'Nuevo cliente - Primera visita esta semana. Enviar bienvenida aumenta 40% probabilidad de retorno.';
            case 'vip': 
                return `${cliente?.visits_count || 5}+ visitas. Cliente fiel que merece trato especial.`;
            case 'risk': 
                return `Sin visitas en ${Math.floor((Date.now() - new Date(cliente?.last_visit_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24))} días. Actuar ahora para recuperar.`;
            case 'reactivation': 
                return 'Cliente inactivo con potencial. Oferta especial puede traerlo de vuelta.';
            case 'birthday': 
                return 'Cumpleaños próximo. Momento perfecto para conectar.';
            default: 
                return 'Oportunidad de conectar con el cliente.';
        }
    };

    const getMensajeAutomatico = (tipo, nombre) => {
        const nombreCliente = nombre || 'Cliente';
        switch(tipo) {
            case 'welcome':
                return `Hola ${nombreCliente}! 🎉 Gracias por visitarnos. Como bienvenida, te regalamos un 10% en tu próxima visita. ¡Te esperamos!`;
            case 'vip':
                return `${nombreCliente}, eres especial para nosotros ⭐ Como cliente VIP, disfruta de reserva prioritaria y sorpresas exclusivas.`;
            case 'risk':
                return `${nombreCliente}, te echamos de menos 💔 Vuelve esta semana y te invitamos al postre. ¿Reservamos tu mesa favorita?`;
            case 'reactivation':
                return `¡${nombreCliente}! Hace tiempo que no nos vemos. Te esperamos con tu plato favorito y una copa de vino cortesía de la casa 🍷`;
            case 'birthday':
                return `¡Feliz cumpleaños ${nombreCliente}! 🎂 Celebra con nosotros y el postre corre por nuestra cuenta. ¿Reservamos?`;
            default:
                return `Hola ${nombreCliente}, tenemos algo especial para ti. ¡Te esperamos pronto!`;
        }
    };

    const enviarMensaje = async (alerta) => {
        try {
            toast.loading('Enviando mensaje...', { id: alerta.id });

            // Guardar interacción
            await supabase.from('customer_interactions').insert({
                restaurant_id: restaurant.id,
                customer_id: alerta.metadata.customer_id,
                channel: alerta.telefono ? 'whatsapp' : 'email',
                interaction_type: alerta.tipo,
                content: alerta.mensaje,
                status: 'sent'
            });

            // Marcar sugerencia como procesada
            await supabase
                .from('crm_suggestions')
                .update({ status: 'processed' })
                .eq('id', alerta.id);

            // Actualizar UI
            setAlertas(prev => prev.filter(a => a.id !== alerta.id));
            toast.success(`Mensaje enviado a ${alerta.cliente}`, { id: alerta.id });

            // Actualizar stats
            setStats(prev => ({
                ...prev,
                mensajesEnviados: prev.mensajesEnviados + 1
            }));

        } catch (error) {
            console.error('Error enviando mensaje:', error);
            toast.error('Error al enviar mensaje', { id: alerta.id });
        }
    };

    const ignorarAlerta = async (alerta) => {
        try {
            await supabase
                .from('crm_suggestions')
                .update({ status: 'dismissed' })
                .eq('id', alerta.id);

            setAlertas(prev => prev.filter(a => a.id !== alerta.id));
            toast.success('Alerta ignorada');
        } catch (error) {
            console.error('Error ignorando alerta:', error);
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
        <div className="p-6 max-w-7xl mx-auto">
            {/* HEADER */}
            <div className="mb-6">
                <h1 className="text-lg font-bold text-gray-900">CRM Inteligente</h1>
                <p className="text-gray-600">Gestiona la comunicación con tus clientes de forma inteligente</p>
            </div>

            {/* TABS DE NAVEGACIÓN */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`${
                                        activeTab === tab.id
                                            ? 'border-purple-500 text-purple-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* CONTENIDO POR TAB */}
            {activeTab === 'dashboard' && (
            <div>

            {/* MINI DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
                <div className="bg-blue-50 p-2 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-bold text-blue-600">{stats.mensajesEnviados}</div>
                            <div className="text-sm text-blue-700">Mensajes esta semana</div>
                        </div>
                        <MessageSquare className="w-8 h-8 text-blue-400" />
                    </div>
                </div>
                
                <div className="bg-green-50 p-2 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-bold text-green-600">{stats.clientesRecuperados}</div>
                            <div className="text-sm text-green-700">Clientes respondieron</div>
                        </div>
                        <Users className="w-8 h-8 text-green-400" />
                    </div>
                </div>
                
                <div className="bg-purple-50 p-2 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-bold text-purple-600">€{stats.valorGenerado}</div>
                            <div className="text-sm text-purple-700">Valor generado</div>
                        </div>
                        <DollarSign className="w-8 h-8 text-purple-400" />
                    </div>
                </div>
            </div>

            {/* BOTÓN DE INFO */}
            <div className="mb-4">
                <button
                    onClick={() => setMostrarInfo(!mostrarInfo)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                    <Info className="w-5 h-5" />
                    ¿Cuándo aparecen las alertas?
                </button>
            </div>

            {/* INFO EXPANDIBLE */}
            {mostrarInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">📊 Las alertas aparecen automáticamente cuando:</h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                        <li>• <strong>Bienvenida:</strong> Cliente nuevo hace su primera reserva</li>
                        <li>• <strong>VIP:</strong> Cliente alcanza 5+ visitas</li>
                        <li>• <strong>Riesgo:</strong> Cliente regular no viene en 30+ días</li>
                        <li>• <strong>Reactivación:</strong> Cliente inactivo 60+ días</li>
                        <li>• <strong>Cumpleaños:</strong> 3 días antes del cumpleaños</li>
                    </ul>
                    <p className="mt-3 text-xs text-blue-700">
                        💡 Los mensajes se generan automáticamente. Solo tienes que decidir si enviar o ignorar.
                    </p>
                </div>
            )}

            {/* ALERTAS */}
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-2 border-b bg-gradient-to-r from-purple-50 to-blue-50">
                    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-purple-600" />
                        Alertas CRM - Acciones Pendientes ({alertas.length})
                    </h2>
                </div>

                {alertas.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>¡Todo al día! No hay alertas pendientes.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {alertas.map((alerta) => (
                            <div key={alerta.id} className="p-2 hover:bg-gray-50">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        {/* Título y descripción */}
                                        <h3 className="font-semibold text-gray-900 mb-1">
                                            {alerta.titulo}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-2">
                                            {alerta.descripcion}
                                        </p>
                                        
                                        {/* Mensaje pre-generado */}
                                        <div className="bg-gray-50 p-2 rounded-lg mb-2">
                                            <p className="text-sm text-gray-700">
                                                <strong>Mensaje:</strong> {alerta.mensaje}
                                            </p>
                                        </div>

                                        {/* Info del cliente */}
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {alerta.telefono && (
                                                <span>📱 {alerta.telefono}</span>
                                            )}
                                            {alerta.email && (
                                                <span>✉️ {alerta.email}</span>
                                            )}
                                            {alerta.valor > 0 && (
                                                <span>💰 Valor: €{alerta.valor}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Botones de acción */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => enviarMensaje(alerta)}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                                        >
                                            <Send className="w-4 h-4" />
                                            Enviar
                                        </button>
                                        <button
                                            onClick={() => ignorarAlerta(alerta)}
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            Ignorar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>
            )}

            {/* TAB DE PLANTILLAS */}
            {activeTab === 'plantillas' && (
                <PlantillasCRM />
            )}
        </div>
    );
};

export default CRMSimple;

