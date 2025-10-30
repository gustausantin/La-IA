import React from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { Clock, Copy, Plus, X } from 'lucide-react';

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export default function Step2Schedule() {
  const {
    businessHours,
    updateDayHours,
    applyToWeekdays,
    addTimeBlock,
    removeTimeBlock,
    updateTimeBlock
  } = useOnboardingStore();

  const handleToggleDay = (day) => {
    const currentDay = businessHours[day];
    updateDayHours(day, {
      ...currentDay,
      isOpen: !currentDay.isOpen
    });
  };

  const handleApplyToAll = () => {
    // Usar el horario del lunes como base
    const mondayHours = businessHours.monday;
    applyToWeekdays(mondayHours);
  };

  return (
    <div>
      {/* Título */}
      <div className="text-center mb-3">
        <div className="inline-flex p-2 bg-purple-100 rounded-full mb-2">
          <Clock className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          ¿Cuál es tu horario habitual?
        </h2>
        <p className="text-gray-600 text-xs">
          Define cuándo la IA puede ofrecer citas a tus clientes
        </p>
      </div>

      {/* Botón para aplicar a todos los laborables */}
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <button
          onClick={handleApplyToAll}
          className="flex items-center gap-2 text-xs font-medium text-purple-700 hover:text-purple-900 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          Aplicar horario de lunes a todos los días laborables
        </button>
      </div>

      {/* Lista de días */}
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = businessHours[key];
          
          // Migración automática de estructura antigua a nueva
          if (!day) return null;
          
          const timeBlocks = day.timeBlocks || (day.openTime ? [{ openTime: day.openTime, closeTime: day.closeTime }] : [{ openTime: '09:00', closeTime: '20:00' }]);
          const isOpen = day.isOpen !== undefined ? day.isOpen : true;
          
          return (
            <div
              key={key}
              className={`border-2 rounded-lg p-3 transition-all ${
                isOpen
                  ? 'border-purple-200 bg-purple-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Toggle y nombre del día */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => handleToggleDay(key)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    isOpen ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      isOpen ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="font-medium text-sm text-gray-900 min-w-[70px]">{label}</span>
              </div>

              {/* Bloques horarios */}
              {isOpen ? (
                <div className="space-y-1.5 ml-12">
                  {timeBlocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="flex items-center gap-1.5">
                      {/* Inputs de hora */}
                      <input
                        type="time"
                        value={block.openTime}
                        onChange={(e) => updateTimeBlock(key, blockIndex, 'openTime', e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs font-medium transition-all w-[85px]"
                      />
                      <span className="text-gray-400 text-xs">-</span>
                      <input
                        type="time"
                        value={block.closeTime}
                        onChange={(e) => updateTimeBlock(key, blockIndex, 'closeTime', e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs font-medium transition-all w-[85px]"
                      />
                      
                      {/* Botón eliminar bloque (solo si hay más de 1) */}
                      {timeBlocks.length > 1 && (
                        <button
                          onClick={() => removeTimeBlock(key, blockIndex)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar tramo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      {/* Botón añadir bloque (solo en el último) */}
                      {blockIndex === timeBlocks.length - 1 && timeBlocks.length < 3 && (
                        <button
                          onClick={() => addTimeBlock(key)}
                          className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                          title="Añadir tramo"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500 italic text-xs ml-12">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Microcopy informativo */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-gray-700 text-center">
          💡 <strong>¿Cierras para comer?</strong> Usa el botón <strong>+</strong> para añadir un segundo tramo horario (ej: 9-14h y 16-20h)
        </p>
      </div>
      
      <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-600 text-center">
          🏖️ No te preocupes por festivos o vacaciones. Podrás gestionarlo desde el Calendario.
        </p>
      </div>
    </div>
  );
}

