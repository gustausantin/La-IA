// GoogleCalendarIntegration.jsx - UI para conectar Google Calendar
import React, { useState, useEffect } from 'react';
import { Calendar, Check, X, RefreshCw, AlertCircle, ExternalLink, Download, Upload } from 'lucide-react';
import GoogleCalendarService from '../../services/GoogleCalendarService';
import toast from 'react-hot-toast';

export default function GoogleCalendarIntegration({ businessId }) {
    const [isConnected, setIsConnected] = useState(false);
    const [integration, setIntegration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [stats, setStats] = useState(null);
    const [needsReconnect, setNeedsReconnect] = useState(false);

    // Cargar estado de conexión
    useEffect(() => {
        loadConnectionStatus();
        loadStats();
    }, [businessId]);

    const loadConnectionStatus = async () => {
        setLoading(true);
        const result = await GoogleCalendarService.isConnected(businessId);
        if (result.success) {
            setIsConnected(result.isConnected);
            setIntegration(result.integration);
            setNeedsReconnect(result.needsReconnect);
        }
        setLoading(false);
    };

    const loadStats = async () => {
        const result = await GoogleCalendarService.getSyncStats(businessId);
        if (result.success) {
            setStats(result.stats);
        }
    };

    const handleConnect = async () => {
        try {
            await GoogleCalendarService.connect(businessId);
            // La redirección a Google OAuth ocurre automáticamente
        } catch (error) {
            toast.error('Error al conectar con Google Calendar');
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('¿Seguro que quieres desconectar Google Calendar?')) {
            return;
        }

        const result = await GoogleCalendarService.disconnect(businessId);
        if (result.success) {
            toast.success('Google Calendar desconectado');
            setIsConnected(false);
            setIntegration(null);
        } else {
            toast.error('Error al desconectar');
        }
    };

    const handleSync = async (direction = 'both') => {
        setSyncing(true);
        const result = await GoogleCalendarService.sync(businessId, { direction });
        setSyncing(false);

        if (result.success) {
            const { imported = 0, exported = 0 } = result.data || {};
            toast.success(
                `Sincronización completada:\n` +
                `📥 ${imported} eventos importados\n` +
                `📤 ${exported} eventos exportados`
            );
            loadStats();
        } else {
            toast.error('Error en la sincronización');
        }
    };

    const handleEnableAutoSync = async () => {
        const result = await GoogleCalendarService.enableAutoSync(businessId, 15);
        if (result.success) {
            toast.success('Sincronización automática activada (cada 15 min)');
            loadConnectionStatus();
        } else {
            toast.error('Error al activar auto-sync');
        }
    };

    const handleDisableAutoSync = async () => {
        const result = await GoogleCalendarService.disableAutoSync(businessId);
        if (result.success) {
            toast.success('Sincronización automática desactivada');
            loadConnectionStatus();
        } else {
            toast.error('Error al desactivar auto-sync');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header con estado */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isConnected ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                        <Calendar className={`w-6 h-6 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">Google Calendar</h3>
                        <p className="text-sm text-gray-600">
                            {isConnected 
                                ? '✅ Conectado y sincronizando' 
                                : '⭕ No conectado'
                            }
                        </p>
                    </div>
                </div>

                {/* Botón principal */}
                {!isConnected ? (
                    <button
                        onClick={handleConnect}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
                    >
                        <Calendar className="w-5 h-5" />
                        Conectar Google Calendar
                    </button>
                ) : (
                    <button
                        onClick={handleDisconnect}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Alerta si necesita reconectar */}
            {needsReconnect && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-900">Reconexión necesaria</p>
                            <p className="text-sm text-amber-700 mt-1">
                                Tu token de acceso ha expirado. Por favor, reconecta Google Calendar.
                            </p>
                            <button
                                onClick={handleConnect}
                                className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                            >
                                Reconectar ahora
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel de sincronización */}
            {isConnected && !needsReconnect && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-6">
                    {/* Estadísticas */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                                <p className="text-xs text-gray-600 mt-1">Total eventos</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <p className="text-2xl font-bold text-green-600">{stats.synced}</p>
                                <p className="text-xs text-gray-600 mt-1">Sincronizados</p>
                            </div>
                            <div className="text-center p-4 bg-amber-50 rounded-lg">
                                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                                <p className="text-xs text-gray-600 mt-1">Pendientes</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                                <p className="text-xs text-gray-600 mt-1">Con errores</p>
                            </div>
                        </div>
                    )}

                    {/* Última sincronización */}
                    {stats?.lastSync && (
                        <div className="text-center text-sm text-gray-600">
                            Última sincronización: {new Date(stats.lastSync).toLocaleString('es-ES')}
                        </div>
                    )}

                    {/* Acciones de sincronización */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Sincronización manual</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button
                                onClick={() => handleSync('both')}
                                disabled={syncing}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {syncing ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-5 h-5" />
                                )}
                                Sincronizar todo
                            </button>
                            <button
                                onClick={() => handleSync('import')}
                                disabled={syncing}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                <Download className="w-5 h-5" />
                                Importar
                            </button>
                            <button
                                onClick={() => handleSync('export')}
                                disabled={syncing}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                                <Upload className="w-5 h-5" />
                                Exportar
                            </button>
                        </div>
                    </div>

                    {/* Auto-sync */}
                    <div className="pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-gray-900">Sincronización automática</h4>
                                <p className="text-sm text-gray-600 mt-1">
                                    Sincroniza cambios cada 15 minutos automáticamente
                                </p>
                            </div>
                            <button
                                onClick={integration?.metadata?.autoSync ? handleDisableAutoSync : handleEnableAutoSync}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    integration?.metadata?.autoSync
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {integration?.metadata?.autoSync ? 'Activado ✓' : 'Desactivado'}
                            </button>
                        </div>
                    </div>

                    {/* Info adicional */}
                    <div className="pt-6 border-t border-gray-200">
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-900">
                                    <p className="font-semibold mb-2">¿Cómo funciona?</p>
                                    <ul className="space-y-1 text-blue-800">
                                        <li>• <strong>Importar:</strong> Trae eventos de Google Calendar a LA-IA</li>
                                        <li>• <strong>Exportar:</strong> Envía citas de LA-IA a Google Calendar</li>
                                        <li>• <strong>Sincronizar todo:</strong> Hace ambas cosas a la vez</li>
                                        <li>• Los eventos se sincronizan en tiempo real si activas auto-sync</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Info de Google Calendar */}
            {!isConnected && (
                <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-3">¿Por qué conectar Google Calendar?</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <span>Sincroniza automáticamente tus citas entre ambas plataformas</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <span>Evita reservas duplicadas y conflictos de horario</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <span>Accede a tus citas desde cualquier dispositivo</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <span>Recibe notificaciones de Google en tu móvil</span>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

