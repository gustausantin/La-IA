import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

export default function Step8() {
  const router = useRouter();
  const { completeOnboarding, businessId } = useOnboardingStore();

  const handleFinish = () => {
    // Aquí iríamos al dashboard principal
    alert('¡Onboarding completado! 🎉\nBusiness ID: ' + businessId);
  };

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={8}
        totalSteps={8}
        title="✅ ¡Todo Listo!"
        subtitle="Tu recepcionista IA está configurada"
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.celebration}>🎉🎊🚀</Text>
        <Text style={styles.title}>¡Enhorabuena!</Text>
        <Text style={styles.description}>
          Tu recepcionista IA ya está lista para atender llamadas 24/7
        </Text>
      </ScrollView>
      <OnboardingFooter
        onContinue={handleFinish}
        onBack={() => router.back()}
        continueText="Ir al panel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebration: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 16 },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});

