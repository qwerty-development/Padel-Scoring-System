import React from 'react';
import { View, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { FriendRequest } from '@/types';

interface FriendRequestsModalProps {
  visible: boolean;
  onClose: () => void;
  friendRequests: FriendRequest[];
  onHandleRequest: (requestId: string, action: 'accept' | 'deny') => void;
}

export function FriendRequestsModal({
  visible,
  onClose,
  friendRequests,
  onHandleRequest,
}: FriendRequestsModalProps) {
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
    return "just now";
  };

  const renderRequestCard = (request: FriendRequest) => (
    <View key={request.id} className="bg-card rounded-lg mb-3 p-4 border border-border/30" style={{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    }}>
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
          <Text className="text-lg font-bold text-primary-foreground">
            {request.from_user.full_name?.charAt(0)?.toUpperCase() ||
              request.from_user.email.charAt(0).toUpperCase() ||
              "?"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-medium">
            {request.from_user.full_name || request.from_user.email}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {formatTimeAgo(request.created_at)}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3 mt-4">
        <Button
          className="flex-1"
          variant="default"
          onPress={() => onHandleRequest(request.id, "accept")}
        >
          <Text className="text-primary-foreground">Accept</Text>
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onHandleRequest(request.id, "deny")}
        >
          <Text>Decline</Text>
        </Button>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    
    >
      <View className="flex-1 bg-background pt-12">
        <View className="flex-row justify-between items-center px-6 pb-4 border-b border-border">
          <Text className="text-xl font-bold">Friend Requests</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="#555" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6 pt-4">
          {friendRequests.length > 0 ? (
            friendRequests.map(renderRequestCard)
          ) : (
            <View className="bg-card rounded-lg p-6 items-center border border-border/40 my-6" style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <View className="bg-muted/30 p-4 rounded-full mb-4">
                <Ionicons name="mail-outline" size={48} color="#888" />
              </View>
              <Text className="text-lg font-medium mt-2 mb-2">
                No pending requests
              </Text>
              <Text className="text-muted-foreground text-center">
                You don't have any friend requests at the moment
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}