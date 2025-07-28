import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";

// Enhanced match status enumeration
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5,
  RECRUITING = 6,
}

// Complete match data interface
interface MatchData {
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
  validation_status?: string;
  all_confirmed?: boolean;
  confirmation_status?: string;
  rating_applied?: boolean;
  player1?: any;
  player2?: any;
  player3?: any;
  player4?: any;
  
  // Computed properties
  isTeam1?: boolean;
  userWon?: boolean;
  setScores?: string;
  isCompleted?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  needsScores?: boolean;
  needsConfirmation?: boolean;
  isDisputed?: boolean;
  teammate?: any;
  opponents?: any[];
  team1Sets?: number;
  team2Sets?: number;
}

// Enhanced user stats
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
  publicMatches: number;
  privateMatches: number;
  needsConfirmation: number;
  disputed: number;
}

// Friend activity interface
interface FriendActivity {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
  recentMatch?: any;
  ratingChange?: number;
  lastActive?: string;
}

// Enhanced Avatar Component with error handling and loading states
interface AvatarProps {
  user: {
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBorder?: boolean;
  borderColor?: string;
  showShadow?: boolean;
  isCurrentUser?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ 
  user, 
  size = 'md', 
  showBorder = false,
  borderColor = "#3B82F6",
  showShadow = false,
  isCurrentUser = false
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeConfig = {
    xs: { width: 24, height: 24, borderRadius: 12, textClass: 'text-xs', borderWidth: 1 },
    sm: { width: 32, height: 32, borderRadius: 16, textClass: 'text-sm', borderWidth: 2 },
    md: { width: 40, height: 40, borderRadius: 20, textClass: 'text-base', borderWidth: 2 },
    lg: { width: 48, height: 48, borderRadius: 24, textClass: 'text-lg', borderWidth: 3 },
    xl: { width: 64, height: 64, borderRadius: 32, textClass: 'text-xl', borderWidth: 4 }
  }[size];

  if (!user) {
    return (
      <View 
        className="bg-gray-300 dark:bg-gray-600 items-center justify-center" 
        style={{
          width: sizeConfig.width,
          height: sizeConfig.height,
          borderRadius: sizeConfig.borderRadius,
          borderWidth: showBorder ? sizeConfig.borderWidth : 0,
          borderColor: showBorder ? borderColor : 'transparent'
        }}
      >
        <Text className={`${sizeConfig.textClass} text-gray-600 dark:text-gray-300 font-bold`}>?</Text>
      </View>
    );
  }

  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const containerStyle = {
    width: sizeConfig.width,
    height: sizeConfig.height,
    borderRadius: sizeConfig.borderRadius,
    borderWidth: showBorder ? sizeConfig.borderWidth : 0,
    borderColor: showBorder ? borderColor : 'transparent',
    shadowColor: showShadow ? "#000" : "transparent",
    shadowOffset: showShadow ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: showShadow ? 0.1 : 0,
    shadowRadius: showShadow ? 4 : 0,
    elevation: showShadow ? 3 : 0,
  };

  if (user.avatar_url && !imageError) {
    return (
      <View className="relative">
        <Image
          source={{ uri: user.avatar_url }}
          style={containerStyle}
          resizeMode="cover"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
          onLoadStart={() => setImageLoading(true)}
        />
        {imageLoading && (
          <View 
            className="absolute inset-0 bg-blue-500 items-center justify-center"
            style={{ borderRadius: sizeConfig.borderRadius }}
          >
            <Text className={`${sizeConfig.textClass} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}
        {isCurrentUser && (
          <View className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 items-center justify-center border-2 border-white">
            <Ionicons name="checkmark" size={8} color="white" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View 
      className="bg-blue-500 items-center justify-center relative" 
      style={containerStyle}
    >
      <Text className={`${sizeConfig.textClass} font-bold text-white`}>
        {getInitial()}
      </Text>
      {isCurrentUser && (
        <View className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 items-center justify-center border-2 border-white">
          <Ionicons name="checkmark" size={8} color="white" />
        </View>
      )}
    </View>
  );
};

// Multi-Player Avatar Stack Component
interface PlayerAvatarStackProps {
  players: Array<{
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null>;
  maxDisplay?: number;
  size?: 'xs' | 'sm' | 'md';
  currentUserId?: string;
}

const PlayerAvatarStack: React.FC<PlayerAvatarStackProps> = ({
  players,
  maxDisplay = 3,
  size = 'sm',
  currentUserId
}) => {
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
          <Avatar
            user={player}
            size={size}
            showBorder={true}
            borderColor="#ffffff"
            isCurrentUser={player?.id === currentUserId}
          />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          className={`${
            size === 'xs' ? 'w-6 h-6' : size === 'sm' ? 'w-8 h-8' : 'w-12 h-12'
          } rounded-full bg-gray-300 dark:bg-gray-600 items-center justify-center ml-1`}
          style={{
            borderWidth: 2,
            borderColor: "#ffffff",
          }}
        >
          <Text
            className={`${
              size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-xs' : 'text-sm'
            } font-bold text-gray-600 dark:text-gray-300`}
          >
            +{overflowCount}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function EnhancedCleanDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const { profile, session } = useAuth();

  // Enhanced user stats calculation
  const userStats = useMemo((): UserStats => {
    if (!matches.length || !session?.user?.id) {
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
        publicMatches: 0,
        privateMatches: 0,
        needsConfirmation: 0,
        disputed: 0,
      };
    }

    const completedMatches = matches
      .filter(match => 
        match.team1_score_set1 !== null && match.team2_score_set1 !== null
      )
      .sort((a, b) => 
        new Date(a.completed_at || a.end_time || a.start_time).getTime() - 
        new Date(b.completed_at || b.end_time || b.start_time).getTime()
      );

    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let totalDuration = 0;
    let matchesWithDuration = 0;
    let publicMatches = 0;
    let privateMatches = 0;
    let needsConfirmation = 0;
    let disputed = 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let recentWins = 0;
    let recentMatches = 0;
    let olderWins = 0;
    let olderMatches = 0;

    matches.forEach(match => {
      // Count match types
      if (match.is_public) publicMatches++;
      else privateMatches++;

      // Count confirmation status
      if (match.needsConfirmation) needsConfirmation++;
      if (match.isDisputed) disputed++;
    });

    completedMatches.forEach((match, index) => {
      const isTeam1 = match.player1_id === session.user.id || 
                     match.player2_id === session.user.id;

      let userWon = false;

      if (match.winner_team) {
        userWon = (isTeam1 && match.winner_team === 1) || 
                 (!isTeam1 && match.winner_team === 2);
      } else {
        let team1Sets = 0;
        let team2Sets = 0;

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

        userWon = (isTeam1 && team1Sets > team2Sets) || 
                 (!isTeam1 && team2Sets > team1Sets);
      }

      const matchDate = new Date(match.completed_at || match.end_time || match.start_time);

      // Calculate recent vs older performance
      if (matchDate >= sevenDaysAgo) {
        recentMatches++;
        if (userWon) recentWins++;
      } else if (matchDate >= thirtyDaysAgo) {
        olderMatches++;
        if (userWon) olderWins++;
      }

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

      // Calculate duration
      if (match.start_time && match.end_time) {
        const duration = new Date(match.end_time).getTime() - 
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

    return {
      totalMatches: wins + losses,
      wins,
      losses,
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      currentStreak,
      longestStreak,
      averageMatchDuration: matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0,
      recentPerformance,
      ratingChange7Days: 0, // TODO: Calculate from rating history
      ratingChange30Days: 0, // TODO: Calculate from rating history
      publicMatches,
      privateMatches,
      needsConfirmation,
      disputed,
    };
  }, [matches, session?.user?.id]);

  // Enhanced match categorization
  const categorizedMatches = useMemo(() => {
    if (!matches.length) {
      return {
        upcoming: [],
        needsAttention: [],
        recent: [],
        thisWeek: [],
        publicMatches: [],
        needsConfirmation: [],
        disputed: [],
      };
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      upcoming: matches
        .filter(match => {
          const startTime = new Date(match.start_time);
          return startTime > now && match.status !== MatchStatus.CANCELLED;
        })
        .sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        .slice(0, 5),

      needsAttention: matches
        .filter(match => {
          const startTime = new Date(match.start_time);
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const isPast = endTime ? endTime < now : startTime < now;
          const hasNoScores = !match.team1_score_set1 && !match.team2_score_set1;
          return (isPast && hasNoScores && match.status !== MatchStatus.CANCELLED) ||
                 match.needsConfirmation || match.isDisputed;
        })
        .sort((a, b) => 
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        )
        .slice(0, 5),

      recent: matches
        .filter(match => 
          match.team1_score_set1 !== null && match.team2_score_set1 !== null
        )
        .sort((a, b) => {
          const dateA = new Date(a.completed_at || a.end_time || a.start_time);
          const dateB = new Date(b.completed_at || b.end_time || b.start_time);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5),

      thisWeek: matches.filter(match => {
        const hasScores = match.team1_score_set1 !== null && 
                         match.team2_score_set1 !== null;
        const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
        return matchDate >= weekAgo && hasScores;
      }),

      publicMatches: matches
        .filter(match => {
          const startTime = new Date(match.start_time);
          return match.is_public && startTime > now;
        })
        .slice(0, 3),

      needsConfirmation: matches
        .filter(match => match.needsConfirmation)
        .slice(0, 3),

      disputed: matches
        .filter(match => match.isDisputed)
        .slice(0, 3),
    };
  }, [matches]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session]);

  const fetchData = async (shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch matches with enhanced player information
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `)
        .or(
          `player1_id.eq.${session?.user?.id},player2_id.eq.${session?.user?.id},player3_id.eq.${session?.user?.id},player4_id.eq.${session?.user?.id}`
        )
        .order('start_time', { ascending: false });

      if (matchError) throw matchError;

      // Process match data with enhanced computed properties
      const processedMatches = (matchData || []).map(match => {
        const userId = session?.user?.id;
        const now = new Date();
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;

        const isTeam1 = match.player1_id === userId || match.player2_id === userId;
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasScores = match.team1_score_set1 !== null && 
                         match.team2_score_set1 !== null;
        const isCompleted = hasScores && isPast;
        const needsScores = isPast && !hasScores && 
                           match.status !== MatchStatus.CANCELLED;

        // Enhanced confirmation logic
        const statusNum = typeof match.status === 'string' ? 
                         parseInt(match.status, 10) : match.status;
        const needsConfirmation = statusNum === 4 && hasScores && 
                                 match.confirmation_status === 'pending' && 
                                 !match.all_confirmed;
        const isDisputed = match.validation_status === 'disputed' || 
                          match.confirmation_status === 'rejected';

        // Enhanced teammate and opponent identification
        let teammate = null;
        let opponents: any[] = [];

        if (isTeam1) {
          teammate = match.player1_id === userId ? match.player2 : match.player1;
          opponents = [match.player3, match.player4].filter(Boolean);
        } else {
          teammate = match.player3_id === userId ? match.player4 : match.player3;
          opponents = [match.player1, match.player2].filter(Boolean);
        }

        let userWon = false;
        let setScores = '';
        let team1Sets = 0;
        let team2Sets = 0;

        if (hasScores) {
          // Set-based winner calculation
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

          if (match.winner_team) {
            userWon = (isTeam1 && match.winner_team === 1) || 
                     (!isTeam1 && match.winner_team === 2);
          } else {
            userWon = (isTeam1 && team1Sets > team2Sets) || 
                     (!isTeam1 && team2Sets > team1Sets);
          }

          // Create readable set scores
          const userSet1 = isTeam1 ? match.team1_score_set1 : match.team2_score_set1;
          const oppSet1 = isTeam1 ? match.team2_score_set1 : match.team1_score_set1;
          setScores = `${userSet1}-${oppSet1}`;

          if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
            const userSet2 = isTeam1 ? match.team1_score_set2 : match.team2_score_set2;
            const oppSet2 = isTeam1 ? match.team2_score_set2 : match.team1_score_set2;
            setScores += `, ${userSet2}-${oppSet2}`;

            if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
              const userSet3 = isTeam1 ? match.team1_score_set3 : match.team2_score_set3;
              const oppSet3 = isTeam1 ? match.team2_score_set3 : match.team1_score_set3;
              setScores += `, ${userSet3}-${oppSet3}`;
            }
          }
        }

        return {
          ...match,
          isTeam1,
          userWon,
          setScores,
          isCompleted,
          isFuture,
          isPast,
          needsScores,
          needsConfirmation,
          isDisputed,
          teammate,
          opponents,
          team1Sets,
          team2Sets,
        };
      });

      setMatches(processedMatches);

      // Fetch friends activity with enhanced information
      if (profile?.friends_list && profile.friends_list.length > 0) {
        const { data: friendsData, error: friendsError } = await supabase
          .from('profiles')
          .select('id, full_name, email, glicko_rating, avatar_url, updated_at')
          .in('id', profile.friends_list);

        if (!friendsError && friendsData) {
          setFriendsActivity(friendsData.slice(0, 5));
        }
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchData(true);
  };

  // Enhanced greeting system
  const getGreeting = () => {
    const { currentStreak, winRate, totalMatches, recentPerformance } = userStats;

    if (currentStreak >= 5) return { emoji: '🔥', message: 'You\'re absolutely unstoppable!' };
    if (currentStreak >= 3) return { emoji: '⚡', message: 'What a streak you\'re on!' };
    if (currentStreak >= 1) return { emoji: '💪', message: 'Keep that momentum going!' };
    if (currentStreak === 0 && winRate >= 70) return { emoji: '🎯', message: 'Consistent champion!' };
    if (currentStreak === 0 && recentPerformance === 'improving') return { emoji: '📈', message: 'Getting better every match!' };
    if (currentStreak >= -2 && recentPerformance === 'improving') return { emoji: '💡', message: 'Your comeback starts now!' };
    if (currentStreak >= -2) return { emoji: '😤', message: 'Time to turn things around!' };
    if (currentStreak >= -4) return { emoji: '😰', message: 'Every champion faces challenges!' };
    if (currentStreak <= -5) return { emoji: '🔄', message: 'Your biggest comeback awaits!' };
    if (totalMatches === 0) return { emoji: '🚀', message: 'Ready to start your journey!' };
    if (totalMatches < 5) return { emoji: '🌟', message: 'Welcome to the courts!' };
    return { emoji: '👋', message: 'Great to see you back!' };
  };

  const renderUserHeader = () => {
    const greeting = getGreeting();
    const firstName = profile?.full_name?.split(' ')[0] || 'Player';

    return (
      <View className="mb-8">
        {/* Enhanced Greeting */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {greeting.emoji} Hi, {firstName}
            </Text>
          </TouchableOpacity>
          <Text className="text-gray-600 dark:text-gray-400">
            {greeting.message}
          </Text>
        </View>

        {/* Enhanced Stats Grid */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.8}
        >
          <View className="bg-card dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row justify-around mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-blue-600">
                  {profile?.glicko_rating 
                    ? Math.round(parseFloat(profile.glicko_rating))
                    : '-'}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Rating
                </Text>
              </View>
              
              <View className="items-center">
                <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {userStats.winRate}%
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Win Rate
                </Text>
              </View>
              
              <View className="items-center">
                <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {userStats.totalMatches}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Matches
                </Text>
              </View>
              
              <View className="items-center">
                <Text className={`text-2xl font-bold ${
                  userStats.currentStreak > 0 ? 'text-green-600' :
                  userStats.currentStreak < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {userStats.currentStreak}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Streak
                </Text>
              </View>
            </View>

            {/* Additional Stats Row */}
            {userStats.totalMatches > 0 && (
              <View className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <View className="flex-row justify-around">
                  <View className="items-center">
                    <Text className="text-lg font-semibold text-blue-600">
                      {categorizedMatches.thisWeek.length}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      This Week
                    </Text>
                  </View>
                  
                  <View className="items-center">
                    <Text className={`text-lg font-semibold ${
                      userStats.recentPerformance === 'improving' ? 'text-green-600' :
                      userStats.recentPerformance === 'declining' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {userStats.recentPerformance === 'improving' ? '📈' :
                       userStats.recentPerformance === 'declining' ? '📉' : '➡️'}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Trend
                    </Text>
                  </View>
                  
                  <View className="items-center">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {userStats.publicMatches}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Public
                    </Text>
                  </View>
                  
                  <View className="items-center">
                    <Text className={`text-lg font-semibold ${
                      userStats.needsConfirmation > 0 ? 'text-orange-600' : 'text-gray-600'
                    }`}>
                      {userStats.needsConfirmation}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      Pending
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Enhanced visibility badge
  const renderVisibilityBadge = (isPublic: boolean) => {
    return (
      <View className={`flex-row items-center px-2 py-1 rounded-full ${
        isPublic 
          ? 'bg-blue-100 dark:bg-blue-900/30' 
          : 'bg-gray-100 dark:bg-gray-800/50'
      }`}>
        <Ionicons 
          name={isPublic ? 'globe-outline' : 'lock-closed-outline'} 
          size={12} 
          color={isPublic ? '#2563eb' : '#6b7280'} 
          style={{ marginRight: 4 }}
        />
        <Text className={`text-xs font-medium ${
          isPublic 
            ? 'text-blue-700 dark:text-blue-300' 
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {isPublic ? 'Public' : 'Private'}
        </Text>
      </View>
    );
  };

  // Enhanced confirmation badge
  const renderConfirmationBadge = (match: MatchData) => {
    if (!match.isCompleted) return null;

    if (match.isDisputed) {
      return (
        <View className="flex-row items-center px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
          <Ionicons name="alert-circle-outline" size={12} color="#dc2626" style={{ marginRight: 4 }} />
          <Text className="text-xs font-medium text-red-700 dark:text-red-300">Disputed</Text>
        </View>
      );
    }
    
    if (match.needsConfirmation) {
      return (
        <View className="flex-row items-center px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Ionicons name="time-outline" size={12} color="#d97706" style={{ marginRight: 4 }} />
          <Text className="text-xs font-medium text-amber-700 dark:text-amber-300">Pending</Text>
        </View>
      );
    }
    
    if (match.all_confirmed) {
      return (
        <View className="flex-row items-center px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
          <Ionicons name="checkmark-circle-outline" size={12} color="#059669" style={{ marginRight: 4 }} />
          <Text className="text-xs font-medium text-green-700 dark:text-green-300">Confirmed</Text>
        </View>
      );
    }

    return null;
  };

  const renderMatchCard = (match: MatchData, type: 'upcoming' | 'attention' | 'recent') => {
    const startTime = new Date(match.start_time);
    const now = new Date();
    const isToday = startTime.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === startTime.toDateString();
    
    const formattedDate = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : 
      startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const formattedTime = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const getStatusColor = () => {
      if (match.isDisputed) return 'bg-red-500';
      if (match.needsConfirmation) return 'bg-amber-500';
      if (type === 'upcoming') return 'bg-blue-500';
      if (type === 'attention') return 'bg-orange-500';
      return match.userWon ? 'bg-green-500' : 'bg-red-500';
    };

    return (
      <TouchableOpacity
        key={match.id}
        className="bg-card dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { 
              matchId: match.id,
              mode: match.needsScores ? 'score-entry' : 
                    match.needsConfirmation ? 'confirmation' : undefined
            }
          });
        }}
      >
        {/* Enhanced Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <View className={`w-3 h-3 rounded-full mr-3 ${getStatusColor()}`} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formattedDate} • {formattedTime}
              </Text>
              {(match.region || match.court) && (
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {match.court || match.region}
                </Text>
              )}
            </View>
          </View>
          
          <View className="flex-row items-center gap-2">
            {renderVisibilityBadge(match.is_public)}
            {renderConfirmationBadge(match)}
          </View>
        </View>

        {/* Enhanced Team Display with Avatars */}
        <View className="flex-row items-center justify-between mb-4">
          {/* Your Team */}
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">Your Team</Text>
            <View className="flex-row items-center">
              <PlayerAvatarStack
                players={[
                  profile,
                  match.teammate
                ]}
                maxDisplay={2}
                size="sm"
                currentUserId={session?.user?.id}
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100" numberOfLines={1}>
                  You {match.teammate ? `& ${match.teammate.full_name || match.teammate.email.split('@')[0]}` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Score or VS */}
          <View className="items-center px-4">
            {match.setScores ? (
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  match.userWon ? 'text-green-600' : 'text-red-600'
                }`}>
                  {match.userWon ? 'W' : 'L'}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {match.setScores}
                </Text>
              </View>
            ) : (
              <Text className="text-lg font-bold text-gray-400">VS</Text>
            )}
          </View>

          {/* Opponents */}
          <View className="flex-1 items-end">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">Opponents</Text>
            <View className="flex-row items-center justify-end">
              <View className="mr-3 flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right" numberOfLines={1}>
                  {match.opponents
                    .map(p => p?.full_name || p?.email?.split('@')[0] || 'TBD')
                    .join(' & ')}
                </Text>
              </View>
              <PlayerAvatarStack
                players={match.opponents}
                maxDisplay={2}
                size="sm"
                currentUserId={session?.user?.id}
              />
            </View>
          </View>
        </View>

        {/* Enhanced Status Indicators */}
        {match.isDisputed && (
          <View className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
            <View className="flex-row items-center">
              <Ionicons name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 8 }} />
              <Text className="text-sm text-red-800 dark:text-red-300 font-medium">
                This match result is disputed and requires review
              </Text>
            </View>
          </View>
        )}

        {match.needsConfirmation && !match.isDisputed && (
          <View className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-4 border-amber-500">
            <View className="flex-row items-center">
              <Ionicons name="time" size={16} color="#d97706" style={{ marginRight: 8 }} />
              <Text className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                Waiting for all players to confirm this result
              </Text>
            </View>
          </View>
        )}

        {type === 'attention' && match.needsScores && (
          <View className="mt-2">
            <Button
              size="sm"
              variant="default"
              className="w-full"
              onPress={() => router.push({
                pathname: '/(protected)/(screens)/match-details',
                params: { matchId: match.id, mode: 'score-entry' }
              })}
            >
              <Ionicons name="create-outline" size={14} style={{ marginRight: 6 }} />
              <Text className="text-primary-foreground font-medium">Enter Scores</Text>
            </Button>
          </View>
        )}

        {/* Match Description */}
        {match.description && (
          <View className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Text className="text-sm text-gray-700 dark:text-gray-300 italic">
              {match.description}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    matches: MatchData[],
    type: 'upcoming' | 'attention' | 'recent',
    viewAllAction?: () => void,
    showBadge?: boolean,
    badgeCount?: number
  ) => {
    if (matches.length === 0) return null;

    return (
      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Text className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </Text>
            {showBadge && badgeCount && badgeCount > 0 && (
              <View className={`ml-3 px-2 py-1 rounded-full ${
                type === 'attention' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                <Text className={`text-xs font-medium ${
                  type === 'attention' ? 'text-orange-800 dark:text-orange-300' : 'text-blue-800 dark:text-blue-300'
                }`}>
                  {badgeCount}
                </Text>
              </View>
            )}
          </View>
          {viewAllAction && (
            <TouchableOpacity onPress={viewAllAction} className="flex-row items-center">
              <Text className="text-blue-600 text-sm mr-1">View All</Text>
              <Ionicons name="chevron-forward" size={14} color="#2563eb" />
            </TouchableOpacity>
          )}
        </View>
        
        {matches.map(match => renderMatchCard(match, type))}
      </View>
    );
  };

  const renderFriendsActivity = () => {
    if (friendsActivity.length === 0) return null;

    return (
      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Friends Activity
          </Text>
          <TouchableOpacity 
            onPress={() => router.push('/(protected)/(screens)/friends')}
            className="flex-row items-center"
          >
            <Text className="text-blue-600 text-sm mr-1">View All</Text>
            <Ionicons name="chevron-forward" size={14} color="#2563eb" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {friendsActivity.map(friend => (
            <TouchableOpacity
              key={friend.id}
              className="bg-card dark:bg-gray-800 rounded-xl p-4 mr-3 w-32 border border-gray-100 dark:border-gray-700"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
              onPress={() => router.push({
                pathname: '/(protected)/(screens)/friend-profile',
                params: { friendId: friend.id }
              })}
            >
              <View className="items-center mb-3">
                <Avatar 
                  user={friend} 
                  size="lg" 
                  showShadow={true}
                  showBorder={true}
                  borderColor="#3B82F6"
                />
              </View>
              <Text className="text-sm font-medium text-center text-gray-900 dark:text-gray-100" numberOfLines={1}>
                {friend.full_name || friend.email.split('@')[0]}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Rating: {friend.glicko_rating 
                  ? Math.round(parseFloat(friend.glicko_rating))
                  : '-'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="items-center justify-center py-16">
      <View className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-6">
        <Ionicons name="tennisball-outline" size={40} color="#9CA3AF" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Welcome to Padel!
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-8 px-6 leading-6">
        Start your padel journey by creating your first match or connecting with friends. 
        Your match history and stats will appear here as you play.
      </Text>
      
      <View className="w-full px-6 gap-4">
        <Button
          onPress={() => router.push('/(protected)/(screens)/create-match')}
          className="w-full bg-blue-500 hover:bg-blue-600"
          style={{
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
          <Text className="text-white font-medium">Create Your First Match</Text>
        </Button>
        
        <Button
          variant="outline"
          onPress={() => router.push('/(protected)/(screens)/friends')}
          className="w-full"
        >
          <Ionicons name="people" size={18} style={{ marginRight: 8 }} />
          <Text className="font-medium">Find Friends to Play With</Text>
        </Button>
        
        <Button
          variant="outline"
          onPress={() => router.push('/(protected)/(screens)/leaderboard')}
          className="w-full"
        >
          <Ionicons name="trophy" size={18} style={{ marginRight: 8 }} />
          <Text className="font-medium">View Leaderboard</Text>
        </Button>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1  dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">Loading your dashboard...</Text>
          <View className="mt-4 flex-row gap-4">
            <View className="items-center">
              <View className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center">
                <Ionicons name="globe" size={12} color="#2563eb" />
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">Public</Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center">
                <Ionicons name="lock-closed" size={12} color="#6b7280" />
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">Private</Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full items-center justify-center">
                <Ionicons name="time" size={12} color="#d97706" />
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-gray-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced User Header */}
        {renderUserHeader()}

        {/* Content */}
        {matches.length === 0 ? renderEmptyState() : (
          <>
            {/* Priority: Matches Needing Attention */}
            {renderSection(
              'Needs Attention',
              categorizedMatches.needsAttention,
              'attention',
              undefined,
              true,
              categorizedMatches.needsAttention.length
            )}

            {/* Upcoming Matches */}
            {renderSection(
              'Upcoming Matches',
              categorizedMatches.upcoming,
              'upcoming',
              () => router.push('/(protected)/(screens)/match-history')
            )}

            {/* Recent Matches */}
            {renderSection(
              'Recent Matches',
              categorizedMatches.recent,
              'recent',
              () => router.push('/(protected)/(screens)/match-history')
            )}

            {/* Enhanced Friends Activity */}
            {renderFriendsActivity()}
          </>
        )}
      </ScrollView>

      {/* Enhanced Floating Action Button */}
      <TouchableOpacity
        onPress={() => router.push('/(protected)/(screens)/create-match')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 items-center justify-center shadow-lg"
        style={{
          shadowColor: "#3B82F6",
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