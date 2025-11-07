// CalendarioReservas.jsx - Calendario Profesional estilo Google Calendar + Booksy
import React, { useState, useEffect, useMemo } from 'react';
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

// 🎨 COLORES POR ESTADO
const STATUS_COLORS = {
    confirmed: {
        bg: 'bg-blue-100',
        border: 'border-l-4 border-blue-500',
        text: 'text-blue-900',
        dot: 'bg-blue-500'
    },
    pending: {
        bg: 'bg-yellow-100',
        border: 'border-l-4 border-yellow-500',
        text: 'text-yellow-900',
        dot: 'bg-yellow-500'
    },
    cancelled: {
        bg: 'bg-red-100',
        border: 'border-l-4 border-red-500',
        text: 'text-red-900',
        dot: 'bg-red-500'
    },
    completed: {
        bg: 'bg-green-100',
        border: 'border-l-4 border-green-500',
        text: 'text-green-900',
        dot: 'bg-green-500'
    },
    no_show: {
        bg: 'bg-gray-100',
        border: 'border-l-4 border-gray-500',
        text: 'text-gray-900',
        dot: 'bg-gray-500'
    }
};

export default function CalendarioReservas({ 
    reservations = [],
    resources = [], // Profesionales/Recursos (ej: Patricia Taylor, Michael Brown)
    onReservationClick = () => {},
    onSlotClick = () => {},
    onRefresh = () => {},
    onReservationMove = null, // 🆕 Callback para mover reserva
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

    // 🆕 DRAG & DROP
    const [draggingReservation, setDraggingReservation] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);

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

                    {/* Navegación de Fechas */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={irAAnterior}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        
                        <button
                            onClick={irAHoy}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-sm text-gray-900 transition-colors"
                        >
                            Hoy
                        </button>

                        <div className="text-center min-w-[200px]">
                            <p className="font-bold text-gray-900 text-lg">
                                {format(fechaActual, "EEEE d 'de' MMMM", { locale: es })}
                            </p>
                            <p className="text-xs text-gray-600">
                                {format(fechaActual, 'yyyy')}
                            </p>
                        </div>

                        <button
                            onClick={irASiguiente}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Actualizar"
                        >
                            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => onSlotClick({ date: format(fechaActual, 'yyyy-MM-dd'), time: '09:00' })}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Reserva
                        </button>
                    </div>
                </div>
            </div>

            {/* 🔍 BARRA DE FILTROS Y BÚSQUEDA */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Búsqueda */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={filtros.busqueda}
                            onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                            placeholder="Buscar por nombre o teléfono..."
                            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        {filtros.busqueda && (
                            <button
                                onClick={() => setFiltros(prev => ({ ...prev, busqueda: '' }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filtro por Recurso/Profesional */}
                    {resources.length > 0 && (
                        <select
                            value={filtros.recurso}
                            onChange={(e) => setFiltros(prev => ({ ...prev, recurso: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="todos">👥 Todos los profesionales</option>
                            {resources.map(recurso => (
                                <option key={recurso.id} value={recurso.id}>
                                    {recurso.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Filtro por Estado */}
                    <select
                        value={filtros.estado}
                        onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                        <option value="todos">📊 Todos los estados</option>
                        <option value="confirmed">✅ Confirmadas</option>
                        <option value="pending">⏳ Pendientes</option>
                        <option value="completed">🎉 Completadas</option>
                        <option value="cancelled">❌ Canceladas</option>
                        <option value="no_show">⚫ No-Show</option>
                    </select>

                    {/* Botón Limpiar Filtros */}
                    {(filtros.busqueda || filtros.recurso !== 'todos' || filtros.estado !== 'todos') && (
                        <button
                            onClick={() => setFiltros({ recurso: 'todos', estado: 'todos', busqueda: '' })}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* 📊 MINI-STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg border border-blue-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Confirmadas</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.confirmadas}</p>
                        </div>
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-yellow-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Pendientes</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
                        </div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-red-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">No-Shows</p>
                            <p className="text-2xl font-bold text-red-600">{stats.noShows}</p>
                        </div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-purple-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Ocupación</p>
                            <p className="text-2xl font-bold text-purple-600">{stats.ocupacion}%</p>
                        </div>
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* 🗓️ CALENDARIO (Vista según selector) */}
            {vista === 'dia' && (
                <VistaDia 
                    fecha={fechaActual}
                    reservations={reservationsFiltradas}
                    resources={resources}
                    horaInicio={horaInicio}
                    horaFin={horaFin}
                    onReservationClick={onReservationClick}
                    onSlotClick={onSlotClick}
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
        </div>
    );
}

// 📅 VISTA DÍA - Timeline vertical con columnas por recurso + DRAG & DROP
function VistaDia({ 
    fecha, 
    reservations, 
    resources, 
    horaInicio, 
    horaFin, 
    onReservationClick, 
    onSlotClick,
    onReservationMove,
    draggingReservation,
    setDraggingReservation,
    dragOverSlot,
    setDragOverSlot
}) {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    const reservasDelDia = reservations.filter(r => r.reservation_date === fechaStr);
    
    // Generar horas del día
    const horas = Array.from({ length: horaFin - horaInicio + 1 }, (_, i) => horaInicio + i);

    // Si no hay recursos definidos, usar uno por defecto
    const recursosDisplay = resources.length > 0 ? resources : [{ id: 'default', name: 'Todos' }];

    // 🆕 Handlers de Drag & Drop
    const handleDragStart = (e, reserva) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget);
        setDraggingReservation(reserva);
    };

    const handleDragOver = (e, hora, recursoId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverSlot({ hora, recursoId, fecha: fechaStr });
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverSlot(null);
    };

    const handleDrop = (e, hora, recursoId) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggingReservation || !onReservationMove) {
            setDraggingReservation(null);
            setDragOverSlot(null);
            return;
        }

        const nuevaHora = `${hora.toString().padStart(2, '0')}:00`;
        
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header con recursos */}
            <div className="grid grid-cols-[80px_1fr] border-b border-gray-200 bg-gray-50">
                <div className="p-3 border-r border-gray-200">
                    <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <div className={`grid grid-cols-${recursosDisplay.length} divide-x divide-gray-200`}>
                    {recursosDisplay.map(recurso => (
                        <div key={recurso.id} className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {recurso.name[0]}
                                </div>
                                <span className="font-semibold text-gray-900 text-sm">{recurso.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Timeline */}
            <div className="max-h-[600px] overflow-y-auto">
                {horas.map(hora => (
                    <div key={hora} className="grid grid-cols-[80px_1fr] border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        {/* Hora */}
                        <div className="p-3 border-r border-gray-200 text-right">
                            <span className="text-sm font-semibold text-gray-600">
                                {hora.toString().padStart(2, '0')}:00
                            </span>
                        </div>

                        {/* Slots por recurso */}
                        <div className={`grid grid-cols-${recursosDisplay.length} divide-x divide-gray-100`}>
                            {recursosDisplay.map(recurso => {
                                // Buscar reservas de este recurso en esta hora
                                const reservasEnHora = reservasDelDia.filter(r => {
                                    const horaReserva = parseInt(r.reservation_time?.split(':')[0] || '0');
                                    return horaReserva === hora;
                                });

                                const isDragOver = dragOverSlot?.hora === hora && 
                                                  dragOverSlot?.recursoId === recurso.id &&
                                                  dragOverSlot?.fecha === fechaStr;

                                return (
                                    <div
                                        key={`${recurso.id}-${hora}`}
                                        className={`min-h-[60px] p-2 cursor-pointer transition-all ${
                                            isDragOver ? 'bg-blue-100 border-2 border-dashed border-blue-400' : 'hover:bg-blue-50'
                                        }`}
                                        onClick={() => !reservasEnHora.length && onSlotClick({
                                            date: fechaStr,
                                            time: `${hora.toString().padStart(2, '0')}:00`,
                                            resource: recurso
                                        })}
                                        onDragOver={(e) => handleDragOver(e, hora, recurso.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, hora, recurso.id)}
                                    >
                                        {reservasEnHora.map(reserva => {
                                            const colors = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmed;
                                            const isDragging = draggingReservation?.id === reserva.id;
                                            
                                            return (
                                                <div
                                                    key={reserva.id}
                                                    draggable={!!onReservationMove}
                                                    onDragStart={(e) => handleDragStart(e, reserva)}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReservationClick(reserva);
                                                    }}
                                                    className={`${colors.bg} ${colors.border} rounded-lg p-2 shadow-sm transition-all cursor-move mb-1 ${
                                                        isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'
                                                    }`}
                                                >
                                                    <p className={`font-semibold text-sm ${colors.text} truncate`}>
                                                        {reserva.customer_name}
                                                    </p>
                                                    <p className="text-xs text-gray-600 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {reserva.reservation_time}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
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
