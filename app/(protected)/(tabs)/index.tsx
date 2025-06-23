import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { H1, H2, H3 } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";
import { useNotifications } from '@/context/notification-provider';

// Enhanced match status enumeration with comprehensive coverage
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5,
  RECRUITING = 6,
}

// Comprehensive data interfaces for type safety
interface EnhancedMatchData {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  created_at: string;
  completed_at: string | null;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  is_public: boolean;
  description: string | null;
  player1?: any;
  player2?: any;
  player3?: any;
  player4?: any;
  // Computed properties
  needsScores?: boolean;
  isTeam1?: boolean;
  userWon?: boolean;
  setScores?: string;
  isCompleted?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
}

interface FriendActivity {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
  recentMatch?: any;
  ratingChange?: number;
}

interface UserStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  averageMatchDuration: number;
  recentPerformance: "improving" | "declining" | "stable";
  ratingChange7Days: number;
  ratingChange30Days: number;
}

/**
 * Advanced Universal Avatar Component for Dashboard Integration
 * Implements sophisticated image loading with comprehensive fallback mechanisms
 * Optimized for multiple avatar sizes and context-aware styling
 */
interface DashboardAvatarProps {
  user: {
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBorder?: boolean;
  borderColor?: string;
  showShadow?: boolean;
}

function DashboardAvatar({
  user,
  size = "md",
  showBorder = false,
  borderColor = "#2148ce",
  showShadow = false,
}: DashboardAvatarProps) {
  // State management for complex image loading lifecycle
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  // Comprehensive size configuration matrix for dashboard contexts
  const avatarSizeConfiguration = {
    xs: {
      containerClass: "w-6 h-6",
      imageStyle: { width: 24, height: 24, borderRadius: 12 },
      textClass: "text-xs",
      borderWidth: 1,
    },
    sm: {
      containerClass: "w-8 h-8",
      imageStyle: { width: 32, height: 32, borderRadius: 16 },
      textClass: "text-sm",
      borderWidth: 2,
    },
    md: {
      containerClass: "w-12 h-12",
      imageStyle: { width: 48, height: 48, borderRadius: 24 },
      textClass: "text-lg",
      borderWidth: 2,
    },
    lg: {
      containerClass: "w-16 h-16",
      imageStyle: { width: 64, height: 64, borderRadius: 32 },
      textClass: "text-xl",
      borderWidth: 3,
    },
    xl: {
      containerClass: "w-20 h-20",
      imageStyle: { width: 80, height: 80, borderRadius: 40 },
      textClass: "text-2xl",
      borderWidth: 4,
    },
  };

  const sizeConfig = avatarSizeConfiguration[size];

  /**
   * Advanced Fallback Character Extraction Algorithm
   * Implements comprehensive null-safety validation and character extraction
   * Priority: full_name -> email -> default fallback
   */
  const extractUserInitial = (): string => {
    if (!user) return "?";

    // Primary extraction path: full_name with comprehensive validation
    if (user.full_name?.trim()) {
      const sanitizedFullName = user.full_name.trim();
      if (sanitizedFullName.length > 0) {
        return sanitizedFullName.charAt(0).toUpperCase();
      }
    }

    // Secondary extraction path: email with validation
    if (user.email?.trim()) {
      const sanitizedEmail = user.email.trim();
      if (sanitizedEmail.length > 0) {
        return sanitizedEmail.charAt(0).toUpperCase();
      }
    }

    // Tertiary fallback: default character
    return "?";
  };

  /**
   * Avatar Image Availability Validation Logic
   * Implements comprehensive URL validation and error state verification
   */
  const shouldDisplayAvatarImage = (): boolean => {
    if (!user?.avatar_url) return false;

    const trimmedUrl = user.avatar_url.trim();
    return Boolean(
      trimmedUrl && // URL exists and not empty
        trimmedUrl.length > 0 && // URL has content
        !imageLoadError // No previous loading failures
    );
  };

  /**
   * Dynamic Container Styling with Context-Aware Enhancements
   */
  const getContainerStyle = () => {
    let baseStyle = {
      shadowColor: showShadow ? "#000" : "transparent",
      shadowOffset: showShadow
        ? { width: 0, height: 2 }
        : { width: 0, height: 0 },
      shadowOpacity: showShadow ? 0.1 : 0,
      shadowRadius: showShadow ? 4 : 0,
      elevation: showShadow ? 3 : 0,
    };

    if (showBorder) {
      baseStyle = {
        ...baseStyle,
        borderWidth: sizeConfig.borderWidth,
        borderColor: borderColor,
      };
    }

    return baseStyle;
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
    console.warn(`Dashboard avatar load failure:`, {
      userId: user?.id,
      userName: user?.full_name || user?.email,
      avatarUrl: user?.avatar_url,
      timestamp: new Date().toISOString(),
      component: "DashboardAvatar",
      context: "EnhancedHomeDashboard",
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
  if (shouldDisplayAvatarImage()) {
    return (
      <View
        className={`${sizeConfig.containerClass} rounded-full bg-primary items-center justify-center overflow-hidden`}
        style={getContainerStyle()}
      >
        <Image
          source={{ uri: user!.avatar_url! }}
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
              backgroundColor: "rgba(26, 126, 189, 0.85)",
            }}
          >
            <Text
              className={`${sizeConfig.textClass} font-bold text-primary-foreground`}
            >
              {extractUserInitial()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Enhanced Text Initial Fallback with Premium Visual Effects
  return (
    <View
      className={`${sizeConfig.containerClass} rounded-full bg-primary items-center justify-center`}
      style={getContainerStyle()}
    >
      <Text
        className={`${sizeConfig.textClass} font-bold text-primary-foreground`}
      >
        {extractUserInitial()}
      </Text>
    </View>
  );
}

/**
 * Enhanced User Header Avatar Component
 * Specialized for main dashboard header display with premium styling
 */
interface UserHeaderAvatarProps {
  profile: any;
}

function UserHeaderAvatar({ profile }: UserHeaderAvatarProps) {
  return (
    <DashboardAvatar
      user={profile}
      size="xl"
      showBorder={true}
      borderColor="#ffffff"
      showShadow={true}
    />
  );
}

/**
 * Multi-Player Avatar Stack Component for Match Cards
 * Displays overlapping avatars for team representation
 */
interface PlayerAvatarStackProps {
  players: Array<{
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null>;
  maxDisplay?: number;
  size?: "xs" | "sm" | "md";
}

function PlayerAvatarStack({
  players,
  maxDisplay = 3,
  size = "sm",
}: PlayerAvatarStackProps) {
  const validPlayers = players.filter(Boolean);
  const displayPlayers = validPlayers.slice(0, maxDisplay);
  const overflowCount = validPlayers.length - maxDisplay;

  const getOffsetStyle = (index: number) => ({
    marginLeft: index > 0 ? -8 : 0,
    zIndex: displayPlayers.length - index,
  });

  return (
    <View className="flex-row items-center">
      {displayPlayers.map((player, index) => (
        <View key={`${player?.id || index}`} style={getOffsetStyle(index)}>
          <DashboardAvatar
            user={player}
            size={size}
            showBorder={true}
            borderColor="#ffffff"
            showShadow={false}
          />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          className={`${size === "xs" ? "w-6 h-6" : size === "sm" ? "w-8 h-8" : "w-12 h-12"} rounded-full bg-gray-300 items-center justify-center ml-1`}
          style={{
            borderWidth: 2,
            borderColor: "#ffffff",
          }}
        >
          <Text
            className={`${size === "xs" ? "text-xs" : size === "sm" ? "text-xs" : "text-sm"} font-bold text-gray-600`}
          >
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function EnhancedHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allMatches, setAllMatches] = useState<EnhancedMatchData[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const { profile, session } = useAuth();
  const { hasPermission, requestPermission,sendTestNotification } = useNotifications();

useEffect(() => {
  // Request notification permission on first load
  if (!hasPermission) {
    setTimeout(() => {
      requestPermission();
    }, 2000); // Delay to not overwhelm user
  }
}, []);

  // Time-based match categorization - FIXED LOGIC
  const categorizedMatches = useMemo(() => {
    if (!allMatches.length)
      return {
        upcoming: [],
        needsAttention: [],
        recent: [],
        thisWeek: [],
        publicMatches: [],
      };

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log("🔍 Categorizing matches:", {
      totalMatches: allMatches.length,
      currentTime: now.toISOString(),
      weekAgo: weekAgo.toISOString(),
    });

    return {
      // FIXED: Future matches based on start_time, regardless of status
      upcoming: allMatches
        .filter((match) => {
          const startTime = new Date(match.start_time);
          const isFuture = startTime > now;
          console.log(`Match ${match.id} upcoming check:`, {
            startTime: startTime.toISOString(),
            isFuture,
            status: match.status,
          });
          return isFuture;
        })
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        .slice(0, 5),

      // FIXED: Past matches needing attention based on time, not status
      needsAttention: allMatches
        .filter((match) => {
          const startTime = new Date(match.start_time);
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const isPastMatch = endTime ? endTime < now : startTime < now;
          const hasNoScores =
            !match.team1_score_set1 && !match.team2_score_set1;
          const needsAttention =
            isPastMatch &&
            hasNoScores &&
            match.status !== MatchStatus.CANCELLED;

          console.log(`⚠️ Match ${match.id} attention check:`, {
            startTime: startTime.toISOString(),
            endTime: endTime?.toISOString(),
            isPastMatch,
            hasNoScores,
            needsAttention,
            status: match.status,
          });

          return needsAttention;
        })
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        ),

      // FIXED: Recent completed matches based on scores existence
      recent: allMatches
        .filter((match) => {
          const hasScores =
            match.team1_score_set1 !== null && match.team2_score_set1 !== null;
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const completedTime = match.completed_at
            ? new Date(match.completed_at)
            : null;
          const isCompleted = hasScores && (endTime || completedTime);

          console.log(`🏆 Match ${match.id} recent check:`, {
            hasScores,
            endTime: endTime?.toISOString(),
            completedTime: completedTime?.toISOString(),
            isCompleted,
          });

          return isCompleted;
        })
        .sort((a, b) => {
          const dateA = new Date(a.completed_at || a.end_time || a.start_time);
          const dateB = new Date(b.completed_at || b.end_time || b.start_time);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5),

      // FIXED: This week's completed matches
      thisWeek: allMatches.filter((match) => {
        const hasScores =
          match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const matchDate = new Date(
          match.completed_at || match.end_time || match.start_time
        );
        const isThisWeek = matchDate >= weekAgo && hasScores;

        console.log(`📊 Match ${match.id} this week check:`, {
          matchDate: matchDate.toISOString(),
          isThisWeek,
          hasScores,
          weekAgo: weekAgo.toISOString(),
        });

        return isThisWeek;
      }),

      // Public recruiting matches
      publicMatches: allMatches
        .filter((match) => {
          const startTime = new Date(match.start_time);
          return match.is_public && startTime > now;
        })
        .slice(0, 3),
    };
  }, [allMatches]);

  // FIXED: Enhanced statistics calculation with proper win/loss logic
  const calculateUserStats = useMemo((): UserStats => {
    if (!allMatches.length || !session?.user?.id) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageMatchDuration: 0,
        recentPerformance: "stable",
        ratingChange7Days: 0,
        ratingChange30Days: 0,
      };
    }

    // FIXED: Filter completed matches with scores
    const completedMatches = allMatches
      .filter((match) => {
        const hasScores =
          match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        console.log(`📈 Stats calculation for match ${match.id}:`, {
          hasScores,
          team1_set1: match.team1_score_set1,
          team2_set1: match.team2_score_set1,
          winner_team: match.winner_team,
        });
        return hasScores;
      })
      .sort((a, b) => {
        // Sort by completion time for proper streak calculation
        const dateA = new Date(a.completed_at || a.end_time || a.start_time);
        const dateB = new Date(b.completed_at || b.end_time || b.start_time);
        return dateA.getTime() - dateB.getTime(); // Ascending order for streak calculation
      });

    console.log("📊 Completed matches for stats:", completedMatches.length);

    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let totalDuration = 0;
    let matchesWithDuration = 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let recentWins = 0;
    let recentMatches = 0;
    let olderWins = 0;
    let olderMatches = 0;

    // Process each completed match
    completedMatches.forEach((match, index) => {
      // FIXED: Determine user team correctly
      const isTeam1 =
        match.player1_id === session.user.id ||
        match.player2_id === session.user.id;

      // FIXED: Determine winner using set-based logic when winner_team is not reliable
      let userWon = false;

      if (match.winner_team) {
        // Use winner_team if available
        userWon =
          (isTeam1 && match.winner_team === 1) ||
          (!isTeam1 && match.winner_team === 2);
      } else {
        // FIXED: Calculate winner based on sets won
        let team1Sets = 0;
        let team2Sets = 0;

        // Count sets won by each team
        if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
        else if (match.team2_score_set1 > match.team1_score_set1) team2Sets++;

        if (
          match.team1_score_set2 !== null &&
          match.team2_score_set2 !== null
        ) {
          if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
          else if (match.team2_score_set2 > match.team1_score_set2) team2Sets++;
        }

        if (
          match.team1_score_set3 !== null &&
          match.team2_score_set3 !== null
        ) {
          if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
          else if (match.team2_score_set3 > match.team1_score_set3) team2Sets++;
        }

        // Determine winner based on sets
        if (team1Sets > team2Sets) {
          userWon = isTeam1;
        } else if (team2Sets > team1Sets) {
          userWon = !isTeam1;
        }
      }

      console.log(`🎯 Match ${match.id} result:`, {
        isTeam1,
        winner_team: match.winner_team,
        userWon,
        sets: `${match.team1_score_set1}-${match.team2_score_set1}, ${match.team1_score_set2}-${match.team2_score_set2}`,
      });

      const matchDate = new Date(
        match.completed_at || match.end_time || match.start_time
      );

      // Calculate recent vs older performance for trend analysis
      if (matchDate >= sevenDaysAgo) {
        recentMatches++;
        if (userWon) recentWins++;
      } else if (matchDate >= thirtyDaysAgo) {
        olderMatches++;
        if (userWon) olderWins++;
      }

      // Update win/loss counts
      if (userWon) {
        wins++;
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else {
        losses++;
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }

      // Track longest streak
      if (Math.abs(currentStreak) > Math.abs(longestStreak)) {
        longestStreak = currentStreak;
      }

      // Calculate duration if both start and end times exist
      if (match.start_time && match.end_time) {
        const duration =
          new Date(match.end_time).getTime() -
          new Date(match.start_time).getTime();
        totalDuration += duration;
        matchesWithDuration++;
      }
    });

    // Determine performance trend
    let recentPerformance: "improving" | "declining" | "stable" = "stable";
    if (recentMatches >= 2 && olderMatches >= 2) {
      const recentWinRate = recentWins / recentMatches;
      const olderWinRate = olderWins / olderMatches;
      if (recentWinRate > olderWinRate + 0.1) {
        recentPerformance = "improving";
      } else if (recentWinRate < olderWinRate - 0.1) {
        recentPerformance = "declining";
      }
    }

    const finalStats = {
      totalMatches: wins + losses,
      wins,
      losses,
      winRate:
        wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      currentStreak,
      longestStreak,
      averageMatchDuration:
        matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0,
      recentPerformance,
      ratingChange7Days: 0, // TODO: Calculate from rating history
      ratingChange30Days: 0, // TODO: Calculate from rating history
    };

    console.log("📊 Final calculated stats:", finalStats);
    return finalStats;
  }, [allMatches, session?.user?.id]);

  // Data fetching with comprehensive friend activity
  useEffect(() => {
    if (session?.user?.id) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      console.log("🚀 Fetching dashboard data for user:", session?.user?.id);

      // Fetch user matches with enhanced player information
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `
        )
        .or(
          `player1_id.eq.${session?.user?.id},player2_id.eq.${session?.user?.id},player3_id.eq.${session?.user?.id},player4_id.eq.${session?.user?.id}`
        )
        .order("start_time", { ascending: false });

      if (matchError) {
        console.error("❌ Match fetch error:", matchError);
        throw matchError;
      }

      console.log("📊 Raw match data received:", {
        count: matchData?.length || 0,
        sampleMatch: matchData?.[0],
      });

      // FIXED: Process match data with enhanced computed properties
      const processedMatches = (matchData || []).map((match) => {
        const now = new Date();
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;

        // FIXED: Time-based classifications
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const isCompleted =
          match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const needsScores =
          isPast && !isCompleted && match.status !== MatchStatus.CANCELLED;

        const isTeam1 =
          match.player1_id === session?.user?.id ||
          match.player2_id === session?.user?.id;

        // FIXED: Determine user victory using sets logic
        let userWon = false;
        if (isCompleted) {
          if (match.winner_team) {
            userWon =
              (isTeam1 && match.winner_team === 1) ||
              (!isTeam1 && match.winner_team === 2);
          } else {
            // Calculate winner based on sets
            let team1Sets = 0;
            let team2Sets = 0;

            if (match.team1_score_set1 > match.team2_score_set1) team1Sets++;
            else if (match.team2_score_set1 > match.team1_score_set1)
              team2Sets++;

            if (
              match.team1_score_set2 !== null &&
              match.team2_score_set2 !== null
            ) {
              if (match.team1_score_set2 > match.team2_score_set2) team1Sets++;
              else if (match.team2_score_set2 > match.team1_score_set2)
                team2Sets++;
            }

            if (
              match.team1_score_set3 !== null &&
              match.team2_score_set3 !== null
            ) {
              if (match.team1_score_set3 > match.team2_score_set3) team1Sets++;
              else if (match.team2_score_set3 > match.team1_score_set3)
                team2Sets++;
            }

            if (team1Sets > team2Sets) {
              userWon = isTeam1;
            } else if (team2Sets > team1Sets) {
              userWon = !isTeam1;
            }
          }
        }

        // Create readable set scores
        let setScores = "";
        if (
          match.team1_score_set1 !== null &&
          match.team2_score_set1 !== null
        ) {
          const userSet1 = isTeam1
            ? match.team1_score_set1
            : match.team2_score_set1;
          const oppSet1 = isTeam1
            ? match.team2_score_set1
            : match.team1_score_set1;
          setScores = `${userSet1}-${oppSet1}`;

          if (
            match.team1_score_set2 !== null &&
            match.team2_score_set2 !== null
          ) {
            const userSet2 = isTeam1
              ? match.team1_score_set2
              : match.team2_score_set2;
            const oppSet2 = isTeam1
              ? match.team2_score_set2
              : match.team1_score_set2;
            setScores += `, ${userSet2}-${oppSet2}`;

            if (
              match.team1_score_set3 !== null &&
              match.team2_score_set3 !== null
            ) {
              const userSet3 = isTeam1
                ? match.team1_score_set3
                : match.team2_score_set3;
              const oppSet3 = isTeam1
                ? match.team2_score_set3
                : match.team1_score_set3;
              setScores += `, ${userSet3}-${oppSet3}`;
            }
          }
        }

        const processedMatch = {
          ...match,
          needsScores,
          isTeam1,
          userWon,
          setScores,
          isCompleted,
          isFuture,
          isPast,
        };

        console.log(`🔄 Processed match ${match.id}:`, {
          needsScores,
          isTeam1,
          userWon,
          isCompleted,
          isFuture,
          isPast,
          setScores,
        });

        return processedMatch;
      });

      setAllMatches(processedMatches);

      // Fetch friends activity
      if (profile?.friends_list && profile.friends_list.length > 0) {
        const { data: friendsData, error: friendsError } = await supabase
          .from("profiles")
          .select("id, full_name, email, glicko_rating, avatar_url")
          .in("id", profile.friends_list);

        if (!friendsError && friendsData) {
          setFriendsActivity(friendsData.slice(0, 5));
        }
      }
    } catch (error) {
      console.error("💥 Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update user stats when matches change
  useEffect(() => {
    setUserStats(calculateUserStats);
  }, [calculateUserStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Navigation handlers with enhanced routing
  const handleMatchAction = (match: EnhancedMatchData) => {
    if (match.needsScores) {
      router.push({
        pathname: "/(protected)/(screens)/match-details",
        params: { matchId: match.id, mode: "score-entry" },
      });
    } else {
      router.push({
        pathname: "/(protected)/(screens)/match-details",
        params: { matchId: match.id },
      });
    }
  };

  // Quick action handlers
  const handleCreateMatch = () => {
    router.push("/(protected)/(screens)/create-match");
  };

  const handleViewLeaderboard = () => {
    router.push("/(protected)/(screens)/leaderboard");
  };

  const handleViewFriends = () => {
    router.push("/(protected)/(screens)/friends");
  };

  const handleViewAllMatches = () => {
    router.push("/(protected)/(screens)/match-history");
  };

/**
   * Dynamic Emoji Selection Based on Player Performance
   * Analyzes multiple statistics to provide contextual greeting emojis
   */
const getPlayerStatusEmoji = (): string => {
  if (!userStats) return "👋";

  const { currentStreak, winRate, totalMatches, recentPerformance } = userStats;

  // 🔥 LEGENDARY PERFORMANCE (5+ win streak)
  if (currentStreak >= 5) {
    return "🔥"; // On fire!
  }

  // ⚡ HOT STREAK (3-4 wins)
  if (currentStreak >= 3) {
    return "⚡"; // Lightning performance
  }

  // 💪 WINNING MOMENTUM (1-2 wins)
  if (currentStreak >= 1) {
    return totalMatches >= 10 && winRate >= 70 ? "🏆" : "💪"; // Trophy for seasoned winners, muscle for momentum
  }

  // 🤔 ANALYZING PHASE (no streak but decent stats)
  if (currentStreak === 0) {
    if (winRate >= 60) return "🎯"; // Good aim, consistent player
    if (recentPerformance === "improving") return "📈"; // Trending up
    if (totalMatches < 3) return "🌟"; // New star player
    return "🤔"; // Thinking, planning next move
  }

  // 😤 DETERMINATION MODE (1-2 losses)
  if (currentStreak >= -2) {
    return recentPerformance === "improving" ? "💡" : "😤"; // Light bulb for improvement, determined face for grinding
  }

  // 😰 ROUGH PATCH (3-4 losses)
  if (currentStreak >= -4) {
    return "😰"; // Worried but still fighting
  }

  // 🔄 COMEBACK TIME (5+ losses)
  if (currentStreak <= -5) {
    return "🔄"; // Time for a comeback/reset
  }

  // 🚀 ROOKIE ENERGY (very few matches played)
  if (totalMatches === 0) {
    return "🚀"; // Ready to launch career
  }

  if (totalMatches < 5) {
    return "🌟"; // Rising star
  }

  // 👋 DEFAULT FRIENDLY GREETING
  return "👋";
};

/**
 * Get contextual status message based on player performance
 */
const getPlayerStatusMessage = (): string => {
  if (!userStats) return "";

  const { currentStreak, winRate, totalMatches, recentPerformance } = userStats;

  if (currentStreak >= 5) return "You're absolutely unstoppable!";
  if (currentStreak >= 3) return "What a streak you're on!";
  if (currentStreak >= 1) return "Keep that momentum going!";
  if (currentStreak === 0 && winRate >= 70) return "Consistent champion!";
  if (currentStreak === 0 && recentPerformance === "improving") return "Getting better every match!";
  if (currentStreak >= -2 && recentPerformance === "improving") return "Your comeback starts now!";
  if (currentStreak >= -2) return "Time to turn things around!";
  if (currentStreak >= -4) return "Every champion faces challenges!";
  if (currentStreak <= -5) return "Your biggest comeback awaits!";
  if (totalMatches === 0) return "Ready to start your journey!";
  if (totalMatches < 5) return "Welcome to the courts!";
  return "Great to see you back!";
};

// Component: Enhanced User Header with Avatar and Quick Stats
const renderUserHeader = () => (
  <View className="mb-6 p-4 pt-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
    <View className="flex-row items-center mb-4">
      <View className="flex-1">
        <Text className="text-4xl font-bold">
          {getPlayerStatusEmoji()} {profile?.full_name?.split(" ")[0] || "Player"}
        </Text>
        {userStats && (
          <Text className="text-sm text-muted-foreground mt-1 italic">
            {getPlayerStatusMessage()}
          </Text>
        )}
      </View>
    </View>

      {/* Quick Stats Row */}
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-lg font-bold text-primary">
            {profile?.glicko_rating
              ? Math.round(parseFloat(profile.glicko_rating))
              : "-"}
          </Text>
          <Text className="text-xs text-muted-foreground">Current Rating</Text>
        </View>
        <View className="items-center">
          <Text className="text-lg font-bold">{userStats?.winRate || 0}%</Text>
          <Text className="text-xs text-muted-foreground">Win Rate</Text>
        </View>
        <View className="items-center">
          <Text className="text-lg font-bold">
            {categorizedMatches.thisWeek.length}
          </Text>
          <Text className="text-xs text-muted-foreground">This Week</Text>
        </View>
        <View className="items-center">
          <Text
            className={`text-lg font-bold ${
              userStats?.currentStreak && userStats.currentStreak > 0
                ? "text-green-500"
                : userStats?.currentStreak && userStats.currentStreak < 0
                  ? "text-red-500"
                  : ""
            }`}
          >
            {userStats?.currentStreak || 0}
          </Text>
          <Text className="text-xs text-muted-foreground">Streak</Text>
        </View>
      </View>
    </View>
  );

  // ENHANCEMENT: Visibility Badge Component for Match Visibility Indicator
  const renderVisibilityBadge = (isPublic: boolean) => {
    return (
      <View
        className={`flex-row items-center  rounded-full ${
          isPublic
            ? "bg-blue-100 dark:bg-blue-900/30"
            : "bg-gray-100 dark:bg-gray-800/50"
        }`}
      >
        <Ionicons
          name={isPublic ? "globe-outline" : "lock-closed-outline"}
          size={12}
          color={isPublic ? "#2563eb" : "#6b7280"}
          style={{ marginRight: 4 }}
        />
        <Text
          className={`text-xs font-medium ${
            isPublic
              ? "text-blue-700 dark:text-blue-300"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          {isPublic ? "Public" : "Private"}
        </Text>
      </View>
    );
  };

  // Component: Enhanced Match Card with Rich Information INCLUDING VISIBILITY INDICATOR AND AVATARS
  const renderMatchCard = (
    match: EnhancedMatchData,
    type: "upcoming" | "attention" | "recent"
  ) => {
    const startTime = new Date(match.start_time);
    const formattedDate = startTime.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const formattedTime = startTime.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const teammate = match.isTeam1
      ? match.player1_id === session?.user?.id
        ? match.player2
        : match.player1
      : match.player3_id === session?.user?.id
        ? match.player4
        : match.player3;

    const opponents = match.isTeam1
      ? [match.player3, match.player4]
      : [match.player1, match.player2];

    const isCreator = match.player1_id === session?.user?.id;

    const getBgColor = () => {
      if (type === "upcoming") return "bg-blue-50 dark:bg-blue-900/30";
      if (type === "attention") return "bg-amber-50 dark:bg-amber-900/30";
      if (match.userWon) return "bg-green-50 dark:bg-green-900/30";
      return "bg-red-50 dark:bg-red-900/30";
    };

    const getStatusInfo = () => {
      if (type === "upcoming")
        return { icon: "calendar-outline", color: "#2563eb", text: "Upcoming" };
      if (type === "attention") {
        if (match.needsScores)
          return {
            icon: "create-outline",
            color: "#d97706",
            text: "Add Scores",
          };
        return {
          icon: "alert-circle-outline",
          color: "#d97706",
          text: "Needs Confirmation",
        };
      }
      if (match.userWon)
        return { icon: "trophy-outline", color: "#059669", text: "Victory" };
      return {
        icon: "trending-down-outline",
        color: "#dc2626",
        text: "Defeat",
      };
    };

    const statusInfo = getStatusInfo();

    return (
      <TouchableOpacity
        key={match.id}
        className={`mb-3 p-4 rounded-xl ${getBgColor()} border border-border/30`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
        onPress={() => handleMatchAction(match)}
        activeOpacity={0.7}
      >
        {/* ENHANCED Header with Status, Time, AND VISIBILITY INDICATOR */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center flex-1">
            {/* VISIBILITY BADGE - Positioned after status text */}
            <View className="">
              {renderVisibilityBadge(match.is_public)}
            </View>

          </View>
          <View className="items-end">
            <Text className="text-sm font-medium">{formattedDate}</Text>
          </View>
        </View>

        {/* Location Info with Enhanced Layout */}


        {/* ENHANCED Team Composition with Avatar Integration */}
        <View className="mb-3">
          <View className="flex-row items-center justify-between mb-2">
            {/* Your Team Section with Avatar */}
            <View className="flex-row items-center flex-1">
              <View className="mr-2">
                <PlayerAvatarStack
                  players={[
                    profile, // Current user
                    teammate, // Teammate
                  ]}
                  maxDisplay={2}
                  size="sm"
                />
              </View>
              {/* MODIFICATION 1: Add flex-1 to this View */}
              <View className="flex-1">
                {/* MODIFICATION 2: Add numberOfLines to this Text */}
                <Text className="font-medium text-sm" numberOfLines={2}>
                  You{" "}
                  {teammate
                    ? `& ${teammate.full_name || teammate.email.split("@")[0]}`
                    : ""}
                </Text>
              </View>
            </View>

            {/* VS Indicator */}
            <View className="mx-3">
              <Text className="text-muted-foreground font-medium">vs</Text>
            </View>

            {/* Opponent Team Section with Avatar */}
            <View className="flex-row items-center flex-1 justify-end">
              {/* MODIFICATION 3: Add flex-1 to this View */}
              <View className="flex-1 mr-2"> 
                {/* MODIFICATION 4: Add numberOfLines to this Text */}
                <Text className="text-right font-medium text-sm" numberOfLines={2}>
                  {opponents
                    .filter(Boolean)
                    .map(
                      (p) => p?.full_name || p?.email?.split("@")[0] || "TBD"
                    )
                    .join(" & ")}
                </Text>
              </View>
              <PlayerAvatarStack players={opponents} maxDisplay={2} size="sm" />
            </View>
          </View>
          </View>
        {/* Score Display with Enhanced Visibility Context */}
        {match.setScores ? (
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center">
              <Text className="text-sm font-medium mr-2">Score:</Text>
              <Text className="text-sm font-mono">{match.setScores}</Text>
            </View>
            {type === "recent" && (
              <View
                className={`px-2 py-1 rounded-full ${
                  match.userWon
                    ? "bg-green-100 dark:bg-green-900/40"
                    : "bg-red-100 dark:bg-red-900/40"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    match.userWon
                      ? "text-green-800 dark:text-green-300"
                      : "text-red-800 dark:text-red-300"
                  }`}
                >
                  {match.userWon ? "Victory" : "Defeat"}
                </Text>
              </View>
            )}
          </View>
        ) : type === "attention" ? (
          <Button
            size="sm"
            variant="default"
            className="mt-2 w-full"
            onPress={() => handleMatchAction(match)}
          >
            <Ionicons
              name="create-outline"
              size={14}
              style={{ marginRight: 6 }}
            />
            <Text className="text-5xl text-primary-foreground">
              {match.needsScores ? "Enter Scores" : "View Details"}
            </Text>
          </Button>
        ) : null} 
               
      </TouchableOpacity>
      
    );
  };

  // Component: Enhanced Friends Activity Section with Avatar Integration
  const renderFriendsActivity = () => {
    if (!friendsActivity.length) return null;

    return (
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-3">
          <H3>Friends Activity</H3>
          <TouchableOpacity
            onPress={handleViewFriends}
            className="flex-row items-center"
          >
            <Text className="text-primary text-sm mr-1">See All</Text>
            <Ionicons name="chevron-forward" size={14} color="#2148ce" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {friendsActivity.map((friend, index) => (
            <TouchableOpacity
              key={friend.id}
              className="bg-card rounded-xl p-4 mr-3 w-32 border border-border/30"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              }}
              onPress={() =>
                router.push({
                  pathname: "/(protected)/(screens)/friend-profile",
                  params: { friendId: friend.id },
                })
              }
              activeOpacity={0.7}
            >
              {/* Enhanced Friend Avatar */}
              <View className="items-center mb-2">
                <DashboardAvatar user={friend} size="lg" showShadow={true} />
              </View>

              <Text
                className="text-sm font-medium text-center"
                numberOfLines={1}
              >
                {friend.full_name || friend.email.split("@")[0]}
              </Text>
              <Text className="text-xs text-muted-foreground text-center">
                Rating:{" "}
                {friend.glicko_rating
                  ? Math.round(parseFloat(friend.glicko_rating))
                  : "-"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Loading state with enhanced UI
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#2148ce" />
          <Text className="mt-4 text-muted-foreground">
            Loading your dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2148ce"
            colors={["#2148ce"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced User Header with Avatar Integration */}
        {renderUserHeader()}

        {/* Priority: Matches Needing Attention */}
        {categorizedMatches.needsAttention.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>Needs Attention</H2>
              <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                <Text className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {categorizedMatches.needsAttention.length}
                </Text>
              </View>
            </View>

            {categorizedMatches.needsAttention.map((match) =>
              renderMatchCard(match, "attention")
            )}
          </View>
        )}

        {/* Upcoming Matches with Enhanced Avatar Display */}
        {categorizedMatches.upcoming.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>Upcoming Matches</H2>
              {categorizedMatches.upcoming.length >= 3 && (
                <TouchableOpacity
                  onPress={handleViewAllMatches}
                  className="flex-row items-center"
                >
                  <Text className="text-primary text-sm mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={14} color="#2148ce" />
                </TouchableOpacity>
              )}
            </View>

            {categorizedMatches.upcoming
              .slice(0, 3)
              .map((match) => renderMatchCard(match, "upcoming"))}
          </View>
        )}

        {/* Recent Matches with Enhanced Avatar Display */}
        {categorizedMatches.recent.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>Recent Matches</H2>
              <TouchableOpacity
                onPress={handleViewAllMatches}
                className="flex-row items-center"
              >
                <Text className="text-primary text-sm mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={14} color="#2148ce" />
              </TouchableOpacity>
            </View>

            {categorizedMatches.recent
              .slice(0, 3)
              .map((match) => renderMatchCard(match, "recent"))}
          </View>
        )}

        {/* Enhanced Empty State with Avatar-Aware Onboarding */}
        {allMatches.length === 0 && (
          <View
            className="bg-card rounded-xl p-8 items-center border border-border/30"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
              <Ionicons name="tennisball-outline" size={40} color="#2148ce" />
            </View>
            <Text className="text-xl font-bold mb-2">
              Welcome to Padel Scoring!
            </Text>
            <Text className="text-muted-foreground text-center mb-6 leading-5">
              Start your padel journey by creating your first match or
              connecting with friends. Your avatar and match history will appear
              here as you play.
            </Text>

            <View className="w-full gap-3">
              <Button
                variant="default"
                onPress={handleCreateMatch}
                className="w-full"
                style={{
                  shadowColor: "#2148ce",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
                <Text>Create Your First Match</Text>
              </Button>

              <Button
                variant="outline"
                onPress={handleViewFriends}
                className="w-full"
              >
                <Ionicons name="people" size={18} style={{ marginRight: 8 }} />
                <Text>Find Friends to Play With</Text>
              </Button>
            </View>
          </View>
        )}

        {/* Enhanced Friends Activity with Avatar Integration */}
        {renderFriendsActivity()}

        <Button onPress={sendTestNotification}>
  <Text>Test Notification</Text>
</Button>
      </ScrollView>

      {/* Enhanced Floating Action Button for Quick Match Creation */}
      <TouchableOpacity
        onPress={handleCreateMatch}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{
          shadowColor: "#2148ce",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>


    </SafeAreaView>
  );
}
