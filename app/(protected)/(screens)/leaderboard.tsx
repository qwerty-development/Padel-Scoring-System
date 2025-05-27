import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
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

interface LeaderboardAvatarProps {
  user: UserRanking;
  rank: number;
  isCurrentUser: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Comprehensive Avatar Component with Advanced State Management
 * Implements three-stage loading system: initial -> loading -> final
 * Provides fallback mechanisms for image loading failures
 * Optimized for leaderboard display requirements
 */
function LeaderboardAvatar({ user, rank, isCurrentUser, size = 'md' }: LeaderboardAvatarProps) {
  // State management for image loading lifecycle
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  // Configuration matrix for different avatar sizes
  const sizeConfiguration = {
    sm: {
      containerClass: 'w-8 h-8',
      imageStyle: { width: 32, height: 32, borderRadius: 16 },
      textClass: 'text-sm',
      iconSize: 12
    },
    md: {
      containerClass: 'w-10 h-10',
      imageStyle: { width: 40, height: 40, borderRadius: 20 },
      textClass: 'text-lg',
      iconSize: 16
    },
    lg: {
      containerClass: 'w-12 h-12',
      imageStyle: { width: 48, height: 48, borderRadius: 24 },
      textClass: 'text-xl',
      iconSize: 20
    }
  };

  const config = sizeConfiguration[size];

  /**
   * Advanced Fallback Initial Character Extraction Algorithm
   * Priority order: full_name -> email -> default fallback
   * Implements comprehensive null-safety checks
   */
  const extractFallbackInitial = (): string => {
    // Primary extraction: full_name with null-safety validation
    if (user.full_name?.trim()) {
      const sanitizedName = user.full_name.trim();
      const firstCharacter = sanitizedName.charAt(0);
      return firstCharacter.toUpperCase();
    }
    
    // Secondary extraction: email with validation
    if (user.email?.trim()) {
      const sanitizedEmail = user.email.trim();
      const firstCharacter = sanitizedEmail.charAt(0);
      return firstCharacter.toUpperCase();
    }
    
    // Tertiary fallback: default character
    return '?';
  };

  /**
   * Dynamic Background Color Algorithm Based on Ranking Position
   * Implements medal-tier color classification system
   * Provides visual hierarchy for ranking positions
   */
  const calculateBackgroundColorClass = (): string => {
    // Medal tier color assignments
    if (rank === 1) return 'bg-amber-400'; // Gold medal
    if (rank === 2) return 'bg-gray-300';  // Silver medal
    if (rank === 3) return 'bg-amber-700'; // Bronze medal
    
    // Current user highlighting logic
    if (isCurrentUser) return 'bg-primary';
    
    // Default tier assignment
    return 'bg-primary';
  };

  /**
   * Text Color Class Determination Algorithm
   * Ensures optimal contrast for different background colors
   * Maintains accessibility compliance standards
   */
  const calculateTextColorClass = (): string => {
    // High contrast requirements for medal tiers
    if (rank <= 3) return 'text-primary-foreground';
    
    // Standard contrast for other positions
    return 'text-primary-foreground';
  };

  /**
   * Avatar Image Availability Validation Logic
   * Implements comprehensive URL validation and error state checking
   */
  const shouldDisplayAvatarImage = (): boolean => {
    return Boolean(
      user.avatar_url &&           // URL exists
      user.avatar_url.trim() &&    // URL is not empty string
      !imageLoadError              // No previous loading errors
    );
  };

  /**
   * Image Loading Success Event Handler
   * Manages state transition from loading to loaded
   */
  const handleImageLoadSuccess = (): void => {
    setImageLoading(false);
  };

  /**
   * Image Loading Failure Event Handler
   * Implements comprehensive error logging and state management
   */
  const handleImageLoadFailure = (): void => {
    console.warn(`Leaderboard avatar load failure:`, {
      userId: user.id,
      userRank: rank,
      avatarUrl: user.avatar_url,
      userName: user.full_name || user.email,
      timestamp: new Date().toISOString(),
      component: 'LeaderboardAvatar'
    });
    
    setImageLoadError(true);
    setImageLoading(false);
  };

  /**
   * Image Loading Initiation Event Handler
   * Manages state transition from initial to loading
   */
  const handleImageLoadStart = (): void => {
    setImageLoading(true);
  };

  // Avatar Image Rendering Branch
  if (shouldDisplayAvatarImage()) {
    return (
      <View className={`${config.containerClass} rounded-full ${calculateBackgroundColorClass()} items-center justify-center mr-4 overflow-hidden`}>
        <Image
          source={{ uri: user.avatar_url }}
          style={config.imageStyle}
          resizeMode="cover"
          onLoad={handleImageLoadSuccess}
          onError={handleImageLoadFailure}
          onLoadStart={handleImageLoadStart}
        />
        
        {/* Loading State Overlay with Synchronized Styling */}
        {imageLoading && (
          <View 
            className={`absolute inset-0 ${calculateBackgroundColorClass()} items-center justify-center`}
            style={{
              backgroundColor: 'rgba(26, 126, 189, 0.8)',
            }}
          >
            <Text className={`${config.textClass} font-bold ${calculateTextColorClass()}`}>
              {extractFallbackInitial()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Text Initial Fallback Rendering Branch
  return (
    <View className={`${config.containerClass} rounded-full ${calculateBackgroundColorClass()} items-center justify-center mr-4`}>
      <Text className={`${config.textClass} font-bold ${calculateTextColorClass()}`}>
        {extractFallbackInitial()}
      </Text>
    </View>
  );
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

  /**
   * Enhanced User Ranking Card Renderer with Avatar Integration
   * Implements comprehensive ranking display logic
   * Provides interactive navigation and visual feedback
   */
  const renderUserRankingCard = (user: UserRanking, index: number) => {
    const page = viewType === 'global' ? globalPage : friendsPage;
    const calculatedRank = page * USERS_PER_PAGE + index + 1;
    const isCurrentUser = user.id === session?.user?.id;
    
    /**
     * Medal Icon Rendering Algorithm for Top-Tier Rankings
     * Implements visual hierarchy for top 3 positions
     */
    const renderRankingIndicator = () => {
      const medalConfigurations = {
        1: { name: "podium" as const, color: "#FFD700", size: 24 }, // Gold
        2: { name: "podium" as const, color: "#C0C0C0", size: 24 }, // Silver
        3: { name: "podium" as const, color: "#CD7F32", size: 24 }  // Bronze
      };
      
      const medalConfig = medalConfigurations[calculatedRank as keyof typeof medalConfigurations];
      
      if (medalConfig) {
        return (
          <View className="items-center justify-center">
            <Ionicons 
              name={medalConfig.name} 
              size={medalConfig.size} 
              color={medalConfig.color} 
            />
          </View>
        );
      }
      
      // Standard ranking number display for positions 4+
      return (
        <View className="w-8 items-center justify-center">
          <Text className="font-bold text-muted-foreground text-center text-base">
            {calculatedRank}
          </Text>
        </View>
      );
    };

    /**
     * Dynamic Background Color Calculation for User Cards
     * Implements visual distinction for current user
     */
    const calculateCardBackgroundClass = (): string => {
      if (isCurrentUser) {
        return 'bg-primary/10 dark:bg-primary/20 border-primary/30';
      }
      return 'bg-card border-border/30';
    };

    return (
      <TouchableOpacity
        key={user.id}
        className={`flex-row items-center p-4 mb-2 rounded-xl ${calculateCardBackgroundClass()} border`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
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
        activeOpacity={0.7}
      >
        {/* Ranking Position Indicator */}
        <View className="mr-3 w-8">
          {renderRankingIndicator()}
        </View>
        
        {/* Enhanced Avatar Component Integration */}
        <LeaderboardAvatar 
          user={user} 
          rank={calculatedRank} 
          isCurrentUser={isCurrentUser} 
          size="md" 
        />
        
        {/* User Information Section */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-medium text-foreground">
              {user.full_name || user.email.split('@')[0]}
            </Text>
            {isCurrentUser && (
              <View className="ml-2 px-2 py-0.5 bg-primary rounded-full">
                <Text className="text-xs text-primary-foreground font-medium">You</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-muted-foreground">{user.email}</Text>
        </View>
        
        {/* Rating Display Section */}
        <View className="items-end">
          <View className="flex-row items-center">
            <Ionicons name="stats-chart" size={12} color="#888" style={{ marginRight: 4 }} />
            <Text className="text-xl font-bold text-primary">
              {parseInt(user.glicko_rating, 10).toString() || '1500'}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">Rating</Text>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Enhanced Empty State Renderer with Context-Aware Messaging
   * Provides appropriate guidance based on current view type
   */
  const renderEmptyState = () => (
    <View 
      className="bg-card rounded-xl p-6 items-center border border-border/30 my-4"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="bg-muted/30 p-4 rounded-full mb-4">
        <Ionicons name="podium-outline" size={48} color="#888" />
      </View>
      <Text className="text-lg font-medium mt-2 mb-2 text-foreground">
        {viewType === 'friends' 
          ? "No friends found"
          : "No players found"}
      </Text>
      <Text className="text-muted-foreground text-center leading-5">
        {viewType === 'friends' 
          ? "Add friends to see their rankings and compete together!"
          : "Be the first to climb the leaderboard by playing matches!"}
      </Text>
      
      {viewType === 'friends' && (
        <TouchableOpacity
          className="mt-4 px-4 py-2 bg-primary rounded-lg"
          onPress={() => router.push('/(protected)/(screens)/friends')}
        >
          <Text className="text-primary-foreground font-medium">Add Friends</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Current rankings data source determination
  const currentRankings = viewType === 'global' ? globalRankings : friendsRankings;
  const hasMoreUsers = viewType === 'global' ? hasMoreGlobalUsers : hasMoreFriendUsers;
  
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Enhanced Tab Navigation with Visual Feedback */}
      <View className="flex-row border-b border-border bg-background">
        <TouchableOpacity
          className={`flex-1 py-3 ${viewType === 'global' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setViewType('global')}
          activeOpacity={0.7}
        >
          <View className="flex-row justify-center items-center">
            <Ionicons 
              name="earth" 
              size={16} 
              color={viewType === 'global' ? '#1a7ebd' : '#888'} 
              style={{ marginRight: 6 }}
            />
            <Text className={`text-center font-medium ${viewType === 'global' ? 'text-primary' : 'text-muted-foreground'}`}>
              Global
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          className={`flex-1 py-3 ${viewType === 'friends' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setViewType('friends')}
          activeOpacity={0.7}
        >
          <View className="flex-row justify-center items-center">
            <Ionicons 
              name="people" 
              size={16} 
              color={viewType === 'friends' ? '#1a7ebd' : '#888'} 
              style={{ marginRight: 6 }}
            />
            <Text className={`text-center font-medium ${viewType === 'friends' ? 'text-primary' : 'text-muted-foreground'}`}>
              Friends
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Enhanced Content Area with Optimized Scrolling */}
      <ScrollView 
        className="p-6"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#1a7ebd"]}
            tintColor="#1a7ebd"
          />
        }
        onScrollEndDrag={loadMoreUsers}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Loading State Management */}
        {loading && currentRankings.length === 0 ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#1a7ebd" />
            <Text className="text-muted-foreground mt-4">Loading rankings...</Text>
          </View>
        ) : (
          <>
            {/* Rankings Display or Empty State */}
            {currentRankings.length > 0 
              ? currentRankings.map((user, index) => renderUserRankingCard(user, index))
              : renderEmptyState()
            }
            
            {/* Pagination Loading Indicator */}
            {loading && currentRankings.length > 0 && (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#1a7ebd" />
                <Text className="text-muted-foreground text-sm mt-2">Loading more users...</Text>
              </View>
            )}
            
            {/* End of Results Indicator */}
            {!hasMoreUsers && currentRankings.length > 0 && (
              <View className="py-4 items-center">
                <Text className="text-muted-foreground text-sm">
                  You've reached the end of the rankings
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}