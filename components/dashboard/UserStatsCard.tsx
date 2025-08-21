import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { UserStats } from "@/types/dashboard";
import { useColorScheme } from "@/lib/useColorScheme";

interface UserStatsCardProps {
  userStats: UserStats;
  glickoRating?: string | null;
}

export const UserStatsCard: React.FC<UserStatsCardProps> = ({
  userStats,
  glickoRating,
}) => {
  const { colorScheme } = useColorScheme();

  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 shadow-sm">
      <View className="flex-row">
        {/* Matches */}
        <View className="flex-1 items-center py-5 px-2">
          <View className="h-8 items-center justify-center mb-1">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {userStats.totalMatches}
            </Text>
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Matches
          </Text>
        </View>

        <View className="w-px bg-gray-200 dark:bg-gray-700" />

        {/* Win Rate */}
        <View className="flex-1 items-center py-5 px-2">
          <View className="h-8 items-center justify-center mb-1">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {userStats.winRate}%
            </Text>
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Win rate
          </Text>
        </View>

        <View className="w-px bg-gray-200 dark:bg-gray-700" />

        {/* Rating */}
        <View className="flex-1 items-center py-5 px-2">
          <View className="h-8 items-center justify-center mb-1">
            <View className="flex-row items-center">
              <Ionicons name="arrow-up" size={16} color="#16a34a" />
              <Text className="ml-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {glickoRating ? Math.round(parseFloat(glickoRating)) : "-"}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Rating
          </Text>
        </View>

        <View className="w-px bg-gray-200 dark:bg-gray-700" />

        {/* Streak */}
        <View className="flex-1 items-center py-5 px-2">
          <View className="h-8 items-center justify-center mb-1">
            {userStats.currentStreak > 0 ? (
              <View
                className="relative items-center justify-center"
                style={{ width: 32, height: 32 }}
              >
                <Ionicons 
                  name="flame" 
                  size={28} 
                  color={colorScheme === "dark" ? "#92400e" : "#fbbf24"} 
                />
                <Text className={`absolute text-xl font-bold ${
                  colorScheme === "dark" ? "text-white" : "text-black"
                } drop-shadow-sm`}>
                  {userStats.currentStreak}
                </Text>
              </View>
            ) : (
              <Text
                className={`text-2xl font-bold ${
                  userStats.currentStreak < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {userStats.currentStreak}
              </Text>
            )}
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Streak
          </Text>
        </View>
      </View>
    </View>
  );
};
