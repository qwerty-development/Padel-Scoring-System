import { supabase } from "@/config/supabase";

export interface MatchConfirmation {
  id: string;
  match_id: string;
  player_id: string;
  action: "pending" | "approved" | "reported";
  action_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchConfirmationStatus {
  match_id: string;
  confirmation_status: "pending" | "confirmed" | "cancelled";
  confirmation_deadline: string;
  approved_count: number;
  reported_count: number;
  hours_remaining: number;
  status_prediction: string;
  player_confirmations: MatchConfirmation[];
}

export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
  newStatus?: "pending" | "confirmed" | "cancelled";
}

export class MatchConfirmationServiceV2 {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // ms

  /**
   * Get confirmation status for a match with retry logic
   */
  static async getMatchConfirmationStatus(
    matchId: string,
  ): Promise<MatchConfirmationStatus | null> {
    if (!matchId) {
      console.error("❌ [CONFIRMATION-V2] Invalid matchId provided");
      return null;
    }

    let lastError: any = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(
          `📊 [CONFIRMATION-V2] Getting status for match: ${matchId} (attempt ${attempt})`,
        );

        // Get match status from view
        const { data: statusData, error: statusError } = await supabase
          .from("match_confirmation_status")
          .select("*")
          .eq("id", matchId)
          .maybeSingle(); // Use maybeSingle to handle no rows gracefully

        if (statusError) {
          throw statusError;
        }

        if (!statusData) {
          console.warn(
            "⚠️ [CONFIRMATION-V2] No confirmation status found for match",
          );
          return null;
        }

        // Get player confirmations
        const { data: confirmations, error: confirmError } = await supabase
          .from("match_confirmations")
          .select("*")
          .eq("match_id", matchId)
          .order("created_at");

        if (confirmError) {
          throw confirmError;
        }

        // Validate data consistency
        const actualApproved =
          confirmations?.filter((c) => c.action === "approved").length || 0;
        const actualReported =
          confirmations?.filter((c) => c.action === "reported").length || 0;

        if (
          actualApproved !== statusData.approved_count ||
          actualReported !== statusData.reported_count
        ) {
          console.warn(
            "⚠️ [CONFIRMATION-V2] Count mismatch detected, data might be stale",
          );
        }

        return {
          match_id: statusData.id,
          confirmation_status: statusData.confirmation_status,
          confirmation_deadline: statusData.confirmation_deadline,
          approved_count: statusData.approved_count,
          reported_count: statusData.reported_count,
          hours_remaining: Math.max(0, statusData.hours_remaining || 0),
          status_prediction: statusData.status_prediction,
          player_confirmations: confirmations || [],
        };
      } catch (error) {
        lastError = error;
        console.error(`❌ [CONFIRMATION-V2] Attempt ${attempt} failed:`, error);

        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    console.error("💥 [CONFIRMATION-V2] All attempts failed:", lastError);
    return null;
  }

