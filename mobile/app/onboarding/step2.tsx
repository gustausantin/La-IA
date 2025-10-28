import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';
import { supabase } from '../../services/supabase';

interface ServiceTemplate {
  name: string;
  description: string;
  duration_minutes: number;
  suggested_price: number;
  is_popular: boolean;
}

interface CustomService {
  id: string;
  name: string;
  duration: number;
  price: number;
}

export default function Step2() {
  const router = useRouter();
  const { goToStep, setServices, verticalType, services: existingServices } = useOnboardingStore();
  
  const [loading, setLoading] = useState(true);
  const [suggestedServices, setSuggestedServices] = useState<ServiceTemplate[]>([]);
  const [selectedServices, setSelectedServices] = useState<CustomService[]>(existingServices || []);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // Usar datos locales del archivo constants/verticals.ts
      const { VERTICALS } = await import('../../constants/verticals');
      const vertical = VERTICALS.find(v => v.id === verticalType);
      
      if (vertical?.defaultServices) {
        const services: ServiceTemplate[] = vertical.defaultServices.map(s => ({
          name: s.name,
          description: '',
          duration_minutes: s.duration,
          suggested_price: s.price,
          is_popular: false
        }));
        setSuggestedServices(services);
      }
    } catch (error) {
      console.error('[Step2] Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: ServiceTemplate) => {
    const existingIndex = selectedServices.findIndex(s => s.name === service.name);
    
    if (existingIndex !== -1) {
      // Remover servicio
      setSelectedServices(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Agregar servicio
      const newService: CustomService = {
        id: `service-${Date.now()}`,
        name: service.name,
        duration: service.duration_minutes,
        price: service.suggested_price
      };
      setSelectedServices(prev => [...prev, newService]);
    }
  };

  const updateServicePrice = (id: string, price: string) => {
    const numPrice = parseFloat(price) || 0;
    setSelectedServices(prev =>
      prev.map(s => s.id === id ? { ...s, price: numPrice } : s)
    );
  };

  const updateServiceDuration = (id: string, duration: string) => {
    const numDuration = parseInt(duration) || 0;
    setSelectedServices(prev =>
      prev.map(s => s.id === id ? { ...s, duration: numDuration } : s)
    );
  };

  const handleContinue = () => {
    setServices(selectedServices);
    goToStep(3);
    router.push('/onboarding/step3');
  };

  const handleBack = () => {
    goToStep(1);
    router.back();
  };

  const isServiceSelected = (serviceName: string) => {
    return selectedServices.some(s => s.name === serviceName);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <OnboardingHeader
        currentStep={2}
        totalSteps={8}
        title="💼 Servicios y Precios"
        subtitle="Define los servicios que ofreces"
      />

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.description}>
          Selecciona servicios sugeridos o personaliza precios y duraciones
        </Text>

        {/* Servicios sugeridos */}
        {suggestedServices.map((service) => {
          const selected = isServiceSelected(service.name);
          const selectedService = selectedServices.find(s => s.name === service.name);
          
          return (
            <View key={service.name} style={styles.serviceWrapper}>
              <TouchableOpacity
                style={[styles.serviceCard, selected && styles.serviceCardSelected]}
                onPress={() => toggleService(service)}
              >
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, selected && styles.serviceNameSelected]}>
                      {service.name}
                    </Text>
                    {service.is_popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>⭐</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>

                {service.description && (
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                )}
              </TouchableOpacity>

              {/* Inputs de precio y duración cuando está seleccionado */}
              {selected && selectedService && (
                <View style={styles.serviceInputs}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>⏱️ Duración (min)</Text>
                    <TextInput
                      style={styles.input}
                      value={selectedService.duration.toString()}
                      onChangeText={(val) => updateServiceDuration(selectedService.id, val)}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>💰 Precio (€)</Text>
                    <TextInput
                      style={styles.input}
                      value={selectedService.price.toString()}
                      onChangeText={(val) => updateServicePrice(selectedService.id, val)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.hint}>
          💡 Selecciona al menos 1 servicio para continuar
        </Text>
      </ScrollView>

      <OnboardingFooter
        onContinue={handleContinue}
        onBack={handleBack}
        disabled={selectedServices.length === 0}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  serviceWrapper: {
    marginBottom: 16,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  serviceCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  serviceNameSelected: {
    color: '#6366f1',
  },
  popularBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularText: {
    fontSize: 11,
    color: '#92400e',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  serviceInputs: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
