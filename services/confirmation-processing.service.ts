import { supabase } from "@/config/supabase";
import { EnhancedRatingService } from "./enhanced-rating.service";
import { MatchConfirmationService } from "./match-confirmation.service";

export interface ProcessingResult {
  processed: number;
  confirmedApplied: number;
  expiredApplied: number;
  rejected: number;
  errors: string[];
}

export class ConfirmationProcessingService {
  /**
   * Process all matches that need confirmation handling
   * This should be called periodically (e.g., every hour) by a scheduled job
   */
  static async processAllPendingConfirmations(): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      processed: 0,
      confirmedApplied: 0,
      expiredApplied: 0,
      rejected: 0,
      errors: [],
    };

    try {
      console.log("🔄 [PROCESSOR] Starting confirmation processing...");

      // Call the database function that handles all the logic
      const { data, error } = await supabase.rpc("process_match_confirmations");

      if (error) {
        console.error("❌ [PROCESSOR] Database processing error:", error);
        result.errors.push(error.message);
        return result;
      }

      if (data && data.length > 0) {
        const processResult = data[0];
        result.processed = processResult.processed_count || 0;
        result.confirmedApplied = processResult.confirmed_applied || 0;
        result.expiredApplied = processResult.expired_applied || 0;
        result.rejected = processResult.rejected_count || 0;

        console.log(`✅ [PROCESSOR] Processing complete:`, {
          processed: result.processed,
          confirmedApplied: result.confirmedApplied,
          expiredApplied: result.expiredApplied,
          rejected: result.rejected,
        });
      }

      // Also process any matches that the database function might have missed
      await this.processMatchesWithJavaScript(result);
    } catch (error) {
      console.error("💥 [PROCESSOR] Critical error:", error);
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return result;
  }

  /**
   * JavaScript-based processing as a backup or for more complex logic
   */
  private static async processMatchesWithJavaScript(result: ProcessingResult) {
    try {
      // Find matches that need processing
      const { data: matches, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          match_confirmations (*)
        `,
        )
        .eq("status", "4")
        .eq("rating_applied", false)
        .or("all_confirmed.eq.true,validation_deadline.lte.now()");

      if (error || !matches) {
        console.error("❌ [PROCESSOR] Error fetching matches:", error);
        return;
      }

      for (const match of matches) {
        try {
          // Skip if already processed
          if (match.validation_status === "validated" && match.rating_applied) {
            continue;
          }

          const confirmations = match.match_confirmations || [];
          const rejectionCount = confirmations.filter(
            (c: any) => c.status === "rejected",
          ).length;
          const allConfirmed = match.all_confirmed;

          // Handle different scenarios
          if (rejectionCount >= 2) {
            // Mark as disputed
            await supabase
              .from("matches")
              .update({
                validation_status: "disputed",
                confirmation_status: "rejected",
                disputed_at: new Date().toISOString(),
              })
              .eq("id", match.id);

            result.rejected++;
            console.log(
              `❌ [PROCESSOR] Match ${match.id} rejected due to multiple rejections`,
            );
          } else if (allConfirmed) {
            // Apply ratings immediately
            const ratingResult =
              await EnhancedRatingService.applyValidatedRatings(match.id);

            if (ratingResult.success) {
              result.confirmedApplied++;
              console.log(
                `✅ [PROCESSOR] Match ${match.id} confirmed and ratings applied`,
              );
            } else {
              result.errors.push(
                `Failed to apply ratings for match ${match.id}: ${ratingResult.message}`,
              );
            }
          } else if (new Date(match.validation_deadline) <= new Date()) {
            // Validation period expired
            if (rejectionCount < 2 && (match.report_count || 0) < 2) {
              // Apply ratings
              const ratingResult =
                await EnhancedRatingService.applyValidatedRatings(match.id);

              if (ratingResult.success) {
                result.expiredApplied++;
                console.log(
                  `⏰ [PROCESSOR] Match ${match.id} validated after expiry`,
                );
              } else {
                result.errors.push(
                  `Failed to apply ratings for expired match ${match.id}: ${ratingResult.message}`,
                );
              }
            } else {
              // Too many issues - dispute it
              await supabase
                .from("matches")
                .update({
                  validation_status: "disputed",
                  disputed_at: new Date().toISOString(),
                })
                .eq("id", match.id);

              result.rejected++;
              console.log(
                `❌ [PROCESSOR] Match ${match.id} disputed after expiry due to reports/rejections`,
              );
            }
          }

          result.processed++;
        } catch (matchError) {
          console.error(
            `💥 [PROCESSOR] Error processing match ${match.id}:`,
            matchError,
          );
          result.errors.push(
            `Match ${match.id}: ${matchError instanceof Error ? matchError.message : "Unknown error"}`,
          );
        }
      }
    } catch (error) {
      console.error("💥 [PROCESSOR] Error in JavaScript processing:", error);
      result.errors.push(
        `JS Processing: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Process a specific match
   */
  static async processSingleMatch(matchId: string): Promise<{
    success: boolean;
    message: string;
    action?: "confirmed" | "expired" | "rejected";
  }> {
    try {
      console.log(`🔄 [PROCESSOR] Processing single match: ${matchId}`);

      // Get match details
      const confirmationStatus =
        await MatchConfirmationService.getMatchConfirmationStatus(matchId);

      if (!confirmationStatus) {
        return {
          success: false,
          message: "Failed to get confirmation status",
        };
      }

      // Get match details
      const { data: match, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error || !match) {
        return {
          success: false,
          message: "Match not found",
        };
      }

      // Check if already processed
      if (match.rating_applied) {
        return {
          success: true,
          message: "Match already processed",
        };
      }

      // Process based on status
      if (confirmationStatus.rejected_count >= 2) {
        // Reject the match
        await supabase
          .from("matches")
          .update({
            validation_status: "disputed",
            confirmation_status: "rejected",
            disputed_at: new Date().toISOString(),
          })
          .eq("id", matchId);

        return {
          success: true,
          message: "Match rejected due to multiple player rejections",
          action: "rejected",
        };
      }

      if (confirmationStatus.all_confirmed) {
        // Apply ratings immediately
        const result =
          await EnhancedRatingService.applyValidatedRatings(matchId);

        return {
          success: result.success,
          message: result.message,
          action: "confirmed",
        };
      }

      if (new Date(match.validation_deadline) <= new Date()) {
        // Validation expired - check if we can apply ratings
        if (
          confirmationStatus.rejected_count < 2 &&
          (match.report_count || 0) < 2
        ) {
          const result =
            await EnhancedRatingService.applyValidatedRatings(matchId);

          return {
            success: result.success,
            message: result.message,
            action: "expired",
          };
        } else {
          // Dispute it
          await supabase
            .from("matches")
            .update({
              validation_status: "disputed",
              disputed_at: new Date().toISOString(),
            })
            .eq("id", matchId);

          return {
            success: true,
            message: "Match disputed due to reports/rejections",
            action: "rejected",
          };
        }
      }

      return {
        success: false,
        message: "Match not ready for processing yet",
      };
    } catch (error) {
      console.error("💥 [PROCESSOR] Error processing single match:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats(): Promise<{
    pendingConfirmation: number;
    pendingExpiry: number;
    readyToProcess: number;
    disputed: number;
    completed: number;
  }> {
    try {
      const now = new Date();

      // Get various counts
      const { data: stats } = await supabase
        .from("matches")
        .select(
          "status, rating_applied, all_confirmed, validation_deadline, validation_status, confirmation_status",
        )
        .eq("status", "4");

      if (!stats) {
        return {
          pendingConfirmation: 0,
          pendingExpiry: 0,
          readyToProcess: 0,
          disputed: 0,
          completed: 0,
        };
      }

      const counts = {
        pendingConfirmation: 0,
        pendingExpiry: 0,
        readyToProcess: 0,
        disputed: 0,
        completed: 0,
      };

      stats.forEach((match) => {
        if (match.rating_applied) {
          counts.completed++;
        } else if (
          match.validation_status === "disputed" ||
          match.confirmation_status === "rejected"
        ) {
          counts.disputed++;
        } else if (match.all_confirmed) {
          counts.readyToProcess++;
        } else if (
          match.validation_deadline &&
          new Date(match.validation_deadline) <= now
        ) {
          counts.readyToProcess++;
        } else if (
          match.validation_deadline &&
          new Date(match.validation_deadline) > now
        ) {
          counts.pendingExpiry++;
        } else {
          counts.pendingConfirmation++;
        }
      });

      return counts;
    } catch (error) {
      console.error("Error getting processing stats:", error);
      return {
        pendingConfirmation: 0,
        pendingExpiry: 0,
        readyToProcess: 0,
        disputed: 0,
        completed: 0,
      };
    }
  }
}
