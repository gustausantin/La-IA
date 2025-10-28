import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';
import { supabase } from '../../services/supabase';

interface Service {
  name: string;
  description: string;
  duration_minutes: number;
  suggested_price: number;
  is_popular: boolean;
}

export default function Step3() {
  const router = useRouter();
  const { goToStep, setServices, verticalType } = useOnboardingStore();
  
  const [loading, setLoading] = useState(true);
  const [suggestedServices, setSuggestedServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

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
        const services: Service[] = vertical.defaultServices.map(s => ({
          name: s.name,
          description: '',
          duration_minutes: s.duration,
          suggested_price: s.price,
          is_popular: false
        }));
        setSuggestedServices(services);
      }
    } catch (error) {
      console.error('[Step3] Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceName: string) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceName)) {
        return prev.filter(s => s !== serviceName);
      } else {
        return [...prev, serviceName];
      }
    });
  };

  const handleContinue = () => {
    // Guardar servicios seleccionados en el store
    const services = suggestedServices
      .filter(s => selectedServices.includes(s.name))
      .map((s, index) => ({
        id: `service-${index}`,
        name: s.name,
        duration: s.duration_minutes,
        price: s.suggested_price
      }));

    setServices(services);
    goToStep(4);
    router.push('/onboarding/step4');
  };

  const handleBack = () => {
    goToStep(2);
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <OnboardingHeader
          currentStep={3}
          totalSteps={8}
          title="⏳ Cargando..."
          subtitle="Obteniendo servicios recomendados"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={3}
        totalSteps={8}
        title="💼 Servicios Iniciales"
        subtitle="Selecciona los servicios que ofreces"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Elige los servicios principales que ofreces. Podrás agregar más y editar precios después.
        </Text>

        {suggestedServices.map((service) => {
          const isSelected = selectedServices.includes(service.name);
          
          return (
            <TouchableOpacity
              key={service.name}
              style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
              onPress={() => toggleService(service.name)}
            >
              <View style={styles.serviceHeader}>
                <Text style={[styles.serviceName, isSelected && styles.serviceNameSelected]}>
                  {service.name}
                </Text>
                {service.is_popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>⭐ Popular</Text>
                  </View>
                )}
              </View>
              
              {service.description && (
                <Text style={styles.serviceDescription}>{service.description}</Text>
              )}
              
              <View style={styles.serviceFooter}>
                <Text style={styles.serviceDuration}>⏱️ {service.duration_minutes} min</Text>
                <Text style={styles.servicePrice}>💰 {service.suggested_price}€</Text>
              </View>

              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
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
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  serviceNameSelected: {
    color: '#6366f1',
  },
  popularBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  popularText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceDuration: {
    fontSize: 13,
    color: '#6b7280',
  },
  servicePrice: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  checkbox: {
    position: 'absolute',
    top: 12,
    right: 12,
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
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
