import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

export default function Step3() {
  const router = useRouter();
  const { goToStep } = useOnboardingStore();

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={3}
        totalSteps={8}
        title="📅 Horarios"
        subtitle="Define tu disponibilidad semanal"
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.comingSoon}>🚧 Implementación en progreso...</Text>
      </ScrollView>
      <OnboardingFooter
        onContinue={() => { goToStep(4); router.push('/onboarding/step4'); }}
        onBack={() => { goToStep(2); router.back(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  comingSoon: { fontSize: 24 },
});