  /**
   * Approve a match with optimistic locking
   */
  static async approveMatch(
    matchId: string,
    playerId: string,
  ): Promise<ActionResult> {
    if (!matchId || !playerId) {
      return {
        success: false,
        message: "Invalid match or player ID",
      };
    }

    try {
      console.log(
        `✅ [CONFIRMATION-V2] Player ${playerId} approving match ${matchId}`,
      );

      // Start a transaction-like operation
      const { data: currentMatch, error: matchError } = await supabase
        .from("matches")
        .select("confirmation_status, approved_count, reported_count")
        .eq("id", matchId)
        .single();

      if (matchError || !currentMatch) {
        return {
          success: false,
          message: "Match not found",
          error: matchError?.message,
        };
      }

      // Check if already confirmed/cancelled
      if (currentMatch.confirmation_status !== "pending") {
        return {
          success: false,
          message: `Match is already ${currentMatch.confirmation_status}`,
          newStatus: currentMatch.confirmation_status as any,
        };
      }

      // Check if player can approve
      const canApprove = await this.canPlayerTakeAction(matchId, playerId);
      if (!canApprove.success) {
        return canApprove;
      }

      // Update confirmation record
      const { data: updateData, error: updateError } = await supabase
        .from("match_confirmations")
        .update({
          action: "approved",
          action_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .select()
        .single();

      if (updateError) {
        console.error("❌ [CONFIRMATION-V2] Update error:", updateError);
        return {
          success: false,
          message: "Failed to approve match",
          error: updateError.message,
        };
      }

      // Wait a bit for trigger to process
      await this.delay(500);

      // Check final status
      const status = await this.getMatchConfirmationStatus(matchId);

      if (status?.confirmation_status === "confirmed") {
        return {
          success: true,
          message: "🎉 All players confirmed! Match is now confirmed.",
          newStatus: "confirmed",
        };
      }

      return {
        success: true,
        message: `Match approved successfully (${status?.approved_count || currentMatch.approved_count + 1}/4 approved)`,
        newStatus: status?.confirmation_status || "pending",
      };
    } catch (error) {
      console.error("💥 [CONFIRMATION-V2] Critical error:", error);
      return {
        success: false,
        message: "An unexpected error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Report a match with validation
   */
  static async reportMatch(
    matchId: string,
    playerId: string,
    reason?: string,
  ): Promise<ActionResult> {
    if (!matchId || !playerId) {
      return {
        success: false,
        message: "Invalid match or player ID",
      };
    }

    // Validate reason length
    if (reason && reason.length > 500) {
      return {
        success: false,
        message: "Reason is too long (max 500 characters)",
      };
    }

    try {
      console.log(
        `🚫 [CONFIRMATION-V2] Player ${playerId} reporting match ${matchId}`,
      );

      // Get current match state
      const { data: currentMatch, error: matchError } = await supabase
        .from("matches")
        .select("confirmation_status, reported_count")
        .eq("id", matchId)
        .single();

      if (matchError || !currentMatch) {
        return {
          success: false,
          message: "Match not found",
          error: matchError?.message,
        };
      }

      // Check if already confirmed/cancelled
      if (currentMatch.confirmation_status !== "pending") {
        return {
          success: false,
          message: `Match is already ${currentMatch.confirmation_status}`,
          newStatus: currentMatch.confirmation_status as any,
        };
      }

      // Check if player can report
      const canReport = await this.canPlayerTakeAction(matchId, playerId);
      if (!canReport.success) {
        return canReport;
      }

      // Update confirmation record
      const { error: updateError } = await supabase
        .from("match_confirmations")
        .update({
          action: "reported",
          action_at: new Date().toISOString(),
          reason: reason?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("match_id", matchId)
        .eq("player_id", playerId);

      if (updateError) {
        console.error("❌ [CONFIRMATION-V2] Update error:", updateError);
        return {
          success: false,
          message: "Failed to report match",
          error: updateError.message,
        };
      }

      // Wait for trigger
      await this.delay(500);

      // Check final status
      const status = await this.getMatchConfirmationStatus(matchId);

      if (status?.confirmation_status === "cancelled") {
        return {
          success: true,
          message:
            "🚫 Match cancelled due to multiple reports. No ratings will be applied.",
          newStatus: "cancelled",
        };
      }

      return {
        success: true,
        message: `Match reported successfully (${status?.reported_count || currentMatch.reported_count + 1} reports)`,
        newStatus: status?.confirmation_status || "pending",
      };
    } catch (error) {
      console.error("💥 [CONFIRMATION-V2] Critical error:", error);
      return {
        success: false,
        message: "An unexpected error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if a player can take action on a match with proper validation
   */
  static async canPlayerTakeAction(
    matchId: string,
    playerId: string,
  ): Promise<ActionResult> {
    try {
      // Get match details
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select(
          "player1_id, player2_id, player3_id, player4_id, confirmation_status, confirmation_deadline, status",
        )
        .eq("id", matchId)
        .single();

      if (matchError || !match) {
        return {
          success: false,
          message: "Match not found",
        };
      }

      // Check match status
      if (match.status !== "4") {
        return {
          success: false,
          message: "Match is not completed",
        };
      }

      // Check if player is participant
      const players = [
        match.player1_id,
        match.player2_id,
        match.player3_id,
        match.player4_id,
      ].filter(Boolean);
      const isParticipant = players.includes(playerId);

      if (!isParticipant) {
        return {
          success: false,
          message: "You are not a participant in this match",
        };
      }

      // Check match confirmation status
      if (match.confirmation_status !== "pending") {
        return {
          success: false,
          message: `Match is already ${match.confirmation_status}`,
        };
      }

      // Check deadline
      const now = new Date();
      const deadline = match.confirmation_deadline
        ? new Date(match.confirmation_deadline)
        : null;

      if (!deadline) {
        return {
          success: false,
          message: "Match has no confirmation deadline set",
        };
      }

      if (deadline < now) {
        return {
          success: false,
          message: "Confirmation period has expired",
        };
      }

      // Check if player already took action
      const { data: confirmation, error: confError } = await supabase
        .from("match_confirmations")
        .select("action, action_at")
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (confError) {
        return {
          success: false,
          message: "Error checking confirmation status",
          error: confError.message,
        };
      }

      if (!confirmation) {
        return {
          success: false,
          message: "No confirmation record found for player",
        };
      }

      if (confirmation.action !== "pending") {
        const actionTime = confirmation.action_at
          ? new Date(confirmation.action_at).toLocaleString()
          : "unknown time";
        return {
          success: false,
          message: `You already ${confirmation.action} this match at ${actionTime}`,
        };
      }

      return {
        success: true,
        message: "Player can take action",
      };
    } catch (error) {
      console.error("Error checking player action eligibility:", error);
      return {
        success: false,
        message: "Error checking eligibility",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process all expired confirmations with proper locking
   */
  static async processExpiredConfirmations(): Promise<{
    success: boolean;
    processed: number;
    confirmed: number;
    cancelled: number;
    error?: string;
  }> {
    try {
      console.log("🔄 [CONFIRMATION-V2] Processing expired confirmations...");

      // Try to acquire lock first
      const { data: lockAcquired } = await supabase.rpc(
        "acquire_processing_lock",
        {
          p_lock_name: "edge_function_processing",
          p_locked_by: "edge-function",
        },
      );

      if (!lockAcquired) {
        console.log("🔒 [CONFIRMATION-V2] Another process is already running");
        return {
          success: true, // Not an error, just skip
          processed: 0,
          confirmed: 0,
          cancelled: 0,
        };
      }

      try {
        const { data, error } = await supabase.rpc(
          "process_expired_confirmations",
        );

        if (error) {
          throw error;
        }

        const result = data?.[0] || {
          processed_count: 0,
          confirmed_count: 0,
          cancelled_count: 0,
        };

        console.log("✅ [CONFIRMATION-V2] Processing complete:", result);

        return {
          success: true,
          processed: result.processed_count,
          confirmed: result.confirmed_count,
          cancelled: result.cancelled_count,
        };
      } finally {
        // Always release lock
        await supabase.rpc("release_processing_lock", {
          p_lock_name: "edge_function_processing",
        });
      }
    } catch (error) {
      console.error("💥 [CONFIRMATION-V2] Critical error:", error);
      return {
        success: false,
        processed: 0,
        confirmed: 0,
        cancelled: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Utility function to delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Subscribe to real-time updates with error handling
   */
  static subscribeToMatchConfirmations(
    matchId: string,
    onUpdate: (payload: any) => void,
    onError?: (error: any) => void,
  ) {
    const channel = supabase
      .channel(`match-confirmations:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_confirmations",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          console.log("📡 [CONFIRMATION-V2] Confirmation update:", payload);
          onUpdate(payload);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          console.log("📡 [CONFIRMATION-V2] Match update:", payload);
          onUpdate(payload);
        },
      );

    // Handle subscription errors
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("✅ [CONFIRMATION-V2] Subscribed to real-time updates");
      } else if (status === "CHANNEL_ERROR") {
        console.error("❌ [CONFIRMATION-V2] Subscription error");
        onError?.({
          type: "CHANNEL_ERROR",
          message: "Failed to subscribe to updates",
        });
      } else if (status === "TIMED_OUT") {
        console.error("❌ [CONFIRMATION-V2] Subscription timeout");
        onError?.({ type: "TIMED_OUT", message: "Subscription timed out" });
      }
    });

    return channel;
  }
}
