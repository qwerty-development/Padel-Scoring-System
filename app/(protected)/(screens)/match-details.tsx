import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Image,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { format } from "date-fns";
import { MatchConfirmationSectionV2 } from "@/components/MatchConfirmationSection";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMatchConfirmationV2 } from "@/hooks/useMatchConfirmation";

// Simplified enums and interfaces
export enum MatchStatus {
  PENDING = 1,
  CANCELLED = 3,
  COMPLETED = 4,
  RECRUITING = 6,
}

interface PlayerDetail {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
}

interface MatchDetail {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: string | number;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  is_public: boolean;
  description: string | null;
  player1: PlayerDetail;
  player2: PlayerDetail | null;
  player3: PlayerDetail | null;
  player4: PlayerDetail | null;
}

interface ScoreSet {
  team1: number;
  team2: number;
}

// Enhanced Avatar Component with Navigation
interface AvatarProps {
  player: PlayerDetail | null;
  size?: "sm" | "md" | "lg";
  isCurrentUser?: boolean;
  teamColor?: string;
  currentUserId?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  player,
  size = "md",
  isCurrentUser = false,
  teamColor = "#3B82F6",
  currentUserId,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeConfig = {
    sm: { width: 40, height: 40, borderRadius: 20, textClass: "text-sm" },
    md: { width: 48, height: 48, borderRadius: 24, textClass: "text-base" },
    lg: { width: 56, height: 56, borderRadius: 28, textClass: "text-lg" },
  }[size];

  const handleProfilePress = () => {
    if (!player) return;

    if (isCurrentUser) {
      router.push("/(protected)/(tabs)/profile");
      return;
    }

    // Navigate to friend profile screen
    router.push({
      pathname: "/(protected)/(screens)/friend-profile",
      params: {
        userId: player.id,
        playerName: player.full_name || player.email.split("@")[0],
      },
    });
  };

  if (!player) {
    return (
      <View className="items-center">
        <View
          className="bg-gray-300 dark:bg-gray-600 items-center justify-center"
          style={sizeConfig}
        >
          <Text
            className={`${sizeConfig.textClass} text-gray-600 dark:text-gray-300 font-bold`}
          >
            ?
          </Text>
        </View>
        <Text
          className="text-xs font-medium mt-2 text-center"
          numberOfLines={1}
        >
          Empty
        </Text>
      </View>
    );
  }

  const getInitial = () => {
    if (player.full_name?.trim()) {
      return player.full_name.charAt(0).toUpperCase();
    }
    return player.email.charAt(0).toUpperCase();
  };

  const getName = () => {
    if (player.full_name?.trim()) {
      return player.full_name.split(" ")[0];
    }
    return player.email.split("@")[0];
  };

