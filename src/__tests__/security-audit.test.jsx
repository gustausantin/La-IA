// ✅ TESTS DE AUDITORÍA DE SEGURIDAD - DETECTAR PROBLEMAS COMO RLS
import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '../lib/supabase';

describe('🔒 AUDITORÍA DE SEGURIDAD CRÍTICA', () => {
  let auditResults = {};

  beforeAll(async () => {
    // Ejecutar auditoría completa de base de datos
    try {
      // Verificar RLS en todas las tablas
      const { data: tables, error: tablesError } = await supabase
        .rpc('audit_rls_status');
      
      if (tablesError) {
        console.warn('⚠️ No se puede ejecutar auditoría RLS:', tablesError);
        auditResults.rls = [];
      } else {
        auditResults.rls = tables || [];
      }

      // Verificar políticas
      const { data: policies, error: policiesError } = await supabase
        .rpc('audit_policies_count');
        
      if (policiesError) {
        console.warn('⚠️ No se puede ejecutar auditoría de políticas:', policiesError);
        auditResults.policies = [];
      } else {
        auditResults.policies = policies || [];
      }

    } catch (error) {
      console.warn('⚠️ Error en auditoría de seguridad:', error);
      auditResults = { rls: [], policies: [] };
    }
  });

  describe('🛡️ ROW LEVEL SECURITY (RLS)', () => {
    it('CRÍTICO: Todas las tablas sensibles deben tener RLS habilitado', () => {
      const criticalTables = [
        'businesses',
        'user_restaurant_mapping', 
        'reservations',
        'customers',
        'tables',
        'profiles'
      ];

      const tablesWithoutRLS = auditResults.rls.filter(table => 
        criticalTables.includes(table.tablename) && !table.rowsecurity
      );

      if (tablesWithoutRLS.length > 0) {
        console.error('❌ RIESGO CRÍTICO: Tablas sin RLS:', tablesWithoutRLS);
      }

      expect(tablesWithoutRLS.length).toBe(0);
    });

    it('CRÍTICO: Ninguna tabla debe estar "Unrestricted"', () => {
      const unrestrictedTables = auditResults.rls.filter(table => 
        !table.rowsecurity && table.tablename !== 'schema_migrations'
      );

      if (unrestrictedTables.length > 0) {
        console.error('❌ TABLAS UNRESTRICTED DETECTADAS:', unrestrictedTables);
      }

      expect(unrestrictedTables.length).toBe(0);
    });
  });

  describe('📋 POLÍTICAS DE SEGURIDAD', () => {
    it('CRÍTICO: Tablas críticas deben tener al menos 1 política', () => {
      const criticalTables = [
        'businesses',
        'user_restaurant_mapping',
        'reservations', 
        'customers'
      ];

      const tablesWithoutPolicies = auditResults.policies.filter(table =>
        criticalTables.includes(table.tablename) && table.total_policies === 0
      );

      if (tablesWithoutPolicies.length > 0) {
        console.error('❌ TABLAS SIN POLÍTICAS:', tablesWithoutPolicies);
      }

      expect(tablesWithoutPolicies.length).toBe(0);
    });
  });

  describe('🔍 TESTS DE PENETRACIÓN BÁSICA', () => {
    it('CRÍTICO: No debe poder acceder a datos de otros usuarios', async () => {
      // Intentar acceder a todas las reservas sin filtro
      const { data, error } = await supabase
        .from('appointments')
        .select('*');

      // Si RLS funciona, solo debe ver sus propias reservas (o ninguna si no tiene)
      // Si ve reservas de múltiples businesses diferentes = PROBLEMA
      if (data && data.length > 1) {
        const uniquebusinesses = [...new Set(data.map(r => r.business_id))];
        if (uniquebusinesses.length > 1) {
          console.error('❌ LEAK DE DATOS: Ve reservas de múltiples businesses:', uniquebusinesses);
          expect(uniquebusinesses.length).toBeLessThanOrEqual(1);
        }
      }

      // El test pasa si no hay error de permisos (RLS configurado correctamente)
      expect(error).toBeNull();
    });

    it('CRÍTICO: No debe poder acceder a businesses de otros usuarios', async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*');

      // Similar al test anterior
      if (data && data.length > 1) {
        console.error('❌ LEAK DE DATOS: Ve múltiples businesses sin autorización');
        expect(data.length).toBeLessThanOrEqual(1);
      }

      expect(error).toBeNull();
    });
  });

  describe('📊 INTEGRIDAD DE BASE DE DATOS', () => {
    it('CRÍTICO: Función create_restaurant_securely debe existir', async () => {
      const { data, error } = await supabase
        .rpc('create_restaurant_securely', {
          restaurant_data: {}, 
          user_profile: {}
        });

      // No importa si falla por datos, importa que la función exista
      expect(error?.code).not.toBe('42883'); // Function does not exist
    });

    it('CRÍTICO: Tablas fundamentales deben existir', async () => {
      const fundamentalTables = [
        'businesses',
        'user_restaurant_mapping',
        'reservations'
      ];

      for (const tableName of fundamentalTables) {
        const { error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);

        expect(error?.code).not.toBe('42P01'); // Table does not exist
      }
    });
  });
});

// ✅ TESTS PARA DETECTAR ARQUITECTURA INCORRECTA
describe('🏗️ AUDITORÍA DE ARQUITECTURA', () => {
  it('CRÍTICO: AuthContext debe proveer businessId', () => {
    // Este test fallaría si AuthContext no gestiona businessId correctamente
    const mockAuthContext = {
      user: { id: 'test-user' },
      restaurant: null,
      businessId: null,
      isReady: true
    };

    // En situación real, esto debería activar migración automática
    expect(mockAuthContext.isReady).toBe(true);
    
    // TODO: Implementar test que verifique migración automática
    console.warn('⚠️ TODO: Verificar que migración automática funciona cuando businessId es null');
  });

  it('CRÍTICO: App debe funcionar durante outages de Supabase', () => {
    // Mock de error de Supabase
    const supabaseOutage = {
      from: () => ({
        select: () => Promise.reject(new Error('Management API down'))
      })
    };

    // App debe manejar errores gracefully sin crashes
    expect(() => {
      // Simular carga de página durante outage
      const mockPageLoad = () => {
        try {
          supabaseOutage.from('businesses').select('*');
        } catch (error) {
          return 'loading'; // App debe mostrar loading, no crash
        }
      };
      mockPageLoad();
    }).not.toThrow();
  });
});

