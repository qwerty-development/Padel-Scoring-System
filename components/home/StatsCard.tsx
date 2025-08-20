import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Profile, MatchData } from "@/types";

interface StatsCardProps {
  profile: Profile | null;
  matches: MatchData[];
  userId: string;
}

export function StatsCard({ profile, matches, userId }: StatsCardProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push("/(tabs)/profile");
  };
  // Calculate stats from matches data
  const stats = useMemo(() => {
    if (!matches || matches.length === 0) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      };
    }

    let wins = 0;
    let losses = 0;

    matches.forEach((match) => {
      // Determine which team the user is on
      const isTeam1 =
        match.player1_id === userId || match.player2_id === userId;
      const isTeam2 =
        match.player3_id === userId || match.player4_id === userId;

      // Get the winner based on sets instead of directly from winner_team
      let winnerTeam = 0;

      // Count sets won by each team
      let team1Sets = 0;
      let team2Sets = 0;

      // Check first set
      if (match.team1_score_set1 > match.team2_score_set1) {
        team1Sets++;
      } else if (match.team2_score_set1 > match.team1_score_set1) {
        team2Sets++;
      }

      // Check second set
      if (match.team1_score_set2 > match.team2_score_set2) {
        team1Sets++;
      } else if (match.team2_score_set2 > match.team1_score_set2) {
        team2Sets++;
      }

      // Check third set if it exists
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        if (match.team1_score_set3 > match.team2_score_set3) {
          team1Sets++;
        } else if (match.team2_score_set3 > match.team1_score_set3) {
          team2Sets++;
        }
      }

      // Determine winner based on sets
      if (team1Sets > team2Sets) {
        winnerTeam = 1;
      } else if (team2Sets > team1Sets) {
        winnerTeam = 2;
      }

      // Count win or loss
      if (isTeam1 && winnerTeam === 1) {
        wins++;
      } else if (isTeam2 && winnerTeam === 2) {
        wins++;
      } else if (winnerTeam !== 0) {
        // Only count as a loss if there was a winner (not a draw)
        losses++;
      }
    });

    const totalMatches = matches.length;
    const winRate =
      totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    return {
      totalMatches,
      wins,
      losses,
      winRate,
    };
  }, [matches, userId]);

  // Format the Glicko rating with appropriate rounding
  const formattedRating = useMemo(() => {
    if (!profile?.glicko_rating) return "-";

    // Handle both string and number types for glicko_rating
    const rating =
      typeof profile.glicko_rating === "string"
        ? parseInt(profile.glicko_rating, 10)
        : profile.glicko_rating;

    return isNaN(rating) ? "-" : Math.round(rating).toString();
  }, [profile?.glicko_rating]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6}>
      <View className="bg-card rounded-xl p-6 mb-6 shadow">
        <H3 className="mb-4">Your Statistics</H3>
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-2xl font-bold text-primary">
              {formattedRating}
            </Text>
            <Text className="text-sm text-muted-foreground">Rating</Text>
          </View>

          <View className="items-center">
            <Text className="text-2xl font-bold text-green-500">
              {stats.wins}
            </Text>
            <Text className="text-sm text-muted-foreground">Wins</Text>
          </View>

          <View className="items-center">
            <Text className="text-2xl font-bold text-red-500">
              {stats.losses}
            </Text>
            <Text className="text-sm text-muted-foreground">Losses</Text>
          </View>

          <View className="items-center">
            <Text className="text-2xl font-bold">{stats.totalMatches}</Text>
            <Text className="text-sm text-muted-foreground">Matches</Text>
          </View>
        </View>

        {/* Win rate bar (optional) */}
        {stats.totalMatches > 0 && (
          <View className="mt-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs text-muted-foreground">Win Rate</Text>
              <Text className="text-xs font-medium">{stats.winRate}%</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${stats.winRate}%` }}
              />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
