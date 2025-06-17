import React, { useState } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Friend } from '@/types';

interface FriendCardProps {
  friend: Friend;
  onCreateMatch?: () => void;
  showRating?: boolean;
}

export function FriendCard({ 
  friend, 
  onCreateMatch,
  showRating = true 
}: FriendCardProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Get the fallback initial
  const getInitial = () => {
    if (friend.full_name?.trim()) {
      return friend.full_name.charAt(0).toUpperCase();
    }
    if (friend.email) {
      return friend.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  // Check if we should show the avatar image
  const shouldShowImage = friend.avatar_url && !imageLoadError;

  const renderAvatar = () => {
    if (shouldShowImage) {
      return (
        <View className="w-10 h-10 rounded-full mr-3 overflow-hidden bg-primary items-center justify-center">
          <Image
            source={{ uri: friend.avatar_url }}
            className="w-full h-full"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
            }}
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
              className="absolute inset-0 bg-primary items-center justify-center"
              style={{
                backgroundColor: 'rgba(26, 126, 189, 0.8)',
              }}
            >
              <Text className="text-sm font-bold text-primary-foreground">
                {getInitial()}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Fallback to text initial
    return (
      <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
        <Text className="text-sm font-bold text-primary-foreground">
          {getInitial()}
        </Text>
      </View>
    );
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 1800) return '#10b981'; // green
    if (rating >= 1600) return '#f59e0b'; // amber  
    if (rating >= 1400) return '#3b82f6'; // blue
    return '#6b7280'; // gray
  };

  const getRatingBadge = (rating: number) => {
    if (rating >= 1800) return 'Expert';
    if (rating >= 1600) return 'Advanced';
    if (rating >= 1400) return 'Intermediate';
    return 'Beginner';
  };

  const displayRating = friend.glicko_rating || 1500;

  return (
    <TouchableOpacity
      className="bg-card rounded-xl mb-2 p-3 border border-border/30"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}
      onPress={() => {
        router.push({
          pathname: '/(protected)/(screens)/friend-profile',
          params: { friendId: friend.id }
        });
      }}
    >
      <View className="flex-row items-center">
        {renderAvatar()}
        
        <View className="flex-1">
          {/* Name */}
          <Text className="font-semibold text-base" numberOfLines={1}>
            {friend.full_name || friend.email}
          </Text>
          
          {/* Playing attributes */}
          <View className="flex-row items-center gap-4 mt-1">
            {friend.preferred_hand && (
              <View className="flex-row items-center">
                <Ionicons 
                  name={friend.preferred_hand === 'Left' ? "hand-left-outline" : "hand-right-outline"} 
                  size={12} 
                  color="#6b7280" 
                />
                <Text className="text-xs text-muted-foreground ml-1">
                  {friend.preferred_hand}
                </Text>
              </View>
            )}
            
            {friend.court_playing_side && (
              <View className="flex-row items-center">
                <Ionicons name="tennisball-outline" size={12} color="#6b7280" />
                <Text className="text-xs text-muted-foreground ml-1">
                  {friend.court_playing_side} side
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Rating section */}
        {showRating && (
          <View className="items-end mr-2">
            <View 
              className="px-2 py-1 rounded-lg"
              style={{ backgroundColor: getRatingColor(displayRating) + '15' }}
            >
              <Text 
                className="text-sm font-bold"
                style={{ color: getRatingColor(displayRating) }}
              >
                {displayRating.toFixed(0)}
              </Text>
            </View>
            <Text 
              className="text-xs mt-0.5"
              style={{ color: getRatingColor(displayRating) }}
            >
              {getRatingBadge(displayRating)}
            </Text>
          </View>
        )}
        
        {/* Action buttons */}
        <View className="flex-row items-center gap-1 ml-2">
          {onCreateMatch && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onCreateMatch();
              }}
              className="p-2 rounded-full bg-primary"
              style={{
                shadowColor: "#2148ce",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Ionicons name="add" size={16} color="white" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: '/(protected)/(screens)/friend-profile',
                params: { friendId: friend.id }
              });
            }}
            className="p-2 rounded-full bg-background border border-border"
          >
            <Ionicons name="chevron-forward" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}