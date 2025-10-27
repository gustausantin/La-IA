// ReservationCard.jsx - Card de reserva optimizado para móvil
import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Phone,
  MessageSquare,
  Clock,
  Users,
  MapPin,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import Card, { CardHeader, CardFooter } from './Card';
import TouchButton, { IconButton } from './TouchButton';
import { useSwipe } from '../../hooks/useGestures';

const STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    color: 'bg-yellow-100 text-yellow-800',
    icon: AlertCircle,
  },
  confirmed: {
    label: 'Confirmada',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelada',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
  completed: {
    label: 'Completada',
    color: 'bg-gray-100 text-gray-800',
    icon: CheckCircle2,
  },
  no_show: {
    label: 'No Show',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
};

const ReservationCard = ({
  reservation,
  onCall,
  onMessage,
  onEdit,
  onCancel,
  onConfirm,
  onViewDetails,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      setSwipeOffset(-80);
      setShowActions(true);
    },
    onSwipeRight: () => {
      setSwipeOffset(0);
      setShowActions(false);
    },
  });

  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const formattedDate = format(parseISO(reservation.date || reservation.reservation_date), 'PPp', { locale: es });
  const formattedTime = format(parseISO(reservation.date || reservation.reservation_date), 'HH:mm');

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons (revealed on swipe) */}
      {showActions && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-2 px-2 bg-gradient-to-l from-gray-50">
          {reservation.status === 'pending' && onConfirm && (
            <IconButton
              icon={CheckCircle2}
              onClick={() => {
                onConfirm(reservation);
                setShowActions(false);
                setSwipeOffset(0);
              }}
              variant="success"
              size="md"
            />
          )}
          {onEdit && (
            <IconButton
              icon={MoreVertical}
              onClick={() => {
                onEdit(reservation);
                setShowActions(false);
                setSwipeOffset(0);
              }}
              variant="ghost"
              size="md"
            />
          )}
        </div>
      )}

      {/* Main card */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: 'transform 0.3s ease',
        }}
        {...swipeHandlers}
      >
        <Card
          onClick={() => onViewDetails?.(reservation)}
          interactive
          padding="md"
          className="mb-3"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {reservation.customer_name || 'Sin nombre'}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig.label}
                </span>
              </div>
            </div>
            <IconButton
              icon={MoreVertical}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(reservation);
              }}
              variant="ghost"
              size="sm"
            />
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{formattedDate}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{formattedTime}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{reservation.party_size || reservation.people_count} personas</span>
            </div>

            {reservation.table_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{reservation.table_name}</span>
              </div>
            )}

            {reservation.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 mt-2">
                {reservation.notes}
              </p>
            )}
          </div>

          {/* Actions */}
          <CardFooter>
            <TouchButton
              icon={Phone}
              onClick={(e) => {
                e.stopPropagation();
                onCall?.(reservation);
              }}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Llamar
            </TouchButton>
            <TouchButton
              icon={MessageSquare}
              onClick={(e) => {
                e.stopPropagation();
                onMessage?.(reservation);
              }}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Mensaje
            </TouchButton>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

// Compact version for lists
export const ReservationCardCompact = ({ reservation, onClick }) => {
  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const time = format(parseISO(reservation.date || reservation.reservation_date), 'HH:mm');

  return (
    <div
      onClick={() => onClick?.(reservation)}
      className="flex items-center gap-3 p-3 bg-white border-b border-gray-100 active:bg-gray-50 transition-colors"
    >
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
          <span className="text-lg font-bold text-purple-600">
            {(reservation.customer_name || '?')[0].toUpperCase()}
          </span>
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {reservation.customer_name || 'Sin nombre'}
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
          <span className="font-medium">{time}</span>
          <span>•</span>
          <span>{reservation.party_size || reservation.people_count}p</span>
        </div>
      </div>
      
      <div className="flex-shrink-0">
        <StatusIcon className={`w-5 h-5 ${statusConfig.color.split(' ')[1]}`} />
      </div>
    </div>
  );
};

export default ReservationCard;

