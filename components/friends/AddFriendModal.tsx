import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { supabase } from "@/config/supabase";
import { Profile } from "@/types";

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userProfile: Profile | null;
  onRequestSent?: () => void;
}

interface SearchUser {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

interface UserAvatarProps {
  user: SearchUser;
  size?: "sm" | "md" | "lg";
}

function UserAvatar({ user, size = "md" }: UserAvatarProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }[size];

  const sizeStyle = {
    sm: { width: 32, height: 32, borderRadius: 16 },
    md: { width: 48, height: 48, borderRadius: 24 },
    lg: { width: 64, height: 64, borderRadius: 32 },
  }[size];

  const textSize = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  }[size];

  // Get the fallback initial
  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    if (user.nickname?.trim()) {
      return user.nickname.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "?";
  };

  const shouldShowImage = user.avatar_url && !imageLoadError;

  if (shouldShowImage) {
    return (
      <View
        className={`${sizeClasses} rounded-full bg-primary items-center justify-center overflow-hidden`}
      >
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
            className="absolute inset-0 bg-primary items-center justify-center"
            style={{
              backgroundColor: "rgba(26, 126, 189, 0.8)",
            }}
          >
            <Text className={`${textSize} font-bold text-primary-foreground`}>
              {getInitial()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback to text initial
  return (
    <View
      className={`${sizeClasses} rounded-full bg-primary items-center justify-center`}
    >
      <Text className={`${textSize} font-bold text-primary-foreground`}>
        {getInitial()}
      </Text>
    </View>
  );
}

export function AddFriendModal({
  visible,
  onClose,
  userId,
  userProfile,
  onRequestSent,
}: AddFriendModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
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
        .from("profiles")
        .select("id, email, full_name, nickname, avatar_url") // Include avatar_url in select
        .or(`full_name.ilike.%${query}%,nickname.ilike.%${query}%`) // Search by full_name or nickname (case-insensitive like)
        .neq("id", userId) // Exclude current user
        .limit(10);

      if (error) throw error;

      setSearchResults(data || []); // Keep all results, including existing friends
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    try {
      setSentRequests((prev) => new Set(prev).add(targetUserId));

      const { error } = await supabase.from("friend_requests").insert({
        from_user_id: userId,
        to_user_id: targetUserId,
        status: "pending",
      });

      if (error) throw error;

      // Call the callback to refresh sent requests in parent component
      if (onRequestSent) {
        onRequestSent();
      }

      // Remove from search results after successful request
      setSearchResults((prev) =>
        prev.filter((user) => user.id !== targetUserId),
      );
    } catch (error) {
      console.error("Error sending friend request:", error);
      setSentRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const renderSearchResult = (user: SearchUser) => {
    const isSent = sentRequests.has(user.id);
    const isAlreadyFriend = userProfile?.friends_list?.includes(user.id);

    return (
      <View
        key={user.id}
        className="bg-card rounded-lg mb-3 p-4 border border-border/30"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center">
          <View className="mr-4">
            <UserAvatar user={user} size="md" />
          </View>
          <View className="flex-1">
            <Text className="font-medium">
              {user.full_name || user.nickname || user.email}
            </Text>
            <Text className="text-sm text-muted-foreground">{user.email}</Text>
            {user.nickname && user.full_name && (
              <Text className="text-xs text-muted-foreground">
                Nickname: {user.nickname}
              </Text>
            )}
          </View>
          {isAlreadyFriend ? (
            <Button variant="outline" disabled>
              <Ionicons
                name="checkmark-circle"
                size={16}
                style={{ marginRight: 4 }}
              />
              <Text>Friends</Text>
            </Button>
          ) : (
            <Button
              variant={isSent ? "secondary" : "default"}
              onPress={() => sendFriendRequest(user.id)}
              disabled={isSent}
            >
              {isSent ? (
                <>
                  <Ionicons
                    name="checkmark"
                    size={16}
                    style={{ marginRight: 4 }}
                  />
                  <Text>Sent</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="person-add"
                    size={16}
                    style={{ marginRight: 4 }}
                  />
                  <Text>Add Friend</Text>
                </>
              )}
            </Button>
          )}
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
        <View
          className="bg-background rounded-2xl p-6 w-11/12 max-w-lg"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View className="flex-row justify-between items-center mb-6">
            <H1>Add Friend</H1>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-6">
            <View className="flex-1 mr-3">
              <TextInput
                className="bg-card border-2 border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="Search by name or nickname"
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default" // Changed keyboard type as it's no longer just email
              />
            </View>
            <Button
              variant="default"
              onPress={() => searchUsers(searchQuery)}
              disabled={searchLoading}
            >
              {searchLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name="search"
                    size={16}
                    style={{ marginRight: 4 }}
                  />
                  <Text>Search</Text>
                </>
              )}
            </Button>
          </View>

          {searchLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#2148ce" />
              <Text className="text-muted-foreground mt-2">
                Searching users...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
            >
              {searchResults.map(renderSearchResult)}
              {searchResults.length === 0 && searchQuery && (
                <View className="py-8 items-center">
                  <Ionicons name="search-outline" size={48} color="#888" />
                  <Text className="text-center text-muted-foreground mt-4">
                    No users found with this name or nickname
                  </Text>
                  <Text className="text-center text-muted-foreground text-sm mt-2">
                    Try searching for different keywords
                  </Text>
                </View>
              )}
              {searchResults.length === 0 && !searchQuery && (
                <View className="py-8 items-center">
                  <Ionicons name="person-add-outline" size={48} color="#888" />
                  <Text className="text-center text-muted-foreground mt-4">
                    Search for friends by their name or nickname
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
