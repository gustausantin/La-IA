import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';
import { log } from '../utils/logger.js';

// Store de analytics avanzado
export const useAnalyticsStore = create()(
  devtools(
    (set, get) => ({
      // === DATOS DE ANALYTICS ===
      isLoading: false,
      error: null,
      
      // === MÉTRICAS PRINCIPALES ===
      kpis: {
        revenue: {
          today: 0,
          yesterday: 0,
          thisWeek: 0,
          lastWeek: 0,
          thisMonth: 0,
          lastMonth: 0,
          growth: 0,
        },
        customers: {
          total: 0,
          new: 0,
          returning: 0,
          satisfaction: 0,
        },
        reservations: {
          total: 0,
          confirmed: 0,
          cancelled: 0,
          noShow: 0,
          conversionRate: 0,
        },
        operational: {
          avgServiceTime: 0,
          tableRotation: 0,
          staffEfficiency: 0,
          kitchenPerformance: 0,
        },
      },
      
      // === DATOS TEMPORALES ===
      chartData: {
        revenue: [],
        customers: [],
        reservations: [],
        hourlyActivity: [],
        popularDishes: [],
        customerFlow: [],
      },
      
      // === FILTROS Y CONFIGURACIÓN ===
      filters: {
        dateRange: 'last7days',
        startDate: null,
        endDate: null,
        segment: 'all',
        metric: 'revenue',
      },
      
      // === INSIGHTS Y PREDICCIONES ===
      insights: [],
      predictions: {
        nextHourCustomers: 0,
        todayRevenue: 0,
        peakHours: [],
        recommendations: [],
      },
      
      // === COMPARATIVAS ===
      comparisons: {
        periodOverPeriod: null,
        yearOverYear: null,
        benchmarks: null,
      },
      
      // === ACCIONES PRINCIPALES ===
      loadAnalytics: async (dateRange = 'last7days') => {
        set({ isLoading: true, error: null });
        
        try {
          log.info('📊 Loading analytics data for:', dateRange);
          
          // Cargar todas las métricas en paralelo
          await Promise.all([
            get().loadKPIs(dateRange),
            get().loadChartData(dateRange),
            get().loadInsights(),
            get().loadPredictions(),
          ]);
          
          log.info('✅ Analytics data loaded');
          
        } catch (error) {
          log.error('❌ Failed to load analytics:', error);
          set({ error: error.message });
        } finally {
          set({ isLoading: false });
        }
      },
      
      // === CARGA DE KPIs ===
      loadKPIs: async (dateRange) => {
        try {
          const { data, error } = await supabase
            .rpc('get_restaurant_kpis', {
              date_range: dateRange,
            });
          
          if (error) throw error;
          
          set({ kpis: data });
          
        } catch (error) {
          log.error('❌ Failed to load KPIs:', error);
        }
      },
      
      // === CARGA DE DATOS DE GRÁFICOS ===
      loadChartData: async (dateRange) => {
        try {
          // Revenue chart
          const revenueData = await supabase
            .rpc('get_revenue_chart_data', { date_range: dateRange });
          
          // Customer flow chart
          const customerData = await supabase
            .rpc('get_customer_flow_data', { date_range: dateRange });
          
          // Reservations chart
          const reservationData = await supabase
            .rpc('get_reservations_chart_data', { date_range: dateRange });
          
          // Hourly activity
          const hourlyData = await supabase
            .rpc('get_hourly_activity_data', { date_range: dateRange });
          
          // Popular dishes
          const dishesData = await supabase
            .rpc('get_popular_dishes_data', { date_range: dateRange });
          
          set({
            chartData: {
              revenue: revenueData.data || [],
              customers: customerData.data || [],
              reservations: reservationData.data || [],
              hourlyActivity: hourlyData.data || [],
              popularDishes: dishesData.data || [],
              customerFlow: customerData.data || [],
            },
          });
          
        } catch (error) {
          log.error('❌ Failed to load chart data:', error);
        }
      },
      
      // === INSIGHTS AUTOMÁTICOS ===
      loadInsights: async () => {
        try {
          const { data, error } = await supabase
            .rpc('generate_business_insights');
          
          if (error) throw error;
          
          set({ insights: data || [] });
          
        } catch (error) {
          log.error('❌ Failed to load insights:', error);
        }
      },
      
      // === PREDICCIONES CON IA ===
      loadPredictions: async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_ai_predictions');
          
          if (error) throw error;
          
          set({ predictions: { ...get().predictions, ...data } });
          
        } catch (error) {
          log.error('❌ Failed to load predictions:', error);
        }
      },
      
      // === ANÁLISIS COMPARATIVO ===
      loadComparisons: async (comparisonType) => {
        try {
          const { data, error } = await supabase
            .rpc('get_comparative_analysis', {
              comparison_type: comparisonType,
            });
          
          if (error) throw error;
          
          set((state) => ({
            comparisons: {
              ...state.comparisons,
              [comparisonType]: data,
            },
          }));
          
        } catch (error) {
          log.error('❌ Failed to load comparisons:', error);
        }
      },
      
      // === ANÁLISIS PERSONALIZADO ===
      createCustomAnalysis: async (params) => {
        try {
          log.info('🔍 Creating custom analysis:', params);
          
          const { data, error } = await supabase
            .rpc('create_custom_analysis', params);
          
          if (error) throw error;
          
          log.info('✅ Custom analysis created');
          return data;
          
        } catch (error) {
          log.error('❌ Failed to create custom analysis:', error);
          throw error;
        }
      },
      
      // === EXPORTACIÓN DE DATOS ===
      exportData: async (format = 'csv', filters = {}) => {
        try {
          log.info('📤 Exporting analytics data:', format);
          
          const { data, error } = await supabase
            .rpc('export_analytics_data', {
              export_format: format,
              filters,
            });
          
          if (error) throw error;
          
          // Crear y descargar archivo
          const blob = new Blob([data], { 
            type: format === 'csv' ? 'text/csv' : 'application/json' 
          });
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          log.info('✅ Data exported successfully');
          
        } catch (error) {
          log.error('❌ Failed to export data:', error);
          throw error;
        }
      },
      
      // === GESTIÓN DE FILTROS ===
      updateFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
        
        // Recargar datos con nuevos filtros
        const { dateRange } = get().filters;
        get().loadAnalytics(dateRange);
      },
      
      setDateRange: (range, startDate = null, endDate = null) => {
        set((state) => ({
          filters: {
            ...state.filters,
            dateRange: range,
            startDate,
            endDate,
          },
        }));
        
        get().loadAnalytics(range);
      },
      
      // === MÉTRICAS EN TIEMPO REAL ===
      startRealTimeUpdates: () => {
        // Actualizar métricas cada 30 segundos
        const interval = setInterval(() => {
          get().updateRealTimeMetrics();
        }, 30000);
        
        return interval;
      },
      
      updateRealTimeMetrics: async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_realtime_metrics');
          
          if (error) throw error;
          
          set((state) => ({
            kpis: {
              ...state.kpis,
              ...data,
            },
          }));
          
        } catch (error) {
          log.error('❌ Failed to update real-time metrics:', error);
        }
      },
      
      // === ALERTAS Y NOTIFICACIONES ===
      checkAlerts: () => {
        const { kpis } = get();
        const alerts = [];
        
        // Alert por caída de revenue
        if (kpis.revenue.growth < -10) {
          alerts.push({
            type: 'warning',
            title: 'Caída en ingresos',
            message: `Los ingresos han caído un ${Math.abs(kpis.revenue.growth)}%`,
            metric: 'revenue',
          });
        }
        
        // Alert por baja satisfacción
        if (kpis.customers.satisfaction < 3.5) {
          alerts.push({
            type: 'error',
            title: 'Satisfacción baja',
            message: `Satisfacción del cliente: ${kpis.customers.satisfaction}/5`,
            metric: 'satisfaction',
          });
        }
        
        // Alert por alta cancelación
        if (kpis.reservations.conversionRate < 80) {
          alerts.push({
            type: 'warning',
            title: 'Alta tasa de cancelación',
            message: `Tasa de conversión: ${kpis.reservations.conversionRate}%`,
            metric: 'reservations',
          });
        }
        
        return alerts;
      },
      
      // === BENCHMARKING ===
      loadBenchmarks: async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_industry_benchmarks');
          
          if (error) throw error;
          
          set((state) => ({
            comparisons: {
              ...state.comparisons,
              benchmarks: data,
            },
          }));
          
        } catch (error) {
          log.error('❌ Failed to load benchmarks:', error);
        }
      },
      
      // === UTILIDADES ===
      getMetricGrowth: (metric, period = 'week') => {
        const { kpis } = get();
        const current = kpis[metric]?.[`this${period}`] || 0;
        const previous = kpis[metric]?.[`last${period}`] || 0;
        
        if (previous === 0) return 0;
        
        return ((current - previous) / previous) * 100;
      },
      
      formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'EUR',
        }).format(amount);
      },
      
      formatPercentage: (value, decimals = 1) => {
        return `${value.toFixed(decimals)}%`;
      },
      
      // === RESET ===
      reset: () => {
        set({
          kpis: {
            revenue: { today: 0, yesterday: 0, thisWeek: 0, lastWeek: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
            customers: { total: 0, new: 0, returning: 0, satisfaction: 0 },
            reservations: { total: 0, confirmed: 0, cancelled: 0, noShow: 0, conversionRate: 0 },
            operational: { avgServiceTime: 0, tableRotation: 0, staffEfficiency: 0, kitchenPerformance: 0 },
          },
          chartData: {
            revenue: [],
            customers: [],
            reservations: [],
            hourlyActivity: [],
            popularDishes: [],
            customerFlow: [],
          },
          insights: [],
          predictions: {
            nextHourCustomers: 0,
            todayRevenue: 0,
            peakHours: [],
            recommendations: [],
          },
          comparisons: {
            periodOverPeriod: null,
            yearOverYear: null,
            benchmarks: null,
          },
          error: null,
        });
      },
    }),
    {
      name: 'AnalyticsStore',
    }
  )
);
