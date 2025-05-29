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

// PRODUCTION FIX 1: Add polyfills for missing functions
const safeAtob = (str: string): string => {
  try {
    // Use native atob if available, otherwise use polyfill
    if (typeof atob !== 'undefined') {
      return atob(str);
    }
    // Polyfill for production builds
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;
    
    str = str.replace(/[^A-Za-z0-9+/]/g, '');
    
    while (i < str.length) {
      const encoded1 = chars.indexOf(str.charAt(i++));
      const encoded2 = chars.indexOf(str.charAt(i++));
      const encoded3 = chars.indexOf(str.charAt(i++));
      const encoded4 = chars.indexOf(str.charAt(i++));
      
      const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
      
      result += String.fromCharCode((bitmap >> 16) & 255);
      if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
      if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255);
    }
    
    return result;
  } catch (error) {
    console.error('📷 PRODUCTION: Base64 decode error:', error);
    throw new Error('Failed to decode base64 string');
  }
};

// PRODUCTION FIX 2: Enhanced error handling with retry mechanism
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`📷 PRODUCTION: Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) break;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
};

// PRODUCTION FIX 3: Safe permission requests with timeout
const requestCameraPermission = async (): Promise<boolean> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Permission request timeout')), 10000);
    });
    
    const permissionPromise = ImagePicker.requestCameraPermissionsAsync();
    const { status } = await Promise.race([permissionPromise, timeoutPromise]);
    
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in your device settings to take profile pictures.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('📷 PRODUCTION: Camera permission error:', error);
    Alert.alert('Permission Error', 'Unable to request camera permission. Please try again.');
    return false;
  }
};

const requestMediaLibraryPermission = async (): Promise<boolean> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Permission request timeout')), 10000);
    });
    
    const permissionPromise = ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status } = await Promise.race([permissionPromise, timeoutPromise]);
    
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please enable photo library access in your device settings to select profile pictures.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('📷 PRODUCTION: Media library permission error:', error);
    Alert.alert('Permission Error', 'Unable to request photo library permission. Please try again.');
    return false;
  }
};

// PRODUCTION FIX 4: Enhanced image processing with memory management
const processImage = async (uri: string): Promise<string> => {
  let processedUri: string | null = null;
  
  try {
    console.log('📷 PRODUCTION: Processing image:', uri);
    
    // Verify source file exists with timeout
    const fileCheckPromise = FileSystem.getInfoAsync(uri);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('File check timeout')), 5000);
    });
    
    const fileInfo = await Promise.race([fileCheckPromise, timeoutPromise]);
    
    if (!fileInfo.exists) {
      throw new Error('Source image file does not exist');
    }
    
    if (fileInfo.size && fileInfo.size > 10 * 1024 * 1024) {
      throw new Error('Image file too large (max 10MB)');
    }
    
    console.log('📷 PRODUCTION: Source file validated:', {
      exists: fileInfo.exists,
      size: fileInfo.size,
      uri: fileInfo.uri
    });
    
    // Process image with memory-conscious settings
    const processedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400, height: 400 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    processedUri = processedImage.uri;
    
    // Verify processed image
    const processedFileInfo = await FileSystem.getInfoAsync(processedUri);
    
    if (!processedFileInfo.exists || (processedFileInfo.size && processedFileInfo.size === 0)) {
      throw new Error('Image processing resulted in empty or non-existent file');
    }
    
    console.log('📷 PRODUCTION: Image processed successfully');
    return processedUri;
    
  } catch (error) {
    console.error('📷 PRODUCTION: Image processing error:', error);
    
    // Cleanup on error
    if (processedUri) {
      try {
        await FileSystem.deleteAsync(processedUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('📷 PRODUCTION: Cleanup error:', cleanupError);
      }
    }
    
    throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// PRODUCTION FIX 5: Safe blob conversion with enhanced error handling
const fileUriToBlob = async (uri: string): Promise<Blob> => {
  try {
    console.log('📷 PRODUCTION: Converting file URI to blob:', uri);
    
    // Read file with timeout and size limit
    const readPromise = FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('File read timeout')), 15000);
    });
    
    const base64Data = await Promise.race([readPromise, timeoutPromise]);
    
    if (!base64Data || base64Data.length === 0) {
      throw new Error('Failed to read file as base64 - empty data');
    }
    
    console.log('📷 PRODUCTION: Base64 data length:', base64Data.length);
    
    // Use safe base64 decoding
    const binaryData = safeAtob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }
    
    const blob = new Blob([uint8Array], { type: 'image/jpeg' });
    
    console.log('📷 PRODUCTION: Blob created successfully:', {
      size: blob.size,
      type: blob.type
    });
    
    if (blob.size === 0) {
      throw new Error('Created blob has zero size');
    }
    
    return blob;
    
  } catch (error) {
    console.error('📷 PRODUCTION: File URI to blob conversion error:', error);
    throw new Error(`Failed to convert file to blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// PRODUCTION FIX 6: Enhanced FormData upload with better error handling
