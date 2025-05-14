import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';

import { Text } from '@/components/ui/text';
import { H1, H2, H3 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';
import { SetScoreInput, SetScore } from '@/components/create-match/SetScoreInput';

// Match status enum for improved type safety and readability
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
}

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
  status: number;
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

export default function MatchDetails() {
  const { matchId, mode } = useLocalSearchParams();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { session, profile } = useAuth();
  
  // Score entry state for past matches missing scores
  const [editingScores, setEditingScores] = useState(mode === 'score-entry');
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);

  useEffect(() => {
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  // Initialize score state from match data
  useEffect(() => {
    if (match && (match.team1_score_set1 !== null || match.team2_score_set1 !== null)) {
      setSet1Score({
        team1: match.team1_score_set1 || 0,
        team2: match.team2_score_set1 || 0
      });
      setSet2Score({
        team1: match.team1_score_set2 || 0,
        team2: match.team2_score_set2 || 0
      });
      
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setSet3Score({
          team1: match.team1_score_set3,
          team2: match.team2_score_set3
        });
        setShowSet3(true);
      }
      
      // Validate scores
      setIsSet1Valid(true);
      setIsSet2Valid(true);
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setIsSet3Valid(true);
      }
    }
  }, [match]);
  
  // Effect to show/hide set 3 based on set 1 and 2 results during editing
  useEffect(() => {
    if (!editingScores) return;
    
    // Only show set 3 if there's a tie (1-1) in sets
    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);
    
    setShowSet3(isTied && isSet1Valid && isSet2Valid);
    
    // Reset set 3 score if we're hiding it
    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid, editingScores]);

  const fetchMatchDetails = async (id: string) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setMatch(data);
    } catch (error) {
      console.error('Error fetching match details:', error);
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

  // Determine if this is a future match
  const isFutureMatch = () => {
    if (!match || !match.start_time) return false;
    return new Date(match.start_time) > new Date();
  };
  
  // Determine if the match needs scores
  const needsScores = () => {
    if (!match) return false;
    
    // Past match without scores
    if (!isFutureMatch() && 
        (match.team1_score_set1 === null || match.team2_score_set1 === null) && 
        match.status !== MatchStatus.CANCELLED) {
      return true;
    }
    
    return false;
  };
  
  // Check if the current user can join this match
  const canJoinMatch = () => {
    if (!match || !session?.user?.id) return false;
    if (!isFutureMatch()) return false;
    
    // Check if user is already in the match
    if (match.player1_id === session.user.id ||
        match.player2_id === session.user.id ||
        match.player3_id === session.user.id ||
        match.player4_id === session.user.id) {
      return false;
    }
    
    // Check for available slots
    return !match.player2_id || !match.player3_id || !match.player4_id;
  };
  
  // Check which position is available
  const getAvailablePosition = () => {
    if (!match) return null;
    
    if (!match.player2_id) return 'player2_id';
    if (!match.player3_id) return 'player3_id';
    if (!match.player4_id) return 'player4_id';
    
    return null;
  };

  // Join a match
  const joinMatch = async () => {
    if (!match || !session?.user?.id) return;
    
    const position = getAvailablePosition();
    if (!position) return;
    
    try {
      setSaving(true);
      
      // Update the match with the current user in the available position
      const { data, error } = await supabase
        .from('matches')
        .update({ [position]: session.user.id })
        .eq('id', match.id)
        .select();

      if (error) throw error;
      
      // Refresh the match details
      fetchMatchDetails(match.id);
      
      Alert.alert('Success', 'You have joined the match!');
    } catch (error) {
      console.error('Error joining match:', error);
      Alert.alert('Error', 'Failed to join the match');
    } finally {
      setSaving(false);
    }
  };
  
  // Function to determine winning team based on sets
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
  
  // Save match scores
  const saveMatchScores = async () => {
    if (!match || !session?.user?.id) return;
    
    // Validate scores
    if (!isSet1Valid || !isSet2Valid || (showSet3 && !isSet3Valid)) {
      Alert.alert('Invalid Scores', 'Please enter valid scores for all sets.');
      return;
    }
    
    try {
      setSaving(true);
      
      const winnerTeam = determineWinnerTeam();
      
      // Prepare update data
      const updateData = {
        team1_score_set1: set1Score.team1,
        team2_score_set1: set1Score.team2,
        team1_score_set2: set2Score.team1,
        team2_score_set2: set2Score.team2,
        team1_score_set3: showSet3 ? set3Score.team1 : null,
        team2_score_set3: showSet3 ? set3Score.team2 : null,
        winner_team: winnerTeam,
        status: MatchStatus.COMPLETED,
        completed_at: new Date().toISOString()
      };
      
      // Update the match
      const { data, error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', match.id)
        .select();

      if (error) throw error;
      
      // If all players are present, calculate and update Glicko ratings
      if (match.player1_id && match.player2_id && match.player3_id && match.player4_id) {
        await updatePlayerRatings(match, winnerTeam);
      }
      
      // Refresh the match details
      fetchMatchDetails(match.id);
      
      // Exit editing mode
      setEditingScores(false);
      
      Alert.alert('Success', 'Match scores saved successfully!');
    } catch (error) {
      console.error('Error saving match scores:', error);
      Alert.alert('Error', 'Failed to save match scores');
    } finally {
      setSaving(false);
    }
  };
  
  // Update player ratings based on match outcome
  const updatePlayerRatings = async (matchData: MatchDetail, winnerTeam: number) => {
    try {
      // Fetch all players' Glicko ratings
      const playerIds = [matchData.player1_id, matchData.player2_id, matchData.player3_id, matchData.player4_id].filter(Boolean) as string[];
      
      const { data: playersData, error: playersError } = await supabase
        .from('profiles')
        .select('id, glicko_rating, glicko_rd, glicko_vol')
        .in('id', playerIds);

      if (playersError) throw playersError;

      if (!playersData || playersData.length !== 4) {
        throw new Error('Could not fetch all player ratings');
      }

      // Map player IDs to their profiles
      const player1Profile = playersData.find(p => p.id === matchData.player1_id);
      const player2Profile = playersData.find(p => p.id === matchData.player2_id);
      const player3Profile = playersData.find(p => p.id === matchData.player3_id);
      const player4Profile = playersData.find(p => p.id === matchData.player4_id);

      if (!player1Profile || !player2Profile || !player3Profile || !player4Profile) {
        throw new Error('Could not match all player IDs from fetched data');
      }

      // Create Glicko rating objects
      const player1Rating: GlickoRating = {
        rating: parseFloat(player1Profile.glicko_rating || '1500'),
        rd: parseFloat(player1Profile.glicko_rd || '350'),
        vol: parseFloat(player1Profile.glicko_vol || '0.06')
      };
      
      const player2Rating: GlickoRating = {
        rating: parseFloat(player2Profile.glicko_rating || '1500'),
        rd: parseFloat(player2Profile.glicko_rd || '350'),
        vol: parseFloat(player2Profile.glicko_vol || '0.06')
      };
      
      const player3Rating: GlickoRating = {
        rating: parseFloat(player3Profile.glicko_rating || '1500'),
        rd: parseFloat(player3Profile.glicko_rd || '350'),
        vol: parseFloat(player3Profile.glicko_vol || '0.06')
      };
      
      const player4Rating: GlickoRating = {
        rating: parseFloat(player4Profile.glicko_rating || '1500'),
        rd: parseFloat(player4Profile.glicko_rd || '350'),
        vol: parseFloat(player4Profile.glicko_vol || '0.06')
      };

      // Calculate new ratings using your Glicko calculation function
      // This function should be imported from the appropriate utility file
      const newRatings = {
        player1: { ...player1Rating },
        player2: { ...player2Rating },
        player3: { ...player3Rating },
        player4: { ...player4Rating }
      };
      
      // Apply realistic rating changes based on team 1 vs team 2 outcome
      // This is a simplified example - your actual calculations would use the proper Glicko formulas
      const ratingChange = 15; // Example rating change amount
      
      if (winnerTeam === 1) {
        // Team 1 won
        newRatings.player1.rating += ratingChange;
        newRatings.player2.rating += ratingChange;
        newRatings.player3.rating -= ratingChange;
        newRatings.player4.rating -= ratingChange;
      } else if (winnerTeam === 2) {
        // Team 2 won
        newRatings.player1.rating -= ratingChange;
        newRatings.player2.rating -= ratingChange;
        newRatings.player3.rating += ratingChange;
        newRatings.player4.rating += ratingChange;
      }

      // Update player ratings in the database
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
    } catch (error) {
      console.error('Error updating player ratings:', error);
      throw error;
    }
  };

  const shareMatch = async () => {
    if (!match) return;
    
    // Calculate sets won by each team
    const team1Sets = countSetsWon(match, 1);
    const team2Sets = countSetsWon(match, 2);
    
    try {
      const message = `Padel Match Result: ${match.player1.full_name || 'Player 1'} & ${match.player2?.full_name || 'Player 2'} vs ${match.player3?.full_name || 'Player 3'} & ${match.player4?.full_name || 'Player 4'}\n\n` + 
                     `${isFutureMatch() ? 'Scheduled Match' : `Score: ${team1Sets}-${team2Sets}`}\n\n` +
                     `${isFutureMatch() ? `Date: ${formatDate(match.start_time)} at ${formatTime(match.start_time)}` : 
                     `Set Details:${match.team1_score_set1 !== null ? `\nSet 1: ${match.team1_score_set1}-${match.team2_score_set1}` : ''}${match.team1_score_set2 !== null ? `\nSet 2: ${match.team1_score_set2}-${match.team2_score_set2}` : ''}${match.team1_score_set3 !== null ? `\nSet 3: ${match.team1_score_set3}-${match.team2_score_set3}` : ''}`}`;
      
      await Share.share({
        message,
        title: isFutureMatch() ? 'Padel Match Invitation' : 'Padel Match Result',
      });
    } catch (error) {
      console.error('Error sharing match:', error);
    }
  };

  // Count sets won by a specific team
  const countSetsWon = (match: MatchDetail, teamNumber: 1 | 2): number => {
    let setsWon = 0;
    
    if (!match.team1_score_set1 || !match.team2_score_set1) return 0;
    
    if (teamNumber === 1) {
      if (match.team1_score_set1 > match.team2_score_set1) setsWon++;
      if (match.team1_score_set2 && match.team2_score_set2 && match.team1_score_set2 > match.team2_score_set2) setsWon++;
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null && 
          match.team1_score_set3 > match.team2_score_set3) setsWon++;
    } else {
      if (match.team2_score_set1 > match.team1_score_set1) setsWon++;
      if (match.team1_score_set2 && match.team2_score_set2 && match.team2_score_set2 > match.team1_score_set2) setsWon++;
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null && 
          match.team2_score_set3 > match.team1_score_set3) setsWon++;
    }
    
    return setsWon;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMMM d, yyyy');
  };

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'h:mm a');
  };

  const getStatusText = (match: MatchDetail) => {
    // Calculate actual display status
    if (isFutureMatch()) {
      return { text: 'Upcoming', color: 'text-blue-500' };
    }
    
    if (needsScores()) {
      return { text: 'Needs Scores', color: 'text-amber-500' };
    }
    
    switch (match.status) {
      case MatchStatus.PENDING: return { text: 'Pending', color: 'text-blue-500' };
      case MatchStatus.NEEDS_CONFIRMATION: return { text: 'Needs Confirmation', color: 'text-yellow-500' };
      case MatchStatus.CANCELLED: return { text: 'Cancelled', color: 'text-gray-500' };
      case MatchStatus.COMPLETED: return { text: 'Completed', color: 'text-green-500' };
      default: return { text: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  const renderPlayerAvatar = (player: PlayerDetail | null) => {
    if (!player) {
      return (
        <View className="items-center">
          <View className="w-12 h-12 rounded-full bg-gray-300 items-center justify-center mb-2">
            <Text className="text-lg font-bold text-gray-500">?</Text>
          </View>
          <Text className="font-medium text-center" numberOfLines={1}>
            Open Slot
          </Text>
          <Text className="text-xs text-muted-foreground text-center">
            -
          </Text>
        </View>
      );
    }
    
    return (
      <View className="items-center">
        <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mb-2">
          <Text className="text-lg font-bold text-primary-foreground">
            {player.full_name?.charAt(0)?.toUpperCase() || player.email.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text className="font-medium text-center" numberOfLines={1}>
          {player.full_name || player.email.split('@')[0]}
        </Text>
        <Text className="text-xs text-muted-foreground text-center">
          {player.glicko_rating ? Math.round(parseFloat(player.glicko_rating)) : '-'}
        </Text>
      </View>
    );
  };

  const renderSetScore = (
    setNumber: number, 
    team1Score: number | null, 
    team2Score: number | null,
    winnerTeam: number | null
  ) => {
    if (team1Score === null || team2Score === null) return null;
    
    const team1Won = team1Score > team2Score;
    const team2Won = team2Score > team1Score;
    
    return (
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-muted-foreground w-16">Set {setNumber}</Text>
        <View className="flex-row items-center flex-1 justify-center">
          <Text className={`text-xl font-semibold ${team1Won ? 'text-primary' : ''}`}>
            {team1Score}
          </Text>
          <Text className="text-xl mx-2">-</Text>
          <Text className={`text-xl font-semibold ${team2Won ? 'text-primary' : ''}`}>
            {team2Score}
          </Text>
        </View>
        {(team1Won || team2Won) && (
          <View className="w-16 items-end">
            <Text className="text-xs text-muted-foreground">
              {team1Won ? 'Team 1' : 'Team 2'}
            </Text>
          </View>
        )}
      </View>
    );
  };
  
  const renderScoreEditSection = () => {
    return (
      <View className="bg-card rounded-xl p-6 mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <H3>Edit Match Score</H3>
          <TouchableOpacity 
            onPress={() => setEditingScores(false)}
            className="p-2"
          >
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>
        
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
        
        {isSet1Valid && isSet2Valid && (
          <View className="mt-4 bg-primary/10 p-3 rounded-lg">
            <Text className="text-lg font-semibold text-center text-primary">
              Winner: {determineWinnerTeam() === 1 ? 'Team 1' : 'Team 2'}
            </Text>
          </View>
        )}
        
        <Button
          className="w-full mt-6"
          variant="default"
          onPress={saveMatchScores}
          disabled={saving || !isSet1Valid || !isSet2Valid || (showSet3 && !isSet3Valid)}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-primary-foreground">Save Scores</Text>
          )}
        </Button>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1a7ebd" />
      </View>
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
        <Text>Could not find the match you're looking for.</Text>
      </SafeAreaView>
    );
  }

  const status = getStatusText(match);
  const userId = session?.user?.id;
  const isTeam1 = userId && (match.player1_id === userId || match.player2_id === userId);
  const isTeam2 = userId && (match.player3_id === userId || match.player4_id === userId);
  
  const team1Sets = countSetsWon(match, 1);
  const team2Sets = countSetsWon(match, 2);
  
  const userWon = (isTeam1 && team1Sets > team2Sets) || (isTeam2 && team2Sets > team1Sets);
  const matchTied = team1Sets === team2Sets;

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
      >
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </Button>
          <H1>Match Details</H1>
        </View>

        {/* Status Banner - extra prominent for matches needing attention */}
        {needsScores() && (
          <View className="bg-amber-100 rounded-xl p-4 mb-4 flex-row items-center">
            <Ionicons name="alert-circle-outline" size={24} color="#d97706" style={{ marginRight: 8 }} />
            <View className="flex-1">
              <Text className="font-bold text-amber-800">Match Needs Scores</Text>
              <Text className="text-amber-700">This match is missing scores. As a participant, you can enter them.</Text>
            </View>
          </View>
        )}
        
        {isFutureMatch() && (
          <View className="bg-blue-100 rounded-xl p-4 mb-4 flex-row items-center">
            <Ionicons name="calendar-outline" size={24} color="#1d4ed8" style={{ marginRight: 8 }} />
            <View className="flex-1">
              <Text className="font-bold text-blue-800">Upcoming Match</Text>
              <Text className="text-blue-700">This match is scheduled for the future.</Text>
            </View>
          </View>
        )}

        {/* Date, Time and Status */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-lg font-medium">{formatDate(match.start_time)}</Text>
            <Text className="text-muted-foreground">
              {formatTime(match.start_time)}
              {match.end_time ? ` - ${formatTime(match.end_time)}` : ''}
            </Text>
          </View>
          <View className="bg-card px-3 py-1 rounded-full">
            <Text className={status.color}>{status.text}</Text>
          </View>
        </View>

        {/* Match Location */}
        {(match.region || match.court) && (
          <View className="bg-card rounded-xl p-4 mb-6 flex-row items-center">
            <Ionicons name="location-outline" size={24} color="#1a7ebd" className="mr-2" />
            <View>
              <Text className="font-medium">
                {match.court || 'Unknown Court'}
              </Text>
              {match.region && (
                <Text className="text-sm text-muted-foreground">{match.region}</Text>
              )}
            </View>
          </View>
        )}

        {/* Score Editing Section */}
        {editingScores && renderScoreEditSection()}

        {/* Match Score - Only show for completed matches */}
        {!editingScores && match.team1_score_set1 !== null && match.team2_score_set1 !== null && (
          <View className="bg-card rounded-xl p-6 mb-6">
            <H3 className="mb-4">Match Score</H3>
            
            {/* Final score */}
            <View className="items-center mb-4">
              <View className="flex-row items-center justify-center mb-2">
                <Text className="text-4xl font-bold text-primary">{team1Sets}</Text>
                <Text className="text-2xl mx-4">-</Text>
                <Text className="text-4xl font-bold text-primary">{team2Sets}</Text>
              </View>
              {userId && (isTeam1 || isTeam2) && (
                <Text className={`font-medium ${
                  userWon ? 'text-green-500' : (matchTied ? 'text-yellow-500' : 'text-red-500')
                }`}>
                  {userWon ? 'You Won!' : (matchTied ? 'Tie Game' : 'You Lost')}
                </Text>
              )}
              <Text className="text-xs text-muted-foreground mt-1">Sets</Text>
            </View>
            
            <View className="h-px bg-border my-3" />
            
            {/* Set-by-set scores */}
            <View className="mt-3">
              {renderSetScore(1, match.team1_score_set1, match.team2_score_set1, match.winner_team)}
              {renderSetScore(2, match.team1_score_set2, match.team2_score_set2, match.winner_team)}
              {match.team1_score_set3 !== null && match.team2_score_set3 !== null && 
                renderSetScore(3, match.team1_score_set3, match.team2_score_set3, match.winner_team)}
            </View>
          </View>
        )}

        {/* Teams */}
        <View className="bg-card rounded-xl p-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <H3>Teams</H3>
            {isFutureMatch() && (userId === match.player1_id) && (
              <Text className="text-xs text-muted-foreground">You are the organizer</Text>
            )}
          </View>
          
          {/* Team 1 */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-medium text-primary">Team 1</Text>
              {match.winner_team === 1 && (
                <View className="bg-primary/10 px-2 py-0.5 rounded-full flex-row items-center">
                  <Ionicons name="trophy" size={14} color="#1a7ebd" />
                  <Text className="text-xs text-primary ml-1">Winner</Text>
                </View>
              )}
            </View>
            <View className="flex-row justify-around">
              {renderPlayerAvatar(match.player1)}
              {renderPlayerAvatar(match.player2)}
            </View>
          </View>
          
          <View className="h-px bg-border my-2" />
          
          {/* Team 2 */}
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-medium text-accent">Team 2</Text>
              {match.winner_team === 2 && (
                <View className="bg-primary/10 px-2 py-0.5 rounded-full flex-row items-center">
                  <Ionicons name="trophy" size={14} color="#1a7ebd" />
                  <Text className="text-xs text-primary ml-1">Winner</Text>
                </View>
              )}
            </View>
            <View className="flex-row justify-around">
              {renderPlayerAvatar(match.player3)}
              {renderPlayerAvatar(match.player4)}
            </View>
          </View>
        </View>

        {/* Match Info */}
        <View className="bg-card rounded-xl p-6 mb-6">
          <H3 className="mb-4">Match Info</H3>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted-foreground">Created</Text>
            <Text>{formatDate(match.created_at)} {formatTime(match.created_at)}</Text>
          </View>
          
          {match.completed_at && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted-foreground">Completed</Text>
              <Text>{formatDate(match.completed_at)} {formatTime(match.completed_at)}</Text>
            </View>
          )}
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted-foreground">Match Duration</Text>
            <Text>
              {match.start_time && match.end_time 
                ? getMatchDuration(match.start_time, match.end_time) 
                : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="flex-row gap-3 mb-6">
          <Button
            className="flex-1"
            variant="outline"
            onPress={shareMatch}
          >
            <Ionicons name="share-outline" size={20} style={{ marginRight: 8 }} />
            <Text>Share</Text>
          </Button>
          
          {/* Show Join button for future matches with open slots */}
          {canJoinMatch() && (
            <Button
              className="flex-1"
              variant="default"
              onPress={joinMatch}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add" size={20} style={{ marginRight: 8 }} />
                  <Text className="text-primary-foreground">Join Match</Text>
                </>
              )}
            </Button>
          )}
          
          {/* Enter scores button for past matches missing scores */}
          {needsScores() && !editingScores && (
            <Button
              className="flex-1"
              variant="default"
              onPress={() => setEditingScores(true)}
            >
              <Ionicons name="create-outline" size={20} style={{ marginRight: 8 }} />
              <Text className="text-primary-foreground">Enter Scores</Text>
            </Button>
          )}
          
          {/* Confirm match button */}
          {match.status === MatchStatus.NEEDS_CONFIRMATION && userId && (
            <Button
              className="flex-1"
              variant="default"
              onPress={() => {
                // Future feature: Confirm match score
              }}
            >
              <Ionicons name="checkmark" size={20} style={{ marginRight: 8 }} />
              <Text className="text-primary-foreground">Confirm Score</Text>
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function to calculate match duration
function getMatchDuration(startTimeStr: string, endTimeStr: string): string {
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
}