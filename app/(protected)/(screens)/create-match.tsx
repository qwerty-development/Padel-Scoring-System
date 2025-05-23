import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3 } from "@/components/ui/typography";
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';
import { Friend } from '@/types';

import { calculateMatchRatings } from '@/utils/glickoUtils';
import { PlayerSelectionModal } from '@/components/create-match/PlayerSelectionModal';
import { CustomDateTimePicker } from '@/components/create-match/DateTimePicker';
import { SetScoreInput, SetScore } from '@/components/create-match/SetScoreInput';

// Enhanced Match Status Enum
export enum MatchStatus {
  PENDING = 1,           // Future match, waiting for start time
  NEEDS_CONFIRMATION = 2, // Match finished, waiting for score confirmation
  CANCELLED = 3,         // Match was cancelled
  COMPLETED = 4,         // Match completed with scores recorded
  RECRUITING = 5,        // Public match looking for players
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
}

interface MatchData {
  id?: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  created_at?: string;
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
  is_public: boolean;
  description?: string;
}

export default function CreateMatchScreen() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : []
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  
  // Enhanced Date and time state
  const [matchDate, setMatchDate] = useState(new Date());
  const [matchStartTime, setMatchStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0); // Round to next 15 minutes
    return now;
  });
  const [matchEndTime, setMatchEndTime] = useState(() => {
    const date = new Date();
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    date.setHours(date.getHours() + 1, 30); // Default 1.5 hour matches
    return date;
  });
  
  // Simplified Match Settings - Only Public/Private Toggle
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [matchDescription, setMatchDescription] = useState('');
  
  // References for score inputs to enable auto-focus
  const team1Set1Ref = useRef<TextInput>(null);
  const team2Set1Ref = useRef<TextInput>(null);
  const team1Set2Ref = useRef<TextInput>(null);
  const team2Set2Ref = useRef<TextInput>(null);
  const team1Set3Ref = useRef<TextInput>(null);
  const team2Set3Ref = useRef<TextInput>(null);
  
  // Score state
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);

  // Location state
  const [region, setRegion] = useState('');
  const [court, setCourt] = useState('');
  
  const { profile, session } = useAuth();

  // Enhanced match type determination with buffer time
  const isPastMatch = useMemo(() => {
    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes()
    );
    const now = new Date();
    const bufferTime = 15 * 60 * 1000; // 15 minutes buffer
    return combinedStartTime.getTime() <= (now.getTime() + bufferTime);
  }, [matchDate, matchStartTime]);

  // Determine if this is a valid future match (at least 15 minutes from now)
  const isFutureMatch = useMemo(() => {
    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes()
    );
    const now = new Date();
    const minFutureTime = 15 * 60 * 1000; // 15 minutes minimum
    return combinedStartTime.getTime() > (now.getTime() + minFutureTime);
  }, [matchDate, matchStartTime]);

  // Enhanced team composition analysis
  const teamComposition = useMemo(() => {
    const totalPlayers = 1 + selectedFriends.length; // Including current user
    const availableSlots = 4 - totalPlayers;
    
    // Assign players to teams for display purposes
    const team1Players = [
      { 
        id: session?.user?.id || '', 
        name: profile?.full_name || session?.user?.email?.split('@')[0] || 'You',
        isCurrentUser: true 
      }
    ];
    const team2Players: Array<{ id: string; name: string; isCurrentUser: boolean }> = [];
    
    selectedPlayers.forEach((player, index) => {
      const playerInfo = {
        id: player.id,
        name: player.full_name || player.email?.split('@')[0] || 'Player',
        isCurrentUser: false
      };
      
      if (index === 0) {
        team1Players.push(playerInfo); // Second player goes to team 1
      } else {
        team2Players.push(playerInfo); // Remaining players go to team 2
      }
    });

    return {
      totalPlayers,
      availableSlots,
      team1Players,
      team2Players,
      isComplete: totalPlayers === 4,
      isValidForPast: totalPlayers === 4,
      isValidForFuture: totalPlayers >= 1 // At least current user
    };
  }, [selectedFriends, selectedPlayers, session?.user?.id, profile?.full_name]);

  // Effect to show/hide set 3 based on set 1 and 2 results
  useEffect(() => {
    if (!isPastMatch) {
      setShowSet3(false);
      return;
    }

    // Only show set 3 if there's a tie (1-1) in sets
    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);
    
    setShowSet3(isTied && isSet1Valid && isSet2Valid);
    
    // Reset set 3 score if we're hiding it
    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid, isPastMatch]);

  // Load selected player details
  useEffect(() => {
    if (selectedFriends.length > 0) {
      const selected = friends.filter(friend => selectedFriends.includes(friend.id));
      setSelectedPlayers(selected);
    } else {
      setSelectedPlayers([]);
    }
  }, [selectedFriends, friends]);

  // Auto-adjust end time when start time changes
  useEffect(() => {
    const startTime = new Date(matchStartTime);
    const newEndTime = new Date(startTime);
    newEndTime.setHours(newEndTime.getHours() + 1, 30); // Default 1.5 hours
    setMatchEndTime(newEndTime);
  }, [matchStartTime]);

  // Auto-disable public match option for past matches
  useEffect(() => {
    if (isPastMatch && isPublicMatch) {
      setIsPublicMatch(false);
    }
  }, [isPastMatch, isPublicMatch]);

  const fetchFriends = useCallback(async () => {
    try {
      if (!profile?.friends_list || !Array.isArray(profile.friends_list) || profile.friends_list.length === 0) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, glicko_rating, preferred_hand, court_playing_side')
        .in('id', profile.friends_list);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [profile]);

  useEffect(() => {
    if (session?.user?.id) {
      setLoading(true);
      fetchFriends().finally(() => setLoading(false));
    }
  }, [session, fetchFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [fetchFriends]);

  // Enhanced navigation between score inputs
  const handleTeam1Set1Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set1Ref.current?.focus();
    }
  };

  const handleTeam2Set1Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team1Set2Ref.current?.focus();
    }
  };

  const handleTeam1Set2Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set2Ref.current?.focus();
    }
  };

  const handleTeam2Set2Change = (text: string) => {
    if (showSet3 && text.length === 1 && /^\d$/.test(text)) {
      team1Set3Ref.current?.focus();
    }
  };

  const handleTeam1Set3Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set3Ref.current?.focus();
    }
  };

  const determineWinnerTeam = (): number => {
    let team1Sets = 0;
    let team2Sets = 0;
    
    // Count sets won by each team
    if (set1Score.team1 > set1Score.team2) team1Sets++;
    else if (set1Score.team2 > set1Score.team1) team2Sets++;
    
    if (set2Score.team1 > set2Score.team2) team1Sets++;
    else if (set2Score.team2 > set2Score.team1) team2Sets++;
    
    if (showSet3) {
      if (set3Score.team1 > set3Score.team2) team1Sets++;
      else if (set3Score.team2 > set3Score.team1) team2Sets++;
    }
    
    // Determine winner
    if (team1Sets > team2Sets) return 1;
    if (team2Sets > team1Sets) return 2;
    return 0; // Tie (should not happen in a valid padel match)
  };

  // Enhanced validation with detailed error messages
  const validateMatch = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Time validation
    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes()
    );
    
    const combinedEndTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchEndTime.getHours(),
      matchEndTime.getMinutes()
    );

    if (combinedEndTime <= combinedStartTime) {
      errors.push('End time must be after start time');
    }

    const matchDuration = combinedEndTime.getTime() - combinedStartTime.getTime();
    const minDuration = 30 * 60 * 1000; // 30 minutes
    const maxDuration = 4 * 60 * 60 * 1000; // 4 hours
    
    if (matchDuration < minDuration) {
      errors.push('Match duration must be at least 30 minutes');
    }
    
    if (matchDuration > maxDuration) {
      errors.push('Match duration cannot exceed 4 hours');
    }

    if (isPastMatch) {
      // Past match validation
      if (!teamComposition.isValidForPast) {
        errors.push('Past matches require exactly 4 players (you + 3 friends)');
      }
      
      if (!isSet1Valid || !isSet2Valid) {
        errors.push('Please enter valid scores for both sets');
      }
      
      if (showSet3 && !isSet3Valid) {
        errors.push('Please enter a valid score for the third set');
      }

      // Check if match is too far in the past (more than 7 days)
      const now = new Date();
      const daysDiff = (now.getTime() - combinedStartTime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) {
        errors.push('Cannot record matches older than 7 days');
      }

      // Past matches cannot be public
      if (isPublicMatch) {
        errors.push('Past matches cannot be made public');
      }
      
    } else {
      // Future match validation
      if (!isFutureMatch) {
        errors.push('Future matches must be scheduled at least 15 minutes from now');
      }
      
      if (!teamComposition.isValidForFuture) {
        errors.push('You must be part of the match');
      }

      // Check if match is too far in the future (more than 30 days)
      const now = new Date();
      const daysDiff = (combinedStartTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 30) {
        errors.push('Cannot schedule matches more than 30 days in advance');
      }
    }

    // Location validation for public matches
    if (isPublicMatch && !region.trim()) {
      errors.push('Public matches require a location to be specified');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const createMatch = async () => {
    try {
      const validation = validateMatch();
      
      if (!validation.isValid) {
        Alert.alert(
          'Validation Error', 
          validation.errors.join('\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      setLoading(true);
      
      const combinedStartTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchStartTime.getHours(),
        matchStartTime.getMinutes()
      );

      const combinedEndTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchEndTime.getHours(),
        matchEndTime.getMinutes()
      );

      if (isPastMatch) {
        // Past match - create with scores and update ratings
        const winnerTeam = determineWinnerTeam();
        
        const playerIds = [session?.user?.id, ...selectedFriends].filter(id => id != null) as string[];
        if (playerIds.length !== 4) {
          throw new Error('Could not form a team of 4 players');
        }

        // Fetch all players' Glicko ratings
        const { data: playersData, error: playersError } = await supabase
          .from('profiles')
          .select('id, glicko_rating, glicko_rd, glicko_vol')
          .in('id', playerIds);

        if (playersError) throw playersError;

        if (!playersData || playersData.length !== 4) {
          throw new Error('Could not fetch all player ratings');
        }

        // Map player IDs to their profiles
        const playerProfiles = playerIds.map(id => 
          playersData.find(p => p.id === id)
        ).filter(Boolean);

        if (playerProfiles.length !== 4) {
          throw new Error('Could not match all player IDs from fetched data');
        }

        // Create Glicko rating objects
        const glickoRatings = playerProfiles.map(profile => ({
          rating: parseFloat(profile!.glicko_rating || '1500'),
          rd: parseFloat(profile!.glicko_rd || '350'),
          vol: parseFloat(profile!.glicko_vol || '0.06')
        }));

        // Calculate new ratings
        const newRatings = calculateMatchRatings(
          glickoRatings[0],
          glickoRatings[1],
          glickoRatings[2],
          glickoRatings[3],
          winnerTeam === 1 ? 1 : 0,
          winnerTeam === 2 ? 1 : 0
        );

        // Prepare match data for Supabase
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: selectedFriends[0] || null,
          player3_id: selectedFriends[1] || null,
          player4_id: selectedFriends[2] || null,
          team1_score_set1: set1Score.team1,
          team2_score_set1: set1Score.team2,
          team1_score_set2: set2Score.team1,
          team2_score_set2: set2Score.team2,
          team1_score_set3: showSet3 ? set3Score.team1 : null,
          team2_score_set3: showSet3 ? set3Score.team2 : null,
          winner_team: winnerTeam,
          status: MatchStatus.COMPLETED,
          completed_at: new Date().toISOString(),
          start_time: combinedStartTime.toISOString(),
          end_time: combinedEndTime.toISOString(),
          region: region.trim() || null,
          court: court.trim() || null,
          is_public: false, // Past matches are always private
          description: matchDescription.trim() || null
        };

        // Insert match into Supabase
        const { data: matchResult, error: matchError } = await supabase
          .from('matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        // Update player ratings
        const updatePromises = playerProfiles.map((profile, index) => 
          supabase.from('profiles').update({
            glicko_rating: Math.round(Object.values(newRatings)[index].rating).toString(),
            glicko_rd: Math.round(Object.values(newRatings)[index].rd).toString(),
            glicko_vol: Object.values(newRatings)[index].vol.toFixed(6)
          }).eq('id', profile!.id)
        );

        await Promise.all(updatePromises);

        // Show success message with rating change
        const userRatingChange = Math.round(newRatings.player1.rating - glickoRatings[0].rating);
        Alert.alert(
          'Match Recorded Successfully!', 
          `Match created and ratings updated.\nYour rating changed by ${userRatingChange > 0 ? '+' : ''}${userRatingChange} points.`,
          [{ text: 'OK', onPress: () => router.push('/(protected)/(tabs)') }]
        );
        
      } else {
        // Future match - create for scheduling
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: selectedFriends[0] || null,
          player3_id: selectedFriends[1] || null,
          player4_id: selectedFriends[2] || null,
          team1_score_set1: null,
          team2_score_set1: null,
          team1_score_set2: null,
          team2_score_set2: null,
          team1_score_set3: null,
          team2_score_set3: null,
          winner_team: null,
          status: teamComposition.isComplete ? MatchStatus.PENDING : MatchStatus.RECRUITING,
          completed_at: null,
          start_time: combinedStartTime.toISOString(),
          end_time: combinedEndTime.toISOString(),
          region: region.trim() || null,
          court: court.trim() || null,
          is_public: isPublicMatch,
          description: matchDescription.trim() || null
        };

        // Insert match into Supabase
        const { data: matchResult, error: matchError } = await supabase
          .from('matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        // Show appropriate success message
        let statusMessage = '';
        if (teamComposition.isComplete) {
          statusMessage = isPublicMatch 
            ? 'Your public match has been scheduled successfully!'
            : 'Your private match has been scheduled successfully!';
        } else {
          statusMessage = isPublicMatch 
            ? 'Your public match has been created! Other players can now join.'
            : `Private match created with ${teamComposition.availableSlots} open slot${teamComposition.availableSlots > 1 ? 's' : ''}. Invite more friends to complete the match.`;
        }

        Alert.alert(
          'Match Scheduled!', 
          statusMessage,
          [{ text: 'OK', onPress: () => router.push('/(protected)/(tabs)') }]
        );
      }
      
    } catch (error) {
      console.error('Error creating match:', error);
      Alert.alert(
        'Error', 
        `Failed to create match: ${(error as Error).message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Enhanced player section with team visualization
  const renderPlayerSection = () => (
    <View className={`mb-6 p-4 rounded-xl border border-border/30 ${
      isPastMatch 
        ? 'bg-amber-50 dark:bg-amber-900/20' 
        : 'bg-blue-50 dark:bg-blue-900/20'
    }`}>
      <View className="flex-row items-center justify-between mb-2">
        <H3>Players ({teamComposition.totalPlayers}/4)</H3>
        <View className={`px-3 py-1 rounded-full ${
          isPastMatch 
            ? 'bg-amber-100 dark:bg-amber-900/40' 
            : 'bg-blue-100 dark:bg-blue-900/40'
        }`}>
          <Text className={`text-xs font-medium ${
            isPastMatch 
              ? 'text-amber-800 dark:text-amber-200' 
              : 'text-blue-800 dark:text-blue-200'
          }`}>
            {isPastMatch ? 'Past Match' : 'Future Match'}
          </Text>
        </View>
      </View>
      
      <Text className="text-xs text-muted-foreground mb-4">
        {isPastMatch 
          ? 'Past matches require exactly 4 players for rating calculations'
          : 'Future matches can have 1-4 players. Missing spots can be filled later.'}
      </Text>
      
      {/* Team Composition Display */}
      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4 mb-4">
        <View className="flex-row justify-between">
          {/* Team 1 */}
          <View className="flex-1 mr-2">
            <View className="flex-row items-center mb-2">
              <View className="w-6 h-6 rounded-full bg-primary items-center justify-center mr-2">
                <Text className="text-xs font-bold text-white">T1</Text>
              </View>
              <Text className="text-sm font-medium">Team 1</Text>
            </View>
            {teamComposition.team1Players.map((player, index) => (
              <View key={player.id} className="flex-row items-center mb-1">
                <View className="w-8 h-8 rounded-full bg-primary/80 items-center justify-center mr-2">
                  <Text className="text-xs font-bold text-white">
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-sm" numberOfLines={1}>
                  {player.isCurrentUser ? 'You' : player.name}
                </Text>
              </View>
            ))}
            {Array(2 - teamComposition.team1Players.length).fill(0).map((_, i) => (
              <View key={`team1-empty-${i}`} className="flex-row items-center mb-1 opacity-40">
                <View className="w-8 h-8 rounded-full border-2 border-dashed border-primary/40 items-center justify-center mr-2">
                  <Text className="text-xs text-primary/60">?</Text>
                </View>
                <Text className="text-sm text-muted-foreground">Open</Text>
              </View>
            ))}
          </View>
          
          {/* VS Divider */}
          <View className="items-center justify-center px-2">
            <Text className="text-lg font-bold text-muted-foreground">VS</Text>
          </View>
          
          {/* Team 2 */}
          <View className="flex-1 ml-2">
            <View className="flex-row items-center mb-2">
              <View className="w-6 h-6 rounded-full bg-indigo-500 items-center justify-center mr-2">
                <Text className="text-xs font-bold text-white">T2</Text>
              </View>
              <Text className="text-sm font-medium">Team 2</Text>
            </View>
            {teamComposition.team2Players.map((player, index) => (
              <View key={player.id} className="flex-row items-center mb-1">
                <View className="w-8 h-8 rounded-full bg-indigo-500 items-center justify-center mr-2">
                  <Text className="text-xs font-bold text-white">
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-sm" numberOfLines={1}>{player.name}</Text>
              </View>
            ))}
            {Array(2 - teamComposition.team2Players.length).fill(0).map((_, i) => (
              <View key={`team2-empty-${i}`} className="flex-row items-center mb-1 opacity-40">
                <View className="w-8 h-8 rounded-full border-2 border-dashed border-indigo-500/40 items-center justify-center mr-2">
                  <Text className="text-xs text-indigo-500/60">?</Text>
                </View>
                <Text className="text-sm text-muted-foreground">Open</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      
      {/* Player Management Buttons */}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onPress={() => setShowPlayerModal(true)}
        >
          <Ionicons name="people-outline" size={16} color="#1a7ebd" />
          <Text className="ml-2">
            {selectedPlayers.length === 0 ? 'Add Players' : 'Manage Players'}
          </Text>
        </Button>
        
        {selectedPlayers.length > 0 && (
          <Button
            variant="ghost"
            onPress={() => {
              setSelectedFriends([]);
              setSelectedPlayers([]);
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </Button>
        )}
      </View>
      
      {/* Status Indicators */}
      {!isPastMatch && (
        <View className="mt-3 p-3 bg-background/40 rounded-lg">
          <View className="flex-row items-center">
            <Ionicons 
              name={teamComposition.isComplete ? "checkmark-circle" : "information-circle"} 
              size={16} 
              color={teamComposition.isComplete ? "#22c55e" : "#f59e0b"} 
            />
            <Text className={`ml-2 text-sm ${
              teamComposition.isComplete ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {teamComposition.isComplete 
                ? 'Match is ready to start' 
                : `${teamComposition.availableSlots} slot${teamComposition.availableSlots > 1 ? 's' : ''} available`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  // Enhanced time section with simplified match settings
  const renderTimeSection = () => (
    <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
      <H3 className="mb-4">Date & Time</H3>
      
      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4 mb-4">
        <CustomDateTimePicker
          label="Match Date"
          value={matchDate}
          onChange={setMatchDate}
          mode="date"
          minimumDate={isPastMatch ? undefined : new Date()}
          maximumDate={isPastMatch ? new Date() : (() => {
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30);
            return maxDate;
          })()}
        />
        
        <View className="flex-row gap-4 mt-4">
          <View className="flex-1">
            <CustomDateTimePicker
              label="Start Time"
              value={matchStartTime}
              onChange={setMatchStartTime}
              mode="time"
            />
          </View>
          <View className="flex-1">
            <CustomDateTimePicker
              label="End Time"
              value={matchEndTime}
              onChange={setMatchEndTime}
              mode="time"
            />
          </View>
        </View>
        
        {/* Duration Display */}
        <View className="mt-3 p-2 bg-muted/30 rounded">
          <Text className="text-sm text-muted-foreground">
            Duration: {Math.round((matchEndTime.getTime() - matchStartTime.getTime()) / (1000 * 60))} minutes
          </Text>
        </View>
      </View>
      
      {/* Simplified Match Settings for Future Matches */}
      {!isPastMatch && (
        <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4 mb-4">
          <Text className="text-base font-medium mb-3">Match Settings</Text>
          
          {/* Public/Private Toggle */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-muted-foreground">Match Visibility</Text>
              <View className="flex-row items-center">
                <Text className={`text-sm mr-3 ${!isPublicMatch ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  Private
                </Text>
                <TouchableOpacity
                  className={`w-12 h-6 rounded-full ${
                    isPublicMatch ? 'bg-primary' : 'bg-muted'
                  }`}
                  onPress={() => setIsPublicMatch(!isPublicMatch)}
                >
                  <View className={`w-5 h-5 rounded-full bg-white m-0.5 transition-transform ${
                    isPublicMatch ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </TouchableOpacity>
                <Text className={`text-sm ml-3 ${isPublicMatch ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  Public
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              {isPublicMatch 
                ? 'Anyone can discover and join this match' 
                : 'Only invited players can see this match'}
            </Text>
          </View>
          
          <View className="mb-4">
            <Text className="text-sm font-medium mb-2 text-muted-foreground">Description (Optional)</Text>
            <TextInput
              className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-3 text-foreground"
              value={matchDescription}
              onChangeText={setMatchDescription}
              placeholder="Add details about the match..."
              placeholderTextColor="#888"
              multiline
              numberOfLines={2}
              maxLength={200}
            />
          </View>
        </View>
      )}
      
      {/* Location fields */}
      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4">
        <Text className="text-base font-medium mb-3">Location Details</Text>
        
        <View className="mb-4">
          <Text className="text-sm font-medium mb-2 text-muted-foreground">
            Court {isPublicMatch && '*'}
          </Text>
          <TextInput
            className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
            value={court}
            onChangeText={setCourt}
            placeholder="Court name or number"
            placeholderTextColor="#888"
          />
        </View>
        
        <View>
          <Text className="text-sm font-medium mb-2 text-muted-foreground">
            Region/Location {isPublicMatch && '*'}
          </Text>
          <TextInput
            className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
            value={region}
            onChangeText={setRegion}
            placeholder="City, venue, or area"
            placeholderTextColor="#888"
          />
        </View>
        
        {isPublicMatch && (
          <Text className="text-xs text-muted-foreground mt-2">
            * Required for public matches
          </Text>
        )}
      </View>
    </View>
  );

  const renderScoreSection = () => {
    // Only show score section for past matches
    if (!isPastMatch) return null;
    
    return (
      <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
        <H3 className="mb-4">Match Score</H3>
        
        <SetScoreInput
          setNumber={1}
          value={set1Score}
          onChange={setSet1Score}
          onValidate={setIsSet1Valid}
          team1Ref={team1Set1Ref}
          team2Ref={team2Set1Ref}
          onTeam1Change={handleTeam1Set1Change}
          onTeam2Change={handleTeam2Set1Change}
        />
        
        <SetScoreInput
          setNumber={2}
          value={set2Score}
          onChange={setSet2Score}
          onValidate={setIsSet2Valid}
          team1Ref={team1Set2Ref}
          team2Ref={team2Set2Ref}
          onTeam1Change={handleTeam1Set2Change}
          onTeam2Change={handleTeam2Set2Change}
        />
        
        {showSet3 && (
          <SetScoreInput
            setNumber={3}
            value={set3Score}
            onChange={setSet3Score}
            onValidate={setIsSet3Valid}
            team1Ref={team1Set3Ref}
            team2Ref={team2Set3Ref}
            onTeam1Change={handleTeam1Set3Change}
          />
        )}
        
        {isSet1Valid && isSet2Valid && (
          <View className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary">
            <Text className="text-lg font-semibold">
              Winner: Team {determineWinnerTeam()}
            </Text>
            <Text className="text-muted-foreground">
              {determineWinnerTeam() === 1 
                ? `${teamComposition.team1Players.map(p => p.isCurrentUser ? 'You' : p.name).join(' & ')} won this match` 
                : `${teamComposition.team2Players.map(p => p.name).join(' & ')} won this match`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Enhanced submit button logic
  const getSubmitButtonState = () => {
    const validation = validateMatch();
    
    return {
      disabled: loading || !validation.isValid,
      text: loading 
        ? 'Creating...' 
        : isPastMatch 
          ? 'Record Match' 
          : teamComposition.isComplete 
            ? 'Schedule Match' 
            : 'Create Match',
      subtitle: !validation.isValid && validation.errors.length > 0 
        ? validation.errors[0] 
        : null
    };
  };

  const submitState = getSubmitButtonState();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a7ebd"
            colors={['#1a7ebd']}
          />
        }
      >
        <View className="flex-row items-center pt-4 pb-2">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-background dark:bg-card"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </TouchableOpacity>
          <H1>{isPastMatch ? 'Record Match' : 'Schedule Match'}</H1>
        </View>

        <Text className="text-muted-foreground mb-6 ml-1">
          {isPastMatch 
            ? 'Record a completed match. All players will have their ratings updated based on the results.'
            : 'Schedule a future match. You can invite friends or create a public match for others to join.'}
        </Text>
        
        {renderTimeSection()}
        {renderPlayerSection()}
        {renderScoreSection()}
        
        <View className="mt-2 mb-10">
          <Button
            className="w-full"
            size="lg"
            variant="default"
            onPress={createMatch}
            disabled={submitState.disabled}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-primary-foreground font-medium">
                {submitState.text}
              </Text>
            )}
          </Button>
          
          {submitState.subtitle && (
            <Text className="text-sm text-red-500 dark:text-red-400 mt-2 text-center">
              {submitState.subtitle}
            </Text>
          )}
        </View>
      </ScrollView>
      
      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={setSelectedFriends}
        loading={loading}
        maxSelections={isPastMatch ? 3 : 3}
      />
    </SafeAreaView>
  );
}