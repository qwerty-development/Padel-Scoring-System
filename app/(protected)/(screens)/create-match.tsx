import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3 } from "@/components/ui/typography";
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';

interface Friend {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

// Glicko-2 constants
const TAU = 0.5; // Reasonable default
const EPSILON = 0.000001; // Convergence tolerance

/**
 * Calculate the g-function value
 */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * rd * rd) / (Math.PI * Math.PI));
}

/**
 * Calculate the E-function (expected score)
 */
function E(rating: number, opponentRating: number, opponentRd: number): number {
  return 1 / (1 + Math.exp(-g(opponentRd) * (rating - opponentRating) / 400));
}

/**
 * Calculate the v value (variance)
 */
function v(rating: number, opponentRatings: number[], opponentRds: number[]): number {
  let sum = 0;
  for (let i = 0; i < opponentRatings.length; i++) {
    const e = E(rating, opponentRatings[i], opponentRds[i]);
    const gRd = g(opponentRds[i]);
    sum += gRd * gRd * e * (1 - e);
  }
  return 1 / sum;
}

/**
 * Calculate the delta value
 */
function delta(v: number, rating: number, opponentRatings: number[], opponentRds: number[], scores: number[]): number {
  let sum = 0;
  for (let i = 0; i < opponentRatings.length; i++) {
    sum += g(opponentRds[i]) * (scores[i] - E(rating, opponentRatings[i], opponentRds[i]));
  }
  return v * sum;
}

/**
 * Calculate updated Glicko-2 rating
 */
function updateGlicko(
  rating: number, 
  rd: number, 
  vol: number, 
  opponentRatings: number[], 
  opponentRds: number[], 
  scores: number[]
): { rating: number; rd: number; vol: number } {
  // Convert from Glicko to Glicko-2 scale
  let mu = (rating - 1500) / 173.7178;
  let phi = rd / 173.7178;
  
  if (opponentRatings.length === 0) {
    // If no games played, increase the RD
    phi = Math.sqrt(phi * phi + vol * vol);
    
    // Convert back to Glicko scale
    rd = phi * 173.7178;
    if (rd > 350) rd = 350; // Cap RD at 350
    
    return {
      rating: rating,
      rd: rd,
      vol: vol
    };
  }
  
  // Step 3: Calculate the variance
  const variance = v(mu, opponentRatings.map(r => (r - 1500) / 173.7178), opponentRds.map(r => r / 173.7178));
  
  // Step 4: Calculate the delta
  const d = delta(
    variance, 
    mu, 
    opponentRatings.map(r => (r - 1500) / 173.7178), 
    opponentRds.map(r => r / 173.7178), 
    scores
  );
  
  // Step 5: Calculate the new volatility (iterative algorithm)
  let a = Math.log(vol * vol);
  let A = a;
  let B = 0;
  
  if (d * d > phi * phi + variance) {
    B = Math.log(d * d - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * Math.sqrt(TAU * TAU), phi, variance, d, a) < 0) {
      k++;
    }
    B = a - k * Math.sqrt(TAU * TAU);
  }
  
  // Iterative algorithm
  let fA = f(A, phi, variance, d, a);
  let fB = f(B, phi, variance, d, a);
  
  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C, phi, variance, d, a);
    
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    
    B = C;
    fB = fC;
  }
  
  const newVol = Math.exp(A / 2);
  
  // Step 6: Update the rating deviation
  phi = Math.sqrt(phi * phi + newVol * newVol);
  
  // Step 7: Update the rating
  const newPhi = 1 / Math.sqrt(1 / (phi * phi) + 1 / variance);
  const newMu = mu + newPhi * newPhi * d / variance;
  
  // Convert back to Glicko scale
  const newRating = 173.7178 * newMu + 1500;
  const newRd = 173.7178 * newPhi;
  
  return {
    rating: newRating,
    rd: Math.min(newRd, 350), // Cap RD at 350
    vol: newVol
  };
}

// Helper function for the volatility calculation
function f(x: number, phi: number, v: number, delta: number, a: number): number {
  const ex = Math.exp(x);
  const d2 = delta * delta;
  const phiv = phi * phi + v;
  
  return (ex * (d2 - phiv - ex)) / (2 * Math.pow(phiv + ex, 2)) - (x - a) / (TAU * TAU);
}

/**
 * Calculate new ratings for all players after a padel match
 */
