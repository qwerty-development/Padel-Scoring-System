import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { TeamPlayerRowProps } from "@/types/create-match";
import { MatchPlayerAvatar } from "./MatchPlayerAvatar";

export function TeamPlayerRow({
  player,
  team,
  showRating = false,
  onRemove,
  onSwapTeam,
}: TeamPlayerRowProps) {
  return (
    <View className="flex-row items-center mb-2 p-2 rounded-lg bg-white/40 dark:bg-white/5 relative">
      {/* Remove button - only for non-current users */}
      {!player.isCurrentUser && onRemove && (
        <TouchableOpacity
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center z-10"
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={12} color="white" />
        </TouchableOpacity>
      )}

      {/* Swap button - only for non-current users */}
      {!player.isCurrentUser && onSwapTeam && (
        <TouchableOpacity
          className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 rounded-full items-center justify-center z-10"
          onPress={onSwapTeam}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal" size={10} color="white" />
        </TouchableOpacity>
      )}

      <MatchPlayerAvatar
        player={{
          id: player.id,
          full_name: player.name,
          email: player.email || "",
          avatar_url: player.avatar_url,
          isCurrentUser: player.isCurrentUser,
        }}
        team={team}
        size="sm"
        showBorder={true}
        showShadow={true}
      />

      <View className="flex-1 ml-2">
        <Text className="font-medium text-xs" numberOfLines={1}>
          {player.isCurrentUser ? "You" : player.name}
        </Text>
        {showRating && player.glicko_rating && (
          <Text className="text-xs text-muted-foreground">
            {Math.round(Number(player.glicko_rating))}
          </Text>
        )}
      </View>
    </View>
  );
}
