import React, { useRef } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/context/supabase-provider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import extracted components
import { UserHeader } from "@/components/dashboard/UserHeader";
import { UserStatsCard } from "@/components/dashboard/UserStatsCard";
import { FriendsActivitySection } from "@/components/dashboard/FriendsActivity";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MatchesSection } from "@/components/dashboard/MatchesSection";

// Import custom hook
import { useDashboardData } from "@/hooks/useDashboardData";

export default function EnhancedCleanDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  // Animation setup
  const HEADER_MAX_HEIGHT = 200;
  const HEADER_MIN_HEIGHT = 100;
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const collapseDistance = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;
  const collapsedTitleOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.5, collapseDistance * 0.9],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.4, collapseDistance * 0.7],
    outputRange: [1, 0, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.7],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });

  // Use custom hook for data management
  const {
    loading,
    refreshing,
    matches,
    friendsActivity,
    userStats,
    categorizedMatches,
    onRefresh,
  } = useDashboardData();

  if (loading) {
    return (
      <View className="flex-1 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            Loading your dashboard...
          </Text>
          <View className="mt-4 flex-row gap-4">
            <View className="items-center">
              <View className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center">
                <Ionicons name="globe" size={12} color="#2563eb" />
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Public
              </Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center">
                <Ionicons name="lock-closed" size={12} color="#6b7280" />
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Private
              </Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full items-center justify-center">
                <Ionicons name="time" size={12} color="#d97706" />
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pending
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 dark:bg-gray-900">
      <UserHeader
        profile={profile}
        headerHeight={headerHeight}
        titleOpacity={titleOpacity}
        titleTranslateY={titleTranslateY}
        collapsedTitleOpacity={collapsedTitleOpacity}
        insets={insets}
      />

      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={["#3B82F6"]}
          />
        }
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      >
        <View className="px-5 mt-8">
          <UserStatsCard
            userStats={userStats}
            glickoRating={profile?.glicko_rating}
          />
        </View>

        {matches.length === 0 ? (
          <EmptyState />
        ) : (
          <View className="px-5">
            <MatchesSection
              title="Needs Attention"
              matches={categorizedMatches.needsAttention}
              type="attention"
              showBadge={true}
              badgeCount={categorizedMatches.needsAttention.length}
            />

            <MatchesSection
              title="Recent Matches"
              matches={categorizedMatches.recent}
              type="recent"
              viewAllAction={() =>
                router.push("/(protected)/(screens)/match-history")
              }
            />

            <FriendsActivitySection friendsActivity={friendsActivity} />
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}
