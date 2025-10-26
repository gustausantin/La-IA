import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';
import { log } from '../utils/logger.js';

// Store de comunicación y chat IA
export const useCommunicationStore = create()(
  devtools(
    (set, get) => ({
      // === ESTADO DE COMUNICACIÓN ===
      isLoading: false,
      error: null,
      isConnected: false,
      
      // === CONVERSACIONES ===
      conversations: [],
      activeConversation: null,
      unreadCount: 0,
      
      // === MENSAJES ===
      messages: {},
      isTyping: false,
      typingUsers: [],
      
      // === AGENTE IA ===
      aiAgent: {
        isActive: true,
        personality: 'friendly',
        autoRespond: true,
        responseDelay: 2000,
        knowledge: [],
      },
      
      // === CONFIGURACIÓN ===
      settings: {
        notifications: true,
        soundEnabled: true,
        autoTranslate: false,
        language: 'es',
        businessHours: true,
      },
      
      // === TEMPLATES Y RESPUESTAS ===
      templates: [],
      quickReplies: [
        '¡Hola! ¿En qué puedo ayudarte?',
        'Gracias por contactarnos',
        'Tu reserva ha sido confirmada',
        'Lamentamos las molestias',
      ],
      
      // === MÉTRICAS ===
      metrics: {
        totalConversations: 0,
        averageResponseTime: 0,
        customerSatisfaction: 0,
        resolutionRate: 0,
        aiHandledPercentage: 0,
      },
      
      // === ACCIONES PRINCIPALES ===
      loadConversations: async () => {
        set({ isLoading: true, error: null });
        
        try {
          log.info('💬 Loading conversations');
          
          const { data, error } = await supabase
            .from('conversations')
            .select(`
              *
            `)
            .order('updated_at', { ascending: false });
          
          if (error) throw error;
          
          const unreadCount = data.filter(conv => conv.unread_count > 0).length;
          
          set({ 
            conversations: data || [],
            unreadCount,
          });
          
          log.info('✅ Conversations loaded');
          
        } catch (error) {
          log.error('❌ Failed to load conversations:', error);
          set({ error: error.message });
        } finally {
          set({ isLoading: false });
        }
      },
      
      loadMessages: async (conversationId) => {
        try {
          log.info('📨 Loading messages for conversation:', conversationId);
          
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
          
          if (error) throw error;
          
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: data || [],
            },
          }));
          
          // Marcar como leído
          await get().markAsRead(conversationId);
          
        } catch (error) {
          log.error('❌ Failed to load messages:', error);
        }
      },
      
      // === GESTIÓN DE CONVERSACIONES ===
      setActiveConversation: (conversationId) => {
        set({ activeConversation: conversationId });
        
        if (conversationId) {
          get().loadMessages(conversationId);
        }
      },
      
      createConversation: async (customerData) => {
        try {
          log.info('💬 Creating new conversation');
          
          const { data, error } = await supabase
            .from('conversations')
            .insert({
              customer_id: customerData.id,
              status: 'active',
              channel: customerData.channel || 'web',
            })
            .select()
            .single();
          
          if (error) throw error;
          
          set((state) => ({
            conversations: [data, ...state.conversations],
          }));
          
          log.info('✅ Conversation created');
          return data;
          
        } catch (error) {
          log.error('❌ Failed to create conversation:', error);
          throw error;
        }
      },
      
      // === ENVÍO DE MENSAJES ===
      sendMessage: async (conversationId, content, type = 'text') => {
        try {
          log.info('📤 Sending message');
          
          const message = {
            conversation_id: conversationId,
            content,
            type,
            sender_type: 'staff',
            created_at: new Date().toISOString(),
          };
          
          // Agregar mensaje localmente de inmediato
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: [
                ...(state.messages[conversationId] || []),
                message,
              ],
            },
          }));
          
          // Enviar a la base de datos
          const { data, error } = await supabase
            .from('messages')
            .insert(message)
            .select()
            .single();
          
          if (error) throw error;
          
          // Actualizar con ID real
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId].map(msg =>
                msg === message ? data : msg
              ),
            },
          }));
          
          // Actualizar conversación
          await get().updateConversation(conversationId, {
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          });
          
          log.info('✅ Message sent');
          return data;
          
        } catch (error) {
          log.error('❌ Failed to send message:', error);
          throw error;
        }
      },
      
      // === AGENTE IA ===
      sendAIResponse: async (conversationId, userMessage) => {
        try {
          log.info('🤖 Generating AI response');
          
          const { aiAgent } = get();
          if (!aiAgent.isActive) return;
          
          // Simular typing
          get().setTyping(true);
          
          // Generar respuesta con IA
          const { data, error } = await supabase
            .rpc('generate_ai_response', {
              conversation_id: conversationId,
              user_message: userMessage,
              agent_config: aiAgent,
            });
          
          if (error) throw error;
          
          // Delay simulado
          setTimeout(async () => {
            get().setTyping(false);
            await get().sendMessage(conversationId, data.response, 'ai');
          }, aiAgent.responseDelay);
          
        } catch (error) {
          log.error('❌ Failed to generate AI response:', error);
          get().setTyping(false);
        }
      },
      
      // === GESTIÓN DE ESTADO ===
      setTyping: (isTyping) => {
        set({ isTyping });
      },
      
      markAsRead: async (conversationId) => {
        try {
          await supabase
            .from('conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);
          
          set((state) => ({
            conversations: state.conversations.map(conv =>
              conv.id === conversationId 
                ? { ...conv, unread_count: 0 }
                : conv
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }));
          
        } catch (error) {
          log.error('❌ Failed to mark as read:', error);
        }
      },
      
      updateConversation: async (conversationId, updates) => {
        try {
          const { error } = await supabase
            .from('conversations')
            .update(updates)
            .eq('id', conversationId);
          
          if (error) throw error;
          
          set((state) => ({
            conversations: state.conversations.map(conv =>
              conv.id === conversationId 
                ? { ...conv, ...updates }
                : conv
            ),
          }));
          
        } catch (error) {
          log.error('❌ Failed to update conversation:', error);
        }
      },
      
      // === TEMPLATES ===
      loadTemplates: async () => {
        try {
          const { data, error } = await supabase
            .from('message_templates')
            .select('*')
            .order('name');
          
          if (error) throw error;
          
          set({ templates: data || [] });
          
        } catch (error) {
          log.error('❌ Failed to load templates:', error);
        }
      },
      
      sendTemplate: async (conversationId, templateId) => {
        try {
          const { templates } = get();
          const template = templates.find(t => t.id === templateId);
          
          if (!template) throw new Error('Template not found');
          
          await get().sendMessage(conversationId, template.content);
          
        } catch (error) {
          log.error('❌ Failed to send template:', error);
          throw error;
        }
      },
      
      // === MÉTRICAS ===
      loadMetrics: async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_communication_metrics');
          
          if (error) throw error;
          
          set({ metrics: { ...get().metrics, ...data } });
          
        } catch (error) {
          log.error('❌ Failed to load metrics:', error);
        }
      },
      
      // === NOTIFICACIONES ===
      setupNotifications: () => {
        // Configurar notificaciones del navegador
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      },
      
      showNotification: (title, options = {}) => {
        const { settings } = get();
        
        if (!settings.notifications) return;
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            ...options,
          });
        }
        
        // Sonido de notificación
        if (settings.soundEnabled) {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {
            // Ignorar errores de autoplay
          });
        }
      },
      
      // === WEBSOCKETS TIEMPO REAL ===
      subscribeToRealtime: () => {
        try {
          log.info('🔌 Subscribing to real-time updates');
          
          const channel = supabase
            .channel('conversations')
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            }, (payload) => {
              get().handleNewMessage(payload.new);
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'conversations',
            }, (payload) => {
              get().handleConversationUpdate(payload.new);
            })
            .subscribe();
          
          set({ isConnected: true });
          
          return channel;
          
        } catch (error) {
          log.error('❌ Failed to subscribe to real-time:', error);
        }
      },
      
      handleNewMessage: (message) => {
        const { activeConversation } = get();
        
        // Agregar mensaje al store
        set((state) => ({
          messages: {
            ...state.messages,
            [message.conversation_id]: [
              ...(state.messages[message.conversation_id] || []),
              message,
            ],
          },
        }));
        
        // Mostrar notificación si no es la conversación activa
        if (message.conversation_id !== activeConversation && message.sender_type === 'customer') {
          get().showNotification('Nuevo mensaje', {
            body: message.content,
          });
        }
      },
      
      handleConversationUpdate: (conversation) => {
        set((state) => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversation.id ? conversation : conv
          ),
        }));
      },
      
      // === CONFIGURACIÓN ===
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },
      
      updateAIAgent: (newConfig) => {
        set((state) => ({
          aiAgent: { ...state.aiAgent, ...newConfig },
        }));
      },
      
      // === UTILIDADES ===
      getConversationById: (id) => {
        const { conversations } = get();
        return conversations.find(conv => conv.id === id);
      },
      
      getUnreadCount: () => {
        const { conversations } = get();
        return conversations.reduce((total, conv) => total + (conv.unread_count || 0), 0);
      },
      
      // === RESET ===
      reset: () => {
        set({
          conversations: [],
          activeConversation: null,
          messages: {},
          unreadCount: 0,
          isTyping: false,
          typingUsers: [],
          error: null,
        });
      },
    }),
    {
      name: 'CommunicationStore',
    }
  )
);
