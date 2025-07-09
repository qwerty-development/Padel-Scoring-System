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

// Clean Avatar Component
interface AvatarProps {
  player: PlayerDetail | null;
  size?: 'sm' | 'md' | 'lg';
  isCurrentUser?: boolean;
  teamColor?: string;
}

const Avatar: React.FC<AvatarProps> = ({ 
  player, 
  size = 'md', 
  isCurrentUser = false,
  teamColor = '#3B82F6'
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeConfig = {
    sm: { width: 40, height: 40, borderRadius: 20, textClass: 'text-sm' },
    md: { width:48, height: 48, borderRadius: 24, textClass: 'text-base' },
    lg: { width: 56, height: 56, borderRadius: 28, textClass: 'text-lg' }
  }[size];

  if (!player) {
    return (
      <View 
        className="bg-gray-300 dark:bg-gray-600 items-center justify-center" 
        style={sizeConfig}
      >
        <Text className={`${sizeConfig.textClass} text-gray-600 dark:text-gray-300 font-bold`}>?</Text>
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
      return player.full_name.split(' ')[0];
    }
    return player.email.split('@')[0];
  };

  return (
    <View className="items-center">
      <View className="relative">
        {player.avatar_url && !imageError ? (
          <Image
            source={{ uri: player.avatar_url }}
            style={{
              ...sizeConfig,
              borderWidth: isCurrentUser ? 2 : 0,
              borderColor: isCurrentUser ? '#10B981' : 'transparent'
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
              borderColor: isCurrentUser ? '#10B981' : 'transparent'
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
      
      <Text className="text-xs font-medium mt-2 text-center" numberOfLines={1}>
        {isCurrentUser ? 'You' : getName()}
      </Text>
      
      {player.glicko_rating && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {Math.round(parseFloat(player.glicko_rating))}
        </Text>
      )}
    </View>
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
    const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
    const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
    
    const isPlayer1 = match.player1_id === userId;
    const isPlayer2 = match.player2_id === userId;
    const isPlayer3 = match.player3_id === userId;
    const isPlayer4 = match.player4_id === userId;
    
    const userParticipating = isPlayer1 || isPlayer2 || isPlayer3 || isPlayer4;
    const userTeam: 1 | 2 | null = 
      (isPlayer1 || isPlayer2) ? 1 : 
      (isPlayer3 || isPlayer4) ? 2 : null;

    const hasOpenSlots = !match.player2_id || !match.player3_id || !match.player4_id;
    const canJoin = isFuture && !userParticipating && hasOpenSlots;
    const canEnterScores = isCreator && needsScores;

    // Calculate sets
    let team1Sets = 0, team2Sets = 0, winnerTeam = 0;
    
    if (hasScores) {
      if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
      else if (match.team2_score_set1 > match.team1_score_set1) team2Sets++;
      
      if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
        if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
        else if (match.team2_score_set2 > match.team1_score_set2) team2Sets++;
      }
      
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
        else if (match.team2_score_set3 > match.team1_score_set3) team2Sets++;
      }
      
      winnerTeam = team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0;
    }

    const userWon: boolean | null = userParticipating && winnerTeam > 0 
      ? userTeam === winnerTeam 
      : null;

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
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);

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
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `)
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
      Alert.alert("Permission Denied", "Only the match creator can enter scores");
      return;
    }

    // Calculate winner
    let team1Sets = 0, team2Sets = 0;
    
    if (set1Score.team1 > set1Score.team2) team1Sets++;
    else if (set1Score.team2 > set1Score.team1) team2Sets++;
    
    if (set2Score.team1 > set2Score.team2) team1Sets++;
    else if (set2Score.team2 > set2Score.team1) team2Sets++;
    
    if (showSet3) {
      if (set3Score.team1 > set3Score.team2) team1Sets++;
      else if (set3Score.team2 > set3Score.team1) team2Sets++;
    }

    const winnerTeam = team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0;

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
        `Scores saved successfully. ${winnerTeam === matchState.userTeam ? 'Congratulations!' : 'Better luck next time!'}`
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
              
              Alert.alert(
                "Match Deleted", 
                "The match has been deleted",
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch (error) {
              console.error("Error deleting match:", error);
              Alert.alert("Error", "Failed to delete match");
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const shareMatch = async () => {
    if (!match) return;

    try {
      const playerNames = [
        match.player1?.full_name || "Player 1",
        match.player2?.full_name || "Player 2", 
        match.player3?.full_name || "Player 3",
        match.player4?.full_name || "Player 4"
      ];

      const message = matchState.isFuture 
        ? `🎾 Padel Match\n\n📅 ${format(new Date(match.start_time), "PPP 'at' p")}\n📍 ${match.region || 'TBD'}\n\nTeam 1: ${playerNames[0]} & ${playerNames[1]}\nTeam 2: ${playerNames[2]} & ${playerNames[3]}`
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

  const renderScoreInput = (setNumber: number, score: ScoreSet, onChange: (score: ScoreSet) => void) => {
    return (
      <View className="mb-4">
        <Text className="text-sm font-medium mb-2">Set {setNumber}</Text>
        <View className="flex-row items-center justify-center">
          <View className="flex-row items-center bg-card dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <TouchableOpacity
              onPress={() => onChange({ ...score, team1: Math.max(0, score.team1 - 1) })}
              className="p-3"
            >
              <Ionicons name="remove" size={20} color="#666" />
            </TouchableOpacity>
            
            <Text className="text-xl font-bold w-12 text-center">{score.team1}</Text>
            
            <TouchableOpacity
              onPress={() => onChange({ ...score, team1: Math.min(7, score.team1 + 1) })}
              className="p-3"
            >
              <Ionicons name="add" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          
          <Text className="text-xl mx-4 text-gray-500">-</Text>
          
          <View className="flex-row items-center bg-card dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <TouchableOpacity
              onPress={() => onChange({ ...score, team2: Math.max(0, score.team2 - 1) })}
              className="p-3"
            >
              <Ionicons name="remove" size={20} color="#666" />
            </TouchableOpacity>
            
            <Text className="text-xl font-bold w-12 text-center">{score.team2}</Text>
            
            <TouchableOpacity
              onPress={() => onChange({ ...score, team2: Math.min(7, score.team2 + 1) })}
              className="p-3"
            >
              <Ionicons name="add" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSetScore = (setNumber: number, team1Score: number | null, team2Score: number | null) => {
    if (team1Score === null || team2Score === null) return null;

    return (
      <View className="flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
        <Text className="font-medium">Set {setNumber}</Text>
        <View className="flex-row items-center">
          <Text className={`text-lg font-bold ${team1Score > team2Score ? 'text-blue-600' : 'text-gray-500'}`}>
            {team1Score}
          </Text>
          <Text className="text-lg mx-3 text-gray-500">-</Text>
          <Text className={`text-lg font-bold ${team2Score > team1Score ? 'text-purple-600' : 'text-gray-500'}`}>
            {team2Score}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">Loading match details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900 p-6">
        <View className="flex-1 items-center justify-center">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-medium mt-4 mb-2">Match Not Found</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
            Could not find the match you're looking for.
          </Text>
          <Button onPress={() => router.back()}>
            <Text className="text-white">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-gray-900">
      {/* Header */}
      <View className="bg-backround dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2"
            >
              <Ionicons name="arrow-back" size={24} color="#3B82F6" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Match Details
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(match.start_time)}
              </Text>
            </View>
          </View>
          
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={shareMatch}
              className="p-2"
            >
              <Ionicons name="share-social" size={20} color="#3B82F6" />
            </TouchableOpacity>
            
            {matchState.isCreator && (
              <TouchableOpacity
                onPress={deleteMatch}
                className="p-2"
              >
                <Ionicons name="trash" size={20} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Match Status */}
        <View className="bg-card dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatTime(match.start_time)}
              {match.end_time && ` - ${formatTime(match.end_time)}`}
            </Text>
            
            <View className="flex-row items-center gap-2">
              {match.is_public && (
                <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                  <Text className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Public
                  </Text>
                </View>
              )}
              
              <View className={`px-2 py-1 rounded-full ${
                matchState.isFuture ? 'bg-blue-100 dark:bg-blue-900/30' :
                matchState.hasScores ? 'bg-green-100 dark:bg-green-900/30' :
                'bg-orange-100 dark:bg-orange-900/30'
              }`}>
                <Text className={`text-xs font-medium ${
                  matchState.isFuture ? 'text-blue-700 dark:text-blue-300' :
                  matchState.hasScores ? 'text-green-700 dark:text-green-300' :
                  'text-orange-700 dark:text-orange-300'
                }`}>
                  {matchState.isFuture ? 'Upcoming' :
                   matchState.hasScores ? 'Completed' :
                   'Needs Scores'}
                </Text>
              </View>
            </View>
          </View>
          
          {(match.region || match.court) && (
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={16} color="#6B7280" style={{ marginRight: 8 }} />
              <Text className="text-gray-600 dark:text-gray-400">
                {match.court ? `${match.court}, ` : ''}{match.region || 'TBD'}
              </Text>
            </View>
          )}
        </View>

        {/* Score Display or Input */}
        {editingScores ? (
          <View className="bg-card dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Enter Scores
              </Text>
              <TouchableOpacity
                onPress={() => setEditingScores(false)}
                className="p-2"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {renderScoreInput(1, set1Score, setSet1Score)}
            {renderScoreInput(2, set2Score, setSet2Score)}
            {showSet3 && renderScoreInput(3, set3Score, setSet3Score)}

            <Button
              onPress={saveScores}
              disabled={saving}
              className="w-full mt-4"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium">Save Scores</Text>
              )}
            </Button>
          </View>
        ) : matchState.hasScores ? (
          <View className="bg-card dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <View className="items-center mb-6">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">Final Score</Text>
              <View className="flex-row items-center">
                <Text className="text-4xl font-bold text-blue-600">
                  {matchState.team1Sets}
                </Text>
                <Text className="text-2xl mx-4 text-gray-400">-</Text>
                <Text className="text-4xl font-bold text-purple-600">
                  {matchState.team2Sets}
                </Text>
              </View>
              
              {matchState.userParticipating && (
                <View className={`mt-3 px-4 py-2 rounded-full ${
                  matchState.userWon === true ? 'bg-green-100 dark:bg-green-900/30' :
                  matchState.userWon === false ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                  <Text className={`font-medium ${
                    matchState.userWon === true ? 'text-green-700 dark:text-green-300' :
                    matchState.userWon === false ? 'text-red-700 dark:text-red-300' :
                    'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {matchState.userWon === true ? '🏆 Victory!' :
                     matchState.userWon === false ? '😔 Defeat' :
                     '🤝 Draw'}
                  </Text>
                </View>
              )}
            </View>

            <View>
              <Text className="font-medium mb-3 text-gray-900 dark:text-gray-100">Set Breakdown</Text>
              {renderSetScore(1, match.team1_score_set1, match.team2_score_set1)}
              {renderSetScore(2, match.team1_score_set2, match.team2_score_set2)}
              {match.team1_score_set3 !== null && match.team2_score_set3 !== null &&
                renderSetScore(3, match.team1_score_set3, match.team2_score_set3)}
            </View>
          </View>
        ) : null}

        {/* Players */}
        <View className="bg-card dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Players</Text>
          
          {/* Team 1 */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-medium text-blue-600">Team 1</Text>
              {matchState.hasScores && matchState.winnerTeam === 1 && (
                <View className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                  <Text className="text-xs font-bold text-yellow-700 dark:text-yellow-300">WINNER</Text>
                </View>
              )}
            </View>
            <View className="flex-row justify-around">
              <Avatar
                player={match.player1}
                isCurrentUser={match.player1_id === session?.user?.id}
                teamColor="#3B82F6"
              />
              <Avatar
                player={match.player2}
                isCurrentUser={match.player2_id === session?.user?.id}
                teamColor="#3B82F6"
              />
            </View>
          </View>

          {/* Team 2 */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-medium text-purple-600">Team 2</Text>
              {matchState.hasScores && matchState.winnerTeam === 2 && (
                <View className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                  <Text className="text-xs font-bold text-yellow-700 dark:text-yellow-300">WINNER</Text>
                </View>
              )}
            </View>
            <View className="flex-row justify-around">
              <Avatar
                player={match.player3}
                isCurrentUser={match.player3_id === session?.user?.id}
                teamColor="#8B5CF6"
              />
              <Avatar
                player={match.player4}
                isCurrentUser={match.player4_id === session?.user?.id}
                teamColor="#8B5CF6"
              />
            </View>
          </View>
        </View>

        {/* Match Description */}
        {match.description && (
          <View className="bg-card dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <Text className="font-medium mb-3 text-gray-900 dark:text-gray-100">Description</Text>
            <Text className="text-gray-600 dark:text-gray-400 leading-5">
              {match.description}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-3">
          {matchState.canJoin && (
            <Button
              onPress={joinMatch}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium">Join Match</Text>
              )}
            </Button>
          )}

          {matchState.canEnterScores && (
            <Button
              onPress={() => setEditingScores(true)}
              className="w-full"
            >
              <Text className="text-white font-medium">Enter Scores</Text>
            </Button>
          )}

          {matchState.isCreator && matchState.hasScores && (
            <Button
              variant="outline"
              onPress={() => setEditingScores(true)}
              className="w-full"
            >
              <Text className="text-black dark:text-white">Edit Scores</Text>
            </Button>
          )}
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}