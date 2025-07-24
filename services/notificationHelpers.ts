import { supabase } from '@/config/supabase';

/**
 * NotificationHelpers: Client-side utility functions for triggering notification events
 * These functions create notification records which trigger database functions
 * that send push notifications via Edge Functions
 */

export const NotificationHelpers = {
  /**
   * Trigger a friend request notification
   * Called when sending a friend request
   */
  async sendFriendRequestNotification(toUserId: string, fromUserName: string) {
    try {
      const { error } = await supabase.rpc('trigger_notification', {
        p_user_id: toUserId,
        p_type: 'friend_request_received',
        p_title: 'New Friend Request',
        p_body: `${fromUserName} sent you a friend request`,
        p_data: { type: 'friend_request_received' }
      });

      if (error) console.error('Error triggering friend request notification:', error);
    } catch (error) {
      console.error('Failed to send friend request notification:', error);
    }
  },

  /**
   * Trigger a friend request accepted notification
   * Called when accepting a friend request
   */
  async sendFriendAcceptedNotification(toUserId: string, acceptedByName: string) {
    try {
      const { error } = await supabase.rpc('trigger_notification', {
        p_user_id: toUserId,
        p_type: 'friend_request_accepted',
        p_title: 'Friend Request Accepted',
        p_body: `${acceptedByName} accepted your friend request`,
        p_data: { type: 'friend_request_accepted' }
      });

      if (error) console.error('Error triggering friend accepted notification:', error);
    } catch (error) {
      console.error('Failed to send friend accepted notification:', error);
    }
  },

  /**
   * Trigger match invitation notifications
   * Called when creating a new match with players
   */
  async sendMatchInvitationNotifications(
    playerIds: string[],
    createdById: string,
    createdByName: string,
    matchId: string,
    startTime: string
  ) {
    try {
      // Filter out the creator and null values
      const invitedPlayerIds = playerIds.filter(id => id && id !== createdById);
      
      if (invitedPlayerIds.length === 0) return;

      const matchDate = new Date(startTime);
      const formattedDate = matchDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      for (const playerId of invitedPlayerIds) {
        await supabase.rpc('trigger_notification', {
          p_user_id: playerId,
          p_type: 'match_invitation',
          p_title: 'Match Invitation',
          p_body: `${createdByName} invited you to a match on ${formattedDate}`,
          p_data: { 
            type: 'match_invitation',
            match_id: matchId,
            start_time: startTime
          }
        });
      }
    } catch (error) {
      console.error('Failed to send match invitation notifications:', error);
    }
  },

  /**
   * Trigger match confirmation required notifications
   * Called when a match ends and needs score confirmation
   * FIXED: Now excludes the match creator (player_1) who auto-confirms
   */
  async sendMatchConfirmationNotifications(
    playerIds: string[],
    matchId: string,
    createdById: string
  ) {
    try {
      // Filter out the creator (who auto-confirms) and null values
      const playersNeedingConfirmation = playerIds.filter(id => id && id !== createdById);
      
      if (playersNeedingConfirmation.length === 0) {
        console.log('No players need confirmation notifications (creator auto-confirms)');
        return;
      }

      for (const playerId of playersNeedingConfirmation) {
        await supabase.rpc('trigger_notification', {
          p_user_id: playerId,
          p_type: 'match_confirmation_required',
          p_title: 'Confirm Match Score',
          p_body: 'Please confirm the score for your recent match',
          p_data: { 
            type: 'match_confirmation_required',
            match_id: matchId
          }
        });
      }
    } catch (error) {
      console.error('Failed to send match confirmation notifications:', error);
    }
  },

  /**
   * Trigger match score confirmed notification
   * Called when a player confirms the match score
   */
  async sendMatchScoreConfirmedNotification(
    playerIds: string[],
    confirmedById: string,
    confirmedByName: string,
    matchId: string
  ) {
    try {
      const otherPlayerIds = playerIds.filter(id => id && id !== confirmedById);
      
      for (const playerId of otherPlayerIds) {
        await supabase.rpc('trigger_notification', {
          p_user_id: playerId,
          p_type: 'match_score_confirmed',
          p_title: 'Match Score Confirmed',
          p_body: `${confirmedByName} confirmed the match score`,
          p_data: { 
            type: 'match_score_confirmed',
            match_id: matchId,
            confirmed_by: confirmedById
          }
        });
      }
    } catch (error) {
      console.error('Failed to send match score confirmed notification:', error);
    }
  },

  /**
   * Trigger match score disputed notification
   * Called when a player disputes the match score
   */
  async sendMatchScoreDisputedNotification(
    playerIds: string[],
    disputedById: string,
    disputedByName: string,
    matchId: string
  ) {
    try {
      const otherPlayerIds = playerIds.filter(id => id && id !== disputedById);
      
      for (const playerId of otherPlayerIds) {
        await supabase.rpc('trigger_notification', {
          p_user_id: playerId,
          p_type: 'match_score_disputed',
          p_title: 'Match Score Disputed',
          p_body: `${disputedByName} disputed the match score`,
          p_data: { 
            type: 'match_score_disputed',
            match_id: matchId,
            disputed_by: disputedById
          }
        });
      }
    } catch (error) {
      console.error('Failed to send match score disputed notification:', error);
    }
  },

  /**
   * Trigger match cancelled notification
   * Called when a match is cancelled
   */
  async sendMatchCancelledNotification(
    playerIds: string[],
    cancelledById: string,
    cancelledByName: string,
    matchId: string
  ) {
    try {
      const otherPlayerIds = playerIds.filter(id => id && id !== cancelledById);
      
      for (const playerId of otherPlayerIds) {
        await supabase.rpc('trigger_notification', {
          p_user_id: playerId,
          p_type: 'match_cancelled',
          p_title: 'Match Cancelled',
          p_body: `${cancelledByName} cancelled the match`,
          p_data: { 
            type: 'match_cancelled',
            match_id: matchId,
            cancelled_by: cancelledById
          }
        });
      }
    } catch (error) {
      console.error('Failed to send match cancelled notification:', error);
    }
  },

  /**
   * Trigger public match joined notification
   * Called when someone joins a public match
   */
  async sendPublicMatchJoinedNotification(
    matchCreatorId: string,
    joinedByName: string,
    matchId: string
  ) {
    try {
      await supabase.rpc('trigger_notification', {
        p_user_id: matchCreatorId,
        p_type: 'public_match_joined',
        p_title: 'Player Joined Your Match',
        p_body: `${joinedByName} joined your public match`,
        p_data: { 
          type: 'public_match_joined',
          match_id: matchId
        }
      });
    } catch (error) {
      console.error('Failed to send public match joined notification:', error);
    }
  },

  /**
   * Schedule a match reminder notification
   * Called when creating a match to schedule a 30-minute reminder
   */
  async scheduleMatchReminder(
    playerIds: string[],
    matchId: string,
    startTime: string
  ) {
    try {
      const startDate = new Date(startTime);
      const reminderTime = new Date(startDate.getTime() - 30 * 60 * 1000); // 30 minutes before

      // Only schedule if match is more than 30 minutes in the future
      if (reminderTime > new Date()) {
        for (const playerId of playerIds) {
          // This would typically be handled by a scheduled job
          // For now, we'll create a notification record with a future timestamp
          await supabase.rpc('schedule_match_reminder', {
            p_match_id: matchId
          });
        }
      }
    } catch (error) {
      console.error('Failed to schedule match reminder:', error);
    }
  },

  /**
   * Trigger match edited notification
   * Called when an admin/creator edits a match
   */
  async sendMatchEditedNotification(
    playerIds: string[],
    editedById: string,
    editedByName: string,
    matchId: string,
    editedFields: string[]
  ) {
    try {
      // Filter out the editor (they don't need to know they edited it)
      const otherPlayerIds = playerIds.filter(id => id && id !== editedById);
      
      if (otherPlayerIds.length === 0) {
        console.log('No other players to notify about match edit');
        return;
      }

      // Create a readable summary of what was edited
      const fieldsText = editedFields.length > 0 
        ? `Updated: ${editedFields.join(', ')}`
        : 'Match details updated';

      for (const playerId of otherPlayerIds) {
        await supabase.rpc('trigger_notification', {
          p_user_id: playerId,
          p_type: 'match_edited',
          p_title: 'Match Updated',
          p_body: `${editedByName} edited your match. ${fieldsText}`,
          p_data: { 
            type: 'match_edited',
            match_id: matchId,
            edited_by: editedById,
            edited_fields: editedFields
          }
        });
      }
    } catch (error) {
      console.error('Failed to send match edited notification:', error);
    }
  }
};