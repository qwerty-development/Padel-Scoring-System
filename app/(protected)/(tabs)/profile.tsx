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
    const fileInfo = await Promise.race([
      FileSystem.getInfoAsync(uri),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('File check timeout')), 3000))
    ]);
    
    if (!fileInfo.exists) {
      console.error('🚨 PRODUCTION: Source file does not exist');
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
          if (attempt === 2) throw error;
          continue;
        }
        
        uploadSuccess = true;
        break;
      } catch (error) {
        uploadError = error instanceof Error ? error.message : 'Upload failed';
        if (attempt === 2) break;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        ? () => ImagePicker.requestCameraPermissionsAsync()
        : () => ImagePicker.requestMediaLibraryPermissionsAsync()
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
    const pickerPromise = useCamera
      ? ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true, // Enable base64 for direct conversion
          exif: false,
        })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true, // Enable base64 for direct conversion
          exif: false,
        });
    
    const result = await Promise.race([
      pickerPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Picker timeout')), 25000))
    ]);
    
    if (result.canceled) {
      return { success: false, cancelled: true };
    }
    
    if (!result.assets || result.assets.length === 0) {
      return { success: false, error: 'No image selected' };
    }
    
    // Get base64 data directly from picker
    const base64Data = result.assets[0].base64;
    if (!base64Data || base64Data.length === 0) {
      return { success: false, error: 'Failed to get image data' };
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
  const [loading, setLoading] = useState(false);
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
    ratingHistory: [],
    recentMatches: [],
    scheduledMatches: [],
    averageMatchDuration: 0,
    recentPerformance: 'stable',
    thisWeekMatches: 0,
    thisMonthMatches: 0,
  });

  // Safe state update helper
  const safeSetState = useCallback((updateFn: (prev: any) => any, setter: React.Dispatch<React.SetStateAction<any>>) => {
    if (isMountedRef.current) {
      try {
        setter(updateFn);
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
        console.error('🚨 PRODUCTION: Failed to fetch stats:', error);
      });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [profile?.id]);

  // Auto-clear messages
  useEffect(() => {
    if (avatarState.error || avatarState.success) {
      const timer = setTimeout(() => {
        safeSetState(prev => ({ ...prev, error: null, success: null }), setAvatarState);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [avatarState.error, avatarState.success, safeSetState]);

  // PRODUCTION BULLETPROOF FIX 8: Safe avatar upload handler with verified base64 method
  const handleAvatarUpload = async () => {
    if (!profile?.id) {
      safeSetState(prev => ({ ...prev, error: 'Profile not available' }), setAvatarState);
      return;
    }

    try {
      safeSetState(() => ({ uploading: false, deleting: false, error: null, success: null }), setAvatarState);

      // Show selection options
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

      // Select image with base64 output
      const selectionResult = await selectImageSafely(selection === 'camera');
      
      if (!isMountedRef.current) return;
      
      if (!selectionResult.success) {
        if (!selectionResult.cancelled && selectionResult.error) {
          safeSetState(prev => ({ ...prev, error: selectionResult.error }), setAvatarState);
        }
        return;
      }

      if (!selectionResult.base64) {
        safeSetState(prev => ({ ...prev, error: 'No image data received' }), setAvatarState);
        return;
      }

      // Start upload
      safeSetState(prev => ({ ...prev, uploading: true }), setAvatarState);

      const uploadResult = await uploadAvatarSafely(
        selectionResult.base64,
        profile.id,
        profile.avatar_url
      );

      if (!isMountedRef.current) return;

      if (!uploadResult.success) {
        safeSetState(() => ({
          uploading: false,
          deleting: false,
          error: uploadResult.error || 'Upload failed',
          success: null,
        }), setAvatarState);
        return;
      }

      // Update profile
      await saveProfile({ avatar_url: uploadResult.publicUrl });

      if (isMountedRef.current) {
        safeSetState(() => ({
          uploading: false,
          deleting: false,
          error: null,
          success: 'Profile picture updated successfully!',
        }), setAvatarState);
      }

    } catch (error) {
      console.error('🚨 PRODUCTION: Avatar upload error:', error);
      if (isMountedRef.current) {
        safeSetState(() => ({
          uploading: false,
          deleting: false,
          error: 'Failed to update profile picture',
          success: null,
        }), setAvatarState);
      }
    }
  };

  // PRODUCTION BULLETPROOF FIX 9: Safe avatar removal handler
  const handleAvatarRemove = async () => {
    if (!profile?.id || !profile.avatar_url) {
      safeSetState(prev => ({ ...prev, error: 'No profile picture to remove' }), setAvatarState);
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
              safeSetState(prev => ({ ...prev, deleting: true, error: null }), setAvatarState);

              const deleteResult = await deleteAvatarSafely(profile.avatar_url!);
              
              if (!isMountedRef.current) return;
              
              // Update profile regardless of delete result
              await saveProfile({ avatar_url: null });

              if (isMountedRef.current) {
                safeSetState(() => ({
                  uploading: false,
                  deleting: false,
                  error: null,
                  success: 'Profile picture removed successfully!',
                }), setAvatarState);
              }

            } catch (error) {
              console.error('🚨 PRODUCTION: Avatar removal error:', error);
              if (isMountedRef.current) {
                safeSetState(() => ({
                  uploading: false,
                  deleting: false,
                  error: 'Failed to remove profile picture',
                  success: null,
                }), setAvatarState);
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
  };

  // PRODUCTION BULLETPROOF FIX 10: Safe statistics fetching
  const fetchPlayerStatistics = async (playerId: string) => {
    try {
      if (!isMountedRef.current) return;
      
      safeSetState(() => true, setLoading);
      
      // Fetch with shorter timeout for production
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
          .order('created_at', { ascending: false }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000))
      ]);

      if (!isMountedRef.current) return;

      if (matchError) {
        console.error('🚨 PRODUCTION: Match fetch error:', matchError);
        throw matchError;
      }

      // Safe stats calculation with error boundaries
      const stats = calculateStatsWithErrorHandling(matchData || [], playerId);
      
      if (isMountedRef.current) {
        safeSetState(() => stats, setPlayerStats);
      }
      
    } catch (error) {
      console.error("🚨 PRODUCTION: Error fetching stats:", error);
      // Continue with default stats instead of crashing
    } finally {
      if (isMountedRef.current) {
        safeSetState(() => false, setLoading);
      }
    }
  };

  // Safe stats calculation
  const calculateStatsWithErrorHandling = (matchData: any[], playerId: string): EnhancedPlayerStats => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let wins = 0, losses = 0, currentStreak = 0, longestStreak = 0;
      let needsAttention = 0, upcomingMatches = 0, thisWeekMatches = 0, thisMonthMatches = 0;
      let totalDuration = 0, matchesWithDuration = 0;
      
      const recentMatches: any[] = [];
      const scheduledMatches: any[] = [];
      
      // Default rating history
      const baseRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating.toString()) : 1500;
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
      
      // Safe match processing
      if (Array.isArray(matchData)) {
        const completedMatches = matchData
          .filter(match => {
            try {
              return match && match.team1_score_set1 !== null && match.team2_score_set1 !== null;
            } catch {
              return false;
            }
          })
          .sort((a, b) => {
            try {
              const dateA = new Date(a.completed_at || a.end_time || a.start_time);
              const dateB = new Date(b.completed_at || b.end_time || b.start_time);
              return dateA.getTime() - dateB.getTime();
            } catch {
              return 0;
            }
          });

        // Process each match safely
        matchData.forEach(match => {
          try {
            if (!match || !match.start_time) return;
            
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
                if (duration > 0) {
                  totalDuration += duration;
                  matchesWithDuration++;
                }
              }
            }
          } catch (error) {
            console.warn('🚨 PRODUCTION: Match processing error:', error);
          }
        });

        // Calculate wins/losses safely
        completedMatches.forEach((match) => {
          try {
            const isTeam1 = match.player1_id === playerId || match.player2_id === playerId;
            let userWon = false;
            
            if (match.winner_team) {
              userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
            } else {
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
          } catch (error) {
            console.warn('🚨 PRODUCTION: Win/loss calculation error:', error);
          }
        });
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
      } catch (error) {
        console.warn('🚨 PRODUCTION: Performance calculation error:', error);
      }
      
      const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
      const averageMatchDuration = matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0;
      
      return {
        matches: wins + losses,
        wins, losses, winRate, streak: currentStreak, longestStreak,
        upcomingMatches, needsAttention, ratingHistory, recentMatches, scheduledMatches,
        averageMatchDuration, recentPerformance, thisWeekMatches, thisMonthMatches,
      };
      
    } catch (error) {
      console.error('🚨 PRODUCTION: Stats calculation failed:', error);
      // Return safe default stats
      return {
        matches: 0, wins: 0, losses: 0, winRate: 0, streak: 0, longestStreak: 0,
        upcomingMatches: 0, needsAttention: 0, ratingHistory: [], recentMatches: [], scheduledMatches: [],
        averageMatchDuration: 0, recentPerformance: 'stable', thisWeekMatches: 0, thisMonthMatches: 0,
      };
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
      const message = `Check out my Padel profile!\n\nName: ${profile?.full_name || 'Anonymous Player'}\nRating: ${profile?.glicko_rating || '-'}\nWin Rate: ${playerStats.winRate}%\nMatches: ${playerStats.matches}\nStreak: ${playerStats.streak}\n\nLet's play a match!`;
      await Share.share({ message, title: 'Padel Profile' });
    } catch (error) {
      console.error('🚨 PRODUCTION: Share failed:', error);
    }
  };

  // Safe render helpers
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
      <TouchableOpacity onPress={showAvatarOptions} disabled={avatarState.uploading || avatarState.deleting}>
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
                {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
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
          <ActivityIndicator size="small" color="#1a7ebd" style={{ marginRight: 8 }} />
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
            onPress={() => safeSetState(prev => ({ ...prev, error: null }), setAvatarState)}
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
        <Ionicons name={icon} size={20} color="#1a7ebd" />
      </View>
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">{title}</Text>
        <Text className="font-medium">{value || 'Not set'}</Text>
      </View>
    </View>
  );

  const renderStatsCard = () => (
    <View className="bg-card rounded-lg p-6 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Text className="text-xs text-muted-foreground mr-2">Current Rating:</Text>
          <Text className="text-base font-bold text-primary">
            {profile?.glicko_rating ? parseInt(profile.glicko_rating.toString()).toString() : '-'}
          </Text>
        </View>
        <TouchableOpacity onPress={shareProfile}>
          <Ionicons name="share-outline" size={20} color="#1a7ebd" />
        </TouchableOpacity>
      </View>
      
      <View className="flex-row justify-around mb-4">
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">{playerStats.matches}</Text>
          <Text className="text-sm text-muted-foreground">Matches</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-green-500">{playerStats.wins}</Text>
          <Text className="text-sm text-muted-foreground">Wins</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-red-500">{playerStats.losses}</Text>
          <Text className="text-sm text-muted-foreground">Losses</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">{playerStats.winRate}%</Text>
          <Text className="text-sm text-muted-foreground">Win Rate</Text>
        </View>
      </View>
      
      <View className="bg-muted/20 rounded-lg p-3 mb-4">
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-lg font-bold">{playerStats.thisWeekMatches}</Text>
            <Text className="text-xs text-muted-foreground">This Week</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold">{playerStats.thisMonthMatches}</Text>
            <Text className="text-xs text-muted-foreground">This Month</Text>
          </View>
          <View className="items-center">
            <Text className={`text-lg font-bold ${
              playerStats.longestStreak > 0 ? 'text-green-500' : 
              playerStats.longestStreak < 0 ? 'text-red-500' : ''
            }`}>
              {Math.abs(playerStats.longestStreak)}
            </Text>
            <Text className="text-xs text-muted-foreground">Best Streak</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold">
              {playerStats.averageMatchDuration > 0 
                ? Math.round(playerStats.averageMatchDuration / (1000 * 60)) + 'm'
                : '-'
              }
            </Text>
            <Text className="text-xs text-muted-foreground">Avg Duration</Text>
          </View>
        </View>
      </View>
      
      <View className="h-px bg-border mb-4" />
      
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center">
          <Ionicons 
            name={
              playerStats.recentPerformance === 'improving' ? 'trending-up' :
              playerStats.recentPerformance === 'declining' ? 'trending-down' : 'remove'
            } 
            size={20} 
            color={
              playerStats.recentPerformance === 'improving' ? '#10b981' :
              playerStats.recentPerformance === 'declining' ? '#ef4444' : '#6b7280'
            } 
            style={{ marginRight: 8 }} 
          />
          <View>
            <Text className="text-sm text-muted-foreground">
              Current Streak: 
              <Text className={`font-medium ${
                playerStats.streak > 0 ? 'text-green-500' : 
                playerStats.streak < 0 ? 'text-red-500' : ''
              }`}>
                {' '}{playerStats.streak > 0 ? `${playerStats.streak}W` : 
                     playerStats.streak < 0 ? `${Math.abs(playerStats.streak)}L` : '0'}
              </Text>
            </Text>
            <Text className={`text-xs ${
              playerStats.recentPerformance === 'improving' ? 'text-green-500' :
              playerStats.recentPerformance === 'declining' ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              Recent form: {playerStats.recentPerformance}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          className="flex-row items-center"
          onPress={() => {
            try {
              router.push('/(protected)/(screens)/match-history');
            } catch (error) {
              console.error('🚨 PRODUCTION: Navigation error:', error);
            }
          }}
        >
          <Text className="text-primary text-sm mr-1">Full History</Text>
          <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMatchesSection = () => {
    if (playerStats.recentMatches.length === 0 && playerStats.scheduledMatches.length === 0 && playerStats.needsAttention === 0) {
      return null;
    }
    
    return (
      <View className="bg-card rounded-lg p-4 mb-6">
        <H3 className="mb-3">Match Overview</H3>
        
        {playerStats.needsAttention > 0 && (
          <TouchableOpacity 
            className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700"
            onPress={() => {
              try {
                router.push({
                  pathname: '/(protected)/(screens)/match-history',
                  params: { filter: 'attention' }
                });
              } catch (error) {
                console.error('🚨 PRODUCTION: Navigation error:', error);
              }
            }}
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Ionicons name="alert-circle-outline" size={20} color="#d97706" style={{ marginRight: 8 }} />
                <Text className="text-amber-800 dark:text-amber-300 font-medium">
                  {playerStats.needsAttention} match{playerStats.needsAttention !== 1 ? 'es' : ''} need{playerStats.needsAttention === 1 ? 's' : ''} attention
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#d97706" />
            </View>
          </TouchableOpacity>
        )}
        
        {playerStats.upcomingMatches > 0 && (
          <TouchableOpacity 
            className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
            onPress={() => {
              try {
                router.push({
                  pathname: '/(protected)/(screens)/match-history',
                  params: { filter: 'upcoming' }
                });
              } catch (error) {
                console.error('🚨 PRODUCTION: Navigation error:', error);
              }
            }}
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={20} color="#2563eb" style={{ marginRight: 8 }} />
                <Text className="text-blue-800 dark:text-blue-300 font-medium">
                  {playerStats.upcomingMatches} upcoming match{playerStats.upcomingMatches !== 1 ? 'es' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#2563eb" />
            </View>
          </TouchableOpacity>
        )}

        {playerStats.matches > 0 && (
          <View className="p-3 rounded-lg bg-primary/5 dark:bg-primary/10">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted-foreground">Recent Activity</Text>
              <TouchableOpacity 
                onPress={() => {
                  try {
                    router.push('/(protected)/(screens)/match-history');
                  } catch (error) {
                    console.error('🚨 PRODUCTION: Navigation error:', error);
                  }
                }}
                className="flex-row items-center"
              >
                <Text className="text-primary text-sm mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={12} color="#1a7ebd" />
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-around mt-2">
              <View className="items-center">
                <Text className="font-bold text-primary">{playerStats.thisWeekMatches}</Text>
                <Text className="text-xs text-muted-foreground">This Week</Text>
              </View>
              <View className="items-center">
                <Text className="font-bold">{playerStats.winRate}%</Text>
                <Text className="text-xs text-muted-foreground">Win Rate</Text>
              </View>
              <View className="items-center">
                <Text className={`font-bold ${
                  playerStats.streak > 0 ? 'text-green-500' : 
                  playerStats.streak < 0 ? 'text-red-500' : ''
                }`}>
                  {playerStats.streak || 0}
                </Text>
                <Text className="text-xs text-muted-foreground">Streak</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}> 
        <View className="relative pt-12 pb-4 px-6 bg-primary/10">
          <View className="items-center mt-10">
            {safeRender(() => renderBulletproofAvatar())}
            <View className="flex-row justify-between items-start">
              <View className="flex-1 items-center">
                <H1 className="mb-1 text-center">{profile?.full_name || 'Anonymous Player'}</H1>
                {profile?.nickname && (
                  <H2 className="text-muted-foreground text-center">"{profile.nickname}"</H2>
                )}
              </View>
            </View>
          </View>
        </View>

        <View className="px-6 pb-8 pt-6">
          {loading && (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#1a7ebd" />
            </View>
          )}
        
          {safeRender(() => renderMatchesSection())}
          {safeRender(() => renderStatsCard())}

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