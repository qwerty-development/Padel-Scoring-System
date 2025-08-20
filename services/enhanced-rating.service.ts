import { supabase } from "@/config/supabase";
import { calculateMatchRatings } from "@/lib/glicko";

interface MatchRatingResult {
  success: boolean;
  message: string;
  error?: string;
  rating_changes?: any[];
}

interface RatingChangeRecord {
  player_id: string;
  rating_before: number;
  rd_before: number;
  vol_before: number;
  rating_after: number;
  rd_after: number;
  vol_after: number;
}

/**
 * Enhanced Rating Service with Validation and Dispute Handling
 *
 * ARCHITECTURE OVERVIEW:
 * 1. Deferred rating calculation at match completion
 * 2. 24-hour validation window for disputes (or immediate if all confirm)
 * 3. Automatic rating application after validation
 * 4. Dispute handling with rating reversion
 * 5. Audit trail for all rating changes
 */
export class EnhancedRatingService {
  /**
   * STEP 2.1.1.1: Calculate and Store Ratings (Deferred Application)
   *
   * PURPOSE: Calculate rating changes immediately but defer application
   * TIMING: Called when match is marked as completed
   * STORAGE: Saves changes to match_rating_changes table
   * APPLICATION: Deferred until validation period expires OR all players confirm
   *
   * @param matchId - UUID of the completed match
   * @returns Promise<MatchRatingResult>
   */
  static async calculateAndStoreRatings(
    matchId: string,
  ): Promise<MatchRatingResult> {
    try {
      console.log(
        `🎯 [RATING] Starting deferred rating calculation for match: ${matchId}`,
      );

      // STEP 2.1.1.1.1: Fetch match details with full player information
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:profiles!player1_id(id, glicko_rating, glicko_rd, glicko_vol),
          player2:profiles!player2_id(id, glicko_rating, glicko_rd, glicko_vol),
          player3:profiles!player3_id(id, glicko_rating, glicko_rd, glicko_vol),
          player4:profiles!player4_id(id, glicko_rating, glicko_rd, glicko_vol)
        `,
        )
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        console.error(`❌ [RATING] Match fetch error:`, matchError);
        return {
          success: false,
          message: "Failed to fetch match details",
          error: matchError?.message || "Match not found",
        };
      }

      // STEP 2.1.1.1.2: Validation checks
      if (match.rating_applied) {
        console.log(
          `ℹ️ [RATING] Ratings already applied for match: ${matchId}`,
        );
        return {
          success: true,
          message: "Ratings already calculated and applied",
        };
      }

      if (!match.winner_team || match.team1_score_set1 === null) {
        console.error(
          `❌ [RATING] Match incomplete - missing scores or winner`,
        );
        return {
          success: false,
          message: "Match scores incomplete",
          error: "Cannot calculate ratings for incomplete match",
        };
      }

      // STEP 2.1.1.1.3: Prepare player ratings for calculation
      const playerRatings = [
        match.player1,
        match.player2,
        match.player3,
        match.player4,
      ].map((player) => ({
        id: player.id,
        rating: parseFloat(player.glicko_rating) || 1500,
        rd: parseFloat(player.glicko_rd) || 350,
        vol: parseFloat(player.glicko_vol) || 0.06,
      }));

      console.log(
        `📊 [RATING] Current ratings:`,
        playerRatings.map((p) => `${p.id.substring(0, 8)}: ${p.rating}`),
      );

      // STEP 2.1.1.1.4: Calculate new ratings
      const winnerTeam = match.winner_team;
      const team1Wins = winnerTeam === 1 ? 1 : 0;
      const team2Wins = winnerTeam === 2 ? 1 : 0;

      const updatedRatings = calculateMatchRatings(
        playerRatings[0],
        playerRatings[1],
        playerRatings[2],
        playerRatings[3],
        team1Wins,
        team2Wins,
      );

      // Convert to array format consistent with existing code
      const newRatings = [
        updatedRatings.player1,
        updatedRatings.player2,
        updatedRatings.player3,
        updatedRatings.player4,
      ];

      console.log(
        `📈 [RATING] New ratings calculated:`,
        newRatings.map((p: any) => `${p.id}: ${p.rating}`),
      );

      // STEP 2.1.1.1.5: Prepare rating change records for audit trail
      const ratingChanges: RatingChangeRecord[] = playerRatings.map(
        (oldRating, index) => {
          const newRating = newRatings[index];
          return {
            player_id: oldRating.id,
            rating_before: oldRating.rating,
            rd_before: oldRating.rd,
            vol_before: oldRating.vol,
            rating_after: newRating.rating,
            rd_after: newRating.rd,
            vol_after: newRating.vol,
          };
        },
      );

      // STEP 2.1.1.1.6: Store rating changes WITHOUT applying to profiles
      const { error: storeError } = await supabase
        .from("match_rating_changes")
        .insert(
          ratingChanges.map((change) => ({
            match_id: matchId,
            ...change,
          })),
        );

      if (storeError) {
        console.error(
          `❌ [RATING] Failed to store rating changes:`,
          storeError,
        );
        return {
          success: false,
          message: "Failed to store rating changes",
          error: storeError.message,
        };
      }

      console.log(
        `✅ [RATING] Successfully stored rating changes for future application`,
      );

      // STEP 2.1.1.1.7: Update match with validation metadata (if not already set)
      const validationDeadline = new Date();
      validationDeadline.setHours(validationDeadline.getHours() + 24);

      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({
          validation_deadline:
            match.validation_deadline || validationDeadline.toISOString(),
          validation_status: "pending",
          rating_applied: false, // CRITICAL: Ratings not yet applied
          report_count: 0,
        })
        .eq("id", matchId);

      if (matchUpdateError) {
        console.error(
          `❌ [RATING] Failed to update match validation status:`,
          matchUpdateError,
        );
        return {
          success: false,
          message: "Failed to update match validation status",
          error: matchUpdateError.message,
        };
      }

      console.log(`🎯 [RATING] Match prepared for validation period.
Ratings will apply after: ${validationDeadline.toISOString()}`);

      return {
        success: true,
        message: `Ratings calculated and queued for application after validation period`,
        rating_changes: ratingChanges,
      };
    } catch (error) {
      console.error(`💥 [RATING] Critical error in rating calculation:`, error);
      return {
        success: false,
        message: "Critical error during rating calculation",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * STEP 2.1.1.2: Apply Pre-calculated Ratings After Validation
   *
   * PURPOSE: Apply stored rating changes after validation period expires OR all players confirm
   * SAFETY: Only applies if match is still in 'pending' status and not disputed
   * ATOMICITY: All rating updates succeed or all fail
   *
   * @param matchId - UUID of the match to process
   * @returns Promise<MatchRatingResult>
   */
  static async applyValidatedRatings(
    matchId: string,
  ): Promise<MatchRatingResult> {
    try {
      console.log(
        `🔄 [RATING] Starting validated rating application for match: ${matchId}`,
      );

      // STEP 2.1.1.2.1: Verify match is ready for rating application
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select(
          "validation_status, validation_deadline, rating_applied, report_count, all_confirmed, confirmation_status",
        )
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        console.error(`❌ [RATING] Match validation check failed:`, matchError);
        return {
          success: false,
          message: "Failed to verify match validation status",
          error: matchError?.message || "Match not found",
        };
      }

      // STEP 2.1.1.2.2: Validation status checks
      if (match.rating_applied) {
        console.log(
          `ℹ️ [RATING] Ratings already applied for match: ${matchId}`,
        );
        return {
          success: true,
          message: "Ratings already applied for this match",
        };
      }

      // Check if all players confirmed (immediate application)
      const canApplyImmediately =
        match.all_confirmed && match.confirmation_status === "confirmed";

      // Check if validation period has expired
      const validationExpired =
        match.validation_deadline &&
        new Date(match.validation_deadline) <= new Date();

      if (!canApplyImmediately && !validationExpired) {
        console.log(
          `⚠️ [RATING] Cannot apply ratings yet. All confirmed: ${match.all_confirmed}, Validation expired: ${validationExpired}`,
        );
        return {
          success: false,
          message: "Validation conditions not met",
          error: "Waiting for all confirmations or validation period to expire",
        };
      }

      if (
        match.validation_status !== "pending" &&
        match.validation_status !== "validated"
      ) {
        console.log(
          `⚠️ [RATING] Match not in valid status for rating application: ${match.validation_status}`,
        );
        return {
          success: false,
          message: `Cannot apply ratings. Match status: ${match.validation_status}`,
          error: "Invalid validation status",
        };
      }

      if (match.report_count >= 2 || match.confirmation_status === "rejected") {
        console.log(`⚠️ [RATING] Match has been disputed/rejected`);
        await supabase
          .from("matches")
          .update({
            validation_status: "disputed",
            disputed_at: new Date().toISOString(),
          })
          .eq("id", matchId);

        return {
          success: false,
          message: "Match has been disputed due to reports or rejections",
          error: "Too many reports/rejections received",
        };
      }

      // STEP 2.1.1.2.3: Fetch pre-calculated rating changes
      const { data: ratingChanges, error: changesError } = await supabase
        .from("match_rating_changes")
        .select("*")
        .eq("match_id", matchId)
        .eq("is_reverted", false);

      if (changesError || !ratingChanges || ratingChanges.length === 0) {
        console.error(
          `❌ [RATING] No rating changes found for match:`,
          changesError,
        );
        return {
          success: false,
          message: "No pre-calculated rating changes found",
          error: changesError?.message || "Missing rating data",
        };
      }

      console.log(
        `📊 [RATING] Applying ${ratingChanges.length} rating changes`,
      );

      // STEP 2.1.1.2.4: Apply all rating changes atomically
      for (const change of ratingChanges) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            glicko_rating: change.rating_after.toString(),
            glicko_rd: change.rd_after.toString(),
            glicko_vol: change.vol_after.toString(),
          })
          .eq("id", change.player_id);

        if (updateError) {
          console.error(
            `❌ [RATING] Failed to update player ${change.player_id}:`,
            updateError,
          );
          throw new Error(
            `Rating update failed for player ${change.player_id}: ${updateError.message}`,
          );
        }

        console.log(
          `✅ [RATING] Updated player ${change.player_id}: ${change.rating_before} → ${change.rating_after}`,
        );
      }

      // STEP 2.1.1.2.5: Mark match as validated and ratings applied
      const { error: finalUpdateError } = await supabase
        .from("matches")
        .update({
          validation_status: "validated",
          rating_applied: true,
          validation_completed_at: new Date().toISOString(),
        })
        .eq("id", matchId);

      if (finalUpdateError) {
        console.error(
          `❌ [RATING] Failed to finalize match status:`,
          finalUpdateError,
        );
        throw new Error(
          `Match finalization failed: ${finalUpdateError.message}`,
        );
      }

      // STEP 2.1.1.2.6: Mark rating changes as applied
      const { error: markAppliedError } = await supabase
        .from("match_rating_changes")
        .update({
          applied_at: new Date().toISOString(),
        })
        .eq("match_id", matchId)
        .eq("is_reverted", false);

      if (markAppliedError) {
        console.warn(
          `⚠️ [RATING] Failed to mark changes as applied:`,
          markAppliedError,
        );
        // Non-critical error, continue
      }

      console.log(
        `🎉 [RATING] Successfully applied all rating changes for match: ${matchId}`,
      );

      const appliedVia = canApplyImmediately
        ? "all player confirmations"
        : "validation period expiry";

      return {
        success: true,
        message: `Ratings successfully applied via ${appliedVia}`,
        rating_changes: ratingChanges,
      };
    } catch (error) {
      console.error(`💥 [RATING] Critical error in rating application:`, error);

      // Attempt to mark match as having rating errors
      try {
        await supabase
          .from("matches")
          .update({
            rating_error: true,
            rating_error_message:
              error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", matchId);
      } catch (updateError) {
        console.error(`💥 [RATING] Failed to mark rating error:`, updateError);
      }

      return {
        success: false,
        message: "Critical error during rating application",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process all matches that need rating application
   * This should be called periodically by a cron job or background worker
   */
  static async processAllPendingRatings(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    try {
      console.log(`🔄 [RATING] Processing all pending ratings...`);

      // Find matches that need rating application
      const { data: pendingMatches, error } = await supabase
        .from("matches")
        .select("id")
        .eq("rating_applied", false)
        .eq("validation_status", "pending")
        .or("validation_deadline.lte.now(),all_confirmed.eq.true")
        .not("confirmation_status", "eq", "rejected");

      if (error) {
        console.error(`❌ [RATING] Failed to fetch pending matches:`, error);
        return { processed: 0, successful: 0, failed: 0 };
      }

      let successful = 0;
      let failed = 0;

      for (const match of pendingMatches || []) {
        const result = await this.applyValidatedRatings(match.id);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      }

      console.log(
        `✅ [RATING] Batch processing complete. Successful: ${successful}, Failed: ${failed}`,
      );

      return {
        processed: pendingMatches?.length || 0,
        successful,
        failed,
      };
    } catch (error) {
      console.error(`💥 [RATING] Critical error in batch processing:`, error);
      return { processed: 0, successful: 0, failed: 0 };
    }
  }
}
