import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share, Dimensions, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { router } from 'expo-router';
import { supabase } from '@/config/supabase';

// TECHNICAL SPECIFICATION: Match status enumeration with comprehensive coverage
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
}

// TECHNICAL SPECIFICATION: Enhanced statistics interface with comprehensive metrics
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
  // ENHANCEMENT: Additional performance metrics
  averageMatchDuration: number;
  recentPerformance: 'improving' | 'declining' | 'stable';
  thisWeekMatches: number;
  thisMonthMatches: number;
}

export default function Profile() {
  const { signOut, profile } = useAuth();
  const { toggleColorScheme, colorScheme } = useColorScheme();
  const [loading, setLoading] = useState(false);
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

  // TECHNICAL SPECIFICATION: Component lifecycle initialization
  useEffect(() => {
    if (profile?.id) {
      fetchPlayerStatistics(profile.id);
    }
  }, [profile?.id]);

  // TECHNICAL SPECIFICATION: Comprehensive statistics calculation with corrected logic
  const fetchPlayerStatistics = async (playerId: string) => {
    try {
      setLoading(true);
      
      console.log('🚀 Profile: Fetching statistics for player:', playerId);
      
      // REQUIREMENT 1: Enhanced match data retrieval with player information
      const { data: matchData, error: matchError } = await supabase
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

      if (matchError) {
        console.error('❌ Profile: Match fetch error:', matchError);
        throw matchError;
      }

      console.log('📊 Profile: Raw match data received:', {
        count: matchData?.length || 0,
        sampleMatch: matchData?.[0]
      });

      // REQUIREMENT 2: Time boundary calculations for performance analysis
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // REQUIREMENT 3: Statistical calculation variables initialization
      let wins = 0;
      let losses = 0;
      let currentStreak = 0;
      let longestStreak = 0;
      let needsAttention = 0;
      let upcomingMatches = 0;
      let thisWeekMatches = 0;
      let thisMonthMatches = 0;
      let totalDuration = 0;
      let matchesWithDuration = 0;
      
      const recentMatches: any[] = [];
      const scheduledMatches: any[] = [];
      
      // REQUIREMENT 4: Rating history processing with fallback generation
      const { data: ratingData, error: ratingError } = await supabase
        .from('match_ratings')
        .select('created_at, rating')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true });
        
      let ratingHistory: {date: string, rating: number}[] = [];
      if (ratingData && ratingData.length > 0) {
        ratingHistory = ratingData.map(item => ({
          date: new Date(item.created_at).toLocaleDateString(),
          rating: item.rating
        }));
      } else {
        // FALLBACK: Demo rating history generation
        const baseRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating) : 1500;
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

      // REQUIREMENT 5: Performance tracking arrays for trend analysis
      const recentResults: boolean[] = [];
      const olderResults: boolean[] = [];
      
      // REQUIREMENT 6: Comprehensive match processing with corrected logic
      if (matchData) {
        // CRITICAL FIX: Sort matches chronologically for proper streak calculation
        const chronologicalMatches = matchData
          .filter(match => {
            // FIXED: Time-based completion determination
            const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
            return hasScores;
          })
          .sort((a, b) => {
            const dateA = new Date(a.completed_at || a.end_time || a.start_time);
            const dateB = new Date(b.completed_at || b.end_time || b.start_time);
            return dateA.getTime() - dateB.getTime(); // Ascending for streak calculation
          });

        console.log('📈 Profile: Processing', chronologicalMatches.length, 'completed matches chronologically');

        // REQUIREMENT 7: Process all matches for categorization and statistics
        matchData.forEach(match => {
          const startTime = new Date(match.start_time);
          const endTime = match.end_time ? new Date(match.end_time) : null;
          const completedTime = match.completed_at ? new Date(match.completed_at) : null;
          
          // FIXED: Time-based classifications replacing status dependency
          const isFuture = startTime > now;
          const isPast = endTime ? endTime < now : startTime < now;
          const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
          const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
          const needsConfirmation = match.status === MatchStatus.NEEDS_CONFIRMATION;
          
          console.log(`🔍 Profile: Match ${match.id} classification:`, {
            isFuture,
            isPast,
            hasScores,
            needsScores,
            needsConfirmation,
            startTime: startTime.toISOString()
          });
          
          // REQUIREMENT 8: Attention and upcoming match counting
          if (needsScores || needsConfirmation) {
            needsAttention++;
          }
          
          if (isFuture) {
            upcomingMatches++;
            if (scheduledMatches.length < 3) {
              scheduledMatches.push(match);
            }
          }
          
          // REQUIREMENT 9: Time-based match counting for performance metrics
          const matchDate = completedTime || endTime || startTime;
          if (hasScores) {
            if (matchDate >= weekAgo) {
              thisWeekMatches++;
            }
            if (matchDate >= monthAgo) {
              thisMonthMatches++;
            }
            
            // REQUIREMENT 10: Recent matches collection
            if (recentMatches.length < 3) {
              recentMatches.push(match);
            }
            
            // REQUIREMENT 11: Duration calculation
            if (match.start_time && match.end_time) {
              const duration = new Date(match.end_time).getTime() - new Date(match.start_time).getTime();
              totalDuration += duration;
              matchesWithDuration++;
            }
          }
        });

        // REQUIREMENT 12: Chronological streak and win/loss calculation
        chronologicalMatches.forEach((match, index) => {
          const isTeam1 = match.player1_id === playerId || match.player2_id === playerId;
          
          // CRITICAL FIX: Comprehensive winner determination using set counting
          let userWon = false;
          
          if (match.winner_team) {
            // OPTION 1: Use winner_team if available and reliable
            userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
          } else {
            // OPTION 2: FIXED set-based winner calculation
            let team1Sets = 0;
            let team2Sets = 0;
            
            // Set 1 analysis
            if (match.team1_score_set1 > match.team2_score_set1) {
              team1Sets++;
            } else if (match.team2_score_set1 > match.team1_score_set1) {
              team2Sets++;
            }
            
            // Set 2 analysis
            if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) {
              if (match.team1_score_set2 > match.team2_score_set2) {
                team1Sets++;
              } else if (match.team2_score_set2 > match.team1_score_set2) {
                team2Sets++;
              }
            }
            
            // Set 3 analysis
            if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
              if (match.team1_score_set3 > match.team2_score_set3) {
                team1Sets++;
              } else if (match.team2_score_set3 > match.team1_score_set3) {
                team2Sets++;
              }
            }
            
            // WINNER DETERMINATION: Team with more sets wins
            if (team1Sets > team2Sets) {
              userWon = isTeam1;
            } else if (team2Sets > team1Sets) {
              userWon = !isTeam1;
            }
            // If sets are equal, match is a draw (shouldn't happen in padel)
          }
          
          console.log(`🎯 Profile: Match ${match.id} result:`, {
            isTeam1,
            userWon,
            sets: `${match.team1_score_set1}-${match.team2_score_set1}, ${match.team1_score_set2}-${match.team2_score_set2}`,
            winner_team: match.winner_team
          });
          
          // REQUIREMENT 13: Win/loss and streak calculation
          const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
          
          // Performance trend analysis data collection
          if (matchDate >= weekAgo) {
            recentResults.push(userWon);
          } else if (matchDate >= monthAgo) {
            olderResults.push(userWon);
          }
          
          if (userWon) {
            wins++;
            currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
          } else {
            losses++;
            currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
          }
          
          // REQUIREMENT 14: Longest streak tracking
          if (Math.abs(currentStreak) > Math.abs(longestStreak)) {
            longestStreak = currentStreak;
          }
        });
      }
      
      // REQUIREMENT 15: Performance trend analysis
      let recentPerformance: 'improving' | 'declining' | 'stable' = 'stable';
      if (recentResults.length >= 2 && olderResults.length >= 2) {
        const recentWinRate = recentResults.filter(Boolean).length / recentResults.length;
        const olderWinRate = olderResults.filter(Boolean).length / olderResults.length;
        
        if (recentWinRate > olderWinRate + 0.15) {
          recentPerformance = 'improving';
        } else if (recentWinRate < olderWinRate - 0.15) {
          recentPerformance = 'declining';
        }
      }
      
      // REQUIREMENT 16: Final statistics compilation
      const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
      const averageMatchDuration = matchesWithDuration > 0 ? totalDuration / matchesWithDuration : 0;
      
      const finalStats: EnhancedPlayerStats = {
        matches: wins + losses,
        wins,
        losses,
        winRate,
        streak: currentStreak,
        longestStreak,
        upcomingMatches,
        needsAttention,
        ratingHistory,
        recentMatches,
        scheduledMatches,
        averageMatchDuration,
        recentPerformance,
        thisWeekMatches,
        thisMonthMatches,
      };

      console.log('📊 Profile: Final calculated statistics:', finalStats);
      setPlayerStats(finalStats);
      
    } catch (error) {
      console.error("💥 Profile: Error fetching player statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  // REQUIREMENT 17: User interaction handlers
  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Sign Out", 
          onPress: async () => {
            await signOut();
          },
          style: "destructive"
        }
      ]
    );
  };

  const shareProfile = async () => {
    try {
      const message = `Check out my Padel profile!\n\nName: ${profile?.full_name || 'Anonymous Player'}\nRating: ${profile?.glicko_rating || '-'}\nWin Rate: ${playerStats.winRate}%\nMatches: ${playerStats.matches}\nStreak: ${playerStats.streak}\n\nLet's play a match!`;
      
      await Share.share({
        message,
        title: 'Padel Profile',
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  // REQUIREMENT 18: Component rendering functions
  const renderAvatar = () => (
    <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
      <Text className="text-4xl font-bold text-primary-foreground">
        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
      </Text>
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

  // REQUIREMENT 19: Enhanced statistics card with comprehensive metrics
  const renderStatsCard = () => (
    <View className="bg-card rounded-lg p-6 mb-6">
      {/* Header with current rating */}
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Text className="text-xs text-muted-foreground mr-2">Current Rating:</Text>
          <Text className="text-base font-bold text-primary">
            {profile?.glicko_rating ? parseInt(profile.glicko_rating).toString() : '-'}
          </Text>
        </View>
        <TouchableOpacity onPress={shareProfile}>
          <Ionicons name="share-outline" size={20} color="#1a7ebd" />
        </TouchableOpacity>
      </View>
      
      {/* Main statistics grid */}
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
      
      {/* Enhanced metrics section */}
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
      
      {/* Performance insights */}
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
          onPress={() => router.push('/(protected)/(screens)/match-history')}
        >
          <Text className="text-primary text-sm mr-1">Full History</Text>
          <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // REQUIREMENT 20: Enhanced matches section with improved statistics display
  const renderMatchesSection = () => {
    if (playerStats.recentMatches.length === 0 && playerStats.scheduledMatches.length === 0 && playerStats.needsAttention === 0) {
      return null;
    }
    
    return (
      <View className="bg-card rounded-lg p-4 mb-6">
        <H3 className="mb-3">Match Overview</H3>
        
        {/* Matches needing attention */}
        {playerStats.needsAttention > 0 && (
          <TouchableOpacity 
            className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700"
            onPress={() => router.push({
              pathname: '/(protected)/(screens)/match-history',
              params: { filter: 'attention' }
            })}
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
        
        {/* Upcoming matches */}
        {playerStats.upcomingMatches > 0 && (
          <TouchableOpacity 
            className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
            onPress={() => router.push({
              pathname: '/(protected)/(screens)/match-history',
              params: { filter: 'upcoming' }
            })}
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

        {/* Quick stats summary */}
        {playerStats.matches > 0 && (
          <View className="p-3 rounded-lg bg-primary/5 dark:bg-primary/10">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted-foreground">Recent Activity</Text>
              <TouchableOpacity 
                onPress={() => router.push('/(protected)/(screens)/match-history')}
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
        {/* Header section */}
        <View className="relative pt-12 pb-4 px-6 bg-primary/10">
          <View className="items-center mt-10">
            {renderAvatar()}
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

        {/* Content sections */}
        <View className="px-6 pb-8 pt-6">
          {/* Loading indicator */}
          {loading && (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#1a7ebd" />
            </View>
          )}
        
          {/* Enhanced matches section */}
          {renderMatchesSection()}
          
          {/* Enhanced stats card */}
          {renderStatsCard()}

          {/* Personal Information Section */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <H3>Personal Information</H3>
              <TouchableOpacity
                onPress={() => {router.push('/(protected)/(screens)/edit-profile')}}
              >
                <Ionicons name="create-outline" size={20} color={colorScheme === 'dark' ? '#a1a1aa' : '#777'} />
              </TouchableOpacity>
            </View>
            {renderInfoCard("Age", profile?.age ? profile.age.toString() : null, "person-outline")}
            {renderInfoCard("Gender", profile?.sex, "body-outline")}
            {renderInfoCard("Email", profile?.email, "mail-outline")}
          </View>

          {/* Playing Preferences Section */}
          <View className="mb-6">
            <H3 className="mb-3">Playing Preferences</H3>
            {renderInfoCard("Preferred Hand", profile?.preferred_hand, "hand-left-outline")}
            {renderInfoCard("Court Position", profile?.court_playing_side, "tennisball-outline")}
            {renderInfoCard("Preferred Area", profile?.preferred_area, "location-outline")}
          </View>
        </View>

        {/* Sign Out Button */}
        <View className="px-6 mb-6">
          <Button 
            variant="destructive"
            className="w-full py-3 flex-row justify-center items-center"
            onPress={handleSignOut}
          >
            <Ionicons 
              name="log-out-outline" 
              size={20} 
              color="white" 
              style={{ marginRight: 8 }} 
            />
            <Text className="text-white font-medium">Sign Out</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}