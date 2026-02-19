import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useRouteStore } from '../../src/stores/routeStore';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import LoadingScreen from '../../src/components/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../src/constants/theme';
import { SavedRoute } from '../../src/types';

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { routes, isLoading, loadRoutes, deleteRoute } = useRouteStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (user) await loadRoutes(user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDeleteRoute = (route: SavedRoute) => {
    Alert.alert('Delete Route', `Are you sure you want to delete "${route.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteRoute(route.id),
      },
    ]);
  };

  const renderRoute = ({ item }: { item: SavedRoute }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/route/${item.id}`)}
    >
      <Card style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <View style={styles.routeIcon}>
            <Ionicons name="map" size={20} color={Colors.primary} />
          </View>
          <View style={styles.routeHeaderRight}>
            <TouchableOpacity
              onPress={() => handleDeleteRoute(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.dangerRed} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.routeName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.routeDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.routeAddresses}>
          <View style={styles.addressRow}>
            <Ionicons name="radio-button-on" size={12} color={Colors.safeGreen} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.sourceAddress || 'Unknown source'}
            </Text>
          </View>
          <View style={styles.addressLine} />
          <View style={styles.addressRow}>
            <Ionicons name="location" size={12} color={Colors.dangerRed} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.destinationAddress || 'Unknown destination'}
            </Text>
          </View>
        </View>
        <View style={styles.routeFooter}>
          <View style={styles.pathCount}>
            <Ionicons name="git-branch-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.pathCountText}>{item.paths.length} path(s)</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading && routes.length === 0) {
    return <LoadingScreen message="Loading routes..." />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>My Routes</Text>
      </View>

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRoute}
        contentContainerStyle={[
          styles.listContent,
          routes.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="map-outline"
            title="No Routes Yet"
            description="Create your first route to plan safe journeys."
            actionLabel="Create Route"
            onAction={() => router.push('/route/create')}
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
        onPress={() => router.push('/route/create')}
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
  routeCard: {
    marginBottom: Spacing.md,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  routeDesc: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  routeAddresses: {
    marginBottom: Spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressLine: {
    width: 1,
    height: 16,
    backgroundColor: Colors.dark.border,
    marginLeft: 5.5,
    marginVertical: 2,
  },
  addressText: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: Spacing.md,
  },
  pathCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathCountText: {
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
