import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { H1 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { supabase } from '@/config/supabase';
import { Profile } from '@/types';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userProfile: Profile | null;
}

interface SearchUser {
  id: string;
  email: string;
  full_name: string | null;
}

export function AddFriendModal({ visible, onClose, userId, userProfile }: AddFriendModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', query.toLowerCase())
        .neq('id', userId) // Exclude current user
        .limit(10);

      if (error) throw error;
      
      // Filter out users who are already friends
      const filteredResults = data?.filter(user => 
        !userProfile?.friends_list?.includes(user.id)
      ) || [];
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    try {
      setSentRequests(prev => new Set(prev).add(targetUserId));
      
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: userId,
          to_user_id: targetUserId,
          status: 'pending'
        });

      if (error) throw error;
      
      // Remove from search results after successful request
      setSearchResults(prev => prev.filter(user => user.id !== targetUserId));
    } catch (error) {
      console.error('Error sending friend request:', error);
      setSentRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const renderSearchResult = (user: SearchUser) => {
    const isSent = sentRequests.has(user.id);
    
    return (
      <View key={user.id} className="bg-card rounded-lg mb-3 p-4">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
            <Text className="text-lg font-bold text-primary-foreground">
              {user.full_name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-medium">{user.full_name || user.email}</Text>
            <Text className="text-sm text-muted-foreground">{user.email}</Text>
          </View>
          <Button
            variant={isSent ? "secondary" : "default"}
            onPress={() => sendFriendRequest(user.id)}
            disabled={isSent}
          >
            <Text>{isSent ? 'Sent' : 'Add Friend'}</Text>
          </Button>
        </View>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-background rounded-2xl p-6 w-11/12 max-w-lg">
          <View className="flex-row justify-between items-center mb-6">
            <H1>Add Friend</H1>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center mb-6">
            <View className="flex-1 mr-3">
              <TextInput
                className="bg-card border-2 border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="Search by email"
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
            <Button 
              variant="default"
              onPress={() => searchUsers(searchQuery)}
              disabled={searchLoading}
            >
              <Text>Search</Text>
            </Button>
          </View>

          {searchLoading ? (
            <ActivityIndicator size="small" color="#1a7ebd" />
          ) : (
            <ScrollView style={{ maxHeight: 300 }}>
              {searchResults.map(renderSearchResult)}
              {searchResults.length === 0 && searchQuery && (
                <Text className="text-center text-muted-foreground">
                  No users found with this email
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}