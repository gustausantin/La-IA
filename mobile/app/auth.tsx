import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleReset = async () => {
    Alert.alert(
      '🔥 RESET COMPLETO',
      '¿Estás seguro? Esto borrará TODA la memoria de la app',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'SÍ, BORRAR TODO',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Cerrar sesión en Supabase
              await supabase.auth.signOut();
              
              // 2. Borrar AsyncStorage completo
              await AsyncStorage.clear();
              
              // 3. Limpiar campos
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              
              Alert.alert('✅ Reset completo', 'La app está limpia. Ahora puedes registrarte de nuevo.');
            } catch (error) {
              console.error('[Reset] Error:', error);
              Alert.alert('Error', 'No se pudo resetear la app');
            }
          },
        },
      ]
    );
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor, rellena todos los campos');
      return;
    }

    // VALIDAR CONTRASEÑA EN REGISTRO
    if (isSignUp) {
      if (!confirmPassword) {
        Alert.alert('Error', 'Por favor, confirma tu contraseña');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Las contraseñas no coinciden');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Registro
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined, // Sin confirmación de email
          }
        });

        if (error) throw error;

        // Login automático después del registro (sin email de confirmación)
        if (data.session) {
          console.log('[Auth] Registro exitoso, redirigiendo a onboarding');
          router.replace('/onboarding');
        } else {
          Alert.alert('Error', 'No se pudo crear la sesión automáticamente');
        }
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        console.log('[Auth] Login exitoso:', data.user?.id);
        
        // Verificar si el usuario ya tiene un negocio
        const { data: mapping } = await supabase
          .from('user_business_mapping')
          .select('business_id')
          .eq('auth_user_id', data.user.id)
          .eq('active', true)
          .single();

        if (mapping) {
          // Ya tiene negocio, ir al dashboard (cuando lo implementemos)
          Alert.alert('Bienvenido', 'Ya tienes un negocio creado');
          // TODO: router.replace('/dashboard');
        } else {
          // No tiene negocio, ir al onboarding
          router.replace('/onboarding');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Error:', error);
      Alert.alert('Error', error.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>🚀 LA-IA</Text>
        <Text style={styles.subtitle}>Tu recepcionista IA</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          {isSignUp && (
            <>
              <Text style={styles.label}>Confirmar Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? '¿Ya tienes cuenta? Inicia sesión'
                : '¿No tienes cuenta? Regístrate'}
            </Text>
          </TouchableOpacity>

          {/* BOTÓN DE RESET - SOLO PARA DEBUG */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleReset}
            disabled={loading}
          >
            <Text style={styles.resetText}>🔥 RESET COMPLETO (Borrar memoria app)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  resetText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

