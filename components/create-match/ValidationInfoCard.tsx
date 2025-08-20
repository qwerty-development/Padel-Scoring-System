import React, { useState, useRef, useEffect } from "react";
import { View, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { ValidationInfoCardProps } from "@/types/create-match";

export const ValidationInfoCard: React.FC<ValidationInfoCardProps> = ({
  isPastMatch,
  validationDeadline,
}) => {
  const [expanded, setExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  // Calculate if this is demo mode (1 hour validation)
  const now = new Date();
  const deadlineDate = new Date(validationDeadline);
  const hoursUntilDeadline =
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isDemo = hoursUntilDeadline <= 1 && hoursUntilDeadline > 0;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded, animatedHeight]);

  if (!isPastMatch) return null;

  return (
    <View className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 items-center justify-center mr-3">
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#2563eb"
            />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-blue-800 dark:text-blue-300">
              Score Validation System Active
            </Text>
            <Text className="text-sm text-blue-600 dark:text-blue-400">
              {isDemo ? "1-hour" : "24-hour"} dispute window • Tap to learn more
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#2563eb"
        />
      </TouchableOpacity>

      <Animated.View
        style={{
          maxHeight: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 500],
          }),
          opacity: animatedHeight,
          overflow: "hidden",
        }}
      >
        <View className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <Text className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            The validation system protects rating integrity:
          </Text>

          <View className="space-y-2">
            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">1.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                After recording scores, all participants have{" "}
                {isDemo ? "1 hour" : "24 hours"} to dispute if incorrect
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">2.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                Ratings are only applied after the dispute window closes
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">3.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                If 2+ players report issues, the match is disputed and ratings
                are not applied
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">4.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                Match creator can delete within 24 hours if mistakes were made
              </Text>
            </View>
          </View>

          {isDemo && (
            <View className="mt-3 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <View className="flex-row items-center">
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#d97706"
                  style={{ marginRight: 6 }}
                />
                <Text className="text-xs text-amber-700 dark:text-amber-400">
                  Demo Mode: Using 1-hour validation for testing
                </Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};
