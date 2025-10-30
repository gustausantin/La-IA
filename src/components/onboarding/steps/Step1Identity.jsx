import React, { useState } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';

/**
 * PASO 1: IDENTIDAD RÁPIDA
 * Solo 2 cosas: Vertical + Nombre del negocio
 * Objetivo: Rápido, sin fricción, personalizar la demo
 */
export default function Step1Identity({ verticals }) {
  const {
    businessName,
    selectedVertical,
    setBusinessName,
    setSelectedVertical,
    setDemoConfig
  } = useOnboardingStore();

  const [localLoading, setLocalLoading] = useState(false);

  // Mapping de servicios por defecto para la demo
  const DEMO_SERVICES = {
    fisioterapia: { name: 'Sesión Fisioterapia', duration: 45 },
    masajes_osteopatia: { name: 'Masaje Relajante', duration: 60 },
    clinica_dental: { name: 'Revisión General', duration: 30 },
    psicologia_coaching: { name: 'Primera Sesión', duration: 60 },
    centro_estetica: { name: 'Limpieza Facial', duration: 60 },
    peluqueria_barberia: { name: 'Corte y Peinado', duration: 30 },
    centro_unas: { name: 'Manicura', duration: 30 },
    entrenador_personal: { name: 'Sesión Personal', duration: 60 },
    yoga_pilates: { name: 'Clase de Yoga', duration: 60 },
    veterinario: { name: 'Consulta General', duration: 30 }
  };

  const handleSelectVertical = async (vertical) => {
    setLocalLoading(true);
    setSelectedVertical(vertical);

    // Configurar servicio por defecto para la demo
    const demoService = DEMO_SERVICES[vertical.id] || { name: 'Servicio', duration: 60 };
    setDemoConfig({
      defaultServiceName: demoService.name,
      defaultServiceDuration: demoService.duration,
      serviceIcon: vertical.icon
    });

    toast.success(`¡${vertical.name} seleccionado!`);
    setLocalLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Título Principal */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-3">
          <Sparkles className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1.5">
          ¡Bienvenido! Prepara tu demo en 2 minutos
        </h2>
        <p className="text-gray-600 text-xs">
          Dinos solo dos cosas para personalizar tu prueba
        </p>
      </div>

      {/* SECCIÓN 1: Selección de Vertical */}
      {!selectedVertical ? (
        <div>
          <h3 className="text-base font-bold text-gray-900 mb-2">
            1. Elige tu sector:
          </h3>

          {localLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
              <p className="text-gray-600 text-sm font-medium">Preparando tu demo...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {verticals.map((vertical) => {
                const Icon = vertical.icon;

                return (
                  <button
                    key={vertical.id}
                    onClick={() => handleSelectVertical(vertical)}
                    disabled={localLoading}
                    className={`group relative overflow-hidden ${vertical.bgColor} ${vertical.borderColor} border rounded-lg p-3 transition-all duration-300 ${vertical.hoverColor} hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-left`}
                  >
                    {/* Gradiente de fondo sutil */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="relative">
                      {/* Icono con gradiente */}
                      <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${vertical.color} shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 mb-2`}>
                        <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      
                      {/* Título */}
                      <h3 className="text-sm font-bold text-gray-900 mb-0.5 group-hover:text-gray-900 leading-tight">
                        {vertical.name}
                      </h3>
                      
                      {/* Descripción */}
                      <p className="text-[10px] text-gray-600 leading-snug line-clamp-2">
                        {vertical.description}
                      </p>
                    </div>

                    {/* Indicador de selección */}
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full border border-gray-300 group-hover:border-purple-500 group-hover:bg-purple-500 transition-all duration-300 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SECCIÓN 2: Formulario con Vertical Seleccionado */
        <div className="space-y-4">
          {/* Mostrar el vertical seleccionado */}
          <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-300 rounded-lg flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${selectedVertical.color} shadow-sm`}>
              {typeof selectedVertical.icon === 'function' ? (
                <selectedVertical.icon className="w-5 h-5 text-white" strokeWidth={2.5} />
              ) : (
                <div className="w-5 h-5 bg-white rounded" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-purple-700 font-medium">Sector seleccionado:</p>
              <p className="text-sm font-bold text-gray-900">{selectedVertical.name}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>

          {/* Nombre del negocio */}
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-2">
              2. ¿Cómo se llama tu negocio?
            </h3>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Peluquería Estilo Propio"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm font-medium placeholder:text-gray-400"
              autoFocus
            />
            <p className="mt-1.5 text-[10px] text-gray-500">
              💡 Este nombre se usará en la demo de tu asistente
            </p>
          </div>

          {/* Advertencia si falta el nombre */}
          {businessName.trim().length < 3 && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-[10px] text-amber-800 text-center font-medium">
                ⚠️ Por favor, escribe el nombre de tu negocio (mínimo 3 caracteres)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

