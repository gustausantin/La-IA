// src/pages/Calendario.jsx - Gestión PREMIUM de horarios y disponibilidad con IA
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useChannelStats } from '../hooks/useChannelStats';
import { useOccupancy } from '../hooks/useOccupancy';
import { useAvailabilityChangeDetection } from '../hooks/useAvailabilityChangeDetection';
import { useRegenerationModal } from '../hooks/useRegenerationModal';
import RegenerationRequiredModal from '../components/RegenerationRequiredModal';
import ProtectedReservationsInfoModal from '../components/ProtectedReservationsInfoModal';
import AutoSlotRegenerationService from '../services/AutoSlotRegenerationService';
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
    const { business, businessId: businessId, isReady, addNotification } = useAuthContext();
    const { channelStats } = useChannelStats();
    const { occupancy: occupancyData } = useOccupancy(7);
    const changeDetection = useAvailabilityChangeDetection(businessId);
    const { isModalOpen, modalChangeReason, modalChangeDetails, showRegenerationModal, closeModal } = useRegenerationModal();
    
    // 🛡️ Estados para modal de reservas protegidas
    const [protectedReservations, setProtectedReservations] = useState([]);
    const [showProtectedModal, setShowProtectedModal] = useState(false);

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
    
    // ⭐ Estados para modal de detalles de ausencia
    const [showAbsenceDetailModal, setShowAbsenceDetailModal] = useState(false);
    const [selectedAbsence, setSelectedAbsence] = useState(null);
    
    // ⭐ Estados para modal de lista de ausencias (cuando hay +1 más)
    const [showAbsenceListModal, setShowAbsenceListModal] = useState(false);
    const [selectedDayAbsences, setSelectedDayAbsences] = useState([]);

    // Estados para eventos especiales
    const [events, setEvents] = useState([]);

    // Estados para ausencias de empleados
    const [employeeAbsences, setEmployeeAbsences] = useState([]);

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
        if (businessId) {
            console.log('🚀 INICIALIZANDO CALENDARIO - Business ID:', businessId);
            
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
            loadEmployeeAbsences(); // ⭐ Cargar ausencias de empleados
        }
    }, [businessId]); // SOLO cuando cambia businessId, NO al navegar meses

    // DEBUG: Verificar schedule en cada render
    useEffect(() => {
        if (schedule.length > 0) {
            console.log('🔄 SCHEDULE ACTUAL EN RENDER:', schedule.map(s => `${s.day_of_week}:${s.is_open ? 'ABIERTO' : 'CERRADO'}`).join(', '));
        }
    });

    // Escuchar cambios de horarios desde Configuración
    useEffect(() => {
        const handleBusinessReload = (event) => {
            console.log("🔄 Calendario: Recargando horarios por cambio en Configuración");
            initializeData();
        };

        const handleScheduleUpdate = (event) => {
            console.log("🔄 Calendario: Horarios actualizados desde Configuración");
            initializeData();
        };

        const handleAbsencesUpdate = (event) => {
            console.log("🏖️ Calendario: Ausencias actualizadas desde Tu Equipo");
            loadEmployeeAbsences();
        };

        window.addEventListener('force-business-reload', handleBusinessReload);
        window.addEventListener('schedule-updated', handleScheduleUpdate);
        window.addEventListener('absences-updated', handleAbsencesUpdate); // ⭐ Nuevo listener
        
        // Nota: Removidos listeners de focus/visibility que causaban recargas innecesarias

        return () => {
            window.removeEventListener('force-business-reload', handleBusinessReload);
            window.removeEventListener('schedule-updated', handleScheduleUpdate);
            window.removeEventListener('absences-updated', handleAbsencesUpdate);
        };
    }, []);

    const initializeData = async () => {
        if (!businessId) return;
        
        setLoading(true);
        try {
            // Cargar horarios desde businesses.settings (donde están realmente guardados)
            const { data: businessData, error: scheduleError } = await supabase
                .from("businesses")
                .select("settings")
                .eq("id", businessId)
                .single();

            if (scheduleError) {
                console.error("❌ Error cargando horarios:", scheduleError);
            }

            // 🛡️ Cargar excepciones de calendario (días protegidos)
            const { data: exceptions, error: exceptionsError } = await supabase
                .from("calendar_exceptions")
                .select("*")
                .eq("business_id", businessId)
                .eq("is_open", true); // Solo días que deben estar abiertos

            if (exceptionsError) {
                console.error("❌ Error cargando excepciones:", exceptionsError);
            } else {
                console.log("🛡️ Excepciones cargadas:", exceptions);
                // Guardar excepciones en estado para usarlas en getDaySchedule
                setCalendarExceptions(exceptions || []);
            }

            let savedHours = businessData?.settings?.operating_hours || {};
            
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

            // CREAR SCHEDULE DEFINITIVO - CON SOPORTE DE TURNOS
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
                
                // 🔧 SOPORTE DE TURNOS - Cargar shifts si existen, sino crear uno por defecto
                let shifts = [];
                if (dayConfig.shifts && Array.isArray(dayConfig.shifts) && dayConfig.shifts.length > 0) {
                    shifts = dayConfig.shifts;
                } else {
                    // Crear un turno simple con open/close
                    shifts = [{ start: dayConfig.open || "09:00", end: dayConfig.close || "22:00" }];
                }
                
                console.log(`🔄 ${day.day_name}: ${isOpen ? `✅ ${shifts.map(s => `${s.start}-${s.end}`).join(', ')}` : '❌ Cerrado'}`);
                
                return {
                    ...day,
                    is_open: isOpen,
                    shifts: shifts,
                    // Legacy para compatibilidad
                    open_time: shifts[0]?.start || "09:00",
                    close_time: shifts[shifts.length - 1]?.end || "22:00"
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

        } catch (error) {
            console.error("❌ Error inicializando calendario:", error);
            toast.error("Error al cargar los datos del calendario");
        } finally {
            setLoading(false);
        }
    };


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
        closed: false,
        isRange: false, // Día único o rango
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    });

    // Cargar eventos especiales (excepciones de calendario)
    const loadEvents = async () => {
        if (!businessId) return;
        
        try {
            const { data, error } = await supabase
                .from('calendar_exceptions')
                .select('*')
                .eq('business_id', businessId)
                .order('exception_date');
            
            if (error) throw error;
            
            setEvents(data || []);
            console.log('✅ Eventos/Excepciones cargados:', data?.length || 0);
        } catch (error) {
            console.error('❌ Error cargando eventos:', error);
        }
    };

    // Cargar ausencias de TODOS los empleados
    const loadEmployeeAbsences = async () => {
        console.log('🏖️ [INICIO] loadEmployeeAbsences llamada');
        console.log('  - businessId:', businessId);
        
        if (!businessId) {
            console.log('  ⚠️ No hay businessId, saliendo...');
            return;
        }
        
        try {
            console.log('🔍 Ejecutando query de employee_absences...');
            
            const { data, error } = await supabase
                .from('employee_absences')
                .select(`
                    *,
                    employees!employee_absences_employee_id_fkey (
                        name,
                        color
                    )
                `)
                .eq('business_id', businessId)
                .eq('approved', true)
                .order('start_date', { ascending: true });
            
            console.log('🔍 Query completada. Error:', error, 'Data:', data);
            
            if (error) {
                console.error('❌ Error en query employee_absences:', error);
                console.error('   Detalles:', JSON.stringify(error, null, 2));
                throw error;
            }
            
            console.log('✅ Ausencias de empleados cargadas:', data?.length || 0);
            if (data && data.length > 0) {
                console.log('📋 Detalles de ausencias:', data.map(a => ({
                    empleado: a.employees?.name || 'Sin nombre',
                    desde: a.start_date,
                    hasta: a.end_date,
                    tipo: a.reason,
                    aprobado: a.approved
                })));
            } else {
                console.log('⚠️ No hay ausencias aprobadas para este negocio');
            }
            
            setEmployeeAbsences(data || []);
            console.log('🔄 Estado employeeAbsences actualizado, total:', (data || []).length);
        } catch (error) {
            console.error('❌ [ERROR CRÍTICO] Error cargando ausencias de empleados:', error);
            console.error('   Stack:', error.stack);
        }
        
        console.log('🏖️ [FIN] loadEmployeeAbsences completada');
    };

    // Eliminar evento especial
    const handleDeleteEvent = useCallback(async (event) => {
        if (!event || !event.id) return;
        
        const confirmed = window.confirm(
            `¿Estás seguro de que quieres eliminar el evento "${event.reason || 'Sin título'}"?\n\n` +
            `📅 Fecha: ${format(parseISO(event.exception_date), 'dd/MM/yyyy')}\n` +
            `${!event.is_open ? '🔒 Este día dejará de estar cerrado' : '🎉 Se eliminará el evento especial'}`
        );
        
        if (!confirmed) return;
        
        try {
            const { error } = await supabase
                .from('calendar_exceptions')
                .delete()
                .eq('id', event.id);
            
            if (error) throw error;
            
            console.log('✅ Evento eliminado de calendar_exceptions');
            
            // Actualizar estado local
            setEvents(prev => prev.filter(e => e.id !== event.id));
            setCalendarExceptions(prev => prev.filter(e => e.id !== event.id));
            
            // ✅ VERIFICAR SI EL EVENTO ELIMINADO ESTÁ DENTRO DEL RANGO
            const eventDate = event.exception_date;
            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = business?.settings?.advance_booking_days || 20;
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
                        changeDetection.onSpecialEventChange('removed', event.reason || 'Evento');
                        showRegenerationModal(
                            'special_event_deleted', 
                            `Evento "${event.reason || 'Sin título'}" eliminado (${format(parseISO(event.exception_date), 'dd/MM/yyyy')})`
                        );
                    } else {
                        console.log('✅ No se muestra aviso: usuario está configurando el sistema por primera vez');
                    }
                });
            } else {
                console.log(`ℹ️ Evento eliminado fuera de rango (${eventDate} > ${maxDate}) - NO se requiere regeneración`);
            }
            
            toast.success(`✅ Evento "${event.reason || 'Sin título'}" eliminado correctamente`);
        } catch (error) {
            console.error('❌ Error eliminando evento:', error);
            toast.error('Error al eliminar el evento');
        }
    }, [changeDetection, showRegenerationModal, business]);

    // Guardar evento especial (DÍA ÚNICO o RANGO DE FECHAS)
    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!businessId) return;
        
        try {
            // ⭐ GENERAR LISTA DE FECHAS (día único o rango)
            const startDate = new Date(eventForm.startDate + 'T00:00:00');
            const endDate = new Date(eventForm.endDate + 'T00:00:00');
            
            // Validar que la fecha de fin no sea anterior a la de inicio
            if (endDate < startDate) {
                toast.error('❌ La fecha de fin no puede ser anterior a la fecha de inicio');
                return;
            }
            
            // Generar array de fechas del rango
            const datesToProcess = eachDayOfInterval({ start: startDate, end: endDate });
            const dateStrings = datesToProcess.map(date => format(date, 'yyyy-MM-dd'));
            
            console.log(`📅 Procesando ${dateStrings.length} día(s):`, dateStrings);
            
            // 🔒 VALIDACIÓN: Si está marcado como cerrado, validar TODAS las fechas
            if (eventForm.closed) {
                console.log(`🔒 Validando cierre de ${dateStrings.length} día(s)...`);
                
                // Buscar reservas confirmadas en cualquiera de los días del rango
                const { data: reservationsData, error: reservationsError } = await supabase
                    .from('appointments')
                    .select('id, customer_name, appointment_date, appointment_time, duration_minutes')
                    .eq('business_id', businessId)
                    .in('appointment_date', dateStrings)
                    .in('status', ['confirmed', 'pending']); // Ambos bloquean
                
                if (reservationsError) {
                    console.warn("⚠️ Error verificando reservas:", reservationsError);
                } else if (reservationsData && reservationsData.length > 0) {
                    // ❌ HAY RESERVAS - BLOQUEAR
                    const reservationsByDate = {};
                    reservationsData.forEach(r => {
                        if (!reservationsByDate[r.appointment_date]) {
                            reservationsByDate[r.appointment_date] = [];
                        }
                        reservationsByDate[r.appointment_date].push(r);
                    });
                    
                    const affectedDates = Object.keys(reservationsByDate).sort();
                    const totalReservations = reservationsData.length;
                    
                    const detailedList = affectedDates.slice(0, 3).map(date => {
                        const dayReservations = reservationsByDate[date];
                        const reservationList = dayReservations.slice(0, 2).map(r => 
                            `  • ${r.customer_name} - ${r.appointment_time}`
                        ).join('\n');
                        const more = dayReservations.length > 2 ? `\n  ... y ${dayReservations.length - 2} más` : '';
                        return `📅 ${format(parseISO(date), 'dd/MM/yyyy', { locale: es })}: ${dayReservations.length} reserva(s)\n${reservationList}${more}`;
                    }).join('\n\n');
                    
                    const moreInfo = affectedDates.length > 3 ? `\n\n... y ${affectedDates.length - 3} días más con reservas` : '';
                        
                        toast.error(
                        `❌ NO SE PUEDE CERRAR\n\n` +
                        `Hay ${totalReservations} reserva(s) confirmada(s) en ${affectedDates.length} día(s) del rango:\n\n` +
                        `${detailedList}${moreInfo}\n\n` +
                        `🔧 SOLUCIÓN: Cancela o reprograma estas reservas primero.`,
                        { 
                            duration: 10000,
                                style: { 
                                minWidth: '450px',
                                    whiteSpace: 'pre-line',
                                    fontSize: '13px'
                                }
                            }
                        );
                        return; // BLOQUEAR creación del evento
                }
            }
            
            // ✅ NO HAY RESERVAS (o es evento abierto) - CREAR EVENTOS
            
            // Primero eliminar eventos existentes en esas fechas (si existen)
            const { error: deleteError } = await supabase
                    .from('calendar_exceptions')
                .delete()
                .eq('business_id', businessId)
                .in('exception_date', dateStrings);
            
            if (deleteError) {
                console.warn("⚠️ Error eliminando eventos existentes:", deleteError);
            }
            
            // Ahora crear los nuevos eventos
            const eventsToCreate = dateStrings.map(dateStr => ({
                business_id: businessId,
                exception_date: dateStr,
                reason: eventForm.title || 'Evento',
                is_open: !eventForm.closed,
                open_time: eventForm.closed ? null : eventForm.start_time,
                close_time: eventForm.closed ? null : eventForm.end_time
            }));
            
            // INSERTAR TODOS LOS EVENTOS
            const { data, error } = await supabase
                .from('calendar_exceptions')
                .insert(eventsToCreate)
                .select();
            
            if (error) throw error;
            
            // Actualizar estados locales
            const newEvents = data || [];
            setEvents(prev => {
                const filtered = prev.filter(e => !dateStrings.includes(e.exception_date));
                return [...filtered, ...newEvents];
            });
            setCalendarExceptions(prev => {
                const filtered = prev.filter(e => !dateStrings.includes(e.exception_date));
                return [...filtered, ...newEvents];
            });
            
            // ✅ VERIFICAR SI ALGÚN EVENTO ESTÁ DENTRO DEL RANGO DE REGENERACIÓN
            const today = format(new Date(), 'yyyy-MM-dd');
            const advanceDays = business?.settings?.advance_booking_days || 20;
            const maxDate = format(addDays(new Date(), advanceDays), 'yyyy-MM-dd');
            
            const datesWithinRange = dateStrings.filter(d => d >= today && d <= maxDate);
            
            if (datesWithinRange.length > 0) {
                changeDetection.checkExistingSlots().then(slotsExist => {
                    if (slotsExist) {
                        changeDetection.onSpecialEventChange(
                            eventForm.closed ? 'closed' : 'special_hours',
                            dateStrings.length === 1 ? format(startDate, 'dd/MM/yyyy') : `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                        );
                        
                        // MOSTRAR MODAL
                        if (eventForm.closed) {
                            showRegenerationModal('special_event_closed', 
                                dateStrings.length === 1 
                                    ? `Día ${format(startDate, 'dd/MM/yyyy')} cerrado` 
                                    : `${dateStrings.length} días cerrados`
                            );
                        } else {
                            showRegenerationModal('special_event_created', 
                                `Evento "${eventForm.title}" (${dateStrings.length} día${dateStrings.length > 1 ? 's' : ''})`
                            );
                        }
                    } else {
                        console.log('✅ No se muestra aviso: usuario está configurando el sistema por primera vez');
                    }
                });
            } else {
                console.log(`ℹ️ Evento(s) fuera de rango - NO se requiere regeneración`);
            }
            
            setShowEventModal(false);
            console.log('✅ Evento(s) guardado(s):', data);
            
            // 🆕 Notificar a otros componentes que se actualizó el calendario
            window.dispatchEvent(new CustomEvent('calendar-exception-updated'));
            
            toast.success(
                dateStrings.length === 1 
                    ? `✅ Evento creado para ${format(startDate, 'dd/MM/yyyy')}`
                    : `✅ Evento creado para ${dateStrings.length} días (${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')})`,
                { duration: 4000 }
            );
        } catch (error) {
            console.error('❌ Error guardando evento:', error);
            toast.error('Error al guardar el evento');
        }
    };

    // Obtener evento de un día específico
    const getDayEvent = useCallback((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return events.find(event => event.exception_date === dateStr);
    }, [events]);

    // Obtener ausencias de empleados de un día específico
    const getDayAbsences = useCallback((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Debug: Ver todas las ausencias disponibles
        if (employeeAbsences.length > 0 && dateStr === '2025-11-17') {
            console.log('🔍 DEBUG getDayAbsences:');
            console.log('  - Fecha buscada:', dateStr);
            console.log('  - Total ausencias en memoria:', employeeAbsences.length);
            console.log('  - Ausencias:', employeeAbsences.map(a => ({
                empleado: a.employees?.name,
                desde: a.start_date,
                hasta: a.end_date
            })));
        }
        
        const absencesForDay = employeeAbsences.filter(absence => {
            // Comparar fechas correctamente
            const checkDate = new Date(dateStr + 'T00:00:00');
            const startDate = new Date(absence.start_date + 'T00:00:00');
            const endDate = new Date(absence.end_date + 'T00:00:00');
            
            const isInRange = checkDate >= startDate && checkDate <= endDate;
            
            // Debug específico
            if (dateStr === '2025-11-17' || dateStr === '2025-11-18') {
                console.log(`  ✓ Comparando ${absence.employees?.name}: ${absence.start_date} a ${absence.end_date} | ¿Incluye ${dateStr}? ${isInRange}`);
            }
            
            return isInRange;
        });
        
        // ⭐ ORDENAR por hora (ausencias con hora primero, ordenadas cronológicamente)
        const sorted = absencesForDay.sort((a, b) => {
            // Si ambas tienen hora, ordenar por start_time
            if (!a.all_day && !b.all_day && a.start_time && b.start_time) {
                return a.start_time.localeCompare(b.start_time);
            }
            // Ausencias con hora van primero
            if (!a.all_day && a.start_time && b.all_day) return -1;
            if (a.all_day && !b.all_day && b.start_time) return 1;
            // Si ambas son día completo, mantener orden original
            return 0;
        });
        
        // Debug para ver qué ausencias encuentra
        if (sorted.length > 0) {
            console.log(`📅 ${dateStr}: ${sorted.length} ausencia(s) -`, sorted.map(a => a.employees?.name).join(', '));
        }
        
        return sorted;
    }, [employeeAbsences]);

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
                // NO HAY EVENTO → Mostrar modal de creación con fecha pre-rellenada
                const dateString = format(date, 'yyyy-MM-dd'); // Formato YYYY-MM-DD para input type="date"
                setEventForm({
                    title: '',
                    description: '',
                    start_time: '09:00',
                    end_time: '22:00',
                    closed: false,
                    isRange: false, // Por defecto día único
                    startDate: dateString, // ✅ Pre-rellenar con el día seleccionado
                    endDate: dateString    // ✅ Pre-rellenar con el día seleccionado
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
        if (!businessId) {
            toast.error("Error: No hay negocio configurado");
            return;
        }

        // VALIDACIONES CON SOPORTE DE TURNOS
        const invalidDays = schedule.filter(day => {
            if (!day.is_open) return false;
            
            // Verificar si tiene shifts definidos
            const shifts = day.shifts || [];
            if (shifts.length === 0) {
                // Si no hay shifts, verificar open_time/close_time legacy
                return !day.open_time || !day.close_time || day.open_time === "" || day.close_time === "";
            }
            
            // Validar cada turno
            for (const shift of shifts) {
                if (!shift.start || !shift.end || shift.start === "" || shift.end === "") {
                    return true; // Turno inválido
                }
                if (shift.end <= shift.start) {
                    return true; // Hora de cierre debe ser posterior a apertura
                }
            }
            
            return false;
        });

        if (invalidDays.length > 0) {
            toast.error(`Horarios incompletos o inválidos en: ${invalidDays.map(d => d.day_name).join(', ')}`);
            return;
        }

        setSaving(true);
        try {
            console.log("🔄 Guardando horarios simplificados...", schedule);
            
            // 🚨 VALIDACIÓN CRÍTICA: Verificar conflictos con horarios de empleados
            console.log("🔍 Verificando conflictos con horarios de empleados...");
            
            try {
                // 1. Obtener todos los empleados activos con sus horarios
                const { data: employees, error: employeesError } = await supabase
                    .from('employees')
                    .select(`
                        id,
                        name,
                        employee_schedules (
                            day_of_week,
                            is_working,
                            shifts
                        )
                    `)
                    .eq('business_id', businessId)
                    .eq('is_active', true);
                
                if (employeesError) {
                    console.warn("⚠️ Error obteniendo empleados:", employeesError);
                } else if (employees && employees.length > 0) {
                    // 2. Comparar nuevo horario del negocio con horarios de empleados
                    const conflicts = [];
                    const dayKeyMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    
                    schedule.forEach(day => {
                        if (!day.is_open) return; // Día cerrado, no hay conflicto
                        
                        const dayName = day.day_of_week;
                        const dayIndex = dayKeyMap.indexOf(dayName);
                        if (dayIndex === -1) return;
                        
                        // Obtener primera hora de inicio del negocio para este día
                        const businessShifts = day.shifts || [{ start: day.open_time, end: day.close_time }];
                        const businessFirstStart = businessShifts
                            .map(s => s.start)
                            .sort()
                            [0]; // Primera hora de inicio
                        
                        if (!businessFirstStart) return;
                        
                        const [businessHour, businessMin] = businessFirstStart.split(':').map(Number);
                        const businessStartMinutes = businessHour * 60 + businessMin;
                        
                        // Verificar cada empleado
                        employees.forEach(emp => {
                            const empSchedules = emp.employee_schedules || [];
                            const empDaySchedule = empSchedules.find(s => 
                                s.day_of_week === dayIndex && s.is_working
                            );
                            
                            if (empDaySchedule && empDaySchedule.shifts && empDaySchedule.shifts.length > 0) {
                                empDaySchedule.shifts.forEach(shift => {
                                    if (shift.start) {
                                        const [empHour, empMin] = shift.start.split(':').map(Number);
                                        const empStartMinutes = empHour * 60 + empMin;
                                        
                                        // Si el empleado empieza ANTES que el negocio, hay conflicto
                                        if (empStartMinutes < businessStartMinutes) {
                                            conflicts.push({
                                                employeeName: emp.name,
                                                employeeId: emp.id,
                                                dayName: day.day_name || dayName,
                                                dayOfWeek: dayName,
                                                employeeStart: shift.start,
                                                businessStart: businessFirstStart
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    });
                    
                    // 3. Si hay conflictos, mostrar advertencia y NO permitir guardar
                    if (conflicts.length > 0) {
                        // Agrupar conflictos por día
                        const conflictsByDay = conflicts.reduce((acc, conflict) => {
                            if (!acc[conflict.dayOfWeek]) {
                                acc[conflict.dayOfWeek] = [];
                            }
                            acc[conflict.dayOfWeek].push(conflict);
                            return acc;
                        }, {});
                        
                        // Crear mensaje detallado
                        let conflictMessage = `⚠️ CONFLICTO DETECTADO\n\n`;
                        conflictMessage += `Has configurado el horario del negocio, pero hay ${conflicts.length} empleado(s) que tienen horarios que empiezan ANTES del horario del negocio:\n\n`;
                        
                        Object.entries(conflictsByDay).forEach(([dayKey, dayConflicts]) => {
                            const dayName = dayConflicts[0].dayName;
                            conflictMessage += `📅 ${dayName}:\n`;
                            dayConflicts.forEach(c => {
                                conflictMessage += `   • ${c.employeeName}: empieza a las ${c.employeeStart} (negocio: ${c.businessStart})\n`;
                            });
                            conflictMessage += `\n`;
                        });
                        
                        conflictMessage += `\n🚨 ACCIÓN REQUERIDA:\n`;
                        conflictMessage += `Debes cambiar primero los horarios de estos empleados antes de guardar el nuevo horario del negocio.\n\n`;
                        conflictMessage += `El horario del NEGOCIO siempre tiene prioridad sobre los horarios de empleados.\n\n`;
                        conflictMessage += `¿Quieres cancelar el guardado para revisar los horarios de empleados?`;
                        
                        const userConfirmed = window.confirm(conflictMessage);
                        
                        if (userConfirmed) {
                            toast.error(
                                `❌ Guardado cancelado\n\n` +
                                `Revisa los horarios de ${conflicts.length} empleado(s) en "Tu Equipo" antes de cambiar el horario del negocio.`,
                                { duration: 8000 }
                            );
                            setSaving(false);
                            return;
                        } else {
                            // Usuario quiere continuar de todas formas (no recomendado)
                            toast.warning(
                                `⚠️ Continuando con guardado...\n\n` +
                                `Los horarios de empleados pueden causar confusión en el calendario.`,
                                { duration: 6000 }
                            );
                        }
                    }
                }
            } catch (employeeConflictError) {
                console.warn("⚠️ Error verificando conflictos con empleados:", employeeConflictError);
                // Continuar con el guardado aunque falle la verificación
            }
            
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
                    const availabilityConflicts = conflictData.conflicts;
                    const criticalConflicts = availabilityConflicts.filter(c => c.severity === 'CRITICAL');
                    
                    if (criticalConflicts.length > 0) {
                        // Hay reservas confirmadas en días que se van a cerrar
                        const conflictMessage = criticalConflicts.map(c => 
                            `📅 ${c.conflict_date}: ${c.confirmed_reservations} reservas confirmadas`
                        ).join('\n');
                        
                        const userConfirmed = confirm(
                            `⚠️ CONFLICTO CRÍTICO DETECTADO\n\n` +
                            `Los siguientes días tienen RESERVAS CONFIRMADAS pero van a cerrarse:\n\n` +
                            `${conflictMessage}\n\n` +
                            `🚨 IMPACTO: Los clientes podrían llegar a un negocio cerrado\n\n` +
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
                        closed: true,
                        shifts: []
                    };
                    calendar_schedule.push({
                        day_of_week: dayName,
                        day_name: day.day_name,
                        is_open: false
                    });
                } else {
                    // Día abierto - CON SOPORTE DE TURNOS
                    const shifts = day.shifts || [{ start: day.open_time, end: day.close_time }];
                    
                    operating_hours[dayName] = {
                        open: day.open_time || "09:00",
                        close: day.close_time || "22:00",
                        closed: false,
                        shifts: shifts  // ⭐ Guardar turnos
                    };
                    calendar_schedule.push({
                        day_of_week: dayName,
                        day_name: day.day_name,
                        is_open: true,
                        open_time: day.open_time || "09:00",
                        close_time: day.close_time || "22:00",
                        shifts: shifts  // ⭐ Guardar turnos también aquí
                    });
                }
            });

            console.log("📊 Datos a guardar:", { operating_hours, calendar_schedule });

            // GUARDADO ROBUSTO EN SUPABASE
            const { data: currentBusiness, error: fetchError } = await supabase
                .from("businesses")
                .select("settings")
                .eq("id", businessId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error("Error obteniendo configuración actual:", fetchError);
                throw fetchError;
            }

            const currentSettings = currentBusiness?.settings || {};

            // Actualizar con estructura completa
            const { error } = await supabase
                .from("businesses")
                .update({
                    settings: {
                        ...currentSettings,
                        operating_hours: operating_hours,
                        calendar_schedule: calendar_schedule
                    },
                    updated_at: new Date().toISOString()
                })
                .eq("id", businessId);

            if (error) {
                console.error("❌ Error Supabase:", error);
                throw error;
            }

            // ACTUALIZAR ESTADO LOCAL
            setSchedule(calendar_schedule);

            // Eventos de sincronización
            try {
                // 1. Evento para recargar esta página
                window.dispatchEvent(new CustomEvent('schedule-updated', { 
                    detail: { 
                        scheduleData: calendar_schedule, 
                        operatingHours: operating_hours,
                        businessId 
                    } 
                }));
                
                // 2. Evento para recargar el AuthContext (actualiza business.settings en Reservas)
                window.dispatchEvent(new CustomEvent('force-business-reload'));
                console.log('✅ Eventos de actualización disparados');
            } catch (eventError) {
                console.warn("Error disparando eventos:", eventError);
            }

            toast.success("✅ Horarios guardados. El calendario se actualizará automáticamente.", {
                duration: 3000
            });
            console.log("✅ Guardado exitoso - horarios simples");
            
            // ⚡ REGENERACIÓN AUTOMÁTICA EN BACKGROUND (solo si existen slots)
            changeDetection.checkExistingSlots().then(async (slotsExist) => {
                if (slotsExist) {
                    console.log('⚡ Regenerando disponibilidad automáticamente después de cambiar horarios...');
                    
                    // Obtener días de antelación configurados
                    const { data: businessData } = await supabase
                        .from('businesses')
                        .select('settings')
                        .eq('id', businessId)
                        .single();
                    
                    const advanceDays = businessData?.settings?.advance_booking_days || 30;
                    
                    // Mostrar toast informativo mientras se regenera
                    const regenerationToast = toast.loading(
                        '⚡ Actualizando disponibilidad con los nuevos horarios...',
                        { duration: 5000 }
                    );
                    
                    try {
                        // Regenerar automáticamente en background
                        const result = await AutoSlotRegenerationService.regenerate(businessId, 'business_hours_changed', {
                            silent: false,
                            advanceDays: advanceDays
                        });
                        
                        toast.dismiss(regenerationToast);
                        
                        if (result.success) {
                            toast.success(
                                `✅ Disponibilidad actualizada: ${result.slotsUpdated || 0} slots generados`,
                                { duration: 3000, icon: '✅' }
                            );
                            
                            // 🛡️ Si hay reservas protegidas, mostrar modal informativo (NO bloqueante)
                            if (result.protectedReservations && result.protectedReservations.length > 0) {
                                setProtectedReservations(result.protectedReservations);
                                setShowProtectedModal(true);
                            }
                            
                            // Disparar evento para que otros componentes se actualicen
                            window.dispatchEvent(new CustomEvent('availabilityRegenerated', {
                                detail: { reason: 'business_hours_changed', slotsUpdated: result.slotsUpdated }
                            }));
                        } else {
                            // Si falla, verificar si es un caso esperado (sin horarios de empleados)
                            // NO mostrar error si es NO_EMPLOYEE_SCHEDULES (es un caso esperado, no un error real)
                            if (result.errorCode !== 'NO_EMPLOYEE_SCHEDULES') {
                                toast.error('⚠️ Error al actualizar disponibilidad. Intenta regenerar manualmente desde Disponibilidades.', {
                                    duration: 5000
                                });
                            } else {
                                // Caso esperado: empleados sin horarios configurados
                                console.log('ℹ️ Regeneración omitida: empleados sin horarios configurados (caso esperado)');
                            }
                            console.error('❌ Regeneración automática falló:', result.error);
                        }
                    } catch (error) {
                        console.error('❌ Error en regeneración automática:', error);
                        toast.dismiss(regenerationToast);
                        
                        // Solo mostrar error si no es un caso esperado
                        // NO mostrar error si es relacionado con horarios de empleados
                        if (!error.message?.includes('NO_EMPLOYEE_SCHEDULES') && 
                            !error.message?.includes('horarios configurados')) {
                            toast.error('⚠️ Error al actualizar disponibilidad. Intenta regenerar manualmente desde Disponibilidades.', {
                                duration: 5000
                            });
                        }
                    }
                } else {
                    console.log('✅ No se regenera: usuario está configurando el sistema por primera vez');
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
            <div className="max-w-[95%] mx-auto">
                {/* Header estilo Dashboard - limpio y espacioso */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 mb-2">
                        <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" />
                        Horario y Calendario
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 ml-10 sm:ml-11">
                        Define el horario del negocio y visualiza ausencias del equipo
                    </p>
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
                                Horario
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

                    {/* Tab: Horarios del negocio - ESTILO EMPLEADOS */}
                    {activeTab === 'horarios' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                                <h3 className="text-xs font-bold text-gray-900">
                                    🏢 Horario del Negocio
                                </h3>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    Define cuándo está abierto el negocio. Los empleados no pueden trabajar fuera de estas horas.
                                </p>
                            </div>
                            
                            {/* Lista de días - MÁS COMPACTA (10-15% reducido) */}
                            <div className="p-2.5 space-y-1">
                                {schedule.map((day, index) => (
                                    <div 
                                        key={day.day_of_week}
                                        className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                                            day.is_open
                                                ? 'bg-white border-purple-200 hover:border-purple-400'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        {/* Toggle ON/OFF - Más pequeño */}
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={day.is_open}
                                                onChange={() => {
                                                    const newSchedule = [...schedule];
                                                    newSchedule[index].is_open = !newSchedule[index].is_open;
                                                    if (newSchedule[index].is_open && !newSchedule[index].open_time) {
                                                        newSchedule[index].open_time = "09:00";
                                                        newSchedule[index].close_time = "22:00";
                                                        newSchedule[index].shifts = [{ start: "09:00", end: "22:00" }];
                                                    }
                                                    setSchedule(newSchedule);
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>

                                        {/* Nombre del día - Más compacto */}
                                        <div className="w-20">
                                            <p className={`text-xs font-bold ${day.is_open ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {day.day_name}
                                            </p>
                                                    </div>

                                        {/* Turnos (múltiples) - MÁS COMPACTO */}
                                        {day.is_open ? (
                                            <div className="flex items-start gap-2 flex-1">
                                                <div className="flex-1 space-y-1">
                                                    {(day.shifts || [{ start: day.open_time, end: day.close_time }]).map((shift, shiftIdx) => (
                                                        <div key={shiftIdx} className="flex items-center gap-1.5">
                                                            {day.shifts && day.shifts.length > 1 && (
                                                                <span className="text-xs text-gray-500 font-semibold w-6">
                                                                    T{shiftIdx + 1}
                                                                </span>
                                                            )}
                                                        <input
                                                            type="time"
                                                                value={shift.start}
                                                            onChange={(e) => {
                                                                const newSchedule = [...schedule];
                                                                    if (!newSchedule[index].shifts) {
                                                                        newSchedule[index].shifts = [{ start: newSchedule[index].open_time, end: newSchedule[index].close_time }];
                                                                    }
                                                                    newSchedule[index].shifts[shiftIdx].start = e.target.value;
                                                                    // Actualizar legacy
                                                                    newSchedule[index].open_time = newSchedule[index].shifts[0].start;
                                                                setSchedule(newSchedule);
                                                            }}
                                                                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-transparent w-full min-w-[85px] max-w-[120px]"
                                                        />
                                                            <span className="text-gray-400 text-xs">—</span>
                                                        <input
                                                            type="time"
                                                                value={shift.end}
                                                            onChange={(e) => {
                                                                const newSchedule = [...schedule];
                                                                    if (!newSchedule[index].shifts) {
                                                                        newSchedule[index].shifts = [{ start: newSchedule[index].open_time, end: newSchedule[index].close_time }];
                                                                    }
                                                                    newSchedule[index].shifts[shiftIdx].end = e.target.value;
                                                                    // Actualizar legacy
                                                                    newSchedule[index].close_time = newSchedule[index].shifts[newSchedule[index].shifts.length - 1].end;
                                                                setSchedule(newSchedule);
                                                            }}
                                                                className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:border-transparent w-full min-w-[85px] max-w-[120px]"
                                                            />
                                                            
                                                            {/* Botón Quitar (solo si hay más de 1 turno) */}
                                                            {day.shifts && day.shifts.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newSchedule = [...schedule];
                                                                        newSchedule[index].shifts = newSchedule[index].shifts.filter((_, idx) => idx !== shiftIdx);
                                                                        // Actualizar legacy
                                                                        if (newSchedule[index].shifts.length > 0) {
                                                                            newSchedule[index].open_time = newSchedule[index].shifts[0].start;
                                                                            newSchedule[index].close_time = newSchedule[index].shifts[newSchedule[index].shifts.length - 1].end;
                                                                        }
                                                                        setSchedule(newSchedule);
                                                                    }}
                                                                    className="p-0.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                    title="Quitar turno"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                    </div>
                                                    ))}
                                                    
                                                    {/* Botón Añadir Turno */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newSchedule = [...schedule];
                                                            if (!newSchedule[index].shifts) {
                                                                newSchedule[index].shifts = [{ start: newSchedule[index].open_time, end: newSchedule[index].close_time }];
                                                            }
                                                            newSchedule[index].shifts.push({ start: '16:00', end: '20:00' });
                                                            setSchedule(newSchedule);
                                                        }}
                                                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-semibold transition-colors mt-0.5"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Añadir turno
                                                    </button>
                                                </div>
                                                
                                                {/* Botón copiar para toda la semana - SOLO EN LUNES */}
                                                {day.day_of_week === 'monday' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!confirm(`¿Copiar el horario de ${day.day_name} a toda la semana?`)) {
                                                                return;
                                                            }
                                                            
                                                            // Copiar a todos los demás días (excepto los que están cerrados)
                                                            const newSchedule = schedule.map(d => {
                                                                if (d.day_of_week === 'monday') return d; // No copiar sobre sí mismo
                                                                if (!d.is_open) return d; // No copiar a días cerrados
                                                                
                                                                return {
                                                                    ...d,
                                                                    shifts: day.shifts ? [...day.shifts] : [{ start: day.open_time, end: day.close_time }],
                                                                    open_time: day.open_time,
                                                                    close_time: day.close_time
                                                                };
                                                            });
                                                            
                                                            setSchedule(newSchedule);
                                                            toast.success(`Horario de ${day.day_name} copiado a toda la semana ✅`);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1 whitespace-nowrap"
                                                        title="Copiar este horario a todos los días abiertos de la semana"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                        Copiar semana
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-400 font-medium">Cerrado</p>
                                            </div>
                                        )}
                                                        </div>
                                ))}
                                                    </div>
                                                    
                            {/* Nota informativa */}
                            <div className="px-3 py-2.5 bg-blue-50 border-t border-blue-200">
                                <p className="text-xs text-gray-700">
                                    <strong>💡 Turnos partidos:</strong> Usa "Añadir turno" si cierras para comer. Ej: T1 (9-14h) + T2 (16-20h).
                                </p>
                            </div>
                            
                            {/* Footer con botón de guardar - Más compacto */}
                            <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50">
                                                        <button
                                    onClick={saveWeeklySchedule}
                                    disabled={saving}
                                    className="w-full px-3 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Guardar Horario
                                        </>
                                    )}
                                                        </button>
                                                    </div>
                        </div>
                    )}

                    {/* Tab: Calendario */}
                    {activeTab === 'calendario' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Controles del calendario - MÁS GRANDES Y VISIBLES */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => navigateMonth('prev')}
                                        className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"
                                        title="Mes anterior"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                                    </button>
                                    <h3 className="text-lg font-bold text-gray-900 capitalize text-center flex-1 min-w-0">
                                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                                    </h3>
                                    <button
                                        onClick={() => navigateMonth('next')}
                                        className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"
                                        title="Mes siguiente"
                                    >
                                        <ChevronRight className="w-5 h-5 text-gray-700" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentDate(new Date())}
                                        className="px-4 py-2 text-sm font-semibold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg transition-all shadow-sm"
                                    >
                                        📅 Hoy
                                    </button>
                                </div>
                                    <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // ✅ Activar modal de eventos
                                        setSelectedDay(new Date());
                                        setEventForm({
                                            title: '',
                                            description: '',
                                            start_time: '09:00',
                                            end_time: '22:00',
                                            closed: false,
                                            isRange: false, // Por defecto día único
                                            startDate: format(new Date(), 'yyyy-MM-dd'),
                                            endDate: format(new Date(), 'yyyy-MM-dd')
                                        });
                                        setShowEventModal(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all text-sm font-bold shadow-md"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Nuevo evento
                                    </button>
                            </div>

                            {/* Calendario - MÁS GRANDE Y PROFESIONAL */}
                            <div className="bg-white overflow-hidden">
                                {/* Encabezados de días */}
                                <div className="grid grid-cols-7 bg-gradient-to-r from-gray-100 to-slate-100 border-b-2 border-gray-300">
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, index) => (
                                        <div key={day} className="py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wide">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Días del calendario - CON ALINEACIÓN CORRECTA */}
                                <div className="grid grid-cols-7">
                                    {calendarDays.map((day, index) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const dayDate = new Date(day);
                                        dayDate.setHours(0, 0, 0, 0);
                                        
                                        const isToday = isSameDay(day, new Date());
                                        const isPastDay = dayDate < today; // ⭐ Detectar días pasados
                                        const isCurrentMonth = isSameMonth(day, currentDate);
                                        const daySchedule = getDaySchedule(day);
                                        const dayEvent = getDayEvent(day);
                                        const dayAbsences = getDayAbsences(day); // ⭐ Obtener ausencias del día
                                        
                                        // Debug para verificar alineación de la primera semana
                                        if (index < 7) {
                                            const columnDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                                            console.log(`Columna ${index} (${columnDays[index]}): ${format(day, 'EEEE dd/MM', { locale: es })} | getDaySchedule dice: ${daySchedule.day_name} ${daySchedule.is_open ? '✅' : '❌'}`);
                                        }

                                                        return (
                                            <div
                                                key={index}
                                                className={`min-h-[110px] p-2 border-b border-r border-gray-200 relative ${
                                                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                                                } ${isToday && isCurrentMonth ? 'bg-blue-50 border-blue-300' : ''} ${dayEvent && isCurrentMonth ? 'bg-yellow-50' : ''} ${isCurrentMonth && !isPastDay ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors`}
                                                onClick={() => isCurrentMonth && !isPastDay && handleDayClick(day)}
                                            >
                                                {/* ⭐ OVERLAY DE LÍNEAS DIAGONALES para días pasados */}
                                                {isPastDay && isCurrentMonth && (
                                                    <div 
                                                        className="absolute inset-0 pointer-events-none z-10"
                                                        style={{
                                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(156, 163, 175, 0.35) 5px, rgba(156, 163, 175, 0.35) 8px)',
                                                            backgroundColor: 'rgba(243, 244, 246, 0.5)'
                                                        }}
                                                    />
                                                )}
                                                
                                                {/* ⭐ CONTENIDO DEL DÍA (con z-index para estar sobre el overlay) */}
                                                <div className="relative z-20">
                                                    <div className={`text-sm font-bold mb-1.5 ${
                                                        isToday && isCurrentMonth ? 'text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center text-xs' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                                    }`}>
                                                        {format(day, 'd')}
                                                </div>

                                                {/* Estado del día - EVENTOS TIENEN PRIORIDAD */}
                                                {isCurrentMonth && (
                                                        <div className="space-y-1.5">
                                                        {/* Si hay evento y está cerrado, mostrar CERRADO */}
                                                        {dayEvent && !dayEvent.is_open ? (
                                                            <div>
                                                                <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded block mb-1 text-[10px] font-semibold">
                                                                    Cerrado
                                                                </span>
                                                                <div className="flex items-center justify-between text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded mb-1">
                                                                    <span className="text-[10px] font-medium">🔒 {dayEvent.reason || 'Evento'}</span>
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
                                                                <span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded block mb-1 text-[10px] font-semibold">
                                                                    Abierto {(dayEvent.open_time || daySchedule.open_time || '09:00').substring(0, 5)}-{(dayEvent.close_time || daySchedule.close_time || '22:00').substring(0, 5)}
                                                                </span>
                                                                <div className="flex items-center justify-between text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                                                                    <span className="text-[10px] font-medium">🎉 {dayEvent.reason || 'Evento'}</span>
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
                                                            <span className={`px-1.5 py-0.5 rounded block text-[10px] font-semibold ${
                                                                daySchedule.is_open 
                                                                    ? 'text-green-700 bg-green-100' 
                                                                    : 'text-red-700 bg-red-100'
                                                            }`}>
                                                                {daySchedule.is_open ? `Abierto ${(daySchedule.open_time || '09:00').substring(0, 5)}-${(daySchedule.close_time || '22:00').substring(0, 5)}` : 'Cerrado'}
                                                            </span>
                                                        )}
                                                        
                                                        {/* ⭐ AUSENCIAS DE EMPLEADOS - CLICKEABLE */}
                                                        {dayAbsences && dayAbsences.length > 0 && (
                                                            <div className="mt-1.5 space-y-0.5">
                                                                {dayAbsences.slice(0, 2).map((absence, idx) => {
                                                                    // Emoji según tipo de ausencia
                                                                    const reasonEmoji = {
                                                                        'vacation': '🏖️',
                                                                        'sick_leave': '🤒',
                                                                        'medical_appointment': '🩺',
                                                                        'personal_leave': '🏠',
                                                                        'other': '📅'
                                                                    };
                                                                    
                                                                    // Texto corto según tipo
                                                                    const reasonText = {
                                                                        'vacation': 'Vacaciones',
                                                                        'sick_leave': 'Baja',
                                                                        'medical_appointment': 'Médico',
                                                                        'personal_leave': 'Permiso',
                                                                        'other': absence.reason_label || 'Ausencia'
                                                                    };
                                                                    
                                                                    const emoji = reasonEmoji[absence.reason] || '📅';
                                                                    const text = reasonText[absence.reason] || absence.reason_label || 'Ausencia';
                                                                    
                                                                    // ⭐ Mostrar horarios solo si NO es día completo
                                                                    const timeRange = !absence.all_day && absence.start_time && absence.end_time
                                                                        ? ` ${absence.start_time.substring(0, 5)}-${absence.end_time.substring(0, 5)}`
                                                                        : '';
                                                                    
                                                                    return (
                                                                        <div
                                                                            key={absence.id}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedAbsence(absence);
                                                                                setShowAbsenceDetailModal(true);
                                                                            }}
                                                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                                                            style={{ 
                                                                                backgroundColor: `${absence.employees.color}20`,
                                                                                borderLeft: `2px solid ${absence.employees.color}`
                                                                            }}
                                                                            title={`Click para ver detalles: ${absence.employees.name} - ${text}${timeRange}`}
                                                                        >
                                                                            <span className="truncate">
                                                                                {emoji} {absence.employees.name} - {text}{timeRange}
                                                                            </span>
                                                    </div>
                                                                    );
                                                                })}
                                                                {dayAbsences.length > 2 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedDayAbsences(dayAbsences);
                                                                            setShowAbsenceListModal(true);
                                                                        }}
                                                                        className="text-[10px] text-blue-600 font-bold pl-1.5 hover:text-blue-800 hover:underline cursor-pointer"
                                                                        title="Click para ver todas las ausencias"
                                                                    >
                                                                        +{dayAbsences.length - 2} más ▶
                                                                    </button>
                                                )}
                                                            </div>
                                                        )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Modal de Eventos Especiales - Mobile-first */}
            {showEventModal && selectedDay && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                    <div className="bg-white rounded-t-xl md:rounded-lg p-4 md:p-6 w-full md:max-w-md md:mx-4 max-h-[90vh] overflow-y-auto safe-area-inset-bottom">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-900">
                                {eventForm.isRange ? 'Crear evento (rango de fechas)' : `Crear evento - ${format(selectedDay, 'dd/MM/yyyy')}`}
                            </h3>
                            <button
                                onClick={() => setShowEventModal(false)}
                                className="min-w-[44px] min-h-[44px] text-gray-400 hover:text-gray-600 touch-target flex items-center justify-center rounded-lg hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvent} className="space-y-4">
                            {/* Aviso importante */}
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-2 mb-2">
                                <p className="text-sm text-blue-700">
                                    <strong>📌 Importante:</strong> Los eventos tienen prioridad sobre el horario regular. 
                                    Si marcas como cerrado, anulará el horario habitual.
                                </p>
                            </div>

                            {/* ⭐ SELECTOR: Día único vs Rango de fechas */}
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tipo de evento
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEventForm(prev => ({ ...prev, isRange: false }))}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            !eventForm.isRange 
                                                ? 'bg-purple-600 text-white shadow-md' 
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        📅 Día único
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEventForm(prev => ({ ...prev, isRange: true }))}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            eventForm.isRange 
                                                ? 'bg-purple-600 text-white shadow-md' 
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        📆 Rango de fechas
                                    </button>
                                </div>
                            </div>

                            {/* ⭐ CAMPOS DE FECHA (según tipo) */}
                            {eventForm.isRange ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha inicio
                                        </label>
                                        <input
                                            type="date"
                                            value={eventForm.startDate}
                                            onChange={(e) => setEventForm(prev => ({ ...prev, startDate: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Fecha fin
                                        </label>
                                        <input
                                            type="date"
                                            value={eventForm.endDate}
                                            onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))}
                                            min={eventForm.startDate}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                            required
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Fecha
                                    </label>
                                    <input
                                        type="date"
                                        value={eventForm.startDate}
                                        onChange={(e) => setEventForm(prev => ({ 
                                            ...prev, 
                                            startDate: e.target.value,
                                            endDate: e.target.value 
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        required
                                    />
                                </div>
                            )}

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
                                    <span className="text-sm text-gray-700">Negocio cerrado este día</span>
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
                                    Si no está marcado, es un evento especial con el negocio abierto
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
                                Evento: {selectedEvent.title || selectedEvent.reason || 'Sin título'}
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
                                    📅 {(() => {
                                        // ✅ Validar y formatear fecha de forma segura
                                        const dateStr = selectedEvent.exception_date || selectedEvent.event_date;
                                        if (!dateStr) {
                                            return 'Fecha no disponible';
                                        }
                                        try {
                                            const date = parseISO(dateStr);
                                            if (isNaN(date.getTime())) {
                                                return 'Fecha inválida';
                                            }
                                            return format(date, 'EEEE, dd MMMM yyyy', { locale: es });
                                        } catch (error) {
                                            console.error('❌ Error formateando fecha:', error, dateStr);
                                            return dateStr; // Devolver la fecha sin formatear si falla
                                        }
                                    })()}
                                </p>
                            </div>

                            <div className="bg-gray-50 p-2 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2">Estado:</p>
                                {(() => {
                                    // ✅ Determinar si está cerrado: is_closed o !is_open
                                    const isClosed = selectedEvent.is_closed !== undefined 
                                        ? selectedEvent.is_closed 
                                        : (selectedEvent.is_open !== undefined ? !selectedEvent.is_open : false);
                                    
                                    return isClosed ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                            🔒 Negocio cerrado este día
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                            🎉 Evento especial - Negocio abierto
                                        </span>
                                    );
                                })()}
                            </div>

                            {(() => {
                                // ✅ Determinar si está cerrado
                                const isClosed = selectedEvent.is_closed !== undefined 
                                    ? selectedEvent.is_closed 
                                    : (selectedEvent.is_open !== undefined ? !selectedEvent.is_open : false);
                                
                                const startTime = selectedEvent.start_time || selectedEvent.open_time;
                                const endTime = selectedEvent.end_time || selectedEvent.close_time;
                                
                                return !isClosed && (startTime || endTime) && (
                                    <div className="bg-gray-50 p-2 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-2">Horario especial:</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {startTime || '09:00'} - {endTime || '22:00'}
                                        </p>
                                    </div>
                                );
                            })()}

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
                                    // ✅ Obtener fecha de forma segura
                                    const dateStr = selectedEvent.exception_date || selectedEvent.event_date;
                                    let eventDate = selectedDay; // Usar el día seleccionado por defecto
                                    
                                    if (dateStr) {
                                        try {
                                            const parsedDate = parseISO(dateStr);
                                            if (!isNaN(parsedDate.getTime())) {
                                                eventDate = parsedDate;
                                            }
                                        } catch (error) {
                                            console.error('❌ Error parseando fecha del evento:', error);
                                        }
                                    }
                                    
                                    // Formatear fecha para el input type="date"
                                    const dateString = format(eventDate, 'yyyy-MM-dd');
                                    
                                    setEventForm({
                                        title: selectedEvent.title || selectedEvent.reason || '',
                                        description: selectedEvent.description || '',
                                        start_time: selectedEvent.start_time || selectedEvent.open_time || '09:00',
                                        end_time: selectedEvent.end_time || selectedEvent.close_time || '22:00',
                                        closed: selectedEvent.is_closed !== undefined ? selectedEvent.is_closed : !selectedEvent.is_open,
                                        isRange: false, // Por defecto día único (se puede cambiar después)
                                        startDate: dateString, // ✅ Pre-rellenar con la fecha del evento
                                        endDate: dateString    // ✅ Pre-rellenar con la fecha del evento
                                    });
                                    setShowEventDetailModal(false);
                                    setShowEventModal(true);
                                    setSelectedDay(eventDate);
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

            {/* ⭐ MODAL DE DETALLES DE AUSENCIA */}
            {showAbsenceDetailModal && selectedAbsence && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                Detalles de Ausencia
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAbsenceDetailModal(false);
                                    setSelectedAbsence(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Información del empleado */}
                        <div className="mb-4 flex items-center gap-3">
                            <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: selectedAbsence.employees.color }}
                            >
                                {selectedAbsence.employees.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{selectedAbsence.employees.name}</p>
                                <p className="text-sm text-gray-500">Empleado</p>
                            </div>
                        </div>

                        {/* Detalles de la ausencia */}
                        <div className="space-y-3">
                            {/* Tipo de ausencia */}
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                                <p className="text-sm text-blue-900 font-semibold mb-1">
                                    {(() => {
                                        const types = {
                                            'vacation': '🏖️ Vacaciones',
                                            'sick_leave': '🤒 Baja médica',
                                            'medical_appointment': '🩺 Cita médica',
                                            'personal_leave': '🏠 Permiso personal',
                                            'other': '📅 Otra ausencia'
                                        };
                                        return types[selectedAbsence.reason] || '📅 Ausencia';
                                    })()}
                                </p>
                                {selectedAbsence.reason_label && (
                                    <p className="text-sm text-blue-700">{selectedAbsence.reason_label}</p>
                                )}
                            </div>

                            {/* Fechas */}
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">
                                    {selectedAbsence.all_day ? 'Período:' : 'Fecha y hora:'}
                                </p>
                                <p className="text-sm font-medium text-gray-900">
                                    {format(parseISO(selectedAbsence.start_date), 'dd MMM yyyy', { locale: es })} 
                                    {selectedAbsence.start_date !== selectedAbsence.end_date && (
                                        <>
                                            {' - '}
                                            {format(parseISO(selectedAbsence.end_date), 'dd MMM yyyy', { locale: es })}
                                        </>
                                    )}
                                </p>
                                
                                {/* ⭐ Mostrar horarios si NO es día completo */}
                                {!selectedAbsence.all_day && selectedAbsence.start_time && selectedAbsence.end_time && (
                                    <p className="text-sm font-semibold text-blue-600 mt-1">
                                        🕐 {selectedAbsence.start_time.substring(0, 5)} - {selectedAbsence.end_time.substring(0, 5)}
                                    </p>
                                )}
                                
                                {/* Duración */}
                                {selectedAbsence.all_day ? (
                                    <p className="text-xs text-gray-500 mt-1">
                                        ({(() => {
                                            const start = parseISO(selectedAbsence.start_date);
                                            const end = parseISO(selectedAbsence.end_date);
                                            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                                            return `${days} día${days > 1 ? 's' : ''}`;
                                        })()})
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-1">
                                        ({(() => {
                                            if (!selectedAbsence.start_time || !selectedAbsence.end_time) return '';
                                            const [startH, startM] = selectedAbsence.start_time.split(':').map(Number);
                                            const [endH, endM] = selectedAbsence.end_time.split(':').map(Number);
                                            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                                            const hours = Math.floor(durationMinutes / 60);
                                            const minutes = durationMinutes % 60;
                                            return hours > 0 
                                                ? `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`
                                                : `${minutes}m`;
                                        })()})
                                    </p>
                                )}
                            </div>

                            {/* Notas (si las hay) */}
                            {selectedAbsence.notes && (
                                <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                                    <p className="text-xs text-yellow-800 font-semibold mb-1">Notas:</p>
                                    <p className="text-sm text-yellow-900">{selectedAbsence.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Botón cerrar */}
                        <div className="mt-6">
                            <button
                                onClick={() => {
                                    setShowAbsenceDetailModal(false);
                                    setSelectedAbsence(null);
                                }}
                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ⭐ MODAL DE LISTA DE AUSENCIAS (cuando hay +1 más) - Mobile-first */}
            {showAbsenceListModal && selectedDayAbsences.length > 0 && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                    <div className="bg-white rounded-t-xl md:rounded-lg p-4 md:p-6 w-full md:max-w-lg md:mx-4 max-h-[80vh] overflow-y-auto safe-area-inset-bottom">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                Ausencias del día ({selectedDayAbsences.length})
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAbsenceListModal(false);
                                    setSelectedDayAbsences([]);
                                }}
                                className="min-w-[44px] min-h-[44px] text-gray-400 hover:text-gray-600 touch-target flex items-center justify-center rounded-lg hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Lista de todas las ausencias */}
                        <div className="space-y-3">
                            {selectedDayAbsences.map((absence, idx) => {
                                const reasonEmoji = {
                                    'vacation': '🏖️',
                                    'sick_leave': '🤒',
                                    'medical_appointment': '🩺',
                                    'personal_leave': '🏠',
                                    'other': '📅'
                                };
                                
                                const reasonText = {
                                    'vacation': 'Vacaciones',
                                    'sick_leave': 'Baja',
                                    'medical_appointment': 'Médico',
                                    'personal_leave': 'Permiso',
                                    'other': absence.reason_label || 'Ausencia'
                                };
                                
                                const emoji = reasonEmoji[absence.reason] || '📅';
                                const text = reasonText[absence.reason] || absence.reason_label || 'Ausencia';
                                const timeRange = !absence.all_day && absence.start_time && absence.end_time
                                    ? ` ${absence.start_time.substring(0, 5)}-${absence.end_time.substring(0, 5)}`
                                    : '';
                                
                                return (
                                    <div
                                        key={absence.id}
                                        onClick={() => {
                                            setShowAbsenceListModal(false);
                                            setSelectedAbsence(absence);
                                            setShowAbsenceDetailModal(true);
                                        }}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                                        style={{ 
                                            backgroundColor: `${absence.employees.color}10`,
                                            borderLeft: `4px solid ${absence.employees.color}`
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div 
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                            style={{ backgroundColor: absence.employees.color }}
                                        >
                                            {absence.employees.name.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {absence.employees.name}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                                {emoji} {text}{timeRange}
                                            </p>
                                        </div>

                                        {/* Flecha */}
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Botón cerrar */}
                        <div className="mt-6">
                            <button
                                onClick={() => {
                                    setShowAbsenceListModal(false);
                                    setSelectedDayAbsences([]);
                                }}
                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🛡️ Modal informativo de reservas protegidas (NO bloqueante) */}
            <ProtectedReservationsInfoModal
                isOpen={showProtectedModal}
                onClose={() => setShowProtectedModal(false)}
                protectedReservations={protectedReservations}
            />
            
            {/* 🚨 Modal bloqueante (solo como fallback en casos extremos - NO debería mostrarse) */}
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


