import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H1, H3 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  team1_score: number;
  team2_score: number;
  status: number;
  created_at: string;
  completed_at: string | null;
  player1: { id: string; full_name: string | null; email: string };
  player2: { id: string; full_name: string | null; email: string };
  player3: { id: string; full_name: string | null; email: string };
  player4: { id: string; full_name: string | null; email: string };
}

type FilterType = 'all' | 'wins' | 'losses';

export default function MatchHistory() {
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
  }, [session, filter]);

  const fetchMatches = async (pageIndex: number, shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      let query = supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email),
          player2:profiles!player2_id(id, full_name, email),
          player3:profiles!player3_id(id, full_name, email),
          player4:profiles!player4_id(id, full_name, email)
        `)
        .or(`player1_id.eq.${session?.user?.id},player2_id.eq.${session?.user?.id},player3_id.eq.${session?.user?.id},player4_id.eq.${session?.user?.id}`)
        .order('created_at', { ascending: false })
        .range(pageIndex * MATCHES_PER_PAGE, (pageIndex + 1) * MATCHES_PER_PAGE - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Apply filter on client side (could be done via query too)
      let filteredData = data || [];
      if (filter !== 'all') {
        filteredData = filteredData.filter(match => {
          const userId = session?.user?.id;
          const isTeam1 = match.player1_id === userId || match.player2_id === userId;
          const teamWon = (isTeam1 && match.team1_score > match.team2_score) || 
                        (!isTeam1 && match.team2_score > match.team1_score);
          
          if (filter === 'wins') return teamWon;
          if (filter === 'losses') return !teamWon && match.team1_score !== match.team2_score;
          return true;
        });
      }

      if (pageIndex === 0) {
        setMatches(filteredData);
      } else {
        setMatches(prev => [...prev, ...filteredData]);
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
    <View className="flex-row gap-2 mb-6">
      {(['all', 'wins', 'losses'] as FilterType[]).map((filterType) => (
        <TouchableOpacity
          key={filterType}
          className={`flex-1 py-2 rounded-lg ${filter === filterType ? 'bg-primary' : 'bg-card'}`}
          onPress={() => setFilter(filterType)}
        >
          <Text className={`text-center font-medium ${filter === filterType ? 'text-primary-foreground' : 'text-foreground'}`}>
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMatchCard = (match: MatchData) => {
    const userId = session?.user?.id;
    const isTeam1 = match.player1_id === userId || match.player2_id === userId;
    const teamWon = (isTeam1 && match.team1_score > match.team2_score) || 
                    (!isTeam1 && match.team2_score > match.team1_score);
    const isTied = match.team1_score === match.team2_score;
    
    // Your team's players
    const teammate = isTeam1 
      ? (match.player1_id === userId ? match.player2 : match.player1)
      : (match.player3_id === userId ? match.player4 : match.player3);
    
    // Opponent team's players
    const opponents = isTeam1 
      ? [match.player3, match.player4]
      : [match.player1, match.player2];

    // Format the date
    const matchDate = new Date(match.created_at);
    const formattedDate = matchDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <TouchableOpacity
        key={match.id}
        className={`bg-card rounded-xl p-4 mb-3 border-l-4 ${
          teamWon ? 'border-green-500' : (isTied ? 'border-yellow-500' : 'border-red-500')
        }`}
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { matchId: match.id }
          });
        }}
      >
        <View className="mb-3">
          <Text className="text-xs text-muted-foreground">{formattedDate}</Text>
        </View>
        
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1">
            <Text className="font-medium">
              You & {teammate.full_name || teammate.email.split('@')[0]}
            </Text>
          </View>
          
          <View className="flex-row items-center">
            <Text className="text-xl font-bold mr-2">
              {isTeam1 ? match.team1_score : match.team2_score}
            </Text>
            <Text className="text-muted-foreground">:</Text>
            <Text className="text-xl font-bold ml-2">
              {isTeam1 ? match.team2_score : match.team1_score}
            </Text>
          </View>
          
          <View className="flex-1 items-end">
            <Text className="font-medium text-right">
              {opponents[0].full_name || opponents[0].email.split('@')[0]} & {opponents[1].full_name || opponents[1].email.split('@')[0]}
            </Text>
          </View>
        </View>
        
        <View className="flex-row justify-between items-center">
          <Text className={`text-sm font-medium ${
            teamWon ? 'text-green-500' : (isTied ? 'text-yellow-500' : 'text-red-500')
          }`}>
            {teamWon ? 'Victory' : (isTied ? 'Tie' : 'Defeat')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#888" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyMatches = () => (
    <View className="bg-card rounded-xl p-6 items-center">
      <Ionicons name="tennisball-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">No matches found</Text>
      <Text className="text-muted-foreground text-center mb-4">
        {filter === 'all' 
          ? "You haven't played any matches yet" 
          : `You don't have any ${filter} yet`}
      </Text>
      {filter === 'all' && (
        <Button
          variant="default"
          onPress={() => router.push('/(protected)/(screens)/create-match')}
        >
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
          <H1>Match History</H1>
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