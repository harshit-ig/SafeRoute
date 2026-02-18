import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile, updateProfilePhoto, isLoading } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoUri, setPhotoUri] = useState(user?.profilePhoto || '');
  const [hasChanges, setHasChanges] = useState(false);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setHasChanges(true);
      // Upload photo immediately
      await updateProfilePhoto(uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setHasChanges(true);
      await updateProfilePhoto(uri);
    }
  };

  const handlePhotoOptions = () => {
    Alert.alert('Change Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Gallery', onPress: handlePickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    await updateProfile({
      name: name.trim(),
      email: email.trim() || undefined,
    });
    Alert.alert('Success', 'Profile updated successfully', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarSection} onPress={handlePhotoOptions} activeOpacity={0.8}>
          <View style={styles.avatarContainer}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {name ? name[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={18} color={Colors.white} />
            </View>
          </View>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>

        {/* Form */}
        <Input
          label="Full Name"
          placeholder="Your full name"
          value={name}
          onChangeText={handleChange(setName)}
          leftIcon="person-outline"
        />

        <Input
          label="Phone Number"
          value={user?.phone || ''}
          onChangeText={() => {}}
          leftIcon="call-outline"
          editable={false}
        />

        <Input
          label="Email (optional)"
          placeholder="your@email.com"
          value={email}
          onChangeText={handleChange(setEmail)}
          leftIcon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Save Button */}
        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={isLoading}
          disabled={!hasChanges}
          icon="checkmark"
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
  avatarSection: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.dark.background,
  },
  changePhotoText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.md,
  },
});
