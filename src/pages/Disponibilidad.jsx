// Disponibilidad.jsx - Página temporal para gestión de disponibilidades
// Esta página será removida una vez que se confíe en la lógica y métricas

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AvailabilityManager from '../components/AvailabilityManager';

export default function Disponibilidad() {
    const location = useLocation();
    const [autoTriggerRegeneration, setAutoTriggerRegeneration] = useState(false);

    // 🚨 Auto-trigger regeneración si viene desde el modal de regeneración
    useEffect(() => {
        if (location.state?.autoOpenAvailability) {
            setAutoTriggerRegeneration(true);
            // Limpiar el state para que no se repita
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                            Gestión de Disponibilidades
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 mt-1">
                            Configura y gestiona los horarios disponibles para reservas
                        </p>
                    </div>
                </div>
            </div>

            {/* AvailabilityManager */}
            <AvailabilityManager autoTriggerRegeneration={autoTriggerRegeneration} />
        </div>
    );
}

