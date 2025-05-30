import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { router } from 'expo-router';
import { supabase } from '@/config/supabase';

// PRODUCTION BULLETPROOF FIX 1: Direct base64 to binary conversion (Verified Method)
const base64Decode = (base64String: string): Uint8Array => {
  try {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Uint8Array(byteNumbers);
  } catch (error) {
    console.error('🚨 PRODUCTION: Base64 decode error:', error);
    throw new Error('Failed to decode base64 string');
  }
};

// PRODUCTION BULLETPROOF FIX 2: Ultra-safe permission handling
const getSafePermission = async (permissionFn: () => Promise<any>, timeoutMs: number = 8000): Promise<boolean> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Permission timeout')), timeoutMs);
    });
    
    const result = await Promise.race([permissionFn(), timeoutPromise]);
    return result?.status === 'granted';
  } catch (error) {
    console.error('🚨 PRODUCTION: Permission request failed:', error);
    return false;
  }
};

// PRODUCTION BULLETPROOF FIX 3: Memory-conscious image processing with base64 output
const processImageSafely = async (uri: string): Promise<string | null> => {
  try {
    // Verify file exists with minimal timeout
    const fileInfoPromise = FileSystem.getInfoAsync(uri);
    const timeoutPromiseFileInfo = new Promise<FileSystem.FileInfo>((_, reject) => 
        setTimeout(() => reject(new Error('File check timeout')), 3000)
    );
    // Correctly type fileInfo
    const fileInfo = await Promise.race([fileInfoPromise, timeoutPromiseFileInfo]) as FileSystem.FileInfo & { exists: boolean };

    if (!fileInfo || !fileInfo.exists) { // Check if fileInfo itself is null/undefined from timeout
      console.error('🚨 PRODUCTION: Source file does not exist or check timed out');
      return null;
    }
    
    // Limit file size to prevent memory issues
    if (fileInfo.size && fileInfo.size > 8 * 1024 * 1024) {
      console.error('🚨 PRODUCTION: File too large:', fileInfo.size);
      return null;
    }
    
    // Process image and get base64 directly
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400, height: 400 } }], // Reasonable size for avatars
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true, // Get base64 directly for reliable upload
      }
    );
    
    if (!result.base64 || result.base64.length === 0) {
      throw new Error('Failed to generate base64 data');
    }
    
    return result.base64;
    
  } catch (error) {
    console.error('🚨 PRODUCTION: Image processing failed:', error);
    return null;
  }
};

// PRODUCTION BULLETPROOF FIX 4: Simplified, reliable upload method using verified base64 approach
const uploadAvatarSafely = async (
  base64Data: string, 
  userId: string, 
  previousAvatarUrl?: string | null
): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
  try {
    // Step 1: Validate inputs
    if (!base64Data || !userId) {
      return { success: false, error: 'Invalid parameters' };
    }
    
    // Step 2: Convert base64 to binary using verified method
    const binaryData = base64Decode(base64Data);
    
    if (binaryData.length === 0) {
      return { success: false, error: 'Failed to process image data' };
    }
    
    // Step 3: Check data size (converted binary should be reasonable)
    if (binaryData.length > 5 * 1024 * 1024) { // 5MB limit for safety
      return { success: false, error: 'Processed image is too large' };
    }
    
    // Step 4: Generate safe file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileName = `avatar_${userId}_${timestamp}_${randomId}.jpg`;
    const filePath = `${userId}/${fileName}`;
    
    // Step 5: Upload to Supabase using verified method
    let uploadSuccess = false;
    let uploadError: string | null = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, binaryData, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true,
          });
        
        if (error) {
          uploadError = error.message;
          console.warn(`🚨 PRODUCTION: Upload attempt ${attempt} failed:`, error);
          if (attempt === 2) throw error; // Rethrow to be caught by outer try-catch
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          continue;
        }
        
        uploadSuccess = true;
        break;
      } catch (errorAttempt) { // Catch rethrown error or new error
        uploadError = errorAttempt instanceof Error ? errorAttempt.message : 'Upload failed in attempt';
        if (attempt === 2) break; // Break if last attempt
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
      }
    }
    
    if (!uploadSuccess) {
      return { success: false, error: uploadError || 'Upload failed after retries' };
    }
    
    // Step 6: Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    
    if (!publicUrlData?.publicUrl) {
      return { success: false, error: 'Failed to generate public URL' };
    }
    
    // Step 7: Clean up old avatar (non-blocking)
    if (previousAvatarUrl && previousAvatarUrl !== publicUrlData.publicUrl) {
      setTimeout(async () => {
        try {
          const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
          const match = previousAvatarUrl.match(urlPattern);
          if (match && match[1]) {
            const oldFilePath = decodeURIComponent(match[1]);
            await supabase.storage.from('avatars').remove([oldFilePath]);
          }
        } catch (cleanupError) {
          console.warn('🚨 PRODUCTION: Old avatar cleanup failed:', cleanupError);
        }
      }, 1000);
    }
    
    return {
      success: true,
      publicUrl: publicUrlData.publicUrl
    };
    
  } catch (error) {
    console.error('🚨 PRODUCTION: Avatar upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
};

// PRODUCTION BULLETPROOF FIX 5: Safe image selection with direct base64 output
const selectImageSafely = async (useCamera: boolean): Promise<{ success: boolean; base64?: string; error?: string; cancelled?: boolean }> => {
  try {
    // Request permissions safely
    const hasPermission = await getSafePermission(
      useCamera 
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync
    );
    
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        `Please enable ${useCamera ? 'camera' : 'photo library'} access in your device settings.`,
        [{ text: 'OK' }]
      );
      return { success: false, error: 'Permission denied' };
    }
    
    // Launch picker with timeout and base64 enabled
    const pickerFn = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const pickerPromise = pickerFn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true, 
        exif: false,
      });
    
    const result = await Promise.race([
      pickerPromise,
      new Promise<ImagePicker.ImagePickerResult>((_, reject) => setTimeout(() => reject(new Error('Picker timeout')), 25000))
    ]);
    
    if (result.canceled) {
      return { success: false, cancelled: true };
    }
    
    if (!result.assets || result.assets.length === 0 || !result.assets[0]) {
      return { success: false, error: 'No image selected or asset is invalid' };
    }
    
    // Get base64 data directly from picker
    const base64Data = result.assets[0].base64;
    if (!base64Data || base64Data.length === 0) {
      return { success: false, error: 'Failed to get image data (base64)' };
    }
    
    return { success: true, base64: base64Data };
    
  } catch (error) {
    console.error('🚨 PRODUCTION: Image selection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image selection failed'
    };
  }
};

