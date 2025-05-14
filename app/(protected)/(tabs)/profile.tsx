import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share, Dimensions, Alert } from "react-native"; // Added Alert
import { Ionicons } from '@expo/vector-icons';


import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { router } from 'expo-router';
import { supabase } from '@/config/supabase';

// Match status enum for consistency with other components
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
}


export default function Profile() {
  const { signOut, profile } = useAuth();
  const { toggleColorScheme, colorScheme } = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState({
    matches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    streak: 0,
    upcomingMatches: 0,
    needsAttention: 0,
    ratingHistory: [] as {date: string, rating: number}[],
    recentMatches: [] as any[],
    scheduledMatches: [] as any[]
  });

  // Load player statistics when component mounts
  useEffect(() => {
    if (profile?.id) {
      fetchPlayerStatistics(profile.id);
    }
  }, [profile?.id]);

  // Fetch player statistics from various sources
  const fetchPlayerStatistics = async (playerId: string) => {
    try {
      setLoading(true);
      
      // Get match history for statistics
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email),
          player2:profiles!player2_id(id, full_name, email),
          player3:profiles!player3_id(id, full_name, email),
          player4:profiles!player4_id(id, full_name, email)
        `)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`)
        .order('created_at', { ascending: false });

      if (matchError) throw matchError;
      
      // Process match results
      let wins = 0;
      let losses = 0;
      let streak = 0;
      let currentStreak = 0;
      let needsAttention = 0;
      let upcomingMatches = 0;
      const recentMatches = [];
      const scheduledMatches = [];
      const now = new Date();
      
      // Rating history array to hold historical ratings
      const { data: ratingData, error: ratingError } = await supabase
        .from('match_ratings')
        .select('created_at, rating')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true });
        
      // For demo purposes, generate some sample rating history if none exists
      let ratingHistory = [];
      if (ratingData && ratingData.length > 0) {
        ratingHistory = ratingData.map(item => ({
          date: new Date(item.created_at).toLocaleDateString(),
          rating: item.rating
        }));
      } else {
        // Demo data if no rating history
        const baseRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating) : 1500;
        ratingHistory = [
          { date: '1 May', rating: baseRating - Math.random() * 100 },
          { date: '8 May', rating: baseRating - Math.random() * 50 },
          { date: '15 May', rating: baseRating - Math.random() * 25 },
          { date: '22 May', rating: baseRating },
          { date: '29 May', rating: baseRating + Math.random() * 25 },
          { date: '5 Jun', rating: baseRating + Math.random() * 50 },
          { date: '12 Jun', rating: baseRating + Math.random() * 60 },
        ];
      }
      
      // Process match data
      if (matchData) {
        matchData.forEach(match => {
          const startTime = new Date(match.start_time);
          const isUpcoming = startTime > now && match.status === MatchStatus.PENDING;
          const isPastWithoutScores = startTime <= now && (!match.team1_score_set1 || !match.team2_score_set1) && match.status !== MatchStatus.CANCELLED;
          const needsConfirmation = match.status === MatchStatus.NEEDS_CONFIRMATION;
          
          const isTeam1 = match.player1_id === playerId || match.player2_id === playerId;
          const isCompleted = match.status === MatchStatus.COMPLETED;
          
          // Check if match requires attention
          if (isPastWithoutScores || needsConfirmation) {
            needsAttention++;
          }
          
          // Count upcoming matches
          if (isUpcoming) {
            upcomingMatches++;
            if (scheduledMatches.length < 3) {
              scheduledMatches.push(match);
            }
          }
          
          // Process completed matches for win/loss stats
          if (isCompleted) {
            const team1Won = (match.team1_score_set1 > match.team2_score_set1 && match.team1_score_set2 > match.team2_score_set2) || 
                            (match.team1_score_set1 > match.team2_score_set1 && match.team1_score_set3 > match.team2_score_set3) ||
                            (match.team1_score_set2 > match.team2_score_set2 && match.team1_score_set3 > match.team2_score_set3);
            
            const team2Won = (match.team2_score_set1 > match.team1_score_set1 && match.team2_score_set2 > match.team1_score_set2) || 
                            (match.team2_score_set1 > match.team1_score_set1 && match.team2_score_set3 > match.team1_score_set3) ||
                            (match.team2_score_set2 > match.team1_score_set2 && match.team2_score_set3 > match.team1_score_set3);
                            
            const userWon = (isTeam1 && team1Won) || (!isTeam1 && team2Won);
            
            if (userWon) {
              wins++;
              currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
            } else {
              losses++;
              currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
            }
            
            // Update streak if it's better than previous
            if (Math.abs(currentStreak) > Math.abs(streak)) {
              streak = currentStreak;
            }
            
            // Add to recent matches
            if (recentMatches.length < 3) {
              recentMatches.push(match);
            }
          }
        });
      }
      
      // Calculate win rate
      const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
      
      // Update player stats
      setPlayerStats({
        matches: wins + losses,
        wins,
        losses,
        winRate,
        streak,
        upcomingMatches,
        needsAttention,
        ratingHistory,
        recentMatches,
        scheduledMatches
      });
      
    } catch (error) {
      console.error("Error fetching player statistics:", error);
    } finally {
      setLoading(false);
    }
  };

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
            // router.replace('/(auth)/sign-in'); // Optional: redirect after sign out
          },
          style: "destructive"
        }
      ]
    );
  };

  const shareProfile = async () => {
    try {
      const message = `Check out my Padel profile!\n\nName: ${profile?.full_name || 'Anonymous Player'}\nRating: ${profile?.glicko_rating || '-'}\nWin Rate: ${playerStats.winRate}%\nMatches: ${playerStats.matches}\n\nLet's play a match!`;
      
      await Share.share({
        message,
        title: 'Padel Profile',
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

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

  const renderStatsCard = () => (
    <View className="bg-card rounded-lg p-6 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Text className="text-xs text-muted-foreground mr-2">Current Rating:</Text>
          <Text className="text-base font-bold text-primary">
            {profile?.glicko_rating ? parseInt(profile.glicko_rating).toString() : '-'}
          </Text>
        </View>
      </View>
      
 
      
      <View className="flex-row justify-around">
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
      
      <View className="h-px bg-border my-4" />
      
      <View className="flex-row justify-between">
        <View className="flex-row items-center">
          <Ionicons name="trending-up-outline" size={20} color="#10b981" style={{ marginRight: 8 }} />
          <Text className="text-sm text-muted-foreground">
            Current Streak: 
            <Text className={`font-medium ${playerStats.streak > 0 ? 'text-green-500' : playerStats.streak < 0 ? 'text-red-500' : ''}`}>
              {' '}{playerStats.streak > 0 ? `${playerStats.streak}W` : playerStats.streak < 0 ? `${Math.abs(playerStats.streak)}L` : '0'}
            </Text>
          </Text>
        </View>
        <TouchableOpacity 
          className="flex-row items-center"
          onPress={() => router.push('/(protected)/(screens)/match-history')}
        >
          <Text className="text-primary text-sm mr-1">View Full History</Text>
          <Ionicons name="chevron-forward" size={14} color="#1a7ebd" />
        </TouchableOpacity>
      </View>
    </View>
  );
  

  
  const renderMatchesSection = () => {
    // Only show if there are any matches to display
    if (playerStats.recentMatches.length === 0 && playerStats.scheduledMatches.length === 0 && playerStats.needsAttention === 0) {
      return null;
    }
    
    return (
      <View className="bg-card rounded-lg p-4 mb-6">
        <H3 className="mb-3">My Matches</H3>
        
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
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}> 

        <View className="relative pt-12 pb-4 px-6 bg-primary/10">
    
          <View className="absolute top-12 right-6 flex-row items-center z-10">
            <TouchableOpacity
              className="w-10 h-10 rounded-full items-center justify-center bg-card shadow-sm" // Added shadow
              onPress={handleSignOut} // Use the new handler with confirmation
              aria-label="Sign out"
            >
              <Ionicons 
                name="log-out-outline" 
                size={24} // Slightly larger for emphasis
                color={colorScheme === "dark" ? "#f87171" : "#ef4444"} // Reddish color for sign out
              />
            </TouchableOpacity>
          </View>
          
          <View className="items-center mt-10"> {/* Adjusted mt for space from icons */}
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

        {/* Content */}
        <View className="px-6 pb-8 pt-6"> {/* Added pt-6 for spacing from header */}
          {/* Loading indicator */}
          {loading && (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#1a7ebd" />
            </View>
          )}
        
          
          {/* Matches section */}
          {renderMatchesSection()}
          
          {/* Stats Card */}
          {renderStatsCard()}

          {/* Personal Info Section */}
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
      </ScrollView>
    </View>
  );
}