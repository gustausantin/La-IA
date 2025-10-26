// MetricsCards.jsx - Tarjetas de métricas separadas
import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MessageSquare, 
  DollarSign, 
  Bot,
  Activity,
  Clock 
} from 'lucide-react';

const MetricsCards = ({ metrics = {} }) => {
  const cards = [
    {
      title: 'Conversaciones IA',
      value: metrics.total_conversations || 0,
      change: metrics.conversations_change || 0,
      icon: Bot,
      color: 'purple'
    },
    {
      title: 'Reservas Generadas',
      value: metrics.reservations_generated || 0,
      change: metrics.reservations_change || 0,
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Tiempo Respuesta',
      value: `${metrics.avg_response_time || 0}s`,
      change: metrics.response_time_change || 0,
      icon: Clock,
      color: 'green',
      inverse: true // Para tiempo de respuesta, menos es mejor
    },
    {
      title: 'Satisfacción Cliente',
      value: `${metrics.satisfaction_score || 0}%`,
      change: metrics.satisfaction_change || 0,
      icon: Activity,
      color: 'yellow'
    },
    {
      title: 'Revenue IA',
      value: `€${metrics.ai_revenue || 0}`,
      change: metrics.revenue_change || 0,
      icon: DollarSign,
      color: 'emerald'
    },
    {
      title: 'Mensajes Procesados',
      value: metrics.messages_processed || 0,
      change: metrics.messages_change || 0,
      icon: MessageSquare,
      color: 'indigo'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      purple: 'bg-purple-50 text-purple-600',
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      emerald: 'bg-emerald-50 text-emerald-600',
      indigo: 'bg-indigo-50 text-indigo-600'
    };
    return colors[color] || colors.blue;
  };

  const getChangeIcon = (change, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0;
    return isPositive ? TrendingUp : TrendingDown;
  };

  const getChangeColor = (change, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0;
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const ChangeIcon = getChangeIcon(card.change, card.inverse);
        
        return (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {card.value}
                </p>
                
                {card.change !== 0 && (
                  <div className={`flex items-center mt-2 ${getChangeColor(card.change, card.inverse)}`}>
                    <ChangeIcon className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">
                      {Math.abs(card.change)}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      vs último mes
                    </span>
                  </div>
                )}
              </div>
              
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getColorClasses(card.color)}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsCards;
