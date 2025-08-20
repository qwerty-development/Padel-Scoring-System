import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { useColorScheme } from "@/lib/useColorScheme";
import * as Notifications from "expo-notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  created_at: string;
}

const NotificationIcon = ({ type }: { type: string }) => {
  const iconMap: Record<string, { name: string; color: string }> = {
    friend_request_received: { name: "person-add", color: "#3b82f6" },
    friend_request_accepted: { name: "checkmark-circle", color: "#10b981" },
    match_invitation: { name: "tennisball", color: "#f59e0b" },
    match_confirmation_required: { name: "alert-circle", color: "#ef4444" },
    match_score_confirmed: { name: "checkmark-done", color: "#10b981" },
    match_score_disputed: { name: "warning", color: "#f59e0b" },
    match_starting_soon: { name: "time", color: "#3b82f6" },
    match_cancelled: { name: "close-circle", color: "#ef4444" },
    public_match_joined: { name: "people", color: "#8b5cf6" },
  };

  const icon = iconMap[type] || { name: "notifications", color: "#6b7280" };

  return (
    <View
      className="w-10 h-10 rounded-full items-center justify-center"
      style={{ backgroundColor: `${icon.color}20` }}
    >
      <Ionicons name={icon.name as any} size={24} color={icon.color} />
    </View>
  );
};

export default function NotificationsScreen() {
  const { session } = useAuth();
  const { isDarkColorScheme } = useColorScheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkNotificationPermission();
    if (session?.user?.id) {
      fetchNotifications();
    }
  }, [session?.user?.id]);

  const checkNotificationPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (error) {
      console.error("Error checking notification permission:", error);
      setHasPermission(false);
    }
  };

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      // Show empty array on error to prevent white screen
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
    }

    // Navigate based on notification type
    switch (notification.type) {
      case "friend_request_received":
      case "friend_request_accepted":
        router.push("/(protected)/(tabs)/friends");
        break;

      case "match_invitation":
      case "match_confirmation_required":
      case "match_score_confirmed":
      case "match_score_disputed":
      case "match_cancelled":
      case "match_starting_soon":
      case "public_match_joined":
        if (notification.data?.match_id) {
          router.push({
            pathname: "/(protected)/(screens)/match-details",
            params: { id: notification.data.match_id },
          });
        }
        break;
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const clearAllNotifications = () => {
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to clear all notifications? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("notifications")
                .delete()
                .eq("user_id", session?.user?.id);

              if (error) throw error;

              setNotifications([]);
            } catch (error) {
              console.error("Error clearing notifications:", error);
            }
          },
        },
      ],
    );
  };

  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);

    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const groups: Record<string, Notification[]> = {};

    notifications.forEach((notification) => {
      const date = new Date(notification.created_at);
      let key: string;

      if (isToday(date)) {
        key = "Today";
      } else if (isYesterday(date)) {
        key = "Yesterday";
      } else {
        key = format(date, "MMMM d, yyyy");
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
    });

    return groups;
  };

  // Don't render anything while checking permissions to prevent flash
  if (hasPermission === null) {
    return (
      <SafeAreaView>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView>
        <View className="flex-1 p-4">
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDarkColorScheme ? "#fff" : "#000"}
              />
            </TouchableOpacity>
            <H1>Notifications</H1>
          </View>

          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="notifications-off" size={64} color="#888" />
            <Text className="text-lg font-medium mt-4 mb-2 text-center">
              Notifications Disabled
            </Text>
            <Text className="text-muted-foreground text-center mb-6">
              Enable notifications to stay updated about matches, friend
              requests, and more.
            </Text>
            <Button onPress={requestPermission}>
              <Text>Enable Notifications</Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView>
        <View className="flex-1">
          <View className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDarkColorScheme ? "#fff" : "#000"}
              />
            </TouchableOpacity>
            <H1>Notifications</H1>
          </View>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const groupedNotifications = groupNotificationsByDate(notifications);
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <SafeAreaView>
      <View className="flex-1">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDarkColorScheme ? "#fff" : "#000"}
              />
            </TouchableOpacity>
            <H1>Notifications</H1>
          </View>

          {notifications.length > 0 && (
            <View className="flex-row gap-2">
              {hasUnread && (
                <TouchableOpacity onPress={markAllAsRead}>
                  <Ionicons name="checkmark-done" size={24} color="#3b82f6" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={clearAllNotifications}>
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {notifications.length === 0 ? (
            <View className="flex-1 items-center justify-center p-8 mt-20">
              <Ionicons name="notifications-outline" size={64} color="#888" />
              <Text className="text-lg font-medium mt-4 mb-2">
                No notifications yet
              </Text>
              <Text className="text-muted-foreground text-center">
                You'll see match updates, friend requests, and other important
                updates here.
              </Text>
            </View>
          ) : (
            Object.entries(groupedNotifications).map(
              ([date, dateNotifications]) => (
                <View key={date}>
                  <Text className="text-sm font-semibold text-muted-foreground px-4 py-2 bg-gray-50 dark:bg-gray-900">
                    {date}
                  </Text>
                  {dateNotifications.map((notification) => (
                    <TouchableOpacity
                      key={notification.id}
                      onPress={() => handleNotificationPress(notification)}
                      className={`flex-row p-4 border-b border-gray-200 dark:border-gray-700 ${
                        !notification.read
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                      }`}
                    >
                      <NotificationIcon type={notification.type} />
                      <View className="flex-1 ml-3">
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1">
                            <Text className="font-semibold mb-1">
                              {notification.title}
                            </Text>
                            <Text className="text-sm text-muted-foreground">
                              {notification.body}
                            </Text>
                          </View>
                          {!notification.read && (
                            <View className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-2" />
                          )}
                        </View>
                        <Text className="text-xs text-muted-foreground mt-1">
                          {formatNotificationDate(notification.created_at)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ),
            )
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
