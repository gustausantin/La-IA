import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Clock,
  Target,
  Activity,
  Bot,
  Star,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const MetricsOverview = React.memo(({ data, dateRange }) => {
  // Calcular métricas principales con memoización
  const metrics = useMemo(() => {
    if (!data) {
      return {
        totalReservations: 0,
        totalRevenue: 0,
        averageTicket: 0,
        conversionRate: 0,
        agentEfficiency: 0,
        customerSatisfaction: 0,
        responseTime: 0,
        activeConversations: 0
      };
    }

    return {
      totalReservations: data.totalReservations || 0,
      totalRevenue: data.totalRevenue || 0,
      averageTicket: data.averageTicket || 0,
      conversionRate: data.conversionRate || 0,
      agentEfficiency: data.agentEfficiency || 0,
      customerSatisfaction: data.customerSatisfaction || 0,
      responseTime: data.responseTime || 0,
      activeConversations: data.activeConversations || 0
    };
  }, [data]);

  // Comparación con período anterior (debe venir de props o ser calculado)
  const previousMetrics = useMemo(() => ({
    totalReservations: data?.previousTotalReservations || 0,
    totalRevenue: data?.previousTotalRevenue || 0,
    averageTicket: data?.previousAverageTicket || 0,
    conversionRate: data?.previousConversionRate || 0,
    agentEfficiency: data?.previousAgentEfficiency || 0,
    customerSatisfaction: data?.previousCustomerSatisfaction || 0,
    responseTime: data?.previousResponseTime || 0,
    activeConversations: data?.previousActiveConversations || 0
  }), [data]);

  // Calcular cambios porcentuales
  const getPercentageChange = (current, previous) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Componente de métrica individual
  const MetricCard = ({ 
    icon: Icon, 
    title, 
    value, 
    previousValue, 
    unit = '', 
    format = 'number',
    color = 'blue',
    subtitle
  }) => {
    const change = getPercentageChange(value, previousValue);
    const isPositive = change > 0;
    const isNegative = change < 0;

    const formatValue = (val) => {
      switch (format) {
        case 'currency':
          return `€${val.toLocaleString()}`;
        case 'percentage':
          return `${val}%`;
        case 'decimal':
          return val.toFixed(1);
        case 'time':
          return `${val}min`;
        default:
          return val.toLocaleString();
      }
    };

    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2 bg-${color}-100 rounded-lg`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
          {change !== 0 && (
            <div className={`flex items-center space-x-1 text-sm ${
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
            }`}>
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : isNegative ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : null}
              <span className="font-medium">
                {Math.abs(change).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-gray-900">
            {formatValue(value)}{unit}
          </h3>
          <p className="font-medium text-gray-700">{title}</p>
          {subtitle && (
            <p className="text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        
        <div className="mt-3 text-sm text-gray-600">
          vs. período anterior: {formatValue(previousValue)}{unit}
        </div>
      </div>
    );
  };

  // Componente de métrica simplificada para grid 2x2
  const SimpleMetric = ({ icon: Icon, title, value, unit, color, trend }) => (
    <div className="bg-white p-2 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 text-${color}-600`} />
        {trend && (
          <div className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-base font-bold text-gray-900">{value}{unit}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Resumen de Métricas
          </h2>
          <p className="text-gray-600 mt-1">
            Indicadores clave de rendimiento del período seleccionado
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {dateRange?.start && dateRange?.end 
            ? `${dateRange.start} - ${dateRange.end}`
            : 'Últimos 30 días'
          }
        </div>
      </div>

      {/* Métricas principales - Grid 2x4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Target}
          title="Reservas Totales"
          value={metrics.totalReservations}
          previousValue={previousMetrics.totalReservations}
          color="blue"
          subtitle="Conversiones exitosas"
        />
        
        <MetricCard
          icon={DollarSign}
          title="Ingresos Generados"
          value={metrics.totalRevenue}
          previousValue={previousMetrics.totalRevenue}
          format="currency"
          color="green"
          subtitle="Por el agente IA"
        />
        
        <MetricCard
          icon={Activity}
          title="Ticket Promedio"
          value={metrics.averageTicket}
          previousValue={previousMetrics.averageTicket}
          format="currency"
          color="purple"
          subtitle="Por reserva"
        />
        
        <MetricCard
          icon={TrendingUp}
          title="Tasa de Conversión"
          value={metrics.conversionRate}
          previousValue={previousMetrics.conversionRate}
          format="percentage"
          color="orange"
          subtitle="Consultas → Reservas"
        />
      </div>

      {/* Métricas secundarias - Grid 2x2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SimpleMetric
          icon={Bot}
          title="Eficiencia IA"
          value={metrics.agentEfficiency}
          unit="%"
          color="blue"
          trend={getPercentageChange(metrics.agentEfficiency, previousMetrics.agentEfficiency)}
        />
        
        <SimpleMetric
          icon={Star}
          title="Satisfacción"
          value={metrics.customerSatisfaction}
          unit="/5"
          color="yellow"
          trend={getPercentageChange(metrics.customerSatisfaction, previousMetrics.customerSatisfaction)}
        />
        
        <SimpleMetric
          icon={Clock}
          title="T. Respuesta"
          value={metrics.responseTime}
          unit="min"
          color="green"
          trend={getPercentageChange(previousMetrics.responseTime, metrics.responseTime)} // Invertido porque menor es mejor
        />
        
        <SimpleMetric
          icon={Users}
          title="Conversaciones"
          value={metrics.activeConversations}
          unit=""
          color="purple"
          trend={getPercentageChange(metrics.activeConversations, previousMetrics.activeConversations)}
        />
      </div>

      {/* ROI del Agente IA */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ROI del Agente IA
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-lg font-bold text-purple-600">
                  €{(metrics.totalRevenue * 0.15).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Ahorro en personal</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {((metrics.totalRevenue * 0.15) / 500).toFixed(1)}x
                </div>
                <div className="text-sm text-gray-600">ROI mensual</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  24/7
                </div>
                <div className="text-sm text-gray-600">Disponibilidad</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Bot className="w-12 h-12 text-purple-500 mb-2" />
            <div className="text-sm text-gray-600">Agente Activo</div>
          </div>
        </div>
      </div>
    </div>
  );
});

MetricsOverview.displayName = 'MetricsOverview';

export default MetricsOverview;
