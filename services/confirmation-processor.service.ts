// services/confirmation-processor.service.ts
// CREATE THIS NEW FILE

import { supabase } from "@/config/supabase";
import { MatchConfirmationService } from "./match-confirmation.service";

export interface ProcessingResult {
  processed: number;
  approved: number;
  errors: string[];
  timestamp: string;
  success: boolean;
}

export class ConfirmationProcessorService {
  /**
   * Main processing function - call this from your cron or periodic task
   */
  static async processAllConfirmations(): Promise<ProcessingResult> {
    const startTime = new Date();
    console.log('🔄 [PROCESSOR] Starting confirmation processing at', startTime.toISOString());

    try {
      // Call the service method which calls the database function
      const result = await MatchConfirmationService.processExpiredConfirmations();

      const processingResult: ProcessingResult = {
        processed: result.processed,
        approved: result.approved,
        errors: result.success ? [] : ['Processing failed'],
        timestamp: new Date().toISOString(),
        success: result.success
      };

      console.log('✅ [PROCESSOR] Processing complete:', processingResult);

      return processingResult;
    } catch (error) {
      console.error('💥 [PROCESSOR] Critical error:', error);
      
      return {
        processed: 0,
        approved: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: new Date().toISOString(),
        success: false
      };
    }
  }

  /**
   * Get current statistics
   */
  static async getStats(): Promise<{
    pendingConfirmations: number;
    readyForApproval: number;
    approvedToday: number;
    cancelledToday: number;
  }> {
    try {
      // Count pending confirmations
      const { count: pending } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('confirmation_status', 'pending')
        .eq('status', '4');

      // Count ready for auto-approval
      const { count: ready } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('confirmation_status', 'pending')
        .lte('confirmation_deadline', new Date().toISOString())
        .eq('status', '4');

      // Count approved today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: approved } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('confirmation_status', 'approved')
        .gte('approved_at', today.toISOString());

      // Count cancelled today
      const { count: cancelled } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('confirmation_status', 'cancelled')
        .gte('cancelled_at', today.toISOString());

      return {
        pendingConfirmations: pending || 0,
        readyForApproval: ready || 0,
        approvedToday: approved || 0,
        cancelledToday: cancelled || 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        pendingConfirmations: 0,
        readyForApproval: 0,
        approvedToday: 0,
        cancelledToday: 0
      };
    }
  }
}

// Export a function that can be called from anywhere
export async function runConfirmationProcessor(): Promise<ProcessingResult> {
  return ConfirmationProcessorService.processAllConfirmations();
}