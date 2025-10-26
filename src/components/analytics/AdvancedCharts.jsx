import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  BarChart3,
  Activity,
  Target,
} from 'lucide-react';

const AdvancedCharts = React.memo(({ data, dateRange }) => {
  // Generar datos de ejemplo con memoización
  const chartData = useMemo(() => {
    // Datos de reservas por día (últimos 30 días)
    const reservationTrend = Array.from({ length: 30 }, (_, index) => {
      const day = index + 1;
      return {
        day: `${day}`,
        date: `2024-01-${day.toString().padStart(2, '0')}`,
        reservas: 0, // DATOS REALES REQUERIDOS
        ingresos: 0, // DATOS REALES REQUERIDOS
        consultas: 0, // DATOS REALES REQUERIDOS
        conversion: 0, // DATOS REALES REQUERIDOS
        satisfaction: 0, // DATOS REALES REQUERIDOS
      };
    });

    // Datos por hora del día
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      reservas: 0, // DATOS REALES REQUERIDOS
      consultas: 0, // DATOS REALES REQUERIDOS
      tiempo_respuesta: 0, // DATOS REALES REQUERIDOS
    }));

    // Datos de embudo de conversión - SOLO DATOS REALES
    const funnelData = [
      { stage: 'Consultas', value: 0, percentage: 0 }, // REQUIERE DATOS REALES
      { stage: 'Interesados', value: 0, percentage: 0 }, // REQUIERE DATOS REALES
      { stage: 'Propuestas', value: 0, percentage: 0 }, // REQUIERE DATOS REALES
      { stage: 'Reservas', value: 0, percentage: 0 }, // REQUIERE DATOS REALES
      { stage: 'Completadas', value: 0, percentage: 0 }, // REQUIERE DATOS REALES
    ];

    // Datos de canales - SOLO DATOS REALES
    const channelPerformance = [
      { canal: 'WhatsApp', reservas: 0, conversion: 0, satisfaccion: 0 }, // REQUIERE DATOS REALES
      { canal: 'Teléfono', reservas: 0, conversion: 0, satisfaccion: 0 }, // REQUIERE DATOS REALES
      { canal: 'Web', reservas: 0, conversion: 0, satisfaccion: 0 }, // REQUIERE DATOS REALES
      { canal: 'Email', reservas: 0, conversion: 0, satisfaccion: 0 }, // REQUIERE DATOS REALES
    ];

    return {
      reservationTrend,
      hourlyData,
      funnelData,
      channelPerformance,
    };
  }, [dateRange]);

  // Colores del tema
  const colors = {
    primary: '#8B5CF6',
    secondary: '#10B981',
    accent: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  };

  // Componente de gráfico con header
  const ChartContainer = ({ title, subtitle, children, action }) => (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );

  // Tooltip personalizado
  const CustomTooltip = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatter ? formatter(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Análisis Avanzado
        </h2>
        <p className="text-gray-600">
          Tendencias detalladas y análisis de rendimiento
        </p>
      </div>

      {/* Tendencia de reservas e ingresos */}
      <ChartContainer
        title="Tendencia de Reservas e Ingresos"
        subtitle="Evolución diaria en los últimos 30 días"
        action={
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Calendar className="w-4 h-4" />
            Cambiar período
          </button>
        }
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData.reservationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="day" 
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                stroke="#6B7280"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="ingresos"
                fill={colors.secondary}
                fillOpacity={0.1}
                stroke={colors.secondary}
                strokeWidth={2}
                name="Ingresos (€)"
              />
              
              <Bar
                yAxisId="left"
                dataKey="reservas"
                fill={colors.primary}
                name="Reservas"
                radius={[2, 2, 0, 0]}
              />
              
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="conversion"
                stroke={colors.accent}
                strokeWidth={3}
                dot={{ r: 4 }}
                name="Conversión (%)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* Grid de gráficos secundarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividad por horas */}
        <ChartContainer
          title="Actividad por Horas"
          subtitle="Distribución de consultas y reservas"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                
                <Area
                  type="monotone"
                  dataKey="consultas"
                  stackId="1"
                  stroke={colors.info}
                  fill={colors.info}
                  fillOpacity={0.6}
                  name="Consultas"
                />
                <Area
                  type="monotone"
                  dataKey="reservas"
                  stackId="1"
                  stroke={colors.primary}
                  fill={colors.primary}
                  fillOpacity={0.8}
                  name="Reservas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Tiempo de respuesta */}
        <ChartContainer
          title="Tiempo de Respuesta"
          subtitle="Promedio por hora del día"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip 
                  content={<CustomTooltip formatter={(value) => `${value.toFixed(1)} min`} />} 
                />
                <ReferenceLine y={2} stroke={colors.danger} strokeDasharray="5 5" />
                
                <Line
                  type="monotone"
                  dataKey="tiempo_respuesta"
                  stroke={colors.secondary}
                  strokeWidth={3}
                  dot={{ r: 4, fill: colors.secondary }}
                  activeDot={{ r: 6 }}
                  name="Tiempo de respuesta"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      {/* Embudo de conversión */}
      <ChartContainer
        title="Embudo de Conversión"
        subtitle="Flujo de clientes desde consulta hasta reserva completada"
      >
        <div className="space-y-3">
          {chartData.funnelData.map((stage, index) => (
            <div key={stage.stage} className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{stage.stage}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{stage.percentage.toFixed(1)}%</span>
                  <span className="font-semibold text-gray-900">{stage.value.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${stage.percentage}%`,
                    backgroundColor: `hsl(${250 + index * 10}, 65%, ${60 - index * 5}%)`,
                  }}
                />
              </div>
              {index < chartData.funnelData.length - 1 && (
                <div className="text-center mt-2 mb-1">
                  <span className="text-xs text-gray-500">
                    -{((chartData.funnelData[index].value - chartData.funnelData[index + 1].value) / chartData.funnelData[index].value * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </ChartContainer>

      {/* Rendimiento por canal */}
      <ChartContainer
        title="Rendimiento por Canal"
        subtitle="Comparación de efectividad entre canales de comunicación"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.channelPerformance} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6B7280" fontSize={12} />
              <YAxis dataKey="canal" type="category" stroke="#6B7280" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              <Bar
                dataKey="reservas"
                fill={colors.primary}
                name="Reservas"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="conversion"
                fill={colors.secondary}
                name="Conversión (%)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
    </div>
  );
});

AdvancedCharts.displayName = 'AdvancedCharts';

export default AdvancedCharts;
