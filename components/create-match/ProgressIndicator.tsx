import React from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Text } from "@/components/ui/text";
import { ProgressIndicatorProps } from "@/types/create-match";

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  completedSteps,
  stepConfig,
  onStepPress,
  canNavigateToStep,
}) => {
  const currentIndex = stepConfig.findIndex((step) => step.id === currentStep);

  return (
    <View className="bg-blue-600 px-4 py-6">
      {/* Header with back button and step indicator */}
      <View className="flex-row items-center justify-between">
        {/* Close Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2"
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>

        {/* Step Text */}
        <Text className="text-white text-lg font-semibold">
          Step {currentIndex + 1} of {totalSteps}
        </Text>

        {/* Spacer for centering */}
        <View className="w-12" />
      </View>
    </View>
  );
};
