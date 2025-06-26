import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/supabase-provider';
import { 
  MatchConfirmationService,
  ConfirmationSummary,
  MatchConfirmation,
  ConfirmationResult
} from '@/services/match-confirmation.service';

export interface UseMatchConfirmationReturn {
  // Data
  confirmationStatus: ConfirmationSummary | null;
  userConfirmation: MatchConfirmation | null;
  canConfirm: boolean;
  
  // State
  loading: boolean;
  confirming: boolean;
  rejecting: boolean;
  
  // Actions
  confirmScore: () => Promise<ConfirmationResult>;
  rejectScore: (reason?: string) => Promise<ConfirmationResult>;
  refresh: () => Promise<void>;
  
  // Computed values
  isFullyConfirmed: boolean;
  isCancelled: boolean;
  needsConfirmation: boolean;
  confirmationProgress: number;
}

export function useMatchConfirmation(matchId: string): UseMatchConfirmationReturn {
  const { profile } = useAuth();
  const [confirmationStatus, setConfirmationStatus] = useState<ConfirmationSummary | null>(null);
  const [userConfirmation, setUserConfirmation] = useState<MatchConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [canConfirm, setCanConfirm] = useState(false);

  // Load confirmation status
  const loadConfirmationStatus = useCallback(async () => {
    if (!matchId) return;

    try {
      setLoading(true);
      
      // Get confirmation status
      const status = await MatchConfirmationService.getMatchConfirmationStatus(matchId);
      setConfirmationStatus(status);

      // Find user's confirmation
      if (status && profile) {
        const userConf = status.confirmations.find(c => c.player_id === profile.id);
        setUserConfirmation(userConf || null);
        
        // Check if user can confirm
        const eligible = await MatchConfirmationService.canUserConfirmMatch(matchId, profile.id);
        setCanConfirm(eligible && (!userConf || userConf.status === 'pending'));
      }
    } catch (error) {
      console.error('Error loading confirmation status:', error);
      setConfirmationStatus(null);
      setUserConfirmation(null);
      setCanConfirm(false);
    } finally {
      setLoading(false);
    }
  }, [matchId, profile]);

  // Confirm score
  const confirmScore = useCallback(async (): Promise<ConfirmationResult> => {
    if (!profile || !canConfirm) {
      return {
        success: false,
        message: 'Cannot confirm score'
      };
    }

    try {
      setConfirming(true);
      const result = await MatchConfirmationService.confirmMatchScore(matchId, profile.id);
      
      // Reload status if successful
      if (result.success) {
        await loadConfirmationStatus();
      }
      
      return result;
    } catch (error) {
      console.error('Error confirming score:', error);
      return {
        success: false,
        message: 'Failed to confirm score'
      };
    } finally {
      setConfirming(false);
    }
  }, [matchId, profile, canConfirm, loadConfirmationStatus]);

  // Reject score
  const rejectScore = useCallback(async (reason?: string): Promise<ConfirmationResult> => {
    if (!profile || !canConfirm) {
      return {
        success: false,
        message: 'Cannot reject score'
      };
    }

    try {
      setRejecting(true);
      const result = await MatchConfirmationService.rejectMatchScore(matchId, profile.id, reason);
      
      // Reload status if successful
      if (result.success) {
        await loadConfirmationStatus();
      }
      
      return result;
    } catch (error) {
      console.error('Error rejecting score:', error);
      return {
        success: false,
        message: 'Failed to reject score'
      };
    } finally {
      setRejecting(false);
    }
  }, [matchId, profile, canConfirm, loadConfirmationStatus]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!matchId) return;

    // Initial load
    loadConfirmationStatus();

    // Subscribe to updates
    const subscription = MatchConfirmationService.subscribeToConfirmationUpdates(
      matchId,
      () => {
        loadConfirmationStatus();
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [matchId, loadConfirmationStatus]);

  // Computed values
  const isFullyConfirmed = confirmationStatus?.all_confirmed || false;
  const isCancelled = confirmationStatus?.should_cancel || false;
  const needsConfirmation = !isFullyConfirmed && !isCancelled && userConfirmation?.status === 'pending';
  const confirmationProgress = confirmationStatus 
    ? (confirmationStatus.confirmed_count / confirmationStatus.total_players) * 100 
    : 0;

  return {
    // Data
    confirmationStatus,
    userConfirmation,
    canConfirm,
    
    // State
    loading,
    confirming,
    rejecting,
    
    // Actions
    confirmScore,
    rejectScore,
    refresh: loadConfirmationStatus,
    
    // Computed values
    isFullyConfirmed,
    isCancelled,
    needsConfirmation,
    confirmationProgress
  };
}