function calculateMatchRatings(
  player1: { rating: number; rd: number; vol: number },
  player2: { rating: number; rd: number; vol: number },
  player3: { rating: number; rd: number; vol: number },
  player4: { rating: number; rd: number; vol: number },
  team1Score: number,
  team2Score: number
): {
  player1: { rating: number; rd: number; vol: number };
  player2: { rating: number; rd: number; vol: number };
  player3: { rating: number; rd: number; vol: number };
  player4: { rating: number; rd: number; vol: number };
} {
  // Normalize scores to Glicko range (0-1)
  const totalGames = team1Score + team2Score;
  if (totalGames === 0) {
    return { player1, player2, player3, player4 }; // No changes if no games played
  }
  
  const team1Result = team1Score / totalGames;
  const team2Result = team2Score / totalGames;
  
  // For each player in team 1, they played against both players in team 2
  const newPlayer1 = updateGlicko(
    player1.rating,
    player1.rd,
    player1.vol,
    [player3.rating, player4.rating],
    [player3.rd, player4.rd],
    [team1Result, team1Result]
  );
  
  const newPlayer2 = updateGlicko(
    player2.rating,
    player2.rd,
    player2.vol,
    [player3.rating, player4.rating],
    [player3.rd, player4.rd],
    [team1Result, team1Result]
  );
  
  // For each player in team 2, they played against both players in team 1
  const newPlayer3 = updateGlicko(
    player3.rating,
    player3.rd,
    player3.vol,
    [player1.rating, player2.rating],
    [player1.rd, player2.rd],
    [team2Result, team2Result]
  );
  
  const newPlayer4 = updateGlicko(
    player4.rating,
    player4.rd,
    player4.vol,
    [player1.rating, player2.rating],
    [player1.rd, player2.rd],
    [team2Result, team2Result]
  );
  
  return {
    player1: newPlayer1,
    player2: newPlayer2,
    player3: newPlayer3,
    player4: newPlayer4
  };
}

