import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/theme';

export default function CircleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
