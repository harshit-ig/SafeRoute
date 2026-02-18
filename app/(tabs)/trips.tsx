import React, { useEffect, useCallback } from 'react';
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
import { useAuthStore } from '../../src/stores/authStore';
import { useTripStore } from '../../src/stores/tripStore';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import LoadingScreen from '../../src/components/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../src/constants/theme';
import { Trip, TripStatus } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { tripHistory, activeTrip, isLoading, loadTripHistory, loadActiveTrip } = useTripStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const load = useCallback(async () => {
    if (user) {
      await Promise.all([loadTripHistory(user.id), loadActiveTrip(user.id)]);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const getStatusColor = (status: TripStatus) => {
    switch (status) {
      case TripStatus.STARTED: return Colors.safeGreen;
      case TripStatus.COMPLETED: return Colors.primary;
      case TripStatus.CANCELLED: return Colors.dangerRed;
      case TripStatus.EMERGENCY: return Colors.dangerRed;
      default: return Colors.dark.textMuted;
    }
  };

  const getStatusLabel = (status: TripStatus) => {
    switch (status) {
      case TripStatus.STARTED: return 'Active';
      case TripStatus.COMPLETED: return 'Completed';
      case TripStatus.CANCELLED: return 'Cancelled';
      case TripStatus.EMERGENCY: return 'Emergency';
      case TripStatus.PLANNED: return 'Planned';
      default: return status;
    }
  };

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/trip/${item.id}`)}
    >
      <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
        </View>
        <Text style={styles.tripDest} numberOfLines={1}>
          {item.destinationAddress || 'Unknown destination'}
        </Text>
        <Text style={styles.tripFrom} numberOfLines={1}>
          From: {item.sourceAddress || 'Unknown'}
        </Text>
        <View style={styles.tripMeta}>
          <Ionicons name="time-outline" size={14} color={Colors.dark.textMuted} />
          <Text style={styles.tripMetaText}>{formatDateTime(item.startTime)}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading && tripHistory.length === 0) {
    return <LoadingScreen message="Loading trips..." />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tripHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        contentContainerStyle={[
          styles.listContent,
          tripHistory.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No Trips Yet"
            description="Plan your first trip and stay safe on the road."
            actionLabel="Plan a Trip"
            onAction={() => router.push('/trip/plan')}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push('/trip/plan')}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
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
  listContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 100,
  },
  tripCard: {
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
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  tripDest: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  tripFrom: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripMetaText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
    marginLeft: 6,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xxl,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
