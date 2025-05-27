import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl, 
  TouchableOpacity, 
  Dimensions,
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { H1, H2, H3 } from '@/components/ui/typography';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

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
  recentPerformance: 'improving' | 'declining' | 'stable';
  ratingChange7Days: number;
  ratingChange30Days: number;
}

export default function EnhancedHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allMatches, setAllMatches] = useState<EnhancedMatchData[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const { profile, session } = useAuth();

  // Time-based match categorization - FIXED LOGIC
  const categorizedMatches = useMemo(() => {
    if (!allMatches.length) return {
      upcoming: [],
      needsAttention: [],
      recent: [],
      thisWeek: [],
      publicMatches: []
    };

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    console.log('🔍 Categorizing matches:', {
      totalMatches: allMatches.length,
      currentTime: now.toISOString(),
      weekAgo: weekAgo.toISOString()
    });
    
    return {
      // FIXED: Future matches based on start_time, regardless of status
      upcoming: allMatches
        .filter(match => {
          const startTime = new Date(match.start_time);
          const isFuture = startTime > now;
          console.log(`📅 Match ${match.id} upcoming check:`, {
            startTime: startTime.toISOString(),
            isFuture,
            status: match.status
          });
          return isFuture;
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5),
      
      // FIXED: Past matches needing attention based on time, not status
      needsAttention: allMatches
        .filter(match => {
          const startTime = new Date(match.start_time);
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const isPastMatch = endTime ? endTime < now : startTime < now;
          const hasNoScores = !match.team1_score_set1 && !match.team2_score_set1;
          const needsAttention = isPastMatch && hasNoScores && match.status !== MatchStatus.CANCELLED;
          
          console.log(`⚠️ Match ${match.id} attention check:`, {
            startTime: startTime.toISOString(),
            endTime: endTime?.toISOString(),
            isPastMatch,
            hasNoScores,
            needsAttention,
            status: match.status
          });
          
          return needsAttention;
        })
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      
      // FIXED: Recent completed matches based on scores existence
      recent: allMatches
        .filter(match => {
          const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const completedTime = match.completed_at ? new Date(match.completed_at) : null;
          const isCompleted = hasScores && (endTime || completedTime);
          
          console.log(`🏆 Match ${match.id} recent check:`, {
            hasScores,
            endTime: endTime?.toISOString(),
            completedTime: completedTime?.toISOString(),
            isCompleted
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
      thisWeek: allMatches
        .filter(match => {
          const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
          const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
          const isThisWeek = matchDate >= weekAgo && hasScores;
          
          console.log(`📊 Match ${match.id} this week check:`, {
            matchDate: matchDate.toISOString(),
            isThisWeek,
            hasScores,
            weekAgo: weekAgo.toISOString()
          });
          
          return isThisWeek;
        }),
      
      // Public recruiting matches
      publicMatches: allMatches
        .filter(match => {
          const startTime = new Date(match.start_time);
          return match.is_public && startTime > now;
        })
        .slice(0, 3)
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
        recentPerformance: 'stable',
        ratingChange7Days: 0,
        ratingChange30Days: 0,
      };
    }

    // FIXED: Filter completed matches with scores
    const completedMatches = allMatches
      .filter(match => {
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        console.log(`📈 Stats calculation for match ${match.id}:`, {
          hasScores,
          team1_set1: match.team1_score_set1,
          team2_set1: match.team2_score_set1,
          winner_team: match.winner_team
        });
        return hasScores;
      })
      .sort((a, b) => {
        // Sort by completion time for proper streak calculation
        const dateA = new Date(a.completed_at || a.end_time || a.start_time);
        const dateB = new Date(b.completed_at || b.end_time || b.start_time);
        return dateA.getTime() - dateB.getTime(); // Ascending order for streak calculation
      });

    console.log('📊 Completed matches for stats:', completedMatches.length);

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
      const isTeam1 = match.player1_id === session.user.id || match.player2_id === session.user.id;
      
      // FIXED: Determine winner using set-based logic when winner_team is not reliable
      let userWon = false;
      
      if (match.winner_team) {
        // Use winner_team if available
        userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
      } else {
        // FIXED: Calculate winner based on sets won
        let team1Sets = 0;
        let team2Sets = 0;
        
        // Count sets won by each team
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
        sets: `${match.team1_score_set1}-${match.team2_score_set1}, ${match.team1_score_set2}-${match.team2_score_set2}`
      });
      
      const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
      
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
        const duration = new Date(match.end_time).getTime() - new Date(match.start_time).getTime();
        totalDuration += duration;
        matchesWithDuration++;
      }
    });

    // Determine performance trend
    let recentPerformance: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentMatches >= 2 && olderMatches >= 2) {
      const recentWinRate = recentWins / recentMatches;
      const olderWinRate = olderWins / olderMatches;
      if (recentWinRate > olderWinRate + 0.1) {
        recentPerformance = 'improving';
      } else if (recentWinRate < olderWinRate - 0.1) {
        recentPerformance = 'declining';
      }
    }

    const finalStats = {
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
    };

    console.log('📊 Final calculated stats:', finalStats);
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
      
      console.log('🚀 Fetching dashboard data for user:', session?.user?.id);
      
      // Fetch user matches with enhanced player information
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `)
        .or(`player1_id.eq.${session?.user?.id},player2_id.eq.${session?.user?.id},player3_id.eq.${session?.user?.id},player4_id.eq.${session?.user?.id}`)
        .order('start_time', { ascending: false });

      if (matchError) {
        console.error('❌ Match fetch error:', matchError);
        throw matchError;
      }

      console.log('📊 Raw match data received:', {
        count: matchData?.length || 0,
        sampleMatch: matchData?.[0]
      });

      // FIXED: Process match data with enhanced computed properties
      const processedMatches = (matchData || []).map(match => {
        const now = new Date();
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        
        // FIXED: Time-based classifications
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const isCompleted = (match.team1_score_set1 !== null && match.team2_score_set1 !== null);
        const needsScores = isPast && !isCompleted && match.status !== MatchStatus.CANCELLED;
        
        const isTeam1 = match.player1_id === session?.user?.id || match.player2_id === session?.user?.id;
        
        // FIXED: Determine user victory using sets logic
        let userWon = false;
        if (isCompleted) {
          if (match.winner_team) {
            userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
          } else {
            // Calculate winner based on sets
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
            
            if (team1Sets > team2Sets) {
              userWon = isTeam1;
            } else if (team2Sets > team1Sets) {
              userWon = !isTeam1;
            }
          }
        }
        
        // Create readable set scores
        let setScores = '';
        if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) {
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

        const processedMatch = {
          ...match,
          needsScores,
          isTeam1,
          userWon,
          setScores,
          isCompleted,
          isFuture,
          isPast
        };

        console.log(`🔄 Processed match ${match.id}:`, {
          needsScores,
          isTeam1,
          userWon,
          isCompleted,
          isFuture,
          isPast,
          setScores
        });

        return processedMatch;
      });

      setAllMatches(processedMatches);

      // Fetch friends activity
      if (profile?.friends_list && profile.friends_list.length > 0) {
        const { data: friendsData, error: friendsError } = await supabase
          .from('profiles')
          .select('id, full_name, email, glicko_rating, avatar_url')
          .in('id', profile.friends_list);

        if (!friendsError && friendsData) {
          setFriendsActivity(friendsData.slice(0, 5));
        }
      }
      
    } catch (error) {
      console.error('💥 Error fetching dashboard data:', error);
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
        pathname: '/(protected)/(screens)/match-details',
        params: { matchId: match.id, mode: 'score-entry' }
      });
    } else {
      router.push({
        pathname: '/(protected)/(screens)/match-details',
        params: { matchId: match.id }
      });
    }
  };

  // Quick action handlers
  const handleCreateMatch = () => {
    router.push('/(protected)/(screens)/create-match');
  };

  const handleViewLeaderboard = () => {
    router.push('/(protected)/(screens)/leaderboard');
  };

  const handleViewFriends = () => {
    router.push('/(protected)/(screens)/friends');
  };

  const handleViewAllMatches = () => {
    router.push('/(protected)/(screens)/match-history');
  };

  // Component: Enhanced User Header with Avatar and Quick Stats
  const renderUserHeader = () => (
    <View className="mb-6 p-4 pt-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
      <View className="flex-row items-center mb-4">
       
        <View className="flex-1">
          <Text className="text-4xl font-bold">
            👋 {profile?.full_name?.split(' ')[0] || 'Player'}
          </Text>
          
        </View>
     
      </View>
      
      {/* Quick Stats Row */}
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-lg font-bold text-primary">
            {profile?.glicko_rating ? Math.round(parseFloat(profile.glicko_rating)) : '-'}
          </Text>
          <Text className="text-xs text-muted-foreground">Current Rating</Text>
        </View>
        <View className="items-center">
          <Text className="text-lg font-bold">
            {userStats?.winRate || 0}%
          </Text>
          <Text className="text-xs text-muted-foreground">Win Rate</Text>
        </View>
        <View className="items-center">
          <Text className="text-lg font-bold">
            {categorizedMatches.thisWeek.length}
          </Text>
          <Text className="text-xs text-muted-foreground">This Week</Text>
        </View>
        <View className="items-center">
          <Text className={`text-lg font-bold ${
            userStats?.currentStreak && userStats.currentStreak > 0 ? 'text-green-500' : 
            userStats?.currentStreak && userStats.currentStreak < 0 ? 'text-red-500' : ''
          }`}>
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

  // Component: Enhanced Match Card with Rich Information INCLUDING VISIBILITY INDICATOR
  const renderMatchCard = (match: EnhancedMatchData, type: 'upcoming' | 'attention' | 'recent') => {
    const startTime = new Date(match.start_time);
    const formattedDate = startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formattedTime = startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    
    const teammate = match.isTeam1 
      ? (match.player1_id === session?.user?.id ? match.player2 : match.player1)
      : (match.player3_id === session?.user?.id ? match.player4 : match.player3);
    
    const opponents = match.isTeam1 
      ? [match.player3, match.player4]
      : [match.player1, match.player2];

    const getBgColor = () => {
      if (type === 'upcoming') return 'bg-blue-50 dark:bg-blue-900/30';
      if (type === 'attention') return 'bg-amber-50 dark:bg-amber-900/30';
      if (match.userWon) return 'bg-green-50 dark:bg-green-900/30';
      return 'bg-red-50 dark:bg-red-900/30';
    };

    const getStatusInfo = () => {
      if (type === 'upcoming') return { icon: 'calendar-outline', color: '#2563eb', text: 'Upcoming' };
      if (type === 'attention') {
        if (match.needsScores) return { icon: 'create-outline', color: '#d97706', text: 'Add Scores' };
        return { icon: 'alert-circle-outline', color: '#d97706', text: 'Needs Confirmation' };
      }
      if (match.userWon) return { icon: 'trophy-outline', color: '#059669', text: 'Victory' };
      return { icon: 'trending-down-outline', color: '#dc2626', text: 'Defeat' };
    };

    const statusInfo = getStatusInfo();

    return (
      <TouchableOpacity 
        key={match.id}
        className={`mb-3 p-4 rounded-xl ${getBgColor()} border border-border/30`}
        onPress={() => handleMatchAction(match)}
      >
        {/* ENHANCED Header with Status, Time, AND VISIBILITY INDICATOR */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-8 h-8 rounded-full bg-white items-center justify-center mr-2">
              <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.color} />
            </View>
            <Text className="font-medium" style={{ color: statusInfo.color }}>
              {statusInfo.text}
            </Text>
            {/* VISIBILITY BADGE - Positioned after status text */}
            <View className="ml-2">
              {renderVisibilityBadge(match.is_public)}
            </View>
          </View>
          <View className="items-end">
            <Text className="text-sm font-medium">{formattedDate}</Text>
            <Text className="text-xs text-muted-foreground">{formattedTime}</Text>
          </View>
        </View>
        
        {/* Location Info with Enhanced Layout */}
        {(match.region || match.court) && (
          <View className="flex-row items-center mb-2">
            <Ionicons name="location-outline" size={14} color="#888" style={{ marginRight: 4 }} />
            <Text className="text-sm text-muted-foreground">
              {match.region}{match.court ? `, Court ${match.court}` : ''}
            </Text>
          </View>
        )}
        
        {/* ENHANCED Team Composition with Public Match Context */}
        <View className="mb-3">
          <Text className="font-medium mb-1">
            You {teammate ? `& ${teammate.full_name || teammate.email.split('@')[0]}` : ''}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              vs. {opponents.filter(Boolean).map(p => 
                p?.full_name || p?.email?.split('@')[0] || 'TBD'
              ).join(' & ')}
            </Text>
            {/* ADDITIONAL Public Match Indicator for Future Matches */}
            {match.is_public && type === 'upcoming' && (
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={12} color="#2563eb" style={{ marginRight: 2 }} />
                <Text className="text-xs text-blue-600 dark:text-blue-400">
                  Others can join
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Score Display with Enhanced Visibility Context */}
        {match.setScores ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-sm font-medium mr-2">Score:</Text>
              <Text className="text-sm">{match.setScores}</Text>
            </View>
            {type === 'recent' && (
              <View className={`px-2 py-1 rounded-full ${
                match.userWon ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'
              }`}>
                <Text className={`text-xs font-medium ${
                  match.userWon ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                }`}>
                  {match.userWon ? 'WIN' : 'LOSS'}
                </Text>
              </View>
            )}
          </View>
        ) : type === 'attention' ? (
          <Button 
            size="sm" 
            variant="default" 
            className="mt-2"
            onPress={() => handleMatchAction(match)}
          >
            <Text className="text-xs text-primary-foreground">
              {match.needsScores ? 'Enter Scores' : 'View Details'}
            </Text>
          </Button>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Component: Friends Activity Section
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
            <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {friendsActivity.map((friend, index) => (
            <TouchableOpacity
              key={friend.id}
              className="bg-card rounded-xl p-4 mr-3 w-32 border border-border/30"
              onPress={() => router.push({
                pathname: '/(protected)/(screens)/friend-profile',
                params: { friendId: friend.id }
              })}
            >
              <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mb-2 self-center">
                <Text className="text-lg font-bold text-primary-foreground">
                  {friend.full_name?.charAt(0)?.toUpperCase() || friend.email.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm font-medium text-center" numberOfLines={1}>
                {friend.full_name || friend.email.split('@')[0]}
              </Text>
              <Text className="text-xs text-muted-foreground text-center">
                Rating: {friend.glicko_rating ? Math.round(parseFloat(friend.glicko_rating)) : '-'}
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
          <ActivityIndicator size="large" color="#1a7ebd" />
          <Text className="mt-4 text-muted-foreground">Loading your dashboard...</Text>
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
            tintColor="#1a7ebd"
            colors={['#1a7ebd']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced User Header */}
        {renderUserHeader()}
        
        {/* Priority: Matches Needing Attention */}
        {categorizedMatches.needsAttention.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>⚠️ Needs Attention</H2>
              <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                <Text className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {categorizedMatches.needsAttention.length}
                </Text>
              </View>
            </View>
            
            {categorizedMatches.needsAttention.map(match => 
              renderMatchCard(match, 'attention')
            )}
          </View>
        )}
        
        {/* Upcoming Matches */}
        {categorizedMatches.upcoming.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>📅 Upcoming Matches</H2>
              {categorizedMatches.upcoming.length >= 3 && (
                <TouchableOpacity 
                  onPress={handleViewAllMatches}
                  className="flex-row items-center"
                >
                  <Text className="text-primary text-sm mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
                </TouchableOpacity>
              )}
            </View>
            
            {categorizedMatches.upcoming.slice(0, 3).map(match => 
              renderMatchCard(match, 'upcoming')
            )}
          </View>
        )}
        
        {/* Recent Matches */}
        {categorizedMatches.recent.length > 0 && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H2>🏆 Recent Matches</H2>
              <TouchableOpacity 
                onPress={handleViewAllMatches}
                className="flex-row items-center"
              >
                <Text className="text-primary text-sm mr-1">View All</Text>
                <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
              </TouchableOpacity>
            </View>
            
            {categorizedMatches.recent.slice(0, 3).map(match => 
              renderMatchCard(match, 'recent')
            )}
          </View>
        )}
        
        {/* Enhanced Empty State with Onboarding */}
        {allMatches.length === 0 && (
          <View className="bg-card rounded-xl p-8 items-center border border-border/30">
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
              <Ionicons name="tennisball-outline" size={40} color="#1a7ebd" />
            </View>
            <Text className="text-xl font-bold mb-2">Welcome to Padel Scoring!</Text>
            <Text className="text-muted-foreground text-center mb-6">
              Start your padel journey by creating your first match or connecting with friends
            </Text>
            
            <View className="w-full gap-3">
              <Button
                variant="default"
                onPress={handleCreateMatch}
                className="w-full"
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
        
        {/* Friends Activity */}
        {renderFriendsActivity()}
      </ScrollView>
      
      {/* Floating Action Button for Quick Match Creation */}
      <TouchableOpacity
        onPress={handleCreateMatch}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}