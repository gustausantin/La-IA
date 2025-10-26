import { log } from '../utils/logger';
import { mlEngine } from './MLEngine';
import { supabase } from '../lib/supabase';

class AnalyticsAI {
  constructor() {
    this.patterns = new Map();
    this.predictions = new Map();
    this.insights = [];
    this.models = {
      revenue: null,
      customer: null,
      operational: null,
    };
    this.learningData = {
      historical: [],
      realtime: [],
      external: [],
    };
  }

  // === MÉTODOS AUXILIARES ===
  calculateOptimizationImpact(optimization) {
    return {
      efficiency: optimization.efficiency || 0.85,
      revenue: optimization.revenue || 1000,
      satisfaction: optimization.satisfaction || 0.90,
      operationalCost: optimization.operationalCost || 500
    };
  }

  calculateCostSavings(optimization) {
    const baseCost = 1000;
    const optimizedCost = optimization.operationalCost || 800;
    return baseCost - optimizedCost;
  }

  predictSatisfactionImpact(optimization) {
    return Math.min(0.95, (optimization.satisfaction || 0.8) * 1.1);
  }

  calculateBusinessImpact(prediction) {
    return {
      revenueImpact: prediction.expectedReservations * 45, // €45 promedio por reserva
      operationalCost: prediction.expectedReservations * 15,
      netProfit: prediction.expectedReservations * 30,
      customerSatisfaction: 0.85 + (prediction.confidence * 0.15)
    };
  }

  async generateDemandStrategies(prediction) {
    const strategies = [];
    if (prediction.expectedReservations > 80) {
      strategies.push('Implementar sistema de cola virtual');
      strategies.push('Abrir horarios adicionales');
    }
    if (prediction.confidence < 0.7) {
      strategies.push('Mejorar recolección de datos');
    }
    return strategies;
  }

  validatePredictionConfidence(prediction) {
    return Math.min(0.95, Math.max(0.5, prediction.confidence || 0.8));
  }

  analyzeSegmentationPatterns(customers) {
    const patterns = {
      vip_percentage: customers.filter(c => c.ai_segment === 'Champion').length / customers.length,
      churn_risk: customers.filter(c => c.churn_risk > 70).length / customers.length,
      engagement_score: customers.reduce((sum, c) => sum + (c.behavior_score || 0), 0) / customers.length
    };
    return patterns;
  }

  async generateSegmentationInsights(customers) {
    const insights = [];
    const vipCount = customers.filter(c => c.ai_segment === 'Champion').length;
    const atRiskCount = customers.filter(c => c.churn_risk > 70).length;
    
    if (vipCount > customers.length * 0.15) {
      insights.push({
        type: 'opportunity',
        message: `Alto porcentaje de clientes VIP (${Math.round(vipCount/customers.length*100)}%)`,
        recommendation: 'Implementar programa de fidelización exclusivo'
      });
    }
    
    if (atRiskCount > customers.length * 0.2) {
      insights.push({
        type: 'warning',
        message: `${atRiskCount} clientes en riesgo de churn`,
        recommendation: 'Activar campaña de retención inmediata'
      });
    }
    
    return insights;
  }

  // === SEGMENTACIÓN INTELIGENTE DE CLIENTES ===
  async segmentCustomers(customers) {
    try {
      log.info('🧠 Starting intelligent customer segmentation...');
      
      // Usar ML Engine para segmentación avanzada
      const segmentedCustomers = await mlEngine.segmentCustomers(customers);
      
      // Analizar patrones de segmentación
      const segmentAnalysis = this.analyzeSegmentationPatterns(segmentedCustomers);
      
      return {
        customers: segmentedCustomers,
        analysis: segmentAnalysis,
        insights: await this.generateSegmentationInsights(segmentedCustomers)
      };
      
    } catch (error) {
      log.error('❌ Customer segmentation failed:', error);
      throw error;
    }
  }

  // === PREDICCIÓN DE DEMANDA AVANZADA ===
  async predictDemandAdvanced(dateRange, factors = {}) {
    try {
      log.info('📈 Advanced demand prediction with ML...');
      
      // Usar ML Engine para predicción avanzada
      const prediction = await mlEngine.predictDemand(dateRange, factors);
      
      // Enriquecer con análisis adicional
      const enrichedPrediction = {
        ...prediction,
        businessImpact: this.calculateBusinessImpact(prediction),
        recommendations: await this.generateDemandStrategies(prediction),
        confidence: this.validatePredictionConfidence(prediction)
      };
      
      return enrichedPrediction;
      
    } catch (error) {
      log.error('❌ Advanced demand prediction failed:', error);
      throw error;
    }
  }

