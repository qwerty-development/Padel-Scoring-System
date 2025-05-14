import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H1 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

interface UserRanking {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string;
  avatar_url: string | null;
}

export default function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [page, setPage] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [viewType, setViewType] = useState<'global' | 'friends'>('global');
  const { session, profile } = useAuth();
  const USERS_PER_PAGE = 20;

  useEffect(() => {
    if (session?.user?.id) {
      fetchRankings(0);
    }
  }, [session, viewType]);

  const fetchRankings = async (pageIndex: number, shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, glicko_rating, avatar_url');
        
      // Apply friends filter when needed
      if (viewType === 'friends' && profile?.friends_list && Array.isArray(profile.friends_list)) {
        // Add current user to the list to ensure they appear in the ranking
        const userAndFriends = [...profile.friends_list];
        if (session?.user?.id) userAndFriends.push(session.user.id);
        
        query = query.in('id', userAndFriends);
      }
      
      const { data, error } = await query
        .order('glicko_rating', { ascending: false })
        .range(pageIndex * USERS_PER_PAGE, (pageIndex + 1) * USERS_PER_PAGE - 1);

      if (error) throw error;
      
      if (pageIndex === 0) {
        setRankings(data || []);
      } else {
        setRankings(prev => [...prev, ...(data || [])]);
      }
      
      setHasMoreUsers(data && data.length === USERS_PER_PAGE);
      setPage(pageIndex);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreUsers = () => {
    if (hasMoreUsers && !loading) {
      fetchRankings(page + 1);
    }
  };

  const onRefresh = () => {
    fetchRankings(0, true);
  };

  const renderUserRank = (user: UserRanking, index: number) => {
    const rank = page * USERS_PER_PAGE + index + 1;
    const isCurrentUser = user.id === session?.user?.id;
    
    // Render medal icons for top positions
    const renderRankIndicator = () => {
      if (rank === 1) return <Ionicons name="trophy" size={24} color="gold" />;
      if (rank === 2) return <Ionicons name="trophy" size={24} color="silver" />;
      if (rank === 3) return <Ionicons name="trophy" size={24} color="#CD7F32" />; // Bronze
      return <Text className="font-bold text-muted-foreground w-6 text-center">{rank}</Text>;
    };
    
    return (
      <TouchableOpacity
        key={user.id}
        className={`flex-row items-center p-4 mb-2 rounded-xl ${
          isCurrentUser ? 'bg-primary/10' : 'bg-card'
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
        <View className="mr-3">
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
          <Text className="text-sm text-muted-foreground">{user.email}</Text>
        </View>
        
        <View className="items-end">
          <Text className="text-xl font-bold text-primary">
            {parseInt(user.glicko_rating, 10).toString() || '1500'}
          </Text>
          <Text className="text-xs text-muted-foreground">Rating</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View className="bg-card rounded-xl p-6 items-center">
      <Ionicons name="podium-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">
        {viewType === 'friends' 
          ? "No friends found"
          : "No players found"}
      </Text>
      <Text className="text-muted-foreground text-center">
        {viewType === 'friends' 
          ? "Add friends to see their rankings!"
          : "Be the first to climb the leaderboard by playing matches!"}
      </Text>
    </View>
  );

  if (loading && !refreshing && page === 0) {
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
        onScrollEndDrag={() => loadMoreUsers()}
      >

        
        {/* View toggle buttons */}
        <View className="flex-row gap-2 mb-6">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg ${viewType === 'global' ? 'bg-primary' : 'bg-card'}`}
            onPress={() => {
              setViewType('global');
              setPage(0);
              setRankings([]);
              fetchRankings(0);
            }}
          >
            <Text className={`text-center font-medium ${viewType === 'global' ? 'text-primary-foreground' : 'text-foreground'}`}>
              Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg ${viewType === 'friends' ? 'bg-primary' : 'bg-card'}`}
            onPress={() => {
              setViewType('friends');
              setPage(0);
              setRankings([]);
              fetchRankings(0);
            }}
          >
            <Text className={`text-center font-medium ${viewType === 'friends' ? 'text-primary-foreground' : 'text-foreground'}`}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>
        
        {rankings.length > 0 
          ? rankings.map((user, index) => renderUserRank(user, index))
          : renderEmptyState()
        }
        
        {loading && page > 0 && (
          <View className="py-4">
            <ActivityIndicator size="small" color="#1a7ebd" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}