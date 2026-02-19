import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useTripStore } from '../../src/stores/tripStore';
import { useLocationStore } from '../../src/stores/locationStore';
import LoadingScreen from '../../src/components/LoadingScreen';
import { Colors, FontSize, FontWeight, BorderRadius, Shadows } from '../../src/constants/theme';
import { Trip, TripStatus } from '../../src/types';
import { formatDuration, formatTime, calculateHaversineDistance } from '../../src/utils/helpers';
import { getCurrentLocation } from '../../src/utils/helpers';
import { decodePolyline, fetchAllRoutes } from '../../src/utils/maps';

// ─── Constants ───────────────────────────────────────────────
const NAV_TILT = 50;
const NAV_ZOOM_DELTA = 0.004;
const LOCATION_POLL_MS = 4000; // 4 s between backend pings

// ─── Dark nav map style ─────────────────────────────────────
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

// ─── Types ───────────────────────────────────────────────────
interface BackendStatus {
  progressIndex: number;
  isDeviated: boolean;
  isGoingBackward: boolean;
  hasJoinedRoute: boolean;
  distanceFromRoute: number;
  threshold: number;
  remainingDistance: number;
  etaSeconds: number;
  deviationCount: number;
  totalPoints: number;
  activeRouteIndex: number;
  tripCompleted?: boolean;
  distanceToDestination?: number;
}

