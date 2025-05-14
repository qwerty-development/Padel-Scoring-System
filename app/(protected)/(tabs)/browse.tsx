import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { H1, H2 } from '@/components/ui/typography';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';
import { MatchData } from '@/types';

export default function PublicMatches() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publicMatches, setPublicMatches] = useState<MatchData[]>([]);
  const { profile, session } = useAuth();

  // Filter matches to show only those with available slots
  const availableMatches = useMemo(() => {
    if (!publicMatches.length) return [];

    const now = new Date();
    
    return publicMatches
      .filter(match => {
        const startTime = new Date(match.start_time);
        // Only show future matches that are pending
        return startTime > now && match.status === MatchStatus.PENDING;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [publicMatches]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPublicMatches();
    }
  }, [session]);

  const fetchPublicMatches = async () => {
    try {
      setLoading(true);
      
      // Fetch all public matches
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email),
          player2:profiles!player2_id(id, full_name, email),
          player3:profiles!player3_id(id, full_name, email),
          player4:profiles!player4_id(id, full_name, email)
        `)
        .eq('is_public', true)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Process match data
      const processedData = (data || []).map(match => {
        // Check if current user is already in this match
        const isCurrentUserInMatch = 
          match.player1_id === session?.user?.id || 
          match.player2_id === session?.user?.id || 
          match.player3_id === session?.user?.id || 
          match.player4_id === session?.user?.id;
        
        // Calculate available positions
        const availablePositions = [];
        if (!match.player1_id) availablePositions.push(1);
        if (!match.player2_id) availablePositions.push(2);
        if (!match.player3_id) availablePositions.push(3);
        if (!match.player4_id) availablePositions.push(4);
        
        return {
          ...match,
          isCurrentUserInMatch,
          availablePositions
        };
      });

      setPublicMatches(processedData);
    } catch (error) {
      console.error('Error fetching public matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPublicMatches();
  };

  const handleJoinMatch = async (match: MatchData) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to join a match');
      return;
    }

    if (match.isCurrentUserInMatch) {
      // Navigate to match details if already joined
      router.push({
        pathname: '/(protected)/(screens)/match-details',
        params: { matchId: match.id }
      });
      return;
    }

    try {
      // Determine which position to join
      let positionToJoin = null;
      const positions = match.availablePositions || [];
      
      if (positions.length === 0) {
        Alert.alert('Error', 'This match is already full');
        return;
      }

      // Ask which team the user wants to join if there are options on both teams
      const team1HasOpenings = positions.some(p => p === 1 || p === 2);
      const team2HasOpenings = positions.some(p => p === 3 || p === 4);

      if (team1HasOpenings && team2HasOpenings) {
        Alert.alert(
          'Choose a team',
          'Which team would you like to join?',
          [
            {
              text: 'Team 1',
              onPress: () => joinTeam(match, positions.filter(p => p === 1 || p === 2)[0])
            },
            {
              text: 'Team 2',
              onPress: () => joinTeam(match, positions.filter(p => p === 3 || p === 4)[0])
            }
          ]
        );
      } else {
        // Join the first available position
        joinTeam(match, positions[0]);
      }
    } catch (error) {
      console.error('Error joining match:', error);
      Alert.alert('Error', 'Failed to join match. Please try again.');
    }
  };

  const joinTeam = async (match: MatchData, position: number) => {
    try {
      setLoading(true);
      
      // Determine which field to update based on position
      const updateField = `player${position}_id`;
      
      // Update the match with the current user in the specified position
      const { error } = await supabase
        .from('matches')
        .update({ [updateField]: session?.user?.id })
        .eq('id', match.id);
      
      if (error) throw error;
      
      Alert.alert(
        'Success',
        'You have joined the match!',
        [
          {
            text: 'View Match',
            onPress: () => router.push({
              pathname: '/(protected)/(screens)/match-details',
              params: { matchId: match.id }
            })
          },
          {
            text: 'Stay on This Page',
            onPress: () => fetchPublicMatches()
          }
        ]
      );
    } catch (error) {
      console.error('Error joining team:', error);
      Alert.alert('Error', 'Failed to join team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render a match card
  const renderMatchCard = (match: MatchData, index: number) => {
    const startTime = new Date(match.start_time);
    const formattedDate = startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formattedTime = startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    
    // Get all players for display
    const players = [match.player1, match.player2, match.player3, match.player4];
    
    // Calculate how many slots are available
    const availableSlots = (match.availablePositions || []).length;
    
    return (
      <View 
        key={`public-match-${match.id}-${index}`}
        className="mb-3 p-4 rounded-xl bg-card border border-border/30"
      >
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2">
              <Ionicons name="people-outline" size={16} color="#059669" />
            </View>
            <Text className="font-medium">Public Match</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            {formattedDate} • {formattedTime}
          </Text>
        </View>
        
        {/* Location info if available */}
        {match.location && (
          <View className="flex-row items-center mb-2">
            <Ionicons name="location-outline" size={16} color="#888" style={{ marginRight: 4 }} />
            <Text className="text-sm text-muted-foreground">{match.location}</Text>
          </View>
        )}
        
        {/* Team 1 */}
        <View className="mb-2">
          <Text className="font-medium">Team 1</Text>
          <View className="flex-row">
            {match.player1 ? (
              <Text className="text-sm">{match.player1.full_name || match.player1.email.split('@')[0]}</Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">Open Position</Text>
            )}
            {match.player1 && match.player2 && <Text className="text-sm mx-1">&</Text>}
            {match.player2 ? (
              <Text className="text-sm">{match.player2.full_name || match.player2.email.split('@')[0]}</Text>
            ) : (
              match.player1 && <Text className="text-sm text-muted-foreground italic">Open Position</Text>
            )}
          </View>
        </View>
        
        {/* Team 2 */}
        <View className="mb-3">
          <Text className="font-medium">Team 2</Text>
          <View className="flex-row">
            {match.player3 ? (
              <Text className="text-sm">{match.player3.full_name || match.player3.email.split('@')[0]}</Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">Open Position</Text>
            )}
            {match.player3 && match.player4 && <Text className="text-sm mx-1">&</Text>}
            {match.player4 ? (
              <Text className="text-sm">{match.player4.full_name || match.player4.email.split('@')[0]}</Text>
            ) : (
              match.player3 && <Text className="text-sm text-muted-foreground italic">Open Position</Text>
            )}
          </View>
        </View>
        
        {/* Join or View button */}
        <Button 
          size="sm" 
          variant={match.isCurrentUserInMatch ? "outline" : "default"} 
          className="mt-1"
          onPress={() => handleJoinMatch(match)}
        >
          <Text className={`text-xs ${match.isCurrentUserInMatch ? "text-primary" : "text-primary-foreground"}`}>
            {match.isCurrentUserInMatch ? 'View Match' : `Join Match${availableSlots > 0 ? ` (${availableSlots} ${availableSlots === 1 ? 'spot' : 'spots'} left)` : ''}`}
          </Text>
        </Button>
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="p-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="mb-6">
          <H1 className="mb-2">Public Matches</H1>
          <Text className="text-muted-foreground">
            Browse and join available public matches
          </Text>
        </View>
        
        {availableMatches.length > 0 ? (
          <View className="mb-6">
            <H2 className="mb-3">Available Matches</H2>
            {availableMatches.map((match, index) => renderMatchCard(match, index))}
          </View>
        ) : (
          <View className="bg-card rounded-xl p-6 items-center my-6">
            <Ionicons name="search-outline" size={48} color="#888" />
            <Text className="text-lg font-medium mt-4 mb-2">No public matches available</Text>
            <Text className="text-muted-foreground text-center mb-4">
              There are no public matches available to join at this time
            </Text>
            <Button
              variant="default"
              onPress={() => router.push('/(protected)/(screens)/create-match')}
            >
              <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
              <Text>Create Public Match</Text>
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}