import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function OnboardingIndex() {
  const router = useRouter();
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Solo redirigir UNA VEZ
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    // Redirigir al paso actual
    const step = currentStep || 1;
    console.log('[OnboardingIndex] Redirigiendo a step:', step);
    router.replace(`/onboarding/step${step}` as any);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

