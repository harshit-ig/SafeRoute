import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/stores/authStore';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfilePhoto, isLoading } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        await updateProfilePhoto(base64);
      } catch {
        Alert.alert('Error', 'Failed to update profile photo');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/profile/edit')}>
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar */}
        <TouchableOpacity onPress={handlePickImage} style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {user?.profilePhoto ? (
              <Image
                source={{ uri: user.profilePhoto }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={48} color={Colors.dark.textMuted} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color={Colors.white} />
            </View>
          </View>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profilePhone}>{user?.phoneNumber || ''}</Text>
        </TouchableOpacity>

        {/* Contact Info Card */}
        <Card style={styles.infoCard} title="Contact Information">
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user?.phoneNumber || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Safe Circle</Text>
              <Text style={styles.infoValue}>{user?.groupCode || 'Not joined'}</Text>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <Card style={styles.actionCard}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/profile/edit')}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primaryFaded }]}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.actionText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/(tabs)/circles')}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.safeGreenFaded }]}>
              <Ionicons name="shield-outline" size={20} color={Colors.safeGreen} />
            </View>
            <Text style={styles.actionText}>Safe Circle</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.dangerRedFaded }]}>
              <Ionicons name="log-out-outline" size={20} color={Colors.dangerRed} />
            </View>
            <Text style={[styles.actionText, { color: Colors.dangerRed }]}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 100,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.dark.background,
  },
  profileName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  profilePhone: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: FontSize.md,
    color: Colors.dark.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  actionCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.dark.text,
  },
});
