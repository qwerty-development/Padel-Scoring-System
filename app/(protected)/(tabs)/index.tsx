import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Text as RNText } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { H1, H2 } from '@/components/ui/typography';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';
import { StatsCard } from '@/components/home/StatsCard';
import { RecentMatchesSection } from '@/components/home/RecentMatchesSection';
import { CreateMatchFAB } from '@/components/home/CreateMatchFAB';
import { MatchData } from '@/types';

// Define match status types for explicit categorization
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom status for UI purposes (past matches without scores)
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allMatches, setAllMatches] = useState<MatchData[]>([]);
  const { profile, session } = useAuth();

  // Categorize matches into relevant groups for UI display
  const categorizedMatches = useMemo(() => {
    if (!allMatches.length) return {
      upcoming: [],
      needsAttention: [],
      recent: []
    };

    const now = new Date();
    
    return {
      // Future matches that haven't started yet
      upcoming: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        return startTime > now && match.status === MatchStatus.PENDING;
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      
      // Matches that need attention - past matches without scores or pending confirmation
      needsAttention: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        
        // Past matches without scores (custom UI status)
        const isPastWithoutScores = startTime < now && (!match.team1_score_set1 || !match.team2_score_set1) && match.status !== MatchStatus.CANCELLED;
        
        // Matches needing confirmation
        const needsConfirmation = match.status === MatchStatus.NEEDS_CONFIRMATION;
        
        return isPastWithoutScores || needsConfirmation;
      }).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      
      // Recently completed matches
      recent: allMatches.filter(match => 
        match.status === MatchStatus.COMPLETED
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
    };
  }, [allMatches]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchAllMatches();
    }
  }, [session]);

  const fetchAllMatches = async () => {
    try {
      setLoading(true);
      
      // Fetch all matches where the user was a participant
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
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Process match data to handle nullable fields and compute additional properties
      const processedData = (data || []).map(match => {
        // Calculate if match is in the past but has no scores
        const now = new Date();
        const startTime = new Date(match.start_time);
        const needsScores = startTime < now && 
                          (!match.team1_score_set1 || !match.team2_score_set1) && 
                          match.status !== MatchStatus.CANCELLED;
        
        // Calculate who is on the user's team
        const isTeam1 = match.player1_id === session?.user?.id || match.player2_id === session?.user?.id;
        
        return {
          ...match,
          needsScores,
          isTeam1
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
    setRefreshing(true);
    fetchAllMatches();
  };

  // Function to handle quick actions on matches
  const handleMatchAction = (match: MatchData) => {
    if (match.needsScores) {
      // Navigate to match details with score entry mode
      router.push({
        pathname: '/(protected)/(screens)/match-details',
        params: { matchId: match.id, mode: 'score-entry' }
      });
    } else {
      // Navigate to standard match details
      router.push({
        pathname: '/(protected)/(screens)/match-details',
        params: { matchId: match.id }
      });
    }
  };

  // Render a match item with appropriate status indicators
  const renderMatchItem = (match: MatchData, index: number, type: 'upcoming' | 'attention' | 'recent') => {
    const startTime = new Date(match.start_time);
    const formattedDate = startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formattedTime = startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    
    // Get team members to display
    const teammate = match.isTeam1 
      ? (match.player1_id === session?.user?.id ? match.player2 : match.player1)
      : (match.player3_id === session?.user?.id ? match.player4 : match.player3);
    
    // Get opponents to display
    const opponents = match.isTeam1 
      ? [match.player3, match.player4]
      : [match.player1, match.player2];
    
    // Style based on match type
    const getBgColor = () => {
      if (type === 'upcoming') return 'bg-blue-50 dark:bg-blue-900/30';
      if (type === 'attention') return 'bg-amber-50 dark:bg-amber-900/30';
      return 'bg-card';
    };
    
    return (
      <TouchableOpacity 
        key={`${type}-${match.id}-${index}`}
        className={`mb-3 p-4 rounded-xl ${getBgColor()} border border-border/30`}
        onPress={() => handleMatchAction(match)}
      >
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center">
            {type === 'upcoming' && (
              <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2">
                <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
              </View>
            )}
            {type === 'attention' && (
              <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center mr-2">
                <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
              </View>
            )}
            {type === 'recent' && (
              <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2">
                <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
              </View>
            )}
            <Text className="font-medium">
              {type === 'upcoming' ? 'Upcoming' : 
               match.needsScores ? 'Needs Scores' : 
               match.status === MatchStatus.NEEDS_CONFIRMATION ? 'Needs Confirmation' : 
               'Completed'}
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            {formattedDate} • {formattedTime}
          </Text>
        </View>
        
        <View className="mb-2">
          <Text className="font-medium">
            You {teammate ? `& ${teammate.full_name || teammate.email.split('@')[0]}` : ''}
          </Text>
          <Text className="text-sm text-muted-foreground">
            vs. {opponents.filter(Boolean).map(p => 
              p?.full_name || p?.email?.split('@')[0] || 'TBD'
            ).join(' & ')}
          </Text>
        </View>
        
        {match.team1_score_set1 && match.team2_score_set1 ? (
          <View className="flex-row items-center">
            <Text className="text-sm font-medium mr-2">Score:</Text>
            <Text className="text-sm">
              {match.isTeam1 ? match.team1_score_set1 : match.team2_score_set1}-
              {match.isTeam1 ? match.team2_score_set1 : match.team1_score_set1}
              {match.team1_score_set2 && match.team2_score_set2 ? `, ${match.isTeam1 ? match.team1_score_set2 : match.team2_score_set2}-${match.isTeam1 ? match.team2_score_set2 : match.team1_score_set2}` : ''}
              {match.team1_score_set3 && match.team2_score_set3 ? `, ${match.isTeam1 ? match.team1_score_set3 : match.team2_score_set3}-${match.isTeam1 ? match.team2_score_set3 : match.team1_score_set3}` : ''}
            </Text>
          </View>
        ) : type === 'attention' ? (
          <Button 
            size="sm" 
            variant="default" 
            className="mt-1"
            onPress={() => handleMatchAction(match)}
          >
            <Text className="text-xs text-primary-foreground">
              {match.needsScores ? 'Enter Scores' : 'View Details'}
            </Text>
          </Button>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1a7ebd" />
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
          <H1 className="mb-2">👋 {profile?.full_name || 'Player'}</H1>
        </View>
        
        <StatsCard 
          profile={profile} 
          matches={allMatches} 
          userId={session?.user?.id || ''}
        />
        
        {/* Upcoming Matches Section */}
        {categorizedMatches.upcoming.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>Upcoming Matches</H2>
              {categorizedMatches.upcoming.length > 3 && (
                <TouchableOpacity 
                  onPress={() => router.push('/(protected)/(screens)/match-history')}
                  className="flex-row items-center"
                >
                  <Text className="text-primary text-sm mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
                </TouchableOpacity>
              )}
            </View>
            
            {categorizedMatches.upcoming.slice(0, 3).map((match, index) => 
              renderMatchItem(match, index, 'upcoming')
            )}
          </View>
        )}
        
        {/* Matches Needing Attention */}
        {categorizedMatches.needsAttention.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>Needs Attention</H2>
            </View>
            
            {categorizedMatches.needsAttention.map((match, index) => 
              renderMatchItem(match, index, 'attention')
            )}
          </View>
        )}
        
        {/* Recent Matches */}
        {categorizedMatches.recent.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>Recent Matches</H2>
              <TouchableOpacity 
                onPress={() => router.push('/(protected)/(screens)/match-history')}
                className="flex-row items-center"
              >
                <Text className="text-primary text-sm mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
              </TouchableOpacity>
            </View>
            
            {categorizedMatches.recent.slice(0, 3).map((match, index) => 
              renderMatchItem(match, index, 'recent')
            )}
          </View>
        )}
        
        {/* No matches state */}
        {allMatches.length === 0 && (
          <View className="bg-card rounded-xl p-6 items-center my-6">
            <Ionicons name="tennisball-outline" size={48} color="#888" />
            <Text className="text-lg font-medium mt-4 mb-2">No matches yet</Text>
            <Text className="text-muted-foreground text-center mb-4">
              Create your first match to start tracking your padel performance
            </Text>
            <Button
              variant="default"
              onPress={() => router.push('/(protected)/(screens)/create-match')}
            >
              <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
              <Text>Create Match</Text>
            </Button>
          </View>
        )}
      </ScrollView>
      
      <CreateMatchFAB />
    </SafeAreaView>
  );
}