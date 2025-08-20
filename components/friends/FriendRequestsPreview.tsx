import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { FriendRequest } from "@/types";

interface FriendRequestsPreviewProps {
  requests: FriendRequest[];
  onAccept: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onViewAll: () => void;
}

export function FriendRequestsPreview({
  requests,
  onAccept,
  onDeny,
  onViewAll,
}: FriendRequestsPreviewProps) {
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
    <View key={request.id} className="bg-card rounded-lg mb-3 p-4">
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
          onPress={() => onAccept(request.id)}
        >
          <Text>Accept</Text>
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => onDeny(request.id)}
        >
          <Text>Decline</Text>
        </Button>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View className="bg-card rounded-lg p-6 items-center">
      <Ionicons name="mail-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">No pending requests</Text>
      <Text className="text-muted-foreground text-center">
        You don't have any friend requests at the moment
      </Text>
    </View>
  );

  if (requests.length === 0) {
    return null;
  }

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <H3>Friend Requests</H3>
        {requests.length > 2 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text className="text-primary">See All</Text>
          </TouchableOpacity>
        )}
      </View>

      {requests.length > 0
        ? requests.slice(0, 2).map(renderRequestCard)
        : renderEmptyState()}
    </View>
  );
}
