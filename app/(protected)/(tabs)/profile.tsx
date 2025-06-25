import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { router } from 'expo-router';
import { supabase } from '@/config/supabase';
import { NotificationBadge } from "@/components/NotificationBadge";

// PRODUCTION RULE 1: Ultra-conservative base64 decoding with comprehensive error boundaries
const safeBase64Decode = (base64String: string): Uint8Array | null => {
  try {
    if (!base64String || typeof base64String !== 'string' || base64String.length === 0) {
      console.error('🚨 PRODUCTION: Invalid base64 input');
      return null;
    }

    // Sanitize input
    const cleanedBase64 = base64String.replace(/[^A-Za-z0-9+/]/g, '');
    if (cleanedBase64.length === 0) {
      console.error('🚨 PRODUCTION: Empty base64 after sanitization');
      return null;
    }

    // Use native atob with fallback
    let byteCharacters: string;
    try {
      byteCharacters = atob(cleanedBase64);
    } catch (atobError) {
      console.error('🚨 PRODUCTION: atob failed, using manual decode');
      // Manual base64 decode fallback
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      
      while (i < cleanedBase64.length) {
        const encoded1 = chars.indexOf(cleanedBase64.charAt(i++));
        const encoded2 = chars.indexOf(cleanedBase64.charAt(i++));
        const encoded3 = chars.indexOf(cleanedBase64.charAt(i++));
        const encoded4 = chars.indexOf(cleanedBase64.charAt(i++));
        
        if (encoded1 === -1 || encoded2 === -1) break;
        
        const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
        
        result += String.fromCharCode((bitmap >> 16) & 255);
        if (encoded3 !== 64 && encoded3 !== -1) result += String.fromCharCode((bitmap >> 8) & 255);
        if (encoded4 !== 64 && encoded4 !== -1) result += String.fromCharCode(bitmap & 255);
      }
      byteCharacters = result;
    }

    if (!byteCharacters || byteCharacters.length === 0) {
      console.error('🚨 PRODUCTION: Failed to decode base64');
      return null;
    }

    // Convert to Uint8Array with size limits
    const maxSize = 10 * 1024 * 1024; // 10MB absolute limit
    if (byteCharacters.length > maxSize) {
      console.error('🚨 PRODUCTION: Decoded data too large:', byteCharacters.length);
      return null;
    }

    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Uint8Array(byteNumbers);
  } catch (error) {
    console.error('🚨 PRODUCTION: Base64 decode catastrophic failure:', error);
    return null;
  }
};

// PRODUCTION RULE 2: Progressive permission handling with timeout protection
const requestPermissionSafely = async (
  permissionType: 'camera' | 'library',
  timeoutMs: number = 5000
): Promise<boolean> => {
  try {
    const permissionPromise = permissionType === 'camera' 
      ? ImagePicker.requestCameraPermissionsAsync()
      : ImagePicker.requestMediaLibraryPermissionsAsync();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Permission timeout')), timeoutMs);
    });

    const result = await Promise.race([permissionPromise, timeoutPromise]);
    return result?.status === 'granted';
  } catch (error) {
    console.error(`🚨 PRODUCTION: ${permissionType} permission failed:`, error);
    return false;
  }
};

