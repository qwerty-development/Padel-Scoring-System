import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
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
  region: string | null;
  court: string | null;
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
  
  // Store all matches (unfiltered)
  const [allMatches, setAllMatches] = useState<any[]>([]);
  
  // Store filtered matches for each tab separately
  const [filteredMatches, setFilteredMatches] = useState<{
    all: any[];
    upcoming: any[];
    completed: any[];
    attention: any[];
  }>({
    all: [],
    upcoming: [],
    completed: [],
    attention: []
  });
  
  const [page, setPage] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const { session } = useAuth();
  const MATCHES_PER_PAGE = 10;

  useEffect(() => {
    if (session?.user?.id) {
      fetchMatches();
    }
  }, [session, friendId]);

  // Apply filter locally when changing tabs
  useEffect(() => {
    applyFilter();
  }, [filter, allMatches]);

  const applyFilter = () => {
    const now = new Date();
    
    const filtered = {
      all: allMatches,
      upcoming: allMatches.filter(match => 
        match.isFuture && match.status === MatchStatus.PENDING
      ),
      completed: allMatches.filter(match => 
        match.status === MatchStatus.COMPLETED
      ),
      attention: allMatches.filter(match => 
        match.needsScores || match.status === MatchStatus.NEEDS_CONFIRMATION
      )
    };
    
    setFilteredMatches(filtered);
  };

  const fetchMatches = async (shouldRefresh = false) => {
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
      
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Process data for all filters at once
      const now = new Date();
      const processedData = (data || []).map(match => {
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
          isTied,
          userIsPlayer1: match.player1_id === userId,
          userIsPlayer2: match.player2_id === userId,
          userIsPlayer3: match.player3_id === userId,
          userIsPlayer4: match.player4_id === userId
        };
      });

      setAllMatches(processedData);
      
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchMatches(true);
  };

  // Filter switching without reloading
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  const renderFilterButtons = () => (
    <View className="flex-row border-b border-border">
      {(['all', 'upcoming', 'completed', 'attention'] as FilterType[]).map((filterType) => (
        <TouchableOpacity
          key={filterType}
          className={`flex-1 py-3 ${filter === filterType ? 'border-b-2 border-primary' : ''}`}
          onPress={() => handleFilterChange(filterType)}
        >
          <Text className={`text-center font-medium ${filter === filterType ? 'text-primary' : 'text-muted-foreground'}`}>
            {filterType === 'all' ? 'All' : 
             filterType === 'upcoming' ? 'Upcoming' : 
             filterType === 'completed' ? 'Completed' :
             'Attention'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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

  // Get match type style
  const getMatchStyle = () => {
    if (match.isFuture) {
      return {
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        iconName: 'calendar-outline',
        iconColor: '#1d4ed8'
      };
    } else if (match.needsScores) {
      return {
        bgColor: 'bg-amber-50 dark:bg-amber-900/30',
        iconName: 'alert-circle-outline',
        iconColor: '#d97706'
      };
    } else if (match.status === MatchStatus.NEEDS_CONFIRMATION) {
      return {
        bgColor: 'bg-amber-50 dark:bg-amber-900/30',
        iconName: 'help-circle-outline',
        iconColor: '#d97706'
      };
    } else if (match.status === MatchStatus.COMPLETED) {
      if (match.teamWon) {
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/30',
          iconName: 'trophy-outline',
          iconColor: '#059669'
        };
      } else if (match.isTied) {
        return {
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
          iconName: 'remove-circle-outline',
          iconColor: '#d97706'
        };
      } else {
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/30',
          iconName: 'close-circle-outline',
          iconColor: '#dc2626'
        };
      }
    } else {
      return {
        bgColor: 'bg-card',
        iconName: 'help-outline',
        iconColor: '#6b7280'
      };
    }
  };
  
  const style = getMatchStyle();

  return (
    <TouchableOpacity
      key={match.id}
      className={`mb-5 rounded-xl border border-border/30 overflow-hidden`}
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
      {/* Status header - Now contains time on left and location on right */}
      <View className={`px-4 py-2 bg-primary/30`}>
        <View className="flex-row items-center justify-between">
          {/* Time on left (replaced status) */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={18} color={style.iconColor} style={{ marginRight: 6 }} />
            <Text className="font-medium">{formattedTime}</Text>
          </View>
          
          {/* Location on right */}
          {(match.court || match.region) ? (
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={16} color="#1a7ebd" style={{ marginRight: 4 }} />
              <Text className="text-sm text-muted-foreground">
                {match.court || match.region}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">
              {formattedDate}
            </Text>
          )}
        </View>
      </View>
      
      {/* Match content */}
      <View className="p-5 bg-card dark:bg-card/90">
        {/* Teams section */}
        <View className="flex-row justify-between items-start mb-4">
          {/* Team 1 (Your team) */}
          <View className="flex-1">
            
            {/* Player 1 */}
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2">
                <Text className="text-xs font-bold text-white">
                  {match.userIsPlayer1 ? 'Y' : 
                   match.player1?.full_name?.charAt(0)?.toUpperCase() || 
                   match.player1?.email?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text className={`${match.userIsPlayer1 ? 'font-extrabold text-primary' : ''}`}>
                {match.userIsPlayer1 ? 'You' : match.player1?.full_name || match.player1?.email?.split('@')[0]}
              </Text>
            </View>
            
            {/* Player 2 */}
            {match.player2 ? (
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-primary/80 items-center justify-center mr-2">
                  <Text className="text-xs font-bold text-white">
                    {match.userIsPlayer2 ? 'Y' : 
                     match.player2?.full_name?.charAt(0)?.toUpperCase() || 
                     match.player2?.email?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text className={`${match.userIsPlayer2 ? 'font-extrabold text-primary' : ''}`}>
                  {match.userIsPlayer2 ? 'You' : match.player2?.full_name || match.player2?.email?.split('@')[0]}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center opacity-50">
                <View className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center mr-2">
                  <Text className="text-xs font-bold text-white">?</Text>
                </View>
                <Text className="text-muted-foreground">Empty</Text>
              </View>
            )}
          </View>
          
          {/* Score */}
          {match.team1_score_set1 !== null && match.team2_score_set1 !== null ? (
            <View className="items-center px-3">
              <Text className="text-xs text-muted-foreground mb-1">Score</Text>
              <View className="flex-row items-center">
                <Text className={`text-2xl font-bold ${match.teamWon && match.isTeam1 ? 'text-green-600 dark:text-green-400' : !match.teamWon && !match.isTeam1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {match.team1Sets}
                </Text>
                <Text className="text-xl mx-1">-</Text>
                <Text className={`text-2xl font-bold ${match.teamWon && !match.isTeam1 ? 'text-green-600 dark:text-green-400' : !match.teamWon && match.isTeam1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {match.team2Sets}
                </Text>
              </View>
            </View>
          ) : (
            <View className="items-center px-3">
              <Text className="text-base text-muted-foreground font-medium">vs</Text>
            </View>
          )}
          
          {/* Team 2 (Opponents) */}
          <View className="flex-1 items-end">
            
            {/* Player 3 */}
            {match.player3 ? (
              <View className="flex-row items-center justify-end mb-2">
                <Text className={`${match.userIsPlayer3 ? 'font-extrabold text-indigo-500' : ''} text-right`}>
                  {match.userIsPlayer3 ? 'You' : match.player3?.full_name || match.player3?.email?.split('@')[0]}
                </Text>
                <View className="w-8 h-8 rounded-full bg-indigo-500 items-center justify-center ml-2">
                  <Text className="text-xs font-bold text-white">
                    {match.userIsPlayer3 ? 'Y' : 
                     match.player3?.full_name?.charAt(0)?.toUpperCase() || 
                     match.player3?.email?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-end mb-2 opacity-50">
                <Text className="text-muted-foreground">Empty</Text>
                <View className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center ml-2">
                  <Text className="text-xs font-bold text-white">?</Text>
                </View>
              </View>
            )}
            
            {/* Player 4 */}
            {match.player4 ? (
              <View className="flex-row items-center justify-end">
                <Text className={`${match.userIsPlayer4 ? 'font-extrabold text-indigo-500' : ''} text-right`}>
                  {match.userIsPlayer4 ? 'You' : match.player4?.full_name || match.player4?.email?.split('@')[0]}
                </Text>
                <View className="w-8 h-8 rounded-full bg-indigo-500/80 items-center justify-center ml-2">
                  <Text className="text-xs font-bold text-white">
                    {match.userIsPlayer4 ? 'Y' : 
                     match.player4?.full_name?.charAt(0)?.toUpperCase() || 
                     match.player4?.email?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-end opacity-50">
                <Text className="text-muted-foreground">Empty</Text>
                <View className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center ml-2">
                  <Text className="text-xs font-bold text-white">?</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        
        
        {/* New: Match result for completed matches at bottom of card */}
        {match.status === MatchStatus.COMPLETED && (
          <View className={`p-3 rounded-lg flex-row items-center justify-center mt-3
            ${match.teamWon 
              ? 'bg-green-50 dark:bg-green-900/30' 
              : 'bg-red-50 dark:bg-red-900/30'}`
            }
          >
            <Ionicons 
              name={match.teamWon ? "trophy" : "sad-outline"} 
              size={20} 
              color={match.teamWon ? "#059669" : "#dc2626"} 
              style={{ marginRight: 8 }} 
            />
            <Text className={`font-medium ${
              match.teamWon 
                ? 'text-green-800 dark:text-green-300' 
                : 'text-red-800 dark:text-red-300'}`
              }
            >
              {match.teamWon ? 'Victory' : 'Defeat'}
            </Text>
          </View>
        )}
        
        {/* Bottom row: Actions for non-completed matches */}
        {match.status !== MatchStatus.COMPLETED && (
          <View className="flex-row justify-between items-center mt-3">
            {match.isFuture ? (
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={14} color="#888" style={{ marginRight: 4 }} />
                <Text className="text-sm text-blue-600 dark:text-blue-400">
                  {getOpenSlotsText(match)}
                </Text>
              </View>
            ) : match.needsScores ? (
              <View className="flex-row items-center">
                <Ionicons name="create-outline" size={14} color="#d97706" style={{ marginRight: 4 }} />
                <Text className="text-sm text-amber-600 dark:text-amber-400">
                  Tap to add scores
                </Text>
              </View>
            ) : null}
            
            <View className="flex-row items-center">
              <Text className="text-sm text-muted-foreground mr-1">View details</Text>
              <Ionicons name="chevron-forward" size={14} color="#888" />
            </View>
          </View>
        )}
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
    <View className="bg-card dark:bg-card/90 rounded-xl p-6 items-center border border-border/30 m-6">
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
      <Button
        variant="default"
        onPress={() => router.push('/(protected)/(screens)/create-match')}
      >
        <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
        <Text>Create Match</Text>
      </Button>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1a7ebd" />
      </View>
    );
  }

  // Get the current matches to display based on filter
  const currentMatches = filteredMatches[filter];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Tab Navigation */}
      {renderFilterButtons()}
      
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {currentMatches && currentMatches.length > 0 
          ? currentMatches.map(renderMatchCard)
          : renderEmptyMatches()
        }
        
        {/* Bottom padding */}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}