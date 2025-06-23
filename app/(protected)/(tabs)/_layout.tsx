import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { NotificationBadge } from "@/components/NotificationBadge";
import { useNotifications } from "@/context/notification-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

export default function TabsLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors[colorScheme].primary,
        tabBarInactiveTintColor: colors[colorScheme].mutedForeground,
        tabBarStyle: {
          backgroundColor: colors[colorScheme].card,
          borderTopColor: colors[colorScheme].border,
        },
        headerStyle: {
          backgroundColor: colors[colorScheme].card,
        },
        headerTintColor: colors[colorScheme].foreground,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
          headerTitle: "Home",
          headerRight: () => <HeaderNotificationButton />,
        }}
      />
      <Tabs.Screen 
      name="browse"
      options={{
        title: "Browse",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
          headerTitle: "Browse",
          headerRight: () => <HeaderNotificationButton />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
          headerTitle: "Friends",
          headerRight: () => <HeaderNotificationButton />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
          headerTitle: "Profile",
          headerRight: () => <HeaderNotificationButton />,
        }}
      />
    </Tabs>
  );
}

function HeaderNotificationButton() {
  const { isDarkColorScheme } = useColorScheme();
  
  return (
    <TouchableOpacity
      onPress={() => router.push('/(protected)/(screens)/notifications')}
      className="mr-4 relative"
    >
      <Ionicons
        name="notifications-outline"
        size={24}
        color={isDarkColorScheme ? '#fff' : '#000'}
      />
      <NotificationBadge size="small" position="top-right" />
    </TouchableOpacity>
  );
}