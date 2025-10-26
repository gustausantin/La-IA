// CRMProximosMensajes.jsx - Vista de próximos mensajes CRM
// Gestión de cola de mensajes programados con acciones de envío inmediato

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  MessageSquare,
  Send,
  Edit,
  SkipForward,
  Clock,
  User,
  Crown,
  AlertTriangle,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  MoreVertical,
  Search,
  ArrowUp,
  ArrowDown,
  Zap,
  Heart,
  Users,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { es } from 'date-fns/locale';

// Componente principal
export default function CRMProximosMensajes() {
  const { restaurantId, isReady } = useAuthContext();
  
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({});
  
  const [filters, setFilters] = useState({
    search: '',
    segment: '',
    channel: '',
    rule: '',
    status: 'planned',
    dateRange: 'all'
  });
  
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);

  // Cargar mensajes programados
  const loadMessages = useCallback(async () => {
    if (!restaurantId) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('scheduled_messages')
        .select(`
          *,
          customer:customer_id(id, name, email, phone, preferences, total_visits, total_spent),
          automation_rule:automation_rule_id(name, description, target_segment),
          template:template_id(name, category, subject)
        `)
        .eq('restaurant_id', restaurantId)
        .order('scheduled_for', { ascending: true });
      
      // Aplicar filtros
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.channel) {
        query = query.eq('channel_planned', filters.channel);
      }
      
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date(now);
        
        switch (filters.dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            query = query.gte('scheduled_for', startDate.toISOString())
                         .lt('scheduled_for', new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString());
            break;
          case 'tomorrow':
            startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(0, 0, 0, 0);
            query = query.gte('scheduled_for', startDate.toISOString())
                         .lt('scheduled_for', new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString());
            break;
          case 'week':
            query = query.gte('scheduled_for', now.toISOString())
                         .lt('scheduled_for', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
            break;
        }
      }
      
      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      
      // Filtrar por búsqueda de texto
      let filteredMessages = data || [];
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredMessages = filteredMessages.filter(msg =>
          msg.customer?.name?.toLowerCase().includes(searchTerm) ||
          msg.customer?.email?.toLowerCase().includes(searchTerm) ||
          msg.automation_rule?.name?.toLowerCase().includes(searchTerm) ||
          msg.content_rendered?.toLowerCase().includes(searchTerm)
        );
      }
      
      if (filters.segment) {
        filteredMessages = filteredMessages.filter(msg =>
          msg.automation_rule?.target_segment === filters.segment
        );
      }
      
      setMessages(filteredMessages);
      
      // Calcular estadísticas
      calculateStats(filteredMessages);
      
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      toast.error('Error al cargar los mensajes programados');
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filters]);
  
  // Calcular estadísticas
  const calculateStats = (messagesData) => {
    const stats = {
      total: messagesData.length,
      planned: messagesData.filter(m => m.status === 'planned').length,
      processing: messagesData.filter(m => m.status === 'processing').length,
      sent: messagesData.filter(m => m.status === 'sent').length,
      failed: messagesData.filter(m => m.status === 'failed').length,
      whatsapp: messagesData.filter(m => m.channel_planned === 'whatsapp').length,
      email: messagesData.filter(m => m.channel_planned === 'email').length,
      today: messagesData.filter(m => isToday(parseISO(m.scheduled_for))).length,
      tomorrow: messagesData.filter(m => isTomorrow(parseISO(m.scheduled_for))).length,
      thisWeek: messagesData.filter(m => isThisWeek(parseISO(m.scheduled_for))).length
    };
    
    setStats(stats);
  };
  
  // Enviar mensaje ahora
  const sendMessageNow = async (messageId) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          scheduled_for: new Date().toISOString(),
          status: 'planned'
        })
        .eq('id', messageId);
      
      if (error) throw error;
      
      toast.success('Mensaje programado para envío inmediato');
      loadMessages();
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      toast.error('Error al programar el envío inmediato');
    }
  };
  
  // Saltar mensaje
  const skipMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'skipped',
          last_error: 'Saltado manualmente por el usuario'
        })
        .eq('id', messageId);
      
      if (error) throw error;
      
      toast.success('Mensaje saltado');
      loadMessages();
      
    } catch (error) {
      console.error('Error saltando mensaje:', error);
      toast.error('Error al saltar el mensaje');
    }
  };
  
  // Editar mensaje
  const editMessage = async (messageId, newContent) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          content_rendered: newContent
        })
        .eq('id', messageId);
      
      if (error) throw error;
      
      toast.success('Mensaje actualizado');
      loadMessages();
      setShowEditModal(null);
      
    } catch (error) {
      console.error('Error editando mensaje:', error);
      toast.error('Error al editar el mensaje');
    }
  };
  
  // Acciones en lote
  const performBatchAction = async (action) => {
    if (selectedMessages.length === 0) {
      toast.error('Selecciona al menos un mensaje');
      return;
    }
    
    try {
      let updateData = {};
      let successMessage = '';
      
      switch (action) {
        case 'send_now':
          updateData = {
            scheduled_for: new Date().toISOString(),
            status: 'planned'
          };
          successMessage = `${selectedMessages.length} mensajes programados para envío inmediato`;
          break;
        case 'skip':
          updateData = {
            status: 'skipped',
            last_error: 'Saltado manualmente en lote'
          };
          successMessage = `${selectedMessages.length} mensajes saltados`;
          break;
        default:
          return;
      }
      
      const { error } = await supabase
        .from('scheduled_messages')
        .update(updateData)
        .in('id', selectedMessages);
      
      if (error) throw error;
      
      toast.success(successMessage);
      setSelectedMessages([]);
      loadMessages();
      
    } catch (error) {
      console.error('Error en acción en lote:', error);
      toast.error('Error ejecutando la acción en lote');
    }
  };
  
  // Cargar datos al montar
  useEffect(() => {
    if (isReady && restaurantId) {
      loadMessages();
    }
  }, [isReady, restaurantId, loadMessages]);
  
  if (!isReady) {
    return <div className="p-6 text-center">Cargando...</div>;
  }
  
  if (!restaurantId) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h2 className="text-base font-semibold text-gray-900 mb-2">
          Configuración Requerida
        </h2>
        <p className="text-gray-600">
          Necesitas completar la configuración del restaurante para acceder a los mensajes CRM.
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-purple-600" />
              Próximos Mensajes CRM
            </h1>
            <p className="text-gray-600 mt-1">
              Gestiona y programa mensajes automáticos para tus clientes
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadMessages}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatsCard
          title="Total"
          value={stats.total || 0}
          icon={MessageSquare}
          color="blue"
        />
        <StatsCard
          title="Programados"
          value={stats.planned || 0}
          icon={Clock}
          color="yellow"
        />
        <StatsCard
          title="Enviados"
          value={stats.sent || 0}
          icon={CheckCircle2}
          color="green"
        />
        <StatsCard
          title="WhatsApp"
          value={stats.whatsapp || 0}
          icon={Phone}
          color="green"
        />
        <StatsCard
          title="Email"
          value={stats.email || 0}
          icon={Mail}
          color="blue"
        />
        <StatsCard
          title="Hoy"
          value={stats.today || 0}
          icon={Calendar}
          color="purple"
        />
        <StatsCard
          title="Esta Semana"
          value={stats.thisWeek || 0}
          icon={TrendingUp}
          color="indigo"
        />
      </div>
      
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar cliente, regla..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          
          {/* Estado */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Todos los estados</option>
            <option value="planned">Programados</option>
            <option value="processing">Procesando</option>
            <option value="sent">Enviados</option>
            <option value="delivered">Entregados</option>
            <option value="failed">Fallidos</option>
            <option value="skipped">Saltados</option>
          </select>
          
          {/* Canal */}
          <select
            value={filters.channel}
            onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todos los canales</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
          
          {/* Segmento */}
          <select
            value={filters.segment}
            onChange={(e) => setFilters(prev => ({ ...prev, segment: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todos los segmentos</option>
            <option value="nuevo">Nuevo</option>
            <option value="ocasional">Ocasional</option>
            <option value="regular">Regular</option>
            <option value="vip">VIP</option>
            <option value="inactivo">Inactivo</option>
            <option value="en_riesgo">En Riesgo</option>
            <option value="alto_valor">Alto Valor</option>
          </select>
          
          {/* Rango de fecha */}
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="tomorrow">Mañana</option>
            <option value="week">Esta semana</option>
          </select>
          
          {/* Acciones en lote */}
          {selectedMessages.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => performBatchAction('send_now')}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Enviar ({selectedMessages.length})
              </button>
              <button
                onClick={() => performBatchAction('skip')}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Saltar ({selectedMessages.length})
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Lista de mensajes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando mensajes...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay mensajes programados
            </h3>
            <p className="text-gray-600">
              Los mensajes automáticos aparecerán aquí cuando se evalúen las reglas de automatización.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                isSelected={selectedMessages.includes(message.id)}
                onSelect={(selected) => {
                  if (selected) {
                    setSelectedMessages(prev => [...prev, message.id]);
                  } else {
                    setSelectedMessages(prev => prev.filter(id => id !== message.id));
                  }
                }}
                onSendNow={() => sendMessageNow(message.id)}
                onSkipForward={() => skipMessage(message.id)}
                onEdit={() => setShowEditModal(message)}
                onPreview={() => setShowPreviewModal(message)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Modal de preview */}
      {showPreviewModal && (
        <PreviewModal
          message={showPreviewModal}
          onClose={() => setShowPreviewModal(null)}
        />
      )}
      
      {/* Modal de edición */}
      {showEditModal && (
        <EditModal
          message={showEditModal}
          onSave={(newContent) => editMessage(showEditModal.id, newContent)}
          onClose={() => setShowEditModal(null)}
        />
      )}
    </div>
  );
}

// Componente de tarjeta de estadísticas
const StatsCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    purple: 'text-purple-500',
    indigo: 'text-indigo-500',
    red: 'text-red-500'
  };
  
  return (
    <div className="bg-white p-2 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${colorClasses[color]}`} />
      </div>
    </div>
  );
};

// Componente de fila de mensaje
const MessageRow = ({ 
  message, 
  isSelected, 
  onSelect, 
  onSendNow, 
  onSkipForward, 
  onEdit, 
  onPreview 
}) => {
  const getStatusBadge = (status) => {
    const badges = {
      planned: { color: 'bg-yellow-100 text-yellow-800', text: 'Programado' },
      processing: { color: 'bg-blue-100 text-blue-800', text: 'Procesando' },
      sent: { color: 'bg-green-100 text-green-800', text: 'Enviado' },
      delivered: { color: 'bg-green-100 text-green-800', text: 'Entregado' },
      failed: { color: 'bg-red-100 text-red-800', text: 'Fallido' },
      skipped: { color: 'bg-gray-100 text-gray-800', text: 'Saltado' }
    };
    
    const badge = badges[status] || badges.planned;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };
  
  const getSegmentIcon = (segment) => {
    const icons = {
      nuevo: Users,
      vip: Crown,
      en_riesgo: AlertTriangle,
      alto_valor: Heart
    };
    
    const Icon = icons[segment] || Users;
    return <Icon className="w-4 h-4" />;
  };
  
  const formatScheduledDate = (dateString) => {
    const date = parseISO(dateString);
    
    if (isToday(date)) {
      return `Hoy ${format(date, 'HH:mm')}`;
    } else if (isTomorrow(date)) {
      return `Mañana ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    }
  };
  
  return (
    <div className="p-2 hover:bg-gray-50">
      <div className="flex items-center gap-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
        />
        
        {/* Cliente */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {message.customer?.name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 truncate">
                {message.customer?.name || 'Cliente sin nombre'}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {message.customer?.email || message.customer?.phone || 'Sin contacto'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Segmento */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          {getSegmentIcon(message.automation_rule?.target_segment)}
          <span className="capitalize">
            {message.automation_rule?.target_segment?.replace('_', ' ') || 'N/A'}
          </span>
        </div>
        
        {/* Regla */}
        <div className="hidden md:block w-32 text-sm text-gray-600 truncate">
          {message.automation_rule?.name || 'Sin regla'}
        </div>
        
        {/* Canal */}
        <div className="flex items-center gap-1">
          {message.channel_planned === 'whatsapp' ? (
            <Phone className="w-4 h-4 text-green-500" />
          ) : (
            <Mail className="w-4 h-4 text-blue-500" />
          )}
          <span className="text-sm text-gray-600 capitalize">
            {message.channel_planned}
          </span>
        </div>
        
        {/* Fecha programada */}
        <div className="hidden lg:block w-32 text-sm text-gray-600">
          {formatScheduledDate(message.scheduled_for)}
        </div>
        
        {/* Estado */}
        <div>
          {getStatusBadge(message.status)}
        </div>
        
        {/* Acciones */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPreview}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Ver preview"
          >
            <Eye className="w-4 h-4" />
          </button>
          
          {message.status === 'planned' && (
            <>
              <button
                onClick={onSendNow}
                className="p-2 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50"
                title="Enviar ahora"
              >
                <Send className="w-4 h-4" />
              </button>
              
              <button
                onClick={onEdit}
                className="p-2 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </button>
              
              <button
                onClick={onSkipForward}
                className="p-2 text-gray-600 hover:text-gray-700 rounded-lg hover:bg-gray-50"
                title="Saltar"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Preview del contenido */}
      <div className="mt-3 ml-8 text-sm text-gray-600 line-clamp-2">
        {message.content_rendered?.substring(0, 150)}
        {message.content_rendered?.length > 150 && '...'}
      </div>
    </div>
  );
};

// Modal de preview
const PreviewModal = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Preview del Mensaje
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Cliente:</p>
              <p className="text-gray-900">{message.customer?.name}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Canal:</p>
              <div className="flex items-center gap-2">
                {message.channel_planned === 'whatsapp' ? (
                  <Phone className="w-4 h-4 text-green-500" />
                ) : (
                  <Mail className="w-4 h-4 text-blue-500" />
                )}
                <span className="capitalize">{message.channel_planned}</span>
              </div>
            </div>
            
            {message.subject_rendered && (
              <div>
                <p className="text-sm font-medium text-gray-700">Asunto:</p>
                <p className="text-gray-900">{message.subject_rendered}</p>
              </div>
            )}
            
            <div>
              <p className="text-sm font-medium text-gray-700">Contenido:</p>
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <pre className="whitespace-pre-wrap text-gray-900 text-sm">
                  {message.content_rendered}
                </pre>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">Programado para:</p>
              <p className="text-gray-900">
                {format(parseISO(message.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: es })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal de edición
const EditModal = ({ message, onSave, onClose }) => {
  const [content, setContent] = useState(message.content_rendered || '');
  
  const handleSave = () => {
    if (!content.trim()) {
      toast.error('El contenido no puede estar vacío');
      return;
    }
    
    onSave(content);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Editar Mensaje
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Cliente: {message.customer?.name}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenido del mensaje:
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Escribe el contenido del mensaje..."
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
