import React, { useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";
import { AddFriendButton } from "@/components/friends/AddFriendButton";
import { AddFriendModal } from "@/components/friends/AddFriendModal";
import { FriendSearchBar } from "@/components/friends/FriendSearchBar";
import { FriendCard } from "@/components/friends/FriendCard";
import { Friend, FriendRequest } from "@/types";

export default function FriendsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<"friends" | "requests">(
    tab === "requests" ? "requests" : "friends"
  );
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: any }>({});

  const { profile, session } = useAuth();

  // Organize friends by letter sections
  const friendsByLetter = friends.reduce(
    (acc: Record<string, Friend[]>, friend) => {
      // Get the first letter of name or email
      const name = friend.full_name || friend.email;
      const firstLetter = name.charAt(0).toUpperCase();

      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }

      acc[firstLetter].push(friend);
      return acc;
    },
    {}
  );

  // Sort each section alphabetically
  Object.keys(friendsByLetter).forEach((letter) => {
    friendsByLetter[letter].sort((a, b) => {
      const nameA = (a.full_name || a.email).toUpperCase();
      const nameB = (b.full_name || b.email).toUpperCase();
      return nameA.localeCompare(nameB);
    });
  });

  // Get available letters (ones that have friends)
  const availableLetters = new Set(Object.keys(friendsByLetter));

  // Filter friends based on search query
  const filteredFriends = Object.entries(friendsByLetter).reduce(
    (acc: Record<string, Friend[]>, [letter, letterFriends]) => {
      if (!searchQuery) {
        acc[letter] = letterFriends;
        return acc;
      }

      const filtered = letterFriends.filter(
        (friend) =>
          (friend.full_name?.toLowerCase() || "").includes(
            searchQuery.toLowerCase()
          ) || friend.email.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (filtered.length > 0) {
        acc[letter] = filtered;
      }

      return acc;
    },
    {}
  );

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
        .from("profiles")
        .select(
          "id, email, full_name, age, preferred_hand, court_playing_side, glicko_rating"
        )
        .in("id", profile.friends_list);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .select(
          `
          *,
          from_user:profiles!from_user_id(id, full_name, email),
          to_user:profiles!to_user_id(id, full_name, email)
        `
        )
        .eq("to_user_id", session?.user?.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFriendRequests(data || []);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchFriends(), fetchFriendRequests()]).finally(() =>
      setRefreshing(false)
    );
  };

  const handleFriendRequest = async (
    requestId: string,
    action: "accept" | "deny"
  ) => {
    try {
      // Remove the request from the UI immediately
      setFriendRequests((prev) => prev.filter((req) => req.id !== requestId));

      if (action === "accept") {
        // Update the status to 'accepted'
        const { data, error } = await supabase
          .from("friend_requests")
          .update({ status: "accepted" })
          .eq("id", requestId)
          .select("*, from_user:profiles!from_user_id(id, full_name, email)")
          .single();

        if (error) throw error;

        // Add to local friends list immediately for UI responsiveness
        if (data && data.from_user) {
          const newFriend = {
            id: data.from_user.id,
            email: data.from_user.email,
            full_name: data.from_user.full_name,
            age: null,
            preferred_hand: null,
            court_playing_side: null,
            glicko_rating: null,
          };
          setFriends((prev) => [...prev, newFriend]);
        }
      }

      // Delete the request
      await supabase.from("friend_requests").delete().eq("id", requestId);

      // Refresh friends list after a short delay
      setTimeout(fetchFriends, 1000);
    } catch (error) {
      console.error("Error handling friend request:", error);
      fetchFriendRequests();
    }
  };

  const handleLetterSelect = (letter: string) => {
    setActiveLetter(letter);
    if (scrollViewRef.current && sectionRefs.current[letter]) {
      sectionRefs.current[letter].measure(
        (
          fx: number,
          fy: number,
          width: number,
          height: number,
          px: number,
          py: number
        ) => {
          scrollViewRef.current?.scrollTo({ y: py, animated: true });
        }
      );
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
          onPress={() => handleFriendRequest(request.id, "accept")}
        >
          <Text>Accept</Text>
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onPress={() => handleFriendRequest(request.id, "deny")}
        >
          <Text>Decline</Text>
        </Button>
      </View>
    </View>
  );

  const renderTabButton = (tab: "friends" | "requests", label: string) => (
    <TouchableOpacity
      className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : "bg-card"}`}
      onPress={() => setActiveTab(tab)}
    >
      <Text
        className={`text-center font-medium ${activeTab === tab ? "text-primary-foreground" : "text-foreground"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderFriendsAlphabetically = () => {
    const letters = Object.keys(filteredFriends).sort();

    if (letters.length === 0) {
      return (
        <View className="bg-card rounded-lg p-6 items-center">
          <Ionicons name="people-outline" size={48} color="#888" />
          <Text className="text-lg font-medium mt-4 mb-2">
            No friends found
          </Text>
          <Text className="text-muted-foreground text-center">
            {searchQuery
              ? "Try a different search term"
              : "Connect with other padel players to grow your network"}
          </Text>
        </View>
      );
    }

    return letters.map((letter) => (
      <View key={letter} ref={(ref) => (sectionRefs.current[letter] = ref)}>
        <View className="px-2 py-1 bg-background/80 sticky top-0 z-10">
          <Text className="text-sm font-bold text-muted-foreground">
            {letter}
          </Text>
        </View>

        {filteredFriends[letter].map((friend) => (
          <FriendCard
            key={friend.id}
            friend={friend}
            expanded={expandedFriend === friend.id}
            onToggleExpand={setExpandedFriend}
          />
        ))}
      </View>
    ));
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1a7ebd" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 p-6">
        {/* Tab navigation */}
        <View className="flex-row gap-2 mb-4">
          {renderTabButton("friends", "My Friends")}
          {renderTabButton(
            "requests",
            `Requests${friendRequests.length > 0 ? ` (${friendRequests.length})` : ""}`
          )}
        </View>

        {activeTab === "friends" && (
          <View className="flex-row">
            <View className="w-5/6">
            <FriendSearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery("")}
            />
              </View>
              <View className="items-center w-1/6">
              <AddFriendButton onPress={() => setShowAddModal(true)} />
                </View>

          </View>
        )}

        {/* Content based on active tab */}
        <ScrollView
          ref={scrollViewRef}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#1a7ebd"]}
              tintColor="#1a7ebd"
            />
          }
          className="flex-1"
        >
          {activeTab === "friends" ? (
            renderFriendsAlphabetically()
          ) : friendRequests.length > 0 ? (
            friendRequests.map(renderRequestCard)
          ) : (
            <View className="bg-card rounded-lg p-6 items-center">
              <Ionicons name="mail-outline" size={48} color="#888" />
              <Text className="text-lg font-medium mt-4 mb-2">
                No pending requests
              </Text>
              <Text className="text-muted-foreground text-center">
                You don't have any friend requests at the moment
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Add Friend Modal */}
      <AddFriendModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        userId={session?.user?.id || ""}
        userProfile={profile}
      />
    </SafeAreaView>
  );
}
