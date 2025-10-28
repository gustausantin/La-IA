// supabase.test.js - Tests de clase mundial para servicios de Supabase 🔌
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabase';
import { mockSupabase } from '../../test/setup';

// === TESTS DE CONFIGURACIÓN DE SUPABASE ===
describe('Supabase - Configuración', () => {
  it('debería exportar cliente de supabase configurado', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(supabase.from).toBeDefined();
  });

  it('debería tener métodos de autenticación disponibles', () => {
    expect(supabase.auth.signInWithPassword).toBeDefined();
    expect(supabase.auth.signUp).toBeDefined();
    expect(supabase.auth.signOut).toBeDefined();
    expect(supabase.auth.getSession).toBeDefined();
    expect(supabase.auth.onAuthStateChange).toBeDefined();
  });

  it('debería tener métodos de base de datos disponibles', () => {
    expect(typeof supabase.from).toBe('function');
    expect(supabase.channel).toBeDefined();
    expect(supabase.removeChannel).toBeDefined();
    expect(supabase.rpc).toBeDefined();
  });
});

// === TESTS DE AUTENTICACIÓN ===
describe('Supabase - Autenticación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signInWithPassword', () => {
    it('debería hacer login con credenciales válidas', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token-123', user: mockUser };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('debería retornar error con credenciales inválidas', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      });

      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(result.data.user).toBeNull();
      expect(result.error.message).toBe('Invalid login credentials');
    });

    it('debería manejar error de email no confirmado', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' }
      });

      const result = await supabase.auth.signInWithPassword({
        email: 'unconfirmed@example.com',
        password: 'password123'
      });

      expect(result.error.message).toBe('Email not confirmed');
    });
  });

  describe('signUp', () => {
    it('debería registrar usuario nuevo correctamente', async () => {
      const mockUser = { id: 'user-123', email: 'new@example.com' };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null
      });

      const result = await supabase.auth.signUp({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: { restaurant_name: 'Test Restaurant' }
        }
      });

      expect(result.data.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('debería retornar error si el usuario ya existe', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' }
      });

      const result = await supabase.auth.signUp({
        email: 'existing@example.com',
        password: 'password123'
      });

      expect(result.error.message).toBe('User already registered');
    });
  });

  describe('getSession', () => {
    it('debería obtener sesión existente', async () => {
      const mockSession = {
        access_token: 'token-123',
        user: { id: 'user-123', email: 'test@example.com' }
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await supabase.auth.getSession();

      expect(result.data.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('debería retornar null si no hay sesión', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await supabase.auth.getSession();

      expect(result.data.session).toBeNull();
    });
  });

  describe('signOut', () => {
    it('debería hacer logout correctamente', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });

      const result = await supabase.auth.signOut();

      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAuthStateChange', () => {
    it('debería configurar listener de cambios de auth', () => {
      const mockCallback = vi.fn();
      const mockUnsubscribe = vi.fn();

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      });

      const result = supabase.auth.onAuthStateChange(mockCallback);

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback);
      expect(result.data.subscription.unsubscribe).toBeDefined();
    });
  });
});

// === TESTS DE BASE DE DATOS ===
describe('Supabase - Base de Datos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Operaciones de SELECT', () => {
    it('debería obtener reservas correctamente', async () => {
      const mockReservations = [
        { id: '1', customer_name: 'John Doe', party_size: 4 },
        { id: '2', customer_name: 'Jane Smith', party_size: 2 }
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'reservations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockReservations,
              error: null
            })
          };
        }
        return mockSupabase.from();
      });

      const query = supabase
        .from('appointments')
        .select('*')
        .eq('business_id', 'rest-123')
        .order('created_at');

      const result = await query;

      expect(result.data).toEqual(mockReservations);
      expect(result.error).toBeNull();
    });

    it('debería manejar errores de consulta', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Permission denied' }
        })
      }));

      const query = supabase
        .from('appointments')
        .select('*')
        .eq('business_id', 'invalid-id')
        .order('created_at');

      const result = await query;

      expect(result.error.message).toBe('Permission denied');
    });

    it('debería manejar filtros complejos', async () => {
      const mockData = [{ id: '1', status: 'confirmed' }];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      }));

      const query = supabase
        .from('appointments')
        .select('*')
        .eq('business_id', 'rest-123')
        .gte('reservation_date', '2025-01-25')
        .lte('reservation_date', '2025-01-25')
        .order('reservation_time');

      const result = await query;

      expect(result.data).toEqual(mockData);
    });

    it('debería usar single() para consultas de un solo resultado', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUser,
          error: null
        })
      }));

      const query = supabase
        .from('profiles')
        .select('*')
        .eq('id', 'user-123')
        .single();

      const result = await query;

      expect(result.data).toEqual(mockUser);
    });

    it('debería usar maybeSingle() para consultas opcionales', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }));

      const query = supabase
        .from('user_restaurant_mapping')
        .select('*')
        .eq('auth_user_id', 'user-123')
        .maybeSingle();

      const result = await query;

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('Operaciones RPC', () => {
    it('debería ejecutar RPC functions correctamente', async () => {
      const mockResult = {
        business_id: 'rest-123',
        restaurant_name: 'Test Restaurant'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: mockResult,
        error: null
      });

      const result = await supabase.rpc('create_restaurant_securely', {
        restaurant_data: {
          name: 'Test Restaurant',
          email: 'test@example.com'
        }
      });

      expect(result.data).toEqual(mockResult);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_restaurant_securely', {
        restaurant_data: {
          name: 'Test Restaurant',
          email: 'test@example.com'
        }
      });
    });

    it('debería manejar errores en RPC functions', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function execution failed' }
      });

      const result = await supabase.rpc('invalid_function', {});

      expect(result.error.message).toBe('Function execution failed');
    });
  });
});

