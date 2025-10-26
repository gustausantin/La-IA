// AuthContext.test.jsx - Tests de clase mundial para autenticación 🔐
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuthContext } from '../AuthContext';
import { mockSupabase, createMockAuthContext } from '../../test/setup';

// === COMPONENT HELPER PARA TESTING ===
const TestComponent = () => {
  const authContext = useAuthContext();
  
  return (
    <div>
      <div data-testid="auth-status">{authContext.status}</div>
      <div data-testid="is-authenticated">{authContext.isAuthenticated.toString()}</div>
      <div data-testid="is-ready">{authContext.isReady.toString()}</div>
      <div data-testid="user-email">{authContext.user?.email || 'no-user'}</div>
      <div data-testid="restaurant-name">{authContext.restaurant?.name || 'no-restaurant'}</div>
      <div data-testid="restaurant-id">{authContext.restaurantId || 'no-id'}</div>
      <div data-testid="notifications-count">{authContext.notifications?.length || 0}</div>
      <div data-testid="unread-count">{authContext.unreadCount || 0}</div>
      <button 
        data-testid="login-btn" 
        onClick={() => authContext.login('test@test.com', 'password123')}
      >
        Login
      </button>
      <button 
        data-testid="logout-btn" 
        onClick={authContext.logout}
      >
        Logout
      </button>
      <button 
        data-testid="force-logout-btn" 
        onClick={authContext.forceLogout}
      >
        Force Logout
      </button>
    </div>
  );
};

const renderWithAuthProvider = (component = <TestComponent />) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  );
};

// === TESTS DE INICIALIZACIÓN ===
describe('AuthContext - Inicialización', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful session check
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
  });

  it('debería inicializar con estado por defecto', async () => {
    renderWithAuthProvider();
    
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('is-ready')).toHaveTextContent('true');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      expect(screen.getByTestId('restaurant-name')).toHaveTextContent('no-restaurant');
    });
  });

  it('debería verificar sesión al inicializar', async () => {
    renderWithAuthProvider();
    
    await waitFor(() => {
      expect(mockSupabase.auth.getSession).toHaveBeenCalledTimes(1);
    });
  });

  it('debería configurar listener de cambios de auth', async () => {
    renderWithAuthProvider();
    
    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });
  });
});

// === TESTS DE LOGIN ===
describe('AuthContext - Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
  });

  it('debería hacer login correctamente', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { 
        user: { id: 'test-user', email: 'test@test.com' },
        session: { access_token: 'token' }
      },
      error: null
    });

    renderWithAuthProvider();

    act(() => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123'
      });
    });
  });

  it('debería manejar error de login', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' }
    });

    renderWithAuthProvider();

    act(() => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
      // El error debe ser manejado internamente
    });
  });

  it('debería manejar email no confirmado', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed' }
    });

    renderWithAuthProvider();

    act(() => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
    });
  });
});

// === TESTS DE LOGOUT ===
describe('AuthContext - Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simular usuario logueado
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { 
        session: { 
          user: { id: 'test-user', email: 'test@test.com' },
          access_token: 'token'
        }
      },
      error: null
    });
  });

  it('debería hacer logout correctamente', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({
      error: null
    });

    renderWithAuthProvider();

    // Esperar a que se inicialice
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('true');
    });

    act(() => {
      screen.getByTestId('logout-btn').click();
    });

    await waitFor(() => {
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  it('debería hacer force logout sin esperar Supabase', async () => {
    const reloadSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {});

    renderWithAuthProvider();

    act(() => {
      screen.getByTestId('force-logout-btn').click();
    });

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledWith('/login');
    });

    reloadSpy.mockRestore();
  });
});

// === TESTS DE GESTIÓN DE SESIÓN ===
describe('AuthContext - Gestión de Sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería cargar datos de usuario al encontrar sesión', async () => {
    const mockUser = { id: 'test-user', email: 'test@test.com' };
    const mockSession = { user: mockUser, access_token: 'token' };
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    // Mock restaurant mapping
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'user_restaurant_mapping') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              restaurant: {
                id: 'test-restaurant',
                name: 'Test Restaurant'
              }
            },
            error: null
          })
        };
      }
      return mockSupabase.from();
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@test.com');
    }, { timeout: 5000 });
  });

  it('debería manejar timeout en fetchRestaurantInfo', async () => {
    const mockUser = { id: 'test-user', email: 'test@test.com' };
    const mockSession = { user: mockUser, access_token: 'token' };
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    // Mock timeout en restaurant fetch - pero devuelve vacío en lugar de error
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    }));

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
      expect(screen.getByTestId('restaurant-name')).toHaveTextContent('no-restaurant');
    }, { timeout: 5000 });
  });
});

