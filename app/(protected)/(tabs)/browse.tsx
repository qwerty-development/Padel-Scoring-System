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

import { H1, H2, H3 } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";

// **TECHNICAL SPECIFICATION 1: Production Match Status Enumeration**
export enum MatchStatus {
  PENDING = 1, // Future match, waiting for start time
  NEEDS_CONFIRMATION = 2, // Match finished, waiting for score confirmation
  CANCELLED = 3, // Match was cancelled
  COMPLETED = 4, // Match completed with scores recorded
  RECRUITING = 5, // Public match looking for players
}

// **TECHNICAL SPECIFICATION 2: Production-Grade Interface Definitions**
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
  created_at: string;
  player1?: PlayerProfile;
  player2?: PlayerProfile;
  player3?: PlayerProfile;
  player4?: PlayerProfile;
  // Computed properties for production UI
  team1Slots?: number;
  team2Slots?: number;
  totalAvailableSlots?: number;
  timeUntilMatch?: number;
  averageRating?: number;
  skillLevel?: string;
  isUserInMatch?: boolean;
  userTeam?: 1 | 2 | null;
  canJoinTeam1?: boolean;
  canJoinTeam2?: boolean;
  team1Players?: PlayerProfile[];
  team2Players?: PlayerProfile[];
}

interface PlayerProfile {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
}

// **TECHNICAL SPECIFICATION 3: Team Selection Interface**
interface TeamSelectionModalProps {
  visible: boolean;
  match: PublicMatch | null;
  onClose: () => void;
  onSelectTeam: (teamNumber: 1 | 2) => void;
  loading: boolean;
}

// **TECHNICAL SPECIFICATION 4: Filter State Architecture**
interface FilterState {
  searchQuery: string;
  availableSlotsOnly: boolean;
  skillLevel: "all" | "beginner" | "intermediate" | "advanced" | "expert";
  timeRange: "all" | "today" | "tomorrow" | "week" | "month";
  sortBy: "time" | "skill" | "slots" | "location";
  sortOrder: "asc" | "desc";
}

