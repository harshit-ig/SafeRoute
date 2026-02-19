import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useTripStore } from '../../src/stores/tripStore';
import LoadingScreen from '../../src/components/LoadingScreen';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Trip, TripStatus } from '../../src/types';
import { formatTime, formatDistance, calculateHaversineDistance } from '../../src/utils/helpers';
import { getCurrentLocation } from '../../src/utils/helpers';
import { decodePolyline, fetchRoute } from '../../src/utils/maps';
import { LatLng } from 'react-native-maps';
import { useLocationTracking } from '../../src/hooks/useLocationTracking';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ActiveTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { activeTrip, endTrip, sendSOS, isLoading, loadTripById } = useTripStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [untraveledRoute, setUntraveledRoute] = useState<LatLng[]>([]);
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Location tracking hook
  const {
    currentLocation,
    traveledPath,
    isTracking,
    distanceTraveled,
    startTracking,
    stopTracking,
  } = useLocationTracking({
    tripId: id || '',
    userId: user?.id || '',
    enabled: trip?.status === TripStatus.STARTED,
    updateInterval: 15000, // 15 seconds
    onLocationUpdate: (location) => {
      // Update untraveled route when location changes
      updateUntraveledRoute(location);
    },
    onError: (error) => {
      console.error('Location tracking error:', error);
    },
  });

  useEffect(() => {
    loadTrip();
  }, [id]);

  useEffect(() => {
    if (isEmergency) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isEmergency]);

  const loadTrip = async () => {
    if (!id) return;
    const t = await loadTripById(id);
    if (t) {
      setTrip(t);
      await loadRoutePolyline(t);
    } else if (activeTrip?.id === id) {
      setTrip(activeTrip);
      await loadRoutePolyline(activeTrip);
    }
  };

  const loadRoutePolyline = async (t: Trip) => {
    // First try to decode the stored encoded polyline
    if (t.routePolyline && t.routePolyline.length > 0) {
      try {
        const decoded = decodePolyline(t.routePolyline);
        if (decoded.length >= 2) {
          setRouteCoords(decoded);
          setUntraveledRoute(decoded); // Initially all route is untraveled
          return;
        }
      } catch {}
    }
    // Fallback: fetch from Directions API
    const src = { latitude: t.sourceLat, longitude: t.sourceLng };
    const dst = { latitude: t.destinationLat, longitude: t.destinationLng };
    const result = await fetchRoute(src, dst);
    if (result.coords.length >= 2) {
      setRouteCoords(result.coords);
      setUntraveledRoute(result.coords);
    }
  };

  // Find closest point on route and split into traveled/untraveled
  const updateUntraveledRoute = (currentLoc: LatLng) => {
    if (routeCoords.length < 2) return;

    let minDistance = Infinity;
    let closestIndex = 0;

    // Find closest point on the route
    routeCoords.forEach((coord, index) => {
      const distance = calculateHaversineDistance(
        currentLoc.latitude,
        currentLoc.longitude,
        coord.latitude,
        coord.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Update untraveled route (from closest point to destination)
    const remaining = routeCoords.slice(closestIndex);
    setUntraveledRoute(remaining);
  };

  const handleEndTrip = () => {
    Alert.alert('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip',
        onPress: async () => {
          if (trip) {
            await stopTracking(); // Stop location tracking
            await endTrip(trip.id);
            router.replace('/(tabs)/home');
          }
        },
      },
    ]);
  };

  const handleSOS = () => {
    if (isEmergency) {
      // Cancel SOS
      Alert.alert('Cancel Emergency', 'Confirm you are safe now?', [
        { text: 'No', style: 'cancel' },
        {
          text: "I'm Safe",
          onPress: () => setIsEmergency(false),
        },
      ]);
    } else {
      Alert.alert(
        '🚨 Emergency SOS',
        'This will alert all members of your Safe Circle with your current location. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send SOS',
            style: 'destructive',
            onPress: async () => {
              if (trip && user && currentLocation) {
                await sendSOS(
                  trip.id,
                  user.id,
                  currentLocation.latitude,
                  currentLocation.longitude,
                  'Emergency SOS - Help needed!'
                );
                setIsEmergency(true);
              }
            },
          },
        ]
      );
    }
  };

  const centerOnLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  if (!trip) return <LoadingScreen message="Loading trip..." />;

  const isActive = trip.status === TripStatus.STARTED || trip.status === TripStatus.PLANNED;
  const source = { latitude: trip.sourceLat, longitude: trip.sourceLng };
  const destination = { latitude: trip.destinationLat, longitude: trip.destinationLng };

  const remainingDist = currentLocation
    ? calculateHaversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        trip.destinationLat,
        trip.destinationLng
      )
    : null;

  // Calculate progress percentage
  const totalDistance = calculateHaversineDistance(
    trip.sourceLat,
    trip.sourceLng,
    trip.destinationLat,
    trip.destinationLng
  );
  const progressPercent = remainingDist !== null 
    ? Math.min(100, Math.max(0, ((totalDistance - remainingDist) / totalDistance) * 100))
    : 0;

  const statusColor = isEmergency
    ? Colors.dangerRed
    : trip.status === TripStatus.STARTED
    ? Colors.safeGreen
    : trip.status === TripStatus.COMPLETED
    ? Colors.primary
    : Colors.dark.textMuted;

  const statusLabel = isEmergency
    ? '🚨 Emergency Mode'
    : trip.status === TripStatus.STARTED
    ? isTracking
      ? '✓ On Route (Tracking)'
      : '✓ On Route'
    : trip.status === TripStatus.COMPLETED
    ? '✓ Trip Completed'
    : 'Trip Planned';

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: statusColor, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonOverlay}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: (trip.sourceLat + trip.destinationLat) / 2,
          longitude: (trip.sourceLng + trip.destinationLng) / 2,
          latitudeDelta: Math.abs(trip.sourceLat - trip.destinationLat) * 1.5 + 0.01,
          longitudeDelta: Math.abs(trip.sourceLng - trip.destinationLng) * 1.5 + 0.01,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker coordinate={source} title="Start" pinColor="green" />
        <Marker coordinate={destination} title="Destination" pinColor="red" />
        {currentLocation && (
          <Marker coordinate={currentLocation} title="You" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.currentLocMarker}>
              <View style={styles.currentLocDot} />
            </View>
          </Marker>
        )}
        
        {/* Route Visualization: Gray (traveled) + Blue (untraveled) */}
        {routeCoords.length >= 2 && (
          <>
            {/* Traveled path - Grey */}
            {traveledPath.length >= 2 && (
              <>
                <Polyline
                  coordinates={traveledPath}
                  strokeColor={'rgba(128, 128, 128, 0.3)'}
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                />
                <Polyline
                  coordinates={traveledPath}
                  strokeColor={'#808080'}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            )}
            
            {/* Untraveled route - Blue */}
            {untraveledRoute.length >= 2 && (
              <>
                <Polyline
                  coordinates={untraveledRoute}
                  strokeColor={Colors.primary + '35'}
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                />
                <Polyline
                  coordinates={untraveledRoute}
                  strokeColor={Colors.primary}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            )}
          </>
        )}
      </MapView>

      {/* Info Panel */}
      <View style={[styles.infoPanel, { paddingBottom: isActive ? 180 : insets.bottom + 20 }]}>
        <Card style={styles.infoCard}>
          <Text style={styles.destText} numberOfLines={1}>
            📍 {trip.destinationAddress}
          </Text>
          
          {/* Progress Bar */}
          {trip.status === TripStatus.STARTED && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(progressPercent)}% complete</Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            {trip.estimatedDuration && (
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoValue}>{Math.round(trip.estimatedDuration)} min</Text>
              </View>
            )}
            {remainingDist !== null && (
              <View style={styles.infoItem}>
                <Ionicons name="navigate-outline" size={16} color={Colors.safeGreen} />
                <Text style={styles.infoValue}>{formatDistance(remainingDist)}</Text>
              </View>
            )}
            {distanceTraveled > 0 && (
              <View style={styles.infoItem}>
                <Ionicons name="footsteps-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoValue}>{formatDistance(distanceTraveled / 1000)}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Ionicons name="warning-outline" size={16} color={Colors.warningOrange} />
              <Text style={styles.infoValue}>{trip.deviationCount}</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* My Location FAB */}
      <TouchableOpacity style={[styles.locFab, { top: insets.top + 70 }]} onPress={centerOnLocation}>
        <Ionicons name="locate" size={22} color={Colors.primary} />
      </TouchableOpacity>

      {/* Action Buttons */}
      {isActive && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <Animated.View style={{ flex: 1, transform: [{ scale: isEmergency ? pulseAnim : 1 }] }}>
            <TouchableOpacity
              style={[
                styles.sosButton,
                isEmergency ? styles.safeButton : {},
              ]}
              onPress={handleSOS}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isEmergency ? 'shield-checkmark' : 'alert-circle'}
                size={24}
                color={Colors.white}
              />
              <Text style={styles.sosText}>
                {isEmergency ? "I'm Safe Now" : 'Emergency SOS'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={styles.endButton} onPress={handleEndTrip} activeOpacity={0.8}>
            <Ionicons name="stop-circle" size={22} color={Colors.white} />
            <Text style={styles.endText}>End</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    zIndex: 10,
  },
  backButtonOverlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  map: {
    flex: 1,
  },
  currentLocMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 99, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.lg,
  },
  destText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.dark.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.safeGreen,
    borderRadius: 3,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    marginLeft: 6,
  },
  locFab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerRed,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    marginRight: Spacing.md,
    ...Shadows.md,
  },
  safeButton: {
    backgroundColor: Colors.safeGreen,
  },
  sosText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    marginLeft: 8,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  endText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
    marginLeft: 6,
  },
});
