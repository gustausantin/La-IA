
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
  const [business, setBusiness] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [agentStatus, setAgentStatus] = useState({
    active: true, activeConversations: 0, pendingActions: 0,
    channels: { vapi: true, whatsapp: true, email: true, instagram: false, facebook: false }
  });

  const bootedRef = useRef(false);
  const lastSignInRef = useRef(null);
  const loadUserDataRef = useRef(false); // NUEVA PROTECCIÓN CONTRA EJECUCIONES MÚLTIPLES

  // ✅ FUNCIÓN REAL: Cargar información del negocio
  const fetchBusinessInfo = async (userId, forceRefresh = false) => {
    console.log('🔵 INICIANDO fetchBusinessInfo para usuario:', userId);
    
    try {
      // PASO 1: Obtener business_id del mapping
      console.log('📡 Query 1: Obteniendo business_id del mapping...');
      const { data: mappingData, error: mappingError } = await supabase
        .from('user_business_mapping')
        .select('business_id')
        .eq('auth_user_id', userId)
        .eq('active', true)
        .maybeSingle();

      if (mappingError) {
        console.error('❌ Error en mapping query:', mappingError);
        setBusiness(null);
        setBusinessId(null);
        return;
      }

        if (!mappingData) {
          console.log('⚠️ Usuario sin negocio asociado en mapping');
          setBusiness(null);
          setBusinessId(null);
          return;
        }

      console.log('✅ business_id encontrado:', mappingData.business_id);

      // PASO 2: Obtener datos del negocio
      console.log('📡 Query 2: Obteniendo datos del negocio...');
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', mappingData.business_id)
        .eq('active', true)
        .single();

      if (businessError) {
        console.error('❌ Error en businesses query:', businessError);
        setBusiness(null);
        setBusinessId(null);
        return;
      }

      console.log('✅ Negocio cargado:', businessData);
      
      setBusiness(businessData);
      setBusinessId(businessData.id);

    } catch (err) {
      console.error('💥 Error fatal en fetchBusinessInfo:', err);
      setBusiness(null);
      setBusinessId(null);
    }
  };

  // ENTERPRISE: Función para crear negocio automáticamente para usuarios huérfanos
  const createBusinessForOrphanUser = async (user) => {
    try {
      logger.info('🚀 Iniciando migración automática para usuario huérfano...', { userId: user.id, email: user.email });
      
      // Crear negocio automáticamente usando los datos del usuario
      const { data: businessData, error: businessError } = await supabase
        .rpc('create_business_securely', {
          business_data: {
            name: `Negocio de ${user.email.split('@')[0]}`,
            vertical_type: 'otros',
            email: user.email,
            phone: '+34 600 000 000', // Teléfono por defecto
            city: 'Madrid', // Ciudad por defecto
            active: true
          },
          user_profile: {
            email: user.email,
            full_name: user.email.split('@')[0] // Nombre basado en email
          }
        });

      if (businessError) {
        logger.error('❌ Error en migración automática:', businessError);
        throw businessError;
      }

      logger.info('✅ Migración automática completada:', businessData);
      
      // Actualizar estado inmediatamente
      const newBusiness = {
        id: businessData?.business_id,
        name: businessData?.business_name || `Negocio de ${user.email.split('@')[0]}`
      };
      
      setBusiness(newBusiness);
      setBusinessId(newBusiness.id);
      try {
        await realtimeService.setBusinessFilter(newBusiness.id);
      } catch {}
      
      // Disparar evento para que otras partes de la app se actualicen
      window.dispatchEvent(new CustomEvent('business-created', { 
        detail: { business: newBusiness } 
      }));
      
      logger.info('🎉 Usuario migrado exitosamente - negocio disponible');
      
    } catch (error) {
      logger.error('💥 Error crítico en migración automática:', error);
      // Silencioso - no mostrar toast innecesario
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
      
      // PASO 2: Cargar información del negocio
      logger.info('🏢 Cargando información del negocio...');
      await fetchBusinessInfo(u.id);
      
      // PASO 3: Verificar que el negocio existe (arquitectura enterprise)
      const { data: userMapping, error: mappingError } = await supabase
        .from('user_business_mapping')
        .select('business_id')
        .eq('auth_user_id', u.id)
        .maybeSingle();
      
      if (mappingError) {
        logger.error('❌ Error verificando mapping:', mappingError);
      } else if (!userMapping?.business_id) {
        logger.warn('🚨 Trigger failure - ejecutando fallback de emergencia');
        
        try {
          await createBusinessForOrphanUser(u);
          await fetchBusinessInfo(u.id);
          logger.info('✅ Fallback completado exitosamente');
        } catch (fallbackError) {
          logger.error('💥 Fallback falló:', fallbackError);
          // Silencioso - el usuario será redirigido al onboarding
        }
      } else {
        logger.info('✅ Negocio verificado correctamente');
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
        setBusiness(null); 
        setBusinessId(null);
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
    const handleBusinessUpdate = (event) => {
      const updatedBusiness = event.detail?.business;
      if (updatedBusiness) {
        console.log('🔄 AuthContext: Recibiendo actualización del negocio desde Configuración');
        setBusiness(updatedBusiness);
        setBusinessId(updatedBusiness.id);
        console.log('✅ AuthContext: Negocio actualizado en memoria');
      }
    };
    
    // ✅ Event listener para recarga forzada desde OnboardingWizard
    const handleForceBusinessReload = async () => {
      console.log('🔄 AuthContext: Recarga forzada desde OnboardingWizard');
      if (user?.id) {
        await fetchBusinessInfo(user.id, true);
        console.log('✅ AuthContext: Negocio recargado');
      }
    };
    
    window.addEventListener('business-updated', handleBusinessUpdate);
    window.addEventListener('force-business-reload', handleForceBusinessReload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('business-updated', handleBusinessUpdate);
      window.removeEventListener('force-business-reload', handleForceBusinessReload);
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
      setBusiness(null);
      setBusinessId(null);
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
    business, 
    businessId, 
    businessInfo: business,
    // Aliases para compatibilidad temporal
    restaurant: business,
    restaurantInfo: business,
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
    fetchBusinessInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthProvider };
export default AuthProvider;

