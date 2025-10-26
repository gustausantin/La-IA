import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Activity, 
  Bell, 
  MessageSquare,
  Calendar,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Settings
} from 'lucide-react';
import { useRealtime, useRealtimePresence, useRealtimeAlerts } from '../../hooks/useRealtime.js';
import { Card } from '../ui/index.js';

// Componente principal de estado en tiempo real
const RealtimeStatus = ({ variant = 'compact', className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { connectionStatus, isConnected, metrics, error } = useRealtime();
  const { onlineUsers, getOnlineCount } = useRealtimePresence();
  const { alerts } = useRealtimeAlerts();

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'reconnecting': return 'text-orange-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return Wifi;
      case 'connecting': 
      case 'reconnecting': return Clock;
      case 'disconnected': return WifiOff;
      default: return WifiOff;
    }
  };

  const StatusIcon = getStatusIcon();

  if (variant === 'compact') {
    return (
      <motion.div
        className={`flex items-center gap-2 ${className}`}
        whileHover={{ scale: 1.02 }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <StatusIcon className={`w-4 h-4 ${getStatusColor()}`} />
        <span className="text-sm font-medium text-gray-700 capitalize">
          {connectionStatus}
        </span>
        {getOnlineCount() > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            <span>{getOnlineCount()}</span>
          </div>
        )}
        {alerts.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle className="w-3 h-3" />
            <span>{alerts.length}</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${getStatusColor()}`} />
            <h3 className="font-semibold text-gray-900">Estado en Tiempo Real</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Estado de conexión */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className={`text-lg font-bold ${getStatusColor()}`}>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {connectionStatus}
            </div>
          </div>
          
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {getOnlineCount()}
            </div>
            <div className="text-xs text-gray-500">
              Usuarios online
            </div>
          </div>
        </div>

        {/* Métricas */}
        {isConnected && metrics && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Latencia:</span>
              <span className="font-medium">{Math.round(metrics.avgLatency || 0)}ms</span>
            </div>
            
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">Mensajes:</span>
              <span className="font-medium">{metrics.messagesReceived || 0}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600">Uptime:</span>
              <span className="font-medium">
                {Math.round((metrics.uptime || 0) / 1000 / 60)}m
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-500" />
              <span className="text-gray-600">Reconexiones:</span>
              <span className="font-medium">{metrics.reconnections || 0}</span>
            </div>
          </div>
        )}

        {/* Alertas */}
        {alerts.length > 0 && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Alertas activas ({alerts.length})</span>
            </div>
            <div className="space-y-1">
              {alerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="text-sm text-red-700">
                  {alert.message}
                </div>
              ))}
              {alerts.length > 3 && (
                <div className="text-xs text-red-600">
                  +{alerts.length - 3} más...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span>Error de conexión</span>
            </div>
            <div className="text-sm text-red-700">{error.message}</div>
          </div>
        )}

        {/* Detalles expandidos */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-t pt-3"
            >
              <h4 className="font-medium text-gray-900">Usuarios Online</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {Object.entries(onlineUsers).map(([key, presences]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{presences[0]?.userId || 'Usuario'}</span>
                    <span className="text-gray-500 text-xs ml-auto">
                      {presences[0]?.page || '/'}
                    </span>
                  </div>
                ))}
                {Object.keys(onlineUsers).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-2">
                    No hay usuarios online
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};

// Componente de notificaciones en tiempo real
export const RealtimeNotifications = ({ className = '' }) => {
  const [notifications, setNotifications] = useState([]);
  const { subscribe } = useRealtime();

  React.useEffect(() => {
    const unsubscribes = [
      subscribe('reservation:created', (reservation) => {
        addNotification('reservation', `Nueva reserva: ${reservation.party_size} personas`, 'info');
      }),
      subscribe('message:received', (message) => {
        addNotification('message', `Nuevo mensaje: ${message.content.substring(0, 50)}...`, 'info');
      }),
      subscribe('alert:global', (alert) => {
        addNotification('alert', alert.message, 'error');
      }),
    ];

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe]);

  const addNotification = (type, message, severity) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      severity,
      timestamp: Date.now(),
    };

    setNotifications(prev => [notification, ...prev.slice(0, 4)]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'reservation': return Calendar;
      case 'message': return MessageSquare;
      case 'alert': return AlertTriangle;
      default: return Bell;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      case 'success': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = getIcon(notification.type);
          
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 300, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.9 }}
              className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 max-w-sm"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${getSeverityColor(notification.severity)}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Actualización en tiempo real
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Componente de métricas en tiempo real
export const RealtimeMetricsWidget = ({ className = '' }) => {
  const { liveMetrics } = useRealtimeMetrics();
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  const metrics = [
    { key: 'revenue', label: 'Ingresos', icon: BarChart3, color: 'text-green-600', format: '€' },
    { key: 'customers', label: 'Clientes', icon: Users, color: 'text-blue-600', format: '' },
    { key: 'reservations', label: 'Reservas', icon: Calendar, color: 'text-purple-600', format: '' },
    { key: 'messages', label: 'Mensajes', icon: MessageSquare, color: 'text-orange-600', format: '' },
  ];

  return (
    <Card variant="default" padding="md" className={className}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Métricas en Tiempo Real</h3>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500">En vivo</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const value = liveMetrics[metric.key] || 0;
            
            return (
              <motion.div
                key={metric.key}
                className={`p-2 rounded-lg border cursor-pointer transition-all ${
                  selectedMetric === metric.key 
                    ? 'border-purple-200 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedMetric(metric.key)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {metric.label}
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {value.toLocaleString()}{metric.format}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Gráfico simple o información adicional */}
        <div className="p-2 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">
            {metrics.find(m => m.key === selectedMetric)?.label} - Última actualización
          </div>
          <div className="text-xs text-gray-500">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RealtimeStatus;