  // === OPTIMIZACIÓN AUTOMÁTICA DE MESAS ===
  async optimizeTablesAI(reservations, tableLayout, preferences = {}) {
    try {
      log.info('🪑 AI-powered table optimization...');
      
      // Usar ML Engine para optimización
      const optimization = await mlEngine.optimizeTables(
        reservations, 
        tableLayout, 
        preferences
      );
      
      // Análisis de impacto
      const impact = this.calculateOptimizationImpact(optimization);
      
      return {
        ...optimization,
        impact,
        savings: this.calculateCostSavings(optimization),
        customerSatisfactionImpact: this.predictSatisfactionImpact(optimization)
      };
      
    } catch (error) {
      log.error('❌ AI table optimization failed:', error);
      throw error;
    }
  }

  // === INSIGHTS AUTOMÁTICOS ===
  async generateAutoInsights(data) {
    try {
      log.info('💡 Generating automatic insights with AI...');
      
      // Usar ML Engine para insights
      const mlInsights = await mlEngine.generateAutoInsights(data);
      
      // Combinar con análisis tradicional
      const traditionalInsights = await this.generateInsights();
      
      // Fusionar y priorizar insights
      const combinedInsights = this.combineInsights(mlInsights, traditionalInsights);
      
      return {
        insights: combinedInsights,
        summary: this.generateInsightSummary(combinedInsights),
        actionItems: this.extractActionItems(combinedInsights)
      };
      
    } catch (error) {
      log.error('❌ Auto insights generation failed:', error);
      throw error;
    }
  }

  // === ANÁLISIS PREDICTIVO ===
  async predictRevenue(timeframe = 'today') {
    try {
      log.info('🔮 Predicting revenue for:', timeframe);

      // Obtener datos históricos
      const historicalData = await this.getHistoricalData('revenue', 30);
      
      // Factores externos (día de la semana, festivos, clima, etc.)
      const externalFactors = await this.getExternalFactors();
      
      // Aplicar algoritmo de predicción
      const prediction = await this.applyPredictionModel(historicalData, externalFactors, timeframe);
      
      // Calcular confianza de la predicción
      const confidence = this.calculateConfidence(prediction, historicalData);
      
      const result = {
        predicted: prediction.value,
        confidence: confidence,
        factors: prediction.factors,
        timeframe,
        timestamp: new Date().toISOString(),
        methodology: 'Linear Regression + External Factors',
      };

      this.predictions.set(`revenue_${timeframe}`, result);
      
      log.info('✅ Revenue prediction completed:', result);
      return result;

    } catch (error) {
      log.error('❌ Failed to predict revenue:', error);
      throw error;
    }
  }

  async predictCustomerFlow(hour) {
    try {
      log.info('👥 Predicting customer flow for hour:', hour);

      const historicalFlow = await this.getHourlyPatterns('customer_flow');
      const seasonalFactors = await this.getSeasonalFactors();
      const weatherImpact = await this.getWeatherImpact();

      // Modelo específico para flujo de clientes
      const prediction = this.calculateCustomerFlowPrediction(
        historicalFlow,
        seasonalFactors,
        weatherImpact,
        hour
      );

      const result = {
        hour,
        expectedCustomers: prediction.customers,
        peakProbability: prediction.peakProbability,
        confidence: prediction.confidence,
        recommendations: this.generateFlowRecommendations(prediction),
        timestamp: new Date().toISOString(),
      };

      this.predictions.set(`customer_flow_${hour}`, result);
      return result;

    } catch (error) {
      log.error('❌ Failed to predict customer flow:', error);
      throw error;
    }
  }

  // === DETECCIÓN DE PATRONES ===
  async detectPatterns(dataType = 'all') {
    try {
      log.info('🔍 Detecting patterns for:', dataType);

      const patterns = {};

      if (dataType === 'all' || dataType === 'revenue') {
        patterns.revenue = await this.detectRevenuePatterns();
      }

      if (dataType === 'all' || dataType === 'customer') {
        patterns.customer = await this.detectCustomerPatterns();
      }

      if (dataType === 'all' || dataType === 'operational') {
        patterns.operational = await this.detectOperationalPatterns();
      }

      this.patterns.set(dataType, patterns);
      
      log.info('✅ Pattern detection completed:', patterns);
      return patterns;

    } catch (error) {
      log.error('❌ Failed to detect patterns:', error);
      throw error;
    }
  }

