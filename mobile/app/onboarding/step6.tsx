import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

export default function Step6() {
  const router = useRouter();
  const { goToStep, setCallForwarding, phone } = useOnboardingStore();
  
  const [whatsappNumber, setWhatsappNumber] = useState(phone || '');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [forwardingActivated, setForwardingActivated] = useState(false);

  const operators = [
    { id: 'movistar', name: 'Movistar', code: '*21*' },
    { id: 'vodafone', name: 'Vodafone', code: '*21*' },
    { id: 'orange', name: 'Orange', code: '*21*' },
    { id: 'yoigo', name: 'Yoigo', code: '*21*' },
    { id: 'otro', name: 'Otro', code: '*21*' },
  ];

  const handleVerifyConnection = () => {
    // Simulación de verificación
    setForwardingActivated(true);
    setTimeout(() => {
      // En producción, aquí haríamos una verificación real
    }, 2000);
  };

  const handleContinue = () => {
    setCallForwarding(forwardingActivated, selectedOperator);
    goToStep(7);
    router.push('/onboarding/step7');
  };

  const handleBack = () => {
    goToStep(5);
    router.back();
  };

  const aiPhoneNumber = '+34 XXX XXX XXX'; // Número temporal

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={6}
        totalSteps={8}
        title="📞 Conecta tu Teléfono"
        subtitle="Alertas y desvío de llamadas"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Parte A: Alertas Urgentes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Alertas Urgentes por WhatsApp</Text>
          <Text style={styles.description}>
            Te enviaremos una alerta solo si un cliente tiene una queja grave o situación urgente.
          </Text>
          
          <TextInput
            style={styles.input}
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            placeholder="+34 XXX XXX XXX"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />
          
          <Text style={styles.hint}>
            💡 Opcional: Solo para situaciones importantes
          </Text>
        </View>

        {/* Parte B: Desvío de Llamadas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>☎️ Desvío de Llamadas</Text>
          <Text style={styles.description}>
            ¡Último paso! Desvía las llamadas de tu negocio a tu asistente IA.
          </Text>

          {/* Selector de operador */}
          <Text style={styles.label}>Selecciona tu operador:</Text>
          <View style={styles.operatorGrid}>
            {operators.map((operator) => (
              <TouchableOpacity
                key={operator.id}
                style={[
                  styles.operatorCard,
                  selectedOperator === operator.id && styles.operatorCardSelected
                ]}
                onPress={() => setSelectedOperator(operator.id)}
              >
                <Text style={[
                  styles.operatorName,
                  selectedOperator === operator.id && styles.operatorNameSelected
                ]}>
                  {operator.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Instrucciones de desvío */}
          {selectedOperator && (
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>📋 Instrucciones:</Text>
              
              <View style={styles.step}>
                <Text style={styles.stepNumber}>1️⃣</Text>
                <Text style={styles.stepText}>
                  Abre la app de teléfono de tu móvil
                </Text>
              </View>
              
              <View style={styles.step}>
                <Text style={styles.stepNumber}>2️⃣</Text>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>Marca este código:</Text>
                  <View style={styles.codeCard}>
                    <Text style={styles.code}>
                      *21*{aiPhoneNumber}#
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.step}>
                <Text style={styles.stepNumber}>3️⃣</Text>
                <Text style={styles.stepText}>
                  Pulsa el botón de llamar ☎️
                </Text>
              </View>

              <View style={styles.step}>
                <Text style={styles.stepNumber}>4️⃣</Text>
                <Text style={styles.stepText}>
                  Espera la confirmación (aparecerá un mensaje)
                </Text>
              </View>

              {/* Botón de verificación */}
              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  forwardingActivated && styles.verifyButtonSuccess
                ]}
                onPress={handleVerifyConnection}
                disabled={forwardingActivated}
              >
                <Text style={styles.verifyButtonText}>
                  {forwardingActivated ? '✅ ¡CONECTADO!' : '🔍 ¡Hecho! Verificar Conexión'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {forwardingActivated && (
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>¡Conexión verificada!</Text>
            <Text style={styles.successText}>
              Tu asistente IA está listo para recibir llamadas
            </Text>
          </View>
        )}
      </ScrollView>

      <OnboardingFooter
        onContinue={handleContinue}
        onBack={handleBack}
        continueText={forwardingActivated ? "Continuar" : "Lo haré después"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  operatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  operatorCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  operatorCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  operatorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  operatorNameSelected: {
    color: '#6366f1',
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    fontSize: 20,
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  codeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  code: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    textAlign: 'center',
    letterSpacing: 1,
  },
  verifyButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonSuccess: {
    backgroundColor: '#10b981',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
  },
});
