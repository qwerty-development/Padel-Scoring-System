import React from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Avatar } from "@/components/ui/avatar";
import { FriendActivity } from "@/types/dashboard";

interface FriendsActivityProps {
  friendsActivity: FriendActivity[];
}

export const FriendsActivitySection: React.FC<FriendsActivityProps> = ({
  friendsActivity,
}) => {
  const router = useRouter();

  if (friendsActivity.length === 0) return null;

  return (
    <View className="mb-8">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Friends Activity
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(protected)/(tabs)/friends")}
          className="flex-row items-center"
        >
          <Text className="text-blue-600 text-sm mr-1">View All</Text>
          <Ionicons name="chevron-forward" size={14} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {friendsActivity.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            className="bg-card dark:bg-gray-800 rounded-xl p-4 mr-3 w-32 border border-gray-100 dark:border-gray-700"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
            onPress={() =>
              router.push({
                pathname: "/(protected)/(screens)/friend-profile",
                params: { friendId: friend.id },
              })
            }
          >
            <View className="items-center mb-3">
              <Avatar
                user={friend}
                size="lg"
                showShadow={true}
                showBorder={true}
                borderColor="#3B82F6"
              />
            </View>
            <Text
              className="text-sm font-medium text-center text-gray-900 dark:text-gray-100"
              numberOfLines={1}
            >
              {friend.full_name || friend.email.split("@")[0]}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Rating:{" "}
              {friend.glicko_rating
                ? Math.round(parseFloat(friend.glicko_rating))
                : "-"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};
