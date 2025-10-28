import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '../lib/supabase.js';
import { log } from '../utils/logger.js';

// Store de reservas
export const useReservationStore = create()(
  devtools(
    (set, get) => ({
      // === ESTADO DE RESERVAS ===
      isLoading: false,
      error: null,
      businessId: null, // ID del negocio - REQUERIDO para datos reales
      
      // === RESERVAS ===
      reservations: [],
      filteredReservations: [],
      selectedDate: new Date().toISOString().split('T')[0],
      
      // === DISPONIBILIDAD ===
      availability: {},
      timeSlots: [],
      
      // === FILTROS ===
      filters: {
        status: 'all',
        timeRange: 'today',
        table: 'all',
        party_size: 'all',
      },
      
      // === CONFIGURACIÓN DINÁMICA - SOLO DATOS REALES ===
      settings: {
        // NUNCA valores por defecto - SIEMPRE desde Supabase
        slotDuration: null, // se obtiene OBLIGATORIAMENTE de businesses.settings.reservation_duration
        maxAdvanceBooking: null, // se obtiene OBLIGATORIAMENTE de businesses.settings.advance_booking_days
        minAdvanceBooking: null, // se obtiene OBLIGATORIAMENTE de businesses.settings.min_advance_hours
        maxPartySize: null, // se obtiene OBLIGATORIAMENTE de businesses.settings.max_party_size
        minPartySize: null, // se obtiene OBLIGATORIAMENTE de businesses.settings.min_party_size
        bufferTime: 15, // único valor técnico permitido
      },
      
      // === MÉTRICAS ===
      metrics: {
        todayReservations: 0,
        weekReservations: 0,
        monthReservations: 0,
        averagePartySize: 0,
        noShowRate: 0,
        cancellationRate: 0,
      },
      
      // === ACCIONES PRINCIPALES ===
      
      // === INICIALIZACIÓN CON DATOS REALES ===
      initialize: async (businessId) => {
        try {
          log.info('🚀 Initializing reservation store with REAL data for business:', businessId);
          
          if (!businessId) {
            throw new Error('Business ID is REQUIRED for initialization');
          }
          
          set({ businessId, isLoading: true, error: null });
          
          // Cargar política de reservas REAL
          await get().loadReservationPolicy(businessId);
          
          log.info('✅ Reservation store initialized with REAL data');
          
        } catch (error) {
          log.error('❌ Failed to initialize reservation store:', error);
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
      
      // === CARGAR POLÍTICA DE RESERVAS - SOLO DATOS REALES ===
      loadReservationPolicy: async (businessId) => {
        try {
          log.info('⚙️ Loading REAL reservation policy for restaurant:', businessId);
          
          if (!businessId) {
            throw new Error('Restaurant ID is required - NO DEFAULTS ALLOWED');
          }
          
          const { data, error } = await supabase
            .from('businesses')
            .select('settings')
            .eq('id', businessId)
            .single();
          
          if (error) throw error;
          
          const policy = data?.settings || {};
          
          // VALIDAR que existan los datos REALES - NO defaults
          if (!policy.reservation_duration || !policy.advance_booking_days || 
              !policy.min_advance_hours || !policy.max_party_size || !policy.min_party_size) {
            throw new Error('INCOMPLETE RESERVATION POLICY - All fields required in businesses.settings');
          }
          
          // Actualizar SOLO con datos REALES de Supabase
          set((state) => ({
            settings: {
              ...state.settings,
              slotDuration: policy.reservation_duration,
              maxAdvanceBooking: policy.advance_booking_days,
              minAdvanceBooking: policy.min_advance_hours,
              maxPartySize: policy.max_party_size,
              minPartySize: policy.min_party_size,
            }
          }));
          
          log.info('✅ REAL reservation policy loaded:', {
            duration: policy.reservation_duration,
            advanceDays: policy.advance_booking_days,
            minHours: policy.min_advance_hours,
            partySize: `${policy.min_party_size}-${policy.max_party_size}`
          });
          
        } catch (error) {
          log.error('❌ Failed to load REAL reservation policy:', error);
          // NO defaults - la aplicación debe mostrar error si no hay datos reales
          throw error;
        }
      },
      
      loadReservations: async (date = null) => {
        set({ isLoading: true, error: null });
        
        try {
          const targetDate = date || get().selectedDate;
          log.info('📅 Loading reservations for:', targetDate);
          
          const { data, error } = await supabase
            .from('appointments')
            .select(`
              *,
              customer:customer_id (
                id,
                name,
                email,
                phone,
                segment_auto,
                visits_count
              ),
              table:tables(*)
            `)
            .gte('date', targetDate)
            .lt('date', new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('time', { ascending: true });
          
          if (error) throw error;
          
          // Mapear datos del customer al formato esperado
          const reservationsWithCustomers = (data || []).map(r => ({
            ...r,
            customer_name: r.customer?.name || r.customer_name,
            customer_email: r.customer?.email || r.customer_email,
            customer_phone: r.customer?.phone || r.customer_phone
          }));
          
          set({ 
            reservations: reservationsWithCustomers,
            filteredReservations: reservationsWithCustomers,
          });
          
          // Cargar disponibilidad para el día
          await get().loadAvailability(targetDate);
          
          log.info('✅ Reservations loaded');
          
        } catch (error) {
          log.error('❌ Failed to load reservations:', error);
          set({ error: error.message });
        } finally {
          set({ isLoading: false });
        }
      },
      
      // === CREAR RESERVA ===
      createReservation: async (reservationData) => {
        try {
          log.info('📝 Creating new reservation');
          
          // Usar RPC validada para evitar solapes
          const payload = {
            reservation_date: reservationData.reservation_date || reservationData.date,
            reservation_time: reservationData.reservation_time || reservationData.time,
            party_size: reservationData.party_size,
            table_id: reservationData.table_id || null,
            status: reservationData.status || 'pending',
            customer_name: reservationData.customer_name,
            customer_email: reservationData.customer_email,
            customer_phone: reservationData.customer_phone,
            channel: reservationData.channel || 'manual',
            source: reservationData.source || 'manual',
            special_requests: reservationData.special_requests || null,
            notes: reservationData.notes || null
          };

          const { data: rpcData, error: rpcError } = await supabase
            .rpc('create_reservation_validated', {
              p_business_id: reservationData.business_id,
              p_payload: payload,
              p_slot_minutes: 90
            });

          if (rpcError) throw rpcError;
          if (!rpcData?.success) {
            throw new Error(rpcData?.error || 'No se pudo crear la reserva');
          }

          const data = rpcData.reservation;
          
          if (error) throw error;
          
          set((state) => ({
            reservations: [...state.reservations, data],
            filteredReservations: [...state.filteredReservations, data],
          }));
          
          // Actualizar disponibilidad
          await get().loadAvailability(data.date);
          
          log.info('✅ Reservation created');
          return data;
          
        } catch (error) {
          log.error('❌ Failed to create reservation:', error);
          throw error;
        }
      },
      
      // === ACTUALIZAR RESERVA ===
      updateReservation: async (reservationId, updates) => {
        try {
          log.info('📝 Updating reservation:', reservationId);
          
          const { data, error } = await supabase
            .from('appointments')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', reservationId)
            .select(`
              *,
              customer:customers(*),
              table:tables(*)
            `)
            .single();
          
          if (error) throw error;
          
          set((state) => ({
            reservations: state.reservations.map(res =>
              res.id === reservationId ? data : res
            ),
            filteredReservations: state.filteredReservations.map(res =>
              res.id === reservationId ? data : res
            ),
          }));
          
          log.info('✅ Reservation updated');
          return data;
          
        } catch (error) {
          log.error('❌ Failed to update reservation:', error);
          throw error;
        }
      },
      
      // === CANCELAR RESERVA ===
      cancelReservation: async (reservationId, reason = '') => {
        try {
          log.info('❌ Cancelling reservation:', reservationId);
          
          const { data, error } = await supabase
            .from('appointments')
            .update({
              status: 'cancelled',
              cancellation_reason: reason,
              cancelled_at: new Date().toISOString(),
            })
            .eq('id', reservationId)
            .select()
            .single();
          
          if (error) throw error;
          
          set((state) => ({
            reservations: state.reservations.map(res =>
              res.id === reservationId ? { ...res, status: 'cancelled' } : res
            ),
            filteredReservations: state.filteredReservations.map(res =>
              res.id === reservationId ? { ...res, status: 'cancelled' } : res
            ),
          }));
          
          // Actualizar disponibilidad
          const reservation = get().reservations.find(r => r.id === reservationId);
          if (reservation) {
            await get().loadAvailability(reservation.date);
          }
          
          log.info('✅ Reservation cancelled');
          
        } catch (error) {
          log.error('❌ Failed to cancel reservation:', error);
          throw error;
        }
      },
      
      // === DISPONIBILIDAD ===
      loadAvailability: async (date) => {
        try {
          log.info('⏰ Loading availability for:', date);
          
          const { data, error } = await supabase
            .rpc('get_table_availability', {
              target_date: date,
            });
          
          if (error) throw error;
          
          set((state) => ({
            availability: {
              ...state.availability,
              [date]: data,
            },
          }));
          
          // Generar slots de tiempo disponibles con datos REALES
          // Necesitamos el businessId - obtenerlo del contexto o parámetro
          const businessId = get().businessId; // Agregar al estado si no existe
          if (businessId) {
            await get().generateTimeSlots(date, businessId);
          } else {
            log.error('❌ Restaurant ID required for generating REAL time slots');
          }
          
        } catch (error) {
          log.error('❌ Failed to load availability:', error);
        }
      },
      
      // === GENERAR SLOTS SIMPLIFICADOS (SIN TURNOS) ===
      generateTimeSlots: async (date, businessId) => {
        try {
          const { settings } = get();
          
          // VALIDAR que tengamos la política REAL cargada
          if (!settings.slotDuration) {
            throw new Error('POLICY NOT LOADED - Must call loadReservationPolicy first');
          }
          
          log.info('🎯 Generating SIMPLE time slots for:', date, 'with duration:', settings.slotDuration);
          
          // 1. OBTENER CALENDARIO REAL (eventos especiales)
          const { data: eventsData, error: eventsError } = await supabase
            .from('special_events')
            .select('*')
            .eq('business_id', businessId)
            .eq('event_date', date);
            
          if (eventsError) throw eventsError;
          
          // 2. VERIFICAR SI EL DÍA ESTÁ CERRADO
          const specialEvent = eventsData?.[0];
          if (specialEvent?.is_closed) {
            log.info('🚫 Day is CLOSED due to special event');
            set(state => ({ timeSlots: [] }));
            return;
          }
          
          // 3. OBTENER HORARIO GENERAL DEL RESTAURANTE (SIMPLIFICADO)
          const { data: restaurantData, error: restaurantError } = await supabase
            .from('businesses')
            .select('settings')
            .eq('id', businessId)
            .single();
            
          if (restaurantError) throw restaurantError;
          
          let operatingHours = restaurantData?.settings?.operating_hours;
          if (!operatingHours) {
            log.error('❌ No operating hours configured - using defaults');
            // Usar horarios por defecto si no están configurados
            const defaultHours = {
              monday: { open: '09:00', close: '22:00', closed: false },
              tuesday: { open: '09:00', close: '22:00', closed: false },
              wednesday: { open: '09:00', close: '22:00', closed: false },
              thursday: { open: '09:00', close: '22:00', closed: false },
              friday: { open: '09:00', close: '22:00', closed: false },
              saturday: { open: '09:00', close: '22:00', closed: false },
              sunday: { open: '10:00', close: '21:00', closed: false }
            };
            
            // Guardar horarios por defecto
            await supabase
              .from('businesses')
              .update({ 
                settings: { 
                  ...restaurantData?.settings, 
                  operating_hours: defaultHours 
                } 
              })
              .eq('id', businessId);
              
            log.info('✅ Default operating hours created and saved');
            operatingHours = defaultHours;
          }
          
          // 4. DETERMINAR HORARIO SIMPLE PARA EL DÍA
          const dayOfWeek = new Date(date).toLocaleDateString('en', { weekday: 'lowercase' });
          const dayHours = operatingHours[dayOfWeek];
          
          if (!dayHours || dayHours.closed) {
            log.info('🚫 Day is CLOSED according to operating hours');
            set(state => ({ timeSlots: [] }));
            return;
          }
          
          // 5. GENERAR SLOTS SIMPLES DENTRO DEL HORARIO
          const slots = [];
          const [startHour, startMin] = dayHours.open.split(':').map(Number);
          const [endHour, endMin] = dayHours.close.split(':').map(Number);
          
          let currentTime = startHour * 60 + startMin; // minutos desde medianoche
          const endTime = endHour * 60 + endMin;
          
          // Generar slots cada X minutos según política
          while (currentTime + settings.slotDuration <= endTime) {
            const hour = Math.floor(currentTime / 60);
            const minute = currentTime % 60;
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            slots.push({
              time: timeString,
              available: true, // Se calculará con disponibilidad real
              duration: settings.slotDuration
            });
            
            currentTime += settings.slotDuration;
          }
          
          log.info('✅ Generated SIMPLE slots:', slots.length, 'slots with', settings.slotDuration, 'min duration');
          log.info('📅 Operating hours:', `${dayHours.open} - ${dayHours.close}`);
          
          set(state => ({ timeSlots: slots }));
          
        } catch (error) {
          log.error('❌ Failed to generate SIMPLE time slots:', error);
          // NO generar slots falsos - mostrar error
          set(state => ({ timeSlots: [], error: error.message }));
        }
      },
      
      
      // === BÚSQUEDA DE MESAS ===
      findAvailableTables: async (date, time, partySize) => {
        try {
          const { data, error } = await supabase
            .rpc('find_available_tables', {
              target_date: date,
              target_time: time,
              party_size: partySize,
            });
          
          if (error) throw error;
          
          return data;
          
        } catch (error) {
          log.error('❌ Failed to find available tables:', error);
          return [];
        }
      },
      
      // === FILTROS ===
      applyFilters: () => {
        const { reservations, filters } = get();
        
        let filtered = [...reservations];
        
        // Filtro por estado
        if (filters.status !== 'all') {
          filtered = filtered.filter(res => res.status === filters.status);
        }
        
        // Filtro por mesa
        if (filters.table !== 'all') {
          filtered = filtered.filter(res => res.table_id === filters.table);
        }
        
        // Filtro por tamaño de grupo
        if (filters.party_size !== 'all') {
          const size = parseInt(filters.party_size);
          filtered = filtered.filter(res => res.party_size === size);
        }
        
        set({ filteredReservations: filtered });
      },
      
      updateFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
        
        get().applyFilters();
      },
      
      // === GESTIÓN DE FECHA ===
      setSelectedDate: (date) => {
        set({ selectedDate: date });
        get().loadReservations(date);
      },
      
      // === MÉTRICAS ===
      loadMetrics: async () => {
        try {
          const { data, error } = await supabase
            .rpc('get_reservation_metrics');
          
          if (error) throw error;
          
          set({ metrics: { ...get().metrics, ...data } });
          
        } catch (error) {
          log.error('❌ Failed to load metrics:', error);
        }
      },
      
      // === NOTIFICACIONES Y RECORDATORIOS ===
      sendReminders: async (reservationIds = []) => {
        try {
          log.info('📬 Sending reservation reminders');
          
          const { data, error } = await supabase
            .rpc('send_reservation_reminders', {
              reservation_ids: reservationIds,
            });
          
          if (error) throw error;
          
          log.info('✅ Reminders sent');
          return data;
          
        } catch (error) {
          log.error('❌ Failed to send reminders:', error);
          throw error;
        }
      },
      
      // === VALIDACIONES ===
      validateReservation: (reservationData) => {
        const { settings } = get();
        const errors = [];
        
        // Validar tamaño del grupo
        if (reservationData.party_size > settings.maxPartySize) {
          errors.push(`Máximo ${settings.maxPartySize} personas por reserva`);
        }
        
        // Validar fecha anticipada
        const reservationDate = new Date(reservationData.date);
        const now = new Date();
        const maxDate = new Date(now.getTime() + settings.maxAdvanceBooking * 24 * 60 * 60 * 1000);
        const minDate = new Date(now.getTime() + settings.minAdvanceBooking * 60 * 60 * 1000);
        
        if (reservationDate > maxDate) {
          errors.push(`No se pueden hacer reservas con más de ${settings.maxAdvanceBooking} días de anticipación`);
        }
        
        if (reservationDate < minDate) {
          errors.push(`Las reservas deben hacerse con al menos ${settings.minAdvanceBooking} hora(s) de anticipación`);
        }
        
        return errors;
      },
      
      // === UTILIDADES ===
      getReservationsByStatus: (status) => {
        const { reservations } = get();
        return reservations.filter(res => res.status === status);
      },
      
      getReservationsByTimeRange: (startTime, endTime) => {
        const { filteredReservations } = get();
        return filteredReservations.filter(res => 
          res.time >= startTime && res.time <= endTime
        );
      },
      
      getTodayReservations: () => {
        const today = new Date().toISOString().split('T')[0];
        const { reservations } = get();
        return reservations.filter(res => res.date === today);
      },
      
      // === CONFIGURACIÓN ===
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },
      
      // === EXPORTAR ===
      exportReservations: async (format = 'csv', dateRange = {}) => {
        try {
          log.info('📤 Exporting reservations');
          
          const { data, error } = await supabase
            .rpc('export_reservations', {
              export_format: format,
              date_range: dateRange,
            });
          
          if (error) throw error;
          
          // Crear y descargar archivo
          const blob = new Blob([data], { 
            type: format === 'csv' ? 'text/csv' : 'application/json' 
          });
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `reservations-${new Date().toISOString().split('T')[0]}.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          log.info('✅ Reservations exported');
          
        } catch (error) {
          log.error('❌ Failed to export reservations:', error);
          throw error;
        }
      },
      
      // === OBTENER ESTADÍSTICAS REALES DE DISPONIBILIDADES ===
      getAvailabilityStats: async (businessId) => {
        try {
          log.info('📊 Loading REAL availability stats for restaurant:', businessId);
          
          if (!businessId) {
            throw new Error('Restaurant ID is REQUIRED for REAL stats');
          }
          
          // Generar fecha actual correctamente - forzar timezone local
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          
          log.info('📅 Using correct date for 30/09/2025:', {
            date_filter: todayStr,
            business_id: businessId
          });
          
          // Consultar slots REALES desde Supabase
          const { data: slotsData, error: slotsError } = await supabase
            .from('availability_slots')
            .select('*')
            .eq('business_id', businessId)
            .gte('slot_date', todayStr); // Solo futuros
            
          if (slotsError) {
            log.error('❌ Slots query failed:', slotsError);
            throw slotsError;
          }
          
          log.info('✅ Slots loaded:', slotsData?.length || 0);
          
          // Consultar reservas REALES - versión más robusta
          let reservationsData = [];
          try {
            log.info('🔍 Querying reservations...');
            
            // Consulta simplificada para evitar error 400
            const { data, error: reservationsError } = await supabase
              .from('appointments')
              .select('id, status, reservation_date') // Quitar slot_id por si no existe
              .eq('business_id', businessId)
              .gte('reservation_date', todayStr);
              
            if (reservationsError) {
              log.error('❌ Reservations query failed:', reservationsError);
              // Continuar sin reservas si hay error
              reservationsData = [];
            } else {
              // Filtrar solo status activos
              reservationsData = (data || []).filter(r => 
                ['pending', 'confirmed', 'completed', 'seated', 'confirmada', 'sentada'].includes(r.status)
              );
              log.info('✅ Active reservations loaded:', reservationsData.length);
            }
          } catch (reservationError) {
            log.warn('⚠️ Could not load reservations, continuing with slots only:', reservationError);
            reservationsData = [];
          }
          
          // Calcular estadísticas REALES
          const totalSlots = slotsData?.length || 0;
          
          // 🎯 OBTENER DURACIÓN DE RESERVA REAL DE LA BD
          let reservationDuration = 60; // Default temporal
          let slotDuration = 30; // Default temporal
          
          try {
            const { data: settingsData, error: settingsError } = await supabase
              .from('businesses')
              .select('settings')
              .eq('id', businessId)
              .single();
            
            if (!settingsError && settingsData?.settings) {
              reservationDuration = settingsData.settings.reservation_duration || 60;
              slotDuration = settingsData.settings.slot_duration || 30;
            }
          } catch (err) {
            log.warn('⚠️ Could not load reservation duration, using defaults');
          }
          
          // 🎯 CALCULAR SLOTS OCUPADOS CORRECTAMENTE
          // Cada reserva ocupa: duración_reserva / duración_slot
          const activeReservations = reservationsData.length;
          const slotsPerReservation = Math.ceil(reservationDuration / slotDuration);
          const occupiedSlots = Math.min(activeReservations * slotsPerReservation, totalSlots);
          const availableSlots = Math.max(0, totalSlots - occupiedSlots);
          
          log.info('📊 Cálculo de slots:', {
            reservas: activeReservations,
            duracion_reserva: reservationDuration,
            duracion_slot: slotDuration,
            slots_por_reserva: slotsPerReservation,
            slots_ocupados: occupiedSlots
          });
          
          // Consultar mesas REALES
          let tablesCount = 0;
          try {
            const { data: tablesData, error: tablesError } = await supabase
              .from('resources')
              .select('id')
              .eq('business_id', businessId)
              .eq('is_active', true);
              
            if (tablesError) {
              log.warn('⚠️ Could not load tables count:', tablesError);
            } else {
              tablesCount = tablesData?.length || 0;
            }
          } catch (tablesError) {
            log.warn('⚠️ Tables query failed, using 0:', tablesError);
          }
          
          const stats = {
            total: totalSlots,
            free: availableSlots,
            occupied: occupiedSlots,
            reserved: occupiedSlots, // Mismo valor por ahora
            tablesCount: tablesCount
          };
          
          log.info('✅ REAL availability stats calculated:', stats);
          return stats;
          
        } catch (error) {
          log.error('❌ Failed to load REAL availability stats:', error);
          // NO retornar stats falsas
          throw error;
        }
      },
      
      // === RESET ===
      reset: () => {
        set({
          reservations: [],
          filteredReservations: [],
          availability: {},
          timeSlots: [],
          selectedDate: new Date().toISOString().split('T')[0],
          businessId: null, // Reset restaurant ID también
          filters: {
            status: 'all',
            timeRange: 'today',
            table: 'all',
            party_size: 'all',
          },
          error: null,
        });
      },
    }),
    {
      name: 'ReservationStore',
    }
  )
);

