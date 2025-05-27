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
  asTeammates: MatchData[];
  asOpponents: MatchData[];
  allMatches: MatchData[];
  teammateStats: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  opponentStats: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
  };
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
    asTeammates: [],
    asOpponents: [],
    allMatches: [],
    teammateStats: { matches: 0, wins: 0, losses: 0, winRate: 0 },
    opponentStats: { matches: 0, wins: 0, losses: 0, winRate: 0 }
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
    const asTeammates: MatchData[] = [];
    const asOpponents: MatchData[] = [];
    
    let teammateWins = 0;
    let teammateMatches = 0;
    let opponentWins = 0;
    let opponentMatches = 0;

    matches.forEach(match => {
      const isUserInTeam1 = match.player1_id === currentUserId || match.player2_id === currentUserId;
      const isFriendInTeam1 = match.player1_id === friendId || match.player2_id === friendId;
      
      // If both in same team
      if ((isUserInTeam1 && isFriendInTeam1) || (!isUserInTeam1 && !isFriendInTeam1)) {
        asTeammates.push(match);
        teammateMatches++;
        
        // Check if their team won
        if ((isUserInTeam1 && match.winner_team === 1) || (!isUserInTeam1 && match.winner_team === 2)) {
          teammateWins++;
        }
      } else {
        asOpponents.push(match);
        opponentMatches++;
        
        // Check if current user won against friend
        if ((isUserInTeam1 && match.winner_team === 1) || (!isUserInTeam1 && match.winner_team === 2)) {
          opponentWins++;
        }
      }
    });

    return {
      asTeammates,
      asOpponents,
      allMatches: matches,
      teammateStats: {
        matches: teammateMatches,
        wins: teammateWins,
        losses: teammateMatches - teammateWins,
        winRate: teammateMatches > 0 ? Math.round((teammateWins / teammateMatches) * 100) : 0
      },
      opponentStats: {
        matches: opponentMatches,
        wins: opponentWins,
        losses: opponentMatches - opponentWins,
        winRate: opponentMatches > 0 ? Math.round((opponentWins / opponentMatches) * 100) : 0
      }
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
   * Enhanced Statistics Card Renderer with Improved Visual Hierarchy
   */
  const renderStatsCard = () => (
    <View 
      className="bg-card rounded-lg p-6 mb-6 border border-border/30"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <H3 className="mb-4">Player Statistics</H3>
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_rating ? parseInt(profile.glicko_rating).toString() : '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Glicko Rating</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_rd ? parseInt(profile.glicko_rd).toString() : '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Rating Deviation</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_vol || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Volatility</Text>
        </View>
      </View>
    </View>
  );

  /**
   * Enhanced Match History Card with Comprehensive Statistics Display
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
            Challenge them to your first match!
          </Text>
        </View>
      );
    }

    return (
      <View 
        className="bg-card rounded-lg p-6 mb-6 border border-border/30"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <H3 className="mb-4">Match History</H3>
        
        {/* Head-to-head Stats */}
        <View className="flex-row justify-between mb-4">
          <View className="items-center flex-1">
            <Text className="text-lg font-bold text-primary">
              {matchHistory.teammateStats.matches}
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              As Teammates
            </Text>
            <Text className="text-xs mt-1">
              {matchHistory.teammateStats.wins}W - {matchHistory.teammateStats.losses}L
            </Text>
            <Text className="text-xs font-medium text-primary">
              {matchHistory.teammateStats.winRate}% Win Rate
            </Text>
          </View>
          
          <View className="h-full w-px bg-border mx-2" />
          
          <View className="items-center flex-1">
            <Text className="text-lg font-bold text-primary">
              {matchHistory.opponentStats.matches}
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              As Opponents
            </Text>
            <Text className="text-xs mt-1">
              {matchHistory.opponentStats.wins}W - {matchHistory.opponentStats.losses}L
            </Text>
            <Text className="text-xs font-medium text-primary">
              {matchHistory.opponentStats.winRate}% Win Rate
            </Text>
          </View>
        </View>
        
        {/* Recent Matches */}
        <Text className="font-medium mt-4 mb-2">Recent Matches</Text>
        
        {matchHistory.allMatches.slice(0, 3).map(match => renderMatchItem(match))}
        
        {matchHistory.allMatches.length > 3 && (
          <Button
            variant="outline"
            className="mt-3"
            onPress={() => {
              router.push({
                pathname: '/(protected)/(screens)/match-history',
                params: { friendId: friendId as string }
              });
            }}
          >
            <Ionicons name="time-outline" size={16} style={{ marginRight: 6 }} />
            <Text>View All Matches</Text>
          </Button>
        )}
      </View>
    );
  };

  /**
   * Enhanced Match Item Renderer with Improved Visual Indicators
   */
  const renderMatchItem = (match: MatchData) => {
    const currentUserId = session?.user?.id;
    const isUserInTeam1 = match.player1_id === currentUserId || match.player2_id === currentUserId;
    const isFriendInTeam1 = match.player1_id === friendId || match.player2_id === friendId;
    const areTeammates = (isUserInTeam1 && isFriendInTeam1) || (!isUserInTeam1 && !isFriendInTeam1);
    
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
            <View className={`w-8 h-8 rounded-full ${areTeammates ? 'bg-blue-100' : 'bg-amber-100'} items-center justify-center mr-2`}>
              <Ionicons 
                name={areTeammates ? "people-outline" : "git-compare-outline"} 
                size={16} 
                color={areTeammates ? "#1d4ed8" : "#d97706"} 
              />
            </View>
            <Text className="font-medium">
              {areTeammates ? 'Teammates' : 'Opponents'}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">{formattedDate}</Text>
        </View>
        
        <View className="flex-row justify-between items-center mt-2">
          <Text className={`font-medium ${userWon ? 'text-green-600' : 'text-red-600'}`}>
            {userWon ? 'Win' : 'Loss'}
          </Text>
          <Text className="font-medium">{scoreDisplay}</Text>
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
        <View className="px-6 pt-4 flex-row items-center">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </Button>
          <Text className="text-lg font-medium">Friend Profile</Text>
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
          
          {/* Stats Card */}
          {renderStatsCard()}

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
              <Text>Challenge to Match</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}