import React from "react";
import { View, Text } from "react-native";
import { useNotifications } from "@/context/notification-provider";

interface NotificationBadgeProps {
  size?: "small" | "medium" | "large";
  position?: "top-right" | "top-left";
}

export function NotificationBadge({
  size = "small",
  position = "top-right",
}: NotificationBadgeProps) {
  const { unreadCount } = useNotifications();

  if (unreadCount === 0) return null;

  const sizeClasses = {
    small: "w-4 h-4 text-[10px]",
    medium: "w-5 h-5 text-xs",
    large: "w-6 h-6 text-sm",
  };

  const positionClasses = {
    "top-right": "-top-1 -right-1",
    "top-left": "-top-1 -left-1",
  };

  const displayCount = unreadCount > 99 ? "99+" : unreadCount.toString();

  return (
    <View
      className={`absolute ${positionClasses[position]} bg-red-500 rounded-full ${sizeClasses[size]} items-center justify-center z-10`}
    >
      <Text className="text-white font-bold">{displayCount}</Text>
    </View>
  );
}
