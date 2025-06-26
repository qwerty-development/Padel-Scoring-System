import { supabase } from "@/config/supabase";

export interface MatchConfirmation {
  id: string;
  match_id: string;
  player_id: string;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfirmationSummary {
  match_id: string;
  confirmation_status: string;
  all_confirmed: boolean;
  confirmed_count: number;
  rejected_count: number;
  pending_count: number;
  total_players: number;
  confirmations: MatchConfirmation[];
  can_apply_ratings: boolean;
  should_cancel: boolean;
}

export interface ConfirmationResult {
  success: boolean;
  message: string;
  should_cancel?: boolean;
  should_apply_ratings?: boolean;
}

export class MatchConfirmationService {
  /**
   * Get confirmation status for a match
   */
  static async getMatchConfirmationStatus(matchId: string): Promise<ConfirmationSummary | null> {
    try {
      console.log(`📊 [CONFIRMATION] Fetching confirmation status for match: ${matchId}`);

      // Fetch match details with confirmations
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          match_confirmations (*)
        `)
        .eq('id', matchId)
        .single();

      if (matchError) {
        console.error('❌ [CONFIRMATION] Error fetching match:', matchError);
        return null;
      }

      // Fetch confirmation summary
      const { data: summary, error: summaryError } = await supabase
        .from('match_confirmation_summary')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (summaryError) {
        console.error('❌ [CONFIRMATION] Error fetching summary:', summaryError);
      }

      const confirmations = match.match_confirmations || [];
      const confirmedCount = confirmations.filter((c: MatchConfirmation) => c.status === 'confirmed').length;
      const rejectedCount = confirmations.filter((c: MatchConfirmation) => c.status === 'rejected').length;
      const pendingCount = confirmations.filter((c: MatchConfirmation) => c.status === 'pending').length;

      return {
        match_id: matchId,
        confirmation_status: match.confirmation_status || 'pending',
        all_confirmed: match.all_confirmed || false,
        confirmed_count: confirmedCount,
        rejected_count: rejectedCount,
        pending_count: pendingCount,
        total_players: confirmations.length,
        confirmations: confirmations,
        can_apply_ratings: match.all_confirmed && !match.rating_applied,
        should_cancel: rejectedCount >= 2
      };
    } catch (error) {
      console.error('💥 [CONFIRMATION] Critical error:', error);
      return null;
    }
  }

  /**
   * Confirm match score
   */
  static async confirmMatchScore(matchId: string, playerId: string): Promise<ConfirmationResult> {
    try {
      console.log(`✅ [CONFIRMATION] Player ${playerId} confirming match ${matchId}`);

      // Call the database function
      const { data, error } = await supabase
        .rpc('confirm_match_score', {
          p_match_id: matchId,
          p_player_id: playerId
        });

      if (error) {
        console.error('❌ [CONFIRMATION] Error confirming match:', error);
        return {
          success: false,
          message: error.message || 'Failed to confirm match score'
        };
      }

      const result = data[0];
      console.log('✅ [CONFIRMATION] Confirmation result:', result);

      // Check if all players confirmed
      const status = await this.getMatchConfirmationStatus(matchId);
      if (status?.all_confirmed) {
        // Trigger immediate rating application
        await this.applyRatingsImmediately(matchId);
        
        return {
          success: true,
          message: result.message,
          should_apply_ratings: true
        };
      }

      return {
        success: result.success,
        message: result.message
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
   * Reject match score
   */
  static async rejectMatchScore(
    matchId: string, 
    playerId: string, 
    reason?: string
  ): Promise<ConfirmationResult> {
    try {
      console.log(`❌ [CONFIRMATION] Player ${playerId} rejecting match ${matchId}`);

      // Call the database function
      const { data, error } = await supabase
        .rpc('reject_match_score', {
          p_match_id: matchId,
          p_player_id: playerId,
          p_reason: reason || null
        });

      if (error) {
        console.error('❌ [CONFIRMATION] Error rejecting match:', error);
        return {
          success: false,
          message: error.message || 'Failed to reject match score'
        };
      }

      const result = data[0];
      console.log('❌ [CONFIRMATION] Rejection result:', result);

      return {
        success: result.success,
        message: result.message,
        should_cancel: result.should_cancel
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
   * Apply ratings immediately when all players confirm
   */
  static async applyRatingsImmediately(matchId: string): Promise<boolean> {
    try {
      console.log(`🚀 [CONFIRMATION] Applying ratings immediately for match ${matchId}`);

      // Import the enhanced rating service
      const { EnhancedRatingService } = await import('./enhanced-rating.service');

      // Apply the validated ratings
      const result = await EnhancedRatingService.applyValidatedRatings(matchId);

      if (result.success) {
        console.log('✅ [CONFIRMATION] Ratings applied successfully');
        
        // Update match to reflect immediate application
        await supabase
          .from('matches')
          .update({
            rating_applied: true,
            validation_status: 'validated'
          })
          .eq('id', matchId);
      } else {
        console.error('❌ [CONFIRMATION] Failed to apply ratings:', result.message);
      }

      return result.success;
    } catch (error) {
      console.error('💥 [CONFIRMATION] Critical error applying ratings:', error);
      return false;
    }
  }

  /**
   * Check if user can confirm/reject a match
   */
  static async canUserConfirmMatch(matchId: string, userId: string): Promise<boolean> {
    try {
      const { data: match, error } = await supabase
        .from('matches')
        .select('player1_id, player2_id, player3_id, player4_id, status')
        .eq('id', matchId)
        .single();

      if (error || !match) return false;

      // Check if user is a participant
      const isParticipant = [
        match.player1_id,
        match.player2_id,
        match.player3_id,
        match.player4_id
      ].includes(userId);

      // Check if match is completed
      const isCompleted = match.status === '4';

      return isParticipant && isCompleted;
    } catch (error) {
      console.error('Error checking confirmation eligibility:', error);
      return false;
    }
  }

  /**
   * Get user's confirmation status for a match
   */
  static async getUserConfirmationStatus(
    matchId: string, 
    userId: string
  ): Promise<MatchConfirmation | null> {
    try {
      const { data, error } = await supabase
        .from('match_confirmations')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user confirmation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserConfirmationStatus:', error);
      return null;
    }
  }

  /**
   * Subscribe to confirmation updates
   */
  static subscribeToConfirmationUpdates(
    matchId: string,
    onUpdate: (payload: any) => void
  ) {
    return supabase
      .channel(`match_confirmations:${matchId}`)
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