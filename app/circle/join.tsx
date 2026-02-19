import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCircleStore } from '../../src/stores/circleStore';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';

export default function JoinCircleScreen() {
  const insets = useSafeAreaInsets();
  const { joinCircle, isLoading } = useCircleStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter an invite code');
      return;
    }
    if (trimmed.length < 4) {
      setError('Invalid code format');
      return;
    }
    setError('');
    const circle = await joinCircle(trimmed);
    if (circle) {
      router.back();
    } else {
      setError('Invalid or expired code. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Circle</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.iconCircle}>
            <Ionicons name="link" size={48} color={Colors.safeGreen} />
          </View>
          <Text style={styles.heading}>Join a Safe Circle</Text>
          <Text style={styles.subtitle}>
            Enter the invite code shared by the circle creator to join their Safe Circle.
          </Text>
        </View>

        {/* Code Input */}
        <View style={styles.codeContainer}>
          <Input
            label="Invite Code"
            placeholder="Enter code (e.g. ABC123)"
            value={code}
            onChangeText={(text) => {
              setCode(text.toUpperCase());
              setError('');
            }}
            error={error}
            leftIcon="key-outline"
            autoCapitalize="characters"
          />
        </View>

        {/* How it works */}
        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>How it works</Text>
          {[
            { step: '1', text: 'Ask the circle creator for their invite code' },
            { step: '2', text: 'Enter the code above and tap Join' },
            { step: '3', text: "You'll be added to the circle instantly" },
          ].map((item, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{item.step}</Text>
              </View>
              <Text style={styles.stepText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <Button
          title="Join Circle"
          onPress={handleJoin}
          loading={isLoading}
          icon="enter-outline"
          style={{ marginTop: Spacing.xl }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  content: {
    padding: Spacing.lg,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.safeGreen + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.safeGreen + '30',
  },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  codeContainer: {
    marginBottom: Spacing.lg,
  },
  stepsContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepsTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepNumber: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  stepText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
