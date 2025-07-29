import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { FEATURE_FLAGS } from "@/constants/features";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors[colorScheme].primary,
        tabBarInactiveTintColor: colors[colorScheme].mutedForeground,
        tabBarStyle: {
          backgroundColor: colors[colorScheme].card,
          borderTopColor: colors[colorScheme].border,
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
      {FEATURE_FLAGS.PUBLIC_MATCHES_ENABLED ? (
        <Tabs.Screen
          name="browse"
          options={{
            title: "Browse",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
      ) : (
        /* Override the auto-generated "browse" screen to remove it from the tab bar */
        <Tabs.Screen
          name="browse"
          options={{
            href: null, // disable deep-linking
          }}
        />
      )}
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}