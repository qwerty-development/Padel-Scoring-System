// hooks/useMatchConfirmation.ts
// CREATE THIS NEW FILE

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/supabase-provider';
import { 
  MatchConfirmationService,
  ConfirmationSummary,
  MatchConfirmation,
  ActionResult
} from '@/services/match-confirmation.service';

export interface UseMatchConfirmationReturn {
  // Data
  summary: ConfirmationSummary | null;
  confirmations: MatchConfirmation[];
  playerConfirmation: MatchConfirmation | null;
  
  // State
  loading: boolean;
  approving: boolean;
  reporting: boolean;
  
  // Actions
  approveMatch: () => Promise<ActionResult>;
  reportMatch: (reason?: string) => Promise<ActionResult>;
  refresh: () => Promise<void>;
  
  // Computed values
  canTakeAction: boolean;
  hasApproved: boolean;
  hasReported: boolean;
  isPending: boolean;
  timeRemainingText: string;
  statusText: string;
  isParticipant: boolean;
}

export function useMatchConfirmation(matchId: string): UseMatchConfirmationReturn {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<ConfirmationSummary | null>(null);
  const [confirmations, setConfirmations] = useState<MatchConfirmation[]>([]);
  const [playerConfirmation, setPlayerConfirmation] = useState<MatchConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);

  // Load all confirmation data
  const loadConfirmationData = useCallback(async () => {
    if (!matchId || !profile?.id) return;

    try {
      setLoading(true);
      
      // Check if user is participant
      const participant = await MatchConfirmationService.isUserParticipant(matchId, profile.id);
      setIsParticipant(participant);
      
      // Get summary
      const summaryData = await MatchConfirmationService.getMatchConfirmationSummary(matchId);
      setSummary(summaryData);

      // Get all confirmations
      const confirmationsData = await MatchConfirmationService.getMatchConfirmations(matchId);
      setConfirmations(confirmationsData);

      // Get player's confirmation
      if (participant) {
        const playerData = await MatchConfirmationService.getPlayerConfirmation(
          matchId, 
          profile.id
        );
        setPlayerConfirmation(playerData);
      }
    } catch (error) {
      console.error('Error loading confirmation data:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId, profile?.id]);

  // Approve match
  const approveMatch = useCallback(async (): Promise<ActionResult> => {
    if (!profile?.id) {
      return {
        success: false,
        message: 'Not authenticated'
      };
    }

    try {
      setApproving(true);
      const result = await MatchConfirmationService.approveMatch(matchId, profile.id);
      
      if (result.success) {
        await loadConfirmationData();
      }
      
      return result;
    } finally {
      setApproving(false);
    }
  }, [matchId, profile?.id, loadConfirmationData]);

  // Report match
  const reportMatch = useCallback(async (reason?: string): Promise<ActionResult> => {
    if (!profile?.id) {
      return {
        success: false,
        message: 'Not authenticated'
      };
    }

    try {
      setReporting(true);
      const result = await MatchConfirmationService.reportMatch(
        matchId, 
        profile.id, 
        reason
      );
      
      if (result.success) {
        await loadConfirmationData();
      }
      
      return result;
    } finally {
      setReporting(false);
    }
  }, [matchId, profile?.id, loadConfirmationData]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!matchId) return;

    // Initial load
    loadConfirmationData();

    // Subscribe to updates
    const subscription = MatchConfirmationService.subscribeToConfirmationUpdates(
      matchId,
      () => {
        loadConfirmationData();
      }
    );

    // Refresh every minute to update countdown
    const interval = setInterval(() => {
      if (summary?.confirmation_status === 'pending') {
        loadConfirmationData();
      }
    }, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [matchId, loadConfirmationData]);

  // Computed values
  const canTakeAction = isParticipant && 
    summary?.confirmation_status === 'pending' &&
    playerConfirmation?.action === 'pending' &&
    summary?.hours_remaining > 0;
  
  const hasApproved = playerConfirmation?.action === 'approved';
  const hasReported = playerConfirmation?.action === 'reported';
  const isPending = playerConfirmation?.action === 'pending';

  const timeRemainingText = (() => {
    if (!summary || summary.confirmation_status !== 'pending') return '';
    
    const hours = Math.floor(summary.hours_remaining);
    const minutes = Math.floor((summary.hours_remaining % 1) * 60);
    
    if (hours === 0 && minutes === 0) return 'Expired';
    if (hours === 0) return `${minutes}m remaining`;
    if (minutes === 0) return `${hours}h remaining`;
    return `${hours}h ${minutes}m remaining`;
  })();

  const statusText = (() => {
    if (!summary) return '';
    
    if (summary.confirmation_status === 'approved') {
      return 'Match Approved';
    }
    
    if (summary.confirmation_status === 'cancelled') {
      return 'Match Cancelled';
    }
    
    if (summary.hours_remaining <= 0) {
      return 'Awaiting Auto-Approval';
    }
    
    return `${summary.approved_count}/4 approved, ${summary.reported_count} reported`;
  })();

  return {
    // Data
    summary,
    confirmations,
    playerConfirmation,
    
    // State
    loading,
    approving,
    reporting,
    
    // Actions
    approveMatch,
    reportMatch,
    refresh: loadConfirmationData,
    
    // Computed values
    canTakeAction,
    hasApproved,
    hasReported,
    isPending,
    timeRemainingText,
    statusText,
    isParticipant
  };
}