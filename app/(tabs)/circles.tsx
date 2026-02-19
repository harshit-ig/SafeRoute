import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  FlatList,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useCircleStore } from '../../src/stores/circleStore';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import EmptyState from '../../src/components/EmptyState';
import LoadingScreen from '../../src/components/LoadingScreen';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { User } from '../../src/types';

export default function CirclesScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { circle, members, isLoading, loadUserCircle, loadMembers, leaveCircle } = useCircleStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await loadUserCircle();
    if (user?.groupCode) {
      await loadMembers(user.groupCode);
    }
  }, [user?.groupCode]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleShare = async () => {
    if (!circle) return;
    try {
      await Share.share({
        message: `Join my SafeRoute circle "${circle.name}"${circle.description ? `: ${circle.description}` : ''}\n\nUse code: ${circle.groupCode}`,
      });
    } catch {}
  };

  const handleLeave = () => {
    if (!circle) return;
    Alert.alert(
      'Leave Circle',
      'Are you sure you want to leave? You will no longer receive alerts from this circle.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveCircle(circle.groupCode);
          },
        },
      ]
    );
  };

  if (isLoading && !circle) {
    return <LoadingScreen message="Loading your circle..." />;
  }

  // No circle view
  if (!circle) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Text style={styles.headerTitle}>Safe Circle</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="shield-checkmark" size={64} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Safe Circle Yet</Text>
          <Text style={styles.emptyDesc}>
            Create or join a Safe Circle to stay connected with trusted contacts during your trips.
          </Text>
          <Text style={styles.emptyNote}>
            You can only be a member of one circle at a time.
          </Text>
          <Button
            title="Create New Circle"
            onPress={() => router.push('/circle/create')}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.xxl }}
            icon={<Ionicons name="add-circle-outline" size={20} color={Colors.white} style={{ marginRight: 4 }} />}
          />
          <Button
            title="Join Existing Circle"
            onPress={() => router.push('/circle/join')}
            variant="outline"
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.md }}
            icon={<Ionicons name="enter-outline" size={20} color={Colors.primary} style={{ marginRight: 4 }} />}
          />
        </View>
      </View>
    );
  }

  // Circle details view
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Safe Circle</Text>
        <TouchableOpacity onPress={handleLeave}>
          <Ionicons name="exit-outline" size={24} color={Colors.dangerRed} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Circle Info Card */}
        <Card style={styles.circleCard}>
          <Text style={styles.circleName}>{circle.name}</Text>
          {circle.description && (
            <Text style={styles.circleDesc}>{circle.description}</Text>
          )}
          <Text style={styles.codeLabel}>Share this code with others to join:</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{circle.groupCode}</Text>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Members Section */}
        <View style={styles.membersHeader}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
        </View>

        {members.map((member) => (
          <Card key={member.id} style={styles.memberCard}>
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Ionicons name="person" size={20} color={Colors.primary} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.name}
                  {member.id === user?.id && (
                    <Text style={styles.youBadge}> (You)</Text>
                  )}
                </Text>
                <Text style={styles.memberPhone}>{member.phoneNumber}</Text>
              </View>
              {member.id === circle.creatorId && (
                <View style={styles.creatorBadge}>
                  <Text style={styles.creatorText}>Creator</Text>
                </View>
              )}
            </View>
          </Card>
        ))}

        <Text style={styles.circleNote}>
          You can only be a member of one Safe Circle at a time.
        </Text>
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
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  emptyNote: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },
  circleCard: {
    marginBottom: Spacing.xl,
  },
  circleName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  circleDesc: {
    fontSize: FontSize.md,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.sm,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryFaded,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  codeText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 4,
  },
  shareBtn: {
    padding: Spacing.sm,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.dark.text,
  },
  memberCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.dark.text,
  },
  youBadge: {
    color: Colors.primary,
    fontWeight: FontWeight.regular,
  },
  memberPhone: {
    fontSize: FontSize.sm,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  creatorBadge: {
    backgroundColor: Colors.primaryFaded,
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  creatorText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.primary,
  },
  circleNote: {
    fontSize: FontSize.sm,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xxl,
    fontStyle: 'italic',
  },
});
