import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H1, H2, H3 } from '@/components/ui/typography';
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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentMatches, setRecentMatches] = useState<MatchData[]>([]);
  const [stats, setStats] = useState({
    totalMatches: 0,
    wins: 0,
    losses: 0,
  });
  const { profile, session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchRecentMatches();
    }
  }, [session]);

  const fetchRecentMatches = async () => {
    try {
      setLoading(true);
      
      // Fetch recent matches where the user was a participant
      const { data, error } = await supabase
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
        .limit(5);

      if (error) throw error;

      setRecentMatches(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching recent matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecentMatches();
  };

  const calculateStats = (matches: MatchData[]) => {
    if (matches.length === 0) {
      setStats({ totalMatches: 0, wins: 0, losses: 0 });
      return;
    }

    let wins = 0;
    let losses = 0;
    const userId = session?.user?.id;

    matches.forEach(match => {
      const isTeam1 = match.player1_id === userId || match.player2_id === userId;
      const isTeam2 = match.player3_id === userId || match.player4_id === userId;
      
      if (isTeam1 && match.team1_score > match.team2_score) wins++;
      else if (isTeam2 && match.team2_score > match.team1_score) wins++;
      else if (match.team1_score !== match.team2_score) losses++;
    });

    setStats({
      totalMatches: matches.length,
      wins,
      losses,
    });
  };

  const renderQuickActions = () => (
    <View className="flex-row justify-between gap-3 mb-6">
      <TouchableOpacity
        className="flex-1 bg-primary rounded-xl p-4 items-center"
        onPress={() => router.push('/(protected)/(screens)/create-match')}
      >
        <View className="w-12 h-12 rounded-full bg-white items-center justify-center mb-2">
          <Ionicons name="tennisball" size={24} color="#fbbf24" />
        </View>
        <Text className="text-white font-medium">Create Match</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        className="flex-1 bg-card rounded-xl p-4 items-center"
        onPress={() => router.push('/(protected)/(screens)/friends')}
      >
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mb-2">
          <Ionicons name="people" size={24} color="#fbbf24" />
        </View>
        <Text className="font-medium">Friends</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        className="flex-1 bg-card rounded-xl p-4 items-center"
        onPress={() => router.push('/profile')}
      >
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mb-2">
          <Ionicons name="person" size={24} color="#fbbf24" />
        </View>
        <Text className="font-medium">Profile</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStatsCard = () => (
    <View className="bg-card rounded-xl p-6 mb-6">
      <H3 className="mb-4">Your Statistics</H3>
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_rating || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Rating</Text>
        </View>
        
        <View className="items-center">
          <Text className="text-2xl font-bold text-green-500">
            {stats.wins}
          </Text>
          <Text className="text-sm text-muted-foreground">Wins</Text>
        </View>
        
        <View className="items-center">
          <Text className="text-2xl font-bold text-red-500">
            {stats.losses}
          </Text>
          <Text className="text-sm text-muted-foreground">Losses</Text>
        </View>
        
        <View className="items-center">
          <Text className="text-2xl font-bold">
            {stats.totalMatches}
          </Text>
          <Text className="text-sm text-muted-foreground">Matches</Text>
        </View>
      </View>
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
        
        <View className="flex-row justify-end">
          <Text className={`text-sm font-medium ${
            teamWon ? 'text-green-500' : (isTied ? 'text-yellow-500' : 'text-red-500')
          }`}>
            {teamWon ? 'Victory' : (isTied ? 'Tie' : 'Defeat')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyMatches = () => (
    <View className="bg-card rounded-xl p-6 items-center">
      <Ionicons name="tennisball-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">No matches yet</Text>
      <Text className="text-muted-foreground text-center mb-4">
        Start playing and recording your matches to see them here
      </Text>
      <Button
        variant="default"
        onPress={() => router.push('/(protected)/(screens)/create-match')}
      >
        <Text>Create First Match</Text>
      </Button>
    </View>
  );

  if (loading && !refreshing) {
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
      >
        <View className="mb-6">
          <H1 className="mb-2">Home</H1>
          <Text className="text-muted-foreground">
            Welcome back, {profile?.full_name || 'Player'}!
          </Text>
        </View>
        
        {renderQuickActions()}
        {renderStatsCard()}
        
		<View className="mb-4 flex-row justify-between items-center">
  <H3>Recent Matches</H3>
  <TouchableOpacity 
    onPress={() => {
      router.push('/(protected)/(screens)/match-history');
    }}
  >
    <Text className="text-primary">See All</Text>
  </TouchableOpacity>
</View>
        
        {recentMatches.length > 0 
          ? recentMatches.map(renderMatchCard)
          : renderEmptyMatches()
        }
      </ScrollView>
    </SafeAreaView>
  );
}