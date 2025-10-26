import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  Users,
  DollarSign,
  Clock,
  Zap,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Sparkles,
  RefreshCw,
  Download,
  Filter,
  ChevronRight,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Card, Button, SkeletonChart } from '../ui/index';
import { analyticsAI } from '../../services/analyticsAI';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { log } from '../../utils/logger';

// Colores para gráficos Recharts
const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

// Dashboard principal de IA
const AIInsightsDashboard = ({ className = '' }) => {
  const [insights, setInsights] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    priority: 'all',
    category: 'all',
  });

  const { loadAnalytics } = useAnalyticsStore();

  useEffect(() => {
    loadAIData();
  }, []);

  const loadAIData = async () => {
    setIsLoading(true);
    
    try {
      log.info('🤖 Loading AI analytics data');
      
      // Cargar en paralelo todos los datos de IA
      const [insightsData, predictionsData, recommendationsData] = await Promise.all([
        analyticsAI.generateInsights(),
        generatePredictions(),
        analyticsAI.generateRecommendations(),
      ]);

      setInsights(insightsData);
      setPredictions(predictionsData);
      setRecommendations(recommendationsData);
      setLastUpdate(new Date());

      log.info('✅ AI analytics data loaded');

    } catch (error) {
      log.error('❌ Failed to load AI data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePredictions = async () => {
    try {
      const [revenuePrediction, customerFlowPredictions] = await Promise.all([
        analyticsAI.predictRevenue('today'),
        Promise.all([
          analyticsAI.predictCustomerFlow(12),
          analyticsAI.predictCustomerFlow(19),
          analyticsAI.predictCustomerFlow(21),
        ])
      ]);

      return {
        revenue: revenuePrediction,
        customerFlow: customerFlowPredictions,
      };
    } catch (error) {
      log.error('❌ Failed to generate predictions:', error);
      return { revenue: null, customerFlow: [] };
    }
  };

  const refreshData = () => {
    loadAIData();
  };

  const exportInsights = async () => {
    try {
      const data = await analyticsAI.exportAnalysis('json');
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-insights-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      log.info('📤 AI insights exported');
    } catch (error) {
      log.error('❌ Failed to export insights:', error);
    }
  };

  const filteredInsights = insights.filter(insight => {
    if (filters.type !== 'all' && insight.type !== filters.type) return false;
    if (filters.priority !== 'all' && insight.priority < parseInt(filters.priority)) return false;
    if (filters.category !== 'all' && insight.category !== filters.category) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <SkeletonChart />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con controles */}
      <Card variant="default" padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Dashboard IA</h2>
              <p className="text-sm text-gray-600">
                Insights y predicciones generadas por inteligencia artificial
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <div className="text-xs text-gray-500 mr-4">
                Última actualización: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportInsights}
              icon={Download}
            >
              Exportar
            </Button>
            
            <Button
              variant="primary"
              size="sm"
              onClick={refreshData}
              icon={RefreshCw}
            >
              Actualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-700">Filtros:</span>
          </div>
          
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">Todos los tipos</option>
            <option value="performance">Performance</option>
            <option value="opportunity">Oportunidades</option>
            <option value="risk">Riesgos</option>
            <option value="optimization">Optimización</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">Todas las prioridades</option>
            <option value="9">Alta (9+)</option>
            <option value="7">Media (7+)</option>
            <option value="5">Baja (5+)</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">Todas las categorías</option>
            <option value="revenue">Ingresos</option>
            <option value="customer">Clientes</option>
            <option value="operational">Operacional</option>
            <option value="inventory">Inventario</option>
          </select>
        </div>
      </Card>

      {/* Métricas de IA en tiempo real */}
      <AIMetricsOverview 
        insights={insights}
        predictions={predictions}
        recommendations={recommendations}
      />

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Insights principales */}
        <div className="lg:col-span-2">
          <AIInsightsList 
            insights={filteredInsights}
            onSelectInsight={setSelectedInsight}
            selectedInsight={selectedInsight}
          />
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <AIPredictionsPanel predictions={predictions} />
          <AIRecommendationsPanel recommendations={recommendations} />
        </div>
      </div>

      {/* Modal de detalle de insight */}
      <AnimatePresence>
        {selectedInsight && (
          <AIInsightModal 
            insight={selectedInsight}
            onClose={() => setSelectedInsight(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Componente de métricas overview
const AIMetricsOverview = ({ insights, predictions, recommendations }) => {
  const metrics = [
    {
      label: 'Insights Activos',
      value: insights.length,
      icon: Lightbulb,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      label: 'Predicciones',
      value: Object.keys(predictions).length,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Recomendaciones',
      value: recommendations.length,
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Confianza IA',
      value: '94%',
      icon: Brain,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card variant="default" padding="md" hover={true}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {metric.value}
                  </div>
                  <div className="text-sm text-gray-600">
                    {metric.label}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

// Lista de insights
const AIInsightsList = ({ insights, onSelectInsight, selectedInsight }) => {
  const getInsightIcon = (type) => {
    switch (type) {
      case 'performance': return Activity;
      case 'opportunity': return TrendingUp;
      case 'risk': return AlertTriangle;
      case 'optimization': return Zap;
      default: return Lightbulb;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'performance': return 'text-green-600';
      case 'opportunity': return 'text-blue-600';
      case 'risk': return 'text-red-600';
      case 'optimization': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityBadge = (priority) => {
    if (priority >= 9) return 'bg-red-100 text-red-800';
    if (priority >= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <Card variant="default" padding="none">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Insights de IA</h3>
        <p className="text-sm text-gray-600 mt-1">
          Análisis automático y recomendaciones inteligentes
        </p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {insights.map((insight, index) => {
          const Icon = getInsightIcon(insight.type);
          const isSelected = selectedInsight?.title === insight.title;
          
          return (
            <motion.div
              key={index}
              className={`p-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                isSelected ? 'bg-purple-50 border-l-4 border-purple-500' : ''
              }`}
              onClick={() => onSelectInsight(insight)}
              whileHover={{ x: 4 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-gray-100`}>
                  <Icon className={`w-4 h-4 ${getInsightColor(insight.type)}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {insight.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(insight.priority)}`}>
                        P{insight.priority}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {insight.description}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Impacto: {insight.impact}/10</span>
                    <span>•</span>
                    <span className="capitalize">{insight.category}</span>
                    <span>•</span>
                    <span>{new Date(insight.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        
        {insights.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p>No hay insights disponibles</p>
            <p className="text-sm mt-1">La IA está analizando los datos...</p>
          </div>
        )}
      </div>
    </Card>
  );
};

// Panel de predicciones
const AIPredictionsPanel = ({ predictions }) => {
  return (
    <Card variant="default" padding="md">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Predicciones IA</h3>
      </div>
      
      <div className="space-y-4">
        {predictions.revenue && (
          <div className="p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                Ingresos Hoy
              </span>
              <span className="text-xs text-blue-600">
                {Math.round(predictions.revenue.confidence * 100)}% confianza
              </span>
            </div>
            <div className="text-lg font-bold text-blue-900">
              €{predictions.revenue.predicted.toLocaleString()}
            </div>
          </div>
        )}
        
        {predictions.customerFlow?.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">
              Flujo de Clientes
            </span>
            {predictions.customerFlow.map((flow, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{flow.hour}:00</span>
                <span className="font-medium">
                  {flow.expectedCustomers} clientes
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

// Panel de recomendaciones
const AIRecommendationsPanel = ({ recommendations }) => {
  return (
    <Card variant="default" padding="md">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900">Recomendaciones</h3>
      </div>
      
      <div className="space-y-3">
        {recommendations.slice(0, 3).map((rec, index) => (
          <div key={index} className="p-2 bg-green-50 rounded-lg">
            <div className="text-sm font-medium text-green-900 mb-1">
              {rec.title}
            </div>
            <div className="text-xs text-green-700">
              {rec.description}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
              <span>Impacto: {rec.impact}/10</span>
              <span>•</span>
              <span>Urgencia: {rec.urgency}/10</span>
            </div>
          </div>
        ))}
        
        {recommendations.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No hay recomendaciones</p>
          </div>
        )}
      </div>
    </Card>
  );
};

// Modal de detalle de insight
const AIInsightModal = ({ insight, onClose }) => {
  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              {insight.title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className={`px-3 py-1 rounded-full font-medium ${
                insight.priority >= 9 ? 'bg-red-100 text-red-800' :
                insight.priority >= 7 ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                Prioridad {insight.priority}
              </span>
              <span className="text-gray-600">
                Impacto: {insight.impact}/10
              </span>
              <span className="text-gray-600 capitalize">
                {insight.category}
              </span>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Descripción</h3>
              <p className="text-gray-700">{insight.description}</p>
            </div>
            
            {insight.recommendations && insight.recommendations.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Recomendaciones</h3>
                <ul className="space-y-2">
                  {insight.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {insight.data && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Datos Adicionales</h3>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(insight.data, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-gray-500">
                {new Date(insight.timestamp).toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cerrar
                </Button>
                {insight.actionable && (
                  <Button variant="primary" size="sm">
                    Implementar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AIInsightsDashboard;
