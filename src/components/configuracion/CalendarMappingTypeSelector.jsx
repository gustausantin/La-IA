// CalendarMappingTypeSelector.jsx - Selección previa: ¿Por trabajador o por recurso?
import React, { useState } from 'react';
import { Users, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CalendarMappingTypeSelector({ 
    onSelect 
}) {
    const [selectedType, setSelectedType] = useState(null);

    const handleSelect = (type) => {
        setSelectedType(type);
    };

    const handleConfirm = () => {
        if (!selectedType) {
            toast.error('Por favor, selecciona una opción');
            return;
        }
        onSelect(selectedType);
    };

    return (
        <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3 mb-6">
                <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2 text-lg">
                        ¿Cómo quieres configurar los calendarios?
                    </h4>
                    <p className="text-sm text-gray-600">
                        Selecciona cómo están organizados tus calendarios en Google Calendar para vincularlos correctamente.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Opción 1: Por Trabajador */}
                <button
                    onClick={() => handleSelect('employee')}
                    className={`p-5 rounded-lg border-2 transition-all text-left ${
                        selectedType === 'employee'
                            ? 'border-blue-600 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                            selectedType === 'employee' ? 'bg-blue-600' : 'bg-gray-100'
                        }`}>
                            <Users className={`w-6 h-6 ${
                                selectedType === 'employee' ? 'text-white' : 'text-gray-600'
                            }`} />
                        </div>
                        <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 mb-2">
                                Por Trabajador
                            </h5>
                            <p className="text-sm text-gray-600 mb-3">
                                Cada calendario corresponde a un trabajador específico (ej: "María", "Andrés").
                            </p>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>✓ Ideal si cada trabajador tiene su propio calendario</p>
                                <p>✓ Asignación directa trabajador → calendario</p>
                            </div>
                        </div>
                        {selectedType === 'employee' && (
                            <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
                        )}
                    </div>
                </button>

                {/* Opción 2: Por Recurso */}
                <button
                    onClick={() => handleSelect('resource')}
                    className={`p-5 rounded-lg border-2 transition-all text-left ${
                        selectedType === 'resource'
                            ? 'border-purple-600 bg-purple-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                            selectedType === 'resource' ? 'bg-purple-600' : 'bg-gray-100'
                        }`}>
                            <Package className={`w-6 h-6 ${
                                selectedType === 'resource' ? 'text-white' : 'text-gray-600'
                            }`} />
                        </div>
                        <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 mb-2">
                                Por Recurso
                            </h5>
                            <p className="text-sm text-gray-600 mb-3">
                                Cada calendario corresponde a un recurso físico (ej: "Silla 1", "Silla 2").
                            </p>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>✓ Ideal si organizas por recursos compartidos</p>
                                <p>✓ El sistema asignará trabajadores por horario</p>
                            </div>
                        </div>
                        {selectedType === 'resource' && (
                            <CheckCircle2 className="w-6 h-6 text-purple-600 flex-shrink-0" />
                        )}
                    </div>
                </button>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleConfirm}
                    disabled={!selectedType}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    Continuar con esta opción
                </button>
            </div>
        </div>
    );
}

