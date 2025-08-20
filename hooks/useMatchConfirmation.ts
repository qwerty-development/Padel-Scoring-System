// hooks/useMatchConfirmationV2.ts
// FIXED version with proper cleanup and performance optimizations

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/context/supabase-provider";
import {
  MatchConfirmationServiceV2,
  MatchConfirmationStatus,
  ActionResult,
} from "@/services/match-confirmation.service";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface UseMatchConfirmationReturn {
  // Data
  status: MatchConfirmationStatus | null;

  // States
  loading: boolean;
  processing: boolean;
  error: string | null;

  // Actions
  approveMatch: () => Promise<ActionResult>;
  reportMatch: (reason?: string) => Promise<ActionResult>;
  refresh: () => Promise<void>;

  // Computed values
  canTakeAction: boolean;
  hasApproved: boolean;
  hasReported: boolean;
  isPending: boolean;
  timeRemaining: string;
  userConfirmation: any | null;
  isParticipant: boolean;
}

export function useMatchConfirmationV2(
  matchId: string,
): UseMatchConfirmationReturn {
  const { profile } = useAuth();
  const [status, setStatus] = useState<MatchConfirmationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent memory leaks
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastLoadTimeRef = useRef<Date | null>(null);

  // Debounced refresh to prevent spam
  const loadStatus = useCallback(async () => {
    if (!matchId || !isMountedRef.current) return;

    // Prevent loading too frequently (min 1 second between loads)
    const now = new Date();
    if (lastLoadTimeRef.current) {
      const timeSinceLastLoad =
        now.getTime() - lastLoadTimeRef.current.getTime();
      if (timeSinceLastLoad < 1000) {
        console.log("⏳ [HOOK] Skipping load - too frequent");
        return;
      }
    }
    lastLoadTimeRef.current = now;

    try {
      setError(null);
      const statusData =
        await MatchConfirmationServiceV2.getMatchConfirmationStatus(matchId);

      if (isMountedRef.current) {
        setStatus(statusData);
        if (!statusData) {
          setError("Failed to load confirmation status");
        }
      }
    } catch (err) {
      console.error("Error loading confirmation status:", err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [matchId]);

  // Approve match
  const approveMatch = useCallback(async (): Promise<ActionResult> => {
    if (!profile?.id) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }

    if (processing) {
      return {
        success: false,
        message: "Another action is in progress",
      };
    }

    try {
      setProcessing(true);
      setError(null);

      const result = await MatchConfirmationServiceV2.approveMatch(
        matchId,
        profile.id,
      );

      if (result.success && isMountedRef.current) {
        // Wait a bit for database to update
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await loadStatus();
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      if (isMountedRef.current) {
        setProcessing(false);
      }
    }
  }, [matchId, profile?.id, processing, loadStatus]);

  // Report match
  const reportMatch = useCallback(
    async (reason?: string): Promise<ActionResult> => {
      if (!profile?.id) {
        return {
          success: false,
          message: "Not authenticated",
        };
      }

      if (processing) {
        return {
          success: false,
          message: "Another action is in progress",
        };
      }

      try {
        setProcessing(true);
        setError(null);

        const result = await MatchConfirmationServiceV2.reportMatch(
          matchId,
          profile.id,
          reason,
        );

        if (result.success && isMountedRef.current) {
          // Wait a bit for database to update
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await loadStatus();
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return {
          success: false,
          message: errorMessage,
        };
      } finally {
        if (isMountedRef.current) {
          setProcessing(false);
        }
      }
    },
    [matchId, profile?.id, processing, loadStatus],
  );

  // Setup subscriptions and timers
  useEffect(() => {
    if (!matchId) return;

    isMountedRef.current = true;
    setLoading(true);

    // Initial load
    loadStatus();

    // Subscribe to updates with error handling
    subscriptionRef.current =
      MatchConfirmationServiceV2.subscribeToMatchConfirmations(
        matchId,
        (payload: any) => {
          console.log("📡 [HOOK] Received real-time update");
          if (isMountedRef.current) {
            loadStatus();
          }
        },
        (error: { message: any }) => {
          console.error("📡 [HOOK] Subscription error:", error);
          if (isMountedRef.current) {
            setError(`Real-time updates unavailable: ${error.message}`);
          }
        },
      );

    // Refresh every minute for countdown (only if pending)
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current && status?.confirmation_status === "pending") {
        loadStatus();
      }
    }, 60000);

    // Cleanup function
    return () => {
      isMountedRef.current = false;

      // Unsubscribe from real-time updates
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [matchId]); // Only depend on matchId, not loadStatus

  // Update interval when status changes
  useEffect(() => {
    if (status?.confirmation_status !== "pending" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [status?.confirmation_status]);

  // Memoized computed values
  const userConfirmation = useMemo(
    () =>
      status?.player_confirmations.find(
        (c: { player_id: string | undefined }) => c.player_id === profile?.id,
      ),
    [status?.player_confirmations, profile?.id],
  );

  const isParticipant = useMemo(() => {
    if (!status || !profile?.id) return false;
    return status.player_confirmations.some(
      (c: { player_id: string }) => c.player_id === profile.id,
    );
  }, [status?.player_confirmations, profile?.id]);

  const canTakeAction = useMemo(
    () =>
      status?.confirmation_status === "pending" &&
      userConfirmation?.action === "pending" &&
      (status?.hours_remaining || 0) > 0 &&
      !processing,
    [status, userConfirmation, processing],
  );

  const hasApproved = userConfirmation?.action === "approved";
  const hasReported = userConfirmation?.action === "reported";
  const isPending = status?.confirmation_status === "pending";

  const timeRemaining = useMemo(() => {
    if (!status || status.confirmation_status !== "pending") return "";

    const hours = Math.floor(Math.max(0, status.hours_remaining));
    const minutes = Math.floor(Math.max(0, (status.hours_remaining % 1) * 60));

    if (hours <= 0 && minutes <= 0) return "Expired";
    if (hours === 0) return `${minutes}m remaining`;
    if (minutes === 0) return `${hours}h remaining`;
    return `${hours}h ${minutes}m remaining`;
  }, [status]);

  // Debounced refresh function
  const refresh = useCallback(() => {
    // Use debouncing to prevent rapid refreshes
    return loadStatus();
  }, [loadStatus]);

  return {
    // Data
    status,

    // States
    loading,
    processing,
    error,

    // Actions
    approveMatch,
    reportMatch,
    refresh,

    // Computed values
    canTakeAction,
    hasApproved,
    hasReported,
    isPending,
    timeRemaining,
    userConfirmation,
    isParticipant,
  };
}
