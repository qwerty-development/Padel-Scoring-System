// services/match-confirmation.service.ts
// REPLACE YOUR ENTIRE FILE WITH THIS

import { supabase } from '@/config/supabase';

export interface MatchConfirmation {
  id: string;
  match_id: string;
  player_id: string;
  action: 'pending' | 'approved' | 'reported';
  action_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfirmationSummary {
  match_id: string;
  confirmation_status: 'pending' | 'approved' | 'cancelled';
  confirmation_deadline: string;
  approved_count: number;
  reported_count: number;
  approved_at: string | null;
  cancelled_at: string | null;
  rating_applied: boolean;
  status_text: string;
  hours_remaining: number;
  player_confirmations: Array<{
    player_id: string;
    action: string;
    action_at: string | null;
    reason: string | null;
  }>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  newStatus?: 'pending' | 'approved' | 'cancelled';
}

export class MatchConfirmationService {
  /**
   * Get confirmation summary for a match
   */
  static async getMatchConfirmationSummary(matchId: string): Promise<ConfirmationSummary | null> {
    try {
      console.log(`📊 [CONFIRMATION] Getting summary for match: ${matchId}`);

      const { data, error } = await supabase
        .from('match_confirmation_summary')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (error) {
        console.error('❌ [CONFIRMATION] Error fetching summary:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 [CONFIRMATION] Critical error:', error);
      return null;
    }
  }

  /**
   * Get all confirmations for a match
   */
  static async getMatchConfirmations(matchId: string): Promise<MatchConfirmation[]> {
    try {
      const { data, error } = await supabase
        .from('match_confirmations')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at');

      if (error) {
        console.error('Error fetching confirmations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMatchConfirmations:', error);
      return [];
    }
  }

  /**
   * Get player's confirmation for a match
   */
  static async getPlayerConfirmation(
    matchId: string, 
    playerId: string
  ): Promise<MatchConfirmation | null> {
    try {
      const { data, error } = await supabase
        .from('match_confirmations')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_id', playerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching player confirmation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getPlayerConfirmation:', error);
      return null;
    }
  }

  /**
   * Approve match
   */
  static async approveMatch(matchId: string, playerId: string): Promise<ActionResult> {
    try {
      console.log(`✅ [CONFIRMATION] Player ${playerId} approving match ${matchId}`);

      // First check if player can take action
      const playerConf = await this.getPlayerConfirmation(matchId, playerId);
      
      if (!playerConf) {
        return {
          success: false,
          message: 'You are not a participant in this match'
        };
      }

      if (playerConf.action !== 'pending') {
        return {
          success: false,
          message: `You have already ${playerConf.action} this match`
        };
      }

      // Check match status
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('confirmation_status, confirmation_deadline')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        return {
          success: false,
          message: 'Match not found'
        };
      }

      if (match.confirmation_status !== 'pending') {
        return {
          success: false,
          message: `Match is already ${match.confirmation_status}`
        };
      }

      // Check if within deadline
      if (new Date(match.confirmation_deadline) < new Date()) {
        return {
          success: false,
          message: 'Confirmation period has expired'
        };
      }

      // Update the confirmation
      const { error: updateError } = await supabase
        .from('match_confirmations')
        .update({
          action: 'approved',
          action_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId)
        .eq('player_id', playerId);

      if (updateError) {
        console.error('❌ [CONFIRMATION] Update error:', updateError);
        return {
          success: false,
          message: 'Failed to approve match'
        };
      }

      // Check the new status
      const summary = await this.getMatchConfirmationSummary(matchId);
      
      if (summary?.confirmation_status === 'approved') {
        // Trigger rating calculation
        const { error: ratingError } = await supabase
          .rpc('trigger_rating_calculation', { p_match_id: matchId });
          
        if (ratingError) {
          console.error('Rating trigger error:', ratingError);
        }

        return {
          success: true,
          message: '🎉 All players confirmed! Ratings will be updated.',
          newStatus: 'approved'
        };
      }

      return {
        success: true,
        message: 'Match approved successfully',
        newStatus: summary?.confirmation_status || 'pending'
      };
    } catch (error) {
      console.error('💥 [CONFIRMATION] Critical error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Report match
   */
  static async reportMatch(
    matchId: string, 
    playerId: string, 
    reason?: string
  ): Promise<ActionResult> {
    try {
      console.log(`🚫 [CONFIRMATION] Player ${playerId} reporting match ${matchId}`);

      // First check if player can take action
      const playerConf = await this.getPlayerConfirmation(matchId, playerId);
      
      if (!playerConf) {
        return {
          success: false,
          message: 'You are not a participant in this match'
        };
      }

      if (playerConf.action !== 'pending') {
        return {
          success: false,
          message: `You have already ${playerConf.action} this match`
        };
      }

      // Check match status
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('confirmation_status, confirmation_deadline')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        return {
          success: false,
          message: 'Match not found'
        };
      }

      if (match.confirmation_status !== 'pending') {
        return {
          success: false,
          message: `Match is already ${match.confirmation_status}`
        };
      }

      // Check if within deadline
      if (new Date(match.confirmation_deadline) < new Date()) {
        return {
          success: false,
          message: 'Confirmation period has expired'
        };
      }

      // Update the confirmation
      const { error: updateError } = await supabase
        .from('match_confirmations')
        .update({
          action: 'reported',
          action_at: new Date().toISOString(),
          reason: reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId)
        .eq('player_id', playerId);

      if (updateError) {
        console.error('❌ [CONFIRMATION] Update error:', updateError);
        return {
          success: false,
          message: 'Failed to report match'
        };
      }

      // Check the new status
      const summary = await this.getMatchConfirmationSummary(matchId);
      
      if (summary?.confirmation_status === 'cancelled') {
        return {
          success: true,
          message: '🚫 Match cancelled due to multiple reports. No ratings will be applied.',
          newStatus: 'cancelled'
        };
      }

      return {
        success: true,
        message: 'Match reported successfully',
        newStatus: summary?.confirmation_status || 'pending'
      };
    } catch (error) {
      console.error('💥 [CONFIRMATION] Critical error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Process expired confirmations (call from cron or manually)
   */
  static async processExpiredConfirmations(): Promise<{
    processed: number;
    approved: number;
    success: boolean;
  }> {
    try {
      console.log('🔄 [CONFIRMATION] Processing expired confirmations...');

      const { data, error } = await supabase
        .rpc('process_match_confirmations_and_ratings');

      if (error) {
        console.error('❌ [CONFIRMATION] Processing error:', error);
        return {
          processed: 0,
          approved: 0,
          success: false
        };
      }

      console.log('✅ [CONFIRMATION] Processing complete:', data);

      return {
        processed: data?.processed || 0,
        approved: data?.approved || 0,
        success: true
      };
    } catch (error) {
      console.error('💥 [CONFIRMATION] Critical error:', error);
      return {
        processed: 0,
        approved: 0,
        success: false
      };
    }
  }

  /**
   * Check if user is a participant
   */
  static async isUserParticipant(matchId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('player1_id, player2_id, player3_id, player4_id')
        .eq('id', matchId)
        .single();

      if (error || !data) return false;

      return [
        data.player1_id,
        data.player2_id,
        data.player3_id,
        data.player4_id
      ].includes(userId);
    } catch (error) {
      console.error('Error checking participant:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time updates
   */
  static subscribeToConfirmationUpdates(
    matchId: string,
    onUpdate: (payload: any) => void
  ) {
    return supabase
      .channel(`confirmations:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_confirmations',
          filter: `match_id=eq.${matchId}`
        },
        onUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        onUpdate
      )
      .subscribe();
  }
}