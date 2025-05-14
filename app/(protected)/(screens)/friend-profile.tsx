import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
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

  const renderMatchHistoryCard = () => {
    if (matchesLoading) {
      return (
        <View className="bg-card rounded-lg p-6 mb-6 items-center">
          <ActivityIndicator size="small" color="#1a7ebd" />
        </View>
      );
    }

    if (matchHistory.allMatches.length === 0) {
      return (
        <View className="bg-card rounded-lg p-6 mb-6 items-center">
          <Ionicons name="tennisball-outline" size={36} color="#888" />
          <Text className="mt-2 text-muted-foreground text-center">
            No matches played together yet
          </Text>
        </View>
      );
    }

    return (
      <View className="bg-card rounded-lg p-6 mb-6">
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
            <Text>View All Matches</Text>
          </Button>
        )}
      </View>
    );
  };

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
        className="bg-card border border-border/40 rounded-lg p-3 mb-2"
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { matchId: match.id }
          });
        }}
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
            <Text>
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

  const renderComparisonCard = () => {
    if (!currentUserProfile || !profile || !currentUserProfile.glicko_rating || !profile.glicko_rating) {
      return null;
    }
    
    const userRating = parseInt(currentUserProfile.glicko_rating);
    const friendRating = parseInt(profile.glicko_rating);
    const ratingDiff = userRating - friendRating;
    
    return (
      <View className="bg-card rounded-lg p-4 mb-6">
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
        <Text>Could not find the profile you're looking for.</Text>
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
      >
        {/* Header with back button */}
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

        {/* Profile Header */}
        <View className="pt-4 pb-6 px-6 items-center">
          {renderAvatar()}
          <H1 className="mb-1 text-center">{profile.full_name || 'Anonymous Player'}</H1>
          {profile.nickname && (
            <H2 className="text-muted-foreground text-center">"{profile.nickname}"</H2>
          )}
        </View>

        {/* Content */}
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

          {/* Actions */}
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