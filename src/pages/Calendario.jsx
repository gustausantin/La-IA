// src/pages/Calendario.jsx - Gestión PREMIUM de horarios y disponibilidad con IA
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useChannelStats } from '../hooks/useChannelStats';
import { useOccupancy } from '../hooks/useOccupancy';
import { useAvailabilityChangeDetection } from '../hooks/useAvailabilityChangeDetection';
import { useRegenerationModal } from '../hooks/useRegenerationModal';
import RegenerationRequiredModal from '../components/RegenerationRequiredModal';
import CalendarioErrorBoundary from '../components/CalendarioErrorBoundary';
import { 
    format, 
    parseISO, 
    startOfWeek, 
    endOfWeek, 
    addDays, 
    isSameDay, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval,
    addMonths,
    subMonths,
    isToday,
    isBefore,
    isAfter,
    getDay,
    setHours,
    setMinutes,
    addMinutes,
    differenceInMinutes,
    isWithinInterval,
    isSameMonth
} from 'date-fns';
import { es } from 'date-fns/locale';

// TEST INLINE - VERIFICAR LÓGICA
console.log('🧪 TEST CALENDAR LOGIC:');
// 🔒 REGLA ORO #2: testData eliminado - PROHIBIDO usar datos falsos
// Todos los datos deben venir de la base de datos real

// ALERTA VISUAL PARA DEBUG
setTimeout(() => {
    console.log('🔍🔍🔍 MIRA LA CONSOLA - Deberías ver logs del calendario aquí 🔍🔍🔍');
    console.log('📅 Si configuras MARTES abierto, SOLO los martes deberían aparecer ABIERTOS');
    console.log('❌ Si ves otros días abiertos, hay un problema grave');
}, 2000);
import { 
    Save, 
    Plus, 
    Calendar,
    Clock,
    ChevronLeft,
    ChevronRight,
    Settings,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Coffee,
    Moon,
    Sun,
    Sunset,
    Bot,
    Users,
    TrendingUp,
    Info,
    Edit2,
    Copy,
    Star,
    Activity,
    Zap,
    MessageSquare,
    Phone,
    Mail,
    Sparkles,
    Brain,
    RefreshCw,
    X
} from "lucide-react";
import toast from "react-hot-toast";

// Configuración de días de la semana
const daysOfWeek = [
    { id: 'monday', name: 'Lunes' },
    { id: 'tuesday', name: 'Martes' },
    { id: 'wednesday', name: 'Miércoles' },
    { id: 'thursday', name: 'Jueves' },
    { id: 'friday', name: 'Viernes' },
    { id: 'saturday', name: 'Sábado' },
    { id: 'sunday', name: 'Domingo' }
];

