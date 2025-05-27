import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Friend } from '@/types';

interface FriendLeaderboardProps {
  friends: Friend[];
  userId: string;
}

interface AvatarProps {
  user: Friend;
  rank: number;
  isCurrentUser: boolean;
  size?: 'sm' | 'md';
}

function UserAvatar({ user, rank, isCurrentUser, size = 'md' }: AvatarProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const sizeStyle = size === 'sm' ? { width: 32, height: 32, borderRadius: 16 } : { width: 40, height: 40, borderRadius: 20 };
  const textSize = size === 'sm' ? 'text-sm' : 'text-lg';

  // Get the fallback initial
  const getInitial = () => {
    if (user.full_name && user.full_name.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  // Get background color based on rank and user status
  const getBgColor = () => {
    if (rank === 1) return 'bg-amber-400';
    if (rank === 2) return 'bg-gray-300';
    if (rank === 3) return 'bg-amber-700';
    return 'bg-primary';
  };

  const shouldShowImage = user.avatar_url && !imageLoadError;

  if (shouldShowImage) {
    return (
      <View className={`${sizeClasses} rounded-full mr-3 overflow-hidden ${getBgColor()} items-center justify-center`}>
        <Image
          source={{ uri: user.avatar_url }}
          style={sizeStyle}
          resizeMode="cover"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoadError(true);
            setImageLoading(false);
          }}
          onLoadStart={() => setImageLoading(true)}
        />
        {/* Loading state overlay */}
        {imageLoading && (
          <View 
            className={`absolute inset-0 ${getBgColor()} items-center justify-center`}
          >
            <Text className={`${textSize} font-bold ${
              rank <= 3 ? 'text-primary-foreground' : 'text-primary-foreground'
            }`}>
              {getInitial()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback to text initial
  return (
    <View className={`${sizeClasses} rounded-full items-center justify-center mr-3 ${getBgColor()}`}>
      <Text className={`${textSize} font-bold ${
        rank <= 3 ? 'text-primary-foreground' : 'text-primary-foreground'
      }`}>
        {getInitial()}
      </Text>
    </View>
  );
}

export function FriendLeaderboard({ friends, userId }: FriendLeaderboardProps) {
  // Sort and limit to top 5 friends by rating
  const sortedFriends = useMemo(() => {
    return [...friends]
      .sort((a, b) => {
        const ratingA = a.glicko_rating || 1500;
        const ratingB = b.glicko_rating || 1500;
        return ratingB - ratingA;
      })
      .slice(0, 5);
  }, [friends]);

  // Find current user's position in the full leaderboard
  const userRank = useMemo(() => {
    const allSorted = [...friends].sort((a, b) => {
      const ratingA = a.glicko_rating || 1500;
      const ratingB = b.glicko_rating || 1500;
      return ratingB - ratingA;
    });
    
    return allSorted.findIndex(friend => friend.id === userId) + 1;
  }, [friends, userId]);

  const renderUserRank = (user: Friend, index: number) => {
    const rank = index + 1;
    const isCurrentUser = user.id === userId;
    
    // Create background color based on rank
    const getBgColor = () => {
      if (isCurrentUser) return 'bg-primary/15';
      if (rank === 1) return 'bg-amber-50 dark:bg-amber-950/30';
      if (rank === 2) return 'bg-gray-50 dark:bg-gray-800/40';
      if (rank === 3) return 'bg-orange-50 dark:bg-orange-950/30';
      return 'bg-card';
    };
    
    // Render medal icons for top positions
    const renderRankIndicator = () => {
      if (rank === 1) return <Ionicons name="trophy" size={22} color="#FFD700" />;
      if (rank === 2) return <Ionicons name="trophy" size={20} color="#C0C0C0" />;
      if (rank === 3) return <Ionicons name="trophy" size={18} color="#CD7F32" />;
      return <Text className="font-bold text-muted-foreground w-6 text-center">{rank}</Text>;
    };
    
    return (
      <TouchableOpacity
        key={user.id}
        className={`flex-row items-center p-3 mb-2 rounded-xl border ${getBgColor()} ${
          isCurrentUser ? 'border-primary/30' : 'border-border/30'
        }`}
        style={[
          styles.cardShadow,
          rank <= 3 && styles.topRankShadow
        ]}
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
        {/* Rank indicator */}
        <View className="mr-3 w-8 items-center justify-center">
          {renderRankIndicator()}
        </View>
        
        {/* Avatar */}
        <UserAvatar user={user} rank={rank} isCurrentUser={isCurrentUser} />
        
        {/* User info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-medium">
              {user.full_name || user.email.split('@')[0]}
            </Text>
            {isCurrentUser && (
              <View className="ml-2 px-2 py-0.5 bg-primary rounded-full">
                <Text className="text-xs text-primary-foreground">You</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-muted-foreground">{user.email}</Text>
        </View>
        
        {/* Rating */}
        <View className="items-end">
          <View className="flex-row items-center">
            <Ionicons name="stats-chart" size={12} color="#888" style={{ marginRight: 4 }} />
            <Text className="text-lg font-bold text-primary">
              {user.glicko_rating?.toString() || '1500'}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">Rating</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View
      className="bg-card rounded-lg p-6 items-center mt-4 border border-border/40"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <Ionicons name="people-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">
        No friends found
      </Text>
      <Text className="text-muted-foreground text-center">
        Connect with other players to see their rank
      </Text>
    </View>
  );

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-4">
      </View>
      
      {sortedFriends.length > 0 
        ? (
          <>
            {sortedFriends.map((friend, index) => renderUserRank(friend, index))}
            {friends.length > 5 && (
              <TouchableOpacity 
                className="items-center" 
                onPress={() => router.push('/leaderboard')}
              >
              </TouchableOpacity>
            )}
          </>
        )
        : renderEmptyState()
      }
      
      <TouchableOpacity 
        className="items-center" 
        onPress={() => router.push('/leaderboard')}
      >
        <Text className="bg-primary px-5 py-2 rounded-3xl mt-5 text-primary-foreground">More</Text>
      </TouchableOpacity>
    </View>
  );
}

// Platform-specific shadows for better depth
const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topRankShadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  }
});