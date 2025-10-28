import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';
import { supabase } from '../../services/supabase';

export default function Step4() {
  const router = useRouter();
  const { goToStep, verticalType, businessName } = useOnboardingStore();
  
  const [resourceCount, setResourceCount] = useState(1);
  const [resourceName, setResourceName] = useState('recurso');
  const [resourceNamePlural, setResourceNamePlural] = useState('recursos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResourceNames();
  }, []);

  const loadResourceNames = async () => {
    try {
      setLoading(true);
      
      // Mapeo local de nombres de recursos por vertical
      const resourceMap: Record<string, { singular: string; plural: string }> = {
        fisioterapia: { singular: 'camilla', plural: 'camillas' },
        masajes_osteopatia: { singular: 'camilla', plural: 'camillas' },
        clinica_dental: { singular: 'sillón', plural: 'sillones' },
        psicologia_coaching: { singular: 'sala', plural: 'salas' },
        centro_estetica: { singular: 'cabina', plural: 'cabinas' },
        peluqueria_barberia: { singular: 'silla', plural: 'sillas' },
        centro_unas: { singular: 'mesa', plural: 'mesas' },
        entrenador_personal: { singular: 'espacio', plural: 'espacios' },
        yoga_pilates: { singular: 'esterilla', plural: 'esterillas' },
        veterinario: { singular: 'consulta', plural: 'consultas' }
      };

      const resource = resourceMap[verticalType] || { singular: 'recurso', plural: 'recursos' };
      setResourceName(resource.singular);
      setResourceNamePlural(resource.plural);
    } catch (error) {
      console.error('[Step4] Error loading resource names:', error);
    } finally {
      setLoading(false);
    }
  };

  const increment = () => {
    if (resourceCount < 20) {
      setResourceCount(resourceCount + 1);
    }
  };

  const decrement = () => {
    if (resourceCount > 1) {
      setResourceCount(resourceCount - 1);
    }
  };

  const handleContinue = () => {
    // El número de recursos se guardará en el backend al crear el negocio
    // Por ahora solo avanzamos al siguiente paso
    goToStep(5);
    router.push('/onboarding/step5');
  };

  const handleBack = () => {
    goToStep(3);
    router.back();
  };

  const displayName = resourceCount === 1 ? resourceName : resourceNamePlural;

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={4}
        totalSteps={8}
        title="🏢 Espacio de Trabajo"
        subtitle="Define tu capacidad"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.questionCard}>
          <Text style={styles.greeting}>Hola, {businessName || 'profesional'} 👋</Text>
          <Text style={styles.question}>
            ¿Cuántos <Text style={styles.highlight}>{resourceNamePlural}</Text> tienes?
          </Text>
        </View>

        <View style={styles.counterCard}>
          <TouchableOpacity
            style={[styles.counterButton, resourceCount === 1 && styles.counterButtonDisabled]}
            onPress={decrement}
            disabled={resourceCount === 1}
          >
            <Text style={styles.counterButtonText}>−</Text>
          </TouchableOpacity>

          <View style={styles.counterDisplay}>
            <Text style={styles.counterNumber}>{resourceCount}</Text>
            <Text style={styles.counterLabel}>{displayName}</Text>
          </View>

          <TouchableOpacity
            style={[styles.counterButton, resourceCount === 20 && styles.counterButtonDisabled]}
            onPress={increment}
            disabled={resourceCount === 20}
          >
            <Text style={styles.counterButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.examplesCard}>
          <Text style={styles.examplesTitle}>💡 Ejemplos:</Text>
          <Text style={styles.exampleText}>
            • Si trabajas solo: <Text style={styles.bold}>1 {resourceName}</Text>
          </Text>
          <Text style={styles.exampleText}>
            • Si tienes un equipo pequeño: <Text style={styles.bold}>2-5 {resourceNamePlural}</Text>
          </Text>
          <Text style={styles.exampleText}>
            • Centro más grande: <Text style={styles.bold}>6+ {resourceNamePlural}</Text>
          </Text>
        </View>

        <Text style={styles.note}>
          ℹ️ Esto nos ayuda a gestionar tu disponibilidad de forma inteligente. Podrás ajustarlo después.
        </Text>
      </ScrollView>

      <OnboardingFooter
        onContinue={handleContinue}
        onBack={handleBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20, alignItems: 'center' },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 12,
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 28,
  },
  highlight: {
    color: '#6366f1',
  },
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  counterButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  counterButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
  },
  counterButtonText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '600',
  },
  counterDisplay: {
    marginHorizontal: 40,
    alignItems: 'center',
  },
  counterNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 4,
  },
  counterLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  examplesCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: '#111827',
  },
  note: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
