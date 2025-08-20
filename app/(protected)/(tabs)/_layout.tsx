import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity } from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors[colorScheme].primary,
        tabBarInactiveTintColor: colors[colorScheme].mutedForeground,
        tabBarStyle: {
          backgroundColor: colors[colorScheme].card,
          borderTopColor: colors[colorScheme].border,
          height: 90,
          paddingBottom: 20,
          paddingTop: 10,
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
              className="items-center justify-center -mt-6"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "#CCFF00", // tennis ball yellow
                borderWidth: 3,
                borderColor: "#ffffff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 8,
              }}
            >
              <Ionicons name="add" size={28} color="#000000" />
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
  );
}
