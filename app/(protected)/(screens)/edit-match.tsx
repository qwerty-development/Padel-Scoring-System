import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  TextInput,
  Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3 } from "@/components/ui/typography";
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';

import { PlayerSelectionModal } from '@/components/create-match/PlayerSelectionModal';
import { CustomDateTimePicker } from '@/components/create-match/DateTimePicker';
import { SetScoreInput, SetScore } from '@/components/create-match/SetScoreInput';

// Match Status Enum
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  RECRUITING = 5,
}

interface EditableMatch {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  is_public: boolean;
  description: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  completed_at: string | null;
  created_at: string;
  player1?: any;
  player2?: any;
  player3?: any;
  player4?: any;
}

interface Friend {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  glicko_rating: string | null;
}

// Edit Permission Calculator
const calculateEditPermissions = (match: EditableMatch, userId: string) => {
  const now = new Date();
  const startTime = new Date(match.start_time);
  const endTime = match.end_time ? new Date(match.end_time) : null;
  const completedTime = match.completed_at ? new Date(match.completed_at) : null;
  
  const isCreator = match.player1_id === userId;
  const isFuture = startTime > now;
  const isPast = endTime ? endTime < now : startTime < now;
  
  // Calculate hours since completion
  const hoursSinceCompletion = completedTime 
    ? (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60)
    : endTime && isPast
      ? (now.getTime() - endTime.getTime()) / (1000 * 60 * 60)
      : 0;
  
  // Calculate minutes until start
  const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
  
  const permissions = {
    canEdit: isCreator,
    canEditDateTime: isFuture && minutesUntilStart > 30, // Can edit if more than 30 min before start
    canEditPlayers: isFuture && minutesUntilStart > 60, // Can edit if more than 1 hour before start
    canEditLocation: hoursSinceCompletion < 24,
    canEditVisibility: isFuture && minutesUntilStart > 30,
    canEditDescription: hoursSinceCompletion < 24,
    canEditScores: isPast && hoursSinceCompletion < 2 && match.status !== MatchStatus.COMPLETED,
    isLocked: match.status === MatchStatus.COMPLETED && hoursSinceCompletion > 24,
    reason: '',
    warningMessage: ''
  };
  
  // Set reason and warning messages
  if (!isCreator) {
    permissions.reason = 'Only the match creator can edit';
  } else if (permissions.isLocked) {
    permissions.reason = 'Match is locked after 24 hours';
  } else if (minutesUntilStart <= 30 && isFuture) {
    permissions.warningMessage = 'Match starting soon - limited editing available';
  } else if (hoursSinceCompletion > 2 && hoursSinceCompletion < 24) {
    permissions.warningMessage = 'Only location details can be edited';
  }
  
  return permissions;
};

