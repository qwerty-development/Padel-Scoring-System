import React, { useRef, useEffect } from "react";
import { Animated } from "react-native";

import { SlideContainerProps } from "@/types/create-match";

export const SlideContainer: React.FC<SlideContainerProps> = ({
  children,
  isActive,
  direction = "forward",
}) => {
  const slideAnimation = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const fadeAnimation = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isActive, slideAnimation, fadeAnimation]);

  if (!isActive && slideAnimation._value === 0) return null;

  return (
    <Animated.View
      pointerEvents={isActive ? "auto" : "none"}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        opacity: fadeAnimation,
        transform: [
          {
            translateX: slideAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [direction === "forward" ? 50 : -50, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};