// ─── Component ───────────────────────────────────────────────
export default function ActiveTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { activeTrip, endTrip, sendSOS, loadTripById, updateLocation } = useTripStore();

  const globalLat = useLocationStore((s) => s.latitude);
  const globalLng = useLocationStore((s) => s.longitude);

  // ─── State ───
  const [trip, setTrip] = useState<Trip | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [altRouteCoords, setAltRouteCoords] = useState<LatLng[][]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [tripCompleted, setTripCompleted] = useState(false);
  const completedHandled = useRef(false);

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const emergencyGlow = useRef(new Animated.Value(0)).current;
  const hasInitialFit = useRef(false);
  const tripRef = useRef<Trip | null>(null);
  // keep a mutable ref to trip for async callbacks
  useEffect(() => { tripRef.current = trip; }, [trip]);

  // ─── Seed location from global store ───
  useEffect(() => {
    if (globalLat != null && globalLng != null && !currentLocation) {
      setCurrentLocation({ latitude: globalLat, longitude: globalLng });
    }
  }, [globalLat, globalLng]);

  // ─── Load trip + start polling ───
  useEffect(() => {
    loadTrip();
    fetchAndPing(); // first ping
    const iv = setInterval(fetchAndPing, LOCATION_POLL_MS);
    return () => clearInterval(iv);
  }, [id]);

  // ─── Emergency animations ───
  useEffect(() => {
    if (isEmergency) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(emergencyGlow, { toValue: 1, duration: 700, useNativeDriver: false }),
          Animated.timing(emergencyGlow, { toValue: 0, duration: 700, useNativeDriver: false }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
      emergencyGlow.setValue(0);
    }
  }, [isEmergency]);

  // ─── Initial fit to full route once ───
  useEffect(() => {
    if (routeCoords.length >= 2 && !hasInitialFit.current && mapRef.current) {
      const all = [...routeCoords, ...altRouteCoords.flat()];
      if (currentLocation) all.push(currentLocation);
      mapRef.current.fitToCoordinates(all, {
        edgePadding: { top: 140, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
      hasInitialFit.current = true;
      setTimeout(() => {
        if (!userInteracted) animateToUser();
      }, 2500);
    }
  }, [routeCoords]);

  // ─── Auto-follow user (Google Maps nav style) ───
  useEffect(() => {
    if (currentLocation && isFollowing && !userInteracted && routeCoords.length >= 2 && hasInitialFit.current) {
      animateToUser();
    }
  }, [currentLocation, isFollowing, userInteracted]);

  // ─── Derived: active route coords (switches when backend says user is on alt route) ───
  const activeRouteIdx = backendStatus?.activeRouteIndex ?? 0;
  const activeRouteCoords = useMemo(() => {
    if (activeRouteIdx === 0 || altRouteCoords.length === 0) return routeCoords;
    // activeRouteIndex 0 = primary, 1 = first alt, 2 = second alt, etc.
    const altIdx = activeRouteIdx - 1;
    if (altIdx >= 0 && altIdx < altRouteCoords.length) return altRouteCoords[altIdx];
    return routeCoords;
  }, [activeRouteIdx, routeCoords, altRouteCoords]);

  // ─── Derived: split route using BACKEND progressIndex ───
  const progressIdx = backendStatus?.progressIndex ?? 0;
  const { coveredCoords, remainingCoords } = useMemo(() => {
    if (activeRouteCoords.length < 2) return { coveredCoords: [] as LatLng[], remainingCoords: activeRouteCoords };
    const idx = Math.max(0, Math.min(progressIdx, activeRouteCoords.length - 1));
    return {
      coveredCoords: activeRouteCoords.slice(0, idx + 1),
      remainingCoords: activeRouteCoords.slice(idx),
    };
  }, [progressIdx, activeRouteCoords]);

  const isDeviated = backendStatus?.isDeviated ?? false;
  const isGoingBackward = backendStatus?.isGoingBackward ?? false;
  const hasJoinedRoute = backendStatus?.hasJoinedRoute ?? false;
  const distFromRoute = backendStatus?.distanceFromRoute ?? 0;

  // ─── Helpers ───
  const animateToUser = () => {
    if (!currentLocation || !mapRef.current) return;
    let heading = 0;
    const coords = activeRouteCoords.length >= 2 ? activeRouteCoords : routeCoords;
    if (coords.length > 0) {
      const nextIdx = Math.min(progressIdx + 3, coords.length - 1);
      heading = computeBearing(currentLocation, coords[nextIdx]);
    }
    mapRef.current.animateCamera(
      { center: currentLocation, pitch: NAV_TILT, heading, zoom: 17 },
      { duration: 800 },
    );
  };

  const loadTrip = async () => {
    if (!id) { setLoadFailed(true); return; }
    if (activeTrip?.id === id) {
      setTrip(activeTrip);
      await loadRoutePolyline(activeTrip);
      return;
    }
    const t = await loadTripById(id);
    if (t) { setTrip(t); await loadRoutePolyline(t); }
    else setLoadFailed(true);
  };

  const loadRoutePolyline = async (t: Trip) => {
    if (t.routePolyline && t.routePolyline.length > 0) {
      try {
        const decoded = decodePolyline(t.routePolyline);
        if (decoded.length >= 2) {
          setRouteCoords(decoded);
          // Decode alternative polylines
          if (t.alternativePolylines?.length) {
            const alts = t.alternativePolylines
              .map(poly => { try { return decodePolyline(poly); } catch { return []; } })
              .filter(coords => coords.length >= 2);
            console.log(`[loadRoutePolyline] Decoded ${alts.length} alternative routes`);
            setAltRouteCoords(alts);
          } else {
            console.log('[loadRoutePolyline] No alternative polylines stored on trip');
          }
          return;
        }
      } catch {}
    }
    // Fallback: fetch routes live
    const result = await fetchAllRoutes(
      { latitude: t.sourceLat, longitude: t.sourceLng },
      { latitude: t.destinationLat, longitude: t.destinationLng },
    );
    if (result.primary.coords.length >= 2) {
      setRouteCoords(result.primary.coords);
      const alts = result.alternatives
        .map(poly => { try { return decodePolyline(poly); } catch { return []; } })
        .filter(coords => coords.length >= 2);
      console.log(`[loadRoutePolyline] Fallback fetched ${alts.length} alternative routes`);
      setAltRouteCoords(alts);
    }
  };

  /** Fetch GPS + ping backend to compute deviation server-side */
  const fetchAndPing = async () => {
    if (completedHandled.current) return;
    const loc = await getCurrentLocation();
    if (!loc) return;
    setCurrentLocation(loc);

    const t = tripRef.current;
    if (!t) return;
    const isActive = t.status === TripStatus.STARTED || t.status === TripStatus.PLANNED;
    if (!isActive) return;

    // POST to backend
    const result = await updateLocation(t.id, loc.latitude, loc.longitude);
    if (result) {
      setBackendStatus(result);
      // ── Auto-complete: backend detected arrival at destination ──
      if (result.tripCompleted && !completedHandled.current) {
        completedHandled.current = true;
        setTripCompleted(true);
      }
    }
  };

  // ─── Actions ───
  const handleEndTrip = () => {
    Alert.alert('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip',
        onPress: async () => {
          if (trip) { await endTrip(trip.id); router.replace('/(tabs)/home'); }
        },
      },
    ]);
  };

  const handleSOS = () => {
    if (isEmergency) {
      Alert.alert('Cancel Emergency', 'Confirm you are safe now?', [
        { text: 'No', style: 'cancel' },
        { text: "I'm Safe", onPress: () => setIsEmergency(false) },
      ]);
    } else {
      Alert.alert(
        'Emergency SOS',
        'This will alert all members of your Safe Circle with your current location.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send SOS',
            style: 'destructive',
            onPress: async () => {
              if (trip && user && currentLocation) {
                await sendSOS(trip.id, user.id, currentLocation.latitude, currentLocation.longitude, 'Emergency SOS');
                setIsEmergency(true);
              }
            },
          },
        ],
      );
    }
  };

  const handleRecenter = () => {
    setUserInteracted(false);
    setIsFollowing(true);
    animateToUser();
  };

  const handleFitRoute = () => {
    if (routeCoords.length >= 2 && mapRef.current) {
      setUserInteracted(true);
      setIsFollowing(false);
      const all = [...routeCoords, ...altRouteCoords.flat()];
      if (currentLocation) all.push(currentLocation);
      mapRef.current.fitToCoordinates(all, {
        edgePadding: { top: 140, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    }
  };

  // ─── Loading / Error ───
  if (!trip) {
    if (loadFailed) {
      return (
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="warning-outline" size={48} color={Colors.warningOrange} />
          <Text style={styles.errorTitle}>Trip not found</Text>
          <Text style={styles.errorSub}>This trip may have failed to start or no longer exists.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <LoadingScreen message="Loading trip..." />;
  }

  // ─── Derived state ───
  const isActive = trip.status === TripStatus.STARTED || trip.status === TripStatus.PLANNED;
  const isCompleted = trip.status === TripStatus.COMPLETED;
  const source: LatLng = { latitude: trip.sourceLat, longitude: trip.sourceLng };
  const destination: LatLng = { latitude: trip.destinationLat, longitude: trip.destinationLng };

  // Use backend data for distance & ETA when available
  const remainingDist = backendStatus
    ? backendStatus.remainingDistance
    : currentLocation
    ? calculateHaversineDistance(currentLocation.latitude, currentLocation.longitude, trip.destinationLat, trip.destinationLng)
    : null;

  const etaSeconds = backendStatus?.etaSeconds ?? null;
  const etaMin = etaSeconds !== null ? Math.max(0, Math.round(etaSeconds / 60)) : null;

  const elapsedMs = Date.now() - trip.startTime;
  const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60000));

  const arrivalTime = etaMin !== null ? formatTime(Date.now() + etaMin * 60000) : null;

  const deviationCount = backendStatus?.deviationCount ?? trip.deviationCount ?? 0;

  // Status label & color
  const isApproaching = isActive && !hasJoinedRoute && backendStatus !== null;

  const statusLabel = isEmergency
    ? 'EMERGENCY'
    : isGoingBackward
    ? 'WRONG WAY'
    : isDeviated
    ? 'OFF ROUTE'
    : isApproaching
    ? 'APPROACHING'
    : isActive
    ? 'ON ROUTE'
    : isCompleted
    ? 'COMPLETED'
    : trip.status;

  const statusColor = isEmergency
    ? Colors.dangerRed
    : isGoingBackward
    ? Colors.dangerRed
    : isDeviated
    ? Colors.warningOrange
    : isApproaching
    ? Colors.primary
    : isActive
    ? Colors.safeGreen
    : Colors.primary;

  const emergencyBorderColor = emergencyGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(239,68,68,0)', 'rgba(239,68,68,0.6)'],
  });

  // Format remaining distance
  const fmtRemaining = remainingDist !== null
    ? remainingDist < 1000
      ? `${Math.round(remainingDist)} m`
      : `${(remainingDist / 1000).toFixed(1)} km`
    : '--';

  // ─── Bottom panel height for edge padding calcs ───
  const BOTTOM_PANEL_H = isActive ? 230 : 190;

  return (
    <View style={styles.container}>
      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: currentLocation?.latitude ?? trip.sourceLat,
          longitude: currentLocation?.longitude ?? trip.sourceLng,
          latitudeDelta: NAV_ZOOM_DELTA,
          longitudeDelta: NAV_ZOOM_DELTA,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={darkMapStyle}
        mapType="standard"
        onPanDrag={() => { setUserInteracted(true); setIsFollowing(false); }}
      >
        {/* Alternative routes (semi-transparent distinct color) */}
        {altRouteCoords.map((altCoords, idx) => {
          // Don't render the active alt route here — it's rendered via covered/remaining
          if (activeRouteIdx > 0 && idx === activeRouteIdx - 1) return null;
          return altCoords.length >= 2 ? (
            <React.Fragment key={`alt-${idx}`}>
              {/* Glow */}
              <Polyline
                coordinates={altCoords}
                strokeColor="rgba(100,160,200,0.12)"
                strokeWidth={10}
              />
              {/* Line */}
              <Polyline
                coordinates={altCoords}
                strokeColor="rgba(100,160,200,0.45)"
                strokeWidth={4}
              />
            </React.Fragment>
          ) : null;
        })}

        {/* Primary route (faded) when user is on an alternative */}
        {activeRouteIdx > 0 && routeCoords.length >= 2 && (
          <>
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(100,160,200,0.12)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(100,160,200,0.45)"
              strokeWidth={4}
            />
          </>
        )}

        {/* Covered portion (soft teal trail) */}
        {coveredCoords.length >= 2 && (
          <Polyline coordinates={coveredCoords} strokeColor="rgba(0,180,220,0.35)" strokeWidth={6} />
        )}

        {/* Remaining (active) — glow + line */}
        {remainingCoords.length >= 2 && (
          <>
            <Polyline
              coordinates={remainingCoords}
              strokeColor={isDeviated ? Colors.warningOrange + '25' : 'rgba(0,210,255,0.18)'}
              strokeWidth={12}
            />
            <Polyline
              coordinates={remainingCoords}
              strokeColor={isDeviated ? Colors.warningOrange : '#00D2FF'}
              strokeWidth={5}
            />
          </>
        )}

        {/* Source marker */}
        <Marker coordinate={source} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.srcDotOuter}>
            <View style={styles.srcDotInner} />
          </View>
        </Marker>

        {/* Destination marker */}
        <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.destPin}>
            <View style={styles.destPinHead}>
              <Ionicons name="flag" size={12} color="#fff" />
            </View>
            <View style={styles.destPinStem} />
          </View>
        </Marker>
      </MapView>

      {/* ── Emergency border ── */}
      {isEmergency && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderWidth: 4, borderColor: emergencyBorderColor }]}
        />
      )}

      {/* ── Top: Google-Maps-style green ETA bar ── */}
      <View style={[styles.etaBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.etaCenterBlock}>
          {isActive && etaMin !== null ? (
            <>
              <Text style={styles.etaBigNumber}>{etaMin}</Text>
              <Text style={styles.etaMinLabel}>min</Text>
            </>
          ) : isCompleted ? (
            <Text style={styles.etaMinLabel}>Trip Completed</Text>
          ) : (
            <Text style={styles.etaMinLabel}>--</Text>
          )}
        </View>

        <View style={styles.etaRightBlock}>
          <Text style={styles.etaArrival}>{arrivalTime ?? '--'}</Text>
          <Text style={styles.etaDistance}>{fmtRemaining}</Text>
        </View>
      </View>

      {/* ── Status pill (below ETA bar) ── */}
      <View style={[styles.statusPillRow, { top: insets.top + 64 }]}>
        <View style={[styles.statusPill, { borderColor: statusColor + '60', backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {(isDeviated || isApproaching) && (
          <Text style={[styles.deviationHint, isGoingBackward && { color: Colors.dangerRed }, isApproaching && { color: Colors.primary }]}>
            {isGoingBackward ? 'Moving backward on route' : isApproaching ? `${Math.round(distFromRoute)}m to route` : `${Math.round(distFromRoute)}m from route`}
          </Text>
        )}
      </View>

      {/* ── Right FABs ── */}
      <View style={[styles.fabCol, { bottom: BOTTOM_PANEL_H + 16 }]}>
        {(!isFollowing || userInteracted) && (
          <TouchableOpacity style={styles.fab} onPress={handleRecenter}>
            <Ionicons name="navigate" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.fab, { marginTop: 10 }]} onPress={handleFitRoute}>
          <Ionicons name="expand-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Bottom panel (card + action bar in ONE container) ── */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.bottomHandle} />

        {/* Route from → to */}
        <View style={styles.routeRow}>
          <View style={styles.routeDots}>
            <View style={[styles.dot, { backgroundColor: Colors.safeGreen }]} />
            <View style={styles.dotLine} />
            <View style={[styles.dot, { backgroundColor: Colors.dangerRed }]} />
          </View>
          <View style={styles.routeLabels}>
            <Text style={styles.routeText} numberOfLines={1}>{trip.sourceAddress || 'Start'}</Text>
            <Text style={styles.routeText} numberOfLines={1}>{trip.destinationAddress || 'Destination'}</Text>
          </View>
          <View style={styles.routeTimes}>
            <Text style={styles.routeTimeText}>{formatTime(trip.startTime)}</Text>
            <Text style={styles.routeTimeText}>{arrivalTime ? `~${arrivalTime}` : '--'}</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Ionicons name="speedometer-outline" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{fmtRemaining}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{elapsedMin} min</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="warning-outline" size={14} color={deviationCount > 0 ? Colors.warningOrange : Colors.dark.textMuted} />
            <Text style={[styles.statText, deviationCount > 0 && { color: Colors.warningOrange }]}>
              {deviationCount} dev
            </Text>
          </View>
        </View>

        {/* Completed extra */}
        {isCompleted && (
          <View style={styles.completedRow}>
            <View style={styles.completedItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.safeGreen} />
              <Text style={styles.completedText}>
                {trip.endTime ? formatDuration(Math.round((trip.endTime - trip.startTime) / 60000)) : '--'}
              </Text>
            </View>
            <View style={styles.completedItem}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.warningOrange} />
              <Text style={styles.completedText}>{deviationCount} deviations</Text>
            </View>
            <View style={styles.completedItem}>
              <Ionicons name="pause-circle-outline" size={16} color={Colors.dark.textMuted} />
              <Text style={styles.completedText}>{trip.stopCount} stops</Text>
            </View>
          </View>
        )}

        {/* Action buttons (inside the card, no separate actionBar) */}
        {isActive && (
          <View style={styles.actionRow}>
            <Animated.View style={{ flex: 1, transform: [{ scale: isEmergency ? pulseAnim : 1 }] }}>
              <TouchableOpacity
                style={[styles.sosBtn, isEmergency && { backgroundColor: Colors.safeGreen }]}
                onPress={handleSOS}
                activeOpacity={0.8}
              >
                <Ionicons name={isEmergency ? 'shield-checkmark' : 'alert-circle'} size={22} color="#fff" />
                <Text style={styles.sosBtnText}>{isEmergency ? "I'm Safe" : 'SOS'}</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndTrip} activeOpacity={0.8}>
              <Ionicons name="square" size={16} color="#fff" />
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Arrival overlay ── */}
      {tripCompleted && (
        <View style={styles.arrivalOverlay}>
          <View style={styles.arrivalCard}>
            <View style={styles.arrivalIconCircle}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.safeGreen} />
            </View>
            <Text style={styles.arrivalTitle}>You've Arrived!</Text>
            <Text style={styles.arrivalSubtitle}>
              {trip.destinationAddress || 'Destination reached'}
            </Text>
            <View style={styles.arrivalStatsRow}>
              <View style={styles.arrivalStat}>
                <Text style={styles.arrivalStatValue}>{elapsedMin}</Text>
                <Text style={styles.arrivalStatLabel}>min</Text>
              </View>
              <View style={styles.arrivalStatDivider} />
              <View style={styles.arrivalStat}>
                <Text style={styles.arrivalStatValue}>{deviationCount}</Text>
                <Text style={styles.arrivalStatLabel}>deviations</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.arrivalBtn}
              onPress={() => router.replace('/(tabs)/home')}
              activeOpacity={0.8}
            >
              <Ionicons name="home" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.arrivalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Bearing helper ──────────────────────────────────────────
function computeBearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },

  // ── ETA bar (Google-Maps-style green bar) ──
  etaBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 20,
  },
  navBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaCenterBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  etaBigNumber: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  etaMinLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: '#ffffffCC',
    marginLeft: 4,
  },
  etaRightBlock: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  etaArrival: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  etaDistance: {
    fontSize: FontSize.sm,
    color: '#ffffffAA',
    marginTop: 2,
  },

  // ── Status pill ──
  statusPillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  deviationHint: {
    fontSize: FontSize.xs,
    color: Colors.warningOrange,
    marginTop: 4,
    fontWeight: FontWeight.medium,
  },

  // ── FABs ──
  fabCol: {
    position: 'absolute',
    right: 14,
    zIndex: 10,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface + 'F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },

  // ── Markers ──
  srcDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.safeGreen + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  srcDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.safeGreen,
    borderWidth: 2,
    borderColor: '#fff',
  },
  destPin: { alignItems: 'center' },
  destPinHead: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.dangerRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destPinStem: {
    width: 3,
    height: 8,
    backgroundColor: Colors.dangerRed,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  // ── Bottom panel (single container that holds card + action buttons) ──
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.dark.border,
    ...Shadows.lg,
    zIndex: 10,
  },
  bottomHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.surfaceLight,
    alignSelf: 'center',
    marginBottom: 12,
  },

  // Route row
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeDots: {
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 2,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLine: {
    width: 2,
    height: 18,
    backgroundColor: Colors.dark.surfaceLight,
    marginVertical: 2,
  },
  routeLabels: {
    flex: 1,
    justifyContent: 'space-between',
    height: 40,
  },
  routeText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
  },
  routeTimes: {
    justifyContent: 'space-between',
    height: 40,
    alignItems: 'flex-end',
  },
  routeTimeText: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    fontWeight: FontWeight.medium,
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: BorderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  statText: {
    fontSize: FontSize.xs,
    color: Colors.dark.textSecondary,
    marginLeft: 5,
    fontWeight: FontWeight.medium,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.dark.surfaceLight,
    marginHorizontal: 4,
  },

  // Completed
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.dark.background,
    borderRadius: BorderRadius.sm,
    padding: 10,
    marginBottom: 8,
  },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    marginLeft: 6,
  },

  // Action row (inside bottom panel)
  actionRow: {
    flexDirection: 'row',
    paddingTop: 4,
    paddingBottom: 2,
  },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerRed,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    marginRight: 10,
    ...Shadows.md,
  },
  sosBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginLeft: 8,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  endBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: '#fff',
    marginLeft: 6,
  },

  // Error
  errorTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginTop: 16,
  },
  errorSub: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorBtn: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  errorBtnText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },

  // Arrival overlay
  arrivalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  arrivalCard: {
    width: '82%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    ...Shadows.md,
  },
  arrivalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.safeGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  arrivalTitle: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  arrivalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  arrivalStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  arrivalStat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  arrivalStatValue: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  arrivalStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  arrivalStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.dark.border,
  },
  arrivalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.safeGreen,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
  },
  arrivalBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
});
