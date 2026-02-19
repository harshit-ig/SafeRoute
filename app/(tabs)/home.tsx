import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useTripStore } from '../../src/stores/tripStore';
import { useCircleStore } from '../../src/stores/circleStore';
import Card from '../../src/components/Card';
import QuickAction from '../../src/components/QuickAction';
import TrackingStatsCard from '../../src/components/TrackingStatsCard';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { TripStatus } from '../../src/types';
import { formatTime } from '../../src/utils/helpers';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { activeTrip, loadActiveTrip } = useTripStore();
  const { circle, loadUserCircle } = useCircleStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (user) {
      await Promise.all([
        loadActiveTrip(user.id),
        loadUserCircle(),
      ]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const userName = user?.name?.split(' ')[0] || 'Traveler';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.userName}>{userName} 👋</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.avatarBtn}
        >
          <Ionicons name="person-circle" size={44} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Safety Status Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {activeTrip ? 'Trip in progress' : 'You\'re safe'}
          </Text>
          {circle && (
            <View style={styles.circleTag}>
              <Ionicons name="people" size={14} color={Colors.primary} />
              <Text style={styles.circleTagText}>
                {circle.memberCount} watching
              </Text>
            </View>
          )}
        </View>

        {/* Active Trip Card */}
        {activeTrip && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/trip/${activeTrip.id}`)}
          >
            <Card style={styles.activeTripCard}>
              <View style={styles.activeTripHeader}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text style={styles.activeTripTime}>
                  Started {formatTime(activeTrip.startTime)}
                </Text>
              </View>
              <Text style={styles.activeTripDest} numberOfLines={1}>
                📍 {activeTrip.destinationAddress}
              </Text>
              <View style={styles.activeTripFooter}>
                <Text style={styles.activeTripAction}>Continue Trip →</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction
            title="Plan New Trip"
            description="Start a safe journey"
            icon="navigate-outline"
            color={Colors.primary}
            onPress={() => router.push('/trip/plan')}
            style={{ marginBottom: Spacing.md }}
          />
          <QuickAction
            title="Trip History"
            description="View past trips"
            icon="time-outline"
            color={Colors.safeGreen}
            onPress={() => router.push('/trip/history')}
            style={{ marginBottom: Spacing.md }}
          />
          <QuickAction
            title="Safe Circle"
            description={circle ? circle.name : 'Add trusted contacts'}
            icon="shield-checkmark-outline"
            color={Colors.accent}
            onPress={() => router.push('/(tabs)/circles')}
            style={{ marginBottom: Spacing.md }}
          />
          <QuickAction
            title="My Routes"
            description="Manage saved routes"
            icon="map-outline"
            color={Colors.warningOrange}
            onPress={() => router.push('/(tabs)/routes')}
          />
        </View>

        {/* Tracking Stats */}
        {!activeTrip && (
          <>
            <Text style={styles.sectionTitle}>Your Activity</Text>
            <TrackingStatsCard onRefresh={onRefresh} />
          </>
        )}

        {/* No Active Trip CTA */}
        {!activeTrip && (
          <Card style={styles.ctaCard}>
            <Ionicons name="compass-outline" size={40} color={Colors.primary} />
            <Text style={styles.ctaTitle}>Ready to go?</Text>
            <Text style={styles.ctaDesc}>
              Plan a trip and let your circle know you're traveling safely.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/trip/plan')}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>Plan a Trip</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
          </Card>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  avatarBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 100,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.safeGreenFaded,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.safeGreen,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.safeGreen,
    flex: 1,
  },
  circleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFaded,
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  circleTagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginLeft: 4,
  },
  activeTripCard: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
    marginBottom: Spacing.xl,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.safeGreen,
    marginRight: 6,
  },
  liveText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    letterSpacing: 1,
  },
  activeTripTime: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  activeTripDest: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  activeTripFooter: {
    alignItems: 'flex-end',
  },
  activeTripAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
  },
  quickActions: {
    marginBottom: Spacing.xl,
  },
  ctaCard: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    borderColor: Colors.primary + '30',
  },
  ctaTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  ctaDesc: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 28,
    ...Shadows.md,
  },
  ctaButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
    marginRight: 8,
  },
});
