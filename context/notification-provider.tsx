import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  NotificationService,
  NotificationData,
} from "@/services/notificationService";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface NotificationContextType {
  notificationService: NotificationService;
  hasPermission: boolean;
  unreadCount: number;
  requestPermission: () => Promise<boolean>;
  markAsRead: (notificationId: string) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { session, profile } = useAuth();
  const [notificationService] = useState(() =>
    NotificationService.getInstance(),
  );
  const [hasPermission, setHasPermission] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const [notificationChannel, setNotificationChannel] =
    useState<RealtimeChannel | null>(null);

  // Initialize notifications when user logs in
  useEffect(() => {
    if (session?.user?.id) {
      initializeNotifications();
      setupRealtimeSubscription();
      fetchUnreadCount();
    }

    return () => {
      // Cleanup when user logs out
      if (!session?.user?.id) {
        notificationService.cleanup();
        cleanupRealtimeSubscription();
      }
    };
  }, [session?.user?.id]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  /**
   * Handle app state changes to refresh data when app comes to foreground
   */
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === "active") {
      // App has come to the foreground
      if (session?.user?.id) {
        fetchUnreadCount();
      }
    }
    setAppState(nextAppState);
  };

  /**
   * Initialize notification service
   */
  const initializeNotifications = async () => {
    if (!session?.user?.id) return;

    const permission = await notificationService.initialize(session.user.id);
    setHasPermission(permission);

    // Listen for notification events
    window.addEventListener(
      "notification:received",
      handleNotificationReceived,
    );
  };

  /**
   * Set up real-time subscription for new notifications
   */
  const setupRealtimeSubscription = () => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        handleNewNotification,
      )
      .subscribe();

    setNotificationChannel(channel);
  };

  /**
   * Clean up real-time subscription
   */
  const cleanupRealtimeSubscription = () => {
    if (notificationChannel) {
      supabase.removeChannel(notificationChannel);
      setNotificationChannel(null);
    }
  };

  /**
   * Handle new notification from real-time subscription
   */
  const handleNewNotification = (payload: any) => {
    console.log("New notification received:", payload);

    // Increment unread count
    setUnreadCount((prev) => prev + 1);

    // Show local notification if app is in background
    if (AppState.currentState !== "active" && payload.new) {
      notificationService.sendLocalNotification(
        payload.new.title,
        payload.new.body,
        payload.new.data,
      );
    }
  };

  /**
   * Handle notification received event
   */
  const handleNotificationReceived = (event: CustomEvent) => {
    const data = event.detail as NotificationData;
    console.log("Notification event received:", data);

    // Refresh unread count
    fetchUnreadCount();
  };

  /**
   * Request notification permission
   */
  const requestPermission = async (): Promise<boolean> => {
    if (!session?.user?.id) return false;

    const permission = await notificationService.initialize(session.user.id);
    setHasPermission(permission);
    return permission;
  };

  /**
   * Fetch unread notification count
   */
  const fetchUnreadCount = async () => {
    if (!session?.user?.id) return;

    const count = await notificationService.getUnreadCount(session.user.id);
    setUnreadCount(count);
  };

  /**
   * Mark notification as read
   */
  const markAsRead = async (notificationId: string) => {
    await notificationService.markNotificationAsRead(notificationId);
    await fetchUnreadCount();
  };

  /**
   * Send test notification
   */
  const sendTestNotification = async () => {
    await notificationService.sendLocalNotification(
      "Test Notification",
      "This is a test notification from Padel Scoring App",
      { type: "match_invitation" as const },
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationService.cleanup();
      cleanupRealtimeSubscription();
    };
  }, []);

  const value: NotificationContextType = {
    notificationService,
    hasPermission,
    unreadCount,
    requestPermission,
    markAsRead,
    refreshUnreadCount: fetchUnreadCount,
    sendTestNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
}