const uploadUsingFormData = async (
  imageUri: string, 
  userId: string, 
  previousAvatarUrl?: string | null
): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
  try {
    console.log('📷 PRODUCTION: Using FormData upload method');
    
    // Verify file exists with enhanced checks
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error('Image file does not exist');
    }
    
    if (fileInfo.size && fileInfo.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds 5MB limit');
    }
    
    console.log('📷 PRODUCTION: File info for upload:', {
      exists: fileInfo.exists,
      size: fileInfo.size,
      uri: fileInfo.uri
    });
    
    // Generate unique file path
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `avatar_${userId}_${timestamp}_${randomSuffix}.jpg`;
    const filePath = `${userId}/${fileName}`;
    
    // Create FormData with proper structure
    const formData = new FormData();
    
    const fileObject = {
      uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
      type: 'image/jpeg',
      name: fileName,
    } as any;
    
    formData.append('file', fileObject);
    
    // Get session with error handling
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error('No active session for upload');
    }
    
    const uploadUrl = `${supabase.supabaseUrl}/storage/v1/object/avatars/${filePath}`;
    
    // Upload with timeout
    const uploadPromise = fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
      body: formData,
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Upload timeout')), 30000);
    });
    
    const uploadResponse = await Promise.race([uploadPromise, timeoutPromise]);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    
    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to generate public URL');
    }
    
    // Cleanup previous avatar safely
    if (previousAvatarUrl && previousAvatarUrl !== publicUrlData.publicUrl) {
      try {
        const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
        const match = previousAvatarUrl.match(urlPattern);
        if (match && match[1]) {
          const oldFilePath = decodeURIComponent(match[1]);
          await supabase.storage.from('avatars').remove([oldFilePath]);
          console.log('📷 PRODUCTION: Previous avatar cleaned up:', oldFilePath);
        }
      } catch (cleanupError) {
        console.warn('📷 PRODUCTION: Previous avatar cleanup failed:', cleanupError);
      }
    }
    
    console.log('📷 PRODUCTION: FormData upload completed:', {
      filePath,
      publicUrl: publicUrlData.publicUrl
    });
    
    return {
      success: true,
      publicUrl: publicUrlData.publicUrl
    };
    
  } catch (error) {
    console.error('📷 PRODUCTION: FormData upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'FormData upload failed'
    };
  }
};

