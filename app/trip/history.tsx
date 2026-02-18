import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripStore } from '../../src/stores/tripStore';
import LoadingScreen from '../../src/components/LoadingScreen';
import EmptyState from '../../src/components/EmptyState';
import Card from '../../src/components/Card';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../src/constants/theme';
import { Trip, TripStatus } from '../../src/types';
import { formatDate, formatTime, formatDistance, calculateHaversineDistance } from '../../src/utils/helpers';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  [TripStatus.STARTED]: { label: 'Active', color: Colors.safeGreen, icon: 'radio-button-on' },
  [TripStatus.COMPLETED]: { label: 'Completed', color: Colors.primary, icon: 'checkmark-circle' },
  [TripStatus.CANCELLED]: { label: 'Cancelled', color: Colors.dark.textMuted, icon: 'close-circle' },
  [TripStatus.PLANNED]: { label: 'Planned', color: Colors.warningOrange, icon: 'time' },
  [TripStatus.UNSAFE]: { label: 'Unsafe', color: Colors.dangerRed, icon: 'warning' },
  [TripStatus.ERROR]: { label: 'Error', color: Colors.dangerRed, icon: 'alert-circle' },
};

type FilterType = 'all' | 'active' | 'completed' | 'cancelled';

export default function TripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { tripHistory, loadTripHistory, isLoading } = useTripStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTripHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTripHistory();
    setRefreshing(false);
  };

  const filteredTrips = tripHistory.filter((trip) => {
    switch (filter) {
      case 'active':
        return trip.status === TripStatus.STARTED || trip.status === TripStatus.PLANNED;
      case 'completed':
        return trip.status === TripStatus.COMPLETED;
      case 'cancelled':
        return trip.status === TripStatus.CANCELLED;
      default:
        return true;
    }
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Done' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const renderTrip = ({ item }: { item: Trip }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG[TripStatus.PLANNED];
    const distance = calculateHaversineDistance(
      item.sourceLat,
      item.sourceLng,
      item.destinationLat,
      item.destinationLng
    );
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/trip/${item.id}`)}
      >
        <Card style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon as any} size={14} color={config.color} />
              <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.startedAt)}</Text>
          </View>

          <View style={styles.locationRow}>
            <View style={styles.locationDots}>
              <View style={[styles.dot, { backgroundColor: Colors.safeGreen }]} />
              <View style={styles.locationLine} />
              <View style={[styles.dot, { backgroundColor: Colors.dangerRed }]} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.addressText} numberOfLines={1}>
                {item.sourceAddress || 'Starting Point'}
              </Text>
              <View style={{ height: 16 }} />
              <Text style={styles.addressText} numberOfLines={1}>
                {item.destinationAddress || 'Destination'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>{formatTime(item.startedAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="resize-outline" size={14} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>{formatDistance(distance)}</Text>
            </View>
            {item.deviationCount > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="warning-outline" size={14} color={Colors.warningOrange} />
                <Text style={[styles.metaText, { color: Colors.warningOrange }]}>
                  {item.deviationCount} deviation{item.deviationCount > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No trips found"
            description={
              filter === 'all'
                ? "You haven't taken any trips yet"
                : `No ${filter} trips`
            }
          />
        }
      />
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
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterTabActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.dark.textMuted,
  },
  filterTabTextActive: {
    color: Colors.primary,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  tripCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginLeft: 4,
  },
  dateText: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  locationDots: {
    alignItems: 'center',
    width: 20,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 3,
  },
  locationInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  addressText: {
    fontSize: FontSize.md,
    color: Colors.dark.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    marginLeft: 4,
  },
});
