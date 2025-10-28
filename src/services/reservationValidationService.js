// ======================================================================
// SERVICIO DE VALIDACIÓN DE RESERVAS - ENTERPRISE GRADE
// ======================================================================
// NORMA 2: Solo datos REALES de Supabase
// NORMA 3: Multi-tenant (filtrado por business_id)
// NORMA 4: Usa AvailabilityService y tablas existentes
// ======================================================================

import { supabase } from '../lib/supabase';
import { AvailabilityService } from './AvailabilityService';

/**
 * Servicio de validación de reservas con reglas de negocio completas
 */
export class ReservationValidationService {
  
  /**
   * Validar fecha de reserva
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @returns {Promise<Object>} { valid: boolean, message: string, code: string }
   */
  static async validateDate(businessId, date) {
    try {
      if (!date) {
        return {
          valid: false,
          message: 'La fecha es obligatoria',
          code: 'DATE_REQUIRED'
        };
      }

      const selectedDate = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. No permitir fechas pasadas
      if (selectedDate < today) {
        return {
          valid: false,
          message: 'No se pueden hacer reservas en fechas pasadas',
          code: 'DATE_PAST'
        };
      }

      // 2. Obtener configuración del restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      if (restaurantError) {
        console.error('Error obteniendo configuración:', restaurantError);
        return {
          valid: false,
          message: 'Error al validar la fecha',
          code: 'CONFIG_ERROR'
        };
      }

      const settings = restaurant?.settings || {};
      const maxAdvanceDays = settings.max_advance_days || 30;

      // 3. Verificar rango máximo de antelación
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

      if (selectedDate > maxDate) {
        return {
          valid: false,
          message: `No se aceptan reservas con más de ${maxAdvanceDays} días de antelación`,
          code: 'DATE_TOO_FAR'
        };
      }

      // 4. Verificar eventos especiales (cierres, festivos)
      const { data: events, error: eventsError } = await supabase
        .from('special_events')
        .select('*')
        .eq('business_id', businessId)
        .lte('event_date', date)
        .gte('event_date', date);

      if (eventsError) {
        console.warn('Error verificando eventos especiales:', eventsError);
      }

      const closedEvent = events?.find(event => 
        event.is_closed === true && event.event_date === date
      );

      if (closedEvent) {
        return {
          valid: false,
          message: `Este día está cerrado: ${closedEvent.title || 'Día especial'}`,
          code: 'DATE_CLOSED',
          event: closedEvent
        };
      }

      // 5. 🔥 VERIFICAR QUE EL DÍA DE LA SEMANA ESTÉ ABIERTO
      const operatingHours = settings.operating_hours || {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = selectedDate.getDay(); // 0 = domingo, 6 = sábado
      const dayName = dayNames[dayOfWeek];
      const dayConfig = operatingHours[dayName];

      console.log(`🔍 Validando fecha ${date} (${dayName}):`, dayConfig);

      // Si el día está marcado como cerrado (closed: true) o no existe configuración
      if (!dayConfig || dayConfig.closed === true) {
        const dayNameEs = {
          sunday: 'Domingo',
          monday: 'Lunes',
          tuesday: 'Martes',
          wednesday: 'Miércoles',
          thursday: 'Jueves',
          friday: 'Viernes',
          saturday: 'Sábado'
        };
        
        return {
          valid: false,
          message: `El restaurante está cerrado los ${dayNameEs[dayName]}`,
          code: 'DATE_DAY_CLOSED',
          dayOfWeek: dayName
        };
      }

      return {
        valid: true,
        message: 'Fecha válida',
        code: 'DATE_VALID'
      };

    } catch (error) {
      console.error('Error validando fecha:', error);
      return {
        valid: false,
        message: 'Error al validar la fecha',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validar hora de reserva
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} time - Hora en formato HH:MM:SS
   * @returns {Promise<Object>} { valid: boolean, message: string, alternatives: array }
   */
  static async validateTime(businessId, date, time, excludeReservationId = null) {
    try {
      if (!time) {
        return {
          valid: false,
          message: 'La hora es obligatoria',
          code: 'TIME_REQUIRED'
        };
      }

      console.log(`🔍 Validando hora ${time} para fecha ${date}`);

      // 1. Obtener configuración del restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      if (restaurantError) {
        console.error('Error obteniendo configuración:', restaurantError);
        return {
          valid: false,
          message: 'Error al validar la hora',
          code: 'CONFIG_ERROR'
        };
      }

      const settings = restaurant?.settings || {};
      const operatingHours = settings.operating_hours || {};
      
      // 2. Verificar que la hora esté dentro del horario de apertura
      const selectedDate = new Date(date + 'T00:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = selectedDate.getDay();
      const dayName = dayNames[dayOfWeek];
      const dayConfig = operatingHours[dayName];

      if (!dayConfig || dayConfig.closed === true) {
        return {
          valid: false,
          message: 'El restaurante está cerrado este día',
          code: 'TIME_DAY_CLOSED'
        };
      }

      // Comparar hora solicitada con horario de apertura
      const requestedTime = time.substring(0, 5); // HH:MM
      const openTime = dayConfig.open || '09:00';
      const closeTime = dayConfig.close || '22:00';

      console.log(`📅 Horario del ${dayName}: ${openTime} - ${closeTime}`);

      // 🆕 3. VALIDAR ANTELACIÓN MÍNIMA (min_advance_hours en MINUTOS)
      const minAdvanceMinutes = settings.min_advance_hours || 0; // Ahora en MINUTOS
      
      if (minAdvanceMinutes > 0) {
        const now = new Date();
        const reservationDateTime = new Date(`${date}T${requestedTime}:00`);
        const minutesUntilReservation = Math.floor((reservationDateTime - now) / (1000 * 60));
        
        console.log(`⏰ Antelación: ${minutesUntilReservation} minutos (mínimo requerido: ${minAdvanceMinutes} minutos)`);
        
        if (minutesUntilReservation < minAdvanceMinutes) {
          return {
            valid: false,
            message: `Lo siento, no se admiten reservas con una antelación inferior a ${minAdvanceMinutes} minutos. Por favor, reserva con al menos ${minAdvanceMinutes} minutos de antelación.`,
            code: 'MIN_ADVANCE_TIME_NOT_MET',
            requiredMinutes: minAdvanceMinutes,
            currentMinutes: minutesUntilReservation
          };
        }
      }

      if (requestedTime < openTime || requestedTime > closeTime) {
        // 🆕 Generar alternativas dentro del horario
        const alternatives = [];
        const slotInterval = settings.slot_interval || 30;
        
        const [openHours, openMinutes] = openTime.split(':').map(Number);
        const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
        const openTotalMinutes = openHours * 60 + openMinutes;
        const closeTotalMinutes = closeHours * 60 + closeMinutes;
        
        for (let minutes = openTotalMinutes; minutes <= closeTotalMinutes; minutes += slotInterval) {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
          const displayTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          alternatives.push({ time: timeStr, displayTime });
        }
        
        return {
          valid: false,
          message: `El restaurante solo acepta reservas entre ${openTime} y ${closeTime}`,
          code: 'TIME_OUTSIDE_HOURS',
          alternatives: alternatives.slice(0, 6) // Máximo 6 alternativas
        };
      }

      // 3. 🔥 VERIFICAR QUE NO HAYA CONFLICTOS CON RESERVAS EXISTENTES
      // Obtener duración de reserva (en minutos)
      const reservationDuration = settings.reservation_duration || 60;
      
      // Calcular rango de tiempo que ocuparía esta reserva
      const [hours, minutes] = time.split(':').map(Number);
      const requestedMinutes = hours * 60 + minutes;
      const endMinutes = requestedMinutes + reservationDuration;
      
      // Convertir de vuelta a formato HH:MM:SS
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;

      console.log(`⏱️ Reserva ocuparía: ${time} - ${endTime} (${reservationDuration} min)`);

      // Buscar reservas confirmadas que se solapen con este horario
      let query = supabase
        .from('appointments')
        .select('id, reservation_time, party_size, table_id')
        .eq('business_id', businessId)
        .eq('reservation_date', date)
        .in('status', ['confirmed', 'pending'])
        .order('reservation_time');

      // 🔥 EXCLUIR LA RESERVA ACTUAL SI ESTAMOS EDITANDO
      if (excludeReservationId) {
        query = query.neq('id', excludeReservationId);
        console.log(`🔄 Excluyendo reserva actual de la validación: ${excludeReservationId}`);
      }

      const { data: existingReservations, error: reservationsError } = await query;

      if (reservationsError) {
        console.error('Error verificando reservas:', reservationsError);
      }

      console.log(`📋 Reservas existentes en ${date} (excluyendo actual):`, existingReservations?.length || 0);

      return {
        valid: true,
        message: 'Hora válida con disponibilidad',
        code: 'TIME_VALID',
        existingReservations: existingReservations?.length || 0
      };

    } catch (error) {
      console.error('Error validando hora:', error);
      return {
        valid: false,
        message: 'Error al validar la hora',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Buscar horas alternativas cercanas
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} requestedTime - Hora solicitada en formato HH:MM:SS
   * @param {number} rangeMinutes - Rango de búsqueda en minutos (±)
   * @returns {Promise<Array>} Array de horas alternativas
   */
  static async findAlternativeTimes(businessId, date, requestedTime, rangeMinutes = 60) {
    try {
      const { data: slots, error } = await supabase
        .from('availability_slots')
        .select('start_time, end_time')
        .eq('business_id', businessId)
        .eq('slot_date', date)
        .eq('status', 'free')
        .order('start_time');

      if (error || !slots) {
        return [];
      }

      // Filtrar horarios únicos y ordenar
      const uniqueTimes = [...new Set(slots.map(slot => slot.start_time))];
      
      return uniqueTimes.slice(0, 3).map(time => ({
        time,
        label: time.substring(0, 5) // HH:MM
      }));

    } catch (error) {
      console.error('Error buscando alternativas:', error);
      return [];
    }
  }

  /**
   * 🚀 BUSCAR ALTERNATIVAS MÁS CERCANAS (SIN DEPENDER DE availability_slots)
   * Genera horarios dinámicamente y verifica disponibilidad real
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} requestedTime - Hora solicitada en formato HH:MM o HH:MM:SS
   * @param {number} partySize - Número de personas
   * @param {number} k - Número máximo de alternativas a devolver (default: 6)
   * @returns {Promise<Array>} Array de alternativas ordenadas por proximidad
   * 
   * REGLA 2: Solo datos REALES (mesas + reservas)
   * REGLA 3: Multi-tenant (filtrado por business_id)
   */
  static async findNearestAlternatives(businessId, date, requestedTime, partySize, k = 6, excludeReservationId = null) {
    try {
      console.log('🔍 Buscando alternativas cercanas:', { businessId, date, requestedTime, partySize, k, excludeReservationId });

      // 1. Obtener configuración del restaurante
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      const settings = restaurant?.settings || {};
      const operatingHours = settings.operating_hours || {};
      const reservationDuration = settings.reservation_duration || 60;
      const slotInterval = settings.slot_interval || 30; // Intervalo entre slots (30 min por defecto)

      // 2. Obtener horario de apertura del día
      const selectedDate = new Date(date + 'T00:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = selectedDate.getDay();
      const dayName = dayNames[dayOfWeek];
      const dayConfig = operatingHours[dayName];

      if (!dayConfig || dayConfig.closed === true) {
        console.log('⚠️ Restaurante cerrado este día');
        return [];
      }

      const openTime = dayConfig.open || '09:00';
      const closeTime = dayConfig.close || '22:00';

      // 3. Generar todos los horarios posibles (cada 30 min)
      const [openHours, openMinutes] = openTime.split(':').map(Number);
      const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
      
      const openTotalMinutes = openHours * 60 + openMinutes;
      const closeTotalMinutes = closeHours * 60 + closeMinutes;

      const possibleTimes = [];
      for (let minutes = openTotalMinutes; minutes <= closeTotalMinutes; minutes += slotInterval) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
        possibleTimes.push(timeStr);
      }

      console.log(`📅 Horarios posibles generados: ${possibleTimes.length}`);

      // 4. Para cada horario, verificar si hay mesas disponibles
      const alternatives = [];
      
      for (const time of possibleTimes) {
        const result = await this.getAvailableTables(businessId, date, time, partySize, excludeReservationId);
        
        if (result.success && result.tables.length > 0) {
          alternatives.push({
            time: time,
            displayTime: time.substring(0, 5),
            availableTables: result.tables.length,
            tableCount: result.tables.length
          });
        }
      }

      if (alternatives.length === 0) {
        console.log('⚠️ No hay alternativas disponibles');
        return [];
      }

      // 5. Calcular proximidad a la hora solicitada
      const normalizedRequestedTime = requestedTime.length === 5 ? `${requestedTime}:00` : requestedTime;
      const [reqHours, reqMinutes] = normalizedRequestedTime.split(':').map(Number);
      const requestedMinutes = reqHours * 60 + reqMinutes;

      alternatives.forEach(alt => {
        const [altHours, altMinutes] = alt.time.split(':').map(Number);
        const altMinutesTotal = altHours * 60 + altMinutes;
        alt.proximityMinutes = Math.abs(altMinutesTotal - requestedMinutes);
      });

      // 6. Ordenar por proximidad y tomar las K más cercanas
      alternatives.sort((a, b) => a.proximityMinutes - b.proximityMinutes);
      const topAlternatives = alternatives.slice(0, k);

      console.log('✅ Alternativas encontradas:', topAlternatives.map(a => 
        `${a.displayTime} (${a.tableCount} mesas, ${a.proximityMinutes} min)`
      ));

      return topAlternatives.map(alt => ({
        time: alt.time,
        displayTime: alt.displayTime,
        availableTables: alt.tableCount,
        proximityMinutes: alt.proximityMinutes,
        label: `${alt.displayTime} · ${alt.tableCount} mesa${alt.tableCount > 1 ? 's' : ''}`
      }));

    } catch (error) {
      console.error('❌ Error buscando alternativas cercanas:', error);
      return [];
    }
  }

  /**
   * Validar número de personas
   * @param {string} businessId - ID del restaurante
   * @param {number} partySize - Número de personas
   * @returns {Promise<Object>} { valid: boolean, message: string }
   */
  static async validatePartySize(businessId, partySize) {
    try {
      if (!partySize || partySize < 1) {
        return {
          valid: false,
          message: 'El número de personas debe ser al menos 1',
          code: 'PARTY_SIZE_MIN'
        };
      }

      // Obtener configuración del restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      if (restaurantError) {
        console.error('Error obteniendo configuración:', restaurantError);
      }

      const settings = restaurant?.settings || {};
      const minPartySize = settings.min_party_size || 1;
      const maxPartySize = settings.max_party_size || 20;
      const largeGroupThreshold = settings.large_group_threshold || 10;

      if (partySize < minPartySize) {
        return {
          valid: false,
          message: `El número mínimo de personas es ${minPartySize}`,
          code: 'PARTY_SIZE_TOO_SMALL'
        };
      }

      if (partySize > maxPartySize) {
        return {
          valid: false,
          message: `El número máximo de personas permitido es ${maxPartySize}. Para grupos más grandes, contacte directamente con el restaurante.`,
          code: 'PARTY_SIZE_TOO_LARGE',
          requiresContact: true
        };
      }

      // 🔥 Cualquier grupo puede requerir juntar mesas si no hay individual suficiente
      if (partySize >= 1) {
        const isLargeGroup = partySize >= 10;
        return {
          valid: true,
          message: isLargeGroup ? `Grupo grande: ${partySize} personas - Requiere aprobación` : `Grupo de ${partySize} personas`,
          code: isLargeGroup ? 'PARTY_SIZE_LARGE_GROUP' : 'PARTY_SIZE_OK',
          isLargeGroup: isLargeGroup,
          warning: isLargeGroup 
            ? `⚠️ Grupos de ${partySize} personas requieren aprobación del restaurante. La reserva quedará PENDIENTE DE APROBACIÓN.`
            : partySize >= 6 
              ? `Puede requerir juntar mesas. La reserva quedará pendiente de confirmación.`
              : null
        };
      }

      return {
        valid: true,
        message: 'Número de personas válido',
        code: 'PARTY_SIZE_VALID'
      };

    } catch (error) {
      console.error('Error validando party_size:', error);
      return {
        valid: false,
        message: 'Error al validar el número de personas',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * 🔥 Obtener mesas disponibles SIN DEPENDER DE availability_slots
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} time - Hora en formato HH:MM:SS
   * @param {number} partySize - Número de personas
   * @returns {Promise<Object>} { success: boolean, tables: array }
   */
  static async getAvailableTables(businessId, date, time, partySize, excludeReservationId = null) {
    try {
      console.log(`🔍 Buscando mesas para ${partySize} personas el ${date} a las ${time}`, excludeReservationId ? `(excluyendo reserva ${excludeReservationId})` : '');

      // 1. Obtener TODAS las mesas activas con capacidad suficiente
      const { data: allTables, error: tablesError } = await supabase
        .from('resources')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gte('capacity', partySize)
        .order('capacity', { ascending: true }); // Mesa más pequeña primero

      if (tablesError) {
        console.error('Error obteniendo mesas:', tablesError);
        return {
          success: false,
          tables: [],
          message: 'Error al obtener mesas'
        };
      }

      if (!allTables || allTables.length === 0) {
        return {
          success: false,
          tables: [],
          message: `No hay mesas con capacidad para ${partySize} personas`
        };
      }

      console.log(`📋 Mesas con capacidad suficiente: ${allTables.length}`);

      // 2. Obtener configuración de duración de reserva
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      const reservationDuration = restaurant?.settings?.reservation_duration || 60;

      // 3. Calcular rango de tiempo de la nueva reserva
      const [hours, minutes] = time.split(':').map(Number);
      const requestedMinutes = hours * 60 + minutes;
      const endMinutes = requestedMinutes + reservationDuration;

      // 4. Obtener reservas existentes en ese día (EXCLUYENDO la actual si estamos editando)
      let query = supabase
        .from('appointments')
        .select('id, table_id, reservation_time, party_size')
        .eq('business_id', businessId)
        .eq('reservation_date', date)
        .in('status', ['confirmed', 'pending']);

      // 🔥 EXCLUIR LA RESERVA ACTUAL SI ESTAMOS EDITANDO
      if (excludeReservationId) {
        query = query.neq('id', excludeReservationId);
        console.log(`🔄 Excluyendo reserva actual: ${excludeReservationId}`);
      }

      const { data: existingReservations, error: reservationsError } = await query;

      if (reservationsError) {
        console.error('Error obteniendo reservas:', reservationsError);
      }

      console.log(`📅 Reservas existentes: ${existingReservations?.length || 0}`);

      // 5. Filtrar mesas que NO tengan conflictos
      const availableTables = allTables.filter(table => {
        // Buscar si esta mesa tiene alguna reserva que se solape
        const hasConflict = existingReservations?.some(reservation => {
          if (reservation.table_id !== table.id) return false;

          // Calcular rango de la reserva existente
          const [resHours, resMinutes] = reservation.reservation_time.split(':').map(Number);
          const resStartMinutes = resHours * 60 + resMinutes;
          const resEndMinutes = resStartMinutes + reservationDuration;

          // Verificar si hay solapamiento
          const overlaps = (
            (requestedMinutes >= resStartMinutes && requestedMinutes < resEndMinutes) ||
            (endMinutes > resStartMinutes && endMinutes <= resEndMinutes) ||
            (requestedMinutes <= resStartMinutes && endMinutes >= resEndMinutes)
          );

          if (overlaps) {
            console.log(`❌ Mesa ${table.table_number} ocupada: reserva a las ${reservation.reservation_time}`);
          }

          return overlaps;
        });

        return !hasConflict;
      });

      console.log(`✅ Mesas disponibles: ${availableTables.length}`);

      if (availableTables.length === 0) {
        return {
          success: false,
          tables: [],
          message: `No hay mesas disponibles para ${partySize} personas a las ${time.substring(0, 5)}`
        };
      }

      return {
        success: true,
        tables: availableTables,
        message: `${availableTables.length} mesa(s) disponible(s)`
      };

    } catch (error) {
      console.error('Error obteniendo mesas disponibles:', error);
      return {
        success: false,
        tables: [],
        message: 'Error al buscar mesas disponibles'
      };
    }
  }

  /**
   * Validar mesa seleccionada
   * @param {string} businessId - ID del restaurante
   * @param {string} tableId - ID de la mesa
   * @param {number} partySize - Número de personas
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} time - Hora en formato HH:MM:SS
   * @returns {Promise<Object>} { valid: boolean, message: string }
   */
  static async validateTable(businessId, tableId, partySize, date, time, excludeReservationId = null) {
    try {
      if (!tableId) {
        return {
          valid: false,
          message: 'Debe seleccionar una mesa',
          code: 'TABLE_REQUIRED'
        };
      }

      // 1. Verificar que la mesa existe y está activa
      const { data: table, error: tableError } = await supabase
        .from('resources')
        .select('*')
        .eq('id', tableId)
        .eq('business_id', businessId)
        .single();

      if (tableError || !table) {
        return {
          valid: false,
          message: 'Mesa no encontrada',
          code: 'TABLE_NOT_FOUND'
        };
      }

      if (!table.is_active) {
        return {
          valid: false,
          message: 'Esta mesa no está disponible',
          code: 'TABLE_INACTIVE'
        };
      }

      // 2. Verificar capacidad
      if (table.capacity < partySize) {
        return {
          valid: false,
          message: `La mesa ${table.table_number} solo tiene capacidad para ${table.capacity} personas (necesitas ${partySize})`,
          code: 'TABLE_CAPACITY_INSUFFICIENT'
        };
      }

      // 3. 🔥 Verificar que NO haya conflictos con reservas existentes (SIN availability_slots)
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      const reservationDuration = restaurant?.settings?.reservation_duration || 60;

      // Calcular rango de tiempo de la nueva reserva
      const [hours, minutes] = time.split(':').map(Number);
      const requestedMinutes = hours * 60 + minutes;
      const endMinutes = requestedMinutes + reservationDuration;

      // Obtener reservas existentes para esta mesa en ese día
      let query = supabase
        .from('appointments')
        .select('id, reservation_time')
        .eq('business_id', businessId)
        .eq('table_id', tableId)
        .eq('reservation_date', date)
        .in('status', ['confirmed', 'pending']);

      // 🔥 EXCLUIR LA RESERVA ACTUAL SI ESTAMOS EDITANDO
      if (excludeReservationId) {
        query = query.neq('id', excludeReservationId);
        console.log(`🔄 Excluyendo reserva actual de validación de mesa: ${excludeReservationId}`);
      }

      const { data: existingReservations, error: reservationsError } = await query;

      if (reservationsError) {
        console.error('Error verificando reservas:', reservationsError);
        return {
          valid: false,
          message: 'Error al verificar disponibilidad de la mesa',
          code: 'RESERVATION_CHECK_ERROR'
        };
      }

      // Verificar si hay conflictos
      const hasConflict = existingReservations?.some(reservation => {
        const [resHours, resMinutes] = reservation.reservation_time.split(':').map(Number);
        const resStartMinutes = resHours * 60 + resMinutes;
        const resEndMinutes = resStartMinutes + reservationDuration;

        // Verificar si hay solapamiento
        const overlaps = (
          (requestedMinutes >= resStartMinutes && requestedMinutes < resEndMinutes) ||
          (endMinutes > resStartMinutes && endMinutes <= resEndMinutes) ||
          (requestedMinutes <= resStartMinutes && endMinutes >= resEndMinutes)
        );

        if (overlaps) {
          console.log(`❌ Mesa ${table.table_number} ocupada: reserva a las ${reservation.reservation_time}`);
        }

        return overlaps;
      });

      if (hasConflict) {
        return {
          valid: false,
          message: `La mesa ${table.table_number} no está disponible en ese horario`,
          code: 'TABLE_NOT_AVAILABLE'
        };
      }

      console.log(`✅ Mesa ${table.table_number} disponible`);

      return {
        valid: true,
        message: `Mesa ${table.table_number} disponible`,
        code: 'TABLE_VALID',
        table: table
      };

    } catch (error) {
      console.error('Error validando mesa:', error);
      return {
        valid: false,
        message: 'Error al validar la mesa',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validación completa de reserva (todos los campos)
   * @param {Object} reservationData - Datos de la reserva
   * @returns {Promise<Object>} { valid: boolean, errors: object }
   */
  static async validateFullReservation(reservationData) {
    const { businessId, date, time, partySize, tableId, customerPhone, customerName } = reservationData;

    const errors = {};

    // 1. Validar teléfono/cliente
    if (!customerPhone) {
      errors.customerPhone = 'El teléfono es obligatorio';
    }

    if (!customerName) {
      errors.customerName = 'El nombre es obligatorio';
    }

    // 2. Validar fecha
    const dateValidation = await this.validateDate(businessId, date);
    if (!dateValidation.valid) {
      errors.date = dateValidation.message;
    }

    // 3. Validar hora
    const timeValidation = await this.validateTime(businessId, date, time);
    if (!timeValidation.valid) {
      errors.time = timeValidation.message;
    }

    // 4. Validar personas
    const partySizeValidation = await this.validatePartySize(businessId, partySize);
    if (!partySizeValidation.valid) {
      errors.partySize = partySizeValidation.message;
    }

    // 5. Validar mesa
    const tableValidation = await this.validateTable(businessId, tableId, partySize, date, time);
    if (!tableValidation.valid) {
      errors.tableId = tableValidation.message;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * 🚀 BUSCAR ALTERNATIVAS CERCANAS
   * Encuentra horarios disponibles cercanos a la hora solicitada
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} requestedTime - Hora solicitada en formato HH:MM:SS
   * @param {number} partySize - Número de personas
   * @param {number} k - Número máximo de alternativas a retornar
   * @param {string} excludeReservationId - ID de reserva a excluir (modo edición)
   * @returns {Promise<Array>} Array de alternativas ordenadas por proximidad
   */
  static async findNearestAlternatives(businessId, date, requestedTime, partySize, k = 6, excludeReservationId = null) {
    try {
      console.log(`🔍 Buscando ${k} alternativas para ${date} ${requestedTime} (${partySize} personas)`);

      // 1. Obtener configuración del restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      if (restaurantError) {
        console.error('Error obteniendo configuración:', restaurantError);
        return [];
      }

      const settings = restaurant?.settings || {};
      const operatingHours = settings.operating_hours || {};
      const reservationDuration = settings.reservation_duration || 60;
      const slotInterval = settings.slot_interval || 30;

      // 2. Obtener horario del día
      const selectedDate = new Date(date + 'T00:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = selectedDate.getDay();
      const dayName = dayNames[dayOfWeek];
      const dayConfig = operatingHours[dayName];

      if (!dayConfig || dayConfig.closed === true) {
        console.log('❌ Restaurante cerrado ese día');
        return [];
      }

      const openTime = dayConfig.open || '09:00';
      const closeTime = dayConfig.close || '22:00';

      console.log(`📅 Horario del ${dayName}: ${openTime} - ${closeTime}`);

      // 3. Generar todos los slots posibles del día
      const [openHours, openMinutes] = openTime.split(':').map(Number);
      const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
      
      const openMinutesTotal = openHours * 60 + openMinutes;
      const closeMinutesTotal = closeHours * 60 + closeMinutes;

      const allSlots = [];
      // 🔥 Incluir hasta la hora de cierre INCLUSIVE (si cierran a las 22:00, aceptan reservas a las 22:00)
      for (let minutes = openMinutesTotal; minutes <= closeMinutesTotal; minutes += slotInterval) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
        allSlots.push(timeStr);
      }

      console.log(`🕐 Slots generados: ${allSlots.length}`);

      // 4. Obtener mesas disponibles para cada slot
      const alternatives = [];

      for (const slotTime of allSlots) {
        // Obtener mesas disponibles para este slot
        const availableTables = await this.getAvailableTables(
          businessId,
          date,
          slotTime,
          partySize,
          excludeReservationId
        );

        if (availableTables.length > 0) {
          // Calcular proximidad a la hora solicitada
          const [reqHours, reqMinutes] = requestedTime.split(':').map(Number);
          const [slotHours, slotMinutes] = slotTime.split(':').map(Number);
          
          const requestedMinutes = reqHours * 60 + reqMinutes;
          const slotMinutesTotal = slotHours * 60 + slotMinutes;
          
          const proximityMinutes = Math.abs(slotMinutesTotal - requestedMinutes);

          alternatives.push({
            time: slotTime,
            displayTime: slotTime.substring(0, 5), // HH:MM
            availableTables: availableTables.length,
            proximityMinutes,
            tables: availableTables
          });
        }
      }

      // 5. Ordenar por proximidad y tomar las k más cercanas
      alternatives.sort((a, b) => a.proximityMinutes - b.proximityMinutes);
      const nearest = alternatives.slice(0, k);

      console.log(`✅ Encontradas ${nearest.length} alternativas:`, nearest.map(a => `${a.displayTime} (${a.availableTables} mesas)`));

      return nearest;

    } catch (error) {
      console.error('Error buscando alternativas:', error);
      return [];
    }
  }

  /**
   * 🔧 BUSCAR COMBINACIÓN DE MESAS
   * Encuentra combinaciones de 2-3 mesas en la misma zona que sumen la capacidad necesaria
   * @param {Array} tables - Array de mesas disponibles
   * @param {number} targetCapacity - Capacidad objetivo
   * @returns {Object|null} Objeto con tables, zone, totalCapacity o null si no encuentra
   */
  static findTableCombination(tables, targetCapacity) {
    // Agrupar mesas por zona
    const tablesByZone = {};
    tables.forEach(table => {
      const zone = table.zone || 'main';
      if (!tablesByZone[zone]) tablesByZone[zone] = [];
      tablesByZone[zone].push(table);
    });

    // Buscar combinaciones en cada zona
    for (const zone in tablesByZone) {
      const zoneTables = tablesByZone[zone];
      
      // Intentar con 2 mesas
      for (let i = 0; i < zoneTables.length; i++) {
        for (let j = i + 1; j < zoneTables.length; j++) {
          const totalCapacity = zoneTables[i].capacity + zoneTables[j].capacity;
          if (totalCapacity >= targetCapacity) {
            return {
              tables: [zoneTables[i], zoneTables[j]],
              zone: zone,
              totalCapacity: totalCapacity
            };
          }
        }
      }
      
      // Intentar con 3 mesas (solo si el grupo es muy grande)
      if (targetCapacity >= 10) {
        for (let i = 0; i < zoneTables.length; i++) {
          for (let j = i + 1; j < zoneTables.length; j++) {
            for (let k = j + 1; k < zoneTables.length; k++) {
              const totalCapacity = zoneTables[i].capacity + zoneTables[j].capacity + zoneTables[k].capacity;
              if (totalCapacity >= targetCapacity) {
                return {
                  tables: [zoneTables[i], zoneTables[j], zoneTables[k]],
                  zone: zone,
                  totalCapacity: totalCapacity
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * 🔍 OBTENER MESAS DISPONIBLES
   * Encuentra todas las mesas disponibles para una fecha/hora/tamaño específicos
   * @param {string} businessId - ID del restaurante
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {string} time - Hora en formato HH:MM:SS
   * @param {number} partySize - Número de personas
   * @param {string} excludeReservationId - ID de reserva a excluir (modo edición)
   * @returns {Promise<Array>} Array de mesas disponibles
   */
  static async getAvailableTables(businessId, date, time, partySize, excludeReservationId = null) {
    try {
      // 🔥 CAMBIO: Para CUALQUIER grupo, intentar buscar combinaciones si no hay mesa individual
      // Primero intentamos con mesas individuales, si no hay, buscamos combinaciones
      let allTables = [];
      let needsCombination = false;

      // Siempre obtener TODAS las mesas para poder buscar combinaciones
      needsCombination = true;
        const { data: allTablesData, error: allTablesError } = await supabase
          .from('resources')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('zone, table_number');

        if (allTablesError) {
          console.error('Error obteniendo mesas:', allTablesError);
          return [];
        }

      allTables = allTablesData || [];
      console.log(`🔍 Grupo de ${partySize} personas: Obteniendo TODAS las mesas (${allTables.length}) para buscar combinaciones`);

      if (allTables.length === 0) {
        console.log('❌ No hay mesas disponibles en el restaurante');
        return [];
      }

      // 2. Obtener duración de reserva
      const { data: restaurant } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single();

      const reservationDuration = restaurant?.settings?.reservation_duration || 60;

      // 3. Calcular rango de tiempo de la nueva reserva
      const [hours, minutes] = time.split(':').map(Number);
      const requestedMinutes = hours * 60 + minutes;
      const endMinutes = requestedMinutes + reservationDuration;

      // 4. Obtener todas las reservas confirmadas/pendientes para ese día
      let query = supabase
        .from('appointments')
        .select('id, table_id, reservation_time')
        .eq('business_id', businessId)
        .eq('reservation_date', date)
        .in('status', ['confirmed', 'pending']);

      // Excluir la reserva actual si estamos editando
      if (excludeReservationId) {
        query = query.neq('id', excludeReservationId);
      }

      const { data: existingReservations, error: reservationsError } = await query;

      if (reservationsError) {
        console.error('Error obteniendo reservas:', reservationsError);
        return [];
      }

      // 5. Filtrar mesas que NO tienen conflictos
      const availableTables = allTables.filter(table => {
        // Verificar si esta mesa tiene alguna reserva que se solape
        const hasConflict = existingReservations?.some(reservation => {
          if (reservation.table_id !== table.id) return false;

          const [resHours, resMinutes] = reservation.reservation_time.split(':').map(Number);
          const resStartMinutes = resHours * 60 + resMinutes;
          const resEndMinutes = resStartMinutes + reservationDuration;

          // Verificar si hay solapamiento
          const overlaps = (
            (requestedMinutes >= resStartMinutes && requestedMinutes < resEndMinutes) ||
            (endMinutes > resStartMinutes && endMinutes <= resEndMinutes) ||
            (requestedMinutes <= resStartMinutes && endMinutes >= resEndMinutes)
          );

          return overlaps;
        });

        return !hasConflict;
      });

      // 6. 🔥 SIEMPRE devolver TODAS las mesas disponibles
      // El agrupamiento por zona se hace en validateZone
      console.log(`✅ Mesas disponibles (sin conflictos): ${availableTables.length}`);
      
      return availableTables;

    } catch (error) {
      console.error('Error obteniendo mesas disponibles:', error);
      return [];
    }
  }
}

export default ReservationValidationService;


