import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";

// Simplified enums and interfaces
export enum MatchStatus {
  PENDING = 1,
  CANCELLED = 3,
  COMPLETED = 4,
  RECRUITING = 5,
}

interface PlayerProfile {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
}

interface PublicMatch {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  is_public: boolean;
  description: string | null;
  player1?: PlayerProfile;
  player2?: PlayerProfile;
  player3?: PlayerProfile;
  player4?: PlayerProfile;

  // Computed properties
  totalAvailableSlots?: number;
  timeUntilMatch?: number;
  averageRating?: number;
  isUserInMatch?: boolean;
  canJoin?: boolean;
  team1Players?: PlayerProfile[];
  team2Players?: PlayerProfile[];
}

interface FilterState {
  searchQuery: string;
  availableSlotsOnly: boolean;
  timeRange: "all" | "today" | "tomorrow" | "week";
}

// Clean Avatar Component
interface AvatarProps {
  user: PlayerProfile;
  size?: "sm" | "md";
}

const Avatar: React.FC<AvatarProps> = ({ user, size = "md" }) => {
  const [imageError, setImageError] = useState(false);

  const sizeConfig = {
    sm: { width: 32, height: 32, borderRadius: 16, textClass: "text-sm" },
    md: { width: 40, height: 40, borderRadius: 20, textClass: "text-base" },
  }[size];

  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const getName = () => {
    if (user.full_name?.trim()) {
      return user.full_name.split(" ")[0];
    }
    return user.email.split("@")[0];
  };

  if (user.avatar_url && !imageError) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={sizeConfig}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      className="bg-blue-500 items-center justify-center"
      style={sizeConfig}
    >
      <Text className={`${sizeConfig.textClass} font-bold text-white`}>
        {getInitial()}
      </Text>
    </View>
  );
};

// Team Selection Modal
interface TeamSelectionModalProps {
  visible: boolean;
  match: PublicMatch | null;
  onClose: () => void;
  onSelectTeam: (teamNumber: 1 | 2) => void;
  loading: boolean;
}

