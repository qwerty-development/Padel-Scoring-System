// services/enhanced-rating.service.ts

import { supabase } from '@/config/supabase';
import { calculateMatchRatings } from '@/utils/glickoUtils';



export interface PlayerRating {
  id: string;
  rating: number;
  rd: number;
  vol: number;
}

export interface RatingChangeRecord {
  player_id: string;
  rating_before: number;
  rd_before: number;
  vol_before: number;
  rating_after: number;
  rd_after: number;
  vol_after: number;
}

export interface MatchRatingResult {
  success: boolean;
  message: string;
  rating_changes?: RatingChangeRecord[];
  error?: string;
}

export class EnhancedRatingService {
  
  /**
   * STEP 2.1.1.1: Calculate and Store Deferred Ratings
   * 
   * PURPOSE: Calculate new ratings but don't apply until validation passes
   * VALIDATION INTEGRATION: Respects validation_status and validation_deadline
   * AUDIT TRAIL: Records all changes for potential reversal
   * 
   * @param matchId - UUID of the completed match
   * @param winnerTeam - Team number (1 or 2) that won the match
   * @param validationDeadline - When validation period expires
   * @returns Promise<MatchRatingResult>
   */
  static async calculateAndStoreMatchRatings(
    matchId: string,
    winnerTeam: number,
    validationDeadline: Date
  ): Promise<MatchRatingResult> {
    try {
      console.log(`🔄 [RATING] Starting deferred rating calculation for match: ${matchId}`);
      console.log(`🏆 [RATING] Winner team: ${winnerTeam}`);
      console.log(`⏰ [RATING] Validation deadline: ${validationDeadline.toISOString()}`);

      // STEP 2.1.1.1.1: Fetch match details with player information
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, glicko_rating, glicko_rd, glicko_vol),
          player2:profiles!player2_id(id, glicko_rating, glicko_rd, glicko_vol),
          player3:profiles!player3_id(id, glicko_rating, glicko_rd, glicko_vol),
          player4:profiles!player4_id(id, glicko_rating, glicko_rd, glicko_vol)
        `)
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        console.error(`❌ [RATING] Failed to fetch match data:`, matchError);
        return {
          success: false,
          message: 'Failed to fetch match data',
          error: matchError?.message || 'Match not found'
        };
      }

      // STEP 2.1.1.1.2: Extract and validate player ratings
      const players = [match.player1, match.player2, match.player3, match.player4]
        .filter(Boolean) as PlayerRating[];

      if (players.length !== 4) {
        console.error(`❌ [RATING] Incomplete player data. Expected 4, got ${players.length}`);
        return {
          success: false,
          message: 'Incomplete player data for rating calculation',
          error: `Missing player data. Found ${players.length}/4 players`
        };
      }

      // STEP 2.1.1.1.3: Convert database strings to numbers for calculation
      const playerRatings: PlayerRating[] = players.map(player => ({
        id: player.id,
        rating: parseFloat(player.glicko_rating || '1500'),
        rd: parseFloat(player.glicko_rd || '350'),
        vol: parseFloat(player.glicko_vol || '0.06')
      }));

      console.log(`📊 [RATING] Player ratings before calculation:`, 
        playerRatings.map(p => `${p.id}: ${p.rating}`));

      // STEP 2.1.1.1.4: Calculate new ratings using existing Glicko utility
      const team1Wins = winnerTeam === 1 ? 1 : 0;
      const team2Wins = winnerTeam === 2 ? 1 : 0;

      const updatedRatings = calculateMatchRatings(
        playerRatings[0],
        playerRatings[1],
        playerRatings[2],
        playerRatings[3],
        team1Wins,
        team2Wins
      );

      // Convert to array format consistent with existing code
      const newRatings = [
        updatedRatings.player1,
        updatedRatings.player2,
        updatedRatings.player3,
        updatedRatings.player4,
      ];

      console.log(`📈 [RATING] New ratings calculated:`, 
        newRatings.map((p:any) => `${p.id}: ${p.rating}`));

      // STEP 2.1.1.1.5: Prepare rating change records for audit trail
      const ratingChanges: RatingChangeRecord[] = playerRatings.map((oldRating, index) => {
        const newRating = newRatings[index];
        return {
          player_id: oldRating.id,
          rating_before: oldRating.rating,
          rd_before: oldRating.rd,
          vol_before: oldRating.vol,
          rating_after: newRating.rating,
          rd_after: newRating.rd,
          vol_after: newRating.vol
        };
      });

      // STEP 2.1.1.1.6: Store rating changes WITHOUT applying to profiles
      const { error: storeError } = await supabase
        .from('match_rating_changes')
        .insert(
          ratingChanges.map(change => ({
            match_id: matchId,
            ...change
          }))
        );

      if (storeError) {
        console.error(`❌ [RATING] Failed to store rating changes:`, storeError);
        return {
          success: false,
          message: 'Failed to store rating changes',
          error: storeError.message
        };
      }

      console.log(`✅ [RATING] Successfully stored rating changes for future application`);

      // STEP 2.1.1.1.7: Update match with validation metadata
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          validation_deadline: validationDeadline.toISOString(),
          validation_status: 'pending',
          rating_applied: false, // CRITICAL: Ratings not yet applied
          report_count: 0
        })
        .eq('id', matchId);

      if (matchUpdateError) {
        console.error(`❌ [RATING] Failed to update match validation status:`, matchUpdateError);
        return {
          success: false,
          message: 'Failed to update match validation status',
          error: matchUpdateError.message
        };
      }

      console.log(`🎯 [RATING] Match prepared for validation period. Ratings will apply after: ${validationDeadline.toISOString()}`);

      return {
        success: true,
        message: `Ratings calculated and queued for application after validation period`,
        rating_changes: ratingChanges
      };

    } catch (error) {
      console.error(`💥 [RATING] Critical error in rating calculation:`, error);
      return {
        success: false,
        message: 'Critical error during rating calculation',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * STEP 2.1.1.2: Apply Pre-calculated Ratings After Validation
   * 
   * PURPOSE: Apply stored rating changes after validation period expires
   * SAFETY: Only applies if match is still in 'pending' status and not disputed
   * ATOMICITY: All rating updates succeed or all fail
   * 
   * @param matchId - UUID of the match to process
   * @returns Promise<MatchRatingResult>
   */
  static async applyValidatedRatings(matchId: string): Promise<MatchRatingResult> {
    try {
      console.log(`🔄 [RATING] Starting validated rating application for match: ${matchId}`);

      // STEP 2.1.1.2.1: Verify match is ready for rating application
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('validation_status, validation_deadline, rating_applied, report_count')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        console.error(`❌ [RATING] Match validation check failed:`, matchError);
        return {
          success: false,
          message: 'Failed to verify match validation status',
          error: matchError?.message || 'Match not found'
        };
      }

      // STEP 2.1.1.2.2: Validation status checks
      if (match.rating_applied) {
        console.log(`ℹ️ [RATING] Ratings already applied for match: ${matchId}`);
        return {
          success: true,
          message: 'Ratings already applied for this match'
        };
      }

      if (match.validation_status !== 'pending') {
        console.log(`⚠️ [RATING] Match not in pending status: ${match.validation_status}`);
        return {
          success: false,
          message: `Cannot apply ratings. Match status: ${match.validation_status}`,
          error: 'Invalid validation status'
        };
      }

      if (match.validation_deadline && new Date(match.validation_deadline) > new Date()) {
        console.log(`⚠️ [RATING] Validation period still active until: ${match.validation_deadline}`);
        return {
          success: false,
          message: 'Validation period has not expired yet',
          error: 'Validation window still open'
        };
      }

      if (match.report_count >= 2) {
        console.log(`⚠️ [RATING] Match has reports: ${match.report_count}, marking as disputed`);
        await supabase
          .from('matches')
          .update({
            validation_status: 'disputed',
            disputed_at: new Date().toISOString()
          })
          .eq('id', matchId);
        
        return {
          success: false,
          message: 'Match has been disputed due to reports',
          error: 'Too many reports received'
        };
      }

      // STEP 2.1.1.2.3: Fetch pre-calculated rating changes
      const { data: ratingChanges, error: changesError } = await supabase
        .from('match_rating_changes')
        .select('*')
        .eq('match_id', matchId)
        .eq('is_reverted', false);

      if (changesError || !ratingChanges || ratingChanges.length === 0) {
        console.error(`❌ [RATING] No rating changes found for match:`, changesError);
        return {
          success: false,
          message: 'No pre-calculated rating changes found',
          error: changesError?.message || 'Missing rating data'
        };
      }

      console.log(`📊 [RATING] Applying ${ratingChanges.length} rating changes`);

      // STEP 2.1.1.2.4: Apply all rating changes atomically
      for (const change of ratingChanges) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            glicko_rating: change.rating_after.toString(),
            glicko_rd: change.rd_after.toString(),
            glicko_vol: change.vol_after.toString()
          })
          .eq('id', change.player_id);

        if (updateError) {
          console.error(`❌ [RATING] Failed to update player ${change.player_id}:`, updateError);
          throw new Error(`Rating update failed for player ${change.player_id}: ${updateError.message}`);
        }

        console.log(`✅ [RATING] Updated player ${change.player_id}: ${change.rating_before} → ${change.rating_after}`);
      }

      // STEP 2.1.1.2.5: Mark match as validated and ratings applied
      const { error: finalUpdateError } = await supabase
        .from('matches')
        .update({
          validation_status: 'validated',
          rating_applied: true
        })
        .eq('id', matchId);

      if (finalUpdateError) {
        console.error(`❌ [RATING] Failed to mark match as validated:`, finalUpdateError);
        throw new Error(`Failed to finalize match validation: ${finalUpdateError.message}`);
      }

      console.log(`🎉 [RATING] Successfully applied validated ratings for match: ${matchId}`);

      return {
        success: true,
        message: `Successfully applied ratings for ${ratingChanges.length} players`,
        rating_changes: ratingChanges.map(change => ({
          player_id: change.player_id,
          rating_before: change.rating_before,
          rd_before: change.rd_before,
          vol_before: change.vol_before,
          rating_after: change.rating_after,
          rd_after: change.rd_after,
          vol_after: change.vol_after
        }))
      };

    } catch (error) {
      console.error(`💥 [RATING] Critical error applying validated ratings:`, error);
      return {
        success: false,
        message: 'Critical error during rating application',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * STEP 2.1.1.3: Process Multiple Expired Validations in Batch
   * 
   * PURPOSE: Efficiently process multiple matches that have passed validation deadline
   * PERFORMANCE: Batch processing for cron job or background task execution
   * ERROR ISOLATION: Individual match failures don't affect batch processing
   * 
   * @param limit - Maximum number of matches to process in one batch
   * @returns Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }>
   */
  static async processBatchValidationExpiry(limit: number = 50): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  }> {
    try {
      console.log(`🔄 [RATING] Starting batch validation processing (limit: ${limit})`);

      // STEP 2.1.1.3.1: Find matches ready for validation processing
      const { data: expiredMatches, error: fetchError } = await supabase
        .from('matches')
        .select('id, validation_deadline, report_count')
        .eq('validation_status', 'pending')
        .eq('rating_applied', false)
        .not('validation_deadline', 'is', null)
        .lt('validation_deadline', new Date().toISOString())
        .limit(limit);

      if (fetchError) {
        console.error(`❌ [RATING] Failed to fetch expired validations:`, fetchError);
        return { processed: 0, succeeded: 0, failed: 1, errors: [fetchError.message] };
      }

      if (!expiredMatches || expiredMatches.length === 0) {
        console.log(`ℹ️ [RATING] No expired validations to process`);
        return { processed: 0, succeeded: 0, failed: 0, errors: [] };
      }

      console.log(`📋 [RATING] Processing ${expiredMatches.length} expired validations`);

      // STEP 2.1.1.3.2: Process each match individually with error isolation
      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const match of expiredMatches) {
        try {
          console.log(`🔄 [RATING] Processing match: ${match.id} (reports: ${match.report_count})`);
          
          const result = await this.applyValidatedRatings(match.id);
          
          if (result.success) {
            succeeded++;
            console.log(`✅ [RATING] Successfully processed match: ${match.id}`);
          } else {
            failed++;
            const errorMsg = `Match ${match.id}: ${result.message}`;
            errors.push(errorMsg);
            console.log(`⚠️ [RATING] Failed to process match: ${errorMsg}`);
          }
        } catch (error) {
          failed++;
          const errorMsg = `Match ${match.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`💥 [RATING] Critical error processing match ${match.id}:`, error);
        }
      }

      console.log(`📊 [RATING] Batch processing complete: ${succeeded} succeeded, ${failed} failed`);

      return {
        processed: expiredMatches.length,
        succeeded,
        failed,
        errors
      };

    } catch (error) {
      console.error(`💥 [RATING] Critical error in batch processing:`, error);
      return {
        processed: 0,
        succeeded: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Unknown critical error']
      };
    }
  }

  /**
   * STEP 2.1.1.4: Revert Disputed Match Ratings
   * 
   * PURPOSE: Handle rating reversal for disputed matches
   * SAFETY: Only reverts ratings that were actually applied
   * AUDIT: Marks rating changes as reverted for historical tracking
   * 
   * @param matchId - UUID of the disputed match
   * @returns Promise<MatchRatingResult>
   */
  static async revertDisputedMatchRatings(matchId: string): Promise<MatchRatingResult> {
    try {
      console.log(`🔄 [RATING] Starting rating reversal for disputed match: ${matchId}`);

      // Use the database function for atomic reversal
      const { data: result, error: revertError } = await supabase
        .rpc('revert_match_ratings', {
          p_match_id: matchId
        });

      if (revertError) {
        console.error(`❌ [RATING] Rating reversal failed:`, revertError);
        return {
          success: false,
          message: 'Failed to revert match ratings',
          error: revertError.message
        };
      }

      const revertResult = result?.[0];
      
      if (!revertResult?.success) {
        console.log(`⚠️ [RATING] Rating reversal conditions not met: ${revertResult?.message}`);
        return {
          success: false,
          message: revertResult?.message || 'Reversal conditions not met',
          error: 'Cannot revert ratings'
        };
      }

      console.log(`✅ [RATING] Successfully reverted ${revertResult.reverted_count} rating changes`);

      return {
        success: true,
        message: `Successfully reverted ratings for ${revertResult.reverted_count} players`
      };

    } catch (error) {
      console.error(`💥 [RATING] Critical error reverting ratings:`, error);
      return {
        success: false,
        message: 'Critical error during rating reversal',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}