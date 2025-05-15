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
  const [globalRankings, setGlobalRankings] = useState<UserRanking[]>([]);
  const [friendsRankings, setFriendsRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [globalPage, setGlobalPage] = useState(0);
  const [friendsPage, setFriendsPage] = useState(0);
  const [hasMoreGlobalUsers, setHasMoreGlobalUsers] = useState(true);
  const [hasMoreFriendUsers, setHasMoreFriendUsers] = useState(true);
  const [viewType, setViewType] = useState<'global' | 'friends'>('global');
  const { session, profile } = useAuth();
  const USERS_PER_PAGE = 20;

  useEffect(() => {
    if (session?.user?.id) {
      // Initial data loading
      if (globalRankings.length === 0) {
        fetchGlobalRankings(0);
      }
      if (friendsRankings.length === 0) {
        fetchFriendsRankings(0);
      }
    }
  }, [session]);

  const fetchGlobalRankings = async (pageIndex: number, shouldRefresh = false) => {
    try {
      setLoading(true);
      if (shouldRefresh) {
        setRefreshing(true);
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, glicko_rating, avatar_url')
        .order('glicko_rating', { ascending: false })
        .range(pageIndex * USERS_PER_PAGE, (pageIndex + 1) * USERS_PER_PAGE - 1);

      if (error) throw error;
      
      if (pageIndex === 0 || shouldRefresh) {
        setGlobalRankings(data || []);
      } else {
        setGlobalRankings(prev => [...prev, ...(data || [])]);
      }
      
      setHasMoreGlobalUsers(data && data.length === USERS_PER_PAGE);
      setGlobalPage(pageIndex);
    } catch (error) {
      console.error('Error fetching global rankings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFriendsRankings = async (pageIndex: number, shouldRefresh = false) => {
    try {
      setLoading(true);
      if (shouldRefresh) {
        setRefreshing(true);
      }
      
      if (!profile?.friends_list || !Array.isArray(profile.friends_list) || profile.friends_list.length === 0) {
        // If no friends, just show the current user
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, glicko_rating, avatar_url')
            .eq('id', session.user.id)
            .single();
            
          if (error) throw error;
          setFriendsRankings(data ? [data] : []);
        } else {
          setFriendsRankings([]);
        }
        setHasMoreFriendUsers(false);
        return;
      }
      
      // Add current user to the list to ensure they appear in the ranking
      const userAndFriends = [...profile.friends_list];
      if (session?.user?.id) userAndFriends.push(session.user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, glicko_rating, avatar_url')
        .in('id', userAndFriends)
        .order('glicko_rating', { ascending: false })
        .range(pageIndex * USERS_PER_PAGE, (pageIndex + 1) * USERS_PER_PAGE - 1);

      if (error) throw error;
      
      if (pageIndex === 0 || shouldRefresh) {
        setFriendsRankings(data || []);
      } else {
        setFriendsRankings(prev => [...prev, ...(data || [])]);
      }
      
      setHasMoreFriendUsers(data && data.length === USERS_PER_PAGE);
      setFriendsPage(pageIndex);
    } catch (error) {
      console.error('Error fetching friends rankings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreUsers = () => {
    if (loading) return;
    
    if (viewType === 'global' && hasMoreGlobalUsers) {
      fetchGlobalRankings(globalPage + 1);
    } else if (viewType === 'friends' && hasMoreFriendUsers) {
      fetchFriendsRankings(friendsPage + 1);
    }
  };

  const onRefresh = () => {
    if (viewType === 'global') {
      fetchGlobalRankings(0, true);
    } else {
      fetchFriendsRankings(0, true);
    }
  };

  const renderUserRank = (user: UserRanking, index: number) => {
    const page = viewType === 'global' ? globalPage : friendsPage;
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
          isCurrentUser ? 'bg-primary/10 dark:bg-primary/20' : 'bg-card'
        } border border-border/30`}
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
            {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-medium">
              {user.full_name || user.email.split('@')[0]}
            </Text>
            {isCurrentUser && (
              <View className="ml-2 px-2 py-0.5 bg-primary rounded">
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
    <View className="bg-card rounded-xl p-6 items-center border border-border/30 my-4">
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

  // Get the current rankings based on the active tab
  const currentRankings = viewType === 'global' ? globalRankings : friendsRankings;
  
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Tab Navigation */}
      <View className="flex-row border-b border-border">
        <TouchableOpacity
          className={`flex-1 py-3 ${viewType === 'global' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setViewType('global')}
        >
          <Text className={`text-center font-medium ${viewType === 'global' ? 'text-primary' : 'text-muted-foreground'}`}>
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 ${viewType === 'friends' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setViewType('friends')}
        >
          <Text className={`text-center font-medium ${viewType === 'friends' ? 'text-primary' : 'text-muted-foreground'}`}>
            Friends
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content */}
      <ScrollView 
        className="p-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScrollEndDrag={loadMoreUsers}
      >
        
        {loading && currentRankings.length === 0 ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#1a7ebd" />
          </View>
        ) : (
          <>
            {currentRankings.length > 0 
              ? currentRankings.map((user, index) => renderUserRank(user, index))
              : renderEmptyState()
            }
            
            {loading && currentRankings.length > 0 && (
              <View className="py-4">
                <ActivityIndicator size="small" color="#1a7ebd" />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}