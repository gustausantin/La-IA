// src/components/NotificationCenter.jsx
import { useEffect, useState } from "react";
import { Bell, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function NotificationCenter({ isOpen, onClose, business }) {
  // No renderizar si no está abierto
  if (!isOpen) return null;
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!business?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isMounted) return;

      if (error) {
        setNotifications([]);
      } else {
        setNotifications(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();

    return () => { isMounted = false; };
  }, [business?.id]);

  const markNotificationAsRead = async (notificationId) => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return Bell;
    }
  };

  const getNotificationBg = (type) => {
    switch (type) {
      case 'success': return 'bg-green-100';
      case 'error': return 'bg-red-100';
      case 'warning': return 'bg-yellow-100';
      case 'info': return 'bg-blue-100';
      default: return 'bg-gray-100';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  };

  if (loading) return <div>Cargando notificaciones…</div>;

  const list = Array.isArray(notifications) ? notifications : [];

  // Separar leídas y no leídas con fallbacks seguros
  const unread = list.filter(n => n && !n.read);
  const read = list.filter(n => n && n.read);

  return (
    <>
      {/* Overlay para cerrar al hacer click fuera */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Panel de notificaciones */}
      <div className="absolute top-12 right-0 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
        <div className="p-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Notificaciones ({unread.length} sin leer)
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto p-2">
          {notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.slice(0, 10).map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const timeAgo = formatNotificationTime(notification.timestamp);

              return (
                <div
                  key={notification.id}
                  className={`p-2 rounded-lg border transition-all duration-200 hover:bg-gray-50 cursor-pointer ${
                    notification.read
                      ? 'bg-white border-gray-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                  onClick={() => markNotificationAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getNotificationBg(notification.type)}`}>
                      <Icon className={`w-4 h-4 ${getNotificationColor(notification.type)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                          {notification.message}
                        </p>
                        <span className="text-xs text-gray-500 ml-2">
                          {timeAgo}
                        </span>
                      </div>
                      {notification.priority === 'high' && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          Urgente
                        </span>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-gray-300 opacity-50">
              <Bell className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay notificaciones</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
