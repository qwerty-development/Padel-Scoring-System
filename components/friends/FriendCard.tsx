import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Friend } from '@/types';

interface FriendCardProps {
  friend: Friend;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

export function FriendCard({ friend, expanded, onToggleExpand }: FriendCardProps) {
  return (
    <TouchableOpacity
      className="bg-card rounded-lg mb-3 p-4"
      onPress={() => onToggleExpand(friend.id)}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
          <Text className="text-lg font-bold text-primary-foreground">
            {friend.full_name?.charAt(0)?.toUpperCase() || friend.email.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
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
          <Ionicons name="person" size={20} color="#fbbf24" />
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
          <View className="mt-4 flex-row">
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
              <Text>View Full Profile</Text>
            </Button>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}