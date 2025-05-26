import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  RefreshControl,
  TextInput,
  Alert,
  Vibration,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { format } from "date-fns";

import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";
import {
  SetScoreInput,
  SetScore,
} from "@/components/create-match/SetScoreInput";
import { useColorScheme } from "@/lib/useColorScheme";

// CORRECTED: Enhanced match status enumeration with proper TEXT database handling
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
  RECRUITING = 6,
}

// CRITICAL FIX: Database type handling utilities for TEXT status field
const statusToString = (status: MatchStatus | number): string => {
  return String(status);
};

const statusFromString = (status: string | number): number => {
  if (typeof status === 'string') {
    const parsed = parseInt(status, 10);
    return isNaN(parsed) ? MatchStatus.PENDING : parsed;
  }
  return typeof status === 'number' ? status : MatchStatus.PENDING;
};

// CRITICAL FIX: Safe status comparison for TEXT database field
const isStatusEqual = (dbStatus: string | number, compareStatus: MatchStatus): boolean => {
  const dbStatusNum = statusFromString(dbStatus);
  return dbStatusNum === compareStatus;
};

// FIXED: Proper database type handling utilities for score fields
const ensureInteger = (value: any): number => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return typeof value === 'number' ? value : 0;
};

const ensureIntegerOrNull = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  return ensureInteger(value);
};

// ENHANCED: Match validation utilities
const validateScore = (score: number): boolean => {
  return Number.isInteger(score) && score >= 0 && score <= 7;
};

const validateSetScore = (team1: number, team2: number): boolean => {
  if (!validateScore(team1) || !validateScore(team2)) return false;
  
  // Padel scoring rules validation
  const diff = Math.abs(team1 - team2);
  const winner = Math.max(team1, team2);
  const loser = Math.min(team1, team2);
  
  // Must win by 2 if score reaches 6-6, otherwise first to 6
  if (winner === 6) {
    return loser <= 4 || (loser === 5 && diff >= 1) || (loser === 6 && diff >= 2);
  }
  
  // 7 points only allowed in tiebreak situations
  if (winner === 7) {
    return loser === 6 || loser === 5;
  }
  
  return true;
};

// ENHANCED: Comprehensive interface definitions with better type safety
interface PlayerDetail {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
  avatar_url: string | null;
}

interface MatchDetail {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: string | number;
  created_at: string;
  completed_at: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  validation_deadline: string | null;
  is_public: boolean;
  description: string | null;
  player1: PlayerDetail;
  player2: PlayerDetail | null;
  player3: PlayerDetail | null;
  player4: PlayerDetail | null;
}

interface GlickoRating {
  rating: number;
  rd: number;
  vol: number;
}

// ENHANCED: Advanced match state interface with comprehensive permission system
interface MatchState {
  isFuture: boolean;
  isPast: boolean;
  needsScores: boolean;
  hasScores: boolean;
  canJoin: boolean;
  userParticipating: boolean;
  userTeam: 1 | 2 | null;
  team1Sets: number;
  team2Sets: number;
  winnerTeam: number;
  userWon: boolean | null;
  canCancel: boolean;
  hoursFromCompletion: number;
  isCreator: boolean;
  canEnterScores: boolean;
  canViewScores: boolean;
  matchPhase: 'upcoming' | 'active' | 'completed' | 'cancelled';
  timeStatus: 'early' | 'soon' | 'now' | 'recent' | 'old';
}

// ENHANCED: Score entry state with validation
interface ScoreEntryState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestedWinner: number | null;
}

