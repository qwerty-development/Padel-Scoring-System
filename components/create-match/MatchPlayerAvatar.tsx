import React, { useState } from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { MatchPlayerAvatarProps } from "@/types/create-match";

export function MatchPlayerAvatar({
  player,
  team = 1,
  size = "md",
  showBorder = false,
  showTeamIndicator = false,
  isPlaceholder = false,
  showShadow = true,
  onPress,
}: MatchPlayerAvatarProps) {
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  const avatarSizeConfiguration = {
    xs: {
      containerClass: "w-6 h-6",
      imageStyle: { width: 24, height: 24, borderRadius: 12 },
      textClass: "text-xs",
      borderWidth: 1,
      indicatorSize: "w-3 h-3",
      indicatorTextClass: "text-[8px]",
    },
    sm: {
      containerClass: "w-8 h-8",
      imageStyle: { width: 32, height: 32, borderRadius: 16 },
      textClass: "text-sm",
      borderWidth: 2,
      indicatorSize: "w-4 h-4",
      indicatorTextClass: "text-[9px]",
    },
    md: {
      containerClass: "w-12 h-12",
      imageStyle: { width: 48, height: 48, borderRadius: 24 },
      textClass: "text-lg",
      borderWidth: 2,
      indicatorSize: "w-5 h-5",
      indicatorTextClass: "text-[10px]",
    },
    lg: {
      containerClass: "w-16 h-16",
      imageStyle: { width: 64, height: 64, borderRadius: 32 },
      textClass: "text-xl",
      borderWidth: 3,
      indicatorSize: "w-6 h-6",
      indicatorTextClass: "text-xs",
    },
    xl: {
      containerClass: "w-20 h-20",
      imageStyle: { width: 80, height: 80, borderRadius: 40 },
      textClass: "text-2xl",
      borderWidth: 4,
      indicatorSize: "w-7 h-7",
      indicatorTextClass: "text-sm",
    },
  };

  const sizeConfig = avatarSizeConfiguration[size];

  const getTeamStyling = () => {
    const baseStyles = {
      1: {
        bgColor: "bg-primary",
        bgColorFallback: "bg-primary/80",
        borderColor: "#2148ce",
        indicatorBg: "bg-primary",
        teamLabel: "T1",
        teamColor: "#ffffff",
      },
      2: {
        bgColor: "bg-indigo-500",
        bgColorFallback: "bg-indigo-500/80",
        borderColor: "#6366f1",
        indicatorBg: "bg-indigo-500",
        teamLabel: "T2",
        teamColor: "#ffffff",
      },
    };
    return baseStyles[team];
  };

  const teamStyle = getTeamStyling();

  const extractPlayerInitial = (): string => {
    if (isPlaceholder) return "?";
    if (!player) return "?";

    if (player.full_name?.trim()) {
      const sanitizedName = player.full_name.trim();
      if (sanitizedName.length > 0) {
        return sanitizedName.charAt(0).toUpperCase();
      }
    }

    if (player.email?.trim()) {
      const sanitizedEmail = player.email.trim();
      if (sanitizedEmail.length > 0) {
        return sanitizedEmail.charAt(0).toUpperCase();
      }
    }

    return "?";
  };

  const shouldDisplayAvatarImage = (): boolean => {
    if (isPlaceholder || !player?.avatar_url) return false;

    const trimmedUrl = player.avatar_url.trim();
    return Boolean(trimmedUrl && trimmedUrl.length > 0 && !imageLoadError);
  };

  const getContainerStyle = () => {
    let baseStyle = {
      shadowColor: showShadow ? "#000" : "transparent",
      shadowOffset: showShadow
        ? { width: 0, height: 2 }
        : { width: 0, height: 0 },
      shadowOpacity: showShadow ? 0.15 : 0,
      shadowRadius: showShadow ? 4 : 0,
      elevation: showShadow ? 3 : 0,
    };

    if (showBorder) {
      baseStyle = {
        ...baseStyle,
        borderWidth: sizeConfig.borderWidth,
        borderColor: teamStyle.borderColor,
      };
    }

    return baseStyle;
  };

  const handleImageLoadSuccess = (): void => {
    setImageLoading(false);
  };

  const handleImageLoadFailure = (): void => {
    console.warn(`Match player avatar load failure:`, {
      playerId: player?.id,
      playerName: player?.full_name || player?.email,
      avatarUrl: player?.avatar_url,
      team,
      component: "MatchPlayerAvatar",
    });

    setImageLoadError(true);
    setImageLoading(false);
  };

  const handleImageLoadStart = (): void => {
    setImageLoading(true);
  };

  // Wrap in TouchableOpacity if onPress is provided
  const AvatarContainer = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  if (isPlaceholder) {
    return (
      <View className="relative">
        <AvatarContainer
          {...containerProps}
          className={`${sizeConfig.containerClass} rounded-full border-2 border-dashed items-center justify-center ${
            team === 1 ? "border-primary/40" : "border-indigo-500/40"
          } ${onPress ? "bg-gray-50 dark:bg-gray-800" : ""}`}
          style={getContainerStyle()}
        >
          <Ionicons
            name={onPress ? "add" : "help-outline"}
            size={size === "md" ? 20 : 16}
            color={team === 1 ? "#2148ce" : "#6366f1"}
          />
        </AvatarContainer>

        {showTeamIndicator && (
          <View
            className={`absolute -top-1 -right-1 ${sizeConfig.indicatorSize} rounded-full ${teamStyle.indicatorBg} items-center justify-center border-2 border-white dark:border-gray-800`}
          >
            <Text
              className={`${sizeConfig.indicatorTextClass} font-bold text-white`}
            >
              {teamStyle.teamLabel}
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (shouldDisplayAvatarImage()) {
    return (
      <View className="relative">
        <AvatarContainer
          {...containerProps}
          className={`${sizeConfig.containerClass} rounded-full ${teamStyle.bgColor} items-center justify-center overflow-hidden`}
          style={getContainerStyle()}
        >
          <Image
            source={{ uri: player!.avatar_url! }}
            style={sizeConfig.imageStyle}
            resizeMode="cover"
            onLoad={handleImageLoadSuccess}
            onError={handleImageLoadFailure}
            onLoadStart={handleImageLoadStart}
          />

          {imageLoading && (
            <View
              className={`absolute inset-0 ${teamStyle.bgColorFallback} items-center justify-center`}
            >
              <Text className={`${sizeConfig.textClass} font-bold text-white`}>
                {extractPlayerInitial()}
              </Text>

              <View
                className="absolute bottom-1 right-1 bg-white/20 rounded-full p-0.5"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 1,
                  elevation: 1,
                }}
              ></View>
            </View>
          )}
        </AvatarContainer>

        {showTeamIndicator && (
          <View
            className={`absolute -top-1 -right-1 ${sizeConfig.indicatorSize} rounded-full ${teamStyle.indicatorBg} items-center justify-center border-2 border-white dark:border-gray-800`}
          >
            <Text
              className={`${sizeConfig.indicatorTextClass} font-bold text-white`}
            >
              {teamStyle.teamLabel}
            </Text>
          </View>
        )}

        {player?.isCurrentUser && (
          <View className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center border-2 border-white dark:border-gray-800">
            <Ionicons name="person" size={8} color="white" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="relative">
      <AvatarContainer
        {...containerProps}
        className={`${sizeConfig.containerClass} rounded-full ${teamStyle.bgColor} items-center justify-center`}
        style={getContainerStyle()}
      >
        <Text className={`${sizeConfig.textClass} font-bold text-white`}>
          {extractPlayerInitial()}
        </Text>
      </AvatarContainer>

      {showTeamIndicator && (
        <View
          className={`absolute -top-1 -right-1 ${sizeConfig.indicatorSize} rounded-full ${teamStyle.indicatorBg} items-center justify-center border-2 border-white dark:border-gray-800`}
        >
          <Text
            className={`${sizeConfig.indicatorTextClass} font-bold text-white`}
          >
            {teamStyle.teamLabel}
          </Text>
        </View>
      )}

      {player?.isCurrentUser && (
        <View className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center border-2 border-white dark:border-gray-800">
          <Ionicons name="person" size={8} color="white" />
        </View>
      )}
    </View>
  );
}
