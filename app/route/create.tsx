import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, Polyline, MapPressEvent, LatLng } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteStore } from '../../src/stores/routeStore';
import Input from '../../src/components/Input';
import Button from '../../src/components/Button';
import Card from '../../src/components/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { getCurrentLocation } from '../../src/utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PathPoint {
  latitude: number;
  longitude: number;
  order: number;
}

interface RoutePathDraft {
  name: string;
  points: PathPoint[];
  color: string;
}

const PATH_COLORS = [Colors.primary, Colors.safeGreen, Colors.warningOrange, '#FF6B9D', '#00D2FF'];

export default function CreateRouteScreen() {
  const insets = useSafeAreaInsets();
  const { createRoute, isLoading } = useRouteStore();
  const mapRef = useRef<MapView>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceAddress, setSourceAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [sourceLat, setSourceLat] = useState('');
  const [sourceLng, setSourceLng] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [paths, setPaths] = useState<RoutePathDraft[]>([
    { name: 'Path 1', points: [], color: PATH_COLORS[0] },
  ]);
  const [activePathIndex, setActivePathIndex] = useState(0);
  const [mode, setMode] = useState<'info' | 'map'>('info');

  const handleUseCurrentLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setSourceLat(loc.latitude.toString());
      setSourceLng(loc.longitude.toString());
      setSourceAddress('Current Location');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;
    const newPaths = [...paths];
    const activePath = newPaths[activePathIndex];
    activePath.points.push({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      order: activePath.points.length,
    });
    setPaths(newPaths);
  };

  const addPath = () => {
    if (paths.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 paths per route');
      return;
    }
    const newIndex = paths.length;
    setPaths([
      ...paths,
      {
        name: `Path ${newIndex + 1}`,
        points: [],
        color: PATH_COLORS[newIndex % PATH_COLORS.length],
      },
    ]);
    setActivePathIndex(newIndex);
  };

  const removePath = (index: number) => {
    if (paths.length <= 1) {
      Alert.alert('Error', 'At least one path is required');
      return;
    }
    const newPaths = paths.filter((_, i) => i !== index);
    setPaths(newPaths);
    if (activePathIndex >= newPaths.length) {
      setActivePathIndex(newPaths.length - 1);
    }
  };

  const undoLastPoint = () => {
    const newPaths = [...paths];
    newPaths[activePathIndex].points.pop();
    setPaths(newPaths);
  };

  const clearPath = () => {
    const newPaths = [...paths];
    newPaths[activePathIndex].points = [];
    setPaths(newPaths);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a route name');
      return;
    }
    if (!sourceLat || !sourceLng || !destLat || !destLng) {
      Alert.alert('Error', 'Please enter source and destination coordinates');
      return;
    }
    const hasPoints = paths.some((p) => p.points.length >= 2);
    if (!hasPoints) {
      Alert.alert('Error', 'At least one path must have 2 or more points');
      return;
    }

    const route = await createRoute({
      name: name.trim(),
      description: description.trim() || undefined,
      sourceAddress: sourceAddress.trim() || undefined,
      destinationAddress: destinationAddress.trim() || undefined,
      sourceLat: parseFloat(sourceLat),
      sourceLng: parseFloat(sourceLng),
      destinationLat: parseFloat(destLat),
      destinationLng: parseFloat(destLng),
      paths: paths
        .filter((p) => p.points.length >= 2)
        .map((p) => ({
          name: p.name,
          points: p.points.map((pt) => ({
            latitude: pt.latitude,
            longitude: pt.longitude,
            order: pt.order,
          })),
        })),
    });

    if (route) {
      router.back();
    }
  };

  if (mode === 'map') {
    return (
      <View style={styles.container}>
        {/* Map Header */}
        <View style={[styles.mapHeader, { paddingTop: insets.top + Spacing.sm }]}>
          <TouchableOpacity onPress={() => setMode('info')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Draw Path</Text>
          <TouchableOpacity onPress={undoLastPoint} style={styles.backBtn}>
            <Ionicons name="arrow-undo" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Path Tabs */}
        <View style={styles.pathTabRow}>
          {paths.map((path, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.pathTab,
                activePathIndex === index && {
                  borderColor: path.color,
                  backgroundColor: path.color + '20',
                },
              ]}
              onPress={() => setActivePathIndex(index)}
              onLongPress={() => removePath(index)}
            >
              <View style={[styles.pathDot, { backgroundColor: path.color }]} />
              <Text
                style={[
                  styles.pathTabText,
                  activePathIndex === index && { color: path.color },
                ]}
              >
                {path.name} ({path.points.length})
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addPathBtn} onPress={addPath}>
            <Ionicons name="add" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          onPress={handleMapPress}
          initialRegion={{
            latitude: sourceLat ? parseFloat(sourceLat) : 36.75,
            longitude: sourceLng ? parseFloat(sourceLng) : 3.06,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
        >
          {sourceLat && sourceLng && (
            <Marker
              coordinate={{ latitude: parseFloat(sourceLat), longitude: parseFloat(sourceLng) }}
              title="Source"
              pinColor="green"
            />
          )}
          {destLat && destLng && (
            <Marker
              coordinate={{ latitude: parseFloat(destLat), longitude: parseFloat(destLng) }}
              title="Destination"
              pinColor="red"
            />
          )}
          {paths.map((path, pIndex) => (
            <React.Fragment key={pIndex}>
              {path.points.map((pt, ptIndex) => (
                <Marker
                  key={`${pIndex}-${ptIndex}`}
                  coordinate={pt}
                  anchor={{ x: 0.5, y: 0.5 }}
                  opacity={activePathIndex === pIndex ? 1 : 0.4}
                >
                  <View
                    style={[
                      styles.waypointMarker,
                      { backgroundColor: path.color, borderColor: path.color },
                    ]}
                  >
                    <Text style={styles.waypointText}>{ptIndex + 1}</Text>
                  </View>
                </Marker>
              ))}
              {path.points.length >= 2 && (
                <Polyline
                  coordinates={path.points}
                  strokeColor={path.color}
                  strokeWidth={activePathIndex === pIndex ? 4 : 2}
                  lineDashPattern={activePathIndex === pIndex ? undefined : [10, 5]}
                />
              )}
            </React.Fragment>
          ))}
        </MapView>

        {/* Map Actions */}
        <View style={[styles.mapActions, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity style={styles.mapActionBtn} onPress={clearPath}>
            <Ionicons name="trash-outline" size={18} color={Colors.dangerRed} />
            <Text style={[styles.mapActionText, { color: Colors.dangerRed }]}>Clear</Text>
          </TouchableOpacity>
          <Button
            title="Done Drawing"
            onPress={() => setMode('info')}
            icon="checkmark"
            style={{ flex: 1, marginLeft: Spacing.md }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Route</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Basic Info */}
        <Input
          label="Route Name"
          placeholder="e.g. Home to Work"
          value={name}
          onChangeText={setName}
          leftIcon="create-outline"
        />
        <Input
          label="Description (optional)"
          placeholder="Add a description..."
          value={description}
          onChangeText={setDescription}
          leftIcon="document-text-outline"
        />

        {/* Source */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Source</Text>
          <TouchableOpacity onPress={handleUseCurrentLocation}>
            <Text style={styles.useCurrentText}>📍 Use Current</Text>
          </TouchableOpacity>
        </View>
        <Input
          label="Address"
          placeholder="Source address"
          value={sourceAddress}
          onChangeText={setSourceAddress}
          leftIcon="location-outline"
        />
        <View style={styles.coordRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Input label="Latitude" placeholder="36.7538" value={sourceLat} onChangeText={setSourceLat} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Input label="Longitude" placeholder="3.0588" value={sourceLng} onChangeText={setSourceLng} keyboardType="numeric" />
          </View>
        </View>

        {/* Destination */}
        <Text style={styles.sectionTitle}>Destination</Text>
        <Input
          label="Address"
          placeholder="Destination address"
          value={destinationAddress}
          onChangeText={setDestinationAddress}
          leftIcon="flag-outline"
        />
        <View style={styles.coordRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Input label="Latitude" placeholder="36.7" value={destLat} onChangeText={setDestLat} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Input label="Longitude" placeholder="3.0" value={destLng} onChangeText={setDestLng} keyboardType="numeric" />
          </View>
        </View>

        {/* Paths Section */}
        <Text style={styles.sectionTitle}>Paths</Text>
        <Card style={styles.pathsCard}>
          {paths.map((p, i) => (
            <View key={i} style={styles.pathRow}>
              <View style={[styles.pathDotLg, { backgroundColor: p.color }]} />
              <Text style={styles.pathLabel}>{p.name}</Text>
              <Text style={styles.pathPoints}>{p.points.length} points</Text>
            </View>
          ))}
          <TouchableOpacity
            style={styles.drawButton}
            onPress={() => setMode('map')}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={20} color={Colors.primary} />
            <Text style={styles.drawBtnText}>Open Map to Draw Paths</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
          </TouchableOpacity>
        </Card>

        <Button
          title="Save Route"
          onPress={handleSave}
          loading={isLoading}
          icon="save-outline"
          style={{ marginTop: Spacing.xl }}
        />
        <View style={{ height: 40 }} />
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
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.dark.background,
    zIndex: 10,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  useCurrentText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  coordRow: {
    flexDirection: 'row',
  },
  pathsCard: {
    padding: Spacing.md,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  pathDotLg: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  pathLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.dark.text,
  },
  pathPoints: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
  },
  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  drawBtnText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginLeft: Spacing.md,
  },
  // Map mode styles
  pathTabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dark.background,
    gap: Spacing.sm,
  },
  pathTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  pathDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pathTabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.dark.textMuted,
  },
  addPathBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  waypointMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  waypointText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  mapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  mapActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  mapActionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginLeft: 6,
  },
});