export default function CreateMatchScreen() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : []
  );
  const [team1Score, setTeam1Score] = useState('0');
  const [team2Score, setTeam2Score] = useState('0');
  const { profile, session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriends();
    }
  }, [session]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      if (!profile?.friends_list || !Array.isArray(profile.friends_list)) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', profile.friends_list);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(prev => prev.filter(id => id !== friendId));
    } else {
      // Only allow up to 3 friends to be selected (player2, player3, player4)
      if (selectedFriends.length < 3) {
        setSelectedFriends(prev => [...prev, friendId]);
      }
    }
  };

  const createMatch = async () => {
    try {
      if (selectedFriends.length !== 3) {
        alert('Please select exactly 3 friends to create a 2v2 match');
        return;
      }

      setLoading(true);

      const team1ScoreNumber = parseInt(team1Score, 10) || 0;
      const team2ScoreNumber = parseInt(team2Score, 10) || 0;
      
      if (team1ScoreNumber === 0 && team2ScoreNumber === 0) {
        alert('Please enter valid scores for the match');
        setLoading(false);
        return;
      }

      // Fetch player ratings
      const { data: playersData, error: playersError } = await supabase
        .from('profiles')
        .select('id, glicko_rating, glicko_rd, glicko_vol')
        .in('id', [session?.user?.id, ...selectedFriends]);

      if (playersError) throw playersError;

      if (!playersData || playersData.length !== 4) {
        throw new Error('Could not fetch all player ratings');
      }

      // Find ratings for each player
      const player1 = playersData.find(p => p.id === session?.user?.id);
      const player2 = playersData.find(p => p.id === selectedFriends[0]);
      const player3 = playersData.find(p => p.id === selectedFriends[1]);
      const player4 = playersData.find(p => p.id === selectedFriends[2]);

      if (!player1 || !player2 || !player3 || !player4) {
        throw new Error('Could not match all player IDs');
      }

      // Calculate new ratings
      const newRatings = calculateMatchRatings(
        {
          rating: parseFloat(player1.glicko_rating || '1500'),
          rd: parseFloat(player1.glicko_rd || '350'),
          vol: parseFloat(player1.glicko_vol || '0.06')
        },
        {
          rating: parseFloat(player2.glicko_rating || '1500'),
          rd: parseFloat(player2.glicko_rd || '350'),
          vol: parseFloat(player2.glicko_vol || '0.06')
        },
        {
          rating: parseFloat(player3.glicko_rating || '1500'),
          rd: parseFloat(player3.glicko_rd || '350'),
          vol: parseFloat(player3.glicko_vol || '0.06')
        },
        {
          rating: parseFloat(player4.glicko_rating || '1500'),
          rd: parseFloat(player4.glicko_rd || '350'),
          vol: parseFloat(player4.glicko_vol || '0.06')
        },
        team1ScoreNumber,
        team2ScoreNumber
      );

      // Create the match record
      const matchData = {
        player1_id: session?.user?.id,
        player2_id: selectedFriends[0],
        player3_id: selectedFriends[1],
        player4_id: selectedFriends[2],
        team1_score: team1ScoreNumber,
        team2_score: team2ScoreNumber,
        status: 4, // Completed status
        completed_at: new Date().toISOString()
      };

      const { data: matchResult, error: matchError } = await supabase
        .from('matches')
        .insert(matchData)
        .select()
        .single();

      if (matchError) throw matchError;

      // Update each player's rating
      const updatePromises = [
        supabase
          .from('profiles')
          .update({
            glicko_rating: Math.round(newRatings.player1.rating).toString(),
            glicko_rd: Math.round(newRatings.player1.rd).toString(),
            glicko_vol: newRatings.player1.vol.toFixed(6)
          })
          .eq('id', player1.id),
        
        supabase
          .from('profiles')
          .update({
            glicko_rating: Math.round(newRatings.player2.rating).toString(),
            glicko_rd: Math.round(newRatings.player2.rd).toString(),
            glicko_vol: newRatings.player2.vol.toFixed(6)
          })
          .eq('id', player2.id),
        
        supabase
          .from('profiles')
          .update({
            glicko_rating: Math.round(newRatings.player3.rating).toString(),
            glicko_rd: Math.round(newRatings.player3.rd).toString(),
            glicko_vol: newRatings.player3.vol.toFixed(6)
          })
          .eq('id', player3.id),
        
        supabase
          .from('profiles')
          .update({
            glicko_rating: Math.round(newRatings.player4.rating).toString(),
            glicko_rd: Math.round(newRatings.player4.rd).toString(),
            glicko_vol: newRatings.player4.vol.toFixed(6)
          })
          .eq('id', player4.id)
      ];

      await Promise.all(updatePromises);

      // Show success message with rating changes
      const ratingDiff1 = Math.round(newRatings.player1.rating - parseFloat(player1.glicko_rating || '1500'));
      alert(`Match created successfully! Your rating changed by ${ratingDiff1 > 0 ? '+' : ''}${ratingDiff1} points.`);
      
      // Navigate back
      router.push('/(protected)/(tabs)');
    } catch (error) {
      console.error('Error creating match:', error);
      alert('Failed to create match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFriendItem = (friend: Friend) => {
    const isSelected = selectedFriends.includes(friend.id);
    
    return (
      <TouchableOpacity
        key={friend.id}
        className={`bg-card rounded-lg mb-3 p-4 flex-row items-center ${
          isSelected ? 'border-2 border-primary' : ''
        }`}
        onPress={() => toggleFriendSelection(friend.id)}
      >
        <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mr-4">
          <Text className="text-lg font-bold text-primary-foreground">
            {friend.full_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-medium">{friend.full_name || friend.email}</Text>
          <Text className="text-sm text-muted-foreground">{friend.email}</Text>
        </View>
        {isSelected && (
          <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="p-6">
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <H1>Create Match</H1>
        </View>

        <H3 className="mb-4">Select 3 Players</H3>
        <View className="mb-2">
          <Text className="text-sm text-muted-foreground mb-1">
            Select 3 friends to create a 2v2 match. You'll be Player 1.
          </Text>
          <Text className="text-sm text-primary mb-4">
            {selectedFriends.length}/3 selected
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#fbbf24" />
        ) : (
          <>
            {friends.length > 0 ? (
              friends.map(renderFriendItem)
            ) : (
              <View className="bg-card rounded-lg p-6 items-center">
                <Ionicons name="people-outline" size={48} color="#888" />
                <Text className="text-lg font-medium mt-4 mb-2">No friends yet</Text>
                <Text className="text-muted-foreground text-center">
                  Add friends to create a match with them
                </Text>
              </View>
            )}
          </>
        )}

        {selectedFriends.length === 3 && (
          <>
            <H3 className="mb-4 mt-6">Match Score</H3>
            <View className="flex-row items-center justify-center mb-2">
              <View className="items-center">
                <Text className="mb-2 text-muted-foreground">Team 1 (You & Player 2)</Text>
                <TextInput
                  className="bg-card border-2 border-border rounded-lg px-4 py-3 text-foreground w-20 text-center text-lg"
                  value={team1Score}
                  onChangeText={setTeam1Score}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              
              <Text className="mx-6 text-2xl">-</Text>
              
              <View className="items-center">
                <Text className="mb-2 text-muted-foreground">Team 2 (Player 3 & 4)</Text>
                <TextInput
                  className="bg-card border-2 border-border rounded-lg px-4 py-3 text-foreground w-20 text-center text-lg"
                  value={team2Score}
                  onChangeText={setTeam2Score}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            <Text className="text-sm text-muted-foreground text-center mb-6">
              Ratings will be updated based on the match result
            </Text>
          </>
        )}

        <Button
          className="w-full mt-4"
          size="default"
          variant="default"
          onPress={createMatch}
          disabled={loading || selectedFriends.length !== 3}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Text>Create Match</Text>
          )}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}