export default function EditMatchScreen() {
  const { matchId } = useLocalSearchParams();
  const { profile, session } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [match, setMatch] = useState<EditableMatch | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  
  // Form state
  const [matchDate, setMatchDate] = useState(new Date());
  const [matchStartTime, setMatchStartTime] = useState(new Date());
  const [matchEndTime, setMatchEndTime] = useState(new Date());
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [region, setRegion] = useState('');
  const [court, setCourt] = useState('');
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [matchDescription, setMatchDescription] = useState('');
  
  // Score state
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);
  
  // Calculate edit permissions
  const editPermissions = useMemo(() => {
    if (!match || !session?.user?.id) return null;
    return calculateEditPermissions(match, session.user.id);
  }, [match, session?.user?.id]);
  
  // Fetch match data
  useEffect(() => {
    if (matchId) {
      fetchMatchData();
    }
  }, [matchId]);
  
  // Fetch friends list
  useEffect(() => {
    if (profile?.friends_list && profile.friends_list.length > 0) {
      fetchFriends();
    }
  }, [profile]);
  
  // Update form when match data loads
  useEffect(() => {
    if (match) {
      initializeFormData();
    }
  }, [match]);
  
  // Update show set 3 based on scores
  useEffect(() => {
    if (match?.team1_score_set1 !== null) {
      const team1WonSet1 = set1Score.team1 > set1Score.team2;
      const team1WonSet2 = set2Score.team1 > set2Score.team2;
      const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);
      
      setShowSet3(isTied && isSet1Valid && isSet2Valid);
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid, match]);
  
  const fetchMatchData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `)
        .eq('id', matchId)
        .single();
      
      if (error) throw error;
      
      setMatch(data);
    } catch (error) {
      console.error('Error fetching match:', error);
      Alert.alert('Error', 'Failed to load match details');
      router.back();
    } finally {
      setLoading(false);
    }
  };
  
  const fetchFriends = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, glicko_rating')
        .in('id', profile!.friends_list);
      
      if (!error && data) {
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };
  
  const initializeFormData = () => {
    if (!match) return;
    
    // Initialize date/time
    const startTime = new Date(match.start_time);
    const endTime = match.end_time ? new Date(match.end_time) : new Date(startTime);
    endTime.setHours(endTime.getHours() + 1, 30);
    
    setMatchDate(startTime);
    setMatchStartTime(startTime);
    setMatchEndTime(endTime);
    
    // Initialize players
    const friendIds = [match.player2_id, match.player3_id, match.player4_id]
      .filter(id => id !== null && id !== session?.user?.id) as string[];
    setSelectedFriends(friendIds);
    
    // Initialize location
    setRegion(match.region || '');
    setCourt(match.court || '');
    setIsPublicMatch(match.is_public);
    setMatchDescription(match.description || '');
    
    // Initialize scores if they exist
    if (match.team1_score_set1 !== null) {
      setSet1Score({
        team1: match.team1_score_set1,
        team2: match.team2_score_set1 || 0
      });
      setIsSet1Valid(true);
    }
    
    if (match.team1_score_set2 !== null) {
      setSet2Score({
        team1: match.team1_score_set2,
        team2: match.team2_score_set2 || 0
      });
      setIsSet2Valid(true);
    }
    
    if (match.team1_score_set3 !== null) {
      setSet3Score({
        team1: match.team1_score_set3,
        team2: match.team2_score_set3 || 0
      });
      setIsSet3Valid(true);
      setShowSet3(true);
    }
  };
  
  // Update selected players when friends change
  useEffect(() => {
    if (selectedFriends.length > 0 && friends.length > 0) {
      const selected = friends.filter(friend => selectedFriends.includes(friend.id));
      setSelectedPlayers(selected);
    }
  }, [selectedFriends, friends]);
  
  const validateChanges = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!editPermissions?.canEdit) {
      errors.push('You do not have permission to edit this match');
      return { isValid: false, errors };
    }
    
    // Validate date/time if editable
    if (editPermissions.canEditDateTime) {
      const combinedStartTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchStartTime.getHours(),
        matchStartTime.getMinutes()
      );
      
      const combinedEndTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchEndTime.getHours(),
        matchEndTime.getMinutes()
      );
      
      if (combinedEndTime <= combinedStartTime) {
        errors.push('End time must be after start time');
      }
      
      const now = new Date();
      if (combinedStartTime <= now) {
        errors.push('Cannot set match time in the past');
      }
    }
    
    // Validate scores if editable
    if (editPermissions.canEditScores) {
      if (!isSet1Valid || !isSet2Valid) {
        errors.push('Please enter valid scores for both sets');
      }
      
      if (showSet3 && !isSet3Valid) {
        errors.push('Please enter a valid score for the third set');
      }
    }
    
    // Validate public match requirements
    if (isPublicMatch && !region.trim()) {
      errors.push('Public matches require a location');
    }
    
    return { isValid: errors.length === 0, errors };
  };
  
  const hasChanges = (): boolean => {
    if (!match) return false;
    
    // Check date/time changes
    const originalStart = new Date(match.start_time);
    const newStart = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes()
    );
    
    if (originalStart.getTime() !== newStart.getTime()) return true;
    
    // Check player changes
    const originalPlayers = [match.player2_id, match.player3_id, match.player4_id]
      .filter(id => id !== null) as string[];
    if (JSON.stringify(originalPlayers.sort()) !== JSON.stringify(selectedFriends.sort())) return true;
    
    // Check other fields
    if (region !== (match.region || '')) return true;
    if (court !== (match.court || '')) return true;
    if (isPublicMatch !== match.is_public) return true;
    if (matchDescription !== (match.description || '')) return true;
    
    // Check scores
    if (match.team1_score_set1 !== set1Score.team1) return true;
    if (match.team2_score_set1 !== set1Score.team2) return true;
    if (match.team1_score_set2 !== set2Score.team1) return true;
    if (match.team2_score_set2 !== set2Score.team2) return true;
    
    return false;
  };
  
  const determineWinnerTeam = (): number => {
    let team1Sets = 0;
    let team2Sets = 0;
    
    if (set1Score.team1 > set1Score.team2) team1Sets++;
    else if (set1Score.team2 > set1Score.team1) team2Sets++;
    
    if (set2Score.team1 > set2Score.team2) team1Sets++;
    else if (set2Score.team2 > set2Score.team1) team2Sets++;
    
    if (showSet3) {
      if (set3Score.team1 > set3Score.team2) team1Sets++;
      else if (set3Score.team2 > set3Score.team1) team2Sets++;
    }
    
    return team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0;
  };
  
const saveChanges = async () => {
  try {
    setSaving(true);
    
    if (!match || !session?.user?.id) {
      Alert.alert('Error', 'Unable to save changes');
      return;
    }
    
    const validation = validateForm();
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }
    
    // Track what fields were edited for the notification
    const editedFields: string[] = [];
    
    // Prepare update data
    const updateData: any = {};
    
    // Check for date/time changes
    if (editPermissions?.canEditDateTime) {
      const newStartTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchStartTime.getHours(),
        matchStartTime.getMinutes()
      ).toISOString();
      
      const newEndTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchEndTime.getHours(),
        matchEndTime.getMinutes()
      ).toISOString();
      
      if (newStartTime !== match.start_time) {
        updateData.start_time = newStartTime;
        editedFields.push('Start time');
      }
      
      if (newEndTime !== match.end_time) {
        updateData.end_time = newEndTime;
        editedFields.push('End time');
      }
    }
    
    // Check for location changes
    if (editPermissions?.canEditLocation) {
      if (region !== (match.region || '')) {
        updateData.region = region.trim() || null;
        editedFields.push('Location');
      }
      
      if (court !== (match.court || '')) {
        updateData.court = court.trim() || null;
        editedFields.push('Court');
      }
    }
    
    // Check for visibility changes
    if (editPermissions?.canEditVisibility) {
      if (isPublicMatch !== match.is_public) {
        updateData.is_public = isPublicMatch;
        editedFields.push(isPublicMatch ? 'Made public' : 'Made private');
      }
    }
    
    // Check for description changes
    if (editPermissions?.canEditDescription) {
      if (matchDescription !== (match.description || '')) {
        updateData.description = matchDescription.trim() || null;
        editedFields.push('Description');
      }
    }
    
    // Check for player changes
    if (editPermissions?.canEditPlayers) {
      const currentPlayerIds = [
        match.player2_id,
        match.player3_id,
        match.player4_id
      ].filter(Boolean);
      
      const newPlayerIds = selectedFriends.slice(0, 3).filter(Boolean);
      
      if (JSON.stringify(currentPlayerIds) !== JSON.stringify(newPlayerIds)) {
        updateData.player2_id = newPlayerIds[0] || null;
        updateData.player3_id = newPlayerIds[1] || null;
        updateData.player4_id = newPlayerIds[2] || null;
        editedFields.push('Players');
      }
    }
    
    // Check for score changes
    if (editPermissions?.canEditScores) {
      const scoreUpdates: any = {};
      
      if (set1Score.team1 !== (match.team1_score_set1 || 0)) {
        scoreUpdates.team1_score_set1 = set1Score.team1;
        editedFields.push('Scores');
      }
      
      if (set1Score.team2 !== (match.team2_score_set1 || 0)) {
        scoreUpdates.team2_score_set1 = set1Score.team2;
        editedFields.push('Scores');
      }
      
      if (set2Score.team1 !== (match.team1_score_set2 || 0)) {
        scoreUpdates.team1_score_set2 = set2Score.team1;
        editedFields.push('Scores');
      }
      
      if (set2Score.team2 !== (match.team2_score_set2 || 0)) {
        scoreUpdates.team2_score_set2 = set2Score.team2;
        editedFields.push('Scores');
      }
      
      if (showSet3) {
        if (set3Score.team1 !== (match.team1_score_set3 || 0)) {
          scoreUpdates.team1_score_set3 = set3Score.team1;
          editedFields.push('Scores');
        }
        
        if (set3Score.team2 !== (match.team2_score_set3 || 0)) {
          scoreUpdates.team2_score_set3 = set3Score.team2;
          editedFields.push('Scores');
        }
      }
      
      Object.assign(updateData, scoreUpdates);
    }
    
    // Only proceed if there are actual changes
    if (Object.keys(updateData).length === 0) {
      Alert.alert('No Changes', 'No changes detected to save');
      return;
    }
    
    // Remove duplicates from edited fields
    const uniqueEditedFields = [...new Set(editedFields)];
    
    // Add updated_by field to track who made the edit
    updateData.updated_by = session.user.id;
    
    // Update the match in the database
    const { error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', match.id);
    
    if (error) {
      throw error;
    }
    
    // Send notification to other players about the match edit
    if (profile?.full_name && uniqueEditedFields.length > 0) {
      const allPlayerIds = [
        match.player1_id,
        match.player2_id,
        match.player3_id,
        match.player4_id
      ].filter(Boolean);
      
      // Import the notification helper
      const { NotificationHelpers } = await import('@/services/notificationHelpers');
      
      await NotificationHelpers.sendMatchEditedNotification(
        allPlayerIds,
        session.user.id,
        profile.full_name,
        match.id,
        uniqueEditedFields
      );
    }
    
    Vibration.vibrate([100, 50, 100]);
    
    Alert.alert(
      'Match Updated',
      `Match has been updated successfully.${uniqueEditedFields.length > 0 ? `\n\nUpdated: ${uniqueEditedFields.join(', ')}` : ''}`,
      [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]
    );
    
  } catch (error) {
    console.error('Error updating match:', error);
    Vibration.vibrate(300);
    Alert.alert('Error', 'Failed to update match. Please try again.');
  } finally {
    setSaving(false);
  }
};
  
  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2148ce" />
          <Text className="mt-4 text-muted-foreground">Loading match details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Permission denied state
  if (!editPermissions?.canEdit) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#2148ce" />
          </TouchableOpacity>
          <H1>Edit Match</H1>
        </View>
        
        <View className="bg-red-50 dark:bg-red-900/30 rounded-xl p-6 items-center">
          <Ionicons name="lock-closed-outline" size={48} color="#dc2626" />
          <Text className="text-lg font-medium mt-4 mb-2">Permission Denied</Text>
          <Text className="text-muted-foreground text-center">
            {editPermissions?.reason || 'You do not have permission to edit this match'}
          </Text>
          <Button
            variant="outline"
            className="mt-6"
            onPress={() => router.back()}
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }
  
  // Match locked state
  if (editPermissions?.isLocked) {
    return (
      <SafeAreaView className="flex-1 bg-background p-6">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#2148ce" />
          </TouchableOpacity>
          <H1>Edit Match</H1>
        </View>
        
        <View className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-6 items-center">
          <Ionicons name="time-outline" size={48} color="#d97706" />
          <Text className="text-lg font-medium mt-4 mb-2">Match Locked</Text>
          <Text className="text-muted-foreground text-center">
            This match is locked and cannot be edited after 24 hours
          </Text>
          <Button
            variant="outline"
            className="mt-6"
            onPress={() => router.back()}
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row items-center pt-4 pb-2">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#2148ce" />
          </TouchableOpacity>
          <H1>Edit Match</H1>
        </View>
        
        {/* Warning Banner */}
        {editPermissions?.warningMessage && (
          <View className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mb-4 flex-row items-center">
            <Ionicons name="warning-outline" size={20} color="#d97706" style={{ marginRight: 8 }} />
            <Text className="text-sm text-amber-800 dark:text-amber-200 flex-1">
              {editPermissions.warningMessage}
            </Text>
          </View>
        )}
        
        {/* Date & Time Section */}
        {editPermissions?.canEditDateTime ? (
          <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
            <H3 className="mb-4">Date & Time</H3>
            
            <CustomDateTimePicker
              label="Match Date"
              value={matchDate}
              onChange={setMatchDate}
              mode="date"
              minimumDate={new Date()}
            />
            
            <View className="flex-row gap-4 mt-4">
              <View className="flex-1">
                <CustomDateTimePicker
                  label="Start Time"
                  value={matchStartTime}
                  onChange={setMatchStartTime}
                  mode="time"
                />
              </View>
              <View className="flex-1">
                <CustomDateTimePicker
                  label="End Time"
                  value={matchEndTime}
                  onChange={setMatchEndTime}
                  mode="time"
                />
              </View>
            </View>
          </View>
        ) : match && (
          <View className="mb-6 p-4 rounded-xl bg-muted/30 border border-border/30">
            <View className="flex-row items-center">
              <Ionicons name="lock-closed-outline" size={16} color="#888" style={{ marginRight: 8 }} />
              <Text className="text-sm text-muted-foreground">
                Date & time cannot be edited (match starting soon)
              </Text>
            </View>
          </View>
        )}
        
        {/* Players Section */}
        {editPermissions?.canEditPlayers ? (
          <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
            <H3 className="mb-4">Players</H3>
            
            <View className="bg-muted/20 rounded-lg p-3 mb-4">
              <Text className="text-sm text-muted-foreground">
                Selected: You + {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''}
              </Text>
            </View>
            
            <Button
              variant="outline"
              onPress={() => setShowPlayerModal(true)}
            >
              <Ionicons name="people-outline" size={18} style={{ marginRight: 8 }} />
              <Text>Change Players</Text>
            </Button>
          </View>
        ) : (
          <View className="mb-6 p-4 rounded-xl bg-muted/30 border border-border/30">
            <View className="flex-row items-center">
              <Ionicons name="lock-closed-outline" size={16} color="#888" style={{ marginRight: 8 }} />
              <Text className="text-sm text-muted-foreground">
                Players cannot be edited
              </Text>
            </View>
          </View>
        )}
        
        {/* Location Section */}
        {editPermissions?.canEditLocation && (
          <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
            <H3 className="mb-4">Location</H3>
            
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2 text-muted-foreground">
                Region/Location {isPublicMatch && '*'}
              </Text>
              <TextInput
                className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
                value={region}
                onChangeText={setRegion}
                placeholder="City, venue, or area"
                placeholderTextColor="#888"
              />
            </View>
            
            <View>
              <Text className="text-sm font-medium mb-2 text-muted-foreground">Court</Text>
              <TextInput
                className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
                value={court}
                onChangeText={setCourt}
                placeholder="Court name or number"
                placeholderTextColor="#888"
              />
            </View>
          </View>
        )}
        
        {/* Match Settings */}
        {(editPermissions?.canEditVisibility || editPermissions?.canEditDescription) && (
          <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
            <H3 className="mb-4">Match Settings</H3>
            
            {editPermissions.canEditVisibility && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-medium text-muted-foreground">Visibility</Text>
                  <View className="flex-row items-center">
                    <Text className={`text-sm mr-3 ${!isPublicMatch ? 'font-medium' : 'text-muted-foreground'}`}>
                      Private
                    </Text>
                    <TouchableOpacity
                      className={`w-12 h-6 rounded-full ${isPublicMatch ? 'bg-primary' : 'bg-muted'}`}
                      onPress={() => setIsPublicMatch(!isPublicMatch)}
                    >
                      <View className={`w-5 h-5 rounded-full bg-white m-0.5 ${
                        isPublicMatch ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </TouchableOpacity>
                    <Text className={`text-sm ml-3 ${isPublicMatch ? 'font-medium' : 'text-muted-foreground'}`}>
                      Public
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            {editPermissions.canEditDescription && (
              <View>
                <Text className="text-sm font-medium mb-2 text-muted-foreground">Description</Text>
                <TextInput
                  className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-3 text-foreground"
                  value={matchDescription}
                  onChangeText={setMatchDescription}
                  placeholder="Add match details..."
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={2}
                  maxLength={200}
                />
              </View>
            )}
          </View>
        )}
        
        {/* Scores Section */}
        {editPermissions?.canEditScores && (
          <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
            <H3 className="mb-4">Match Scores</H3>
            
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
          </View>
        )}
        
        {/* Action Buttons */}
        <View className="flex-row gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => router.back()}
          >
            <Text>Cancel</Text>
          </Button>
          
          <Button
            variant="default"
            className="flex-1"
            onPress={saveChanges}
            disabled={saving || !hasChanges()}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-primary-foreground">
                {hasChanges() ? 'Save Changes' : 'No Changes'}
              </Text>
            )}
          </Button>
        </View>
      </ScrollView>
      
      {/* Player Selection Modal */}
      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={setSelectedFriends}
        loading={false}
        maxSelections={3}
      />
    </SafeAreaView>
  );
}