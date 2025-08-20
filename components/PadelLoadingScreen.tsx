// components/PadelLoadingScreen.tsx (React Native version)
import React from "react";
import { View, Animated, Easing } from "react-native";
import { Text } from "@/components/ui/text";

const PadelLoadingScreen = () => {
  const spinValue = React.useRef(new Animated.Value(0)).current;
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Continuous spin animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.1,
          duration: 500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => {};
  }, []);

  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View className="flex-1 bg-background items-center justify-center">
      {/* Padel Ball */}
      <Animated.View
        className="relative w-16 h-16 mb-8"
        style={{
          transform: [{ scale: scaleValue }, { rotate: spinInterpolate }],
        }}
      >
        {/* Ball background */}
        <View className="absolute w-full h-full rounded-full bg-primary" />

        {/* Ball stripes/pattern */}
        <View className="absolute w-full h-full rounded-full">
          {/* Top half */}
          <View className="absolute w-full h-1/2 rounded-t-full overflow-hidden">
            <View
              className="absolute h-full w-0.5 bg-primary-foreground left-1/4"
              style={{ transform: [{ rotate: "20deg" }] }}
            />
            <View
              className="absolute h-full w-0.5 bg-primary-foreground left-1/2"
              style={{ transform: [{ rotate: "20deg" }] }}
            />
            <View
              className="absolute h-full w-0.5 bg-primary-foreground left-3/4"
              style={{ transform: [{ rotate: "20deg" }] }}
            />
          </View>

          {/* Bottom half */}
          <View className="absolute w-full h-1/2 bottom-0 rounded-b-full overflow-hidden">
            <View
              className="absolute h-full w-0.5 bg-primary-foreground left-1/4"
              style={{ transform: [{ rotate: "-20deg" }] }}
            />
            <View
              className="absolute h-full w-0.5 bg-primary-foreground left-1/2"
              style={{ transform: [{ rotate: "-20deg" }] }}
            />
            <View
              className="absolute h-full w-0.5 bg-primary-foreground left-3/4"
              style={{ transform: [{ rotate: "-20deg" }] }}
            />
          </View>
        </View>
      </Animated.View>

      {/* Loading Text */}
      <Text className="text-lg font-medium text-muted-foreground">
        Preparing your court...
      </Text>
    </View>
  );
};

export default PadelLoadingScreen;
