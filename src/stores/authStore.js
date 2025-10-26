import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';
import { log } from '../utils/logger.js';

// Store de autenticación
export const useAuthStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === ESTADO DE AUTENTICACIÓN ===
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        
        // === PERFIL DE USUARIO ===
        profile: null,
        permissions: [],
        role: null,
        
        // === CONFIGURACIÓN DE SESIÓN ===
        sessionTimeout: 30 * 60 * 1000, // 30 minutos
        lastActivity: Date.now(),
        autoLogoutTimer: null,
        
        // === ACCIONES DE AUTENTICACIÓN ===
        login: async (email, password) => {
          set({ isLoading: true, error: null });
          
          try {
            log.info('🔐 Attempting login for:', email);
            
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            
            if (error) {
              throw error;
            }
            
            set({
              user: data.user,
              session: data.session,
              isAuthenticated: true,
              lastActivity: Date.now(),
            });
            
            // Cargar perfil del usuario
            await get().loadProfile();
            
            log.info('✅ Login successful');
            return { success: true };
            
          } catch (error) {
            log.error('❌ Login failed:', error);
            set({ error: error.message });
            return { success: false, error: error.message };
          } finally {
            set({ isLoading: false });
          }
        },
        
        register: async (email, password, userData = {}) => {
          set({ isLoading: true, error: null });
          
          try {
            log.info('📝 Attempting registration for:', email);
            
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: userData,
              },
            });
            
            if (error) {
              throw error;
            }
            
            log.info('✅ Registration successful');
            return { success: true, needsVerification: !data.session };
            
          } catch (error) {
            log.error('❌ Registration failed:', error);
            set({ error: error.message });
            return { success: false, error: error.message };
          } finally {
            set({ isLoading: false });
          }
        },
        
        logout: async () => {
          try {
            log.info('🚪 Logging out user');
            
            const { error } = await supabase.auth.signOut();
            
            if (error) {
              throw error;
            }
            
            // Limpiar timer de auto-logout
            const { autoLogoutTimer } = get();
            if (autoLogoutTimer) {
              clearTimeout(autoLogoutTimer);
            }
            
            // Reset del estado
            set({
              user: null,
              session: null,
              isAuthenticated: false,
              profile: null,
              permissions: [],
              role: null,
              error: null,
              autoLogoutTimer: null,
            });
            
            log.info('✅ Logout successful');
            
          } catch (error) {
            log.error('❌ Logout failed:', error);
            set({ error: error.message });
          }
        },
        
        // === GESTIÓN DE PERFIL ===
        loadProfile: async () => {
          const { user } = get();
          if (!user) return;
          
          try {
            log.info('👤 Loading user profile');
            
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            
            if (error && error.code !== 'PGRST116') {
              throw error;
            }
            
            if (data) {
              set({
                profile: data,
                role: data.role,
                permissions: data.permissions || [],
              });
              
              log.info('✅ Profile loaded');
            }
            
          } catch (error) {
            log.error('❌ Failed to load profile:', error);
          }
        },
        
        updateProfile: async (updates) => {
          const { user } = get();
          if (!user) return;
          
          try {
            log.info('📝 Updating user profile');
            
            const { data, error } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', user.id)
              .select()
              .single();
            
            if (error) {
              throw error;
            }
            
            set({ profile: data });
            log.info('✅ Profile updated');
            
            return { success: true };
            
          } catch (error) {
            log.error('❌ Failed to update profile:', error);
            return { success: false, error: error.message };
          }
        },
        
        // === GESTIÓN DE SESIÓN ===
        updateActivity: () => {
          const now = Date.now();
          set({ lastActivity: now });
          
          // Reiniciar timer de auto-logout
          get().setupAutoLogout();
        },
        
        setupAutoLogout: () => {
          const { autoLogoutTimer, sessionTimeout } = get();
          
          // Limpiar timer anterior
          if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
          }
          
          // Configurar nuevo timer
          const timer = setTimeout(() => {
            log.warn('⏰ Session timeout - auto logout');
            get().logout();
          }, sessionTimeout);
          
          set({ autoLogoutTimer: timer });
        },
        
        checkSessionValidity: () => {
          const { lastActivity, sessionTimeout } = get();
          const now = Date.now();
          
          if (now - lastActivity > sessionTimeout) {
            log.warn('⏰ Session expired');
            get().logout();
            return false;
          }
          
          return true;
        },
        
        // === GESTIÓN DE PERMISOS ===
        hasPermission: (permission) => {
          const { permissions, role } = get();
          
          // Admin tiene todos los permisos
          if (role === 'admin') return true;
          
          return permissions.includes(permission);
        },
        
        hasRole: (requiredRole) => {
          const { role } = get();
          return role === requiredRole;
        },
        
        // === RECUPERACIÓN DE CONTRASEÑA ===
        resetPassword: async (email) => {
          try {
            log.info('🔄 Requesting password reset for:', email);
            
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            
            if (error) {
              throw error;
            }
            
            log.info('✅ Password reset email sent');
            return { success: true };
            
          } catch (error) {
            log.error('❌ Password reset failed:', error);
            return { success: false, error: error.message };
          }
        },
        
        updatePassword: async (newPassword) => {
          try {
            log.info('🔄 Updating password');
            
            const { error } = await supabase.auth.updateUser({
              password: newPassword,
            });
            
            if (error) {
              throw error;
            }
            
            log.info('✅ Password updated');
            return { success: true };
            
          } catch (error) {
            log.error('❌ Password update failed:', error);
            return { success: false, error: error.message };
          }
        },
        
        // === UTILIDADES ===
        clearError: () => {
          set({ error: null });
        },
        
        // === INICIALIZACIÓN ===
        initialize: async () => {
          try {
            log.info('🚀 Initializing auth store');
            
            // Obtener sesión actual
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              set({
                user: session.user,
                session,
                isAuthenticated: true,
                lastActivity: Date.now(),
              });
              
              await get().loadProfile();
              get().setupAutoLogout();
              
              log.info('✅ Auth store initialized with existing session');
            } else {
              log.info('ℹ️ No existing session found');
            }
            
            // Escuchar cambios de autenticación
            supabase.auth.onAuthStateChange((event, session) => {
              log.info(`🔄 Auth state changed: ${event}`);
              
              if (event === 'SIGNED_IN' && session) {
                set({
                  user: session.user,
                  session,
                  isAuthenticated: true,
                  lastActivity: Date.now(),
                });
                get().loadProfile();
                get().setupAutoLogout();
              } else if (event === 'SIGNED_OUT') {
                const { autoLogoutTimer } = get();
                if (autoLogoutTimer) {
                  clearTimeout(autoLogoutTimer);
                }
                
                set({
                  user: null,
                  session: null,
                  isAuthenticated: false,
                  profile: null,
                  permissions: [],
                  role: null,
                  autoLogoutTimer: null,
                });
              }
            });
            
          } catch (error) {
            log.error('❌ Auth store initialization failed:', error);
          }
        },
      }),
      {
        name: 'la-ia-auth-store',
        partialize: (state) => ({
          lastActivity: state.lastActivity,
          sessionTimeout: state.sessionTimeout,
        }),
      }
    ),
    {
      name: 'AuthStore',
    }
  )
);