const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
  visible,
  match,
  onClose,
  onSelectTeam,
  loading,
}) => {
  if (!match) return null;

  const team1HasSpace = !match.player1_id || !match.player2_id;
  const team2HasSpace = !match.player3_id || !match.player4_id;

  const renderTeam = (teamNumber: 1 | 2) => {
    const players = teamNumber === 1 ? match.team1Players : match.team2Players;
    const hasSpace = teamNumber === 1 ? team1HasSpace : team2HasSpace;
    const teamColor = teamNumber === 1 ? "blue" : "purple";

    return (
      <View
        className={`flex-1 p-4 rounded-xl bg-${teamColor}-50 dark:bg-${teamColor}-900/20 mx-2`}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className={`text-lg font-bold text-${teamColor}-600`}>
            Team {teamNumber}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {players?.length || 0}/2 players
          </Text>
        </View>

        {/* Players */}
        <View className="mb-4">
          {players?.map((player) => (
            <View key={player.id} className="flex-row items-center mb-2">
              <Avatar user={player} size="sm" />
              <View className="ml-3 flex-1">
                <Text className="font-medium text-gray-900 dark:text-gray-100">
                  {player.full_name || player.email.split("@")[0]}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {player.glicko_rating
                    ? Math.round(parseFloat(player.glicko_rating))
                    : 1500}
                </Text>
              </View>
            </View>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 2 - (players?.length || 0) }).map(
            (_, index) => (
              <View
                key={index}
                className="flex-row items-center mb-2 opacity-50"
              >
                <View
                  className={`w-8 h-8 rounded-full border-2 border-dashed border-${teamColor}-300 items-center justify-center`}
                >
                  <Text className={`text-${teamColor}-400`}>?</Text>
                </View>
                <Text className="ml-3 text-gray-500 dark:text-gray-400">
                  Open slot
                </Text>
              </View>
            ),
          )}
        </View>

        {/* Join Button */}
        <Button
          variant={hasSpace ? "default" : "outline"}
          className="w-full"
          onPress={() => hasSpace && onSelectTeam(teamNumber)}
          disabled={!hasSpace || loading}
          style={{
            backgroundColor: hasSpace
              ? teamNumber === 1
                ? "#3B82F6"
                : "#8B5CF6"
              : undefined,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              className={
                hasSpace ? "text-white" : "text-gray-500 dark:text-gray-400"
              }
            >
              {hasSpace ? `Join Team ${teamNumber}` : "Team Full"}
            </Text>
          )}
        </Button>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center p-4">
        <View className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <View>
              <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Choose Your Team
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(match.start_time).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Teams */}
          <View className="p-6">
            <View className="flex-row">
              {renderTeam(1)}
              {renderTeam(2)}
            </View>

            {!team1HasSpace && !team2HasSpace && (
              <View className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <Text className="text-sm text-red-600 dark:text-red-400 text-center">
                  This match is currently full. Check back later for
                  cancellations.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function CleanBrowsePublicMatches() {
  const router = useRouter();
  const { profile, session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publicMatches, setPublicMatches] = useState<PublicMatch[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [teamSelectionMatch, setTeamSelectionMatch] =
    useState<PublicMatch | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    availableSlotsOnly: false,
    timeRange: "all",
  });

  // Process match data
  const processMatchData = useCallback(
    (matches: any[]): PublicMatch[] => {
      const now = new Date();
      const userId = session?.user?.id;

      return matches.map((match) => {
        const startTime = new Date(match.start_time);
        const timeUntilMatch = startTime.getTime() - now.getTime();

        const team1Players = [match.player1, match.player2].filter(Boolean);
        const team2Players = [match.player3, match.player4].filter(Boolean);
        const totalAvailableSlots =
          4 - team1Players.length - team2Players.length;

        const isUserInMatch = [
          match.player1_id,
          match.player2_id,
          match.player3_id,
          match.player4_id,
        ].includes(userId);

        const canJoin =
          !isUserInMatch && totalAvailableSlots > 0 && timeUntilMatch > 0;

        const allPlayers = [...team1Players, ...team2Players];
        const ratings = allPlayers
          .map((p) => parseFloat(p?.glicko_rating || "1500"))
          .filter((r) => !isNaN(r));

        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
            : 1500;

        return {
          ...match,
          totalAvailableSlots,
          timeUntilMatch,
          averageRating,
          isUserInMatch,
          canJoin,
          team1Players,
          team2Players,
        };
      });
    },
    [session?.user?.id],
  );

  // Apply filters
  const filteredMatches = useMemo(() => {
    let filtered = [...publicMatches];

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((match) => {
        const searchableText = [
          match.region,
          match.court,
          match.description,
          ...(match.team1Players?.map((p) => p.full_name || p.email) || []),
          ...(match.team2Players?.map((p) => p.full_name || p.email) || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    // Available slots filter
    if (filters.availableSlotsOnly) {
      filtered = filtered.filter(
        (match) => match.totalAvailableSlots && match.totalAvailableSlots > 0,
      );
    }

    // Time range filter
    if (filters.timeRange !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((match) => {
        const matchDate = new Date(match.start_time);

        switch (filters.timeRange) {
          case "today":
            return (
              matchDate >= today &&
              matchDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
            );
          case "tomorrow":
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            return (
              matchDate >= tomorrow &&
              matchDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
            );
          case "week":
            const weekFromNow = new Date(
              today.getTime() + 7 * 24 * 60 * 60 * 1000,
            );
            return matchDate >= today && matchDate <= weekFromNow;
          default:
            return true;
        }
      });
    }

    // Sort by time
    filtered.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );

    return filtered;
  }, [publicMatches, filters]);

  // Fetch matches
  const fetchPublicMatches = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      const now = new Date();

      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `,
        )
        .eq("is_public", true)
        .gte("start_time", now.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const processedData = processMatchData(data || []);
      setPublicMatches(processedData);
    } catch (error) {
      console.error("Error fetching matches:", error);
      Alert.alert("Error", "Could not load public matches. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [processMatchData, refreshing]);

  // Handle match press
  const handleMatchPress = useCallback(
    (match: PublicMatch) => {
      if (match.isUserInMatch) {
        router.push({
          pathname: "/(protected)/(screens)/match-details",
          params: { matchId: match.id },
        });
        return;
      }

      if (!match.canJoin) {
        Alert.alert(
          "Cannot Join",
          "This match is full or has already started.",
        );
        return;
      }

      setTeamSelectionMatch(match);
      setShowTeamModal(true);
    },
    [router],
  );

  // Handle team selection
  const handleTeamSelection = useCallback(
    async (teamNumber: 1 | 2) => {
      if (!teamSelectionMatch || !session?.user?.id) return;

      try {
        setJoining(teamSelectionMatch.id);

        let updateField = "";
        if (teamNumber === 1) {
          if (!teamSelectionMatch.player1_id) {
            updateField = "player1_id";
          } else if (!teamSelectionMatch.player2_id) {
            updateField = "player2_id";
          }
        } else {
          if (!teamSelectionMatch.player3_id) {
            updateField = "player3_id";
          } else if (!teamSelectionMatch.player4_id) {
            updateField = "player4_id";
          }
        }

        if (!updateField) {
          throw new Error(`Team ${teamNumber} is full`);
        }

        const { error } = await supabase
          .from("matches")
          .update({ [updateField]: session.user.id })
          .eq("id", teamSelectionMatch.id)
          .is(updateField, null);

        if (error) throw error;

        setShowTeamModal(false);
        setTeamSelectionMatch(null);

        Alert.alert(
          "Successfully Joined!",
          `You have joined Team ${teamNumber}. Good luck!`,
          [
            {
              text: "View Match",
              onPress: () =>
                router.push({
                  pathname: "/(protected)/(screens)/match-details",
                  params: { matchId: teamSelectionMatch.id },
                }),
            },
            {
              text: "Continue Browsing",
              onPress: () => fetchPublicMatches(),
            },
          ],
        );
      } catch (error) {
        console.error("Join error:", error);
        Alert.alert(
          "Join Failed",
          "Could not join the match. The position may have been filled.",
        );
        fetchPublicMatches();
      } finally {
        setJoining(null);
      }
    },
    [teamSelectionMatch, session?.user?.id, router, fetchPublicMatches],
  );

  useEffect(() => {
    if (session?.user?.id) {
      fetchPublicMatches();
    }
  }, [session, fetchPublicMatches]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPublicMatches();
  }, [fetchPublicMatches]);

  const formatTimeUntilMatch = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor(milliseconds / (1000 * 60));
    if (minutes > 0) return `${minutes}m`;
    return "Soon";
  };

  const getSkillLevel = (rating: number): { label: string; color: string } => {
    if (rating < 1300) return { label: "Beginner", color: "#22c55e" };
    if (rating < 1500) return { label: "Intermediate", color: "#eab308" };
    if (rating < 1700) return { label: "Advanced", color: "#f97316" };
    if (rating < 1900) return { label: "Expert", color: "#dc2626" };
    return { label: "Pro", color: "#7c3aed" };
  };

  const renderMatchCard = useCallback(
    (match: PublicMatch) => {
      const startTime = new Date(match.start_time);
      const formattedDate = startTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const formattedTime = startTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const timeUntilText =
        match.timeUntilMatch && match.timeUntilMatch > 0
          ? formatTimeUntilMatch(match.timeUntilMatch)
          : "Starting Soon";

      const skill = getSkillLevel(match.averageRating || 1500);

      const getActionText = () => {
        if (match.isUserInMatch) return "View Details";
        if (!match.canJoin) return "Match Full";
        return "Join Match";
      };

      return (
        <TouchableOpacity
          key={match.id}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
          onPress={() => handleMatchPress(match)}
          disabled={joining === match.id}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formattedDate} • {formattedTime}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {timeUntilText}
              </Text>
            </View>

            <View className="items-end">
              <View className="flex-row items-center">
                <Ionicons
                  name="people"
                  size={16}
                  color="#6B7280"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {4 - (match.totalAvailableSlots || 0)}/4
                </Text>
              </View>
              {(match.totalAvailableSlots || 0) > 0 && (
                <Text className="text-xs text-green-600 dark:text-green-400">
                  {match.totalAvailableSlots} spot
                  {match.totalAvailableSlots !== 1 ? "s" : ""} open
                </Text>
              )}
            </View>
          </View>

          {/* Location */}
          {(match.region || match.court) && (
            <View className="flex-row items-center mb-3">
              <Ionicons
                name="location-outline"
                size={16}
                color="#6B7280"
                style={{ marginRight: 6 }}
              />
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                {match.court && match.region
                  ? `${match.court}, ${match.region}`
                  : match.court || match.region}
              </Text>
            </View>
          )}

          {/* Skill Level */}
          <View className="flex-row items-center mb-4">
            <View
              className="px-3 py-1 rounded-full mr-3"
              style={{ backgroundColor: skill.color + "20" }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: skill.color }}
              >
                {skill.label}
              </Text>
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              Avg: {Math.round(match.averageRating || 1500)}
            </Text>
          </View>

          {/* Players */}
          <View className="flex-row justify-between mb-4">
            {/* Team 1 */}
            <View className="flex-1 mr-2">
              <Text className="text-xs text-primary font-medium mb-2">
                Team 1
              </Text>
              {match.team1Players?.map((player) => (
                <View key={player.id} className="flex-row items-center mb-1">
                  <Avatar user={player} size="sm" />
                  <Text className="text-xs ml-2 flex-1" numberOfLines={1}>
                    {player.full_name || player.email.split("@")[0]}
                  </Text>
                </View>
              ))}
              {Array.from({
                length: 2 - (match.team1Players?.length || 0),
              }).map((_, index) => (
                <View
                  key={index}
                  className="flex-row items-center mb-1 opacity-50"
                >
                  <View className="w-8 h-8 rounded-full border border-dashed border-blue-300 items-center justify-center">
                    <Text className="text-blue-400 text-xs">?</Text>
                  </View>
                  <Text className="text-xs ml-2 text-gray-400">Open</Text>
                </View>
              ))}
            </View>

            {/* VS */}
            <View className="items-center justify-center px-2">
              <Text className="text-sm font-bold text-gray-400">VS</Text>
            </View>

            {/* Team 2 */}
            <View className="flex-1 ml-2">
              <Text className="text-xs text-purple-600 font-medium mb-2">
                Team 2
              </Text>
              {match.team2Players?.map((player) => (
                <View key={player.id} className="flex-row items-center mb-1">
                  <Avatar user={player} size="sm" />
                  <Text className="text-xs ml-2 flex-1" numberOfLines={1}>
                    {player.full_name || player.email.split("@")[0]}
                  </Text>
                </View>
              ))}
              {Array.from({
                length: 2 - (match.team2Players?.length || 0),
              }).map((_, index) => (
                <View
                  key={index}
                  className="flex-row items-center mb-1 opacity-50"
                >
                  <View className="w-8 h-8 rounded-full border border-dashed border-purple-300 items-center justify-center">
                    <Text className="text-purple-400 text-xs">?</Text>
                  </View>
                  <Text className="text-xs ml-2 text-gray-400">Open</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Description */}
          {match.description && (
            <View className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Text className="text-sm text-gray-600 dark:text-gray-300 italic">
                {match.description}
              </Text>
            </View>
          )}

          {/* Action Button */}
          <Button
            variant={
              match.canJoin && !match.isUserInMatch ? "default" : "outline"
            }
            className="w-full"
            onPress={() => handleMatchPress(match)}
            disabled={
              joining === match.id || (!match.canJoin && !match.isUserInMatch)
            }
          >
            {joining === match.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                className={`font-medium ${
                  match.canJoin && !match.isUserInMatch
                    ? "text-white"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {getActionText()}
              </Text>
            )}
          </Button>
        </TouchableOpacity>
      );
    },
    [handleMatchPress, joining],
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            Loading public matches...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-background dark:bg-gray-800 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Public Matches
        </Text>

        {/* Search */}
        <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 mb-4">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-gray-900 dark:text-gray-100"
            placeholder="Search matches..."
            value={filters.searchQuery}
            onChangeText={(text) =>
              setFilters((prev) => ({ ...prev, searchQuery: text }))
            }
            placeholderTextColor="#9CA3AF"
          />
          {filters.searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                setFilters((prev) => ({ ...prev, searchQuery: "" }))
              }
            >
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row"
        >
          <TouchableOpacity
            className={`mr-3 px-4 py-2 rounded-xl ${
              filters.availableSlotsOnly
                ? "bg-blue-500"
                : "bg-gray-100 dark:bg-gray-700"
            }`}
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                availableSlotsOnly: !prev.availableSlotsOnly,
              }))
            }
          >
            <Text
              className={`font-medium ${
                filters.availableSlotsOnly
                  ? "text-white"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Available Only
            </Text>
          </TouchableOpacity>

          {(["today", "tomorrow", "week"] as const).map((range) => (
            <TouchableOpacity
              key={range}
              className={`mr-3 px-4 py-2 rounded-xl ${
                filters.timeRange === range
                  ? "bg-blue-500"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  timeRange: prev.timeRange === range ? "all" : range,
                }))
              }
            >
              <Text
                className={`font-medium capitalize ${
                  filters.timeRange === range
                    ? "text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results Count */}
        <View className="mt-4">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {filteredMatches.length} match
            {filteredMatches.length !== 1 ? "es" : ""} found
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredMatches.length > 0 ? (
          filteredMatches.map(renderMatchCard)
        ) : (
          <View className="items-center justify-center py-16">
            <View className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-6">
              <Ionicons name="search-outline" size={40} color="#9CA3AF" />
            </View>
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No matches found
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center mb-8 px-6">
              {publicMatches.length === 0
                ? "No public matches are currently available. Be the first to create one!"
                : "Try adjusting your filters or search terms to find matches."}
            </Text>
            <Button
              onPress={() => router.push("/(protected)/(screens)/create-match")}
              className="bg-blue-500 hover:bg-primary"
            >
              <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
              <Text className="text-white font-medium">
                Create Public Match
              </Text>
            </Button>
          </View>
        )}
      </ScrollView>

      {/* Team Selection Modal */}
      <TeamSelectionModal
        visible={showTeamModal}
        match={teamSelectionMatch}
        onClose={() => {
          setShowTeamModal(false);
          setTeamSelectionMatch(null);
        }}
        onSelectTeam={handleTeamSelection}
        loading={joining !== null}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => router.push("/(protected)/(screens)/create-match")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 items-center justify-center shadow-lg"
        style={{
          shadowColor: "#3B82F6",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