  async detectRevenuePatterns() {
    const data = await this.getHistoricalData('revenue', 90);
    
    return {
      trends: this.analyzeTrends(data),
      seasonality: this.analyzeSeasonality(data),
      anomalies: this.detectAnomalies(data),
      correlations: await this.findCorrelations('revenue', data),
      cyclical: this.detectCyclicalPatterns(data),
    };
  }

  async detectCustomerPatterns() {
    const data = await this.getHistoricalData('customers', 90);
    
    return {
      behaviorSegments: this.segmentCustomers(data),
      visitFrequency: this.analyzeVisitFrequency(data),
      preferences: this.analyzePreferences(data),
      loyalty: this.analyzeLoyalty(data),
      churnRisk: this.predictChurnRisk(data),
    };
  }

  async detectOperationalPatterns() {
    const data = await this.getOperationalData(90);
    
    return {
      efficiency: this.analyzeEfficiency(data),
      bottlenecks: this.identifyBottlenecks(data),
      staffing: this.analyzeStaffingPatterns(data),
      inventory: this.analyzeInventoryPatterns(data),
      quality: this.analyzeQualityMetrics(data),
    };
  }

  // === GENERACIÓN DE INSIGHTS ===
  async generateInsights(force = false) {
    try {
      log.info('💡 Generating AI insights');

      if (!force && this.insights.length > 0 && this.isInsightsFresh()) {
        return this.insights;
      }

      const insights = [];

      // Insights de rendimiento
      const performanceInsights = await this.generatePerformanceInsights();
      insights.push(...performanceInsights);

      // Insights de oportunidades
      const opportunityInsights = await this.generateOpportunityInsights();
      insights.push(...opportunityInsights);

      // Insights de riesgos
      const riskInsights = await this.generateRiskInsights();
      insights.push(...riskInsights);

      // Insights de optimización
      const optimizationInsights = await this.generateOptimizationInsights();
      insights.push(...optimizationInsights);

      // Ordenar por prioridad e impacto
      insights.sort((a, b) => {
        return (b.priority * b.impact) - (a.priority * a.impact);
      });

      this.insights = insights.slice(0, 10); // Top 10 insights
      
      log.info('✅ AI insights generated:', this.insights.length);
      return this.insights;

    } catch (error) {
      log.error('❌ Failed to generate insights:', error);
      throw error;
    }
  }

  async generatePerformanceInsights() {
    const currentMetrics = await this.getCurrentMetrics();
    const historicalAverage = await this.getHistoricalAverage();
    const insights = [];

    // Revenue performance
    if (currentMetrics.revenue > historicalAverage.revenue * 1.2) {
      insights.push({
        type: 'performance',
        category: 'revenue',
        title: 'Rendimiento excepcional de ingresos',
        description: `Los ingresos están un ${Math.round(((currentMetrics.revenue / historicalAverage.revenue) - 1) * 100)}% por encima del promedio histórico`,
        impact: 9,
        priority: 8,
        actionable: true,
        recommendations: [
          'Analizar qué estrategias están funcionando mejor',
          'Replicar las acciones exitosas en períodos similares',
          'Considerar expandir las ofertas más rentables'
        ],
        timestamp: new Date().toISOString(),
      });
    }

    // Customer satisfaction
    if (currentMetrics.satisfaction < 4.0) {
      insights.push({
        type: 'performance',
        category: 'customer',
        title: 'Alerta: Satisfacción del cliente baja',
        description: `La satisfacción promedio (${currentMetrics.satisfaction}/5) está por debajo del objetivo`,
        impact: 8,
        priority: 9,
        actionable: true,
        recommendations: [
          'Revisar comentarios recientes de clientes',
          'Capacitar al personal en atención al cliente',
          'Implementar mejoras en el servicio inmediatamente'
        ],
        timestamp: new Date().toISOString(),
      });
    }

    return insights;
  }

