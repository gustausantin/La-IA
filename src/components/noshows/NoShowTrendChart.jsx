// NoShowTrendChart.jsx - Gráfico de Tendencias de No-Shows (30 días)
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Gráfico de líneas mostrando tendencias de no-shows detectados vs prevenidos
 * Últimos 30 días con métricas de éxito
 */
export default function NoShowTrendChart({ data, loading = false }) {
    if (loading) {
        return (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    📈 Tendencias (Últimos 30 días)
                </h3>
                <div className="h-64 flex items-center justify-center text-gray-500">
                    <p>No hay datos de tendencias disponibles</p>
                </div>
            </div>
        );
    }

    // Calcular métricas generales
    const totalDetected = data.reduce((sum, day) => sum + (day.detected || 0), 0);
    const totalPrevented = data.reduce((sum, day) => sum + (day.prevented || 0), 0);
    const avgSuccessRate = data.length > 0 
        ? (totalPrevented / Math.max(totalDetected, 1) * 100).toFixed(1)
        : 0;

    // Última semana vs semana anterior
    const lastWeek = data.slice(0, 7);
    const prevWeek = data.slice(7, 14);
    const lastWeekPrevented = lastWeek.reduce((sum, day) => sum + (day.prevented || 0), 0);
    const prevWeekPrevented = prevWeek.reduce((sum, day) => sum + (day.prevented || 0), 0);
    const weekTrend = lastWeekPrevented - prevWeekPrevented;

    // Formatear datos para el gráfico (invertir orden para mostrar más reciente a la derecha)
    const chartData = [...data].reverse().map(item => ({
        date: format(new Date(item.date), 'dd/MM', { locale: es }),
        dateTime: item.date,
        Detectados: item.detected || 0,
        Prevenidos: item.prevented || 0,
        'Tasa de Éxito': item.success_rate || 0
    }));

    // Tooltip personalizado
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white border-2 border-gray-300 rounded-lg p-3 shadow-lg">
                    <p className="font-bold text-gray-900 mb-2">{label}</p>
                    <p className="text-sm text-red-600">
                        🔴 Detectados: <strong>{data.Detectados}</strong>
                    </p>
                    <p className="text-sm text-green-600">
                        🟢 Prevenidos: <strong>{data.Prevenidos}</strong>
                    </p>
                    <p className="text-sm text-blue-600 mt-2">
                        📊 Tasa de éxito: <strong>{data['Tasa de Éxito']}%</strong>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
            {/* Header con métricas */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                        📈 Tendencias de No-Shows
                    </h3>
                    <p className="text-sm text-gray-600">Últimos 30 días</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {/* Total Detectados */}
                    <div className="text-right">
                        <p className="text-xs text-gray-600 uppercase">Detectados</p>
                        <p className="text-2xl font-bold text-red-600">{totalDetected}</p>
                    </div>

                    {/* Total Prevenidos */}
                    <div className="text-right">
                        <p className="text-xs text-gray-600 uppercase">Prevenidos</p>
                        <p className="text-2xl font-bold text-green-600">{totalPrevented}</p>
                    </div>

                    {/* Tasa Promedio */}
                    <div className="text-right">
                        <p className="text-xs text-gray-600 uppercase">Tasa Éxito</p>
                        <p className="text-2xl font-bold text-blue-600">{avgSuccessRate}%</p>
                    </div>
                </div>
            </div>

            {/* Tendencia semanal */}
            <div className={`
                mb-4 p-3 rounded-lg border-2
                ${weekTrend >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}
            `}>
                <div className="flex items-center gap-2">
                    {weekTrend >= 0 ? (
                        <>
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <p className="text-sm text-green-800">
                                <strong>+{weekTrend}</strong> no-shows prevenidos esta semana vs semana anterior
                            </p>
                        </>
                    ) : (
                        <>
                            <TrendingDown className="w-5 h-5 text-red-600" />
                            <p className="text-sm text-red-800">
                                <strong>{weekTrend}</strong> menos no-shows prevenidos esta semana vs semana anterior
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Gráfico */}
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                        dataKey="date" 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                        wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="Detectados" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="Prevenidos" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>

            {/* Tabla de últimos días */}
            <div className="mt-6 border-t-2 border-gray-200 pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">Últimos 7 días</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Día</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Detectados</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Prevenidos</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Tasa Éxito</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {data.slice(0, 7).map((day, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-900">
                                        {format(new Date(day.date), 'dd MMM yyyy', { locale: es })}
                                    </td>
                                    <td className="px-3 py-2 text-center text-red-600 font-semibold">
                                        {day.detected || 0}
                                    </td>
                                    <td className="px-3 py-2 text-center text-green-600 font-semibold">
                                        {day.prevented || 0}
                                    </td>
                                    <td className="px-3 py-2 text-center text-blue-600 font-semibold">
                                        {day.success_rate || 0}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

