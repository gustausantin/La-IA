// Facturación & Servicios - Dashboard de ingresos y productividad
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    DollarSign, Clock, Users, RefreshCw, Calendar,
    TrendingUp, BarChart3, Award, CheckCircle2, Scissors,
    User, Eye, Phone, Mail, AlertTriangle, Target, Sparkles, PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getVerticalConfig, METRIC_COLORS } from '../config/verticals';

const Consumos = () => {
    const { business, businessId, isReady } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [appointments, setAppointments] = useState([]);
    const [services, setServices] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('today'); // 'today', 'week', 'month', 'custom'
    const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // 🎨 Obtener configuración del vertical actual
    const verticalConfig = useMemo(() => {
        return getVerticalConfig(business?.vertical_type);
    }, [business?.vertical_type]);

    // Obtener icono del vertical
    const VerticalIcon = verticalConfig.icon;

    // Calcular rango de fechas según período seleccionado
    const dateRange = useMemo(() => {
        const now = new Date();
        switch (selectedPeriod) {
            case 'today':
                return {
                    start: format(startOfDay(now), 'yyyy-MM-dd HH:mm:ss'),
                    end: format(endOfDay(now), 'yyyy-MM-dd HH:mm:ss'),
                    label: 'Hoy'
                };
            case 'week':
                return {
                    start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd HH:mm:ss'),
                    end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd HH:mm:ss'),
                    label: 'Esta Semana'
                };
            case 'month':
                return {
                    start: format(startOfMonth(now), 'yyyy-MM-dd HH:mm:ss'),
                    end: format(endOfMonth(now), 'yyyy-MM-dd HH:mm:ss'),
                    label: 'Este Mes'
                };
            case 'custom':
                return {
                    start: `${customDate} 00:00:00`,
                    end: `${customDate} 23:59:59`,
                    label: format(parseISO(customDate), 'dd MMM yyyy', { locale: es })
                };
            default:
                return {
                    start: format(startOfDay(now), 'yyyy-MM-dd HH:mm:ss'),
                    end: format(endOfDay(now), 'yyyy-MM-dd HH:mm:ss'),
                    label: 'Hoy'
                };
        }
    }, [selectedPeriod, customDate]);

    // Cargar datos
    const loadData = useCallback(async () => {
        if (!businessId) return;

        try {
            setLoading(true);

            // Cargar citas completadas del período (SIN join - lo haremos manual)
            const { data: appointmentsData, error: appointmentsError } = await supabase
                .from('appointments')
                .select('id, customer_name, customer_phone, customer_email, appointment_date, appointment_time, status, service_id, duration_minutes, resource_id, created_at, updated_at')
                .eq('business_id', businessId)
                .gte('appointment_date', dateRange.start.split(' ')[0])
                .lte('appointment_date', dateRange.end.split(' ')[0])
                .in('status', ['confirmed', 'completed'])
                .order('appointment_date', { ascending: false });

            if (appointmentsError) {
                console.error('Error cargando appointments:', appointmentsError);
                throw appointmentsError;
            }

            // Cargar servicios por separado
            const { data: servicesData, error: servicesError } = await supabase
                .from('business_services')
                .select('id, name, suggested_price, duration_minutes, category, is_active')
                .eq('business_id', businessId)
                .eq('is_active', true);

            if (servicesError) {
                console.error('Error cargando services:', servicesError);
                throw servicesError;
            }

            // 🔧 Hacer el "join" manualmente en el frontend
            const servicesMap = {};
            (servicesData || []).forEach(service => {
                servicesMap[service.id] = service;
            });

            // Enriquecer appointments con datos de servicios
            // Nota: business_services usa 'suggested_price' en lugar de 'price'
            const enrichedAppointments = (appointmentsData || []).map(apt => {
                const service = servicesMap[apt.service_id];
                return {
                    ...apt,
                    services: service ? {
                        ...service,
                        price: service.suggested_price || 0 // Mapear suggested_price a price para compatibilidad
                    } : null
                };
            });

            console.log('✅ Datos cargados:', {
                appointments: enrichedAppointments.length,
                services: servicesData?.length || 0
            });

            setAppointments(enrichedAppointments);
            setServices(servicesData || []);

        } catch (error) {
            console.error('❌ Error cargando datos de facturación:', error);
            toast.error('Error al cargar datos de facturación');
        } finally {
            setLoading(false);
        }
    }, [businessId, dateRange]);

    // Calcular métricas
    const metrics = useMemo(() => {
        const completedAppointments = appointments.filter(a => a.status === 'completed');
        
        // Total facturado (suma de precios de servicios)
        const totalRevenue = completedAppointments.reduce((sum, apt) => {
            const servicePrice = apt.services?.price || 0;
            return sum + servicePrice;
        }, 0);

        // Total de servicios
        const totalServices = completedAppointments.length;

        // Servicios pendientes (confirmados pero no completados)
        const pendingServices = appointments.filter(a => a.status === 'confirmed').length;

        // Ticket promedio
        const avgTicket = totalServices > 0 ? totalRevenue / totalServices : 0;

        return {
            totalRevenue,
            totalServices,
            pendingServices,
            avgTicket,
            completedAppointments
        };
    }, [appointments]);

    // Top Servicios Más Vendidos
    const topServices = useMemo(() => {
        const servicesMap = {};

        metrics.completedAppointments.forEach(apt => {
            const service = apt.services;
            if (!service) return;

            const serviceKey = service.id;
            if (!servicesMap[serviceKey]) {
                servicesMap[serviceKey] = {
                    id: service.id,
                    name: service.name,
                    category: service.category,
                    price: service.price,
                    count: 0,
                    totalRevenue: 0
                };
            }
            servicesMap[serviceKey].count += 1;
            servicesMap[serviceKey].totalRevenue += service.price;
        });

        return Object.values(servicesMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [metrics.completedAppointments]);

    // Ranking de Recursos (en lugar de empleados, por ahora)
    const resourceRanking = useMemo(() => {
        const resourcesMap = {};

        metrics.completedAppointments.forEach(apt => {
            const resourceId = apt.resource_id;
            if (!resourceId) return;

            if (!resourcesMap[resourceId]) {
                resourcesMap[resourceId] = {
                    id: resourceId,
                    name: `Recurso ${resourceId.slice(0, 8)}`,
                    count: 0,
                    totalRevenue: 0
                };
            }
            resourcesMap[resourceId].count += 1;
            resourcesMap[resourceId].totalRevenue += apt.services?.price || 0;
        });

        return Object.values(resourcesMap)
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5);
    }, [metrics.completedAppointments]);

    // Effects
    useEffect(() => {
        if (isReady && businessId) {
                loadData();
        }
    }, [isReady, businessId, loadData]);

    if (!isReady) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando información del negocio...</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando datos de facturación...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-4">
            <div className="max-w-[85%] mx-auto space-y-4">
                {/* Header estilo Dashboard - limpio y espacioso */}
                <div className="mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 mb-2">
                                <DollarSign className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" />
                                {verticalConfig.labels.billing}
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600 ml-10 sm:ml-11">
                                Control financiero y productividad de tu {verticalConfig.name.toLowerCase()}
                            </p>
                        </div>

                        {/* Selector de Período */}
                        <div className="flex items-center gap-2">
                            <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1 shadow-sm">
                                <button
                                    onClick={() => setSelectedPeriod('today')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        selectedPeriod === 'today'
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    Hoy
                                </button>
                                <button
                                    onClick={() => setSelectedPeriod('week')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        selectedPeriod === 'week'
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    Semana
                                </button>
                                <button
                                    onClick={() => setSelectedPeriod('month')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        selectedPeriod === 'month'
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    Mes
                                </button>
                            </div>

                            {selectedPeriod === 'custom' && (
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                    className="px-3 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-purple-500 shadow-sm"
                                />
                            )}

                            <button
                                onClick={loadData}
                                className="p-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
                                title="Actualizar datos"
                            >
                                <RefreshCw className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Métricas Principales - Mobile-first: 1 columna en móvil */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Facturado */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                                <DollarSign className="w-6 h-6 text-white" />
                            </div>
                            <Sparkles className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-1">
                            €{metrics.totalRevenue.toFixed(0)}
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                            Facturado
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {dateRange.label}
                        </div>
                    </div>

                    {/* Servicios Completados */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                <VerticalIcon className="w-6 h-6 text-white" />
                            </div>
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-1">
                            {metrics.totalServices}
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                            {verticalConfig.labels.services}
                        </div>
                        <div className="text-xs text-green-600 mt-1 font-semibold">
                            Completados
                        </div>
                    </div>

                    {/* Servicios Pendientes */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                                <Clock className="w-6 h-6 text-white" />
                            </div>
                            <Target className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-1">
                            {metrics.pendingServices}
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                            {verticalConfig.labels.services}
                        </div>
                        <div className="text-xs text-orange-600 mt-1 font-semibold">
                            Pendientes
                        </div>
                    </div>

                    {/* Ticket Promedio */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                                <BarChart3 className="w-6 h-6 text-white" />
                            </div>
                            <Award className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-1">
                            €{metrics.avgTicket.toFixed(0)}
                    </div>
                        <div className="text-sm text-gray-600 font-medium">
                            Ticket Promedio
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            Por servicio
                    </div>
                </div>
            </div>

                {/* Top Servicios + Empleados */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Servicios Más Vendidos */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                                <VerticalIcon className="w-5 h-5 text-white" />
                            </div>
                            {verticalConfig.labels.topServices}
                        </h2>

                        {topServices.length > 0 ? (
                            <div className="space-y-3">
                                {topServices.map((service, index) => {
                                    const medals = ['🥇', '🥈', '🥉'];
                                    const medal = medals[index] || '🏅';

                            return (
                                        <div key={service.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl border border-purple-100 hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="text-2xl">{medal}</div>
                                        <div className="flex-1">
                                                    <div className="font-semibold text-gray-900">{service.name}</div>
                                                    <div className="text-xs text-gray-500">{service.category || 'General'}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-purple-700">{service.count}</div>
                                                <div className="text-xs text-gray-600">{verticalConfig.labels.services.toLowerCase()}</div>
                                                <div className="text-sm font-semibold text-green-600">€{service.totalRevenue.toFixed(0)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Scissors className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">No hay servicios completados en este período</p>
                                            </div>
                                            )}
                                        </div>

                    {/* Estadísticas Adicionales + Comparativa con Sector */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            Análisis de Productividad
                        </h2>

                        {metrics.totalServices > 0 ? (
                            <div className="space-y-4">
                                {/* Tasa de Conversión CON COMPARATIVA */}
                                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold text-gray-700">Tasa de Completados</div>
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <div className="text-3xl font-bold text-green-700">
                                            {appointments.length > 0 
                                                ? Math.round((metrics.totalServices / appointments.length) * 100)
                                                : 0}%
                                                            </div>
                                        {(() => {
                                            const myRate = appointments.length > 0 ? Math.round((metrics.totalServices / appointments.length) * 100) : 0;
                                            const benchmark = verticalConfig.benchmarks.conversionRate;
                                            const diff = myRate - benchmark;
                                            if (Math.abs(diff) >= 5) {
                                                return (
                                                    <div className={`text-sm font-semibold ${diff > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {diff > 0 ? '↗' : '↘'} {Math.abs(diff)}% vs sector
                                                            </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                                        </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        {metrics.totalServices} de {appointments.length} citas
                                        <span className="ml-2 text-gray-500">
                                            • Promedio del sector: {verticalConfig.benchmarks.conversionRate}%
                                                </span>
                                        </div>
                                    </div>

                                {/* Ticket Promedio CON COMPARATIVA */}
                                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold text-gray-700">Ticket Promedio</div>
                                        <DollarSign className="w-5 h-5 text-purple-600" />
                                                        </div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <div className="text-3xl font-bold text-purple-700">
                                            €{metrics.avgTicket.toFixed(0)}
                                                        </div>
                                        {(() => {
                                            const myTicket = metrics.avgTicket;
                                            const benchmark = verticalConfig.benchmarks.avgTicket;
                                            const diff = myTicket - benchmark;
                                            if (Math.abs(diff) >= 5) {
                                                return (
                                                    <div className={`text-sm font-semibold ${diff > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {diff > 0 ? '↗' : '↘'} €{Math.abs(diff).toFixed(0)}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                                        </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        Por {verticalConfig.labels.service.toLowerCase()}
                                        <span className="ml-2 text-gray-500">
                                            • Promedio del sector: €{verticalConfig.benchmarks.avgTicket}
                                        </span>
                                                </div>
                                            </div>

                                {/* Servicios Pendientes */}
                                <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold text-gray-700">Por Completar</div>
                                        <Clock className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div className="text-3xl font-bold text-orange-700">
                                        {metrics.pendingServices}
                                                            </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        {verticalConfig.labels.services} confirmados
                                                    </div>
                                                </div>
                                        </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">No hay datos en este período</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de Servicios Completados */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            {verticalConfig.labels.servicesCompleted} ({metrics.totalServices})
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {dateRange.label}
                        </p>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {metrics.completedAppointments.length > 0 ? (
                            metrics.completedAppointments.map((apt) => {
                                const service = apt.services;
                                
                                return (
                                    <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Info del Servicio */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                                                        <VerticalIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                                        <div className="font-semibold text-gray-900">
                                                            {service?.name || `Sin ${verticalConfig.labels.service.toLowerCase()}`}
                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            {apt.customer_name}
                                    </div>
                                </div>
                    </div>

                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(parseISO(apt.appointment_date), 'dd MMM', { locale: es })}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {apt.appointment_time?.slice(0, 5) || 'N/A'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                                                        {apt.status === 'completed' ? 'Completado' : 'Confirmado'}
                                                    </span>
                            </div>
                        </div>

                                            {/* Precio */}
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-green-700">
                                                    €{service?.price?.toFixed(0) || 0}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {service?.duration_minutes || 30} min
                                    </div>
                            </div>
                        </div>
                    </div>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center text-gray-500">
                                <VerticalIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                    No hay {verticalConfig.labels.services.toLowerCase()} completados
                            </h3>
                                <p className="text-sm">
                                    Los {verticalConfig.labels.services.toLowerCase()} completados aparecerán aquí
                                </p>
                                            </div>
                        )}
                            </div>
                        </div>

                {/* Resumen Visual */}
                {metrics.totalServices > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            Resumen del Período
                            </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Facturación Total</div>
                                <div className="text-2xl font-bold text-green-700">€{metrics.totalRevenue.toFixed(0)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-600 mb-1">{verticalConfig.labels.servicesCompleted}</div>
                                <div className="text-2xl font-bold text-blue-700">{metrics.totalServices}</div>
                                            </div>
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Ticket Promedio</div>
                                <div className="text-2xl font-bold text-purple-700">€{metrics.avgTicket.toFixed(0)}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Sector: €{verticalConfig.benchmarks.avgTicket}
                                        </div>
                                    </div>
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Tasa Completados</div>
                                <div className="text-2xl font-bold text-indigo-700">
                                    {appointments.length > 0 
                                        ? Math.round((metrics.totalServices / appointments.length) * 100)
                                        : 0}%
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Sector: {verticalConfig.benchmarks.conversionRate}%
                            </div>
                        </div>
                    </div>
                </div>
            )}
                </div>
        </div>
    );
};

export default Consumos;
