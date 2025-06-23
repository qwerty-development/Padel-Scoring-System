import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/config/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner:true,
    shouldShowList:true
  }),
});

export interface NotificationData {
  type: NotificationType;
  matchId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export type NotificationType = 
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'match_invitation'
  | 'match_confirmation_required'
  | 'match_score_confirmed'
  | 'match_score_disputed'
  | 'match_starting_soon'
  | 'match_cancelled'
  | 'public_match_joined';

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service and request permissions
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Check if physical device
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return false;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      // Get Expo push token
      const token = await this.getExpoPushToken();
      if (!token) {
        console.log('Failed to get Expo push token');
        return false;
      }

      this.expoPushToken = token;

      // Save token to database
      await this.saveTokenToDatabase(userId, token);

      // Set up notification listeners
      this.setupNotificationListeners();

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  /**
   * Get Expo push token
   */
  private async getExpoPushToken(): Promise<string | null> {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('Project ID not found');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Save notification token to database
   */
  private async saveTokenToDatabase(userId: string, token: string): Promise<void> {
    try {
      const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

      const { error } = await supabase
        .from('notification_tokens')
        .upsert({
          user_id: userId,
          token,
          device_type: deviceType,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving notification token:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    // Handle notifications when app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived
    );

    // Handle notification responses (when user taps on notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );
  }

  /**
   * Handle notification received in foreground
   */
  private handleNotificationReceived = (notification: Notifications.Notification): void => {
    console.log('Notification received:', notification);
    
    // You can add custom handling here based on notification type
    const data = notification.request.content.data as NotificationData;
    
    // Emit event or update app state as needed
    this.emitNotificationEvent('received', data);
  };

  /**
   * Handle notification response (user interaction)
   */
  private handleNotificationResponse = (
    response: Notifications.NotificationResponse
  ): void => {
    console.log('Notification response:', response);
    
    const data = response.notification.request.content.data as NotificationData;
    
    // Navigate based on notification type
    this.handleNotificationNavigation(data);
  };

  /**
   * Handle navigation based on notification type
   */
  private handleNotificationNavigation(data: NotificationData): void {
    // Import router dynamically to avoid circular dependencies
    const { router } = require('expo-router');

    switch (data.type) {
      case 'friend_request_received':
      case 'friend_request_accepted':
        router.push('/(protected)/(tabs)/friends');
        break;
        
      case 'match_invitation':
      case 'match_confirmation_required':
      case 'match_score_confirmed':
      case 'match_score_disputed':
      case 'match_cancelled':
        if (data.matchId) {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { id: data.matchId }
          });
        }
        break;
        
      case 'match_starting_soon':
        if (data.matchId) {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { id: data.matchId }
          });
        }
        break;
        
      case 'public_match_joined':
        if (data.matchId) {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { id: data.matchId }
          });
        }
        break;
    }
  }

  /**
   * Send local notification (for testing or immediate notifications)
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // null means immediate
    });
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(
    title: string,
    body: string,
    triggerDate: Date,
    data?: NotificationData
  ): Promise<string> {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        date: triggerDate,
      },
    });

    return identifier;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return data?.notification_preferences || {};
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return {};
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: any
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: preferences })
        .eq('id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Emit notification event (for real-time updates)
   */
  private emitNotificationEvent(event: string, data: any): void {
    // You can implement a custom event emitter or use a state management solution
    // For now, we'll use a simple approach with a global event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`notification:${event}`, { detail: data }));
    }
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Remove device token (for logout)
   */
  async removeDeviceToken(userId: string): Promise<void> {
    try {
      if (!this.expoPushToken) return;

      const { error } = await supabase
        .from('notification_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', this.expoPushToken);

      if (error) throw error;

      this.expoPushToken = null;
    } catch (error) {
      console.error('Error removing device token:', error);
    }
  }
}