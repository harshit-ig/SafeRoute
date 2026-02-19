import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../constants/theme';
import { locationService } from '../services/locationService';
import { useTripStore } from '../stores/tripStore';

interface TrackingStatsCardProps {
  onRefresh?: () => void;
}

export default function TrackingStatsCard({ onRefresh }: TrackingStatsCardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { loadTrackingStats, trackingStats } = useTripStore();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      await loadTrackingStats();
      const locationStats = await locationService.getTrackingStats();
      setStats(locationStats);
    } catch (error) {
      console.error('Failed to load tracking stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatSpeed = (metersPerSecond: number): string => {
    const kmh = metersPerSecond * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  if (!stats && !trackingStats) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="stats-chart" size={20} color={Colors.primary} />
          <Text style={styles.title}>Tracking Stats</Text>
        </View>
        <TouchableOpacity onPress={() => {
          loadStats();
          onRefresh?.();
        }} disabled={loading}>
          <Ionicons 
            name="refresh" 
            size={18} 
            color={loading ? Colors.dark.textMuted : Colors.primary} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Ionicons name="navigate-outline" size={24} color={Colors.safeGreen} />
          <Text style={styles.statValue}>
            {stats?.totalTrips || trackingStats?.totalTrips || 0}
          </Text>
          <Text style={styles.statLabel}>Total Trips</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="speedometer-outline" size={24} color={Colors.primary} />
          <Text style={styles.statValue}>
            {stats?.totalDistance 
              ? formatDistance(stats.totalDistance) 
              : trackingStats?.totalDistance 
              ? formatDistance(trackingStats.totalDistance)
              : '0m'}
          </Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="flash-outline" size={24} color={Colors.warningOrange} />
          <Text style={styles.statValue}>
            {stats?.averageSpeed 
              ? formatSpeed(stats.averageSpeed)
              : trackingStats?.averageSpeed
              ? formatSpeed(trackingStats.averageSpeed)
              : '0 km/h'}
          </Text>
          <Text style={styles.statLabel}>Avg Speed</Text>
        </View>
      </View>

      {stats?.lastUpdated && (
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
    marginLeft: Spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  lastUpdated: {
    fontSize: FontSize.xs,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
