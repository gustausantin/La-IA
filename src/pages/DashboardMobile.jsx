// DashboardMobile.jsx - Dashboard mobile-first
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
} from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import BottomNavigation from '../components/mobile/BottomNavigation';
import Card, { StatsCard, CardHeader } from '../components/mobile/Card';
import TouchButton from '../components/mobile/TouchButton';
import { ReservationCardCompact } from '../components/mobile/ReservationCard';
import { usePullToRefresh } from '../hooks/useGestures';
import toast from 'react-hot-toast';

const DashboardMobile = () => {
  const { restaurantId, restaurant } = useAuthContext();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    today: { total: 0, confirmed: 0, pending: 0, people: 0 },
    thisWeek: { total: 0, people: 0, revenue: 0 },
    thisMonth: { total: 0, people: 0, revenue: 0 },
  });

  const [upcomingReservations, setUpcomingReservations] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pull to refresh
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await loadDashboardData();
      toast.success('Actualizado');
    },
  });

  const loadDashboardData = async () => {
    if (!restaurantId) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Today's stats
      const { data: todayData } = await supabase
        .from('reservations')
        .select('status, party_size')
        .eq('restaurant_id', restaurantId)
        .gte('date', `${today}T00:00:00`)
        .lte('date', `${today}T23:59:59`);

      const todayStats = {
        total: todayData?.length || 0,
        confirmed: todayData?.filter(r => r.status === 'confirmed').length || 0,
        pending: todayData?.filter(r => r.status === 'pending').length || 0,
        people: todayData?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0,
      };

      // Upcoming reservations
      const { data: upcoming } = await supabase
        .from('reservations')
        .select(`
          *,
          customer:customers(name, phone),
          table:tables(name)
        `)
        .eq('restaurant_id', restaurantId)
        .gte('date', new Date().toISOString())
        .in('status', ['confirmed', 'pending'])
        .order('date', { ascending: true })
        .limit(5);

      setStats({ ...stats, today: todayStats });
      setUpcomingReservations(upcoming?.map(r => ({
        ...r,
        customer_name: r.customer?.name,
        customer_phone: r.customer?.phone,
        table_name: r.table?.name,
      })) || []);

    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [restaurantId]);

  return (
    <div 
      className="min-h-screen bg-gray-50 pb-24"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      {...pullToRefresh}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{restaurant?.name || 'La-IA'}</h1>
            <p className="text-purple-100 text-sm">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">👋</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.today.total}</p>
            <p className="text-xs text-purple-100">Hoy</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.today.confirmed}</p>
            <p className="text-xs text-purple-100">Confirmadas</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.today.pending}</p>
            <p className="text-xs text-purple-100">Pendientes</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            label="Personas hoy"
            value={stats.today.people}
            icon={Users}
            color="blue"
            onClick={() => navigate('/reservas')}
          />
          <StatsCard
            label="Tasa confirmación"
            value={stats.today.total > 0 
              ? `${Math.round((stats.today.confirmed / stats.today.total) * 100)}%`
              : '0%'}
            icon={CheckCircle2}
            color="green"
            trend="up"
            trendValue="+5%"
          />
        </div>

        {/* Quick actions */}
        <Card padding="md">
          <h3 className="font-semibold text-gray-900 mb-3">Acciones rápidas</h3>
          <div className="grid grid-cols-2 gap-3">
            <TouchButton
              icon={Calendar}
              onClick={() => navigate('/reservas?new=true')}
              variant="outline"
              size="md"
            >
              Nueva Reserva
            </TouchButton>
            <TouchButton
              icon={Users}
              onClick={() => navigate('/clientes')}
              variant="outline"
              size="md"
            >
              Ver Clientes
            </TouchButton>
            <TouchButton
              icon={MessageSquare}
              onClick={() => navigate('/comunicacion')}
              variant="outline"
              size="md"
            >
              Mensajes
            </TouchButton>
            <TouchButton
              icon={Clock}
              onClick={() => navigate('/calendario')}
              variant="outline"
              size="md"
            >
              Calendario
            </TouchButton>
          </div>
        </Card>

        {/* Upcoming reservations */}
        {upcomingReservations.length > 0 && (
          <Card padding="sm">
            <CardHeader
              title="Próximas reservas"
              action={
                <button
                  onClick={() => navigate('/reservas')}
                  className="text-sm text-purple-600 font-medium"
                >
                  Ver todas
                </button>
              }
            />
            <div className="divide-y divide-gray-100">
              {upcomingReservations.slice(0, 3).map((reservation) => (
                <ReservationCardCompact
                  key={reservation.id}
                  reservation={reservation}
                  onClick={() => navigate(`/reservas/${reservation.id}`)}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Alerts & reminders */}
        {stats.today.pending > 0 && (
          <Card padding="md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  Tienes {stats.today.pending} reservas pendientes
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Confirma las reservas para mejorar tu tasa de asistencia
                </p>
                <TouchButton
                  onClick={() => navigate('/reservas')}
                  variant="primary"
                  size="sm"
                >
                  Ver reservas
                </TouchButton>
              </div>
            </div>
          </Card>
        )}

        {/* Channels status */}
        <Card padding="md">
          <h3 className="font-semibold text-gray-900 mb-3">Canales activos</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                Activo
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium">Llamadas (VAPI)</span>
              </div>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                Activo
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                Activo
              </span>
            </div>
          </div>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default DashboardMobile;