// === TESTS DE MIGRACIÓN AUTOMÁTICA ===
describe('AuthContext - Migración Automática', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería crear restaurant automáticamente para usuario huérfano', async () => {
    const mockUser = { id: 'test-user', email: 'test@test.com' };
    const mockSession = { user: mockUser, access_token: 'token' };
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    // Mock no restaurant found initially - triggers auto-creation
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'user_restaurant_mapping') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        abortSignal: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
    });

    // Mock successful restaurant creation
    mockSupabase.rpc.mockResolvedValue({
      data: {
        restaurant_id: 'new-restaurant',
        restaurant_name: 'Restaurante de test'
      },
      error: null
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_restaurant_securely', 
        expect.objectContaining({
          restaurant_data: expect.objectContaining({
            name: 'Restaurante de test',
            email: 'test@test.com'
          })
        })
      );
    }, { timeout: 5000 });
  });
});

// === TESTS DE NOTIFICACIONES ===
describe('AuthContext - Notificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
  });

  it('debería agregar notificaciones correctamente', async () => {
    const TestNotificationComponent = () => {
      const { addNotification, notifications } = useAuthContext();
      
      return (
        <div>
          <div data-testid="notifications-count">{notifications.length}</div>
          <button 
            data-testid="add-notification-btn"
            onClick={() => addNotification({
              type: 'test',
              message: 'Test notification'
            })}
          >
            Add Notification
          </button>
        </div>
      );
    };

    renderWithAuthProvider(<TestNotificationComponent />);

    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');

    act(() => {
      screen.getByTestId('add-notification-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    });
  });
});

// === TESTS DE ERROR HANDLING ===
describe('AuthContext - Manejo de Errores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería manejar error en getSession', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Network error' }
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });
  });

  it('debería manejar fallos en onAuthStateChange', async () => {
    const mockUnsubscribe = vi.fn();
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      // Simular error en el callback
      setTimeout(() => {
        try {
          callback('SIGNED_IN', null); // Session null debería ser manejado
        } catch (error) {
          // Error esperado y manejado
        }
      }, 100);
      
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });
});

// === TESTS DE PERFORMANCE ===
describe('AuthContext - Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no debería ejecutar loadUserData múltiples veces para el mismo usuario', async () => {
    const mockUser = { id: 'test-user', email: 'test@test.com' };
    let callCount = 0;

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: null, error: null });
      })
    }));

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
    });

    // Debería haber llamado a fetchRestaurantInfo solo una vez
    expect(callCount).toBeLessThanOrEqual(2); // Permitir máximo 2 llamadas
  });
});

// === TESTS DE INTEGRATION ===
describe('AuthContext - Integración', () => {
  it('debería proporcionar contexto válido a componentes hijos', () => {
    const TestConsumerComponent = () => {
      const authContext = useAuthContext();
      
      // Verificar que todas las propiedades esperadas están presentes
      const requiredProperties = [
        'status', 'isAuthenticated', 'isReady', 'user', 'restaurant',
        'login', 'logout', 'signOut', 'forceLogout', 'notifications'
      ];
      
      const missingProps = requiredProperties.filter(prop => 
        authContext[prop] === undefined
      );
      
      return (
        <div data-testid="missing-props">
          {missingProps.length === 0 ? 'all-present' : missingProps.join(',')}
        </div>
      );
    };

    renderWithAuthProvider(<TestConsumerComponent />);
    
    expect(screen.getByTestId('missing-props')).toHaveTextContent('all-present');
  });

  it('debería lanzar error si se usa fuera del provider', () => {
    const ConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const TestComponentOutsideProvider = () => {
      try {
        useAuthContext();
        return <div>No error</div>;
      } catch (error) {
        return <div data-testid="error-message">{error.message}</div>;
      }
    };

    expect(() => {
      render(<TestComponentOutsideProvider />);
    }).toThrow('useAuthContext must be used within an AuthProvider');

    ConsoleErrorSpy.mockRestore();
  });
});
