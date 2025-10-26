// ====================================
// DASHBOARD AGENTE V2 - LA MEJOR APP DE GESTIÓN DE RESTAURANTES DEL MUNDO
// Vista ejecutiva: Todo lo importante de un vistazo
// ====================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    TrendingUp, TrendingDown, Users, AlertTriangle, 
    MessageSquare, Star, Smile, Clock, CheckCircle2,
    ArrowRight, RefreshCw, Brain, DollarSign, Target,
    Phone, Globe, Instagram, Facebook, Mail, Zap,
    Calendar, Bot
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardAgenteV2() {
    const { restaurant, user } = useAuthContext();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    
    const [dashboardData, setDashboardData] = useState({
        // Hero Section - KPIs Críticos
        reservationsToday: 0,
        reservationsYesterday: 0,
        reservationsDiff: 0,
        occupancyPercent: 0,
        occupancyYesterday: 0,
        occupancyDiff: 0,
        newCustomersToday: 0,
        newCustomersYesterday: 0,
        newCustomersDiff: 0,
        highRiskNoShows: 0,
        
        // Rendimiento Agente IA (últimos 7 días)
        aiConversationsCount: 0,
        aiSatisfaction: 0,
        aiPositivePercent: 0,
        aiEscalationPercent: 0,
        aiAvgResponseTime: 0,
        aiQuality: 0,
        
        // Clientes y Valor
        newCustomers: 0,
        returningCustomers: 0,
        vipCustomers: 0,
        fidelizationPercent: 0,
        weeklyValue: 0,
        avgTicket: 0,
        weeklyValueDiff: 0,
        
        // Canales (SOLO LOS ACTIVOS EN CONFIGURACIÓN)
        activeChannels: [],
        
        // Alertas y Acciones
        noShowAlerts: [],
        crmAlerts: [],
        
        // Tendencia Semanal
        weeklyTrend: [],
        
        // Avatar y nombres (se actualizan desde freshRestaurant)
        agentAvatar: null,
        agentName: 'Sofia',
        contactName: 'Jefe'
    });

    // Cargar todos los datos
    const loadDashboardData = async () => {
        if (!restaurant?.id) return;

        try {
            setLoading(true);
            
            // ✅ SIEMPRE recargar restaurant desde Supabase (para tener canales actualizados)
            const { data: freshRestaurant } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurant.id)
                .single();
            
            console.log('🔄 Restaurant recargado desde Supabase');
            console.log('🔍 Canales actuales:', freshRestaurant?.settings?.channels);
            
            // Usar freshRestaurant en lugar de restaurant para tener datos actualizados
            const currentRestaurant = freshRestaurant || restaurant;
            
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
            const sevenDaysAgo = subDays(today, 7);
            
            // ========================================
            // 1. HERO SECTION - KPIs CRÍTICOS DEL DÍA
            // ========================================
            
            // Reservas HOY
            const { data: todayReservations } = await supabase
                .from('reservations')
                .select(`
                    *,
                    customer:customer_id (
                        visits_count,
                        segment_auto
                    )
                `)
                .eq('restaurant_id', restaurant.id)
                .eq('reservation_date', todayStr)
                .in('status', ['pending', 'pending_approval', 'confirmed', 'seated', 'completed']);
            
            // Reservas AYER
            const { data: yesterdayReservations } = await supabase
                .from('reservations')
                .select('id, party_size')
                .eq('restaurant_id', restaurant.id)
                .eq('reservation_date', yesterdayStr)
                .in('status', ['pending', 'pending_approval', 'confirmed', 'seated', 'completed']);
            
            const reservationsToday = todayReservations?.length || 0;
            const reservationsYesterday = yesterdayReservations?.length || 0;
            const reservationsDiff = reservationsToday - reservationsYesterday;
            
            // Ocupación HOY vs AYER
            const { data: tables } = await supabase
                .from('tables')
                .select('capacity')
                .eq('restaurant_id', restaurant.id);
            
            const totalCapacity = tables?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0;
            const openingHours = 4; // 18:00 - 22:00 (simplificado)
            const avgDuration = 90; // minutos
            const turnosDisponibles = Math.floor((openingHours * 60) / avgDuration);
            const capacidadDiaria = totalCapacity * turnosDisponibles;
            
            const totalPeopleToday = todayReservations?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0;
            const totalPeopleYesterday = yesterdayReservations?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0;
            
            const occupancyPercent = capacidadDiaria > 0 ? Math.round((totalPeopleToday / capacidadDiaria) * 100) : 0;
            const occupancyYesterday = capacidadDiaria > 0 ? Math.round((totalPeopleYesterday / capacidadDiaria) * 100) : 0;
            const occupancyDiff = occupancyPercent - occupancyYesterday;
            
            // Clientes NUEVOS HOY
            const newCustomersToday = todayReservations?.reduce((sum, r) => {
                if (!r.customer_id || r.customer?.visits_count === 1) {
                    return sum + (r.party_size || 0);
                }
                return sum;
            }, 0) || 0;
            
            const { data: yesterdayReservationsWithCustomer } = await supabase
                .from('reservations')
                .select(`
                    party_size,
                    customer_id,
                    customer:customer_id (visits_count)
                `)
                .eq('restaurant_id', restaurant.id)
                .eq('reservation_date', yesterdayStr)
                .in('status', ['pending', 'pending_approval', 'confirmed', 'seated', 'completed']);
            
            const newCustomersYesterday = yesterdayReservationsWithCustomer?.reduce((sum, r) => {
                if (!r.customer_id || r.customer?.visits_count === 1) {
                    return sum + (r.party_size || 0);
                }
                return sum;
            }, 0) || 0;
            
            const newCustomersDiff = newCustomersToday - newCustomersYesterday;
            
            // Alertas NO-SHOWS de riesgo HOY
            const { data: riskPredictions } = await supabase
                .rpc('predict_upcoming_noshows_v2', {
                    p_restaurant_id: restaurant.id,
                    p_days_ahead: 0
                });
            
            const highRiskNoShows = riskPredictions?.filter(p => 
                p.risk_level === 'high' || p.risk_level === 'medium'
            ).length || 0;
            
            // ========================================
            // 2. RENDIMIENTO AGENTE IA (últimos 7 días)
            // ========================================
            
            // CORREGIDO: Buscar conversaciones resueltas O activas (analizadas)
            const { data: conversations } = await supabase
                .from('agent_conversations')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .gte('created_at', format(sevenDaysAgo, 'yyyy-MM-dd'));
            
            // Filtrar solo las que tienen análisis (sentiment o satisfaction)
            const analyzedConversations = conversations?.filter(c => 
                c.sentiment || (typeof c.metadata === 'object' && c.metadata?.satisfaction_level)
            ) || [];
            
            const aiConversationsCount = analyzedConversations.length || 0;
            
            // Satisfacción promedio
            const satisfactionMap = {
                'very_satisfied': 5,
                'satisfied': 4,
                'neutral': 3,
                'unsatisfied': 2,
                'very_unsatisfied': 1
            };
            
            const satisfactionScores = analyzedConversations
                .filter(c => {
                    const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                    return metadata?.satisfaction_level;
                })
                .map(c => {
                    const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                    return satisfactionMap[metadata.satisfaction_level] || 0;
                });
            
            const aiSatisfaction = satisfactionScores.length > 0
                ? (satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length)
                : 0;
            
            // % Sentiment positivo
            const positiveCount = analyzedConversations.filter(c => c.sentiment === 'positive').length || 0;
            const aiPositivePercent = aiConversationsCount > 0 
                ? Math.round((positiveCount / aiConversationsCount) * 100) 
                : 0;
            
            // % Escalación
            const escalationCount = analyzedConversations.filter(c => {
                const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                return metadata?.escalation_needed === true;
            }).length || 0;
            
            const aiEscalationPercent = aiConversationsCount > 0 
                ? Math.round((escalationCount / aiConversationsCount) * 100) 
                : 0;
            
            // Calidad promedio
            const qualityScores = analyzedConversations
                .filter(c => {
                    const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                    return metadata?.resolution_quality;
                })
                .map(c => {
                    const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                    return metadata.resolution_quality;
                });
            
            const aiQuality = qualityScores.length > 0
                ? (qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
                : 0;
            
            // Tiempo promedio de respuesta (calcular desde resolution_time_seconds)
            const responseTimes = analyzedConversations
                .filter(c => c.resolution_time_seconds && c.resolution_time_seconds > 0)
                .map(c => c.resolution_time_seconds / 3600); // convertir a horas
            
            const aiAvgResponseTime = responseTimes.length > 0
                ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                : 0;
            
            // ========================================
            // 3. CLIENTES Y VALOR (ESTA SEMANA, NO SOLO HOY)
            // ========================================
            
            // PRIMERO: Calcular fechas de esta semana
            const startThisWeek = startOfWeek(today, { weekStartsOn: 1 });
            const endThisWeek = endOfWeek(today, { weekStartsOn: 1 });
            const startLastWeek = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
            const endLastWeek = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
            
            // Obtener reservas de ESTA SEMANA con datos de clientes
            const { data: thisWeekReservationsWithCustomers } = await supabase
                .from('reservations')
                .select(`
                    *,
                    customer:customer_id (
                        id,
                        visits_count,
                        segment_auto
                    )
                `)
                .eq('restaurant_id', restaurant.id)
                .gte('reservation_date', format(startThisWeek, 'yyyy-MM-dd'))
                .lte('reservation_date', format(endThisWeek, 'yyyy-MM-dd'))
                .in('status', ['pending', 'pending_approval', 'confirmed', 'seated', 'completed']);
            
            // Contar clientes ÚNICOS (evitar duplicados si mismo cliente tiene varias reservas)
            const uniqueCustomerIds = new Set();
            const newCustomersSet = new Set();
            const returningCustomersSet = new Set();
            const vipCustomersSet = new Set();
            
            thisWeekReservationsWithCustomers?.forEach(r => {
                const customerId = r.customer_id || `temp_${r.customer_phone}`;
                
                if (!uniqueCustomerIds.has(customerId)) {
                    uniqueCustomerIds.add(customerId);
                    
                    if (!r.customer_id || r.customer?.visits_count === 1) {
                        newCustomersSet.add(customerId);
                    } else if (r.customer?.visits_count > 1 && r.customer?.visits_count < 10) {
                        returningCustomersSet.add(customerId);
                    } else if (r.customer?.visits_count >= 10 || r.customer?.segment_auto === 'vip') {
                        vipCustomersSet.add(customerId);
                    }
                }
            });
            
            const newCustomers = newCustomersSet.size;
            const returningCustomers = returningCustomersSet.size;
            const vipCustomers = vipCustomersSet.size;
            
            console.log('👥 Clientes esta semana:', {
                nuevos: newCustomers,
                retorno: returningCustomers,
                vip: vipCustomers,
                total: uniqueCustomerIds.size,
                reservas: thisWeekReservationsWithCustomers?.length
            });
            
            const totalCustomersToday = newCustomers + returningCustomers + vipCustomers;
            const fidelizationPercent = totalCustomersToday > 0 
                ? Math.round(((returningCustomers + vipCustomers) / totalCustomersToday) * 100) 
                : 0;
            
            // Valor generado esta semana (fechas ya calculadas arriba)
            const { data: thisWeekRes } = await supabase
                .from('reservations')
                .select('spend_amount')
                .eq('restaurant_id', restaurant.id)
                .gte('reservation_date', format(startThisWeek, 'yyyy-MM-dd'))
                .lte('reservation_date', format(endThisWeek, 'yyyy-MM-dd'))
                .in('status', ['completed', 'seated']);
            
            const { data: lastWeekRes } = await supabase
                .from('reservations')
                .select('spend_amount')
                .eq('restaurant_id', restaurant.id)
                .gte('reservation_date', format(startLastWeek, 'yyyy-MM-dd'))
                .lte('reservation_date', format(endLastWeek, 'yyyy-MM-dd'))
                .in('status', ['completed', 'seated']);
            
            // Ticket medio desde settings (si no está configurado, usar 0)
            const avgTicket = currentRestaurant?.settings?.avg_ticket || 0;
            console.log('💰 Ticket medio desde settings:', avgTicket);
            const weeklySpend = thisWeekRes?.reduce((sum, r) => sum + (r.spend_amount || 0), 0) || 0;
            const lastWeekSpend = lastWeekRes?.reduce((sum, r) => sum + (r.spend_amount || 0), 0) || 0;
            
            const weeklyValue = weeklySpend > 0 ? weeklySpend : (thisWeekRes?.length || 0) * avgTicket;
            const lastWeekValue = lastWeekSpend > 0 ? lastWeekSpend : (lastWeekRes?.length || 0) * avgTicket;
            const weeklyValueDiff = weeklyValue - lastWeekValue;
            const weeklyValuePercent = lastWeekValue > 0 ? Math.round((weeklyValueDiff / lastWeekValue) * 100) : 0;
            
            // ========================================
            // 4. CANALES Y DISTRIBUCIÓN
            // ========================================
            
            const channelCounts = {};
            const channelMap = {
                'agent_whatsapp': 'whatsapp',
                'whatsapp': 'whatsapp',
                'agent_phone': 'phone',
                'phone': 'phone',
                'vapi': 'phone',
                'web': 'web',
                'widget': 'web',
                'instagram': 'instagram',
                'facebook': 'facebook',
                'manual': 'manual'
            };
            
            const { data: thisWeekChannels } = await supabase
                .from('reservations')
                .select('source')
                .eq('restaurant_id', restaurant.id)
                .gte('reservation_date', format(startThisWeek, 'yyyy-MM-dd'))
                .lte('reservation_date', format(endThisWeek, 'yyyy-MM-dd'))
                .in('status', ['pending', 'pending_approval', 'confirmed', 'seated', 'completed']);
            
            thisWeekChannels?.forEach(r => {
                const source = r.source || 'manual';
                const channel = channelMap[source.toLowerCase()] || 'manual';
                channelCounts[channel] = (channelCounts[channel] || 0) + 1;
            });
            
            const totalChannelReservations = Object.values(channelCounts).reduce((a, b) => a + b, 0) || 1;
            
            // ========================================
            // CANALES ACTIVOS: LEE settings.channels (NO channels)
            // ========================================
            console.log('🔍 Restaurant settings:', currentRestaurant?.settings);
            console.log('🔍 Channels config:', currentRestaurant?.settings?.channels);
            
            const channelsConfig = currentRestaurant?.settings?.channels || {};
            
            const channelConfigurations = [
                {
                    key: 'manual',
                    name: 'Manual',
                    enabled: true, // ✅ SIEMPRE activo (reservas desde Dashboard)
                    icon: <Calendar className="w-5 h-5 text-gray-600" />,
                    color: 'bg-gray-600'
                },
                {
                    key: 'whatsapp',
                    name: 'WhatsApp',
                    enabled: channelsConfig.whatsapp?.enabled === true,
                    icon: <MessageSquare className="w-5 h-5 text-green-600" />,
                    color: 'bg-green-600'
                },
                {
                    key: 'phone',
                    name: 'VAPI (Teléfono)',
                    enabled: channelsConfig.vapi?.enabled === true,
                    icon: <Phone className="w-5 h-5 text-blue-600" />,
                    color: 'bg-blue-600'
                },
                {
                    key: 'web',
                    name: 'Web Chat',
                    enabled: channelsConfig.webchat?.enabled === true,
                    icon: <Globe className="w-5 h-5 text-purple-600" />,
                    color: 'bg-purple-600'
                },
                {
                    key: 'instagram',
                    name: 'Instagram',
                    enabled: channelsConfig.instagram?.enabled === true,
                    icon: <Instagram className="w-5 h-5 text-pink-600" />,
                    color: 'bg-pink-600'
                },
                {
                    key: 'facebook',
                    name: 'Facebook',
                    enabled: channelsConfig.facebook?.enabled === true,
                    icon: <Facebook className="w-5 h-5 text-blue-700" />,
                    color: 'bg-blue-700'
                }
            ];
            
            console.log('🔍 Channel configurations:', channelConfigurations.map(ch => ({
                name: ch.name,
                enabled: ch.enabled
            })));
            
            // Construir array de canales activos: SOLO los enabled (aunque tengan 0 reservas)
            const activeChannels = channelConfigurations
                .filter(ch => {
                    console.log(`🔍 Canal ${ch.name}: enabled=${ch.enabled}, count=${channelCounts[ch.key] || 0}`);
                    return ch.enabled === true; // SOLO este filtro, NO filtrar por count
                })
                .map(ch => ({
                    name: ch.name,
                    icon: ch.icon,
                    color: ch.color,
                    count: channelCounts[ch.key] || 0,
                    percent: Math.round(((channelCounts[ch.key] || 0) / totalChannelReservations) * 100)
                }));
            
            console.log('✅ Active channels:', activeChannels.map(ch => `${ch.name} (${ch.count} reservas)`));
            
            // ========================================
            // 5. ALERTAS Y ACCIONES PENDIENTES
            // ========================================
            
            // Top 3 No-Shows de riesgo
            const noShowAlerts = (riskPredictions || [])
                .filter(p => p.risk_level === 'high' || p.risk_level === 'medium')
                .slice(0, 3)
                .map(p => ({
                    customerName: p.customer_name || 'Cliente',
                    tableNames: p.table_names || 'Sin mesa',
                    time: p.reservation_time ? p.reservation_time.substring(0, 5) : '', // Sin segundos
                    riskLevel: p.risk_level,
                    riskScore: p.risk_score
                }));
            
            // Alertas CRM pendientes
            const { data: crmSuggestions } = await supabase
                .from('crm_suggestions')
                .select('type')
                .eq('restaurant_id', restaurant.id)
                .eq('status', 'pending');
            
            const crmAlertsCounts = {};
            crmSuggestions?.forEach(s => {
                crmAlertsCounts[s.type] = (crmAlertsCounts[s.type] || 0) + 1;
            });
            
            const crmAlerts = [
                { type: 'welcome', count: crmAlertsCounts.welcome || 0, label: 'Bienvenidas nuevos' },
                { type: 'reactivation', count: crmAlertsCounts.reactivation || 0, label: 'Reactivaciones inactivos' },
                { type: 'vip', count: crmAlertsCounts.vip || 0, label: 'Recordatorios VIP' }
            ].filter(a => a.count > 0);
            
            // ========================================
            // 6. TENDENCIA SEMANAL (ESTA SEMANA: Lun-Dom)
            // ========================================
            
            const weeklyTrend = [];
            const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 }); // Lunes
            
            for (let i = 0; i < 7; i++) {
                const date = new Date(startOfThisWeek);
                date.setDate(startOfThisWeek.getDate() + i);
                const dateStr = format(date, 'yyyy-MM-dd');
                
                const { data: dayReservations } = await supabase
                    .from('reservations')
                    .select('id')
                    .eq('restaurant_id', restaurant.id)
                    .eq('reservation_date', dateStr)
                    .in('status', ['pending', 'pending_approval', 'confirmed', 'seated', 'completed']);
                
                console.log(`📅 ${format(date, 'EEE d/M', { locale: es })}: ${dayReservations?.length || 0} reservas`);
                
                weeklyTrend.push({
                    day: format(date, 'EEE', { locale: es }),
                    date: dateStr,
                    count: dayReservations?.length || 0,
                    isToday: dateStr === todayStr
                });
            }
            
            // ========================================
            // ACTUALIZAR ESTADO
            // ========================================
            
            setDashboardData({
                // Hero Section
                reservationsToday,
                reservationsYesterday,
                reservationsDiff,
                occupancyPercent,
                occupancyYesterday,
                occupancyDiff,
                newCustomersToday,
                newCustomersYesterday,
                newCustomersDiff,
                highRiskNoShows,
                
                // Agente IA
                aiConversationsCount,
                aiSatisfaction,
                aiPositivePercent,
                aiEscalationPercent,
                aiAvgResponseTime,
                aiQuality,
                
                // Clientes y Valor
                newCustomers,
                returningCustomers,
                vipCustomers,
                fidelizationPercent,
                weeklyValue,
                avgTicket,
                weeklyValueDiff: weeklyValuePercent,
                
                // Canales (SOLO ACTIVOS)
                activeChannels,
                
                // Alertas
                noShowAlerts,
                crmAlerts,
                
                // Tendencia
                weeklyTrend,
                
                // Avatar del agente (desde freshRestaurant)
                agentAvatar: currentRestaurant?.settings?.agent?.avatar_url || null,
                agentName: currentRestaurant?.settings?.agent?.name || 'Sofia',
                contactName: currentRestaurant?.settings?.contact_name || user?.email?.split('@')[0] || 'Jefe'
            });
            
            setLastUpdate(new Date());
            
        } catch (error) {
            console.error('❌ Error cargando dashboard:', error);
            toast.error('Error al cargar datos del dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (restaurant?.id) {
            loadDashboardData();
        }
    }, [restaurant?.id]);
    
    // Auto-refresh cuando se actualizan canales desde Configuración
    useEffect(() => {
        const handleChannelUpdate = async () => {
            console.log('🔄 Canales actualizados, RECARGANDO restaurant desde Supabase...');
            
            // FORZAR RECARGA del restaurant desde Supabase
            const { data: freshRestaurant } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurant.id)
                .single();
            
            if (freshRestaurant) {
                console.log('✅ Restaurant recargado con nuevos canales:', freshRestaurant.settings?.channels);
                // Forzar actualización del contexto
                window.dispatchEvent(new CustomEvent('restaurant-updated', {
                    detail: { restaurant: freshRestaurant }
                }));
            }
            
            // Recargar dashboard con datos frescos
            setTimeout(() => loadDashboardData(), 500);
        };
        
        window.addEventListener('channels-updated', handleChannelUpdate);
        
        return () => {
            window.removeEventListener('channels-updated', handleChannelUpdate);
        };
    }, [restaurant?.id]);

    // Helper para formatear números
    const formatNumber = (num) => {
        return new Intl.NumberFormat('es-ES').format(num);
    };

    // Helper para mostrar diferencias
    const renderDiff = (diff, isPercent = false) => {
        if (diff === 0) return null;
        
        const isPositive = diff > 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        const color = isPositive ? 'text-green-600' : 'text-red-600';
        
        return (
            <div className={`flex items-center gap-1 text-xs ${color} font-medium`}>
                <Icon className="w-3 h-3" />
                {isPositive ? '+' : ''}{formatNumber(diff)}{isPercent ? '%' : ''}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando dashboard...</p>
                </div>
            </div>
        );
    }

    // Datos del agente para el header (ahora vienen desde dashboardData que usa freshRestaurant)
    const agentName = dashboardData.agentName || 'Sofia';
    const agentAvatar = dashboardData.agentAvatar || null;
    const contactName = dashboardData.contactName || 'Jefe';

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-4">
            <div className="max-w-[85%] mx-auto space-y-3">
                
                {/* HEADER CON AVATAR Y SALUDO */}
                <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-white rounded-xl shadow-sm border border-purple-100 p-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 flex items-center justify-center shadow-lg ring-2 ring-purple-100">
                                {agentAvatar ? (
                                    <img src={agentAvatar} alt={agentName} className="w-full h-full object-cover" />
                                ) : (
                                    <Bot className="w-16 h-16 text-white opacity-80" />
                                )}
                            </div>
                        </div>

                        {/* Información */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-xl font-bold text-gray-900 mb-0.5">
                                {format(new Date(), 'HH') < 12 ? 'Buenos días' : format(new Date(), 'HH') < 20 ? 'Buenas tardes' : 'Buenas noches'}, {contactName}
                            </h1>
                            <p className="text-xs text-gray-600 mb-2">
                                Aquí tienes los datos más importantes del día para tu restaurante
                            </p>
                            
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-gray-700">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4 text-purple-600" />
                                    <span className="font-semibold capitalize">
                                        {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold">Actualizado: {format(lastUpdate, 'HH:mm')}</span>
                                </div>
                                <button
                                    onClick={loadDashboardData}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Actualizar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. HERO SECTION - KPIs CRÍTICOS DEL DÍA (Colores sobrios) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* Reservas de Hoy */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border-2 border-blue-200">
                        <div className="flex items-center justify-between mb-1">
                            <Target className="w-4 h-4 text-blue-600" />
                            {renderDiff(dashboardData.reservationsDiff)}
                        </div>
                        <div className="text-lg font-bold text-gray-900">{dashboardData.reservationsToday}</div>
                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Reservas de Hoy</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">vs ayer: {dashboardData.reservationsYesterday}</div>
                    </div>

                    {/* Ocupación */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border-2 border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                            <Users className="w-4 h-4 text-purple-600" />
                            {renderDiff(dashboardData.occupancyDiff, true)}
                        </div>
                        <div className="text-lg font-bold text-gray-900">{dashboardData.occupancyPercent}%</div>
                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Ocupación</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">vs ayer: {dashboardData.occupancyYesterday}%</div>
                    </div>

                    {/* Clientes Nuevos */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border-2 border-green-200">
                        <div className="flex items-center justify-between mb-1">
                            <Users className="w-4 h-4 text-green-600" />
                            {renderDiff(dashboardData.newCustomersDiff)}
                        </div>
                        <div className="text-lg font-bold text-gray-900">{dashboardData.newCustomersToday}</div>
                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Clientes Nuevos</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">vs ayer: {dashboardData.newCustomersYesterday}</div>
                    </div>

                    {/* Alertas No-Show */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border-2 border-orange-200">
                        <div className="flex items-center justify-between mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="text-lg font-bold text-gray-900">{dashboardData.highRiskNoShows}</div>
                        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Alertas No-Show</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Riesgo Alto/Medio</div>
                    </div>
                </div>

                {/* 2. RENDIMIENTO DEL AGENTE IA */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Brain className="w-5 h-5 text-indigo-600" />
                            🤖 Agente IA
                        </h2>
                        <span className="text-xs text-gray-500">(últimos 7 días)</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="text-center p-2 bg-indigo-50 rounded-lg">
                            <div className="text-lg font-bold text-indigo-600">{dashboardData.aiConversationsCount}</div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">Conversaciones</div>
                        </div>
                        
                        <div className="text-center p-2 bg-amber-50 rounded-lg">
                            <div className="text-lg font-bold text-amber-600">
                                {dashboardData.aiSatisfaction > 0 ? dashboardData.aiSatisfaction.toFixed(1) : '-'}/5
                            </div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">⭐ Satisfacción</div>
                        </div>
                        
                        <div className="text-center p-2 bg-green-50 rounded-lg">
                            <div className="text-lg font-bold text-green-600">
                                {dashboardData.aiPositivePercent.toFixed(0)}%
                            </div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">😊 Positivos</div>
                        </div>
                        
                        <div className="text-center p-2 bg-orange-50 rounded-lg">
                            <div className="text-lg font-bold text-orange-600">
                                {dashboardData.aiEscalationPercent.toFixed(0)}%
                            </div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">⚠️ Escalación</div>
                        </div>
                        
                        <div className="text-center p-2 bg-blue-50 rounded-lg">
                            <div className="text-lg font-bold text-blue-600">
                                {dashboardData.aiAvgResponseTime.toFixed(1)}h
                            </div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">⏱️ Tiempo Resp.</div>
                        </div>
                        
                        <div className="text-center p-2 bg-purple-50 rounded-lg">
                            <div className="text-lg font-bold text-purple-600">
                                {dashboardData.aiQuality > 0 ? dashboardData.aiQuality.toFixed(1) : '-'}/5
                            </div>
                            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">✅ Calidad</div>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => navigate('/comunicacion')}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                    >
                        Ver Comunicaciones
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                {/* 3. ALERTAS Y ACCIONES PENDIENTES (Movido aquí para más visibilidad) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Alertas No-Shows */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            ⚠️ Alertas No-Shows ({dashboardData.highRiskNoShows})
                        </h3>
                        {dashboardData.noShowAlerts.length > 0 ? (
                            <div className="space-y-2 mb-4">
                                {dashboardData.noShowAlerts.map((alert, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                                        <span className="text-sm font-medium text-gray-700">
                                            <span className="font-bold">{alert.tableNames}</span> - {alert.customerName}
                                        </span>
                                        <span className="text-base font-bold text-gray-900">{alert.time}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mb-4">Sin alertas de riesgo hoy 🎉</p>
                        )}
                        <button
                            onClick={() => navigate('/no-shows')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                        >
                            Ver todas
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Acciones CRM */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-purple-600" />
                            📢 Acciones CRM ({dashboardData.crmAlerts.reduce((sum, a) => sum + a.count, 0)})
                        </h3>
                        {dashboardData.crmAlerts.length > 0 ? (
                            <div className="space-y-2 mb-4">
                                {dashboardData.crmAlerts.map((alert, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                        <span className="text-sm font-medium text-gray-700">• {alert.count} {alert.label}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mb-4">No hay acciones pendientes 🎉</p>
                        )}
                        <button
                            onClick={() => navigate('/crm-inteligente')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                        >
                            Ver CRM
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 4. CANALES + TENDENCIA SEMANAL (Misma fila, 50/50) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Canales Activos */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Canales Activos</h3>
                        <div className="flex-1">
                            {dashboardData.activeChannels && dashboardData.activeChannels.length > 0 ? (
                                <div className="space-y-3">
                                    {dashboardData.activeChannels.map((channel, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            {channel.icon}
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-700">{channel.name}</span>
                                                    <span className="text-sm font-bold text-gray-900">
                                                        {channel.count} reservas ({channel.percent}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full transition-all ${channel.color}`}
                                                        style={{ width: `${channel.percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No hay canales activos configurados</p>
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/configuracion?tab=canales')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium mt-4"
                        >
                            Ver Canales
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tendencia Semanal */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Reservas Esta Semana</h3>
                        <p className="text-xs text-gray-500 mb-4">📅 Lun-Dom (semana actual)</p>
                        
                        <div className="flex-1">
                            {/* Gráfico simple con barras */}
                            <div className="flex items-end justify-between gap-2 mb-4 h-32">
                                {dashboardData.weeklyTrend.map((day, idx) => {
                                    const maxCount = Math.max(...dashboardData.weeklyTrend.map(d => d.count), 1);
                                    const heightPercent = (day.count / maxCount) * 100;
                                    
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center">
                                            <div className="w-full flex flex-col justify-end h-24">
                                                <div 
                                                    className={`w-full rounded-t-lg transition-all ${
                                                        day.isToday ? 'bg-purple-600' : 'bg-blue-400'
                                                    }`}
                                                    style={{ height: `${heightPercent}%` }}
                                                />
                                            </div>
                                            <div className="text-xs font-bold text-gray-900 mt-2">{day.count}</div>
                                            <div className={`text-xs ${day.isToday ? 'text-purple-600 font-bold' : 'text-gray-500'}`}>
                                                {day.day}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Resumen */}
                            <div className="flex items-center justify-center gap-6 text-sm text-gray-600 pt-4 border-t">
                                <span>
                                    Total semana: <strong className="text-gray-900">{dashboardData.weeklyTrend.reduce((sum, d) => sum + d.count, 0)} reservas</strong>
                                </span>
                                <span>
                                    Media: <strong className="text-gray-900">{Math.round(dashboardData.weeklyTrend.reduce((sum, d) => sum + d.count, 0) / 7)}/día</strong>
                                </span>
                            </div>
                        </div>
                        
                        <button
                            onClick={() => navigate('/reservas')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium mt-4"
                        >
                            Ver Reservas
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 5. CLIENTES Y VALOR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Clientes */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            Clientes
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">📅 Esta semana (Lun-Dom)</p>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">🆕 Nuevos:</span>
                                <span className="text-lg font-bold text-gray-900">{dashboardData.newCustomers}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">🔁 Retorno:</span>
                                <span className="text-lg font-bold text-gray-900">{dashboardData.returningCustomers}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">👑 VIP:</span>
                                <span className="text-lg font-bold text-gray-900">{dashboardData.vipCustomers}</span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                                <span className="text-sm text-gray-600">📊 Fidelización:</span>
                                <span className="text-lg font-bold text-green-600">{dashboardData.fidelizationPercent}%</span>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/clientes')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium mt-4"
                        >
                            Ver Clientes
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Valor Generado */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                            Valor Generado
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">📅 Esta semana (Lun-Dom)</p>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Esta semana:</span>
                                <span className="text-lg font-bold text-gray-900">€{formatNumber(dashboardData.weeklyValue)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Ticket medio:</span>
                                <span className="text-lg font-bold text-gray-900">€{dashboardData.avgTicket}</span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                                <span className="text-sm text-gray-600">vs semana pasada:</span>
                                {renderDiff(dashboardData.weeklyValueDiff, true)}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/consumos')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium mt-4"
                        >
                            Ver Consumos
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

