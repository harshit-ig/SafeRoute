import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, Polyline, MapPressEvent, LatLng, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRouteStore } from '../../src/stores/routeStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { generateId } from '../../src/utils/helpers';
import { fetchRoute, reverseGeocode } from '../../src/utils/maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PATH_COLORS = [Colors.primary, Colors.safeGreen, Colors.warningOrange, '#FF6B9D', '#00D2FF'];

// ─── Types ───────────────────────────────────────────────────
interface WayPoint {
  latitude: number;
  longitude: number;
}

interface PathDraft {
  name: string;
  waypoints: WayPoint[];
  routeCoords: LatLng[];
  distance: string;
  duration: string;
  color: string;
}

type Step = 'source' | 'destination' | 'paths';

// ─── Component ───────────────────────────────────────────────
export default function CreateRouteScreen() {
  const insets = useSafeAreaInsets();
  const { createRoute, isLoading } = useRouteStore();
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);

  // ── Endpoints (shared by all paths) ──
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<WayPoint | null>(null);
  const [destination, setDestination] = useState<WayPoint | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [destLabel, setDestLabel] = useState('');

  // ── Paths ──
  const [paths, setPaths] = useState<PathDraft[]>([
    { name: 'Path 1', waypoints: [], routeCoords: [], distance: '', duration: '', color: PATH_COLORS[0] },
  ]);
  const [activePathIdx, setActivePathIdx] = useState(0);
  const [addingWaypoint, setAddingWaypoint] = useState(false);

  // ── Meta ──
  const [routeName, setRouteName] = useState('');
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  // ─── Get user location on mount ──
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  // ─── Recalculate a specific path ──
  const recalcPath = useCallback(async (
    s: WayPoint, d: WayPoint, wps: WayPoint[], pathIndex: number,
  ) => {
    setFetchingRoute(true);
    const result = await fetchRoute(s, d, wps);
    setPaths((prev) =>
      prev.map((p, i) =>
        i === pathIndex
          ? { ...p, routeCoords: result.coords, distance: result.distance, duration: result.duration }
          : p
      )
    );
    setFetchingRoute(false);

    if (result.coords.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(result.coords, {
        edgePadding: { top: 140, right: 60, bottom: 360, left: 60 },
        animated: true,
      });
    }
  }, []);

  // ─── Auto-calculate first path when source & dest both set ──
  const onEndpointsReady = useCallback(async (s: WayPoint, d: WayPoint) => {
    setStep('paths');
    await recalcPath(s, d, [], 0);
  }, [recalcPath]);

  // ─── Use current location as source ──
  const handleUseCurrentLocation = async () => {
    setLocatingUser(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Enable location access in device settings.');
        setLocatingUser(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords: WayPoint = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setSource(coords);
      const address = await reverseGeocode(coords.latitude, coords.longitude);
      setSourceLabel(address);
      setStep('destination');
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    } catch {
      Alert.alert('Error', 'Could not get your current location.');
    }
    setLocatingUser(false);
  };

  // ─── Map tap handler ──
  const handleMapPress = async (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;

    if (step === 'source') {
      setSource(coordinate);
      const addr = await reverseGeocode(coordinate.latitude, coordinate.longitude);
      setSourceLabel(addr);
      setStep('destination');
    } else if (step === 'destination') {
      setDestination(coordinate);
      const addr = await reverseGeocode(coordinate.latitude, coordinate.longitude);
      setDestLabel(addr);
      await onEndpointsReady(source!, coordinate);
    } else if (step === 'paths' && addingWaypoint) {
      // Add waypoint to the active path
      const newWps = [...paths[activePathIdx].waypoints, coordinate];
      setPaths((prev) =>
        prev.map((p, i) => i === activePathIdx ? { ...p, waypoints: newWps } : p)
      );
      if (source && destination) {
        await recalcPath(source, destination, newWps, activePathIdx);
      }
    }
  };

  // ─── Remove waypoint from active path ──
  const removeWaypoint = async (wpIndex: number) => {
    const newWps = paths[activePathIdx].waypoints.filter((_, i) => i !== wpIndex);
    setPaths((prev) =>
      prev.map((p, i) => i === activePathIdx ? { ...p, waypoints: newWps } : p)
    );
    if (source && destination) {
      await recalcPath(source, destination, newWps, activePathIdx);
    }
  };

  // ─── Add a new path ──
  const addPath = async () => {
    if (paths.length >= 5) {
      Alert.alert('Limit', 'Maximum 5 paths per route.');
      return;
    }
    const newIdx = paths.length;
    const newPath: PathDraft = {
      name: `Path ${newIdx + 1}`,
      waypoints: [],
      routeCoords: [],
      distance: '',
      duration: '',
      color: PATH_COLORS[newIdx % PATH_COLORS.length],
    };
    setPaths((prev) => [...prev, newPath]);
    setActivePathIdx(newIdx);
    setAddingWaypoint(false);
    // Auto-calculate the direct route for the new path
    if (source && destination) {
      await recalcPath(source, destination, [], newIdx);
    }
  };

  // ─── Remove a path ──
  const removePath = (index: number) => {
    if (paths.length <= 1) {
      Alert.alert('Error', 'At least one path is required.');
      return;
    }
    setPaths((prev) => prev.filter((_, i) => i !== index));
    if (activePathIdx >= paths.length - 1) {
      setActivePathIdx(Math.max(0, paths.length - 2));
    } else if (activePathIdx === index) {
      setActivePathIdx(0);
    }
  };

  // ─── Reset endpoints ──
  const resetSource = () => {
    setSource(null);
    setSourceLabel('');
    setDestination(null);
    setDestLabel('');
    setPaths([{ name: 'Path 1', waypoints: [], routeCoords: [], distance: '', duration: '', color: PATH_COLORS[0] }]);
    setActivePathIdx(0);
    setStep('source');
  };

  const resetDestination = () => {
    setDestination(null);
    setDestLabel('');
    setPaths((prev) => prev.map((p) => ({ ...p, routeCoords: [], distance: '', duration: '' })));
    setStep('destination');
  };

  // ─── Save route ──
  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert('Name Required', 'Please enter a route name.');
      return;
    }
    if (!source || !destination) {
      Alert.alert('Error', 'Please set source and destination.');
      return;
    }
    const validPaths = paths.filter((p) => p.routeCoords.length >= 2);
    if (validPaths.length === 0) {
      Alert.alert('Error', 'At least one path must have a valid route.');
      return;
    }

    const routeId = generateId();

    try {
      await createRoute({
        id: routeId,
        userId: user?.id || '',
        name: routeName.trim(),
        description: validPaths.map((p) => `${p.name}: ${p.distance}`).join(' | '),
        sourceLat: source.latitude,
        sourceLng: source.longitude,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,
        sourceAddress: sourceLabel,
        destinationAddress: destLabel,
        isActive: true,
        createdAt: Date.now(),
        paths: validPaths.map((p) => {
          const pathId = generateId();
          const allPoints: WayPoint[] = [source, ...p.waypoints, destination];
          return {
            id: pathId,
            routeId,
            name: p.name,
            description: `${p.distance} • ${p.duration}`,
            isActive: true,
            points: allPoints.map((pt, idx) => ({
              id: generateId(),
              pathId,
              latitude: pt.latitude,
              longitude: pt.longitude,
              isSource: idx === 0,
              isDestination: idx === allPoints.length - 1,
              isWaypoint: idx > 0 && idx < allPoints.length - 1,
              order: idx,
            })),
          };
        }),
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save route.');
    }
  };

  // ─── Derived state ──
  const activePath = paths[activePathIdx];
  const canTapMap = step === 'source' || step === 'destination' || (step === 'paths' && addingWaypoint);

  const instructionText =
    step === 'source' ? 'Tap the map to set your starting point'
      : step === 'destination' ? 'Now tap to set your destination'
        : addingWaypoint ? `Tap to add a stop on ${activePath.name}`
          : '';

  const initialRegion: Region = userLocation
    ? { ...userLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { latitude: 36.75, longitude: 3.06, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <View style={styles.container}>
      {/* ── Full-screen Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        onPress={canTapMap ? handleMapPress : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="standard"
        customMapStyle={darkMapStyle}
      >
        {/* Source marker */}
        {source && (
          <Marker coordinate={source} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.sourceMarkerWrap}>
              <View style={styles.sourceMarker}>
                <Ionicons name="radio-button-on" size={14} color={Colors.safeGreen} />
              </View>
              <View style={styles.markerStem} />
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {destination && (
          <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destMarkerWrap}>
              <View style={styles.destMarker}>
                <Ionicons name="location" size={16} color={Colors.dangerRed} />
              </View>
              <View style={[styles.markerStem, { backgroundColor: Colors.dangerRed }]} />
            </View>
          </Marker>
        )}

        {/* All path polylines */}
        {paths.map((path, pIdx) =>
          path.routeCoords.length >= 2 ? (
            <React.Fragment key={`path-${pIdx}`}>
              {/* Glow for active path */}
              {pIdx === activePathIdx && (
                <Polyline
                  coordinates={path.routeCoords}
                  strokeColor={path.color + '40'}
                  strokeWidth={10}
                />
              )}
              <Polyline
                coordinates={path.routeCoords}
                strokeColor={path.color}
                strokeWidth={pIdx === activePathIdx ? 5 : 2}
                lineDashPattern={pIdx === activePathIdx ? undefined : [10, 6]}
              />
            </React.Fragment>
          ) : null
        )}

        {/* Waypoint markers for active path only */}
        {activePath.waypoints.map((wp, i) => (
          <Marker
            key={`wp-${activePathIdx}-${i}`}
            coordinate={wp}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => {
              Alert.alert('Remove Stop', `Remove stop ${i + 1} from ${activePath.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeWaypoint(i) },
              ]);
            }}
          >
            <View style={[styles.waypointMarker, { backgroundColor: activePath.color, borderColor: activePath.color }]}>  
              <Text style={styles.waypointText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Create Route</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Instruction Pill ── */}
      {instructionText !== '' && (
        <View style={styles.instructionPill}>
          <Ionicons
            name={step === 'source' ? 'radio-button-on' : step === 'destination' ? 'flag' : 'add-circle'}
            size={16}
            color={step === 'source' ? Colors.safeGreen : step === 'destination' ? Colors.dangerRed : activePath.color}
          />
          <Text style={styles.instructionText}>{instructionText}</Text>
        </View>
      )}

      {/* ── My Location Button ── */}
      <TouchableOpacity
        style={[styles.myLocationBtn, { bottom: step === 'paths' ? 380 : 200 }]}
        onPress={() => {
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
          }
        }}
      >
        <Ionicons name="navigate" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {/* ── Bottom Panel ── */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        {/* ── Uber-style source/dest card ── */}
        <View style={styles.locationCard}>
          <View style={styles.timeline}>
            <View style={[styles.timelineDot, { backgroundColor: Colors.safeGreen }]} />
            <View style={styles.timelineLine} />
            <View style={[styles.timelineDot, { backgroundColor: Colors.dangerRed }]} />
          </View>
          <View style={styles.locationLabels}>
            <TouchableOpacity style={styles.locationRow} onPress={resetSource}>
              <Text style={[styles.locationText, !sourceLabel && styles.locationPlaceholder]} numberOfLines={1}>
                {sourceLabel || 'Set starting point'}
              </Text>
              {!source && (
                <TouchableOpacity onPress={handleUseCurrentLocation} style={styles.gpsBtn}>
                  {locatingUser ? (
                    <ActivityIndicator size={14} color={Colors.primary} />
                  ) : (
                    <Ionicons name="locate" size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.locationRow, { borderBottomWidth: 0 }]} onPress={resetDestination}>
              <Text style={[styles.locationText, !destLabel && styles.locationPlaceholder]} numberOfLines={1}>
                {destLabel || 'Set destination'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Path management (when source & dest are set) ── */}
        {step === 'paths' && (
          <View style={styles.pathsSection}>
            {/* Path tabs */}
            <View style={styles.pathTabRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {paths.map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.pathTab,
                      activePathIdx === idx && { borderColor: p.color, backgroundColor: p.color + '20' },
                    ]}
                    onPress={() => { setActivePathIdx(idx); setAddingWaypoint(false); }}
                    onLongPress={() => {
                      if (paths.length > 1) {
                        Alert.alert('Remove Path', `Delete ${p.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => removePath(idx) },
                        ]);
                      }
                    }}
                  >
                    <View style={[styles.pathDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.pathTabText, activePathIdx === idx && { color: p.color }]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {paths.length < 5 && (
                  <TouchableOpacity style={styles.addPathBtn} onPress={addPath}>
                    <Ionicons name="add" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* Active path info */}
            {fetchingRoute ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={activePath.color} size="small" />
                <Text style={styles.loadingText}>Finding route...</Text>
              </View>
            ) : activePath.distance ? (
              <View style={[styles.routeStats, { borderColor: activePath.color + '30' }]}>
                <View style={styles.statItem}>
                  <Ionicons name="speedometer-outline" size={16} color={activePath.color} />
                  <Text style={styles.statValue}>{activePath.distance}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={16} color={activePath.color} />
                  <Text style={styles.statValue}>{activePath.duration}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="navigate-outline" size={16} color={activePath.color} />
                  <Text style={styles.statValue}>{activePath.waypoints.length} stops</Text>
                </View>
              </View>
            ) : null}

            {/* Actions row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionChip, addingWaypoint && { backgroundColor: activePath.color }]}
                onPress={() => setAddingWaypoint(!addingWaypoint)}
              >
                <Ionicons
                  name={addingWaypoint ? 'close' : 'add-circle-outline'}
                  size={16}
                  color={addingWaypoint ? Colors.white : Colors.primary}
                />
                <Text style={[styles.actionChipText, addingWaypoint && { color: Colors.white }]}>
                  {addingWaypoint ? 'Done' : 'Add Stop'}
                </Text>
              </TouchableOpacity>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Route name"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={routeName}
                  onChangeText={setRouteName}
                />
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, isLoading && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                  <Text style={styles.saveBtnText}>
                    Save Route ({paths.filter((p) => p.routeCoords.length >= 2).length} path{paths.filter((p) => p.routeCoords.length >= 2).length !== 1 ? 's' : ''})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Dark map style ──────────────────────────────────────────
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

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8, zIndex: 10,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  topTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.dark.text,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Instruction pill
  instructionPill: {
    position: 'absolute', top: 110, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark.surface, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: BorderRadius.full, gap: 8, ...Shadows.md,
  },
  instructionText: { fontSize: FontSize.sm, color: Colors.dark.text, fontWeight: FontWeight.medium },

  // My location
  myLocationBtn: {
    position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },

  // Source marker
  sourceMarkerWrap: { alignItems: 'center' },
  sourceMarker: {
    backgroundColor: Colors.dark.surface, borderRadius: 20, padding: 6,
    borderWidth: 2, borderColor: Colors.safeGreen, ...Shadows.md,
  },
  markerStem: {
    width: 3, height: 10, backgroundColor: Colors.safeGreen,
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
  },

  // Destination marker
  destMarkerWrap: { alignItems: 'center' },
  destMarker: {
    backgroundColor: Colors.dark.surface, borderRadius: 20, padding: 6,
    borderWidth: 2, borderColor: Colors.dangerRed, ...Shadows.md,
  },

  // Waypoint markers
  waypointMarker: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.white, ...Shadows.md,
  },
  waypointText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white },

  // Bottom panel
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.dark.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16, ...Shadows.lg,
  },

  // Location card
  locationCard: { flexDirection: 'row', paddingVertical: 8 },
  timeline: { width: 24, alignItems: 'center', paddingTop: 6 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: Colors.dark.border, marginVertical: 3 },
  locationLabels: { flex: 1, marginLeft: 8 },
  locationRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.dark.border, minHeight: 40,
  },
  locationText: { flex: 1, fontSize: FontSize.md, color: Colors.dark.text, fontWeight: FontWeight.medium },
  locationPlaceholder: { color: Colors.dark.textMuted, fontWeight: FontWeight.regular },
  gpsBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primaryFaded, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },

  // Paths section
  pathsSection: { marginTop: 4 },
  pathTabRow: { marginBottom: 10 },
  pathTab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: BorderRadius.full, borderWidth: 1.5,
    borderColor: Colors.dark.border, backgroundColor: Colors.dark.surface,
  },
  pathDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  pathTabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.dark.textMuted },
  addPathBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // Route stats
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 8 },
  loadingText: { fontSize: FontSize.sm, color: Colors.dark.textSecondary },
  routeStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.dark.border,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.dark.text },
  statDivider: { width: 1, height: 18, backgroundColor: Colors.dark.border, marginHorizontal: 12 },

  // Action row
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryFaded, gap: 5,
  },
  actionChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },
  nameInput: {
    backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: FontSize.sm,
    color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border,
  },

  // Save button
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, gap: 8, ...Shadows.md,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.white },
});
