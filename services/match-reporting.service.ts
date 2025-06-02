

import { supabase } from '@/config/supabase';
import { 
  MatchReport, 
  ReportReason, 
  ValidationStatus, 
  ReportMatchPayload, 
  CanReportResponse,
  ValidationWindowInfo,
  MatchWithValidation 
} from '@/types/match-reporting';

/**
 * Service class handling all match reporting operations
 * Implements comprehensive validation and reporting logic
 */
export class MatchReportingService {
  /**
   * Report a match score issue
   * @param payload - Report details including match ID and reason
   * @param userId - ID of the reporting user
   * @returns Success status and any error details
   */
  static async reportMatch(
    payload: ReportMatchPayload, 
    userId: string
  ): Promise<{ success: boolean; error?: string; report?: MatchReport }> {
    try {
      // 1. Verify user can report this match
      const canReport = await this.canUserReportMatch(payload.match_id, userId);
      
      if (!canReport.can_report) {
        return { success: false, error: canReport.reason };
      }

      // 2. Create the report
      const { data: report, error: reportError } = await supabase
        .from('match_reports')
        .insert({
          match_id: payload.match_id,
          reporter_id: userId,
          reason: payload.reason,
          additional_details: payload.additional_details || null
        })
        .select()
        .single();

      if (reportError) {
        console.error('Error creating match report:', reportError);
        return { 
          success: false, 
          error: reportError.message || 'Failed to submit report' 
        };
      }

      // 3. Check if match should be immediately disputed
      const { data: match } = await supabase
        .from('matches')
        .select('report_count, validation_status')
        .eq('id', payload.match_id)
        .single();

      if (match && match.report_count >= 2 && match.validation_status === 'disputed') {
        // Optionally reverse ratings immediately
        await this.handleDisputedMatch(payload.match_id);
      }

      return { success: true, report };
    } catch (error) {
      console.error('Error in reportMatch:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred while reporting the match' 
      };
    }
  }

  /**
   * Check if a user can report a specific match
   * @param matchId - ID of the match to check
   * @param userId - ID of the user attempting to report
   * @returns Whether user can report and reason if not
   */
  static async canUserReportMatch(
    matchId: string, 
    userId: string
  ): Promise<CanReportResponse> {
    try {
      const { data, error } = await supabase
        .rpc('can_user_report_match', {
          p_match_id: matchId,
          p_user_id: userId
        });

      if (error) {
        console.error('Error checking report eligibility:', error);
        return { can_report: false, reason: 'Failed to verify eligibility' };
      }

      return data?.[0] || { can_report: false, reason: 'Unknown error' };
    } catch (error) {
      console.error('Error in canUserReportMatch:', error);
      return { can_report: false, reason: 'System error' };
    }
  }

