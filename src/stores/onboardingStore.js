import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { log } from '../utils/logger.js';

/**
 * Store para el flujo de onboarding de 5 pasos
 * Gestiona todo el estado del onboarding hasta que se guarda en Supabase
 */
export const useOnboardingStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // === ESTADO GENERAL ===
        currentStep: 1,
        isLoading: false,
        error: null,
        
        // === PASO 1: PERFIL Y VERTICAL ===
        businessName: '',
        businessPhone: '',
        selectedVertical: null, // { id, name, icon, color, ... }
        verticalConfig: null, // Configuración desde get-vertical-onboarding-config
        
        // === PASO 2: HORARIO BASE (con soporte para múltiples bloques) ===
        businessHours: {
          monday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
          tuesday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
          wednesday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
          thursday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
          friday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
          saturday: { isOpen: true, timeBlocks: [{ openTime: '10:00', closeTime: '14:00' }] },
          sunday: { isOpen: false, timeBlocks: [] }
        },
        
        // === PASO 3: ASISTENTE IA ===
        assistantName: 'María',
        assistantVoice: 'female', // 'female' | 'male'
        testCallCompleted: false,
        testCallTranscript: null,
        
        // === PASO 4: CONEXIÓN Y ALERTAS ===
        assignedPhone: null, // Número asignado del pool (ej: '+34931204462')
        whatsappNumber: '',
        phoneOperator: '', // 'movistar', 'vodafone', 'orange', etc.
        connectionVerified: false,
        
        // === PASO 5: CONFIRMACIÓN ===
        confirmationComplete: false,
        
        // === DATOS ADICIONALES ===
        businessData: {
          email: '',
          address: '',
          city: '',
          postalCode: '',
        },
        
        // === ACCIONES GENERALES ===
        setStep: (step) => {
          log.info(`📍 Onboarding: Paso ${step}`);
          set({ currentStep: step, error: null });
        },
        
        nextStep: () => {
          const { currentStep } = get();
          if (currentStep < 5) {
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
        
        // === PASO 1: PERFIL Y VERTICAL ===
        setBusinessName: (name) => {
          set({ businessName: name });
        },
        
        setBusinessPhone: (phone) => {
          set({ businessPhone: phone });
        },
        
        setSelectedVertical: (vertical) => {
          log.info('🎯 Vertical seleccionado:', vertical?.name);
          set({ selectedVertical: vertical });
        },
        
        setVerticalConfig: (config) => {
          log.info('⚙️ Configuración de vertical cargada:', config);
          set({ verticalConfig: config });
        },
        
        // === PASO 2: HORARIO BASE ===
        setBusinessHours: (hours) => {
          set({ businessHours: hours });
        },
        
        updateDayHours: (day, hours) => {
          const { businessHours } = get();
          // Migrar estructura antigua a nueva si es necesario
          const migratedHours = hours.timeBlocks ? hours : {
            isOpen: hours.isOpen,
            timeBlocks: hours.openTime ? [{ openTime: hours.openTime, closeTime: hours.closeTime }] : []
          };
          set({
            businessHours: {
              ...businessHours,
              [day]: migratedHours
            }
          });
        },
        
        applyToWeekdays: (hours) => {
          const { businessHours } = get();
          const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
          const newHours = { ...businessHours };
          weekdays.forEach(day => {
            newHours[day] = { ...hours };
          });
          set({ businessHours: newHours });
        },
        
        // Gestión de bloques horarios múltiples
        addTimeBlock: (day) => {
          const { businessHours } = get();
          const dayData = businessHours[day];
          // Migrar si es necesario
          const currentBlocks = dayData.timeBlocks || (dayData.openTime ? [{ openTime: dayData.openTime, closeTime: dayData.closeTime }] : [{ openTime: '09:00', closeTime: '20:00' }]);
          
          set({
            businessHours: {
              ...businessHours,
              [day]: {
                isOpen: dayData.isOpen,
                timeBlocks: [...currentBlocks, { openTime: '16:00', closeTime: '20:00' }]
              }
            }
          });
        },
        
        removeTimeBlock: (day, blockIndex) => {
          const { businessHours } = get();
          const dayData = businessHours[day];
          const currentBlocks = dayData.timeBlocks || [];
          const newBlocks = currentBlocks.filter((_, index) => index !== blockIndex);
          
          set({
            businessHours: {
              ...businessHours,
              [day]: {
                isOpen: dayData.isOpen,
                timeBlocks: newBlocks.length > 0 ? newBlocks : [{ openTime: '09:00', closeTime: '20:00' }]
              }
            }
          });
        },
        
        updateTimeBlock: (day, blockIndex, field, value) => {
          const { businessHours } = get();
          const dayData = businessHours[day];
          // Migrar si es necesario
          const currentBlocks = dayData.timeBlocks || (dayData.openTime ? [{ openTime: dayData.openTime, closeTime: dayData.closeTime }] : [{ openTime: '09:00', closeTime: '20:00' }]);
          const newBlocks = [...currentBlocks];
          newBlocks[blockIndex] = {
            ...newBlocks[blockIndex],
            [field]: value
          };
          
          set({
            businessHours: {
              ...businessHours,
              [day]: {
                isOpen: dayData.isOpen,
                timeBlocks: newBlocks
              }
            }
          });
        },
        
        // === PASO 3: ASISTENTE IA ===
        setAssistantName: (name) => {
          set({ assistantName: name });
        },
        
        setAssistantVoice: (voice) => {
          log.info('🎤 Voz seleccionada:', voice);
          set({ assistantVoice: voice });
        },
        
        setTestCallCompleted: (completed) => {
          set({ testCallCompleted: completed });
        },
        
        setTestCallTranscript: (transcript) => {
          set({ testCallTranscript: transcript });
        },
        
        // === PASO 4: CONEXIÓN Y ALERTAS ===
        setAssignedPhone: (phone) => {
          log.info('📞 Número asignado:', phone);
          set({ assignedPhone: phone });
        },
        
        setWhatsappNumber: (number) => {
          set({ whatsappNumber: number });
        },
        
        setPhoneOperator: (operator) => {
          set({ phoneOperator: operator });
        },
        
        setConnectionVerified: (verified) => {
          log.info(verified ? '✅ Conexión verificada' : '❌ Conexión no verificada');
          set({ connectionVerified: verified });
        },
        
        // === PASO 5: CONFIRMACIÓN ===
        setConfirmationComplete: (complete) => {
          set({ confirmationComplete: complete });
        },
        
        // === DATOS ADICIONALES ===
        setBusinessData: (data) => {
          set({ businessData: { ...get().businessData, ...data } });
        },
        
        // === UTILIDADES ===
        isStepValid: (step) => {
          const state = get();
          
          switch (step) {
            case 1:
              return state.businessName && 
                     state.businessPhone && 
                     state.selectedVertical &&
                     state.businessData.address &&
                     state.businessData.city &&
                     state.businessData.postalCode;
            case 2:
              return true; // El horario siempre tiene valores por defecto
            case 3:
              return state.assistantName && state.assistantVoice;
            case 4:
              return state.connectionVerified; // Debe confirmar el desvío (checkbox obligatorio)
            case 5:
              return true;
            default:
              return false;
          }
        },
        
        getAllData: () => {
          const state = get();
          return {
            // Perfil y Vertical
            businessName: state.businessName,
            businessPhone: state.businessPhone,
            vertical: state.selectedVertical?.id,
            verticalConfig: state.verticalConfig,
            
            // Horario
            businessHours: state.businessHours,
            
            // Asistente
            assistantName: state.assistantName,
            assistantVoice: state.assistantVoice,
            
            // Conexión
            assignedPhone: state.assignedPhone,
            whatsappNumber: state.whatsappNumber,
            phoneOperator: state.phoneOperator,
            connectionVerified: state.connectionVerified,
            
            // Datos adicionales
            ...state.businessData
          };
        },
        
        // === RESET ===
        reset: () => {
          log.info('🔄 Reiniciando onboarding');
          set({
            currentStep: 1,
            isLoading: false,
            error: null,
            businessName: '',
            businessPhone: '',
            selectedVertical: null,
            verticalConfig: null,
            businessHours: {
              monday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
              tuesday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
              wednesday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
              thursday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
              friday: { isOpen: true, timeBlocks: [{ openTime: '09:00', closeTime: '20:00' }] },
              saturday: { isOpen: true, timeBlocks: [{ openTime: '10:00', closeTime: '14:00' }] },
              sunday: { isOpen: false, timeBlocks: [] }
            },
            assistantName: 'María',
            assistantVoice: 'female',
            testCallCompleted: false,
            testCallTranscript: null,
            assignedPhone: null,
            whatsappNumber: '',
            phoneOperator: '',
            connectionVerified: false,
            confirmationComplete: false,
            businessData: {
              email: '',
              address: '',
              city: '',
              postalCode: '',
            }
          });
        },
      }),
      {
        name: 'onboarding-storage',
        partialize: (state) => ({
          // Solo persistir datos del usuario, no el estado de la UI
          businessName: state.businessName,
          businessPhone: state.businessPhone,
          selectedVertical: state.selectedVertical,
          verticalConfig: state.verticalConfig,
          businessHours: state.businessHours,
          assistantName: state.assistantName,
          assistantVoice: state.assistantVoice,
          assignedPhone: state.assignedPhone,
          whatsappNumber: state.whatsappNumber,
          phoneOperator: state.phoneOperator,
          businessData: state.businessData,
          currentStep: state.currentStep,
        }),
      }
    )
  )
);

