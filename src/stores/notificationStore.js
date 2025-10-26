import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { log } from '../utils/logger.js';

// Store de notificaciones
export const useNotificationStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === NOTIFICACIONES ===
        notifications: [],
        unreadCount: 0,
        
        // === CONFIGURACIÓN ===
        settings: {
          enabled: true,
          sound: true,
          desktop: true,
          email: true,
          sms: false,
          pushNotifications: true,
        },
        
        // === TIPOS DE NOTIFICACIÓN ===
        types: {
          reservation: { enabled: true, priority: 'high' },
          message: { enabled: true, priority: 'high' },
          payment: { enabled: true, priority: 'medium' },
          inventory: { enabled: true, priority: 'medium' },
          staff: { enabled: true, priority: 'low' },
          system: { enabled: true, priority: 'high' },
          marketing: { enabled: false, priority: 'low' },
        },
        
        // === FILTROS ===
        filters: {
          type: 'all',
          priority: 'all',
          read: 'all',
          dateRange: 'all',
        },
        
        // === ACCIONES PRINCIPALES ===
        addNotification: (notification) => {
          const id = Date.now().toString();
          const newNotification = {
            id,
            timestamp: new Date().toISOString(),
            read: false,
            ...notification,
          };
          
          set((state) => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));
          
          // Mostrar notificación del navegador si está habilitada
          const { settings, types } = get();
          const typeSettings = types[notification.type] || { enabled: true };
          
          if (settings.enabled && typeSettings.enabled) {
            get().showBrowserNotification(newNotification);
          }
          
          // Log de la notificación
          log.info('🔔 New notification:', notification);
          
          return id;
        },
        
        // === NOTIFICACIONES ESPECÍFICAS ===
        addReservationNotification: (type, data) => {
          const messages = {
            new: `Nueva reserva para ${data.partySize} personas`,
            confirmed: `Reserva confirmada para ${data.customerName}`,
            cancelled: `Reserva cancelada por ${data.customerName}`,
            reminder: `Recordatorio: reserva en 1 hora`,
            noShow: `No-show: ${data.customerName} no se presentó`,
          };
          
          return get().addNotification({
            type: 'reservation',
            title: 'Reserva',
            message: messages[type] || 'Actualización de reserva',
            data,
            priority: type === 'new' ? 'high' : 'medium',
            actions: [
              { label: 'Ver detalles', action: 'viewReservation', data: data.id },
              { label: 'Contactar cliente', action: 'contactCustomer', data: data.customerId },
            ],
          });
        },
        
        addMessageNotification: (data) => {
          return get().addNotification({
            type: 'message',
            title: 'Nuevo mensaje',
            message: `${data.customerName}: ${data.preview}`,
            data,
            priority: 'high',
            actions: [
              { label: 'Responder', action: 'openChat', data: data.conversationId },
              { label: 'Marcar como leído', action: 'markAsRead', data: data.messageId },
            ],
          });
        },
        
        addPaymentNotification: (type, data) => {
          const messages = {
            received: `Pago recibido: ${data.amount}€`,
            failed: `Pago fallido: ${data.amount}€`,
            refund: `Reembolso procesado: ${data.amount}€`,
            dispute: `Disputa de pago iniciada`,
          };
          
          return get().addNotification({
            type: 'payment',
            title: 'Pago',
            message: messages[type] || 'Actualización de pago',
            data,
            priority: type === 'failed' || type === 'dispute' ? 'high' : 'medium',
          });
        },
        
        addInventoryNotification: (type, data) => {
          const messages = {
            lowStock: `Stock bajo: ${data.itemName} (${data.quantity} restantes)`,
            outOfStock: `Sin stock: ${data.itemName}`,
            delivery: `Entrega recibida: ${data.itemName}`,
            expired: `Producto vencido: ${data.itemName}`,
          };
          
          return get().addNotification({
            type: 'inventory',
            title: 'Inventario',
            message: messages[type] || 'Actualización de inventario',
            data,
            priority: type === 'outOfStock' ? 'high' : 'medium',
            actions: [
              { label: 'Ver inventario', action: 'viewInventory' },
              { label: 'Hacer pedido', action: 'orderSupplies', data: data.itemId },
            ],
          });
        },
        
        addStaffNotification: (type, data) => {
          const messages = {
            clockIn: `${data.staffName} marcó entrada`,
            clockOut: `${data.staffName} marcó salida`,
            break: `${data.staffName} tomó descanso`,
            absent: `${data.staffName} reportó ausencia`,
            overtime: `${data.staffName} trabajó horas extra`,
          };
          
          return get().addNotification({
            type: 'staff',
            title: 'Personal',
            message: messages[type] || 'Actualización de personal',
            data,
            priority: 'low',
          });
        },
        
        addSystemNotification: (type, data) => {
          const messages = {
            update: 'Nueva actualización disponible',
            maintenance: 'Mantenimiento programado',
            backup: 'Copia de seguridad completada',
            error: 'Error del sistema detectado',
            performance: 'Alerta de rendimiento',
          };
          
          return get().addNotification({
            type: 'system',
            title: 'Sistema',
            message: messages[type] || 'Notificación del sistema',
            data,
            priority: type === 'error' ? 'high' : 'medium',
          });
        },
        
        // === GESTIÓN DE NOTIFICACIONES ===
        markAsRead: (notificationId) => {
          set((state) => ({
            notifications: state.notifications.map(notification =>
              notification.id === notificationId
                ? { ...notification, read: true }
                : notification
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }));
          
          log.info('📖 Notification marked as read:', notificationId);
        },
        
        markAllAsRead: () => {
          set((state) => ({
            notifications: state.notifications.map(notification => ({
              ...notification,
              read: true,
            })),
            unreadCount: 0,
          }));
          
          log.info('📖 All notifications marked as read');
        },
        
        removeNotification: (notificationId) => {
          set((state) => {
            const notification = state.notifications.find(n => n.id === notificationId);
            const wasUnread = notification && !notification.read;
            
            return {
              notifications: state.notifications.filter(n => n.id !== notificationId),
              unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
            };
          });
          
          log.info('🗑️ Notification removed:', notificationId);
        },
        
        clearAll: () => {
          set({
            notifications: [],
            unreadCount: 0,
          });
          
          log.info('🗑️ All notifications cleared');
        },
        
        clearOld: (days = 7) => {
          const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          
          set((state) => {
            const filtered = state.notifications.filter(notification => 
              new Date(notification.timestamp) > cutoffDate
            );
            
            const removedUnread = state.notifications
              .filter(n => new Date(n.timestamp) <= cutoffDate && !n.read)
              .length;
            
            return {
              notifications: filtered,
              unreadCount: Math.max(0, state.unreadCount - removedUnread),
            };
          });
          
          log.info(`🗑️ Cleared notifications older than ${days} days`);
        },
        
        // === NOTIFICACIONES DEL NAVEGADOR ===
        requestPermission: async () => {
          if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            log.info('🔔 Notification permission:', permission);
            return permission === 'granted';
          }
          return false;
        },
        
        showBrowserNotification: (notification) => {
          const { settings } = get();
          
          if (!settings.desktop || !('Notification' in window) || Notification.permission !== 'granted') {
            return;
          }
          
          const browserNotification = new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            tag: notification.id,
            requireInteraction: notification.priority === 'high',
            data: notification.data,
          });
          
          // Auto cerrar después de 5 segundos (excepto alta prioridad)
          if (notification.priority !== 'high') {
            setTimeout(() => {
              browserNotification.close();
            }, 5000);
          }
          
          // Manejar clicks
          browserNotification.onclick = () => {
            window.focus();
            get().handleNotificationClick(notification);
            browserNotification.close();
          };
          
          // Sonido si está habilitado
          if (settings.sound) {
            get().playNotificationSound(notification.priority);
          }
        },
        
        playNotificationSound: (priority = 'medium') => {
          try {
            const sounds = {
              high: '/sounds/high-priority.mp3',
              medium: '/sounds/medium-priority.mp3',
              low: '/sounds/low-priority.mp3',
            };
            
            const audio = new Audio(sounds[priority] || sounds.medium);
            audio.volume = 0.5;
            audio.play().catch(() => {
              // Ignorar errores de autoplay
              log.debug('Could not play notification sound');
            });
          } catch (error) {
            log.error('❌ Failed to play notification sound:', error);
          }
        },
        
        // === MANEJO DE ACCIONES ===
        handleNotificationClick: (notification) => {
          // Marcar como leída
          get().markAsRead(notification.id);
          
          // Ejecutar acción por defecto basada en el tipo
          const defaultActions = {
            reservation: () => window.location.hash = '/reservas',
            message: () => window.location.hash = '/comunicacion',
            payment: () => window.location.hash = '/analytics',
            inventory: () => window.location.hash = '/inventario',
            staff: () => window.location.hash = '/personal',
            system: () => window.location.hash = '/configuracion',
          };
          
          const action = defaultActions[notification.type];
          if (action) {
            action();
          }
        },
        
        executeAction: (action, data) => {
          const actions = {
            viewReservation: (id) => window.location.hash = `/reservas/${id}`,
            contactCustomer: (customerId) => window.location.hash = `/clientes/${customerId}`,
            openChat: (conversationId) => window.location.hash = `/comunicacion/${conversationId}`,
            markAsRead: (messageId) => {
              // Implementar lógica específica
              log.info('Marking message as read:', messageId);
            },
            viewInventory: () => window.location.hash = '/inventario',
            orderSupplies: (itemId) => window.location.hash = `/inventario/order/${itemId}`,
          };
          
          const actionFn = actions[action];
          if (actionFn) {
            actionFn(data);
          }
        },
        
        // === FILTROS ===
        getFilteredNotifications: () => {
          const { notifications, filters } = get();
          
          return notifications.filter(notification => {
            // Filtro por tipo
            if (filters.type !== 'all' && notification.type !== filters.type) {
              return false;
            }
            
            // Filtro por prioridad
            if (filters.priority !== 'all' && notification.priority !== filters.priority) {
              return false;
            }
            
            // Filtro por estado de lectura
            if (filters.read === 'read' && !notification.read) {
              return false;
            }
            if (filters.read === 'unread' && notification.read) {
              return false;
            }
            
            // Filtro por fecha
            if (filters.dateRange !== 'all') {
              const notificationDate = new Date(notification.timestamp);
              const now = new Date();
              const daysDiff = Math.floor((now - notificationDate) / (1000 * 60 * 60 * 24));
              
              switch (filters.dateRange) {
                case 'today':
                  if (daysDiff > 0) return false;
                  break;
                case 'week':
                  if (daysDiff > 7) return false;
                  break;
                case 'month':
                  if (daysDiff > 30) return false;
                  break;
              }
            }
            
            return true;
          });
        },
        
        updateFilters: (newFilters) => {
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          }));
        },
        
        // === CONFIGURACIÓN ===
        updateSettings: (newSettings) => {
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          }));
          
          log.info('⚙️ Notification settings updated:', newSettings);
        },
        
        updateTypeSettings: (type, settings) => {
          set((state) => ({
            types: {
              ...state.types,
              [type]: { ...state.types[type], ...settings },
            },
          }));
          
          log.info(`⚙️ Notification type settings updated for ${type}:`, settings);
        },
        
        // === ESTADÍSTICAS ===
        getStats: () => {
          const { notifications } = get();
          
          const stats = {
            total: notifications.length,
            unread: notifications.filter(n => !n.read).length,
            byType: {},
            byPriority: {},
            recent: notifications.filter(n => 
              new Date() - new Date(n.timestamp) < 24 * 60 * 60 * 1000
            ).length,
          };
          
          // Estadísticas por tipo
          notifications.forEach(notification => {
            stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
            stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
          });
          
          return stats;
        },
        
        // === UTILIDADES ===
        getNotificationById: (id) => {
          const { notifications } = get();
          return notifications.find(n => n.id === id);
        },
        
        getRecentNotifications: (limit = 10) => {
          const { notifications } = get();
          return notifications.slice(0, limit);
        },
        
        getUnreadNotifications: () => {
          const { notifications } = get();
          return notifications.filter(n => !n.read);
        },
        
        // === PROGRAMACIÓN ===
        scheduleNotification: (notification, delay) => {
          setTimeout(() => {
            get().addNotification(notification);
          }, delay);
        },
        
        // === LIMPIEZA AUTOMÁTICA ===
        startAutoCleanup: () => {
          // Limpiar notificaciones antiguas cada hora
          const interval = setInterval(() => {
            get().clearOld(7); // Mantener solo 7 días
          }, 60 * 60 * 1000);
          
          return interval;
        },
      }),
      {
        name: 'la-ia-notification-store',
        partialize: (state) => ({
          settings: state.settings,
          types: state.types,
          filters: state.filters,
        }),
      }
    ),
    {
      name: 'NotificationStore',
    }
  )
);
