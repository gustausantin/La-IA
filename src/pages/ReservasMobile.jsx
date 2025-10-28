// ReservasMobile.jsx - Vista mobile-first de reservas
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Plus,
  Calendar as CalendarIcon,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import BottomNavigation from '../components/mobile/BottomNavigation';
import ReservationCard, { ReservationCardCompact } from '../components/mobile/ReservationCard';
import TouchButton, { FAB, IconButton } from '../components/mobile/TouchButton';
import { SearchInput } from '../components/mobile/Input';
import Card, { StatsCard } from '../components/mobile/Card';
import { usePullToRefresh } from '../hooks/useGestures';
import { useDevice } from '../hooks/useDevice';
import toast from 'react-hot-toast';

const ReservasMobile = () => {
  const { businessId } = useAuthContext();
  const navigate = useNavigate();
  const device = useDevice();

  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [reservations, setReservations] = useState([]);
  const [filteredReservations, setFilteredReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'list'

  // Pull to refresh
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await loadReservations();
      toast.success('Actualizado');
    },
  });

  // Load reservations
  const loadReservations = async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(name, phone, email),
          table:tables(name)
        `)
        .eq('business_id', businessId)
        .gte('date', `${dateStr}T00:00:00`)
        .lte('date', `${dateStr}T23:59:59`)
        .order('date', { ascending: true });

      if (error) throw error;

      const mapped = data.map(r => ({
        ...r,
        customer_name: r.customer?.name,
        customer_phone: r.customer?.phone,
        table_name: r.table?.name,
      }));

      setReservations(mapped);
      setFilteredReservations(mapped);
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast.error('Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [businessId, selectedDate]);

  // Filter reservations
  useEffect(() => {
    let filtered = reservations;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.customer_name?.toLowerCase().includes(query) ||
        r.customer_phone?.includes(query)
      );
    }

    setFilteredReservations(filtered);
  }, [reservations, filterStatus, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = reservations.length;
    const confirmed = reservations.filter(r => r.status === 'confirmed').length;
    const pending = reservations.filter(r => r.status === 'pending').length;
    const people = reservations.reduce((sum, r) => sum + (r.party_size || 0), 0);

    return { total, confirmed, pending, people };
  }, [reservations]);

  // Handlers
  const handleNewReservation = () => {
    navigate('/reservas?new=true');
  };

  const handleCall = (reservation) => {
    window.location.href = `tel:${reservation.customer_phone}`;
  };

  const handleMessage = (reservation) => {
    window.location.href = `sms:${reservation.customer_phone}`;
  };

  const handleViewDetails = (reservation) => {
    navigate(`/reservas/${reservation.id}`);
  };

  const handleEdit = (reservation) => {
    navigate(`/reservas/${reservation.id}/edit`);
  };

  const handleConfirm = async (reservation) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', reservation.id);

      if (error) throw error;

      toast.success('Reserva confirmada');
      loadReservations();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al confirmar');
    }
  };

  return (
    <div 
      className="min-h-screen bg-gray-50 pb-24"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      {...pullToRefresh}
    >
      {/* Pull to refresh indicator */}
      {pullToRefresh.isPulling && (
        <div className="fixed top-0 left-0 right-0 flex justify-center pt-4 z-50">
          <div className="bg-white rounded-full p-2 shadow-lg">
            <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
            <IconButton
              icon={Filter}
              onClick={() => {/* TODO: Open filter modal */}}
              variant="ghost"
            />
          </div>

          {/* Date selector */}
          <div className="flex items-center gap-2 mb-3">
            <IconButton
              icon={ChevronLeft}
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              variant="outline"
              size="sm"
            />
            
            <button
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              className="flex-1 bg-purple-50 text-purple-600 rounded-lg py-2 px-4 font-medium text-sm active:bg-purple-100 transition-colors"
            >
              {format(selectedDate, 'EEEE, d MMMM', { locale: es })}
            </button>
            
            <IconButton
              icon={ChevronRight}
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              variant="outline"
              size="sm"
            />
          </div>

          {/* Search */}
          <SearchInput
            placeholder="Buscar por nombre o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        {/* Stats */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'confirmed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            Confirmadas ({stats.confirmed})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            Pendientes ({stats.pending})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : filteredReservations.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-8">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay reservas
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'No se encontraron reservas con ese criterio'
                  : 'No hay reservas para esta fecha'}
              </p>
              <TouchButton
                icon={Plus}
                onClick={handleNewReservation}
                variant="primary"
                size="lg"
              >
                Nueva Reserva
              </TouchButton>
            </div>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="space-y-3">
            {filteredReservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                onCall={handleCall}
                onMessage={handleMessage}
                onEdit={handleEdit}
                onConfirm={handleConfirm}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <Card padding="sm">
            {filteredReservations.map((reservation) => (
              <ReservationCardCompact
                key={reservation.id}
                reservation={reservation}
                onClick={handleViewDetails}
              />
            ))}
          </Card>
        )}
      </div>

      {/* FAB */}
      <FAB
        icon={Plus}
        onClick={handleNewReservation}
        position="bottom-right"
      />

      {/* Bottom Navigation */}
      <BottomNavigation onNewReservation={handleNewReservation} />
    </div>
  );
};

export default ReservasMobile;


