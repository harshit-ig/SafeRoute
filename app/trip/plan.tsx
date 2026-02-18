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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useTripStore } from '../../src/stores/tripStore';
import { useRouteStore } from '../../src/stores/routeStore';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import Card from '../../src/components/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { SavedRoute } from '../../src/types';
import { getCurrentLocation } from '../../src/utils/helpers';

export default function PlanTripScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { startTrip, isLoading } = useTripStore();
  const { routes, loadRoutes } = useRouteStore();

  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationLat, setDestinationLat] = useState('');
  const [destinationLng, setDestinationLng] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);

  React.useEffect(() => {
    loadRoutes();
  }, []);

  const handleSelectRoute = (route: SavedRoute) => {
    setSelectedRoute(route);
    setDestinationAddress(route.destinationAddress || '');
    setDestinationLat(route.destinationLat?.toString() || '');
    setDestinationLng(route.destinationLng?.toString() || '');
    setShowRoutes(false);
  };

  const handleStartTrip = async () => {
    if (!destinationAddress.trim()) {
      Alert.alert('Error', 'Please enter a destination address');
      return;
    }
    if (!destinationLat || !destinationLng) {
      Alert.alert('Error', 'Please enter destination coordinates');
      return;
    }
    if (!user) return;

    const loc = await getCurrentLocation();
    if (!loc) {
      Alert.alert('Error', 'Unable to get current location. Please enable location services.');
      return;
    }

    const trip = await startTrip({
      userId: user.id,
      sourceLat: loc.latitude,
      sourceLng: loc.longitude,
      sourceAddress: 'Current Location',
      destinationLat: parseFloat(destinationLat),
      destinationLng: parseFloat(destinationLng),
      destinationAddress: destinationAddress.trim(),
      estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
      routeId: selectedRoute?.id,
    });

    if (trip) {
      router.replace(`/trip/${trip.id}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan a Trip</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Saved Routes */}
        <TouchableOpacity
          style={styles.savedRouteBtn}
          onPress={() => setShowRoutes(!showRoutes)}
          activeOpacity={0.8}
        >
          <Ionicons name="bookmarks-outline" size={20} color={Colors.primary} />
          <Text style={styles.savedRouteText}>
            {selectedRoute ? selectedRoute.name : 'Choose from Saved Routes'}
          </Text>
          <Ionicons
            name={showRoutes ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.dark.textMuted}
          />
        </TouchableOpacity>

        {showRoutes && (
          <Card style={styles.routeList}>
            {routes.length === 0 ? (
              <Text style={styles.emptyRoutes}>No saved routes yet</Text>
            ) : (
              routes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={[
                    styles.routeItem,
                    selectedRoute?.id === route.id && styles.routeItemSelected,
                  ]}
                  onPress={() => handleSelectRoute(route)}
                >
                  <Ionicons name="map-outline" size={18} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.routeName}>{route.name}</Text>
                    {route.destinationAddress && (
                      <Text style={styles.routeAddr} numberOfLines={1}>
                        {route.destinationAddress}
                      </Text>
                    )}
                  </View>
                  {selectedRoute?.id === route.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.safeGreen} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </Card>
        )}

        {/* Destination */}
        <Text style={styles.sectionTitle}>Destination</Text>
        <Input
          label="Destination Address"
          placeholder="Where are you going?"
          value={destinationAddress}
          onChangeText={setDestinationAddress}
          leftIcon="location-outline"
        />
        <View style={styles.coordRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Input
              label="Latitude"
              placeholder="e.g. 36.7538"
              value={destinationLat}
              onChangeText={setDestinationLat}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Input
              label="Longitude"
              placeholder="e.g. 3.0588"
              value={destinationLng}
              onChangeText={setDestinationLng}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Details */}
        <Text style={styles.sectionTitle}>Details</Text>
        <Input
          label="Estimated Duration (minutes)"
          placeholder="e.g. 30"
          value={estimatedDuration}
          onChangeText={setEstimatedDuration}
          keyboardType="numeric"
          leftIcon="time-outline"
        />

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="location" size={20} color={Colors.safeGreen} />
            <Text style={styles.summaryText}>📍 Current Location</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Ionicons name="flag" size={20} color={Colors.dangerRed} />
            <Text style={styles.summaryText}>
              {destinationAddress || 'Set your destination...'}
            </Text>
          </View>
          {selectedRoute && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Ionicons name="map" size={20} color={Colors.primary} />
                <Text style={styles.summaryText}>
                  Route: {selectedRoute.name}
                </Text>
              </View>
            </>
          )}
        </Card>

        <Button
          title="Start Trip"
          onPress={handleStartTrip}
          loading={isLoading}
          icon="navigate"
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
  savedRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.lg,
  },
  savedRouteText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.dark.text,
    marginLeft: Spacing.md,
  },
  routeList: {
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  emptyRoutes: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    padding: Spacing.md,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
  },
  routeItemSelected: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  routeName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.dark.text,
  },
  routeAddr: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  coordRow: {
    flexDirection: 'row',
  },
  summaryCard: {
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.md,
    flex: 1,
  },
  summaryDivider: {
    width: 2,
    height: 24,
    backgroundColor: Colors.dark.border,
    marginLeft: 9,
    marginVertical: 4,
  },
});
