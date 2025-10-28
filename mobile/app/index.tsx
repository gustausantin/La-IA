import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const hasChecked = useRef(false); // Evitar múltiples ejecuciones

  useEffect(() => {
    // Solo ejecutar UNA VEZ al montar el componente
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Verificar si hay sesión activa
    const checkSession = async () => {
      const { supabase } = await import('../services/supabase');
      const { useOnboardingStore } = await import('../stores/onboardingStore');
      
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        console.log('[Index] Usuario autenticado:', session.user.email);
        
        // Verificar si tiene negocio EN SUPABASE (la única fuente de verdad)
        const { data: mapping, error } = await supabase
          .from('user_business_mapping')
          .select('business_id')
          .eq('auth_user_id', session.user.id)
          .eq('active', true)
          .single();

        if (error) {
          console.log('[Index] No tiene negocio en Supabase:', error.message);
        }

        if (mapping) {
          // Tiene negocio, ir al dashboard
          console.log('[Index] Usuario con negocio:', mapping.business_id);
          // TODO: router.replace('/dashboard');
          router.replace('/onboarding'); // Temporal hasta que exista dashboard
        } else {
          // NO tiene negocio -> Resetear store y empezar onboarding desde cero
          console.log('[Index] Reseteando onboarding para usuario sin negocio');
          useOnboardingStore.getState().resetOnboarding();
          router.replace('/onboarding');
        }
      } else {
        // No hay sesión, ir a auth
        console.log('[Index] Sin sesión, ir a login');
        router.replace('/auth');
      }
    };

    const timer = setTimeout(() => {
      checkSession();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚀 LA-IA</Text>
      <Text style={styles.subtitle}>Tu recepcionista IA</Text>
      <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 32,
  },
  loader: {
    marginTop: 16,
  },
});

