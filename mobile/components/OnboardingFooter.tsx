import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface OnboardingFooterProps {
  onContinue: () => void;
  onBack?: () => void;
  continueText?: string;
  disabled?: boolean;
  loading?: boolean;
}

export default function OnboardingFooter({
  onContinue,
  onBack,
  continueText = 'Continuar',
  disabled = false,
  loading = false,
}: OnboardingFooterProps) {
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          disabled={loading}
        >
          <Text style={styles.backText}>← Atrás</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.continueButton,
          disabled && styles.continueButtonDisabled,
        ]}
        onPress={onContinue}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.continueText}>{continueText}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  continueButton: {
    flex: 2,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#6366f1',
  },
  continueButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