  /**
   * Get all reports for a specific match
   * @param matchId - ID of the match
   * @returns Array of match reports with reporter details
   */
  static async getMatchReports(matchId: string): Promise<MatchReport[]> {
    try {
      const { data, error } = await supabase
        .from('match_reports')
        .select(`
          *,
          reporter:profiles!reporter_id(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching match reports:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMatchReports:', error);
      return [];
    }
  }

  /**
   * Calculate validation window information for a match
   * @param match - Match with validation data
   * @returns Detailed validation window status
   */
  static calculateValidationWindow(match: MatchWithValidation): ValidationWindowInfo {
    if (!match.validation_deadline) {
      return {
        is_open: false,
        deadline: null,
        hours_remaining: 0,
        minutes_remaining: 0,
        status_text: 'No validation period',
        status_color: '#6b7280' // gray
      };
    }

    const now = new Date();
    const deadline = new Date(match.validation_deadline);
    const diffMs = deadline.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return {
        is_open: false,
        deadline,
        hours_remaining: 0,
        minutes_remaining: 0,
        status_text: match.validation_status === 'disputed' 
          ? 'Match disputed' 
          : 'Validation period ended',
        status_color: match.validation_status === 'disputed' 
          ? '#dc2626' // red
          : '#6b7280' // gray
      };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let statusText = '';
    let statusColor = '#059669'; // green

    if (hours >= 20) {
      statusText = `${hours} hours to report`;
      statusColor = '#059669'; // green
    } else if (hours >= 12) {
      statusText = `${hours} hours to report`;
      statusColor = '#3b82f6'; // blue
    } else if (hours >= 6) {
      statusText = `${hours}h ${minutes}m to report`;
      statusColor = '#f59e0b'; // amber
    } else if (hours >= 1) {
      statusText = `${hours}h ${minutes}m remaining`;
      statusColor = '#ef4444'; // red
    } else {
      statusText = `${minutes} minutes left!`;
      statusColor = '#dc2626'; // dark red
    }

    return {
      is_open: true,
      deadline,
      hours_remaining: hours,
      minutes_remaining: minutes,
      status_text: statusText,
      status_color: statusColor
    };
  }

  /**
   * Handle a match that has been disputed
   * Reverses ratings and marks match as cancelled
   * @param matchId - ID of the disputed match
   */
  static async handleDisputedMatch(matchId: string): Promise<void> {
    try {
      // 1. Get match details with player ratings
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, glicko_rating, glicko_rd, glicko_vol),
          player2:profiles!player2_id(id, glicko_rating, glicko_rd, glicko_vol),
          player3:profiles!player3_id(id, glicko_rating, glicko_rd, glicko_vol),
          player4:profiles!player4_id(id, glicko_rating, glicko_rd, glicko_vol)
        `)
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        console.error('Error fetching disputed match:', matchError);
        return;
      }

      // 2. Only proceed if ratings were applied
      if (!match.rating_applied) {
        console.log(`Ratings not yet applied for match ${matchId}, no reversal needed.`);
        // Still mark as cancelled if disputed, but ratings were never applied
        const { error: updateError } = await supabase
          .from('matches')
          .update({
            validation_status: 'cancelled',
            // rating_applied is already false
          })
          .eq('id', matchId);
        if (updateError) {
          console.error('Error updating disputed match (no ratings applied):', updateError);
        }
        return;
      }

      // 3. Implement rating reversal logic
      // This assumes a 'match_rating_changes' table exists with columns:
      // player_id, match_id, rating_before, rd_before, vol_before
      const { data: ratingChanges, error: changesError } = await supabase
        .from('match_rating_changes')
        .select('player_id, rating_before, rd_before, vol_before')
        .eq('match_id', matchId);

      if (changesError) {
        console.error(`Error fetching rating changes for match ${matchId}:`, changesError);
        // Potentially proceed to mark as cancelled but log the failure to revert ratings
        // For now, we'll stop to avoid partial processing if critical data is missing.
        return;
      }

      if (!ratingChanges || ratingChanges.length === 0) {
        console.warn(`No rating changes found for match ${matchId}, cannot reverse ratings. Proceeding to mark as cancelled.`);
      } else {
        // Revert ratings for each player involved
        for (const change of ratingChanges) {
          const { error: playerUpdateError } = await supabase
            .from('profiles')
            .update({
              glicko_rating: change.rating_before,
              glicko_rd: change.rd_before,
              glicko_vol: change.vol_before,
            })
            .eq('id', change.player_id);

          if (playerUpdateError) {
            console.error(`Error reverting ratings for player ${change.player_id} in match ${matchId}:`, playerUpdateError);
            // Decide on error handling: continue, or stop and log?
            // For now, log and continue to ensure match status is updated.
          }
        }
        console.log(`Ratings successfully reverted for match ${matchId}.`);
      }
      
      // 4. Update match status to cancelled and mark ratings as not applied
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          validation_status: 'cancelled',
          rating_applied: false // Mark that ratings are no longer (or were not successfully) applied
        })
        .eq('id', matchId);

      if (updateError) {
        console.error('Error updating disputed match status after attempting rating reversal:', updateError);
      } else {
        console.log(`Match ${matchId} marked as cancelled and rating_applied set to false due to disputes.`);
      }

    } catch (error) {
      console.error('Error in handleDisputedMatch:', error);
    }
  }

  /**
   * Process matches that have passed their validation deadline
   * Should be called periodically (e.g., via cron job)
   */
  static async processExpiredValidations(): Promise<void> {
    try {
      // Find all matches past deadline that are still pending
      const { data: pendingMatches, error } = await supabase
        .from('matches')
        .select('id, report_count')
        .eq('validation_status', 'pending')
        .lt('validation_deadline', new Date().toISOString())
        .eq('rating_applied', false);

      if (error) {
        console.error('Error fetching pending validations:', error);
        return;
      }

      // Process each match
      for (const match of pendingMatches || []) {
        if (match.report_count < 2) {
          // Validate and apply ratings
          await supabase.rpc('process_match_validation', {
            p_match_id: match.id
          });
        }
      }
    } catch (error) {
      console.error('Error in processExpiredValidations:', error);
    }
  }

  /**
   * Get validation status summary for multiple matches
   * Useful for dashboard displays
   * @param matchIds - Array of match IDs to check
   * @returns Map of match ID to validation status
   */
  static async getValidationStatuses(
    matchIds: string[]
  ): Promise<Map<string, ValidationStatus>> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, validation_status')
        .in('id', matchIds);

      if (error) {
        console.error('Error fetching validation statuses:', error);
        return new Map();
      }

      const statusMap = new Map<string, ValidationStatus>();
      (data || []).forEach(match => {
        statusMap.set(match.id, match.validation_status as ValidationStatus);
      });

      return statusMap;
    } catch (error) {
      console.error('Error in getValidationStatuses:', error);
      return new Map();
    }
  }
}