import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingData {
  // Paso 1: Perfil del negocio
  businessName: string;
  verticalType: string;
  city: string;
  phone: string;
  
  // Paso 2: Servicios y precios
  services: Array<{
    id: string;
    name: string;
    duration: number;
    price: number;
  }>;
  
  // Paso 3: Horarios
  schedule: Record<string, { open: boolean; start: string; end: string }>;
  
  // Paso 4: Google Calendar
  googleCalendarConnected: boolean;
  calendarId?: string;
  
  // Paso 5: Personalidad IA
  aiVoice: string;
  greetingScript: string;
  
  // Paso 6: Test de llamada
  testCompleted: boolean;
  testResult?: any;
  
  // Paso 7: Desvío de llamadas
  callForwardingActivated: boolean;
  operator?: string;
  
  // Paso 8: Confirmación
  onboardingCompleted: boolean;
  
  // Metadata
  currentStep: number;
  businessId?: string;
}

interface OnboardingStore extends OnboardingData {
  // Actions
  setBusinessProfile: (data: Partial<OnboardingData>) => void;
  setServices: (services: OnboardingData['services']) => void;
  setSchedule: (schedule: OnboardingData['schedule']) => void;
  setGoogleCalendar: (connected: boolean, calendarId?: string) => void;
  setAIPersonality: (voice: string, script: string) => void;
  setTestCompleted: (result: any) => void;
  setCallForwarding: (activated: boolean, operator?: string) => void;
  completeOnboarding: (businessId: string) => void;
  goToStep: (step: number) => void;
  resetOnboarding: () => void;
}

const initialState: OnboardingData = {
  businessName: '',
  verticalType: '',
  city: '',
  phone: '',
  services: [],
  schedule: {
    monday: { open: true, start: '09:00', end: '18:00' },
    tuesday: { open: true, start: '09:00', end: '18:00' },
    wednesday: { open: true, start: '09:00', end: '18:00' },
    thursday: { open: true, start: '09:00', end: '18:00' },
    friday: { open: true, start: '09:00', end: '18:00' },
    saturday: { open: false, start: '09:00', end: '14:00' },
    sunday: { open: false, start: '09:00', end: '14:00' },
  },
  googleCalendarConnected: false,
  aiVoice: 'maria',
  greetingScript: '',
  testCompleted: false,
  callForwardingActivated: false,
  onboardingCompleted: false,
  currentStep: 1,
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      ...initialState,

      setBusinessProfile: (data) => set((state) => ({ ...state, ...data })),

      setServices: (services) => set({ services }),

      setSchedule: (schedule) => set({ schedule }),

      setGoogleCalendar: (connected, calendarId) =>
        set({ googleCalendarConnected: connected, calendarId }),

      setAIPersonality: (voice, script) =>
        set({ aiVoice: voice, greetingScript: script }),

      setTestCompleted: (result) =>
        set({ testCompleted: true, testResult: result }),

      setCallForwarding: (activated, operator) =>
        set({ callForwardingActivated: activated, operator }),

      completeOnboarding: (businessId) =>
        set({ onboardingCompleted: true, businessId }),

      goToStep: (step) => set({ currentStep: step }),

      resetOnboarding: () => set(initialState),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

