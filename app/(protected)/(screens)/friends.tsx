import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { H1, H3 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Friend {
  id: string;
  email: string;
  full_name: string | null;
  age: string | null;
  preferred_hand: string | null;
  court_playing_side: string | null;
  glicko_rating: number | null;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'denied';
  created_at: string;
  from_user: {
    id: string;
    full_name: string | null;
    email: string;
  };
  to_user: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

interface SearchUser {
  id: string;
  email: string;
  full_name: string | null;
}

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const { profile, session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [session]);

  const fetchFriends = async () => {
    try {
      if (!profile?.friends_list || !Array.isArray(profile.friends_list)) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, age, preferred_hand, court_playing_side, glicko_rating')
        .in('id', profile.friends_list);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          from_user:profiles!from_user_id(id, full_name, email),
          to_user:profiles!to_user_id(id, full_name, email)
        `)
        .eq('to_user_id', session?.user?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFriendRequests(data || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'deny') => {
    try {
      if (action === 'accept') {
        // First, update the status to 'accepted'
        const { data, error } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId)
          .select()
          .single();
  
        if (error) throw error;
  
        // Then manually update the friends lists
        if (data) {
          console.log(data)
          // Update sender's friends list
          await supabase
            .from('profiles')
            .update({ friends_list: [...(profile?.friends_list || []), data.to_user_id] })
            .eq('id', data.from_user_id);
  
          // Update receiver's friends list
          await supabase
            .from('profiles')
            .update({ friends_list: [...(profile?.friends_list || []), data.from_user_id] })
            .eq('id', data.to_user_id);
        }
      }
  
      // Finally, delete the request regardless of action
      await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);
      
      // Refresh data
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

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
        .neq('id', session?.user?.id) // Exclude current user
        .limit(10);

      if (error) throw error;
      
      // Filter out users who are already friends
      const filteredResults = data?.filter(user => 
        !profile?.friends_list?.includes(user.id)
      ) || [];
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      setSentRequests(prev => new Set(prev).add(userId));
      
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: session?.user?.id,
          to_user_id: userId,
          status: 'pending'
        });

      if (error) throw error;
      
      // Remove from search results after successful request
      setSearchResults(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error sending friend request:', error);
      setSentRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const renderFriendCard = (friend: Friend) => {
    const isExpanded = expandedFriend === friend.id;
    
    return (
<TouchableOpacity
  key={friend.id}
  className="bg-card rounded-lg mb-3 p-4"
  onPress={() => setExpandedFriend(isExpanded ? null : friend.id)}
>
  <View className="flex-row items-center">
    <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
      <Text className="text-lg font-bold text-primary-foreground">
        {friend.full_name?.charAt(0)?.toUpperCase() || '?'}
      </Text>
    </View>
    <View className="flex-1">
      <Text className="font-medium">{friend.full_name || friend.email}</Text>
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center">
          <Ionicons name="hand-left-outline" size={14} color="#888" />
          <Text className="text-sm text-muted-foreground ml-1">{friend.preferred_hand}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="tennisball-outline" size={14} color="#888" />
          <Text className="text-sm text-muted-foreground ml-1">{friend.court_playing_side}</Text>
        </View>
      </View>
    </View>
    <Ionicons 
      name={isExpanded ? "chevron-up" : "chevron-down"} 
      size={20} 
      color="#888" 
    />
  </View>
  
  {isExpanded && (
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
    </View>
  )}
</TouchableOpacity>
    );
  };

  const renderRequestCard = (request: FriendRequest) => (
    <View key={request.id} className="bg-card rounded-lg mb-3 p-4">
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
          <Text className="text-lg font-bold text-primary-foreground">
            {request.from_user.full_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-medium">{request.from_user.full_name || request.from_user.email}</Text>
          <Text className="text-sm text-muted-foreground">{formatTimeAgo(request.created_at)}</Text>
        </View>
      </View>
      
      <View className="flex-row gap-3 mt-4">
        <Button
          className="flex-1"
          variant="default"
          onPress={() => handleFriendRequest(request.id, 'accept')}
        >
          <Text>Accept</Text>
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => handleFriendRequest(request.id, 'deny')}
        >
          <Text>Decline</Text>
        </Button>
      </View>
    </View>
  );

  const renderSearchResult = (user: SearchUser) => {
    const isSent = sentRequests.has(user.id);
    
    return (
      <View key={user.id} className="bg-card rounded-lg mb-3 p-4">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
            <Text className="text-lg font-bold text-primary-foreground">
              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
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

  const renderTabButton = (tab: 'friends' | 'requests', label: string) => (
    <TouchableOpacity
      className={`flex-1 py-2 rounded-lg ${activeTab === tab ? 'bg-primary' : 'bg-card'}`}
      onPress={() => setActiveTab(tab)}
    >
      <Text className={`text-center font-medium ${activeTab === tab ? 'text-primary-foreground' : 'text-foreground'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="p-6">
        <View className="flex-row justify-between items-center mb-6">
          <H1>Friends</H1>
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        {/* Tab navigation */}
        <View className="flex-row gap-2 mb-6">
          {renderTabButton('friends', 'My Friends')}
          {renderTabButton('requests', `Requests${friendRequests.length > 0 ? ` (${friendRequests.length})` : ''}`)}
        </View>

        {/* Content based on active tab */}
        {activeTab === 'friends' ? (
          friends.length > 0 ? (
            friends.map(renderFriendCard)
          ) : (
            <View className="bg-card rounded-lg p-6 items-center">
              <Ionicons name="people-outline" size={48} color="#888" />
              <Text className="text-lg font-medium mt-4 mb-2">No friends yet</Text>
              <Text className="text-muted-foreground text-center">
                Connect with other padel players to grow your network
              </Text>
            </View>
          )
        ) : (
          friendRequests.length > 0 ? (
            friendRequests.map(renderRequestCard)
          ) : (
            <View className="bg-card rounded-lg p-6 items-center">
              <Ionicons name="mail-outline" size={48} color="#888" />
              <Text className="text-lg font-medium mt-4 mb-2">No pending requests</Text>
              <Text className="text-muted-foreground text-center">
                You don't have any friend requests at the moment
              </Text>
            </View>
          )
        )}
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddModal}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-background rounded-2xl p-6 w-11/12 max-w-lg">
            <View className="flex-row justify-between items-center mb-6">
              <H1>Add Friend</H1>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
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
              <ActivityIndicator size="small" color="#fbbf24" />
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
    </SafeAreaView>
  );
}