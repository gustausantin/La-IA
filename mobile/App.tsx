import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚀 LA-IA Mobile</Text>
        <Text style={styles.subtitle}>Wizard de Onboarding</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '12.5%' }]} />
        </View>
        <Text style={styles.progressText}>Paso 1 de 8</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.stepTitle}>📋 Paso 1: Perfil del Negocio</Text>
          <Text style={styles.stepDescription}>
            Configura los datos básicos de tu negocio
          </Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Principal</Text>
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>• Nombre del negocio</Text>
              <Text style={styles.placeholderText}>• Tipo de negocio</Text>
              <Text style={styles.placeholderText}>• Descripción</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Próximos Pasos</Text>
            <View style={styles.stepsList}>
              <Text style={styles.stepItem}>✅ Paso 1: Perfil del Negocio</Text>
              <Text style={styles.stepItem}>⏳ Paso 2: Horarios</Text>
              <Text style={styles.stepItem}>⏳ Paso 3: Servicios</Text>
              <Text style={styles.stepItem}>⏳ Paso 4: Colaboradores</Text>
              <Text style={styles.stepItem}>⏳ Paso 5: Políticas</Text>
              <Text style={styles.stepItem}>⏳ Paso 6: Recordatorios</Text>
              <Text style={styles.stepItem}>⏳ Paso 7: Integración WhatsApp</Text>
              <Text style={styles.stepItem}>⏳ Paso 8: Confirmación</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Status Footer */}
      <View style={styles.footer}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>📱 Conexión</Text>
          <Text style={styles.statusValue}>✅ Online</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>⚡ Estado</Text>
          <Text style={styles.statusValue}>Funcionando</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#6366f1',
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  progressContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  placeholder: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  placeholderText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  stepsList: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
  },
  stepItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
});
