import React from 'react';
import { BarChart3, Users, Clock, DollarSign, TrendingUp, Award } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const OccupancyMetrics = ({ metrics, date, totalReservations }) => {
    if (!metrics) return null;

    const formattedDate = format(date, "EEEE d 'de' MMMM, yyyy", { locale: es });

    return (
        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg p-2 text-white shadow-md">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Dashboard de Ocupación
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {/* Tasa de Ocupación */}
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded flex items-center justify-between hover:bg-white/20 transition-colors">
                    <div>
                        <p className="text-xs text-purple-100">Ocupación</p>
                        <p className="text-base font-bold">{metrics.occupancyRate}%</p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-purple-200" />
                </div>

                {/* Slots Reservados */}
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded flex items-center justify-between hover:bg-white/20 transition-colors">
                    <div>
                        <p className="text-xs text-purple-100">Reservados</p>
                        <p className="text-base font-bold">{metrics.reservedSlots}</p>
                        <p className="text-[10px] text-purple-200">de {metrics.totalSlots} slots</p>
                    </div>
                    <Users className="w-4 h-4 text-purple-200" />
                </div>

                {/* Hora Pico */}
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded flex items-center justify-between hover:bg-white/20 transition-colors">
                    <div>
                        <p className="text-xs text-purple-100">Hora Pico</p>
                        <p className="text-base font-bold">{metrics.peakHour}</p>
                    </div>
                    <Clock className="w-4 h-4 text-purple-200" />
                </div>

                {/* Revenue Estimado */}
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded flex items-center justify-between hover:bg-white/20 transition-colors">
                    <div>
                        <p className="text-xs text-purple-100">Revenue Est.</p>
                        <p className="text-base font-bold">{metrics.estimatedRevenue}€</p>
                    </div>
                    <DollarSign className="w-4 h-4 text-purple-200" />
                </div>

                {/* Top Mesa */}
                <div className="bg-white/10 backdrop-blur-sm p-2 rounded flex items-center justify-between hover:bg-white/20 transition-colors">
                    <div>
                        <p className="text-xs text-purple-100">Top Mesa</p>
                        <p className="text-sm font-bold truncate">
                            {metrics.tableStats?.[0]?.tableName || 'N/A'}
                        </p>
                        <p className="text-[10px] text-purple-200">
                            {metrics.tableStats?.[0]?.occupancyRate?.toFixed(0) || '0'}% ocupada
                        </p>
                    </div>
                    <Award className="w-4 h-4 text-purple-200" />
                </div>
            </div>

            {/* Insight Compacto */}
            <div className="mt-2 p-2 bg-white/10 backdrop-blur-sm rounded border border-white/20">
                <div className="flex items-start gap-1.5">
                    <div className="p-1 bg-white/20 rounded">
                        <TrendingUp className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-white text-[10px]">💡 Insight IA</h4>
                        <p className="text-[10px] text-purple-100 leading-tight">
                            {metrics.occupancyRate > 80 
                                ? "🔥 Alta ocupación. Considera overbooking controlado."
                                : metrics.occupancyRate > 50
                                ? "📊 Ocupación moderada. Momento para captación."
                                : "⚠️ Ocupación baja. Activa estrategias de marketing."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
