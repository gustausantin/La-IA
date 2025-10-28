import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OnboardingHeader from '../../components/OnboardingHeader';
import OnboardingFooter from '../../components/OnboardingFooter';

interface DaySchedule {
  open: boolean;
  start: string;
  end: string;
}

export default function Step7() {
  const router = useRouter();
  const { goToStep, setSchedule, schedule: initialSchedule } = useOnboardingStore();
  
  const [schedule, setLocalSchedule] = useState<Record<string, DaySchedule>>(
    initialSchedule || {
      monday: { open: true, start: '09:00', end: '18:00' },
      tuesday: { open: true, start: '09:00', end: '18:00' },
      wednesday: { open: true, start: '09:00', end: '18:00' },
      thursday: { open: true, start: '09:00', end: '18:00' },
      friday: { open: true, start: '09:00', end: '18:00' },
      saturday: { open: false, start: '09:00', end: '14:00' },
      sunday: { open: false, start: '09:00', end: '14:00' },
    }
  );

  const days = [
    { key: 'monday', name: 'Lunes', emoji: '📅' },
    { key: 'tuesday', name: 'Martes', emoji: '📅' },
    { key: 'wednesday', name: 'Miércoles', emoji: '📅' },
    { key: 'thursday', name: 'Jueves', emoji: '📅' },
    { key: 'friday', name: 'Viernes', emoji: '📅' },
    { key: 'saturday', name: 'Sábado', emoji: '📅' },
    { key: 'sunday', name: 'Domingo', emoji: '📅' },
  ];

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00'
  ];

  const toggleDay = (dayKey: string) => {
    setLocalSchedule({
      ...schedule,
      [dayKey]: {
        ...schedule[dayKey],
        open: !schedule[dayKey].open
      }
    });
  };

  const updateTime = (dayKey: string, type: 'start' | 'end', value: string) => {
    setLocalSchedule({
      ...schedule,
      [dayKey]: {
        ...schedule[dayKey],
        [type]: value
      }
    });
  };

  const handleContinue = () => {
    setSchedule(schedule);
    goToStep(8);
    router.push('/onboarding/step8');
  };

  const handleBack = () => {
    goToStep(6);
    router.back();
  };

  return (
    <View style={styles.container}>
      <OnboardingHeader
        currentStep={7}
        totalSteps={8}
        title="🕐 Horario Base"
        subtitle="¿Cuándo estás disponible?"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Define tu horario habitual. Podrás gestionar vacaciones y festivos más tarde en el Calendario.
        </Text>

        {days.map((day) => {
          const daySchedule = schedule[day.key];
          
          return (
            <View key={day.key} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <TouchableOpacity
                  style={styles.dayToggle}
                  onPress={() => toggleDay(day.key)}
                >
                  <View style={[styles.checkbox, daySchedule.open && styles.checkboxChecked]}>
                    {daySchedule.open && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.dayName, !daySchedule.open && styles.dayNameDisabled]}>
                    {day.emoji} {day.name}
                  </Text>
                </TouchableOpacity>

                {!daySchedule.open && (
                  <Text style={styles.closedBadge}>Cerrado</Text>
                )}
              </View>

              {daySchedule.open && (
                <View style={styles.timeSelector}>
                  <View style={styles.timeGroup}>
                    <Text style={styles.timeLabel}>Apertura</Text>
                    <View style={styles.timePicker}>
                      <Text style={styles.timeValue}>{daySchedule.start}</Text>
                    </View>
                  </View>

                  <Text style={styles.timeSeparator}>→</Text>

                  <View style={styles.timeGroup}>
                    <Text style={styles.timeLabel}>Cierre</Text>
                    <View style={styles.timePicker}>
                      <Text style={styles.timeValue}>{daySchedule.end}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            💡 <Text style={styles.bold}>Tip:</Text> Podrás ajustar horarios específicos, añadir descansos y gestionar excepciones desde el panel de control.
          </Text>
        </View>
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
  contentContainer: { padding: 20 },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dayNameDisabled: {
    color: '#9ca3af',
  },
  closedBadge: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  timeGroup: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  timePicker: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#9ca3af',
    marginHorizontal: 12,
  },
  noteCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  noteText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
});
