import React, { useState, useEffect } from 'react';
import { 
  View, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Friend } from '@/types';
import { useColorScheme } from '@/lib/useColorScheme';

interface PlayerSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  selectedFriends: string[];
  onSelectFriends: (selectedIds: string[]) => void;
  loading: boolean;
  maxSelections?: number;
}

export function PlayerSelectionModal({
  visible,
  onClose,
  friends,
  selectedFriends,
  onSelectFriends,
  loading,
  maxSelections = 3
}: PlayerSelectionModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedFriends, setLocalSelectedFriends] = useState<string[]>([]);

  // Reset local selection when modal opens with new props
  useEffect(() => {
    if (visible) {
      setLocalSelectedFriends([...selectedFriends]);
      setSearchQuery('');
    }
  }, [visible, selectedFriends]);

  // Filter friends based on search query
  const filteredFriends = friends.filter(friend => {
    const name = friend.full_name || '';
    const email = friend.email || '';
    const query = searchQuery.toLowerCase();
    
    return name.toLowerCase().includes(query) || 
           email.toLowerCase().includes(query);
  });

  const toggleFriendSelection = (friendId: string) => {
    setLocalSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        if (prev.length < maxSelections) {
          return [...prev, friendId];
        }
        return prev;
      }
    });
  };

  const handleConfirm = () => {
    onSelectFriends(localSelectedFriends);
    onClose();
  };

  const getTeamIndicator = (index: number) => {
    if (index === 0) {
      return (
        <View className="absolute top-0 right-0 bg-primary rounded-full w-5 h-5 items-center justify-center border border-white dark:border-gray-800">
          <Text className="text-[10px] font-bold text-white">T1</Text>
        </View>
      )
    } else {
      return (
        <View className="absolute top-0 right-0 bg-yellow-500 rounded-full w-5 h-5 items-center justify-center border border-white dark:border-gray-800">
          <Text className="text-[10px] font-bold text-white">T2</Text>
        </View>
      )
    }
  };

  const renderFriendItem = (friend: Friend) => {
    const isSelected = localSelectedFriends.includes(friend.id);
    const selectionIndex = localSelectedFriends.indexOf(friend.id);
    
    // Determine team color based on selection order
    const getSelectionStyle = () => {
      if (!isSelected) return "";
      if (selectionIndex === 0) return "bg-primary/10 dark:bg-primary/20 border border-primary"; // Team 1 (blue)
      return "bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-500"; // Team 2 (yellow)
    };
    
    return (
      <TouchableOpacity
        key={friend.id}
        className={`flex-row items-center p-3 mb-2 rounded-xl ${getSelectionStyle()}`}
        onPress={() => toggleFriendSelection(friend.id)}
      >
        <View className="relative">
          <View className="w-12 h-12 rounded-full bg-primary dark:bg-primary/80 items-center justify-center mr-4">
            <Text className="text-lg font-bold text-white">
              {friend.full_name?.charAt(0)?.toUpperCase() || 
              friend.email.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          {isSelected && getTeamIndicator(selectionIndex)}
        </View>
        
        <View className="flex-1">
          <Text className="font-medium">
            {friend.full_name || friend.email.split('@')[0]}
          </Text>
          <Text className="text-sm text-muted-foreground">{friend.email}</Text>
        </View>
        
        {isSelected && (
          <View className={`w-6 h-6 rounded-full items-center justify-center ${selectionIndex === 0 ? 'bg-primary' : 'bg-yellow-500'}`}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Display team composition at the top of modal
  const renderSelectedTeams = () => {
    if (localSelectedFriends.length === 0) return null;
    
    return (
      <View className="px-6 pb-3 pt-1">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-medium text-muted-foreground">Current Selection</Text>
          <TouchableOpacity 
            className="py-1 px-2"
            onPress={() => setLocalSelectedFriends([])}
          >
            <Text className="text-xs text-primary">Clear All</Text>
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-between bg-background dark:bg-gray-800/60 rounded-lg p-3">
          {/* Team 1 */}
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2">
              <Text className="text-sm font-bold text-white">T1</Text>
            </View>
            <View>
              {localSelectedFriends.length > 0 ? (
                <Text className="text-xs" numberOfLines={1}>
                  {getFriendName(localSelectedFriends[0])}
                </Text>
              ) : (
                <Text className="text-xs text-muted-foreground">Not selected</Text>
              )}
            </View>
          </View>
          
          {/* Team 2 */}
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-yellow-500 items-center justify-center mr-2">
              <Text className="text-sm font-bold text-white">T2</Text>
            </View>
            <View>
              {localSelectedFriends.length > 1 ? (
                <Text className="text-xs" numberOfLines={1}>
                  {getFriendName(localSelectedFriends[1])}{localSelectedFriends.length > 2 ? ` + ${getFriendName(localSelectedFriends[2])}` : ''}
                </Text>
              ) : (
                <Text className="text-xs text-muted-foreground">Not selected</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };
  
  // Helper to get friend name
  const getFriendName = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    return friend ? (friend.full_name || friend.email.split('@')[0]) : '';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className={`h-[90%] rounded-t-3xl ${isDark ? 'bg-card' : 'bg-white'} shadow-lg`}>
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-border">
            <View>
              <Text className="text-xl font-bold">Select Players</Text>
              <Text className="text-sm text-muted-foreground">
                {localSelectedFriends.length}/{maxSelections} selected
              </Text>
            </View>
            
            <TouchableOpacity 
              className="w-8 h-8 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-800"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={isDark ? '#ddd' : '#555'} />
            </TouchableOpacity>
          </View>
          
          {/* Selected players summary */}
          {renderSelectedTeams()}
          
          {/* Search bar */}
          <View className="px-6 py-5 mb-2">
            <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 h-12">
              <Ionicons name="search" size={20} color={isDark ? '#aaa' : '#777'} className="mr-2" />
              <TextInput
                className="flex-1 h-full text-foreground"
                placeholder="Search friends..."
                placeholderTextColor={isDark ? '#aaa' : '#888'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={isDark ? '#aaa' : '#777'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Friends list */}
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#1a7ebd" />
            </View>
          ) : (
            <ScrollView 
              className="flex-1 px-6"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {filteredFriends.length > 0 ? (
                filteredFriends.map(renderFriendItem)
              ) : (
                <View className="items-center justify-center py-12">
                  <Ionicons name="people-outline" size={48} color={isDark ? '#777' : '#999'} />
                  <Text className="text-lg font-medium mt-4 mb-2">
                    {searchQuery ? "No results found" : "No friends yet"}
                  </Text>
                  <Text className="text-muted-foreground text-center">
                    {searchQuery 
                      ? "Try a different search term" 
                      : "Add friends to create matches with them"}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
          
          {/* Footer buttons */}
          <View className="p-5 border-t border-border">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={onClose}
              >
                <Text>Cancel</Text>
              </Button>
              
              <Button
                variant="default"
                className="flex-1"
                onPress={handleConfirm}
                disabled={localSelectedFriends.length === 0 || (maxSelections === 3 && localSelectedFriends.length !== 3)}
              >
                <Text className="text-primary-foreground">
                  {localSelectedFriends.length === 0 ? 'Select Players' : 'Confirm Selection'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}