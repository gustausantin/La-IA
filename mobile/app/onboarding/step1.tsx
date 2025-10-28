import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { VERTICALS } from '../../constants/verticals';
import { createBusiness } from '../../services/supabase';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

interface Step1FormData {
  businessName: string;
  verticalType: string;
  city: string;
  phone: string;
}

export default function Step1() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const {
    businessName,
    verticalType,
    city,
    phone,
    setBusinessProfile,
    goToStep,
    completeOnboarding,
  } = useOnboardingStore();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<Step1FormData>({
    defaultValues: {
      businessName,
      verticalType,
      city,
      phone,
    },
    mode: 'onChange',
  });

  const selectedVertical = watch('verticalType');

  const onSubmit = async (data: Step1FormData) => {
    setLoading(true);

    try {
      // Guardar en el store
      setBusinessProfile(data);

      // Crear negocio en Supabase
      const result = await createBusiness({
        name: data.businessName,
        vertical_type: data.verticalType,
        city: data.city,
        phone: data.phone,
        active: true,
      });

      if (!result.success) {
        Alert.alert(
          'Error al crear negocio',
          result.error || 'No se pudo crear el negocio. Intenta de nuevo.'
        );
        setLoading(false);
        return;
      }

      // Guardar business_id en el store
      if (result.business_id) {
        completeOnboarding(result.business_id);
      }

      // Ir al siguiente paso
      goToStep(2);
      router.push('/onboarding/step2');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={1}
        totalSteps={8}
        title="📋 Perfil del Negocio"
        subtitle="Cuéntanos sobre tu negocio para personalizar la IA"
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Selector de vertical */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Tipo de negocio <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="verticalType"
            rules={{ required: 'Selecciona un tipo de negocio' }}
            render={({ field: { onChange, value } }) => (
              <View style={styles.verticalGrid}>
                {VERTICALS.map((vertical) => (
                  <TouchableOpacity
                    key={vertical.id}
                    style={[
                      styles.verticalCard,
                      value === vertical.id && styles.verticalCardSelected,
                    ]}
                    onPress={() => onChange(vertical.id)}
                  >
                    <Text style={styles.verticalIcon}>{vertical.icon}</Text>
                    <Text style={styles.verticalName}>{vertical.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
          {errors.verticalType && (
            <Text style={styles.errorText}>{errors.verticalType.message}</Text>
          )}
        </View>

        {/* Nombre del negocio */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Nombre del negocio <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="businessName"
            rules={{
              required: 'El nombre es obligatorio',
              minLength: { value: 3, message: 'Mínimo 3 caracteres' },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.businessName && styles.inputError]}
                placeholder="Ej: Clínica Fisio Madrid"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
              />
            )}
          />
          {errors.businessName && (
            <Text style={styles.errorText}>{errors.businessName.message}</Text>
          )}
          <Text style={styles.hint}>
            La IA se presentará con este nombre al atender llamadas
          </Text>
        </View>

        {/* Ciudad */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Ciudad <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="city"
            rules={{ required: 'La ciudad es obligatoria' }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="Ej: Madrid"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
              />
            )}
          />
          {errors.city && (
            <Text style={styles.errorText}>{errors.city.message}</Text>
          )}
        </View>

        {/* Teléfono */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Teléfono principal <Text style={styles.required}>*</Text>
          </Text>
          <Controller
            control={control}
            name="phone"
            rules={{
              required: 'El teléfono es obligatorio',
              pattern: {
                value: /^(\+34)?[6-9]\d{8}$/,
                message: 'Formato inválido (Ej: +34612345678)',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="+34 612 345 678"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
              />
            )}
          />
          {errors.phone && (
            <Text style={styles.errorText}>{errors.phone.message}</Text>
          )}
          <Text style={styles.hint}>
            Número que desviarás a la IA para gestionar llamadas
          </Text>
        </View>
      </ScrollView>

      <OnboardingFooter
        onContinue={handleSubmit(onSubmit)}
        continueText="Crear negocio y continuar"
        disabled={!isValid}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 6,
  },
  verticalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  verticalCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  verticalCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  verticalIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  verticalName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});

