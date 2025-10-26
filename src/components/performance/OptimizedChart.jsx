import React, { memo, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { 
  ResponsiveContainer,
  LineChart,
  BarChart,
  PieChart,
  Line,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { motion } from 'framer-motion';

/**
 * 🚀 OPTIMIZED CHART COMPONENT
 * Gráficos ultra optimizados con memoización y lazy rendering
 */

// Hook para optimizar datos de charts
const useOptimizedChartData = (data, type, options = {}) => {
  return useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    const { 
      maxDataPoints = 50,
      sortBy,
      filterBy,
      aggregateBy 
    } = options;

    let processedData = [...data];

    // Filtrar datos si es necesario
    if (filterBy) {
      processedData = processedData.filter(filterBy);
    }

    // Ordenar datos
    if (sortBy) {
      processedData.sort(sortBy);
    }

    // Limitar puntos de datos para performance
    if (processedData.length > maxDataPoints) {
      const step = Math.ceil(processedData.length / maxDataPoints);
      processedData = processedData.filter((_, index) => index % step === 0);
    }

    // Agregar datos si es necesario
    if (aggregateBy && type === 'line') {
      // Implementar agregación por tiempo/categoría
      const aggregated = processedData.reduce((acc, item) => {
        const key = aggregateBy(item);
        if (!acc[key]) {
          acc[key] = { ...item, count: 0 };
        }
        acc[key].count += 1;
        return acc;
      }, {});
      processedData = Object.values(aggregated);
    }

    return processedData;
  }, [data, type, options.maxDataPoints, options.sortBy, options.filterBy, options.aggregateBy]);
};

// Hook para colores optimizados
const useChartColors = (colorScheme = 'default') => {
  return useMemo(() => {
    const colorSchemes = {
      default: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'],
      business: ['#1E40AF', '#7C3AED', '#059669', '#D97706', '#DC2626', '#4B5563'],
      modern: ['#6366F1', '#8B5CF6', '#06B6D4', '#84CC16', '#F59E0B', '#EF4444'],
      gradient: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe']
    };
    return colorSchemes[colorScheme] || colorSchemes.default;
  }, [colorScheme]);
};

// Tooltip personalizado optimizado
const CustomTooltip = memo(({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-2 rounded-lg shadow-lg border border-gray-200"
    >
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </motion.div>
  );
});

// Componente principal optimizado
const OptimizedChart = memo(({
  type = 'line',
  data,
  width = '100%',
  height = 300,
  colors = 'default',
  loading = false,
  error = null,
  options = {},
  onDataPointClick,
  className = '',
  animate = true,
  lazy = true,
  priority = 'normal',
  ...props
}) => {
  const chartRef = useRef();
  const [isVisible, setIsVisible] = useState(!lazy);
  const [hasError, setHasError] = useState(false);

  // Optimizar datos
  const optimizedData = useOptimizedChartData(data, type, options.data || {});
  const chartColors = useChartColors(colors);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (!lazy) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: priority === 'high' ? '200px' : '50px'
      }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, priority]);

  // Manejar click en datos
  const handleDataClick = useCallback((data, index) => {
    onDataPointClick?.(data, index);
  }, [onDataPointClick]);

  // Configuración base optimizada
  const baseConfig = useMemo(() => ({
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
    ...options.config
  }), [options.config]);

  // Renderizar loading state
  const LoadingSkeleton = () => (
    <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
      <div className="animate-pulse space-y-2 w-full p-2">
        <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto"></div>
        <div className="grid grid-cols-12 gap-1 h-48">
          {Array(12).fill(0).map((_, i) => (
            <div 
              key={i}
              className="bg-gray-200 rounded"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Renderizar error state
  if (error || hasError) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 rounded-lg border border-red-200">
        <div className="text-center p-2">
          <div className="text-red-500 text-lg mb-2">📊</div>
          <p className="text-red-800 font-medium">Error cargando gráfico</p>
          <p className="text-red-600 text-sm">{error?.message || 'Error desconocido'}</p>
        </div>
      </div>
    );
  }

  // Mostrar loading mientras está cargando o no es visible
  if (loading || !isVisible) {
    return (
      <div ref={chartRef} className={`${className}`} style={{ height }}>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error boundary interno
  const renderChart = () => {
    try {
      const commonProps = {
        data: optimizedData,
        ...baseConfig,
        onClick: handleDataClick
      };

      switch (type) {
        case 'line':
          return (
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey={options.xAxis?.key || 'name'} 
                tick={{ fontSize: 12 }}
                {...options.xAxis}
              />
              <YAxis tick={{ fontSize: 12 }} {...options.yAxis} />
              <Tooltip 
                content={<CustomTooltip formatter={options.tooltip?.formatter} />}
                {...options.tooltip}
              />
              {options.legend && <Legend {...options.legend} />}
              {options.lines?.map((lineConfig, index) => (
                <Line
                  key={lineConfig.key || index}
                  type="monotone"
                  dataKey={lineConfig.key}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  {...lineConfig}
                />
              )) || (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={chartColors[0]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          );

        case 'bar':
          return (
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey={options.xAxis?.key || 'name'} 
                tick={{ fontSize: 12 }}
                {...options.xAxis}
              />
              <YAxis tick={{ fontSize: 12 }} {...options.yAxis} />
              <Tooltip 
                content={<CustomTooltip formatter={options.tooltip?.formatter} />}
                {...options.tooltip}
              />
              {options.legend && <Legend {...options.legend} />}
              {options.bars?.map((barConfig, index) => (
                <Bar
                  key={barConfig.key || index}
                  dataKey={barConfig.key}
                  fill={chartColors[index % chartColors.length]}
                  radius={[4, 4, 0, 0]}
                  {...barConfig}
                />
              )) || (
                <Bar
                  dataKey="value"
                  fill={chartColors[0]}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          );

        case 'pie':
          return (
            <PieChart {...commonProps}>
              <Pie
                data={optimizedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label={options.pie?.label}
                {...options.pie}
              >
                {optimizedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={chartColors[index % chartColors.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip formatter={options.tooltip?.formatter} />}
                {...options.tooltip}
              />
              {options.legend && <Legend {...options.legend} />}
            </PieChart>
          );

        default:
          return <div>Tipo de gráfico no soportado: {type}</div>;
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      setHasError(true);
      return null;
    }
  };

  const chartContent = (
    <ResponsiveContainer width={width} height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );

  return (
    <div ref={chartRef} className={`${className}`} style={{ height }}>
      {animate ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {chartContent}
        </motion.div>
      ) : (
        chartContent
      )}
    </div>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;