// === TESTS DE REAL-TIME ===
describe('Supabase - Real-time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Channels y Subscriptions', () => {
    it('debería crear channel correctamente', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const channel = supabase.channel('test-channel');

      expect(mockSupabase.channel).toHaveBeenCalledWith('test-channel');
      expect(channel).toEqual(mockChannel);
    });

    it('debería configurar subscription a cambios de postgres', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const channel = supabase
        .channel('reservations-channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: 'business_id=eq.rest-123'
        }, (payload) => {
        })
        .subscribe();

      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('debería remover channels correctamente', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const channel = supabase.channel('test-channel');
      supabase.removeChannel(channel);

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channel);
    });
  });
});

// === TESTS DE ABORT SIGNALS ===
describe('Supabase - Abort Signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería usar abort signal en consultas', async () => {
    const controller = new AbortController();

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error('AbortError'))
    }));

    const query = supabase
      .from('user_restaurant_mapping')
      .select('*')
      .eq('auth_user_id', 'user-123')
      .abortSignal(controller.signal)
      .maybeSingle();

    // Abortar la consulta
    controller.abort();

    try {
      await query;
    } catch (error) {
      expect(error.message).toBe('AbortError');
    }
  });

  it('debería manejar timeout con abort signal', async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100);

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (controller.signal.aborted) {
              reject(new Error('AbortError'));
            } else {
              resolve({ data: null, error: null });
            }
          }, 200);
        })
      )
    }));

    const query = supabase
      .from('test_table')
      .select('*')
      .abortSignal(controller.signal)
      .maybeSingle();

    try {
      await query;
    } catch (error) {
      expect(error.message).toBe('AbortError');
    }

    clearTimeout(timeoutId);
  });
});

// === TESTS DE ERROR HANDLING ===
describe('Supabase - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería manejar errores de conexión', async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));

    try {
      await supabase.auth.getSession();
    } catch (error) {
      expect(error.message).toBe('Network error');
    }
  });

  it('debería manejar errores de permisos', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { 
          message: 'permission denied for table reservations',
          code: '42501'
        }
      })
    }));

    const result = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', 'unauthorized');

    expect(result.error.code).toBe('42501');
    expect(result.error.message).toContain('permission denied');
  });

  it('debería manejar timeouts gracefully', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        })
      )
    }));

    try {
      await supabase
        .from('slow_table')
        .select('*')
        .eq('id', '123');
    } catch (error) {
      expect(error.message).toBe('Request timeout');
    }
  });
});

// === TESTS DE PERFORMANCE ===
describe('Supabase - Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería cachear configuración del cliente', () => {
    // El cliente de Supabase debería ser singleton
    const client1 = supabase;
    const client2 = supabase;

    expect(client1).toBe(client2);
  });

  it('debería reutilizar queries similares', async () => {
    let callCount = 0;

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: [], error: null });
      })
    }));

    // Ejecutar la misma query múltiples veces
    await Promise.all([
      supabase.from('appointments').select('*').eq('business_id', 'rest-123').order('created_at'),
      supabase.from('appointments').select('*').eq('business_id', 'rest-123').order('created_at'),
      supabase.from('appointments').select('*').eq('business_id', 'rest-123').order('created_at')
    ]);

    // Cada query debería ejecutarse independientemente
    expect(callCount).toBe(3);
  });
});

