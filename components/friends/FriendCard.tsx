import React, { useState } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Friend } from '@/types';

interface FriendCardProps {
  friend: Friend;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  activity?: {
    lastMatch: string | null;
    scheduledMatch: string | null;
    matchCount: number;
  };
  onCreateMatch?: () => void;
  onViewHistory?: () => void;
}

export function FriendCard({ 
  friend, 
  expanded, 
  onToggleExpand,
  activity,
  onCreateMatch,
  onViewHistory 
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
        <View className="w-12 h-12 rounded-full mr-4 overflow-hidden bg-primary items-center justify-center">
          <Image
            source={{ uri: friend.avatar_url }}
            className="w-full h-full"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
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
              <Text className="text-lg font-bold text-primary-foreground">
                {getInitial()}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Fallback to text initial
    return (
      <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
        <Text className="text-lg font-bold text-primary-foreground">
          {getInitial()}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      className="bg-card rounded-lg mb-3 p-4"
      onPress={() => onToggleExpand(friend.id)}
    >
      <View className="flex-row items-center">
        {renderAvatar()}
        
        <View className="flex-1">
          <Text className="font-medium">{friend.full_name || friend.email}</Text>
          <View className="flex-row items-center gap-3">
            {friend.preferred_hand && (
              <View className="flex-row items-center">
                <Ionicons name="hand-left-outline" size={14} color="#888" />
                <Text className="text-sm text-muted-foreground ml-1">{friend.preferred_hand}</Text>
              </View>
            )}
            {friend.court_playing_side && (
              <View className="flex-row items-center">
                <Ionicons name="tennisball-outline" size={14} color="#888" />
                <Text className="text-sm text-muted-foreground ml-1">{friend.court_playing_side}</Text>
              </View>
            )}
          </View>
          
          {/* Activity indicators */}
          {activity && (
            <View className="flex-row items-center gap-2 mt-1">
              {activity.scheduledMatch && (
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={12} color="#10b981" />
                  <Text className="text-xs text-green-600 ml-1">Scheduled match</Text>
                </View>
              )}
              {activity.matchCount > 0 && (
                <Text className="text-xs text-muted-foreground">
                  {activity.matchCount} match{activity.matchCount !== 1 ? 'es' : ''} played
                </Text>
              )}
            </View>
          )}
        </View>
        
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering the card expansion
            router.push({
              pathname: '/(protected)/(screens)/friend-profile',
              params: { friendId: friend.id }
            });
          }}
          className="mr-3 p-2"
        >
          <Ionicons name="person" size={20} color="#1a7ebd" />
        </TouchableOpacity>
        
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color="#888" 
        />
      </View>
      
      {expanded && (
        <View className="mt-4 pt-4 border-t border-border">
          <View className="bg-background/50 rounded p-3">
            <Text className="text-sm text-muted-foreground mb-2">Player Statistics</Text>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="font-bold text-primary">{friend.glicko_rating?.toFixed(0) || '-'}</Text>
                <Text className="text-xs text-muted-foreground">Rating</Text>
              </View>
              <View className="items-center">
                <Text className="font-bold">{friend.age || '-'}</Text>
                <Text className="text-xs text-muted-foreground">Age</Text>
              </View>
            </View>
          </View>
          
          {/* Action buttons */}
          <View className="mt-4 flex-row gap-3">
            <Button
              className="flex-1"
              variant="default"
              onPress={() => {
                router.push({
                  pathname: '/(protected)/(screens)/friend-profile',
                  params: { friendId: friend.id }
                });
              }}
            >
              <Text>View Profile</Text>
            </Button>
            
            {onCreateMatch && (
              <Button
                className="flex-1"
                variant="outline"
                onPress={onCreateMatch}
              >
                <Ionicons name="add-circle-outline" size={16} style={{ marginRight: 4 }} />
                <Text>New Match</Text>
              </Button>
            )}
          </View>
          
          {onViewHistory && activity && activity.matchCount > 0 && (
            <Button
              className="mt-2"
              variant="ghost"
              onPress={onViewHistory}
            >
              <Ionicons name="time-outline" size={16} style={{ marginRight: 4 }} />
              <Text>View Match History</Text>
            </Button>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}