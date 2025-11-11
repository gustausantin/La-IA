// ====================================
// COPILOT BANNER - "Completa tu configuración"
// Guía paso a paso post-onboarding
// ====================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Package, Phone, CheckCircle2 } from 'lucide-react';

const COPILOT_STEPS = [
  {
    id: 1,
    title: 'Configura tu Equipo y Horarios',
    description: 'Añade profesionales y define sus turnos',
    icon: Users,
    url: '/copilot/equipo',
    color: 'purple'
  },
  {
    id: 2,
    title: 'Configura tus Servicios',
    description: 'Define qué ofreces y tus precios',
    icon: Package,
    url: '/copilot/servicios',
    color: 'blue'
  },
  {
    id: 3,
    title: 'Conecta tu Teléfono y Activa',
    description: 'Desvío de llamadas y activar asistente',
    icon: Phone,
    url: '/copilot/activar',
    color: 'green'
  }
];

export default function CopilotBanner({ currentStep = 0, onContinue }) {
  const navigate = useNavigate();
  const percentage = Math.round((currentStep / COPILOT_STEPS.length) * 100);
  
  // Si ya completó todos los pasos, no mostrar banner
  if (currentStep >= COPILOT_STEPS.length) {
    return null;
  }

  const nextStep = COPILOT_STEPS[currentStep];
  const Icon = nextStep.icon;

  const colorClasses = {
    purple: {
      bg: 'from-purple-50 via-blue-50 to-indigo-50',
      border: 'border-purple-200',
      iconBg: 'from-purple-600 to-blue-600',
      progressBg: 'from-purple-600 to-blue-600',
      button: 'from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
    },
    blue: {
      bg: 'from-blue-50 via-indigo-50 to-blue-50',
      border: 'border-blue-200',
      iconBg: 'from-blue-600 to-indigo-600',
      progressBg: 'from-blue-600 to-indigo-600',
      button: 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
    },
    green: {
      bg: 'from-green-50 via-emerald-50 to-green-50',
      border: 'border-green-200',
      iconBg: 'from-green-600 to-emerald-600',
      progressBg: 'from-green-600 to-emerald-600',
      button: 'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
    }
  };

  const colors = colorClasses[nextStep.color];

  return (
    <div className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-4 sm:p-5 shadow-sm`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icono y número de paso */}
        <div className="flex-shrink-0">
          <div className={`w-14 h-14 bg-gradient-to-br ${colors.iconBg} rounded-xl flex items-center justify-center shadow-lg relative`}>
            <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-900 shadow-md">
              {nextStep.id}
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-bold text-gray-900">
              📋 Completa tu configuración ({percentage}%)
            </h3>
          </div>
          
          {/* Barra de progreso */}
          <div className="w-full h-2 bg-white/70 rounded-full mb-3 overflow-hidden shadow-inner">
            <div 
              className={`h-full bg-gradient-to-r ${colors.progressBg} rounded-full transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="text-sm text-gray-700 mb-1 font-semibold">
            ⏩ Siguiente: {nextStep.title}
          </p>
          <p className="text-xs text-gray-600">
            {nextStep.description}
          </p>
        </div>

        {/* Botón de acción */}
        <div className="flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={() => onContinue ? onContinue(nextStep) : navigate(nextStep.url)}
            className={`w-full sm:w-auto px-5 py-3 bg-gradient-to-r ${colors.button} text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 hover:shadow-xl hover:-translate-y-0.5 active:scale-95`}
          >
            Continuar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mini-preview de los pasos */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-3">
          {COPILOT_STEPS.map((step) => {
            const StepIcon = step.icon;
            const isCompleted = step.id <= currentStep;
            const isCurrent = step.id === currentStep + 1;
            
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div className={`relative ${isCurrent ? 'scale-110' : ''} transition-transform`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-500' 
                      : isCurrent 
                      ? `bg-gradient-to-br ${colorClasses[step.color].iconBg}` 
                      : 'bg-gray-200'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.5} />
                    ) : (
                      <StepIcon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                    )}
                  </div>
                  {isCurrent && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-purple-600 animate-pulse" />
                  )}
                </div>
                {step.id < COPILOT_STEPS.length && (
                  <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



