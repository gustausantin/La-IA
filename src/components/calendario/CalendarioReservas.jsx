// CalendarioReservas.jsx - Calendario Profesional estilo Google Calendar + Booksy
import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    User,
    Phone,
    Mail,
    Plus,
    RefreshCw,
    Filter,
    Search,
    X
} from 'lucide-react';
import QuickActionModal from './QuickActionModal';

// 🎨 COLORES PROFESIONALES - Paleta sobria y elegante
const STATUS_COLORS = {
    confirmed: {
        bg: 'bg-blue-50',
        border: 'border-l-[5px] border-blue-600',
        text: 'text-gray-900',
        dot: 'bg-blue-600',
        bgHover: 'hover:bg-blue-100'
    },
    pending: {
        bg: 'bg-yellow-50',
        border: 'border-l-[5px] border-yellow-500',
        text: 'text-gray-900',
        dot: 'bg-yellow-500',
        bgHover: 'hover:bg-yellow-100'
    },
    cancelled: {
        bg: 'bg-red-50',
        border: 'border-l-[5px] border-red-600',
        text: 'text-gray-900',
        dot: 'bg-red-600',
        bgHover: 'hover:bg-red-100'
    },
    completed: {
        bg: 'bg-green-50',
        border: 'border-l-[5px] border-green-600',
        text: 'text-gray-900',
        dot: 'bg-green-600',
        bgHover: 'hover:bg-green-100'
    },
    no_show: {
        bg: 'bg-gray-200',
        border: 'border-l-[5px] border-gray-600',
        text: 'text-gray-900',
        dot: 'bg-gray-600',
        bgHover: 'hover:bg-gray-300'
    }
};

// 💰 ICONOS DE ESTADO (Estilo Booksy)
const getStatusIcon = (reservation) => {
    // Pagado
    if (reservation.payment_status === 'paid') {
        return <span className="text-green-600 text-xs">💰</span>;
    }
    // Pendiente de confirmación
    if (reservation.status === 'pending') {
        return <span className="text-amber-600 text-xs">⭕</span>;
    }
    // Cliente favorito/VIP
    if (reservation.customer_tags?.includes('vip') || reservation.customer_tags?.includes('favorito')) {
        return <span className="text-red-600 text-xs">❤️</span>;
    }
    return null;
};

// 🕐 CALCULAR HORA DE FIN
const calcularHoraFin = (horaInicio, duracionMinutos) => {
    const [hora, minuto] = horaInicio.split(':').map(Number);
    const totalMinutos = hora * 60 + minuto + duracionMinutos;
    const horaFin = Math.floor(totalMinutos / 60);
    const minutoFin = totalMinutos % 60;
    return `${horaFin.toString().padStart(2, '0')}:${minutoFin.toString().padStart(2, '0')}`;
};

