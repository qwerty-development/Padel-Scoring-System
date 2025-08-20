import React, { useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/text";
import { H1, H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";
import { AddFriendButton } from "@/components/friends/AddFriendButton";
import { AddFriendModal } from "@/components/friends/AddFriendModal";
import { FriendSearchBar } from "@/components/friends/FriendSearchBar";
import { FriendCard } from "@/components/friends/FriendCard";
import { FriendLeaderboard } from "@/components/friends/FriendLeaderboard";
import { FriendRequestsModal } from "@/components/friends/FriendRequestModal";
import { Friend, FriendRequest } from "@/types";

// NOTIFICATION INTEGRATION: Import notification helpers
import { NotificationHelpers } from "@/services/notificationHelpers";

// Get screen dimensions for layout calculations
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Match status enum for consistency with the rest of the app
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
}

export default function FriendsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<"friends" | "leaderboard">(
    tab === "leaderboard" ? "leaderboard" : "friends",
  );

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  // Make sure to initialize this to false (it's already there)
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  // Make sure to initialize this to false (it's already there)
  const [friendActivity, setFriendActivity] = useState<{
    [key: string]: {
      lastMatch: string | null;
      scheduledMatch: string | null;
      matchCount: number;
    };
  }>({});
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
    {},
  );

  // Get all available letters for the alphabet navigation
  const availableLetters = Object.keys(friendsByLetter).sort();

  // Sort each section alphabetically
  Object.keys(friendsByLetter).forEach((letter) => {
    friendsByLetter[letter].sort((a, b) => {
      const nameA = (a.full_name || a.email).toUpperCase();
      const nameB = (b.full_name || b.email).toUpperCase();
      return nameA.localeCompare(nameB);
    });
  });

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
            searchQuery.toLowerCase(),
          ) || friend.email.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      if (filtered.length > 0) {
        acc[letter] = filtered;
      }

      return acc;
    },
    {},
  );

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriends();
      fetchFriendRequests();
      fetchSentRequests();
    }
  }, [session]);

  // Fetch friend activity data when friends list changes
  useEffect(() => {
    if (friends.length > 0 && session?.user?.id) {
      fetchFriendActivity();
    }
  }, [friends, session?.user?.id]);

  const fetchFriends = async () => {
    try {
      if (!profile?.friends_list || !Array.isArray(profile.friends_list)) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, age, preferred_hand, court_playing_side, glicko_rating, avatar_url",
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
          from_user:profiles!from_user_id(id, full_name, email, avatar_url),
          to_user:profiles!to_user_id(id, full_name, email, avatar_url)
        `,
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

  const fetchSentRequests = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("friend_requests")
        .select(
          `
          *,
          from_user:profiles!from_user_id(id, full_name, email, avatar_url),
          to_user:profiles!to_user_id(id, full_name, email, avatar_url)
        `,
        )
        .eq("from_user_id", session?.user?.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSentRequests(data || []);
    } catch (error) {
      console.error("Error fetching sent requests:", error);
    }
  };

  const fetchFriendActivity = async () => {
    try {
      if (!session?.user?.id) return;

      // Get all friend IDs
      const friendIds = friends.map((friend) => friend.id);
      if (friendIds.length === 0) return;

      // Query matches where current user and any friend participated
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, player1_id, player2_id, player3_id, player4_id, start_time, status",
        )
        .or(
          `and(player1_id.eq.${session.user.id},or(${friendIds.map((id) => `player2_id.eq.${id},player3_id.eq.${id},player4_id.eq.${id}`).join(",")})),` +
            `and(player2_id.eq.${session.user.id},or(${friendIds.map((id) => `player1_id.eq.${id},player3_id.eq.${id},player4_id.eq.${id}`).join(",")})),` +
            `and(player3_id.eq.${session.user.id},or(${friendIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id},player4_id.eq.${id}`).join(",")})),` +
            `and(player4_id.eq.${session.user.id},or(${friendIds.map((id) => `player1_id.eq.${id},player2_id.eq.${id},player3_id.eq.${id}`).join(",")}))`,
        )
        .order("start_time", { ascending: false });

      if (error) throw error;

      // Process match data to extract friend activity
      const activityData: { [key: string]: any } = {};
      const now = new Date();

      // Initialize activity data for all friends
      friendIds.forEach((id) => {
        activityData[id] = {
          lastMatch: null,
          scheduledMatch: null,
          matchCount: 0,
        };
      });

      // Process each match
      data?.forEach((match) => {
        // Find which friend was in this match
        const matchFriendIds = [
          match.player1_id,
          match.player2_id,
          match.player3_id,
          match.player4_id,
        ].filter((id) => id !== session.user.id && friendIds.includes(id));

        matchFriendIds.forEach((friendId) => {
          if (!friendId) return;

          // Increment match count
          activityData[friendId].matchCount++;

          // Check if this is a scheduled match (in future)
          const matchDate = new Date(match.start_time);
          if (matchDate > now && match.status === MatchStatus.PENDING) {
            if (!activityData[friendId].scheduledMatch) {
              activityData[friendId].scheduledMatch = match.id;
            }
          }
          // Otherwise it's a past match
          else if (!activityData[friendId].lastMatch) {
            activityData[friendId].lastMatch = match.id;
          }
        });
      });

      setFriendActivity(activityData);
    } catch (error) {
      console.error("Error fetching friend activity:", error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchFriends(),
      fetchFriendRequests(),
      fetchSentRequests(),
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const handleFriendRequest = async (
    requestId: string,
    action: "accept" | "deny",
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
          .select(
            "*, from_user:profiles!from_user_id(id, full_name, email, avatar_url)",
          )
          .single();

        if (error) throw error;

        // Add friend relationship for both users
        if (data?.from_user?.id && profile?.id) {
          // Get both users' current friends lists
          const [receiverProfile, senderProfile] = await Promise.all([
            supabase
              .from("profiles")
              .select("friends_list")
              .eq("id", profile.id)
              .single(),
            supabase
              .from("profiles")
              .select("friends_list")
              .eq("id", data.from_user.id)
              .single(),
          ]);

          if (receiverProfile.error || senderProfile.error) {
            throw receiverProfile.error || senderProfile.error;
          }

          const receiverFriendsList = receiverProfile.data.friends_list || [];
          const senderFriendsList = senderProfile.data.friends_list || [];

          // Update both users' friends lists in parallel
          await Promise.all([
            // Add sender to receiver's friends list (if not already there)
            !receiverFriendsList.includes(data.from_user.id) &&
              supabase
                .from("profiles")
                .update({
                  friends_list: [...receiverFriendsList, data.from_user.id],
                })
                .eq("id", profile.id),

            // Add receiver to sender's friends list (if not already there)
            !senderFriendsList.includes(profile.id) &&
              supabase
                .from("profiles")
                .update({
                  friends_list: [...senderFriendsList, profile.id],
                })
                .eq("id", data.from_user.id),
          ]);

          // Send notification to the original sender
          if (profile.full_name) {
            await NotificationHelpers.sendFriendAcceptedNotification(
              data.from_user.id,
              profile.full_name,
            );
          }
        }

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

  const handleCancelRequest = async (requestId: string) => {
    try {
      // Remove from UI immediately
      setSentRequests((prev) => prev.filter((req) => req.id !== requestId));

      // Delete the request
      await supabase.from("friend_requests").delete().eq("id", requestId);
    } catch (error) {
      console.error("Error canceling friend request:", error);
      fetchSentRequests();
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
          py: number,
        ) => {
          scrollViewRef.current?.scrollTo({ y: py, animated: true });
        },
      );
    }
  };

  const renderTabButton = (
    tab: "friends" | "leaderboard" | "requests",
    label: string,
    badge?: number,
  ) => (
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
        {badge && badge > 0 && (
          <View className="ml-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
            <Text className="text-white text-xs font-bold">{badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFriendsAlphabetically = () => {
    const letters = Object.keys(filteredFriends).sort();

    if (letters.length === 0) {
      return (
        <View
          className="bg-card rounded-lg p-6 items-center mt-4 border border-border/40"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <Ionicons name="people-outline" size={48} color="#888" />
          <Text className="text-lg font-medium mt-4 mb-2">
            No friends found
          </Text>
          <Text className="text-muted-foreground text-center">
            {searchQuery
              ? "Try a different search term"
              : "Connect with other players to grow your network"}
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
            activity={friendActivity[friend.id]}
            onCreateMatch={() => {
              router.push({
                pathname: "/(protected)/(screens)/create-match",
                params: { friendId: friend.id },
              });
            }}
            onViewHistory={() => {
              router.push({
                pathname: "/(protected)/(screens)/match-history",
                params: { friendId: friend.id },
              });
            }}
          />
        ))}
      </View>
    ));
  };

  const renderAlphabetSidebar = () => {
    if (availableLetters.length <= 1) return null;

    return (
      <View className="absolute right-1 top-1/2 -translate-y-1/2 bg-card/80 rounded-lg py-1 px-0.5">
        {availableLetters.map((letter) => (
          <TouchableOpacity
            key={letter}
            onPress={() => handleLetterSelect(letter)}
            className={`py-0.5 px-2 ${activeLetter === letter ? "bg-primary rounded-md" : ""}`}
          >
            <Text
              className={`text-xs font-bold ${activeLetter === letter ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {letter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRequestsTab = () => {
    if (friendRequests.length === 0 && sentRequests.length === 0) {
      return (
        <View className="bg-card rounded-lg p-6 items-center mt-4">
          <Ionicons name="mail-outline" size={48} color="#888" />
          <Text className="text-lg font-medium mt-4 mb-2">
            No friend requests
          </Text>
          <Text className="text-muted-foreground text-center mb-4">
            You don't have any pending friend requests
          </Text>
          <Button variant="default" onPress={() => setShowAddModal(true)}>
            <Ionicons name="person-add" size={18} style={{ marginRight: 8 }} />
            <Text>Add Friend</Text>
          </Button>
        </View>
      );
    }

    return (
      <View className="py-4">
        {friendRequests.length > 0 && (
          <>
            <H3 className="mb-3">Incoming Requests</H3>
            {friendRequests.map((request) => (
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
                      {new Date(request.created_at).toLocaleDateString()}
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
            ))}
          </>
        )}

        {sentRequests.length > 0 && (
          <>
            <H3 className="mb-3 mt-6">Sent Requests</H3>
            {sentRequests.map((request) => (
              <View key={request.id} className="bg-card rounded-lg mb-3 p-4">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-4">
                    <Text className="text-lg font-bold text-gray-500">
                      {request.to_user.full_name?.charAt(0)?.toUpperCase() ||
                        request.to_user.email.charAt(0).toUpperCase() ||
                        "?"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium">
                      {request.to_user.full_name || request.to_user.email}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      Sent on{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <Button
                  className="mt-4"
                  variant="outline"
                  onPress={() => handleCancelRequest(request.id)}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    style={{ marginRight: 8 }}
                  />
                  <Text>Cancel Request</Text>
                </Button>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#2148ce" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        {/* Tab navigation */}
        <View className="flex-row">
          {renderTabButton("friends", "Friends")}
          {renderTabButton("leaderboard", "Leaderboard")}
        </View>

        {/* Search bar and action buttons - only show in Friends tab */}
        {activeTab === "friends" && (
          <View className="flex-row px-6 pt-4">
            <View className="w-3/4">
              <FriendSearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => setSearchQuery("")}
              />
            </View>
            <View className="w-1/4">
              <View className="flex-row px-4 gap-3">
                {/* Friend Requests Button */}
                {/* Friend Requests Button */}
                <TouchableOpacity
                  className="w-10 h-10 rounded-full items-center justify-center"
                  onPress={() => setShowRequestsModal(true)}
                >
                  <View className="relative">
                    <Ionicons name="mail-outline" size={24} color="#555" />
                    {friendRequests.length + sentRequests.length > 0 && (
                      <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                        <Text className="text-white text-xs font-bold">
                          {friendRequests.length + sentRequests.length}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Add Friend Button */}
                <AddFriendButton onPress={() => setShowAddModal(true)} />
              </View>
            </View>
          </View>
        )}

        {/* Content based on active tab */}
        <View className="flex-1 relative">
          <ScrollView
            ref={scrollViewRef}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#2148ce"]}
                tintColor="#2148ce"
              />
            }
            className="flex-1 px-6 pt-2"
          >
            {activeTab === "friends" ? (
              renderFriendsAlphabetically()
            ) : activeTab === "leaderboard" ? (
              <FriendLeaderboard
                friends={friends}
                userId={session?.user?.id || ""}
              />
            ) : (
              renderRequestsTab()
            )}

            {/* Add bottom padding */}
            <View className="h-6" />
          </ScrollView>

          {/* Alphabet quick-scroll sidebar - only show in friends tab when we have multiple letter groups */}
          {activeTab === "friends" && renderAlphabetSidebar()}
        </View>
      </View>

      <AddFriendModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        userId={session?.user?.id || ""}
        userProfile={profile}
        onRequestSent={async (toUserId: string) => {
          // NOTIFICATION INTEGRATION: Send friend request notification
          if (profile?.full_name) {
            await NotificationHelpers.sendFriendRequestNotification(
              toUserId,
              profile.full_name,
            );
          }
          fetchSentRequests();
        }}
      />

      {/* Friend Requests Modal - Updated with sent requests support */}
      <FriendRequestsModal
        visible={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        friendRequests={friendRequests}
        sentRequests={sentRequests}
        onHandleRequest={handleFriendRequest}
        onCancelRequest={handleCancelRequest}
      />
    </SafeAreaView>
  );
}