// **TECHNICAL SPECIFICATION 5: Avatar Component Interface and Implementation**
interface UserAvatarProps {
  user: PlayerProfile;
  size?: "xs" | "sm" | "md" | "lg";
  teamIndex?: number;
  showTeamBadge?: boolean;
  style?: any;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = "md",
  teamIndex,
  showTeamBadge = false,
  style,
}) => {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }[size];

  const sizeStyle = {
    xs: { width: 24, height: 24, borderRadius: 12 },
    sm: { width: 32, height: 32, borderRadius: 16 },
    md: { width: 48, height: 48, borderRadius: 24 },
    lg: { width: 64, height: 64, borderRadius: 32 },
  }[size];

  const textSize = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  }[size];

  // **AVATAR BACKGROUND COLOR CALCULATION**
  const getBgColor = () => {
    if (teamIndex === 0 || teamIndex === 1) return "bg-primary"; // Team 1 - Blue
    if (teamIndex === 2 || teamIndex === 3) return "bg-indigo-500"; // Team 2 - Purple/Indigo
    return "bg-gray-500"; // Default/neutral
  };

  // **FALLBACK TEXT GENERATION**
  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "?";
  };

  const shouldShowImage = user.avatar_url && !imageLoadError;

  // **TEAM BADGE RENDERING**
  const renderTeamBadge = () => {
    if (!showTeamBadge || teamIndex === undefined) return null;

    const teamNumber = teamIndex <= 1 ? 1 : 2;
    const badgeColor = teamNumber === 1 ? "bg-primary" : "bg-indigo-500";

    return (
      <View
        className={`absolute -top-1 -right-1 ${badgeColor} rounded-full w-4 h-4 items-center justify-center border border-white`}
      >
        <Text className="text-white text-[8px] font-bold">{teamNumber}</Text>
      </View>
    );
  };

  if (shouldShowImage) {
    return (
      <View
        className={`${sizeClasses} rounded-full ${getBgColor()} items-center justify-center overflow-hidden relative`}
        style={style}
      >
        <Image
          source={{ uri: user.avatar_url }}
          style={sizeStyle}
          resizeMode="cover"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoadError(true);
            setImageLoading(false);
          }}
          onLoadStart={() => setImageLoading(true)}
        />
        {/* **LOADING STATE OVERLAY** */}
        {imageLoading && (
          <View
            className={`absolute inset-0 ${getBgColor()} items-center justify-center`}
          >
            <Text className={`${textSize} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}
        {renderTeamBadge()}
      </View>
    );
  }

  // **FALLBACK TO TEXT INITIAL**
  return (
    <View
      className={`${sizeClasses} rounded-full ${getBgColor()} items-center justify-center relative`}
      style={style}
    >
      <Text className={`${textSize} font-bold text-white`}>{getInitial()}</Text>
      {renderTeamBadge()}
    </View>
  );
};

// **TECHNICAL SPECIFICATION 6: Production Utility Functions**
const getSkillLevelFromRating = (rating: number): string => {
  if (rating < 1300) return "Beginner";
  if (rating < 1500) return "Intermediate";
  if (rating < 1700) return "Advanced";
  if (rating < 1900) return "Expert";
  return "Professional";
};

const getSkillLevelColor = (rating: number): string => {
  if (rating < 1300) return "#22c55e";
  if (rating < 1500) return "#eab308";
  if (rating < 1700) return "#f97316";
  if (rating < 1900) return "#dc2626";
  return "#7c3aed";
};

const formatTimeUntilMatch = (milliseconds: number): string => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(milliseconds / (1000 * 60));
  if (minutes > 0) return `${minutes}m`;
  return "Soon";
};

// **TECHNICAL SPECIFICATION 7: Enhanced Team Selection Modal Component**
const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
  visible,
  match,
  onClose,
  onSelectTeam,
  loading,
}) => {
  const { colorScheme } = useColorScheme();

  if (!match) return null;

  const team1Average =
    match.team1Players && match.team1Players.length > 0
      ? match.team1Players.reduce(
          (sum, p) => sum + parseFloat(p.glicko_rating || "1500"),
          0,
        ) / match.team1Players.length
      : 0;

  const team2Average =
    match.team2Players && match.team2Players.length > 0
      ? match.team2Players.reduce(
          (sum, p) => sum + parseFloat(p.glicko_rating || "1500"),
          0,
        ) / match.team2Players.length
      : 0;

  const renderTeamSection = (teamNumber: 1 | 2) => {
    const players = teamNumber === 1 ? match.team1Players : match.team2Players;
    const availableSlots =
      teamNumber === 1 ? match.team1Slots : match.team2Slots;
    const canJoin = teamNumber === 1 ? match.canJoinTeam1 : match.canJoinTeam2;
    const teamAverage = teamNumber === 1 ? team1Average : team2Average;

    return (
      <View
        className={`flex-1 p-4 rounded-lg ${teamNumber === 1 ? "bg-primary/5" : "bg-indigo-500/5"} mx-2`}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className={`font-bold text-lg ${teamNumber === 1 ? "text-primary" : "text-indigo-600"}`}
          >
            Team {teamNumber}
          </Text>
          <View className="items-end">
            <Text className="text-sm text-muted-foreground">
              {2 - (availableSlots || 0)}/2 players
            </Text>
            {teamAverage > 0 && (
              <Text className="text-xs text-muted-foreground">
                Avg: {Math.round(teamAverage)}
              </Text>
            )}
          </View>
        </View>

        {/* **CURRENT PLAYERS WITH AVATARS** */}
        <View className="mb-4">
          {players?.map((player, index) => (
            <View key={player.id} className="flex-row items-center mb-3">
              <UserAvatar
                user={player}
                size="md"
                teamIndex={teamNumber === 1 ? index : index + 2}
                showTeamBadge={false}
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium">
                  {player.full_name || player.email?.split("@")[0]}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Rating: {player.glicko_rating || "1500"}
                </Text>
              </View>
            </View>
          ))}

          {/* **EMPTY SLOTS WITH PLACEHOLDER AVATARS** */}
          {Array.from({ length: availableSlots || 0 }).map((_, index) => (
            <View
              key={`empty-${index}`}
              className="flex-row items-center mb-3 opacity-50"
            >
              <View
                className={`w-12 h-12 rounded-full border-2 border-dashed items-center justify-center mr-3 ${
                  teamNumber === 1
                    ? "border-primary/40"
                    : "border-indigo-500/40"
                }`}
              >
                <Text
                  className={`text-lg ${teamNumber === 1 ? "text-primary/60" : "text-indigo-500/60"}`}
                >
                  ?
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                Open Position
              </Text>
            </View>
          ))}
        </View>

        {/* **JOIN BUTTON** */}
        <Button
          variant={canJoin ? "default" : "outline"}
          className="w-full"
          onPress={() => canJoin && onSelectTeam(teamNumber)}
          disabled={!canJoin || loading}
          style={{
            backgroundColor: canJoin
              ? teamNumber === 1
                ? "#2148ce"
                : "#6366f1"
              : undefined,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              className={`text-sm ${canJoin ? "text-white" : "text-muted-foreground"}`}
            >
              {!canJoin ? "Team Full" : `Join Team ${teamNumber}`}
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
        <View
          className="bg-background rounded-xl"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* **MODAL HEADER** */}
          <View className="flex-row justify-between items-center p-4 border-b border-border">
            <H3>Choose Your Team</H3>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="p-2"
            >
              <Ionicons
                name="close"
                size={24}
                color={colorScheme === "dark" ? "#ddd" : "#333"}
              />
            </TouchableOpacity>
          </View>

          {/* **MATCH INFORMATION** */}
          <View className="p-4 bg-muted/20">
            <Text className="text-sm text-muted-foreground mb-1">
              Match Details
            </Text>
            <Text className="font-medium">
              {new Date(match.start_time).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {(match.region || match.court) && (
              <Text className="text-sm text-muted-foreground">
                {match.court && match.region
                  ? `${match.court}, ${match.region}`
                  : match.court || match.region}
              </Text>
            )}
          </View>

          {/* **TEAM SELECTION WITH AVATARS** */}
          <View className="p-4">
            <Text className="text-sm text-muted-foreground mb-4 text-center">
              Select which team you'd like to join
            </Text>

            <View className="flex-row">
              {renderTeamSection(1)}
              {renderTeamSection(2)}
            </View>

            {/* **ADDITIONAL INFORMATION** */}
            {!match.canJoinTeam1 && !match.canJoinTeam2 && (
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

// **TECHNICAL SPECIFICATION 8: Main Component Implementation**
export default function ProductionBrowsePublicMatches() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile, session } = useAuth();

  // **PRODUCTION STATE MANAGEMENT**
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publicMatches, setPublicMatches] = useState<PublicMatch[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [teamSelectionMatch, setTeamSelectionMatch] =
    useState<PublicMatch | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // **FILTER STATE MANAGEMENT**
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    availableSlotsOnly: false,
    skillLevel: "all",
    timeRange: "all",
    sortBy: "time",
    sortOrder: "asc",
  });

  // **TECHNICAL SPECIFICATION 9: Enhanced Match Processing with Team Logic**
  const processMatchData = useCallback(
    (matches: any[]): PublicMatch[] => {
      const now = new Date();
      const userId = session?.user?.id;

      return matches.map((match) => {
        // **TIME CALCULATIONS**
        const startTime = new Date(match.start_time);
        const timeUntilMatch = startTime.getTime() - now.getTime();

        // **TEAM COMPOSITION ANALYSIS**
        const team1Players = [match.player1, match.player2].filter(Boolean);
        const team2Players = [match.player3, match.player4].filter(Boolean);

        const team1Slots = 2 - team1Players.length;
        const team2Slots = 2 - team2Players.length;
        const totalAvailableSlots = team1Slots + team2Slots;

        // **USER PARTICIPATION ANALYSIS**
        const isUserPlayer1 = match.player1_id === userId;
        const isUserPlayer2 = match.player2_id === userId;
        const isUserPlayer3 = match.player3_id === userId;
        const isUserPlayer4 = match.player4_id === userId;

        const isUserInMatch =
          isUserPlayer1 || isUserPlayer2 || isUserPlayer3 || isUserPlayer4;
        const userTeam: 1 | 2 | null =
          isUserPlayer1 || isUserPlayer2
            ? 1
            : isUserPlayer3 || isUserPlayer4
              ? 2
              : null;

        // **JOIN CAPABILITY ASSESSMENT**
        const canJoinTeam1 =
          !isUserInMatch && team1Slots > 0 && timeUntilMatch > 0;
        const canJoinTeam2 =
          !isUserInMatch && team2Slots > 0 && timeUntilMatch > 0;

        // **SKILL LEVEL CALCULATIONS**
        const allPlayers = [...team1Players, ...team2Players];
        const ratings = allPlayers
          .map((p) => parseFloat(p?.glicko_rating || "1500"))
          .filter((r) => !isNaN(r));

        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
            : 1500;

        const skillLevel = getSkillLevelFromRating(averageRating);

        return {
          ...match,
          team1Slots,
          team2Slots,
          totalAvailableSlots,
          timeUntilMatch,
          averageRating,
          skillLevel,
          isUserInMatch,
          userTeam,
          canJoinTeam1,
          canJoinTeam2,
          team1Players,
          team2Players,
        };
      });
    },
    [session?.user?.id],
  );

  // **TECHNICAL SPECIFICATION 10: Production Filtering Logic**
  const filteredMatches = useMemo(() => {
    let filtered = [...publicMatches];

    // **SEARCH FILTERING**
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

    // **AVAILABILITY FILTERING**
    if (filters.availableSlotsOnly) {
      filtered = filtered.filter(
        (match) => match.totalAvailableSlots && match.totalAvailableSlots > 0,
      );
    }

    // **SKILL LEVEL FILTERING**
    if (filters.skillLevel !== "all") {
      filtered = filtered.filter(
        (match) => match.skillLevel?.toLowerCase() === filters.skillLevel,
      );
    }

    // **TIME RANGE FILTERING**
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
          case "month":
            const monthFromNow = new Date(
              today.getTime() + 30 * 24 * 60 * 60 * 1000,
            );
            return matchDate >= today && matchDate <= monthFromNow;
          default:
            return true;
        }
      });
    }

    // **SORTING IMPLEMENTATION**
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case "time":
          comparison =
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          break;
        case "skill":
          comparison = (a.averageRating || 1500) - (b.averageRating || 1500);
          break;
        case "slots":
          comparison =
            (b.totalAvailableSlots || 0) - (a.totalAvailableSlots || 0);
          break;
        case "location":
          const locationA = a.region || a.court || "";
          const locationB = b.region || b.court || "";
          comparison = locationA.localeCompare(locationB);
          break;
      }

      return filters.sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [publicMatches, filters]);

  // **TECHNICAL SPECIFICATION 11: Production Data Fetching**
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

      if (error) {
        console.error("Database query error:", error);
        throw error;
      }

      const processedData = processMatchData(data || []);
      setPublicMatches(processedData);
    } catch (error) {
      console.error("Error fetching matches:", error);
      Alert.alert(
        "Error Loading Matches",
        "Could not load public matches. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [processMatchData, refreshing]);

  // **TECHNICAL SPECIFICATION 12: Enhanced Join Logic with Team Selection**
  const handleMatchPress = useCallback(
    (match: PublicMatch) => {
      if (match.isUserInMatch) {
        // User is already in match - navigate to details
        router.push({
          pathname: "/(protected)/(screens)/match-details",
          params: { matchId: match.id },
        });
        return;
      }

      if (!match.canJoinTeam1 && !match.canJoinTeam2) {
        // Match is full
        Alert.alert("Match Full", "This match has no available positions.");
        return;
      }

      // Show team selection modal
      setTeamSelectionMatch(match);
      setShowTeamModal(true);
    },
    [router],
  );

  const handleTeamSelection = useCallback(
    async (teamNumber: 1 | 2) => {
      if (!teamSelectionMatch || !session?.user?.id) return;

      try {
        setJoining(teamSelectionMatch.id);

        // **DETERMINE TARGET POSITION BASED ON TEAM SELECTION**
        let updateField = "";

        if (teamNumber === 1) {
          // Join Team 1 (players 1 & 2)
          if (!teamSelectionMatch.player1_id) {
            updateField = "player1_id";
          } else if (!teamSelectionMatch.player2_id) {
            updateField = "player2_id";
          }
        } else {
          // Join Team 2 (players 3 & 4)
          if (!teamSelectionMatch.player3_id) {
            updateField = "player3_id";
          } else if (!teamSelectionMatch.player4_id) {
            updateField = "player4_id";
          }
        }

        if (!updateField) {
          throw new Error(`Team ${teamNumber} is full`);
        }

        // **ATOMIC DATABASE UPDATE**
        const { error } = await supabase
          .from("matches")
          .update({ [updateField]: session.user.id })
          .eq("id", teamSelectionMatch.id)
          // Add a safety check to ensure the position is still available
          .is(updateField, null);

        if (error) {
          console.error("Database update error:", error);
          throw error;
        }

        // **SUCCESS HANDLING**
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
          "Could not join the match. The position may have been filled by another player.",
        );
        // Refresh data to show current state
        fetchPublicMatches();
      } finally {
        setJoining(null);
      }
    },
    [teamSelectionMatch, session?.user?.id, router, fetchPublicMatches],
  );

  const closeTeamModal = useCallback(() => {
    setShowTeamModal(false);
    setTeamSelectionMatch(null);
  }, []);

  // **COMPONENT LIFECYCLE**
  useEffect(() => {
    if (session?.user?.id) {
      fetchPublicMatches();
    }
  }, [session, fetchPublicMatches]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPublicMatches();
  }, [fetchPublicMatches]);

  // **TECHNICAL SPECIFICATION 13: Production UI Components**

  const renderFilterControls = () => (
    <View className="bg-background border-b border-border p-4">
      {/* **SEARCH BAR** */}
      <View className="flex-row items-center bg-muted/30 rounded-lg px-3 py-2 mb-4">
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          className="flex-1 ml-2 text-foreground"
          placeholder="Search location, players, description..."
          value={filters.searchQuery}
          onChangeText={(text) =>
            setFilters((prev) => ({ ...prev, searchQuery: text }))
          }
          placeholderTextColor="#888"
        />
        {filters.searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setFilters((prev) => ({ ...prev, searchQuery: "" }))}
          >
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* **QUICK FILTERS** */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        <View className="flex-row gap-2">
          <TouchableOpacity
            className={`px-3 py-2 rounded-full ${
              filters.availableSlotsOnly ? "bg-primary" : "bg-muted/30"
            }`}
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                availableSlotsOnly: !prev.availableSlotsOnly,
              }))
            }
          >
            <Text
              className={`text-xs ${
                filters.availableSlotsOnly
                  ? "text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              Available Spots
            </Text>
          </TouchableOpacity>

          {["today", "tomorrow", "week"].map((range) => (
            <TouchableOpacity
              key={range}
              className={`px-3 py-2 rounded-full ${
                filters.timeRange === range ? "bg-primary" : "bg-muted/30"
              }`}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  timeRange: prev.timeRange === range ? "all" : (range as any),
                }))
              }
            >
              <Text
                className={`text-xs capitalize ${
                  filters.timeRange === range
                    ? "text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* **SORT CONTROLS** */}
      <View className="flex-row justify-between items-center">
        <Text className="text-sm text-muted-foreground">Sort by:</Text>
        <View className="flex-row gap-2">
          {[
            { key: "time", label: "Time" },
            { key: "skill", label: "Skill" },
            { key: "slots", label: "Spots" },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => {
                if (filters.sortBy === key) {
                  setFilters((prev) => ({
                    ...prev,
                    sortOrder: prev.sortOrder === "asc" ? "desc" : "asc",
                  }));
                } else {
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: key as any,
                    sortOrder: "asc",
                  }));
                }
              }}
              className={`px-3 py-1 rounded-full flex-row items-center ${
                filters.sortBy === key ? "bg-primary" : "bg-muted/30"
              }`}
            >
              <Text
                className={`text-xs ${
                  filters.sortBy === key
                    ? "text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {label}
              </Text>
              {filters.sortBy === key && (
                <Ionicons
                  name={
                    filters.sortOrder === "asc" ? "chevron-up" : "chevron-down"
                  }
                  size={12}
                  color={filters.sortBy === key ? "#fff" : "#333"}
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderMatchCard = useCallback(
    (match: PublicMatch) => {
      const startTime = new Date(match.start_time);
      const formattedDate = startTime.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const formattedTime = startTime.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });

      const skillColor = getSkillLevelColor(match.averageRating || 1500);
      const timeUntilText =
        match.timeUntilMatch && match.timeUntilMatch > 0
          ? formatTimeUntilMatch(match.timeUntilMatch)
          : "Starting Soon";

      const getActionButtonText = () => {
        if (match.isUserInMatch) return "View Match Details";
        if (!match.canJoinTeam1 && !match.canJoinTeam2) return "Match Full";
        return "Join Match";
      };

      const getActionButtonVariant = () => {
        if (match.isUserInMatch) return "outline";
        if (!match.canJoinTeam1 && !match.canJoinTeam2) return "outline";
        return "default";
      };

      return (
        <TouchableOpacity
          key={match.id}
          className="mb-4 rounded-xl bg-card border border-border/30 overflow-hidden"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={() => handleMatchPress(match)}
          disabled={joining === match.id}
        >
          {/* **HEADER** */}
          <View className="bg-primary/5 dark:bg-primary/10 px-4 py-3">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-semibold text-primary">Public Match</Text>
                <Text className="text-xs text-muted-foreground">
                  {formattedDate} • {formattedTime} • {timeUntilText}
                </Text>
              </View>

              <View className="items-end">
                <View className="flex-row items-center">
                  <Ionicons
                    name="people"
                    size={16}
                    color="#888"
                    style={{ marginRight: 4 }}
                  />
                  <Text className="text-sm font-medium">
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
          </View>

          {/* **CONTENT** */}
          <View className="p-4">
            {/* **LOCATION** */}
            {(match.region || match.court) && (
              <View className="flex-row items-center mb-3">
                <Ionicons
                  name="location-outline"
                  size={16}
                  color="#888"
                  style={{ marginRight: 6 }}
                />
                <Text className="text-sm">
                  {match.court && match.region
                    ? `${match.court}, ${match.region}`
                    : match.court || match.region}
                </Text>
              </View>
            )}

            {/* **SKILL LEVEL** */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  className="px-2 py-1 rounded-full mr-2"
                  style={{ backgroundColor: skillColor + "20" }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: skillColor }}
                  >
                    {match.skillLevel}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  Avg: {Math.round(match.averageRating || 1500)}
                </Text>
              </View>
            </View>

            {/* **TEAM COMPOSITION WITH AVATARS** */}
            <View className="flex-row justify-between mb-4">
              {/* **TEAM 1** */}
              <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-2">
                  {match.team1Slots && match.team1Slots > 0 && (
                    <View className="ml-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                      <Text className="text-xs text-green-600 dark:text-green-400">
                        {match.team1Slots} open
                      </Text>
                    </View>
                  )}
                </View>

                {match.team1Players?.map((player, index) => (
                  <View key={player.id} className="flex-row items-center mb-2">
                    <UserAvatar
                      user={player}
                      size="sm"
                      teamIndex={index}
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-xs flex-1" numberOfLines={1}>
                      {player.full_name || player.email?.split("@")[0]}
                    </Text>
                  </View>
                ))}

                {Array.from({ length: match.team1Slots || 0 }).map(
                  (_, index) => (
                    <View
                      key={`team1-empty-${index}`}
                      className="flex-row items-center mb-2 opacity-50"
                    >
                      <View className="w-8 h-8 rounded-full border border-dashed border-primary/40 items-center justify-center mr-2">
                        <Text className="text-xs text-primary/60">?</Text>
                      </View>
                      <Text className="text-xs text-muted-foreground">
                        Open
                      </Text>
                    </View>
                  ),
                )}
              </View>

              {/* **VS DIVIDER** */}
              <View className="items-center justify-center px-2">
                <Text className="text-sm font-bold text-muted-foreground">
                  VS
                </Text>
              </View>

              {/* **TEAM 2** */}
              <View className="flex-1 ml-2">
                <View className="flex-row items-center mb-2">
                  {match.team2Slots && match.team2Slots > 0 && (
                    <View className="ml-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                      <Text className="text-xs text-green-600 dark:text-green-400">
                        {match.team2Slots} open
                      </Text>
                    </View>
                  )}
                </View>

                {match.team2Players?.map((player, index) => (
                  <View key={player.id} className="flex-row items-center mb-2">
                    <UserAvatar
                      user={player}
                      size="sm"
                      teamIndex={index + 2}
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-xs flex-1" numberOfLines={1}>
                      {player.full_name || player.email?.split("@")[0]}
                    </Text>
                  </View>
                ))}

                {Array.from({ length: match.team2Slots || 0 }).map(
                  (_, index) => (
                    <View
                      key={`team2-empty-${index}`}
                      className="flex-row items-center mb-2 opacity-50"
                    >
                      <View className="w-8 h-8 rounded-full border border-dashed border-indigo-500/40 items-center justify-center mr-2">
                        <Text className="text-xs text-indigo-500/60">?</Text>
                      </View>
                      <Text className="text-xs text-muted-foreground">
                        Open
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </View>

            {/* **DESCRIPTION** */}
            {match.description && (
              <View className="mb-3 p-2 bg-muted/20 rounded">
                <Text className="text-sm italic">{match.description}</Text>
              </View>
            )}

            {/* **ACTION BUTTON** */}
            <Button
              size="sm"
              variant={getActionButtonVariant()}
              className="w-full"
              onPress={() => handleMatchPress(match)}
              disabled={
                joining === match.id ||
                (!match.canJoinTeam1 &&
                  !match.canJoinTeam2 &&
                  !match.isUserInMatch)
              }
            >
              {joining === match.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  className={`text-sm ${
                    getActionButtonVariant() === "outline"
                      ? "text-primary"
                      : "text-primary-foreground"
                  }`}
                >
                  {getActionButtonText()}
                </Text>
              )}
            </Button>
          </View>
        </TouchableOpacity>
      );
    },
    [handleMatchPress, joining],
  );

  // **LOADING STATE**
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#2148ce" />
          <Text className="mt-4 text-muted-foreground">
            Loading public matches...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // **MAIN RENDER**
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* **HEADER** */}

      {/* **FILTERS** */}
      {renderFilterControls()}

      {/* **CONTENT** */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2148ce"
            colors={["#2148ce"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredMatches.length > 0 ? (
          filteredMatches.map(renderMatchCard)
        ) : (
          <View
            className="bg-card rounded-xl p-8 items-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons name="search-outline" size={48} color="#888" />
            <Text className="text-lg font-medium mt-4 mb-2">
              No matches found
            </Text>
            <Text className="text-muted-foreground text-center mb-6">
              {publicMatches.length === 0
                ? "No public matches are currently available"
                : "Try adjusting your filters or search terms"}
            </Text>
            <Button
              variant="default"
              onPress={() => router.push("/(protected)/(screens)/create-match")}
            >
              <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
              <Text>Create Public Match</Text>
            </Button>
          </View>
        )}
      </ScrollView>

      {/* **TEAM SELECTION MODAL** */}
      <TeamSelectionModal
        visible={showTeamModal}
        match={teamSelectionMatch}
        onClose={closeTeamModal}
        onSelectTeam={handleTeamSelection}
        loading={joining !== null}
      />

      {/* **FLOATING ACTION BUTTON** */}
      <TouchableOpacity
        onPress={() => router.push("/(protected)/(screens)/create-match")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