export default function EnhancedMatchDetailsWithFixedTypes() {
  const { matchId, mode } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { session, profile } = useAuth();

  // ENHANCED: Score entry state management with validation
  const [editingScores, setEditingScores] = useState(mode === "score-entry");
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);
  const [scoreValidation, setScoreValidation] = useState<ScoreEntryState>({
    isValid: false,
    errors: [],
    warnings: [],
    suggestedWinner: null
  });

  // ENHANCED: UI state management
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [animatedValue] = useState(new Animated.Value(0));

  // REQUIREMENT 1: Enhanced match state calculation with comprehensive analysis
  const matchState = useMemo((): MatchState => {
    if (!match || !session?.user?.id) {
      return {
        isFuture: false,
        isPast: false,
        needsScores: false,
        hasScores: false,
        canJoin: false,
        userParticipating: false,
        userTeam: null,
        team1Sets: 0,
        team2Sets: 0,
        winnerTeam: 0,
        userWon: null,
        canCancel: false,
        hoursFromCompletion: 0,
        isCreator: false,
        canEnterScores: false,
        canViewScores: true,
        matchPhase: 'upcoming',
        timeStatus: 'early',
      };
    }

    console.log('🔍 Enhanced Match Details: Calculating comprehensive match state for:', match.id);

    // ENHANCED: Advanced time-based analysis
    const now = new Date();
    const startTime = new Date(match.start_time);
    const endTime = match.end_time ? new Date(match.end_time) : null;
    const completedTime = match.completed_at ? new Date(match.completed_at) : null;
    
    const isFuture = startTime > now;
    const isPast = endTime ? endTime < now : startTime < now;
    const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
    
    // FIXED: Use proper integer comparison for status
    const statusInt = ensureInteger(match.status);
    const needsScores = isPast && !hasScores && statusInt !== MatchStatus.CANCELLED;

    // ENHANCED: Time categorization for better UX
    const minutesToStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    const hoursFromCompletion = completedTime 
      ? (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60)
      : endTime && !isFuture 
        ? (now.getTime() - endTime.getTime()) / (1000 * 60 * 60)
        : 0;

    const timeStatus: MatchState['timeStatus'] = 
      minutesToStart > 1440 ? 'early' :    // More than 24 hours
      minutesToStart > 60 ? 'soon' :        // 1-24 hours
      minutesToStart > -60 ? 'now' :        // Within 1 hour
      hoursFromCompletion < 24 ? 'recent' : // Last 24 hours
      'old';                                // More than 24 hours ago

    const matchPhase: MatchState['matchPhase'] = 
      statusInt === MatchStatus.CANCELLED ? 'cancelled' :
      hasScores ? 'completed' :
      isPast ? 'active' :
      'upcoming';

    // ENHANCED: Advanced permission system
    const userId = session.user.id;
    const isCreator = userId === match.player1_id;
    
    const canCancel = isCreator && 
                     statusInt !== MatchStatus.CANCELLED &&
                     (isFuture || hoursFromCompletion < 24);

    const canEnterScores = isCreator && needsScores;
    const canViewScores = hasScores || matchState?.userParticipating || isCreator;

    // ENHANCED: User participation analysis
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

    // ENHANCED: Advanced score analysis with better winner determination
    let team1Sets = 0, team2Sets = 0, winnerTeam = 0;
    
    if (hasScores) {
      // Set 1 analysis
      const t1s1 = ensureIntegerOrNull(match.team1_score_set1) || 0;
      const t2s1 = ensureIntegerOrNull(match.team2_score_set1) || 0;
      if (t1s1 > t2s1) team1Sets++;
      else if (t2s1 > t1s1) team2Sets++;
      
      // Set 2 analysis
      const t1s2 = ensureIntegerOrNull(match.team1_score_set2);
      const t2s2 = ensureIntegerOrNull(match.team2_score_set2);
      if (t1s2 !== null && t2s2 !== null) {
        if (t1s2 > t2s2) team1Sets++;
        else if (t2s2 > t1s2) team2Sets++;
      }
      
      // Set 3 analysis
      const t1s3 = ensureIntegerOrNull(match.team1_score_set3);
      const t2s3 = ensureIntegerOrNull(match.team2_score_set3);
      if (t1s3 !== null && t2s3 !== null) {
        if (t1s3 > t2s3) team1Sets++;
        else if (t2s3 > t1s3) team2Sets++;
      }
      
      // Winner determination with database fallback
      winnerTeam = ensureIntegerOrNull(match.winner_team) || 
                  (team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0);
    }

    const userWon: boolean | null = userParticipating && winnerTeam > 0 
      ? userTeam === winnerTeam 
      : null;

    const finalState: MatchState = {
      isFuture,
      isPast,
      needsScores,
      hasScores,
      canJoin,
      userParticipating,
      userTeam,
      team1Sets,
      team2Sets,
      winnerTeam,
      userWon,
      canCancel,
      hoursFromCompletion,
      isCreator,
      canEnterScores,
      canViewScores,
      matchPhase,
      timeStatus,
    };

    console.log('✅ Enhanced Match Details: Comprehensive final state:', finalState);
    return finalState;
  }, [match, session?.user?.id]);

  // ENHANCED: Real-time score validation
  const validateCurrentScores = useCallback((): ScoreEntryState => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!isSet1Valid) {
      errors.push("Set 1 scores are invalid");
    }
    
    if (!isSet2Valid) {
      errors.push("Set 2 scores are invalid");
    }
    
    if (showSet3 && !isSet3Valid) {
      errors.push("Set 3 scores are invalid");
    }
    
    // Advanced validation logic
    if (isSet1Valid && isSet2Valid) {
      const team1WonSet1 = set1Score.team1 > set1Score.team2;
      const team1WonSet2 = set2Score.team1 > set2Score.team2;
      
      if ((team1WonSet1 && team1WonSet2) || (!team1WonSet1 && !team1WonSet2)) {
        if (showSet3) {
          warnings.push("Match appears to be decided in 2 sets, but Set 3 is being entered");
        } else {
          warnings.push("Match was decided in 2 sets");
        }
      }
    }
    
    // Determine suggested winner
    let suggestedWinner: number | null = null;
    if (isSet1Valid && isSet2Valid) {
      let team1Sets = 0, team2Sets = 0;
      
      if (set1Score.team1 > set1Score.team2) team1Sets++;
      else team2Sets++;
      
      if (set2Score.team1 > set2Score.team2) team1Sets++;
      else team2Sets++;
      
      if (showSet3 && isSet3Valid) {
        if (set3Score.team1 > set3Score.team2) team1Sets++;
        else team2Sets++;
      }
      
      suggestedWinner = team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : null;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestedWinner
    };
  }, [set1Score, set2Score, set3Score, isSet1Valid, isSet2Valid, isSet3Valid, showSet3]);

  // ENHANCED: Component lifecycle with better error handling
  useEffect(() => {
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  // ENHANCED: Real-time score validation
  useEffect(() => {
    if (editingScores) {
      setScoreValidation(validateCurrentScores());
    }
  }, [editingScores, validateCurrentScores]);

  // ENHANCED: Score state initialization with validation
  useEffect(() => {
    if (match && matchState.hasScores) {
      console.log('🔄 Enhanced Match Details: Initializing score state from match data');
      
      setSet1Score({
        team1: ensureInteger(match.team1_score_set1),
        team2: ensureInteger(match.team2_score_set1),
      });
      setSet2Score({
        team1: ensureInteger(match.team1_score_set2),
        team2: ensureInteger(match.team2_score_set2),
      });

      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setSet3Score({
          team1: ensureInteger(match.team1_score_set3),
          team2: ensureInteger(match.team2_score_set3),
        });
        setShowSet3(true);
      }

      setIsSet1Valid(true);
      setIsSet2Valid(true);
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setIsSet3Valid(true);
      }
    }
  }, [match, matchState.hasScores]);

  // ENHANCED: Set 3 visibility with smart logic
  useEffect(() => {
    if (!editingScores) return;

    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);

    setShowSet3(isTied && isSet1Valid && isSet2Valid);

    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
      setIsSet3Valid(false);
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid, editingScores]);

  // ENHANCED: Advanced data fetching with retry mechanism
  const fetchMatchDetails = async (id: string, retryCount = 0) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }

      console.log('📡 Enhanced Match Details: Fetching match data for ID:', id);

      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url)
        `
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error('❌ Enhanced Match Details: Fetch error:', error);
        
        // Retry mechanism for network issues
        if (retryCount < 2 && (error.code === 'PGRST301' || error.message.includes('network'))) {
          console.log('🔄 Retrying fetch...', retryCount + 1);
          setTimeout(() => fetchMatchDetails(id, retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        
        throw error;
      }

      console.log('📊 Enhanced Match Details: Match data received:', {
        id: data.id,
        status: data.status,
        statusType: typeof data.status,
        hasScores: data.team1_score_set1 !== null,
        startTime: data.start_time
      });

      setMatch(data);
    } catch (error) {
      console.error("💥 Enhanced Match Details: Error fetching match details:", error);
      
      if (retryCount === 0) {
        Alert.alert(
          "Error Loading Match",
          "Failed to load match details. Would you like to retry?",
          [
            { text: "Cancel", onPress: () => router.back() },
            { text: "Retry", onPress: () => fetchMatchDetails(id, 0) }
          ]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ENHANCED: Optimized refresh with visual feedback
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Vibration.vibrate(50); // Haptic feedback
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  // ENHANCED: Smart join functionality with team balancing
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

      // Smart team assignment based on skill levels
      let targetPosition = availablePositions[0];
      
      if (availablePositions.length > 1) {
        const userRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating) : 1500;
        
        // Calculate team averages for better balance
        const team1Players = [match.player1, match.player2].filter(Boolean);
        const team2Players = [match.player3, match.player4].filter(Boolean);
        
        const team1Avg = team1Players.length > 0 
          ? team1Players.reduce((sum, p) => sum + parseFloat(p.glicko_rating || '1500'), 0) / team1Players.length
          : 1500;
        
        const team2Avg = team2Players.length > 0 
          ? team2Players.reduce((sum, p) => sum + parseFloat(p.glicko_rating || '1500'), 0) / team2Players.length
          : 1500;

        // Join the team that would result in better balance
        const team1Balance = Math.abs((team1Avg + userRating) / (team1Players.length + 1) - team2Avg);
        const team2Balance = Math.abs((team2Avg + userRating) / (team2Players.length + 1) - team1Avg);
        
        if (team1Balance < team2Balance && availablePositions.includes("player2_id")) {
          targetPosition = "player2_id";
        } else if (availablePositions.includes("player3_id")) {
          targetPosition = "player3_id";
        }
      }

      console.log('🎯 Enhanced Match Details: Joining match at position:', targetPosition);

      const { data, error } = await supabase
        .from("matches")
        .update({ [targetPosition]: session.user.id })
        .eq("id", match.id)
        .select();

      if (error) throw error;

      fetchMatchDetails(match.id);
      Vibration.vibrate([100, 50, 100]); // Success haptic pattern

      Alert.alert(
        "Successfully Joined!",
        "You have joined the match. Good luck!",
        [
          {
            text: "View Details",
            onPress: () => {
              // Auto-scroll to teams section
              Animated.timing(animatedValue, {
                toValue: 1,
                duration: 500,
                useNativeDriver: false,
              }).start();
            }
          },
          { text: "OK" }
        ]
      );
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error joining match:", error);
      Vibration.vibrate(200); // Error haptic
      Alert.alert("Error", "Failed to join the match. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // FIXED: Enhanced score saving with proper integer handling
  const saveMatchScores = async () => {
    if (!match || !session?.user?.id) return;

    if (!matchState.isCreator) {
      Alert.alert("Permission Denied", "Only the match creator can enter scores.");
      return;
    }

    const validation = validateCurrentScores();
    if (!validation.isValid) {
      Alert.alert(
        "Invalid Scores", 
        `Please fix the following issues:\n${validation.errors.join('\n')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      Alert.alert(
        "Score Validation Warning",
        `${validation.warnings.join('\n')}\n\nDo you want to continue?`,
        [
          { text: "Review", style: "cancel" },
          { text: "Continue", onPress: () => performScoreSave() }
        ]
      );
      return;
    }

    await performScoreSave();
  };

  // CRITICAL FIX: Score saving logic with proper TEXT status handling
  const performScoreSave = async () => {
    if (!match) return;

    try {
      setSaving(true);

      const winnerTeam = scoreValidation.suggestedWinner || 0;
      
      console.log('💾 Enhanced Match Details: Saving scores with winner:', winnerTeam);

      // CRITICAL FIX: Convert status to STRING for TEXT database field
      const updateData = {
        team1_score_set1: ensureInteger(set1Score.team1),
        team2_score_set1: ensureInteger(set1Score.team2),
        team1_score_set2: ensureInteger(set2Score.team1),
        team2_score_set2: ensureInteger(set2Score.team2),
        team1_score_set3: showSet3 ? ensureInteger(set3Score.team1) : null,
        team2_score_set3: showSet3 ? ensureInteger(set3Score.team2) : null,
        winner_team: ensureInteger(winnerTeam),
        status: "4", // CRITICAL FIX: Convert to string for TEXT field
        completed_at: new Date().toISOString(),
      };

      console.log('🔧 Enhanced Match Details: Update data with STRING status for TEXT field:', updateData);

      const { data, error } = await supabase
        .from("matches")
        .update(updateData)
        .eq("id", match.id)
        .select();

      if (error) {
        console.error('❌ Enhanced Match Details: Database update error:', error);
        throw error;
      }

      // Update ratings if all players present
      if (match.player1_id && match.player2_id && match.player3_id && match.player4_id) {
        await updatePlayerRatings(match, winnerTeam);
      }

      fetchMatchDetails(match.id);
      setEditingScores(false);
      
      Vibration.vibrate([100, 50, 100, 50, 100]); // Success pattern

      Alert.alert(
        "Match Completed!",
        `Scores saved successfully. ${winnerTeam === matchState.userTeam ? 'Congratulations on your victory!' : 'Better luck next time!'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error saving match scores:", error);
      Vibration.vibrate(300); // Error haptic
      Alert.alert(
        "Error Saving Scores",
        `Failed to save match scores: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  // ENHANCED: Advanced rating update system with better error handling
  const updatePlayerRatings = async (matchData: MatchDetail, winnerTeam: number) => {
    try {
      console.log('📈 Enhanced Match Details: Updating player ratings for winner team:', winnerTeam);

      const playerIds = [
        matchData.player1_id,
        matchData.player2_id,
        matchData.player3_id,
        matchData.player4_id,
      ].filter(Boolean) as string[];

      const { data: playersData, error: playersError } = await supabase
        .from("profiles")
        .select("id, glicko_rating, glicko_rd, glicko_vol")
        .in("id", playerIds);

      if (playersError) throw playersError;

      if (!playersData || playersData.length !== 4) {
        throw new Error("Could not fetch all player ratings");
      }

      // Create rating objects with better validation
      const playerRatings = playerIds.map(id => {
        const profile = playersData.find(p => p.id === id);
        if (!profile) throw new Error(`Profile not found for player ${id}`);
        
        return {
          id,
          rating: parseFloat(profile.glicko_rating || "1500"),
          rd: parseFloat(profile.glicko_rd || "350"),
          vol: parseFloat(profile.glicko_vol || "0.06"),
        };
      });

      // Enhanced rating calculation with skill differential
      const team1Avg = (playerRatings[0].rating + playerRatings[1].rating) / 2;
      const team2Avg = (playerRatings[2].rating + playerRatings[3].rating) / 2;
      const ratingDiff = Math.abs(team1Avg - team2Avg);
      
      // Dynamic rating change based on skill difference and score margin
      const baseChange = 15;
      const diffMultiplier = Math.min(ratingDiff * 0.1, 10);
      const scoreMargin = Math.abs(matchState.team1Sets - matchState.team2Sets);
      const marginMultiplier = scoreMargin >= 2 ? 1.2 : 0.8;
      
      const adjustedChange = Math.round(baseChange + diffMultiplier * marginMultiplier);

      // Apply rating changes
      const updates = playerRatings.map((player, index) => {
        let newRating = player.rating;
        const isTeam1 = index < 2;
        const won = (isTeam1 && winnerTeam === 1) || (!isTeam1 && winnerTeam === 2);
        
        newRating += won ? adjustedChange : -adjustedChange;
        newRating = Math.max(100, Math.min(3000, newRating)); // Bounds checking

        return supabase
          .from("profiles")
          .update({
            glicko_rating: Math.round(newRating).toString(),
            glicko_rd: Math.round(player.rd).toString(),
            glicko_vol: player.vol.toFixed(6),
          })
          .eq("id", player.id);
      });

      await Promise.all(updates);
      
      console.log('✅ Enhanced Match Details: Player ratings updated successfully');
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error updating player ratings:", error);
      // Don't throw here - rating update failure shouldn't prevent score saving
    }
  };

  // ENHANCED: Advanced match cancellation with confirmation
  const cancelMatch = async () => {
    if (!match || !session?.user?.id || !matchState.canCancel) return;

    if (!matchState.isCreator) {
      Alert.alert("Permission Denied", "Only the match creator can delete matches.");
      return;
    }

    const timeInfo = getCancellationTimeInfo();
    
    Alert.alert(
      "Delete Match",
      `Are you sure you want to permanently delete this match?\n\n${timeInfo}\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              Vibration.vibrate(100);

              const { error } = await supabase
                .from("matches")
                .delete()
                .eq("id", match.id);
                
              if (error) throw error;
              
              Vibration.vibrate([100, 50, 100]);
              
              Alert.alert(
                "Match Deleted", 
                "The match has been permanently removed.",
                [
                  { 
                    text: "OK", 
                    onPress: () => router.replace("/(protected)/(tabs)")
                  }
                ]
              );
            } catch (error) {
              console.error("❌ Enhanced Match Details: Error deleting match:", error);
              Vibration.vibrate(300);
              Alert.alert("Error", "Failed to delete match");
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // ENHANCED: Advanced sharing with multiple formats
  const shareMatch = async () => {
    if (!match) return;

    try {
      const playerNames = [
        match.player1?.full_name || "Player 1",
        match.player2?.full_name || "Player 2", 
        match.player3?.full_name || "Player 3",
        match.player4?.full_name || "Player 4"
      ];

      let message = '';
      
      if (matchState.isFuture) {
        message = `🎾 Padel Match Invitation\n\n` +
                 `📅 ${formatDate(match.start_time)} at ${formatTime(match.start_time)}\n` +
                 `📍 ${match.region || 'TBD'}${match.court ? `, Court ${match.court}` : ''}\n\n` +
                 `Team 1: ${playerNames[0]} & ${playerNames[1]}\n` +
                 `Team 2: ${playerNames[2]} & ${playerNames[3]}\n\n` +
                 `Join us for some padel! 🏆`;
      } else {
        message = `🏆 Padel Match Result\n\n` +
                 `📊 Final Score: ${matchState.team1Sets}-${matchState.team2Sets}\n` +
                 `🏅 Winner: Team ${matchState.winnerTeam}\n\n` +
                 `Team 1: ${playerNames[0]} & ${playerNames[1]}\n` +
                 `Team 2: ${playerNames[2]} & ${playerNames[3]}\n\n`;
        
        if (match.team1_score_set1 !== null) {
          message += `Set Details:\n`;
          message += `Set 1: ${match.team1_score_set1}-${match.team2_score_set1}\n`;
          if (match.team1_score_set2 !== null) {
            message += `Set 2: ${match.team1_score_set2}-${match.team2_score_set2}\n`;
          }
          if (match.team1_score_set3 !== null) {
            message += `Set 3: ${match.team1_score_set3}-${match.team2_score_set3}\n`;
          }
        }
      }

      await Share.share({
        message,
        title: matchState.isFuture ? "Padel Match Invitation" : "Padel Match Result",
      });
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error sharing match:", error);
    }
  };

  // ENHANCED: Utility functions with better formatting
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMMM d, yyyy");
  };

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "h:mm a");
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays === -1) return "Tomorrow";
    if (diffDays < 7 && diffDays > 0) return `${diffDays} days ago`;
    if (diffDays > -7 && diffDays < 0) return `In ${Math.abs(diffDays)} days`;
    
    return formatDate(dateString);
  };

  // CRITICAL FIX: Enhanced status determination with proper TEXT field handling
  const getStatusText = () => {
    if (matchState.isFuture) {
      return { text: "Upcoming", color: "text-blue-500" };
    }

    if (matchState.needsScores) {
      return { text: "Needs Scores", color: "text-amber-500" };
    }

    // CRITICAL FIX: Use safe status comparison for TEXT database field
    if (isStatusEqual(match?.status, MatchStatus.PENDING)) {
      return { text: "Pending", color: "text-blue-500" };
    }
    if (isStatusEqual(match?.status, MatchStatus.NEEDS_CONFIRMATION)) {
      return { text: "Needs Confirmation", color: "text-yellow-500" };
    }
    if (isStatusEqual(match?.status, MatchStatus.CANCELLED)) {
      return { text: "Cancelled", color: "text-gray-500" };
    }
    if (isStatusEqual(match?.status, MatchStatus.COMPLETED)) {
      return { text: "Completed", color: "text-green-500" };
    }
    
    return { text: "Unknown", color: "text-muted-foreground" };
  };

  const getCancellationTimeInfo = (): string => {
    if (!matchState.canCancel) return '';
    
    if (matchState.isFuture) {
      return 'Can delete until match starts';
    } else {
      const hoursRemaining = 24 - matchState.hoursFromCompletion;
      if (hoursRemaining > 1) {
        return `Can delete for ${Math.floor(hoursRemaining)} more hours`;
      } else {
        const minutesRemaining = Math.floor(hoursRemaining * 60);
        return `Can delete for ${minutesRemaining} more minutes`;
      }
    }
  };

  const getMatchDuration = (startTimeStr: string, endTimeStr: string): string => {
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));

    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  const calculateSetsPlayed = () => {
    if (!match) return 'N/A';
    let setsPlayed = 0;
    if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) setsPlayed++;
    if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) setsPlayed++;
    if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) setsPlayed++;
    return setsPlayed || 'N/A';
  };

  // CRITICAL FIX: Match status display with proper TEXT field handling
  const getMatchStatus = (status: string | number) => {
    const statusNum = statusFromString(status);
    switch (statusNum) {
      case MatchStatus.PENDING: return 'Pending';
      case MatchStatus.NEEDS_CONFIRMATION: return 'Needs Confirmation';
      case MatchStatus.CANCELLED: return 'Cancelled';
      case MatchStatus.COMPLETED: return 'Completed';
      case MatchStatus.NEEDS_SCORES: return 'Needs Scores';
      case MatchStatus.RECRUITING: return 'Recruiting';
      default: return 'Unknown';
    }
  };

  // ENHANCED: Set score rendering with better visual hierarchy
  const renderSetScore = (setNumber: number, team1Score: number | null, team2Score: number | null) => {
    if (team1Score === null || team2Score === null) return null;

    const team1Won = team1Score > team2Score;
    const team2Won = team2Score > team1Score;

    return (
      <View className="flex-row items-center justify-between mb-3 p-3 rounded-lg bg-muted/20">
        <Text className="text-muted-foreground w-16 font-medium">Set {setNumber}</Text>
        <View className="flex-row items-center flex-1 justify-center">
          <Text
            className={`text-2xl font-bold ${
              team1Won ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {team1Score}
          </Text>
          <Text className="text-2xl mx-4 text-muted-foreground">-</Text>
          <Text
            className={`text-2xl font-bold ${
              team2Won ? "text-indigo-600" : "text-muted-foreground"
            }`}
          >
            {team2Score}
          </Text>
        </View>
        {(team1Won || team2Won) && (
          <View className="w-16 items-end">
            <View className={`px-2 py-1 rounded-full ${
              team1Won ? 'bg-primary/20' : 'bg-indigo-100 dark:bg-indigo-900/30'
            }`}>
              <Text className={`text-xs font-bold ${
                team1Won ? 'text-primary' : 'text-indigo-600'
              }`}>
                {team1Won ? "T1" : "T2"}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ENHANCED: Score editing section with real-time validation
  const renderScoreEditSection = () => {
    if (!matchState.isCreator) {
      return (
        <View className="bg-card rounded-xl p-6 mb-6 border border-amber-200 dark:border-amber-800">
          <View className="flex-row items-center mb-4">
            <Ionicons name="lock-closed-outline" size={24} color="#d97706" style={{ marginRight: 8 }} />
            <H3>Score Entry Restricted</H3>
          </View>
          <Text className="text-muted-foreground mb-4">
            Only the match creator ({match?.player1?.full_name || match?.player1?.email}) can enter scores for this match.
          </Text>
          <Button
            variant="outline"
            onPress={() => setEditingScores(false)}
            className="w-full"
          >
            <Text>Close</Text>
          </Button>
        </View>
      );
    }

    return (
      <View className="bg-card rounded-xl p-6 mb-6 border border-border/30">
        <View className="flex-row justify-between items-center mb-4">
          <H3>Edit Match Score</H3>
          <TouchableOpacity
            onPress={() => setEditingScores(false)}
            className="p-2"
          >
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Real-time validation display */}
        {scoreValidation.errors.length > 0 && (
          <View className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg mb-4">
            <Text className="text-red-800 dark:text-red-300 font-medium mb-1">Validation Errors:</Text>
            {scoreValidation.errors.map((error, index) => (
              <Text key={index} className="text-red-700 dark:text-red-400 text-sm">• {error}</Text>
            ))}
          </View>
        )}

        {scoreValidation.warnings.length > 0 && (
          <View className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg mb-4">
            <Text className="text-amber-800 dark:text-amber-300 font-medium mb-1">Warnings:</Text>
            {scoreValidation.warnings.map((warning, index) => (
              <Text key={index} className="text-amber-700 dark:text-amber-400 text-sm">• {warning}</Text>
            ))}
          </View>
        )}

        <SetScoreInput
          setNumber={1}
          value={set1Score}
          onChange={setSet1Score}
          onValidate={setIsSet1Valid}
        />

        <SetScoreInput
          setNumber={2}
          value={set2Score}
          onChange={setSet2Score}
          onValidate={setIsSet2Valid}
        />

        {showSet3 && (
          <SetScoreInput
            setNumber={3}
            value={set3Score}
            onChange={setSet3Score}
            onValidate={setIsSet3Valid}
          />
        )}

        {scoreValidation.isValid && scoreValidation.suggestedWinner && (
          <View className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <View className="flex-row items-center justify-center">
              <Ionicons name="trophy-outline" size={20} color="#1a7ebd" style={{ marginRight: 8 }} />
              <Text className="text-lg font-semibold text-primary">
                Winner: Team {scoreValidation.suggestedWinner}
              </Text>
            </View>
            {matchState.userTeam === scoreValidation.suggestedWinner && (
              <Text className="text-center text-green-600 dark:text-green-400 mt-1 font-medium">
                🎉 Congratulations! Your team won!
              </Text>
            )}
          </View>
        )}

        <Button
          className="w-full mt-6"
          variant="default"
          onPress={saveMatchScores}
          disabled={saving || !scoreValidation.isValid}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-primary-foreground font-medium">
              Save Scores {scoreValidation.suggestedWinner && `(Team ${scoreValidation.suggestedWinner} Wins)`}
            </Text>
          )}
        </Button>
      </View>
    );
  };

  // Loading state with enhanced UI
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1a7ebd" />
          <Text className="mt-4 text-muted-foreground">Loading match details...</Text>
          <View className="mt-6 bg-card rounded-xl p-4 w-full max-w-sm">
            <View className="flex-row items-center">
              <Ionicons name="information-circle-outline" size={16} color="#888" style={{ marginRight: 8 }} />
              <Text className="text-sm text-muted-foreground">
                Loading comprehensive match data
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-row items-center mb-6">
          <Button
            variant="ghost"
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </Button>
          <H1>Match Not Found</H1>
        </View>
        <View className="bg-card rounded-xl p-6 items-center">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-medium mt-4 mb-2">Match Not Found</Text>
          <Text className="text-muted-foreground text-center mb-6">
            Could not find the match you're looking for. It may have been deleted or you don't have permission to view it.
          </Text>
          <Button
            variant="default"
            onPress={() => router.replace("/(protected)/(tabs)")}
            className="w-full"
          >
            <Text>Return to Home</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const status = getStatusText();
  const userId = session?.user?.id;
  const isDark = colorScheme === 'dark';

  const isUserPlayer = (playerId: string | undefined) => {
    return playerId === userId;
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="p-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1a7ebd"]}
            tintColor="#1a7ebd"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Status Banners with Better Visual Hierarchy */}
        {matchState.needsScores && (
          <Animated.View 
            style={{ opacity: animatedValue }}
            className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-4 mb-4 border-l-4 border-amber-500"
          >
            <View className="flex-row items-center">
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color="#d97706"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="font-bold text-amber-800 dark:text-amber-300">
                  Match Needs Scores
                </Text>
                <Text className="text-amber-700 dark:text-amber-400 text-sm">
                  {matchState.isCreator 
                    ? "As the match creator, you can enter the scores." 
                    : "Only the match creator can enter scores for this match."}
                </Text>
              </View>
              {matchState.isCreator && (
                <TouchableOpacity
                  onPress={() => setEditingScores(true)}
                  className="bg-amber-500 px-4 py-2 rounded-lg"
                >
                  <Text className="text-white font-medium text-sm">Enter Scores</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
        
        {matchState.isFuture && (
          <View className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 mb-4 border-l-4 border-blue-500">
            <View className="flex-row items-center">
              <Ionicons
                name="calendar-outline"
                size={24}
                color="#1d4ed8"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="font-bold text-blue-800 dark:text-blue-300">
                  Upcoming Match
                </Text>
                <Text className="text-blue-700 dark:text-blue-400 text-sm">
                  {formatRelativeTime(match.start_time)} • {formatTime(match.start_time)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {matchState.canCancel && !matchState.isFuture && (
          <View className="bg-red-100 dark:bg-red-900/30 rounded-xl p-4 mb-4 border-l-4 border-red-500">
            <View className="flex-row items-center">
              <Ionicons
                name="warning-outline"
                size={24}
                color="#dc2626"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="font-bold text-red-800 dark:text-red-300">
                  Deletion Window Active
                </Text>
                <Text className="text-red-700 dark:text-red-400 text-sm">
                  {getCancellationTimeInfo()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Enhanced Date, Time and Location Card */}
        <View className="bg-card rounded-xl p-6 mb-6 border border-border/30">
          <View className="flex-row justify-between items-start">
            <View className="flex-row items-start flex-1">
              <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-4">
                <Ionicons name="calendar-outline" size={24} color="#1a7ebd" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold mb-1">
                  {formatRelativeTime(match.start_time)}
                </Text>
                <Text className="text-muted-foreground mb-2">
                  {formatDate(match.start_time)} • {formatTime(match.start_time)}
                  {match.end_time ? ` - ${formatTime(match.end_time)}` : ""}
                </Text>
                
                {/* Duration and Phase Info */}
                <View className="flex-row items-center flex-wrap gap-2">
                  <View className="bg-primary/10 px-2 py-1 rounded-full">
                    <Text className="text-xs font-medium text-primary">
                      {matchState.matchPhase.toUpperCase()}
                    </Text>
                  </View>
                  {match.start_time && match.end_time && (
                    <View className="bg-muted/50 px-2 py-1 rounded-full">
                      <Text className="text-xs text-muted-foreground">
                        {getMatchDuration(match.start_time, match.end_time)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Location */}
            {(match.region || match.court) && (
              <View className="items-end">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="location-outline" size={16} color="#888" style={{ marginRight: 4 }} />
                  <Text className="text-sm font-medium">
                    {match.court || "Court"}
                  </Text>
                </View>
                {match.region && (
                  <Text className="text-xs text-muted-foreground text-right">
                    {match.region}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Score Editing Section */}
        {editingScores && renderScoreEditSection()}

        {/* Enhanced Match Score Display */}
        {!editingScores && matchState.hasScores && (
          <View className="bg-card rounded-xl p-6 mb-6 border border-border/30">
            <View className="flex-row items-center justify-between mb-4">
              <H3>Match Score</H3>
              <TouchableOpacity
                onPress={() => setShowAdvancedStats(!showAdvancedStats)}
                className="bg-primary/10 px-3 py-1 rounded-full"
              >
                <Text className="text-xs text-primary font-medium">
                  {showAdvancedStats ? 'Hide' : 'Show'} Stats
                </Text>
              </TouchableOpacity>
            </View>

            {/* Final score with enhanced visual design */}
            <View className="items-center mb-6">
              <View className="flex-row items-center justify-center mb-3">
                <Text className="text-5xl font-bold text-primary">
                  {matchState.team1Sets}
                </Text>
                <Text className="text-3xl mx-6 text-muted-foreground">-</Text>
                <Text className="text-5xl font-bold text-indigo-600">
                  {matchState.team2Sets}
                </Text>
              </View>
              
              {matchState.userParticipating && (
                <View className={`px-6 py-3 rounded-full ${
                  matchState.userWon === true
                    ? "bg-green-100 dark:bg-green-900/30"
                    : matchState.userWon === false
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-yellow-100 dark:bg-yellow-900/30"
                }`}>
                  <Text
                    className={`font-bold text-lg ${
                      matchState.userWon === true
                        ? "text-green-800 dark:text-green-300"
                        : matchState.userWon === false
                          ? "text-red-800 dark:text-red-300"
                          : "text-yellow-800 dark:text-yellow-300"
                    }`}
                  >
                    {matchState.userWon === true ? "🏆 Victory!" : 
                     matchState.userWon === false ? "😔 Defeat" : "🤝 Draw"}
                  </Text>
                </View>
              )}
              <Text className="text-sm text-muted-foreground mt-2">Sets</Text>
            </View>

            <View className="h-px bg-border my-4" />

            {/* Set-by-set scores with enhanced design */}
            <View className="space-y-2">
              {renderSetScore(1, match.team1_score_set1, match.team2_score_set1)}
              {renderSetScore(2, match.team1_score_set2, match.team2_score_set2)}
              {match.team1_score_set3 !== null &&
                match.team2_score_set3 !== null &&
                renderSetScore(3, match.team1_score_set3, match.team2_score_set3)}
            </View>

            {/* Advanced Stats Toggle */}
            {showAdvancedStats && (
              <View className="mt-6 pt-6 border-t border-border/50">
                <Text className="font-medium mb-4">Match Statistics</Text>
                <View className="flex-row justify-around">
                  <View className="items-center">
                    <Text className="text-2xl font-bold">{calculateSetsPlayed()}</Text>
                    <Text className="text-xs text-muted-foreground">Sets Played</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold">
                      {match.start_time && match.end_time ? getMatchDuration(match.start_time, match.end_time) : 'N/A'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">Duration</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold">
                      {Math.abs(matchState.team1Sets - matchState.team2Sets)}
                    </Text>
                    <Text className="text-xs text-muted-foreground">Set Margin</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Enhanced Teams Section with Better Visualization */}
        <View className="bg-card rounded-xl p-4 mb-6 border border-border/30">
          <View className="flex-row justify-between items-center mb-4">
            <H3>Teams</H3>
            <View className="flex-row gap-2">
              {matchState.isCreator && (
                <View className="bg-primary/10 px-3 py-1 rounded-full">
                  <Text className="text-xs text-primary font-medium">Creator</Text>
                </View>
              )}
              {matchState.userParticipating && (
                <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                  <Text className="text-xs text-green-700 dark:text-green-300 font-medium">
                    Team {matchState.userTeam}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Enhanced Court Visualization */}
          <View className="aspect-[3/4] w-full bg-gradient-to-b from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 rounded-xl border-2 border-green-400 dark:border-green-700 overflow-hidden">
            {/* Team 1 Side */}
            <View className="h-[48%] border-b-2 border-dashed border-white dark:border-gray-400 relative">
              <View className="absolute top-2 left-2 right-2 flex-row justify-between items-center">
                <View className="bg-primary/90 px-3 py-1 rounded-full shadow-sm">
                  <Text className="text-sm font-bold text-white">Team 1</Text>
                </View>
                {matchState.winnerTeam === 1 && (
                  <Animated.View 
                    className="bg-yellow-500 px-3 py-1 rounded-full flex-row items-center shadow-lg"
                    style={{
                      transform: [{
                        scale: animatedValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.1]
                        })
                      }]
                    }}
                  >
                    <Ionicons name="trophy" size={14} color="white" />
                    <Text className="text-xs font-bold text-white ml-1">WINNER</Text>
                  </Animated.View>
                )}
              </View>

              {/* Team 1 Players with Enhanced Display */}
              <View className="flex-1 flex-row">
                <View className="flex-1 items-center justify-center">
                  <View className="items-center">
                    <View className={`w-16 h-16 rounded-full items-center justify-center mb-1 border-2 border-white dark:border-gray-700 shadow-lg ${
                      isUserPlayer(match.player1?.id) ? 'bg-yellow-500' : 'bg-primary'
                    }`}>
                      <Text className="text-2xl font-bold text-white">
                        {match.player1?.full_name?.charAt(0)?.toUpperCase() ||
                          match.player1?.email?.charAt(0)?.toUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                    <View className="bg-white dark:bg-gray-800 rounded-lg p-2 px-3 min-w-[90px] items-center shadow-sm">
                      <Text className="text-xs font-medium text-center" numberOfLines={1}>
                        {match.player1?.full_name ||
                          match.player1?.email?.split("@")[0] ||
                          "Player 1"}
                      </Text>
                      {isUserPlayer(match.player1?.id) && (
                        <Text className="text-xs text-primary font-bold">
                          You {matchState.isCreator && "(Creator)"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <View className="flex-1 items-center justify-center">
                  <View className="items-center">
                    <View className={`w-16 h-16 rounded-full items-center justify-center mb-1 border-2 border-white dark:border-gray-700 shadow-lg ${
                      isUserPlayer(match.player2?.id) ? 'bg-yellow-500' : match.player2 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}>
                      <Text className="text-2xl font-bold text-white">
                        {match.player2?.full_name?.charAt(0)?.toUpperCase() ||
                          match.player2?.email?.charAt(0)?.toUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                    <View className="bg-white dark:bg-gray-800 rounded-lg p-2 px-3 min-w-[90px] items-center shadow-sm">
                      <Text className="text-xs font-medium text-center" numberOfLines={1}>
                        {match.player2?.full_name ||
                          match.player2?.email?.split("@")[0] ||
                          "Open Slot"}
                      </Text>
                      {isUserPlayer(match.player2?.id) && (
                        <Text className="text-xs text-primary font-bold">You</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Enhanced Court Net */}
            <View className="h-[4%] bg-gray-300 dark:bg-gray-600 flex-row items-center justify-center relative">
              <View className="h-[2px] w-full bg-gray-500 dark:bg-gray-400"></View>
              <View className="absolute w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full"></View>
            </View>

            {/* Team 2 Side */}
            <View className="h-[48%] relative">
              <View className="flex-1 flex-row">
                <View className="flex-1 items-center justify-center">
                  <View className="items-center">
                    <View className="bg-white dark:bg-gray-800 rounded-lg p-2 px-3 min-w-[90px] items-center mb-1 shadow-sm">
                      <Text className="text-xs font-medium text-center" numberOfLines={1}>
                        {match.player3?.full_name ||
                          match.player3?.email?.split("@")[0] ||
                          "Open Slot"}
                      </Text>
                      {isUserPlayer(match.player3?.id) && (
                        <Text className="text-xs text-indigo-600 font-bold">You</Text>
                      )}
                    </View>
                    <View className={`w-16 h-16 rounded-full items-center justify-center mt-1 border-2 border-white dark:border-gray-700 shadow-lg ${
                      isUserPlayer(match.player3?.id) ? 'bg-yellow-500' : match.player3 ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'
                    }`}>
                      <Text className="text-2xl font-bold text-white">
                        {match.player3?.full_name?.charAt(0)?.toUpperCase() ||
                          match.player3?.email?.charAt(0)?.toUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="flex-1 items-center justify-center">
                  <View className="items-center">
                    <View className="bg-white dark:bg-gray-800 rounded-lg p-2 px-3 min-w-[90px] items-center mb-1 shadow-sm">
                      <Text className="text-xs font-medium text-center" numberOfLines={1}>
                        {match.player4?.full_name ||
                          match.player4?.email?.split("@")[0] ||
                          "Open Slot"}
                      </Text>
                      {isUserPlayer(match.player4?.id) && (
                        <Text className="text-xs text-indigo-600 font-bold">You</Text>
                      )}
                    </View>
                    <View className={`w-16 h-16 rounded-full items-center justify-center mt-1 border-2 border-white dark:border-gray-700 shadow-lg ${
                      isUserPlayer(match.player4?.id) ? 'bg-yellow-500' : match.player4 ? 'bg-indigo-500/80' : 'bg-gray-300 dark:bg-gray-700'
                    }`}>
                      <Text className="text-2xl font-bold text-white">
                        {match.player4?.full_name?.charAt(0)?.toUpperCase() ||
                          match.player4?.email?.charAt(0)?.toUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View className="absolute bottom-2 left-2 right-2 flex-row justify-between items-center">
                <View className="bg-indigo-500/90 px-3 py-1 rounded-full shadow-sm">
                  <Text className="text-sm font-bold text-white">Team 2</Text>
                </View>
                {matchState.winnerTeam === 2 && (
                  <Animated.View 
                    className="bg-yellow-500 px-3 py-1 rounded-full flex-row items-center shadow-lg"
                    style={{
                      transform: [{
                        scale: animatedValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.1]
                        })
                      }]
                    }}
                  >
                    <Ionicons name="trophy" size={14} color="white" />
                    <Text className="text-xs font-bold text-white ml-1">WINNER</Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </View>

          {/* Enhanced Court Legend */}
          <View className="flex-row justify-center items-center mt-4 py-2 px-3 bg-background dark:bg-background/50 rounded-lg self-center">
            <View className="flex-row items-center mr-4">
              <View className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></View>
              <Text className="text-xs text-muted-foreground">You</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-gray-300 dark:bg-gray-700 rounded-full mr-2"></View>
              <Text className="text-xs text-muted-foreground">Open Slot</Text>
            </View>
          </View>
        </View>

        {/* Enhanced Match Info Section */}
        <View className="bg-card rounded-xl p-5 mb-6 border border-border/30">
          <View className="flex-row items-center mb-4">
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
              <Ionicons name="information-circle" size={20} color="#1a7ebd" />
            </View>
            <H3>Match Information</H3>
          </View>

          {/* Enhanced Timeline with Better Visual Design */}
          <View className="ml-4">
            <View className="flex-row mb-4">
              <View className="mr-4 items-center">
                <View className="w-4 h-4 rounded-full bg-green-500 shadow-sm" />
                <View className="w-0.5 h-full bg-border absolute mt-4" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="create-outline" size={16} color={isDark ? '#aaa' : '#666'} style={{marginRight: 8}} />
                  <Text className="font-medium">Created</Text>
                </View>
                <Text className="text-muted-foreground">
                  {formatRelativeTime(match.created_at)} at {formatTime(match.created_at)}
                </Text>
              </View>
            </View>

            <View className="flex-row mb-4">
              <View className="mr-4 items-center">
                <View className="w-4 h-4 rounded-full bg-blue-500 shadow-sm" />
                <View className="w-0.5 h-full bg-border absolute mt-4" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="time-outline" size={16} color={isDark ? '#aaa' : '#666'} style={{marginRight: 8}} />
                  <Text className="font-medium">Match Details</Text>
                </View>
                <View className="bg-primary/5 dark:bg-primary/10 py-2 px-3 rounded-lg">
                  <Text className="text-primary font-medium">
                    Duration: {match.start_time && match.end_time
                      ? getMatchDuration(match.start_time, match.end_time)
                      : "Not specified"}
                  </Text>
                  <Text className="text-xs text-primary/70 mt-1">
                    Status: {getMatchStatus(match.status)}
                  </Text>
                </View>
              </View>
            </View>

            {match.completed_at && (
              <View className="flex-row">
                <View className="mr-4 items-center">
                  <View className="w-4 h-4 rounded-full bg-amber-500 shadow-sm" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="checkmark-done-outline" size={16} color={isDark ? '#aaa' : '#666'} style={{marginRight: 8}} />
                    <Text className="font-medium">Completed</Text>
                  </View>
                  <Text className="text-muted-foreground">
                    {formatRelativeTime(match.completed_at)} at {formatTime(match.completed_at)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Enhanced Match Statistics */}
          {(matchState.hasScores || ensureInteger(match.status) === 4) && (
            <View className="mt-6 pt-6 border-t border-border/30">
              <Text className="font-medium mb-4">Quick Stats</Text>
              <View className="grid grid-cols-3 gap-4">
                <View className="items-center p-3 bg-muted/20 rounded-lg">
                  <Ionicons name="tennisball-outline" size={20} color={isDark ? '#aaa' : '#666'} />
                  <Text className="text-lg font-bold mt-1">{calculateSetsPlayed()}</Text>
                  <Text className="text-xs text-muted-foreground text-center">Sets Played</Text>
                </View>

                <View className="items-center p-3 bg-muted/20 rounded-lg">
                  <Ionicons name="trophy-outline" size={20} color={isDark ? '#aaa' : '#666'} />
                  <Text className="text-lg font-bold mt-1 text-primary">
                    {matchState.winnerTeam ? `T${matchState.winnerTeam}` : "N/A"}
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center">Winner</Text>
                </View>
                
                <View className="items-center p-3 bg-muted/20 rounded-lg">
                  <Ionicons name="people-outline" size={20} color={isDark ? '#aaa' : '#666'} />
                  <Text className="text-lg font-bold mt-1">
                    {[match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean).length}
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center">Players</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Enhanced Match Actions with Better Visual Hierarchy */}
        <View className="bg-card rounded-xl border border-border/30 p-5 mb-6">
          <View className="flex-row items-center mb-4">
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
              <Ionicons name="options-outline" size={20} color="#1a7ebd" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-base">Match Actions</Text>
              <Text className="text-xs text-muted-foreground">
                {matchState.needsScores ? 
                  `Scores needed ${matchState.isCreator ? '• You can enter them' : '• Creator only'}` :
                  matchState.canJoin ? 'Spots available to join' :
                  matchState.canCancel ? `Can be deleted • ${getCancellationTimeInfo()}` :
                  'No actions available'
                }
              </Text>
            </View>
          </View>

          {/* Enhanced Action Grid */}
          <View className="space-y-3">
            {/* Primary Actions Row */}
            <View className="flex-row gap-3">
              {/* Share Match Button */}
              <TouchableOpacity 
                className="flex-1 flex-row items-center bg-background dark:bg-background/40 border border-border rounded-xl p-4"
                onPress={shareMatch}
              >
                <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 items-center justify-center mr-3">
                  <Ionicons name="share-social-outline" size={20} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">Share</Text>
                  <Text className="text-xs text-muted-foreground">
                    {matchState.isFuture ? 'Invite others' : 'Share result'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Join Match Button */}
              {matchState.canJoin && (
                <TouchableOpacity 
                  className="flex-1 flex-row items-center bg-primary border border-primary rounded-xl p-4" 
                  onPress={joinMatch}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
                        <Ionicons name="add" size={22} color="#fff" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-white">Join Match</Text>
                        <Text className="text-xs text-white/80">
                          {[match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean).length}/4 players
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Score Entry Action */}
            {matchState.canEnterScores && !editingScores && (
              <TouchableOpacity 
                className="flex-row items-center bg-green-600 border border-green-600 rounded-xl p-4" 
                onPress={() => setEditingScores(true)}
              >
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
                  <Ionicons name="create-outline" size={20} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-white">Enter Match Scores</Text>
                  <Text className="text-xs text-white/80">Creator privilege</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Confirmation Action */}
            {ensureInteger(match.status) === MatchStatus.NEEDS_CONFIRMATION && userId && matchState.isCreator && (
              <TouchableOpacity 
                className="flex-row items-center bg-amber-500 border border-amber-500 rounded-xl p-4" 
                onPress={() => {
                  Alert.alert(
                    "Confirm Match",
                    "Are you sure the match details and scores are correct?",
                    [
                      { text: "No", style: "cancel" },
                      { 
                        text: "Yes, Confirm", 
                        onPress: async () => {
                          try {
                            setSaving(true);
                            const { error } = await supabase
                              .from("matches")
                              .update({ status: MatchStatus.COMPLETED })
                              .eq("id", match.id);
                              
                            if (error) throw error;
                            
                            fetchMatchDetails(match.id);
                            Alert.alert("Success", "Match confirmed!");
                          } catch (error) {
                            console.error("Error confirming match:", error);
                            Alert.alert("Error", "Failed to confirm match");
                          } finally {
                            setSaving(false);
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-white">Confirm Match</Text>
                  <Text className="text-xs text-white/80">Finalize scores</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Delete Action (Separate Section) */}
          {matchState.canCancel && (
            <View className="mt-6 pt-4 border-t border-border/30">
              <TouchableOpacity 
                className="flex-row items-center justify-center py-3"
                onPress={cancelMatch}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Text className="ml-2 text-red-500 font-medium">Delete Match</Text>
                    <Text className="ml-2 text-red-400 text-xs">(Creator Only)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Enhanced User Performance Summary */}
        {matchState.userParticipating && matchState.hasScores && (
          <View className="bg-card rounded-xl p-6 mb-6 border border-border/30">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons name="person-outline" size={20} color="#1a7ebd" />
              </View>
              <H3>Your Performance</H3>
            </View>
            
            <View className="flex-row justify-around">
              <View className="items-center">
                <View className={`w-14 h-14 rounded-full items-center justify-center mb-3 ${
                  matchState.userWon === true ? 'bg-green-100 dark:bg-green-900/30' : 
                  matchState.userWon === false ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                  <Ionicons 
                    name={matchState.userWon === true ? "trophy" : matchState.userWon === false ? "sad" : "remove"} 
                    size={28} 
                    color={matchState.userWon === true ? "#059669" : matchState.userWon === false ? "#dc2626" : "#d97706"} 
                  />
                </View>
                <Text className="text-sm font-medium">Result</Text>
                <Text className={`text-xs ${
                  matchState.userWon === true ? 'text-green-600 dark:text-green-400' : 
                  matchState.userWon === false ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {matchState.userWon === true ? 'Victory' : matchState.userWon === false ? 'Defeat' : 'Draw'}
                </Text>
              </View>
              
              <View className="items-center">
                <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-3">
                  <Text className="text-xl font-bold text-primary">
                    {matchState.userTeam === 1 ? matchState.team1Sets : matchState.team2Sets}
                  </Text>
                </View>
                <Text className="text-sm font-medium">Sets Won</Text>
                <Text className="text-xs text-muted-foreground">Your Team</Text>
              </View>
              
              <View className="items-center">
                <View className="w-14 h-14 rounded-full bg-muted/30 items-center justify-center mb-3">
                  <Text className="text-xl font-bold">
                    {matchState.userTeam === 1 ? matchState.team2Sets : matchState.team1Sets}
                  </Text>
                </View>
                <Text className="text-sm font-medium">Sets Lost</Text>
                <Text className="text-xs text-muted-foreground">Opponents</Text>
              </View>
            </View>

            {/* Enhanced Performance Insights */}
            {matchState.userWon !== null && (
              <View className="mt-6 pt-4 border-t border-border/30">
                <Text className="text-sm font-medium mb-3">Match Insights</Text>
                <View className="space-y-2">
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={matchState.userWon ? "trending-up" : "trending-down"} 
                      size={16} 
                      color={matchState.userWon ? "#059669" : "#dc2626"} 
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-sm text-muted-foreground">
                      {matchState.userWon 
                        ? `Great job! You dominated this match with a ${Math.abs(matchState.team1Sets - matchState.team2Sets)}-set margin.`
                        : `Keep practicing! The margin was ${Math.abs(matchState.team1Sets - matchState.team2Sets)} set${Math.abs(matchState.team1Sets - matchState.team2Sets) !== 1 ? 's' : ''}.`
                      }
                    </Text>
                  </View>
                  
                  {match.start_time && match.end_time && (
                    <View className="flex-row items-center">
                      <Ionicons name="time" size={16} color="#888" style={{ marginRight: 8 }} />
                      <Text className="text-sm text-muted-foreground">
                        Match duration: {getMatchDuration(match.start_time, match.end_time)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Enhanced Match Description */}
        {match.description && (
          <View className="bg-card rounded-xl p-5 mb-6 border border-border/30">
            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons name="document-text-outline" size={20} color="#1a7ebd" />
              </View>
              <Text className="font-medium">Match Notes</Text>
            </View>
            <View className="bg-muted/20 p-4 rounded-lg">
              <Text className="text-muted-foreground italic leading-6">
                "{match.description}"
              </Text>
            </View>
          </View>
        )}

        {/* Enhanced Footer with Quick Navigation */}
        <View className="bg-card rounded-xl p-5 border border-border/30">
          <Text className="font-medium mb-4">Quick Navigation</Text>
          <View className="flex-row justify-around">
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(screens)/match-history')}
              className="items-center p-3"
            >
              <View className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mb-2">
                <Ionicons name="list-outline" size={24} color="#3b82f6" />
              </View>
              <Text className="text-xs text-center font-medium">Match History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(screens)/create-match')}
              className="items-center p-3"
            >
              <View className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center mb-2">
                <Ionicons name="add-circle-outline" size={24} color="#059669" />
              </View>
              <Text className="text-xs text-center font-medium">New Match</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(screens)/leaderboard')}
              className="items-center p-3"
            >
              <View className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mb-2">
                <Ionicons name="trophy-outline" size={24} color="#d97706" />
              </View>
              <Text className="text-xs text-center font-medium">Leaderboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(screens)/friends')}
              className="items-center p-3"
            >
              <View className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 items-center justify-center mb-2">
                <Ionicons name="people-outline" size={24} color="#7c3aed" />
              </View>
              <Text className="text-xs text-center font-medium">Friends</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Enhanced Floating Action Menu */}
      {!editingScores && (
        <View className="absolute bottom-6 right-6">
          {matchState.canEnterScores && (
            <TouchableOpacity
              onPress={() => setEditingScores(true)}
              className="w-14 h-14 rounded-full bg-green-600 items-center justify-center shadow-lg mb-3"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Ionicons name="create" size={24} color="white" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={shareMatch}
            className="w-12 h-12 rounded-full bg-primary items-center justify-center shadow-lg"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Ionicons name="share-social" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}