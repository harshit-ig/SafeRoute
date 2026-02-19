import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useTripStore } from '../../src/stores/tripStore';
import { useRouteStore } from '../../src/stores/routeStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { SavedRoute, TripStatus } from '../../src/types';
import { getCurrentLocation, generateId } from '../../src/utils/helpers';
import { fetchAllRoutes, geocodeAddress, decodePolyline, AllRoutesResult } from '../../src/utils/maps';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_H * 0.48;

// Dark nav map style (matches trip screen)
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

type Stage = 'input' | 'preview' | 'starting';

export default function PlanTripScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { startTrip, isLoading } = useTripStore();
  const { routes, loadRoutes } = useRouteStore();
  const globalLat = useLocationStore((s) => s.latitude);
  const globalLng = useLocationStore((s) => s.longitude);

  // ─── State ───
  const [stage, setStage] = useState<Stage>('input');
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [destFormatted, setDestFormatted] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [userLoc, setUserLoc] = useState<LatLng | null>(
    globalLat != null && globalLng != null ? { latitude: globalLat, longitude: globalLng } : null,
  );

  // Source location: saved route start vs current location
  const [useCurrentLoc, setUseCurrentLoc] = useState(true);
  const [sourceCoords, setSourceCoords] = useState<LatLng | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Your location');

  // Route preview data
  const [routeResult, setRouteResult] = useState<AllRoutesResult | null>(null);
  const [previewCoords, setPreviewCoords] = useState<LatLng[]>([]);
  const [altPreviewCoords, setAltPreviewCoords] = useState<LatLng[][]>([]);
  const [routeDistance, setRouteDistance] = useState('');
  const [routeDuration, setRouteDuration] = useState('');

  const mapRef = useRef<MapView>(null);
  const inputRef = useRef<TextInput>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user?.id) loadRoutes(user.id);
    initLocation();
  }, [user?.id]);

  // Animate sheet on stage change
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: stage === 'preview' ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
  }, [stage]);

  const initLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setUserLoc({ latitude: loc.latitude, longitude: loc.longitude });
      mapRef.current?.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 600);
    }
  };

  // ─── Select saved route ───
  const handleSelectRoute = (route: SavedRoute) => {
    setSelectedRoute(route);
    setDestination(route.destinationAddress || route.name);
    setDestFormatted(route.destinationAddress || '');
    setDestCoords({ latitude: route.destinationLat, longitude: route.destinationLng });
    setShowSaved(false);

    // Default source to saved route start
    if (route.sourceLat && route.sourceLng) {
      setUseCurrentLoc(false);
      setSourceCoords({ latitude: route.sourceLat, longitude: route.sourceLng });
      setSourceLabel(route.sourceAddress || 'Route start');
    }

    // Auto-search route preview
    searchRoute(
      { latitude: route.destinationLat, longitude: route.destinationLng },
      route.destinationAddress || route.name,
      route,
      route.sourceLat && route.sourceLng
        ? { latitude: route.sourceLat, longitude: route.sourceLng }
        : null,
    );
  };

  // ─── Toggle source location ───
  const toggleSource = async () => {
    if (useCurrentLoc) {
      // Switch to route start
      if (selectedRoute?.sourceLat && selectedRoute?.sourceLng) {
        setUseCurrentLoc(false);
        setSourceCoords({ latitude: selectedRoute.sourceLat, longitude: selectedRoute.sourceLng });
        setSourceLabel(selectedRoute.sourceAddress || 'Route start');
        // Re-search with route source
        if (destCoords) {
          searchRoute(destCoords, destFormatted || destination, selectedRoute,
            { latitude: selectedRoute.sourceLat, longitude: selectedRoute.sourceLng });
        }
      }
    } else {
      // Switch to current location
      setUseCurrentLoc(true);
      setSourceCoords(null);
      setSourceLabel('Your location');
      const loc = userLoc || (await getCurrentLocation());
      if (loc) {
        setUserLoc(loc);
        if (destCoords) {
          searchRoute(destCoords, destFormatted || destination, selectedRoute, null);
        }
      }
    }
  };

  // ─── Geocode + search route ───
  const handleSearch = async () => {
    if (!destination.trim()) return;
    Keyboard.dismiss();
    setGeocoding(true);

    const result = await geocodeAddress(destination.trim());
    setGeocoding(false);

    if (!result) {
      Alert.alert('Not Found', 'Could not find that location. Try a more specific address.');
      return;
    }
    setDestCoords({ latitude: result.latitude, longitude: result.longitude });
    setDestFormatted(result.formattedAddress);
    setSelectedRoute(null);
    searchRoute(
      { latitude: result.latitude, longitude: result.longitude },
      result.formattedAddress,
      null,
    );
  };

  // ─── Fetch route preview ───
  const searchRoute = async (
    dst: LatLng,
    address: string,
    route: SavedRoute | null,
    overrideSource?: LatLng | null,
  ) => {
    // Determine source: explicit override > sourceCoords state > current location
    const overrideSrc = overrideSource !== undefined ? overrideSource : sourceCoords;
    let src: LatLng;
    if (overrideSrc) {
      src = overrideSrc;
    } else {
      const loc = userLoc || (await getCurrentLocation());
      if (!loc) {
        Alert.alert('Error', 'Unable to get your location.');
        return;
      }
      setUserLoc(loc);
      src = loc;
    }
    setFetchingRoute(true);

    let waypoints: LatLng[] = [];
    if (route?.paths?.length) {
      const firstPath = route.paths[0];
      waypoints = [...(firstPath.points || [])]
        .sort((a, b) => a.order - b.order)
        .filter((p) => p.isWaypoint)
        .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    }

    const result = await fetchAllRoutes(src, dst, waypoints);
    setFetchingRoute(false);

    if (!result.primary.encodedPolyline) {
      Alert.alert('Error', 'Could not find a route to that destination.');
      return;
    }

    setRouteResult(result);
    setPreviewCoords(result.primary.coords);
    setRouteDistance(result.primary.distance);
    setRouteDuration(result.primary.duration);

    // Decode alternatives
    const alts = result.alternatives
      .map((poly) => { try { return decodePolyline(poly); } catch { return []; } })
      .filter((c) => c.length >= 2);
    setAltPreviewCoords(alts);

    setStage('preview');

    // Fit map to route
    setTimeout(() => {
      if (mapRef.current && result.primary.coords.length >= 2) {
        const all = [...result.primary.coords, ...alts.flat()];
        if (src) all.push(src);
        mapRef.current.fitToCoordinates(all, {
          edgePadding: { top: 100, right: 50, bottom: SCREEN_H * 0.48, left: 50 },
          animated: true,
        });
      }
    }, 300);
  };

  // ─── Start trip ───
  const handleStartTrip = async () => {
    if (!destCoords || !routeResult || !user) return;
    setStage('starting');

    // Determine source for the trip
    let tripSource: LatLng;
    let tripSourceAddress: string;
    if (!useCurrentLoc && sourceCoords) {
      tripSource = sourceCoords;
      tripSourceAddress = sourceLabel;
    } else {
      const loc = userLoc || (await getCurrentLocation());
      if (!loc) {
        Alert.alert('Error', 'Unable to get your location.');
        setStage('preview');
        return;
      }
      tripSource = loc;
      tripSourceAddress = 'Current Location';
    }

    const tripId = generateId();
    try {
      await startTrip({
        id: tripId,
        userId: user.id,
        sourceLat: tripSource.latitude,
        sourceLng: tripSource.longitude,
        sourceAddress: tripSourceAddress,
        destinationLat: destCoords.latitude,
        destinationLng: destCoords.longitude,
        destinationAddress: destFormatted || destination.trim(),
        routePolyline: routeResult.primary.encodedPolyline,
        alternativePolylines: routeResult.alternatives,
        status: TripStatus.PLANNED,
        startTime: Date.now(),
        deviationCount: 0,
        stopCount: 0,
        alertCount: 0,
        routeId: selectedRoute?.id,
        sharedWithUsers: [],
        locationUpdates: [],
      });
      router.replace(`/trip/${tripId}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start trip');
      setStage('preview');
    }
  };

  // ─── Reset to input ───
  const handleBack = () => {
    if (stage === 'preview') {
      setStage('input');
      setPreviewCoords([]);
      setAltPreviewCoords([]);
      setRouteResult(null);
      const center = sourceCoords || userLoc;
      if (center) {
        mapRef.current?.animateToRegion({
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 600);
      }
    } else {
      router.back();
    }
  };

  const isSearching = geocoding || fetchingRoute;

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={[styles.map, { height: MAP_HEIGHT }]}
        initialRegion={{
          latitude: userLoc?.latitude ?? 36.75,
          longitude: userLoc?.longitude ?? 3.06,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={darkMapStyle}
        mapType="standard"
      >
        {/* Alt routes (faded) */}
        {altPreviewCoords.map((coords, idx) => (
          <React.Fragment key={`alt-${idx}`}>
            <Polyline coordinates={coords} strokeColor="rgba(100,160,200,0.12)" strokeWidth={10} />
            <Polyline coordinates={coords} strokeColor="rgba(100,160,200,0.45)" strokeWidth={4} />
          </React.Fragment>
        ))}
        {/* Primary route */}
        {previewCoords.length >= 2 && (
          <>
            <Polyline coordinates={previewCoords} strokeColor="rgba(0,210,255,0.18)" strokeWidth={12} />
            <Polyline coordinates={previewCoords} strokeColor="#00D2FF" strokeWidth={5} />
          </>
        )}
        {/* Source marker */}
        {(sourceCoords || userLoc) && previewCoords.length >= 2 && (
          <Marker coordinate={(sourceCoords || userLoc)!} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.srcDotOuter}>
              <View style={styles.srcDotInner} />
            </View>
          </Marker>
        )}
        {/* Destination marker */}
        {destCoords && previewCoords.length >= 2 && (
          <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destPin}>
              <View style={styles.destPinHead}>
                <Ionicons name="flag" size={12} color="#fff" />
              </View>
              <View style={styles.destPinStem} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Top-left back button ── */}
      <TouchableOpacity
        style={[styles.mapBackBtn, { top: insets.top + 10 }]}
        onPress={handleBack}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ── Bottom sheet ── */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />

        {/* ═══ INPUT STAGE ═══ */}
        {stage === 'input' && (
          <>
            {/* Search bar */}
            <View style={styles.searchSection}>
              {/* Route visualization (dot-line-dot) */}
              <View style={styles.routeViz}>
                <View style={[styles.vizDot, { backgroundColor: Colors.safeGreen }]} />
                <View style={styles.vizLine} />
                <View style={[styles.vizDot, { backgroundColor: Colors.dangerRed }]} />
              </View>

              <View style={styles.searchInputs}>
                {/* Source (tappable toggle) */}
                <TouchableOpacity
                  style={styles.sourceRow}
                  onPress={selectedRoute ? toggleSource : undefined}
                  activeOpacity={selectedRoute ? 0.6 : 1}
                >
                  <Text style={styles.sourceText} numberOfLines={1}>{sourceLabel}</Text>
                  {selectedRoute && (
                    <View style={styles.sourceSwap}>
                      <Ionicons name="swap-vertical" size={14} color={Colors.accent} />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.inputDivider} />
                {/* Destination input */}
                <View style={styles.destInputRow}>
                  <TextInput
                    ref={inputRef}
                    style={styles.destInput}
                    placeholder="Where to?"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={destination}
                    onChangeText={(text) => {
                      setDestination(text);
                      setSelectedRoute(null);
                    }}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoFocus={!selectedRoute}
                  />
                  {destination.length > 0 && (
                    <TouchableOpacity
                      onPress={() => { setDestination(''); setDestCoords(null); setSelectedRoute(null); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.dark.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Search button */}
            <TouchableOpacity
              style={[styles.searchBtn, !destination.trim() && { opacity: 0.4 }]}
              onPress={handleSearch}
              disabled={!destination.trim() || isSearching}
              activeOpacity={0.8}
            >
              {isSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="search" size={18} color="#fff" />
                  <Text style={styles.searchBtnText}>Search Route</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Saved routes section */}
            {routes.length > 0 && (
              <View style={styles.savedSection}>
                <TouchableOpacity
                  style={styles.savedHeader}
                  onPress={() => setShowSaved(!showSaved)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="bookmarks" size={16} color={Colors.primary} />
                  <Text style={styles.savedTitle}>Saved Routes</Text>
                  <Ionicons
                    name={showSaved ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.dark.textMuted}
                  />
                </TouchableOpacity>

                {!showSaved && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={{ paddingRight: 8 }}
                  >
                    {routes.slice(0, 8).map((route) => (
                      <TouchableOpacity
                        key={route.id}
                        style={[
                          styles.routeChip,
                          selectedRoute?.id === route.id && styles.routeChipActive,
                        ]}
                        onPress={() => handleSelectRoute(route)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="navigate-outline"
                          size={13}
                          color={selectedRoute?.id === route.id ? Colors.primary : Colors.dark.textMuted}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            selectedRoute?.id === route.id && styles.chipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {route.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {showSaved && (
                  <ScrollView style={styles.savedList} showsVerticalScrollIndicator={false}>
                    {routes.map((route) => (
                      <TouchableOpacity
                        key={route.id}
                        style={[
                          styles.savedItem,
                          selectedRoute?.id === route.id && styles.savedItemActive,
                        ]}
                        onPress={() => handleSelectRoute(route)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.savedIcon}>
                          <Ionicons
                            name={selectedRoute?.id === route.id ? 'navigate' : 'navigate-outline'}
                            size={18}
                            color={selectedRoute?.id === route.id ? Colors.primary : Colors.dark.textMuted}
                          />
                        </View>
                        <View style={styles.savedInfo}>
                          <Text style={styles.savedName}>{route.name}</Text>
                          {route.destinationAddress ? (
                            <Text style={styles.savedAddr} numberOfLines={1}>
                              {route.destinationAddress}
                            </Text>
                          ) : null}
                        </View>
                        {selectedRoute?.id === route.id && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.safeGreen} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </>
        )}

        {/* ═══ PREVIEW STAGE ═══ */}
        {(stage === 'preview' || stage === 'starting') && (
          <>
            {/* Route info card */}
            <View style={styles.previewCard}>
              {/* Distance / Duration header */}
              <View style={styles.previewHeader}>
                <View style={styles.previewStat}>
                  <Text style={styles.previewBig}>{routeDuration || '--'}</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewStat}>
                  <Text style={styles.previewBig}>{routeDistance || '--'}</Text>
                </View>
                {altPreviewCoords.length > 0 && (
                  <>
                    <View style={styles.previewDivider} />
                    <View style={styles.previewStat}>
                      <View style={styles.altBadge}>
                        <Text style={styles.altBadgeText}>{altPreviewCoords.length + 1} routes</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* From → To */}
              <View style={styles.previewRoute}>
                <View style={styles.previewRouteViz}>
                  <View style={[styles.vizDotSm, { backgroundColor: Colors.safeGreen }]} />
                  <View style={styles.vizLineSm} />
                  <View style={[styles.vizDotSm, { backgroundColor: Colors.dangerRed }]} />
                </View>
                <View style={styles.previewLabels}>
                  <Text style={styles.previewFrom} numberOfLines={1}>{sourceLabel}</Text>
                  <Text style={styles.previewTo} numberOfLines={2}>
                    {destFormatted || destination}
                  </Text>
                </View>
                {selectedRoute && (
                  <TouchableOpacity style={styles.srcToggleBtn} onPress={toggleSource} activeOpacity={0.7}>
                    <Ionicons name={useCurrentLoc ? 'navigate-outline' : 'locate-outline'} size={16} color={Colors.accent} />
                    <Text style={styles.srcToggleText}>{useCurrentLoc ? 'Route start' : 'My location'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Selected route badge */}
              {selectedRoute && (
                <View style={styles.routeBadge}>
                  <Ionicons name="map-outline" size={13} color={Colors.primary} />
                  <Text style={styles.routeBadgeText}>{selectedRoute.name}</Text>
                </View>
              )}
            </View>

            {/* Start button */}
            <TouchableOpacity
              style={[styles.startBtn, stage === 'starting' && { opacity: 0.6 }]}
              onPress={handleStartTrip}
              disabled={stage === 'starting' || isLoading}
              activeOpacity={0.85}
            >
              {stage === 'starting' || isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="navigate" size={20} color="#fff" />
                  <Text style={styles.startBtnText}>Start Trip</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Change destination link */}
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Text style={styles.changeBtnText}>Change destination</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  map: {
    width: '100%',
  },

  // ── Map back button ──
  mapBackBtn: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.dark.surface + 'E8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },

  // ── Bottom sheet ──
  sheet: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.dark.border,
    ...Shadows.lg,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.surfaceLight,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // ── Search section ──
  searchSection: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  routeViz: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    paddingVertical: 4,
  },
  vizDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  vizLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: Colors.dark.surfaceLight,
    marginVertical: 3,
  },
  searchInputs: {
    flex: 1,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sourceText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    fontWeight: FontWeight.medium,
  },
  sourceSwap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  inputDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 2,
  },
  destInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  destInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.dark.text,
    fontWeight: FontWeight.medium,
    paddingVertical: 6,
  },

  // ── Search button ──
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    marginBottom: 18,
    ...Shadows.md,
  },
  searchBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginLeft: 8,
  },

  // ── Saved routes ──
  savedSection: {
    marginTop: 2,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  savedTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.textSecondary,
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  chipScroll: {
    marginBottom: 4,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  routeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.dark.textSecondary,
    marginLeft: 5,
    fontWeight: FontWeight.medium,
    maxWidth: 110,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  savedList: {
    maxHeight: 200,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  savedItemActive: {
    backgroundColor: Colors.primaryFaded,
  },
  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  savedInfo: {
    flex: 1,
  },
  savedName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
  },
  savedAddr: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },

  // ── Preview stage ──
  previewCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  previewStat: {
    flex: 1,
    alignItems: 'center',
  },
  previewBig: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  previewDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.dark.border,
  },
  altBadge: {
    backgroundColor: 'rgba(0,210,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  altBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  previewRoute: {
    flexDirection: 'row',
  },
  previewRouteViz: {
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 2,
  },
  vizDotSm: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vizLineSm: {
    width: 2,
    flex: 1,
    minHeight: 14,
    backgroundColor: Colors.dark.surfaceLight,
    marginVertical: 2,
  },
  previewLabels: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewFrom: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
    marginBottom: 6,
  },
  previewTo: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
  },
  srcToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
    alignSelf: 'center',
  },
  srcToggleText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
    marginLeft: 4,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryFaded,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  routeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginLeft: 5,
  },

  // ── Start button ──
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.safeGreen,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    marginBottom: 10,
    ...Shadows.md,
  },
  startBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginLeft: 10,
  },
  changeBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  changeBtnText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
    fontWeight: FontWeight.medium,
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
});
