import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { log } from '../utils/logger.js';

/**
 * Store para el flujo de onboarding de 4 PASOS (WOW-First)
 * Filosofía: Gancho rápido → Demo → Dashboard con Copilot
 */
export const useOnboardingStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === ESTADO GENERAL ===
        currentStep: 1,
        isLoading: false,
        error: null,
        
        // === PASO 1: IDENTIDAD RÁPIDA ===
        selectedVertical: null, // { id, name, icon, color, ... }
        businessName: '',
        
        // Configuración de demo (se carga al seleccionar vertical)
        demoConfig: {
          defaultServiceName: '',
          defaultServiceDuration: 60,
          serviceIcon: null
        },
        
        // === PASO 2: PERSONALIDAD DEL ASISTENTE ===
        assistantName: '',
        assistantVoice: null, // ID de ElevenLabs
        
        // === PASO 3: DEMO INTERACTIVA ===
        demo: {
          slots: {}, // { "10:00": "libre", "10:45": "ocupado", ... }
          whatsapp: '',
          demoPhone: null,
          completed: false,
          sessionId: null
        },
        
        // === PASO 4: FINALIZACIÓN (no requiere datos, solo UI) ===
        onboardingComplete: false,
        
        // === ACCIONES GENERALES ===
        setStep: (step) => {
          log.info(`📍 Onboarding: Paso ${step} de 4`);
          set({ currentStep: step, error: null });
        },
        
        setCurrentStep: (step) => {
          set({ currentStep: step });
        },
        
        nextStep: () => {
          const { currentStep } = get();
          if (currentStep < 4) {
            set({ currentStep: currentStep + 1, error: null });
          }
        },
        
        prevStep: () => {
          const { currentStep } = get();
          if (currentStep > 1) {
            set({ currentStep: currentStep - 1, error: null });
          }
        },
        
        setLoading: (loading) => {
          set({ isLoading: loading });
        },
        
        setError: (error) => {
          log.error('❌ Onboarding error:', error);
          set({ error });
        },
        
        clearError: () => {
          set({ error: null });
        },
        
        // === PASO 1: IDENTIDAD RÁPIDA ===
        setSelectedVertical: (vertical) => {
          log.info('🎯 Vertical seleccionado:', vertical?.name);
          set({ selectedVertical: vertical });
        },
        
        setBusinessName: (name) => {
          set({ businessName: name });
        },
        
        setDemoConfig: (config) => {
          set({ demoConfig: config });
        },
        
        // === PASO 2: ASISTENTE ===
        setAssistantName: (name) => {
          set({ assistantName: name });
        },
        
        setAssistantVoice: (voiceId) => {
          log.info('🎤 Voz seleccionada:', voiceId);
          set({ assistantVoice: voiceId });
        },
        
        // === PASO 3: DEMO ===
        setDemoSlots: (slots) => {
          set({ demo: { ...get().demo, slots } });
        },
        
        setDemoWhatsapp: (whatsapp) => {
          set({ demo: { ...get().demo, whatsapp } });
        },
        
        setDemoPhone: (phone) => {
          set({ demo: { ...get().demo, demoPhone: phone } });
        },
        
        setDemoCompleted: (completed) => {
          set({ demo: { ...get().demo, completed } });
        },
        
        setDemoSessionId: (sessionId) => {
          set({ demo: { ...get().demo, sessionId } });
        },
        
        updateDemoSlot: (time, status) => {
          const { demo } = get();
          set({
            demo: {
              ...demo,
              slots: {
                ...demo.slots,
                [time]: status
              }
            }
          });
        },
        
        // === PASO 4: FINALIZACIÓN ===
        setOnboardingComplete: (complete) => {
          set({ onboardingComplete: complete });
        },
        
        // === VALIDACIONES ===
        isStepValid: (step) => {
          const state = get();
          
          switch (step) {
            case 1:
              // Paso 1: Vertical + Nombre del negocio
              return state.selectedVertical && state.businessName.trim().length >= 3;
            
            case 2:
              // Paso 2: Nombre del asistente + Voz
              return state.assistantName.trim().length >= 2 && state.assistantVoice;
            
            case 3:
              // Paso 3: Demo completada
              return state.demo.completed === true;
            
            case 4:
              // Paso 4: Siempre válido (solo es UI informativa)
              return true;
            
            default:
              return false;
          }
        },
        
        // === UTILIDADES ===
        getAllData: () => {
          const state = get();
          return {
            // Paso 1
            vertical: state.selectedVertical?.id,
            businessName: state.businessName,
            demoConfig: state.demoConfig,
            
            // Paso 2
            assistantName: state.assistantName,
            assistantVoice: state.assistantVoice,
            
            // Paso 3
            demo: state.demo,
          };
        },
        
        // === RESET ===
        reset: () => {
          log.info('🔄 Reiniciando onboarding');
          set({
            currentStep: 1,
            isLoading: false,
            error: null,
            selectedVertical: null,
            businessName: '',
            demoConfig: {
              defaultServiceName: '',
              defaultServiceDuration: 60,
              serviceIcon: null
            },
            assistantName: '',
            assistantVoice: null,
            demo: {
              slots: {},
              whatsapp: '',
              demoPhone: null,
              completed: false,
              sessionId: null
            },
            onboardingComplete: false
          });
        },
      }),
      {
        name: 'onboarding-storage-v2', // Nuevo nombre para evitar conflictos
        partialize: (state) => ({
          // Persistir solo datos del usuario
          selectedVertical: state.selectedVertical,
          businessName: state.businessName,
          demoConfig: state.demoConfig,
          assistantName: state.assistantName,
          assistantVoice: state.assistantVoice,
          demo: state.demo,
          currentStep: state.currentStep,
        }),
      }
    )
  )
);
