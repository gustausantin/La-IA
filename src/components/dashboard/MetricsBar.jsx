import React from 'react';
import { DollarSign, Calendar, Star, AlertTriangle } from 'lucide-react';

/**
 * MetricsBar - La Salud del Negocio
 * Barra compacta con 4 KPIs críticos
 */

const MetricItem = ({ icon: Icon, value, label, alert = false }) => (
  <div className={`
    flex flex-col items-center justify-center p-3 sm:p-4 flex-1 
    ${alert ? 'text-red-600 bg-red-50' : 'text-gray-700'}
    transition-colors duration-200
  `}>
    <div className="flex items-center gap-1.5 mb-2 opacity-70">
      <Icon size={16} className={alert ? 'text-red-600' : 'text-gray-500'} />
      <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider">
        {label}
      </span>
    </div>
    <span className={`
      text-xl sm:text-2xl font-bold leading-none
      ${alert ? 'text-red-700' : 'text-gray-900'}
    `}>
      {value}
    </span>
  </div>
);

const MetricsBar = ({ 
  caja = 0, 
  citas = 0, 
  vip = 0, 
  riesgo = 0 
}) => {
  return (
    <div className="grid grid-cols-4 divide-x divide-gray-200 bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <MetricItem 
        icon={DollarSign} 
        value={`${caja}€`} 
        label="Caja" 
      />
      <MetricItem 
        icon={Calendar} 
        value={citas} 
        label="Citas" 
      />
      <MetricItem 
        icon={Star} 
        value={vip} 
        label="VIP" 
      />
      <MetricItem 
        icon={AlertTriangle} 
        value={riesgo} 
        label="Riesgo" 
        alert={riesgo > 0} 
      />
    </div>
  );
};

export default MetricsBar;

