import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Image } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';

interface FriendProfile {
  id: string;
  email: string;
  full_name: string | null;
  age: string | null;
  nickname: string | null;
  sex: string | null;
  preferred_hand: string | null;
  preferred_area: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
  court_playing_side: string | null;
  avatar_url: string | null;
}

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  team1_score_set1: number;
  team2_score_set1: number;
  team1_score_set2: number;
  team2_score_set2: number;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  status: number;
  created_at: string;
  completed_at: string | null;
  start_time: string;
  end_time: string | null;
  winner_team: number;
  player1: { id: string; full_name: string | null; email: string };
  player2: { id: string; full_name: string | null; email: string };
  player3: { id: string; full_name: string | null; email: string };
  player4: { id: string; full_name: string | null; email: string };
}

interface MatchHistory {
  partnerMatches: MatchData[];
  rivalMatches: MatchData[];
  allMatches: MatchData[];
  partnershipRecord: {
    totalMatches: number;
    wins: number;
    losses: number;
    winPercentage: number;
    setsWon: number;
    setsLost: number;
  };
  headToHeadRecord: {
    totalMatches: number;
    userWins: number;
    friendWins: number;
    userWinPercentage: number;
    setsWon: number;
    setsLost: number;
  };
  recentForm: ('W' | 'L')[];
}

/**
 * Advanced Avatar Component for Friend Profile Display
 * Implements comprehensive image loading with sophisticated fallback mechanisms
 * Optimized for large profile avatar display requirements (96x96px)
 */
interface ProfileAvatarProps {
  profile: FriendProfile | null;
  size?: 'md' | 'lg' | 'xl';
}

