import { supabase } from "@/config/supabase";
import {
  MatchReport,
  ReportReason,
  ValidationStatus,
  ReportMatchPayload,
  CanReportResponse,
  ValidationWindowInfo,
  MatchWithValidation,
} from "@/types/match-reporting";

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
    userId: string,
  ): Promise<{ success: boolean; error?: string; report?: MatchReport }> {
    try {
      // 1. Verify user can report this match
      const canReport = await this.canUserReportMatch(payload.match_id, userId);

      if (!canReport.can_report) {
        return { success: false, error: canReport.reason };
      }

      // 2. Create the report
      const { data: report, error: reportError } = await supabase
        .from("match_reports")
        .insert({
          match_id: payload.match_id,
          reporter_id: userId,
          reason: payload.reason,
          additional_details: payload.additional_details || null,
        })
        .select()
        .single();

      if (reportError) {
        console.error("Error creating match report:", reportError);
        return {
          success: false,
          error: reportError.message || "Failed to submit report",
        };
      }

      // 3. Check if match should be immediately disputed
      const { data: match } = await supabase
        .from("matches")
        .select("report_count, validation_status")
        .eq("id", payload.match_id)
        .single();

      if (
        match &&
        match.report_count >= 2 &&
        match.validation_status === "disputed"
      ) {
        // Optionally reverse ratings immediately
        await this.handleDisputedMatch(payload.match_id);
      }

      return { success: true, report };
    } catch (error) {
      console.error("Error in reportMatch:", error);
      return {
        success: false,
        error: "An unexpected error occurred while reporting the match",
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
    userId: string,
  ): Promise<CanReportResponse> {
    try {
      const { data, error } = await supabase.rpc("can_user_report_match", {
        p_match_id: matchId,
        p_user_id: userId,
      });

      if (error) {
        console.error("Error checking report eligibility:", error);
        return { can_report: false, reason: "Failed to verify eligibility" };
      }

      return data?.[0] || { can_report: false, reason: "Unknown error" };
    } catch (error) {
      console.error("Error in canUserReportMatch:", error);
      return { can_report: false, reason: "System error" };
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
        .from("match_reports")
        .select(
          `
          *,
          reporter:profiles!reporter_id(
            id,
            full_name,
            email,
            avatar_url
          )
        `,
        )
        .eq("match_id", matchId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching match reports:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in getMatchReports:", error);
      return [];
    }
  }

  /**
   * Calculate validation window information for a match
   * @param match - Match with validation data
   * @returns Detailed validation window status
   */
  static calculateValidationWindow(
    match: MatchWithValidation,
  ): ValidationWindowInfo {
    if (!match.validation_deadline) {
      return {
        is_open: false,
        deadline: null,
        hours_remaining: 0,
        minutes_remaining: 0,
        status_text: "No validation period",
        status_color: "#6b7280", // gray
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
        status_text:
          match.validation_status === "disputed"
            ? "Match disputed"
            : "Validation period ended",
        status_color:
          match.validation_status === "disputed"
            ? "#dc2626" // red
            : "#6b7280", // gray
      };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let statusText = "";
    let statusColor = "#059669"; // green

    if (hours >= 20) {
      statusText = `${hours} hours to report`;
      statusColor = "#059669"; // green
    } else if (hours >= 12) {
      statusText = `${hours} hours to report`;
      statusColor = "#3b82f6"; // blue
    } else if (hours >= 6) {
      statusText = `${hours}h ${minutes}m to report`;
      statusColor = "#f59e0b"; // amber
    } else if (hours >= 1) {
      statusText = `${hours}h ${minutes}m remaining`;
      statusColor = "#ef4444"; // red
    } else {
      statusText = `${minutes} minutes left!`;
      statusColor = "#dc2626"; // dark red
    }

    return {
      is_open: true,
      deadline,
      hours_remaining: hours,
      minutes_remaining: minutes,
      status_text: statusText,
      status_color: statusColor,
    };
  }

  static async handleDisputedMatch(matchId: string): Promise<void> {
    try {
      console.log(
        `🔄 [DISPUTE] Starting dispute handling for match: ${matchId}`,
      );

      // STEP 4.1.1.1.1: Validate match exists and check current status
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("validation_status, rating_applied, report_count, disputed_at")
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        console.error(
          `❌ [DISPUTE] Failed to fetch match for dispute handling:`,
          matchError,
        );
        throw new Error(
          `Match not found: ${matchError?.message || "Unknown error"}`,
        );
      }

      console.log(`📊 [DISPUTE] Match status before dispute handling:`, {
        validation_status: match.validation_status,
        rating_applied: match.rating_applied,
        report_count: match.report_count,
        disputed_at: match.disputed_at,
      });

      // STEP 4.1.1.1.2: Check if dispute handling is necessary
      if (
        match.validation_status === "cancelled" ||
        match.validation_status === "disputed"
      ) {
        console.log(
          `ℹ️ [DISPUTE] Match already in terminal state: ${match.validation_status}`,
        );
        return;
      }

      // STEP 4.1.1.1.3: Mark match as disputed first (for immediate UI feedback)
      const { error: statusUpdateError } = await supabase
        .from("matches")
        .update({
          validation_status: "disputed",
          disputed_at: new Date().toISOString(),
        })
        .eq("id", matchId);

      if (statusUpdateError) {
        console.error(
          `❌ [DISPUTE] Failed to mark match as disputed:`,
          statusUpdateError,
        );
        throw new Error(`Status update failed: ${statusUpdateError.message}`);
      }

      console.log(
        `🚨 [DISPUTE] Match marked as disputed at ${new Date().toISOString()}`,
      );

      // STEP 4.1.1.1.4: Handle rating reversal if ratings were applied
      if (match.rating_applied) {
        console.log(
          `🔄 [DISPUTE] Ratings were applied, initiating reversal process`,
        );

        // Use the enhanced rating service for atomic rating reversal
        const { EnhancedRatingService } = await import(
          "@/services/enhanced-rating.service"
        );
        const revertResult =
          await EnhancedRatingService.revertDisputedMatchRatings(matchId);

        if (!revertResult.success) {
          console.error(
            `❌ [DISPUTE] Rating reversal failed:`,
            revertResult.error,
          );

          // Log the failure but don't throw - match is already marked as disputed
          console.warn(
            `⚠️ [DISPUTE] Continuing with dispute handling despite rating reversal failure`,
          );
        } else {
          console.log(
            `✅ [DISPUTE] Rating reversal completed successfully: ${revertResult.message}`,
          );
        }
      } else {
        console.log(
          `ℹ️ [DISPUTE] No ratings to revert - ratings were not yet applied`,
        );

        // Ensure rating_applied is explicitly set to false for disputed matches
        const { error: ratingStatusError } = await supabase
          .from("matches")
          .update({ rating_applied: false })
          .eq("id", matchId);

        if (ratingStatusError) {
          console.warn(
            `⚠️ [DISPUTE] Failed to update rating_applied status:`,
            ratingStatusError,
          );
        }
      }

      // STEP 4.1.1.1.5: Final status update to ensure consistency
      const { error: finalUpdateError } = await supabase
        .from("matches")
        .update({
          validation_status: "cancelled", // Final state for disputed matches
          rating_applied: false, // Ensure ratings are marked as not applied
        })
        .eq("id", matchId);

      if (finalUpdateError) {
        console.error(
          `❌ [DISPUTE] Failed to finalize dispute status:`,
          finalUpdateError,
        );
        throw new Error(
          `Final status update failed: ${finalUpdateError.message}`,
        );
      }

      console.log(
        `🎯 [DISPUTE] Dispute handling completed successfully for match: ${matchId}`,
      );
      console.log(
        `📋 [DISPUTE] Final status: validation_status='cancelled', rating_applied=false`,
      );
    } catch (error) {
      console.error(
        `💥 [DISPUTE] Critical error in dispute handling for match ${matchId}:`,
        error,
      );

      // Attempt to log the error in the database for admin review
      try {
        await supabase
          .from("matches")
          .update({
            validation_status: "disputed", // Ensure match is at least marked as disputed
            disputed_at: new Date().toISOString(),
          })
          .eq("id", matchId);
      } catch (recoveryError) {
        console.error(
          `💥 [DISPUTE] Failed to update match status during error recovery:`,
          recoveryError,
        );
      }

      // Re-throw for upstream error handling
      throw error;
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
        .from("matches")
        .select("id, report_count")
        .eq("validation_status", "pending")
        .lt("validation_deadline", new Date().toISOString())
        .eq("rating_applied", false);

      if (error) {
        console.error("Error fetching pending validations:", error);
        return;
      }

      // Process each match
      for (const match of pendingMatches || []) {
        if (match.report_count < 2) {
          // Validate and apply ratings
          await supabase.rpc("process_match_validation", {
            p_match_id: match.id,
          });
        }
      }
    } catch (error) {
      console.error("Error in processExpiredValidations:", error);
    }
  }

  /**
   * Get validation status summary for multiple matches
   * Useful for dashboard displays
   * @param matchIds - Array of match IDs to check
   * @returns Map of match ID to validation status
   */
  static async getValidationStatuses(
    matchIds: string[],
  ): Promise<Map<string, ValidationStatus>> {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("id, validation_status")
        .in("id", matchIds);

      if (error) {
        console.error("Error fetching validation statuses:", error);
        return new Map();
      }

      const statusMap = new Map<string, ValidationStatus>();
      (data || []).forEach((match) => {
        statusMap.set(match.id, match.validation_status as ValidationStatus);
      });

      return statusMap;
    } catch (error) {
      console.error("Error in getValidationStatuses:", error);
      return new Map();
    }
  }
}
