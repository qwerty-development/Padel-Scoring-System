import React, { useState, useEffect } from 'react';
import { 
  View, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator,
  Image,
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

interface UserAvatarProps {
  user: Friend;
  size?: 'sm' | 'md' | 'lg';
  teamIndex?: number;
}

function UserAvatar({ user, size = 'md', teamIndex }: UserAvatarProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  }[size];

  const sizeStyle = {
    sm: { width: 32, height: 32, borderRadius: 16 },
    md: { width: 48, height: 48, borderRadius: 24 },
    lg: { width: 64, height: 64, borderRadius: 32 }
  }[size];

  const textSize = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl'
  }[size];

  // Get the fallback initial
  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  // Get background color based on team
  const getBgColor = () => {
    if (teamIndex === 0) return 'bg-primary'; // Team 1 - Blue
    if (teamIndex === 1 || teamIndex === 2) return 'bg-yellow-500'; // Team 2 - Yellow
    return 'bg-primary'; // Default
  };

  const shouldShowImage = user.avatar_url && !imageLoadError;

  if (shouldShowImage) {
    return (
      <View className={`${sizeClasses} rounded-full ${getBgColor()} items-center justify-center overflow-hidden`}>
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
            <Text className={`${textSize} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback to text initial
  return (
    <View className={`${sizeClasses} rounded-full ${getBgColor()} items-center justify-center`}>
      <Text className={`${textSize} font-bold text-white`}>
        {getInitial()}
      </Text>
    </View>
  );
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
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: isSelected ? 2 : 1 },
          shadowOpacity: isSelected ? 0.1 : 0.05,
          shadowRadius: isSelected ? 3 : 2,
          elevation: isSelected ? 3 : 1,
        }}
      >
        <View className="relative mr-4">
          <UserAvatar 
            user={friend} 
            size="md" 
            teamIndex={isSelected ? selectionIndex : undefined}
          />
          {isSelected && getTeamIndicator(selectionIndex)}
        </View>
        
        <View className="flex-1">
          <Text className="font-medium text-foreground">
            {friend.full_name || friend.email.split('@')[0]}
          </Text>
          <Text className="text-sm text-muted-foreground">{friend.email}</Text>
          
          {/* Additional player info */}
          <View className="flex-row items-center gap-3 mt-1">
            {friend.glicko_rating && (
              <View className="flex-row items-center">
                <Ionicons name="stats-chart" size={12} color="#888" />
                <Text className="text-xs text-muted-foreground ml-1">
                  {friend.glicko_rating.toFixed(0)}
                </Text>
              </View>
            )}
            {friend.preferred_hand && (
              <View className="flex-row items-center">
                <Ionicons name="hand-left-outline" size={12} color="#888" />
                <Text className="text-xs text-muted-foreground ml-1">
                  {friend.preferred_hand}
                </Text>
              </View>
            )}
          </View>
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
        
        <View className="flex-row justify-between bg-background dark:bg-gray-800/60 rounded-lg p-3 border border-border/30">
          {/* Team 1 */}
          <View className="flex-row items-center flex-1">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-3">
              <Text className="text-sm font-bold text-white">T1</Text>
            </View>
            <View className="flex-1">
              {localSelectedFriends.length > 0 ? (
                <View className="flex-row items-center">
                  {(() => {
                    const friend = getFriendById(localSelectedFriends[0]);
                    return friend ? (
                      <>
                        <UserAvatar user={friend} size="sm" teamIndex={0} />
                        <View className="ml-2 flex-1">
                          <Text className="text-xs font-medium" numberOfLines={1}>
                            {getFriendName(localSelectedFriends[0])}
                          </Text>
                        </View>
                      </>
                    ) : null;
                  })()}
                </View>
              ) : (
                <Text className="text-xs text-muted-foreground">Not selected</Text>
              )}
            </View>
          </View>
          
          {/* Divider */}
          <View className="w-px bg-border mx-3 self-stretch" />
          
          {/* Team 2 */}
          <View className="flex-row items-center flex-1">
            <View className="w-8 h-8 rounded-full bg-yellow-500 items-center justify-center mr-3">
              <Text className="text-sm font-bold text-white">T2</Text>
            </View>
            <View className="flex-1">
              {localSelectedFriends.length > 1 ? (
                <View className="flex-row items-center">
                  {(() => {
                    const friend = getFriendById(localSelectedFriends[1]);
                    return friend ? (
                      <>
                        <UserAvatar user={friend} size="sm" teamIndex={1} />
                        <View className="ml-2 flex-1">
                          <Text className="text-xs font-medium" numberOfLines={1}>
                            {getFriendName(localSelectedFriends[1])}
                            {localSelectedFriends.length > 2 ? ` + ${getFriendName(localSelectedFriends[2])}` : ''}
                          </Text>
                        </View>
                      </>
                    ) : null;
                  })()}
                </View>
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

  // Helper to get friend object by ID
  const getFriendById = (friendId: string) => {
    return friends.find(f => f.id === friendId);
  };

  const renderEmptyState = () => (
    <View className="items-center justify-center py-12">
      <View className="bg-muted/30 p-4 rounded-full mb-4">
        <Ionicons name="people-outline" size={48} color={isDark ? '#777' : '#999'} />
      </View>
      <Text className="text-lg font-medium mt-4 mb-2">
        {searchQuery ? "No results found" : "No friends yet"}
      </Text>
      <Text className="text-muted-foreground text-center max-w-xs">
        {searchQuery 
          ? "Try a different search term or check spelling" 
          : "Add friends to create matches with them"}
      </Text>
      {searchQuery && (
        <TouchableOpacity 
          className="mt-3 px-4 py-2 bg-primary/10 rounded-lg"
          onPress={() => setSearchQuery('')}
        >
          <Text className="text-primary text-sm">Clear search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View 
          className={`h-[90%] rounded-t-3xl ${isDark ? 'bg-card' : 'bg-white'} shadow-lg`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-border">
            <View>
              <Text className="text-xl font-bold">Select Players</Text>
              <Text className="text-sm text-muted-foreground">
                {localSelectedFriends.length}/{maxSelections} selected • {filteredFriends.length} available
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
          <View className="px-6 py-3 mb-2">
            <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 h-12 border border-border/50">
              <Ionicons name="search" size={20} color={isDark ? '#aaa' : '#777'} />
              <TextInput
                className="flex-1 h-full text-foreground ml-3"
                placeholder="Search friends..."
                placeholderTextColor={isDark ? '#aaa' : '#888'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
                  <Ionicons name="close-circle" size={20} color={isDark ? '#aaa' : '#777'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Friends list */}
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#1a7ebd" />
              <Text className="text-muted-foreground mt-3">Loading friends...</Text>
            </View>
          ) : (
            <ScrollView 
              className="flex-1 px-6"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ 
                paddingBottom: 100,
                flexGrow: filteredFriends.length === 0 ? 1 : 0 
              }}
            >
              {filteredFriends.length > 0 ? (
                <>
                  {/* Selection hint */}
                  {localSelectedFriends.length < maxSelections && (
                    <View className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <Text className="text-xs text-blue-700 dark:text-blue-300 text-center">
                        Select {maxSelections === 3 ? '3 players: 1 for Team 1, 2 for Team 2' : `${maxSelections} players`}
                      </Text>
                    </View>
                  )}
                  
                  {filteredFriends.map(renderFriendItem)}
                </>
              ) : (
                renderEmptyState()
              )}
            </ScrollView>
          )}
          
          {/* Footer buttons */}
          <View 
            className="p-5 border-t border-border bg-background/95"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={onClose}
              >
                <Ionicons name="close-outline" size={16} style={{ marginRight: 4 }} />
                <Text>Cancel</Text>
              </Button>
              
              <Button
                variant="default"
                className="flex-1"
                onPress={handleConfirm}
                disabled={localSelectedFriends.length === 0 || (maxSelections === 3 && localSelectedFriends.length !== 3)}
              >
                <Ionicons name="checkmark-circle" size={16} style={{ marginRight: 4 }} />
                <Text className="text-primary-foreground">
                  {localSelectedFriends.length === 0 
                    ? 'Select Players' 
                    : maxSelections === 3 && localSelectedFriends.length !== 3
                      ? `Select ${3 - localSelectedFriends.length} More`
                      : 'Confirm Selection'
                  }
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}