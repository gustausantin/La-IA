
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
// Sync: import único de supabase para evitar duplicados en build
import toast from 'react-hot-toast';
import logger from '../utils/logger';
import { realtimeService } from '../services/realtimeService';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Exportar el contexto para tests
export { AuthContext };

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider');
  return ctx;
};

const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [agentStatus, setAgentStatus] = useState({
    active: true, activeConversations: 0, pendingActions: 0,
    channels: { vapi: true, whatsapp: true, email: true, instagram: false, facebook: false }
  });

  const bootedRef = useRef(false);
  const lastSignInRef = useRef(null);
  const loadUserDataRef = useRef(false); // NUEVA PROTECCIÓN CONTRA EJECUCIONES MÚLTIPLES

  // FUNCIÓN ULTRA SIMPLIFICADA Y DIRECTA
  const fetchRestaurantInfo = async (userId, forceRefresh = false) => {
    console.log('🔵 INICIANDO fetchRestaurantInfo para usuario:', userId, forceRefresh ? '(FORCE REFRESH)' : '');
    
    if (!userId) { 
      console.error('❌ No hay userId');
      setRestaurant(null); 
      setRestaurantId(null); 
      return; 
    }

    // INTENTO 1: Query directo simple
    try {
      console.log('📡 Intento 1: Query directo a user_restaurant_mapping...');
      const { data: mapping, error: mapErr } = await supabase
        .from('user_restaurant_mapping')
        .select('restaurant_id')
        .eq('auth_user_id', userId)
        .single();

      if (mapping?.restaurant_id) {
        console.log('✅ Mapping encontrado, restaurant_id:', mapping.restaurant_id);
        
        // Obtener datos del restaurante
        const { data: rest, error: restErr } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', mapping.restaurant_id)
          .single();

        if (rest) {
          console.log('✅ Restaurant encontrado:', rest.name);
          setRestaurant(rest);
          setRestaurantId(rest.id);
          return;
        }
      }
    } catch (e) {
      console.log('⚠️ Intento 1 falló:', e.message);
    }

    // INTENTO 2: RPC directa
    try {
      console.log('📡 Intento 2: RPC get_user_restaurant_info...');
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc('get_user_restaurant_info', { user_id: userId });
      
      if (rpcData?.restaurant_id) {
        console.log('✅ RPC exitosa, restaurant:', rpcData.restaurant_name);
        setRestaurant({
          id: rpcData.restaurant_id,
          name: rpcData.restaurant_name,
          email: rpcData.email,
          phone: rpcData.phone,
          city: rpcData.city,
          plan: rpcData.plan,
          active: rpcData.active
        });
        setRestaurantId(rpcData.restaurant_id);
        return;
      }
    } catch (e) {
      console.log('⚠️ Intento 2 falló:', e.message);
    }

    // INTENTO 3: Query con select expandido
    try {
      console.log('📡 Intento 3: Query con select expandido...');
      const { data: maps, error } = await supabase
        .from('user_restaurant_mapping')
        .select(`
          restaurant_id,
          restaurant:restaurants(*)
        `)
        .eq('auth_user_id', userId)
        .single();

      if (maps?.restaurant) {
        console.log('✅ Query expandido exitoso:', maps.restaurant.name);
        setRestaurant(maps.restaurant);
        setRestaurantId(maps.restaurant.id);
        return;
      }
    } catch (e) {
      console.log('⚠️ Intento 3 falló:', e.message);
    }

    // INTENTO 4: Buscar por email
    try {
      console.log('📡 Intento 4: Buscar restaurant por email del usuario...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email) {
        const { data: rest, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('email', user.email)
          .single();

        if (rest) {
          console.log('✅ Restaurant encontrado por email:', rest.name);
          setRestaurant(rest);
          setRestaurantId(rest.id);
          
          // Intentar crear el mapping si no existe
          await supabase
            .from('user_restaurant_mapping')
            .upsert({
              auth_user_id: userId,
              restaurant_id: rest.id,
              role: 'owner'
            }, { onConflict: 'auth_user_id' });
          
          return;
        }
      }
    } catch (e) {
      console.log('⚠️ Intento 4 falló:', e.message);
    }

    // Si llegamos aquí, el usuario no tiene restaurante asociado (es normal para nuevos usuarios)
    console.warn('⚠️ Usuario sin restaurante asociado - deberá completar configuración inicial');
    setRestaurant(null);
    setRestaurantId(null);
  };

  // ENTERPRISE: Función para crear restaurant automáticamente para usuarios huérfanos
  const createRestaurantForOrphanUser = async (user) => {
    try {
      logger.info('🚀 Iniciando migración automática para usuario huérfano...', { userId: user.id, email: user.email });
      
      // Crear restaurant automáticamente usando los datos del usuario
      const { data: restaurantData, error: restaurantError } = await supabase
        .rpc('create_restaurant_securely', {
          restaurant_data: {
            name: `Restaurante de ${user.email.split('@')[0]}`, // Nombre basado en email
            email: user.email,
            phone: '+34 600 000 000', // Teléfono por defecto
            city: 'Madrid', // Ciudad por defecto
            plan: 'trial',
            active: true
          },
          user_profile: {
            email: user.email,
            full_name: user.email.split('@')[0] // Nombre basado en email
          }
        });

      if (restaurantError) {
        logger.error('❌ Error en migración automática:', restaurantError);
        throw restaurantError;
      }

      logger.info('✅ Migración automática completada:', restaurantData);
      
      // Actualizar estado inmediatamente
      const restaurantInfo = {
        id: restaurantData.restaurant_id,
        name: restaurantData.restaurant_name || `Restaurante de ${user.email.split('@')[0]}`
      };
      
      setRestaurant(restaurantInfo);
      setRestaurantId(restaurantInfo.id);
      try {
        await realtimeService.setRestaurantFilter(restaurantInfo.id);
      } catch {}
      
      // Disparar evento para que otras partes de la app se actualicen
      window.dispatchEvent(new CustomEvent('restaurant-created', { 
        detail: { restaurant: restaurantInfo } 
      }));
      
      logger.info('🎉 Usuario migrado exitosamente - restaurant disponible');
      
    } catch (error) {
      logger.error('💥 Error crítico en migración automática:', error);
      // No hacer throw para que la app siga funcionando, pero logear el error
      toast.error('Error al configurar tu restaurante. Por favor, contacta con soporte.');
    }
  };

  // ENTERPRISE: loadUserData PROFESIONAL con gestión de estado robusta
  const loadUserData = async (u, source = 'unknown') => {
    // PROTECCIÓN INTELIGENTE: Solo bloquear si el mismo usuario está siendo procesado
    const userKey = `loadUserData_${u.id}`;
    
    if (window[userKey]) {
      logger.debug(`🛡️ loadUserData ya completado para usuario ${u.id} - usando datos en cache`);
      return;
    }
    
    // Si hay otra carga en progreso para un usuario diferente, esperar
    if (loadUserDataRef.current && loadUserDataRef.current !== u.id) {
      logger.warn('⏳ Otra carga en progreso, esperando...');
      await new Promise(resolve => setTimeout(resolve, 100));
      return loadUserData(u, source); // Reintentar
    }
    
    // Marcar como en progreso con el ID del usuario
    loadUserDataRef.current = u.id;
    
    logger.info('🔵 CARGA DE DATOS DE USUARIO', { 
      userId: u.id, 
      email: u.email,
      source,
      timestamp: new Date().toISOString()
    });
    
    try {
      // PASO 1: Establecer usuario y estado
      setUser(u);
      setStatus('signed_in');
      logger.info('✅ Usuario establecido en contexto');
      
      // PASO 2: Cargar información del restaurante
      logger.info('🏢 Cargando información del restaurante...');
      await fetchRestaurantInfo(u.id);
      
      // PASO 3: Verificar que el restaurante existe (arquitectura enterprise)
      const { data: userMapping, error: mappingError } = await supabase
        .from('user_restaurant_mapping')
        .select('restaurant_id')
        .eq('auth_user_id', u.id)
        .maybeSingle();
      
      if (mappingError) {
        logger.error('❌ Error verificando mapping:', mappingError);
      } else if (!userMapping?.restaurant_id) {
        logger.warn('🚨 Trigger failure - ejecutando fallback de emergencia');
        
        try {
          await createRestaurantForOrphanUser(u);
          await fetchRestaurantInfo(u.id);
          logger.info('✅ Fallback completado exitosamente');
        } catch (fallbackError) {
          logger.error('💥 Fallback falló:', fallbackError);
          toast.error('Error configurando restaurante. Contactar soporte.');
          throw fallbackError;
        }
      } else {
        logger.info('✅ Restaurant verificado correctamente');
      }
      
      // PASO 4: Marcar como completado
      window[userKey] = true;
      loadUserDataRef.current = null;
      
      logger.info('🎉 Carga de datos completada exitosamente');
      
    } catch (error) {
      logger.error('💥 Error en loadUserData:', error);
      loadUserDataRef.current = null;
      delete window[userKey];
      setStatus('error');
      throw error;
    }
  };

  const initSession = async () => {
    logger.info('🔐 Inicializando autenticación...');
    setStatus('checking');
    
    try {
      logger.debug('📡 Obteniendo sesión de Supabase...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.error('❌ Error obteniendo sesión:', error);
        throw error;
      }

      if (session?.user) {
        logger.info('✅ Sesión encontrada', { 
          userId: session.user.id,
          email: session.user.email,
          provider: session.user.app_metadata?.provider || 'email'
        });
        await loadUserData(session.user); // AHORA es async
      } else {
        logger.info('📭 No hay sesión activa');
        setUser(null); 
        setStatus('signed_out');
      }
    } catch (error) {
      logger.error('💥 Error crítico en initSession:', error);
      setStatus('signed_out');
    }
  };

  // ELIMINADO: Timeout de seguridad que causaba problemas

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    // CRÍTICO: Escuchar eventos de forzar recarga desde Configuración
    const handleForceReload = (event) => {
      const { restaurant: freshRestaurant } = event.detail;
      if (freshRestaurant) {
        logger.info('🔄 Forzando actualización de restaurant desde evento:', freshRestaurant.name);
        setRestaurant(freshRestaurant);
        setRestaurantId(freshRestaurant.id);
      }
    };

    window.addEventListener('force-restaurant-reload', handleForceReload);

    // Inicializar inmediatamente
    initSession();

    // Auth state listener PROFESIONAL - gestión robusta de eventos
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info('🔔 Auth state change', { event, hasSession: !!session });

      // IGNORAR eventos que no requieren acción
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        logger.debug('Evento ignorado:', event);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Prevenir procesamiento duplicado del mismo usuario
        if (lastSignInRef.current === session.user.id) {
          logger.debug('SIGNED_IN duplicado ignorado'); 
          return;
        }
        lastSignInRef.current = session.user.id;
        
        logger.info('🔑 Usuario autenticado', { email: session.user.email });
        
        // PROFESIONAL: Cargar datos inmediatamente, sin delays artificiales
        try {
          await loadUserData(session.user, 'auth_listener_SIGNED_IN');
        } catch (error) {
          logger.error('Error cargando datos en SIGNED_IN:', error);
        }
        
      } else if (event === 'SIGNED_OUT') {
        lastSignInRef.current = null;
        setUser(null); 
        setRestaurant(null); 
        setRestaurantId(null);
        setStatus('signed_out');
        
        // Limpiar flags de carga
        loadUserDataRef.current = null;
        
        logger.info('👋 Usuario cerró sesión');
        
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        logger.info('🚀 Sesión inicial detectada');
        
        // PROFESIONAL: Cargar datos solo si no están ya cargados
        const userKey = `loadUserData_${session.user.id}`;
        if (!window[userKey]) {
          try {
            await loadUserData(session.user, 'auth_listener_INITIAL');
          } catch (error) {
            logger.error('Error cargando datos en INITIAL_SESSION:', error);
          }
        } else {
          logger.debug('Datos ya cargados, saltando INITIAL_SESSION');
        }
      }
    });

    // Event listener para sincronización manual desde Configuración
    const handleRestaurantUpdate = (event) => {
      const updatedRestaurant = event.detail?.restaurant;
      if (updatedRestaurant) {
        console.log('🔄 AuthContext: Recibiendo actualización del restaurant desde Configuración');
        setRestaurant(updatedRestaurant);
        setRestaurantId(updatedRestaurant.id);
        console.log('✅ AuthContext: Restaurant actualizado en memoria');
      }
    };
    
    window.addEventListener('restaurant-updated', handleRestaurantUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('force-restaurant-reload', handleForceReload);
      window.removeEventListener('restaurant-updated', handleRestaurantUpdate);
    };
  }, []);

  // Helpers auth
  const login = async (email, password) => {
    try {
      logger.info('🔑 Iniciando login', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      logger.info('✅ Autenticación exitosa en Supabase');
      
      // PROFESIONAL: Cargar datos del usuario de forma síncrona
      if (data.user) {
        logger.info('📊 Cargando datos del usuario...');
        await loadUserData(data.user, 'manual_login');
        logger.info('✅ Login completado - usuario y restaurant cargados');
      }
      
      toast.success('¡Bienvenido de vuelta!');
      return { success: true };
      
    } catch (error) {
      logger.error('❌ Error en login:', error);
      
      // Mensajes de error en español
      let errorMessage = error.message;
      if (error.message === 'Invalid login credentials' || error.message === 'Invalid credentials') {
        errorMessage = 'Email o contraseña incorrectos.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Confirma tu email antes de iniciar sesión.';
      }
      
      toast.error(errorMessage || 'Error al iniciar sesión');
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email, 
        password: userData.password,
        options: { 
          data: { 
            restaurant_name: userData.restaurantName, 
            owner_name: userData.ownerName 
          } 
        }
      });
      if (error) throw error;
      if (data.user && !data.session) { 
        toast.success('¡Registro exitoso! Revisa tu email para confirmar tu cuenta.'); 
        return { success: true, needsConfirmation: true }; 
      }
      toast.success('¡Cuenta creada exitosamente!'); 
      return { success: true, needsConfirmation: false };
    } catch (error) {
      logger.error('Register error', error);
      toast.error(error.message || 'Error en el registro');
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try { 
      logger.info('Closing session...');
      await supabase.auth.signOut(); 
      logger.info('Session closed correctly');
      toast.success('Sesión cerrada correctamente'); 
    } catch (e) { 
      logger.error('Logout error', e); 
      toast.error('Error al cerrar sesión'); 
    }
  };

  const forceLogout = () => {
    try {
      logger.info('Force logout initiated');
      // Limpiar todo el estado local
      setUser(null);
      setRestaurant(null);
      setRestaurantId(null);
      setStatus('signed_out');
      setNotifications([]);
      
      // Limpiar localStorage
      localStorage.clear();
      
      // Forzar signout de Supabase sin esperar
      supabase.auth.signOut().catch(() => {}); // Ignore errors
      
      toast.success('Sesión cerrada forzadamente');
      
      // Redirigir inmediatamente
      window.location.replace('/login');
    } catch (error) {
      logger.error('Force logout error', error);
      // Aún así redirigir
      window.location.replace('/login');
    }
  };

  const restartApp = () => {
    try {
      logger.info('Restarting app');
      toast.success('Reiniciando aplicación...');
      
      // Limpiar todo
      localStorage.clear();
      sessionStorage.clear();
      
      // Recargar la página completamente
      window.location.reload();
    } catch (error) {
      logger.error('Restart app error', error);
      window.location.reload();
    }
  };

  // Notifs - SOLO ESTADO LOCAL (SIN SUPABASE PARA EVITAR ERRORES)
  const addNotification = (n) => {
    const newN = { 
      id: Date.now() + Math.random(), 
      timestamp: new Date(), 
      read: false, 
      ...n 
    };
    setNotifications((p) => [newN, ...p].slice(0, 50));
    
    // NO intentar guardar en Supabase por ahora para evitar errores 400
    // La funcionalidad principal (reservas) debe funcionar independientemente
  };
  
  const markNotificationAsRead = (id) => 
    setNotifications((p) => p.map(n => n.id === id ? { ...n, read: true } : n));
  
  const clearNotifications = () => setNotifications([]);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  const value = {
    status,
    isAuthenticated: status === 'signed_in',
    isReady: true, // SIEMPRE true - la app está lista inmediatamente
    loading: false, // NUNCA loading - eliminamos el concepto de loading
    user, 
    restaurant, 
    restaurantId, 
    restaurantInfo: restaurant,
    notifications, 
    agentStatus, 
    unreadCount,
    login, 
    register, 
    logout, 
    signOut: logout,
    forceLogout,
    restartApp,
    addNotification, 
    markNotificationAsRead, 
    markAllNotificationsAsRead: clearNotifications, 
    clearNotifications,
    fetchRestaurantInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthProvider };
export default AuthProvider;
