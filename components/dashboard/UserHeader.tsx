import React from "react";
import {
  View,
  TouchableOpacity,
  ImageBackground,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Avatar } from "@/components/ui/avatar";
import { useColorScheme } from "@/lib/useColorScheme";

interface UserHeaderProps {
  profile: any;
  headerHeight: Animated.AnimatedAddition;
  titleOpacity: Animated.AnimatedAddition;
  titleTranslateY: Animated.AnimatedAddition;
  collapsedTitleOpacity: Animated.AnimatedAddition;
  insets: any;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  profile,
  headerHeight,
  titleOpacity,
  titleTranslateY,
  collapsedTitleOpacity,
  insets,
}) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const headerImage =
    colorScheme === "dark"
      ? require("../../assets/padelcourt.jpg")
      : require("../../assets/padelcourt.jpg");

  const firstName = profile?.full_name?.split(" ")[0] || "Player";

  return (
    <>
      {/* Main Header */}
      <Animated.View
        style={{ height: headerHeight }}
        className="w-full overflow-hidden"
      >
        <ImageBackground
          source={headerImage}
          resizeMode="cover"
          className="w-full h-full"
        >
          <View className="absolute bottom-14 left-5 right-5">
            <Animated.View
              style={{
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              }}
            >
              <Animated.Text className="text-white text-2xl font-light">
                Hello 👋
              </Animated.Text>
              <Animated.Text
                className="text-white text-4xl font-semibold mt-1"
                numberOfLines={1}
              >
                {firstName}
              </Animated.Text>
            </Animated.View>
          </View>
          {/* Avatar aligned with greeting at bottom-right of header */}
          <Animated.View
            className="absolute right-5 bottom-14"
            style={{ opacity: titleOpacity }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/(protected)/(tabs)/profile")}
            >
              <Avatar
                user={
                  profile
                    ? {
                        id: profile.id,
                        full_name: profile.full_name,
                        email: profile.email,
                        avatar_url: profile.avatar_url,
                      }
                    : null
                }
                size="xl"
                showShadow={true}
                showBorder={true}
                borderColor="#ffffff"
                isCurrentUser={true}
              />
            </TouchableOpacity>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      {/* Collapsed top bar: name left, avatar right */}
      <Animated.View
        pointerEvents="box-none"
        className="absolute left-5 right-5"
        style={{
          top: 5 + (insets?.top || 0),
          zIndex: 25,
          opacity: collapsedTitleOpacity,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-semibold" numberOfLines={1}>
            {firstName}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(protected)/(tabs)/profile")}
          >
            <Avatar
              user={
                profile
                  ? {
                      id: profile.id,
                      full_name: profile.full_name,
                      email: profile.email,
                      avatar_url: profile.avatar_url,
                    }
                  : null
              }
              size="sm"
              showShadow={true}
              showBorder={true}
              borderColor="#ffffff"
              isCurrentUser={true}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
};
