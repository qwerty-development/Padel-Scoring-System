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
  
  // Date and time state
  const [matchDate, setMatchDate] = useState(new Date());
  const [matchStartTime, setMatchStartTime] = useState(new Date());
  const [matchEndTime, setMatchEndTime] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date;
  });
  
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

  // Determine if this is a past or future match
  const isPastMatch = useMemo(() => {
    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes()
    );
    return combinedStartTime <= new Date();
  }, [matchDate, matchStartTime]);

  // Effect to show/hide set 3 based on set 1 and 2 results
  useEffect(() => {
    // Only show set 3 if there's a tie (1-1) in sets
    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);
    
    setShowSet3(isTied && isSet1Valid && isSet2Valid);
    
    // Reset set 3 score if we're hiding it
    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid]);

  // Load selected player details
  useEffect(() => {
    if (selectedFriends.length > 0) {
      const selected = friends.filter(friend => selectedFriends.includes(friend.id));
      setSelectedPlayers(selected);
    } else {
      setSelectedPlayers([]);
    }
  }, [selectedFriends, friends]);

  const fetchFriends = useCallback(async () => {
    try {
      if (!profile?.friends_list || !Array.isArray(profile.friends_list) || profile.friends_list.length === 0) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, glicko_rating')
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

  // Handle navigation between score inputs
  const handleTeam1Set1Change = (text: string) => {
    if (text.length === 1) {
      team2Set1Ref.current?.focus();
    }
  };

  const handleTeam2Set1Change = (text: string) => {
    if (text.length === 1) {
      team1Set2Ref.current?.focus();
    }
  };

  const handleTeam1Set2Change = (text: string) => {
    if (text.length === 1) {
      team2Set2Ref.current?.focus();
    }
  };

  const handleTeam2Set2Change = (text: string) => {
    if (showSet3 && text.length === 1) {
      team1Set3Ref.current?.focus();
    }
  };

  const handleTeam1Set3Change = (text: string) => {
    if (text.length === 1) {
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
    return 0; // Tie (should not happen in a valid match)
  };

  const validateMatch = (): boolean => {
    // Different validation based on whether it's a past or future match
    if (isPastMatch) {
      // Past match validation - requires all players and scores
      if (selectedFriends.length !== 3) {
        Alert.alert('Incomplete Selection', 'For past matches, please select exactly 3 players to create a match.');
        return false;
      }
      
      // Validate score
      if (!isSet1Valid || !isSet2Valid) {
        Alert.alert('Invalid Score', 'Please enter valid scores for both sets.');
        return false;
      }
      
      // Validate set 3 if shown
      if (showSet3 && !isSet3Valid) {
        Alert.alert('Invalid Score', 'Please enter a valid score for the third set.');
        return false;
      }
      
    } else {
      // Future match validation - player selection is optional
      if (selectedFriends.length === 0) {
        Alert.alert('No Players Selected', 'Please select at least one player for the match.');
        return false;
      }
    }
    
    // Validate times for both past and future matches
    if (matchEndTime <= matchStartTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return false;
    }
    
    return true;
  };

  const createMatch = async () => {
    try {
      if (!validateMatch()) {
        return;
      }

      setLoading(true);
      
      // Prepare match data based on whether it's a past or future match
      if (isPastMatch) {
        // Past match - create with scores and update ratings
        const winnerTeam = determineWinnerTeam();
        
        const playerIds = [session?.user?.id, ...selectedFriends].filter(id => id != null) as string[];
        if (playerIds.length !== 4) {
          throw new Error('Could not form a team of 4 players.');
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
        const player1Profile = playersData.find(p => p.id === session?.user?.id);
        const player2Profile = playersData.find(p => p.id === selectedFriends[0]);
        const player3Profile = playersData.find(p => p.id === selectedFriends[1]);
        const player4Profile = playersData.find(p => p.id === selectedFriends[2]);

        if (!player1Profile || !player2Profile || !player3Profile || !player4Profile) {
          throw new Error('Could not match all player IDs from fetched data');
        }

        // Create Glicko rating objects
        const player1Rating = {
          rating: parseFloat(player1Profile.glicko_rating || '1500'),
          rd: parseFloat(player1Profile.glicko_rd || '350'),
          vol: parseFloat(player1Profile.glicko_vol || '0.06')
        };
        
        const player2Rating = {
          rating: parseFloat(player2Profile.glicko_rating || '1500'),
          rd: parseFloat(player2Profile.glicko_rd || '350'),
          vol: parseFloat(player2Profile.glicko_vol || '0.06')
        };
        
        const player3Rating = {
          rating: parseFloat(player3Profile.glicko_rating || '1500'),
          rd: parseFloat(player3Profile.glicko_rd || '350'),
          vol: parseFloat(player3Profile.glicko_vol || '0.06')
        };
        
        const player4Rating = {
          rating: parseFloat(player4Profile.glicko_rating || '1500'),
          rd: parseFloat(player4Profile.glicko_rd || '350'),
          vol: parseFloat(player4Profile.glicko_vol || '0.06')
        };

        // Calculate new ratings
        const newRatings = calculateMatchRatings(
          player1Rating,
          player2Rating,
          player3Rating,
          player4Rating,
          winnerTeam === 1 ? 1 : 0,
          winnerTeam === 2 ? 1 : 0
        );

        // Prepare match data for Supabase
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: selectedFriends[0],
          player3_id: selectedFriends[1],
          player4_id: selectedFriends[2],
          team1_score_set1: set1Score.team1,
          team2_score_set1: set1Score.team2,
          team1_score_set2: set2Score.team1,
          team2_score_set2: set2Score.team2,
          team1_score_set3: showSet3 ? set3Score.team1 : null,
          team2_score_set3: showSet3 ? set3Score.team2 : null,
          winner_team: winnerTeam,
          status: 4, // Completed
          completed_at: new Date().toISOString(),
          start_time: matchStartTime.toISOString(),
          end_time: matchEndTime.toISOString(),
          region: region || null,
          court: court || null
        };

        // Insert match into Supabase
        const { data: matchResult, error: matchError } = await supabase
          .from('matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        // Update player ratings
        const updatePromises = [
          supabase.from('profiles').update({
            glicko_rating: Math.round(newRatings.player1.rating).toString(),
            glicko_rd: Math.round(newRatings.player1.rd).toString(),
            glicko_vol: newRatings.player1.vol.toFixed(6)
          }).eq('id', player1Profile.id),
          
          supabase.from('profiles').update({
            glicko_rating: Math.round(newRatings.player2.rating).toString(),
            glicko_rd: Math.round(newRatings.player2.rd).toString(),
            glicko_vol: newRatings.player2.vol.toFixed(6)
          }).eq('id', player2Profile.id),
          
          supabase.from('profiles').update({
            glicko_rating: Math.round(newRatings.player3.rating).toString(),
            glicko_rd: Math.round(newRatings.player3.rd).toString(),
            glicko_vol: newRatings.player3.vol.toFixed(6)
          }).eq('id', player3Profile.id),
          
          supabase.from('profiles').update({
            glicko_rating: Math.round(newRatings.player4.rating).toString(),
            glicko_rd: Math.round(newRatings.player4.rd).toString(),
            glicko_vol: newRatings.player4.vol.toFixed(6)
          }).eq('id', player4Profile.id)
        ];

        await Promise.all(updatePromises);

        // Show success message with rating change
        const ratingDiff = Math.round(newRatings.player1.rating - player1Rating.rating);
        Alert.alert(
          'Match Created', 
          `Match created successfully! Your rating changed by ${ratingDiff > 0 ? '+' : ''}${ratingDiff} points.`,
          [{ text: 'OK', onPress: () => router.push('/(protected)/(tabs)') }]
        );
      } else {
        // Future match - just create with players, no scores or rating updates
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: selectedFriends.length >= 1 ? selectedFriends[0] : null,
          player3_id: selectedFriends.length >= 2 ? selectedFriends[1] : null,
          player4_id: selectedFriends.length >= 3 ? selectedFriends[2] : null,
          team1_score_set1: null,
          team2_score_set1: null,
          team1_score_set2: null,
          team2_score_set2: null,
          team1_score_set3: null,
          team2_score_set3: null,
          winner_team: null,
          status: 1, // Pending
          completed_at: null,
          start_time: new Date(
            matchDate.getFullYear(),
            matchDate.getMonth(),
            matchDate.getDate(),
            matchStartTime.getHours(),
            matchStartTime.getMinutes()
          ).toISOString(),
          end_time: new Date(
            matchDate.getFullYear(),
            matchDate.getMonth(),
            matchDate.getDate(),
            matchEndTime.getHours(),
            matchEndTime.getMinutes()
          ).toISOString(),
          region: region || null,
          court: court || null
        };

        // Insert match into Supabase
        const { data: matchResult, error: matchError } = await supabase
          .from('matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        // Show success message
        Alert.alert(
          'Match Scheduled', 
          'Your match has been scheduled successfully!',
          [{ text: 'OK', onPress: () => router.push('/(protected)/(tabs)') }]
        );
      }
      
    } catch (error) {
      console.error('Error creating match:', error);
      Alert.alert('Error', `Failed to create match: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderPlayerSection = () => (
    <View className={`mb-6 p-4 rounded-xl ${isPastMatch ? 'bg-card' : 'bg-blue-50 dark:bg-blue-900/30'} border border-border/30`}>
      <View className="flex-row items-center justify-between mb-2">
        <H3>Players</H3>
        {isPastMatch ? (
          <View className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 rounded">
            <Text className="text-xs text-amber-800 dark:text-amber-200">Past Match</Text>
          </View>
        ) : (
          <View className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 rounded">
            <Text className="text-xs text-blue-800 dark:text-blue-200">Future Match</Text>
          </View>
        )}
      </View>
      
      {isPastMatch && (
        <Text className="text-xs text-muted-foreground mb-3">
          For past matches, all 4 players are required
        </Text>
      )}
      
      <View className="flex-row flex-wrap mt-2">
        {/* Current user (Player 1) */}
        <View className="w-1/4 items-center mb-4">
          <View className="w-14 h-14 rounded-full bg-primary items-center justify-center mb-1">
            <Text className="text-lg font-bold text-primary-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 
               session?.user?.email?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text className="text-sm font-medium">You</Text>
          <Text className="text-xs text-muted-foreground">Team 1</Text>
        </View>
        
        {/* Player selection button */}
        {(selectedPlayers.length < 3 || !isPastMatch) && (
          <TouchableOpacity 
            className="w-1/4 items-center mb-4"
            onPress={() => setShowPlayerModal(true)}
          >
            <View className="w-14 h-14 rounded-full border-2 border-dashed border-primary/70 items-center justify-center mb-1">
              <Ionicons name="add" size={30} color="#1a7ebd" />
            </View>
            <Text className="text-sm font-medium">Add Players</Text>
            <Text className="text-xs text-muted-foreground">
              {selectedPlayers.length}/{isPastMatch ? '3' : '3+'} selected
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Selected players */}
        {selectedPlayers.map((player, index) => (
          <View 
            key={player.id} 
            className="w-1/4 items-center mb-4"
          >
            <View className={`w-14 h-14 rounded-full items-center justify-center mb-1 ${
              index === 0 ? 'bg-primary' : 'bg-indigo-500 dark:bg-indigo-600'
            }`}>
              <Text className="text-lg font-bold text-white">
                {player.full_name?.charAt(0)?.toUpperCase() || 
                 player.email?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text className="text-sm font-medium text-center" numberOfLines={1}>
              {player.full_name || player.email?.split('@')[0]}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {index === 0 ? 'Team 1' : 'Team 2'}
            </Text>
          </View>
        ))}
        
        {/* Empty slots */}
        {Array(3 - selectedPlayers.length).fill(0).map((_, i) => (
          <View key={`empty-${i}`} className="w-1/4 items-center mb-4 opacity-30">
            <View className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/40 items-center justify-center mb-1">
              <Text className="text-lg text-muted-foreground">?</Text>
            </View>
            <Text className="text-xs text-muted-foreground">Empty Slot</Text>
          </View>
        ))}
      </View>
      
      {selectedPlayers.length > 0 && (
        <TouchableOpacity 
          className="flex-row items-center justify-center mt-2 p-2"
          onPress={() => setShowPlayerModal(true)}
        >
          <Ionicons name="create-outline" size={16} color="#888" />
          <Text className="text-sm text-muted-foreground ml-1">
            Edit Players
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTimeSection = () => (
    <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
      <H3 className="mb-4">Date & Time</H3>
      
      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4 mb-4">
        <CustomDateTimePicker
          label="Match Date"
          value={matchDate}
          onChange={setMatchDate}
          mode="date"
          maximumDate={isPastMatch ? new Date() : undefined}
        />
        
        <View className="flex-row gap-4">
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
      </View>
      
      {/* Location fields */}
      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4">
        <Text className="text-base font-medium mb-3">Location Details</Text>
        
        <View className="mb-4">
          <Text className="text-sm font-medium mb-2 text-muted-foreground">Court</Text>
          <TextInput
            className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
            value={court}
            onChangeText={setCourt}
            placeholder="Enter court name"
            placeholderTextColor="#888"
          />
        </View>
        
        <View>
          <Text className="text-sm font-medium mb-2 text-muted-foreground">Region/Location</Text>
          <TextInput
            className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
            value={region}
            onChangeText={setRegion}
            placeholder="Enter match location"
            placeholderTextColor="#888"
          />
        </View>
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
              Winner: {determineWinnerTeam() === 1 ? 'Team 1' : 'Team 2'}
            </Text>
            <Text className="text-muted-foreground">
              {determineWinnerTeam() === 1 
                ? 'You and Player 2 won this match' 
                : 'Player 3 and Player 4 won this match'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Determine if the submit button should be disabled based on whether it's a past or future match
  const isSubmitDisabled = () => {
    if (loading) return true;
    
    if (isPastMatch) {
      return !isSet1Valid || !isSet2Valid || (showSet3 && !isSet3Valid) || selectedFriends.length !== 3;
    } else {
      return selectedFriends.length === 0;
    }
  };

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
            ? 'Record a match that already happened. All players will have their ratings updated.'
            : 'Schedule a future match. Invite players you want to play with.'}
        </Text>
        
        {renderTimeSection()}
        {renderPlayerSection()}
        {renderScoreSection()}
        
        <Button
          className="w-full mt-2 mb-10"
          size="lg"
          variant="default"
          onPress={createMatch}
          disabled={isSubmitDisabled()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-primary-foreground font-medium">
              {isPastMatch ? 'Create Match' : 'Schedule Match'}
            </Text>
          )}
        </Button>
      </ScrollView>
      
      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={setSelectedFriends}
        loading={loading}
        maxSelections={isPastMatch ? 3 : undefined}
      />
    </SafeAreaView>
  );
}