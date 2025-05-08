import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { H3 } from '@/components/ui/typography';
import { FriendCard } from './FriendCard';
import { Friend } from '@/types';

interface FriendsPreviewProps {
  friends: Friend[];
  title?: string;
}

export function FriendsPreview({ friends, title = "Friends" }: FriendsPreviewProps) {
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);

  const handleToggleExpand = (id: string) => {
    setExpandedFriend(expandedFriend === id ? null : id);
  };

  const renderEmptyState = () => (
    <View className="bg-card rounded-xl p-6 items-center">
      <Ionicons name="people-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">No friends yet</Text>
      <Text className="text-muted-foreground text-center">
        Connect with other padel players to grow your network
      </Text>
    </View>
  );

  // Display just first 3 friends in preview
  const previewFriends = friends.slice(0, 3);

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <H3></H3>
        {friends.length > 0 && (
          <TouchableOpacity 
            onPress={() => router.push('/(protected)/(screens)/friends')}
          >
            <Text className="text-primary">See All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {previewFriends.length > 0 
        ? previewFriends.map(friend => (
            <FriendCard
              key={friend.id}
              friend={friend}
              expanded={expandedFriend === friend.id}
              onToggleExpand={handleToggleExpand}
            />
          ))
        : renderEmptyState()
      }
    </View>
  );
}