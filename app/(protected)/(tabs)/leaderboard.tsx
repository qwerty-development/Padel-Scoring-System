import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H1, H2 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

interface UserRanking {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string;
}

export default function LeaderboardTab() {
  const [loading, setLoading] = useState(true);
  const [topRankings, setTopRankings] = useState<UserRanking[]>([]);
  const [userRank, setUserRank] = useState<{position: number, total: number} | null>(null);
  const [viewType, setViewType] = useState<'global' | 'friends'>('global');
  const { session, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false); // Added for pull to refresh

  const fetchData = useCallback(async () => {
    if (session?.user?.id) {
      await Promise.all([fetchTopRankings(), fetchUserRank()]);
    }
  }, [session, viewType, profile]); // Added profile to dependency array for fetchUserRank

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);


  const fetchTopRankings = async () => {
    try {
      // setLoading(true); // setLoading is handled by fetchData now
      
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, glicko_rating');
        
      if (viewType === 'friends' && profile?.friends_list && Array.isArray(profile.friends_list)) {
        const userAndFriends = [...profile.friends_list];
        if (session?.user?.id) userAndFriends.push(session.user.id);
        
        query = query.in('id', userAndFriends);
      }
      
      const { data, error } = await query
        .order('glicko_rating', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTopRankings(data || []);
    } catch (error) {
      console.error('Error fetching top rankings:', error);
    } finally {
      // setLoading(false); // setLoading is handled by fetchData now
    }
  };

  const fetchUserRank = async () => {
    try {
      if (!session?.user?.id) return;
      
      let totalCountQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
        
      if (viewType === 'friends' && profile?.friends_list && Array.isArray(profile.friends_list)) {
        const userAndFriends = [...profile.friends_list];
        if (session?.user?.id) userAndFriends.push(session.user.id);
        
        totalCountQuery = totalCountQuery.in('id', userAndFriends);
      }
      
      const { count, error: countError } = await totalCountQuery;
      
      if (countError) throw countError;
      
      if (profile?.glicko_rating) {
        let higherRankedQuery = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .gt('glicko_rating', profile.glicko_rating);
          
        if (viewType === 'friends' && profile?.friends_list && Array.isArray(profile.friends_list)) {
          const userAndFriends = [...profile.friends_list];
          if (session?.user?.id) userAndFriends.push(session.user.id);
          
          higherRankedQuery = higherRankedQuery.in('id', userAndFriends);
        }
        
        const { count: higherRanked, error: rankError } = await higherRankedQuery;
        
        if (rankError) throw rankError;
        
        if (higherRanked !== null && count !== null) {
          setUserRank({
            position: higherRanked + 1,
            total: count
          });
        } else {
           setUserRank(null); // Reset user rank if data is not sufficient
        }
      } else {
        setUserRank(null); // Reset user rank if no glicko_rating
      }
    } catch (error) {
      console.error('Error fetching user rank:', error);
       setUserRank(null); // Reset user rank on error
    }
  };

  // onRefresh function for pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]); // fetchData is already memoized

  const renderUserRank = (user: UserRanking, index: number) => {
    const rank = index + 1;
    const isCurrentUser = user.id === session?.user?.id;
    
    const renderRankIndicator = () => {
      if (rank === 1) return <Ionicons name="trophy" size={22} color="gold" />;
      if (rank === 2) return <Ionicons name="trophy" size={22} color="silver" />;
      if (rank === 3) return <Ionicons name="trophy" size={22} color="#CD7F32" />; // Bronze
      return <Text className="font-bold text-muted-foreground w-8">{rank}</Text>;
    };
    
    return (
      <TouchableOpacity
        key={user.id}
        className={`flex-row items-center py-3 ${
          index < topRankings.length - 1 ? 'border-b border-border' : ''
        }`}
        onPress={() => {
          if (isCurrentUser) {
            router.push('/profile');
          } else {
            router.push({
              pathname: '/(protected)/(screens)/friend-profile',
              params: { friendId: user.id }
            });
          }
        }}
      >
        <View className="w-6 items-center mr-2">
          {renderRankIndicator()}
        </View>
        
        <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-4">
          <Text className="text-lg font-bold text-primary-foreground">
            {user.full_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-medium">
              {user.full_name || user.email.split('@')[0]}
            </Text>
            {isCurrentUser && (
              <View className="ml-2 px-2 py-1 bg-primary rounded">
                <Text className="text-xs text-primary-foreground">You</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text className="font-bold text-primary">
          {parseInt(user.glicko_rating, 10).toString() || '1500'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) { // Ensure refreshing doesn't also trigger this full screen loader
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
        refreshControl={ // Added RefreshControl
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fbbf24" // iOS loading indicator color
            colors={['#fbbf24']} // Android loading indicator color(s)
          />
        }
      >
        <View className="mb-6">
          <H1 className="mb-2">Leaderboard</H1>
          <Text className="text-muted-foreground">
            Top Padel players by Glicko rating
          </Text>
        </View>
        
        <View className="flex-row gap-2 mb-6">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg ${viewType === 'global' ? 'bg-primary' : 'bg-card'}`}
            onPress={() => setViewType('global')}
          >
            <Text className={`text-center font-medium ${viewType === 'global' ? 'text-primary-foreground' : 'text-foreground'}`}>
              Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg ${viewType === 'friends' ? 'bg-primary' : 'bg-card'}`}
            onPress={() => setViewType('friends')}
          >
            <Text className={`text-center font-medium ${viewType === 'friends' ? 'text-primary-foreground' : 'text-foreground'}`}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>
        
        {userRank && (
          <View className="bg-primary/10 rounded-xl p-4 mb-6">
            <Text className="text-center text-muted-foreground mb-2">
              Your {viewType === 'friends' ? 'Friends ' : ''}Ranking
            </Text>
            <H2 className="text-center text-primary">
              {userRank.position} <Text className="text-muted-foreground text-base">of {userRank.total}</Text>
            </H2>
            {profile?.glicko_rating && (
              <Text className="text-center text-primary mt-1">
                Rating: {parseInt(profile.glicko_rating, 10).toString()}
              </Text>
            )}
          </View>
        )}
        
        <View className="bg-card rounded-xl p-4 mb-6">
          <View className="mb-4 flex-row justify-between items-center">
            <Text className="font-medium">
              {viewType === 'friends' ? 'Top Friends' : 'Top Players'}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(screens)/leaderboard')}
            >
              <Text className="text-primary">View All</Text>
            </TouchableOpacity>
          </View>
          
          {topRankings.length > 0 ? (
            topRankings.map((user, index) => renderUserRank(user, index))
          ) : (
            <Text className="text-center text-muted-foreground py-4">
              {viewType === 'friends' 
                ? "No friends added yet. Add friends to see their rankings!"
                : "No player rankings available yet"}
            </Text>
          )}
        </View>
        
        <Button
          className="w-full" 
          variant="default"
          onPress={() => router.push('/(protected)/(screens)/create-match')}
        >
          <Ionicons name="add" size={20} color="#fff" className="mr-2" />
          <Text>Create Match</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}