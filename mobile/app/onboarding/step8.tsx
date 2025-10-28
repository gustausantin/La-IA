import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

export default function Step8() {
  const router = useRouter();
  const {
    businessName,
    verticalType,
    city,
    phone,
    services,
    schedule,
    aiVoice,
    greetingScript,
    callForwardingActivated,
    completeOnboarding,
  } = useOnboardingStore();

  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    try {
      setLoading(true);

      // Aquí iría la lógica para crear el negocio completo en Supabase
      // Por ahora, solo marcamos el onboarding como completo
      
      // Simular tiempo de creación
      await new Promise(resolve => setTimeout(resolve, 2000));

      completeOnboarding('temp-business-id'); // ID temporal
      
      // Redirigir al dashboard (TODO)
      router.replace('/dashboard' as any); // Temporal, esta ruta no existe aún
    } catch (error) {
      console.error('[Step8] Error activating:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const openDays = Object.entries(schedule).filter(([_, day]) => day.open).length;

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={8}
        totalSteps={8}
        title="✅ Confirmación Final"
        subtitle="¡Tu recepcionista IA está listo!"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.celebrationCard}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.celebrationTitle}>¡Todo listo!</Text>
          <Text style={styles.celebrationText}>
            Tu asistente IA está configurado y listo para empezar a trabajar
          </Text>
        </View>

        {/* Resumen de configuración */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📋 Resumen de tu configuración</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>🏢 Negocio:</Text>
            <Text style={styles.summaryValue}>{businessName}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>📍 Ciudad:</Text>
            <Text style={styles.summaryValue}>{city}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>📞 Teléfono:</Text>
            <Text style={styles.summaryValue}>{phone}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>💼 Servicios:</Text>
            <Text style={styles.summaryValue}>{services.length} configurados</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>🕐 Horario:</Text>
            <Text style={styles.summaryValue}>
              {openDays} {openDays === 1 ? 'día' : 'días'} abierto
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>🤖 Asistente:</Text>
            <Text style={styles.summaryValue}>
              {aiVoice === 'maria' ? 'María (Femenina)' : 'David (Masculino)'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>☎️ Desvío:</Text>
            <Text style={styles.summaryValue}>
              {callForwardingActivated ? '✅ Activado' : '⏳ Pendiente'}
            </Text>
          </View>
        </View>

        {/* Próximos pasos */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>🚀 Próximos pasos</Text>
          
          <View style={styles.nextStep}>
            <Text style={styles.nextStepNumber}>1</Text>
            <Text style={styles.nextStepText}>
              <Text style={styles.bold}>Completa tu perfil:</Text> Añade más detalles, horarios especiales, y recursos adicionales
            </Text>
          </View>

          <View style={styles.nextStep}>
            <Text style={styles.nextStepNumber}>2</Text>
            <Text style={styles.nextStepText}>
              <Text style={styles.bold}>Conecta tu calendario:</Text> Sincroniza con Google Calendar o Outlook
            </Text>
          </View>

          <View style={styles.nextStep}>
            <Text style={styles.nextStepNumber}>3</Text>
            <Text style={styles.nextStepText}>
              <Text style={styles.bold}>Prueba tu IA:</Text> Haz una llamada de prueba para ver cómo funciona
            </Text>
          </View>

          <View style={styles.nextStep}>
            <Text style={styles.nextStepNumber}>4</Text>
            <Text style={styles.nextStepText}>
              <Text style={styles.bold}>Invita a tu equipo:</Text> Añade colaboradores si trabajas con más personas
            </Text>
          </View>
        </View>

        {!callForwardingActivated && (
          <View style={styles.warningCard}>
            <Text style={styles.warningEmoji}>⚠️</Text>
            <Text style={styles.warningText}>
              <Text style={styles.bold}>Recuerda:</Text> No olvides activar el desvío de llamadas para que tu asistente IA pueda empezar a atender.
            </Text>
          </View>
        )}
      </ScrollView>

      <OnboardingFooter
        onContinue={handleActivate}
        onBack={handleBack}
        continueText={loading ? 'Activando...' : '🎉 ¡Activar mi Recepcionista IA!'}
        loading={loading}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  celebrationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  celebrationText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  nextStepsCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4338ca',
    marginBottom: 16,
  },
  nextStep: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  nextStepText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: '#111827',
  },
  warningCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 20,
  },
});
