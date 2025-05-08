import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';

import { Text } from '@/components/ui/text';
import { H1, H2, H3 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

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
  player2_id: string;
  player3_id: string;
  player4_id: string;
  status: number;
  created_at: string;
  completed_at: string | null;
  team1_score_set1: number;
  team2_score_set1: number;
  team1_score_set2: number;
  team2_score_set2: number;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number;
  start_time: string | null;
  end_time: string | null;
  region: string | null;
  court: string | null;
  validation_deadline: string | null;
  player1: PlayerDetail;
  player2: PlayerDetail;
  player3: PlayerDetail;
  player4: PlayerDetail;
}

export default function MatchDetails() {
  const { matchId } = useLocalSearchParams();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

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

  const shareMatch = async () => {
    if (!match) return;
    
    // Calculate sets won by each team
    const team1Sets = countSetsWon(match, 1);
    const team2Sets = countSetsWon(match, 2);
    
    try {
      const message = `Padel Match Result: ${match.player1.full_name || 'Player 1'} & ${match.player2.full_name || 'Player 2'} vs ${match.player3.full_name || 'Player 3'} & ${match.player4.full_name || 'Player 4'}\n\nScore: ${team1Sets}-${team2Sets}\n\nSet Details:\nSet 1: ${match.team1_score_set1}-${match.team2_score_set1}\nSet 2: ${match.team1_score_set2}-${match.team2_score_set2}${match.team1_score_set3 !== null ? `\nSet 3: ${match.team1_score_set3}-${match.team2_score_set3}` : ''}`;
      
      await Share.share({
        message,
        title: 'Padel Match Result',
      });
    } catch (error) {
      console.error('Error sharing match:', error);
    }
  };

  // Count sets won by a specific team
  const countSetsWon = (match: MatchDetail, teamNumber: 1 | 2): number => {
    let setsWon = 0;
    
    if (teamNumber === 1) {
      if (match.team1_score_set1 > match.team2_score_set1) setsWon++;
      if (match.team1_score_set2 > match.team2_score_set2) setsWon++;
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null && 
          match.team1_score_set3 > match.team2_score_set3) setsWon++;
    } else {
      if (match.team2_score_set1 > match.team1_score_set1) setsWon++;
      if (match.team2_score_set2 > match.team1_score_set2) setsWon++;
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

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return { text: 'Disputed', color: 'text-red-500' };
      case 2: return { text: 'Pending Confirmation', color: 'text-yellow-500' };
      case 3: return { text: 'Cancelled', color: 'text-gray-500' };
      case 4: return { text: 'Completed', color: 'text-green-500' };
      default: return { text: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  const renderPlayerAvatar = (player: PlayerDetail) => (
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

  const renderSetScore = (
    setNumber: number, 
    team1Score: number | null, 
    team2Score: number | null,
    winnerTeam: number
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

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
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
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <H1>Match Not Found</H1>
        </View>
        <Text>Could not find the match you're looking for.</Text>
      </SafeAreaView>
    );
  }

  const status = getStatusText(match.status);
  const userId = session?.user?.id;
  const isTeam1 = match.player1_id === userId || match.player2_id === userId;
  const isTeam2 = match.player3_id === userId || match.player4_id === userId;
  
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
            colors={["#fbbf24"]}
            tintColor="#fbbf24"
          />
        }
      >
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <H1>Match Details</H1>
        </View>

        {/* Date, Time and Status */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-lg font-medium">{formatDate(match.start_time || match.created_at)}</Text>
            <Text className="text-muted-foreground">
              {formatTime(match.start_time || match.created_at)}
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
            <Ionicons name="location-outline" size={24} color="#fbbf24" className="mr-2" />
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

        {/* Match Score */}
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

        {/* Teams */}
        <View className="bg-card rounded-xl p-6 mb-6">
          <H3 className="mb-4">Teams</H3>
          
          {/* Team 1 */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-medium text-primary">Team 1</Text>
              {match.winner_team === 1 && (
                <View className="bg-primary/10 px-2 py-0.5 rounded-full flex-row items-center">
                  <Ionicons name="trophy" size={14} color="#fbbf24" />
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
                  <Ionicons name="trophy" size={14} color="#fbbf24" />
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
          
          {match.status === 2 && userId && (
            <Button
              className="flex-1"
              variant="default"
              onPress={() => {
                // Future feature: Confirm match score
              }}
            >
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