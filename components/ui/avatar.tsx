import React, { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Image as ExpoImage } from "@/components/image";
import { Ionicons } from "@expo/vector-icons";

// Enhanced Avatar Component with error handling and loading states
export interface AvatarProps {
  user: {
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBorder?: boolean;
  borderColor?: string;
  showShadow?: boolean;
  isCurrentUser?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = "md",
  showBorder = false,
  borderColor = "#3B82F6",
  showShadow = false,
  isCurrentUser = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeConfig = {
    xs: {
      width: 24,
      height: 24,
      borderRadius: 12,
      textClass: "text-xs",
      borderWidth: 1,
    },
    sm: {
      width: 32,
      height: 32,
      borderRadius: 16,
      textClass: "text-sm",
      borderWidth: 2,
    },
    md: {
      width: 40,
      height: 40,
      borderRadius: 20,
      textClass: "text-base",
      borderWidth: 2,
    },
    lg: {
      width: 48,
      height: 48,
      borderRadius: 24,
      textClass: "text-lg",
      borderWidth: 3,
    },
    xl: {
      width: 64,
      height: 64,
      borderRadius: 32,
      textClass: "text-xl",
      borderWidth: 4,
    },
  }[size];

  if (!user) {
    return (
      <View
        className="bg-gray-300 dark:bg-gray-600 items-center justify-center"
        style={{
          width: sizeConfig.width,
          height: sizeConfig.height,
          borderRadius: sizeConfig.borderRadius,
          borderWidth: showBorder ? sizeConfig.borderWidth : 0,
          borderColor: showBorder ? borderColor : "transparent",
        }}
      >
        <Text
          className={`${sizeConfig.textClass} text-gray-600 dark:text-gray-300 font-bold`}
        >
          ?
        </Text>
      </View>
    );
  }

  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const containerStyle = {
    width: sizeConfig.width,
    height: sizeConfig.height,
    borderRadius: sizeConfig.borderRadius,
    borderWidth: showBorder ? sizeConfig.borderWidth : 0,
    borderColor: showBorder ? borderColor : "transparent",
    shadowColor: showShadow ? "#000" : "transparent",
    shadowOffset: showShadow
      ? { width: 0, height: 2 }
      : { width: 0, height: 0 },
    shadowOpacity: showShadow ? 0.1 : 0,
    shadowRadius: showShadow ? 4 : 0,
    elevation: showShadow ? 3 : 0,
  };

  if (user.avatar_url && !imageError) {
    return (
      <View className="relative">
        <ExpoImage
          source={{ uri: user.avatar_url }}
          style={containerStyle}
          contentFit="cover"
          cachePolicy="memory-disk"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
          onLoadStart={() => setImageLoading(true)}
        />
        {imageLoading && (
          <View
            className="absolute inset-0 bg-blue-500 items-center justify-center"
            style={{ borderRadius: sizeConfig.borderRadius }}
          >
            <Text className={`${sizeConfig.textClass} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}
        {isCurrentUser && (
          <View className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 items-center justify-center border-2 border-white">
            <Ionicons name="checkmark" size={8} color="white" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      className="bg-blue-500 items-center justify-center relative"
      style={containerStyle}
    >
      <Text className={`${sizeConfig.textClass} font-bold text-white`}>
        {getInitial()}
      </Text>
      {isCurrentUser && (
        <View className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 items-center justify-center border-2 border-white">
          <Ionicons name="checkmark" size={8} color="white" />
        </View>
      )}
    </View>
  );
};

// Multi-Player Avatar Stack Component
export interface PlayerAvatarStackProps {
  players: ({
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null)[];
  maxDisplay?: number;
  size?: "xs" | "sm" | "md";
  currentUserId?: string;
}

export const PlayerAvatarStack: React.FC<PlayerAvatarStackProps> = ({
  players,
  maxDisplay = 3,
  size = "sm",
  currentUserId,
}) => {
  const validPlayers = players.filter(Boolean);
  const displayPlayers = validPlayers.slice(0, maxDisplay);
  const overflowCount = validPlayers.length - maxDisplay;

  const getOffsetStyle = (index: number) => ({
    marginLeft: index > 0 ? -8 : 0,
    zIndex: displayPlayers.length - index,
  });

  return (
    <View className="flex-row items-center">
      {displayPlayers.map((player, index) => (
        <View key={`${player?.id || index}`} style={getOffsetStyle(index)}>
          <Avatar
            user={player}
            size={size}
            showBorder={true}
            borderColor="#ffffff"
            isCurrentUser={player?.id === currentUserId}
          />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          className={`${
            size === "xs" ? "w-6 h-6" : size === "sm" ? "w-8 h-8" : "w-12 h-12"
          } rounded-full bg-gray-300 dark:bg-gray-600 items-center justify-center ml-1`}
          style={{
            borderWidth: 2,
            borderColor: "#ffffff",
          }}
        >
          <Text
            className={`${
              size === "xs" ? "text-xs" : size === "sm" ? "text-xs" : "text-sm"
            } font-bold text-gray-600 dark:text-gray-300`}
          >
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );
};