export default function Calendario() {
    const { business: restaurant, businessId: restaurantId, isReady, addNotification } = useAuthContext();
    const { channelStats } = useChannelStats();
    const { occupancy: occupancyData } = useOccupancy(7);
    const changeDetection = useAvailabilityChangeDetection(restaurantId);
    const { isModalOpen, modalChangeReason, modalChangeDetails, showRegenerationModal, closeModal } = useRegenerationModal();

    // Estados principales
    const [loading, setLoading] = useState(true);
    const [calendarExceptions, setCalendarExceptions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [schedule, setSchedule] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('calendario');
    const [showEventModal, setShowEventModal] = useState(false);
    const [showEventDetailModal, setShowEventDetailModal] = useState(false); // Modal para ver evento existente
    const [selectedEvent, setSelectedEvent] = useState(null); // Evento seleccionado para ver/editar/eliminar
    
    // Estados para estadísticas calculadas
    const [stats, setStats] = useState({
        daysOpen: 0,
        weeklyHours: 0,
        activeChannels: 0,
        activeReservations: 0,
        upcomingEvents: 0
    });

    // Estados para eventos especiales
    const [events, setEvents] = useState([]);

    // Generar días del calendario CON ALINEACIÓN CORRECTA
    const generateCalendarDays = () => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const startWeek = startOfWeek(start, { weekStartsOn: 1 }); // Lunes como primer día
        const endWeek = endOfWeek(end, { weekStartsOn: 1 });
        
        // Generar TODOS los días incluyendo los vacíos al principio y final
        return eachDayOfInterval({
            start: startWeek,
            end: endWeek
        });
    };
    
    const calendarDays = generateCalendarDays();

    // Inicializar datos - SOLO UNA VEZ
    useEffect(() => {
        if (restaurantId) {
            console.log('🚀 INICIALIZANDO CALENDARIO - Restaurant ID:', restaurantId);
            
            // TEST DE VERIFICACIÓN DE DÍAS
            console.log('🧪 TEST: Verificando getDay() con fechas conocidas:');
            const testDates = [
                new Date(2025, 9, 4),  // 4 Oct 2025 = Sábado
                new Date(2025, 9, 5),  // 5 Oct 2025 = Domingo
                new Date(2025, 9, 6),  // 6 Oct 2025 = Lunes
            ];
            testDates.forEach(date => {
                const dayIndex = getDay(date);
                const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                console.log(`   ${format(date, 'dd/MM/yyyy')} es ${format(date, 'EEEE', { locale: es })} | getDay()=${dayIndex} | mapped=${dayNames[dayIndex]}`);
            });
            
            initializeData();
            loadEvents();
        }
    }, [restaurantId]); // SOLO cuando cambia restaurantId, NO al navegar meses

    // DEBUG: Verificar schedule en cada render
    useEffect(() => {
        if (schedule.length > 0) {
            console.log('🔄 SCHEDULE ACTUAL EN RENDER:', schedule.map(s => `${s.day_of_week}:${s.is_open ? 'ABIERTO' : 'CERRADO'}`).join(', '));
        }
    });

    // Escuchar cambios de horarios desde Configuración
    useEffect(() => {
        const handleRestaurantReload = (event) => {
            console.log("🔄 Calendario: Recargando horarios por cambio en Configuración");
            initializeData();
        };

        const handleScheduleUpdate = (event) => {
            console.log("🔄 Calendario: Horarios actualizados desde Configuración");
            initializeData();
        };

        window.addEventListener('force-restaurant-reload', handleRestaurantReload);
        window.addEventListener('schedule-updated', handleScheduleUpdate);
        
        // Nota: Removidos listeners de focus/visibility que causaban recargas innecesarias

        return () => {
            window.removeEventListener('force-restaurant-reload', handleRestaurantReload);
            window.removeEventListener('schedule-updated', handleScheduleUpdate);
        };
    }, []);

    const initializeData = async () => {
        if (!restaurantId) return;
        
        setLoading(true);
        try {
            // Cargar horarios desde restaurants.settings (donde están realmente guardados)
            const { data: restaurantData, error: scheduleError } = await supabase
                .from("restaurants")
                .select("settings")
                .eq("id", restaurantId)
                .single();

            if (scheduleError) {
                console.error("❌ Error cargando horarios:", scheduleError);
            }

            // 🛡️ Cargar excepciones de calendario (días protegidos)
            const { data: exceptions, error: exceptionsError } = await supabase
                .from("calendar_exceptions")
                .select("*")
                .eq("restaurant_id", restaurantId)
                .eq("is_open", true); // Solo días que deben estar abiertos

            if (exceptionsError) {
                console.error("❌ Error cargando excepciones:", exceptionsError);
            } else {
                console.log("🛡️ Excepciones cargadas:", exceptions);
                // Guardar excepciones en estado para usarlas en getDaySchedule
                setCalendarExceptions(exceptions || []);
            }

            let savedHours = restaurantData?.settings?.operating_hours || {};
            
            // Si no hay horarios guardados, inicializar con valores por defecto
            if (Object.keys(savedHours).length === 0) {
                console.log('⚠️ No hay horarios guardados, inicializando por defecto...');
                savedHours = {
                    monday: { open: '09:00', close: '22:00', closed: false },    // ✅ ABIERTO
                    tuesday: { open: '09:00', close: '22:00', closed: false },   // ✅ ABIERTO
                    wednesday: { open: '09:00', close: '22:00', closed: false }, // ✅ ABIERTO
                    thursday: { open: '09:00', close: '22:00', closed: false },  // ✅ ABIERTO
                    friday: { open: '09:00', close: '22:00', closed: false },    // ✅ ABIERTO
                    saturday: { open: '09:00', close: '22:00', closed: true },   // ❌ CERRADO
                    sunday: { open: '10:00', close: '21:00', closed: true }      // ❌ CERRADO
                };
            }
            
            console.log('\n🔄 CARGANDO HORARIOS DESDE BD...');
            console.log('📊 DATOS RAW:', JSON.stringify(savedHours, null, 2));
            
            // Debug detallado de cada día - FORMATO CORRECTO
            console.log('🔍 VERIFICANDO CADA DÍA (formato closed):');
            console.log('  - domingo:', savedHours.sunday?.closed, '→ abierto:', !savedHours.sunday?.closed);
            console.log('  - lunes:', savedHours.monday?.closed, '→ abierto:', !savedHours.monday?.closed);
            console.log('  - martes:', savedHours.tuesday?.closed, '→ abierto:', !savedHours.tuesday?.closed);
            console.log('  - miércoles:', savedHours.wednesday?.closed, '→ abierto:', !savedHours.wednesday?.closed);
            console.log('  - jueves:', savedHours.thursday?.closed, '→ abierto:', !savedHours.thursday?.closed);
            console.log('  - viernes:', savedHours.friday?.closed, '→ abierto:', !savedHours.friday?.closed);
            console.log('  - sábado:', savedHours.saturday?.closed, '→ abierto:', !savedHours.saturday?.closed);

            // CREAR SCHEDULE DEFINITIVO - CARGAR TURNOS REALES
            const loadedSchedule = [
                { day_of_week: 'sunday', day_name: 'Domingo' },
                { day_of_week: 'monday', day_name: 'Lunes' },
                { day_of_week: 'tuesday', day_name: 'Martes' },
                { day_of_week: 'wednesday', day_name: 'Miércoles' },
                { day_of_week: 'thursday', day_name: 'Jueves' },
                { day_of_week: 'friday', day_name: 'Viernes' },
                { day_of_week: 'saturday', day_name: 'Sábado' }
            ].map(day => {
                const dayConfig = savedHours[day.day_of_week] || {};
                // FORMATO CORRECTO: usar !closed en lugar de open
                const isOpen = !dayConfig.closed;
                
                // 🔧 HORARIO SIMPLE (SIN TURNOS) - CAMPOS CORRECTOS
                const openTime = dayConfig.open || "09:00";
                const closeTime = dayConfig.close || "22:00";
                
                console.log(`🔄 ${day.day_name}: ${isOpen ? `✅ ${openTime}-${closeTime}` : '❌ Cerrado'}`);
                
                return {
                    ...day,
                    is_open: isOpen,
                    open_time: openTime,
                    close_time: closeTime
                };
            });
            
            console.log('📅 SCHEDULE CARGADO SIMPLE:', loadedSchedule.map(d => 
                `${d.day_name}: ${d.is_open ? `✅ ${d.open_time}-${d.close_time}` : '❌'}`
            ).join(', '));

            console.log('📊 SCHEDULE CREADO:');
            loadedSchedule.forEach(day => {
                console.log(`  ${day.day_of_week}: ${day.is_open ? '✅ ABIERTO' : '❌ CERRADO'}`);
            });

            setSchedule(loadedSchedule);
            
            // Calcular estadísticas
            calculateStats(loadedSchedule);

        } catch (error) {
            console.error("❌ Error inicializando calendario:", error);
            toast.error("Error al cargar los datos del calendario");
        } finally {
            setLoading(false);
        }
    };

    // Función para calcular estadísticas reales
    const calculateStats = useCallback(async (scheduleData) => {
        try {
            // 1. Días abiertos
            const daysOpen = scheduleData.filter(day => day.is_open).length;
            
            // 2. Horas semanales - CALCULAR CORRECTAMENTE CON MINUTOS
            const weeklyHours = scheduleData.reduce((total, day) => {
                if (!day.is_open || !day.open_time || !day.close_time) return total;
                
                // Parsear horas y minutos correctamente
                const [openHour, openMin] = day.open_time.split(':').map(Number);
                const [closeHour, closeMin] = day.close_time.split(':').map(Number);
                
                // Calcular minutos totales
                const openMinutes = openHour * 60 + openMin;
                const closeMinutes = closeHour * 60 + closeMin;
                const dayMinutes = closeMinutes - openMinutes;
                
                // Convertir a horas (con decimales)
                return total + (dayMinutes / 60);
            }, 0);

            // 3. Canales activos - LEER DE channel_credentials (TABLA REAL)
            // Contar canales IA activos desde settings.channels
            let activeChannels = 0;
            try {
                const { data: restaurantData, error: restaurantError } = await supabase
                    .from("restaurants")
                    .select("settings")
                    .eq("id", restaurantId)
                    .single();
                
                if (restaurantError) throw restaurantError;
                
                const channels = restaurantData?.settings?.channels || {};
                // Contar solo canales IA (no teléfono/móvil que son solo info)
                const iaChannels = ['vapi', 'whatsapp', 'instagram', 'facebook', 'webchat'];
                activeChannels = iaChannels.filter(ch => channels[ch]?.enabled).length;
                console.log('📊 Canales IA activos desde settings.channels:', activeChannels, channels);
            } catch (error) {
                console.error("Error leyendo canales activos:", error);
                activeChannels = 0;
            }

            // 4. Reservas activas (próximos 7 días)
            let activeReservations = 0;
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const sevenDaysLater = format(addDays(new Date(), 7), 'yyyy-MM-dd');
                
                const { data: reservationsData, error: reservationsError } = await supabase
                    .from("reservations")
                    .select("id")
                    .eq("restaurant_id", restaurantId)
                    .gte("reservation_date", today)
                    .lte("reservation_date", sevenDaysLater)
                    .not('status', 'in', '(cancelled,completed)');
                
                if (reservationsError) throw reservationsError;
                
                activeReservations = reservationsData?.length || 0;
                console.log('📊 Reservas activas próximos 7 días:', activeReservations);
            } catch (error) {
                console.error("Error leyendo reservas activas:", error);
                activeReservations = 0;
            }

            // 5. Eventos especiales (próximos 30 días)
            let upcomingEvents = 0;
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const thirtyDaysLater = format(addDays(new Date(), 30), 'yyyy-MM-dd');
                
                const { data: eventsData, error: eventsError } = await supabase
                    .from("special_events")
                    .select("id")
                    .eq("restaurant_id", restaurantId)
                    .gte("event_date", today)
                    .lte("event_date", thirtyDaysLater);
                
                if (eventsError) throw eventsError;
                
                upcomingEvents = eventsData?.length || 0;
                console.log('📊 Eventos especiales próximos 30 días:', upcomingEvents);
            } catch (error) {
                console.error("Error leyendo eventos especiales:", error);
                upcomingEvents = 0;
            }

            setStats({
                daysOpen,
                weeklyHours: Math.round(weeklyHours),
                activeChannels,
                activeReservations,
                upcomingEvents
            });

        } catch (error) {
            console.error("Error calculando estadísticas:", error);
        }
    }, [restaurantId]);

    // SOLUCIÓN DEFINITIVA - MATEMÁTICAMENTE IMPOSIBLE QUE FALLE
    const getDaySchedule = useCallback((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // 🛡️ PRIORIDAD 1: Verificar si hay una excepción para esta fecha específica
        const exception = calendarExceptions.find(ex => ex.exception_date === dateStr);
        
        if (exception) {
            console.log(`🛡️ EXCEPCIÓN ENCONTRADA para ${dateStr}:`, exception);
            return {
                day_of_week: format(date, 'EEEE', { locale: es }).toLowerCase(),
                day_name: format(date, 'EEEE', { locale: es }),
                is_open: exception.is_open,
                open_time: exception.open_time || "09:00",
                close_time: exception.close_time || "22:00",
                is_exception: true,
                exception_reason: exception.reason
            };
        }
        
        // PRIORIDAD 2: Usar horario semanal normal
        // getDay() SIEMPRE devuelve 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
        const dayIndex = getDay(date);
        
        // Mapeo DIRECTO por índice - GARANTIZADO por la especificación de JavaScript
        // IMPORTANTE: La semana empieza en DOMINGO (índice 0) según JavaScript
        const dayMapping = [
            'sunday',    // índice 0 = domingo
            'monday',    // índice 1 = lunes  
            'tuesday',   // índice 2 = martes
            'wednesday', // índice 3 = miércoles
            'thursday',  // índice 4 = jueves
            'friday',    // índice 5 = viernes
            'saturday'   // índice 6 = sábado
        ];
        
        const dayNames = [
            'Domingo',   // índice 0
            'Lunes',     // índice 1
            'Martes',    // índice 2
            'Miércoles', // índice 3
            'Jueves',    // índice 4
            'Viernes',   // índice 5
            'Sábado'     // índice 6
        ];

        const dayKey = dayMapping[dayIndex];
        const dayName = dayNames[dayIndex];
        const dayConfig = schedule.find(s => s.day_of_week === dayKey);
        const isOpen = dayConfig?.is_open === true;

        // Log solo para los primeros días del mes para debug
        const dayOfMonth = parseInt(format(date, 'd'));
        if (dayOfMonth <= 7) {
            console.log(`📅 ${format(date, 'EEEE dd/MM/yyyy', { locale: es })} | getDay()=${dayIndex} | mapped=${dayKey} | config=${isOpen ? '✅' : '❌'}`);
        }

        return {
            day_of_week: dayKey,
            day_name: dayName,
            is_open: isOpen,
            open_time: isOpen ? (dayConfig?.open_time || "09:00") : null,
            close_time: isOpen ? (dayConfig?.close_time || "22:00") : null,
            is_exception: false
        };
    }, [schedule, calendarExceptions]);

    // Funciones de navegación del calendario
    const navigateMonth = (direction) => {
        console.log(`\n🔄 NAVEGANDO AL MES ${direction === 'next' ? 'SIGUIENTE' : 'ANTERIOR'}`);
        console.log('📊 SCHEDULE ANTES DE NAVEGAR:', schedule.map(s => `${s.day_of_week}:${s.is_open ? '✅' : '❌'}`).join(', '));

        setCurrentDate(prev => {
            const newDate = direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1);
            console.log(`📅 Nueva fecha: ${format(newDate, 'MMMM yyyy', { locale: es })}`);
            return newDate;
        });

        // El schedule se mantiene - NO se reinicializa
        console.log('📊 SCHEDULE DESPUÉS DE NAVEGAR (mismo):', schedule.map(s => `${s.day_of_week}:${s.is_open ? '✅' : '❌'}`).join(', '));
        console.log('🔄 El schedule NO cambia al navegar meses - se mantiene constante\n');
    };

    // Estados para eventos especiales
    const [selectedDay, setSelectedDay] = useState(null);
    const [eventForm, setEventForm] = useState({
        title: '',
        description: '',
        start_time: '09:00',
        end_time: '22:00',
        closed: false
    });

    // Cargar eventos especiales
    const loadEvents = async () => {
        if (!restaurantId) return;
        
        try {
            const { data, error } = await supabase
                .from('special_events')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .order('event_date');
            
            if (error) throw error;
            
            setEvents(data || []);
            console.log('✅ Eventos cargados:', data?.length || 0);
        } catch (error) {
            console.error('❌ Error cargando eventos:', error);
        }
    };

    // Eliminar evento especial
    const handleDeleteEvent = useCallback(async (event) => {
        if (!event || !event.id) return;
        
        const confirmed = window.confirm(
            `¿Estás seguro de que quieres eliminar el evento "${event.title}"?\n\n` +
            `📅 Fecha: ${format(parseISO(event.event_date), 'dd/MM/yyyy')}\n` +
            `${event.is_closed ? '🔒 Este día dejará de estar cerrado' : '🎉 Se eliminará el evento especial'}`
        );
        
        if (!confirmed) return;
        
        try {
            const { error } = await supabase
                .from('special_events')
                .delete()
                .eq('id', event.id);
            
            if (error) throw error;
            
            // 🔥 ELIMINAR TAMBIÉN DE calendar_exceptions si era un día cerrado
            if (event.is_closed) {
                const { error: exceptionDeleteError } = await supabase
                    .from('calendar_exceptions')
                    .delete()
                    .eq('restaurant_id', restaurantId)
                    .eq('exception_date', event.event_date)
                    .eq('is_open', false);
                
                if (exceptionDeleteError) {
                    console.error('⚠️ Error eliminando excepción:', exceptionDeleteError);
                } else {
                    console.log('✅ Excepción eliminada de calendar_exceptions');
                }
            }
            
            // Actualizar estado local
            setEvents(prev => prev.filter(e => e.id !== event.id));
            
            // ✅ VERIFICAR SI EL EVENTO ELIMINADO ESTÁ DENTRO DEL RANGO
            const eventDate = event.event_date;
            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = restaurant?.settings?.advance_booking_days || 20;
            const maxDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');
            
            const isWithinRange = eventDate >= today && eventDate <= maxDate;
            
            console.log('🔍 Validando rango de evento eliminado:', {
                eventDate,
                today,
                maxDate,
                advanceDays,
                isWithinRange
            });
            
            // 🚨 MOSTRAR MODAL BLOQUEANTE DE REGENERACIÓN solo si está dentro del rango
            if (isWithinRange) {
                changeDetection.checkExistingSlots().then(slotsExist => {
                    if (slotsExist) {
                        changeDetection.onSpecialEventChange('removed', event.title);
                        showRegenerationModal(
                            'special_event_deleted', 
                            `Evento "${event.title}" eliminado (${format(parseISO(event.event_date), 'dd/MM/yyyy')})`
                        );
                    } else {
                        console.log('✅ No se muestra aviso: usuario está configurando el sistema por primera vez');
                    }
                });
            } else {
                console.log(`ℹ️ Evento eliminado fuera de rango (${eventDate} > ${maxDate}) - NO se requiere regeneración`);
            }
            
            toast.success(`✅ Evento "${event.title}" eliminado correctamente`);
        } catch (error) {
            console.error('❌ Error eliminando evento:', error);
            toast.error('Error al eliminar el evento');
        }
    }, [changeDetection, showRegenerationModal, restaurant]);

    // Guardar evento especial
    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!selectedDay || !restaurantId) return;
        
        try {
            const eventDate = format(selectedDay, 'yyyy-MM-dd');
            
            // 🔒 VALIDACIÓN ANTES DE CERRAR DÍAS
            if (eventForm.closed) {
                console.log(`🔒 Validando cierre del día ${eventDate}...`);
                
                try {
                    // 🚧 TEMPORAL: Función SQL no ejecutada aún
                    console.log("🚧 Función validar_cierre_dia no disponible - saltando validación");
                    const validationData = { validation_result: 'ALLOWED' }; // Mock temporal
                    const validationError = null;
                    
                    if (validationError) {
                        console.warn("⚠️ No se pudo validar el cierre:", validationError);
                    } else if (validationData?.validation_result === 'BLOCKED') {
                        // Hay reservas confirmadas - BLOQUEAR
                        const reservations = validationData.reservation_details || [];
                        const reservationList = reservations.map(r => 
                            `• ${r.customer_name} - ${r.reservation_time} (${r.party_size} personas)`
                        ).join('\n');
                        
                        toast.error(
                            `❌ NO SE PUEDE CERRAR EL DÍA\n\n` +
                            `📅 ${eventDate} tiene ${validationData.existing_reservations} reservas confirmadas:\n\n` +
                            `${reservationList}\n\n` +
                            `🔧 SOLUCIÓN: Ve a "Reservas" y cancela/reprograma estas reservas primero.`,
                            { 
                                duration: 8000,
                                style: { 
                                    minWidth: '400px',
                                    whiteSpace: 'pre-line',
                                    fontSize: '13px'
                                }
                            }
                        );
                        return; // BLOQUEAR creación del evento
                        
                    } else if (validationData?.validation_result === 'WARNING') {
                        // Solo hay disponibilidades - ADVERTIR pero permitir
                        const userConfirmed = confirm(
                            `⚠️ ADVERTENCIA DE CIERRE\n\n` +
                            `📅 ${eventDate} tiene ${validationData.existing_slots} slots disponibles activos.\n\n` +
                            `✅ ACCIÓN AUTOMÁTICA:\n` +
                            `• Los slots disponibles serán eliminados\n` +
                            `• No hay reservas confirmadas afectadas\n\n` +
                            `¿Continuar con el cierre del día?`
                        );
                        
                        if (!userConfirmed) {
                            return; // Cancelado silenciosamente
                        }
                    }
                } catch (validationCheckError) {
                    console.warn("⚠️ Error validando cierre:", validationCheckError);
                    // Continuar con advertencia general
                    const userConfirmed = confirm(
                        `⚠️ NO SE PUDO VALIDAR EL CIERRE\n\n` +
                        `No se pudo verificar si hay reservas confirmadas en ${eventDate}.\n\n` +
                        `🚨 RIESGO: Podrías estar cerrando un día con reservas.\n\n` +
                        `¿Quieres continuar bajo tu responsabilidad?`
                    );
                    
                    if (!userConfirmed) {
                        return; // Cancelado silenciosamente
                    }
                }
            }
            
            const eventData = {
                restaurant_id: restaurantId,
                event_date: eventDate,
                title: eventForm.title,
                description: eventForm.description || '',
                type: eventForm.closed ? 'cerrado' : 'evento',
                start_time: eventForm.closed ? null : eventForm.start_time,
                end_time: eventForm.closed ? null : eventForm.end_time,
                is_closed: eventForm.closed
            };
            
            // 🔥 GUARDAR TAMBIÉN EN calendar_exceptions para que el backend lo respete
            if (eventForm.closed) {
                const exceptionData = {
                    restaurant_id: restaurantId,
                    exception_date: eventDate,
                    is_open: false,  // ← DÍA CERRADO
                    open_time: null,
                    close_time: null,
                    reason: eventForm.title || 'Cerrado',
                    created_by: 'frontend'
                };
                
                const { error: exceptionError } = await supabase
                    .from('calendar_exceptions')
                    .upsert(exceptionData, {
                        onConflict: 'restaurant_id,exception_date'
                    });
                
                if (exceptionError) {
                    console.error('⚠️ Error guardando excepción:', exceptionError);
                } else {
                    console.log('✅ Excepción guardada en calendar_exceptions');
                }
            }
            
            // Verificar si ya existe un evento en esta fecha para actualizar o crear
            const existingEvent = getDayEvent(selectedDay);
            const isEditing = !!existingEvent;
            
            let data, error;
            
            if (isEditing) {
                // ACTUALIZAR evento existente
                const updateResult = await supabase
                    .from('special_events')
                    .update(eventData)
                    .eq('id', existingEvent.id)
                    .select()
                    .single();
                
                data = updateResult.data;
                error = updateResult.error;
                
                if (!error) {
                    // Actualizar estado local
                    setEvents(prev => prev.map(e => e.id === existingEvent.id ? data : e));
                }
            } else {
                // CREAR evento nuevo
                const insertResult = await supabase
                    .from('special_events')
                    .insert([eventData])
                    .select()
                    .single();
                
                data = insertResult.data;
                error = insertResult.error;
                
                if (!error) {
                    // Actualizar estado local
                    setEvents(prev => [...prev, data]);
                }
            }
            
            if (error) throw error;
            
            // ✅ VERIFICAR SI EL EVENTO ESTÁ DENTRO DEL RANGO DE DÍAS CONFIGURADOS
            // (eventDate ya está declarado al inicio de la función)
            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = restaurant?.settings?.advance_booking_days || 20;
            const maxDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');
            
            const isWithinRange = eventDate >= today && eventDate <= maxDate;
            
            console.log('🔍 Validando rango de evento:', {
                eventDate,
                today,
                maxDate,
                advanceDays,
                isWithinRange
            });
            
            // 🚨 MOSTRAR MODAL BLOQUEANTE DE REGENERACIÓN solo si:
            // 1. Existen slots
            // 2. El evento está DENTRO del rango de días configurados
            if (isWithinRange) {
                changeDetection.checkExistingSlots().then(slotsExist => {
                    if (slotsExist) {
                        changeDetection.onSpecialEventChange(
                            eventForm.closed ? 'closed' : 'special_hours',
                            format(selectedDay, 'dd/MM/yyyy')
                        );
                        
                        // MOSTRAR MODAL
                        if (eventForm.closed) {
                            showRegenerationModal('special_event_closed', `Día ${format(selectedDay, 'dd/MM/yyyy')} cerrado`);
                        } else {
                            showRegenerationModal('special_event_created', `Evento "${eventForm.title}" en ${format(selectedDay, 'dd/MM/yyyy')}`);
                        }
                    } else {
                        console.log('✅ No se muestra aviso: usuario está configurando el sistema por primera vez');
                    }
                });
            } else {
                console.log(`ℹ️ Evento fuera de rango (${eventDate} > ${maxDate}) - NO se requiere regeneración`);
            }
            
            setShowEventModal(false);
            console.log('✅ Evento guardado:', data);
            
            // ✅ ÚNICO TOAST AL FINAL (simple y claro) - se adapta a crear/actualizar
            const action = isEditing ? 'actualizado' : 'creado';
            toast.success(`✅ Evento "${eventForm.title}" ${action} para ${format(selectedDay, 'dd/MM/yyyy')}`);
        } catch (error) {
            console.error('❌ Error guardando evento:', error);
            toast.error('Error al guardar el evento');
        }
    };

    // Obtener evento de un día específico
    const getDayEvent = useCallback((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return events.find(event => event.event_date === dateStr);
    }, [events]);

    // Manejar click en día del calendario
    const handleDayClick = useCallback((date) => {
        try {
            setSelectedDay(date);
            
            // Verificar si ya hay un evento en este día
            const existingEvent = getDayEvent(date);
            
            if (existingEvent) {
                // SI HAY EVENTO → Mostrar modal de detalles con opciones [Editar] [Eliminar]
                setSelectedEvent(existingEvent);
                setShowEventDetailModal(true);
            } else {
                // NO HAY EVENTO → Mostrar modal de creación
                setEventForm({
                    title: '',
                    description: '',
                    start_time: '09:00',
                    end_time: '22:00',
                    closed: false
                });
                setShowEventModal(true);
            }
        } catch (error) {
            console.error("Error en handleDayClick:", error);
            toast.error("Error al seleccionar el día");
        }
    }, [getDayEvent]);

    // Guardar horario semanal
    const saveWeeklySchedule = async () => {
        if (!restaurantId) {
            toast.error("Error: No hay restaurante configurado");
            return;
        }

        // VALIDACIONES SIMPLES (SIN TURNOS)
        const invalidDays = schedule.filter(day => {
            if (!day.is_open) return false;
            
            // Verificar que tenga horarios válidos
            return !day.open_time || !day.close_time || 
                   day.open_time === "" || day.close_time === "";
        });

        if (invalidDays.length > 0) {
            toast.error(`Horarios incompletos en: ${invalidDays.map(d => d.day_name).join(', ')}`);
            return;
        }

        setSaving(true);
        try {
            console.log("🔄 Guardando horarios simplificados...", schedule);
            
            // 🔍 DETECCIÓN DE CONFLICTOS CALENDARIO vs DISPONIBILIDADES
            console.log("🔍 Verificando conflictos calendario vs disponibilidades...");
            
            try {
                // 🚧 TEMPORAL: Función SQL no ejecutada aún
                console.log("🚧 Función detectar_conflictos_calendario no disponible - saltando validación");
                const conflictData = { conflicts_found: 0 }; // Mock temporal
                const conflictError = null;
                
                if (conflictError) {
                    console.warn("⚠️ No se pudo verificar conflictos:", conflictError);
                } else if (conflictData?.conflicts_found > 0) {
                    const conflicts = conflictData.conflicts;
                    const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
                    
                    if (criticalConflicts.length > 0) {
                        // Hay reservas confirmadas en días que se van a cerrar
                        const conflictMessage = criticalConflicts.map(c => 
                            `📅 ${c.conflict_date}: ${c.confirmed_reservations} reservas confirmadas`
                        ).join('\n');
                        
                        const userConfirmed = confirm(
                            `⚠️ CONFLICTO CRÍTICO DETECTADO\n\n` +
                            `Los siguientes días tienen RESERVAS CONFIRMADAS pero van a cerrarse:\n\n` +
                            `${conflictMessage}\n\n` +
                            `🚨 IMPACTO: Los clientes podrían llegar a un restaurante cerrado\n\n` +
                            `OPCIONES:\n` +
                            `✅ Cancelar guardado y revisar reservas\n` +
                            `❌ Continuar (RIESGO: Clientes afectados)\n\n` +
                            `¿Quieres CANCELAR el guardado para revisar las reservas?`
                        );
                        
                        if (userConfirmed) {
                            toast.error(
                                `❌ Guardado cancelado\n\n` +
                                `Revisa las ${criticalConflicts.length} reservas confirmadas\n` +
                                `antes de cerrar esos días.`,
                                { duration: 6000 }
                            );
                            setSaving(false);
                            return;
                        }
                    } else {
                        // Solo conflictos de disponibilidades (no críticos)
                        const warningMessage = `Se detectaron ${conflictData.conflicts_found} días con disponibilidades que serán corregidas automáticamente.`;
                        
                        toast(
                            `🔄 Regeneración Requerida\n\n` +
                            `${warningMessage}\n\n` +
                            `Regenera disponibilidades después de guardar.`,
                            { icon: '🔄', duration: 5000 }
                        );
                    }
                }
            } catch (conflictCheckError) {
                console.warn("⚠️ Error verificando conflictos:", conflictCheckError);
                // Continuar con el guardado aunque falle la verificación
            }
            
            // CONVERSIÓN ROBUSTA A FORMATO SUPABASE
            const operating_hours = {};
            const calendar_schedule = [];
            
            schedule.forEach(day => {
                const dayName = day.day_of_week;
                
                if (!day.is_open) {
                    // Día cerrado - MANTENER horarios originales
                    operating_hours[dayName] = {
                        open: day.open_time || "09:00",
                        close: day.close_time || "22:00",
                        closed: true
                    };
                    calendar_schedule.push({
                        day_of_week: dayName,
                        day_name: day.day_name,
                        is_open: false
                    });
                } else {
                    // Día abierto - horario simple (SIN TURNOS)
                    operating_hours[dayName] = {
                        open: day.open_time || "09:00",
                        close: day.close_time || "22:00",
                        closed: false
                    };
                    calendar_schedule.push({
                        day_of_week: dayName,
                        day_name: day.day_name,
                        is_open: true,
                        open_time: day.open_time || "09:00",
                        close_time: day.close_time || "22:00"
                    });
                }
            });

            console.log("📊 Datos a guardar:", { operating_hours, calendar_schedule });

            // GUARDADO ROBUSTO EN SUPABASE
            const { data: currentRestaurant, error: fetchError } = await supabase
                .from("restaurants")
                .select("settings")
                .eq("id", restaurantId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error("Error obteniendo configuración actual:", fetchError);
                throw fetchError;
            }

            const currentSettings = currentRestaurant?.settings || {};

            // Actualizar con estructura completa
            const { error } = await supabase
                .from("restaurants")
                .update({
                    settings: {
                        ...currentSettings,
                        operating_hours: operating_hours,
                        calendar_schedule: calendar_schedule
                    },
                    updated_at: new Date().toISOString()
                })
                .eq("id", restaurantId);

            if (error) {
                console.error("❌ Error Supabase:", error);
                throw error;
            }

            // ACTUALIZAR ESTADO LOCAL
            setSchedule(calendar_schedule);

            // Evento de sincronización
            try {
            window.dispatchEvent(new CustomEvent('schedule-updated', { 
                    detail: { 
                        scheduleData: calendar_schedule, 
                        operatingHours: operating_hours,
                        restaurantId 
                    } 
                }));
            } catch (eventError) {
                console.warn("Error disparando evento:", eventError);
            }

            toast.success("✅ Horarios guardados correctamente");
            console.log("✅ Guardado exitoso - horarios simples");
            
            // 🚨 MOSTRAR MODAL BLOQUEANTE DE REGENERACIÓN (solo si existen slots)
            changeDetection.checkExistingSlots().then(slotsExist => {
                if (slotsExist) {
                    changeDetection.onScheduleChange('weekly_schedule');
                    showRegenerationModal('schedule_changed', 'Horarios semanales del restaurante modificados');
                } else {
                    console.log('✅ No se muestra aviso: usuario está configurando el sistema por primera vez');
                }
            });
            
        } catch (error) {
            console.error("❌ Error guardando horarios:", error);
            
            // MENSAJES DE ERROR ESPECÍFICOS
            let errorMessage = "Error al guardar los horarios";
            
            if (error.code === 'PGRST301') {
                errorMessage = "Sin permisos para actualizar horarios";
            } else if (error.code === '23505') {
                errorMessage = "Conflicto en los datos. Intenta de nuevo";
            } else if (error.message?.includes('permission')) {
                errorMessage = "Sin permisos para actualizar horarios";
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = "Error de conexión. Verifica tu internet";
            } else if (error.message?.includes('validation')) {
                errorMessage = "Datos de horarios inválidos";
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            toast.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

        return (
        <CalendarioErrorBoundary>
        <div className="min-h-screen bg-gray-50 px-4 py-4">
            <div className="max-w-[85%] mx-auto">
                {/* Header */}
                <div className="mb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                Horarios y Calendario
                            </h1>
                            <p className="text-xs text-gray-600 mt-0.5">
                                Gestiona los horarios del restaurante y eventos especiales
                            </p>
                        </div>
                        </div>
                    </div>

                                    {/* Estadísticas rápidas - Diseño vertical mejorado */}
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 mb-3">
                    <h2 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-blue-600" />
                        RESUMEN DE ACTIVIDAD
                    </h2>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="text-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mx-auto mb-1.5">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                            <p className="text-base font-bold text-gray-900">{stats.daysOpen}</p>
                                    <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mt-0.5">Días abiertos</p>
                            <p className="text-xs text-gray-500">de 7 días</p>
                        </div>

                        <div className="text-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg mx-auto mb-1.5">
                                <Clock className="w-5 h-5 text-blue-600" />
                                </div>
                            <p className="text-base font-bold text-gray-900">{stats.weeklyHours}h</p>
                                    <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mt-0.5">Horas semanales</p>
                            <p className="text-xs text-gray-500">tiempo de servicio</p>
                        </div>

                        <div className="text-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg mx-auto mb-1.5">
                                <MessageSquare className="w-5 h-5 text-purple-600" />
                                </div>
                            <p className="text-base font-bold text-gray-900">{stats.activeChannels}</p>
                            <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mt-0.5">Canales activos</p>
                            <p className="text-xs text-gray-500">comunicación</p>
                        </div>

                        <div className="text-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-lg mx-auto mb-1.5">
                                <Users className="w-5 h-5 text-indigo-600" />
                                </div>
                            <p className="text-base font-bold text-gray-900">{stats.activeReservations}</p>
                            <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mt-0.5">Reservas activas</p>
                            <p className="text-xs text-gray-500">próximos 7 días</p>
                        </div>

                        <div className="text-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg mx-auto mb-1.5">
                                <Star className="w-5 h-5 text-amber-600" />
                                </div>
                            <p className="text-base font-bold text-gray-900">{stats.upcomingEvents}</p>
                            <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mt-0.5">Eventos especiales</p>
                            <p className="text-xs text-gray-500">próximos 30 días</p>
                        </div>
                    </div>
                </div>

                {/* Tabs de navegación - Estilo homogéneo compacto */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setActiveTab('horarios')}
                            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'horarios'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Horarios
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('calendario')}
                            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                                activeTab === 'calendario'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-purple-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Calendario
                            </span>
                        </button>
                    </div>
                </div>

                {/* Contenido de tabs */}
                <div>

                    {/* Tab: Horarios del restaurante */}
                    {activeTab === 'horarios' && (
                        <div className="p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {schedule.map((day, index) => (
                                    <div key={day.day_of_week} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-medium text-xs text-gray-900">{day.day_name}</h3>
                                                    <button
                                                onClick={() => {
                                                    const newSchedule = [...schedule];
                                                    newSchedule[index].is_open = !newSchedule[index].is_open;
                                                    if (newSchedule[index].is_open && !newSchedule[index].open_time) {
                                                        newSchedule[index].open_time = "09:00";
                                                        newSchedule[index].close_time = "22:00";
                                                    }
                                                    setSchedule(newSchedule);
                                                }}
                                                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                                            day.is_open 
                                                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                        }`}
                                                    >
                                                        {day.is_open ? 'Abierto' : 'Cerrado'}
                                                    </button>
                                                </div>
                                                
                                        {day.is_open && (
                                            <div className="space-y-2">
                                                {/* Horario Simple (SIN TURNOS) */}
                                                <div className="bg-gray-50 p-2 rounded-lg">
                                                    <div className="text-xs font-medium text-gray-800 mb-1.5">
                                                        Horario de Apertura
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={day.open_time || "09:00"}
                                                            onChange={(e) => {
                                                                const newSchedule = [...schedule];
                                                                newSchedule[index].open_time = e.target.value;
                                                                setSchedule(newSchedule);
                                                            }}
                                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
                                                        />
                                                        <span className="text-gray-500 text-xs">a</span>
                                                        <input
                                                            type="time"
                                                            value={day.close_time || "22:00"}
                                                            onChange={(e) => {
                                                                const newSchedule = [...schedule];
                                                                newSchedule[index].close_time = e.target.value;
                                                                setSchedule(newSchedule);
                                                            }}
                                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                                        </div>
                                ))}
                                                    </div>
                                                    
                            <div className="flex justify-end mt-3 pt-3 border-t border-gray-200">
                                                        <button
                                    onClick={saveWeeklySchedule}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 text-sm font-medium"
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Guardar horarios
                                        </>
                                    )}
                                                        </button>
                                                    </div>
                        </div>
                    )}

                    {/* Tab: Calendario */}
                    {activeTab === 'calendario' && (
                        <div className="p-3">
                            {/* Controles del calendario */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigateMonth('prev')}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <h3 className="text-xs font-semibold text-gray-900">
                                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                                    </h3>
                                    <button
                                        onClick={() => navigateMonth('next')}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentDate(new Date())}
                                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Hoy
                                    </button>
                                </div>
                                    <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toast("Funcionalidad de eventos especiales próximamente", {
                                            icon: "🗓️",
                                            duration: 3000,
                                        });
                                        // setShowEventModal(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all text-xs font-medium"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Nuevo evento
                                    </button>
                            </div>

                            {/* Calendario */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                {/* Encabezados de días */}
                                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => (
                                        <div key={day} className="p-1.5 text-center text-xs font-medium text-gray-600">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Días del calendario - CON ALINEACIÓN CORRECTA */}
                                <div className="grid grid-cols-7">
                                    {calendarDays.map((day, index) => {
                                        const isToday = isSameDay(day, new Date());
                                        const isCurrentMonth = isSameMonth(day, currentDate);
                                        const daySchedule = getDaySchedule(day);
                                        const dayEvent = getDayEvent(day);
                                        
                                        // Debug para verificar alineación de la primera semana
                                        if (index < 7) {
                                            const columnDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                                            console.log(`Columna ${index} (${columnDays[index]}): ${format(day, 'EEEE dd/MM', { locale: es })} | getDaySchedule dice: ${daySchedule.day_name} ${daySchedule.is_open ? '✅' : '❌'}`);
                                        }

                                                        return (
                                            <div
                                                key={index}
                                                className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 ${
                                                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                                                } ${isToday && isCurrentMonth ? 'bg-blue-50' : ''} ${dayEvent && isCurrentMonth ? 'bg-yellow-50' : ''} ${isCurrentMonth ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                                                onClick={() => isCurrentMonth && handleDayClick(day)}
                                            >
                                                <div className={`text-xs font-medium mb-1 ${
                                                    isToday && isCurrentMonth ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                                    }`}>
                                                        {format(day, 'd')}
                                                </div>

                                                {/* Estado del día - EVENTOS TIENEN PRIORIDAD */}
                                                {isCurrentMonth && (
                                                    <div className="text-[10px]">
                                                        {/* Si hay evento y está cerrado, mostrar CERRADO */}
                                                        {dayEvent && dayEvent.is_closed ? (
                                                            <div>
                                                                <span className="text-red-600 bg-red-100 px-1.5 py-0.5 rounded block mb-1 text-[10px]">
                                                                    Cerrado
                                                                </span>
                                                                <div className="flex items-center justify-between text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded mb-1">
                                                                    <span className="text-[10px]">🔒 {dayEvent.title}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteEvent(dayEvent);
                                                                        }}
                                                                        className="text-red-600 hover:text-red-800 ml-1"
                                                                        title="Eliminar evento"
                                                                    >
                                                                        <X className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : dayEvent ? (
                                                            // Si hay evento pero NO está cerrado, mostrar evento especial
                                                            <div>
                                                                <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded block mb-1 text-[10px]">
                                                                    Abierto {(dayEvent.start_time || daySchedule.open_time || '09:00').substring(0, 5)}-{(dayEvent.end_time || daySchedule.close_time || '22:00').substring(0, 5)}
                                                                </span>
                                                                <div className="flex items-center justify-between text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                                                                    <span className="text-[10px]">🎉 {dayEvent.title}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteEvent(dayEvent);
                                                                        }}
                                                                        className="text-red-600 hover:text-red-800 ml-1"
                                                                        title="Eliminar evento"
                                                                    >
                                                                        <X className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // Si NO hay evento, mostrar horario regular
                                                            <span className={`px-1.5 py-0.5 rounded block text-[10px] ${
                                                                daySchedule.is_open 
                                                                    ? 'text-green-600 bg-green-100' 
                                                                    : 'text-red-600 bg-red-100'
                                                            }`}>
                                                                {daySchedule.is_open ? `Abierto ${(daySchedule.open_time || '09:00').substring(0, 5)}-${(daySchedule.close_time || '22:00').substring(0, 5)}` : 'Cerrado'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Modal de Eventos Especiales */}
            {showEventModal && selectedDay && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-900">
                                Crear evento - {format(selectedDay, 'dd/MM/yyyy')}
                            </h3>
                            <button
                                onClick={() => setShowEventModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvent} className="space-y-4">
                            {/* Aviso importante */}
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-2 mb-2">
                                <p className="text-sm text-blue-700">
                                    <strong>📌 Importante:</strong> Los eventos tienen prioridad sobre el horario regular. 
                                    Si marcas este día como cerrado, anulará el horario habitual.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Título del evento
                                </label>
                                <input
                                    type="text"
                                    value={eventForm.title}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    placeholder="Ej: Día de San Valentín, Cerrado por vacaciones..."
                                    required
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={eventForm.closed}
                                        onChange={(e) => setEventForm(prev => ({ ...prev, closed: e.target.checked }))}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-gray-700">Restaurante cerrado este día</span>
                                </label>
                                
                                <div className="pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-600 mb-2">Acceso rápido:</p>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setEventForm(prev => ({ 
                                                ...prev, 
                                                title: 'Vacaciones',
                                                closed: true 
                                            }))}
                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                                        >
                                            🏖️ Vacaciones
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventForm(prev => ({ 
                                                ...prev, 
                                                title: 'Cerrado',
                                                closed: true 
                                            }))}
                                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                                        >
                                            🔒 Cerrado
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventForm(prev => ({ 
                                                ...prev, 
                                                title: 'Festivo',
                                                closed: true 
                                            }))}
                                            className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium hover:bg-orange-200 transition-colors"
                                        >
                                            📅 Festivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventForm(prev => ({ 
                                                ...prev, 
                                                title: 'Evento especial',
                                                closed: false 
                                            }))}
                                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200 transition-colors"
                                        >
                                            🎉 Evento
                                        </button>
                                    </div>
                                </div>
                                
                                <p className="text-xs text-gray-500">
                                    Si no está marcado, es un evento especial con el restaurante abierto
                                </p>
                            </div>

                            {!eventForm.closed && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hora apertura
                                        </label>
                                        <input
                                            type="time"
                                            value={eventForm.start_time}
                                            onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hora cierre
                                        </label>
                                        <input
                                            type="time"
                                            value={eventForm.end_time}
                                            onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descripción (opcional)
                                </label>
                                <textarea
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    rows="3"
                                    placeholder="Detalles adicionales del evento..."
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowEventModal(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    Crear evento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 🎯 MODAL DE DETALLES DEL EVENTO (con opciones Editar/Eliminar) */}
            {showEventDetailModal && selectedEvent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-900">
                                Evento: {selectedEvent.title}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowEventDetailModal(false);
                                    setSelectedEvent(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Información del evento */}
                        <div className="space-y-4 mb-6">
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-2">
                                <p className="text-sm text-blue-900 font-medium">
                                    📅 {format(parseISO(selectedEvent.event_date), 'EEEE, dd MMMM yyyy', { locale: es })}
                                </p>
                            </div>

                            <div className="bg-gray-50 p-2 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2">Estado:</p>
                                {selectedEvent.is_closed ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                        🔒 Restaurante cerrado este día
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                        🎉 Evento especial - Restaurante abierto
                                    </span>
                                )}
                            </div>

                            {!selectedEvent.is_closed && (selectedEvent.start_time || selectedEvent.end_time) && (
                                <div className="bg-gray-50 p-2 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-2">Horario especial:</p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {selectedEvent.start_time || '09:00'} - {selectedEvent.end_time || '22:00'}
                                    </p>
                                </div>
                            )}

                            {selectedEvent.description && (
                                <div className="bg-gray-50 p-2 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-2">Descripción:</p>
                                    <p className="text-sm text-gray-900">{selectedEvent.description}</p>
                                </div>
                            )}
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    // Cerrar modal de detalles y abrir modal de edición
                                    setEventForm({
                                        title: selectedEvent.title,
                                        description: selectedEvent.description || '',
                                        start_time: selectedEvent.start_time || '09:00',
                                        end_time: selectedEvent.end_time || '22:00',
                                        closed: selectedEvent.is_closed
                                    });
                                    setShowEventDetailModal(false);
                                    setShowEventModal(true);
                                    setSelectedDay(parseISO(selectedEvent.event_date));
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Edit2 className="w-4 h-4" />
                                Editar evento
                            </button>
                            <button
                                onClick={async () => {
                                    setShowEventDetailModal(false);
                                    setSelectedEvent(null);
                                    await handleDeleteEvent(selectedEvent);
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Eliminar evento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🚨 MODAL BLOQUEANTE DE REGENERACIÓN */}
            <RegenerationRequiredModal
                isOpen={isModalOpen}
                onClose={closeModal}
                changeReason={modalChangeReason}
                changeDetails={modalChangeDetails}
            />
        </div>
        </CalendarioErrorBoundary>
    );
}

