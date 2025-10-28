import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

export default function Step7() {
  const router = useRouter();
  const { goToStep } = useOnboardingStore();

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={7}
        totalSteps={8}
        title="📲 Desvío de Llamadas"
        subtitle="Activa tu recepcionista IA"
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.comingSoon}>🚧 Implementación en progreso...</Text>
      </ScrollView>
      <OnboardingFooter
        onContinue={() => { goToStep(8); router.push('/onboarding/step8'); }}
        onBack={() => { goToStep(6); router.back(); }}
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