  async generateOpportunityInsights() {
    const patterns = await this.detectPatterns();
    const insights = [];

    // Detectar horarios de baja ocupación
    const lowOccupancyHours = this.findLowOccupancyPeriods(patterns.operational);
    
    if (lowOccupancyHours.length > 0) {
      insights.push({
        type: 'opportunity',
        category: 'revenue',
        title: 'Oportunidad: Optimizar horarios de baja ocupación',
        description: `Se detectaron ${lowOccupancyHours.length} franjas horarias con baja ocupación`,
        impact: 7,
        priority: 6,
        actionable: true,
        recommendations: [
          'Crear promociones para horarios de baja demanda',
          'Implementar happy hours estratégicos',
          'Ajustar la dotación de personal en estos horarios'
        ],
        data: { lowOccupancyHours },
        timestamp: new Date().toISOString(),
      });
    }

    // Detectar productos populares no promocionados
    const underPromotedItems = await this.findUnderPromotedPopularItems();
    
    if (underPromotedItems.length > 0) {
      insights.push({
        type: 'opportunity',
        category: 'menu',
        title: 'Oportunidad: Promocionar platos populares',
        description: `${underPromotedItems.length} platos populares no están siendo promocionados adecuadamente`,
        impact: 6,
        priority: 5,
        actionable: true,
        recommendations: [
          'Destacar estos platos en el menú',
          'Crear combos con estos productos',
          'Formar al personal para recomendarlos'
        ],
        data: { underPromotedItems },
        timestamp: new Date().toISOString(),
      });
    }

    return insights;
  }

  async generateRiskInsights() {
    const insights = [];
    
    // Riesgo de inventario
    const inventoryRisks = await this.analyzeInventoryRisks();
    
    if (inventoryRisks.criticalItems.length > 0) {
      insights.push({
        type: 'risk',
        category: 'inventory',
        title: 'Riesgo: Artículos críticos con stock bajo',
        description: `${inventoryRisks.criticalItems.length} artículos críticos están en riesgo de agotarse`,
        impact: 8,
        priority: 9,
        actionable: true,
        recommendations: [
          'Realizar pedidos urgentes de estos artículos',
          'Contactar proveedores alternativos',
          'Implementar alertas automáticas mejoradas'
        ],
        data: inventoryRisks,
        timestamp: new Date().toISOString(),
      });
    }

    // Riesgo de churn de clientes
    const churnRisk = await this.analyzeChurnRisk();
    
    if (churnRisk.highRiskCustomers > 0) {
      insights.push({
        type: 'risk',
        category: 'customer',
        title: 'Riesgo: Clientes en peligro de abandono',
        description: `${churnRisk.highRiskCustomers} clientes tienen alta probabilidad de abandono`,
        impact: 7,
        priority: 8,
        actionable: true,
        recommendations: [
          'Implementar campaña de retención personalizada',
          'Contactar a estos clientes proactivamente',
          'Ofrecer incentivos especiales para recuperarlos'
        ],
        data: churnRisk,
        timestamp: new Date().toISOString(),
      });
    }

    return insights;
  }

  async generateOptimizationInsights() {
    const insights = [];
    
    // Optimización de personal
    const staffingOptimization = await this.analyzeStaffingOptimization();
    
    if (staffingOptimization.inefficiencies.length > 0) {
      insights.push({
        type: 'optimization',
        category: 'staffing',
        title: 'Optimización: Ajustar horarios de personal',
        description: 'Se detectaron oportunidades de optimización en los horarios del personal',
        impact: 6,
        priority: 7,
        actionable: true,
        recommendations: [
          'Redistribuir turnos según demanda histórica',
          'Implementar sistema de turnos flexibles',
          'Optimizar costos laborales sin afectar servicio'
        ],
        data: staffingOptimization,
        timestamp: new Date().toISOString(),
      });
    }

    return insights;
  }

  // === RECOMENDACIONES INTELIGENTES ===
  async generateRecommendations(context = 'general') {
    try {
      log.info('🎯 Generating AI recommendations for:', context);

      const recommendations = [];
      const currentData = await this.getCurrentMetrics();
      const insights = await this.generateInsights();

      switch (context) {
        case 'revenue':
          recommendations.push(...await this.getRevenueRecommendations(currentData, insights));
          break;
        case 'customer':
          recommendations.push(...await this.getCustomerRecommendations(currentData, insights));
          break;
        case 'operational':
          recommendations.push(...await this.getOperationalRecommendations(currentData, insights));
          break;
        default:
          recommendations.push(...await this.getGeneralRecommendations(currentData, insights));
      }

      // Priorizar recomendaciones
      recommendations.sort((a, b) => {
        const scoreA = a.impact * a.feasibility * a.urgency;
        const scoreB = b.impact * b.feasibility * b.urgency;
        return scoreB - scoreA;
      });

      log.info('✅ AI recommendations generated:', recommendations.length);
      return recommendations.slice(0, 5); // Top 5 recomendaciones

    } catch (error) {
      log.error('❌ Failed to generate recommendations:', error);
      throw error;
    }
  }

