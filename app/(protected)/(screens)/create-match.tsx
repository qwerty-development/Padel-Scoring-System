import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3 } from "@/components/ui/typography";
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';
import { Friend } from '@/types';

import { calculateMatchRatings } from '@/utils/glickoUtils';
import { PlayerSelectionModal } from '@/components/create-match/PlayerSelectionModal';
import { CustomDateTimePicker } from '@/components/create-match/DateTimePicker';
import { SetScoreInput, SetScore } from '@/components/create-match/SetScoreInput';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
}

interface MatchData {
  id?: string;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  status: number;
  created_at?: string;
  completed_at: string;
  team1_score_set1: number;
  team2_score_set1: number;
  team1_score_set2: number;
  team2_score_set2: number;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number;
  start_time: string;
  end_time: string;
  region: string | null;
  court: string | null;
}

export default function CreateMatchScreen() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : []
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  
  // Date and time state
  const [matchDate, setMatchDate] = useState(new Date());
  const [matchStartTime, setMatchStartTime] = useState(new Date());
  const [matchEndTime, setMatchEndTime] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date;
  });
  
  // Score state
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);

  // Location state
  const [region, setRegion] = useState('');
  const [court, setCourt] = useState('');
  
  const { profile, session } = useAuth();

  // Effect to show/hide set 3 based on set 1 and 2 results
  useEffect(() => {
    // Only show set 3 if there's a tie (1-1) in sets
    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);
    
    setShowSet3(isTied && isSet1Valid && isSet2Valid);
    
    // Reset set 3 score if we're hiding it
    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid]);

  // Load selected player details
  useEffect(() => {
    if (selectedFriends.length > 0) {
      const selected = friends.filter(friend => selectedFriends.includes(friend.id));
      setSelectedPlayers(selected);
    } else {
      setSelectedPlayers([]);
    }
  }, [selectedFriends, friends]);

  const fetchFriends = useCallback(async () => {
    try {
      if (!profile?.friends_list || !Array.isArray(profile.friends_list) || profile.friends_list.length === 0) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, glicko_rating')
        .in('id', profile.friends_list);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [profile]);

  useEffect(() => {
    if (session?.user?.id) {
      setLoading(true);
      fetchFriends().finally(() => setLoading(false));
    }
  }, [session, fetchFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [fetchFriends]);

  const determineWinnerTeam = (): number => {
    let team1Sets = 0;
    let team2Sets = 0;
    
    // Count sets won by each team
    if (set1Score.team1 > set1Score.team2) team1Sets++;
    else if (set1Score.team2 > set1Score.team1) team2Sets++;
    
    if (set2Score.team1 > set2Score.team2) team1Sets++;
    else if (set2Score.team2 > set2Score.team1) team2Sets++;
    
    if (showSet3) {
      if (set3Score.team1 > set3Score.team2) team1Sets++;
      else if (set3Score.team2 > set3Score.team1) team2Sets++;
    }
    
    // Determine winner
    if (team1Sets > team2Sets) return 1;
    if (team2Sets > team1Sets) return 2;
    return 0; // Tie (should not happen in a valid match)
  };

  const validateMatch = (): boolean => {
    // Validate player selection
    if (selectedFriends.length !== 3) {
      Alert.alert('Incomplete Selection', 'Please select exactly 3 players to create a match.');
      return false;
    }
    
    // Validate score
    if (!isSet1Valid || !isSet2Valid) {
      Alert.alert('Invalid Score', 'Please enter valid scores for both sets.');
      return false;
    }
    
    // Validate set 3 if shown
    if (showSet3 && !isSet3Valid) {
      Alert.alert('Invalid Score', 'Please enter a valid score for the third set.');
      return false;
    }
    
    // Validate times
    if (matchEndTime <= matchStartTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return false;
    }
    
    return true;
  };

  const createMatch = async () => {
    try {
      if (!validateMatch()) {
        return;
      }

      setLoading(true);
      
      const winnerTeam = determineWinnerTeam();
      
      const playerIds = [session?.user?.id, ...selectedFriends].filter(id => id != null) as string[];
      if (playerIds.length !== 4) {
        throw new Error('Could not form a team of 4 players.');
      }

      // Fetch all players' Glicko ratings
      const { data: playersData, error: playersError } = await supabase
        .from('profiles')
        .select('id, glicko_rating, glicko_rd, glicko_vol')
        .in('id', playerIds);

      if (playersError) throw playersError;

      if (!playersData || playersData.length !== 4) {
        throw new Error('Could not fetch all player ratings');
      }

      // Map player IDs to their profiles
      const player1Profile = playersData.find(p => p.id === session?.user?.id);
      const player2Profile = playersData.find(p => p.id === selectedFriends[0]);
      const player3Profile = playersData.find(p => p.id === selectedFriends[1]);
      const player4Profile = playersData.find(p => p.id === selectedFriends[2]);

      if (!player1Profile || !player2Profile || !player3Profile || !player4Profile) {
        throw new Error('Could not match all player IDs from fetched data');
      }

      // Create Glicko rating objects
      const player1Rating: GlickoRating = {
        rating: parseFloat(player1Profile.glicko_rating || '1500'),
        rd: parseFloat(player1Profile.glicko_rd || '350'),
        vol: parseFloat(player1Profile.glicko_vol || '0.06')
      };
      
      const player2Rating: GlickoRating = {
        rating: parseFloat(player2Profile.glicko_rating || '1500'),
        rd: parseFloat(player2Profile.glicko_rd || '350'),
        vol: parseFloat(player2Profile.glicko_vol || '0.06')
      };
      
      const player3Rating: GlickoRating = {
        rating: parseFloat(player3Profile.glicko_rating || '1500'),
        rd: parseFloat(player3Profile.glicko_rd || '350'),
        vol: parseFloat(player3Profile.glicko_vol || '0.06')
      };
      
      const player4Rating: GlickoRating = {
        rating: parseFloat(player4Profile.glicko_rating || '1500'),
        rd: parseFloat(player4Profile.glicko_rd || '350'),
        vol: parseFloat(player4Profile.glicko_vol || '0.06')
      };

      // Calculate new ratings
      const newRatings = calculateMatchRatings(
        player1Rating,
        player2Rating,
        player3Rating,
        player4Rating,
        winnerTeam === 1 ? 1 : 0,
        winnerTeam === 2 ? 1 : 0
      );

      // Prepare match data for Supabase
      const matchData: MatchData = {
        player1_id: session?.user?.id as string,
        player2_id: selectedFriends[0],
        player3_id: selectedFriends[1],
        player4_id: selectedFriends[2],
        team1_score_set1: set1Score.team1,
        team2_score_set1: set1Score.team2,
        team1_score_set2: set2Score.team1,
        team2_score_set2: set2Score.team2,
        team1_score_set3: showSet3 ? set3Score.team1 : null,
        team2_score_set3: showSet3 ? set3Score.team2 : null,
        winner_team: winnerTeam,
        status: 4, // Completed
        completed_at: new Date().toISOString(),
        start_time: matchStartTime.toISOString(),
        end_time: matchEndTime.toISOString(),
        region: region || null,
        court: court || null
      };

      // Insert match into Supabase
      const { data: matchResult, error: matchError } = await supabase
        .from('matches')
        .insert(matchData)
        .select()
        .single();

      if (matchError) throw matchError;

      // Update player ratings
      const updatePromises = [
        supabase.from('profiles').update({
          glicko_rating: Math.round(newRatings.player1.rating).toString(),
          glicko_rd: Math.round(newRatings.player1.rd).toString(),
          glicko_vol: newRatings.player1.vol.toFixed(6)
        }).eq('id', player1Profile.id),
        
        supabase.from('profiles').update({
          glicko_rating: Math.round(newRatings.player2.rating).toString(),
          glicko_rd: Math.round(newRatings.player2.rd).toString(),
          glicko_vol: newRatings.player2.vol.toFixed(6)
        }).eq('id', player2Profile.id),
        
        supabase.from('profiles').update({
          glicko_rating: Math.round(newRatings.player3.rating).toString(),
          glicko_rd: Math.round(newRatings.player3.rd).toString(),
          glicko_vol: newRatings.player3.vol.toFixed(6)
        }).eq('id', player3Profile.id),
        
        supabase.from('profiles').update({
          glicko_rating: Math.round(newRatings.player4.rating).toString(),
          glicko_rd: Math.round(newRatings.player4.rd).toString(),
          glicko_vol: newRatings.player4.vol.toFixed(6)
        }).eq('id', player4Profile.id)
      ];

      await Promise.all(updatePromises);

      // Show success message with rating change
      const ratingDiff = Math.round(newRatings.player1.rating - player1Rating.rating);
      Alert.alert(
        'Match Created', 
        `Match created successfully! Your rating changed by ${ratingDiff > 0 ? '+' : ''}${ratingDiff} points.`,
        [{ text: 'OK', onPress: () => router.push('/(protected)/(tabs)') }]
      );
      
    } catch (error) {
      console.error('Error creating match:', error);
      Alert.alert('Error', `Failed to create match: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderPlayerSection = () => (
    <View style={styles.section}>
      <H3 className="mb-2">Players</H3>
      
      <View style={styles.playersContainer}>
        {/* Current user (Player 1) */}
        <View style={styles.playerCard}>
          <View style={styles.playerAvatar}>
            <Text className="text-lg font-bold text-primary-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 
               session?.user?.email?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text className="text-sm font-medium mt-1">You</Text>
          <Text className="text-xs text-muted-foreground">Team 1</Text>
        </View>
        
        {/* Player selection button */}
        {selectedPlayers.length < 3 && (
          <TouchableOpacity 
            style={styles.addPlayerButton}
            onPress={() => setShowPlayerModal(true)}
          >
            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={30} color="#fbbf24" />
            </View>
            <Text className="text-sm font-medium mt-1">Add Players</Text>
            <Text className="text-xs text-muted-foreground">
              {selectedPlayers.length}/3 selected
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Selected players */}
        {selectedPlayers.map((player, index) => (
          <View 
            key={player.id} 
            style={styles.playerCard}
          >
            <View style={[
              styles.playerAvatar,
              { backgroundColor: index === 0 ? '#fbbf24' : '#6366f1' }
            ]}>
              <Text className="text-lg font-bold text-primary-foreground">
                {player.full_name?.charAt(0)?.toUpperCase() || 
                 player.email?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text className="text-sm font-medium mt-1" numberOfLines={1}>
              {player.full_name || player.email?.split('@')[0]}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {index === 0 ? 'Team 1' : 'Team 2'}
            </Text>
          </View>
        ))}
      </View>
      
      {selectedPlayers.length > 0 && (
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setShowPlayerModal(true)}
        >
          <Ionicons name="create-outline" size={16} color="#555" />
          <Text className="text-sm text-muted-foreground ml-1">
            Edit Players
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTimeSection = () => (
    <View style={styles.section}>
      <H3 className="mb-4">Date & Time</H3>
      
      <CustomDateTimePicker
        label="Match Date"
        value={matchDate}
        onChange={setMatchDate}
        mode="date"
        maximumDate={new Date()}
      />
      
      <CustomDateTimePicker
        label="Start Time"
        value={matchStartTime}
        onChange={setMatchStartTime}
        mode="time"
      />
      
      <CustomDateTimePicker
        label="End Time"
        value={matchEndTime}
        onChange={setMatchEndTime}
        mode="time"
      />
    </View>
  );

  const renderScoreSection = () => (
    <View style={styles.section}>
      <H3 className="mb-4">Match Score</H3>
      
      <SetScoreInput
        setNumber={1}
        value={set1Score}
        onChange={setSet1Score}
        onValidate={setIsSet1Valid}
      />
      
      <SetScoreInput
        setNumber={2}
        value={set2Score}
        onChange={setSet2Score}
        onValidate={setIsSet2Valid}
      />
      
      {showSet3 && (
        <SetScoreInput
          setNumber={3}
          value={set3Score}
          onChange={setSet3Score}
          onValidate={setIsSet3Valid}
        />
      )}
      
      {isSet1Valid && isSet2Valid && (
        <View style={styles.winnerDisplay}>
          <Text className="text-lg font-semibold text-center">
            Winner: {determineWinnerTeam() === 1 ? 'Team 1' : 'Team 2'}
          </Text>
          <Text className="text-muted-foreground text-center">
            {determineWinnerTeam() === 1 
              ? 'You and Player 2 won this match' 
              : 'Player 3 and Player 4 won this match'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fbbf24"
            colors={['#fbbf24']}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fbbf24" />
          </TouchableOpacity>
          <H1>Create Match</H1>
        </View>

        <Text className="text-muted-foreground mb-6">
          Record a match that already happened. All players will have their ratings updated.
        </Text>
        
        {renderPlayerSection()}
        {renderTimeSection()}
        {renderScoreSection()}
        
        <Button
          className="w-full mt-6 mb-10"
          size="lg"
          variant="default"
          onPress={createMatch}
          disabled={loading || !isSet1Valid || !isSet2Valid || (showSet3 && !isSet3Valid) || selectedFriends.length !== 3}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-primary-foreground font-medium">Create Match</Text>
          )}
        </Button>
      </ScrollView>
      
      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={setSelectedFriends}
        loading={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    marginRight: 12,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  playerCard: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  playerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlayerButton: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  addIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    padding: 8,
  },
  winnerDisplay: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#fbbf24',
  }
});