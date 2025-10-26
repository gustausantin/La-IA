import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../utils/logger';
import { supabase } from '../lib/supabase';

class RealtimeService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.sessionId = uuidv4();
    this.subscriptions = new Map();
    this.eventHandlers = new Map();
    this.heartbeatInterval = null;
    this.currentRestaurantId = null;
    
    // Estados del servicio
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
    this.lastActivity = Date.now();
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      reconnections: 0,
      avgLatency: 0,
      uptime: 0,
    };
  }

  // === INICIALIZACIÓN ===
  async initialize() {
    try {
      log.info('🔌 Initializing realtime service');
      
      // Configurar conexión con Supabase Realtime
      await this.setupSupabaseRealtime();
      
      // Inicializar WebSocket personalizado si es necesario
      // await this.connectWebSocket();
      
      // Configurar heartbeat
      this.startHeartbeat();
      
      log.info('✅ Realtime service initialized');
      
    } catch (error) {
      log.error('❌ Failed to initialize realtime service:', error);
      throw error;
    }
  }

  // === SUPABASE REALTIME ===
  async setupSupabaseRealtime() {
    try {
      log.info('📡 Setting up Supabase realtime channels');
      
      // Canal principal del restaurante (sin filtro inicial)
      this.restaurantChannel = supabase
        .channel('restaurant-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reservations',
        }, (payload) => {
          this.handleReservationUpdate(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
        }, (payload) => {
          this.handleMessageUpdate(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
        }, (payload) => {
          this.handleNotificationUpdate(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'daily_metrics',
        }, (payload) => {
          this.handleMetricsUpdate(payload);
        })
        .subscribe((status) => {
          log.info('📡 Restaurant channel status:', status);
          this.updateConnectionState(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
        });

      // Canal de presencia para usuarios online
      this.presenceChannel = supabase
        .channel('online-users', {
          config: {
            presence: {
              key: this.sessionId,
            },
          },
        })
        .on('presence', { event: 'sync' }, () => {
          const onlineUsers = this.presenceChannel.presenceState();
          this.emit('users:online', onlineUsers);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          this.emit('user:joined', { key, newPresences });
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          this.emit('user:left', { key, leftPresences });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Enviar presencia inicial
            await this.presenceChannel.track({
              userId: this.getCurrentUserId(),
              sessionId: this.sessionId,
              timestamp: new Date().toISOString(),
              page: window.location.pathname,
              userAgent: navigator.userAgent,
            });
          }
        });

      // Canal de broadcasting para eventos globales
      this.broadcastChannel = supabase
        .channel('global-events')
        .on('broadcast', { event: 'alert' }, (payload) => {
          this.handleGlobalAlert(payload);
        })
        .on('broadcast', { event: 'announcement' }, (payload) => {
          this.handleAnnouncement(payload);
        })
        .on('broadcast', { event: 'system-update' }, (payload) => {
          this.handleSystemUpdate(payload);
        })
        .subscribe();

    } catch (error) {
      log.error('❌ Failed to setup Supabase realtime:', error);
      throw error;
    }
  }

  // === FILTRO POR RESTAURANT ===
  async setRestaurantFilter(restaurantId) {
    try {
      if (!restaurantId) return;
      this.currentRestaurantId = restaurantId;

      if (this.restaurantChannel) {
        await supabase.removeChannel(this.restaurantChannel);
        this.restaurantChannel = null;
      }

      const filter = `restaurant_id=eq.${restaurantId}`;

      this.restaurantChannel = supabase
        .channel(`restaurant-updates-${restaurantId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter
        }, (payload) => {
          this.handleReservationUpdate(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter
        }, (payload) => {
          this.handleMessageUpdate(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter
        }, (payload) => {
          this.handleNotificationUpdate(payload);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'daily_metrics',
          filter
        }, (payload) => {
          this.handleMetricsUpdate(payload);
        })
        .subscribe((status) => {
          log.info('📡 Restaurant scoped channel status:', status);
          this.updateConnectionState(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
        });

      log.info('🎯 Realtime filtrado por restaurant_id', { restaurantId });
    } catch (error) {
      log.error('❌ Error setting restaurant filter:', error);
    }
  }

  // === WEBSOCKET PERSONALIZADO ===
  async connectWebSocket(url = 'ws://localhost:3001') {
    try {
      this.connectionState = 'connecting';
      log.info('🔗 Connecting to WebSocket:', url);

      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        query: {
          sessionId: this.sessionId,
          userId: this.getCurrentUserId(),
        },
      });

      // Eventos de conexión
      this.socket.on('connect', () => {
        log.info('✅ WebSocket connected');
        this.isConnected = true;
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.emit('connection:established');
        this.authenticateSocket();
      });

      this.socket.on('disconnect', (reason) => {
        log.warn('⚠️ WebSocket disconnected:', reason);
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.emit('connection:lost', reason);
        
        if (reason === 'io server disconnect') {
          // Reconexión automática
          this.handleReconnection();
        }
      });

      this.socket.on('connect_error', (error) => {
        log.error('❌ WebSocket connection error:', error);
        this.emit('connection:error', error);
        this.handleReconnection();
      });

      // Eventos de datos
      this.socket.on('data', (data) => {
        this.handleSocketData(data);
      });

      this.socket.on('pong', (latency) => {
        this.updateLatency(latency);
      });

    } catch (error) {
      log.error('❌ Failed to connect WebSocket:', error);
      throw error;
    }
  }

  // === AUTENTICACIÓN ===
  async authenticateSocket() {
    if (!this.socket || !this.isConnected) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        this.socket.emit('auth', {
          token: session.access_token,
          userId: session.user.id,
          sessionId: this.sessionId,
        });
      }
    } catch (error) {
      log.error('❌ Socket authentication failed:', error);
    }
  }

  // === MANEJO DE EVENTOS ===
  handleReservationUpdate(payload) {
    log.info('📅 Reservation update received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    this.emit('reservation:updated', {
      type: eventType,
      reservation: newRecord,
      previousReservation: oldRecord,
      timestamp: new Date().toISOString(),
    });

    // Notificación específica por tipo de evento
    switch (eventType) {
      case 'INSERT':
        this.emit('reservation:created', newRecord);
        this.showNotification('Nueva reserva', {
          body: `Reserva para ${newRecord.party_size} personas`,
          icon: '📅',
        });
        break;
      case 'UPDATE':
        this.emit('reservation:modified', { new: newRecord, old: oldRecord });
        break;
      case 'DELETE':
        this.emit('reservation:cancelled', oldRecord);
        break;
    }
  }

  handleMessageUpdate(payload) {
    log.info('💬 Message update received:', payload);
    
    const { eventType, new: newMessage } = payload;
    
    if (eventType === 'INSERT') {
      this.emit('message:received', newMessage);
      
      // Solo notificar si no es del usuario actual
      if (newMessage.sender_id !== this.getCurrentUserId()) {
        this.showNotification('Nuevo mensaje', {
          body: newMessage.content,
          icon: '💬',
        });
      }
    }
  }

  handleNotificationUpdate(payload) {
    log.info('🔔 Notification update received:', payload);
    
    const { eventType, new: notification } = payload;
    
    if (eventType === 'INSERT') {
      this.emit('notification:received', notification);
      
      // Mostrar notificación del navegador
      this.showNotification(notification.title, {
        body: notification.message,
        icon: '🔔',
        tag: notification.id,
      });
    }
  }

  handleMetricsUpdate(payload) {
    log.info('📊 Metrics update received:', payload);
    
    const { new: metrics } = payload;
    this.emit('metrics:updated', metrics);
  }

  handleGlobalAlert(payload) {
    log.warn('🚨 Global alert received:', payload);
    
    this.emit('alert:global', payload);
    
    // Mostrar alerta prominente
    this.showNotification('Alerta del sistema', {
      body: payload.message,
      icon: '🚨',
      requireInteraction: true,
    });
  }

  handleAnnouncement(payload) {
    log.info('📢 Announcement received:', payload);
    
    this.emit('announcement:received', payload);
    
    this.showNotification('Anuncio', {
      body: payload.message,
      icon: '📢',
    });
  }

  handleSystemUpdate(payload) {
    log.info('🔄 System update received:', payload);
    
    this.emit('system:update', payload);
    
    if (payload.requiresReload) {
      this.showNotification('Actualización disponible', {
        body: 'Haz clic para actualizar la aplicación',
        icon: '🔄',
        actions: [
          { action: 'reload', title: 'Actualizar ahora' },
          { action: 'dismiss', title: 'Más tarde' },
        ],
      });
    }
  }

  // === ENVÍO DE DATOS ===
  async sendMessage(channelName, event, data) {
    try {
      // Supabase broadcast
      if (this.broadcastChannel) {
        await this.broadcastChannel.send({
          type: 'broadcast',
          event: event,
          payload: {
            ...data,
            senderId: this.getCurrentUserId(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // WebSocket personalizado
      if (this.socket && this.isConnected) {
        this.socket.emit(event, {
          channel: channelName,
          data: data,
          senderId: this.getCurrentUserId(),
          timestamp: new Date().toISOString(),
        });
      }

      this.metrics.messagesSent++;
      this.lastActivity = Date.now();

    } catch (error) {
      log.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  // === SUSCRIPCIONES ===
  subscribe(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    this.eventHandlers.get(event).add(handler);
    
    const unsubscribe = () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
    };
    
    return unsubscribe;
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          log.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
    
    this.metrics.messagesReceived++;
    this.lastActivity = Date.now();
  }

  // === PRESENCIA DE USUARIOS ===
  async updatePresence(data) {
    try {
      if (this.presenceChannel) {
        await this.presenceChannel.track({
          ...data,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      log.error('❌ Failed to update presence:', error);
    }
  }

  getOnlineUsers() {
    if (this.presenceChannel) {
      return this.presenceChannel.presenceState();
    }
    return {};
  }

  // === HEARTBEAT Y SALUD ===
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        const startTime = Date.now();
        this.socket.emit('ping', startTime);
      }
      
      // Actualizar métricas de uptime
      this.metrics.uptime = Date.now() - this.lastActivity;
      
    }, 30000); // Cada 30 segundos
  }

  updateLatency(latency) {
    this.metrics.avgLatency = (this.metrics.avgLatency + latency) / 2;
  }

  // === RECONEXIÓN ===
  handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error('❌ Max reconnection attempts reached');
      this.emit('connection:failed');
      return;
    }

    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    log.info(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
    
    this.metrics.reconnections++;
  }

  // === NOTIFICACIONES ===
  async showNotification(title, options = {}) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          ...options,
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        return notification;
      }
    } catch (error) {
      log.error('❌ Failed to show notification:', error);
    }
  }

  // === UTILIDADES ===
  getCurrentUserId() {
    try {
      // Nota: getSession es asíncrono; este método puede no tener el valor inmediato
      // Por compatibilidad, intentamos recuperar del storage si existe
      const raw = localStorage.getItem('la-ia-auth-token');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.user?.id || 'anonymous';
      }
      return 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  updateConnectionState(state) {
    this.connectionState = state;
    this.emit('connection:state', state);
  }

  getConnectionStatus() {
    return {
      state: this.connectionState,
      isConnected: this.isConnected,
      sessionId: this.sessionId,
      metrics: this.metrics,
      onlineUsers: this.getOnlineUsers(),
    };
  }

  // === LIMPIEZA ===
  async disconnect() {
    try {
      log.info('🔌 Disconnecting realtime service');
      
      // Limpiar heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      // Desconectar WebSocket
      if (this.socket) {
        this.socket.disconnect();
      }
      
      // Desuscribir canales de Supabase
      if (this.restaurantChannel) {
        await supabase.removeChannel(this.restaurantChannel);
      }
      if (this.presenceChannel) {
        await supabase.removeChannel(this.presenceChannel);
      }
      if (this.broadcastChannel) {
        await supabase.removeChannel(this.broadcastChannel);
      }
      
      // Limpiar handlers
      this.eventHandlers.clear();
      
      this.isConnected = false;
      this.connectionState = 'disconnected';
      
      log.info('✅ Realtime service disconnected');
      
    } catch (error) {
      log.error('❌ Error disconnecting realtime service:', error);
    }
  }
}

// Instancia singleton
export const realtimeService = new RealtimeService();

// Auto-inicialización
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    realtimeService.initialize().catch(error => {
      log.error('❌ Failed to auto-initialize realtime service:', error);
    });
  });
  
  // Limpieza al cerrar
  window.addEventListener('beforeunload', () => {
    realtimeService.disconnect();
  });
}

export default realtimeService;
