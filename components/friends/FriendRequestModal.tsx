import React, { useState } from 'react';
import { View, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { FriendRequest } from '@/types';

interface FriendRequestsModalProps {
  visible: boolean;
  onClose: () => void;
  friendRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  onHandleRequest: (requestId: string, action: 'accept' | 'deny') => void;
  onCancelRequest: (requestId: string) => void;
}

interface RequestUserAvatarProps {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  size?: 'sm' | 'md' | 'lg';
}

function RequestUserAvatar({ user, size = 'md' }: RequestUserAvatarProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Define size configurations with explicit dimensions
  const sizeConfigurations = {
    sm: {
      containerClass: 'w-8 h-8',
      style: { width: 32, height: 32, borderRadius: 16 },
      textClass: 'text-sm'
    },
    md: {
      containerClass: 'w-12 h-12',
      style: { width: 48, height: 48, borderRadius: 24 },
      textClass: 'text-lg'
    },
    lg: {
      containerClass: 'w-16 h-16',
      style: { width: 64, height: 64, borderRadius: 32 },
      textClass: 'text-xl'
    }
  };

  const config = sizeConfigurations[size];

  // Extract fallback initial with comprehensive logic
  const getFallbackInitial = (): string => {
    // Priority order: full_name -> email -> fallback character
    if (user.full_name?.trim()) {
      const trimmedName = user.full_name.trim();
      return trimmedName.charAt(0).toUpperCase();
    }
    
    if (user.email?.trim()) {
      return user.email.charAt(0).toUpperCase();
    }
    
    return '?';
  };

  // Determine if avatar image should be displayed
  const shouldDisplayAvatarImage = Boolean(
    user.avatar_url && 
    user.avatar_url.trim() && 
    !imageLoadError
  );

  // Handle image loading completion
  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Handle image loading failure with comprehensive error logging
  const handleImageError = () => {
    console.warn(`Avatar load failed for user ${user.id}:`, {
      userId: user.id,
      avatarUrl: user.avatar_url,
      userName: user.full_name || user.email,
      timestamp: new Date().toISOString()
    });
    
    setImageLoadError(true);
    setImageLoading(false);
  };

  // Handle image loading initiation
  const handleImageLoadStart = () => {
    setImageLoading(true);
  };

  // Render avatar image with loading states
  if (shouldDisplayAvatarImage) {
    return (
      <View className={`${config.containerClass} rounded-full bg-primary items-center justify-center overflow-hidden mr-4`}>
        <Image
          source={{ uri: user.avatar_url }}
          style={config.style}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
          onLoadStart={handleImageLoadStart}
        />
        
        {/* Loading state overlay with matching background */}
        {imageLoading && (
          <View 
            className="absolute inset-0 bg-primary items-center justify-center"
            style={{
              backgroundColor: 'rgba(26, 126, 189, 0.8)',
            }}
          >
            <Text className={`${config.textClass} font-bold text-primary-foreground`}>
              {getFallbackInitial()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Render fallback text initial avatar
  return (
    <View className={`${config.containerClass} rounded-full bg-primary items-center justify-center mr-4`}>
      <Text className={`${config.textClass} font-bold text-primary-foreground`}>
        {getFallbackInitial()}
      </Text>
    </View>
  );
}

export function FriendRequestsModal({
  visible,
  onClose,
  friendRequests,
  sentRequests,
  onHandleRequest,
  onCancelRequest,
}: FriendRequestsModalProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'sent'>('incoming');
  
  // Format timestamp with comprehensive time calculation
  const formatTimestamp = (dateString: string): string => {
    try {
      const requestDate = new Date(dateString);
      const currentDate = new Date();
      const timeDifferenceMs = currentDate.getTime() - requestDate.getTime();

      // Validate date parsing
      if (isNaN(requestDate.getTime())) {
        console.warn('Invalid date string provided:', dateString);
        return 'Unknown time';
      }

      // Calculate time units with precise mathematics
      const secondsDiff = Math.floor(timeDifferenceMs / 1000);
      const minutesDiff = Math.floor(secondsDiff / 60);
      const hoursDiff = Math.floor(minutesDiff / 60);
      const daysDiff = Math.floor(hoursDiff / 24);
      const weeksDiff = Math.floor(daysDiff / 7);
      const monthsDiff = Math.floor(daysDiff / 30);

      // Return formatted time string with appropriate granularity
      if (monthsDiff > 0) return `${monthsDiff}mo ago`;
      if (weeksDiff > 0) return `${weeksDiff}w ago`;
      if (daysDiff > 0) return `${daysDiff}d ago`;
      if (hoursDiff > 0) return `${hoursDiff}h ago`;
      if (minutesDiff > 0) return `${minutesDiff}m ago`;
      return "just now";
      
    } catch (error) {
      console.error('Error formatting timestamp:', error, 'Original value:', dateString);
      return 'Unknown time';
    }
  };

  // Render tab button
  const renderTabButton = (tab: 'incoming' | 'sent', label: string, count: number) => (
    <TouchableOpacity
      className={`flex-1 py-3 ${
        activeTab === tab
          ? "border-b-2 border-primary"
          : "border-b border-border"
      }`}
      onPress={() => setActiveTab(tab)}
    >
      <View className="flex-row justify-center items-center">
        <Text
          className={`text-center font-medium ${
            activeTab === tab ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {label}
        </Text>
        {count > 0 && (
          <View className="ml-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render individual incoming friend request card
  const renderIncomingRequestCard = (request: FriendRequest) => {
    // Validate request structure to prevent runtime errors
    if (!request?.from_user) {
      console.error('Invalid friend request structure:', request);
      return null;
    }

    return (
      <View 
        key={request.id} 
        className="bg-card rounded-lg mb-3 p-4 border border-border/30" 
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        {/* User information section */}
        <View className="flex-row items-center">
          <RequestUserAvatar user={request.from_user} size="md" />
          
          <View className="flex-1">
            <Text className="font-medium text-foreground">
              {request.from_user.full_name || request.from_user.email}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {request.from_user.email}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              {formatTimestamp(request.created_at)}
            </Text>
          </View>
        </View>

        {/* Action buttons section */}
        <View className="flex-row gap-3 mt-4">
          <Button
            className="flex-1"
            variant="default"
            onPress={() => onHandleRequest(request.id, "accept")}
          >
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text className="text-primary-foreground font-medium">Accept</Text>
            </View>
          </Button>
          
          <Button
            className="flex-1"
            variant="outline"
            onPress={() => onHandleRequest(request.id, "deny")}
          >
            <View className="flex-row items-center">
              <Ionicons name="close-circle-outline" size={16} color="#2148ce" style={{ marginRight: 4 }} />
              <Text className="text-foreground font-medium">Decline</Text>
            </View>
          </Button>
        </View>
      </View>
    );
  };

  // Render individual sent friend request card
  const renderSentRequestCard = (request: FriendRequest) => {
    // Validate request structure to prevent runtime errors
    if (!request?.to_user) {
      console.error('Invalid sent request structure:', request);
      return null;
    }

    return (
      <View 
        key={request.id} 
        className="bg-card rounded-lg mb-3 p-4 border border-border/30" 
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        {/* User information section */}
        <View className="flex-row items-center">
          <RequestUserAvatar user={request.to_user} size="md" />
          
          <View className="flex-1">
            <Text className="font-medium text-foreground">
              {request.to_user.full_name || request.to_user.email}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {request.to_user.email}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Sent {formatTimestamp(request.created_at)}
            </Text>
          </View>
          
          {/* Pending status indicator */}
          <View className="bg-yellow-100 px-2 py-1 rounded-full">
            <Text className="text-xs text-yellow-800 font-medium">Pending</Text>
          </View>
        </View>

        {/* Cancel button */}
        <Button
          className="mt-4"
          variant="outline"
          onPress={() => onCancelRequest(request.id)}
        >
          <View className="flex-row items-center">
            <Ionicons name="close-circle-outline" size={16} color="#dc2626" style={{ marginRight: 4 }} />
            <Text className="text-red-600 font-medium">Cancel Request</Text>
          </View>
        </Button>
      </View>
    );
  };

  // Render empty state for incoming requests
  const renderIncomingEmptyState = () => (
    <View 
      className="bg-card rounded-lg p-6 items-center border border-border/40 my-6" 
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="bg-muted/30 p-4 rounded-full mb-4">
        <Ionicons name="mail-outline" size={48} color="#888" />
      </View>
      <Text className="text-lg font-medium mt-2 mb-2 text-foreground">
        No incoming requests
      </Text>
      <Text className="text-muted-foreground text-center leading-5">
        You don't have any friend requests at the moment.{'\n'}
        New requests will appear here when received.
      </Text>
    </View>
  );

  // Render empty state for sent requests
  const renderSentEmptyState = () => (
    <View 
      className="bg-card rounded-lg p-6 items-center border border-border/40 my-6" 
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="bg-muted/30 p-4 rounded-full mb-4">
        <Ionicons name="paper-plane-outline" size={48} color="#888" />
      </View>
      <Text className="text-lg font-medium mt-2 mb-2 text-foreground">
        No sent requests
      </Text>
      <Text className="text-muted-foreground text-center leading-5">
        You haven't sent any friend requests yet.{'\n'}
        Sent requests will appear here.
      </Text>
    </View>
  );

  const totalRequests = friendRequests.length + sentRequests.length;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-background">
        {/* Header section with enhanced styling */}
        <View 
          className="px-6 pt-12 pb-4 border-b border-border bg-background"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-xl font-bold text-foreground">Friend Requests</Text>
              {totalRequests > 0 && (
                <Text className="text-sm text-muted-foreground mt-1">
                  {totalRequests} total request{totalRequests !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            
            <TouchableOpacity 
              onPress={onClose} 
              className="p-2 rounded-full bg-muted/20"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1,
                elevation: 1,
              }}
            >
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab navigation */}
        <View className="flex-row bg-background border-b border-border">
          {renderTabButton('incoming', 'Incoming', friendRequests.length)}
          {renderTabButton('sent', 'Sent', sentRequests.length)}
        </View>

        {/* Content section with scroll functionality */}
        <ScrollView 
          className="flex-1 px-6 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {activeTab === 'incoming' ? (
            friendRequests.length > 0 
              ? friendRequests.map(renderIncomingRequestCard)
              : renderIncomingEmptyState()
          ) : (
            sentRequests.length > 0 
              ? sentRequests.map(renderSentRequestCard)
              : renderSentEmptyState()
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}