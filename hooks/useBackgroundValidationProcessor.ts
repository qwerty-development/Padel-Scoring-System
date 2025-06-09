// hooks/useBackgroundValidationProcessor.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { EnhancedRatingService } from '@/services/enhanced-rating.service';
import { useAuth } from '@/context/supabase-provider';


interface ValidationProcessingStats {
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  lastProcessedAt: Date | null;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  isActive: boolean;
  errors: string[];
}

interface ValidationProcessingConfig {
  processingIntervalMs: number;        // Default: 5 minutes
  batchSizeLimit: number;              // Default: 50 matches
  maxRetryAttempts: number;            // Default: 3
  retryDelayBaseMs: number;            // Default: 1000ms
  maxConsecutiveFailures: number;      // Default: 5
  errorHistoryLimit: number;           // Default: 20
}

const DEFAULT_CONFIG: ValidationProcessingConfig = {
  processingIntervalMs: 5 * 60 * 1000,  // 5 minutes
  batchSizeLimit: 50,
  maxRetryAttempts: 3,
  retryDelayBaseMs: 1000,               // 1 second base delay
  maxConsecutiveFailures: 5,
  errorHistoryLimit: 20
};

/**
 * STEP 5.1.1.2: Primary Hook Implementation
 * 
 * @param config - Optional configuration overrides for processing behavior
 * @returns Processing state, statistics, and manual control functions
 */
