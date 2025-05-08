import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';

import { H1 } from '@/components/ui/typography';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';
import { StatsCard } from '@/components/home/StatsCard';
import { RecentMatchesSection } from '@/components/home/RecentMatchesSection';
import { CreateMatchFAB } from '@/components/home/CreateMatchFAB';
import { MatchData } from '@/types';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentMatches, setRecentMatches] = useState<MatchData[]>([]);
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
        .limit(10);

      if (error) throw error;

      setRecentMatches(data || []);
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
          <H1 className="mb-2">👋 {profile?.full_name || 'Player'}!</H1>
        </View>
        
        <StatsCard 
          profile={profile} 
          matches={recentMatches} 
          userId={session?.user?.id || ''}
        />
        
        <RecentMatchesSection 
          matches={recentMatches} 
          userId={session?.user?.id || ''} 
        />
      </ScrollView>
      
      <CreateMatchFAB />
    </SafeAreaView>
  );
}