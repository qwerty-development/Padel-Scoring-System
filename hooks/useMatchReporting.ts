// hooks/useMatchReporting.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MatchReportingService } from '@/services/match-reporting.service';
import { 
  MatchReport, 
  ReportReason, 
  ValidationWindowInfo, 
  MatchWithValidation,
  CanReportResponse,
  ValidationStatus
} from '@/types/match-reporting';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';

/**
 * Custom hook for match reporting functionality
 * Provides comprehensive reporting capabilities with real-time updates
 */
export function useMatchReporting(matchId: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  // State management
  const [reports, setReports] = useState<MatchReport[]>([]);
  const [canReport, setCanReport] = useState<CanReportResponse>({ 
    can_report: false, 
    reason: 'Loading...' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationWindow, setValidationWindow] = useState<ValidationWindowInfo | null>(null);
  const [userHasReported, setUserHasReported] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(ValidationStatus.PENDING);

  /**
   * Load reports for the current match
   */
  const loadReports = useCallback(async () => {
    if (!matchId) return;

    try {
      const matchReports = await MatchReportingService.getMatchReports(matchId);
      setReports(matchReports);
      
      // Check if current user has reported
      if (userId) {
        const hasReported = matchReports.some(r => r.reporter_id === userId);
        setUserHasReported(hasReported);
      }
    } catch (error) {
      console.error('Error loading match reports:', error);
    }
  }, [matchId, userId]);

  /**
   * Check if user can report this match
   */
  const checkReportEligibility = useCallback(async () => {
    if (!matchId || !userId) {
      setCanReport({ can_report: false, reason: 'Not authenticated' });
      return;
    }

    try {
      const eligibility = await MatchReportingService.canUserReportMatch(matchId, userId);
      setCanReport(eligibility);
    } catch (error) {
      console.error('Error checking report eligibility:', error);
      setCanReport({ can_report: false, reason: 'Error checking eligibility' });
    }
  }, [matchId, userId]);

  /**
   * Update validation window information
   */
  const updateValidationWindow = useCallback(async () => {
    if (!matchId) return;

    try {
      const { data: match, error } = await supabase
        .from('matches')
        .select('validation_deadline, validation_status, report_count')
        .eq('id', matchId)
        .single();

      if (error || !match) {
        console.error('Error fetching match validation info:', error);
        return;
      }

      const windowInfo = MatchReportingService.calculateValidationWindow(match as any);
      setValidationWindow(windowInfo);
      setValidationStatus(match.validation_status as ValidationStatus);
    } catch (error) {
      console.error('Error updating validation window:', error);
    }
  }, [matchId]);

  /**
   * Submit a match report
   */
  const reportMatch = useCallback(async (
    reason: ReportReason,
    additionalDetails?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!matchId || !userId) {
      return { success: false, error: 'Not authenticated' };
    }

    setIsSubmitting(true);

    try {
      const result = await MatchReportingService.reportMatch({
        match_id: matchId,
        reason,
        additional_details: additionalDetails
      }, userId);

      if (result.success) {
        // Refresh data after successful report
        await Promise.all([
          loadReports(),
          checkReportEligibility(),
          updateValidationWindow()
        ]);
      }

      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [matchId, userId, loadReports, checkReportEligibility, updateValidationWindow]);

  /**
   * Initialize and set up real-time subscriptions
   */
  useEffect(() => {
    if (!matchId) return;

    // Initial data load
    Promise.all([
      loadReports(),
      checkReportEligibility(),
      updateValidationWindow()
    ]);

    // Set up real-time subscription for reports
    const subscription = supabase
      .channel(`match_reports:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_reports',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          console.log('Match report change:', payload);
          loadReports();
          updateValidationWindow();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          console.log('Match validation update:', payload);
          updateValidationWindow();
          checkReportEligibility();
        }
      )
      .subscribe();

    // Set up interval to update countdown timer
    const interval = setInterval(() => {
      updateValidationWindow();
    }, 60000); // Update every minute

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [matchId, loadReports, checkReportEligibility, updateValidationWindow]);

  /**
   * Computed values for UI consumption
   */
  const reportingInfo = useMemo(() => ({
    // Report counts
    totalReports: reports.length,
    hasReports: reports.length > 0,
    isDisputed: validationStatus === ValidationStatus.DISPUTED,
    
    // User status
    userCanReport: canReport.can_report,
    userHasReported,
    
    // Validation window
    validationWindow,
    isValidationOpen: validationWindow?.is_open || false,
    
    // Thresholds
    disputeThreshold: 2,
    reportsNeededForDispute: Math.max(0, 2 - reports.length),
    
    // Status
    validationStatus
  }), [reports, canReport, userHasReported, validationWindow, validationStatus]);

  return {
    // Data
    reports,
    canReport,
    reportingInfo,
    
    // Actions
    reportMatch,
    
    // Loading states
    isSubmitting,
    
    // Refresh functions
    refresh: useCallback(() => {
      loadReports();
      checkReportEligibility();
      updateValidationWindow();
    }, [loadReports, checkReportEligibility, updateValidationWindow])
  };
}

/**
 * Hook for managing validation deadlines across multiple matches
 * Useful for list views that need to show validation status
 */
export function useMatchValidationStatuses(matchIds: string[]) {
  const [statuses, setStatuses] = useState<Map<string, ValidationStatus>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchIds.length) return;

    const loadStatuses = async () => {
      setLoading(true);
      try {
        const statusMap = await MatchReportingService.getValidationStatuses(matchIds);
        setStatuses(statusMap);
      } catch (error) {
        console.error('Error loading validation statuses:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatuses();

    // Subscribe to changes
    const subscription = supabase
      .channel('match_validations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=in.(${matchIds.join(',')})`
        },
        () => {
          loadStatuses();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [matchIds.join(',')]);

  return { statuses, loading };
}

/**
 * Hook for automatic validation processing
 * Can be used in admin panels or background tasks
 */
export function useValidationProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);

  const processValidations = useCallback(async () => {
    setIsProcessing(true);
    try {
      await MatchReportingService.processExpiredValidations();
      setLastProcessed(new Date());
    } catch (error) {
      console.error('Error processing validations:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Auto-process on mount and every 5 minutes
  useEffect(() => {
    processValidations();
    
    const interval = setInterval(processValidations, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [processValidations]);

  return {
    isProcessing,
    lastProcessed,
    processNow: processValidations
  };
}