// hooks/useDashboardData.js - Hook optimizado para datos del Dashboard

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { format, addHours } from 'date-fns';
import toast from 'react-hot-toast';
import logger from '../utils/logger';
import { useDebounce } from './usePerformance';

const LOADING_STATES = {
  INITIAL: "initial",
  LOADING: "loading", 
  SUCCESS: "success",
  ERROR: "error",
};

export const useDashboardData = (restaurantId) => {
  // Estados principales
  const [loadingState, setLoadingState] = useState(LOADING_STATES.INITIAL);
  const [stats, setStats] = useState({
    total_reservations: 0,
    total_covers: 0,
    agent_reservations: 0,
    manual_reservations: 0,
    agent_success_rate: 0,
    avg_response_time: 0,
    whatsapp_reservations: 0,
    vapi_reservations: 0,
    web_reservations: 0,
    instagram_reservations: 0,
    facebook_reservations: 0,
    hourly_reservations: [],
    channel_distribution: [],
  });

  const [reservations, setReservations] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Función para obtener estadísticas del dashboard
  const fetchDashboardStats = useCallback(async () => {
    if (!restaurantId) return;

    try {
      // LIMPIO: Datos vacíos para nuevo restaurant
      const emptyStats = {
        total_reservations: 0,
        total_covers: 0,
        agent_reservations: 0,
        manual_reservations: 0,
        agent_success_rate: 0,
        avg_response_time: 0,
        whatsapp_reservations: 0,
        vapi_reservations: 0,
        web_reservations: 0,
        instagram_reservations: 0,
        facebook_reservations: 0,
        hourly_reservations: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          agent: 0,
          manual: 0,
        })),
        channel_distribution: [
          { name: "WhatsApp", value: 0, percentage: 0 },
          { name: "Vapi", value: 0, percentage: 0 },
          { name: "Web", value: 0, percentage: 0 },
          { name: "Instagram", value: 0, percentage: 0 },
          { name: "Manual", value: 0, percentage: 0 },
        ],
      };

      setStats(emptyStats);
      return emptyStats;
    } catch (error) {
      logger.error("Error fetching stats", error);
      toast.error("Error al cargar estadísticas");
      throw error;
    }
  }, [restaurantId]);

  // Función para obtener conversaciones del agente
  const fetchAgentConversations = useCallback(async () => {
    if (!restaurantId) return;

    try {
      // LIMPIO: Array vacío hasta tener conversaciones reales
      const emptyConversations = [];

      setConversations(emptyConversations);
      return emptyConversations;
    } catch (error) {
      logger.error("Error fetching conversations", error);
      toast.error("Error al cargar conversaciones");
      throw error;
    }
  }, [restaurantId]);

  // Función para obtener reservas del día
  const fetchTodayReservations = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id,
          customer_id,
          customer:customer_id (
            name,
            email,
            phone
          ),
          reservation_date,
          reservation_time,
          party_size,
          status,
          source,
          channel,
          created_at
        `)
        .eq("restaurant_id", restaurantId)
        .gte("reservation_date", format(new Date(), "yyyy-MM-dd"))
        .lte("reservation_date", format(addHours(new Date(), 24), "yyyy-MM-dd"))
        .order("reservation_time", { ascending: true });

      if (error) throw error;

      // Mapear datos del customer y validar campos
      const reservationsWithSource = (data || []).map(res => ({
        ...res,
        customer_name: res.customer?.name || res.customer_name,
        customer_email: res.customer?.email || res.customer_email,
        customer_phone: res.customer?.phone || res.customer_phone,
        source: res.source || 'desconocido',
        channel: res.channel || 'desconocido'
      }));

      setReservations(reservationsWithSource);
      return reservationsWithSource;
    } catch (error) {
      logger.error("Error fetching reservations", error);
      toast.error("Error al cargar reservas");
      throw error;
    }
  }, [restaurantId]);

  // Función para cargar todos los datos
  const loadDashboardData = useCallback(async () => {
    if (!restaurantId) return;

    if (loadingState === LOADING_STATES.LOADING) {
      logger.info('Dashboard: Ya está cargando, esperando...');
      return;
    }

    logger.info('Dashboard: Iniciando carga de datos...');
    setLoadingState(LOADING_STATES.LOADING);

    try {
      logger.info('Dashboard: Cargando estadísticas...');
      const [statsResult, conversationsResult, reservationsResult] = await Promise.allSettled([
        fetchDashboardStats(),
        fetchAgentConversations(),
        fetchTodayReservations(),
      ]);

      // Log de resultados
      statsResult.status === 'fulfilled' 
        ? logger.info('Stats cargadas') 
        : logger.warn('Error en stats', statsResult.reason);

      conversationsResult.status === 'fulfilled' 
        ? logger.info('Conversaciones cargadas') 
        : logger.warn('Error en conversaciones', conversationsResult.reason);

      reservationsResult.status === 'fulfilled' 
        ? logger.info('Reservas cargadas') 
        : logger.warn('Error en reservas', reservationsResult.reason);

      logger.info('Dashboard: Datos cargados exitosamente');
      setLoadingState(LOADING_STATES.SUCCESS);
    } catch (error) {
      logger.error('Dashboard: Error cargando datos', error);
      setLoadingState(LOADING_STATES.ERROR);
    }
  }, [restaurantId, loadingState, fetchDashboardStats, fetchAgentConversations, fetchTodayReservations]);

  // Función para refrescar datos
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success("Datos actualizados");
  }, [loadDashboardData]);

  // Efecto para cargar datos iniciales
  useEffect(() => {
    logger.info('Dashboard: Verificando condiciones de carga', { 
      restaurantId, 
      loadingState 
    });

    if (restaurantId && loadingState === LOADING_STATES.INITIAL) {
      logger.info('Dashboard: Iniciando carga automática inmediata...');
      loadDashboardData();
    }
  }, [restaurantId, loadingState, loadDashboardData]);

  // Suscripción real-time a reservas
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`dashboard-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservations",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          logger.info("Nueva reserva", payload);
          const newReservation = payload.new;

          // Actualizar lista de reservas
          setReservations((prev) => [newReservation, ...prev]);

          // Actualizar estadísticas
          setStats((prev) => ({
            ...prev,
            total_reservations: prev.total_reservations + 1,
            total_covers: prev.total_covers + (newReservation.party_size || 0),
            agent_reservations: newReservation.source === 'agent'
              ? prev.agent_reservations + 1
              : prev.agent_reservations,
            manual_reservations: newReservation.source === 'manual'
              ? prev.manual_reservations + 1
              : prev.manual_reservations,
          }));

          // Notificación
          toast.success(
            `Nueva reserva ${newReservation.source === 'agent' ? 'del agente' : 'manual'}: ${newReservation.customer_name}`,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  // Métricas calculadas
  const agentEfficiency = useMemo(() => {
    if (stats.total_reservations === 0) return 0;
    return Math.round((stats.agent_reservations / stats.total_reservations) * 100);
  }, [stats]);

  const peakHours = useMemo(() => {
    const sorted = [...stats.hourly_reservations].sort(
      (a, b) => b.agent + b.manual - (a.agent + a.manual),
    );
    return sorted.slice(0, 3).map((h) => h.hour.replace(":00", "h"));
  }, [stats.hourly_reservations]);

  // Versión debounced del refresh para evitar múltiples llamadas
  const debouncedRefresh = useDebounce(handleRefresh, 300);

  return {
    // Estados
    loadingState,
    refreshing,
    stats,
    reservations,
    conversations,
    
    // Métricas calculadas
    agentEfficiency,
    peakHours,
    
    // Funciones
    loadDashboardData,
    handleRefresh: debouncedRefresh,
    
    // Estados de loading
    isLoading: loadingState === LOADING_STATES.LOADING,
    isError: loadingState === LOADING_STATES.ERROR,
    isSuccess: loadingState === LOADING_STATES.SUCCESS,
  };
};
