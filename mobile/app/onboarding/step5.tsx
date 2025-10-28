import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';
import { supabase } from '../../services/supabase';

export default function Step5() {
  const router = useRouter();
  const { goToStep, setAIPersonality, businessName, verticalType, setTestCompleted } = useOnboardingStore();
  
  const [assistantName, setAssistantName] = useState('María');
  const [selectedVoice, setSelectedVoice] = useState<'female' | 'male'>('female');
  const [greetingScript, setGreetingScript] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const voices = [
    { id: 'female', name: 'María', gender: 'Femenina', emoji: '👩' },
    { id: 'male', name: 'David', gender: 'Masculina', emoji: '👨' },
  ];

  const handleTestCall = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);

      // Llamar a la Edge Function voice-simulate
      const { data, error } = await supabase.functions.invoke('voice-simulate', {
        body: {
          business_id: 'temp-id', // Temporal, el negocio aún no existe
          vertical_type: verticalType,
          greeting_script: greetingScript || `Hola, soy ${assistantName}, asistente virtual de ${businessName}`
        }
      });

      if (error) throw error;

      if (data?.transcript) {
        setTestResult(data.transcript);
        setTestCompleted(data);
      }
    } catch (error) {
      console.error('[Step5] Error testing call:', error);
      setTestResult('❌ Error al realizar la simulación. Intenta de nuevo.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleContinue = () => {
    // Guardar configuración de IA
    const voice = selectedVoice === 'female' ? 'maria' : 'david';
    const script = greetingScript || `Hola, soy ${assistantName}, asistente virtual de ${businessName}`;
    
    setAIPersonality(voice, script);
    goToStep(6);
    router.push('/onboarding/step6');
  };

  const handleBack = () => {
    goToStep(4);
    router.back();
  };

  const defaultGreeting = `Hola, soy ${assistantName}, asistente virtual de ${businessName}`;

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={5}
        totalSteps={8}
        title="🤖 Tu Asistente"
        subtitle="El Momento WOW"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Nombre del asistente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dale un nombre</Text>
          <TextInput
            style={styles.input}
            value={assistantName}
            onChangeText={setAssistantName}
            placeholder="Nombre del asistente"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Selector de voz */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elige la voz</Text>
          <View style={styles.voiceSelector}>
            {voices.map((voice) => (
              <TouchableOpacity
                key={voice.id}
                style={[
                  styles.voiceCard,
                  selectedVoice === voice.id && styles.voiceCardSelected
                ]}
                onPress={() => setSelectedVoice(voice.id as 'female' | 'male')}
              >
                <Text style={styles.voiceEmoji}>{voice.emoji}</Text>
                <Text style={[
                  styles.voiceName,
                  selectedVoice === voice.id && styles.voiceNameSelected
                ]}>
                  {voice.name}
                </Text>
                <Text style={styles.voiceGender}>Voz {voice.gender}</Text>
                
                {selectedVoice === voice.id && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mensaje personalizado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mensaje de bienvenida (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={greetingScript}
            onChangeText={setGreetingScript}
            placeholder={defaultGreeting}
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
          <Text style={styles.hint}>
            💡 Si lo dejas vacío, usaremos: "{defaultGreeting}"
          </Text>
        </View>

        {/* Botón de test */}
        <View style={styles.testSection}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestCall}
            disabled={testLoading}
          >
            {testLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.testButtonIcon}>📞</Text>
                <Text style={styles.testButtonText}>Probar mi IA ahora</Text>
              </>
            )}
          </TouchableOpacity>

          {testResult && (
            <View style={styles.testResultCard}>
              <Text style={styles.testResultTitle}>✨ Resultado de la prueba:</Text>
              <ScrollView style={styles.testResultScroll}>
                <Text style={styles.testResultText}>{testResult}</Text>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      <OnboardingFooter
        onContinue={handleContinue}
        onBack={handleBack}
        continueText={testResult ? "¡Me encanta! Continuar" : "Continuar"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    fontStyle: 'italic',
  },
  voiceSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  voiceCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  voiceCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  voiceEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  voiceNameSelected: {
    color: '#6366f1',
  },
  voiceGender: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  testSection: {
    marginTop: 8,
  },
  testButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testResultCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  testResultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 12,
  },
  testResultScroll: {
    maxHeight: 200,
  },
  testResultText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 20,
  },
});
