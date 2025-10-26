import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Clock, 
  Bot, 
  User,
  AlertCircle,
  Star,
  ThumbsUp,
  ThumbsDown,
  Info,
  Settings,
  MoreVertical
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const MessageArea = React.memo(({ 
  selectedConversation, 
  messages = [], 
  newMessage, 
  onNewMessageChange, 
  onSendMessage, 
  sendingMessage = false,
  onShowCustomerInfo 
}) => {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll a los nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  // Manejo optimizado del envío
  const handleSend = useCallback(() => {
    if (newMessage.trim() && !sendingMessage) {
      onSendMessage();
    }
  }, [newMessage, sendingMessage, onSendMessage]);

  // Manejo de teclas
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Formatear hora del mensaje
  const formatMessageTime = useCallback((timestamp) => {
    try {
      return format(parseISO(timestamp), 'HH:mm', { locale: es });
    } catch {
      return '';
    }
  }, []);

  // Componente individual de mensaje
  const MessageItem = React.memo(({ message }) => {
    const isOwn = message.direction === 'outbound';
    const isAI = message.ai_generated;

    const getStatusIcon = () => {
      if (message.status === 'delivered') return <CheckCheck className="w-3 h-3 text-blue-500" />;
      if (message.status === 'sent') return <Check className="w-3 h-3 text-gray-400" />;
      if (message.status === 'pending') return <Clock className="w-3 h-3 text-gray-400" />;
      return null;
    };

    return (
      <div className={`flex gap-3 mb-4 ${isOwn ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0
          ${isOwn ? 'bg-purple-500' : isAI ? 'bg-blue-500' : 'bg-gray-500'}
        `}>
          {isOwn ? 'Tú' : isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>

        {/* Contenido del mensaje */}
        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
          {/* Etiqueta del remitente */}
          <div className={`text-xs text-gray-500 mb-1 ${isOwn ? 'text-right' : ''}`}>
            {isOwn ? 'Tú' : isAI ? 'IA Assistant' : selectedConversation?.customer_name || 'Cliente'}
            {isAI && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                IA
              </span>
            )}
          </div>

          {/* Burbuja del mensaje */}
          <div className={`
            px-4 py-2 rounded-2xl break-words
            ${isOwn 
              ? 'bg-purple-500 text-white rounded-tr-sm' 
              : isAI 
                ? 'bg-blue-50 text-blue-900 border border-blue-200 rounded-tl-sm'
                : 'bg-gray-100 text-gray-900 rounded-tl-sm'
            }
          `}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            
            {/* Metadatos del mensaje */}
            <div className={`flex items-center gap-1 mt-1 text-xs ${
              isOwn ? 'text-purple-200' : 'text-gray-500'
            }`}>
              <span>{formatMessageTime(message.created_at)}</span>
              {isOwn && getStatusIcon()}
            </div>
          </div>

          {/* Acciones de IA (solo para mensajes de IA) */}
          {isAI && !isOwn && (
            <div className="flex items-center gap-2 mt-2">
              <button 
                onClick={() => toast.success('Respuesta útil marcada')}
                className="p-1 hover:bg-green-100 rounded transition-colors"
                title="Respuesta útil"
              >
                <ThumbsUp className="w-3 h-3 text-green-600" />
              </button>
              <button 
                onClick={() => toast('Feedback enviado', { icon: '✅' })}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Mejorar respuesta"
              >
                <ThumbsDown className="w-3 h-3 text-red-600" />
              </button>
              <button 
                onClick={() => toast('Transfiriendo a humano...', { icon: '👤' })}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Transferir a humano
              </button>
            </div>
          )}
        </div>
      </div>
    );
  });

  MessageItem.displayName = 'MessageItem';

  // Estado de la conversación
  const conversationStatus = useMemo(() => {
    if (!selectedConversation) return null;
    
    if (selectedConversation.human_takeover) {
      return {
        icon: User,
        text: 'Gestionado por humano',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50'
      };
    }
    
    if (selectedConversation.ai_handled) {
      return {
        icon: Bot,
        text: 'Gestionado por IA',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      };
    }
    
    return {
      icon: AlertCircle,
      text: 'Pendiente de respuesta',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    };
  }, [selectedConversation]);

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Selecciona una conversación
          </h3>
          <p className="text-gray-600 max-w-sm">
            Elige una conversación de la lista para comenzar a chatear con el cliente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header de la conversación */}
      <div className="p-2 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar del cliente */}
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-medium">
              {selectedConversation.customer_name?.charAt(0).toUpperCase() || 'C'}
            </div>
            
            {/* Info del cliente */}
            <div>
              <h3 className="font-semibold text-gray-900">
                {selectedConversation.customer_name || 'Cliente Anónimo'}
              </h3>
              <div className="flex items-center gap-2">
                {conversationStatus && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${conversationStatus.bgColor} ${conversationStatus.color}`}>
                    <conversationStatus.icon className="w-3 h-3" />
                    {conversationStatus.text}
                  </div>
                )}
                {selectedConversation.satisfaction_rating && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs">{selectedConversation.satisfaction_rating}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button 
              onClick={onShowCustomerInfo}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Ver información del cliente"
            >
              <Info className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="font-medium mb-1">No hay mensajes aún</p>
              <p className="text-sm">Envía el primer mensaje para comenzar la conversación</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje */}
      <div className="p-2 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-3">
          {/* Botones de acción */}
          <div className="flex gap-1">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Paperclip className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Smile className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent max-h-32"
              disabled={sendingMessage}
            />
          </div>

          {/* Botón enviar */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendingMessage}
            className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {sendingMessage ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Sugerencias de respuesta rápida */}
        {selectedConversation?.ai_handled && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {['¡Hola! ¿En qué puedo ayudarte?', 'Perfecto, te ayudo con tu reserva', '¿Prefieres mesa interior o terraza?'].map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onNewMessageChange(suggestion)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MessageArea.displayName = 'MessageArea';

export default MessageArea;