export function useBackgroundValidationProcessor(
  config: Partial<ValidationProcessingConfig> = {}
) {
  // STEP 5.1.1.2.1: State Management
  const { session } = useAuth();
  const effectiveConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [stats, setStats] = useState<ValidationProcessingStats>({
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    lastProcessedAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    isActive: false,
    errors: []
  });

  // STEP 5.1.1.2.2: Refs for Interval Management
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(true);

  /**
   * STEP 5.1.1.2.3: Core Processing Function with Comprehensive Error Handling
   */
  const processValidations = useCallback(async (
    retryAttempt: number = 0
  ): Promise<boolean> => {
    // STEP 5.1.1.2.3.1: Pre-processing Validation
    if (!session?.user?.id) {
      console.log('🔒 [VALIDATION_PROCESSOR] Not authenticated, skipping processing');
      return false;
    }

    if (!mountedRef.current) {
      console.log('🔄 [VALIDATION_PROCESSOR] Component unmounted, aborting processing');
      return false;
    }

    if (stats.consecutiveFailures >= effectiveConfig.maxConsecutiveFailures) {
      console.error(`🚫 [VALIDATION_PROCESSOR] Processing suspended due to ${stats.consecutiveFailures} consecutive failures`);
      setStats(prev => ({ ...prev, isActive: false }));
      return false;
    }

    try {
      setIsProcessing(true);
      console.log(`🔄 [VALIDATION_PROCESSOR] Starting batch processing (attempt ${retryAttempt + 1}/${effectiveConfig.maxRetryAttempts + 1})`);

      const startTime = Date.now();

      // STEP 5.1.1.2.3.2: Execute Batch Processing
      const result = await EnhancedRatingService.processBatchValidationExpiry(
        effectiveConfig.batchSizeLimit
      );

      const processingDuration = Date.now() - startTime;

      console.log(`📊 [VALIDATION_PROCESSOR] Batch processing completed in ${processingDuration}ms:`, {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        errorCount: result.errors.length
      });

      // STEP 5.1.1.2.3.3: Update Statistics
      const now = new Date();
      setStats(prev => ({
        totalProcessed: prev.totalProcessed + result.processed,
        totalSucceeded: prev.totalSucceeded + result.succeeded,
        totalFailed: prev.totalFailed + result.failed,
        lastProcessedAt: now,
        lastSuccessAt: result.succeeded > 0 ? now : prev.lastSuccessAt,
        consecutiveFailures: result.failed > 0 && result.succeeded === 0 ? prev.consecutiveFailures + 1 : 0,
        isActive: true,
        errors: [
          ...result.errors.map(error => `${now.toISOString()}: ${error}`),
          ...prev.errors
        ].slice(0, effectiveConfig.errorHistoryLimit)
      }));

      // STEP 5.1.1.2.3.4: Success Condition
      if (result.processed === 0 || result.succeeded > 0) {
        console.log(`✅ [VALIDATION_PROCESSOR] Processing completed successfully`);
        return true;
      }

      // STEP 5.1.1.2.3.5: Partial Failure Handling
      if (result.failed > 0 && retryAttempt < effectiveConfig.maxRetryAttempts) {
        const retryDelay = effectiveConfig.retryDelayBaseMs * Math.pow(2, retryAttempt);
        console.warn(`⚠️ [VALIDATION_PROCESSOR] Partial failure, retrying in ${retryDelay}ms`);
        
        if (mountedRef.current) {
          retryTimeoutRef.current = setTimeout(() => {
            processValidations(retryAttempt + 1);
          }, retryDelay);
        }
        
        return false;
      }

      // STEP 5.1.1.2.3.6: Maximum Retry Attempts Reached
      console.error(`❌ [VALIDATION_PROCESSOR] Maximum retry attempts reached, marking as failed`);
      return false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      console.error(`💥 [VALIDATION_PROCESSOR] Critical processing error:`, error);

      // STEP 5.1.1.2.3.7: Error State Management
      const now = new Date();
      setStats(prev => ({
        ...prev,
        lastProcessedAt: now,
        consecutiveFailures: prev.consecutiveFailures + 1,
        errors: [
          `${now.toISOString()}: CRITICAL ERROR: ${errorMessage}`,
          ...prev.errors
        ].slice(0, effectiveConfig.errorHistoryLimit)
      }));

      // STEP 5.1.1.2.3.8: Retry Logic for Critical Errors
      if (retryAttempt < effectiveConfig.maxRetryAttempts && mountedRef.current) {
        const retryDelay = effectiveConfig.retryDelayBaseMs * Math.pow(2, retryAttempt + 1);
        console.warn(`🔄 [VALIDATION_PROCESSOR] Retrying after critical error in ${retryDelay}ms`);
        
        retryTimeoutRef.current = setTimeout(() => {
          processValidations(retryAttempt + 1);
        }, retryDelay);
        
        return false;
      }

      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [session?.user?.id, stats.consecutiveFailures, effectiveConfig]);

  /**
   * STEP 5.1.1.2.4: Manual Processing Control Functions
   */
  const startProcessing = useCallback(() => {
    console.log('🚀 [VALIDATION_PROCESSOR] Starting background processing');
    
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
    }

    // Initial processing
    processValidations();

    // Set up recurring processing
    processingIntervalRef.current = setInterval(() => {
      if (mountedRef.current && !isProcessing) {
        processValidations();
      }
    }, effectiveConfig.processingIntervalMs);

    setStats(prev => ({ ...prev, isActive: true }));
  }, [processValidations, effectiveConfig.processingIntervalMs, isProcessing]);

  const stopProcessing = useCallback(() => {
    console.log('🛑 [VALIDATION_PROCESSOR] Stopping background processing');
    
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setStats(prev => ({ ...prev, isActive: false }));
  }, []);

  const resetStats = useCallback(() => {
    console.log('🔄 [VALIDATION_PROCESSOR] Resetting processing statistics');
    setStats({
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      lastProcessedAt: null,
      lastSuccessAt: null,
      consecutiveFailures: 0,
      isActive: false,
      errors: []
    });
  }, []);

  const forceProcessNow = useCallback(async (): Promise<boolean> => {
    console.log('⚡ [VALIDATION_PROCESSOR] Manual processing triggered');
    if (!isProcessing) {
      return await processValidations();
    } else {
      console.warn('⚠️ [VALIDATION_PROCESSOR] Processing already in progress, ignoring manual trigger');
      return false;
    }
  }, [processValidations, isProcessing]);

  /**
   * STEP 5.1.1.2.5: Lifecycle Management
   */
  useEffect(() => {
    mountedRef.current = true;

    // Auto-start processing if user is authenticated
    if (session?.user?.id) {
      console.log('🔐 [VALIDATION_PROCESSOR] User authenticated, auto-starting processing');
      startProcessing();
    }

    return () => {
      mountedRef.current = false;
      stopProcessing();
    };
  }, [session?.user?.id, startProcessing, stopProcessing]);

  /**
   * STEP 5.1.1.2.6: Return Interface
   */
  return {
    // Processing State
    isProcessing,
    isActive: stats.isActive,
    
    // Statistics
    stats,
    
    // Control Functions
    startProcessing,
    stopProcessing,
    resetStats,
    forceProcessNow,
    
    // Configuration
    config: effectiveConfig,
    
    // Computed Values
    successRate: stats.totalProcessed > 0 
      ? Math.round((stats.totalSucceeded / stats.totalProcessed) * 100) 
      : 0,
    
    isHealthy: stats.consecutiveFailures < effectiveConfig.maxConsecutiveFailures,
    
    nextProcessingEstimate: stats.lastProcessedAt 
      ? new Date(stats.lastProcessedAt.getTime() + effectiveConfig.processingIntervalMs)
      : null
  };
}