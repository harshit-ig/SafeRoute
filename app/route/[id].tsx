import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteStore } from '../../src/stores/routeStore';
import LoadingScreen from '../../src/components/LoadingScreen';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { SavedRoute, RoutePath } from '../../src/types';
import { fetchRoute } from '../../src/utils/maps';

const PATH_COLORS = [Colors.primary, Colors.safeGreen, Colors.warningOrange, '#FF6B9D', '#00D2FF'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { currentRoute, loadRouteById, deleteRoute, isLoading } = useRouteStore();
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [route, setRoute] = useState<SavedRoute | null>(null);
  const [pathPolylines, setPathPolylines] = useState<LatLng[][]>([]);
  const [loadingPolylines, setLoadingPolylines] = useState(false);

  useEffect(() => {
    if (id) loadRouteAndSet();
  }, [id]);

  const loadRouteAndSet = async () => {
    const r = await loadRouteById(id!);
    if (r) {
      setRoute(r);
      // Fetch real road-following polylines for each path from Directions API
      await fetchPathPolylines(r);
    }
  };

  const fetchPathPolylines = async (r: SavedRoute) => {
    if (!r.paths || r.paths.length === 0) return;
    setLoadingPolylines(true);
    const src = { latitude: r.sourceLat, longitude: r.sourceLng };
    const dst = { latitude: r.destinationLat, longitude: r.destinationLng };
    const polylines: LatLng[][] = [];
    for (const path of r.paths) {
      const sorted = [...(path.points || [])].sort((a, b) => a.order - b.order);
      const waypoints = sorted.filter((p) => p.isWaypoint).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));
      const result = await fetchRoute(src, dst, waypoints);
      polylines.push(result.coords.length >= 2 ? result.coords : sorted.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })));
    }
    setPathPolylines(polylines);
    setLoadingPolylines(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Route', `Delete "${route?.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (route) {
            await deleteRoute(route.id);
            router.back();
          }
        },
      },
    ]);
  };

  const handleStartTrip = () => {
    if (!route) return;
    router.push({
      pathname: '/trip/plan',
      params: { routeId: route.id },
    });
  };

  if (!route) return <LoadingScreen message="Loading route..." />;

  const source = route.sourceLat && route.sourceLng
    ? { latitude: route.sourceLat, longitude: route.sourceLng }
    : null;
  const destination = route.destinationLat && route.destinationLng
    ? { latitude: route.destinationLat, longitude: route.destinationLng }
    : null;

  const allPoints = route.paths?.flatMap((p) => p.points || []) || [];
  const lats = allPoints.map((p) => p.latitude).concat(
    source ? [source.latitude] : [],
    destination ? [destination.latitude] : []
  );
  const lngs = allPoints.map((p) => p.longitude).concat(
    source ? [source.longitude] : [],
    destination ? [destination.longitude] : []
  );

  const minLat = Math.min(...(lats.length ? lats : [36.75]));
  const maxLat = Math.max(...(lats.length ? lats : [36.76]));
  const minLng = Math.min(...(lngs.length ? lngs : [3.05]));
  const maxLng = Math.max(...(lngs.length ? lngs : [3.06]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{route.name}</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.backBtn}>
          <Ionicons name="trash-outline" size={20} color={Colors.dangerRed} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (minLat + maxLat) / 2,
              longitude: (minLng + maxLng) / 2,
              latitudeDelta: (maxLat - minLat) * 1.3 + 0.002,
              longitudeDelta: (maxLng - minLng) * 1.3 + 0.002,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            {source && <Marker coordinate={source} title="Source" pinColor="green" />}
            {destination && <Marker coordinate={destination} title="Destination" pinColor="red" />}
            {pathPolylines.map((coords, pIndex) => {
              if (coords.length < 2) return null;
              return (
                <Polyline
                  key={pIndex}
                  coordinates={coords}
                  strokeColor={PATH_COLORS[pIndex % PATH_COLORS.length]}
                  strokeWidth={selectedPathIndex === pIndex ? 5 : 2}
                  lineDashPattern={selectedPathIndex === pIndex ? undefined : [8, 4]}
                />
              );
            })}
            {loadingPolylines && pathPolylines.length === 0 && route.paths?.map((path, pIndex) => {
              const coords = [...(path.points || [])]
                .sort((a, b) => a.order - b.order)
                .map((pt) => ({ latitude: pt.latitude, longitude: pt.longitude }));
              if (coords.length < 2) return null;
              return (
                <Polyline
                  key={`fallback-${pIndex}`}
                  coordinates={coords}
                  strokeColor={PATH_COLORS[pIndex % PATH_COLORS.length] + '60'}
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              );
            })}
          </MapView>
        </View>

        {/* Info */}
        <View style={styles.content}>
          {route.description && (
            <Text style={styles.description}>{route.description}</Text>
          )}

          {/* Source & Destination */}
          <Card style={styles.locCard}>
            <View style={styles.locRow}>
              <View style={[styles.locDot, { backgroundColor: Colors.safeGreen }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locLabel}>Source</Text>
                <Text style={styles.locAddress}>{route.sourceAddress || 'Not specified'}</Text>
              </View>
            </View>
            <View style={styles.locDivider} />
            <View style={styles.locRow}>
              <View style={[styles.locDot, { backgroundColor: Colors.dangerRed }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locLabel}>Destination</Text>
                <Text style={styles.locAddress}>{route.destinationAddress || 'Not specified'}</Text>
              </View>
            </View>
          </Card>

          {/* Paths */}
          {route.paths && route.paths.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Paths ({route.paths.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pathScroll}
              >
                {route.paths.map((path, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.pathChip,
                      selectedPathIndex === index && {
                        borderColor: PATH_COLORS[index % PATH_COLORS.length],
                        backgroundColor: PATH_COLORS[index % PATH_COLORS.length] + '15',
                      },
                    ]}
                    onPress={() => setSelectedPathIndex(index)}
                  >
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: PATH_COLORS[index % PATH_COLORS.length] },
                      ]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        selectedPathIndex === index && {
                          color: PATH_COLORS[index % PATH_COLORS.length],
                        },
                      ]}
                    >
                      {path.name || `Path ${index + 1}`}
                    </Text>
                    <Text style={styles.chipCount}>
                      {path.points?.length || 0} pts
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Start Trip Button */}
          <Button
            title="Start Trip with this Route"
            onPress={handleStartTrip}
            icon="navigate"
            style={{ marginTop: Spacing.xl }}
          />
          <View style={{ height: 40 }} />
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  mapContainer: {
    height: 250,
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  map: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  locCard: {
    padding: Spacing.lg,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  locLabel: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  locAddress: {
    fontSize: FontSize.md,
    color: Colors.dark.text,
    marginTop: 2,
  },
  locDivider: {
    width: 2,
    height: 20,
    backgroundColor: Colors.dark.border,
    marginLeft: 5,
    marginVertical: 6,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  pathScroll: {
    marginBottom: Spacing.md,
  },
  pathChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: Spacing.md,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.dark.text,
    marginRight: 8,
  },
  chipCount: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
  },
});
