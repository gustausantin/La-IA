import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { useOnboardingStore } from '../../stores/onboardingStore';
import toast from 'react-hot-toast';
import {
  Heart, Sparkles, Scissors, Dumbbell, Flower2, 
  Brain, PawPrint, Activity, X, Check,
  HeartPulse, Sunrise, Smile, Clock, Users,
  Phone, MessageCircle, CheckCircle2, Play, Volume2,
  ChevronRight, ChevronLeft, Loader2
} from 'lucide-react';
import { getVerticalOnboardingConfig, createBusinessWithOnboarding } from '../../services/onboardingService';

// Componentes de cada paso (NUEVO FLUJO DE 4 PASOS)
import Step1Identity from './steps/Step1Identity';
import Step2Assistant from './steps/Step2Assistant';
import Step3DemoInteractiva from './steps/Step3DemoInteractiva';
import Step4GoToApp from './steps/Step4GoToApp';

// 🔟 Verticales para autónomos profesionales con iconos modernos
const VERTICALS = [
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    icon: HeartPulse,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-400 hover:shadow-blue-200',
    description: 'Terapia física y rehabilitación profesional',
  },
  {
    id: 'masajes_osteopatia',
    name: 'Masajes / Osteopatía',
    icon: Sparkles,
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:border-purple-400 hover:shadow-purple-200',
    description: 'Bienestar y tratamientos terapéuticos',
  },
  {
    id: 'clinica_dental',
    name: 'Clínica Dental',
    icon: Smile,
    color: 'from-cyan-500 to-cyan-600',
    bgColor: 'bg-gradient-to-br from-cyan-50 to-cyan-100',
    borderColor: 'border-cyan-200',
    hoverColor: 'hover:border-cyan-400 hover:shadow-cyan-200',
    description: 'Cuidado dental y sonrisas saludables',
  },
  {
    id: 'psicologia_coaching',
    name: 'Psicología / Coaching',
    icon: Brain,
    color: 'from-indigo-500 to-indigo-600',
    bgColor: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
    borderColor: 'border-indigo-200',
    hoverColor: 'hover:border-indigo-400 hover:shadow-indigo-200',
    description: 'Salud mental y desarrollo personal',
  },
  {
    id: 'centro_estetica',
    name: 'Centro de Estética',
    icon: Flower2,
    color: 'from-pink-500 to-pink-600',
    bgColor: 'bg-gradient-to-br from-pink-50 to-pink-100',
    borderColor: 'border-pink-200',
    hoverColor: 'hover:border-pink-400 hover:shadow-pink-200',
    description: 'Belleza y cuidado personal profesional',
  },
  {
    id: 'peluqueria_barberia',
    name: 'Peluquería / Barbería',
    icon: Scissors,
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100',
    borderColor: 'border-orange-200',
    hoverColor: 'hover:border-orange-400 hover:shadow-orange-200',
    description: 'Estilo y cuidado capilar de calidad',
  },
  {
    id: 'centro_unas',
    name: 'Centro de Uñas',
    icon: Heart,
    color: 'from-red-500 to-red-600',
    bgColor: 'bg-gradient-to-br from-red-50 to-red-100',
    borderColor: 'border-red-200',
    hoverColor: 'hover:border-red-400 hover:shadow-red-200',
    description: 'Manicura y pedicura especializada',
  },
  {
    id: 'entrenador_personal',
    name: 'Entrenador Personal',
    icon: Dumbbell,
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
    borderColor: 'border-green-200',
    hoverColor: 'hover:border-green-400 hover:shadow-green-200',
    description: 'Fitness personalizado y resultados',
  },
  {
    id: 'yoga_pilates',
    name: 'Yoga / Pilates',
    icon: Sunrise,
    color: 'from-teal-500 to-teal-600',
    bgColor: 'bg-gradient-to-br from-teal-50 to-teal-100',
    borderColor: 'border-teal-200',
    hoverColor: 'hover:border-teal-400 hover:shadow-teal-200',
    description: 'Equilibrio, flexibilidad y mindfulness',
  },
  {
    id: 'veterinario',
    name: 'Veterinario',
    icon: PawPrint,
    color: 'from-amber-500 to-amber-600',
    bgColor: 'bg-gradient-to-br from-amber-50 to-amber-100',
    borderColor: 'border-amber-200',
    hoverColor: 'hover:border-amber-400 hover:shadow-amber-200',
    description: 'Cuidado veterinario de confianza',
  }
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, fetchBusinessInfo } = useAuthContext();
  
  // Store de onboarding
  const {
    currentStep,
    isLoading,
    error,
    setStep,
    nextStep,
    prevStep,
    setLoading,
    setError,
    clearError,
    isStepValid,
    getAllData,
    reset
  } = useOnboardingStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    reset(); // Limpiar estado del onboarding
    window.location.href = '/login';
  };

  // Renderizar el paso actual (4 pasos)
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Identity verticals={VERTICALS} />;
      case 2:
        return <Step2Assistant />;
      case 3:
        return <Step3DemoInteractiva />;
      case 4:
        return <Step4GoToApp />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-2 sm:p-4">
      <div className="max-w-3xl w-full">
        {/* Botón de Logout mejorado */}
        <div className="flex justify-end mb-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all shadow-sm active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
        
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6 px-2">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent mb-2">
            ¡Bienvenido a La-IA! 🎉
          </h1>
          <p className="text-sm text-gray-600 font-medium">
            Tu demo personalizada en solo 4 pasos
          </p>
        </div>

        {/* Progress Bar - 4 pasos */}
        <div className="mb-4 px-2">
          <div className="flex items-center justify-center gap-1.5 max-w-xl mx-auto">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-full h-2 rounded-full transition-all duration-500 ${
                  currentStep >= s 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600' 
                    : 'bg-gray-200'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full -mt-0.5 transition-all duration-500 ${
                    currentStep >= s 
                      ? 'bg-white border-2 border-purple-600 shadow-md' 
                      : 'bg-gray-300'
                  }`} />
                </div>
                {s < 4 && <div className="w-0.5" />}
              </div>
            ))}
          </div>
          <div className="flex justify-center items-center gap-2 mt-2.5">
            <div className="text-[10px] sm:text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
              Paso {currentStep} de 4
            </div>
          </div>
        </div>

        {/* Contenido según paso */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-5">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {renderStep()}
                </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 px-2">
          {currentStep > 1 && (
                <button
              onClick={prevStep}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
                  Atrás
                </button>
          )}
          
          {currentStep < 4 && (
                <button
              onClick={nextStep}
              disabled={isLoading || !isStepValid(currentStep)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando...
                    </>
                  ) : (
                <>
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </>
                  )}
                </button>
          )}
        </div>
      </div>
    </div>
  );
}