  // === MACHINE LEARNING BÁSICO ===
  async trainModels() {
    try {
      log.info('🤖 Training AI models');

      // Entrenar modelo de predicción de ingresos
      const revenueData = await this.getHistoricalData('revenue', 365);
      this.models.revenue = await this.trainLinearRegressionModel(revenueData);

      // Entrenar modelo de comportamiento de clientes
      const customerData = await this.getHistoricalData('customers', 365);
      this.models.customer = await this.trainCustomerBehaviorModel(customerData);

      // Entrenar modelo operacional
      const operationalData = await this.getOperationalData(365);
      this.models.operational = await this.trainOperationalModel(operationalData);

      log.info('✅ AI models trained successfully');

    } catch (error) {
      log.error('❌ Failed to train models:', error);
      throw error;
    }
  }

  async trainLinearRegressionModel(data) {
    // Implementación simplificada de regresión lineal
    const features = data.map(d => [
      d.dayOfWeek,
      d.isWeekend ? 1 : 0,
      d.isHoliday ? 1 : 0,
      d.weather?.temperature || 20,
      d.marketing?.spend || 0,
    ]);

    const targets = data.map(d => d.revenue);

    // Calcular coeficientes usando mínimos cuadrados
    const coefficients = this.calculateLinearRegressionCoefficients(features, targets);

    return {
      type: 'linear_regression',
      coefficients,
      trained: new Date().toISOString(),
      dataPoints: data.length,
    };
  }

  // === UTILIDADES DE ANÁLISIS ===
  async getHistoricalData(type, days) {
    try {
      const { data, error } = await supabase
        .from('analytics_historical')
        .select('*')
        .eq('type', type)
        .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];

    } catch (error) {
      log.error('❌ Failed to get historical data:', error);
      return [];
    }
  }

  async getCurrentMetrics() {
    try {
      const { data, error } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('date', new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.metrics || {};

    } catch (error) {
      log.error('❌ Failed to get current metrics:', error);
      return {};
    }
  }

  calculateLinearRegressionCoefficients(features, targets) {
    // Implementación simplificada
    // En un entorno real usarías librerías como ML.js o TensorFlow.js
    
    if (features.length === 0 || targets.length === 0) {
      return Array(features[0]?.length || 1).fill(0);
    }

    // Método de mínimos cuadrados simplificado
    const meanTarget = targets.reduce((sum, val) => sum + val, 0) / targets.length;
    const meanFeatures = features[0].map((_, idx) => 
      features.reduce((sum, feature) => sum + feature[idx], 0) / features.length
    );

    // Calcular coeficientes (implementación simplificada)
    const coefficients = meanFeatures.map((meanFeature, idx) => {
      const numerator = features.reduce((sum, feature, i) => 
        sum + (feature[idx] - meanFeature) * (targets[i] - meanTarget), 0
      );
      const denominator = features.reduce((sum, feature) => 
        sum + Math.pow(feature[idx] - meanFeature, 2), 0
      );
      
      return denominator !== 0 ? numerator / denominator : 0;
    });

    return coefficients;
  }

  isInsightsFresh() {
    if (this.insights.length === 0) return false;
    
    const lastInsight = this.insights[0];
    const maxAge = 60 * 60 * 1000; // 1 hora
    
    return (Date.now() - new Date(lastInsight.timestamp).getTime()) < maxAge;
  }

  // === EXPORTACIÓN DE ANÁLISIS ===
  async exportAnalysis(format = 'json') {
    try {
      const analysis = {
        insights: this.insights,
        patterns: Object.fromEntries(this.patterns),
        predictions: Object.fromEntries(this.predictions),
        models: this.models,
        generated: new Date().toISOString(),
      };

      if (format === 'json') {
        return JSON.stringify(analysis, null, 2);
      }

      // Otros formatos podrían añadirse aquí

      return analysis;

    } catch (error) {
      log.error('❌ Failed to export analysis:', error);
      throw error;
    }
  }

  // === LIMPIEZA ===
  cleanup() {
    this.patterns.clear();
    this.predictions.clear();
    this.insights = [];
    this.learningData = { historical: [], realtime: [], external: [] };
    
    log.info('🧹 AnalyticsAI cleaned up');
  }
}

// Instancia singleton
export const analyticsAI = new AnalyticsAI();

// Auto-inicialización de modelos
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      analyticsAI.trainModels().catch(error => {
        log.error('❌ Failed to auto-train models:', error);
      });
    }, 5000); // Esperar 5 segundos después de cargar
  });
}

export default analyticsAI;
