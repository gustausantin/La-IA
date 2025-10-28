import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

export default function Step2() {
  const router = useRouter();
  const { goToStep } = useOnboardingStore();

  const handleContinue = () => {
    goToStep(3);
    router.push('/onboarding/step3');
  };

  const handleBack = () => {
    goToStep(1);
    router.back();
  };

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={2}
        totalSteps={8}
        title="💼 Servicios y Precios"
        subtitle="Define los servicios que ofreces"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.comingSoon}>🚧 Implementación en progreso...</Text>
        <Text style={styles.description}>
          Aquí podrás agregar tus servicios, duración y precios.
        </Text>
      </ScrollView>

      <OnboardingFooter onContinue={handleContinue} onBack={handleBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  comingSoon: { fontSize: 24, marginBottom: 16 },
  description: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
});

