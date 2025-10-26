import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';
import { log } from '../utils/logger.js';

// Store del restaurante
export const useRestaurantStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === INFORMACIÓN DEL RESTAURANTE ===
        restaurant: null,
        isLoading: false,
        error: null,
        
        // === CONFIGURACIÓN ===
        settings: {
          timezone: 'Europe/Madrid',
          currency: 'EUR',
          language: 'es',
          operatingHours: {
            monday: { open: '09:00', close: '23:00', closed: false },
            tuesday: { open: '09:00', close: '23:00', closed: false },
            wednesday: { open: '09:00', close: '23:00', closed: false },
            thursday: { open: '09:00', close: '23:00', closed: false },
            friday: { open: '09:00', close: '24:00', closed: false },
            saturday: { open: '09:00', close: '24:00', closed: false },
            sunday: { open: '10:00', close: '22:00', closed: false },
          },
          maxCapacity: 100,
          avgServiceTime: 90, // minutos
        },
        
        // === MÉTRICAS EN TIEMPO REAL ===
        metrics: {
          currentOccupancy: 0,
          todayReservations: 0,
          todayRevenue: 0,
          averageWaitTime: 0,
          customerSatisfaction: 0,
          staffOnDuty: 0,
        },
        
        // === STAFF Y EMPLEADOS ===
        staff: [],
        shifts: [],
        
        // === INVENTARIO ===
        inventory: {
          items: [],
          lowStockAlerts: [],
          lastUpdated: null,
        },
        
        // === ACCIONES PRINCIPALES ===
        loadRestaurant: async (restaurantId) => {
          set({ isLoading: true, error: null });
          
          try {
            log.info('🏪 Loading restaurant data:', restaurantId);
            
            const { data, error } = await supabase
              .from('restaurants')
              .select('*')
              .eq('id', restaurantId)
              .single();
            
            if (error) {
              throw error;
            }
            
            set({ restaurant: data });
            
            // Cargar configuración adicional
            await get().loadSettings();
            await get().loadMetrics();
            
            log.info('✅ Restaurant data loaded');
            
          } catch (error) {
            log.error('❌ Failed to load restaurant:', error);
            set({ error: error.message });
          } finally {
            set({ isLoading: false });
          }
        },
        
        updateRestaurant: async (updates) => {
          const { restaurant } = get();
          if (!restaurant) return;
          
          try {
            log.info('📝 Updating restaurant');
            
            const { data, error } = await supabase
              .from('restaurants')
              .update(updates)
              .eq('id', restaurant.id)
              .select()
              .single();
            
            if (error) {
              throw error;
            }
            
            set({ restaurant: data });
            log.info('✅ Restaurant updated');
            
            return { success: true };
            
          } catch (error) {
            log.error('❌ Failed to update restaurant:', error);
            return { success: false, error: error.message };
          }
        },
        
        // === GESTIÓN DE CONFIGURACIÓN ===
        loadSettings: async () => {
          const { restaurant } = get();
          if (!restaurant) return;
          
          try {
            const { data, error } = await supabase
              .from('restaurant_settings')
              .select('*')
              .eq('restaurant_id', restaurant.id)
              .maybeSingle();
            if (error) throw error;
            if (data) {
              set({ settings: { ...get().settings, ...data.settings } });
            }
          } catch (error) {
            log.error('❌ Failed to load settings:', error);
          }
        },
        
        updateSettings: async (newSettings) => {
          const { restaurant, settings } = get();
          if (!restaurant) return;
          
          try {
            const updatedSettings = { ...settings, ...newSettings };
            
            const { error } = await supabase
              .from('restaurant_settings')
              .upsert({
                restaurant_id: restaurant.id,
                settings: updatedSettings,
              });
            
            if (error) {
              throw error;
            }
            
            set({ settings: updatedSettings });
            log.info('✅ Settings updated');
            
            return { success: true };
            
          } catch (error) {
            log.error('❌ Failed to update settings:', error);
            return { success: false, error: error.message };
          }
        },
        
        // === MÉTRICAS Y ANALYTICS ===
        loadMetrics: async () => {
          const { restaurant } = get();
          if (!restaurant) return;
          
          try {
            // Cargar métricas del día actual
            const today = new Date().toISOString().split('T')[0];
            
            const { data, error } = await supabase
              .from('daily_metrics')
              .select('*')
              .eq('restaurant_id', restaurant.id)
              .eq('date', today)
              .single();
            
            if (data) {
              set({ metrics: { ...get().metrics, ...data.metrics } });
            }
            
          } catch (error) {
            log.error('❌ Failed to load metrics:', error);
          }
        },
        
        updateMetric: (metric, value) => {
          set((state) => ({
            metrics: {
              ...state.metrics,
              [metric]: value,
            },
          }));
          
          // Sincronizar con base de datos
          get().syncMetrics();
        },
        
        syncMetrics: async () => {
          const { restaurant, metrics } = get();
          if (!restaurant) return;
          
          try {
            const today = new Date().toISOString().split('T')[0];
            
            await supabase
              .from('daily_metrics')
              .upsert({
                restaurant_id: restaurant.id,
                date: today,
                metrics,
                updated_at: new Date().toISOString(),
              });
            
          } catch (error) {
            log.error('❌ Failed to sync metrics:', error);
          }
        },
        
        // === GESTIÓN DE STAFF ===
        loadStaff: async () => {
          const { restaurant } = get();
          if (!restaurant) return;
          
          try {
            const { data, error } = await supabase
              .from('staff')
              .select('*')
              .eq('restaurant_id', restaurant.id)
              .eq('active', true);
            
            if (error) {
              throw error;
            }
            
            set({ staff: data || [] });
            
          } catch (error) {
            log.error('❌ Failed to load staff:', error);
          }
        },
        
        addStaffMember: async (staffData) => {
          const { restaurant } = get();
          if (!restaurant) return;
          
          try {
            const { data, error } = await supabase
              .from('staff')
              .insert({
                ...staffData,
                restaurant_id: restaurant.id,
              })
              .select()
              .single();
            
            if (error) {
              throw error;
            }
            
            set((state) => ({
              staff: [...state.staff, data],
            }));
            
            log.info('✅ Staff member added');
            return { success: true };
            
          } catch (error) {
            log.error('❌ Failed to add staff member:', error);
            return { success: false, error: error.message };
          }
        },
        
        // === GESTIÓN DE INVENTARIO ===
        loadInventory: async () => {
          const { restaurant } = get();
          if (!restaurant) return;
          
          try {
            const { data, error } = await supabase
              .from('inventory_items')
              .select('*')
              .eq('restaurant_id', restaurant.id);
            
            if (error) {
              throw error;
            }
            
            // Detectar artículos con stock bajo
            const lowStockAlerts = data.filter(item => 
              item.current_stock <= item.min_stock_level
            );
            
            set({
              inventory: {
                items: data || [],
                lowStockAlerts,
                lastUpdated: new Date().toISOString(),
              },
            });
            
          } catch (error) {
            log.error('❌ Failed to load inventory:', error);
          }
        },
        
        updateInventoryItem: async (itemId, updates) => {
          try {
            const { data, error } = await supabase
              .from('inventory_items')
              .update(updates)
              .eq('id', itemId)
              .select()
              .single();
            
            if (error) {
              throw error;
            }
            
            set((state) => ({
              inventory: {
                ...state.inventory,
                items: state.inventory.items.map(item =>
                  item.id === itemId ? data : item
                ),
                lastUpdated: new Date().toISOString(),
              },
            }));
            
            return { success: true };
            
          } catch (error) {
            log.error('❌ Failed to update inventory item:', error);
            return { success: false, error: error.message };
          }
        },
        
        // === UTILIDADES ===
        isOpen: () => {
          const { settings } = get();
          const now = new Date();
          const dayOfWeek = now.toLocaleLowerCase();
          const currentTime = now.toTimeString().slice(0, 5);
          
          const todayHours = settings.operatingHours[dayOfWeek];
          
          if (todayHours?.closed) return false;
          
          return currentTime >= todayHours.open && currentTime <= todayHours.close;
        },
        
        getCurrentCapacity: () => {
          const { metrics, settings } = get();
          return Math.round((metrics.currentOccupancy / settings.maxCapacity) * 100);
        },
        
        getEstimatedWaitTime: () => {
          const { metrics, settings } = get();
          const capacity = get().getCurrentCapacity();
          
          if (capacity < 80) return 0;
          
          // Calcular tiempo de espera basado en ocupación
          const baseWaitTime = settings.avgServiceTime * (capacity / 100);
          return Math.round(baseWaitTime);
        },
        
        // === NOTIFICACIONES ===
        getAlerts: () => {
          const { inventory, metrics } = get();
          const alerts = [];
          
          // Alertas de inventario bajo
          if (inventory.lowStockAlerts.length > 0) {
            alerts.push({
              type: 'warning',
              message: `${inventory.lowStockAlerts.length} artículos con stock bajo`,
              data: inventory.lowStockAlerts,
            });
          }
          
          // Alertas de capacidad
          const capacity = get().getCurrentCapacity();
          if (capacity > 95) {
            alerts.push({
              type: 'error',
              message: 'Restaurante a máxima capacidad',
              data: { capacity },
            });
          } else if (capacity > 85) {
            alerts.push({
              type: 'warning',
              message: 'Restaurante cerca de la capacidad máxima',
              data: { capacity },
            });
          }
          
          return alerts;
        },
        
        // === RESET ===
        reset: () => {
          set({
            restaurant: null,
            metrics: {
              currentOccupancy: 0,
              todayReservations: 0,
              todayRevenue: 0,
              averageWaitTime: 0,
              customerSatisfaction: 0,
              staffOnDuty: 0,
            },
            staff: [],
            inventory: {
              items: [],
              lowStockAlerts: [],
              lastUpdated: null,
            },
            error: null,
          });
        },
      }),
      {
        name: 'la-ia-restaurant-store',
        partialize: (state) => ({
          settings: state.settings,
        }),
      }
    ),
    {
      name: 'RestaurantStore',
    }
  )
);