// PRODUCTION FIX 7: Enhanced upload function with proper error boundaries
const uploadAvatarComplete = async (
  imageUri: string, 
  userId: string, 
  previousAvatarUrl?: string | null
) => {
  try {
    console.log('📷 PRODUCTION: Starting enhanced upload with error boundaries');
    
    if (!imageUri || !userId) {
      return { success: false, error: 'Invalid parameters: imageUri and userId are required' };
    }

    // Method 1: Try FormData approach with retry
    console.log('📷 PRODUCTION: Attempting FormData upload with retry');
    const formDataResult = await withRetry(() => uploadUsingFormData(imageUri, userId, previousAvatarUrl));
    
    if (formDataResult.success) {
      console.log('📷 PRODUCTION: FormData upload successful');
      return formDataResult;
    }
    
    console.log('📷 PRODUCTION: FormData failed, trying Blob method:', formDataResult.error);
    
    // Method 2: Fallback to Blob method with enhanced error handling
    try {
      const imageBlob = await fileUriToBlob(imageUri);
      
      if (imageBlob.size > 5 * 1024 * 1024) {
        return { success: false, error: `File size ${Math.round(imageBlob.size / 1024 / 1024)}MB exceeds 5MB limit` };
      }
      
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileName = `avatar_${userId}_${timestamp}_${randomSuffix}.jpg`;
      const filePath = `${userId}/${fileName}`;
      
      console.log('📷 PRODUCTION: Uploading blob to path:', filePath, 'Size:', imageBlob.size);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        throw new Error(`Blob upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to generate public URL');
      }

      // Cleanup previous avatar safely
      if (previousAvatarUrl && previousAvatarUrl !== publicUrlData.publicUrl) {
        try {
          const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
          const match = previousAvatarUrl.match(urlPattern);
          if (match && match[1]) {
            const oldFilePath = decodeURIComponent(match[1]);
            await supabase.storage.from('avatars').remove([oldFilePath]);
            console.log('📷 PRODUCTION: Previous avatar cleaned up:', oldFilePath);
          }
        } catch (cleanupError) {
          console.warn('📷 PRODUCTION: Previous avatar cleanup failed:', cleanupError);
        }
      }

      console.log('📷 PRODUCTION: Blob upload completed successfully');
      return {
        success: true,
        publicUrl: publicUrlData.publicUrl,
        filePath: filePath
      };
      
    } catch (blobError) {
      console.error('📷 PRODUCTION: Blob upload also failed:', blobError);
      return {
        success: false,
        error: `All upload methods failed. Last error: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`
      };
    }

  } catch (error) {
    console.error('📷 PRODUCTION: Complete upload process error:', error);
    return { 
      success: false, 
      error: `Avatar upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

// PRODUCTION FIX 8: Enhanced image selection with better error handling
const captureFromCamera = async () => {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return { success: false, error: 'Camera permission denied' };

    const launchPromise = ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Camera launch timeout')), 30000);
    });

    const result = await Promise.race([launchPromise, timeoutPromise]);

    if (result.canceled) return { success: false, cancelled: true };
    if (!result.assets || result.assets.length === 0) return { success: false, error: 'No image captured' };

    const processedUri = await processImage(result.assets[0].uri);
    return { success: true, uri: processedUri };
  } catch (error) {
    console.error('📷 PRODUCTION: Camera capture error:', error);
    return { 
      success: false, 
      error: `Camera capture failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

const selectFromLibrary = async () => {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return { success: false, error: 'Photo library permission denied' };

    const launchPromise = ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Photo library launch timeout')), 30000);
    });

    const result = await Promise.race([launchPromise, timeoutPromise]);

    if (result.canceled) return { success: false, cancelled: true };
    if (!result.assets || result.assets.length === 0) return { success: false, error: 'No image selected' };

    const processedUri = await processImage(result.assets[0].uri);
    return { success: true, uri: processedUri };
  } catch (error) {
    console.error('📷 PRODUCTION: Photo library selection error:', error);
    return { 
      success: false, 
      error: `Photo selection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

const showImageSelectionOptions = (): Promise<any> => {
  return new Promise((resolve) => {
    Alert.alert(
      'Select Profile Picture',
      'Choose how you would like to set your profile picture',
      [
        { text: 'Camera', onPress: async () => resolve(await captureFromCamera()) },
        { text: 'Photo Library', onPress: async () => resolve(await selectFromLibrary()) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve({ success: false, cancelled: true }) },
      ],
      { cancelable: true, onDismiss: () => resolve({ success: false, cancelled: true }) }
    );
  });
};

// PRODUCTION FIX 9: Enhanced avatar deletion with proper error handling
const deleteAvatarComplete = async (publicUrl: string) => {
  try {
    if (!publicUrl) return { success: false, error: 'No URL provided for deletion' };

    const urlPattern = /\/storage\/v1\/object\/public\/avatars\/(.+)$/;
    const match = publicUrl.match(urlPattern);
    
    if (!match || !match[1]) {
      return { success: false, error: 'Could not extract file path from URL' };
    }

    const filePath = decodeURIComponent(match[1]);
    console.log('📷 PRODUCTION: Deleting avatar at path:', filePath);

    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([filePath]);

    if (deleteError) {
      console.error('📷 PRODUCTION: Deletion error:', deleteError);
      return { success: false, error: `Deletion failed: ${deleteError.message}` };
    }

    console.log('📷 PRODUCTION: Avatar deleted successfully:', filePath);
    return { success: true };

  } catch (error) {
    console.error('📷 PRODUCTION: Deletion error:', error);
    return { 
      success: false, 
      error: `Avatar deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
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

// PRODUCTION FIX 10: Main component with enhanced error boundaries and cleanup
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

  // PRODUCTION FIX 11: Safe state update helper
  const safeSetState = useCallback((updateFn: (prev: any) => any, setter: React.Dispatch<React.SetStateAction<any>>) => {
    if (isMountedRef.current) {
      setter(updateFn);
    }
  }, []);

  // Component lifecycle with cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    if (profile?.id) {
      fetchPlayerStatistics(profile.id);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (avatarState.error || avatarState.success) {
      const timer = setTimeout(() => {
        safeSetState(prev => ({ ...prev, error: null, success: null }), setAvatarState);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [avatarState.error, avatarState.success, safeSetState]);

  // PRODUCTION FIX 12: Enhanced avatar upload handler with proper error boundaries
  const handleAvatarUpload = async () => {
    if (!profile?.id) {
      safeSetState(prev => ({ ...prev, error: 'User profile not available' }), setAvatarState);
      return;
    }

    try {
      console.log('🚀 PRODUCTION: Starting enhanced avatar upload workflow');
      
      safeSetState(() => ({ uploading: false, deleting: false, error: null, success: null }), setAvatarState);

      const selectionResult = await showImageSelectionOptions();
      
      if (!isMountedRef.current) return; // Check if component is still mounted
      
      if (!selectionResult.success) {
        if (!selectionResult.cancelled) {
          safeSetState(prev => ({ ...prev, error: selectionResult.error || 'Failed to select image' }), setAvatarState);
        }
        return;
      }

      if (!selectionResult.uri) {
        safeSetState(prev => ({ ...prev, error: 'No image selected' }), setAvatarState);
        return;
      }

      safeSetState(prev => ({ ...prev, uploading: true }), setAvatarState);
      console.log('🔄 PRODUCTION: Starting upload with improved methods');

      const uploadResult = await uploadAvatarComplete(
        selectionResult.uri,
        profile.id,
        profile.avatar_url
      );

      if (!isMountedRef.current) return; // Check if component is still mounted

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed with all methods');
      }

      await saveProfile({ avatar_url: uploadResult.publicUrl });

      if (isMountedRef.current) {
        safeSetState(() => ({
          uploading: false,
          deleting: false,
          error: null,
          success: 'Profile picture updated successfully!',
        }), setAvatarState);
      }

      console.log('✅ PRODUCTION: Avatar upload completed successfully');

    } catch (error) {
      console.error('❌ PRODUCTION: Avatar upload error:', error);
      if (isMountedRef.current) {
        safeSetState(() => ({
          uploading: false,
          deleting: false,
          error: error instanceof Error ? error.message : 'Failed to update profile picture',
          success: null,
        }), setAvatarState);
      }
    }
  };

  // PRODUCTION FIX 13: Enhanced avatar removal handler
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
              console.log('🗑️ PRODUCTION: Starting avatar removal process');

              const deleteResult = await deleteAvatarComplete(profile.avatar_url!);
              
              if (!isMountedRef.current) return;
              
              if (!deleteResult.success) {
                console.warn('⚠️ PRODUCTION: Storage deletion failed:', deleteResult.error);
              }

              await saveProfile({ avatar_url: null });

              if (isMountedRef.current) {
                safeSetState(() => ({
                  uploading: false,
                  deleting: false,
                  error: null,
                  success: 'Profile picture removed successfully!',
                }), setAvatarState);
              }

              console.log('✅ PRODUCTION: Avatar removal completed');

            } catch (error) {
              console.error('❌ PRODUCTION: Avatar removal error:', error);
              if (isMountedRef.current) {
                safeSetState(() => ({
                  uploading: false,
                  deleting: false,
                  error: error instanceof Error ? error.message : 'Failed to remove profile picture',
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

    const options = [
      { text: 'Change Picture', onPress: handleAvatarUpload },
    ];

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

  // PRODUCTION FIX 14: Enhanced statistics fetching with proper error handling
  const fetchPlayerStatistics = async (playerId: string) => {
    try {
      if (!isMountedRef.current) return;
      
      safeSetState(() => true, setLoading);
      
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
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 15000);
      });

      const { data: matchData, error: matchError } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!isMountedRef.current) return;

      if (matchError) {
        console.error('❌ PRODUCTION: Match fetch error:', matchError);
        throw matchError;
      }

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let wins = 0, losses = 0, currentStreak = 0, longestStreak = 0;
      let needsAttention = 0, upcomingMatches = 0, thisWeekMatches = 0, thisMonthMatches = 0;
      let totalDuration = 0, matchesWithDuration = 0;
      
      const recentMatches: any[] = [];
      const scheduledMatches: any[] = [];
      
      // Safe rating data fetch
      let ratingHistory: {date: string, rating: number}[] = [];
      try {
        const { data: ratingData } = await supabase
          .from('match_ratings')
          .select('created_at, rating')
          .eq('player_id', playerId)
          .order('created_at', { ascending: true });
          
        if (ratingData && ratingData.length > 0) {
          ratingHistory = ratingData.map(item => ({
            date: new Date(item.created_at).toLocaleDateString(),
            rating: item.rating
          }));
        } else {
          const baseRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating.toString()) : 1500;
          ratingHistory = [
            { date: '1 May', rating: Math.round(baseRating - Math.random() * 100) },
            { date: '8 May', rating: Math.round(baseRating - Math.random() * 50) },
            { date: '15 May', rating: Math.round(baseRating - Math.random() * 25) },
            { date: '22 May', rating: Math.round(baseRating) },
            { date: '29 May', rating: Math.round(baseRating + Math.random() * 25) },
            { date: '5 Jun', rating: Math.round(baseRating + Math.random() * 50) },
            { date: '12 Jun', rating: Math.round(baseRating + Math.random() * 60) },
          ];
        }
      } catch (ratingError) {
        console.warn('⚠️ PRODUCTION: Rating data fetch failed:', ratingError);
        // Continue with default rating history
        const baseRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating.toString()) : 1500;
        ratingHistory = [
          { date: '1 May', rating: Math.round(baseRating) },
          { date: '8 May', rating: Math.round(baseRating) },
          { date: '15 May', rating: Math.round(baseRating) },
          { date: '22 May', rating: Math.round(baseRating) },
          { date: '29 May', rating: Math.round(baseRating) },
          { date: '5 Jun', rating: Math.round(baseRating) },
          { date: '12 Jun', rating: Math.round(baseRating) },
        ];
      }

      const recentResults: boolean[] = [];
      const olderResults: boolean[] = [];
      
      if (matchData && Array.isArray(matchData)) {
        const chronologicalMatches = matchData
          .filter(match => match && match.team1_score_set1 !== null && match.team2_score_set1 !== null)
          .sort((a, b) => {
            try {
              const dateA = new Date(a.completed_at || a.end_time || a.start_time);
              const dateB = new Date(b.completed_at || b.end_time || b.start_time);
              return dateA.getTime() - dateB.getTime();
            } catch (error) {
              console.warn('⚠️ PRODUCTION: Date sorting error:', error);
              return 0;
            }
          });

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
          } catch (matchError) {
            console.warn('⚠️ PRODUCTION: Match processing error:', matchError);
          }
        });

        chronologicalMatches.forEach((match) => {
          try {
            if (!match) return;
            
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
          } catch (streakError) {
            console.warn('⚠️ PRODUCTION: Streak calculation error:', streakError);
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
        }
      } catch (performanceError) {
        console.warn('⚠️ PRODUCTION: Performance calculation error:', performanceError);
      }
      
      const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
      const averageMatchDuration = matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0;
      
      const finalStats: EnhancedPlayerStats = {
        matches: wins + losses,
        wins, losses, winRate, streak: currentStreak, longestStreak,
        upcomingMatches, needsAttention, ratingHistory, recentMatches, scheduledMatches,
        averageMatchDuration, recentPerformance, thisWeekMatches, thisMonthMatches,
      };

      if (isMountedRef.current) {
        safeSetState(() => finalStats, setPlayerStats);
      }
      
    } catch (error) {
      console.error("💥 PRODUCTION: Error fetching player statistics:", error);
      // Don't crash - just log the error and continue with default stats
    } finally {
      if (isMountedRef.current) {
        safeSetState(() => false, setLoading);
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
          } catch (error) {
            console.error('Sign out error:', error);
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
      console.error('Error sharing profile:', error);
      // Don't crash - just log the error
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
                  console.log('🖼️ PRODUCTION: Avatar image failed to load, showing fallback');
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
              console.error('Navigation error:', error);
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
                console.error('Navigation error:', error);
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
                console.error('Navigation error:', error);
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
                    console.error('Navigation error:', error);
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

  // PRODUCTION FIX 15: Error boundary wrapper for render methods
  const safeRender = (renderFn: () => React.ReactNode, fallback: React.ReactNode = null) => {
    try {
      return renderFn();
    } catch (error) {
      console.error('Render error:', error);
      return fallback;
    }
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
                  console.error('Navigation error:', error);
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