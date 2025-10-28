import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  MessageCircle, 
  Phone, 
  Mail, 
  Instagram, 
  Globe,
  Bot,
  User,
  Clock,
  Star,
  Check,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

const ConversationList = React.memo(({ 
  conversations = [], 
  selectedConversation, 
  onSelectConversation,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterChange
}) => {
  // Iconos de canales
  const channelIcons = {
    whatsapp: MessageCircle,
    phone: Phone,
    email: Mail,
    instagram: Instagram,
    web: Globe,
    ai: Bot
  };

  // Filtrar y buscar conversaciones con memoización
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      filtered = filtered.filter(conv => 
        conv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.customer_phone?.includes(searchQuery)
      );
    }

    // Filtrar por estado
    if (filterStatus !== 'all') {
      filtered = filtered.filter(conv => {
        switch (filterStatus) {
          case 'active':
            return conv.state === 'active';
          case 'pending':
            return conv.state === 'pending';
          case 'ai':
            return conv.ai_handled && !conv.human_takeover;
          case 'human':
            return conv.human_takeover;
          default:
            return true;
        }
      });
    }

    // Ordenar por última actividad
    return filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }, [conversations, searchQuery, filterStatus]);

  // Formatear tiempo de manera optimizada
  const formatTime = useCallback((dateString) => {
    try {
      const date = parseISO(dateString);
      if (isToday(date)) {
        return format(date, 'HH:mm', { locale: es });
      } else if (isYesterday(date)) {
        return 'Ayer';
      } else {
        return format(date, 'dd/MM', { locale: es });
      }
    } catch {
      return '';
    }
  }, []);

  // Componente individual de conversación
  const ConversationItem = React.memo(({ conversation }) => {
    const ChannelIcon = channelIcons[conversation.channel] || MessageCircle;
    const isSelected = selectedConversation?.id === conversation.id;
    const hasUnread = conversation.unread_count > 0;

    const getStatusColor = () => {
      if (conversation.human_takeover) return 'text-orange-600';
      if (conversation.ai_handled) return 'text-purple-600';
      if (conversation.state === 'pending') return 'text-red-600';
      return 'text-green-600';
    };

    const getStatusIcon = () => {
      if (conversation.human_takeover) return AlertCircle;
      if (conversation.ai_handled) return Bot;
      return User;
    };

    const StatusIcon = getStatusIcon();

    return (
      <div
        onClick={() => onSelectConversation(conversation)}
        className={`
          p-2 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50
          ${isSelected ? 'bg-purple-50 border-purple-200' : ''}
          ${hasUnread ? 'bg-blue-50' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Avatar y canal */}
          <div className="relative">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm
              ${conversation.channel === 'whatsapp' ? 'bg-green-500' : ''}
              ${conversation.channel === 'phone' ? 'bg-blue-500' : ''}
              ${conversation.channel === 'email' ? 'bg-red-500' : ''}
              ${conversation.channel === 'instagram' ? 'bg-pink-500' : ''}
              ${conversation.channel === 'web' ? 'bg-gray-500' : ''}
            `}>
              {conversation.customer_name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <ChannelIcon className="w-3 h-3 text-gray-600" />
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className={`font-medium truncate ${hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                {conversation.customer_name || 'Cliente Anónimo'}
              </h4>
              <div className="flex items-center gap-1">
                <StatusIcon className={`w-3 h-3 ${getStatusColor()}`} />
                <span className="text-xs text-gray-500">
                  {formatTime(conversation.updated_at)}
                </span>
              </div>
            </div>

            <p className={`text-sm truncate ${hasUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
              {conversation.last_message || 'No hay mensajes'}
            </p>

            <div className="flex items-center justify-between mt-2">
              {/* Etiquetas de estado */}
              <div className="flex items-center gap-1">
                {conversation.ai_handled && !conversation.human_takeover && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                    IA
                  </span>
                )}
                {conversation.human_takeover && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                    Humano
                  </span>
                )}
                {conversation.priority === 'high' && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                    Urgente
                  </span>
                )}
              </div>

              {/* Indicadores */}
              <div className="flex items-center gap-1">
                {hasUnread && (
                  <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                  </div>
                )}
                
                {conversation.satisfaction_rating && (
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="text-xs text-gray-600">{conversation.satisfaction_rating}</span>
                  </div>
                )}

                {/* Estado de lectura */}
                {conversation.last_message_read ? (
                  <CheckCheck className="w-3 h-3 text-blue-500" />
                ) : (
                  <Check className="w-3 h-3 text-gray-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });

  ConversationItem.displayName = 'ConversationItem';

  return (
    <div className="flex flex-col h-full">
      {/* Header con búsqueda y filtros */}
      <div className="p-2 space-y-3 border-b border-gray-200">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar conversaciones..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          >
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="pending">Pendientes</option>
            <option value="ai">Gestionadas por IA</option>
            <option value="human">Requieren humano</option>
          </select>
          
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Contador */}
        <div className="text-sm text-gray-600">
          {filteredConversations.length} conversación{filteredConversations.length !== 1 ? 'es' : ''}
          {searchQuery && ` (filtradas de ${conversations.length})`}
        </div>
      </div>

      {/* Lista de conversaciones */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
            <p className="font-medium">No hay conversaciones</p>
            <p className="text-sm text-center">
              {searchQuery ? 'Intenta con otros términos de búsqueda' : 'Las nuevas conversaciones aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ConversationList.displayName = 'ConversationList';

export default ConversationList;
