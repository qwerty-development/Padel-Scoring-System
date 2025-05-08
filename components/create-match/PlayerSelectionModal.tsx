import React, { useState, useEffect } from 'react';
import { 
  View, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Friend } from '@/types';

interface PlayerSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  selectedFriends: string[];
  onSelectFriends: (selectedIds: string[]) => void;
  loading: boolean;
}

export function PlayerSelectionModal({
  visible,
  onClose,
  friends,
  selectedFriends,
  onSelectFriends,
  loading
}: PlayerSelectionModalProps) {
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
        if (prev.length < 3) {
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

  const renderFriendItem = (friend: Friend) => {
    const isSelected = localSelectedFriends.includes(friend.id);
    
    return (
      <TouchableOpacity
        key={friend.id}
        style={[
          styles.friendItem,
          isSelected && styles.selectedFriendItem
        ]}
        onPress={() => toggleFriendSelection(friend.id)}
      >
        <View style={styles.avatar}>
          <Text className="text-lg font-bold text-primary-foreground">
            {friend.full_name?.charAt(0)?.toUpperCase() || 
             friend.email.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        
        <View style={styles.friendInfo}>
          <Text className="font-medium">
            {friend.full_name || friend.email.split('@')[0]}
          </Text>
          <Text className="text-sm text-muted-foreground">{friend.email}</Text>
        </View>
        
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text className="text-xl font-bold">Select Players</Text>
            <Text className="text-primary">
              {localSelectedFriends.length}/3 selected
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>
          
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#555" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#555" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Friends list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fbbf24" />
            </View>
          ) : (
            <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
              {filteredFriends.length > 0 ? (
                filteredFriends.map(renderFriendItem)
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color="#888" />
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
              <View style={{ height: 100 }} /> {/* Bottom padding for scrolling */}
            </ScrollView>
          )}
          
          {/* Confirmation buttons */}
          <View style={styles.footer}>
            <Button
              variant="default"
              onPress={handleConfirm}
              disabled={localSelectedFriends.length !== 3}
              className="flex-1 mx-2"
            >
              <Text className="text-primary-foreground">Confirm</Text>
            </Button>
            
            <Button
              variant="outline"
              onPress={onClose}
              className="flex-1 mx-2"
            >
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    height: '90%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 5,
    position: 'absolute',
    right: 15,
    top: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginVertical: 15,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    height: 45,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    color: '#333',
    fontSize: 16,
  },
  friendsList: {
    paddingHorizontal: 20,
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedFriendItem: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
    marginVertical: 5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  friendInfo: {
    flex: 1,
  },
  checkmark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 25,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});