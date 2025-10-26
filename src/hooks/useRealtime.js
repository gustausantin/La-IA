import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeService } from '../services/realtimeService.js';
import { log } from '../utils/logger.js';
import { useAppStore } from '../stores/appStore.js';
import { useNotificationStore } from '../stores/notificationStore.js';

// Hook principal para tiempo real
export const useRealtime = (options = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [error, setError] = useState(null);
  
  const { trackEvent } = useAppStore();
  const subscriptionsRef = useRef(new Set());

  useEffect(() => {
    // Suscribirse a cambios de estado de conexión
    const unsubscribeState = realtimeService.subscribe('connection:state', (state) => {
      setConnectionStatus(state);
      setIsConnected(state === 'connected');
      trackEvent('realtime_connection_state_changed', { state });
    });

    // Suscribirse a usuarios online
    const unsubscribeUsers = realtimeService.subscribe('users:online', (users) => {
      setOnlineUsers(users);
    });

    // Suscribirse a errores
    const unsubscribeError = realtimeService.subscribe('connection:error', (err) => {
      setError(err);
      log.error('🔴 Realtime connection error:', err);
    });

    // Obtener estado inicial
    const status = realtimeService.getConnectionStatus();
    setConnectionStatus(status.state);
    setIsConnected(status.isConnected);
    setMetrics(status.metrics);
    setOnlineUsers(status.onlineUsers);

    // Guardar suscripciones
    subscriptionsRef.current.add(unsubscribeState);
    subscriptionsRef.current.add(unsubscribeUsers);
    subscriptionsRef.current.add(unsubscribeError);

    // Limpieza
    return () => {
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, [trackEvent]);

  // Función para enviar mensajes
  const sendMessage = useCallback(async (channel, event, data) => {
    try {
      await realtimeService.sendMessage(channel, event, data);
      trackEvent('realtime_message_sent', { channel, event });
    } catch (error) {
      log.error('❌ Failed to send realtime message:', error);
      setError(error);
    }
  }, [trackEvent]);

  // Función para suscribirse a eventos
  const subscribe = useCallback((event, handler) => {
    const unsubscribe = realtimeService.subscribe(event, handler);
    subscriptionsRef.current.add(unsubscribe);
    
    trackEvent('realtime_subscription_added', { event });
    
    return () => {
      unsubscribe();
      subscriptionsRef.current.delete(unsubscribe);
    };
  }, [trackEvent]);

  // Función para actualizar presencia
  const updatePresence = useCallback(async (data) => {
    try {
      await realtimeService.updatePresence(data);
      trackEvent('realtime_presence_updated');
    } catch (error) {
      log.error('❌ Failed to update presence:', error);
      setError(error);
    }
  }, [trackEvent]);

  return {
    connectionStatus,
    isConnected,
    metrics,
    onlineUsers,
    error,
    sendMessage,
    subscribe,
    updatePresence,
    clearError: () => setError(null),
  };
};

// Hook para reservas en tiempo real
export const useRealtimeReservations = () => {
  const [recentUpdates, setRecentUpdates] = useState([]);
  const { subscribe } = useRealtime();
  const { addReservationNotification } = useNotificationStore();

  useEffect(() => {
    const unsubscribeCreated = subscribe('reservation:created', (reservation) => {
      log.info('🆕 New reservation received:', reservation);
      
      setRecentUpdates(prev => [
        { type: 'created', reservation, timestamp: Date.now() },
        ...prev.slice(0, 9) // Mantener solo los 10 más recientes
      ]);
      
      addReservationNotification('new', {
        id: reservation.id,
        customerName: reservation.customer_name,
        partySize: reservation.party_size,
        customerId: reservation.customer_id,
      });
    });

    const unsubscribeModified = subscribe('reservation:modified', ({ new: newRes, old: oldRes }) => {
      log.info('📝 Reservation modified:', { new: newRes, old: oldRes });
      
      setRecentUpdates(prev => [
        { type: 'modified', reservation: newRes, previousReservation: oldRes, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
      
      // Notificar cambios importantes
      if (oldRes.status !== newRes.status) {
        addReservationNotification(newRes.status, {
          id: newRes.id,
          customerName: newRes.customer_name,
          customerId: newRes.customer_id,
        });
      }
    });

    const unsubscribeCancelled = subscribe('reservation:cancelled', (reservation) => {
      log.info('❌ Reservation cancelled:', reservation);
      
      setRecentUpdates(prev => [
        { type: 'cancelled', reservation, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
      
      addReservationNotification('cancelled', {
        id: reservation.id,
        customerName: reservation.customer_name,
        customerId: reservation.customer_id,
      });
    });

    return () => {
      unsubscribeCreated();
      unsubscribeModified();
      unsubscribeCancelled();
    };
  }, [subscribe, addReservationNotification]);

  const clearUpdates = useCallback(() => {
    setRecentUpdates([]);
  }, []);

  return {
    recentUpdates,
    clearUpdates,
  };
};

// Hook para mensajes en tiempo real
export const useRealtimeMessages = (conversationId = null) => {
  const [newMessages, setNewMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const { subscribe, sendMessage } = useRealtime();
  const { addMessageNotification } = useNotificationStore();

  useEffect(() => {
    const unsubscribeMessage = subscribe('message:received', (message) => {
      // Filtrar por conversación si está especificada
      if (conversationId && message.conversation_id !== conversationId) {
        return;
      }
      
      log.info('💬 New message received:', message);
      
      setNewMessages(prev => [
        { ...message, timestamp: Date.now() },
        ...prev.slice(0, 19) // Mantener solo los 20 más recientes
      ]);
      
      // Notificar solo si no es del usuario actual
      if (message.sender_type === 'customer') {
        addMessageNotification({
          messageId: message.id,
          conversationId: message.conversation_id,
          customerName: message.customer_name || 'Cliente',
          preview: message.content.substring(0, 100),
        });
      }
    });

    const unsubscribeTyping = subscribe('user:typing', (data) => {
      if (conversationId && data.conversationId !== conversationId) {
        return;
      }
      
      setTypingUsers(prev => {
        const filtered = prev.filter(user => user.userId !== data.userId);
        return data.isTyping 
          ? [...filtered, { userId: data.userId, name: data.name, timestamp: Date.now() }]
          : filtered;
      });
      
      // Limpiar usuarios que llevan mucho tiempo "escribiendo"
      setTimeout(() => {
        setTypingUsers(prev => 
          prev.filter(user => Date.now() - user.timestamp < 10000)
        );
      }, 10000);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeTyping();
    };
  }, [subscribe, conversationId, addMessageNotification]);

  // Función para enviar indicador de escritura
  const sendTypingIndicator = useCallback(async (isTyping = true) => {
    if (!conversationId) return;
    
    try {
      await sendMessage('chat', 'user:typing', {
        conversationId,
        isTyping,
        userId: 'current-user', // Esto debería venir del store de auth
        name: 'Staff', // Esto también debería venir del store de auth
      });
    } catch (error) {
      log.error('❌ Failed to send typing indicator:', error);
    }
  }, [sendMessage, conversationId]);

  const clearMessages = useCallback(() => {
    setNewMessages([]);
  }, []);

  return {
    newMessages,
    typingUsers,
    sendTypingIndicator,
    clearMessages,
  };
};

// Hook para métricas en tiempo real
export const useRealtimeMetrics = () => {
  const [liveMetrics, setLiveMetrics] = useState({});
  const [history, setHistory] = useState([]);
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribeMetrics = subscribe('metrics:updated', (metrics) => {
      log.info('📊 Metrics updated:', metrics);
      
      setLiveMetrics(prev => ({ ...prev, ...metrics }));
      
      // Agregar al historial
      setHistory(prev => [
        { ...metrics, timestamp: Date.now() },
        ...prev.slice(0, 99) // Mantener últimas 100 entradas
      ]);
    });

    return () => {
      unsubscribeMetrics();
    };
  }, [subscribe]);

  const getMetricHistory = useCallback((metricName, limit = 20) => {
    return history
      .filter(entry => entry[metricName] !== undefined)
      .slice(0, limit)
      .map(entry => ({
        value: entry[metricName],
        timestamp: entry.timestamp,
      }));
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    liveMetrics,
    history,
    getMetricHistory,
    clearHistory,
  };
};

// Hook para alertas globales
export const useRealtimeAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const { subscribe } = useRealtime();
  const { addSystemNotification } = useNotificationStore();

  useEffect(() => {
    const unsubscribeAlert = subscribe('alert:global', (alert) => {
      log.warn('🚨 Global alert received:', alert);
      
      setAlerts(prev => [
        { ...alert, id: Date.now(), timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
      
      addSystemNotification('error', {
        message: alert.message,
        severity: alert.severity,
      });
    });

    const unsubscribeAnnouncement = subscribe('announcement:received', (announcement) => {
      log.info('📢 Announcement received:', announcement);
      
      setAnnouncements(prev => [
        { ...announcement, id: Date.now(), timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
    });

    const unsubscribeSystemUpdate = subscribe('system:update', (update) => {
      log.info('🔄 System update received:', update);
      
      addSystemNotification('update', {
        message: update.message,
        version: update.version,
        requiresReload: update.requiresReload,
      });
    });

    return () => {
      unsubscribeAlert();
      unsubscribeAnnouncement();
      unsubscribeSystemUpdate();
    };
  }, [subscribe, addSystemNotification]);

  const dismissAlert = useCallback((alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const dismissAnnouncement = useCallback((announcementId) => {
    setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
    setAnnouncements([]);
  }, []);

  return {
    alerts,
    announcements,
    dismissAlert,
    dismissAnnouncement,
    clearAll,
  };
};

// Hook para presencia de usuarios
export const useRealtimePresence = () => {
  const [onlineUsers, setOnlineUsers] = useState({});
  const [userActivity, setUserActivity] = useState([]);
  const { subscribe, updatePresence } = useRealtime();

  useEffect(() => {
    const unsubscribeJoin = subscribe('user:joined', ({ key, newPresences }) => {
      log.info('👋 User joined:', { key, newPresences });
      
      setUserActivity(prev => [
        { type: 'joined', userId: key, timestamp: Date.now(), data: newPresences },
        ...prev.slice(0, 19)
      ]);
    });

    const unsubscribeLeave = subscribe('user:left', ({ key, leftPresences }) => {
      log.info('👋 User left:', { key, leftPresences });
      
      setUserActivity(prev => [
        { type: 'left', userId: key, timestamp: Date.now(), data: leftPresences },
        ...prev.slice(0, 19)
      ]);
    });

    const unsubscribeOnline = subscribe('users:online', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      unsubscribeJoin();
      unsubscribeLeave();
      unsubscribeOnline();
    };
  }, [subscribe]);

  // Actualizar presencia automáticamente
  useEffect(() => {
    const updateInterval = setInterval(() => {
      updatePresence({
        page: window.location.pathname,
        lastActivity: Date.now(),
        isActive: document.hasFocus(),
      });
    }, 30000); // Cada 30 segundos

    return () => clearInterval(updateInterval);
  }, [updatePresence]);

  const getOnlineCount = useCallback(() => {
    return Object.keys(onlineUsers).length;
  }, [onlineUsers]);

  const isUserOnline = useCallback((userId) => {
    return Object.values(onlineUsers).some(presence => 
      presence.some(p => p.userId === userId)
    );
  }, [onlineUsers]);

  return {
    onlineUsers,
    userActivity,
    getOnlineCount,
    isUserOnline,
  };
};

export default useRealtime;
