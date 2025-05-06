import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H1, H2, H3 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

interface PlayerDetail {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string;
  glicko_rd: string;
  glicko_vol: string;
  avatar_url: string | null;
}

interface MatchDetail {
  id: string;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  team1_score: number;
  team2_score: number;
  status: number;
  created_at: string;
  completed_at: string | null;
  player1: PlayerDetail;
  player2: PlayerDetail;
  player3: PlayerDetail;
  player4: PlayerDetail;
}

export default function MatchDetails() {
  const { matchId } = useLocalSearchParams();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  const fetchMatchDetails = async (id: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setMatch(data);
    } catch (error) {
      console.error('Error fetching match details:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareMatch = async () => {
    if (!match) return;
    
    try {
      const result = await Share.share({
        message: `Check out our padel match result: ${match.player1.full_name} & ${match.player2.full_name} vs ${match.player3.full_name} & ${match.player4.full_name}. Score: ${match.team1_score}-${match.team2_score}!`,
        title: 'Padel Match Result',
      });
    } catch (error) {
      console.error('Error sharing match:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getStatusText = (status: number) => {
    // Define status codes based on your application logic
    switch (status) {
      case 1: return { text: 'Disputed', color: 'text-red-500' };
      case 2: return { text: 'Pending Confirmation', color: 'text-yellow-500' };
      case 3: return { text: 'Cancelled', color: 'text-gray-500' };
      case 4: return { text: 'Completed', color: 'text-green-500' };
      default: return { text: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  const renderPlayerAvatar = (player: PlayerDetail) => (
    <View className="items-center">
      <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mb-2">
        <Text className="text-lg font-bold text-primary-foreground">
          {player.full_name?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>
      <Text className="font-medium text-center">
        {player.full_name || player.email.split('@')[0]}
      </Text>
      <Text className="text-xs text-muted-foreground text-center">
        {player.glicko_rating}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  if (!match) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-row items-center mb-6">
          <Button 
            variant="ghost" 
            onPress={() => router.back()}
            className="mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </Button>
          <H1>Match Not Found</H1>
        </View>
        <Text>Could not find the match you're looking for.</Text>
      </SafeAreaView>
    );
  }

  const datetime = formatDateTime(match.created_at);
  const status = getStatusText(match.status);
  const userId = session?.user?.id;
  const isTeam1 = match.player1_id === userId || match.player2_id === userId;
  const teamWon = (isTeam1 && match.team1_score > match.team2_score) || 
                  (!isTeam1 && match.team2_score > match.team1_score);
  const isTied = match.team1_score === match.team2_score;

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
          <H1>Match Details</H1>
        </View>

        {/* Date, Time and Status */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-lg font-medium">{datetime.date}</Text>
            <Text className="text-muted-foreground">{datetime.time}</Text>
          </View>
          <View className="bg-card px-3 py-1 rounded-full">
            <Text className={status.color}>{status.text}</Text>
          </View>
        </View>

        {/* Match Score */}
        <View className="bg-card rounded-xl p-6 mb-6 items-center">
          <H3 className="mb-4">Match Score</H3>
          <View className="flex-row items-center">
            <Text className="text-3xl font-bold">{match.team1_score}</Text>
            <Text className="text-2xl mx-4">-</Text>
            <Text className="text-3xl font-bold">{match.team2_score}</Text>
          </View>
          {userId && (
            <Text className={`mt-4 font-medium ${
              teamWon ? 'text-green-500' : (isTied ? 'text-yellow-500' : 'text-red-500')
            }`}>
              {teamWon ? 'You Won!' : (isTied ? 'Tie Game' : 'You Lost')}
            </Text>
          )}
        </View>

        {/* Teams */}
        <View className="bg-card rounded-xl p-6 mb-6">
          <H3 className="mb-4">Teams</H3>
          
          {/* Team 1 */}
          <View className="mb-6">
            <Text className="font-medium text-center mb-3 text-primary">Team 1</Text>
            <View className="flex-row justify-around">
              {renderPlayerAvatar(match.player1)}
              {renderPlayerAvatar(match.player2)}
            </View>
          </View>
          
          <View className="h-px bg-border my-2" />
          
          {/* Team 2 */}
          <View>
            <Text className="font-medium text-center mb-3 text-accent">Team 2</Text>
            <View className="flex-row justify-around">
              {renderPlayerAvatar(match.player3)}
              {renderPlayerAvatar(match.player4)}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="flex-row gap-3 mb-4">
          <Button
            className="flex-1"
            variant="outline"
            onPress={shareMatch}
          >
            <Ionicons name="share-outline" size={20} className="mr-2" />
            <Text>Share</Text>
          </Button>
          
          {match.status === 2 && userId && (
            <Button
              className="flex-1"
              variant="default"
              onPress={() => {
                // Future feature: Confirm match score
              }}
            >
              <Text>Confirm Score</Text>
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}