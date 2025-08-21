import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className={`flex-1 ${colorScheme === "dark" ? "bg-gray-900" : "bg-white"}`}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colorScheme === "dark" ? "#FFFFFF" : "#000000", // White for dark mode, black for light mode
          tabBarInactiveTintColor: colors[colorScheme].mutedForeground, // Muted gray for inactive tabs
          tabBarStyle: {
            backgroundColor: colorScheme === "dark" ? "#111827" : "#FFFFFF", // Use app background color to eliminate white edges
            borderTopColor: colors[colorScheme].primary, // Blue border at top
            borderLeftColor: colors[colorScheme].primary, // Blue border on left
            borderRightColor: colors[colorScheme].primary, // Blue border on right
            borderTopWidth: 3, // Thick blue border
            borderLeftWidth: 3, // Thick blue border
            borderRightWidth: 3, // Thick blue border
            height: 60 + insets.bottom,
            paddingBottom: 20 + insets.bottom,
            paddingTop: 10,
            // Curved edges
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            // Shadow for depth
            shadowColor: colorScheme === "dark" ? "#000" : "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: colorScheme === "dark" ? 0.3 : 0.1,
            shadowRadius: 8,
            elevation: 8,
            // Ensure background is completely opaque
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />

        {/* Create Match - Custom elevated button */}
        <Tabs.Screen
          name="create-match"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => (
              <View
                className="items-center justify-center -mt-8"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors[colorScheme].tennisBall, // Yellow background
                  borderWidth: 1.5,
                  borderColor: 'rgba(255, 255, 255, 0.3)', // Subtle white border
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 10,
                }}
              >
                <Ionicons name="add" size={32} color={colors[colorScheme].primary} />
              </View>
            ),
            tabBarButton: (props) => (
              <TouchableOpacity
                onPress={() => router.push("/(protected)/(screens)/create-match")}
                style={props.style}
                activeOpacity={0.8}
              >
                {props.children}
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />

        {/* Hide other tabs but keep files accessible via direct navigation */}
        <Tabs.Screen
          name="browse"
          options={{
            href: null, // disable deep-linking
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // disable deep-linking - accessible from header avatar
          }}
        />
      </Tabs>
      
      {/* Background extension to cover area behind tabbar */}
      <View 
        className={`absolute bottom-0 left-0 right-0 ${colorScheme === "dark" ? "bg-gray-900" : "bg-white"}`}
        style={{
          height: 120,
          zIndex: -1,
        }}
      />
    </View>
  );
}