// PRODUCTION RULE 3: Simplified image selection with conservative settings
const selectImageWithProductionSafety = async (useCamera: boolean): Promise<{
  success: boolean;
  base64?: string;
  error?: string;
  cancelled?: boolean;
}> => {
  try {
    // Step 1: Request permissions with timeout
    const hasPermission = await requestPermissionSafely(useCamera ? 'camera' : 'library');
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        `Please enable ${useCamera ? 'camera' : 'photo library'} access in device settings.`
      );
      return { success: false, error: 'Permission denied' };
    }

    // Step 2: Launch picker with ultra-conservative settings
    const pickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.5, // Conservative quality for production stability
      base64: true,
      exif: false,
    };

    const pickerPromise = useCamera
      ? ImagePicker.launchCameraAsync(pickerOptions)
      : ImagePicker.launchImageLibraryAsync(pickerOptions);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Picker timeout')), 20000);
    });

    const result = await Promise.race([pickerPromise, timeoutPromise]);

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    if (!result.assets || result.assets.length === 0 || !result.assets[0].base64) {
      return { success: false, error: 'No image data received' };
    }

    const base64Data = result.assets[0].base64;
    
    // Validate base64 data size before returning
    if (base64Data.length > 15 * 1024 * 1024) { // 15MB base64 limit
      return { success: false, error: 'Image too large for processing' };
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

// PRODUCTION RULE 4: Bulletproof upload with extensive error recovery
const uploadAvatarWithProductionSafety = async (
  base64Data: string,
  userId: string,
  previousAvatarUrl?: string | null
): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
  try {
    // Step 1: Input validation with detailed logging
    if (!base64Data || typeof base64Data !== 'string' || base64Data.length === 0) {
      console.error('🚨 PRODUCTION: Invalid base64 data provided');
      return { success: false, error: 'Invalid image data' };
    }

    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      console.error('🚨 PRODUCTION: Invalid user ID provided');
      return { success: false, error: 'Invalid user ID' };
    }

    // Step 2: Convert base64 to binary with safety checks
    const binaryData = safeBase64Decode(base64Data);
    if (!binaryData || binaryData.length === 0) {
      console.error('🚨 PRODUCTION: Base64 conversion failed');
      return { success: false, error: 'Failed to process image data' };
    }

    // Step 3: Size validation
    const maxUploadSize = 5 * 1024 * 1024; // 5MB binary limit
    if (binaryData.length > maxUploadSize) {
      console.error('🚨 PRODUCTION: Binary data too large:', binaryData.length);
      return { success: false, error: 'Image size exceeds limit' };
    }

    console.log('🔧 PRODUCTION: Processing upload:', {
      userId: userId.substring(0, 8) + '...',
      dataSize: binaryData.length,
      timestamp: Date.now()
    });

    // Step 4: Generate unique file path
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `avatar_${userId.substring(0, 8)}_${timestamp}_${randomSuffix}.jpg`;
    const filePath = `${userId}/${fileName}`;

    // Step 5: Attempt upload with retry mechanism
    let uploadAttempts = 0;
    const maxAttempts = 2;
    let lastError: string | null = null;

    while (uploadAttempts < maxAttempts) {
      try {
        uploadAttempts++;
        console.log(`🔧 PRODUCTION: Upload attempt ${uploadAttempts}/${maxAttempts}`);

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, binaryData, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true,
          });

        if (error) {
          lastError = error.message;
          console.warn(`🚨 PRODUCTION: Upload attempt ${uploadAttempts} failed:`, error);
          
          if (uploadAttempts < maxAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          } else {
            throw error;
          }
        }

        console.log('✅ PRODUCTION: Upload successful on attempt', uploadAttempts);
        break;

      } catch (attemptError) {
        lastError = attemptError instanceof Error ? attemptError.message : 'Upload failed';
        console.error(`🚨 PRODUCTION: Upload attempt ${uploadAttempts} error:`, attemptError);
        
        if (uploadAttempts >= maxAttempts) {
          return { success: false, error: lastError || 'Upload failed after retries' };
        }
      }
    }

    // Step 6: Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      console.error('🚨 PRODUCTION: Failed to generate public URL');
      return { success: false, error: 'Failed to generate public URL' };
    }

    console.log('✅ PRODUCTION: Upload completed successfully:', {
      filePath,
      publicUrlLength: publicUrlData.publicUrl.length
    });

    // Step 7: Schedule old avatar cleanup (non-blocking)
    if (previousAvatarUrl && previousAvatarUrl !== publicUrlData.publicUrl) {
      setTimeout(async () => {
        try {
          const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
          const match = previousAvatarUrl.match(urlPattern);
          if (match && match[1]) {
            const oldFilePath = decodeURIComponent(match[1]);
            await supabase.storage.from('avatars').remove([oldFilePath]);
            console.log('🧹 PRODUCTION: Old avatar cleaned up:', oldFilePath);
          }
        } catch (cleanupError) {
          console.warn('🚨 PRODUCTION: Old avatar cleanup failed (non-critical):', cleanupError);
        }
      }, 2000);
    }

    return {
      success: true,
      publicUrl: publicUrlData.publicUrl
    };

  } catch (error) {
    console.error('🚨 PRODUCTION: Upload catastrophic failure:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
};

// PRODUCTION RULE 5: Safe avatar deletion with error isolation
const deleteAvatarWithProductionSafety = async (publicUrl: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    if (!publicUrl || typeof publicUrl !== 'string' || publicUrl.length === 0) {
      return { success: false, error: 'Invalid URL provided' };
    }

    const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
    const match = publicUrl.match(urlPattern);
    
    if (!match || !match[1]) {
      return { success: false, error: 'Could not extract file path from URL' };
    }

    const filePath = decodeURIComponent(match[1]);
    console.log('🗑️ PRODUCTION: Deleting avatar:', filePath);

    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath]);

    if (error) {
      console.error('🚨 PRODUCTION: Delete failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ PRODUCTION: Avatar deleted successfully');
    return { success: true };

  } catch (error) {
    console.error('🚨 PRODUCTION: Delete catastrophic failure:', error);
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

// Header Notification Button Component
function HeaderNotificationButton() {
  const { colorScheme } = useColorScheme();
  
  return (
    <TouchableOpacity
      onPress={() => router.push('/(protected)/(screens)/notifications')}
      className="relative p-2"
    >
      <Ionicons
        name="notifications-outline"
        size={24}
        color={colorScheme === 'dark' ? '#fff' : '#000'}
      />
      <NotificationBadge size="small" position="top-right" />
    </TouchableOpacity>
  );
}

// PRODUCTION RULE 6: Main component with progressive loading and crash isolation
export default function Profile() {
  const { signOut, profile, saveProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  // PRODUCTION RULE 6A: State management with defensive initialization
  const [loading, setLoading] = useState(false);
  const [componentReady, setComponentReady] = useState(false);
  const isMountedRef = useRef(true);
  const initializationRef = useRef(false);
  
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
    ratingHistory: [],
    recentMatches: [],
    scheduledMatches: [],
    averageMatchDuration: 0,
    recentPerformance: 'stable',
    thisWeekMatches: 0,
    thisMonthMatches: 0,
  });

  // PRODUCTION RULE 6B: Ultra-safe state update mechanism
  const safeSetState = useCallback((
    updateFn: (prev: any) => any, 
    setter: React.Dispatch<React.SetStateAction<any>>,
    stateName: string = 'unknown'
  ) => {
    try {
      if (isMountedRef.current) {
        setter(updateFn);
      } else {
        console.warn(`🚨 PRODUCTION: Attempted ${stateName} update on unmounted component`);
      }
    } catch (error) {
      console.error(`🚨 PRODUCTION: State update failed for ${stateName}:`, error);
    }
  }, []);

  // PRODUCTION RULE 6C: Progressive component initialization
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        if (initializationRef.current) return;
        initializationRef.current = true;

        console.log('🚀 PRODUCTION: Initializing profile component');
        isMountedRef.current = true;
        
        // Progressive initialization with delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (isMountedRef.current) {
          safeSetState(() => true, setComponentReady, 'componentReady');
        }

        // Initialize stats if profile is available
        if (profile?.id && isMountedRef.current) {
          console.log('🔧 PRODUCTION: Profile available, initializing stats');
          await new Promise(resolve => setTimeout(resolve, 200));
          
          if (isMountedRef.current) {
            await fetchPlayerStatisticsWithSafety(profile.id);
          }
        }

      } catch (error) {
        console.error('🚨 PRODUCTION: Component initialization failed:', error);
        if (isMountedRef.current) {
          safeSetState(() => true, setComponentReady, 'componentReady'); // Still show component
        }
      }
    };

    initializeComponent();

    return () => {
      console.log('🧹 PRODUCTION: Cleaning up profile component');
      isMountedRef.current = false;
    };
  }, [profile?.id, safeSetState]);

  // PRODUCTION RULE 6D: Safe message cleanup
  useEffect(() => {
    if ((avatarState.error || avatarState.success) && componentReady) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          safeSetState(
            prev => ({ ...prev, error: null, success: null }), 
            setAvatarState, 
            'avatarState'
          );
        }
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [avatarState.error, avatarState.success, componentReady, safeSetState]);

  // PRODUCTION RULE 7: Ultra-safe statistics fetching with comprehensive error handling
  const fetchPlayerStatisticsWithSafety = async (playerId: string) => {
    try {
      if (!isMountedRef.current || !playerId) return;
      
      console.log('📊 PRODUCTION: Starting stats fetch for:', playerId.substring(0, 8) + '...');
      safeSetState(() => true, setLoading, 'loading');
      
      // Add delay to prevent race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!isMountedRef.current) return;

      // Fetch with conservative timeout
      const fetchPromise = supabase
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
        .limit(100); // Limit results for production performance

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 8000);
      });

      const { data: matchData, error: matchError } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]);

      if (!isMountedRef.current) return;

      if (matchError) {
        console.error('🚨 PRODUCTION: Match fetch error:', matchError);
        // Don't throw, continue with empty data
      }

      console.log('📊 PRODUCTION: Processing match data:', matchData?.length || 0, 'matches');

      // Safe stats calculation with error isolation
      const stats = await calculateStatsWithMaximumSafety(matchData || [], playerId);
      
      if (isMountedRef.current) {
        safeSetState(() => stats, setPlayerStats, 'playerStats');
        console.log('✅ PRODUCTION: Stats updated successfully');
      }
      
    } catch (error) {
      console.error("🚨 PRODUCTION: Stats fetch catastrophic failure:", error);
      // Don't crash - continue with default stats
    } finally {
      if (isMountedRef.current) {
        safeSetState(() => false, setLoading, 'loading');
      }
    }
  };

  // PRODUCTION RULE 8: Bulletproof stats calculation with individual error isolation
  const calculateStatsWithMaximumSafety = async (
    matchData: any[], 
    playerId: string
  ): Promise<EnhancedPlayerStats> => {
    try {
      console.log('🔢 PRODUCTION: Starting stats calculation');
      
      // Initialize with safe defaults
      const defaultStats: EnhancedPlayerStats = {
        matches: 0, wins: 0, losses: 0, winRate: 0, streak: 0, longestStreak: 0,
        upcomingMatches: 0, needsAttention: 0, ratingHistory: [], recentMatches: [], 
        scheduledMatches: [], averageMatchDuration: 0, recentPerformance: 'stable',
        thisWeekMatches: 0, thisMonthMatches: 0,
      };

      if (!Array.isArray(matchData) || matchData.length === 0) {
        console.log('📊 PRODUCTION: No match data available, using defaults');
        return defaultStats;
      }

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let wins = 0, losses = 0, currentStreak = 0, longestStreak = 0;
      let needsAttention = 0, upcomingMatches = 0, thisWeekMatches = 0, thisMonthMatches = 0;
      let totalDuration = 0, matchesWithDuration = 0;
      
      const recentMatches: any[] = [];
      const scheduledMatches: any[] = [];
      
      // Generate safe rating history
      const baseRating = (() => {
        try {
          return profile?.glicko_rating ? parseFloat(profile.glicko_rating.toString()) : 1500;
        } catch {
          return 1500;
        }
      })();
      
      const ratingHistory = [
        { date: '1 May', rating: Math.round(baseRating) },
        { date: '8 May', rating: Math.round(baseRating) },
        { date: '15 May', rating: Math.round(baseRating) },
        { date: '22 May', rating: Math.round(baseRating) },
        { date: '29 May', rating: Math.round(baseRating) },
        { date: '5 Jun', rating: Math.round(baseRating) },
        { date: '12 Jun', rating: Math.round(baseRating) },
      ];

      const recentResults: boolean[] = [];
      const olderResults: boolean[] = [];
      
      // Safe match processing with individual error isolation
      const safeMatches = matchData.filter(match => {
        try {
          return match && typeof match === 'object' && match.start_time;
        } catch {
          return false;
        }
      });

      console.log('🔢 PRODUCTION: Processing', safeMatches.length, 'safe matches');

      // Process completed matches for wins/losses
      const completedMatches = safeMatches.filter(match => {
        try {
          return match.team1_score_set1 !== null && 
                 match.team1_score_set1 !== undefined && 
                 match.team2_score_set1 !== null && 
                 match.team2_score_set1 !== undefined;
        } catch {
          return false;
        }
      }).sort((a, b) => {
        try {
          const dateA = new Date(a.completed_at || a.end_time || a.start_time).getTime();
          const dateB = new Date(b.completed_at || b.end_time || b.start_time).getTime();
          return dateA - dateB;
        } catch {
          return 0;
        }
      });

      // Process each match with individual error boundaries
      for (const match of safeMatches) {
        try {
          if (!match || !match.start_time) continue;
          
          const startTime = new Date(match.start_time);
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const completedTime = match.completed_at ? new Date(match.completed_at) : null;
          
          const isFuture = startTime > now;
          const isPast = endTime ? endTime < now : startTime < now;
          const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
          const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
          const needsConfirmation = match.status === MatchStatus.NEEDS_CONFIRMATION;
          
          if (needsScores || needsConfirmation) needsAttention++;
          
          if (isFuture) {
            upcomingMatches++;
            if (scheduledMatches.length < 3) scheduledMatches.push(match);
          }
          
          const matchDate = completedTime || endTime || startTime;
          if (hasScores) {
            if (matchDate >= weekAgo) thisWeekMatches++;
            if (matchDate >= monthAgo) thisMonthMatches++;
            
            if (recentMatches.length < 3) recentMatches.push(match);
            
            if (match.start_time && match.end_time) {
              const duration = new Date(match.end_time).getTime() - new Date(match.start_time).getTime();
              if (duration > 0 && duration < 24 * 60 * 60 * 1000) { // Reasonable duration check
                totalDuration += duration;
                matchesWithDuration++;
              }
            }
          }
        } catch (matchError) {
          console.warn('🚨 PRODUCTION: Match processing error (non-critical):', matchError);
          continue;
        }
      }

      // Calculate wins/losses with individual error isolation
      for (const match of completedMatches) {
        try {
          const isTeam1 = match.player1_id === playerId || match.player2_id === playerId;
          let userWon = false;
          
          if (match.winner_team) {
            userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
          } else {
            // Calculate winner based on sets
            let team1Sets = 0, team2Sets = 0;
            
            if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
            else if (match.team2_score_set1 > match.team1_score_set1) team2Sets++;
            
            if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
              if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
              else if (match.team2_score_set2 > match.team1_score_set2) team2Sets++;
            }
            
            if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
              if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
              else if (match.team2_score_set3 > match.team1_score_set3) team2Sets++;
            }
            
            if (team1Sets > team2Sets) userWon = isTeam1;
            else if (team2Sets > team1Sets) userWon = !isTeam1;
          }
          
          const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
          
          if (matchDate >= weekAgo) recentResults.push(userWon);
          else if (matchDate >= monthAgo) olderResults.push(userWon);
          
          if (userWon) {
            wins++;
            currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
          } else {
            losses++;
            currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
          }
          
          if (Math.abs(currentStreak) > Math.abs(longestStreak)) {
            longestStreak = currentStreak;
          }
        } catch (winLossError) {
          console.warn('🚨 PRODUCTION: Win/loss calculation error (non-critical):', winLossError);
          continue;
        }
      }
      
      // Calculate performance trend safely
      let recentPerformance: 'improving' | 'declining' | 'stable' = 'stable';
      try {
        if (recentResults.length >= 2 && olderResults.length >= 2) {
          const recentWinRate = recentResults.filter(Boolean).length / recentResults.length;
          const olderWinRate = olderResults.filter(Boolean).length / olderResults.length;
          
          if (recentWinRate > olderWinRate + 0.15) recentPerformance = 'improving';
          else if (recentWinRate < olderWinRate - 0.15) recentPerformance = 'declining';
        }
      } catch (performanceError) {
        console.warn('🚨 PRODUCTION: Performance calculation error (non-critical):', performanceError);
      }
      
      const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
      const averageMatchDuration = matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0;
      
      const finalStats: EnhancedPlayerStats = {
        matches: wins + losses,
        wins, losses, winRate, streak: currentStreak, longestStreak,
        upcomingMatches, needsAttention, ratingHistory, recentMatches, scheduledMatches,
        averageMatchDuration, recentPerformance, thisWeekMatches, thisMonthMatches,
      };

      console.log('✅ PRODUCTION: Stats calculation completed successfully');
      return finalStats;
      
    } catch (error) {
      console.error('🚨 PRODUCTION: Stats calculation catastrophic failure:', error);
      // Return safe defaults
      return {
        matches: 0, wins: 0, losses: 0, winRate: 0, streak: 0, longestStreak: 0,
        upcomingMatches: 0, needsAttention: 0, ratingHistory: [], recentMatches: [], 
        scheduledMatches: [], averageMatchDuration: 0, recentPerformance: 'stable',
        thisWeekMatches: 0, thisMonthMatches: 0,
      };
    }
  };

  // PRODUCTION RULE 9: Ultra-safe avatar upload handler
  const handleAvatarUpload = async () => {
    try {
      if (!profile?.id) {
        safeSetState(
          prev => ({ ...prev, error: 'Profile not available' }), 
          setAvatarState, 
          'avatarState'
        );
        return;
      }

      console.log('📷 PRODUCTION: Starting avatar upload process');
      safeSetState(
        () => ({ uploading: false, deleting: false, error: null, success: null }), 
        setAvatarState, 
        'avatarState'
      );

      // Show selection options with production-safe promise handling
      const selection = await new Promise<'camera' | 'library' | null>((resolve) => {
        try {
          Alert.alert(
            'Select Profile Picture',
            'Choose how you would like to set your profile picture',
            [
              { text: 'Camera', onPress: () => resolve('camera') },
              { text: 'Photo Library', onPress: () => resolve('library') },
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            ],
            { 
              cancelable: true, 
              onDismiss: () => resolve(null) 
            }
          );
        } catch (alertError) {
          console.error('🚨 PRODUCTION: Alert error:', alertError);
          resolve(null);
        }
      });

      if (!selection || !isMountedRef.current) {
        console.log('📷 PRODUCTION: Upload cancelled by user');
        return;
      }

      // Select image with production safety
      const selectionResult = await selectImageWithProductionSafety(selection === 'camera');
      
      if (!isMountedRef.current) return;
      
      if (!selectionResult.success) {
        if (!selectionResult.cancelled && selectionResult.error) {
          safeSetState(
            prev => ({ ...prev, error: selectionResult.error }), 
            setAvatarState, 
            'avatarState'
          );
        }
        return;
      }

      if (!selectionResult.base64) {
        safeSetState(
          prev => ({ ...prev, error: 'No image data received' }), 
          setAvatarState, 
          'avatarState'
        );
        return;
      }

      // Start upload process
      console.log('📷 PRODUCTION: Starting upload with base64 data length:', selectionResult.base64.length);
      safeSetState(
        prev => ({ ...prev, uploading: true }), 
        setAvatarState, 
        'avatarState'
      );

      const uploadResult = await uploadAvatarWithProductionSafety(
        selectionResult.base64,
        profile.id,
        profile.avatar_url
      );

      if (!isMountedRef.current) return;

      if (!uploadResult.success) {
        safeSetState(
          () => ({
            uploading: false,
            deleting: false,
            error: uploadResult.error || 'Upload failed',
            success: null,
          }), 
          setAvatarState, 
          'avatarState'
        );
        return;
      }

      // Update profile with new avatar URL
      console.log('📷 PRODUCTION: Updating profile with new avatar URL');
      await saveProfile({ avatar_url: uploadResult.publicUrl });

      if (isMountedRef.current) {
        safeSetState(
          () => ({
            uploading: false,
            deleting: false,
            error: null,
            success: 'Profile picture updated successfully!',
          }), 
          setAvatarState, 
          'avatarState'
        );
        console.log('✅ PRODUCTION: Avatar upload completed successfully');
      }

    } catch (error) {
      console.error('🚨 PRODUCTION: Avatar upload catastrophic failure:', error);
      if (isMountedRef.current) {
        safeSetState(
          () => ({
            uploading: false,
            deleting: false,
            error: 'Failed to update profile picture',
            success: null,
          }), 
          setAvatarState, 
          'avatarState'
        );
      }
    }
  };

  // PRODUCTION RULE 10: Ultra-safe avatar removal handler
  const handleAvatarRemove = async () => {
    try {
      if (!profile?.id || !profile.avatar_url) {
        safeSetState(
          prev => ({ ...prev, error: 'No profile picture to remove' }), 
          setAvatarState, 
          'avatarState'
        );
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
                console.log('🗑️ PRODUCTION: Starting avatar removal process');
                safeSetState(
                  prev => ({ ...prev, deleting: true, error: null }), 
                  setAvatarState, 
                  'avatarState'
                );

                const deleteResult = await deleteAvatarWithProductionSafety(profile.avatar_url!);
                
                if (!isMountedRef.current) return;
                
                // Update profile regardless of delete result (graceful degradation)
                await saveProfile({ avatar_url: null });

                if (isMountedRef.current) {
                  safeSetState(
                    () => ({
                      uploading: false,
                      deleting: false,
                      error: null,
                      success: 'Profile picture removed successfully!',
                    }), 
                    setAvatarState, 
                    'avatarState'
                  );
                  console.log('✅ PRODUCTION: Avatar removal completed');
                }

              } catch (error) {
                console.error('🚨 PRODUCTION: Avatar removal error:', error);
                if (isMountedRef.current) {
                  safeSetState(
                    () => ({
                      uploading: false,
                      deleting: false,
                      error: 'Failed to remove profile picture',
                      success: null,
                    }), 
                    setAvatarState, 
                    'avatarState'
                  );
                }
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('🚨 PRODUCTION: Avatar removal setup error:', error);
    }
  };

  const showAvatarOptions = () => {
    try {
      if (!profile?.id) return;

      const options = [{ text: 'Change Picture', onPress: handleAvatarUpload }];
      
      if (profile.avatar_url) {
        options.push({ text: 'Remove Picture', onPress: handleAvatarRemove });
      }
      
      options.push({ text: 'Cancel', onPress: () => {} });

      Alert.alert(
        'Profile Picture Options',
        'Choose an action for your profile picture',
        options.map(option => ({
          text: option.text,
          style: option.text === 'Cancel' ? 'cancel' : option.text === 'Remove Picture' ? 'destructive' : 'default',
          onPress: option.onPress,
        }))
      );
    } catch (error) {
      console.error('🚨 PRODUCTION: Avatar options error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          onPress: async () => { 
            try {
              await signOut();
            } catch (error) {
              console.error('🚨 PRODUCTION: Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }, 
          style: "destructive" 
        }
      ]);
    } catch (error) {
      console.error('🚨 PRODUCTION: Sign out setup error:', error);
    }
  };

  const shareProfile = async () => {
    try {
      const message = `Check out my Padel profile!\n\nName: ${profile?.full_name || 'Anonymous Player'}\nRating: ${profile?.glicko_rating || '-'}\nWin Rate: ${playerStats.winRate}%\nMatches: ${playerStats.matches}\nStreak: ${playerStats.streak}\n\nLet's play a match!`;
      await Share.share({ message, title: 'Padel Profile' });
    } catch (error) {
      console.error('🚨 PRODUCTION: Share failed (non-critical):', error);
    }
  };

  // PRODUCTION RULE 11: Ultra-safe render helpers with error isolation
  const safeRender = (renderFn: () => React.ReactNode, fallback: React.ReactNode = null) => {
    try {
      return renderFn();
    } catch (error) {
      console.error('🚨 PRODUCTION: Render error:', error);
      return fallback;
    }
  };

  const renderBulletproofAvatar = () => (
    <View className="items-center mb-4">
      <TouchableOpacity 
        onPress={showAvatarOptions} 
        disabled={avatarState.uploading || avatarState.deleting}
        style={{ opacity: (avatarState.uploading || avatarState.deleting) ? 0.7 : 1 }}
      >
        <View className="relative">
          <View className="w-32 h-32 rounded-full bg-primary items-center justify-center overflow-hidden">
            {profile?.avatar_url && !avatarState.uploading && !avatarState.deleting ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                onError={() => {
                  console.log('🚨 PRODUCTION: Avatar load failed, showing fallback');
                }}
              />
            ) : (
              <Text className="text-4xl font-bold text-primary-foreground">
                {(() => {
                  try {
                    return profile?.full_name?.charAt(0)?.toUpperCase() || '?';
                  } catch {
                    return '?';
                  }
                })()}
              </Text>
            )}
          </View>
          
          <View className="absolute -bottom-1 -right-1 bg-primary rounded-full items-center justify-center w-8 h-8">
            <Ionicons name="camera" size={16} color="#ffffff" />
          </View>
          
          {(avatarState.uploading || avatarState.deleting) && (
            <View className="absolute inset-0 rounded-full bg-black/50 items-center justify-center">
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {(avatarState.uploading || avatarState.deleting) && (
        <View className="mt-2 flex-row items-center">
          <ActivityIndicator size="small" color="#2148ce" style={{ marginRight: 8 }} />
          <Text className="text-sm text-muted-foreground">
            {avatarState.uploading ? 'Uploading picture...' : 'Removing picture...'}
          </Text>
        </View>
      )}
      
      {avatarState.error && (
        <View className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 max-w-xs">
          <Text className="text-sm text-red-800 dark:text-red-300 text-center">
            {avatarState.error}
          </Text>
          <TouchableOpacity 
            onPress={() => safeSetState(
              prev => ({ ...prev, error: null }), 
              setAvatarState, 
              'avatarState'
            )}
            className="mt-2 items-center"
          >
            <Text className="text-xs text-red-600 dark:text-red-400 underline">Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {avatarState.success && (
        <View className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 max-w-xs">
          <Text className="text-sm text-green-800 dark:text-green-300 text-center">
            {avatarState.success}
          </Text>
        </View>
      )}
    </View>
  );

  const renderInfoCard = (title: string, value: string | null, icon: keyof typeof Ionicons.glyphMap) => (
    <View className="bg-card rounded-lg p-4 mb-3 flex-row items-center">
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color="#2148ce" />
      </View>
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">{title}</Text>
        <Text className="font-medium">{value || 'Not set'}</Text>
      </View>
    </View>
  );

  const renderEnhancedCombinedCard = () => {
    const getRatingFromProfile = () => {
      try {
        return profile?.glicko_rating ? parseInt(profile.glicko_rating.toString()) : null;
      } catch {
        return null;
      }
    };

    const rating = getRatingFromProfile();
    
    // Rating level classification system
    const getRatingLevel = (rating: number | null) => {
      if (!rating) return { level: 'Unrated', color: '#6b7280', bgColor: '#f3f4f6' };
      if (rating >= 2100) return { level: 'Elite', color: '#7c2d12', bgColor: '#fbbf24' };
      if (rating >= 1900) return { level: 'Expert', color: '#7c3aed', bgColor: '#c4b5fd' };
      if (rating >= 1700) return { level: 'Advanced', color: '#059669', bgColor: '#6ee7b7' };
      if (rating >= 1500) return { level: 'Intermediate', color: '#2563eb', bgColor: '#93c5fd' };
      if (rating >= 1300) return { level: 'Beginner', color: '#dc2626', bgColor: '#fca5a5' };
      return { level: 'Novice', color: '#6b7280', bgColor: '#d1d5db' };
    };

    const ratingLevel = getRatingLevel(rating);
    
    // Trend calculation for visual indicator
    const getTrendIndicator = () => {
      if (playerStats.recentPerformance === 'improving') {
        return { icon: 'trending-up', color: '#10b981' };
      } else if (playerStats.recentPerformance === 'declining') {
        return { icon: 'trending-down', color: '#ef4444' };
      }
      return { icon: 'remove', color: '#6b7280' };
    };

    const trend = getTrendIndicator();

    return (
      <View className="bg-card rounded-2xl mx-6 mb-6 overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}>
        
        {/* Header with gradient background */}
        <View className="px-6 pt-5 pb-4 bg-primary/5">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Ionicons name="analytics" size={22} color="#2148ce" style={{ marginRight: 8 }} />
              <H3 className="text-lg">Performance Overview</H3>
            </View>
            <TouchableOpacity onPress={shareProfile}>
              <Ionicons name="share-outline" size={20} color="#2148ce" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-6 pb-6">
          {/* Compact Rating Badge */}
          <View className="items-center mb-5 -mt-2">
            <View 
              className="px-6 py-3 rounded-xl border-2 flex-row items-center"
              style={{
                backgroundColor: ratingLevel.bgColor,
                borderColor: ratingLevel.color,
                shadowColor: ratingLevel.color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <Ionicons name="trophy" size={20} color={ratingLevel.color} style={{ marginRight: 8 }} />
              <View className="items-center">
                <Text 
                  className="text-2xl font-bold"
                  style={{ color: ratingLevel.color }}
                >
                  {rating || '-'}
                </Text>
                <Text 
                  className="text-xs font-medium"
                  style={{ color: ratingLevel.color, opacity: 0.8 }}
                >
                  Glicko Rating
                </Text>
              </View>
              <View className="ml-8 px-3 py-1 rounded-full" style={{ backgroundColor: ratingLevel.color }}>
                <Text className="text-white text-xs font-bold">{ratingLevel.level}</Text>
              </View>
              <Ionicons 
                name={trend.icon as any} 
                size={18} 
                color={trend.color}
                style={{ marginLeft: 8 }}
              />
            </View>
          </View>

          {/* Main Statistics Grid */}
          <View className="flex-row justify-around mb-5">
            <View className="items-center">
              <Text className="text-xl font-bold text-primary">{playerStats.matches}</Text>
              <Text className="text-xs text-muted-foreground">Matches</Text>
            </View>
            <View className="items-center">
              <Text className="text-xl font-bold text-green-500">{playerStats.wins}</Text>
              <Text className="text-xs text-muted-foreground">Wins</Text>
            </View>
            <View className="items-center">
              <Text className="text-xl font-bold text-red-500">{playerStats.losses}</Text>
              <Text className="text-xs text-muted-foreground">Losses</Text>
            </View>
            <View className="items-center">
              <Text className="text-xl font-bold text-primary">{playerStats.winRate}%</Text>
              <Text className="text-xs text-muted-foreground">Win Rate</Text>
            </View>
          </View>
          
          {/* Additional Stats - More Compact */}
          <View className="bg-muted/10 rounded-xl p-3 mb-4">
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-base font-bold">{playerStats.thisWeekMatches}</Text>
                <Text className="text-xs text-muted-foreground">This Week</Text>
              </View>
              <View className="items-center">
                <Text className="text-base font-bold">{playerStats.thisMonthMatches}</Text>
                <Text className="text-xs text-muted-foreground">This Month</Text>
              </View>
              <View className="items-center">
                <Text className={`text-base font-bold ${
                  playerStats.longestStreak > 0 ? 'text-green-500' : 
                  playerStats.longestStreak < 0 ? 'text-red-500' : ''
                }`}>
                  {Math.abs(playerStats.longestStreak)}
                </Text>
                <Text className="text-xs text-muted-foreground">Best Streak</Text>
              </View>
              <View className="items-center">
                <Text className="text-base font-bold">
                  {playerStats.averageMatchDuration > 0 
                    ? Math.round(playerStats.averageMatchDuration / (1000 * 60)) + 'm'
                    : '-'
                  }
                </Text>
                <Text className="text-xs text-muted-foreground">Avg Duration</Text>
              </View>
            </View>
          </View>
          
          {/* Separator */}
          <View className="h-px bg-border mb-4" />
          
          {/* Current Form and Navigation - More Compact */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center flex-1">
              <Ionicons 
                name={
                  playerStats.recentPerformance === 'improving' ? 'trending-up' :
                  playerStats.recentPerformance === 'declining' ? 'trending-down' : 'remove'
                } 
                size={18} 
                color={
                  playerStats.recentPerformance === 'improving' ? '#10b981' :
                  playerStats.recentPerformance === 'declining' ? '#ef4444' : '#6b7280'
                } 
                style={{ marginRight: 8 }} 
              />
              <View className="flex-1">
                <Text className="text-sm text-muted-foreground">
                  Streak: 
                  <Text className={`font-medium ${
                    playerStats.streak > 0 ? 'text-green-500' : 
                    playerStats.streak < 0 ? 'text-red-500' : ''
                  }`}>
                    {' '}{playerStats.streak > 0 ? `${playerStats.streak}W` : 
                         playerStats.streak < 0 ? `${Math.abs(playerStats.streak)}L` : '0'}
                  </Text>
                  {' • '}
                  <Text className={`${
                    playerStats.recentPerformance === 'improving' ? 'text-green-500' :
                    playerStats.recentPerformance === 'declining' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {playerStats.recentPerformance}
                  </Text>
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              className="flex-row items-center ml-4"
              onPress={() => {
                try {
                  router.push('/(protected)/(screens)/match-history');
                } catch (error) {
                  console.error('🚨 PRODUCTION: Navigation error:', error);
                }
              }}
            >
              <Text className="text-primary text-sm mr-1">History</Text>
              <Ionicons name="chevron-forward" size={14} color="#2148ce" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!componentReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#2148ce" />
        <Text className="mt-4 text-muted-foreground">Loading profile...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}> 
        
        {/* **COMPACT PROFILE HEADER WITH NOTIFICATION BELL** */}
        <View className="relative pt-16 pb-6 px-6 bg-gradient-to-b from-primary/10 to-background">
          {/* Notification Bell - Positioned at top-right */}
          <View className="absolute top-16 right-6 z-10">
            <HeaderNotificationButton />
          </View>
          
          <View className="items-center">
            {/* Avatar with compact styling */}
            <View className="mb-3">
              {safeRender(() => renderBulletproofAvatar())}
            </View>
            
            {/* Name and Nickname - More Compact */}
            <View className="items-center mb-2">
              <H1 className="text-2xl font-bold mb-1 text-center leading-tight">
                {profile?.full_name || 'Anonymous Player'}
              </H1>
              {profile?.nickname && (
                <Text className="text-base text-muted-foreground italic text-center">
                  "{profile.nickname}"
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View className="py-3 items-center">
            <ActivityIndicator size="small" color="#2148ce" />
            <Text className="mt-2 text-xs text-muted-foreground">Loading statistics...</Text>
          </View>
        )}

        {/* **ENHANCED COMBINED RATING AND STATS CARD** */}
        {safeRender(() => renderEnhancedCombinedCard())}

        <View className="px-6 pb-8 pt-2">
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H3>Personal Information</H3>
              <TouchableOpacity onPress={() => {
                try {
                  router.push('/(protected)/(screens)/edit-profile');
                } catch (error) {
                  console.error('🚨 PRODUCTION: Navigation error:', error);
                }
              }}>
                <Ionicons name="create-outline" size={20} color={colorScheme === 'dark' ? '#a1a1aa' : '#777'} />
              </TouchableOpacity>
            </View>
            {safeRender(() => renderInfoCard("Age", profile?.age ? profile.age.toString() : null, "person-outline"))}
            {safeRender(() => renderInfoCard("Gender", profile?.sex, "body-outline"))}
            {safeRender(() => renderInfoCard("Email", profile?.email, "mail-outline"))}
          </View>

          <View className="mb-6">
            <H3 className="mb-3">Playing Preferences</H3>
            {safeRender(() => renderInfoCard("Preferred Hand", profile?.preferred_hand, "hand-left-outline"))}
            {safeRender(() => renderInfoCard("Court Position", profile?.court_playing_side, "tennisball-outline"))}
            {safeRender(() => renderInfoCard("Preferred Area", profile?.preferred_area, "location-outline"))}
          </View>
        </View>

        <View className="px-6 mb-6">
          <Button 
            variant="destructive"
            className="w-full py-3 flex-row justify-center items-center"
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text className="text-white font-medium">Sign Out</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}