import React, { useMemo } from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/context/supabase-provider";

interface Player {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface MatchCardProps {
  match: {
    id: string;
    player1: Player;
    player2: Player | null;
    player3: Player | null;
    player4: Player | null;
    player1_id: string;
    player2_id: string | null;
    player3_id: string | null;
    player4_id: string | null;
    team1_score_set1: number | null;
    team2_score_set1: number | null;
    team1_score_set2: number | null;
    team2_score_set2: number | null;
    team1_score_set3: number | null;
    team2_score_set3: number | null;
    winner_team: number | null;
    start_time: string;
    status: string | number;
    region: string | null;
    court: string | null;
    validation_status?: string;
    all_confirmed?: boolean;
    confirmation_status?: string;
    rating_applied?: boolean;
  };
  showConfirmationBadge?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  showConfirmationBadge = true,
}) => {
  const router = useRouter();
  const { profile } = useAuth();

  // Check if user is participant
  const isParticipant = useMemo(() => {
    return [
      match.player1_id,
      match.player2_id,
      match.player3_id,
      match.player4_id,
    ]
      .filter(Boolean)
      .includes(profile?.id || "");
  }, [match, profile]);

  // Determine match status
  const matchStatus = useMemo(() => {
    const statusNum =
      typeof match.status === "string"
        ? parseInt(match.status, 10)
        : match.status;
    const hasScores = match.team1_score_set1 !== null;
    const isCompleted = statusNum === 4;
    const isPending = statusNum === 1;

    return {
      statusNum,
      hasScores,
      isCompleted,
      isPending,
      displayStatus: getStatusDisplay(statusNum),
    };
  }, [match]);

  // Determine confirmation status
  const confirmationStatus = useMemo(() => {
    if (!matchStatus.isCompleted || !matchStatus.hasScores) {
      return null;
    }

    if (match.all_confirmed) {
      return {
        type: "confirmed",
        label: "Confirmed",
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        icon: "checkmark-circle",
      };
    }

    if (
      match.confirmation_status === "rejected" ||
      match.validation_status === "disputed"
    ) {
      return {
        type: "rejected",
        label: "Disputed",
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        icon: "close-circle",
      };
    }

    if (match.rating_applied) {
      return {
        type: "validated",
        label: "Validated",
        color: "text-primary",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        icon: "shield-checkmark",
      };
    }

    return {
      type: "pending",
      label: "Pending",
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      icon: "time",
    };
  }, [match, matchStatus]);

  const getStatusDisplay = (status: number): string => {
    switch (status) {
      case 1:
        return "Upcoming";
      case 2:
        return "Needs Confirmation";
      case 3:
        return "Cancelled";
      case 4:
        return "Completed";
      case 5:
        return "Recruiting";
      default:
        return "Unknown";
    }
  };

  const getPlayerAvatar = (player: Player | null) => {
    if (!player) return null;

    if (player.avatar_url) {
      return (
        <Image
          source={{ uri: player.avatar_url }}
          className="w-8 h-8 rounded-full"
        />
      );
    }

    return (
      <View className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 items-center justify-center">
        <Text className="text-xs font-semibold">
          {player.full_name?.[0] || player.email[0].toUpperCase()}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/match-details?id=${match.id}`)}
      className="bg-background/80 rounded-xl p-4 mb-3"
      activeOpacity={0.7}
    >
      {/* Header with date and status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className="text-sm text-muted-foreground">
            {format(new Date(match.start_time), "EEE, MMM d")} at{" "}
            {format(new Date(match.start_time), "h:mm a")}
          </Text>
          {match.region && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text className="text-xs text-muted-foreground ml-1">
                {match.region} {match.court ? `- ${match.court}` : ""}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {/* Confirmation Badge */}
          {showConfirmationBadge && confirmationStatus && (
            <View
              className={`px-2 py-1 rounded-full ${confirmationStatus.bgColor}`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={confirmationStatus.icon as any}
                  size={12}
                  color={confirmationStatus.color
                    .replace("text-", "")
                    .replace("600", "")}
                />
                <Text
                  className={`text-xs font-medium ml-1 ${confirmationStatus.color}`}
                >
                  {confirmationStatus.label}
                </Text>
              </View>
            </View>
          )}

          {/* Match Status Badge */}
          <View
            className={`px-2 py-1 rounded-full ${
              matchStatus.isCompleted
                ? "bg-green-100 dark:bg-green-900/30"
                : matchStatus.statusNum === 3
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-blue-100 dark:bg-blue-900/30"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                matchStatus.isCompleted
                  ? "text-green-700 dark:text-green-300"
                  : matchStatus.statusNum === 3
                    ? "text-red-700 dark:text-red-300"
                    : "text-blue-700 dark:text-blue-300"
              }`}
            >
              {matchStatus.displayStatus}
            </Text>
          </View>
        </View>
      </View>

      {/* Teams */}
      <View className="space-y-3">
        {/* Team 1 */}
        <View>
          <Text className="text-xs text-muted-foreground mb-1">TEAM 1</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row -space-x-2">
              {getPlayerAvatar(match.player1)}
              {match.player2 && getPlayerAvatar(match.player2)}
            </View>
            <Text className="text-sm flex-1" numberOfLines={1}>
              {match.player1?.full_name || match.player1?.email.split("@")[0]}
              {match.player2 &&
                ` & ${match.player2.full_name || match.player2.email.split("@")[0]}`}
            </Text>
          </View>
        </View>

        {/* Team 2 */}
        <View>
          <Text className="text-xs text-muted-foreground mb-1">TEAM 2</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row -space-x-2">
              {match.player3 && getPlayerAvatar(match.player3)}
              {match.player4 && getPlayerAvatar(match.player4)}
            </View>
            <Text className="text-sm flex-1" numberOfLines={1}>
              {match.player3
                ? match.player3.full_name || match.player3.email.split("@")[0]
                : "TBD"}
              {match.player4 &&
                ` & ${match.player4.full_name || match.player4.email.split("@")[0]}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Scores */}
      {matchStatus.hasScores && (
        <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Text className="text-xs text-muted-foreground">Score:</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-medium">
                  {match.team1_score_set1}-{match.team2_score_set1}
                </Text>
                <Text className="text-sm font-medium">
                  {match.team1_score_set2}-{match.team2_score_set2}
                </Text>
                {match.team1_score_set3 !== null && (
                  <Text className="text-sm font-medium">
                    {match.team1_score_set3}-{match.team2_score_set3}
                  </Text>
                )}
              </View>
            </View>

            {match.winner_team && (
              <View className="flex-row items-center">
                <Ionicons name="trophy" size={14} color="#f59e0b" />
                <Text className="text-sm font-medium ml-1">
                  Team {match.winner_team}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Participation Indicator */}
      {isParticipant && (
        <View className="absolute top-2 right-2">
          <View className="w-2 h-2 rounded-full bg-primary" />
        </View>
      )}
    </TouchableOpacity>
  );
};
