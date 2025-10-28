// Consumos.jsx - Página completa de análisis de consumos y vinculación POS
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Link2, Unlink, Eye, DollarSign, Clock, Users, 
    CheckCircle2, AlertTriangle, RefreshCw, Filter,
    Receipt, Calendar, Search, TrendingUp, BarChart3,
    ChefHat, Award, Star, Utensils, PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';

const Consumos = () => {
    const { restaurant, businessId, isReady } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [reservations, setReservations] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [matches, setMatches] = useState([]);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [showDetails, setShowDetails] = useState({});
    const [stats, setStats] = useState({
        totalReservations: 0,
        linkedReservations: 0,
        pendingMatches: 0,
        totalRevenue: 0,
        avgTicket: 0
    });
    const [analytics, setAnalytics] = useState({
        topDishes: [],
        topCategories: [],
        paymentMethods: [],
        hourlyDistribution: [],
        revenueByDay: []
    });
    const [activeTab, setActiveTab] = useState('vinculacion'); // 'vinculacion' | 'analytics'
    const [dateRange, setDateRange] = useState('7days');

    // Cargar analytics de consumos
    const loadAnalytics = useCallback(async () => {
        if (!businessId) return;

        try {
            const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
            const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
            const endDate = format(new Date(), 'yyyy-MM-dd');

            // Cargar tickets del período
            const { data: ticketsData, error: ticketsError } = await supabase
                .from('billing_tickets')
                .select(`
                    id, ticket_date, total_amount, payment_method, items,
                    covers_count, tip_amount, customer_id,
                    customers(name, segment_auto_v2)
                `)
                .eq('business_id', businessId)
                .gte('ticket_date', startDate + ' 00:00:00')
                .lte('ticket_date', endDate + ' 23:59:59')
                .eq('is_processed', true)
                .order('ticket_date', { ascending: false });

            if (ticketsError) throw ticketsError;

            // Procesar datos para analytics
            const tickets = ticketsData || [];
            const allItems = [];
            const paymentMethodsMap = {};
            const hourlyMap = {};
            const categoryMap = {};
            const dailyRevenueMap = {};

            tickets.forEach(ticket => {
                // Extraer items
                if (ticket.items && Array.isArray(ticket.items)) {
                    ticket.items.forEach(item => {
                        allItems.push({
                            ...item,
                            ticket_date: ticket.ticket_date,
                            customer_segment: ticket.customers?.segment_auto_v2 || 'unknown'
                        });

                        // Contar categorías
                        const category = item.category || 'Sin categoría';
                        categoryMap[category] = (categoryMap[category] || 0) + (item.quantity || 1);
                    });
                }

                // Métodos de pago
                const paymentMethod = ticket.payment_method || 'No especificado';
                paymentMethodsMap[paymentMethod] = (paymentMethodsMap[paymentMethod] || 0) + 1;

                // Distribución horaria
                const hour = new Date(ticket.ticket_date).getHours();
                const hourBlock = `${hour}:00`;
                hourlyMap[hourBlock] = (hourlyMap[hourBlock] || 0) + parseFloat(ticket.total_amount || 0);

                // Ingresos diarios
                const day = format(parseISO(ticket.ticket_date), 'yyyy-MM-dd');
                dailyRevenueMap[day] = (dailyRevenueMap[day] || 0) + parseFloat(ticket.total_amount || 0);
            });

            // Calcular top dishes
            const dishesMap = {};
            allItems.forEach(item => {
                const dishName = item.name || 'Sin nombre';
                if (!dishesMap[dishName]) {
                    dishesMap[dishName] = {
                        name: dishName,
                        category: item.category || 'Sin categoría',
                        totalQuantity: 0,
                        totalRevenue: 0,
                        avgPrice: 0,
                        orders: 0
                    };
                }
                dishesMap[dishName].totalQuantity += item.quantity || 1;
                dishesMap[dishName].totalRevenue += item.total_price || 0;
                dishesMap[dishName].orders += 1;
            });

            // Calcular precio promedio para cada plato
            Object.values(dishesMap).forEach(dish => {
                dish.avgPrice = dish.totalRevenue / dish.totalQuantity;
            });

            const topDishes = Object.values(dishesMap)
                .sort((a, b) => b.totalQuantity - a.totalQuantity)
                .slice(0, 10);

            const topCategories = Object.entries(categoryMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);

            const paymentMethods = Object.entries(paymentMethodsMap)
                .map(([method, count]) => ({ method, count }))
                .sort((a, b) => b.count - a.count);

            const hourlyDistribution = Object.entries(hourlyMap)
                .map(([hour, revenue]) => ({ hour, revenue }))
                .sort((a, b) => a.hour.localeCompare(b.hour));

            const revenueByDay = Object.entries(dailyRevenueMap)
                .map(([date, revenue]) => ({ date, revenue }))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-14); // Últimos 14 días

            setAnalytics({
                topDishes,
                topCategories,
                paymentMethods,
                hourlyDistribution,
                revenueByDay
            });

        } catch (error) {
            console.error('Error loading analytics:', error);
            toast.error('Error al cargar analytics de consumos');
        }
    }, [businessId, dateRange]);

    // Función para generar consumos automáticamente - SOLO CON DATOS REALES
    const generateAutomaticReceipts = async (reservations) => {
        // NO GENERAR DATOS FICTICIOS - Solo usar datos reales de Supabase
        return [];

        const generatedReceipts = [];
        
        // Generar tickets para reservas confirmadas/completadas
        for (const reservation of reservations.filter(r => ['confirmed', 'completed'].includes(r.status))) {
            const items = [];
            let total = 0;
            
            // Generar items basados en el tamaño del grupo
            const numItems = Math.min(reservation.party_size * 2 + Math.floor(Math.random() * 3), 10);
            for (let i = 0; i < numItems; i++) {
                const plato = platos[Math.floor(Math.random() * platos.length)];
                const quantity = Math.random() < 0.7 ? 1 : 2;
                const itemTotal = plato.price * quantity;
                
                items.push({
                    name: plato.name,
                    category: plato.category,
                    quantity: quantity,
                    price: plato.price,
                    total: itemTotal
                });
                
                total += itemTotal;
            }

            const ticketData = {
                business_id: businessId,
                reservation_id: reservation.id,
                customer_id: reservation.customer_id,
                external_ticket_id: `TKT-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 9999 + 1)}`,
                ticket_number: `#${Math.floor(Math.random() * 9999 + 1)}`,
                mesa_number: reservation.table_number || String(Math.floor(Math.random() * 10 + 1)),
                ticket_date: `${reservation.reservation_date} ${reservation.reservation_time}`,
                service_start: reservation.reservation_time,
                items: items,
                subtotal: total,
                tax_amount: total * 0.10,
                discount_amount: Math.random() < 0.1 ? total * 0.05 : 0,
                tip_amount: Math.random() < 0.3 ? total * 0.1 : 0,
                total_amount: total * 1.10,
                payment_method: Math.random() < 0.6 ? 'card' : Math.random() < 0.9 ? 'cash' : 'mobile',
                payment_status: 'paid',
                covers_count: reservation.party_size,
                waiter_name: ['Carlos', 'María', 'Juan', 'Ana'][Math.floor(Math.random() * 4)],
                is_processed: true,
                auto_matched: true,
                confidence_score: 1.0
            };

            const { data, error } = await supabase
                .from('billing_tickets')
                .insert(ticketData)
                .select()
                .single();

            if (!error && data) {
                generatedReceipts.push(data);
            }
        }

        // Generar algunos walk-ins sin reserva
        for (let i = 0; i < 3; i++) {
            const items = [];
            let total = 0;
            
            const numItems = Math.floor(Math.random() * 4 + 2);
            for (let j = 0; j < numItems; j++) {
                const plato = platos[Math.floor(Math.random() * platos.length)];
                const quantity = 1;
                const itemTotal = plato.price * quantity;
                
                items.push({
                    name: plato.name,
                    category: plato.category,
                    quantity: quantity,
                    price: plato.price,
                    total: itemTotal
                });
                
                total += itemTotal;
            }

            const hour = 13 + Math.floor(Math.random() * 8);
            const minute = Math.floor(Math.random() * 60);

            const walkInData = {
                business_id: businessId,
                reservation_id: null,
                external_ticket_id: `WLK-${format(new Date(), 'yyyyMMdd')}-${i + 1}`,
                ticket_number: `#W${i + 1}`,
                mesa_number: String(Math.floor(Math.random() * 10 + 1)),
                ticket_date: `${selectedDate} ${hour}:${minute.toString().padStart(2, '0')}:00`,
                service_start: `${hour}:${minute.toString().padStart(2, '0')}:00`,
                items: items,
                subtotal: total,
                tax_amount: total * 0.10,
                total_amount: total * 1.10,
                payment_method: Math.random() < 0.7 ? 'card' : 'cash',
                payment_status: 'paid',
                covers_count: Math.floor(Math.random() * 4 + 1),
                waiter_name: ['Pedro', 'Laura'][Math.floor(Math.random() * 2)],
                is_processed: true,
                auto_matched: false,
                confidence_score: 0
            };

            const { data, error } = await supabase
                .from('billing_tickets')
                .insert(walkInData)
                .select()
                .single();

            if (!error && data) {
                generatedReceipts.push(data);
            }
        }

        return generatedReceipts;
    };

    // Cargar datos del día seleccionado
    const loadData = useCallback(async () => {
        if (!businessId) return;

        try {
            setLoading(true);

            // Cargar reservas del día
            const { data: reservationsData, error: reservationsError } = await supabase
                .from('appointments')
                .select(`
                    id, customer_name, customer_phone, customer_email,
                    reservation_date, reservation_time, party_size, status,
                    table_number, special_requests, created_at, customer_id
                `)
                .eq('business_id', businessId)
                .eq('reservation_date', selectedDate)
                .order('reservation_time');

            if (reservationsError) throw reservationsError;

            // 🔧 USAR TABLA EXISTENTE: billing_tickets en lugar de pos_receipts
            const { data: receiptsData, error: receiptsError } = await supabase
                .from('billing_tickets')
                .select(`
                    id, external_ticket_id, ticket_number, mesa_number,
                    ticket_date, service_start, service_end,
                    total_amount, payment_method, auto_matched, confidence_score,
                    reservation_id, customer_id, items, covers_count, waiter_name
                `)
                .eq('business_id', businessId)
                .gte('ticket_date', selectedDate + ' 00:00:00')
                .lte('ticket_date', selectedDate + ' 23:59:59')
                .order('ticket_date');

            if (receiptsError) throw receiptsError;

            // Si no hay consumos y hay reservas, generar automáticamente
            let finalReceiptsData = receiptsData || [];
            if (finalReceiptsData.length === 0 && reservationsData && reservationsData.length > 0) {
                console.log('No hay consumos, generando automáticamente...');
                const generated = await generateAutomaticReceipts(reservationsData);
                if (generated.length > 0) {
                    toast.success(`Se generaron ${generated.length} consumos automáticamente`);
                    // Recargar los datos después de generar
                    const { data: newReceiptsData } = await supabase
                        .from('billing_tickets')
                        .select(`
                            id, external_ticket_id, ticket_number, mesa_number,
                            ticket_date, service_start, service_end,
                            total_amount, payment_method, auto_matched, confidence_score,
                            reservation_id, customer_id, items, covers_count, waiter_name
                        `)
                        .eq('business_id', businessId)
                        .gte('ticket_date', selectedDate + ' 00:00:00')
                        .lte('ticket_date', selectedDate + ' 23:59:59')
                        .order('ticket_date');
                    
                    finalReceiptsData = newReceiptsData || [];
                }
            }

            // Los matches se obtienen directamente de billing_tickets que ya tienen reservation_id
            // No necesitamos tabla separada reservation_receipt_map
            const matchesData = (finalReceiptsData || [])
                .filter(receipt => receipt.reservation_id)
                .map(receipt => ({
                    id: `match_${receipt.reservation_id}_${receipt.id}`,
                    reservation_id: receipt.reservation_id,
                    receipt_id: receipt.id,
                    confidence: 1.0, // Vinculación directa = 100% confianza
                    status: 'linked',
                    linked_by: 'system',
                    linked_at: receipt.created_at
                }));

            // Obtener sugerencias automáticas para reservas sin vincular
            const unlinkedReservations = (reservationsData || []).filter(r => 
                !(matchesData || []).some(m => m.reservation_id === r.id && m.status === 'linked')
            );

            // Generar sugerencias simples para reservas sin vincular
            // basadas en fecha, hora y mesa
            let suggestionsData = [];
            if (unlinkedReservations.length > 0) {
                const unlinkedReceipts = (finalReceiptsData || []).filter(receipt => !receipt.reservation_id);
                
                unlinkedReservations.forEach(reservation => {
                    // Buscar tickets del mismo día sin vincular
                    const candidateReceipts = unlinkedReceipts.filter(receipt => {
                        const receiptDate = format(parseISO(receipt.ticket_date), 'yyyy-MM-dd');
                        return receiptDate === selectedDate;
                    });

                    candidateReceipts.forEach(receipt => {
                        suggestionsData.push({
                            reservation_id: reservation.id,
                            receipt_id: receipt.id,
                            confidence: 0.7, // Sugerencia automática
                            reason: 'Mismo día'
                        });
                    });
                });
            }

            // Combinar matches existentes con sugerencias
            const allMatches = [
                ...(matchesData || []),
                ...suggestionsData.map(s => ({
                    id: `suggestion_${s.reservation_id}_${s.receipt_id}`,
                    reservation_id: s.reservation_id,
                    receipt_id: s.receipt_id,
                    confidence: s.confidence,
                    status: 'pending',
                    linked_by: 'auto',
                    reason: s.reason,
                    tiempo_diff_minutes: s.tiempo_diff_minutes
                }))
            ];

            // Calcular estadísticas
            const totalRevenue = (finalReceiptsData || []).reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
            const linkedCount = (matchesData || []).filter(m => m.status === 'linked').length;
            const pendingCount = allMatches.filter(m => m.status === 'pending').length;

            setReservations(reservationsData || []);
            setReceipts(finalReceiptsData || []);
            setMatches(allMatches);
            setStats({
                totalReservations: (reservationsData || []).length,
                linkedReservations: linkedCount,
                pendingMatches: pendingCount,
                totalRevenue,
                avgTicket: (finalReceiptsData || []).length > 0 ? totalRevenue / (finalReceiptsData || []).length : 0
            });

        } catch (error) {
            console.error('Error loading consumos data:', error);
            toast.error('Error al cargar datos de consumos');
        } finally {
            setLoading(false);
        }
    }, [businessId, selectedDate]);

    // Vincular reserva con ticket (actualizar reservation_id en billing_tickets)
    const linkReservationReceipt = async (reservationId, receiptId, confidence = 1.0) => {
        try {
            const { error } = await supabase
                .from('billing_tickets')
                .update({ 
                    reservation_id: reservationId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', receiptId);

            if (error) throw error;

            toast.success('Vínculo creado exitosamente');
            loadData(); // Recargar datos
        } catch (error) {
            console.error('Error linking reservation-receipt:', error);
            toast.error('Error al crear el vínculo');
        }
    };

    // Desvincular (quitar reservation_id de billing_tickets)
    const unlinkReservationReceipt = async (reservationId, receiptId) => {
        try {
            const { error } = await supabase
                .from('billing_tickets')
                .update({ 
                    reservation_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', receiptId);

            if (error) throw error;

            toast.success('Vínculo eliminado');
            loadData();
        } catch (error) {
            console.error('Error unlinking:', error);
            toast.error('Error al eliminar el vínculo');
        }
    };

    // Los items están en el campo JSONB 'items' de billing_tickets
    // No necesitamos función separada, ya los tenemos cargados
    const getReceiptItems = useCallback((receiptId) => {
        const receipt = receipts.find(r => r.id === receiptId);
        return receipt?.items || [];
    }, [receipts]);

    // Toggle detalles de ticket
    const toggleDetails = (receiptId) => {
        if (showDetails[receiptId]) {
            setShowDetails(prev => ({ ...prev, [receiptId]: null }));
        } else {
            const items = getReceiptItems(receiptId);
            setShowDetails(prev => ({ ...prev, [receiptId]: items }));
        }
    };

    // Efectos
    useEffect(() => {
        if (isReady && businessId) {
            if (activeTab === 'vinculacion') {
                loadData();
            } else {
                loadAnalytics();
            }
        }
    }, [isReady, businessId, loadData, loadAnalytics, activeTab]);

    // Cargar analytics cuando cambie el rango de fechas
    useEffect(() => {
        if (isReady && businessId && activeTab === 'analytics') {
            loadAnalytics();
        }
    }, [dateRange, isReady, businessId, loadAnalytics, activeTab]);

    // Funciones auxiliares
    const getMatchForReservation = (reservationId) => {
        return matches.find(m => m.reservation_id === reservationId);
    };

    const getReceiptForMatch = (receiptId) => {
        return receipts.find(r => r.id === receiptId);
    };

    const formatTime = (timeString) => {
        return timeString ? timeString.slice(0, 5) : '';
    };

    const getStatusColor = (status, confidence) => {
        switch (status) {
            case 'linked': return 'bg-green-100 text-green-800 border-green-200';
            case 'pending': 
                if (confidence >= 0.8) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando datos de consumos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[85%] mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Receipt className="w-6 h-6 text-purple-600" />
                            Consumos
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {activeTab === 'vinculacion' 
                                ? 'Vincula reservas con tickets del sistema POS'
                                : 'Análisis completo de consumos y platos más vendidos'
                            }
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Pestañas */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setActiveTab('vinculacion')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === 'vinculacion'
                                        ? 'bg-white text-purple-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <Link2 className="w-4 h-4 inline mr-2" />
                                Vinculación
                            </button>
                            <button
                                onClick={() => setActiveTab('analytics')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === 'analytics'
                                        ? 'bg-white text-purple-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <BarChart3 className="w-4 h-4 inline mr-2" />
                                Analytics
                            </button>
                        </div>

                        {/* Controles específicos por pestaña */}
                        {activeTab === 'vinculacion' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <button
                                    onClick={loadData}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Actualizar
                                </button>
                            </>
                        ) : (
                            <>
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="7days">Últimos 7 días</option>
                                    <option value="30days">Últimos 30 días</option>
                                    <option value="90days">Últimos 90 días</option>
                                </select>
                                <button
                                    onClick={loadAnalytics}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Actualizar
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-600 font-medium">Reservas</span>
                        </div>
                        <div className="text-lg font-bold text-blue-900">{stats.totalReservations}</div>
                    </div>

                    <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                            <Link2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Vinculadas</span>
                        </div>
                        <div className="text-lg font-bold text-green-900">{stats.linkedReservations}</div>
                    </div>

                    <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm text-yellow-600 font-medium">Pendientes</span>
                        </div>
                        <div className="text-lg font-bold text-yellow-900">{stats.pendingMatches}</div>
                    </div>

                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-purple-600" />
                            <span className="text-sm text-purple-600 font-medium">Facturación</span>
                        </div>
                        <div className="text-lg font-bold text-purple-900">{stats.totalRevenue.toFixed(0)}€</div>
                    </div>

                    <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart3 className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm text-indigo-600 font-medium">Ticket Medio</span>
                        </div>
                        <div className="text-lg font-bold text-indigo-900">{stats.avgTicket.toFixed(0)}€</div>
                    </div>
                </div>
            </div>

            {/* Contenido específico por pestaña */}
            {activeTab === 'vinculacion' ? (
                /* Vista de Vinculación */
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Reservas del {format(parseISO(selectedDate), 'dd MMMM yyyy', { locale: es })}
                        </h2>
                    </div>

                    <div className="divide-y divide-gray-200">
                        {reservations.map((reservation) => {
                            const match = getMatchForReservation(reservation.id);
                            const receipt = match ? getReceiptForMatch(match.receipt_id) : null;
                            const items = receipt ? showDetails[receipt.id] : null;

                            return (
                                <div key={reservation.id} className="p-6">
                                    <div className="flex items-start justify-between">
                                        {/* Info de la reserva */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-semibold text-gray-900">
                                                    {reservation.customer_name}
                                                </h3>
                                                <span className="text-sm text-gray-500">
                                                    Mesa {reservation.table_number}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {formatTime(reservation.reservation_time)}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {reservation.party_size} personas
                                                </span>
                                            </div>

                                            {reservation.customer_phone && (
                                                <p className="text-sm text-gray-600">
                                                    📞 {reservation.customer_phone}
                                                </p>
                                            )}
                                        </div>

                                        {/* Estado del vínculo */}
                                        <div className="flex items-center gap-2">
                                            {match ? (
                                                <>
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(match.status, match.confidence)}`}>
                                                        {match.status === 'linked' ? 'Vinculada' : 'Sugerencia'} 
                                                        {match.confidence && ` (${Math.round(match.confidence * 100)}%)`}
                                                    </span>
                                                    
                                                    {receipt && (
                                                        <div className="text-right">
                                                            <div className="font-semibold text-gray-900">
                                                                {receipt.total_amount}€
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {format(parseISO(receipt.ticket_date), 'HH:mm')}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                    Sin vincular
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ticket vinculado */}
                                    {receipt && (
                                        <div className="mt-4 bg-gray-50 rounded-lg p-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            Ticket #{receipt.ticket_number || receipt.id.slice(0, 8)}
                                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            Mesa {receipt.mesa_number} • {receipt.payment_method || 'N/A'}
                                                        </div>
                                                    </div>
                                                    
                                                    {match.reason && (
                                                        <div className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                            {match.reason}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleDetails(receipt.id)}
                                                        className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        {showDetails[receipt.id] ? 'Ocultar' : 'Ver items'}
                                                    </button>

                                                    {match.status === 'linked' ? (
                                                        <button
                                                            onClick={() => unlinkReservationReceipt(reservation.id, receipt.id)}
                                                            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700"
                                                        >
                                                            <Unlink className="w-4 h-4" />
                                                            Desvincular
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => linkReservationReceipt(reservation.id, receipt.id, match.confidence)}
                                                            className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-700"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            Confirmar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Items del ticket */}
                                            {showDetails[receipt.id] && receipt.items && Array.isArray(receipt.items) && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                        {receipt.items.map((item, index) => (
                                                            <div key={index} className="flex justify-between">
                                                                <span className="text-gray-700">
                                                                    {item.quantity}x {item.name}
                                                                    {item.category && (
                                                                        <span className="text-gray-500 ml-1">
                                                                            ({item.category})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <span className="font-medium">
                                                                    {item.total_price}€
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {reservations.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No hay reservas para el día seleccionado</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Vista de Analytics */
                <div className="space-y-6">
                    {/* Top Dishes */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <ChefHat className="w-5 h-5 text-orange-600" />
                            Platos Más Vendidos
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {analytics.topDishes.slice(0, 8).map((dish, index) => (
                                <div key={dish.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full text-sm font-bold">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{dish.name}</div>
                                            <div className="text-sm text-gray-500">{dish.category}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-gray-900">{dish.totalQuantity} uds</div>
                                        <div className="text-sm text-gray-500">{dish.totalRevenue.toFixed(0)}€</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {analytics.topDishes.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                <ChefHat className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No hay datos de platos para el período seleccionado</p>
                            </div>
                        )}
                    </div>

                    {/* Categorías y Métodos de Pago */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Categories */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-blue-600" />
                                Categorías Más Populares
                            </h3>
                            <div className="space-y-3">
                                {analytics.topCategories.map((category, index) => (
                                    <div key={category.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{
                                                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'][index % 8]
                                            }}></div>
                                            <span className="text-gray-700">{category.name}</span>
                                        </div>
                                        <span className="font-semibold text-gray-900">{category.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                Métodos de Pago
                            </h3>
                            <div className="space-y-3">
                                {analytics.paymentMethods.map((method, index) => (
                                    <div key={method.method} className="flex items-center justify-between">
                                        <span className="text-gray-700 capitalize">{method.method}</span>
                                        <span className="font-semibold text-gray-900">{method.count} tickets</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Revenue Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Hourly Distribution */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-600" />
                                Distribución Horaria
                            </h3>
                            <div className="space-y-2">
                                {analytics.hourlyDistribution.map((hour) => (
                                    <div key={hour.hour} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">{hour.hour}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-purple-600 h-2 rounded-full"
                                                    style={{
                                                        width: `${Math.min(100, (hour.revenue / Math.max(...analytics.hourlyDistribution.map(h => h.revenue))) * 100)}%`
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="font-medium text-gray-900 w-12 text-right">{hour.revenue.toFixed(0)}€</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Daily Revenue */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                                Ingresos Diarios (Últimos 14 días)
                            </h3>
                            <div className="space-y-2">
                                {analytics.revenueByDay.map((day) => (
                                    <div key={day.date} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">
                                            {format(parseISO(day.date), 'dd/MM', { locale: es })}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-green-600 h-2 rounded-full"
                                                    style={{
                                                        width: `${Math.min(100, (day.revenue / Math.max(...analytics.revenueByDay.map(d => d.revenue))) * 100)}%`
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="font-medium text-gray-900 w-12 text-right">{day.revenue.toFixed(0)}€</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Consumos;


