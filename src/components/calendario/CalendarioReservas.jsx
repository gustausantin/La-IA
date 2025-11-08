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
        border: 'border-l-4 border-blue-600',
        text: 'text-gray-900',
        dot: 'bg-blue-600',
        bgHover: 'hover:bg-blue-100'
    },
    pending: {
        bg: 'bg-gray-100',
        border: 'border-l-4 border-gray-500',
        text: 'text-gray-900',
        dot: 'bg-gray-500',
        bgHover: 'hover:bg-gray-200'
    },
    cancelled: {
        bg: 'bg-red-50',
        border: 'border-l-4 border-red-600',
        text: 'text-gray-900',
        dot: 'bg-red-600',
        bgHover: 'hover:bg-red-100'
    },
    completed: {
        bg: 'bg-green-50',
        border: 'border-l-4 border-green-600',
        text: 'text-gray-900',
        dot: 'bg-green-600',
        bgHover: 'hover:bg-green-100'
    },
    no_show: {
        bg: 'bg-gray-200',
        border: 'border-l-4 border-gray-600',
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

export default function CalendarioReservas({ 
    reservations = [],
    resources = [], // Profesionales/Recursos (ej: Patricia Taylor, Michael Brown)
    blockages = [], // 🆕 Bloqueos de horas
    onReservationClick = () => {},
    onSlotClick = () => {},
    onRefresh = () => {},
    onReservationMove = null, // 🆕 Callback para mover reserva
    onBlockSlot = null, // 🆕 Callback para bloquear horas
    onUnblockSlot = null, // 🆕 Callback para desbloquear horas
    onAddToWaitlist = null, // 🆕 Callback para agregar a lista de espera
    loading = false
}) {
    // Estados
    const [vista, setVista] = useState('dia'); // 'dia', 'semana', 'mes'
    const [fechaActual, setFechaActual] = useState(new Date());
    const [horaInicio] = useState(8); // 08:00
    const [horaFin] = useState(22); // 22:00
    
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

        // Filtro por recurso/profesional
        if (filtros.recurso !== 'todos') {
            filtered = filtered.filter(r => 
                r.resource_id === filtros.recurso || 
                r.table_id === filtros.recurso
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

    // 📊 ESTADÍSTICAS RÁPIDAS (basadas en reservas filtradas)
    const stats = useMemo(() => {
        const hoy = format(new Date(), 'yyyy-MM-dd');
        const reservasHoy = reservationsFiltradas.filter(r => r.reservation_date === hoy);
        
        return {
            confirmadas: reservationsFiltradas.filter(r => r.status === 'confirmed').length,
            pendientes: reservationsFiltradas.filter(r => r.status === 'pending').length,
            noShows: reservationsFiltradas.filter(r => r.status === 'no_show').length,
            ocupacion: reservasHoy.length > 0 ? Math.round((reservasHoy.length / 20) * 100) : 0
        };
    }, [reservationsFiltradas]);

    // 🗓️ NAVEGACIÓN
    const irAHoy = () => setFechaActual(new Date());
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
        console.log('🎯 Acción:', actionType, data);
        
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
            case 'edit':
                // Llamar al callback de ver/editar reserva
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
                // Llamar al callback de cancelar (esto ya existe en el sistema)
                onReservationClick(data.reservation);
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
        <div className="space-y-4">
            {/* 🎛️ CONTROLES SUPERIORES */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Selector de Vista */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setVista('dia')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                vista === 'dia'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            📅 Día
                        </button>
                        <button
                            onClick={() => setVista('semana')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                vista === 'semana'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            📆 Semana
                        </button>
                        <button
                            onClick={() => setVista('mes')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                vista === 'mes'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            📊 Mes
                        </button>
                    </div>

                    {/* 📅 NAVEGACIÓN DE FECHAS MEJORADA */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={irAAnterior}
                            className="p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-lg transition-all"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        
                        <button
                            onClick={irAHoy}
                            className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 rounded-lg font-semibold text-sm text-gray-900 transition-all border border-blue-200"
                        >
                            Hoy
                        </button>

                        {/* ✨ FECHA CON DISEÑO MEJORADO */}
                        <div className="relative px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg min-w-[280px]">
                            <div className="absolute inset-0 bg-white/10 rounded-xl"></div>
                            <div className="relative text-center">
                                <p className="font-bold text-white text-lg capitalize tracking-wide">
                                    {format(fechaActual, "EEEE d 'de' MMMM", { locale: es })}
                                </p>
                                <p className="text-xs text-white/80 font-medium mt-0.5">
                                    {format(fechaActual, 'yyyy')}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={irASiguiente}
                            className="p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-lg transition-all"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                    </div>

                    {/* 🔄 BOTÓN ACTUALIZAR (sin Nueva Reserva duplicado) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 rounded-lg transition-all"
                            title="Actualizar"
                        >
                            <RefreshCw className={`w-5 h-5 text-gray-700 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 📱 MOBILE: Selector de Recurso Único */}
            {resources.length > 0 && (
                <div className="lg:hidden bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                        📍 Ver recurso:
                    </label>
                    <select
                        value={mobileSelectedResource}
                        onChange={(e) => setMobileSelectedResource(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm font-medium"
                    >
                        <option value="todos">📊 Todos los recursos</option>
                        {resources.map(r => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* 📊 MINI-STATS - Ocupan TODO el horizontal, MÁS BAJITAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-600 text-base">✓</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-emerald-700 font-semibold">Confirmadas</p>
                            <p className="text-xl font-black text-emerald-600 leading-tight">{stats.confirmadas}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-amber-600 text-base">⏳</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-amber-700 font-semibold">Pendientes</p>
                            <p className="text-xl font-black text-amber-600 leading-tight">{stats.pendientes}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-red-600 text-base">⚠</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-red-700 font-semibold">No-Shows</p>
                            <p className="text-xl font-black text-red-600 leading-tight">{stats.noShows}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-purple-600 text-base">📊</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-purple-700 font-semibold">Ocupación</p>
                            <p className="text-xl font-black text-purple-600 leading-tight">{stats.ocupacion}%</p>
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
    onReservationClick, 
    onSlotClick,
    onCellClick,
    onReservationMove,
    draggingReservation,
    setDraggingReservation,
    dragOverSlot,
    setDragOverSlot
}) {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    const reservasDelDia = reservations.filter(r => r.reservation_date === fechaStr);
    const bloqueosDelDia = blockages.filter(b => b.blocked_date === fechaStr);
    
    // Generar horas del día
    const horas = Array.from({ length: horaFin - horaInicio + 1 }, (_, i) => horaInicio + i);

    // Si no hay recursos definidos, usar uno por defecto
    let recursosDisplay = resources.length > 0 ? resources : [{ id: 'default', name: 'Todos' }];
    
    // 📱 MOBILE: Filtrar por recurso seleccionado
    if (mobileSelectedResource !== 'todos') {
        recursosDisplay = recursosDisplay.filter(r => r.id === mobileSelectedResource);
    }

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

        // 🆕 MEJORADO: Hora con minutos precisos
        const nuevaHora = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
        
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
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 overflow-hidden">
            {/* TABLA HTML - Alineación PERFECTA garantizada */}
            <table className="w-full border-collapse">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-20">
                    <tr className="border-b-2 border-gray-400">
                        {/* Columna de hora */}
                        <th className="w-20 border-r-2 border-gray-400 bg-white py-3">
                            <Clock className="w-5 h-5 text-gray-500 mx-auto" />
                        </th>
                        
                        {/* Recursos con ancho equitativo */}
                        {recursosDisplay.map((recurso, idx) => (
                            <th 
                                key={recurso.id}
                                className={`py-3 ${
                                    idx < recursosDisplay.length - 1 ? 'border-r-2 border-gray-300' : ''
                                }`}
                                style={{ width: `${100 / numRecursos}%` }}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                                        {recurso.name[0]}
                                    </div>
                                    <div className="text-left">
                                        <span className="font-bold text-gray-900 text-sm block">{recurso.name}</span>
                                        <span className="text-xs text-gray-500">9:00 - 19:00</span>
                                    </div>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                
                <tbody>
                    {horas.map(hora => (
                        <Fragment key={hora}>
                            {/* Hora completa (00) */}
                            <tr className="border-b-2 border-gray-300">
                                {/* Celda de hora */}
                                <td className="w-20 h-20 border-r-2 border-gray-400 bg-white align-top text-right pr-3 pt-1">
                                    <span className="text-sm font-bold text-gray-700">
                                        {hora.toString().padStart(2, '0')}:00
                                    </span>
                                </td>

                                {/* Celdas de recursos */}
                            {recursosDisplay.map((recurso, idx) => {
                                // 🆕 FUNCIÓN: Calcular duración de reserva en minutos
                                const calcularDuracionReserva = (reserva) => {
                                    // 1. Si tiene campo 'duration' directo
                                    if (reserva.duration) return parseInt(reserva.duration);
                                    
                                    // 2. Si tiene 'service_duration_minutes'
                                    if (reserva.service_duration_minutes) return parseInt(reserva.service_duration_minutes);
                                    
                                    // 3. Si tiene service con duration_minutes
                                    if (reserva.service?.duration_minutes) return parseInt(reserva.service.duration_minutes);
                                    
                                    // 4. Default: 60 minutos
                                    return 60;
                                };

                                // 🆕 FUNCIÓN: Verificar si esta celda está ocupada por reserva previa
                                const esCeldaOcupadaPorReservaAnterior = (hora, minuto = 0) => {
                                    const tiempoActual = hora * 60 + minuto; // Convertir a minutos desde medianoche
                                    
                                    return reservasDelDia.some(r => {
                                        const [horaRes, minRes] = (r.reservation_time || '00:00').split(':').map(Number);
                                        const tiempoInicio = horaRes * 60 + minRes;
                                        const duracion = calcularDuracionReserva(r);
                                        const tiempoFin = tiempoInicio + duracion;
                                        
                                        // Esta celda está en el rango de una reserva que empezó antes
                                        return tiempoActual > tiempoInicio && tiempoActual < tiempoFin;
                                    });
                                };

                                // Buscar reservas de este recurso en esta hora EXACTA (hora:00)
                                const reservasEnHora = reservasDelDia.filter(r => {
                                    const [horaReserva, minReserva] = (r.reservation_time || '00:00').split(':').map(Number);
                                    return horaReserva === hora && minReserva === 0;
                                });

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
                                        className={`h-20 p-2 cursor-pointer transition-all align-top ${
                                            idx < recursosDisplay.length - 1 ? 'border-r-2 border-gray-300' : ''
                                        } ${
                                            isDragOver ? 'bg-blue-100' : 
                                            tieneBloqueo ? 'bg-red-50 hover:bg-red-100' : 
                                            'hover:bg-blue-50'
                                        }`}
                                        onClick={() => {
                                            const timeStr = `${hora.toString().padStart(2, '0')}:00`;
                                            if (tieneBloqueo) {
                                                // Celda bloqueada - abrir modal con opciones de bloqueo
                                                onCellClick(recurso, fechaStr, timeStr, null, bloqueo);
                                            } else if (reservasEnHora.length === 0) {
                                                // Celda vacía - abrir modal de acciones
                                                onCellClick(recurso, fechaStr, timeStr, null, null);
                                            }
                                        }}
                                        onDragOver={(e) => handleDragOver(e, hora, 0, recurso.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, hora, 0, recurso.id)}
                                    >
                                        {reservasEnHora.map(reserva => {
                                            const colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                            const isDragging = draggingReservation?.id === reserva.id;
                                            const statusIcon = getStatusIcon(reserva);
                                            
                                            // 🆕 DURACIÓN VISUAL: Calcular altura del bloque
                                            const duracionMinutos = calcularDuracionReserva(reserva);
                                            const numSlots = Math.ceil(duracionMinutos / 15); // Cuántos intervalos de 15min ocupa
                                            
                                            // 🎨 Altura: cada slot de 15 min = 20px (h-5), más 80px para el slot principal (h-20)
                                            // Slots adicionales: (numSlots - 1) * 20px
                                            const alturaAdicional = (numSlots - 1) * 20; // px
                                            const alturaTotal = 80 + alturaAdicional; // 80px base + adicionales
                                            
                                            return (
                                                <div
                                                    key={reserva.id}
                                                    draggable={!!onReservationMove}
                                                    onDragStart={(e) => handleDragStart(e, reserva)}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Celda con reserva - abrir modal con opciones de reserva
                                                        const timeStr = `${hora.toString().padStart(2, '0')}:00`;
                                                        onCellClick(recurso, fechaStr, timeStr, reserva, null);
                                                    }}
                                                    className={`${colors.bg} ${colors.border} ${colors.bgHover} rounded-lg p-2.5 shadow-md transition-all cursor-move mb-1 ${
                                                        isDragging ? 'opacity-50 scale-95 rotate-2' : 'hover:shadow-lg hover:scale-105 hover:-translate-y-0.5'
                                                    }`}
                                                    style={{
                                                        minHeight: `${alturaTotal}px`,
                                                        position: 'relative',
                                                        zIndex: 10
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between gap-1 mb-1">
                                                        <p className={`font-bold text-sm ${colors.text} truncate flex-1`}>
                                                            {reserva.customer_name}
                                                        </p>
                                                        {statusIcon && (
                                                            <div className="flex-shrink-0">
                                                                {statusIcon}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {reserva.service_name && (
                                                        <p className="text-xs text-gray-600 truncate mb-1">
                                                            • {reserva.service_name}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <div className="flex items-center gap-1 text-gray-500">
                                                            <Clock className="w-3 h-3" />
                                                            {reserva.reservation_time}
                                                        </div>
                                                        <span className="text-gray-500 font-semibold">
                                                            {duracionMinutos}min
                                                        </span>
                                                    </div>
                                                    {/* 🆕 Indicador visual de duración */}
                                                    {numSlots > 1 && (
                                                        <div className="mt-2 pt-2 border-t border-gray-300">
                                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                                ⏱️ {numSlots} slots ({duracionMinutos}min)
                                                            </p>
                                                        </div>
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
                                                className="bg-red-100 border-l-4 border-red-500 rounded-lg p-2 shadow-sm transition-all cursor-pointer hover:shadow-md hover:scale-105"
                                            >
                                                <p className="font-semibold text-sm text-red-900 flex items-center gap-1">
                                                    🚫 Bloqueado
                                                </p>
                                                {bloqueo.reason && (
                                                    <p className="text-xs text-red-700 truncate">
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
                                <tr key={`${hora}-${minuto}`} className="border-b border-gray-200">
                                    {/* Celda de minuto */}
                                    <td className="w-20 h-5 border-r-2 border-gray-400 bg-white text-right pr-3">
                                        <span className="text-xs text-gray-400 font-medium">
                                            :{minuto}
                                        </span>
                                    </td>

                                    {/* Celdas de slots - ocultar si están ocupadas */}
                                    {recursosDisplay.map((recurso, idx) => {
                                        // 🆕 DURACIÓN VISUAL: Verificar si este slot está ocupado por reserva previa
                                        const tiempoActual = hora * 60 + minuto;
                                        
                                        const reservaEnEsteCelda = reservasDelDia.find(r => {
                                            const [horaRes, minRes] = (r.reservation_time || '00:00').split(':').map(Number);
                                            const tiempoInicio = horaRes * 60 + minRes;
                                            
                                            // Calcular duración
                                            let duracion = 60;
                                            if (r.duration) duracion = parseInt(r.duration);
                                            else if (r.service_duration_minutes) duracion = parseInt(r.service_duration_minutes);
                                            else if (r.service?.duration_minutes) duracion = parseInt(r.service.duration_minutes);
                                            
                                            const tiempoFin = tiempoInicio + duracion;
                                            
                                            // Este slot está dentro del rango de esta reserva
                                            return tiempoActual >= tiempoInicio && tiempoActual < tiempoFin;
                                        });

                                        const estaOcupado = !!reservaEnEsteCelda;
                                        
                                        // 🆕 Drag over state para intervalos de 15min
                                        const isDragOverMinuto = dragOverSlot?.hora === hora && 
                                                                 dragOverSlot?.minuto === minuto &&
                                                                 dragOverSlot?.recursoId === recurso.id &&
                                                                 dragOverSlot?.fecha === fechaStr;
                                        
                                        return (
                                            <td
                                                key={`${recurso.id}-${hora}-${minuto}`}
                                                className={`h-5 transition-colors ${
                                                    idx < recursosDisplay.length - 1 ? 'border-r-2 border-gray-300' : ''
                                                } ${
                                                    isDragOverMinuto ? 'bg-blue-100' :
                                                    estaOcupado 
                                                        ? 'bg-transparent pointer-events-none' 
                                                        : 'cursor-pointer hover:bg-blue-50'
                                                }`}
                                                onClick={() => {
                                                    if (!estaOcupado) {
                                                        const timeStr = `${hora.toString().padStart(2, '0')}:${minuto}`;
                                                        onCellClick(recurso, fechaStr, timeStr, null, null);
                                                    }
                                                }}
                                                onDragOver={(e) => {
                                                    if (!estaOcupado) {
                                                        handleDragOver(e, hora, minuto, recurso.id);
                                                    }
                                                }}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => {
                                                    if (!estaOcupado) {
                                                        handleDrop(e, hora, minuto, recurso.id);
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// 📆 VISTA SEMANA - 7 columnas (Lun-Dom)
function VistaSemana({ fecha, reservations, horaInicio, horaFin, onReservationClick, onSlotClick }) {
    const inicioSemana = startOfWeek(fecha, { locale: es });
    const finSemana = endOfWeek(fecha, { locale: es });
    const diasSemana = eachDayOfInterval({ start: inicioSemana, end: finSemana });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <div className="min-w-[800px]">
                {/* Header días de la semana */}
                <div className="grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
                    {diasSemana.map(dia => {
                        const esHoy = isSameDay(dia, new Date());
                        return (
                            <div key={dia.toISOString()} className={`p-3 text-center ${esHoy ? 'bg-blue-50' : ''}`}>
                                <p className={`text-xs font-medium ${esHoy ? 'text-blue-600' : 'text-gray-600'}`}>
                                    {format(dia, 'EEE', { locale: es }).toUpperCase()}
                                </p>
                                <p className={`text-2xl font-bold ${esHoy ? 'text-blue-600' : 'text-gray-900'}`}>
                                    {format(dia, 'd')}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Grid de reservas */}
                <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[500px]">
                    {diasSemana.map(dia => {
                        const fechaStr = format(dia, 'yyyy-MM-dd');
                        const reservasDelDia = reservations.filter(r => r.reservation_date === fechaStr);
                        const esHoy = isSameDay(dia, new Date());

                        return (
                            <div 
                                key={dia.toISOString()} 
                                className={`p-2 space-y-1 ${esHoy ? 'bg-blue-50/30' : ''}`}
                            >
                                {reservasDelDia.map(reserva => {
                                    const colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                    return (
                                        <div
                                            key={reserva.id}
                                            onClick={() => onReservationClick(reserva)}
                                            className={`${colors.bg} ${colors.border} rounded-md p-1.5 text-xs cursor-pointer hover:shadow-md transition-all`}
                                        >
                                            <p className={`font-semibold ${colors.text} truncate`}>
                                                {reserva.reservation_time} {reserva.customer_name}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// 📊 VISTA MES - Grid mensual
function VistaMes({ fecha, reservations, onReservationClick, onDayClick }) {
    const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
    const inicioSemana = startOfWeek(inicioMes, { locale: es });
    const finSemana = endOfWeek(finMes, { locale: es });
    const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header días de la semana */}
            <div className="grid grid-cols-7 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                    <div key={dia} className="p-2 text-center">
                        <span className="text-xs font-semibold text-gray-600">{dia}</span>
                    </div>
                ))}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
                {dias.map(dia => {
                    const fechaStr = format(dia, 'yyyy-MM-dd');
                    const reservasDelDia = reservations.filter(r => r.reservation_date === fechaStr);
                    const esHoy = isSameDay(dia, new Date());
                    const esMesActual = dia.getMonth() === fecha.getMonth();

                    return (
                        <div
                            key={dia.toISOString()}
                            onClick={() => onDayClick(dia)}
                            className={`min-h-[100px] p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                                !esMesActual ? 'bg-gray-50/50' : ''
                            } ${esHoy ? 'bg-blue-50' : ''}`}
                        >
                            <p className={`text-sm font-semibold mb-1 ${
                                esHoy ? 'text-blue-600' : esMesActual ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                                {format(dia, 'd')}
                            </p>
                            <div className="space-y-0.5">
                                {reservasDelDia.slice(0, 3).map(reserva => {
                                    const colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                    return (
                                        <div
                                            key={reserva.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReservationClick(reserva);
                                            }}
                                            className={`w-2 h-2 rounded-full ${colors.dot} inline-block mr-1`}
                                            title={`${reserva.reservation_time} - ${reserva.customer_name}`}
                                        ></div>
                                    );
                                })}
                                {reservasDelDia.length > 3 && (
                                    <span className="text-[10px] text-gray-600">+{reservasDelDia.length - 3}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


