// WaitlistModal.jsx - Modal para agregar clientes a lista de espera
import React, { useState } from 'react';
import { X, Clock, User, Phone, Mail, Calendar, AlertCircle } from 'lucide-react';
import WaitlistService from '../../services/WaitlistService';

export default function WaitlistModal({
    isOpen,
    onClose,
    businessId,
    prefilledData = {},
    onSuccess = () => {}
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        customerName: prefilledData.customerName || '',
        customerPhone: prefilledData.customerPhone || '',
        customerEmail: prefilledData.customerEmail || '',
        serviceName: prefilledData.serviceName || '',
        preferredDate: prefilledData.preferredDate || '',
        preferredTime: prefilledData.preferredTime || '',
        flexibleTime: true,
        priority: 3,
        notes: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await WaitlistService.addToWaitlist({
                businessId,
                ...formData
            });

            if (result.success) {
                alert('✅ Cliente agregado a la lista de espera');
                onSuccess(result.data);
                onClose();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error al agregar a waitlist:', error);
            alert('❌ Error al agregar cliente a lista de espera');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Lista de Espera</h2>
                                <p className="text-sm text-white/80">
                                    Agregar cliente cuando el calendario está lleno
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Alert Info */}
                <div className="p-6 bg-blue-50 border-b border-blue-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900">
                            <p className="font-semibold mb-1">¿Qué es la lista de espera?</p>
                            <p className="text-blue-700">
                                Cuando el calendario está lleno, puedes agregar clientes a la lista de espera. 
                                Se les notificará automáticamente si se cancela una cita en su fecha/hora preferida.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Información del cliente */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <User className="w-5 h-5 text-purple-600" />
                            Información del Cliente
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre completo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Ej: María García"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Teléfono *
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.customerPhone}
                                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="+34 600 000 000"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email (opcional)
                                </label>
                                <input
                                    type="email"
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="cliente@email.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Servicio solicitado */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-purple-600" />
                            Servicio y Fecha Preferida
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Servicio solicitado *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.serviceName}
                                    onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Ej: Corte de pelo"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha preferida *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.preferredDate}
                                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hora preferida (opcional)
                                </label>
                                <input
                                    type="time"
                                    value={formData.preferredTime}
                                    onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Opciones adicionales */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3">Opciones</h3>
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.flexibleTime}
                                    onChange={(e) => setFormData({ ...formData, flexibleTime: e.target.checked })}
                                    className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                                <div>
                                    <p className="font-medium text-gray-900">Flexible con la hora</p>
                                    <p className="text-sm text-gray-600">
                                        El cliente acepta otras horas disponibles del mismo día
                                    </p>
                                </div>
                            </label>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Prioridad
                                </label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="1">🔴 Alta (VIP/Urgente)</option>
                                    <option value="2">🟡 Media-Alta</option>
                                    <option value="3">🟢 Normal</option>
                                    <option value="4">🔵 Media-Baja</option>
                                    <option value="5">⚪ Baja</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notas adicionales
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    rows="3"
                                    placeholder="Cualquier información adicional..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Agregando...' : '✅ Agregar a Lista de Espera'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

