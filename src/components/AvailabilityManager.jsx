// AvailabilityManager.jsx - Gestor de Tabla de Disponibilidades
import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Calendar,
    CalendarCheck,
    CalendarClock,
    RefreshCw,
    Settings,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Users,
    Trash2,
    Plus,
    Eye,
    EyeOff,
    AlertCircle,
    Info,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAvailabilityChangeDetection } from '../hooks/useAvailabilityChangeDetection';
import ConfirmActionModal from './ConfirmActionModal';
import ResultModal from './ResultModal';

const AvailabilityManager = ({ autoTriggerRegeneration = false }) => {
    const { businessId: businessId } = useAuthContext();
    const changeDetection = useAvailabilityChangeDetection(businessId);
    const [loading, setLoading] = useState(false);
    const [showNoSlotsModal, setShowNoSlotsModal] = useState(false);
    const [noSlotsReason, setNoSlotsReason] = useState(null);
    const [validationExecuted, setValidationExecuted] = useState(false); // 🔒 Flag para evitar validación doble
    const [showRegenerationModal, setShowRegenerationModal] = useState(false); // 🎯 Modal de resultado
    const [regenerationResult, setRegenerationResult] = useState(null); // 📊 Datos del resultado
    const [showConfirmDelete, setShowConfirmDelete] = useState(false); // 🗑️ Modal confirmación borrado
    const [showConfirmRegenerate, setShowConfirmRegenerate] = useState(false); // 🔄 Modal confirmación regeneración
    const [dayStats, setDayStats] = useState(null); // 📊 Estadísticas de días (nueva versión simplificada)
    const [autoTriggerShown, setAutoTriggerShown] = useState(false); // 🔒 Flag para evitar modal repetido
    const [protectedDaysData, setProtectedDaysData] = useState([]); // 🛡️ Datos de días protegidos para el modal
    const [dateRangeInfo, setDateRangeInfo] = useState(null); // 📅 Rango de fechas para el modal
    const [lastMaintenanceRun, setLastMaintenanceRun] = useState(null); // 🔄 Última ejecución del mantenimiento automático
    
    // 🚨 Forzar verificación del estado cuando se monta el componente
    useEffect(() => {
        if (businessId) {
            console.log('🔍 AvailabilityManager montado - verificando estado de regeneración...');
            console.log('🔍 needsRegeneration:', changeDetection.needsRegeneration);
            console.log('🔍 changeType:', changeDetection.changeType);
            console.log('🔍 changeDetails:', changeDetection.changeDetails);
            console.log('🔍 autoTriggerRegeneration:', autoTriggerRegeneration);
            
            // 🎯 LIMPIAR modal de resultado al montar (evitar que aparezca sin acción)
            setShowRegenerationModal(false);
            setRegenerationResult(null);
        }
    }, [businessId, changeDetection.needsRegeneration, changeDetection.changeType, autoTriggerRegeneration]);
    
    const [availabilityStats, setAvailabilityStats] = useState(null);
    const [conflictingReservations, setConflictingReservations] = useState([]);
    const [showDetails, setShowDetails] = useState(false);
    const [showAvailabilityGrid, setShowAvailabilityGrid] = useState(false);
    const [availabilityGrid, setAvailabilityGrid] = useState([]);
    const [businessesettings, setbusinessesettings] = useState(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictData, setConflictData] = useState(null);
    const [generationSuccess, setGenerationSuccess] = useState(() => {
        // Cargar estado persistente del localStorage
        try {
            const saved = localStorage.getItem(`generationSuccess_${businessId}`);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dayAvailability, setDayAvailability] = useState([]);
    const [calendarExceptions, setCalendarExceptions] = useState([]);
    const [loadingDayView, setLoadingDayView] = useState(false);
    const [generationSettings, setGenerationSettings] = useState({
        startDate: format(new Date(), 'yyyy-MM-dd'), // Siempre desde hoy
        endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        overwriteExisting: false,
        // 🆕 CONFIGURACIÓN SIMPLIFICADA DE DISPONIBILIDADES
        advanceBookingDays: 90, // Días de antelación máxima (cuántos días hacia el futuro)
        minAdvanceMinutes: 120  // Minutos de antelación mínima (ej: 120 = 2 horas)
    });

    // Obtener última ejecución del mantenimiento automático
    const loadLastMaintenanceRun = async () => {
        try {
            // Intentar obtener de cron.job_run_details (puede no estar disponible por RLS)
            const { data, error } = await supabase.rpc('get_last_maintenance_run');
            
            if (!error && data) {
                setLastMaintenanceRun(data);
            } else {
                // Fallback: Calcular en base a la lógica (cada día a las 4 AM)
                const now = new Date();
                const today4AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0);
                const lastRun = now.getHours() >= 4 ? today4AM : new Date(today4AM.getTime() - 24 * 60 * 60 * 1000);
                setLastMaintenanceRun({ estimated: true, timestamp: lastRun.toISOString() });
            }
        } catch (error) {
            console.warn('⚠️ No se pudo obtener última ejecución del mantenimiento:', error);
        }
    };

    // Cargar configuración del restaurante
    const loadbusinessesettings = async () => {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', businessId)
                .single();

            if (error) throw error;

            // Extraer configuración del JSONB settings
            const settings = data?.settings || {};
            
            const processedSettings = {
                advance_booking_days: settings.advance_booking_days || 30,
                min_party_size: settings.min_party_size || 1,
                max_party_size: settings.max_party_size || 20,
                reservation_duration: settings.reservation_duration || 90
            };
            
            setbusinessesettings(processedSettings);
            
            // Actualizar fechas según configuración
            if (processedSettings.advance_booking_days) {
                setGenerationSettings(prev => ({
                    ...prev,
                    endDate: format(addDays(new Date(), processedSettings.advance_booking_days), 'yyyy-MM-dd')
                }));
            }
        } catch (error) {
            console.error('Error cargando configuración:', error);
        }
    };

    // 🛡️ Cargar excepciones de calendario
    const loadCalendarExceptions = async () => {
        try {
            const { data, error } = await supabase
                .from('calendar_exceptions')
                .select('*')
                .eq('business_id', businessId)
                .gte('exception_date', format(new Date(), 'yyyy-MM-dd'))
                .order('exception_date', { ascending: true });

            if (error) throw error;

            setCalendarExceptions(data || []);
            console.log(`🛡️ ${data?.length || 0} excepciones de calendario cargadas`);
        } catch (error) {
            console.error('Error cargando excepciones:', error);
        }
    };

    // Cargar estadísticas de disponibilidad - SOLO DATOS REALES
    const loadAvailabilityStats = async () => {
        try {
            console.log('📊 Loading REAL availability stats for restaurant:', businessId);
            
            if (!businessId) {
                console.warn('⚠️ Restaurant ID required for REAL stats');
                return;
            }

            // Usar la nueva función del store que garantiza datos REALES
            const { useReservationStore } = await import('../stores/reservationStore.js');
            const stats = await useReservationStore.getState().getAvailabilityStats(businessId);
            
            console.log('✅ REAL availability stats loaded:', stats);
            setAvailabilityStats(stats);

        } catch (error) {
            console.error('❌ Error loading REAL availability stats:', error);
            toast.error('Error al cargar estadísticas reales de disponibilidad');
            // NO mostrar stats falsas - dejar null
            setAvailabilityStats(null);
        }
    };

    // 📊 Calcular estadísticas de DÍAS basadas en CONFIGURACIÓN (no solo slots generados)
    const loadDayStats = async () => {
        try {
            console.log('📊 Calculando estadísticas de DÍAS para restaurant:', businessId);
            
            if (!businessId) {
                console.warn('⚠️ Restaurant ID required');
                return;
            }

            // 1. Obtener configuración del restaurante (solo para duración y período)
            const { data: restaurantData, error: restError } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', businessId)
                .single();

            if (restError) throw restError;

            const advanceDays = restaurantData?.settings?.advance_booking_days || 30;
            const reservationDuration = restaurantData?.settings?.reservation_duration || 60;

            // 2. Calcular rango de fechas
            const today = format(new Date(), 'yyyy-MM-dd');
            const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');

            // 3. Obtener DÍAS ÚNICOS con slots REALES en availability_slots
            // ⚠️ Usamos RPC para obtener fechas únicas sin límite de 1000 registros
            console.log('🔍 CÓDIGO ACTUALIZADO - Consultando días únicos directamente');
            
            // 🔍 DIAGNÓSTICO: Primero verificar si hay slots en absoluto (sin filtros)
            const { data: diagnosticSlots, error: diagnosticError } = await supabase
                .from('availability_slots')
                .select('id, business_id, slot_date')
                .limit(10);
            
            console.log('🔍 DIAGNÓSTICO loadDayStats - Slots en la tabla (sin filtros):', {
                encontrados: diagnosticSlots?.length || 0,
                error: diagnosticError,
                muestra: diagnosticSlots?.slice(0, 3),
                businessIds: [...new Set(diagnosticSlots?.map(s => s.business_id) || [])],
                fechas: [...new Set(diagnosticSlots?.map(s => s.slot_date) || [])]
            });
            
            let slotsData = [];
            let uniqueDates = [];
            
            // Intentar primero con RPC
            try {
                const { data: rpcData, error: slotsError } = await supabase
                .rpc('get_unique_slot_dates', {
                    p_business_id: businessId,
                    p_from_date: today
                });

                if (!slotsError && rpcData && rpcData.length > 0) {
                    slotsData = rpcData;
                    console.log('✅ RPC devolvió datos:', rpcData.length, 'fechas');
                } else {
                    console.warn('⚠️ RPC no devolvió datos o hubo error:', slotsError);
                    // Fallback: consulta directa más robusta - SIN LÍMITE
                    const { data: directData, error: directError } = await supabase
                        .from('availability_slots')
                        .select('slot_date, id, business_id')
                        .eq('business_id', businessId)
                        .gte('slot_date', today)
                        .order('slot_date', { ascending: true });
                    
                    console.log('🔍 Consulta directa completa:', {
                        encontrados: directData?.length || 0,
                        error: directError,
                        businessIdBuscado: businessId,
                        fechaDesde: today
                    });
                    
                    if (!directError && directData && directData.length > 0) {
                        console.log('✅ Consulta directa encontró', directData.length, 'slots');
                        // Obtener fechas únicas y contar slots por fecha
                        const dateCounts = {};
                        directData.forEach(slot => {
                            const date = slot.slot_date;
                            dateCounts[date] = (dateCounts[date] || 0) + 1;
                        });
                        
                        slotsData = Object.keys(dateCounts).map(date => ({
                            slot_date: date,
                            slots_count: dateCounts[date]
                        })).sort((a, b) => a.slot_date.localeCompare(b.slot_date));
                        
                        console.log('✅ Fechas únicas procesadas:', slotsData.length);
                    } else {
                        console.error('❌ Error también en fallback directo o no hay datos:', directError);
                        if (directData && directData.length === 0) {
                            console.warn('⚠️ No se encontraron slots en la base de datos para business_id:', businessId);
                            console.warn('⚠️ Verifica que los slots se hayan generado correctamente en Supabase');
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Error consultando slots:', err);
                // Fallback: consulta directa
                try {
                    const { data: directData, error: directError } = await supabase
                        .from('availability_slots')
                        .select('slot_date, id')
                        .eq('business_id', businessId)
                        .gte('slot_date', today)
                        .order('slot_date', { ascending: true });
                    
                    if (!directError && directData && directData.length > 0) {
                        const dateCounts = {};
                        directData.forEach(slot => {
                            const date = slot.slot_date;
                            dateCounts[date] = (dateCounts[date] || 0) + 1;
                        });
                        
                        slotsData = Object.keys(dateCounts).map(date => ({
                            slot_date: date,
                            slots_count: dateCounts[date]
                        })).sort((a, b) => a.slot_date.localeCompare(b.slot_date));
                    }
                } catch (fallbackErr) {
                    console.error('❌ Error en fallback:', fallbackErr);
                }
            }

            console.log(`✅ SLOTS RECIBIDOS: ${slotsData?.length} registros`);
            console.log(`📊 Datos de slots recibidos:`, slotsData);
            
            // Debug: Ver fechas únicas en los slots
            uniqueDates = [...new Set(slotsData?.map(s => s.slot_date) || [])].sort();
            console.log(`📅 FECHAS ÚNICAS EN SLOTS: ${uniqueDates.length} días`);
            console.log(`📅 Primera fecha: ${uniqueDates[0]}`);
            console.log(`📅 Última fecha: ${uniqueDates[uniqueDates.length - 1]}`);
            console.log(`📅 Todas las fechas:`, uniqueDates);

            // Si no hay slots pero debería haberlos, hacer consulta directa de debug
            if (slotsData?.length === 0) {
                console.warn('⚠️ No se encontraron slots. Haciendo consulta directa de debug...');
                const { data: debugData, error: debugError } = await supabase
                    .from('availability_slots')
                    .select('slot_date, business_id')
                .eq('business_id', businessId)
                    .gte('slot_date', today)
                    .limit(10);
                
                console.log('🔍 DEBUG - Consulta directa:', {
                    encontrados: debugData?.length || 0,
                    error: debugError,
                    datos: debugData,
                    businessId,
                    today,
                    mensaje: debugData?.length === 0 
                        ? '⚠️ No hay slots en la BD. ¿Se generaron correctamente?' 
                        : '✅ Slots encontrados en la BD'
                });
                
                // Si hay slots pero no se encontraron con RPC, puede ser problema de fecha
                if (debugData && debugData.length > 0) {
                    console.log('✅ Slots EXISTEN en la BD pero no se encontraron con RPC. Verificar:');
                    console.log('   - Fechas de slots:', debugData.map(s => s.slot_date));
                    console.log('   - Fecha de búsqueda (today):', today);
                }
            }

            // 3.5. Obtener días CERRADOS manualmente (festivos, vacaciones) desde calendar_exceptions
            // Nota: Si la tabla no existe o no tiene la columna exception_type, simplemente continuamos sin días cerrados
            let closedDays = [];
            try {
                // Consulta simple sin filtro de exception_type (puede no existir)
                const { data, error: closedError } = await supabase
                    .from('calendar_exceptions')
                    .select('exception_date')
                .eq('business_id', businessId)
                    .gte('exception_date', today)
                    .lte('exception_date', endDate);
                
                if (!closedError && data) {
                    closedDays = data;
                } else if (closedError) {
                    // Si falla, simplemente continuar sin días cerrados (no es crítico)
                    console.warn('⚠️ No se pudieron obtener días cerrados (tabla puede no existir o tener estructura diferente):', closedError.message);
                }
            } catch (err) {
                // Si hay error, simplemente continuar sin días cerrados (no es crítico)
                console.warn('⚠️ No se pudo consultar días cerrados:', err);
            }

            // Crear set de días cerrados
            const closedDaysSet = new Set(
                closedDays?.map(d => d.exception_date) || []
            );

            console.log('🚫 DEBUG - Días cerrados manualmente (desde special_events):', Array.from(closedDaysSet));

            // 4. Calcular días únicos con slots, EXCLUYENDO días cerrados manualmente
            const uniqueDaysWithSlots = new Set(
                slotsData?.filter(s => !closedDaysSet.has(s.slot_date)).map(s => s.slot_date) || []
            );
            
            // ✅ FIX CORRECTO: DÍAS TOTALES = DÍAS REALES CON SLOTS, NO configuración
            const diasConSlotsGenerados = uniqueDaysWithSlots.size;
            const diasTotales = diasConSlotsGenerados;  // ← Días REALES, no configuración

            // Debug: Mostrar TODOS los días con slots
            const diasArray = Array.from(uniqueDaysWithSlots).sort();
            console.log('📊 DEBUG - Días con SLOTS REALES (sin cerrados):', diasTotales);
            console.log('📅 DEBUG - Días específicos:', diasArray);

            // 5. Obtener TODAS las reservas ACTIVAS (sin filtro de rango)
            // ⚠️ CRÍTICO: NO filtrar por endDate porque puede haber reservas futuras
            // que protegen días aunque estén fuera del rango de configuración
            const { data: reservations, error: resError } = await supabase
                .from('appointments')
                .select('appointment_date, status')
                .eq('business_id', businessId)
                .gte('appointment_date', today);  // Solo desde hoy en adelante

            if (resError) throw resError;

            // 6. Filtrar solo las que NO están canceladas o completadas
            const activeReservations = reservations?.filter(r => 
                r.status !== 'cancelled' && r.status !== 'completed'
            ) || [];

            // 7. Calcular días únicos con reservas activas QUE TIENEN SLOTS
            // ⚠️ CRÍTICO: Solo contar reservas en días que TIENEN slots generados
            const reservationsInSlotsRange = activeReservations.filter(r => 
                uniqueDaysWithSlots.has(r.appointment_date)
            );
            
            const uniqueDaysWithReservations = new Set(
                reservationsInSlotsRange.map(r => r.appointment_date)
            ).size;

            // 8. Calcular días libres = días REALES con slots - días con reservas
            // ✅ diasConSlotsGenerados ya está definido arriba (línea 260)
            const diasLibres = Math.max(0, diasConSlotsGenerados - uniqueDaysWithReservations);

            console.log('📊 DEBUG - Cálculo de días:', {
                diasTotalesConfigurados: diasTotales,
                diasConSlotsGenerados: diasConSlotsGenerados,
                diasConReservasEnRango: uniqueDaysWithReservations,
                diasLibres: diasLibres,
                totalReservasActivas: activeReservations.length,
                reservasFueraDeRango: activeReservations.length - reservationsInSlotsRange.length
            });

            // 9. Total de reservas activas (TODAS, incluidas fuera de rango)
            const reservasActivas = activeReservations.length;

            // 10. Obtener número de mesas
            const mesas = availabilityStats?.tablesCount || 0;

            // 11. Calcular la fecha máxima de disponibilidades REALES
            const maxSlotDate = slotsData && slotsData.length > 0
                ? Math.max(...slotsData.map(s => new Date(s.slot_date).getTime()))
                : null;

            const maxDate = maxSlotDate ? format(new Date(maxSlotDate), 'dd/MM/yyyy') : null;

            const stats = {
                diasTotales: diasTotales,  // ← Días REALES con slots (puede ser 0)
                diasConReservas: uniqueDaysWithReservations,  // ← Días con reservas activas
                diasLibres: diasLibres,  // ← Días libres = diasTotales - diasConReservas
                reservasActivas: reservasActivas,  // ← Total reservas activas futuras
                mesas: mesas,
                duracionReserva: reservationDuration,
                advanceDaysConfig: advanceDays,  // ← Configuración (30 días) para el modal
                fechaHasta: maxDate  // ← Fecha máxima REAL de disponibilidades
            };

            console.log('✅ Estadísticas de DÍAS calculadas (BASADAS EN SLOTS REALES):', stats);
            console.log('📊 DEBUG - Días con slots:', diasTotales);
            console.log('📊 DEBUG - Días con reservas:', uniqueDaysWithReservations);
            console.log('📊 DEBUG - Días libres:', diasLibres);
            console.log('📊 DEBUG - Reservas activas:', reservasActivas);
            console.log('📊 DEBUG - Fecha hasta:', maxDate);
            setDayStats(stats);

        } catch (error) {
            console.error('❌ Error calculando estadísticas de días:', error);
            setDayStats(null);
        }
    };

    // Detectar reservas que entrarían en conflicto
    const detectConflicts = async (startDate, endDate) => {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    appointment_date,
                    appointment_time,
                    resource_id,
                    customer_name,
                    party_size,
                    status
                `)
                .eq('business_id', businessId)
                .gte('appointment_date', startDate)
                .lte('appointment_date', endDate)
                .in('status', ['confirmed', 'pending']);

            if (error) throw error;

            setConflictingReservations(data || []);
            return data?.length || 0;
        } catch (error) {
            console.error('Error detectando conflictos:', error);
            return 0;
        }
    };

    // 🔒 REGLA SAGRADA: NUNCA ELIMINAR RESERVAS
    // Esta función SOLO limpia la UI - JAMÁS toca la tabla 'reservations'
    // Las reservas son SAGRADAS y solo se eliminan manualmente desde Reservas.jsx
    // 🗑️ BORRAR DISPONIBILIDADES: Elimina slots sin reservas, preserva ocupados
    const handleSmartCleanup = async () => {
        if (!businessId) {
            toast.error('❌ Falta ID del restaurante');
            return;
        }

        // 🛡️ Preparar datos de días protegidos
        const protectedDays = await prepareProtectedDaysData();
        setProtectedDaysData(protectedDays);

        // Mostrar modal de confirmación
        setShowConfirmDelete(true);
    };

    // 🔄 Preparar y mostrar modal de regeneración
    const handleShowRegenerateModal = async () => {
        // 🛡️ Preparar datos de días protegidos
        const protectedDays = await prepareProtectedDaysData();
        setProtectedDaysData(protectedDays);

        // 📅 Calcular rango de fechas
        try {
            const { data: settings } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', businessId)
                .single();
            
            const advanceDays = settings?.settings?.advance_booking_days || 20;
            const endDate = format(addDays(new Date(), advanceDays), 'dd/MM/yyyy');
            setDateRangeInfo(`hasta el ${endDate} (${advanceDays} días)`);
        } catch (error) {
            console.error('Error calculando rango:', error);
        }

        // Mostrar modal de confirmación
        setShowConfirmRegenerate(true);
    };

    // 📊 Preparar datos de días protegidos para el modal
    const prepareProtectedDaysData = async () => {
        if (!businessId) return [];

        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            
            // Obtener TODAS las reservas futuras agrupadas por día
            const { data: reservations, error } = await supabase
                .from('appointments')
                .select('appointment_date, customer_name, status')
                .eq('business_id', businessId)
                .gte('appointment_date', today)
                .not('status', 'in', '(cancelled,completed)');  // Solo activas
            
            if (error) {
                console.error('❌ Error obteniendo reservas:', error);
                return [];
            }

            // Agrupar por fecha (mapear appointment_date a reservation_date para compatibilidad)
            const groupedByDate = {};
            reservations?.forEach(res => {
                const fecha = res.appointment_date || res.reservation_date;
                if (!groupedByDate[fecha]) {
                    groupedByDate[fecha] = [];
                }
                groupedByDate[fecha].push({ ...res, reservation_date: fecha });
            });

            // Convertir a array ordenado con formato
            const protectedDays = Object.keys(groupedByDate)
                .sort()
                .map(date => ({
                    date: format(new Date(date), 'dd/MM/yyyy', { locale: es }),
                    count: groupedByDate[date].length,
                    rawDate: date
                }));

            console.log('🛡️ Días protegidos preparados:', protectedDays);
            return protectedDays;
        } catch (error) {
            console.error('❌ Error preparando días protegidos:', error);
            return [];
        }
    };

    // 🗑️ Ejecutar borrado después de confirmar
    const executeDelete = async () => {
        if (!businessId) return;

        try {
            setLoading(true);
            toast.loading('🗑️ Borrando disponibilidades...', { id: 'cleanup' });

            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = businessesettings?.advance_booking_days || 30;
            const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');

            console.log('🗑️ BORRAR DISPONIBILIDADES:');
            console.log('   🏪 Restaurante:', businessId);
            console.log('🔍 QUERY PARAMETERS:', {
                today,
                endDate,
                advanceDays,
                businessId
            });

            // 🎯 PASO 1: Consultar reservas ANTES de borrar (para contar días protegidos)
            
            // Debug: Todas las reservas
            const { data: allReservationsDebug } = await supabase
                .from('appointments')
                .select('id, appointment_date, status, customer_name')
                .eq('business_id', businessId);

            console.log('📊 TODAS las reservas del restaurante:', allReservationsDebug);
            
            // ⚠️ TODAS las reservas futuras (SIN filtrar por endDate)
            // CRÍTICO: Incluir reservas fuera del rango porque también protegen días
            const { data: reservationsDataBefore, error: resError } = await supabase
                .from('appointments')
                .select('id, appointment_date, status, customer_name')
                .eq('business_id', businessId)
                .gte('appointment_date', today);  // Solo desde hoy, SIN límite superior

            if (resError) {
                console.error('❌ Error consultando reservas:', resError);
            }

            console.log('📊 TODAS las reservas consultadas:', reservationsDataBefore);

            // ✅ FILTRAR: Solo contar las ACTIVAS (excluir cancelled y completed)
            // Mapear appointment_date a reservation_date para compatibilidad
            const activeReservationsArray = (reservationsDataBefore?.filter(r => 
                r.status !== 'cancelled' && r.status !== 'completed'
            ) || []).map(r => ({ ...r, reservation_date: r.appointment_date }));

            const activeReservations = activeReservationsArray.length;
            
            // Contar días únicos con reservas ACTIVAS (días protegidos)
            const uniqueDaysBefore = new Set(
                activeReservationsArray.map(r => r.reservation_date)
            );
            const daysProtected = uniqueDaysBefore.size;

            console.log('📊 ANTES de borrar (SOLO ACTIVAS):', {
                reservasActivas: activeReservations,
                reservasCanceladas: reservationsDataBefore?.filter(r => r.status === 'cancelled' || r.status === 'completed').length || 0,
                diasProtegidos: daysProtected,
                fechas: Array.from(uniqueDaysBefore)
            });

            // 🎯 PASO 2: Ejecutar borrado
            const { data, error } = await supabase.rpc('borrar_disponibilidades_simple', {
                p_business_id: businessId
            });

            if (error) {
                console.error('❌ Error borrando:', error);
                throw error;
            }

            console.log('🗑️ Resultado borrado:', data);

            toast.dismiss('cleanup');

            if (data?.success) {
                // Limpiar estado local
                setGenerationSuccess(null);
                setAvailabilityStats(null);
                setAvailabilityGrid([]);
                
                try {
                    localStorage.removeItem(`generationSuccess_${businessId}`);
                } catch (error) {
                    console.warn('No se pudo limpiar localStorage:', error);
                }

                // 🎯 PASO 3: Recargar stats
                await loadAvailabilityStats();
                await loadDayStats(); // 📊 Recargar estadísticas de días

                // Total de días en el período
                const totalDays = advanceDays;
                
                // Días eliminados = Total - Protegidos
                const daysDeleted = totalDays - daysProtected;

                const duration = businessesettings?.reservation_duration || 60;
                const endDateFormatted = format(addDays(new Date(), advanceDays), 'dd/MM/yyyy');

                // Mostrar modal con terminología de DÍAS
                console.log('🎯 MOSTRANDO MODAL DE RESULTADO - BORRAR');
                setRegenerationResult({
                    type: 'delete',
                    totalDays: totalDays,
                    daysProtected: daysProtected,
                    daysAvailable: daysDeleted, // Días eliminados
                    activeReservations: activeReservations,
                    period: `HOY hasta ${endDateFormatted} (${advanceDays} días)`,
                    duration: `${duration} min por reserva`
                });
                setShowRegenerationModal(true);
                console.log('✅ Modal de resultado activado');

            } else {
                throw new Error(data?.error || 'Error desconocido');
            }

        } catch (error) {
            console.error('Error borrando disponibilidades:', error);
            toast.dismiss('cleanup');
            toast.error('❌ Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 🛡️ VALIDAR RESERVAS EN DÍAS QUE SE QUIEREN CERRAR
    const validateReservationsOnClosedDays = async (operatingHours) => {
        try {
            // 1. Detectar días que están marcados como cerrados
            const closedDays = [];
            const dayMap = {
                'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
                'friday': 5, 'saturday': 6, 'sunday': 0
            };
            
            Object.entries(operatingHours).forEach(([day, hours]) => {
                if (hours.closed) {
                    closedDays.push({
                        day,
                        dayNumber: dayMap[day],
                        displayName: day.charAt(0).toUpperCase() + day.slice(1)
                    });
                }
            });
            
            if (closedDays.length === 0) {
                return { valid: true, conflicts: [] };
            }
            
            console.log('🔍 Días marcados como cerrados:', closedDays);
            
            // 2. Buscar reservas activas en esos días de la semana
            const { data: reservations, error } = await supabase
                .from('appointments')
                .select('id, customer_name, customer_phone, appointment_date, appointment_time, party_size, status')
                .eq('business_id', businessId)
                .in('status', ['pending', 'confirmed', 'pending_approval'])
                .gte('appointment_date', format(new Date(), 'yyyy-MM-dd'));
            
            if (error) throw error;
            
            console.log('📋 Reservas activas encontradas:', reservations?.length || 0);
            console.log('📋 Detalle de reservas:', reservations);
            
            // 3. Filtrar reservas que caen en días cerrados y agrupar por fecha
            const conflictingReservations = [];
            closedDays.forEach(closedDay => {
                const dayReservations = reservations.filter(r => {
                    // Usar parseISO para evitar problemas de zona horaria
                    const reservationDate = new Date(r.reservation_date + 'T00:00:00');
                    const reservationDay = reservationDate.getDay();
                    console.log(`🔍 Reserva ${r.id}: fecha=${r.reservation_date}, día=${reservationDay}, buscando=${closedDay.dayNumber}`);
                    return reservationDay === closedDay.dayNumber;
                });
                
                console.log(`🔍 Día ${closedDay.displayName} (${closedDay.dayNumber}): ${dayReservations.length} reservas`);
                
                if (dayReservations.length > 0) {
                    // Agrupar por fecha específica (sin duplicados)
                    const uniqueDates = [...new Set(dayReservations.map(r => r.reservation_date))];
                    uniqueDates.forEach(date => {
                        const reservationsForDate = dayReservations.filter(r => r.reservation_date === date);
                        conflictingReservations.push({
                            day: closedDay.day,
                            displayName: closedDay.displayName,
                            date: date, // ✅ FECHA ESPECÍFICA
                            reservations: reservationsForDate
                        });
                    });
                }
            });
            
            console.log('⚠️ Conflictos encontrados:', conflictingReservations);
            
            return {
                valid: conflictingReservations.length === 0,
                conflicts: conflictingReservations,
                closedDays
            };
            
        } catch (error) {
            console.error('❌ Error validando reservas:', error);
            return { valid: false, conflicts: [], error: error.message };
        }
    };

    // 🔒 REGLA SAGRADA: NUNCA ELIMINAR RESERVAS
    // Esta función SOLO regenera availability_slots PROTEGIENDO reservas existentes
    // Las reservas son SAGRADAS y solo se eliminan manualmente desde Reservas.jsx
    const smartRegeneration = async (changeType = 'general', changeData = {}) => {
        if (!businessId) {
            toast.error('❌ No se encontró el ID del restaurante');
            return;
        }

        // 🔄 SIEMPRE recargar settings desde Supabase para tener los horarios actualizados
        console.log('🔄 Recargando settings desde Supabase antes de validar...');
        const { data: freshSettings, error: settingsError } = await supabase
            .from('businesses')
            .select('settings')
            .eq('id', businessId)
            .single();
        
        if (settingsError) {
            console.error('❌ Error recargando settings:', settingsError);
            toast.error('❌ Error al verificar configuración del restaurante');
            return;
        }
        
        const currentSettings = freshSettings?.settings || businessesettings;
        console.log('🔍 Settings actualizados:', currentSettings);
        console.log('🔍 Operating hours que se usarán en regeneración:', currentSettings?.operating_hours);

        // 🔒 NO VALIDAR - La función SQL ya protege los días con reservas
        console.log('✅ Procediendo con regeneración (protección en SQL)');

        try {
            setLoading(true);
            toast.loading('Regeneración inteligente en proceso...', { id: 'smart-generating' });
            
            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = businessesettings?.advance_booking_days || 30;
            const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');


            // Usar generate_availability_slots_employee_based (función que existe)
            // Calcular días a generar
            const startDateObj = new Date(today);
            const endDateObj = new Date(endDate);
            const daysToGenerate = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
            
            // Parámetros correctos: p_business_id, p_start_date, p_days_ahead, p_regenerate
            const { data, error } = await supabase.rpc('generate_availability_slots_employee_based', {
                p_business_id: businessId,
                p_start_date: today,
                p_days_ahead: daysToGenerate,
                p_regenerate: true // Regenerar slots existentes
            });

            if (error) {
                console.error('❌ Error en regeneración inteligente:', error);
                throw error;
            }

            // Verificar si la respuesta es exitosa
            if (data && typeof data === 'object') {
                if (data.success === false) {
                    console.error('❌ Error en la función:', data.error);
                    throw new Error(data.error || 'Error regenerando disponibilidades');
                }
            }

            toast.dismiss('smart-generating');
            
            // Mostrar resultados detallados
            const results = data; // RPC devuelve objeto directo
            const duration = businessesettings?.reservation_duration || 90;
            const endDateFormatted = format(addDays(new Date(), advanceDays), 'dd/MM/yyyy');
            
            console.log('🔍 Resultado de regeneración:', results);
            
            // La función RPC puede devolver un array o un objeto
            const resultData = Array.isArray(results) ? results[0] : results;
            
            // Actualizar estado local con datos correctos
            // La función puede devolver diferentes formatos según la versión
            const slotsCreated = resultData?.slots_created || resultData?.total_slots_generated || 0;
            const slotsMarked = resultData?.slots_marked || 0;
            const daysProtected = resultData?.days_protected || resultData?.days_processed || 0;
            
            console.log('📊 Datos extraídos del resultado:', {
                slotsCreated,
                slotsMarked,
                daysProtected,
                rawResult: results,
                processedResult: resultData
            });
            
            const successData = {
                slotsCreated: slotsCreated,
                dateRange: `HOY hasta ${endDateFormatted}`,
                duration: duration,
                buffer: 15,
                timestamp: new Date().toLocaleString(),
                smartRegeneration: true,
                action: results?.action || 'regeneración_completada',
                message: results?.message || 'Regeneración completada correctamente'
            };
            
            setGenerationSuccess(successData);
            
            // Guardar en localStorage
            try {
                localStorage.setItem(`generationSuccess_${businessId}`, JSON.stringify(successData));
            } catch (error) {
                console.warn('No se pudo guardar en localStorage:', error);
            }
            
            // 🔒 RECARGAR ESTADÍSTICAS INMEDIATAMENTE
            console.log('🔄 Recargando estadísticas después de regenerar...');
            
            // Esperar un momento para que la BD se actualice completamente
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Recargar TODAS las estadísticas en paralelo
            await Promise.all([
                loadAvailabilityStats(),
                loadDayStats() // 📊 Recargar estadísticas de días
            ]);
            
            // Esperar un poco más y forzar recarga adicional
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Recargar de nuevo para asegurar que los datos se reflejen
            await loadDayStats();
            
            // Si hay una fecha seleccionada, recargar también esa vista
            if (selectedDate) {
                console.log('🔄 Recargando vista de día específico:', selectedDate);
                await loadDayAvailability(selectedDate);
            }
            
            console.log('✅ Estadísticas recargadas');
            
            // 🎯 CALCULAR DÍAS Y RESERVAS REALES
            
            console.log('🔍 QUERY PARAMETERS:', {
                today,
                endDate,
                advanceDays,
                businessId
            });
            
            // Obtener TODAS las reservas primero (para debug)
            const { data: allReservations } = await supabase
                .from('appointments')
                .select('id, appointment_date, status, customer_name')
                .eq('business_id', businessId);

            console.log('📊 TODAS las reservas del restaurante:', allReservations);
            
            // TODAS las reservas en el rango (sin filtrar por status)
            const { data: reservationsData, error: reservationsError } = await supabase
                .from('appointments')
                .select('id, appointment_date, status, customer_name')
                .eq('business_id', businessId)
                .gte('appointment_date', today)
                .lte('appointment_date', endDate);

            if (reservationsError) {
                console.error('❌ Error consultando reservas:', reservationsError);
            }

            console.log('📊 TODAS las reservas consultadas:', reservationsData);

            // ✅ FILTRAR: Solo contar las ACTIVAS (excluir cancelled y completed)
            // Mapear appointment_date a reservation_date para compatibilidad
            const activeReservationsArray = (reservationsData?.filter(r => 
                r.status !== 'cancelled' && r.status !== 'completed'
            ) || []).map(r => ({ ...r, reservation_date: r.appointment_date }));

            const activeReservations = activeReservationsArray.length;
            
            // Contar días únicos con reservas ACTIVAS (días protegidos)
            const uniqueDays = new Set(
                activeReservationsArray.map(r => r.reservation_date)
            );
            const daysProtectedCount = uniqueDays.size;

            // Total de días en el período
            const totalDays = advanceDays;
            
            // Días regenerados = Total - Protegidos
            const daysRegenerated = totalDays - daysProtectedCount;
            
            console.log('📊 Estadísticas REALES para modal (SOLO ACTIVAS):', {
                totalDays,
                daysProtectedCount,
                daysRegenerated,
                reservasActivas: activeReservations,
                reservasCanceladas: reservationsData?.filter(r => r.status === 'cancelled' || r.status === 'completed').length || 0,
                fechasProtegidas: Array.from(uniqueDays)
            });
            
            // 🎯 Mostrar modal con terminología de DÍAS
            console.log('🎯 MOSTRANDO MODAL DE RESULTADO - REGENERAR');
            setRegenerationResult({
                type: 'regenerate',
                totalDays: totalDays,
                daysProtected: daysProtectedCount,
                daysAvailable: daysRegenerated, // Días regenerados
                activeReservations: activeReservations,
                period: `HOY hasta ${endDateFormatted} (${advanceDays} días)`,
                duration: `${duration} min por reserva`
            });
            setShowRegenerationModal(true);

            // ✅ LIMPIAR FLAG DE REGENERACIÓN REQUERIDA
            changeDetection.clearRegenerationFlag();
            console.log('✅ Flag de regeneración limpiado');
            console.log('✅ Modal de resultado activado');

        } catch (error) {
            console.error('Error en regeneración inteligente:', error);
            toast.dismiss('smart-generating');
            toast.error('❌ Error en regeneración inteligente: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 🚨 AUTO-TRIGGER: Mostrar modal de confirmación si viene desde cambio de horarios (SOLO UNA VEZ POR SESIÓN)
    useEffect(() => {
        // ✅ FIX: Verificar también needsRegeneration para evitar modal repetido sin cambios pendientes
        if (autoTriggerRegeneration && 
            businessId && 
            !loading && 
            !autoTriggerShown && 
            changeDetection.needsRegeneration) {
            
            console.log('🚨 AUTO-TRIGGER: Mostrando modal de confirmación (PRIMERA VEZ)...');
            
            // Pequeño delay para que el componente termine de montar
            const timer = setTimeout(async () => {
                await handleShowRegenerateModal(); // Preparar datos y mostrar modal
                setAutoTriggerShown(true); // 🔒 MARCAR COMO MOSTRADO para no repetir
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoTriggerRegeneration, businessId, loading, autoTriggerShown, changeDetection.needsRegeneration]);

    // 🔒 REGLA SAGRADA: NUNCA ELIMINAR RESERVAS
    // Esta función SOLO genera availability_slots - JAMÁS toca la tabla 'reservations'
    // Las reservas son SAGRADAS y solo se eliminan manualmente desde Reservas.jsx
    const generateAvailability = async () => {
        // 🔒 Evitar ejecución doble
        if (validationExecuted) {
            console.log('⚠️ Validación ya ejecutada, saltando...');
            return;
        }
        
        try {
            setValidationExecuted(true); // Marcar como ejecutado
            setLoading(true);
            toast.loading('Generando tabla de disponibilidades...', { id: 'generating' });

            // 1. VALIDAR RESERVAS EN DÍAS CERRADOS (igual que smartRegeneration)
            console.log('🛡️ Validando reservas existentes antes de generar...');
            const { data: restaurantData, error: settingsError } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', businessId)
                .single();

            if (!settingsError && restaurantData?.settings?.operating_hours) {
                const validation = await validateReservationsOnClosedDays(restaurantData.settings.operating_hours);
                
                if (!validation.valid && validation.conflicts.length > 0) {
                    console.log('⚠️ CONFLICTOS DETECTADOS - Mostrando modal informativo:', validation.conflicts);
                    toast.dismiss('generating');
                    
                    // Mostrar modal informativo
                    setConflictData({
                        conflicts: validation.conflicts,
                        closedDays: validation.closedDays,
                        isGenerating: true // Flag para saber que viene de generateAvailability
                    });
                    setShowConflictModal(true);
                    return; // Esperar a que el usuario confirme en el modal
                }
            }

            // 2. Detectar conflictos si se va a sobrescribir
            if (generationSettings.overwriteExisting) {
                const conflicts = await detectConflicts(
                    generationSettings.startDate,
                    generationSettings.endDate
                );

                if (conflicts > 0 && !confirm(
                    `⚠️ ATENCIÓN: Se encontraron ${conflicts} reservas confirmadas en este período.\n\n` +
                    `Si continúas, podrías afectar reservas existentes.\n\n` +
                    `¿Estás seguro de que quieres continuar?`
                )) {
                    toast.dismiss('generating');
                    return;
                }
            }

            // 3. CARGAR POLÍTICA DE RESERVAS REAL ANTES DE GENERAR
            console.log('📋 Cargando política de reservas REAL...');
            const { useReservationStore } = await import('../stores/reservationStore.js');
            
            // Declarar variables fuera del try para usarlas después
            let advanceDays, duration, today, endDate;
            
            try {
                await useReservationStore.getState().loadReservationPolicy(businessId);
                const settings = useReservationStore.getState().settings;
                console.log('✅ Política cargada:', settings);
                
                // Usar valores REALES de la política
                advanceDays = settings.maxAdvanceBooking;
                duration = settings.slotDuration;
                
                if (!advanceDays || !duration) {
                    throw new Error('Política de reservas incompleta - faltan datos obligatorios');
                }
                
                today = format(new Date(), 'yyyy-MM-dd');
                endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');
                
                console.log('🎯 Usando política REAL:', {
                    advanceDays,
                    duration,
                    startDate: today,
                    endDate
                });
                
            } catch (policyError) {
                console.error('❌ Error cargando política de reservas:', policyError);
                toast.error('Error: No se pudo cargar la política de reservas. Verifica la configuración.');
                toast.dismiss('generating');
                return;
            }
            
            // Verificar si hay mesas activas
            const { data: tablesData, error: tablesError } = await supabase
                .from('resources')
                .select('id, name, capacity, is_active')
                .eq('business_id', businessId)
                .eq('is_active', true);
            
            if (!tablesData || tablesData.length === 0) {
                toast.error('❌ No hay mesas activas. Añade mesas antes de generar disponibilidades.');
                toast.dismiss('generating');
                return;
            }
            
            // USAR FUNCIÓN SIMPLIFICADA (sin turnos)
            // Si no hay businessId, pasar null para que la función lo detecte
            const { data, error } = await supabase.rpc('generate_availability_slots_simple', {
                p_business_id: businessId || null,
                p_start_date: today,
                p_end_date: endDate
            });

            if (error) {
                console.error('❌ Error en generate_availability_slots:', error);
                toast.dismiss('generating');
                
                // Mostrar error técnico si lo hay
                const errorMsg = error.message || error.hint || 'Error desconocido';
                toast.error(
                    `❌ Error al generar horarios de reserva\n\n` +
                    `🔍 Motivo: ${errorMsg}\n\n` +
                    '📋 Verifica que:\n' +
                    '• Tienes horarios de apertura configurados\n' +
                    '• Hay días abiertos en el calendario\n' +
                    '• La política de reservas está completa\n' +
                    '• Tienes mesas activas\n\n' +
                    '🔧 Revisa: Configuración → Horarios y Política de Reservas',
                    { duration: 10000 }
                );
                setLoading(false);
                return;
            }
            
            // Verificar si la respuesta es exitosa
            if (data && typeof data === 'object') {
                if (data.success === false) {
                    console.error('❌ Error en la función:', data);
                    toast.dismiss('generating');
                    
                    // 🎯 MOSTRAR EL MOTIVO EXACTO DEL ERROR
                    const errorReason = data.error || 'Error desconocido';
                    const errorHint = data.hint || '';
                    
                    let helpMessage = '\n\n📋 Verifica que:\n';
                    
                    // Personalizar mensaje según el error
                    if (errorReason.includes('mesas')) {
                        helpMessage += '• Tienes al menos una mesa activa\n' +
                                      '🔧 Ve a: Mesas → Crear nueva mesa';
                    } else if (errorReason.includes('horario') || errorReason.includes('cerrado')) {
                        helpMessage += '• Tienes horarios de apertura configurados\n' +
                                      '• Hay días abiertos en el calendario\n' +
                                      '🔧 Ve a: Configuración → Horarios o Calendario';
                    } else if (errorReason.includes('política') || errorReason.includes('reservas')) {
                        helpMessage += '• La política de reservas está completa\n' +
                                      '• Los días de antelación están configurados\n' +
                                      '🔧 Ve a: Configuración → Política de Reservas';
                    } else {
                        helpMessage += '• Horarios de apertura configurados\n' +
                                      '• Días abiertos en el calendario\n' +
                                      '• Política de reservas completa\n' +
                                      '• Mesas activas creadas\n' +
                                      '🔧 Revisa: Configuración → Horarios, Calendario y Mesas';
                    }
                    
                    toast.error(
                        `❌ No se pudieron generar horarios de reserva\n\n` +
                        `🔍 Motivo: ${errorReason}` +
                        (errorHint ? `\n💡 Sugerencia: ${errorHint}` : '') +
                        helpMessage,
                        { duration: 12000 }
                    );
                    setLoading(false);
                    return;
                }
            }
            
            // 🔍 DEBUG: Ver exactamente qué devuelve la función SQL
            console.log('🔍 DEBUG RESULTADO SQL:');
            console.log('   📊 data completo:', data);
            console.log('   📊 success:', data?.success);
            console.log('   📊 stats:', data?.stats);
            console.log('   📊 config:', data?.config);

            toast.dismiss('generating');
            
            // Verificar el resultado
            if (!data || !data.success) {
                const errorMessage = data?.error || 'Error desconocido';
                toast.error(`❌ ${errorMessage}`);
                return;
            }
            
            // Extraer estadísticas directamente de la respuesta SQL
            const slotsCreated = data.slots_created || 0;
            const tableCount = data.table_count || 0;
            const policyApplied = data.policy_applied || {};
            const durationMinutes = policyApplied.reservation_duration || 90;
            
            // Valores por defecto para campos que la función SQL no devuelve
            const slotsSkipped = 0;
            const daysProcessed = advanceDays || 7;
            const daysClosed = 0;
            const dateRange = { end: endDate };
            
            const endDateFormatted = dateRange.end ? format(new Date(dateRange.end), 'dd/MM/yyyy') : format(addDays(new Date(), advanceDays), 'dd/MM/yyyy');
            
            let summaryMessage = '';
            
            if (slotsCreated === 0 && slotsSkipped === 0) {
                // 🚨 NO SE GENERARON SLOTS - MOSTRAR MODAL DE ADVERTENCIA
                const reasonData = {
                    daysProcessed,
                    daysClosed,
                    tableCount,
                    slotsSkipped,
                    endDate: endDateFormatted,
                    allClosed: daysClosed === daysProcessed
                };
                
                setNoSlotsReason(reasonData);
                setShowNoSlotsModal(true);
                toast.dismiss('generating');
            } else {
                // Se generaron slots exitosamente
                summaryMessage = `✅ ${slotsCreated} slots creados | ${tableCount} mesas | Hasta ${endDateFormatted}`;
                
                toast.success('✅ Disponibilidades generadas correctamente');
            }

            // 🔒 VERIFICAR DATOS REALES POST-GENERACIÓN
            console.log('📊 Verificando resultado de generación...');
            
            // Contar slots totales actuales
            const { count: totalSlotsCount, error: countError } = await supabase
                .from('availability_slots')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .gte('slot_date', format(new Date(), 'yyyy-MM-dd'));
            
            const totalSlots = countError ? 0 : (totalSlotsCount || 0);
            
            console.log('📊 Total de slots en el sistema:', totalSlots);
            console.log('📊 Respuesta de función SQL:', data);
            
            const successData = {
                slotsCreated: slotsCreated,
                slotsSkipped: slotsSkipped,
                dateRange: `HOY hasta ${endDateFormatted}`,
                duration: duration,
                tableCount: tableCount,
                daysProcessed: daysProcessed,
                daysClosed: daysClosed,
                timestamp: new Date().toLocaleString(),
                totalSlots: totalSlots
            };
            
            // Persistir éxito
            setGenerationSuccess(successData);
            localStorage.setItem(`generationSuccess_${businessId}`, JSON.stringify(successData));
            
            // NO mostrar toast adicional - ya se mostró arriba
            
            setGenerationSuccess(successData);
            
            // Guardar en localStorage para persistencia
            try {
                localStorage.setItem(`generationSuccess_${businessId}`, JSON.stringify(successData));
            } catch (error) {
                // Silencioso - no es crítico
            }
            
            // 🔒 RECARGAR ESTADÍSTICAS INMEDIATAMENTE
            console.log('🔄 Recargando estadísticas después de generar...');
            
            // Esperar un momento para que la BD se actualice completamente
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Recargar TODAS las estadísticas en paralelo
            await Promise.all([
                loadAvailabilityStats(),
                loadDayStats() // 📊 Recargar estadísticas de días
            ]);
            
            // Esperar un poco más y forzar recarga adicional
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Recargar de nuevo para asegurar que los datos se reflejen
            await loadDayStats();
            
            // Si hay una fecha seleccionada, recargar también esa vista
            if (selectedDate) {
                console.log('🔄 Recargando vista de día específico:', selectedDate);
                await loadDayAvailability(selectedDate);
            }
            
            console.log('✅ Estadísticas recargadas');
            
            // 🎯 Obtener estadísticas REALES
            const reservationStore2 = await import('../stores/reservationStore.js');
            const realStats = await reservationStore2.useReservationStore.getState().getAvailabilityStats(businessId);
            
            // 🎯 Mostrar modal con datos REALES
            setRegenerationResult({
                action: 'generación_completada',
                slotsCreated: data?.slots_created || 0,
                slotsMarked: realStats?.reserved || 0,
                daysProtected: data?.days_protected || 0, // REAL del SQL
                totalSlots: realStats?.total || 0,
                availableSlots: realStats?.free || 0,
                message: data?.message || 'Disponibilidades generadas correctamente',
                period: `${today} hasta ${endDate}`,
                duration: `${duration} min por reserva`
            });
            setShowRegenerationModal(true);

        } catch (error) {
            console.error('Error generando disponibilidades:', error);
            toast.dismiss('generating');
            toast.error('❌ Error: ' + error.message);
        } finally {
            setLoading(false);
            setValidationExecuted(false); // Reset para permitir siguiente ejecución
        }
    };

    // Limpiar disponibilidades
    // 🧹 SOLO LIMPIEZA: Elimina slots sin reservas, preserva con reservas, NO regenera
    const smartCleanupOnly = async () => {
        if (!businessId) {
            toast.error('❌ Falta ID del restaurante');
            return;
        }

        const confirmed = confirm(
            '🧹 SOLO LIMPIEZA INTELIGENTE\n\n' +
            '✅ ACCIONES:\n' +
            '• Eliminará slots SIN reservas\n' +
            '• Preservará slots CON reservas confirmadas\n' +
            '• NO generará slots nuevos\n\n' +
            '🛡️ Las reservas confirmadas están 100% protegidas\n' +
            '📊 Resultado: Si no hay reservas → 0 slots\n\n' +
            '¿Continuar con la limpieza?'
        );

        if (!confirmed) return;

        try {
            setLoading(true);
            toast.loading('🧹 Limpieza inteligente...', { id: 'smart-cleanup-only' });

            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = businessesettings?.advance_booking_days || 30;
            const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');

            console.log('🧹 SOLO LIMPIEZA INTELIGENTE:');
            console.log('   📅 Período:', today, 'hasta', endDate);

            const { data, error } = await supabase.rpc('smart_cleanup_availability', {
                p_business_id: businessId,
                p_start_date: today,
                p_end_date: endDate
            });

            if (error) {
                console.error('❌ Error en limpieza:', error);
                throw error;
            }

            console.log('🧹 Resultado limpieza:', data);

            toast.dismiss('smart-cleanup-only');

            if (data?.success) {
                const slotsDeleted = data?.slots_deleted || 0;
                const slotsPreserved = data?.slots_preserved || 0;
                const slotsAfter = data?.slots_after || 0;

                toast.success('✅ Limpieza completada correctamente');

                // Limpiar estado local completamente
                setGenerationSuccess(null);
                setAvailabilityStats(null);
                setAvailabilityGrid([]);
                
                // Limpiar localStorage
                try {
                    localStorage.removeItem(`generationSuccess_${businessId}`);
                } catch (error) {
                    console.warn('No se pudo limpiar localStorage:', error);
                }

                // Recargar stats reales
                await loadAvailabilityStats();
                await loadDayStats(); // 📊 Recargar estadísticas de días
                
                // 🎯 Obtener estadísticas REALES de la BD
                const reservationStore4 = await import('../stores/reservationStore.js');
                const realStats = await reservationStore4.useReservationStore.getState().getAvailabilityStats(businessId);
                
                // Mostrar modal con datos REALES
                setRegenerationResult({
                    action: 'limpieza_simple',
                    slotsCreated: 0, // Correcto: en limpieza no se crean
                    slotsMarked: realStats?.reserved || 0, // REAL de BD
                    daysProtected: data?.days_protected || 0, // REAL del SQL
                    slotsDeleted: slotsDeleted,
                    totalSlots: realStats?.total || 0,
                    availableSlots: realStats?.free || 0,
                    message: `${slotsDeleted} slots eliminados (sin reservas). ${realStats?.reserved || 0} slots preservados (con reservas). ${slotsAfter === 0 ? 'Tabla limpia - Sin disponibilidades.' : 'Solo reservas confirmadas preservadas.'}`,
                    period: 'Limpieza simple',
                    duration: `${realStats?.total || 0} slots totales`
                });
                setShowRegenerationModal(true);

            } else {
                throw new Error(data?.error || 'Error desconocido en limpieza');
            }

        } catch (error) {
            console.error('Error en limpieza:', error);
            toast.dismiss('smart-cleanup-only');
            toast.error('❌ Error en limpieza: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 🔄 LIMPIEZA + REGENERACIÓN: Elimina slots sin reservas, preserva con reservas, regenera nuevos
    const smartCleanupAndRegenerate = async () => {
        if (!businessId || !businessesettings) {
            toast.error('❌ Faltan datos de configuración');
            return;
        }

        const confirmed = confirm(
            '🧠 LIMPIEZA INTELIGENTE + REGENERACIÓN\n\n' +
            '✅ ACCIONES SEGURAS:\n' +
            '• Eliminará slots SIN reservas\n' +
            '• Preservará slots CON reservas confirmadas\n' +
            '• Generará nuevos slots según configuración actual\n\n' +
            '🛡️ Las reservas confirmadas están 100% protegidas\n\n' +
            '¿Continuar con la limpieza inteligente?'
        );

        if (!confirmed) return;

        try {
            setLoading(true);
            toast.loading('🧠 Limpieza inteligente + regeneración...', { id: 'smart-cleanup' });

            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = businessesettings?.advance_booking_days || 30;
            const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');
            const duration = businessesettings?.reservation_duration || 90;

            console.log('🧠 LIMPIEZA + REGENERACIÓN INTELIGENTE:');
            console.log('   📅 Período:', today, 'hasta', endDate);
            console.log('   🕒 Duración:', duration, 'minutos');

            // Calcular días a generar
            const startDateObj = new Date(today);
            const endDateObj = new Date(endDate);
            const daysToGenerate = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
            
            let data, error;
            
            // Usar generate_availability_slots_employee_based con parámetros correctos
            // Parámetros: p_business_id, p_start_date, p_days_ahead, p_regenerate
            const result1 = await supabase.rpc('generate_availability_slots_employee_based', {
                p_business_id: businessId,
                p_start_date: today,
                p_days_ahead: daysToGenerate,
                p_regenerate: true
            });
            
            data = result1.data;
            error = result1.error;

            if (error) {
                console.error('❌ Error en limpieza inteligente:', error);
                throw error;
            }
            
            // Verificar si la respuesta es exitosa
            if (data && typeof data === 'object') {
                if (data.success === false) {
                    console.error('❌ Error en la función:', data.error);
                    throw new Error(data.error || 'Error en limpieza y regeneración');
                }
            }

            console.log('🧠 Resultado limpieza inteligente:', data);

            toast.dismiss('smart-cleanup');

            if (data?.success) {
                // Extraer datos del resultado anidado
                const cleanup = data.cleanup || {};
                const generation = data.generation || {};
                const stats = generation.stats || {};
                
                const slotsCreated = stats.slots_created || 0;
                const slotsDeleted = cleanup.slots_deleted || 0;
                const slotsPreserved = cleanup.slots_preserved || 0;

                toast.success('✅ Limpieza inteligente completada correctamente');

                // Actualizar estado local con datos reales
                const successData = {
                    slotsCreated: slotsCreated,
                    dateRange: `HOY hasta ${format(addDays(new Date(), advanceDays), 'dd/MM/yyyy')}`,
                    duration: duration,
                    buffer: 15,
                    timestamp: new Date().toLocaleString(),
                    totalAvailable: slotsCreated - reservationsProtected,
                    totalOccupied: 0,
                    totalReserved: reservationsProtected,
                    smartCleanup: true
                };

                setGenerationSuccess(successData);

                // Guardar en localStorage
                try {
                    localStorage.setItem(`generationSuccess_${businessId}`, JSON.stringify(successData));
                } catch (error) {
                    console.warn('No se pudo guardar en localStorage:', error);
                }

                // Solo cargar el grid
                setTimeout(async () => {
                    await loadAvailabilityGrid();
                }, 500);

            } else {
                throw new Error(data?.error || 'Error desconocido en limpieza inteligente');
            }

        } catch (error) {
            console.error('Error en limpieza inteligente:', error);
            toast.dismiss('smart-cleanup');
            toast.error('❌ Error en limpieza inteligente: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Cargar vista detallada de disponibilidades
    const loadAvailabilityGrid = async () => {
        try {
            const { data, error } = await supabase
                .from('availability_slots')
                .select(`
                    id,
                    slot_date,
                    start_time,
                    end_time,
                    status,
                    table_id,
                    tables(name, capacity, zone)
                `)
                .eq('business_id', businessId)
                .gte('slot_date', generationSettings.startDate)
                .lte('slot_date', generationSettings.endDate)
                .order('slot_date', { ascending: true })
                .order('start_time', { ascending: true });

            if (error) throw error;

            // Agrupar por fecha y mesa
            const grouped = {};
            data?.forEach(slot => {
                const dateKey = slot.slot_date;
                if (!grouped[dateKey]) {
                    grouped[dateKey] = {};
                }
                
                const tableKey = slot.tables.name;
                if (!grouped[dateKey][tableKey]) {
                    grouped[dateKey][tableKey] = {
                        table: slot.tables,
                        slots: []
                    };
                }
                
                grouped[dateKey][tableKey].slots.push(slot);
            });

            setAvailabilityGrid(grouped);
        } catch (error) {
            console.error('Error cargando vista detallada:', error);
        }
    };

    // Cargar disponibilidades de un día específico - CONSULTA DIRECTA A SUPABASE
    const loadDayAvailability = async (date) => {
        try {
            setLoadingDayView(true);
            
            console.log('🔍 CONSULTANDO DIRECTAMENTE EN SUPABASE para:', {
                business_id: businessId,
                date: date
            });
            
            // 🔍 DIAGNÓSTICO: Primero verificar si hay slots en absoluto (sin filtros)
            const { data: allSlots, error: diagnosticError } = await supabase
                .from('availability_slots')
                .select('id, business_id, slot_date')
                .limit(10);
            
            console.log('🔍 DIAGNÓSTICO - Slots en la tabla (sin filtros):', {
                encontrados: allSlots?.length || 0,
                error: diagnosticError,
                muestra: allSlots?.slice(0, 3),
                businessIds: [...new Set(allSlots?.map(s => s.business_id) || [])]
            });
            
            // ✅ CONSULTA DIRECTA - Ir directamente a la tabla availability_slots
            const { data: slotsData, error: slotsError } = await supabase
                .from('availability_slots')
                .select(`
                    id,
                    slot_date,
                    start_time,
                    end_time,
                    status,
                    is_available,
                    duration_minutes,
                    resource_id,
                    business_id
                `)
                .eq('business_id', businessId)
                .eq('slot_date', date)
                .order('start_time', { ascending: true });
            
            console.log('📊 RESULTADO CONSULTA DIRECTA:', {
                encontrados: slotsData?.length || 0,
                error: slotsError,
                datos: slotsData,
                businessIdBuscado: businessId,
                fechaBuscada: date
            });
            
            // Si no encuentra con fecha exacta, buscar en un rango
            if ((!slotsData || slotsData.length === 0) && !slotsError) {
                console.log('🔍 No se encontraron slots para fecha exacta, buscando en rango...');
                const { data: rangeData } = await supabase
                    .from('availability_slots')
                    .select('id, slot_date, start_time, business_id')
                    .eq('business_id', businessId)
                    .gte('slot_date', format(addDays(new Date(date), -7), 'yyyy-MM-dd'))
                    .lte('slot_date', format(addDays(new Date(date), 7), 'yyyy-MM-dd'))
                    .limit(20);
                
                console.log('🔍 Slots encontrados en rango ±7 días:', {
                    encontrados: rangeData?.length || 0,
                    fechas: [...new Set(rangeData?.map(s => s.slot_date) || [])]
                });
            }
            
            if (slotsError) {
                console.error('❌ Error en consulta directa:', slotsError);
                throw slotsError;
            }
            
            // Si no hay slots, mostrar mensaje
            if (!slotsData || slotsData.length === 0) {
                console.warn('⚠️ No se encontraron slots para la fecha:', date);
                setDayAvailability({
                    'SIN DISPONIBILIDADES': [{
                        id: 'no-slots',
                        start_time: '❌',
                        message: 'No hay disponibilidades generadas para este día. Verifica que haya empleados activos con horarios configurados.',
                        isEmpty: true
                    }]
                });
                setLoadingDayView(false);
                return;
            }
            
            console.log(`✅ ${slotsData.length} slots encontrados para ${date}`);
            
            // Obtener información de recursos y empleados
            const resourceIds = [...new Set(slotsData.map(s => s.resource_id).filter(Boolean))];
            let resourcesMap = {};
            let employeesMap = {};
            
            if (resourceIds.length > 0) {
                // Obtener recursos
                const { data: resourcesData } = await supabase
                    .from('resources')
                    .select('id, name, capacity')
                    .in('id', resourceIds);
                
                if (resourcesData) {
                    resourcesMap = resourcesData.reduce((acc, r) => {
                        acc[r.id] = r;
                        return acc;
                    }, {});
                }
                
                // Obtener empleados que tienen estos recursos asignados
                const { data: employeesData } = await supabase
                    .from('employees')
                    .select('id, name, assigned_resource_id, position_order')
                    .eq('business_id', businessId)
                    .eq('is_active', true)
                    .in('assigned_resource_id', resourceIds);
                
                if (employeesData) {
                    employeesMap = employeesData.reduce((acc, e) => {
                        if (e.assigned_resource_id) {
                            acc[e.assigned_resource_id] = e;
                        }
                        return acc;
                    }, {});
                }
            }
            
            // ✅ AGRUPAR POR EMPLEADO (no por recurso)
            const groupedByEmployee = {};
            
            slotsData.forEach(slot => {
                const resource = resourcesMap[slot.resource_id];
                const employee = slot.resource_id ? employeesMap[slot.resource_id] : null;
                
                // Si hay empleado, agrupar por empleado. Si no, agrupar por "Sin asignar"
                const employeeKey = employee 
                    ? employee.name 
                    : resource 
                        ? `Sin empleado - ${resource.name}` 
                        : 'Sin asignar';
                
                if (!groupedByEmployee[employeeKey]) {
                    groupedByEmployee[employeeKey] = {
                        employee_id: employee?.id || null,
                        employee_name: employee?.name || null,
                        resource_name: resource?.name || null,
                        resource_id: slot.resource_id,
                        slots: []
                    };
                }
                
                groupedByEmployee[employeeKey].slots.push({
                    ...slot,
                    resource_name: resource?.name || null,
                    resource_capacity: resource?.capacity || null,
                    employee_name: employee?.name || null,
                    has_appointment: slot.status !== 'free' && slot.status !== 'available',
                    isEmpty: false
                });
            });
            
            // Ordenar empleados por position_order
            const sortedEmployees = Object.entries(groupedByEmployee).sort((a, b) => {
                const empA = employeesMap[groupedByEmployee[a[0]].resource_id];
                const empB = employeesMap[groupedByEmployee[b[0]].resource_id];
                const orderA = empA?.position_order ?? 999;
                const orderB = empB?.position_order ?? 999;
                return orderA - orderB;
            });
            
            const finalGrouped = {};
            sortedEmployees.forEach(([key, data]) => {
                finalGrouped[key] = data;
            });
            
            console.log('✅ Slots agrupados por EMPLEADO:', Object.keys(finalGrouped));
            setDayAvailability(finalGrouped);
            setLoadingDayView(false);
            
        } catch (error) {
            console.error('❌ Error cargando disponibilidades del día:', error);
            setDayAvailability({
                'ERROR': [{
                    id: 'error',
                    start_time: '❌',
                    message: `Error al consultar: ${error.message}`,
                    isEmpty: true
                }]
            });
            setLoadingDayView(false);
        }
    };

    // Cargar estado persistente cuando cambie el businessId
    useEffect(() => {
        if (businessId) {
            // Cargar estado persistente específico del restaurante
            try {
                const saved = localStorage.getItem(`generationSuccess_${businessId}`);
                if (saved) {
                    setGenerationSuccess(JSON.parse(saved));
                }
            } catch (error) {
                // Silencioso - no es crítico
            }
            
            loadbusinessesettings();
            
            // ✅ CARGAR DATOS DIRECTAMENTE DESDE SUPABASE (sin depender de regeneraciones)
            console.log('🔄 Cargando datos directamente desde Supabase...');
            loadAvailabilityStats().then(() => {
                // Cargar estadísticas de días después de las stats normales
                loadDayStats();
            });

            // 🆕 Cargar configuración de disponibilidades desde la BD
            loadAvailabilityConfig();
            
            // ✅ Si hay una fecha seleccionada, cargar sus slots directamente
            if (selectedDate) {
                console.log('🔄 Cargando slots para fecha seleccionada:', selectedDate);
                loadDayAvailability(selectedDate);
            }
        }
    }, [businessId]);

    // 🆕 Cargar configuración de disponibilidades
    const loadAvailabilityConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('settings')
                .eq('id', businessId)
                .single();

            if (error) throw error;

            if (data?.settings) {
                setGenerationSettings(prev => ({
                    ...prev,
                    advanceBookingDays: data.settings.advance_booking_days || 90,
                    minAdvanceMinutes: data.settings.min_advance_minutes || 120
                }));
            }
        } catch (error) {
            console.error('Error cargando configuración de disponibilidades:', error);
        }
    };

    // Actualizar generationSuccess cuando cambien las estadísticas reales
    useEffect(() => {
        if (availabilityStats && generationSuccess && (
            generationSuccess.totalAvailable === null || 
            generationSuccess.totalAvailable === undefined ||
            generationSuccess.totalOccupied === null || 
            generationSuccess.totalOccupied === undefined ||
            generationSuccess.totalReserved === null || 
            generationSuccess.totalReserved === undefined
        )) {
            setGenerationSuccess(prev => ({
                ...prev,
                totalAvailable: availabilityStats.free || 0,
                totalOccupied: availabilityStats.occupied || 0,
                totalReserved: availabilityStats.occupied || 0 // occupied incluye reservas
            }));
            
            // Actualizar localStorage también
            try {
                const updatedData = {
                    ...generationSuccess,
                    totalAvailable: availabilityStats.free || 0,
                    totalOccupied: availabilityStats.occupied || 0,
                    totalReserved: availabilityStats.occupied || 0
                };
                localStorage.setItem(`generationSuccess_${businessId}`, JSON.stringify(updatedData));
            } catch (error) {
                // Silencioso - no es crítico
            }
        }
    }, [availabilityStats, generationSuccess, businessId]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    Disponibilidades
                </h2>
                <p className="text-sm text-gray-500 mt-1">Gestiona horarios disponibles para reservas</p>
            </div>

            {/* Configuración - COMPACTA */}
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-5 h-5 text-purple-600" />
                    <h3 className="text-base font-bold text-purple-900">Configuración</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Campo 1: Días de antelación máxima */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Días de antelación máxima
                        </label>
                        <input
                            type="number"
                            value={generationSettings.advanceBookingDays}
                            onChange={(e) => setGenerationSettings(prev => ({
                                ...prev,
                                advanceBookingDays: parseInt(e.target.value) || 90
                            }))}
                            min="7"
                            max="365"
                            step="1"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Días hacia el futuro</p>
                    </div>

                    {/* Campo 2: Minutos de antelación mínima */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Minutos de antelación mínima
                        </label>
                        <input
                            type="number"
                            value={generationSettings.minAdvanceMinutes}
                            onChange={(e) => setGenerationSettings(prev => ({
                                ...prev,
                                minAdvanceMinutes: parseInt(e.target.value) || 120
                            }))}
                            min="0"
                            max="1440"
                            step="15"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Minutos de antelación mínima</p>
                    </div>
                </div>

                {/* Info compacta */}
                <div className="mt-2 text-xs text-gray-500 text-center">
                    💡 Define cuántos días hacia el futuro y tiempo mínimo de antelación para reservas
                </div>

                {/* Botón Guardar */}
                <div className="mt-3">
                    <button
                        onClick={async () => {
                            try {
                                setLoading(true);
                                toast.loading('Guardando configuración...', { id: 'save-config' });

                                // Obtener configuración actual
                                const { data: currentData, error: fetchError } = await supabase
                                    .from('businesses')
                                    .select('settings')
                                    .eq('id', businessId)
                                    .single();

                                if (fetchError) throw fetchError;

                                // Actualizar settings
                                const updatedSettings = {
                                    ...(currentData?.settings || {}),
                                    advance_booking_days: generationSettings.advanceBookingDays,
                                    min_advance_minutes: generationSettings.minAdvanceMinutes
                                };

                                const { error } = await supabase
                                    .from('businesses')
                                    .update({ settings: updatedSettings })
                                    .eq('id', businessId);

                                if (error) throw error;

                                toast.dismiss('save-config');
                                toast.success('✅ Configuración guardada correctamente');

                            } catch (error) {
                                console.error('Error guardando configuración:', error);
                                toast.dismiss('save-config');
                                toast.error('❌ Error: ' + error.message);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {loading ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>

            {/* Panel de Estado - SIMPLIFICADO */}
            {availabilityStats?.free > 0 && (
                <div className="bg-white rounded-lg border border-blue-200 shadow-sm mb-4">
                    {/* Header compacto */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Días Disponibles</h3>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    {format(new Date(), 'dd/MM/yyyy')} - {dayStats?.fechaHasta || 'N/A'} ({dayStats?.advanceDaysConfig || 30} días)
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShowRegenerateModal}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all font-medium text-sm"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {loading ? 'Generando...' : 'Generar'}
                            </button>
                            <button 
                                onClick={handleSmartCleanup}
                                disabled={loading}
                                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all disabled:opacity-50 text-sm"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Estadísticas - COMPACTA */}
                    <div className="grid grid-cols-4 gap-3 p-4">
                        <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Días Totales</div>
                            <div className="text-xl font-bold text-gray-900">{dayStats?.diasTotales || 0}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Libres</div>
                            <div className="text-xl font-bold text-green-600">{dayStats?.diasLibres || 0}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Ocupados</div>
                            <div className="text-xl font-bold text-amber-600">{dayStats?.diasConReservas || 0}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Reservas</div>
                            <div className="text-xl font-bold text-purple-600">{dayStats?.reservasActivas || 0}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sin slots - SIMPLIFICADO */}
            {availabilityStats?.free === 0 && dayStats && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-6 h-6 text-amber-600" />
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Sin Disponibilidades</h3>
                                <p className="text-xs text-gray-600 mt-0.5">No hay horarios activos para nuevas reservas</p>
                            </div>
                        </div>
                        <button
                            onClick={handleShowRegenerateModal}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Generar
                        </button>
                    </div>
                </div>
            )}

            {/* Conflictos detectados */}
            {showDetails && conflictingReservations.length > 0 && (
                <div className="border border-orange-200 rounded-lg p-2 mb-6 bg-orange-50">
                    <h3 className="font-medium text-orange-900 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Reservas que podrían verse afectadas ({conflictingReservations.length})
                    </h3>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {conflictingReservations.map(reservation => (
                            <div key={reservation.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex items-center gap-3">
                                    <div className="text-sm">
                                        <div className="font-medium">{reservation.customer_name}</div>
                                        <div className="text-gray-600">
                                            {format(new Date(reservation.reservation_date), 'dd/MM/yyyy', { locale: es })} • {reservation.reservation_time}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Users className="w-4 h-4" />
                                    {reservation.party_size}
                                    <span>•</span>
                                    {reservation.tables?.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selector de día específico - SIMPLIFICADO */}
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 flex-wrap">
                    <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="flex-1 min-w-[150px] max-w-[200px] border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                    <button
                        onClick={() => loadDayAvailability(selectedDate)}
                        disabled={loadingDayView}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all font-medium text-sm shadow-md hover:shadow-lg"
                    >
                        {loadingDayView ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        Ver Horarios
                    </button>
                </div>

                {/* Dashboard visual - TODOS LOS EMPLEADOS EN COLUMNAS */}
                {Object.keys(dayAvailability).length > 0 && (
                    <div className="mt-4">
                        {/* Resumen general */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-200">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-gray-900 mb-1">
                                    {Object.values(dayAvailability).reduce((sum, emp) => {
                                        const slots = emp.slots || [];
                                        return sum + slots.filter(s => s.status === 'free').length;
                                    }, 0)}
                                </div>
                                <div className="text-sm text-gray-600">
                                    slots disponibles creados para {selectedDate}
                                </div>
                            </div>
                        </div>
                        
                        {/* Grid de empleados tipo columnas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(dayAvailability).map(([employeeKey, employeeData]) => {
                                const slots = employeeData.slots || [];
                                const employeeName = employeeData.employee_name || employeeKey;
                                const resourceName = employeeData.resource_name;
                                
                                if (slots[0]?.isEmpty || slots[0]?.isClosed) {
                                    return (
                                        <div key={employeeKey} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="text-center text-gray-500 text-sm">
                                                {slots[0]?.message || 'Sin disponibilidades'}
                                            </div>
                                        </div>
                                    );
                                }
                                
                                const freeSlots = slots.filter(s => s.status === 'free').length;
                                const totalSlots = slots.length;
                                
                                // Agrupar slots por hora para visualización
                                const slotsByHour = {};
                                slots.forEach(slot => {
                                    const hour = slot.start_time?.substring(0, 2) || '00';
                                    if (!slotsByHour[hour]) {
                                        slotsByHour[hour] = [];
                                    }
                                    slotsByHour[hour].push(slot);
                                });
                                
                                return (
                                    <div key={employeeKey} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                        {/* Header empleado */}
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 border-b border-gray-200">
                                            <div className="font-bold text-gray-900 text-sm">{employeeName}</div>
                                            {resourceName && (
                                                <div className="text-xs text-gray-500 mt-0.5">📍 {resourceName}</div>
                                            )}
                                        </div>
                                        
                                        {/* Resumen numérico */}
                                        <div className="p-3 text-center border-b border-gray-100">
                                            <div className="text-2xl font-bold text-gray-900">{freeSlots}</div>
                                            <div className="text-xs text-gray-500">de {totalSlots} slots creados</div>
                                        </div>
                                        
                                        {/* Visualización tipo timeline compacta */}
                                        <div className="p-3">
                                            <div className="space-y-1">
                                                {Object.entries(slotsByHour)
                                                    .sort(([a], [b]) => a.localeCompare(b))
                                                    .slice(0, 12) // Mostrar solo primeras 12 horas
                                                    .map(([hour, hourSlots]) => {
                                                        const freeCount = hourSlots.filter(s => s.status === 'free').length;
                                                        const totalCount = hourSlots.length;
                                                        const percentage = (freeCount / totalCount) * 100;
                                                        
                                                        return (
                                                            <div key={hour} className="flex items-center gap-2 text-xs">
                                                                <div className="w-12 text-gray-600 font-medium">{hour}:00</div>
                                                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={`h-full ${percentage === 100 ? 'bg-green-500' : percentage > 0 ? 'bg-amber-400' : 'bg-gray-300'}`}
                                                                        style={{ width: `${percentage}%` }}
                                                                    ></div>
                                                                </div>
                                                                <div className="w-8 text-right text-gray-500 text-[10px]">
                                                                    {freeCount}/{totalCount}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                            {Object.keys(slotsByHour).length > 12 && (
                                                <div className="text-center text-xs text-gray-400 mt-2">
                                                    +{Object.keys(slotsByHour).length - 12} horas más
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Vista detallada de disponibilidades */}
            {showAvailabilityGrid && (
                <div className="mt-6 border border-gray-200 rounded-lg p-2">
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Calendario de Disponibilidades
                    </h3>
                    
                    {Object.keys(availabilityGrid).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No hay disponibilidades generadas para este período</p>
                            <p className="text-sm">Usa el botón "Generar Horarios de Reserva" para crear slots</p>
                        </div>
                    ) : (
                        <div className="space-y-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                            {Object.entries(availabilityGrid).map(([date, tables]) => (
                                <div key={date} className="border border-gray-100 rounded-lg p-2">
                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: es })}
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(tables).map(([tableName, tableData]) => (
                                            <div key={tableName} className="bg-gray-50 rounded-lg p-2">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Users className="w-4 h-4 text-gray-600" />
                                                    <span className="font-medium text-gray-900">
                                                        {tableName}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        ({tableData.table.capacity} personas)
                                                    </span>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-1">
                                                    {tableData.slots.map((slot) => (
                                                        <div
                                                            key={slot.id}
                                                            className={`px-2 py-1 rounded text-xs font-medium cursor-pointer ${
                                                                slot.status === 'free'
                                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                    : slot.status === 'reserved'
                                                                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                                    : slot.status === 'occupied'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-gray-100 text-gray-700'
                                                            }`}
                                                            title={`${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)} (${slot.status})${
                                                                slot.metadata?.reservation_id ? ' - Con reserva' : ''
                                                            }`}
                                                        >
                                                            {slot.start_time.slice(0, 5)}
                                                            {slot.metadata?.reservation_id && (
                                                                <span className="ml-1">📋</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="mt-2 text-xs text-gray-500">
                                                    {tableData.slots.filter(s => s.status === 'free').length} libres • {' '}
                                                    {tableData.slots.filter(s => s.status === 'reserved').length} reservados • {' '}
                                                    {tableData.slots.filter(s => s.status === 'occupied').length} ocupados
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 🛡️ MODAL DE PROTECCIÓN: RESERVAS EN DÍAS CERRADOS */}
            {showConflictModal && conflictData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
                            <div className="flex items-center gap-4">
                                <AlertTriangle className="w-12 h-12 text-white" />
                                <div>
                                    <h2 className="text-2xl font-bold text-white">
                                        ⚠️ Reservas Detectadas en Días que Quieres Cerrar
                                    </h2>
                                    <p className="text-orange-100 mt-1">
                                        Protección automática de reservas activada
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <p className="text-gray-700 mb-4 text-lg">
                                Has marcado <strong>{conflictData.closedDays.map(d => d.displayName).join(', ')}</strong> como cerrados,
                                pero hay <strong className="text-red-600">{conflictData.conflicts.reduce((sum, c) => sum + c.reservations.length, 0)} reservas activas</strong> en esos días:
                            </p>

                            {/* Lista de conflictos por día */}
                            <div className="space-y-4">
                                {conflictData.conflicts.map(dayConflict => {
                                    // Agrupar reservas por fecha
                                    const byDate = {};
                                    dayConflict.reservations.forEach(r => {
                                        if (!byDate[r.reservation_date]) {
                                            byDate[r.reservation_date] = [];
                                        }
                                        byDate[r.reservation_date].push(r);
                                    });

                                    return (
                                        <div key={dayConflict.day} className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                                            <h3 className="font-bold text-orange-900 mb-3 text-lg capitalize flex items-center gap-2">
                                                <Calendar className="w-5 h-5" />
                                                {dayConflict.displayName}s con reservas:
                                            </h3>

                                            {/* Por cada fecha específica */}
                                            {Object.entries(byDate).map(([date, reservations]) => (
                                                <div key={date} className="mb-3 last:mb-0 bg-white rounded-lg p-3">
                                                    <p className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2">
                                                        <Clock className="w-4 h-4" />
                                                        📅 {format(new Date(date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                                                        <span className="ml-auto bg-orange-200 px-2 py-0.5 rounded-full text-xs">
                                                            {reservations.length} reserva{reservations.length > 1 ? 's' : ''}
                                                        </span>
                                                    </p>
                                                    <ul className="ml-4 space-y-2">
                                                        {reservations.map(r => (
                                                            <li key={r.id} className="text-sm text-gray-700 flex items-center gap-2 bg-gray-50 p-2 rounded">
                                                                <Users className="w-4 h-4 text-gray-500" />
                                                                <span className="font-medium">{r.customer_name}</span>
                                                                <span className="text-gray-500">•</span>
                                                                <span>{r.reservation_time.slice(0, 5)}</span>
                                                                <span className="text-gray-500">•</span>
                                                                <span>{r.party_size} personas</span>
                                                                <span className="ml-auto text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                                                    {r.status === 'confirmed' ? 'Confirmada' : r.status === 'pending' ? 'Pendiente' : 'Pend. Aprobación'}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Explicación */}
                            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mt-6">
                                <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    🛡️ PROTECCIÓN AUTOMÁTICA ACTIVADA
                                </p>
                                <p className="text-sm text-blue-800 mb-2">
                                    Si continúas, el sistema hará lo siguiente:
                                </p>
                                <ul className="text-sm text-blue-800 ml-4 list-disc space-y-1">
                                    <li>
                                        ⚠️ <strong>NO cerrará</strong> los días específicos que tienen reservas (ej: jueves 9, 16, 23 de octubre)
                                    </li>
                                    <li>
                                        ✅ <strong>SÍ cerrará</strong> los demás días de la semana sin reservas
                                    </li>
                                    <li>
                                        📋 Podrás gestionar estas reservas manualmente y cerrar esos días después
                                    </li>
                                    <li>
                                        🔒 Las reservas existentes quedan <strong>100% protegidas</strong>
                                    </li>
                                </ul>
                            </div>

                            {/* Advertencia final */}
                            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mt-4">
                                <p className="text-sm text-yellow-900">
                                    <strong>💡 Recomendación:</strong> Contacta a estos clientes para cancelar/mover sus reservas antes de cerrar definitivamente esos días.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 p-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowConflictModal(false);
                                    setConflictData(null);
                                }}
                                className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    setShowConflictModal(false);
                                    const conflictsCopy = conflictData; // Guardar antes de limpiar
                                    setConflictData(null);
                                    
                                    toast.loading('Creando excepciones para proteger reservas...', { id: 'protected-regen' });
                                    
                                    try {
                                        // 🛡️ PASO 1: CREAR EXCEPCIONES para cada fecha con reservas
                                        const exceptionsToCreate = [];
                                        
                                        conflictsCopy.conflicts.forEach(dayConflict => {
                                            dayConflict.reservations.forEach(reservation => {
                                                const exceptionDate = reservation.reservation_date;
                                                
                                                // Evitar duplicados en el mismo batch
                                                if (!exceptionsToCreate.find(e => e.exception_date === exceptionDate)) {
                                                    // 🔑 OBTENER HORARIOS DEL DÍA CERRADO
                                                    const dayOfWeek = new Date(exceptionDate).getDay();
                                                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                                                    const dayName = dayNames[dayOfWeek];
                                                    const dayConfig = businessesettings?.operating_hours?.[dayName];
                                                    
                                                    exceptionsToCreate.push({
                                                        business_id: businessId,
                                                        exception_date: exceptionDate,
                                                        is_open: true, // Forzar abierto para proteger la reserva
                                                        open_time: dayConfig?.open || '09:00', // Usar horario del día
                                                        close_time: dayConfig?.close || '22:00', // Usar horario del día
                                                        reason: `Reserva existente protegida (${reservation.customer_name} - ${reservation.party_size} personas)`,
                                                        created_by: 'system'
                                                    });
                                                }
                                            });
                                        });
                                        
                                        console.log('🛡️ Creando excepciones:', exceptionsToCreate);
                                        
                                        // Insertar excepciones en batch
                                        if (exceptionsToCreate.length > 0) {
                                            const { error: exceptionsError } = await supabase
                                                .from('calendar_exceptions')
                                                .upsert(exceptionsToCreate, {
                                                    onConflict: 'business_id,exception_date',
                                                    ignoreDuplicates: false
                                                });
                                            
                                            if (exceptionsError) {
                                                console.error('❌ Error creando excepciones:', exceptionsError);
                                                throw new Error('Error al crear excepciones de calendario');
                                            }
                                            
                                            console.log(`✅ ${exceptionsToCreate.length} excepciones creadas`);
                                        }
                                        
                                        toast.loading('Regenerando disponibilidades con protección...', { id: 'protected-regen' });
                                        
                                        // 🔄 PASO 2: REGENERAR o GENERAR DISPONIBILIDADES (ahora respetará las excepciones)
                                        const today = format(new Date(), 'yyyy-MM-dd');
                                        const advanceDays = businessesettings?.advance_booking_days || 30;
                                        const endDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');

                                        let data, error;
                                        
                                        if (conflictData.isGenerating) {
                                            // Viene de generateAvailability - usar función simple
                                            const result = await supabase.rpc('generate_availability_slots_simple', {
                                                p_business_id: businessId,
                                                p_start_date: today,
                                                p_end_date: endDate
                                            });
                                            data = result.data;
                                            error = result.error;
                                        } else {
                                            // Viene de smartRegeneration - usar función de generación
                                            const startDateObj = new Date(today);
                                            const endDateObj = new Date(endDate);
                                            const daysToGenerate = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
                                            
                                            // Usar generate_availability_slots_employee_based con parámetros correctos
                                            const result = await supabase.rpc('generate_availability_slots_employee_based', {
                                                p_business_id: businessId,
                                                p_start_date: today,
                                                p_days_ahead: daysToGenerate,
                                                p_regenerate: true
                                            });
                                            
                                            data = result.data;
                                            error = result.error;
                                        }

                                        if (error) throw error;

                                        toast.dismiss('protected-regen');
                                        toast.success(`✅ ${conflictData.isGenerating ? 'Generación' : 'Regeneración'} completada correctamente`);
                                        
                                        // Actualizar estado
                                        const successData = {
                                            slotsCreated: data?.slots_created || data?.affected_count || 0,
                                            dateRange: `HOY hasta ${format(addDays(new Date(), advanceDays), 'dd/MM/yyyy')}`,
                                            duration: businessesettings?.reservation_duration || 90,
                                            timestamp: new Date().toLocaleString(),
                                            protectedReservations: conflictData.conflicts.reduce((sum, c) => sum + c.reservations.length, 0)
                                        };
                                        
                                        setGenerationSuccess(successData);
                                        localStorage.setItem(`generationSuccess_${businessId}`, JSON.stringify(successData));
                                        
                                        // Recargar estadísticas y excepciones
                                        await loadCalendarExceptions();
                                        
                                        // 🔄 FORZAR RECARGA DE ESTADÍSTICAS CON RETRASO
                                        console.log('🔄 Forzando recarga de estadísticas...');
                                        
                                        // Primero limpiar el estado actual
                                        setAvailabilityStats(null);
                                        setGenerationSuccess(null);
                                        
                                        // Luego recargar con un pequeño delay para asegurar que la BD está actualizada
                                        setTimeout(async () => {
                                            try {
                                                await loadAvailabilityStats();
                                                await loadDayStats(); // 📊 Recargar estadísticas de días
                                                console.log('✅ Estadísticas recargadas después de regeneración');
                                                
                                                // Actualizar generationSuccess con las estadísticas reales
                                                setGenerationSuccess({
                                                    ...successData,
                                                    totalAvailable: availabilityStats?.free || 0,
                                                    totalOccupied: availabilityStats?.occupied || 0,
                                                    totalReserved: availabilityStats?.reserved || 0
                                                });
                                            } catch (error) {
                                                console.error('❌ Error recargando estadísticas:', error);
                                            }
                                        }, 500);
                                        
                                        // Cerrar modal
                                        setShowConflictModal(false);
                                        setConflictData(null);
                                        
                                    } catch (error) {
                                        toast.dismiss('protected-regen');
                                        console.error('Error en regeneración protegida:', error);
                                        toast.error('Error al regenerar: ' + error.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Continuar (Proteger Reservas)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🛡️ SECCIÓN: EXCEPCIONES DE CALENDARIO */}
            {calendarExceptions.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                    <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        🛡️ Días Protegidos (Excepciones Activas)
                    </h3>
                    <p className="text-sm text-blue-800 mb-3">
                        Estos días permanecerán <strong>abiertos</strong> aunque tu horario semanal indique lo contrario:
                    </p>
                    <div className="space-y-2">
                        {calendarExceptions.map(exception => (
                            <div key={exception.id} className="bg-white rounded-lg p-3 flex items-center justify-between border border-blue-200 hover:border-blue-400 transition-colors">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`w-3 h-3 rounded-full ${exception.is_open ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">
                                            📅 {format(new Date(exception.exception_date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            <span className="font-semibold">Motivo:</span> {exception.reason}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${exception.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {exception.is_open ? '✅ Abierto' : '❌ Cerrado'}
                                    </span>
                                    <button
                                        onClick={async () => {
                                            if (!window.confirm(`¿Eliminar la excepción para ${format(new Date(exception.exception_date), "d 'de' MMMM", { locale: es })}?\n\nEste día volverá a seguir el horario semanal normal.`)) {
                                                return;
                                            }
                                            
                                            try {
                                                toast.loading('Eliminando excepción...', { id: 'delete-exception' });
                                                
                                                const { error } = await supabase
                                                    .from('calendar_exceptions')
                                                    .delete()
                                                    .eq('id', exception.id);
                                                
                                                if (error) throw error;
                                                
                                                toast.dismiss('delete-exception');
                                                toast.success('✅ Excepción eliminada correctamente');
                                                
                                                // Recargar excepciones
                                                await loadCalendarExceptions();
                                                
                                                // Sugerir regeneración
                                                toast.info('💡 Recuerda regenerar las disponibilidades para aplicar el cambio', { duration: 5000 });
                                                
                                            } catch (error) {
                                                toast.dismiss('delete-exception');
                                                console.error('Error eliminando excepción:', error);
                                                toast.error('❌ Error al eliminar la excepción');
                                            }
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar excepción"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-blue-700 mt-3 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        <span>Las excepciones se eliminan automáticamente cuando se cancelan todas las reservas del día.</span>
                    </p>
                </div>
            )}

            {/* 🚨 MODAL DE ADVERTENCIA: NO SE GENERARON SLOTS */}
            {showNoSlotsModal && noSlotsReason && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-2">
                    <div 
                        className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full text-center relative border-4 border-orange-500"
                        style={{
                            animation: 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                        }}
                    >
                        {/* Icono de alerta */}
                        <div className="mb-6 flex justify-center">
                            <AlertTriangle className="w-20 h-20 text-orange-600 animate-pulse" />
                        </div>

                        {/* Título */}
                        <h2 className="text-xl font-extrabold text-gray-900 mb-4 leading-tight">
                            ⚠️ NO SE GENERARON HORARIOS DE RESERVA
                        </h2>

                        {/* Mensaje principal */}
                        {noSlotsReason.allClosed ? (
                            <div className="mb-6">
                                <p className="text-lg text-gray-700 mb-4">
                                    <strong>Motivo:</strong> Todos los días están cerrados en el período seleccionado
                                </p>
                                <div className="p-6 bg-red-50 border-l-4 border-red-400 rounded text-left">
                                    <p className="text-gray-800 font-semibold mb-3">📊 Análisis del período:</p>
                                    <ul className="list-disc list-inside text-gray-700 space-y-2">
                                        <li>Días procesados: <strong>{noSlotsReason.daysProcessed}</strong></li>
                                        <li>Días cerrados: <strong className="text-red-600">{noSlotsReason.daysClosed}</strong></li>
                                        <li>Mesas disponibles: <strong>{noSlotsReason.tableCount}</strong></li>
                                        <li>Período: <strong>HOY hasta {noSlotsReason.endDate}</strong></li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                <p className="text-lg text-gray-700 mb-4">
                                    <strong>Motivo:</strong> No se encontraron días con horarios configurados
                                </p>
                                <div className="p-6 bg-orange-50 border-l-4 border-orange-400 rounded text-left">
                                    <p className="text-gray-800 font-semibold mb-3">📊 Estado actual:</p>
                                    <ul className="list-disc list-inside text-gray-700 space-y-2">
                                        <li>Slots existentes preservados: <strong>{noSlotsReason.slotsSkipped}</strong></li>
                                        <li>Días procesados: <strong>{noSlotsReason.daysProcessed}</strong></li>
                                        <li>Días cerrados: <strong>{noSlotsReason.daysClosed}</strong></li>
                                        <li>Mesas disponibles: <strong>{noSlotsReason.tableCount}</strong></li>
                                        <li>Período: <strong>HOY hasta {noSlotsReason.endDate}</strong></li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Solución */}
                        <div className="mb-6 p-6 bg-blue-50 border-l-4 border-blue-500 rounded text-left">
                            <p className="text-gray-800 font-medium text-lg mb-3">
                                🔧 <strong>¿QUÉ DEBES HACER?</strong>
                            </p>
                            <ol className="list-decimal list-inside text-gray-700 space-y-2">
                                {noSlotsReason.allClosed ? (
                                    <>
                                        <li>Ve a <strong>Calendario</strong> y abre algunos días</li>
                                        <li>O ve a <strong>Configuración → Horarios</strong> y configura días abiertos</li>
                                        <li>Vuelve aquí y genera los horarios de nuevo</li>
                                    </>
                                ) : (
                                    <>
                                        <li>Ve a <strong>Configuración → Horarios</strong> y verifica los horarios de apertura</li>
                                        <li>Ve a <strong>Calendario</strong> y asegúrate de tener días abiertos</li>
                                        <li>Verifica que tu <strong>Política de Reservas</strong> esté correctamente configurada</li>
                                        <li>Vuelve aquí y genera los horarios de nuevo</li>
                                    </>
                                )}
                            </ol>
                        </div>

                        {/* Botón de cerrar */}
                        <button
                            onClick={() => {
                                setShowNoSlotsModal(false);
                                setNoSlotsReason(null);
                            }}
                            className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                            Entendido - Voy a configurar
                        </button>
                    </div>
                </div>
            )}

            {/* Modales de Confirmación */}
            <ConfirmActionModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={executeDelete}
                type="delete"
                protectedDays={protectedDaysData}
            />

            <ConfirmActionModal
                isOpen={showConfirmRegenerate}
                onClose={() => setShowConfirmRegenerate(false)}
                onConfirm={() => {
                    // Ejecutar regeneración
                    smartRegeneration('schedule_change', { source: 'manual_confirm' });
                }}
                type="regenerate"
                protectedDays={protectedDaysData}
                dateRange={dateRangeInfo}
            />

            {/* Modal de Resultado Unificado */}
            <ResultModal
                isOpen={showRegenerationModal}
                onClose={() => setShowRegenerationModal(false)}
                type={regenerationResult?.type || 'delete'}
                result={regenerationResult || {}}
            />

            {/* Estilos de animación inline */}
            <style>{`
                @keyframes bounceIn {
                    0% {
                        transform: scale(0.3);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 1;
                    }
                    70% {
                        transform: scale(0.9);
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export default AvailabilityManager;