function ProfileAvatar({ profile, size = 'xl' }: ProfileAvatarProps) {
  // State management for complex image loading lifecycle
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  // Configuration matrix for profile avatar sizing
  const avatarSizeConfiguration = {
    md: {
      containerClass: 'w-16 h-16',
      imageStyle: { width: 64, height: 64, borderRadius: 32 },
      textClass: 'text-2xl',
      borderWidth: 3
    },
    lg: {
      containerClass: 'w-20 h-20',
      imageStyle: { width: 80, height: 80, borderRadius: 40 },
      textClass: 'text-3xl',
      borderWidth: 4
    },
    xl: {
      containerClass: 'w-24 h-24',
      imageStyle: { width: 96, height: 96, borderRadius: 48 },
      textClass: 'text-4xl',
      borderWidth: 4
    }
  };

  const sizeConfig = avatarSizeConfiguration[size];

  /**
   * Advanced Fallback Character Extraction Algorithm
   * Implements comprehensive null-safety validation and character extraction
   * Priority: full_name -> email -> default fallback
   */
  const extractProfileInitial = (): string => {
    if (!profile) return '?';
    
    // Primary extraction path: full_name with comprehensive validation
    if (profile.full_name?.trim()) {
      const sanitizedFullName = profile.full_name.trim();
      if (sanitizedFullName.length > 0) {
        return sanitizedFullName.charAt(0).toUpperCase();
      }
    }
    
    // Secondary extraction path: email with validation
    if (profile.email?.trim()) {
      const sanitizedEmail = profile.email.trim();
      if (sanitizedEmail.length > 0) {
        return sanitizedEmail.charAt(0).toUpperCase();
      }
    }
    
    // Tertiary fallback: default character
    return '?';
  };

  /**
   * Avatar Image Availability Validation Logic
   * Implements comprehensive URL validation and error state verification
   */
  const shouldDisplayProfileImage = (): boolean => {
    if (!profile?.avatar_url) return false;
    
    const trimmedUrl = profile.avatar_url.trim();
    return Boolean(
      trimmedUrl &&                    // URL exists and not empty
      trimmedUrl.length > 0 &&         // URL has content
      !imageLoadError                  // No previous loading failures
    );
  };

  /**
   * Image Loading Success Event Handler
   * Manages state transition from loading to successfully loaded
   */
  const handleImageLoadSuccess = (): void => {
    setImageLoading(false);
  };

  /**
   * Image Loading Failure Event Handler
   * Implements comprehensive error logging with contextual information
   */
  const handleImageLoadFailure = (): void => {
    console.warn(`Friend profile avatar load failure:`, {
      profileId: profile?.id,
      profileName: profile?.full_name || profile?.email,
      avatarUrl: profile?.avatar_url,
      timestamp: new Date().toISOString(),
      component: 'ProfileAvatar',
      context: 'FriendProfileScreen'
    });
    
    setImageLoadError(true);
    setImageLoading(false);
  };

  /**
   * Image Loading Initiation Event Handler
   * Manages state transition from initial to loading state
   */
  const handleImageLoadStart = (): void => {
    setImageLoading(true);
  };

  // Avatar Image Rendering Branch with Enhanced Visual Effects
  if (shouldDisplayProfileImage()) {
    return (
      <View 
        className={`${sizeConfig.containerClass} rounded-full bg-primary items-center justify-center mb-4 overflow-hidden`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Image
          source={{ uri: profile!.avatar_url! }}
          style={sizeConfig.imageStyle}
          resizeMode="cover"
          onLoad={handleImageLoadSuccess}
          onError={handleImageLoadFailure}
          onLoadStart={handleImageLoadStart}
        />
        
        {/* Advanced Loading State Overlay with Synchronized Styling */}
        {imageLoading && (
          <View 
            className="absolute inset-0 bg-primary items-center justify-center"
            style={{
              backgroundColor: 'rgba(26, 126, 189, 0.85)',
            }}
          >
            <Text className={`${sizeConfig.textClass} font-bold text-primary-foreground`}>
              {extractProfileInitial()}
            </Text>
            
            {/* Subtle loading indicator overlay */}
            <View 
              className="absolute bottom-2 right-2 bg-white/20 rounded-full p-1"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          </View>
        )}
      </View>
    );
  }

  // Enhanced Text Initial Fallback with Premium Visual Effects
  return (
    <View 
      className={`${sizeConfig.containerClass} rounded-full bg-primary items-center justify-center mb-4`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Text className={`${sizeConfig.textClass} font-bold text-primary-foreground`}>
        {extractProfileInitial()}
      </Text>
    </View>
  );
}

export default function FriendProfileScreen() {
  const { friendId } = useLocalSearchParams();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistory>({
    partnerMatches: [],
    rivalMatches: [],
    allMatches: [],
    partnershipRecord: { 
      totalMatches: 0, 
      wins: 0, 
      losses: 0, 
      winPercentage: 0,
      setsWon: 0,
      setsLost: 0
    },
    headToHeadRecord: { 
      totalMatches: 0, 
      userWins: 0, 
      friendWins: 0, 
      userWinPercentage: 0,
      setsWon: 0,
      setsLost: 0
    },
    recentForm: []
  });
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { session, profile: currentUserProfile } = useAuth();

  useEffect(() => {
    if (friendId) {
      fetchFriendProfile(friendId as string);
    }
  }, [friendId]);

  useEffect(() => {
    if (friendId && session?.user?.id) {
      fetchMatchHistory(friendId as string, session.user.id);
    }
  }, [friendId, session]);

  const fetchFriendProfile = async (id: string) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching friend profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMatchHistory = async (friendId: string, currentUserId: string) => {
    try {
      setMatchesLoading(true);
      
      // Query matches where both users participated
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email),
          player2:profiles!player2_id(id, full_name, email),
          player3:profiles!player3_id(id, full_name, email),
          player4:profiles!player4_id(id, full_name, email)
        `)
        .or(
          `and(player1_id.eq.${currentUserId},or(player2_id.eq.${friendId},player3_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player2_id.eq.${currentUserId},or(player1_id.eq.${friendId},player3_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player3_id.eq.${currentUserId},or(player1_id.eq.${friendId},player2_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player4_id.eq.${currentUserId},or(player1_id.eq.${friendId},player2_id.eq.${friendId},player3_id.eq.${friendId}))`
        )
        .order('start_time', { ascending: false });

      if (error) throw error;

      if (data) {
        // Process and categorize matches
        const processedMatches = processMatchHistory(data, currentUserId, friendId);
        setMatchHistory(processedMatches);
      }
    } catch (error) {
      console.error('Error fetching match history:', error);
    } finally {
      setMatchesLoading(false);
    }
  };

  const processMatchHistory = (matches: MatchData[], currentUserId: string, friendId: string): MatchHistory => {
    // Separate matches into categories
    const partnerMatches: MatchData[] = [];
    const rivalMatches: MatchData[] = [];
    
    let partnerWins = 0;
    let partnerSetsWon = 0;
    let partnerSetsLost = 0;
    let rivalUserWins = 0;
    let rivalSetsWon = 0;
    let rivalSetsLost = 0;
    const recentForm: ('W' | 'L')[] = [];

    matches.forEach(match => {
      const isUserInTeam1 = match.player1_id === currentUserId || match.player2_id === currentUserId;
      const isFriendInTeam1 = match.player1_id === friendId || match.player2_id === friendId;
      
      // Calculate sets for this match
      const team1Sets = (match.team1_score_set1 > match.team2_score_set1 ? 1 : 0) +
                       (match.team1_score_set2 > match.team2_score_set2 ? 1 : 0) +
                       ((match.team1_score_set3 !== null && match.team2_score_set3 !== null) 
                        ? (match.team1_score_set3 > match.team2_score_set3 ? 1 : 0) : 0);
      
      const team2Sets = (match.team2_score_set1 > match.team1_score_set1 ? 1 : 0) +
                       (match.team2_score_set2 > match.team1_score_set2 ? 1 : 0) +
                       ((match.team1_score_set3 !== null && match.team2_score_set3 !== null) 
                        ? (match.team2_score_set3 > match.team1_score_set3 ? 1 : 0) : 0);
      
      // If both in same team (partners)
      if ((isUserInTeam1 && isFriendInTeam1) || (!isUserInTeam1 && !isFriendInTeam1)) {
        partnerMatches.push(match);
        
        // Check if their team won
        const teamWon = (isUserInTeam1 && match.winner_team === 1) || (!isUserInTeam1 && match.winner_team === 2);
        if (teamWon) {
          partnerWins++;
          recentForm.unshift('W');
        } else {
          recentForm.unshift('L');
        }
        
        // Track sets
        if (isUserInTeam1) {
          partnerSetsWon += team1Sets;
          partnerSetsLost += team2Sets;
        } else {
          partnerSetsWon += team2Sets;
          partnerSetsLost += team1Sets;
        }
      } else {
        // They are opponents (rivals)
        rivalMatches.push(match);
        
        // Check if current user won against friend
        const userWon = (isUserInTeam1 && match.winner_team === 1) || (!isUserInTeam1 && match.winner_team === 2);
        if (userWon) {
          rivalUserWins++;
          recentForm.unshift('W');
        } else {
          recentForm.unshift('L');
        }
        
        // Track sets
        if (isUserInTeam1) {
          rivalSetsWon += team1Sets;
          rivalSetsLost += team2Sets;
        } else {
          rivalSetsWon += team2Sets;
          rivalSetsLost += team1Sets;
        }
      }
    });

    // Limit recent form to last 10 matches
    const limitedRecentForm = recentForm.slice(0, 10);

    return {
      partnerMatches,
      rivalMatches,
      allMatches: matches,
      partnershipRecord: {
        totalMatches: partnerMatches.length,
        wins: partnerWins,
        losses: partnerMatches.length - partnerWins,
        winPercentage: partnerMatches.length > 0 ? Math.round((partnerWins / partnerMatches.length) * 100) : 0,
        setsWon: partnerSetsWon,
        setsLost: partnerSetsLost
      },
      headToHeadRecord: {
        totalMatches: rivalMatches.length,
        userWins: rivalUserWins,
        friendWins: rivalMatches.length - rivalUserWins,
        userWinPercentage: rivalMatches.length > 0 ? Math.round((rivalUserWins / rivalMatches.length) * 100) : 0,
        setsWon: rivalSetsWon,
        setsLost: rivalSetsLost
      },
      recentForm: limitedRecentForm
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (friendId) {
      fetchFriendProfile(friendId as string);
      if (session?.user?.id) {
        fetchMatchHistory(friendId as string, session.user.id);
      }
    }
  };

  /**
   * Enhanced Information Card Renderer with Improved Visual Design
   * Implements consistent styling and improved accessibility
   */
  const renderInfoCard = (title: string, value: string | null, icon: keyof typeof Ionicons.glyphMap) => (
    <View 
      className="bg-card rounded-lg p-4 mb-3 flex-row items-center border border-border/30"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color="#1a7ebd" />
      </View>
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground font-medium">{title}</Text>
        <Text className="font-medium text-foreground">{value || 'Not set'}</Text>
      </View>
    </View>
  );

  /**
   * Enhanced Head-to-Head Statistics Card with Visual Comparison
   */
  const renderHeadToHeadCard = () => {
    const { headToHeadRecord } = matchHistory;
    
    if (headToHeadRecord.totalMatches === 0) {
      return (
        <View 
          className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6 mb-4 border border-orange-200"
          style={{
            shadowColor: "#ea580c",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center mb-3">
            <View className="bg-orange-100 p-2 rounded-full mr-3">
              <Ionicons name="flash-outline" size={20} color="#ea580c" />
            </View>
            <Text className="font-bold text-lg text-orange-800">Head-to-Head Record</Text>
          </View>
          <Text className="text-orange-600 text-center">
            No competitive matches yet - time for a rivalry to begin!
          </Text>
        </View>
      );
    }

    const userWinPercentage = headToHeadRecord.userWinPercentage;
    const friendWinPercentage = 100 - userWinPercentage;

    return (
      <View 
        className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6 mb-4 border border-orange-200"
        style={{
          shadowColor: "#ea580c",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View className="flex-row items-center mb-4">
          <View className="bg-orange-100 p-2 rounded-full mr-3">
            <Ionicons name="flash-outline" size={20} color="#ea580c" />
          </View>
          <Text className="font-bold text-lg text-orange-800">Head-to-Head Record</Text>
        </View>
        
        {/* Win percentage bar */}
        <View className="mb-4">
          <View className="flex-row justify-between mb-2">
            <Text className="font-medium text-sm">You</Text>
            <Text className="font-medium text-sm">{profile?.full_name || 'Friend'}</Text>
          </View>
          <View className="h-6 bg-gray-200 rounded-full overflow-hidden flex-row">
            <View 
              className="bg-green-500 h-full justify-center items-center"
              style={{ width: `${userWinPercentage}%` }}
            >
              {userWinPercentage > 20 && (
                <Text className="text-white text-xs font-bold">{userWinPercentage}%</Text>
              )}
            </View>
            <View 
              className="bg-red-500 h-full justify-center items-center"
              style={{ width: `${friendWinPercentage}%` }}
            >
              {friendWinPercentage > 20 && (
                <Text className="text-white text-xs font-bold">{friendWinPercentage}%</Text>
              )}
            </View>
          </View>
        </View>

        {/* Detailed statistics */}
        <View className="flex-row justify-between">
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-green-600">
              {headToHeadRecord.userWins}
            </Text>
            <Text className="text-xs text-gray-600">Your Wins</Text>
          </View>
          
          <View className="items-center flex-1">
            <Text className="text-lg font-bold text-gray-600">
              {headToHeadRecord.totalMatches}
            </Text>
            <Text className="text-xs text-gray-600">Total Matches</Text>
          </View>
          
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-red-600">
              {headToHeadRecord.friendWins}
            </Text>
            <Text className="text-xs text-gray-600">Their Wins</Text>
          </View>
        </View>

        {/* Sets record */}
        <View className="mt-4 pt-4 border-t border-orange-200">
          <View className="flex-row justify-between">
            <Text className="text-sm text-gray-600">
              Sets: {headToHeadRecord.setsWon}-{headToHeadRecord.setsLost}
            </Text>
            <Text className="text-sm font-medium text-orange-700">
              {headToHeadRecord.userWins > headToHeadRecord.friendWins ? 'You lead' : 
               headToHeadRecord.friendWins > headToHeadRecord.userWins ? 'They lead' : 'Tied'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  /**
   * Enhanced Partnership Record Card
   */
  const renderPartnershipCard = () => {
    const { partnershipRecord } = matchHistory;
    
    if (partnershipRecord.totalMatches === 0) {
      return (
        <View 
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-4 border border-blue-200"
          style={{
            shadowColor: "#3b82f6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center mb-3">
            <View className="bg-blue-100 p-2 rounded-full mr-3">
              <Ionicons name="people-outline" size={20} color="#3b82f6" />
            </View>
            <Text className="font-bold text-lg text-blue-800">Partnership Record</Text>
          </View>
          <Text className="text-blue-600 text-center">
            No team matches yet - team up for your first victory!
          </Text>
        </View>
      );
    }

    return (
      <View 
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-4 border border-blue-200"
        style={{
          shadowColor: "#3b82f6",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View className="flex-row items-center mb-4">
          <View className="bg-blue-100 p-2 rounded-full mr-3">
            <Ionicons name="people-outline" size={20} color="#3b82f6" />
          </View>
          <Text className="font-bold text-lg text-blue-800">Partnership Record</Text>
        </View>
        
        {/* Win rate circle or bar */}
        <View className="items-center mb-4">
          <View className="bg-white rounded-full p-4 shadow-sm">
            <Text className="text-3xl font-bold text-blue-600">
              {partnershipRecord.winPercentage}%
            </Text>
          </View>
          <Text className="text-blue-700 font-medium mt-2">Team Win Rate</Text>
        </View>

        {/* Detailed stats */}
        <View className="flex-row justify-between mb-4">
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-green-600">
              {partnershipRecord.wins}
            </Text>
            <Text className="text-xs text-gray-600">Wins</Text>
          </View>
          
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-gray-600">
              {partnershipRecord.totalMatches}
            </Text>
            <Text className="text-xs text-gray-600">Matches</Text>
          </View>
          
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-red-600">
              {partnershipRecord.losses}
            </Text>
            <Text className="text-xs text-gray-600">Losses</Text>
          </View>
        </View>

        {/* Sets record */}
        <View className="pt-4 border-t border-blue-200">
          <Text className="text-sm text-gray-600 text-center">
            Sets as partners: {partnershipRecord.setsWon}-{partnershipRecord.setsLost}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Recent Form Indicator
   */
  const renderRecentForm = () => {
    if (matchHistory.recentForm.length === 0) return null;

    return (
      <View 
        className="bg-card rounded-lg p-4 mb-4 border border-border/30"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }}
      >

        
        <View className="flex-row justify-center">
          {matchHistory.recentForm.map((result, index) => (
            <View
              key={index}
              className={`w-8 h-8 rounded-full mr-2 items-center justify-center ${
                result === 'W' ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <Text 
                className={`font-bold text-xs ${
                  result === 'W' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {result}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  /**
   * Enhanced Match History Summary Card
   */
  const renderMatchHistoryCard = () => {
    if (matchesLoading) {
      return (
        <View 
          className="bg-card rounded-lg p-6 mb-6 items-center border border-border/30"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <ActivityIndicator size="small" color="#1a7ebd" />
          <Text className="mt-2 text-muted-foreground">Loading match history...</Text>
        </View>
      );
    }

    if (matchHistory.allMatches.length === 0) {
      return (
        <View 
          className="bg-card rounded-lg p-6 mb-6 items-center border border-border/30"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <View className="bg-muted/30 p-4 rounded-full mb-4">
            <Ionicons name="tennisball-outline" size={36} color="#888" />
          </View>
          <Text className="mt-2 text-muted-foreground text-center font-medium">
            No matches played together yet
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Create your first match to start building history!
          </Text>
        </View>
      );
    }

    return (
      <View className="mb-6">
        <H3 className="mb-4">Match History</H3>
        
        {/* Head-to-Head Record */}
        {renderHeadToHeadCard()}
        
        {/* Partnership Record */}
        {renderPartnershipCard()}
        
        {/* Recent Form */}
        {renderRecentForm()}
        
        {/* Recent Matches Preview */}
        <View 
          className="bg-card rounded-lg p-4 border border-border/30"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-bold text-base">Recent Matches</Text>
            {matchHistory.allMatches.length > 3 && (
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: '/(protected)/(screens)/match-history',
                    params: { friendId: friendId as string }
                  });
                }}
              >
                <Text className="text-primary text-sm">View All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {matchHistory.allMatches.slice(0, 3).map(match => renderMatchItem(match))}
        </View>
      </View>
    );
  };

  /**
   * Enhanced Match Item Renderer with Better Visual Indicators
   */
  const renderMatchItem = (match: MatchData) => {
    const currentUserId = session?.user?.id;
    const isUserInTeam1 = match.player1_id === currentUserId || match.player2_id === currentUserId;
    const isFriendInTeam1 = match.player1_id === friendId || match.player2_id === friendId;
    const arePartners = (isUserInTeam1 && isFriendInTeam1) || (!isUserInTeam1 && !isFriendInTeam1);
    
    // Format match date
    const matchDate = new Date(match.start_time);
    const formattedDate = matchDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
    
    // Calculate if user won
    const userWon = (isUserInTeam1 && match.winner_team === 1) || (!isUserInTeam1 && match.winner_team === 2);
    
    // Calculate score to display
    let scoreDisplay = '';
    if (isUserInTeam1) {
      scoreDisplay = `${match.team1_score_set1}-${match.team2_score_set1}`;
      if (match.team1_score_set2 !== null) scoreDisplay += `, ${match.team1_score_set2}-${match.team2_score_set2}`;
      if (match.team1_score_set3 !== null) scoreDisplay += `, ${match.team1_score_set3}-${match.team2_score_set3}`;
    } else {
      scoreDisplay = `${match.team2_score_set1}-${match.team1_score_set1}`;
      if (match.team1_score_set2 !== null) scoreDisplay += `, ${match.team2_score_set2}-${match.team1_score_set2}`;
      if (match.team1_score_set3 !== null) scoreDisplay += `, ${match.team2_score_set3}-${match.team1_score_set3}`;
    }
    
    return (
      <TouchableOpacity 
        key={match.id}
        className="bg-background border border-border/40 rounded-lg p-3 mb-2"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }}
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { matchId: match.id }
          });
        }}
        activeOpacity={0.7}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <View className={`w-8 h-8 rounded-full ${
              arePartners 
                ? 'bg-blue-100' 
                : 'bg-orange-100'
            } items-center justify-center mr-3`}>
              <Ionicons 
                name={arePartners ? "people-outline" : "flash-outline"} 
                size={16} 
                color={arePartners ? "#3b82f6" : "#ea580c"} 
              />
            </View>
            <View>
              <Text className="font-medium">
                {arePartners ? 'Partners' : 'Rivals'}
              </Text>
              <Text className="text-xs text-muted-foreground">{formattedDate}</Text>
            </View>
          </View>
          
          <View className="items-end">
            <View className={`px-2 py-1 rounded-full ${
              userWon ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Text className={`text-xs font-bold ${
                userWon ? 'text-green-700' : 'text-red-700'
              }`}>
                {userWon ? 'WIN' : 'LOSS'}
              </Text>
            </View>
            <Text className="text-xs mt-1 text-muted-foreground">{scoreDisplay}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Enhanced Rating Comparison Card with Visual Rating Bar
   */
  const renderComparisonCard = () => {
    if (!currentUserProfile || !profile || !currentUserProfile.glicko_rating || !profile.glicko_rating) {
      return null;
    }
    
    const userRating = parseInt(currentUserProfile.glicko_rating);
    const friendRating = parseInt(profile.glicko_rating);
    const ratingDiff = userRating - friendRating;
    
    return (
      <View 
        className="bg-card rounded-lg p-4 mb-6 border border-border/30"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <H3 className="mb-4">Rating Comparison</H3>
        
        <View className="flex-row justify-between items-center mb-2">
          <View className="items-center flex-1">
            <Text className="text-lg font-bold">{userRating}</Text>
            <Text className="text-xs text-muted-foreground">Your Rating</Text>
          </View>
          
          <View className="items-center">
            <View className={`px-2 py-1 rounded-full ${ratingDiff > 0 ? 'bg-green-100' : (ratingDiff < 0 ? 'bg-red-100' : 'bg-gray-100')}`}>
              <Text className={`text-xs font-bold ${ratingDiff > 0 ? 'text-green-700' : (ratingDiff < 0 ? 'text-red-700' : 'text-gray-700')}`}>
                {ratingDiff > 0 ? `+${ratingDiff}` : ratingDiff}
              </Text>
            </View>
          </View>
          
          <View className="items-center flex-1">
            <Text className="text-lg font-bold">{friendRating}</Text>
            <Text className="text-xs text-muted-foreground">Their Rating</Text>
          </View>
        </View>
        
        {/* Rating bar visualization */}
        <View className="h-3 bg-gray-200 rounded-full mt-3 overflow-hidden">
          <View 
            className="h-full bg-primary"
            style={{ 
              width: `${Math.min(100, Math.max(0, (userRating / (userRating + friendRating)) * 100))}%` 
            }}
          />
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#1a7ebd" />
        <Text className="mt-4 text-muted-foreground">Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </Button>
          <H1>Profile Not Found</H1>
        </View>
        <View className="items-center mt-12">
          <View className="bg-muted/30 p-6 rounded-full mb-4">
            <Ionicons name="person-outline" size={48} color="#888" />
          </View>
          <Text className="text-muted-foreground text-center">
            Could not find the profile you're looking for.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1a7ebd"]}
            tintColor="#1a7ebd"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Header with Back Button */}
        <View className="pt-4 flex-row items-center">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </Button>
        </View>

        {/* Enhanced Profile Header with Avatar Integration */}
        <View className="pt-4 pb-6 px-6 items-center">
          <ProfileAvatar profile={profile} size="xl" />
          <H1 className="mb-1 text-center">{profile.full_name || 'Anonymous Player'}</H1>
          {profile.nickname && (
            <H2 className="text-muted-foreground text-center">"{profile.nickname}"</H2>
          )}
          <Text className="text-sm text-muted-foreground mt-2">{profile.email}</Text>
        </View> 

        {/* Enhanced Content Section */}
        <View className="px-6 pb-8">
          {/* Rating comparison */}
          {renderComparisonCard()}
          
          {/* Match History */}
          {renderMatchHistoryCard()}
          
          {/* Personal Info Section */}
          <H3 className="mb-4">Personal Information</H3>
          {renderInfoCard("Age", profile.age, "person-outline")}
          {renderInfoCard("Gender", profile.sex, "body-outline")}
          {renderInfoCard("Email", profile.email, "mail-outline")}

          {/* Playing Preferences Section */}
          <H3 className="mb-4 mt-6">Playing Preferences</H3>
          {renderInfoCard("Preferred Hand", profile.preferred_hand, "hand-left-outline")}
          {renderInfoCard("Court Position", profile.court_playing_side, "tennisball-outline")}
          {renderInfoCard("Preferred Area", profile.preferred_area, "location-outline")}

          {/* Enhanced Actions Section */}
          <View className="mt-8 mb-4">
            <Button
              className="w-full mb-4"
              size="default"
              variant="default"
              onPress={() => {
                router.push({
                  pathname: '/(protected)/(screens)/create-match',
                  params: { friendId: profile.id }
                });
              }}
              style={{
                shadowColor: "#1a7ebd",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <Ionicons name="tennisball-outline" size={20} style={{ marginRight: 8 }} />
              <Text>Play Together</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}