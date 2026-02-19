import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    console.log('[RootLayout] Component mounted, starting initialization');
    
    // Add a timeout fallback
    const timeout = setTimeout(() => {
      console.log('[RootLayout] Initialization timeout - forcing initialized state');
      useAuthStore.setState({ isInitialized: true });
    }, 5000); // 5 second timeout

    initialize().finally(() => {
      clearTimeout(timeout);
      console.log('[RootLayout] Initialization complete');
    });

    return () => clearTimeout(timeout);
  }, []);

  console.log('[RootLayout] Render - isInitialized:', isInitialized);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.background },
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
});
