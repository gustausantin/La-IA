import React, { useMemo } from 'react';
import { 
  MessageCircle, 
  Users, 
  Clock, 
  Zap, 
  TrendingUp,
  AlertCircle,
  Bot,
  UserCheck
} from 'lucide-react';

const RealtimeStats = React.memo(({ conversations = [], messages = [] }) => {
  // Calcular estadísticas en tiempo real con memoización
  const stats = useMemo(() => {
    const totalConversations = conversations.length;
    const activeConversations = conversations.filter(c => c.state === 'active').length;
    const aiHandledConversations = conversations.filter(c => c.ai_handled).length;
    const humanTakeoverConversations = conversations.filter(c => c.human_takeover).length;
    
    const totalMessages = messages.length;
    const todayMessages = messages.filter(m => {
      const messageDate = new Date(m.created_at);
      const today = new Date();
      return messageDate.toDateString() === today.toDateString();
    }).length;

    // Calcular tiempo de respuesta real desde metadata de conversaciones
    const responseTime = conversations.reduce((acc, conv) => {
      // Usar tiempo de respuesta real de la conversación o 0 si no existe
      const convResponseTime = conv.response_time || conv.avg_response_time || 0;
      return acc + convResponseTime;
    }, 0) / Math.max(totalConversations, 1);

    const satisfactionRate = conversations.length > 0 ? 
      (conversations.filter(c => c.satisfaction_rating >= 4).length / conversations.length) * 100 : 0;

    return {
      totalConversations,
      activeConversations,
      aiHandledConversations,
      humanTakeoverConversations,
      totalMessages,
      todayMessages,
      responseTime: Math.round(responseTime * 10) / 10,
      satisfactionRate: Math.round(satisfactionRate),
      aiEfficiency: totalConversations > 0 ? Math.round((aiHandledConversations / totalConversations) * 100) : 0
    };
  }, [conversations, messages]);

  const StatCard = ({ icon: Icon, label, value, trend, color = "blue", subtitle }) => (
    <div className={`p-2 bg-${color}-50 rounded-lg border border-${color}-100`}>
      <div className="flex items-center justify-between mb-1">
        <Icon className={`w-4 h-4 text-${color}-600`} />
        {trend && (
          <div className={`flex items-center text-xs text-${color}-600`}>
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend}
          </div>
        )}
      </div>
      <div className={`text-lg font-bold text-${color}-900`}>{value}</div>
      <div className={`text-xs text-${color}-700`}>{label}</div>
      {subtitle && (
        <div className={`text-xs text-${color}-600 mt-1`}>{subtitle}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Estadísticas en Tiempo Real</h3>
        <div className="flex items-center gap-1 text-green-600 text-xs">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          En vivo
        </div>
      </div>

      {/* Grid de estadísticas principales */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={MessageCircle}
          label="Conversaciones"
          value={stats.totalConversations}
          color="blue"
          subtitle={`${stats.activeConversations} activas`}
        />

        <StatCard
          icon={Users}
          label="Mensajes hoy"
          value={stats.todayMessages}
          color="green"
          trend={null}
        />

        <StatCard
          icon={Clock}
          label="T. respuesta"
          value={`${stats.responseTime}min`}
          color="orange"
          subtitle="Promedio"
        />

        <StatCard
          icon={Bot}
          label="IA Eficiencia"
          value={`${stats.aiEfficiency}%`}
          color="purple"
          trend={null}
        />
      </div>

      {/* Indicadores adicionales */}
      <div className="space-y-2">
        {/* Estado del agente IA */}
        <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Agente IA</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-green-700">Activo</span>
          </div>
        </div>

        {/* Tasa de satisfacción */}
        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Satisfacción</span>
          </div>
          <span className="text-sm font-bold text-blue-700">{stats.satisfactionRate}%</span>
        </div>

        {/* Intervenciones humanas */}
        {stats.humanTakeoverConversations > 0 && (
          <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Requieren atención</span>
            </div>
            <span className="text-sm font-bold text-orange-700">{stats.humanTakeoverConversations}</span>
          </div>
        )}
      </div>

      {/* Barra de progreso de eficiencia IA */}
      <div className="bg-gray-50 rounded-lg p-2">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Automatización IA</span>
          <span className="text-gray-600">{stats.aiEfficiency}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${stats.aiEfficiency}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {stats.aiHandledConversations} de {stats.totalConversations} conversaciones automatizadas
        </div>
      </div>
    </div>
  );
});

RealtimeStats.displayName = 'RealtimeStats';

export default RealtimeStats;
