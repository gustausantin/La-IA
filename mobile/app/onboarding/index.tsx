import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function OnboardingIndex() {
  const router = useRouter();
  const currentStep = useOnboardingStore((state) => state.currentStep);

  useEffect(() => {
    // Redirigir al paso actual
    router.replace(`/onboarding/step${currentStep}` as any);
  }, [currentStep]);

  return null;
}

