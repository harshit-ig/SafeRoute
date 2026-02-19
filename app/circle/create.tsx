import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCircleStore } from '../../src/stores/circleStore';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import Card from '../../src/components/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';

export default function CreateCircleScreen() {
  const insets = useSafeAreaInsets();
  const { createCircle, isLoading } = useCircleStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a name for your Safe Circle');
      return;
    }
    if (name.trim().length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }
    setError('');
    const circle = await createCircle(name.trim());
    if (circle) {
      router.back();
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
        <Text style={styles.headerTitle}>Create Circle</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.heading}>Your Safe Circle</Text>
          <Text style={styles.subtitle}>
            Create a circle for your family and friends. They'll be able to see your trips and receive emergency alerts.
          </Text>
        </View>

        <Input
          label="Circle Name"
          placeholder="e.g. Family Circle"
          value={name}
          onChangeText={(text) => { setName(text); setError(''); }}
          error={error}
          leftIcon="people-outline"
        />

        {/* Features */}
        <Card style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>What members can do:</Text>
          {[
            { icon: 'eye-outline', text: 'View your active trips in real-time' },
            { icon: 'notifications-outline', text: 'Receive emergency SOS alerts' },
            { icon: 'location-outline', text: 'See your location during trips' },
            { icon: 'shield-checkmark-outline', text: 'Get notified of route deviations' },
          ].map((item, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={item.icon as any} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          ))}
        </Card>

        <Button
          title="Create Safe Circle"
          onPress={handleCreate}
          loading={isLoading}
          icon="add-circle"
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
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
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
  featuresCard: {
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  featuresTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
});
