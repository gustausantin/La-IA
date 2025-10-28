import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Por ahora vamos directo al onboarding
    // Más adelante aquí irá la lógica de auth
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 1000);

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