export default function CalendarioReservas({ 
    reservations = [],
    resources = [], // Profesionales/Recursos (ej: Patricia Taylor, Michael Brown)
    blockages = [], // 🆕 Bloqueos de horas
    businessSettings = null, // 🆕 Configuración del negocio (incluye operating_hours)
    calendarExceptions = [], // 🆕 Excepciones de calendario (días cerrados, festivos, etc.)
    onReservationClick = () => {},
    onSlotClick = () => {},
    onRefresh = () => {},
    onReservationMove = null, // 🆕 Callback para mover reserva
    onCancelReservation = null, // 🆕 Callback para cancelar reserva
    onBlockSlot = null, // 🆕 Callback para bloquear horas
    onUnblockSlot = null, // 🆕 Callback para desbloquear horas
    onAddToWaitlist = null, // 🆕 Callback para agregar a lista de espera
    loading = false
}) {
    // Estados
    const [vista, setVista] = useState('dia'); // 'dia', 'semana', 'mes'
    const [fechaActual, setFechaActual] = useState(new Date());
    const [currentTime, setCurrentTime] = useState(new Date()); // 🔴 Hora actual para línea roja
    const [showCancelledModal, setShowCancelledModal] = useState(false); // 📋 Modal de lista de canceladas
    const [showNoShowsModal, setShowNoShowsModal] = useState(false); // 📋 Modal de lista de no-shows
    const [showPendingModal, setShowPendingModal] = useState(false); // 📋 Modal de pendientes
    const [showCompletedModal, setShowCompletedModal] = useState(false); // 📋 Modal de completadas
    
    // 🕐 CALCULAR HORAS DINÁMICAMENTE (POR DÍA) - PRIORIZAR HORARIO DEL NEGOCIO
    //
    // 👉 Objetivo: que el calendario arranque en la primera hora REAL de trabajo
    // del día seleccionado según el horario del NEGOCIO (operating_hours).
    // Si el negocio abre a las 11:00, el calendario debe empezar a las 11:00, no a las 09:00.
    const [horaInicio, horaFin] = useMemo(() => {
        let minHora = 24;
        let maxHora = 0;
        let encontradoHorarioNegocio = false;

        // Día de la semana de la fecha actual: 0=domingo, 1=lunes, ..., 6=sábado
        const diaSemanaActual = fechaActual.getDay();
        const dayKeyMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayKeyMap[diaSemanaActual];

        // 🔍 FORZAR RECÁLCULO: Log para verificar que se ejecuta cuando cambia la fecha
        const fechaStr = fechaActual.toISOString().split('T')[0];
        console.log(`🔄 Calendario - RECALCULANDO horario para fecha: ${fechaStr}, día: ${dayName} (${diaSemanaActual})`);

        // 1️⃣ PRIORIDAD: Buscar horario del NEGOCIO SOLO para el día seleccionado (operating_hours)
        if (businessSettings?.operating_hours) {
            const operating = businessSettings.operating_hours;
            let daySchedule = null;

            console.log(`🔍 Calendario - Buscando horario para ${dayName} (${diaSemanaActual})`);
            console.log(`🔍 Calendario - operating_hours tipo:`, typeof operating, Array.isArray(operating) ? 'Array' : 'Object');
            console.log(`🔍 Calendario - operating_hours keys:`, typeof operating === 'object' && !Array.isArray(operating) ? Object.keys(operating) : 'N/A');
            console.log(`🔍 Calendario - operating_hours completo:`, JSON.stringify(operating, null, 2));

            // Soportar distintos formatos posibles:
            //  - Objeto con claves por día: { monday: { ... }, tuesday: { ... }, ... }
            //  - Array de días con campo day_of_week
            if (Array.isArray(operating)) {
                daySchedule = operating.find(d => d.day_of_week === diaSemanaActual || d.day_of_week === dayName) || null;
            } else if (typeof operating === 'object' && operating !== null) {
                // Buscar por clave del día (monday, tuesday, etc.) - PRIORITARIO
                if (operating[dayName]) {
                    daySchedule = operating[dayName];
                    console.log(`✅ Calendario - Encontrado por clave directa: ${dayName}`);
                } else {
                    // Fallback 1: buscar variaciones de nombre (mayúsculas, etc.)
                    const dayNameLower = dayName.toLowerCase();
                    const foundKey = Object.keys(operating).find(key => key.toLowerCase() === dayNameLower);
                    if (foundKey) {
                        daySchedule = operating[foundKey];
                        console.log(`✅ Calendario - Encontrado por clave case-insensitive: ${foundKey}`);
                    } else {
                        // Fallback 2: buscar por day_of_week dentro de los values
                        daySchedule = Object.values(operating).find(d => 
                            d && typeof d === 'object' && (
                                d.day_of_week === diaSemanaActual || 
                                d.day_of_week === dayName ||
                                d.day_of_week === dayNameLower
                            )
                        ) || null;
                        if (daySchedule) {
                            console.log(`✅ Calendario - Encontrado por day_of_week en values`);
                        }
                    }
                }
            }

            console.log(`🔍 Calendario - daySchedule encontrado:`, daySchedule ? JSON.stringify(daySchedule, null, 2) : 'null');

            if (daySchedule && typeof daySchedule === 'object' && !daySchedule.closed) {
                encontradoHorarioNegocio = true;

                // Si tiene turnos, usar todos los turnos de ese día
                if (daySchedule.shifts && Array.isArray(daySchedule.shifts) && daySchedule.shifts.length > 0) {
                    console.log(`🔍 Calendario - Usando ${daySchedule.shifts.length} turnos:`, daySchedule.shifts);
                    daySchedule.shifts.forEach((shift, idx) => {
                        if (shift && shift.start && shift.end) {
                            const [horaStart] = shift.start.split(':').map(Number);
                            const [horaEnd] = shift.end.split(':').map(Number);
                            console.log(`  Turno ${idx + 1}: ${shift.start} - ${shift.end} → horas ${horaStart} - ${horaEnd}`);
                            minHora = Math.min(minHora, horaStart);
                            maxHora = Math.max(maxHora, horaEnd);
                        }
                    });
                } else if (daySchedule.open && daySchedule.close) {
                    // Si no tiene turnos, usar open/close directo
                    console.log(`🔍 Calendario - Usando open/close: ${daySchedule.open} - ${daySchedule.close}`);
                    const [horaOpen] = daySchedule.open.split(':').map(Number);
                    const [horaClose] = daySchedule.close.split(':').map(Number);
                    minHora = Math.min(minHora, horaOpen);
                    maxHora = Math.max(maxHora, horaClose);
                } else {
                    console.warn(`⚠️ Calendario - daySchedule no tiene shifts ni open/close`);
                }
            } else if (daySchedule && daySchedule.closed) {
                console.log(`🔍 Calendario - Día ${dayName} está cerrado según operating_hours`);
            } else if (!daySchedule) {
                console.warn(`⚠️ Calendario - No se encontró daySchedule para ${dayName}`);
            }
        } else {
            console.log(`⚠️ Calendario - No hay businessSettings.operating_hours`);
        }

        // 2️⃣ SOLO SI NO HAY HORARIO DEL NEGOCIO: buscar en horarios de EMPLEADOS como fallback
        if (!encontradoHorarioNegocio && resources && resources.length > 0) {
            console.log(`🔍 Calendario - Buscando en horarios de empleados como fallback...`);
            resources.forEach(recurso => {
                const schedules = (recurso.employee_schedules || []).filter(
                    s => s.day_of_week === diaSemanaActual && s.is_working
                );

                schedules.forEach(schedule => {
                    if (schedule.shifts && schedule.shifts.length > 0) {
                        schedule.shifts.forEach(shift => {
                            if (shift.start && shift.end) {
                                const [horaStart] = shift.start.split(':').map(Number);
                                const [horaEnd] = shift.end.split(':').map(Number);
                                minHora = Math.min(minHora, horaStart);
                                maxHora = Math.max(maxHora, horaEnd);
                            }
                        });
                    }
                });
            });
        }

        // 3️⃣ Si encontramos algún horario, usar el rango completo del día
        if (minHora < 24 && maxHora > 0) {
            console.log(`✅ Calendario - Día: ${dayName} (${diaSemanaActual}), Horario FINAL calculado: ${minHora}:00 - ${maxHora}:00`);
            return [minHora, maxHora];
        }

        // 4️⃣ Por defecto: 8-22 si no hay ninguna configuración
        console.log(`⚠️ Calendario - Día: ${dayName} (${diaSemanaActual}), Sin horario configurado, usando default: 8:00 - 22:00`);
        return [8, 22];
    }, [businessSettings, resources, fechaActual]);
    
    // 🔴 Actualizar hora actual cada minuto
    useEffect(() => {
        setCurrentTime(new Date());
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Cada 60 segundos
        return () => clearInterval(interval);
    }, []);
    
    // 🆕 FILTROS AVANZADOS
    const [filtros, setFiltros] = useState({
        recurso: 'todos', // ID del recurso/profesional
        estado: 'todos', // confirmed, pending, etc.
        busqueda: '' // Búsqueda por nombre de cliente
    });
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    
    // 📱 MOBILE: Selector de recurso único
    const [mobileSelectedResource, setMobileSelectedResource] = useState('todos');

    // 🆕 DRAG & DROP
    const [draggingReservation, setDraggingReservation] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);

    // 🆕 QUICK ACTION MODAL
    const [showQuickAction, setShowQuickAction] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);

    // 🔍 FILTRAR RESERVAS
    const reservationsFiltradas = useMemo(() => {
        let filtered = [...reservations];

        // Filtro por recurso/profesional (también por employee_id para eventos bloqueados)
        if (filtros.recurso !== 'todos') {
            filtered = filtered.filter(r => 
                r.resource_id === filtros.recurso || 
                r.table_id === filtros.recurso ||
                r.employee_id === filtros.recurso // ✅ Agregado: filtrar también por employee_id
            );
        }

        // Filtro por estado
        if (filtros.estado !== 'todos') {
            filtered = filtered.filter(r => r.status === filtros.estado);
        }

        // Búsqueda por nombre de cliente
        if (filtros.busqueda.trim()) {
            const busquedaLower = filtros.busqueda.toLowerCase();
            filtered = filtered.filter(r => 
                r.customer_name?.toLowerCase().includes(busquedaLower) ||
                r.customer_phone?.includes(filtros.busqueda)
            );
        }

        return filtered;
    }, [reservations, filtros]);

    // 📊 ESTADÍSTICAS RÁPIDAS (basadas en TODAS las reservas) - TODOS LOS ESTADOS
    const stats = useMemo(() => {
        return {
            confirmadas: reservationsFiltradas.filter(r => r.status === 'confirmed').length,
            pendientes: reservationsFiltradas.filter(r => r.status === 'pending').length,
            completadas: reservationsFiltradas.filter(r => r.status === 'completed').length,
            canceladas: reservationsFiltradas.filter(r => r.status === 'cancelled').length, // Se cuentan pero no se muestran en calendario
            noShows: reservationsFiltradas.filter(r => r.status === 'no_show').length
        };
    }, [reservationsFiltradas]);

    // 🗓️ NAVEGACIÓN
    const irAHoy = () => {
        // Forzar actualización incluso si ya estamos en hoy
        const hoy = new Date();
        setFechaActual(new Date(hoy.getTime() - 1)); // Establecer 1ms antes
        setTimeout(() => setFechaActual(hoy), 0); // Luego establecer hoy (fuerza re-render)
    };
    const irAAnterior = () => {
        if (vista === 'dia') setFechaActual(subDays(fechaActual, 1));
        else if (vista === 'semana') setFechaActual(subDays(fechaActual, 7));
        else setFechaActual(subDays(fechaActual, 30));
    };
    const irASiguiente = () => {
        if (vista === 'dia') setFechaActual(addDays(fechaActual, 1));
        else if (vista === 'semana') setFechaActual(addDays(fechaActual, 7));
        else setFechaActual(addDays(fechaActual, 30));
    };

    // 🎯 HANDLER DE ACCIONES DEL MODAL
    const handleQuickAction = (actionType, data) => {
        switch (actionType) {
            case 'new_reservation':
                // Llamar al callback de crear reserva con datos pre-rellenados
                onSlotClick({
                    date: data.date,
                    time: data.time,
                    resource: data.resource
                });
                break;
            
            case 'view':
                // Llamar al callback de ver reserva
                onReservationClick(data.reservation);
                break;
            
            case 'edit':
                // Llamar al callback de ver reserva (que abrirá el modal de detalles con opciones de editar)
                onReservationClick(data.reservation);
                break;
            
            case 'block_slot':
                // ✅ Bloquear hora
                if (onBlockSlot) {
                    onBlockSlot(data);
                } else {
                    console.warn('⚠️ Callback onBlockSlot no disponible');
                }
                break;
            
            case 'remove_block':
                // ✅ Desbloquear hora
                if (onUnblockSlot && data.blockage) {
                    onUnblockSlot(data.blockage.id);
                } else {
                    console.warn('⚠️ Callback onUnblockSlot no disponible o sin blockage');
                }
                break;
            
            case 'add_to_waitlist':
                // 🆕 Agregar a lista de espera
                if (onAddToWaitlist) {
                    onAddToWaitlist(data);
                } else {
                    console.warn('⚠️ Callback onAddToWaitlist no disponible');
                }
                break;
            
            case 'contact':
                // Abrir WhatsApp/Teléfono
                if (data.reservation.customer_phone) {
                    window.open(`https://wa.me/${data.reservation.customer_phone.replace(/\D/g, '')}`, '_blank');
                }
                break;
            
            case 'cancel':
                // Abrir modal de confirmación de cancelación
                if (onCancelReservation) {
                    onCancelReservation(data.reservation);
                } else {
                    console.warn('⚠️ Callback onCancelReservation no disponible');
                }
                break;
            
            default:
                console.warn('Acción no implementada:', actionType);
        }
    };

    // 🖱️ HANDLER PARA CLICK EN CELDA
    const handleCellClick = (resource, date, time, reservation = null, blockage = null) => {
        setSelectedCell({
            resource,
            date,
            time,
            reservation,
            blockage
        });
        setShowQuickAction(true);
    };

    return (
        <div className="space-y-3">
            {/* ========================================
                CONTROLES SUPERIORES - REORGANIZADOS Y LIMPIOS
            ======================================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
                {/* SECCIÓN 1: Vistas y Navegación - Agrupadas */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Selector de Vista */}
                    <div className="flex items-center gap-2 sm:gap-2.5">
                        <button
                            onClick={() => setVista('dia')}
                            className={`px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 touch-target ${
                                vista === 'dia'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 transform scale-105'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                            }`}
                        >
                            📅 Día
                        </button>
                        <button
                            onClick={() => setVista('semana')}
                            className={`px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 touch-target ${
                                vista === 'semana'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 transform scale-105'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                            }`}
                        >
                            📆 Semana
                        </button>
                        <button
                            onClick={() => setVista('mes')}
                            className={`px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 touch-target ${
                                vista === 'mes'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 transform scale-105'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                            }`}
                        >
                            📊 Mes
                        </button>
                    </div>

                    {/* 📅 NAVEGACIÓN DE FECHAS - Centrada y clara */}
                    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                        <button
                            onClick={irAAnterior}
                            className="p-2 sm:p-2.5 min-w-[44px] min-h-[44px] hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-xl transition-all duration-200 hover:shadow-md border border-transparent hover:border-gray-200 touch-target flex items-center justify-center"
                            aria-label="Día anterior"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        
                        <button
                            onClick={irAHoy}
                            className="px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] bg-gradient-to-r from-blue-100 to-purple-100 hover:from-blue-200 hover:to-purple-200 rounded-xl font-bold text-xs sm:text-sm text-gray-900 transition-all duration-200 border-2 border-blue-300 hover:border-blue-400 shadow-md hover:shadow-lg transform hover:scale-105 touch-target"
                        >
                            Hoy
                        </button>

                        {/* ✨ FECHA CON DISEÑO MEJORADO */}
                        <div className="relative px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg min-w-[200px] sm:min-w-[240px]">
                            <div className="absolute inset-0 bg-white/10 rounded-xl"></div>
                            <div className="relative text-center">
                                <p className="font-bold text-white text-xs sm:text-sm capitalize tracking-wide">
                                    {format(fechaActual, "EEEE d 'de' MMMM", { locale: es })}
                                </p>
                                <p className="text-[9px] sm:text-[10px] text-white/80 font-medium mt-0.5">
                                    {format(fechaActual, 'yyyy')}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={irASiguiente}
                            className="p-2 sm:p-2.5 min-w-[44px] min-h-[44px] hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-xl transition-all duration-200 hover:shadow-md border border-transparent hover:border-gray-200 touch-target flex items-center justify-center"
                            aria-label="Día siguiente"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                    </div>
                </div>

                {/* SECCIÓN 2: Botón Actualizar eliminado - Ahora está en el header principal */}
            </div>

            {/* 📱 MOBILE: Selector de Recurso Único */}
            {resources.length > 0 && (
                <div className="lg:hidden bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                        📍 Ver trabajador:
                    </label>
                    <select
                        value={mobileSelectedResource}
                        onChange={(e) => setMobileSelectedResource(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm font-medium"
                    >
                        <option value="todos">📊 Todos los trabajadores</option>
                        {resources.map(r => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* 🖥️ DESKTOP: Filtro de Trabajador para Semana y Mes */}
            {resources.length > 0 && (vista === 'semana' || vista === 'mes') && (
                <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            👤 Filtrar por trabajador:
                        </label>
                        <select
                            value={filtros.recurso}
                            onChange={(e) => setFiltros(prev => ({ ...prev, recurso: e.target.value }))}
                            className="flex-1 max-w-xs px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm font-medium"
                        >
                            <option value="todos">📊 Todos los trabajadores</option>
                            {resources.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* 📊 ESTADÍSTICAS POR ESTADO - Sirven como LEYENDA + STATS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full">
                {/* Confirmadas - AZUL */}
                <div className="bg-blue-50 rounded-lg border-l-4 border-blue-600 px-2 py-1.5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">✓</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-blue-800 font-semibold uppercase">Confirmadas</p>
                            <p className="text-base font-black text-blue-700 leading-tight">{stats.confirmadas}</p>
                        </div>
                    </div>
                </div>
                
                {/* Pendientes - AMARILLO */}
                <div
                    className="bg-yellow-50 rounded-lg border-l-4 border-yellow-500 px-2 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setShowPendingModal(true)}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">⏳</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-yellow-800 font-semibold uppercase">Pendientes</p>
                            <p className="text-base font-black text-yellow-700 leading-tight">{stats.pendientes}</p>
                        </div>
                    </div>
                </div>
                
                {/* Completadas - VERDE */}
                <div
                    className="bg-green-50 rounded-lg border-l-4 border-green-600 px-2 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setShowCompletedModal(true)}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">✓</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-green-800 font-semibold uppercase">Completadas</p>
                            <p className="text-base font-black text-green-700 leading-tight">{stats.completadas}</p>
                        </div>
                    </div>
                </div>
                
                {/* Canceladas - ROJO */}
                <div
                    className="bg-red-50 rounded-lg border-l-4 border-red-600 px-2 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setShowCancelledModal(true)}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">✕</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-red-800 font-semibold uppercase">Canceladas</p>
                            <p className="text-base font-black text-red-700 leading-tight">{stats.canceladas}</p>
                        </div>
                    </div>
                </div>
                
                {/* No-Shows - GRIS */}
                <div
                    className="bg-gray-100 rounded-lg border-l-4 border-gray-600 px-2 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setShowNoShowsModal(true)}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">⚠</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-gray-800 font-semibold uppercase">No-Shows</p>
                            <p className="text-base font-black text-gray-700 leading-tight">{stats.noShows}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🗓️ CALENDARIO (Vista según selector) */}
            {vista === 'dia' && (
                <VistaDia 
                    fecha={fechaActual}
                    reservations={reservationsFiltradas}
                    resources={resources}
                    blockages={blockages}
                    mobileSelectedResource={mobileSelectedResource}
                    horaInicio={horaInicio}
                    horaFin={horaFin}
                    currentTime={currentTime}
                    calendarExceptions={calendarExceptions}
                    onReservationClick={onReservationClick}
                    onSlotClick={onSlotClick}
                    onCellClick={handleCellClick}
                    onReservationMove={onReservationMove}
                    draggingReservation={draggingReservation}
                    setDraggingReservation={setDraggingReservation}
                    dragOverSlot={dragOverSlot}
                    setDragOverSlot={setDragOverSlot}
                />
            )}

            {vista === 'semana' && (
                <VistaSemana 
                    fecha={fechaActual}
                    reservations={reservationsFiltradas}
                    resources={resources}
                    horaInicio={horaInicio}
                    horaFin={horaFin}
                    onReservationClick={onReservationClick}
                    onSlotClick={onSlotClick}
                />
            )}

            {vista === 'mes' && (
                <VistaMes 
                    fecha={fechaActual}
                    reservations={reservationsFiltradas}
                    resources={resources}
                    onReservationClick={onReservationClick}
                    onDayClick={(day) => {
                        setFechaActual(day);
                        setVista('dia');
                    }}
                />
            )}

            {/* 🆕 QUICK ACTION MODAL */}
            <QuickActionModal
                isOpen={showQuickAction}
                onClose={() => {
                    setShowQuickAction(false);
                    setSelectedCell(null);
                }}
                cellData={selectedCell}
                onAction={handleQuickAction}
            />
            
            {/* 📋 MODAL DE RESERVAS PENDIENTES */}
            {showPendingModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-yellow-500 to-amber-600 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                ⏳ Reservas Pendientes ({stats.pendientes})
                            </h2>
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Lista de pendientes */}
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {reservationsFiltradas.filter(r => r.status === 'pending').length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No hay reservas pendientes
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {reservationsFiltradas
                                        .filter(r => r.status === 'pending')
                                        .slice(0, 30)
                                        .map(reserva => {
                                            const horaFin = calcularHoraFin(
                                                reserva.reservation_time || reserva.appointment_time || '00:00',
                                                reserva.duration_minutes || reserva.service_duration_minutes || 60
                                            );
                                            
                                            return (
                                                <div 
                                                    key={reserva.id}
                                                    onClick={() => {
                                                        // Cerrar modal de pendientes
                                                        setShowPendingModal(false);
                                                        // Llamar al callback para editar la reserva
                                                        if (onReservationClick) {
                                                            onReservationClick(reserva);
                                                        }
                                                        // Opcional: Navegar al día de la reserva
                                                        const reservaDate = reserva.reservation_date || reserva.appointment_date;
                                                        if (reservaDate) {
                                                            setFechaActual(parseISO(reservaDate));
                                                            setVista('dia');
                                                        }
                                                    }}
                                                    className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer hover:bg-yellow-100 active:scale-[0.98]"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h3 className="font-bold text-gray-900 text-base mb-1">
                                                                {reserva.customer_name}
                                                            </h3>
                                                            <div className="space-y-1 text-sm text-gray-700">
                                                                <p className="flex items-center gap-2">
                                                                    <CalendarIcon className="w-4 h-4" />
                                                                    {format(parseISO(reserva.reservation_date || reserva.appointment_date), "EEE dd MMM yyyy", { locale: es })}
                                                                </p>
                                                                <p className="flex items-center gap-2">
                                                                    <Clock className="w-4 h-4" />
                                                                    {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)} - {horaFin}
                                                                    <span className="text-gray-500">({reserva.duration_minutes || 60}min)</span>
                                                                </p>
                                                                {reserva.service_name && (
                                                                    <p className="flex items-center gap-2">
                                                                        ✂️ {reserva.service_name}
                                                                    </p>
                                                                )}
                                                                {reserva.notes && (
                                                                    <p className="text-xs text-gray-600 italic mt-2">
                                                                        💬 {reserva.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-2">
                                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                                                ⏳ Pendiente
                                                            </span>
                                                            <span className="text-xs text-gray-500 italic">
                                                                👆 Clic para editar
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 📋 MODAL DE RESERVAS COMPLETADAS */}
            {showCompletedModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                ✅ Reservas Completadas ({stats.completadas})
                            </h2>
                            <button
                                onClick={() => setShowCompletedModal(false)}
                                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Lista de completadas */}
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {reservationsFiltradas.filter(r => r.status === 'completed').length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No hay reservas completadas
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {reservationsFiltradas
                                        .filter(r => r.status === 'completed')
                                        .slice(0, 30)
                                        .map(reserva => {
                                            const horaFin = calcularHoraFin(
                                                reserva.reservation_time || reserva.appointment_time || '00:00',
                                                reserva.duration_minutes || reserva.service_duration_minutes || 60
                                            );
                                            
                                            return (
                                                <div 
                                                    key={reserva.id}
                                                    className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h3 className="font-bold text-gray-900 text-base mb-1">
                                                                {reserva.customer_name}
                                                            </h3>
                                                            <div className="space-y-1 text-sm text-gray-700">
                                                                <p className="flex items-center gap-2">
                                                                    <CalendarIcon className="w-4 h-4" />
                                                                    {format(parseISO(reserva.reservation_date || reserva.appointment_date), "EEE dd MMM yyyy", { locale: es })}
                                                                </p>
                                                                <p className="flex items-center gap-2">
                                                                    <Clock className="w-4 h-4" />
                                                                    {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)} - {horaFin}
                                                                    <span className="text-gray-500">({reserva.duration_minutes || 60}min)</span>
                                                                </p>
                                                                {reserva.service_name && (
                                                                    <p className="flex items-center gap-2">
                                                                        ✂️ {reserva.service_name}
                                                                    </p>
                                                                )}
                                                                {reserva.notes && (
                                                                    <p className="text-xs text-gray-600 italic mt-2">
                                                                        💬 {reserva.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                                ✅ Completada
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 📋 MODAL DE RESERVAS CANCELADAS */}
            {showCancelledModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                🗑️ Reservas Canceladas ({stats.canceladas})
                            </h2>
                            <button
                                onClick={() => setShowCancelledModal(false)}
                                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Lista de canceladas - SOLO CANCELADAS */}
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {reservationsFiltradas.filter(r => r.status === 'cancelled').length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No hay reservas canceladas
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {reservationsFiltradas
                                        .filter(r => r.status === 'cancelled')
                                        .map(reserva => {
                                            const horaFin = calcularHoraFin(
                                                reserva.reservation_time || reserva.appointment_time || '00:00',
                                                reserva.duration_minutes || reserva.service_duration_minutes || 60
                                            );
                                            
                                            return (
                                                <div 
                                                    key={reserva.id}
                                                    className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h3 className="font-bold text-gray-900 text-base mb-1">
                                                                {reserva.customer_name}
                                                            </h3>
                                                            <div className="space-y-1 text-sm text-gray-700">
                                                                <p className="flex items-center gap-2">
                                                                    <CalendarIcon className="w-4 h-4" />
                                                                    {format(parseISO(reserva.reservation_date || reserva.appointment_date), "EEE dd MMM yyyy", { locale: es })}
                                                                </p>
                                                                <p className="flex items-center gap-2">
                                                                    <Clock className="w-4 h-4" />
                                                                    {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)} - {horaFin}
                                                                    <span className="text-gray-500">({reserva.duration_minutes || 60}min)</span>
                                                                </p>
                                                                {reserva.service_name && (
                                                                    <p className="flex items-center gap-2">
                                                                        ✂️ {reserva.service_name}
                                                                    </p>
                                                                )}
                                                                {reserva.notes && (
                                                                    <p className="text-xs text-gray-600 italic mt-2">
                                                                        💬 {reserva.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                                ❌ Cancelada
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 📋 MODAL DE NO-SHOWS */}
            {showNoShowsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                ⚠️ No-Shows ({stats.noShows})
                            </h2>
                            <button
                                onClick={() => setShowNoShowsModal(false)}
                                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Lista de no-shows - SOLO NO-SHOWS */}
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {reservationsFiltradas.filter(r => r.status === 'no_show').length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No hay no-shows registrados
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {reservationsFiltradas
                                        .filter(r => r.status === 'no_show')
                                        .map(reserva => {
                                            const horaFin = calcularHoraFin(
                                                reserva.reservation_time || reserva.appointment_time || '00:00',
                                                reserva.duration_minutes || reserva.service_duration_minutes || 60
                                            );
                                            
                                            return (
                                                <div 
                                                    key={reserva.id}
                                                    className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h3 className="font-bold text-gray-900 text-base mb-1">
                                                                {reserva.customer_name}
                                                            </h3>
                                                            <div className="space-y-1 text-sm text-gray-700">
                                                                <p className="flex items-center gap-2">
                                                                    <CalendarIcon className="w-4 h-4" />
                                                                    {format(parseISO(reserva.reservation_date || reserva.appointment_date), "EEE dd MMM yyyy", { locale: es })}
                                                                </p>
                                                                <p className="flex items-center gap-2">
                                                                    <Clock className="w-4 h-4" />
                                                                    {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)} - {horaFin}
                                                                    <span className="text-gray-500">({reserva.duration_minutes || 60}min)</span>
                                                                </p>
                                                                {reserva.service_name && (
                                                                    <p className="flex items-center gap-2">
                                                                        ✂️ {reserva.service_name}
                                                                    </p>
                                                                )}
                                                                {reserva.notes && (
                                                                    <p className="text-xs text-gray-600 italic mt-2">
                                                                        💬 {reserva.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                                                                ⚠️ No-Show
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 📅 VISTA DÍA - Timeline vertical con columnas por recurso + DRAG & DROP
function VistaDia({ 
    fecha, 
    reservations, 
    resources, 
    blockages = [],
    mobileSelectedResource = 'todos',
    horaInicio, 
    horaFin,
    currentTime,
    calendarExceptions = [], // 🆕 Excepciones de calendario (días cerrados, festivos, etc.)
    onReservationClick, 
    onSlotClick,
    onCellClick,
    onReservationMove,
    draggingReservation,
    setDraggingReservation,
    dragOverSlot,
    setDragOverSlot
}) {
    // ✅ ====================================================================
    // 📐 ESTÁNDAR DE VISUALIZACIÓN DE RESERVAS - TABLA MAESTRA
    // ====================================================================
    // ALTURA: numSlots * 27px
    //   - Cada 1/4 de hora (15min) = 27px EXACTOS
    //   - Tabla maestra validada:
    //     • 15min  = 1 cuarto  → 1 × 27 = 27px
    //     • 30min  = 2 cuartos → 2 × 27 = 54px ✓
    //     • 45min  = 3 cuartos → 3 × 27 = 81px ✓
    //     • 60min  = 4 cuartos → 4 × 27 = 108px
    //     • 90min  = 6 cuartos → 6 × 27 = 162px
    //     • 120min = 8 cuartos → 8 × 27 = 216px
    //
    // DISEÑO ADAPTATIVO:
    //   - Reservas ≤30min: Ultra-compacto (3 líneas, texto pequeño, padding 2px 4px)
    //     └─ Línea 1: Nombre + Ícono estado
    //     └─ Línea 2: Servicio
    //     └─ Línea 3: Hora + Duración
    //   - Reservas >30min: Diseño estándar (3 líneas, texto normal, padding 4px 6px)
    //
    // POSICIONAMIENTO: Offset visual de +15min (solo tarjetas)
    //   - Slot :15 busca BD :00 | Slot :30 busca BD :15 | Slot :45 busca BD :30
    //   - Fila hora:00 busca BD (hora-1):45
    //   - Resultado: Reserva de 16:45 aparece en slot 16:45 y ocupa hasta 17:45
    //
    // LÍNEA ROJA (hora actual): SIN offset, busca fila directamente
    //   - Hora real 17:03 → busca fila data-hour="17" data-minute="0"
    //   - Fila data-hour="17" data-minute="0" está VISUALMENTE en posición 17:00
    //   - Progreso: 3min / 15min = 20% → línea aparece ligeramente debajo de 17:00
    // ====================================================================
    
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    const diaSemanaActual = fecha.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    
    // 🔍 DIAGNÓSTICO: Log de reservas recibidas
    React.useEffect(() => {
        if (reservations.length > 0) {
            console.log('📅 CALENDARIO - Fecha mostrada:', fechaStr);
            console.log('📋 CALENDARIO - Total reservas recibidas:', reservations.length);
            console.log('📋 CALENDARIO - Fechas de reservas:', reservations.map(r => ({
                customer: r.customer_name,
                fecha: r.reservation_date || r.appointment_date,
                status: r.status,
                tieneReservationDate: !!r.reservation_date,
                tieneAppointmentDate: !!r.appointment_date
            })));
            console.log('📋 CALENDARIO - Estados de reservas:', reservations.map(r => r.status));
        }
    }, [reservations, fechaStr]);
    
    // 🎯 FILTRAR: Ocultar solo canceladas del calendario
    // Las reservas "no_show" se muestran pero con estilo diferente (tachadas/opacidad)
    // ⚠️ IMPORTANTE: Usar reservations (que ya viene filtrado desde el componente padre)
    const reservasDelDia = reservations.filter(r => {
        // ✅ Normalizar fecha: puede venir como reservation_date o appointment_date
        let fechaReserva = r.reservation_date || r.appointment_date;
        
        // ✅ Si la fecha viene como objeto Date, convertir a string
        if (fechaReserva instanceof Date) {
            fechaReserva = format(fechaReserva, 'yyyy-MM-dd');
        }
        
        // ✅ Si viene como string pero con formato diferente, normalizar
        if (typeof fechaReserva === 'string') {
            // Si tiene hora incluida (ej: "2025-11-19T09:00:00"), extraer solo la fecha
            if (fechaReserva.includes('T')) {
                fechaReserva = fechaReserva.split('T')[0];
            }
            // Si tiene espacios, tomar solo la parte de fecha
            if (fechaReserva.includes(' ')) {
                fechaReserva = fechaReserva.split(' ')[0];
            }
        }
        
        const coincideFecha = fechaReserva === fechaStr;
        const noEstaCancelada = r.status !== 'cancelled'; // Solo ocultar canceladas
        
        // ✅ Incluir eventos 'blocked' de Google Calendar
        const esValida = coincideFecha && noEstaCancelada;
        
        if (!coincideFecha && noEstaCancelada && r.status === 'blocked') {
            // Log específico para eventos bloqueados que no coinciden fecha
            console.log('⚠️ Evento bloqueado no mostrado (fecha diferente):', {
                customer: r.customer_name,
                fechaReserva,
                fechaMostrada: fechaStr,
                status: r.status,
                gcal_event_id: r.gcal_event_id
            });
        }
        
        return esValida;
    });
    
    // 🔍 DIAGNÓSTICO: Log de reservas filtradas
    React.useEffect(() => {
        if (reservations.length > 0) {
            console.log('✅ CALENDARIO - Reservas del día filtradas:', reservasDelDia.length);
            if (reservasDelDia.length === 0 && reservations.length > 0) {
                console.warn('⚠️ CALENDARIO - No hay reservas para mostrar. Posibles causas:');
                console.warn('   1. Fecha diferente (mostrando:', fechaStr, 'vs reservas en otras fechas)');
                console.warn('   2. Todas están canceladas o no_show');
                console.warn('   3. Problema con mapeo reservation_date/appointment_date');
            }
        }
    }, [reservasDelDia.length, reservations.length, fechaStr]);
    const bloqueosDelDia = blockages.filter(b => b.blocked_date === fechaStr);
    
    // 🎯 Referencia a la tabla para buscar filas por minuto exacto
    const tableRef = React.useRef(null);
    const [linePosition, setLinePosition] = React.useState(0);
    
    // 🆕 FUNCIÓN GLOBAL: Calcular duración de reserva en minutos (ESQUEMA REAL)
    const calcularDuracionReserva = (reserva) => {
        // 1. Campo real de appointments
        if (reserva.duration_minutes) return parseInt(reserva.duration_minutes);
        
        // 2. Si tiene campo 'duration' directo (legacy)
        if (reserva.duration) return parseInt(reserva.duration);
        
        // 3. Si tiene 'service_duration_minutes'
        if (reserva.service_duration_minutes) return parseInt(reserva.service_duration_minutes);
        
        // 4. Si tiene service con duration_minutes
        if (reserva.service?.duration_minutes) return parseInt(reserva.service.duration_minutes);
        
        // 5. Default: 60 minutos
        return 60;
    };
    
    // 🎯 CALCULAR POSICIÓN DE LA LÍNEA ROJA - Buscar fila exacta del minuto
    React.useEffect(() => {
        if (!tableRef.current) return;
        
        const calculateLinePosition = () => {
            const table = tableRef.current;
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            
            if (!thead || !tbody) return;
            
            // 🎯 USAR HORA REAL ACTUAL
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            
            // Si está fuera del rango, no mostrar
            if (currentHour < horaInicio || currentHour >= horaFin) {
                setLinePosition(-1000);
                return;
            }
            
            // 🎯 SIN OFFSET - Buscar fila directamente por hora REAL
            // Fila data-hour="17" data-minute="0" está VISUALMENTE en 17:00
            const minInf = Math.floor(currentMinute / 15) * 15;
            const minSup = minInf + 15;
            const horaSup = minSup >= 60 ? currentHour + 1 : currentHour;
            const minSupAjustado = minSup % 60;
            
            const filaInf = tbody.querySelector(`tr[data-hour="${currentHour}"][data-minute="${minInf}"]`);
            const filaSup = tbody.querySelector(`tr[data-hour="${horaSup}"][data-minute="${minSupAjustado}"]`);
            
            if (!filaInf) return;
            
            // 🎯 Usar offsetTop para obtener posición relativa al contenedor
            const theadHeight = thead.getBoundingClientRect().height;
            const topInf = filaInf.offsetTop;
            
            if (filaSup && horaSup <= horaFin) {
                const topSup = filaSup.offsetTop;
                const progreso = (currentMinute - minInf) / 15;
                const distancia = topSup - topInf;
                const posicion = theadHeight + topInf + (distancia * progreso) - 61; // RESTAR 61px (subió 1px desde -60)
                setLinePosition(posicion);
            } else {
                setLinePosition(theadHeight + topInf + 10 - 61);
            }
        };
        
        // Calcular inmediatamente
        calculateLinePosition();
        
        // Re-calcular cada segundo
        const interval = setInterval(calculateLinePosition, 1000);
        
        return () => clearInterval(interval);
    }, [currentTime, horaInicio, horaFin, resources, reservations]);
    
    // Generar horas del día
    const horas = Array.from({ length: horaFin - horaInicio + 1 }, (_, i) => horaInicio + i);

    // Si no hay recursos definidos, usar uno por defecto
    let recursosDisplay = resources.length > 0 ? resources : [{ id: 'default', name: 'Todos' }];
    
    // 📱 MOBILE: Filtrar por recurso seleccionado
    if (mobileSelectedResource !== 'todos') {
        recursosDisplay = recursosDisplay.filter(r => r.id === mobileSelectedResource);
    }
    
    // ⚠️ NOTA: El filtrado por recurso en desktop (semana/mes) se hace en el componente padre
    // antes de pasar las reservas, así que no es necesario filtrar aquí

    // 📐 CÁLCULO DE ANCHO EQUITATIVO
    // Desktop: máximo 5 recursos visibles, ancho equitativo
    // Mobile: cada recurso tiene ancho fijo
    const numRecursos = recursosDisplay.length;
    const anchoRecursoMobile = 180; // px
    const anchoRecursoDesktop = numRecursos <= 5 ? `${100 / numRecursos}%` : '240px';

    // 🆕 Handlers de Drag & Drop - Mejorado para intervalos de 15 min
    const handleDragStart = (e, reserva) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget);
        setDraggingReservation(reserva);
    };

    const handleDragOver = (e, hora, minuto, recursoId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverSlot({ hora, minuto, recursoId, fecha: fechaStr });
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverSlot(null);
    };

    const handleDrop = (e, hora, minuto, recursoId) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggingReservation || !onReservationMove) {
            setDraggingReservation(null);
            setDragOverSlot(null);
            return;
        }

        // 🎯 COMPENSAR OFFSET VISUAL: Restar 15 minutos
        // Slot visual 12:00 → BD debe ser 11:45
        // Slot visual 12:15 → BD debe ser 12:00
        // Slot visual 12:30 → BD debe ser 12:15
        // Slot visual 12:45 → BD debe ser 12:30
        let horaFinal = hora;
        let minutoFinal = minuto - 15;
        
        if (minutoFinal < 0) {
            minutoFinal += 60;
            horaFinal -= 1;
        }
        
        const nuevaHora = `${horaFinal.toString().padStart(2, '0')}:${minutoFinal.toString().padStart(2, '0')}`;
        
        console.log(`🎯 DROP: Slot visual ${hora}:${minuto.toString().padStart(2, '0')} → BD ${nuevaHora}`);
        
        // Verificar si ha cambiado algo
        if (draggingReservation.reservation_time === nuevaHora && 
            draggingReservation.reservation_date === fechaStr &&
            (draggingReservation.resource_id === recursoId || draggingReservation.table_id === recursoId)) {
            setDraggingReservation(null);
            setDragOverSlot(null);
            return;
        }

        // Llamar al callback con los datos actualizados
        onReservationMove(draggingReservation, {
            newDate: fechaStr,
            newTime: nuevaHora,
            newResourceId: recursoId
        });

        setDraggingReservation(null);
        setDragOverSlot(null);
    };

    const handleDragEnd = () => {
        setDraggingReservation(null);
        setDragOverSlot(null);
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 relative" style={{ overflow: 'visible' }}>
            {/* TABLA HTML - Alineación PERFECTA garantizada */}
            <div className="overflow-x-auto">
                <table ref={tableRef} className="w-full border-collapse">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-20">
                    <tr className="border-b-2 border-gray-400">
                        {/* Columna de hora */}
                        <th className="w-20 border-r-2 border-gray-400 bg-white py-4">
                            <Clock className="w-5 h-5 text-gray-500 mx-auto" />
                        </th>
                        
                        {/* Recursos/Empleados - HORIZONTAL CENTRADO */}
                        {recursosDisplay.map((recurso, idx) => {
                            // 🚨 VERIFICAR SI EL DÍA ESTÁ CERRADO EN EL CALENDARIO
                            const fechaStr = format(fecha, 'yyyy-MM-dd');
                            const dayException = calendarExceptions?.find(
                                ex => ex.exception_date === fechaStr
                            );
                            const isDayClosed = dayException && (dayException.is_open === false || dayException.is_open === null);
                            
                            // Si el día está cerrado, mostrar "Sin horario" para TODOS los empleados
                            let horarioTexto = 'Sin horario';
                            let tieneHorarioHoy = false;
                            
                            if (!isDayClosed) {
                                // Solo calcular horario si el día NO está cerrado
                            const schedulesToday = recurso.employee_schedules?.filter(s => 
                                s.day_of_week === diaSemanaActual && s.is_working
                            ) || [];

                                tieneHorarioHoy = schedulesToday.length > 0 && schedulesToday[0].shifts && schedulesToday[0].shifts.length > 0;
                            
                            if (tieneHorarioHoy) {
                                const shifts = schedulesToday[0].shifts;
                                const primerTurno = shifts[0];
                                const ultimoTurno = shifts[shifts.length - 1];
                                horarioTexto = `${primerTurno.start.slice(0, 5)} - ${ultimoTurno.end.slice(0, 5)}`;
                                }
                            }

                            return (
                                <th 
                                    key={recurso.id}
                                    className={`py-4 px-3 ${
                                        idx < recursosDisplay.length - 1 ? 'border-r-2 border-gray-300' : ''
                                    }`}
                                    style={{ width: `${100 / numRecursos}%` }}
                                >
                                    {/* Layout HORIZONTAL centrado - Avatar al lado, TODO centrado */}
                                    <div className="flex items-center justify-center gap-3">
                                        {/* Avatar con sombra de color */}
                                        <div 
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-lg flex-shrink-0 transition-transform hover:scale-105"
                                            style={{ 
                                                backgroundColor: recurso.color || '#6366f1',
                                                boxShadow: `0 4px 12px ${recurso.color || '#6366f1'}35`
                                            }}
                                        >
                                            {recurso.name[0]}
                                        </div>
                                        
                                        {/* Texto TODO centrado y alineado */}
                                        <div className="flex flex-col items-center justify-center min-w-0">
                                            <h3 className="font-bold text-gray-900 text-base leading-tight text-center">
                                                {recurso.name}
                                            </h3>
                                            
                                            {/* Recurso con ícono */}
                                            {tieneHorarioHoy && recurso.resource_name && (
                                                <p className="text-xs text-purple-600 font-semibold mt-0.5 text-center whitespace-nowrap">
                                                    📍 {recurso.resource_name}
                                                </p>
                                            )}
                                            
                                            {/* Horario con ícono */}
                                            <p className="text-xs text-gray-600 font-medium mt-0.5 text-center whitespace-nowrap">
                                                🕐 {horarioTexto}
                                            </p>
                                        </div>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                
                <tbody>
                    {horas.map(hora => (
                        <Fragment key={hora}>
                            {/* Hora completa (00) */}
                            <tr 
                                data-hour={hora}
                                data-minute={0}
                                className="h-[18px] border-b-2 border-gray-300"
                                style={{ height: '18px', maxHeight: '18px', minHeight: '18px', overflow: 'visible' }}
                            >
                                {/* Celda de hora */}
                                <td className="w-20 h-[18px] border-r-2 border-gray-400 bg-white align-top text-right pr-2 pt-0.5">
                                    <span className="text-xs font-bold text-gray-700">
                                        {hora.toString().padStart(2, '0')}:00
                                    </span>
                                </td>

                                {/* Celdas de recursos */}
                            {recursosDisplay.map((recurso, idx) => {
                                // 🆕 FUNCIÓN: Verificar si esta celda está ocupada por reserva previa
                                const esCeldaOcupadaPorReservaAnterior = (hora, minuto = 0) => {
                                    // AJUSTE: restar 15min por offset visual
                                    const tiempoActual = hora * 60 + minuto - 15;
                                    
                                    return reservasDelDia.some(r => {
                                        // ✅ FILTRAR POR RECURSO O EMPLEADO (para eventos bloqueados de Google Calendar)
                                        const coincideRecurso = r.resource_id === recurso.id || 
                                                               r.employee_id === recurso.id ||
                                                               (r.status === 'blocked' && r.employee_id === recurso.id);
                                        if (!coincideRecurso) return false;
                                        
                                        const [horaRes, minRes] = (r.reservation_time || r.appointment_time || '00:00').split(':').map(Number);
                                        const tiempoInicio = horaRes * 60 + minRes;
                                        const duracion = calcularDuracionReserva(r);
                                        const tiempoFin = tiempoInicio + duracion;
                                        
                                        // Esta celda está en el rango de una reserva que empezó antes (SIN incluir inicio)
                                        return tiempoActual > tiempoInicio && tiempoActual < tiempoFin;
                                    });
                                };

                                // ✅ ESTÁNDAR DE VISUALIZACIÓN: Offset de +15min en fila principal
                                // Fila hora:00 busca reservas de (hora-1):45
                                // Ejemplo: Fila 17:00 → busca BD 16:45
                                // Resultado: Reserva de 16:45 aparece en su slot correcto
                                const reservasEnHora = reservasDelDia.filter(r => {
                                    // ✅ Filtrar por resource_id O employee_id (para eventos bloqueados de Google Calendar)
                                    const coincideRecurso = r.resource_id === recurso.id || 
                                                           r.employee_id === recurso.id ||
                                                           (r.status === 'blocked' && r.employee_id === recurso.id);
                                    if (!coincideRecurso) return false;
                                    
                                    const timeStr = r.reservation_time || r.appointment_time || '00:00';
                                    const [horaReserva, minReserva] = timeStr.split(':').map(Number);
                                    return horaReserva === (hora - 1) && minReserva === 45;
                                });

                                // 🚫 Verificar si empleado NO trabaja en esta hora (hora:00)
                                const schedulesToday = recurso.employee_schedules?.filter(s => 
                                    s.day_of_week === diaSemanaActual && s.is_working
                                ) || [];
                                
                                let estaFueraDeHorario = true;
                                if (schedulesToday.length > 0 && schedulesToday[0].shifts) {
                                    const shifts = schedulesToday[0].shifts;
                                    const minutosActuales = hora * 60; // hora:00 en minutos
                                    
                                    // Verificar si este momento está dentro de algún turno
                                    // La hora EXACTA de inicio NO está disponible (empiezan 1 minuto después)
                                    // La hora EXACTA de fin SÍ está disponible (trabajan hasta esa hora)
                                    estaFueraDeHorario = !shifts.some(shift => {
                                        const [hInicio, mInicio] = shift.start.split(':').map(Number);
                                        const [hFin, mFin] = shift.end.split(':').map(Number);
                                        const inicioMin = hInicio * 60 + mInicio;
                                        const finMin = hFin * 60 + mFin;
                                        return minutosActuales > inicioMin && minutosActuales <= finMin;
                                    });
                                }
                                
                                // 🔒 Buscar bloqueos de este recurso en esta hora
                                const bloqueosEnHora = bloqueosDelDia.filter(b => {
                                    // Bloqueo global (sin resource_id) o del recurso específico
                                    const esRecursoCorrecto = !b.resource_id || b.resource_id === recurso.id;
                                    const horaBloqueo = parseInt(b.start_time?.split(':')[0] || '0');
                                    return esRecursoCorrecto && horaBloqueo === hora;
                                });

                                const tieneBloqueo = bloqueosEnHora.length > 0;
                                const bloqueo = bloqueosEnHora[0]; // Tomar el primer bloqueo si hay varios

                                const isDragOver = dragOverSlot?.hora === hora && 
                                                  dragOverSlot?.minuto === 0 &&
                                                  dragOverSlot?.recursoId === recurso.id &&
                                                  dragOverSlot?.fecha === fechaStr;

                                return (
                                    <td
                                        key={`${recurso.id}-${hora}`}
                                        className={`h-[18px] transition-all align-top ${
                                            idx < recursosDisplay.length - 1 ? 'border-r-2 border-gray-300' : ''
                                        } ${
                                            estaFueraDeHorario ? 'bg-gray-100 cursor-not-allowed' :
                                            isDragOver ? 'bg-blue-200 border-2 border-blue-500 border-dashed shadow-lg' : 
                                            tieneBloqueo ? 'bg-red-50 hover:bg-red-100 cursor-pointer' : 
                                            'hover:bg-blue-50 cursor-pointer'
                                        }`}
                                        style={{
                                            height: '18px',
                                            maxHeight: '18px',
                                            minHeight: '18px',
                                            overflow: 'visible',
                                            position: 'relative',
                                            padding: 0,
                                            verticalAlign: 'top',
                                            ...(estaFueraDeHorario ? {
                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(156, 163, 175, 0.2) 10px, rgba(156, 163, 175, 0.2) 20px)'
                                            } : {})
                                        }}
                                        onClick={() => {
                                            if (estaFueraDeHorario) return; // No permitir clic si está fuera de horario
                                            
                                            const timeStr = `${hora.toString().padStart(2, '0')}:00`;
                                            if (tieneBloqueo) {
                                                // Celda bloqueada - abrir modal con opciones de bloqueo
                                                onCellClick(recurso, fechaStr, timeStr, null, bloqueo);
                                            } else if (reservasEnHora.length === 0) {
                                                // Celda vacía - abrir modal de acciones
                                                onCellClick(recurso, fechaStr, timeStr, null, null);
                                            }
                                        }}
                                        onDragOver={(e) => {
                                            if (!estaFueraDeHorario) {
                                                handleDragOver(e, hora, 0, recurso.id);
                                            }
                                        }}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => {
                                            if (!estaFueraDeHorario) {
                                                handleDrop(e, hora, 0, recurso.id);
                                            }
                                        }}
                                    >
                                        {reservasEnHora.map(reserva => {
                                            // 🎨 COLORES: Usar color del empleado SIEMPRE (no solo para bloqueados)
                                            let colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                            
                                            // 🎨 COLOR DEL EMPLEADO: Buscar el empleado asignado (employee_id o resource_id)
                                            let employeeColor = null;
                                            const employeeId = reserva.employee_id || reserva.resource_id;
                                            if (employeeId) {
                                                // Buscar el empleado para obtener su color
                                                const empleado = resources.find(r => r.id === employeeId);
                                                if (empleado && empleado.color) {
                                                    employeeColor = empleado.color;
                                                }
                                            }
                                            
                                            // ✅ Si estamos arrastrando y hay un dragOverSlot, usar el color del recurso destino
                                            if (draggingReservation?.id === reserva.id && dragOverSlot?.recursoId) {
                                                const recursoDestino = resources.find(r => r.id === dragOverSlot.recursoId);
                                                if (recursoDestino && recursoDestino.color) {
                                                    employeeColor = recursoDestino.color;
                                                }
                                            }
                                            
                                            const isDragging = draggingReservation?.id === reserva.id;
                                            const statusIcon = getStatusIcon(reserva);
                                            
                                            // 🆕 DURACIÓN VISUAL: Calcular altura del bloque
                                            const duracionMinutos = calcularDuracionReserva(reserva);
                                            const numSlots = Math.ceil(duracionMinutos / 15); // Cuántos intervalos de 15min ocupa
                                            
                                            // ✅ TABLA MAESTRA: Cada 1/4 = 27px
                                            // 30min (2 cuartos) → 2 * 27 = 54px ✓
                                            // 45min (3 cuartos) → 3 * 27 = 81px ✓
                                            // 60min (4 cuartos) → 4 * 27 = 108px
                                            const alturaTotal = numSlots * 27;
                                            
                                            return (
                                                <div
                                                    key={reserva.id}
                                                    draggable={true}
                                                    onDragStart={(e) => handleDragStart(e, reserva)}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const timeStr = `${hora.toString().padStart(2, '0')}:00`;
                                                        onCellClick(recurso, fechaStr, timeStr, reserva, null);
                                                    }}
                                                    className={`${employeeColor ? '' : colors.bg} ${employeeColor ? '' : colors.border} ${employeeColor ? '' : colors.bgHover} rounded-lg shadow-md transition-all ${
                                                        reserva.status === 'no_show' ? 'opacity-50 line-through' : ''
                                                    } ${
                                                        isDragging ? 'opacity-50 scale-95 rotate-2 cursor-grabbing' : 'hover:shadow-lg hover:scale-105 hover:-translate-y-0.5 cursor-grab'
                                                    }`}
                                                    style={{
                                                        height: `${alturaTotal}px`,
                                                        position: 'absolute',
                                                        top: '0px',
                                                        left: '3px',
                                                        right: '3px',
                                                        padding: duracionMinutos <= 30 ? '2px 4px' : '4px 6px',
                                                        zIndex: 20,
                                                        pointerEvents: 'auto',
                                                        boxSizing: 'border-box',
                                                        // 🎨 Aplicar color del empleado si es evento bloqueado
                                                        ...(employeeColor ? {
                                                            backgroundColor: `${employeeColor}20`, // 20% de opacidad
                                                            borderLeft: `5px solid ${employeeColor}`,
                                                        } : {})
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (employeeColor) {
                                                            e.currentTarget.style.backgroundColor = `${employeeColor}30`;
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (employeeColor) {
                                                            e.currentTarget.style.backgroundColor = `${employeeColor}20`;
                                                        }
                                                    }}
                                                >
                                                    {/* 🎨 DISEÑO ADAPTATIVO según duración */}
                                                    {duracionMinutos <= 30 ? (
                                                        // ⚡ DISEÑO ULTRA-COMPACTO para 15-30 min - TODA LA INFO
                                                        <>
                                                            {/* Línea 1: Cliente + Estado */}
                                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                                <p className={`font-bold text-[11px] ${colors.text} truncate flex-1 leading-tight`}>
                                                                    {reserva.customer_name}
                                                                </p>
                                                                {statusIcon && (
                                                                    <div className="flex-shrink-0 text-sm">
                                                                        {statusIcon}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Línea 2: Servicio compacto O información de Google Calendar */}
                                                            {reserva.service_name ? (
                                                                <p className="text-[10px] text-gray-700 truncate mb-0.5 font-medium leading-none">
                                                                    ✂️ {reserva.service_name}
                                                                </p>
                                                            ) : (() => {
                                                                // ✅ Mostrar información de Google Calendar si no hay servicio
                                                                let gcalInfo = null;
                                                                try {
                                                                    if (reserva.internal_notes) {
                                                                        const parsed = typeof reserva.internal_notes === 'string' 
                                                                            ? JSON.parse(reserva.internal_notes) 
                                                                            : reserva.internal_notes;
                                                                        if (parsed.original_summary || parsed.original_description) {
                                                                            gcalInfo = parsed;
                                                                        }
                                                                    }
                                                                } catch (e) {
                                                                    // Ignorar errores de parseo
                                                                }
                                                                
                                                                const displayText = gcalInfo?.original_summary || reserva.notes || reserva.customer_name;
                                                                if (displayText && displayText !== reserva.customer_name) {
                                                                    return (
                                                                        <p className="text-[10px] text-gray-700 truncate mb-0.5 font-medium leading-none">
                                                                            📅 {displayText}
                                                                        </p>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                            {/* Línea 3: Rango de Horas + Duración */}
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <div className="flex items-center gap-0.5 text-gray-700 font-bold">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    <span>
                                                                        {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)}
                                                                        {' - '}
                                                                        {calcularHoraFin((reserva.reservation_time || reserva.appointment_time || '00:00'), duracionMinutos)}
                                                                    </span>
                                                                </div>
                                                                <span className="text-gray-600 font-bold">
                                                                    {duracionMinutos}min
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        // 📋 DISEÑO COMPLETO para 45+ min (3+ cuartos)
                                                        <>
                                                            {/* Línea 1: Cliente + Estado */}
                                                            <div className="flex items-start justify-between gap-1 mb-1">
                                                                <p className={`font-bold text-sm ${colors.text} truncate flex-1 leading-snug`}>
                                                                    {reserva.customer_name}
                                                                </p>
                                                                {statusIcon && (
                                                                    <div className="flex-shrink-0 text-base">
                                                                        {statusIcon}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Línea 2: Servicio */}
                                                            {reserva.service_name && (
                                                                <p className="text-xs text-gray-700 truncate mb-1 font-medium leading-snug">
                                                                    ✂️ {reserva.service_name}
                                                                </p>
                                                            )}
                                                            
                                                            {/* Línea 3: Rango de Horas + Duración */}
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-1 text-gray-700 font-bold">
                                                                    <Clock className="w-3 h-3" />
                                                                    <span>
                                                                        {(reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5)}
                                                                        {' - '}
                                                                        {calcularHoraFin((reserva.reservation_time || reserva.appointment_time || '00:00'), duracionMinutos)}
                                                                    </span>
                                                                </div>
                                                                <span className="text-gray-600 font-bold">
                                                                    {duracionMinutos}min
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* 🔒 Mostrar bloqueo si existe */}
                                        {tieneBloqueo && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const timeStr = `${hora.toString().padStart(2, '0')}:00`;
                                                    onCellClick(recurso, fechaStr, timeStr, null, bloqueo);
                                                }}
                                                className="bg-red-100 border-l-4 border-red-500 rounded-lg p-1.5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:scale-105"
                                            >
                                                <p className="font-semibold text-xs text-red-900 flex items-center gap-0.5">
                                                    🚫 Bloqueado
                                                </p>
                                                {bloqueo.reason && (
                                                    <p className="text-[10px] text-red-700 truncate">
                                                        {bloqueo.reason}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                            </tr>

                            {/* Intervalos de 15 minutos (:15, :30, :45) */}
                            {[15, 30, 45].map(minuto => (
                                <tr 
                                    key={`${hora}-${minuto}`}
                                    data-hour={hora}
                                    data-minute={minuto}
                                    className="h-[18px] border-b border-gray-200"
                                    style={{ height: '18px', maxHeight: '18px', minHeight: '18px', overflow: 'visible' }}
                                >
                                    {/* Celda de minuto */}
                                    <td className="w-20 h-[18px] border-r-2 border-gray-400 bg-white text-right pr-2">
                                        {minuto !== 0 && (
                                            <span className="text-[10px] text-gray-400 font-medium">
                                            :{minuto}
                                        </span>
                                        )}
                                    </td>

                                    {/* Celdas de slots - ocultar si están ocupadas */}
                                    {recursosDisplay.map((recurso, idx) => {
                                        // 🆕 DURACIÓN VISUAL: Verificar si este slot está ocupado
                                        // AJUSTE: restar 15min porque tenemos offset visual
                                        const tiempoActual = hora * 60 + minuto - 15;
                                        
                                        const reservaEnEsteCelda = reservasDelDia.find(r => {
                                            // ✅ FILTRAR POR RECURSO/EMPLEADO
                                            // ✅ Filtrar por resource_id O employee_id (para eventos bloqueados de Google Calendar)
                                            const coincideRecurso = r.resource_id === recurso.id || 
                                                                   r.employee_id === recurso.id ||
                                                                   (r.status === 'blocked' && r.employee_id === recurso.id);
                                            if (!coincideRecurso) return false;
                                            
                                            const [horaRes, minRes] = (r.reservation_time || '00:00').split(':').map(Number);
                                            const tiempoInicio = horaRes * 60 + minRes;
                                            
                                            // Calcular duración (ESQUEMA REAL)
                                            let duracion = 60;
                                            if (r.duration_minutes) duracion = parseInt(r.duration_minutes); // ✅ Campo real
                                            else if (r.duration) duracion = parseInt(r.duration);
                                            else if (r.service_duration_minutes) duracion = parseInt(r.service_duration_minutes);
                                            else if (r.service?.duration_minutes) duracion = parseInt(r.service.duration_minutes);
                                            
                                            const tiempoFin = tiempoInicio + duracion;
                                            
                                            return tiempoActual > tiempoInicio && tiempoActual < tiempoFin;
                                        });

                                        const estaOcupado = !!reservaEnEsteCelda;
                                        
                                        // 🚫 Verificar si empleado NO trabaja en este minuto
                                        const schedulesToday = recurso.employee_schedules?.filter(s => 
                                            s.day_of_week === diaSemanaActual && s.is_working
                                        ) || [];
                                        
                                        let estaFueraDeHorarioMinuto = true;
                                        if (schedulesToday.length > 0 && schedulesToday[0].shifts) {
                                            const shifts = schedulesToday[0].shifts;
                                            const minutosDesdeMedianoche = hora * 60 + minuto;
                                            
                                            estaFueraDeHorarioMinuto = !shifts.some(shift => {
                                                const [hInicio, mInicio] = shift.start.split(':').map(Number);
                                                const [hFin, mFin] = shift.end.split(':').map(Number);
                                                const inicioMin = hInicio * 60 + mInicio;
                                                const finMin = hFin * 60 + mFin;
                                                return minutosDesdeMedianoche > inicioMin && minutosDesdeMedianoche <= finMin;
                                            });
                                        }
                                        
                                        // 🆕 Drag over state para intervalos de 15min
                                        const isDragOverMinuto = dragOverSlot?.hora === hora && 
                                                                 dragOverSlot?.minuto === minuto &&
                                                                 dragOverSlot?.recursoId === recurso.id &&
                                                                 dragOverSlot?.fecha === fechaStr;
                                        
                                        // ✅ ESTÁNDAR DE VISUALIZACIÓN: Offset de +15min
                                        // Cada slot busca la reserva del cuarto ANTERIOR
                                        // Ejemplo: Slot visual 17:00 → busca BD 16:45
                                        // Resultado: Reserva de 16:45 aparece visualmente en slot 16:45
                                        let minutoABuscar, horaABuscar;
                                        if (minuto === 15) {
                                            minutoABuscar = 0;
                                            horaABuscar = hora;
                                        } else if (minuto === 30) {
                                            minutoABuscar = 15;
                                            horaABuscar = hora;
                                        } else if (minuto === 45) {
                                            minutoABuscar = 30;
                                            horaABuscar = hora;
                                        }
                                        
                                        const reservaQueEmpiezaAqui = reservasDelDia.find(r => {
                                            // ✅ Filtrar por resource_id O employee_id (para eventos bloqueados de Google Calendar)
                                            const coincideRecurso = r.resource_id === recurso.id || 
                                                                   r.employee_id === recurso.id ||
                                                                   (r.status === 'blocked' && r.employee_id === recurso.id);
                                            if (!coincideRecurso) return false;
                                            const timeStr = r.reservation_time || r.appointment_time || '00:00';
                                            const [horaRes, minRes] = timeStr.split(':').map(Number);
                                            return horaRes === horaABuscar && minRes === minutoABuscar;
                                        });
                                        
                                        return (
                                            <td
                                                key={`${recurso.id}-${hora}-${minuto}`}
                                                className={`h-[18px] transition-all relative ${
                                                    idx < recursosDisplay.length - 1 ? 'border-r-2 border-gray-300' : ''
                                                } ${
                                                    estaFueraDeHorarioMinuto ? 'bg-gray-100 cursor-not-allowed' :
                                                    isDragOverMinuto ? 'bg-blue-200 border-2 border-blue-500 border-dashed shadow-lg' :
                                                    estaOcupado 
                                                        ? 'bg-transparent' 
                                                        : 'cursor-pointer hover:bg-blue-50'
                                                }`}
                                                style={{
                                                    height: '18px',
                                                    maxHeight: '18px',
                                                    minHeight: '18px',
                                                    overflow: 'visible',
                                                    position: 'relative',
                                                    padding: 0,
                                                    verticalAlign: 'top',
                                                    ...(estaFueraDeHorarioMinuto ? {
                                                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(156, 163, 175, 0.2) 10px, rgba(156, 163, 175, 0.2) 20px)'
                                                    } : {})
                                                }}
                                                onClick={() => {
                                                    if (estaFueraDeHorarioMinuto || estaOcupado) return;
                                                    
                                                    const timeStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
                                                    onCellClick(recurso, fechaStr, timeStr, null, null);
                                                }}
                                                onDragOver={(e) => {
                                                    if (!estaOcupado && !estaFueraDeHorarioMinuto) {
                                                        handleDragOver(e, hora, minuto, recurso.id);
                                                    }
                                                }}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => {
                                                    if (!estaOcupado && !estaFueraDeHorarioMinuto) {
                                                        handleDrop(e, hora, minuto, recurso.id);
                                                    }
                                                }}
                                            >
                                                {/* 🆕 RENDERIZAR RESERVA QUE EMPIEZA EN ESTE MINUTO */}
                                                {reservaQueEmpiezaAqui && (
                                                    (() => {
                                                        const colors = STATUS_COLORS[reservaQueEmpiezaAqui.status] || STATUS_COLORS.confirmed;
                                                        
                                                        // 🎨 COLOR DEL EMPLEADO: Buscar el empleado asignado (employee_id o resource_id)
                                                        let employeeColor = null;
                                                        const employeeId = reservaQueEmpiezaAqui.employee_id || reservaQueEmpiezaAqui.resource_id;
                                                        if (employeeId) {
                                                            const empleado = resources.find(r => r.id === employeeId);
                                                            if (empleado && empleado.color) {
                                                                employeeColor = empleado.color;
                                                            }
                                                        }
                                                        
                                                        // ✅ Si estamos arrastrando y hay un dragOverSlot, usar el color del recurso destino
                                                        if (draggingReservation?.id === reservaQueEmpiezaAqui.id && dragOverSlot?.recursoId) {
                                                            const recursoDestino = resources.find(r => r.id === dragOverSlot.recursoId);
                                                            if (recursoDestino && recursoDestino.color) {
                                                                employeeColor = recursoDestino.color;
                                                            }
                                                        }
                                                        
                                                        const isDragging = draggingReservation?.id === reservaQueEmpiezaAqui.id;
                                                        const statusIcon = getStatusIcon(reservaQueEmpiezaAqui);
                                                        const duracionMinutos = calcularDuracionReserva(reservaQueEmpiezaAqui);
                                                        const numSlots = Math.ceil(duracionMinutos / 15);
                                                        // ✅ TABLA MAESTRA: Cada 1/4 = 27px
                                                        // 30min (2 cuartos) → 2 * 27 = 54px ✓
                                                        // 45min (3 cuartos) → 3 * 27 = 81px ✓
                                                        // 60min (4 cuartos) → 4 * 27 = 108px
                                                        const alturaTotal = numSlots * 27;
                                                        
                                                        
                                                        return (
                                                            <div
                                                                key={reservaQueEmpiezaAqui.id}
                                                                draggable={true}
                                                                onDragStart={(e) => handleDragStart(e, reservaQueEmpiezaAqui)}
                                                                onDragEnd={handleDragEnd}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const timeStr = `${hora.toString().padStart(2, '0')}:${minuto}`;
                                                                    onCellClick(recurso, fechaStr, timeStr, reservaQueEmpiezaAqui, null);
                                                                }}
                                                                className={`${employeeColor ? '' : colors.bg} ${employeeColor ? '' : colors.border} ${employeeColor ? '' : colors.bgHover} rounded-lg shadow-md transition-all ${
                                                                    reservaQueEmpiezaAqui.status === 'no_show' ? 'opacity-50 line-through' : ''
                                                                } ${
                                                                    isDragging ? 'opacity-50 scale-95 rotate-2 cursor-grabbing' : 'hover:shadow-lg hover:scale-105 hover:-translate-y-0.5 cursor-grab'
                                                                }`}
                                                                style={{
                                                                    height: `${alturaTotal}px`,
                                                                    position: 'absolute',
                                                                    top: '0px',
                                                                    left: '3px',
                                                                    right: '3px',
                                                                    padding: duracionMinutos <= 30 ? '2px 4px' : '4px 6px',
                                                                    zIndex: 20,
                                                                    pointerEvents: 'auto',
                                                                    boxSizing: 'border-box',
                                                                    // 🎨 Aplicar color del empleado
                                                                    ...(employeeColor ? {
                                                                        backgroundColor: `${employeeColor}20`, // 20% de opacidad
                                                                        borderLeft: `5px solid ${employeeColor}`,
                                                                    } : {})
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (employeeColor) {
                                                                        e.currentTarget.style.backgroundColor = `${employeeColor}30`;
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (employeeColor) {
                                                                        e.currentTarget.style.backgroundColor = `${employeeColor}20`;
                                                                    }
                                                                }}
                                                            >
                                                                {/* 🎨 DISEÑO ADAPTATIVO según duración */}
                                                                {duracionMinutos <= 30 ? (
                                                                    // ⚡ DISEÑO ULTRA-COMPACTO para 15-30 min - TODA LA INFO
                                                                    <>
                                                                        {/* Línea 1: Cliente + Estado */}
                                                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                                                            <p className={`font-bold text-[11px] ${colors.text} truncate flex-1 leading-tight`}>
                                                                                {reservaQueEmpiezaAqui.customer_name}
                                                                            </p>
                                                                            {statusIcon && (
                                                                                <div className="flex-shrink-0 text-sm">
                                                                                    {statusIcon}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {/* Línea 2: Servicio compacto O información de Google Calendar */}
                                                                        {reservaQueEmpiezaAqui.service_name ? (
                                                                            <p className="text-[10px] text-gray-700 truncate mb-0.5 font-medium leading-none">
                                                                                ✂️ {reservaQueEmpiezaAqui.service_name}
                                                                            </p>
                                                                        ) : (() => {
                                                                            // ✅ Mostrar información de Google Calendar si no hay servicio
                                                                            let gcalInfo = null;
                                                                            try {
                                                                                if (reservaQueEmpiezaAqui.internal_notes) {
                                                                                    const parsed = typeof reservaQueEmpiezaAqui.internal_notes === 'string' 
                                                                                        ? JSON.parse(reservaQueEmpiezaAqui.internal_notes) 
                                                                                        : reservaQueEmpiezaAqui.internal_notes;
                                                                                    if (parsed.original_summary || parsed.original_description) {
                                                                                        gcalInfo = parsed;
                                                                                    }
                                                                                }
                                                                            } catch (e) {
                                                                                // Ignorar errores de parseo
                                                                            }
                                                                            
                                                                            const displayText = gcalInfo?.original_summary || reservaQueEmpiezaAqui.notes || reservaQueEmpiezaAqui.customer_name;
                                                                            if (displayText && displayText !== reservaQueEmpiezaAqui.customer_name) {
                                                                                return (
                                                                                    <p className="text-[10px] text-gray-700 truncate mb-0.5 font-medium leading-none">
                                                                                        📅 {displayText}
                                                                                    </p>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                        {/* Línea 3: Rango de Horas + Duración */}
                                                                        <div className="flex items-center justify-between text-[10px]">
                                                                            <div className="flex items-center gap-0.5 text-gray-700 font-bold">
                                                                                <Clock className="w-2.5 h-2.5" />
                                                                                <span>
                                                                                    {(reservaQueEmpiezaAqui.reservation_time || reservaQueEmpiezaAqui.appointment_time || '00:00').substring(0, 5)}
                                                                                    {' - '}
                                                                                    {calcularHoraFin((reservaQueEmpiezaAqui.reservation_time || reservaQueEmpiezaAqui.appointment_time || '00:00'), duracionMinutos)}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-gray-600 font-bold">
                                                                                {duracionMinutos}min
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    // 📋 DISEÑO COMPLETO para 45+ min (3+ cuartos)
                                                                    <>
                                                                        {/* Línea 1: Cliente + Estado */}
                                                                        <div className="flex items-start justify-between gap-1 mb-1">
                                                                            <p className={`font-bold text-sm ${colors.text} truncate flex-1 leading-snug`}>
                                                                                {reservaQueEmpiezaAqui.customer_name}
                                                                            </p>
                                                                            {statusIcon && (
                                                                                <div className="flex-shrink-0 text-base">
                                                                                    {statusIcon}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Línea 2: Servicio O información de Google Calendar */}
                                                                        {reservaQueEmpiezaAqui.service_name ? (
                                                                            <p className="text-xs text-gray-700 truncate mb-1 font-medium leading-snug">
                                                                                ✂️ {reservaQueEmpiezaAqui.service_name}
                                                                            </p>
                                                                        ) : (() => {
                                                                            // ✅ Mostrar información de Google Calendar si no hay servicio
                                                                            let gcalInfo = null;
                                                                            try {
                                                                                if (reservaQueEmpiezaAqui.internal_notes) {
                                                                                    const parsed = typeof reservaQueEmpiezaAqui.internal_notes === 'string' 
                                                                                        ? JSON.parse(reservaQueEmpiezaAqui.internal_notes) 
                                                                                        : reservaQueEmpiezaAqui.internal_notes;
                                                                                    if (parsed.original_summary || parsed.original_description) {
                                                                                        gcalInfo = parsed;
                                                                                    }
                                                                                }
                                                                            } catch (e) {
                                                                                // Ignorar errores de parseo
                                                                            }
                                                                            
                                                                            const displayText = gcalInfo?.original_summary || reservaQueEmpiezaAqui.notes || reservaQueEmpiezaAqui.customer_name;
                                                                            if (displayText && displayText !== reservaQueEmpiezaAqui.customer_name) {
                                                                                return (
                                                                                    <p className="text-xs text-gray-700 truncate mb-1 font-medium leading-snug">
                                                                                        📅 {displayText}
                                                                                    </p>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                        
                                                                        {/* Línea 3: Rango de Horas + Duración */}
                                                                        <div className="flex items-center justify-between text-xs">
                                                                            <div className="flex items-center gap-1 text-gray-700 font-bold">
                                                                                <Clock className="w-3 h-3" />
                                                                                <span>
                                                                                    {(reservaQueEmpiezaAqui.reservation_time || reservaQueEmpiezaAqui.appointment_time || '00:00').substring(0, 5)}
                                                                                    {' - '}
                                                                                    {calcularHoraFin((reservaQueEmpiezaAqui.reservation_time || reservaQueEmpiezaAqui.appointment_time || '00:00'), duracionMinutos)}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-gray-600 font-bold">
                                                                                {duracionMinutos}min
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                </tbody>
                </table>
            </div>

            {/* 🔴 LÍNEA ROJA - HORA ACTUAL EN TIEMPO REAL */}
            {linePosition > 0 && (
                <div 
                    className="absolute pointer-events-none z-40"
                    style={{ top: `${linePosition}px`, left: '0', right: '0' }}
                >
                    {/* Línea horizontal roja MÁS GRUESA */}
                    <div className="relative h-0.5 bg-red-500 shadow-lg shadow-red-500/50">
                        {/* Label de hora actual - FUERA, COMPLETAMENTE VISIBLE */}
                        <div className="absolute -top-3.5 z-50" style={{ left: '-85px', width: '70px' }}>
                            <span className="inline-block text-sm font-bold text-white bg-red-500 px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap">
                                {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 📆 VISTA SEMANA - Rediseñada estilo Google Calendar + Booksy MEJORADO
function VistaSemana({ fecha, reservations, resources = [], horaInicio, horaFin, onReservationClick, onSlotClick }) {
    const inicioSemana = startOfWeek(fecha, { locale: es, weekStartsOn: 1 }); // Empezar en Lunes
    const finSemana = endOfWeek(fecha, { locale: es, weekStartsOn: 1 });
    const diasSemana = eachDayOfInterval({ start: inicioSemana, end: finSemana });

    return (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                    {/* 📅 HEADER - Días de la semana MEJORADO */}
                    <div className="grid grid-cols-7 border-b-2 border-gray-400 bg-gradient-to-r from-gray-50 to-gray-100">
                        {diasSemana.map(dia => {
                            const esHoy = isSameDay(dia, new Date());
                            const fechaStr = format(dia, 'yyyy-MM-dd');
                            // ⚠️ IMPORTANTE: Usar reservations (que ya viene filtrado desde el componente padre)
                            const reservasDelDia = reservations.filter(r => 
                                (r.reservation_date === fechaStr || r.appointment_date === fechaStr) && 
                                r.status !== 'cancelled' &&
                                r.status !== 'no_show'
                            );
                            
                            return (
                                <div 
                                    key={dia.toISOString()} 
                                    className={`p-4 text-center border-r last:border-r-0 transition-all ${
                                        esHoy 
                                            ? 'bg-gradient-to-br from-blue-100 to-purple-100 border-blue-300' 
                                            : 'hover:bg-gray-100'
                                    }`}
                                >
                                    <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                                        esHoy ? 'text-blue-700' : 'text-gray-500'
                                    }`}>
                                        {format(dia, 'EEE', { locale: es })}
                                    </p>
                                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-black text-lg ${
                                        esHoy 
                                            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg' 
                                            : 'bg-white text-gray-900 border-2 border-gray-300'
                                    }`}>
                                        {format(dia, 'd')}
                                    </div>
                                    {/* Contador de reservas */}
                                    {reservasDelDia.length > 0 && (
                                        <div className="mt-2">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                                                {reservasDelDia.length} {reservasDelDia.length === 1 ? 'cita' : 'citas'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 📋 GRID DE RESERVAS - Timeline Mejorado */}
                    <div className="grid grid-cols-7 divide-x-2 divide-gray-300 min-h-[600px] bg-gradient-to-b from-white to-gray-50">
                        {diasSemana.map(dia => {
                            const fechaStr = format(dia, 'yyyy-MM-dd');
                            // ⚠️ IMPORTANTE: Usar reservations (que ya viene filtrado desde el componente padre)
                            const reservasDelDia = reservations.filter(r => 
                                (r.reservation_date === fechaStr || r.appointment_date === fechaStr) && 
                                r.status !== 'cancelled' &&
                                r.status !== 'no_show'
                            );
                            const esHoy = isSameDay(dia, new Date());

                            return (
                                <div 
                                    key={dia.toISOString()} 
                                    className={`p-3 relative ${
                                        esHoy ? 'bg-blue-50/20' : ''
                                    }`}
                                >
                                    {reservasDelDia.length === 0 ? (
                                        // Día vacío con diseño elegante
                                        <div className="flex items-center justify-center h-full">
                                            <div className="text-center text-gray-300">
                                                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p className="text-xs font-medium">Sin citas</p>
                                            </div>
                                        </div>
                                    ) : (
                                        // Reservas con diseño mejorado
                                        <div className="space-y-2">
                                            {reservasDelDia
                                                .sort((a, b) => {
                                                    const timeA = a.reservation_time || a.appointment_time || '00:00';
                                                    const timeB = b.reservation_time || b.appointment_time || '00:00';
                                                    return timeA.localeCompare(timeB);
                                                })
                                                .map(reserva => {
                                                    // 🎨 COLORES: Para eventos bloqueados, usar color del empleado
                                                    let colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                                    let employeeColor = null;
                                                    
                                                    if (reserva.status === 'blocked' && reserva.employee_id) {
                                                        // Buscar el empleado para obtener su color
                                                        const empleado = resources.find(r => r.id === reserva.employee_id);
                                                        if (empleado && empleado.color) {
                                                            employeeColor = empleado.color;
                                                        }
                                                    }
                                                    
                                                    const horaInicio = (reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5);
                                                    const duracion = reserva.duration_minutes || reserva.service_duration_minutes || 60;
                                                    const horaFin = calcularHoraFin(horaInicio + ':00', duracion);
                                                    
                                                    return (
                                                        <div
                                                            key={reserva.id}
                                                            onClick={() => onReservationClick(reserva)}
                                                            className={`${employeeColor ? '' : colors.bg} ${employeeColor ? '' : colors.border} rounded-lg p-2.5 cursor-pointer hover:shadow-lg transition-all transform hover:scale-105 hover:-translate-y-0.5`}
                                                            style={{
                                                                // 🎨 Aplicar color del empleado si es evento bloqueado
                                                                ...(employeeColor ? {
                                                                    backgroundColor: `${employeeColor}20`, // 20% de opacidad
                                                                    borderLeft: `4px solid ${employeeColor}`,
                                                                } : {})
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (employeeColor) {
                                                                    e.currentTarget.style.backgroundColor = `${employeeColor}30`;
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (employeeColor) {
                                                                    e.currentTarget.style.backgroundColor = `${employeeColor}20`;
                                                                }
                                                            }}
                                                        >
                                                            {/* Hora - MÁS GRANDE Y DESTACADA */}
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <Clock className="w-3.5 h-3.5 text-gray-600" />
                                                                <span className="font-black text-sm text-gray-900">
                                                                    {horaInicio}
                                                                </span>
                                                                <span className="text-gray-400 font-medium text-xs">→</span>
                                                                <span className="font-bold text-xs text-gray-600">
                                                                    {horaFin}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Cliente */}
                                                            <p className={`font-bold text-xs ${colors.text} truncate mb-1`}>
                                                                👤 {reserva.customer_name}
                                                            </p>
                                                            
                                                            {/* Servicio */}
                                                            {reserva.service_name && (
                                                                <p className="text-[10px] text-gray-600 truncate font-medium">
                                                                    ✂️ {reserva.service_name}
                                                                </p>
                                                            )}
                                                            
                                                            {/* Badge de duración */}
                                                            <div className="mt-1.5 flex justify-end">
                                                                <span className="inline-block px-1.5 py-0.5 rounded-full bg-white/60 text-[9px] font-bold text-gray-600">
                                                                    {duracion}min
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 📊 VISTA MES - Grid mensual
function VistaMes({ fecha, reservations, resources = [], onReservationClick, onDayClick }) {
    const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
    const inicioSemana = startOfWeek(inicioMes, { locale: es, weekStartsOn: 1 }); // Empezar en Lunes
    const finSemana = endOfWeek(finMes, { locale: es, weekStartsOn: 1 });
    const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana });

    return (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 overflow-hidden">
            {/* 📅 HEADER - Días de la semana MEJORADO */}
            <div className="grid grid-cols-7 border-b-2 border-gray-400 bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia, index) => {
                    const esFinSemana = index >= 5; // Sábado y Domingo
                    return (
                        <div 
                            key={dia} 
                            className={`p-3 text-center border-r last:border-r-0 ${
                                esFinSemana ? 'bg-gradient-to-b from-purple-50 to-purple-100' : ''
                            }`}
                        >
                            <span className={`text-xs font-black uppercase tracking-wider ${
                                esFinSemana ? 'text-purple-700' : 'text-gray-700'
                            }`}>
                                {dia}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* 📋 GRID DE DÍAS - Diseño Profesional Mejorado */}
            <div className="grid grid-cols-7 divide-x-2 divide-y-2 divide-gray-300 bg-gradient-to-b from-white to-gray-50">
                {dias.map(dia => {
                    const fechaStr = format(dia, 'yyyy-MM-dd');
                    // 🎯 FILTRAR: SIEMPRE ocultar canceladas y no-shows (estilo Booksy)
                    // ⚠️ IMPORTANTE: Usar reservations (que ya viene filtrado desde el componente padre)
                    const reservasDelDia = reservations.filter(r => 
                        (r.reservation_date === fechaStr || r.appointment_date === fechaStr) && 
                        r.status !== 'cancelled' &&
                        r.status !== 'no_show'
                    );
                    const esHoy = isSameDay(dia, new Date());
                    const esMesActual = dia.getMonth() === fecha.getMonth();
                    const esFinSemana = dia.getDay() === 0 || dia.getDay() === 6;

                    return (
                        <div
                            key={dia.toISOString()}
                            onClick={() => onDayClick(dia)}
                            className={`min-h-[120px] p-2.5 cursor-pointer transition-all duration-200 relative group ${
                                !esMesActual 
                                    ? 'bg-gray-100/40 opacity-60' 
                                    : esHoy 
                                        ? 'bg-gradient-to-br from-blue-50 via-blue-100/50 to-purple-50 border-2 border-blue-400 shadow-md' 
                                        : esFinSemana
                                            ? 'bg-purple-50/30 hover:bg-purple-100/50'
                                            : 'bg-white hover:bg-gray-50 hover:shadow-sm'
                            }`}
                        >
                            {/* Número del día - DESTACADO */}
                            <div className="flex items-center justify-between mb-2">
                                <p className={`text-base font-black ${
                                    esHoy 
                                        ? 'text-blue-700 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-md' 
                                        : esMesActual 
                                            ? 'text-gray-900' 
                                            : 'text-gray-400'
                                }`}>
                                    {format(dia, 'd')}
                                </p>
                                
                                {/* Contador de reservas */}
                                {reservasDelDia.length > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        esHoy 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {reservasDelDia.length}
                                    </span>
                                )}
                            </div>

                            {/* Lista de reservas - MEJORADA */}
                            <div className="space-y-1">
                                {reservasDelDia.slice(0, 4).map(reserva => {
                                    // 🎨 COLORES: Para eventos bloqueados, usar color del empleado
                                    let colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                    let employeeColor = null;
                                    
                                    if (reserva.status === 'blocked' && reserva.employee_id) {
                                        // Buscar el empleado para obtener su color
                                        const empleado = resources.find(r => r.id === reserva.employee_id);
                                        if (empleado && empleado.color) {
                                            employeeColor = empleado.color;
                                        }
                                    }
                                    
                                    const hora = (reserva.reservation_time || reserva.appointment_time || '00:00').substring(0, 5);
                                    
                                    return (
                                        <div
                                            key={reserva.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReservationClick(reserva);
                                            }}
                                            className={`${employeeColor ? '' : colors.bg} ${employeeColor ? '' : colors.border} rounded-md p-1.5 cursor-pointer hover:shadow-md transition-all transform hover:scale-105 text-left group/item`}
                                            style={{
                                                // 🎨 Aplicar color del empleado si es evento bloqueado
                                                ...(employeeColor ? {
                                                    backgroundColor: `${employeeColor}20`, // 20% de opacidad
                                                    borderLeft: `4px solid ${employeeColor}`,
                                                } : {})
                                            }}
                                            onMouseEnter={(e) => {
                                                if (employeeColor) {
                                                    e.currentTarget.style.backgroundColor = `${employeeColor}30`;
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (employeeColor) {
                                                    e.currentTarget.style.backgroundColor = `${employeeColor}20`;
                                                }
                                            }}
                                            title={`${hora} - ${reserva.customer_name} - ${reserva.service_name || 'Servicio'}`}
                                        >
                                            {/* Hora y nombre en una línea compacta */}
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
                                                <span className="text-[10px] font-bold text-gray-700 truncate">
                                                    {hora}
                                                </span>
                                            </div>
                                            <p className={`text-[9px] font-semibold ${colors.text} truncate mt-0.5`}>
                                                {reserva.customer_name}
                                            </p>
                                        </div>
                                    );
                                })}
                                
                                {/* Indicador de más reservas */}
                                {reservasDelDia.length > 4 && (
                                    <div className="pt-1">
                                        <span className="inline-block w-full text-center text-[10px] font-bold text-purple-600 bg-purple-50 rounded-md py-1 px-2 border border-purple-200">
                                            +{reservasDelDia.length - 4} más
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Indicador visual de día vacío */}
                            {reservasDelDia.length === 0 && esMesActual && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-20 transition-opacity">
                                    <CalendarIcon className="w-8 h-8 text-gray-300" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