// PRODUCTION BULLETPROOF FIX 6: Safe avatar deletion
const deleteAvatarSafely = async (publicUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!publicUrl) {
      return { success: false, error: 'No URL provided' };
    }
    
    const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
    const match = publicUrl.match(urlPattern);
    
    if (!match || !match[1]) {
      return { success: false, error: 'Invalid URL format' };
    }
    
    const filePath = decodeURIComponent(match[1]);
    
    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath]);
    
    if (error) {
      console.error('🚨 PRODUCTION: Delete failed:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('🚨 PRODUCTION: Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    };
  }
};

// Match status enum
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5,
}

interface EnhancedPlayerStats {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  longestStreak: number;
  upcomingMatches: number;
  needsAttention: number;
  ratingHistory: {date: string, rating: number}[];
  recentMatches: any[];
  scheduledMatches: any[];
  averageMatchDuration: number;
  recentPerformance: 'improving' | 'declining' | 'stable';
  thisWeekMatches: number;
  thisMonthMatches: number;
}

interface AvatarOperationState {
  uploading: boolean;
  deleting: boolean;
  error: string | null;
  success: string | null;
}

// PRODUCTION BULLETPROOF FIX 7: Main component with comprehensive error handling
export default function Profile() {
  const { signOut, profile, saveProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const [loading, setLoading] = useState(false); // Consider setting true initially if stats load on mount
  const isMountedRef = useRef(true);
  
  const [avatarState, setAvatarState] = useState<AvatarOperationState>({
    uploading: false,
    deleting: false,
    error: null,
    success: null,
  });

  const [playerStats, setPlayerStats] = useState<EnhancedPlayerStats>({
    matches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    streak: 0,
    longestStreak: 0,
    upcomingMatches: 0,
    needsAttention: 0,
    ratingHistory: [], // Will be populated by calculateStats
    recentMatches: [],
    scheduledMatches: [],
    averageMatchDuration: 0,
    recentPerformance: 'stable',
    thisWeekMatches: 0,
    thisMonthMatches: 0,
  });

  // Safe state update helper
  const safeSetState = useCallback(<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prevState: T) => T)) => {
    if (isMountedRef.current) {
      try {
        setter(value);
      } catch (error) {
        console.error('🚨 PRODUCTION: State update failed:', error);
      }
    }
  }, []);


  // Component lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    
    if (profile?.id) {
      fetchPlayerStatistics(profile.id).catch(error => {
        console.error('🚨 PRODUCTION: Failed to fetch stats on mount:', error);
        // Potentially set an error state for stats or use default
      });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [profile?.id]); // Removed safeSetState from deps as it's stable

  // Auto-clear messages
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (avatarState.error || avatarState.success) {
      timer = setTimeout(() => {
        safeSetState(setAvatarState, prev => ({ ...prev, error: null, success: null }));
      }, 4000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [avatarState.error, avatarState.success, safeSetState]);

  // PRODUCTION BULLETPROOF FIX 8: Safe avatar upload handler with verified base64 method
  const handleAvatarUpload = async () => {
    if (!profile?.id) {
      safeSetState(setAvatarState, prev => ({ ...prev, error: 'Profile not available' }));
      return;
    }

    try {
      safeSetState(setAvatarState, { uploading: false, deleting: false, error: null, success: null });

      const selection = await new Promise<'camera' | 'library' | null>((resolve) => {
        Alert.alert(
          'Select Profile Picture',
          'Choose how you would like to set your profile picture',
          [
            { text: 'Camera', onPress: () => resolve('camera') },
            { text: 'Photo Library', onPress: () => resolve('library') },
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          ],
          { cancelable: true, onDismiss: () => resolve(null) }
        );
      });

      if (!selection || !isMountedRef.current) return;
      
      safeSetState(setAvatarState, prev => ({ ...prev, uploading: true, error: null, success: null })); // Show uploading early

      const selectionResult = await selectImageSafely(selection === 'camera');
      
      if (!isMountedRef.current) {
        safeSetState(setAvatarState, prev => ({ ...prev, uploading: false }));
        return;
      }
      
      if (!selectionResult.success) {
        if (!selectionResult.cancelled && selectionResult.error) {
          safeSetState(setAvatarState, { uploading: false, deleting: false, error: selectionResult.error, success: null });
        } else {
          safeSetState(setAvatarState, prev => ({ ...prev, uploading: false })); // Cancelled or no error message
        }
        return;
      }

      if (!selectionResult.base64) {
        safeSetState(setAvatarState, { uploading: false, deleting: false, error: 'No image data received', success: null });
        return;
      }

      const uploadResult = await uploadAvatarSafely(
        selectionResult.base64,
        profile.id,
        profile.avatar_url
      );

      if (!isMountedRef.current) return; // Upload might have finished after unmount

      if (!uploadResult.success) {
        safeSetState(setAvatarState, {
          uploading: false,
          deleting: false,
          error: uploadResult.error || 'Upload failed',
          success: null,
        });
        return;
      }

      await saveProfile({ avatar_url: uploadResult.publicUrl });

      if (isMountedRef.current) {
        safeSetState(setAvatarState, {
          uploading: false,
          deleting: false,
          error: null,
          success: 'Profile picture updated successfully!',
        });
      }

    } catch (error) {
      console.error('🚨 PRODUCTION: Avatar upload error:', error);
      if (isMountedRef.current) {
        safeSetState(setAvatarState, {
          uploading: false,
          deleting: false,
          error: 'Failed to update profile picture',
          success: null,
        });
      }
    }
  };

  // PRODUCTION BULLETPROOF FIX 9: Safe avatar removal handler
  const handleAvatarRemove = async () => {
    if (!profile?.id || !profile.avatar_url) {
      safeSetState(setAvatarState, prev => ({ ...prev, error: 'No profile picture to remove' }));
      return;
    }

    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              safeSetState(setAvatarState, { uploading: false, deleting: true, error: null, success: null });

              // We attempt to delete from storage, but update profile even if storage deletion fails
              // to ensure UI consistency. Storage errors are logged.
              const deleteResult = await deleteAvatarSafely(profile.avatar_url!);
              if (!deleteResult.success) {
                console.warn('🚨 PRODUCTION: Failed to delete avatar from storage, but proceeding to update profile:', deleteResult.error);
              }
              
              if (!isMountedRef.current) return;
              
              await saveProfile({ avatar_url: null });

              if (isMountedRef.current) {
                safeSetState(setAvatarState, {
                  uploading: false,
                  deleting: false,
                  error: null,
                  success: 'Profile picture removed successfully!',
                });
              }

            } catch (error) {
              console.error('🚨 PRODUCTION: Avatar removal error:', error);
              if (isMountedRef.current) {
                safeSetState(setAvatarState, {
                  uploading: false,
                  deleting: false,
                  error: 'Failed to remove profile picture',
                  success: null,
                });
              }
            }
          },
        },
      ]
    );
  };

  const showAvatarOptions = () => {
    if (!profile?.id) return;

    const options = [{ text: 'Change Picture', onPress: handleAvatarUpload }];
    
    if (profile.avatar_url) {
      options.push({ text: 'Remove Picture', onPress: handleAvatarRemove, style: 'destructive' as const });
    }
    
    options.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert(
      'Profile Picture Options',
      'Choose an action for your profile picture',
      options
    );
  };
  
  // Safe stats calculation
  const calculateStatsWithErrorHandling = useCallback((matchData: any[], playerId: string, currentProfile: typeof profile): EnhancedPlayerStats => {
    const defaultStats: EnhancedPlayerStats = {
      matches: 0, wins: 0, losses: 0, winRate: 0, streak: 0, longestStreak: 0,
      upcomingMatches: 0, needsAttention: 0, ratingHistory: [], recentMatches: [], scheduledMatches: [],
      averageMatchDuration: 0, recentPerformance: 'stable', thisWeekMatches: 0, thisMonthMatches: 0,
    };

    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let wins = 0, losses = 0, currentStreak = 0, longestStreak = 0;
      let needsAttention = 0, upcomingMatches = 0, thisWeekMatches = 0, thisMonthMatches = 0;
      let totalDuration = 0, matchesWithDuration = 0;
      
      const recentMatchesLocal: any[] = [];
      const scheduledMatchesLocal: any[] = [];
      
      let baseRating = 1500;
      const glickoRatingVal = currentProfile?.glicko_rating;
      if (glickoRatingVal != null) { // Check for null or undefined
        const numericRating = parseFloat(String(glickoRatingVal)); // Convert to string first, then parse
        if (!isNaN(numericRating)) {
          baseRating = numericRating;
        }
      }

      const ratingHistoryLocal = [ // Example dates, adjust as needed
        { date: 'Week 1', rating: Math.round(baseRating * 0.95) }, // Placeholder logic
        { date: 'Week 2', rating: Math.round(baseRating * 0.98) },
        { date: 'Week 3', rating: Math.round(baseRating) },
        { date: 'Week 4', rating: Math.round(baseRating * 1.02) },
        { date: 'Current', rating: Math.round(baseRating) },
      ];

      const recentResults: boolean[] = [];
      const olderResults: boolean[] = [];
      
      if (Array.isArray(matchData)) {
        const completedMatches = matchData
          .filter(match => {
            try {
              return match && typeof match.team1_score_set1 === 'number' && typeof match.team2_score_set1 === 'number';
            } catch { return false; }
          })
          .sort((a, b) => {
            try {
              const dateA = new Date(a.completed_at || a.end_time || a.start_time || 0).getTime();
              const dateB = new Date(b.completed_at || b.end_time || b.start_time || 0).getTime();
              if (isNaN(dateA) && isNaN(dateB)) return 0;
              if (isNaN(dateA)) return 1; // Push NaN dates to the end
              if (isNaN(dateB)) return -1;
              return dateA - dateB;
            } catch { return 0; }
          });

        matchData.forEach(match => {
          try {
            if (!match || !match.start_time) return;
            
            const startTime = new Date(match.start_time);
            if (isNaN(startTime.getTime())) return; // Invalid start time

            const endTime = match.end_time ? new Date(match.end_time) : null;
            const completedTime = match.completed_at ? new Date(match.completed_at) : null;
            
            const isFuture = startTime > now;
            const isPast = endTime ? endTime < now : startTime < now;
            const hasScores = typeof match.team1_score_set1 === 'number' && typeof match.team2_score_set1 === 'number';
            const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
            const needsConfirmation = match.status === MatchStatus.NEEDS_CONFIRMATION;
            
            if (needsScores || needsConfirmation) needsAttention++;
            
            if (isFuture) {
              upcomingMatches++;
              if (scheduledMatchesLocal.length < 3) scheduledMatchesLocal.push(match);
            }
            
            const matchDate = completedTime || endTime || startTime;
            if (hasScores) {
              if (matchDate >= weekAgo) thisWeekMatches++;
              if (matchDate >= monthAgo) thisMonthMatches++;
              
              if (recentMatchesLocal.length < 3) recentMatchesLocal.push(match);
              
              if (match.start_time && match.end_time && endTime && !isNaN(endTime.getTime())) {
                const duration = endTime.getTime() - startTime.getTime();
                if (duration > 0) {
                  totalDuration += duration;
                  matchesWithDuration++;
                }
              }
            }
          } catch (error) {
            console.warn('🚨 PRODUCTION: Match processing error in loop:', error, 'Match:', match);
          }
        });

        completedMatches.forEach((match) => {
          try {
            const isTeam1 = match.player1_id === playerId || match.player2_id === playerId;
            let userWon = false;
            
            if (typeof match.winner_team === 'number') {
              userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
            } else { // Fallback to score calculation if winner_team is not set
              let team1Sets = 0, team2Sets = 0;
              if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
              else if (match.team2_score_set1 > match.team1_score_set1) team2Sets++;
              
              if (typeof match.team1_score_set2 === 'number' && typeof match.team2_score_set2 === 'number') {
                if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
                else if (match.team2_score_set2 > match.team1_score_set2) team2Sets++;
              }
              
              if (typeof match.team1_score_set3 === 'number' && typeof match.team2_score_set3 === 'number') {
                if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
                else if (match.team2_score_set3 > match.team1_score_set3) team2Sets++;
              }
              
              if (team1Sets > team2Sets) userWon = isTeam1;
              else if (team2Sets > team1Sets) userWon = !isTeam1;
              // If sets are equal, it's a draw or incomplete data - counts as neither win nor loss here.
            }
            
            const matchDate = new Date(match.completed_at || match.end_time || match.start_time || 0);
            if (isNaN(matchDate.getTime())) return; // Skip if invalid date

            if (matchDate >= weekAgo) recentResults.push(userWon);
            else if (matchDate >= monthAgo) olderResults.push(userWon);
            
            if (userWon) {
              wins++;
              currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
            } else { // Assuming a non-win is a loss for streak calculation if scores are present
              losses++;
              currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
            }
            
            if (Math.abs(currentStreak) > Math.abs(longestStreak)) {
              longestStreak = currentStreak;
            }
          } catch (error) {
            console.warn('🚨 PRODUCTION: Win/loss calculation error:', error, 'Match:', match);
          }
        });
      }
      
      let recentPerformance: 'improving' | 'declining' | 'stable' = 'stable';
      try {
        if (recentResults.length >= 2 && olderResults.length >= 2) {
          const recentWinRate = recentResults.filter(Boolean).length / recentResults.length;
          const olderWinRate = olderResults.filter(Boolean).length / olderResults.length;
          
          if (recentWinRate > olderWinRate + 0.15) recentPerformance = 'improving';
          else if (recentWinRate < olderWinRate - 0.15) recentPerformance = 'declining';
        } else if (recentResults.length >= 3) { // Basic trend if not enough older data
            const recentWins = recentResults.filter(Boolean).length;
            if (recentWins / recentResults.length > 0.6) recentPerformance = 'improving';
            else if (recentWins / recentResults.length < 0.4) recentPerformance = 'declining';
        }
      } catch (error) {
        console.warn('🚨 PRODUCTION: Performance calculation error:', error);
      }
      
      const totalPlayed = wins + losses;
      const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;
      const averageMatchDurationMs = matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0;
      
      return {
        matches: totalPlayed, wins, losses, winRate, streak: currentStreak, longestStreak,
        upcomingMatches, needsAttention, ratingHistory: ratingHistoryLocal, 
        recentMatches: recentMatchesLocal, scheduledMatches: scheduledMatchesLocal,
        averageMatchDuration: averageMatchDurationMs, recentPerformance, 
        thisWeekMatches, thisMonthMatches,
      };
      
    } catch (error) {
      console.error('🚨 PRODUCTION: Stats calculation failed catastrophically:', error);
      return defaultStats; // Return safe default stats
    }
  }, [profile]); // Dependency on profile for glicko_rating

  // PRODUCTION BULLETPROOF FIX 10: Safe statistics fetching
  const fetchPlayerStatistics = async (playerId: string) => {
    try {
      if (!isMountedRef.current) return;
      safeSetState(setLoading, true);
      
      const { data: matchData, error: matchError } = await Promise.race([
        supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!player1_id(id, full_name, email, glicko_rating),
            player2:profiles!player2_id(id, full_name, email, glicko_rating),
            player3:profiles!player3_id(id, full_name, email, glicko_rating),
            player4:profiles!player4_id(id, full_name, email, glicko_rating)
          `)
          .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`)
          .order('created_at', { ascending: false })
          .limit(100), // Add a limit for safety
        new Promise<{data: any[] | null, error: any}>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 15000)) // Increased timeout
      ]);

      if (!isMountedRef.current) return;

      if (matchError) {
        console.error('🚨 PRODUCTION: Match fetch error:', matchError);
        // Keep existing (default) stats or set error state
        throw matchError; // Propagate to be caught by calling useEffect's catch
      }

      const stats = calculateStatsWithErrorHandling(matchData || [], playerId, profile);
      
      if (isMountedRef.current) {
        safeSetState(setPlayerStats, stats);
      }
      
    } catch (error) {
      console.error("🚨 PRODUCTION: Error fetching/processing stats:", error);
      if (isMountedRef.current) {
         // Optionally set playerStats to default or indicate error
        safeSetState(setPlayerStats, prev => ({...prev})); // Re-set to defaults or last known good
      }
    } finally {
      if (isMountedRef.current) {
        safeSetState(setLoading, false);
      }
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Sign Out", 
        onPress: async () => { 
          try {
            await signOut();
            // Navigation to sign-in screen is usually handled by the AuthProvider/router setup
          } catch (error) {
            console.error('🚨 PRODUCTION: Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        }, 
        style: "destructive" 
      }
    ]);
  };

  const shareProfile = async () => {
    try {
      const glickoRatingDisplay = (profile?.glicko_rating != null ? Math.round(Number(profile.glicko_rating)).toString() : '-');
      const message = `Check out my Padel profile!\n\nName: ${profile?.full_name || 'Anonymous Player'}\nRating: ${glickoRatingDisplay}\nWin Rate: ${playerStats.winRate}%\nMatches: ${playerStats.matches}\nStreak: ${playerStats.streak}\n\nLet's play a match!`;
      await Share.share({ message, title: 'Padel Profile' });
    } catch (error: any) {
      if (error.message !== 'Share Canceled') { // Don't log if user manually cancels share sheet
           console.error('🚨 PRODUCTION: Share failed:', error);
      }
    }
  };

  // Safe render helpers
  const safeRender = (renderFn: () => React.ReactNode, fallback: React.ReactNode = null): React.ReactNode => {
    try {
      return renderFn();
    } catch (error) {
      console.error('🚨 PRODUCTION: Render error in safeRender:', error);
      // In development, you might want to throw the error to see it clearly
      // if (process.env.NODE_ENV === 'development') throw error;
      return fallback || <Text>Error displaying section.</Text>; // Provide a generic fallback
    }
  };
  
  const renderBulletproofAvatar = () => (
    <View className="items-center mb-4">
      <TouchableOpacity onPress={showAvatarOptions} disabled={avatarState.uploading || avatarState.deleting}>
        <View className="relative">
          <View className="w-32 h-32 rounded-full bg-primary items-center justify-center overflow-hidden border-2 border-card">
            {profile?.avatar_url && !avatarState.uploading && !avatarState.deleting ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                placeholderContentFit="cover" // Added for consistency
                // placeholder={{ blurhash: 'L6Pj0^i_.AyE_3t7t7RMostlyoIso?' }} // Example blurhash
                transition={300} // Slightly longer for smoother feel
                onError={(e) => {
                  console.warn('🚨 PRODUCTION: Avatar load failed:', e?.error);
                  // Optionally set a flag to show fallback if image fails to load even if URL is present
                }}
              />
            ) : (
              <Text className="text-4xl font-bold text-primary-foreground">
                {(profile?.full_name?.charAt(0)?.toUpperCase()) || (profile?.email?.charAt(0)?.toUpperCase()) || '?'}
              </Text>
            )}
          </View>
          
          <View className="absolute -bottom-1 -right-1 bg-primary rounded-full items-center justify-center w-8 h-8 border-2 border-background">
            <Ionicons name="camera" size={16} color="#ffffff" />
          </View>
          
          {(avatarState.uploading || avatarState.deleting) && (
            <View className="absolute inset-0 rounded-full bg-black/60 items-center justify-center">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {(avatarState.uploading || avatarState.deleting) && (
        <View className="mt-2 flex-row items-center">
          <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#a1a1aa' : '#777'} style={{ marginRight: 8 }} />
          <Text className="text-sm text-muted-foreground">
            {avatarState.uploading ? 'Uploading picture...' : 'Removing picture...'}
          </Text>
        </View>
      )}
      
      {avatarState.error && (
        <View className="mt-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30 max-w-xs">
          <Text className="text-sm text-destructive text-center">
            {avatarState.error}
          </Text>
          <TouchableOpacity 
            onPress={() => safeSetState(setAvatarState, prev => ({ ...prev, error: null }))}
            className="mt-2 items-center"
          >
            <Text className="text-xs text-destructive/80 underline">Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {avatarState.success && (
        <View className="mt-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30 max-w-xs">
          <Text className="text-sm text-green-700 dark:text-green-400 text-center">
            {avatarState.success}
          </Text>
        </View>
      )}
    </View>
  );

  const renderInfoCard = (title: string, value: string | number | null | undefined, icon: keyof typeof Ionicons.glyphMap) => (
    <View className="bg-card rounded-lg p-4 mb-3 flex-row items-center shadow-sm">
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color={colorScheme === 'dark' ? '#38bdf8' : '#0284c7'} />
      </View>
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">{title}</Text>
        <Text className="font-medium text-card-foreground text-base">
            {value != null && String(value).trim() !== '' ? String(value) : 'Not set'}
        </Text>
      </View>
    </View>
  );

  const renderStatsCard = () => {
    const glickoRatingDisplay = (profile?.glicko_rating != null) 
      ? Math.round(Number(profile.glicko_rating)).toString() 
      : '-';

    return (
      <View className="bg-card rounded-lg p-4 md:p-6 mb-6 shadow-md">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            <Text className="text-xs text-muted-foreground mr-2">Current Rating:</Text>
            <Text className="text-xl font-bold text-primary">
              {glickoRatingDisplay}
            </Text>
          </View>
          <TouchableOpacity onPress={shareProfile} className="p-2">
            <Ionicons name="share-outline" size={22} color={colorScheme === 'dark' ? '#38bdf8' : '#0284c7'} />
          </TouchableOpacity>
        </View>
        
        <View className="flex-row justify-around mb-4">
          {[
            { label: 'Matches', value: playerStats.matches, color: 'text-primary' },
            { label: 'Wins', value: playerStats.wins, color: 'text-green-500 dark:text-green-400' },
            { label: 'Losses', value: playerStats.losses, color: 'text-red-500 dark:text-red-400' },
            { label: 'Win Rate', value: `${playerStats.winRate}%`, color: 'text-primary' },
          ].map(stat => (
            <View key={stat.label} className="items-center">
              <Text className={`text-2xl font-bold ${stat.color}`}>{stat.value}</Text>
              <Text className="text-sm text-muted-foreground">{stat.label}</Text>
            </View>
          ))}
        </View>
        
        <View className="bg-muted/30 dark:bg-muted/20 rounded-lg p-3 mb-4">
          <View className="flex-row justify-around">
            {[
              { label: 'This Week', value: playerStats.thisWeekMatches },
              { label: 'This Month', value: playerStats.thisMonthMatches },
              { label: 'Best Streak', value: Math.abs(playerStats.longestStreak), 
                color: playerStats.longestStreak > 0 ? 'text-green-500' : playerStats.longestStreak < 0 ? 'text-red-500' : 'text-foreground' },
              { label: 'Avg Duration', value: playerStats.averageMatchDuration > 0 
                  ? `${Math.round(playerStats.averageMatchDuration / (1000 * 60))}m` : '-' },
            ].map(stat => (
              <View key={stat.label} className="items-center px-1">
                <Text className={`text-lg font-bold ${stat.color || 'text-foreground'}`}>{stat.value}</Text>
                <Text className="text-xs text-muted-foreground text-center">{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View className="h-px bg-border mb-4" />
        
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Ionicons 
              name={
                playerStats.recentPerformance === 'improving' ? 'trending-up-outline' :
                playerStats.recentPerformance === 'declining' ? 'trending-down-outline' : 'remove-outline'
              } 
              size={22} 
              color={
                playerStats.recentPerformance === 'improving' ? '#10b981' : // green-500
                playerStats.recentPerformance === 'declining' ? '#ef4444' : // red-500
                (colorScheme === 'dark' ? '#a1a1aa' : '#6b7280') // muted-foreground
              } 
              style={{ marginRight: 8 }} 
            />
            <View>
              <Text className="text-sm text-muted-foreground">
                Current Streak: 
                <Text className={`font-medium ${
                  playerStats.streak > 0 ? 'text-green-500' : 
                  playerStats.streak < 0 ? 'text-red-500' : 'text-foreground'
                }`}>
                  {' '}{playerStats.streak > 0 ? `${playerStats.streak}W` : 
                       playerStats.streak < 0 ? `${Math.abs(playerStats.streak)}L` : '0'}
                </Text>
              </Text>
              <Text className={`text-xs capitalize ${
                playerStats.recentPerformance === 'improving' ? 'text-green-500' :
                playerStats.recentPerformance === 'declining' ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                Recent form: {playerStats.recentPerformance}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            className="flex-row items-center p-1"
            onPress={() => {
              try {
                router.push('/(protected)/(screens)/match-history');
              } catch (error) {
                console.error('🚨 PRODUCTION: Navigation error to match-history:', error);
                Alert.alert("Navigation Error", "Could not open match history.");
              }
            }}
          >
            <Text className="text-primary text-sm mr-1">Full History</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={colorScheme === 'dark' ? '#38bdf8' : '#0284c7'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMatchesSection = () => {
    if (playerStats.recentMatches.length === 0 && playerStats.scheduledMatches.length === 0 && playerStats.needsAttention === 0 && playerStats.upcomingMatches === 0) {
      return null; // No match-related data to show
    }
    
    return (
      <View className="bg-card rounded-lg p-4 md:p-6 mb-6 shadow-md">
        <H3 className="mb-3 text-card-foreground">Match Overview</H3>
        
        {playerStats.needsAttention > 0 && (
          <TouchableOpacity 
            className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30"
            onPress={() => {
              try {
                router.push({
                  pathname: '/(protected)/(screens)/match-history',
                  params: { filter: 'attention' }
                });
              } catch (error) {
                console.error('🚨 PRODUCTION: Navigation error to match-history (attention):', error);
                Alert.alert("Navigation Error", "Could not open matches needing attention.");
              }
            }}
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Ionicons name="alert-circle-outline" size={22} color="#f59e0b" style={{ marginRight: 8 }} />
                <Text className="text-amber-700 dark:text-amber-400 font-medium">
                  {playerStats.needsAttention} match{playerStats.needsAttention !== 1 ? 'es' : ''} need{playerStats.needsAttention === 1 ? 's' : ''} attention
                </Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#f59e0b" />
            </View>
          </TouchableOpacity>
        )}
        
        {playerStats.upcomingMatches > 0 && (
          <TouchableOpacity 
            className="mb-3 p-3 rounded-lg bg-sky-500/10 border border-sky-500/30"
             onPress={() => {
              try {
                router.push({
                  pathname: '/(protected)/(screens)/match-history',
                  params: { filter: 'upcoming' }
                });
              } catch (error) {
                console.error('🚨 PRODUCTION: Navigation error to match-history (upcoming):', error);
                Alert.alert("Navigation Error", "Could not open upcoming matches.");
              }
            }}
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={20} color="#0ea5e9" style={{ marginRight: 8 }} />
                <Text className="text-sky-700 dark:text-sky-400 font-medium">
                  {playerStats.upcomingMatches} upcoming match{playerStats.upcomingMatches !== 1 ? 'es' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#0ea5e9" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!profile && !loading) { // Handle case where profile is null and not loading (e.g. after sign out or error)
    return (
        <View className="flex-1 justify-center items-center bg-background p-5">
            <Ionicons name="person-circle-outline" size={60} color={colorScheme === 'dark' ? '#a1a1aa' : '#777'} />
            <Text className="mt-4 text-lg text-muted-foreground">Profile not available.</Text>
            <Text className="mt-1 text-sm text-muted-foreground text-center">
                This can happen after signing out or if there was an issue loading your data.
            </Text>
            {/* Optionally add a button to try reloading or go to home */}
        </View>
    );
  }


  return (
    <View className="flex-1 bg-background">
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={ // Optional: Add pull-to-refresh for stats
            profile?.id ? <ActivityIndicator 
                // Faking RefreshControl for brevity, use actual RefreshControl for better UX
                animating={loading && Platform.OS === 'android'} // iOS has its own indicator in ScrollView
                color={colorScheme === 'dark' ? '#38bdf8' : '#0284c7'} 
                // onRefresh={() => fetchPlayerStatistics(profile.id!)} // Would need actual RefreshControl
            /> : undefined
        }
      > 
        <View className="relative pt-12 pb-4 px-6 bg-primary/5 dark:bg-primary/10">
          <View className="items-center mt-10">
            {safeRender(renderBulletproofAvatar)}
            <View className="flex-row justify-center items-start w-full mt-2">
              <View className="flex-1 items-center px-4">
                <H1 className="mb-1 text-center text-2xl md:text-3xl text-foreground">
                    {profile?.full_name || 'Player'}
                </H1>
                {profile?.nickname && (
                  <H2 className="text-muted-foreground text-center text-base md:text-lg">
                    "{profile.nickname}"
                  </H2>
                )}
              </View>
            </View>
          </View>
        </View>

        <View className="px-4 md:px-6 pb-8 pt-6">
          {loading && profile?.id && ( // Show loader only if profile is available and loading stats
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#38bdf8' : '#0284c7'} />
              <Text className="mt-2 text-muted-foreground">Loading statistics...</Text>
            </View>
          )}
        
          {!loading && profile?.id && ( // Show stats sections only if not loading and profile is available
            <>
              {safeRender(renderMatchesSection)}
              {safeRender(renderStatsCard)}
            </>
          )}

          {profile && ( // Personal info section visible if profile exists
            <>
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3 px-1">
                  <H3 className="text-card-foreground">Personal Information</H3>
                  <TouchableOpacity onPress={() => {
                    try {
                      router.push('/(protected)/(screens)/edit-profile');
                    } catch (error) {
                      console.error('🚨 PRODUCTION: Navigation error to edit-profile:', error);
                      Alert.alert("Navigation Error", "Could not open edit profile screen.");
                    }
                  }} className="p-1">
                    <Ionicons name="create-outline" size={22} color={colorScheme === 'dark' ? '#a1a1aa' : '#777'} />
                  </TouchableOpacity>
                </View>
                {safeRender(() => renderInfoCard("Age", profile.age, "body-outline"))}
                {safeRender(() => renderInfoCard("Gender", profile.sex, "transgender-outline"))}
                {safeRender(() => renderInfoCard("Email", profile.email, "mail-outline"))}
              </View>

              <View className="mb-6">
                <H3 className="mb-3 px-1 text-card-foreground">Playing Preferences</H3>
                {safeRender(() => renderInfoCard("Preferred Hand", profile.preferred_hand, "hand-left-outline"))}
                {safeRender(() => renderInfoCard("Court Position", profile.court_playing_side, "move-outline"))}
                {safeRender(() => renderInfoCard("Preferred Area", profile.preferred_area, "location-outline"))}
              </View>
            </>
          )}
        </View>

        {profile && ( // Sign out button visible only if profile exists (i.e., signed in)
            <View className="px-4 md:px-6 mb-6">
            <Button 
                variant="destructive"
                className="w-full py-3 flex-row justify-center items-center shadow-md"
                onPress={handleSignOut}
            >
                <Ionicons name="log-out-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-destructive-foreground font-medium text-base">Sign Out</Text>
            </Button>
            </View>
        )}
      </ScrollView>
    </View>
  );
}