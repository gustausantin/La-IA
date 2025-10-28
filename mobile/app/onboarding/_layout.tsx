import { View } from 'react-native';
import { Slot } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}