  const AvatarContent = () => (
    <View className="items-center">
      <View className="relative">
        {player.avatar_url && !imageError ? (
          <Image
            source={{ uri: player.avatar_url }}
            style={{
              ...sizeConfig,
              borderWidth: isCurrentUser ? 2 : 0,
              borderColor: isCurrentUser ? "#10B981" : "transparent",
            }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            className="items-center justify-center"
            style={{
              ...sizeConfig,
              backgroundColor: teamColor,
              borderWidth: isCurrentUser ? 2 : 0,
              borderColor: isCurrentUser ? "#10B981" : "transparent",
            }}
          >
            <Text className={`${sizeConfig.textClass} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}

        {isCurrentUser && (
          <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 items-center justify-center border-2 border-white">
            <Ionicons name="person" size={10} color="white" />
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={handleProfilePress}
        disabled={isCurrentUser}
        activeOpacity={isCurrentUser ? 1 : 0.7}
      >
        <Text
          className={`text-xs font-medium mt-2 text-center ${
            !isCurrentUser ? "text-primary dark:text-blue-400" : ""
          }`}
          numberOfLines={1}
        >
          {isCurrentUser ? "You" : getName()}
        </Text>
      </TouchableOpacity>

      {player.glicko_rating && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {Math.round(parseFloat(player.glicko_rating))}
        </Text>
      )}
    </View>
  );

  // Wrap the entire avatar in TouchableOpacity if not current user
  if (isCurrentUser) {
    return <AvatarContent />;
  }

  return (
    <TouchableOpacity
      onPress={handleProfilePress}
      activeOpacity={0.7}
      className="items-center"
    >
      <View className="relative">
        {player.avatar_url && !imageError ? (
          <Image
            source={{ uri: player.avatar_url }}
            style={{
              ...sizeConfig,
              borderWidth: isCurrentUser ? 2 : 0,
              borderColor: isCurrentUser ? "#10B981" : "transparent",
            }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            className="items-center justify-center"
            style={{
              ...sizeConfig,
              backgroundColor: teamColor,
              borderWidth: isCurrentUser ? 2 : 0,
              borderColor: isCurrentUser ? "#10B981" : "transparent",
            }}
          >
            <Text className={`${sizeConfig.textClass} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}

        {isCurrentUser && (
          <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 items-center justify-center border-2 border-white">
            <Ionicons name="person" size={10} color="white" />
          </View>
        )}
      </View>

      <Text
        className={`text-xs font-medium mt-2 text-center ${
          !isCurrentUser ? "text-primary dark:text-blue-400" : ""
        }`}
        numberOfLines={1}
      >
        {isCurrentUser ? "You" : getName()}
      </Text>

      {player.glicko_rating && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {Math.round(parseFloat(player.glicko_rating))}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default function CleanMatchDetails() {
  const { matchId, mode } = useLocalSearchParams();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingScores, setEditingScores] = useState(mode === "score-entry");

  // Score state
  const [set1Score, setSet1Score] = useState<ScoreSet>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<ScoreSet>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<ScoreSet>({ team1: 0, team2: 0 });
  const [showSet3, setShowSet3] = useState(false);

  const { session, profile } = useAuth();

  // Match confirmation hook (for approve/report flow)
  const {
    canTakeAction: canConfirmMatch,
    approveMatch,
    processing: approving,
  } = useMatchConfirmationV2(matchId as string);

  const confirmMatch = async () => {
    if (!match) return;

    try {
      const result = await approveMatch();

      if (result.success) {
        Alert.alert("Match Confirmed", result.message);
        fetchMatchDetails(match.id);
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      console.error("Error confirming match:", error);
      Alert.alert("Error", "Failed to confirm match");
    }
  };

  // Calculate match state
  const matchState = useMemo(() => {
    if (!match || !session?.user?.id) {
      return {
        userParticipating: false,
        userTeam: null as 1 | 2 | null,
        isCreator: false,
        isFuture: false,
        hasScores: false,
        needsScores: false,
        canJoin: false,
        canEnterScores: false,
        userWon: null as boolean | null,
        team1Sets: 0,
        team2Sets: 0,
        winnerTeam: 0,
      };
    }

    const userId = session.user.id;
    const now = new Date();
    const startTime = new Date(match.start_time);
    const endTime = match.end_time ? new Date(match.end_time) : null;

    const isCreator = userId === match.player1_id;
    const isFuture = startTime > now;
    const isPast = endTime ? endTime < now : startTime < now;
    const hasScores =
      match.team1_score_set1 !== null && match.team2_score_set1 !== null;
    const needsScores =
      isPast && !hasScores && match.status !== MatchStatus.CANCELLED;

    const isPlayer1 = match.player1_id === userId;
    const isPlayer2 = match.player2_id === userId;
    const isPlayer3 = match.player3_id === userId;
    const isPlayer4 = match.player4_id === userId;

    const userParticipating = isPlayer1 || isPlayer2 || isPlayer3 || isPlayer4;
    const userTeam: 1 | 2 | null =
      isPlayer1 || isPlayer2 ? 1 : isPlayer3 || isPlayer4 ? 2 : null;

    const hasOpenSlots =
      !match.player2_id || !match.player3_id || !match.player4_id;
    const canJoin = isFuture && !userParticipating && hasOpenSlots;
    const canEnterScores = isCreator && needsScores;

    // Calculate sets
    let team1Sets = 0,
      team2Sets = 0,
      winnerTeam = 0;

    if (hasScores) {
      // Non-null assertion is safe here because hasScores guarantees both values are present
      if (match.team1_score_set1! > match.team2_score_set1!) team1Sets++;
      else if (match.team2_score_set1! > match.team1_score_set1!) team2Sets++;

      if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
        if (match.team1_score_set2! > match.team2_score_set2!) team1Sets++;
        else if (match.team2_score_set2! > match.team1_score_set2!) team2Sets++;
      }

      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        if (match.team1_score_set3! > match.team2_score_set3!) team1Sets++;
        else if (match.team2_score_set3! > match.team1_score_set3!) team2Sets++;
      }

      winnerTeam = team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0;
    }

    const userWon: boolean | null =
      userParticipating && winnerTeam > 0 ? userTeam === winnerTeam : null;

    return {
      userParticipating,
      userTeam,
      isCreator,
      isFuture,
      hasScores,
      needsScores,
      canJoin,
      canEnterScores,
      userWon,
      team1Sets,
      team2Sets,
      winnerTeam,
    };
  }, [match, session?.user?.id]);

  useEffect(() => {
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  // Initialize scores when match data loads
  useEffect(() => {
    if (match && matchState.hasScores) {
      setSet1Score({
        team1: match.team1_score_set1 || 0,
        team2: match.team2_score_set1 || 0,
      });
      setSet2Score({
        team1: match.team1_score_set2 || 0,
        team2: match.team2_score_set2 || 0,
      });

      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setSet3Score({
          team1: match.team1_score_set3,
          team2: match.team2_score_set3,
        });
        setShowSet3(true);
      }
    }
  }, [match, matchState.hasScores]);

  // Auto-show set 3 if first two sets are tied
  useEffect(() => {
    if (!editingScores) return;

    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    const isTied =
      (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);

    setShowSet3(isTied);
    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
    }
  }, [set1Score, set2Score, editingScores]);

  const fetchMatchDetails = async (id: string) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }

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
        .eq("id", id)
        .single();

      if (error) throw error;
      setMatch(data);
    } catch (error) {
      console.error("Error fetching match details:", error);
      Alert.alert("Error", "Failed to load match details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  };

  const joinMatch = async () => {
    if (!match || !session?.user?.id) return;

    const availablePositions = [];
    if (!match.player2_id) availablePositions.push("player2_id");
    if (!match.player3_id) availablePositions.push("player3_id");
    if (!match.player4_id) availablePositions.push("player4_id");

    if (availablePositions.length === 0) {
      Alert.alert("Match Full", "This match is already full");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("matches")
        .update({ [availablePositions[0]]: session.user.id })
        .eq("id", match.id);

      if (error) throw error;

      fetchMatchDetails(match.id);
      Alert.alert("Success", "You have joined the match!");
    } catch (error) {
      console.error("Error joining match:", error);
      Alert.alert("Error", "Failed to join the match");
    } finally {
      setSaving(false);
    }
  };

  const saveScores = async () => {
    if (!match || !session?.user?.id) return;

    if (!matchState.isCreator) {
      Alert.alert(
        "Permission Denied",
        "Only the match creator can enter scores",
      );
      return;
    }

    // Calculate winner
    let team1Sets = 0,
      team2Sets = 0;

    if (set1Score.team1 > set1Score.team2) team1Sets++;
    else if (set1Score.team2 > set1Score.team1) team2Sets++;

    if (set2Score.team1 > set2Score.team2) team1Sets++;
    else if (set2Score.team2 > set2Score.team1) team2Sets++;

    if (showSet3) {
      if (set3Score.team1 > set3Score.team2) team1Sets++;
      else if (set3Score.team2 > set3Score.team1) team2Sets++;
    }

    const winnerTeam =
      team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0;

    try {
      setSaving(true);

      const updateData = {
        team1_score_set1: set1Score.team1,
        team2_score_set1: set1Score.team2,
        team1_score_set2: set2Score.team1,
        team2_score_set2: set2Score.team2,
        team1_score_set3: showSet3 ? set3Score.team1 : null,
        team2_score_set3: showSet3 ? set3Score.team2 : null,
        winner_team: winnerTeam,
        status: "4", // COMPLETED
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("matches")
        .update(updateData)
        .eq("id", match.id);

      if (error) throw error;

      fetchMatchDetails(match.id);
      setEditingScores(false);

      Alert.alert(
        "Match Completed!",
        `Scores saved successfully. ${winnerTeam === matchState.userTeam ? "Congratulations!" : "Better luck next time!"}`,
      );
    } catch (error) {
      console.error("Error saving scores:", error);
      Alert.alert("Error", "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async () => {
    if (!match || !matchState.isCreator) return;

    Alert.alert(
      "Delete Match",
      "Are you sure you want to delete this match? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);

              const { error } = await supabase
                .from("matches")
                .delete()
                .eq("id", match.id);

              if (error) throw error;

              Alert.alert("Match Deleted", "The match has been deleted", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error("Error deleting match:", error);
              Alert.alert("Error", "Failed to delete match");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const shareMatch = async () => {
    if (!match) return;

    try {
      const playerNames = [
        match.player1?.full_name || "Player 1",
        match.player2?.full_name || "Player 2",
        match.player3?.full_name || "Player 3",
        match.player4?.full_name || "Player 4",
      ];

      const message = matchState.isFuture
        ? `🎾 Padel Match\n\n📅 ${format(new Date(match.start_time), "PPP 'at' p")}\n📍 ${match.region || "TBD"}\n\nTeam 1: ${playerNames[0]} & ${playerNames[1]}\nTeam 2: ${playerNames[2]} & ${playerNames[3]}`
        : `🏆 Padel Match Result\n\nFinal Score: ${matchState.team1Sets}-${matchState.team2Sets}\nWinner: Team ${matchState.winnerTeam}\n\nTeam 1: ${playerNames[0]} & ${playerNames[1]}\nTeam 2: ${playerNames[2]} & ${playerNames[3]}`;

      await Share.share({ message });
    } catch (error) {
      console.error("Error sharing match:", error);
    }
  };

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), "MMMM d, yyyy");
  };

  const formatTime = (dateString: string): string => {
    return format(new Date(dateString), "h:mm a");
  };

  const renderScoreInput = (
    setNumber: number,
    score: ScoreSet,
    onChange: (score: ScoreSet) => void,
  ) => {
    return (
      <View className="mb-4">
        <Text className="text-sm font-medium mb-2">Set {setNumber}</Text>
        <View className="flex-row items-center justify-center">
          <View className="flex-row items-center bg-card dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <TouchableOpacity
              onPress={() =>
                onChange({ ...score, team1: Math.max(0, score.team1 - 1) })
              }
              className="p-3"
            >
              <Ionicons name="remove" size={20} color="#666" />
            </TouchableOpacity>

            <Text className="text-xl font-bold w-12 text-center">
              {score.team1}
            </Text>

            <TouchableOpacity
              onPress={() =>
                onChange({ ...score, team1: Math.min(7, score.team1 + 1) })
              }
              className="p-3"
            >
              <Ionicons name="add" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <Text className="text-xl mx-4 text-gray-500">-</Text>

          <View className="flex-row items-center bg-card dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <TouchableOpacity
              onPress={() =>
                onChange({ ...score, team2: Math.max(0, score.team2 - 1) })
              }
              className="p-3"
            >
              <Ionicons name="remove" size={20} color="#666" />
            </TouchableOpacity>

            <Text className="text-xl font-bold w-12 text-center">
              {score.team2}
            </Text>

            <TouchableOpacity
              onPress={() =>
                onChange({ ...score, team2: Math.min(7, score.team2 + 1) })
              }
              className="p-3"
            >
              <Ionicons name="add" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSetScore = (
    setNumber: number,
    team1Score: number | null,
    team2Score: number | null,
  ) => {
    if (team1Score === null || team2Score === null) return null;

    return (
      <View className="flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
        <Text className="font-medium">Set {setNumber}</Text>
        <View className="flex-row items-center">
          <Text
            className={`text-lg font-bold ${team1Score > team2Score ? "text-primary" : "text-gray-500"}`}
          >
            {team1Score}
          </Text>
          <Text className="text-lg mx-3 text-gray-500">-</Text>
          <Text
            className={`text-lg font-bold ${team2Score > team1Score ? "text-purple-600" : "text-gray-500"}`}
          >
            {team2Score}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <SafeAreaView edges={['top']} className="bg-primary">
          <View className="bg-primary px-6 py-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => router.back()}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-white flex-1 text-center">
                Match Details
              </Text>
              <View className="p-2" />
            </View>
          </View>
        </SafeAreaView>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500">
            Loading match details...
          </Text>
        </View>
      </View>
    );
  }

  if (!match) {
    return (
      <View className="flex-1 bg-white">
        <SafeAreaView edges={['top']} className="bg-primary">
          <View className="bg-primary px-6 py-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => router.back()}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-white flex-1 text-center">
                Match Details
              </Text>
              <View className="p-2" />
            </View>
          </View>
        </SafeAreaView>
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-medium mt-4 mb-2">Match Not Found</Text>
          <Text className="text-gray-500 text-center mb-6">
            Could not find the match you're looking for.
          </Text>
          <Button onPress={() => router.back()}>
            <Text className="text-white">Go Back</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Blue Header with Safe Area */}
      <SafeAreaView edges={['top']} className="bg-primary">
        <View className="bg-primary px-6 py-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="p-2"
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>

            <Text className="text-xl font-bold text-white flex-1 text-center">
              Match Details
            </Text>

            <TouchableOpacity onPress={shareMatch} className="p-2">
              <Ionicons name="share-social" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Match Details Section */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center justify-between">
            {/* Match Information */}
            <View className="flex-1 mr-4">
              {/* Date */}
              <Text className="text-lg text-gray-900 mb-1">
                {format(new Date(match.start_time), "EEEE, d MMMM")}
              </Text>
              
              {/* Time */}
              <Text className="text-base text-gray-700 mb-1">
                {formatTime(match.start_time)}
                {match.end_time && ` - ${formatTime(match.end_time)}`}
              </Text>

              {/* Location */}
              {(match.region || match.court) && (
                <Text className="text-sm text-gray-600">
                  {match.court ? `${match.court}, ` : ""}
                  {match.region || "TBD"}
                </Text>
              )}
            </View>

            {/* Padel Court Image */}
            <View className="w-32 h-24 rounded-xl overflow-hidden">
              <Image
                source={require('../../../assets/padel-court-light.webp')}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          </View>
        </View>

        {/* Match Breakdown Section */}
        {matchState.hasScores && (
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
                    {/* Header with label and status */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base text-gray-900">
            Match Breakdown
          </Text>
              <View className={`px-3 py-1 rounded-full ${
                match.all_confirmed
                  ? "bg-green-100"
                  : "bg-orange-100"
              }`}>
                <Text className={`text-sm font-medium ${
                  match.all_confirmed
                    ? "text-green-700"
                    : "text-orange-700"
                }`}>
                  {match.all_confirmed ? "Confirmed" : "Not Confirmed"}
                </Text>
              </View>
            </View>
            
            {/* Separator Line */}
            <View className="h-px bg-gray-200 mb-4" />
            
            {/* Score Layout - Match Card Style */}
            <View>
              {/* Team 1 - Names with scores vertically centered */}
              <View className="flex-row justify-between mb-2">
                <View className="flex-1 min-w-0">
                  {/* Player 1 */}
                  <View className="flex-row items-center mb-1">
                    <View className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white items-center justify-center mr-3">
                      <Text className="text-blue-800 font-bold text-xs">
                        {match.player1?.full_name?.charAt(0) || match.player1?.email.charAt(0).toUpperCase() || 'P'}
                      </Text>
                    </View>
                    <View className="flex-row items-center flex-1">
                      <Text className="text-sm text-gray-900 flex-1" numberOfLines={1} ellipsizeMode="tail">
                        {match.player1_id === session?.user?.id ? "You" : (match.player1?.full_name?.split(' ')[0] || match.player1?.email.split('@')[0] || 'Player')}
                      </Text>
                      {/* Green dot for winning team */}
                      {matchState.winnerTeam === 1 && (
                        <View className="w-2 h-2 bg-emerald-600 rounded-full ml-2" />
                      )}
                    </View>
                  </View>
                  {/* Player 2 */}
                  {match.player2 && (
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white items-center justify-center mr-3">
                        <Text className="text-blue-800 font-bold text-xs">
                          {match.player2?.full_name?.charAt(0) || match.player2?.email.charAt(0).toUpperCase() || 'P'}
                        </Text>
                      </View>
                      <Text className="text-sm text-gray-900 flex-1" numberOfLines={1} ellipsizeMode="tail">
                        {match.player2_id === session?.user?.id ? "You" : (match.player2?.full_name?.split(' ')[0] || match.player2?.email.split('@')[0] || 'Player')}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Team 1 scores - always show 3 sets, centered vertically */}
                <View className="flex-row items-center self-center flex-shrink-0">
                  <View className="w-12 items-center">
                    <Text className={`text-xl font-semibold ${
                      match.team1_score_set1 !== null
                        ? (match.team1_score_set1 > (match.team2_score_set1 || 0))
                          ? "text-gray-900"
                          : "text-gray-400"
                        : "text-gray-400"
                    }`}>
                      {match.team1_score_set1 ?? "-"}
                    </Text>
                  </View>
                  <View className="w-12 items-center">
                    <Text className={`text-xl font-semibold ${
                      match.team1_score_set2 !== null
                        ? (match.team1_score_set2 > (match.team2_score_set2 || 0))
                          ? "text-gray-900"
                          : "text-gray-400"
                        : "text-gray-400"
                    }`}>
                      {match.team1_score_set2 ?? "-"}
                    </Text>
                  </View>
                  <View className="w-12 items-center">
                    <Text className={`text-xl font-semibold ${
                      match.team1_score_set3 !== null
                        ? (match.team1_score_set3 > (match.team2_score_set3 || 0))
                          ? "text-gray-900"
                          : "text-gray-400"
                        : "text-gray-400"
                    }`}>
                      {match.team1_score_set3 ?? "-"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider - lighter and shorter */}
              <View className="flex-row justify-between my-2">
                <View className="flex-1 mr-6">
                  <View className="h-px bg-gray-200" />
                </View>
                <View className="flex-row items-center flex-shrink-0">
                  <View className="w-12 items-center">
                    <View className="w-6 h-px bg-gray-200" />
                  </View>
                  <View className="w-12 items-center">
                    <View className="w-6 h-px bg-gray-200" />
                  </View>
                  <View className="w-12 items-center">
                    <View className="w-6 h-px bg-gray-200" />
                  </View>
                </View>
              </View>

              {/* Team 2 - Names with scores vertically centered */}
              {match.player3 && (
                <View className="flex-row justify-between">
                  <View className="flex-1 min-w-0">
                    {/* Player 3 */}
                    <View className="flex-row items-center mb-1">
                      <View className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white items-center justify-center mr-3">
                        <Text className="text-purple-800 font-bold text-xs">
                          {match.player3?.full_name?.charAt(0) || match.player3?.email.charAt(0).toUpperCase() || 'P'}
                        </Text>
                      </View>
                      <View className="flex-row items-center flex-1">
                        <Text className="text-sm text-gray-900 flex-1" numberOfLines={1} ellipsizeMode="tail">
                          {match.player3_id === session?.user?.id ? "You" : (match.player3?.full_name?.split(' ')[0] || match.player3?.email.split('@')[0] || 'Player')}
                        </Text>
                        {/* Green dot for winning team */}
                        {matchState.winnerTeam === 2 && (
                          <View className="w-2 h-2 bg-emerald-600 rounded-full ml-2" />
                        )}
                      </View>
                    </View>
                    {/* Player 4 */}
                    {match.player4 && (
                      <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white items-center justify-center mr-3">
                          <Text className="text-purple-800 font-bold text-xs">
                            {match.player4?.full_name?.charAt(0) || match.player4?.email.charAt(0).toUpperCase() || 'P'}
                          </Text>
                        </View>
                        <Text className="text-sm text-gray-900 flex-1" numberOfLines={1} ellipsizeMode="tail">
                          {match.player4_id === session?.user?.id ? "You" : (match.player4?.full_name?.split(' ')[0] || match.player4?.email.split('@')[0] || 'Player')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Team 2 scores - always show 3 sets, centered vertically */}
                  <View className="flex-row items-center self-center flex-shrink-0">
                    <View className="w-12 items-center">
                      <Text className={`text-xl font-semibold ${
                        match.team2_score_set1 !== null
                          ? (match.team2_score_set1 > (match.team1_score_set1 || 0))
                            ? "text-gray-900"
                            : "text-gray-400"
                          : "text-gray-400"
                      }`}>
                        {match.team2_score_set1 ?? "-"}
                      </Text>
                    </View>
                    <View className="w-12 items-center">
                      <Text className={`text-xl font-semibold ${
                        match.team2_score_set2 !== null
                          ? (match.team2_score_set2 > (match.team1_score_set2 || 0))
                            ? "text-gray-900"
                            : "text-gray-400"
                          : "text-gray-400"
                      }`}>
                        {match.team2_score_set2 ?? "-"}
                      </Text>
                    </View>
                    <View className="w-12 items-center">
                      <Text className={`text-xl font-semibold ${
                        match.team2_score_set3 !== null
                          ? (match.team2_score_set3 > (match.team1_score_set3 || 0))
                            ? "text-gray-900"
                            : "text-gray-400"
                          : "text-gray-400"
                      }`}>
                        {match.team2_score_set3 ?? "-"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Players Section */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base text-gray-900">
              Players
            </Text>
            <Text className="text-xs text-gray-500">
              Tap player to view profile
            </Text>
          </View>

          {/* Separator Line */}
          <View className="h-px bg-gray-200 mb-4" />

          {/* All Players in One Row with Team Labels */}
          <View className="flex-row justify-between">
            {/* Team 1 */}
            <View className="flex-1 mr-4">
              <Text className="text-xs text-gray-500 font-medium text-center mb-3">TEAM 1</Text>
              <View className="flex-row justify-between">
                {/* Player 1 */}
                <TouchableOpacity 
                  className="flex-1 items-center p-3 mr-2"
                  onPress={() => {
                    if (match.player1_id !== session?.user?.id && match.player1) {
                      router.push({
                        pathname: "/(protected)/(screens)/friend-profile",
                        params: {
                          userId: match.player1.id,
                          playerName: match.player1.full_name || match.player1.email.split("@")[0],
                        },
                      });
                    }
                  }}
                >
                  <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2 relative">
                    <Text className="text-blue-800 font-bold text-sm">
                      {match.player1?.full_name?.charAt(0) || match.player1?.email.charAt(0).toUpperCase() || 'P'}
                    </Text>
                    {match.player1_id === session?.user?.id && (
                      <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center">
                        <Ionicons name="person" size={8} color="white" />
                      </View>
                    )}
                  </View>
                  <Text className="font-medium text-gray-900 text-center text-xs mb-1" numberOfLines={1}>
                    {match.player1_id === session?.user?.id ? "You" : (match.player1?.full_name?.split(' ')[0] || match.player1?.email.split('@')[0] || 'Player')}
                  </Text>
                  {match.player1?.glicko_rating && (
                    <Text className="text-xs text-gray-500 text-center">
                      {Math.round(parseFloat(match.player1.glicko_rating))}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Player 2 */}
                {match.player2 ? (
                  <TouchableOpacity 
                    className="flex-1 items-center p-3"
                    onPress={() => {
                      if (match.player2_id !== session?.user?.id && match.player2) {
                        router.push({
                          pathname: "/(protected)/(screens)/friend-profile",
                          params: {
                            userId: match.player2.id,
                            playerName: match.player2.full_name || match.player2.email.split("@")[0],
                          },
                        });
                      }
                    }}
                  >
                    <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2 relative">
                      <Text className="text-blue-800 font-bold text-sm">
                        {match.player2?.full_name?.charAt(0) || match.player2?.email.charAt(0).toUpperCase() || 'P'}
                      </Text>
                      {match.player2_id === session?.user?.id && (
                        <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center">
                          <Ionicons name="person" size={8} color="white" />
                        </View>
                      )}
                    </View>
                    <Text className="font-medium text-gray-900 text-center text-xs mb-1" numberOfLines={1}>
                      {match.player2_id === session?.user?.id ? "You" : (match.player2?.full_name?.split(' ')[0] || match.player2?.email.split('@')[0] || 'Player')}
                    </Text>
                    {match.player2?.glicko_rating && (
                      <Text className="text-xs text-gray-500 text-center">
                        {Math.round(parseFloat(match.player2.glicko_rating))}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View className="flex-1 items-center p-3">
                    <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mb-2">
                      <Text className="text-gray-500 font-bold text-sm">?</Text>
                    </View>
                    <Text className="font-medium text-gray-500 text-center text-xs mb-1">Empty</Text>
                    <Text className="text-xs text-gray-400 text-center">-</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Separator */}
            <View className="w-px bg-gray-200 mx-2 self-stretch" />

            {/* Team 2 */}
            <View className="flex-1 ml-4">
              <Text className="text-xs text-gray-500 font-medium text-center mb-3">TEAM 2</Text>
              <View className="flex-row justify-between">
                {/* Player 3 */}
                {match.player3 ? (
                  <TouchableOpacity 
                    className="flex-1 items-center p-3 mr-2"
                    onPress={() => {
                      if (match.player3_id !== session?.user?.id && match.player3) {
                        router.push({
                          pathname: "/(protected)/(screens)/friend-profile",
                          params: {
                            userId: match.player3.id,
                            playerName: match.player3.full_name || match.player3.email.split("@")[0],
                          },
                        });
                      }
                    }}
                  >
                    <View className="w-12 h-12 rounded-full bg-purple-100 items-center justify-center mb-2 relative">
                      <Text className="text-purple-800 font-bold text-sm">
                        {match.player3?.full_name?.charAt(0) || match.player3?.email.charAt(0).toUpperCase() || 'P'}
                      </Text>
                      {match.player3_id === session?.user?.id && (
                        <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center">
                          <Ionicons name="person" size={8} color="white" />
                        </View>
                      )}
                    </View>
                    <Text className="font-medium text-gray-900 text-center text-xs mb-1" numberOfLines={1}>
                      {match.player3_id === session?.user?.id ? "You" : (match.player3?.full_name?.split(' ')[0] || match.player3?.email.split('@')[0] || 'Player')}
                    </Text>
                    {match.player3?.glicko_rating && (
                      <Text className="text-xs text-gray-500 text-center">
                        {Math.round(parseFloat(match.player3.glicko_rating))}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View className="flex-1 items-center p-3 mr-2">
                    <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mb-2">
                      <Text className="text-gray-500 font-bold text-sm">?</Text>
                    </View>
                    <Text className="font-medium text-gray-500 text-center text-xs mb-1">Empty</Text>
                    <Text className="text-xs text-gray-400 text-center">-</Text>
                  </View>
                )}

                {/* Player 4 */}
                {match.player4 ? (
                  <TouchableOpacity 
                    className="flex-1 items-center p-3"
                    onPress={() => {
                      if (match.player4_id !== session?.user?.id && match.player4) {
                        router.push({
                          pathname: "/(protected)/(screens)/friend-profile",
                          params: {
                            userId: match.player4.id,
                            playerName: match.player4.full_name || match.player4.email.split("@")[0],
                          },
                        });
                      }
                    }}
                  >
                    <View className="w-12 h-12 rounded-full bg-purple-100 items-center justify-center mb-2 relative">
                      <Text className="text-purple-800 font-bold text-sm">
                        {match.player4?.full_name?.charAt(0) || match.player4?.email.charAt(0).toUpperCase() || 'P'}
                      </Text>
                      {match.player4_id === session?.user?.id && (
                        <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center">
                          <Ionicons name="person" size={8} color="white" />
                        </View>
                      )}
                    </View>
                    <Text className="font-medium text-gray-900 text-center text-xs mb-1" numberOfLines={1}>
                      {match.player4_id === session?.user?.id ? "You" : (match.player4?.full_name?.split(' ')[0] || match.player4?.email.split('@')[0] || 'Player')}
                    </Text>
                    {match.player4?.glicko_rating && (
                      <Text className="text-xs text-gray-500 text-center">
                        {Math.round(parseFloat(match.player4.glicko_rating))}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View className="flex-1 items-center p-3">
                    <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mb-2">
                      <Text className="text-gray-500 font-bold text-sm">?</Text>
                    </View>
                    <Text className="font-medium text-gray-500 text-center text-xs mb-1">Empty</Text>
                    <Text className="text-xs text-gray-400 text-center">-</Text>
                  </View>
                )}
              </View>
            </View>
          </View>


        </View>

        {/* Match Description */}
        {match.description && (
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
            <Text className="text-base text-gray-900 mb-3">
              Description
            </Text>
            <Text className="text-gray-600 leading-5">
              {match.description}
            </Text>
          </View>
        )}

        {match.team1_score_set1 !== null && (
          <MatchConfirmationSectionV2
            matchId={match.id}
            players={[
              {
                id: match.player1_id!,
                full_name: match.player1?.full_name ?? null,
                email: match.player1?.email ?? "",
              },
              {
                id: match.player2_id!,
                full_name: match.player2?.full_name ?? null,
                email: match.player2?.email ?? "",
              },
              {
                id: match.player3_id!,
                full_name: match.player3?.full_name ?? null,
                email: match.player3?.email ?? "",
              },
              {
                id: match.player4_id!,
                full_name: match.player4?.full_name ?? null,
                email: match.player4?.email ?? "",
              },
            ].filter((p) => p.id)}
            onUpdate={() => {
              // Refresh match details after confirmation changes
              fetchMatchDetails(matchId as string);
            }}
          />
        )}
        {/* Action Buttons */}
        <View className="gap-3">
          {matchState.canJoin && (
            <Button onPress={joinMatch} disabled={saving} className="w-full">
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium">Join Match</Text>
              )}
            </Button>
          )}

          {/* Confirm Match (approve) action */}
          {canConfirmMatch && (
            <Button
              onPress={confirmMatch}
              disabled={approving}
              className="w-full"
            >
              {approving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium">Confirm Match</Text>
              )}
            </Button>
          )}
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
