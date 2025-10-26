// CalendarioVisual.jsx - Vista de Calendario para Reservas
import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Users, Clock } from 'lucide-react';

const CalendarioVisual = ({ reservations, onDateSelect, selectedDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Obtener días del mes actual
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Agrupar reservas por fecha
    const reservationsByDate = reservations.reduce((acc, reservation) => {
        const dateKey = reservation.reservation_date;
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(reservation);
        return acc;
    }, {});

    // Navegar meses
    const previousMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6">
            {/* Header del calendario */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-purple-500" />
                    <h3 className="text-base font-semibold text-gray-900">Vista Calendario</h3>
                </div>
                
                <div className="flex items-center gap-4">
                    <button
                        onClick={previousMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    
                    <h4 className="text-lg font-medium text-gray-900 min-w-[200px] text-center">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </h4>
                    
                    <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                        {day}
                    </div>
                ))}
            </div>

            {/* Días del mes */}
            <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayReservations = reservationsByDate[dateKey] || [];
                    const isSelected = selectedDate && isSameDay(day, parseISO(selectedDate));
                    const isCurrentDay = isToday(day);

                    return (
                        <button
                            key={day.toString()}
                            onClick={() => onDateSelect(dateKey)}
                            className={`
                                relative p-2 h-20 border rounded-lg transition-all hover:border-purple-300
                                ${isSelected 
                                    ? 'border-purple-500 bg-purple-50' 
                                    : 'border-gray-200 hover:bg-gray-50'
                                }
                                ${isCurrentDay ? 'ring-2 ring-blue-200' : ''}
                            `}
                        >
                            {/* Número del día */}
                            <div className={`text-sm font-medium mb-1 ${
                                isCurrentDay 
                                    ? 'text-blue-600 font-bold' 
                                    : isSelected 
                                        ? 'text-purple-600' 
                                        : 'text-gray-700'
                            }`}>
                                {format(day, 'd')}
                            </div>

                            {/* Indicador de reservas */}
                            {dayReservations.length > 0 && (
                                <div className="space-y-1">
                                    {/* Número de reservas */}
                                    <div className={`text-xs px-2 py-1 rounded-full ${
                                        dayReservations.length > 5 
                                            ? 'bg-red-100 text-red-700'
                                            : dayReservations.length > 2
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-green-100 text-green-700'
                                    }`}>
                                        {dayReservations.length}
                                    </div>

                                    {/* Puntos de estado */}
                                    <div className="flex justify-center gap-1">
                                        {dayReservations.slice(0, 3).map((reservation, index) => (
                                            <div
                                                key={index}
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    reservation.status === 'confirmed' 
                                                        ? 'bg-green-400'
                                                        : reservation.status === 'pending'
                                                            ? 'bg-yellow-400'
                                                            : reservation.status === 'completed'
                                                                ? 'bg-blue-400'
                                                                : 'bg-gray-400'
                                                }`}
                                            />
                                        ))}
                                        {dayReservations.length > 3 && (
                                            <div className="text-xs text-gray-400">+</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Leyenda */}
            <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                            <span className="text-gray-600">Confirmada</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                            <span className="text-gray-600">Pendiente</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                            <span className="text-gray-600">Completada</span>
                        </div>
                    </div>
                    
                    <div className="text-gray-500">
                        Hoy: {format(new Date(), 'dd/MM/yyyy')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarioVisual;
