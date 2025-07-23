/* eslint-disable import/no-unresolved */
// Simple client-side processor that can be called from your app
// Put this in a component that's always mounted (like your main layout)

import { useEffect } from "react";
import { supabase } from "@/config/supabase";

export function useConfirmationProcessor() {
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const processConfirmations = async () => {
      try {
        console.log("[PROCESSOR] Running confirmation processing...");

        // Call the public function
        const { data, error } = await supabase.rpc(
          "public_process_confirmations",
        );

        if (error) {
          console.error("[PROCESSOR] Error:", error);
        } else if (data) {
          console.log("[PROCESSOR] Result:", data);

          // If matches were approved, trigger rating calculations
          if (data.approved_matches && data.approved_matches.length > 0) {
            // Import your rating service
            const { EnhancedRatingService } = await import(
              "@/services/enhanced-rating.service"
            );

            // Process each approved match
            for (const matchId of data.approved_matches) {
              try {
                await EnhancedRatingService.calculateAndStoreRatings(matchId);
                await EnhancedRatingService.applyValidatedRatings(matchId);
              } catch (ratingError) {
                console.error(
                  `[PROCESSOR] Rating error for match ${matchId}:`,
                  ratingError,
                );
              }
            }
          }
        }
      } catch (error) {
        console.error("[PROCESSOR] Unexpected error:", error);
      }
    };

    // Run immediately on mount
    processConfirmations();

    // Then run every 5 minutes
    interval = setInterval(processConfirmations, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);
}
