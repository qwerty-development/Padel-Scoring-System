import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H1, H3 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

// Match status enum for improved type safety and readability
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
}

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  status: number;
  created_at: string;
  completed_at: string | null;
  start_time: string;
  end_time: string | null;
  winner_team: number | null;
  player1: { id: string; full_name: string | null; email: string };
  player2: { id: string; full_name: string | null; email: string } | null;
  player3: { id: string; full_name: string | null; email: string } | null;
  player4: { id: string; full_name: string | null; email: string } | null;
}

type FilterType = 'all' | 'upcoming' | 'completed' | 'attention';

export default function MatchHistory() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [page, setPage] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const { session } = useAuth();
  const MATCHES_PER_PAGE = 10;

  useEffect(() => {
    if (session?.user?.id) {
      fetchMatches(0);
    }
  }, [session, filter, friendId]);

  const fetchMatches = async (pageIndex: number, shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Base query to get matches
      let query = supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email),
          player2:profiles!player2_id(id, full_name, email),
          player3:profiles!player3_id(id, full_name, email),
          player4:profiles!player4_id(id, full_name, email)
        `);
      
      // If viewing matches with a specific friend
      if (friendId) {
        query = query.or(
          `and(player1_id.eq.${session?.user?.id},or(player2_id.eq.${friendId},player3_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player2_id.eq.${session?.user?.id},or(player1_id.eq.${friendId},player3_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player3_id.eq.${session?.user?.id},or(player1_id.eq.${friendId},player2_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player4_id.eq.${session?.user?.id},or(player1_id.eq.${friendId},player2_id.eq.${friendId},player3_id.eq.${friendId}))`
        );
      } else {
        // All matches where the user is a participant
        query = query.or(
          `player1_id.eq.${session?.user?.id},` +
          `player2_id.eq.${session?.user?.id},` +
          `player3_id.eq.${session?.user?.id},` +
          `player4_id.eq.${session?.user?.id}`
        );
      }
      
      // Order by start time if upcoming filter, otherwise by creation date
      if (filter === 'upcoming') {
        query = query.order('start_time', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      // Apply pagination
      query = query.range(pageIndex * MATCHES_PER_PAGE, (pageIndex + 1) * MATCHES_PER_PAGE - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Process data and apply filtering
      const now = new Date();
      let filteredData = data || [];
      
      // Apply filter on client side
      if (filter !== 'all') {
        filteredData = filteredData.filter(match => {
          const userId = session?.user?.id;
          const isTeam1 = match.player1_id === userId || match.player2_id === userId;
          const startTime = new Date(match.start_time);
          const needsScores = startTime <= now && 
                            (!match.team1_score_set1 || !match.team2_score_set1) && 
                            match.status !== MatchStatus.CANCELLED;
          
          switch (filter) {
            case 'upcoming':
              return startTime > now && match.status === MatchStatus.PENDING;
            case 'completed':
              return match.status === MatchStatus.COMPLETED;
            case 'attention':
              return needsScores || match.status === MatchStatus.NEEDS_CONFIRMATION;
            default:
              return true;
          }
        });
      }

      // Calculate additional properties for each match
      const processedData = filteredData.map(match => {
        const userId = session?.user?.id;
        const isTeam1 = match.player1_id === userId || match.player2_id === userId;
        const startTime = new Date(match.start_time);
        const needsScores = startTime <= now && 
                         (!match.team1_score_set1 || !match.team2_score_set1) && 
                         match.status !== MatchStatus.CANCELLED;
        const isFuture = startTime > now;
        
        let teammate = null;
        let opponents = [];
        
        // Find teammate and opponents
        if (isTeam1) {
          teammate = match.player1_id === userId ? match.player2 : match.player1;
          opponents = [match.player3, match.player4].filter(Boolean);
        } else {
          teammate = match.player3_id === userId ? match.player4 : match.player3;
          opponents = [match.player1, match.player2].filter(Boolean);
        }
        
        // For display, calculate team scores by counting sets
        let team1Sets = 0;
        let team2Sets = 0;
        
        if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) {
          if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
          else if (match.team2_score_set1 > match.team1_score_set1) team2Sets++;
          
          if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
            if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
            else if (match.team2_score_set2 > match.team1_score_set2) team2Sets++;
            
            if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
              if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
              else if (match.team2_score_set3 > match.team1_score_set3) team2Sets++;
            }
          }
        }
        
        const teamWon = (isTeam1 && team1Sets > team2Sets) || (!isTeam1 && team2Sets > team1Sets);
        const isTied = team1Sets === team2Sets;
        
        return {
          ...match,
          isTeam1,
          needsScores,
          isFuture,
          teammate,
          opponents,
          team1Sets,
          team2Sets,
          teamWon,
          isTied
        };
      });

      if (pageIndex === 0) {
        setMatches(processedData);
      } else {
        setMatches(prev => [...prev, ...processedData]);
      }
      
      setHasMoreMatches(filteredData.length === MATCHES_PER_PAGE);
      setPage(pageIndex);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreMatches = () => {
    if (hasMoreMatches && !loading) {
      fetchMatches(page + 1);
    }
  };

  const onRefresh = () => {
    fetchMatches(0, true);
  };

  const renderFilterButtons = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      className="mb-6"
    >
      {(['all', 'upcoming', 'completed', 'attention'] as FilterType[]).map((filterType) => (
        <TouchableOpacity
          key={filterType}
          className={`px-4 py-2 mr-2 rounded-lg ${filter === filterType ? 'bg-primary' : 'bg-card'}`}
          onPress={() => setFilter(filterType)}
        >
          <Text className={`text-center font-medium ${filter === filterType ? 'text-primary-foreground' : 'text-foreground'}`}>
            {filterType === 'all' ? 'All Matches' : 
             filterType === 'upcoming' ? 'Upcoming' : 
             filterType === 'completed' ? 'Completed' :
             'Needs Attention'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMatchCard = (match: any) => {
    // Format the date
    const matchDate = new Date(match.start_time);
    const now = new Date();
    const isToday = matchDate.toDateString() === now.toDateString();
    
    const formattedDate = isToday 
      ? 'Today' 
      : matchDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: matchDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    
    const formattedTime = matchDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Define border color based on status
    let borderColor = '';
    let statusIcon = '';
    let statusText = '';
    
    if (match.isFuture) {
      borderColor = 'border-blue-500';
      statusIcon = 'calendar-outline';
      statusText = 'Upcoming';
    } else if (match.needsScores) {
      borderColor = 'border-amber-500';
      statusIcon = 'alert-circle-outline';
      statusText = 'Needs Scores';
    } else if (match.status === MatchStatus.NEEDS_CONFIRMATION) {
      borderColor = 'border-yellow-500';
      statusIcon = 'help-circle-outline';
      statusText = 'Pending Confirmation';
    } else if (match.status === MatchStatus.COMPLETED) {
      if (match.teamWon) {
        borderColor = 'border-green-500';
        statusIcon = 'checkmark-circle-outline';
        statusText = 'Victory';
      } else if (match.isTied) {
        borderColor = 'border-yellow-500';
        statusIcon = 'remove-circle-outline';
        statusText = 'Tie';
      } else {
        borderColor = 'border-red-500';
        statusIcon = 'close-circle-outline';
        statusText = 'Defeat';
      }
    } else if (match.status === MatchStatus.CANCELLED) {
      borderColor = 'border-gray-500';
      statusIcon = 'close-circle-outline';
      statusText = 'Cancelled';
    }

    return (
      <TouchableOpacity
        key={match.id}
        className={`bg-card rounded-xl p-4 mb-3 border-l-4 ${borderColor}`}
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { 
              matchId: match.id,
              mode: match.needsScores ? 'score-entry' : undefined
            }
          });
        }}
      >
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center">
            <Ionicons name={statusIcon} size={18} color="#888" style={{ marginRight: 6 }} />
            <Text className="text-sm text-muted-foreground">{statusText}</Text>
          </View>
          <Text className="text-xs text-muted-foreground">{formattedDate} {match.isFuture && `• ${formattedTime}`}</Text>
        </View>
        
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1">
            <Text className="font-medium">
              You {match.teammate && `& ${match.teammate.full_name || match.teammate.email.split('@')[0]}`}
            </Text>
          </View>
          
          {match.team1_score_set1 !== null && match.team2_score_set1 !== null ? (
            <View className="flex-row items-center">
              <Text className="text-xl font-bold mr-2">
                {match.isTeam1 ? match.team1Sets : match.team2Sets}
              </Text>
              <Text className="text-muted-foreground">:</Text>
              <Text className="text-xl font-bold ml-2">
                {match.isTeam1 ? match.team2Sets : match.team1Sets}
              </Text>
            </View>
          ) : match.isFuture ? (
            <View className="bg-blue-100 px-2 py-1 rounded-full">
              <Text className="text-xs text-blue-800">Scheduled</Text>
            </View>
          ) : match.needsScores ? (
            <View className="bg-amber-100 px-2 py-1 rounded-full">
              <Text className="text-xs text-amber-800">Add Scores</Text>
            </View>
          ) : null}
          
          <View className="flex-1 items-end">
            <Text className="font-medium text-right">
              {match.opponents.length > 0 
                ? match.opponents.map(p => p?.full_name || p?.email?.split('@')[0] || 'TBD').join(' & ')
                : 'TBD'}
            </Text>
          </View>
        </View>
        
        <View className="flex-row justify-between items-center">
          {match.isFuture ? (
            <Text className="text-sm text-blue-600">
              {getOpenSlotsText(match)}
            </Text>
          ) : match.status === MatchStatus.COMPLETED ? (
            <Text className={`text-sm font-medium ${
              match.teamWon ? 'text-green-500' : (match.isTied ? 'text-yellow-500' : 'text-red-500')
            }`}>
              {match.teamWon ? 'Victory' : (match.isTied ? 'Tie' : 'Defeat')}
            </Text>
          ) : (
            <Text className="text-sm text-muted-foreground">
              {match.needsScores ? 'Tap to add scores' : 'View details'}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={16} color="#888" />
        </View>
      </TouchableOpacity>
    );
  };

  // Helper to check open slots in a match
  const getOpenSlotsText = (match: any) => {
    const openSlots = 4 - [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean).length;
    
    if (openSlots === 0) return 'Full';
    if (openSlots === 1) return '1 open slot';
    return `${openSlots} open slots`;
  };

  const renderEmptyMatches = () => (
    <View className="bg-card rounded-xl p-6 items-center">
      <Ionicons name="tennisball-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">No matches found</Text>
      <Text className="text-muted-foreground text-center mb-4">
        {filter === 'all' 
          ? "You haven't played any matches yet" 
          : filter === 'upcoming'
          ? "You don't have any upcoming matches"
          : filter === 'completed'
          ? "You don't have any completed matches"
          : "No matches need your attention"}
      </Text>
      {filter === 'all' && (
        <Button
          variant="default"
          onPress={() => router.push('/(protected)/(screens)/create-match')}
        >
          <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
          <Text>Create Match</Text>
        </Button>
      )}
    </View>
  );

  if (loading && !refreshing && page === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="p-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScrollEndDrag={() => loadMoreMatches()}
      >
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <H1>{friendId ? 'Matches Together' : 'Match History'}</H1>
        </View>
        
        {renderFilterButtons()}
        
        {matches.length > 0 
          ? matches.map(renderMatchCard)
          : renderEmptyMatches()
        }
        
        {loading && page > 0 && (
          <View className="py-4">
            <ActivityIndicator size="small" color="#fbbf24" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}