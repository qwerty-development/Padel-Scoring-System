import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { MatchData } from "@/types/dashboard";
import MatchCard from "@/components/matches/MatchCard";

interface MatchesSectionProps {
  title: string;
  matches: MatchData[];
  type: "upcoming" | "attention" | "recent";
  viewAllAction?: () => void;
  showBadge?: boolean;
  badgeCount?: number;
}

export const MatchesSection: React.FC<MatchesSectionProps> = ({
  title,
  matches,
  type,
  viewAllAction,
  showBadge,
  badgeCount,
}) => {
  if (matches.length === 0) return null;

  return (
    <View className="mb-8">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Text className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </Text>
          {showBadge && badgeCount && badgeCount > 0 && (
            <View
              className={`ml-3 px-2 py-1 rounded-full ${
                type === "attention"
                  ? "bg-orange-100 dark:bg-orange-900/30"
                  : "bg-blue-100 dark:bg-blue-900/30"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  type === "attention"
                    ? "text-orange-800 dark:text-orange-300"
                    : "text-blue-800 dark:text-blue-300"
                }`}
              >
                {badgeCount}
              </Text>
            </View>
          )}
        </View>
        {viewAllAction && (
          <TouchableOpacity
            onPress={viewAllAction}
            className="flex-row items-center"
          >
            <Text className="text-blue-600 text-sm mr-1">View All</Text>
            <Ionicons name="chevron-forward" size={14} color="#2563eb" />
          </TouchableOpacity>
        )}
      </View>

      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </View>
  );
};
