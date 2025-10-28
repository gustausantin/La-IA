// AvailabilityTester.jsx - Componente para probar el sistema de disponibilidades
import React, { useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import AvailabilityService from '../services/AvailabilityService';
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const AvailabilityTester = () => {
    const { businessId: businessId } = useAuthContext();
    const [loading, setLoading] = useState(false);
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [testTime, setTestTime] = useState('19:00');
    const [partySize, setPartySize] = useState(2);
    const [results, setResults] = useState(null);

    const testAvailability = async () => {
        if (!businessId) {
            toast.error('No hay restaurante configurado');
            return;
        }

        setLoading(true);
        try {
            // 1. Verificar disponibilidad
            const availability = await AvailabilityService.checkAvailability(
                businessId, testDate, testTime, partySize
            );

            // 2. Validar fecha/hora
            const validation = await AvailabilityService.validateBookingTime(
                businessId, testDate, testTime
            );

            // 3. Obtener slots disponibles
            const timeSlots = await AvailabilityService.getAvailableTimeSlots(
                businessId, testDate, partySize
            );

            setResults({
                availability,
                validation,
                timeSlots,
                testParams: { date: testDate, time: testTime, partySize }
            });

            if (availability.success && availability.hasAvailability) {
                toast.success('✅ Disponibilidad encontrada');
            } else if (availability.success && !availability.hasAvailability) {
                toast.warning('⚠️ No hay disponibilidad para esa hora');
            } else {
                toast.error('❌ Error verificando disponibilidad');
            }

        } catch (error) {
            console.error('Error testing availability:', error);
            toast.error('Error en la prueba: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const generateSlots = async () => {
        if (!businessId) {
            toast.error('No hay restaurante configurado');
            return;
        }

        setLoading(true);
        try {
            const result = await AvailabilityService.generateAvailabilitySlots(
                businessId, testDate, null
            );

            if (result.success) {
                toast.success(result.message);
                // Recargar resultados
                await testAvailability();
            } else {
                toast.error('Error generando slots: ' + result.error);
            }
        } catch (error) {
            console.error('Error generating slots:', error);
            toast.error('Error generando slots: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const testBooking = async () => {
        if (!businessId || !results?.availability?.hasAvailability) {
            toast.error('No hay disponibilidad para reservar');
            return;
        }

        setLoading(true);
        try {
            const booking = await AvailabilityService.bookTable({
                businessId,
                date: testDate,
                time: testTime,
                partySize,
                channel: 'web_test',
                customer: {
                    name: 'Cliente de Prueba',
                    phone: '+34600000000',
                    email: 'test@example.com'
                }
            });

            if (booking.success) {
                toast.success('🎉 Reserva de prueba creada: ' + booking.reservationId);
                // Recargar resultados
                await testAvailability();
            } else {
                toast.error('Error en reserva de prueba: ' + booking.message);
            }
        } catch (error) {
            console.error('Error testing booking:', error);
            toast.error('Error en reserva de prueba: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const initializeSystem = async () => {
        if (!businessId) {
            toast.error('No hay restaurante configurado');
            return;
        }

        setLoading(true);
        try {
            const result = await AvailabilityService.initializeAvailabilitySystem(businessId);
            
            if (result.success) {
                toast.success('Sistema inicializado correctamente');
                await testAvailability();
            } else {
                toast.error('Error inicializando: ' + result.error);
            }
        } catch (error) {
            console.error('Error initializing system:', error);
            toast.error('Error inicializando sistema: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Prueba del Sistema de Disponibilidades
                </h2>

                {/* Parámetros de prueba */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fecha
                        </label>
                        <input
                            type="date"
                            value={testDate}
                            onChange={(e) => setTestDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Hora
                        </label>
                        <input
                            type="time"
                            value={testTime}
                            onChange={(e) => setTestTime(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Personas
                        </label>
                        <select
                            value={partySize}
                            onChange={(e) => setPartySize(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {[1,2,3,4,5,6,7,8].map(size => (
                                <option key={size} value={size}>{size} persona{size > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <button
                        onClick={initializeSystem}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        <Calendar className="w-4 h-4" />
                        Inicializar Sistema
                    </button>
                    <button
                        onClick={generateSlots}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Clock className="w-4 h-4" />
                        Generar Slots
                    </button>
                    <button
                        onClick={testAvailability}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        <Users className="w-4 h-4" />
                        Verificar Disponibilidad
                    </button>
                    {results?.availability?.hasAvailability && (
                        <button
                            onClick={testBooking}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Prueba de Reserva
                        </button>
                    )}
                </div>

                {/* Resultados */}
                {results && (
                    <div className="space-y-4">
                        {/* Validación */}
                        <div className={`p-2 rounded-lg border-l-4 ${
                            results.validation.valid 
                                ? 'bg-green-50 border-green-500' 
                                : 'bg-red-50 border-red-500'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {results.validation.valid ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-600" />
                                )}
                                <h3 className="font-semibold">
                                    Validación: {results.validation.valid ? 'Válida' : 'No válida'}
                                </h3>
                            </div>
                            <p className="text-sm text-gray-700">
                                {results.validation.valid ? results.validation.message : results.validation.reason}
                            </p>
                        </div>

                        {/* Disponibilidad */}
                        <div className={`p-2 rounded-lg border-l-4 ${
                            results.availability.hasAvailability 
                                ? 'bg-green-50 border-green-500' 
                                : 'bg-yellow-50 border-yellow-500'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {results.availability.hasAvailability ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                )}
                                <h3 className="font-semibold">
                                    Disponibilidad: {results.availability.availableSlots} slots encontrados
                                </h3>
                            </div>
                            
                            {results.availability.availableTables.length > 0 && (
                                <div className="mt-2">
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">Mesas disponibles:</h4>
                                    <div className="space-y-1">
                                        {results.availability.availableTables.map((table, idx) => (
                                            <div key={idx} className="text-sm text-gray-600">
                                                • {table.table_name} (Capacidad: {table.capacity})
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {results.availability.suggestedTimes.length > 0 && (
                                <div className="mt-2">
                                    <h4 className="text-sm font-medium text-gray-700 mb-1">Horarios alternativos:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {results.availability.suggestedTimes.map((time, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                                {time}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Horarios del día */}
                        {results.timeSlots.shifts.length > 0 && (
                            <div className="p-2 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-3">
                                    Horarios disponibles ({results.timeSlots.totalSlots} slots totales)
                                </h3>
                                <div className="space-y-3">
                                    {results.timeSlots.shifts.map((shift, idx) => (
                                        <div key={idx}>
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                                                {shift.shiftName.charAt(0).toUpperCase() + shift.shiftName.slice(1)}
                                            </h4>
                                            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                                {shift.timeSlots.map((slot, slotIdx) => (
                                                    <div 
                                                        key={slotIdx}
                                                        className={`text-center p-2 rounded text-xs ${
                                                            slot.time === testTime 
                                                                ? 'bg-blue-200 text-blue-800 font-semibold'
                                                                : 'bg-white border border-gray-200'
                                                        }`}
                                                    >
                                                        <div>{slot.time}</div>
                                                        <div className="text-gray-500">
                                                            {slot.availableCount} mesa{slot.availableCount !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="text-center py-4">
                        <div className="inline-flex items-center gap-2 text-blue-600">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            Procesando...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AvailabilityTester;
