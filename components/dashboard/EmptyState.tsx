import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

export const EmptyState: React.FC = () => {
  const router = useRouter();

  return (
    <View className="items-center justify-center py-16">
      <View className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-6">
        <Ionicons name="tennisball-outline" size={40} color="#9CA3AF" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Welcome to Padel!
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-8 px-6 leading-6">
        Start your padel journey by creating your first match or connecting with
        friends. Your match history and stats will appear here as you play.
      </Text>

      <View className="w-full px-6 gap-4">
        <Button
          onPress={() => router.push("/(protected)/(screens)/create-match")}
          className="w-full bg-blue-500 hover:bg-blue-600"
          style={{
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">
            Create Your First Match
          </Text>
        </Button>

        <Button
          variant="outline"
          onPress={() => router.push("/(protected)/(tabs)/friends")}
          className="w-full"
        >
          <Ionicons name="people" size={18} style={{ marginRight: 8 }} />
          <Text className="font-medium">Find Friends to Play With</Text>
        </Button>

        <Button
          variant="outline"
          onPress={() => router.push("/(protected)/(screens)/leaderboard")}
          className="w-full"
        >
          <Ionicons name="trophy" size={18} style={{ marginRight: 8 }} />
          <Text className="font-medium">View Leaderboard</Text>
        </Button>
      </View>
    </View>
  );
};
