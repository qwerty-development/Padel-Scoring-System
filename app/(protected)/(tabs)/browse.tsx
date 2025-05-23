import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl, 
  TouchableOpacity, 
  Alert,
  TextInput,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { H1, H2, H3 } from '@/components/ui/typography';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';
import { useColorScheme } from '@/lib/useColorScheme';

// CORRECTED MATCH STATUS ENUM WITH PROPER TYPE HANDLING
export enum MatchStatus {
  PENDING = 1,           // Future match, waiting for start time
  NEEDS_CONFIRMATION = 2, // Match finished, waiting for score confirmation
  CANCELLED = 3,         // Match was cancelled
  COMPLETED = 4,         // Match completed with scores recorded
  RECRUITING = 5,        // Public match looking for players
}

// ENHANCED INTERFACE WITH TYPE-SAFE STATUS HANDLING
interface EnhancedMatchData {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number | string; // Handle both string and number types from database
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  is_public: boolean;
  description: string | null;
  created_at: string;
  player1?: { id: string; full_name: string | null; email: string; glicko_rating: string | null; };
  player2?: { id: string; full_name: string | null; email: string; glicko_rating: string | null; };
  player3?: { id: string; full_name: string | null; email: string; glicko_rating: string | null; };
  player4?: { id: string; full_name: string | null; email: string; glicko_rating: string | null; };
  // Computed properties
  isCurrentUserInMatch?: boolean;
  availablePositions?: number[];
  averageSkillLevel?: number;
  skillRange?: { min: number; max: number; };
  timeUntilMatch?: number;
  normalizedStatus?: number; // Normalized numeric status for consistent filtering
}

// SIMPLIFIED FILTER STATE
interface FilterState {
  searchQuery: string;
  availableSlotsOnly: boolean;
  sortBy: 'time' | 'skill' | 'availability';
  sortOrder: 'asc' | 'desc';
}

// UTILITY FUNCTIONS FOR STATUS NORMALIZATION
const normalizeStatus = (status: number | string): number => {
  // Convert string status to number for consistent comparison
  if (typeof status === 'string') {
    const numericStatus = parseInt(status, 10);
    return isNaN(numericStatus) ? 0 : numericStatus;
  }
  return status;
};

const isValidPublicMatchStatus = (status: number | string): boolean => {
  const normalizedStatus = normalizeStatus(status);
  // Accept both PENDING (1) and RECRUITING (5) for public matches
  return normalizedStatus === MatchStatus.PENDING || normalizedStatus === MatchStatus.RECRUITING;
};

// SKILL LEVEL UTILITY FUNCTIONS
const getSkillLevelDescription = (rating: number): string => {
  if (rating < 1300) return 'Beginner';
  if (rating < 1500) return 'Intermediate';
  if (rating < 1700) return 'Advanced';
  if (rating < 1900) return 'Expert';
  if (rating < 2100) return 'Professional';
  return 'Elite';
};

const getSkillLevelColor = (rating: number): string => {
  if (rating < 1300) return '#84cc16'; // lime-500
  if (rating < 1500) return '#eab308'; // yellow-500
  if (rating < 1700) return '#f97316'; // orange-500
  if (rating < 1900) return '#dc2626'; // red-600
  if (rating < 2100) return '#7c3aed'; // violet-600
  return '#1e40af'; // blue-700
};

export default function FixedPublicMatches() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile, session } = useAuth();
  
  // CORE STATE MANAGEMENT
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publicMatches, setPublicMatches] = useState<EnhancedMatchData[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  // FILTER STATE
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    availableSlotsOnly: false,
    sortBy: 'time',
    sortOrder: 'asc'
  });

  // USER SKILL LEVEL CALCULATION
  const userSkillLevel = useMemo(() => {
    return profile?.glicko_rating ? parseFloat(profile.glicko_rating) : 1500;
  }, [profile?.glicko_rating]);

  // ENHANCED MATCH DATA PROCESSING WITH STATUS NORMALIZATION
  const processMatchData = useCallback((matches: any[]): EnhancedMatchData[] => {
    console.log('🔍 PROCESSING MATCH DATA:', {
      totalMatches: matches.length,
      sampleMatch: matches[0],
      userSessionId: session?.user?.id
    });

    return matches.map((match, index) => {
      console.log(`🏓 Processing match ${index + 1}:`, {
        matchId: match.id,
        isPublic: match.is_public,
        status: match.status,
        statusType: typeof match.status,
        normalizedStatus: normalizeStatus(match.status),
        startTime: match.start_time,
        players: {
          player1: match.player1_id,
          player2: match.player2_id,
          player3: match.player3_id,
          player4: match.player4_id
        }
      });

      // Check if current user is in match
      const isCurrentUserInMatch = 
        match.player1_id === session?.user?.id || 
        match.player2_id === session?.user?.id || 
        match.player3_id === session?.user?.id || 
        match.player4_id === session?.user?.id;
      
      // Calculate available positions
      const availablePositions: number[] = [];
      if (!match.player1_id) availablePositions.push(1);
      if (!match.player2_id) availablePositions.push(2);
      if (!match.player3_id) availablePositions.push(3);
      if (!match.player4_id) availablePositions.push(4);
      
      // Calculate skill levels with enhanced error handling
      const playerRatings = [
        match.player1?.glicko_rating,
        match.player2?.glicko_rating,
        match.player3?.glicko_rating,
        match.player4?.glicko_rating
      ].filter(Boolean).map(rating => {
        const parsed = parseFloat(rating);
        return isNaN(parsed) ? 1500 : parsed;
      });
      
      const averageSkillLevel = playerRatings.length > 0 
        ? playerRatings.reduce((sum, rating) => sum + rating, 0) / playerRatings.length
        : 1500;
      
      const skillRange = playerRatings.length > 0 
        ? { min: Math.min(...playerRatings), max: Math.max(...playerRatings) }
        : { min: 1500, max: 1500 };
      
      // Calculate time until match
      const timeUntilMatch = new Date(match.start_time).getTime() - new Date().getTime();
      
      // Normalize status for consistent filtering
      const normalizedStatus = normalizeStatus(match.status);
      
      const processedMatch = {
        ...match,
        isCurrentUserInMatch,
        availablePositions,
        averageSkillLevel,
        skillRange,
        timeUntilMatch,
        normalizedStatus
      };

      console.log(`✅ Processed match ${index + 1}:`, {
        matchId: processedMatch.id,
        originalStatus: match.status,
        normalizedStatus: processedMatch.normalizedStatus,
        availablePositions: processedMatch.availablePositions,
        isCurrentUserInMatch: processedMatch.isCurrentUserInMatch,
        timeUntilMatch: processedMatch.timeUntilMatch
      });

      return processedMatch;
    });
  }, [session?.user?.id]);

  // CORRECTED FILTERING LOGIC WITH PROPER STATUS HANDLING
  const filteredMatches = useMemo(() => {
    console.log('🔍 STARTING FILTER PROCESS:', {
      totalMatches: publicMatches.length,
      filters: filters,
      currentTime: new Date().toISOString()
    });

    if (!publicMatches.length) {
      console.log('❌ NO MATCHES TO FILTER');
      return [];
    }

    const now = new Date();
    console.log('⏰ CURRENT TIME:', now.toISOString());
    
    const results = publicMatches.filter((match, index) => {
      console.log(`🔍 Filtering match ${index + 1}:`, {
        matchId: match.id,
        startTime: match.start_time,
        originalStatus: match.status,
        normalizedStatus: match.normalizedStatus
      });

      // STEP 1: BASIC TIME FILTERING
      const startTime = new Date(match.start_time);
      const isFuture = startTime > now;
      
      console.log(`⏰ Time check for match ${match.id}:`, {
        startTime: startTime.toISOString(),
        isFuture: isFuture,
        timeDiff: startTime.getTime() - now.getTime()
      });

      if (!isFuture) {
        console.log(`❌ Match ${match.id} rejected: not future`);
        return false;
      }

      // STEP 2: CORRECTED STATUS FILTERING - ACCEPT BOTH PENDING AND RECRUITING
      const isValidStatus = isValidPublicMatchStatus(match.status);
      
      console.log(`📊 Status check for match ${match.id}:`, {
        originalStatus: match.status,
        statusType: typeof match.status,
        normalizedStatus: match.normalizedStatus,
        isValidStatus: isValidStatus,
        validStatusesAccepted: [MatchStatus.PENDING, MatchStatus.RECRUITING]
      });

      if (!isValidStatus) {
        console.log(`❌ Match ${match.id} rejected: invalid status`);
        return false;
      }

      // STEP 3: SEARCH QUERY FILTERING
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const searchableText = [
          match.region,
          match.court,
          match.description,
          match.player1?.full_name,
          match.player2?.full_name,
          match.player3?.full_name,
          match.player4?.full_name
        ].filter(Boolean).join(' ').toLowerCase();
        
        const matchesSearch = searchableText.includes(query);
        console.log(`🔍 Search check for match ${match.id}:`, {
          query: query,
          searchableText: searchableText,
          matchesSearch: matchesSearch
        });

        if (!matchesSearch) {
          console.log(`❌ Match ${match.id} rejected: search query`);
          return false;
        }
      }
      
      // STEP 4: AVAILABLE SLOTS FILTERING
      if (filters.availableSlotsOnly && (!match.availablePositions || match.availablePositions.length === 0)) {
        console.log(`❌ Match ${match.id} rejected: no available slots`);
        return false;
      }
      
      console.log(`✅ Match ${match.id} PASSED all filters`);
      return true;
    });

    console.log('🎯 FILTERING RESULTS:', {
      originalCount: publicMatches.length,
      filteredCount: results.length,
      rejectedCount: publicMatches.length - results.length
    });

    // STEP 5: SORTING LOGIC
    const sortedResults = results.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'time':
          comparison = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          break;
        case 'skill':
          comparison = Math.abs(a.averageSkillLevel - userSkillLevel) - 
                      Math.abs(b.averageSkillLevel - userSkillLevel);
          break;
        case 'availability':
          comparison = (b.availablePositions?.length || 0) - (a.availablePositions?.length || 0);
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    console.log('📊 FINAL SORTED RESULTS:', sortedResults.length);
    return sortedResults;
  }, [publicMatches, filters, userSkillLevel]);

  // ENHANCED DATA FETCHING WITH COMPREHENSIVE ERROR HANDLING
  const fetchPublicMatches = useCallback(async () => {
    try {
      console.log('🚀 STARTING FETCH PUBLIC MATCHES');
      setLoading(true);
      
      // STEP 1: BASIC MATCH QUERY WITHOUT COMPLEX FILTERING
      console.log('📡 Executing database query...');
      const { data: basicData, error: basicError } = await supabase
        .from('matches')
        .select('*')
        .eq('is_public', true);

      if (basicError) {
        console.error('❌ BASIC QUERY ERROR:', basicError);
        throw basicError;
      }

      console.log('📊 BASIC QUERY RESULTS:', {
        totalMatches: basicData?.length || 0,
        sampleMatch: basicData?.[0],
        allMatchStatuses: basicData?.map(m => ({ status: m.status, type: typeof m.status })) || []
      });

      setAllMatches(basicData || []);

      // STEP 2: ENHANCED QUERY WITH PROFILE JOINS
      console.log('📡 Executing enhanced query with profiles...');
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating),
          player2:profiles!player2_id(id, full_name, email, glicko_rating),
          player3:profiles!player3_id(id, full_name, email, glicko_rating),
          player4:profiles!player4_id(id, full_name, email, glicko_rating)
        `)
        .eq('is_public', true);

      if (error) {
        console.error('❌ ENHANCED QUERY ERROR:', error);
        throw error;
      }

      console.log('📊 ENHANCED QUERY RESULTS:', {
        totalMatches: data?.length || 0,
        sampleMatch: data?.[0],
        profileJoinSuccess: data?.[0]?.player1 ? 'SUCCESS' : 'NO_PROFILES',
        statusTypes: data?.map(m => ({ id: m.id, status: m.status, type: typeof m.status })) || []
      });

      // STEP 3: PROCESS MATCH DATA WITH STATUS NORMALIZATION
      const processedData = processMatchData(data || []);
      setPublicMatches(processedData);

      // STEP 4: GENERATE ENHANCED DEBUG INFORMATION
      const debugInformation = `
=== FIXED DEBUG INFORMATION ===
Query Timestamp: ${new Date().toISOString()}
Total Raw Matches: ${basicData?.length || 0}
Enhanced Matches: ${data?.length || 0}
Processed Matches: ${processedData.length}
User Session ID: ${session?.user?.id || 'NOT_FOUND'}
User Skill Level: ${userSkillLevel}

=== MATCH STATUS ANALYSIS ===
${basicData?.reduce((acc: any, match: any) => {
  const normalizedStatus = normalizeStatus(match.status);
  const key = `Status ${normalizedStatus} (${typeof match.status})`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {}) ? Object.entries(basicData.reduce((acc: any, match: any) => {
  const normalizedStatus = normalizeStatus(match.status);
  const key = `Status ${normalizedStatus} (${typeof match.status})`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {})).map(([status, count]) => `${status}: ${count} matches`).join('\n') : 'NO_MATCHES'}

=== STATUS VALIDATION RESULTS ===
${processedData.map(match => 
  `Match ${match.id}: Status ${match.status} (${typeof match.status}) -> Normalized: ${match.normalizedStatus} -> Valid: ${isValidPublicMatchStatus(match.status)}`
).join('\n')}

=== SAMPLE MATCH DATA ===
${data?.[0] ? JSON.stringify(data[0], null, 2) : 'NO_SAMPLE_AVAILABLE'}
      `;

      setDebugInfo(debugInformation);
      console.log('🐛 ENHANCED DEBUG INFO GENERATED');
      
    } catch (error) {
      console.error('💥 FETCH ERROR:', error);
      Alert.alert(
        'Data Loading Error',
        `Failed to load matches: ${error.message}. Please check your connection and try again.`,
        [
          { text: 'Show Debug Info', onPress: () => setShowDebugModal(true) },
          { text: 'OK' }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [processMatchData, session?.user?.id, userSkillLevel]);

  // OPTIMIZED REFRESH HANDLER
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPublicMatches();
  }, [fetchPublicMatches]);

  // ENHANCED JOIN MATCH LOGIC
  const handleJoinMatch = useCallback(async (match: EnhancedMatchData) => {
    console.log('🎯 JOIN MATCH ATTEMPT:', { matchId: match.id, userId: session?.user?.id });

    if (!session?.user?.id) {
      Alert.alert('Authentication Required', 'You must be logged in to join a match');
      return;
    }

    if (match.isCurrentUserInMatch) {
      router.push({
        pathname: '/(protected)/(screens)/match-details',
        params: { matchId: match.id }
      });
      return;
    }

    const positions = match.availablePositions || [];
    if (positions.length === 0) {
      Alert.alert('Match Full', 'This match is already full');
      return;
    }

    try {
      setJoining(match.id);
      
      // INTELLIGENT TEAM ASSIGNMENT BASED ON BALANCE
      const team1Positions = positions.filter(p => p === 1 || p === 2);
      const team2Positions = positions.filter(p => p === 3 || p === 4);
      
      if (team1Positions.length > 0 && team2Positions.length > 0) {
        // Calculate team averages for better balance
        const team1Players = [match.player1, match.player2].filter(Boolean);
        const team2Players = [match.player3, match.player4].filter(Boolean);
        
        const team1Avg = team1Players.length > 0 
          ? team1Players.reduce((sum, p) => sum + parseFloat(p.glicko_rating || '1500'), 0) / team1Players.length
          : 1500;
        
        const team2Avg = team2Players.length > 0 
          ? team2Players.reduce((sum, p) => sum + parseFloat(p.glicko_rating || '1500'), 0) / team2Players.length
          : 1500;
        
        // Join the team that would result in better balance
        const userRating = userSkillLevel;
        const team1BalanceScore = Math.abs((team1Avg + userRating) / (team1Players.length + 1) - team2Avg);
        const team2BalanceScore = Math.abs((team2Avg + userRating) / (team2Players.length + 1) - team1Avg);
        
        const preferredPosition = team1BalanceScore < team2BalanceScore 
          ? team1Positions[0] 
          : team2Positions[0];
        
        Alert.alert(
          'Choose Your Team',
          `We recommend Team ${preferredPosition <= 2 ? 1 : 2} for better balance, but you can choose any team.`,
          [
            {
              text: 'Team 1',
              onPress: () => joinTeam(match, team1Positions[0])
            },
            {
              text: 'Team 2', 
              onPress: () => joinTeam(match, team2Positions[0])
            },
            {
              text: 'Auto-Assign',
              onPress: () => joinTeam(match, preferredPosition),
              style: 'default'
            }
          ]
        );
      } else {
        // Only one team has openings
        await joinTeam(match, positions[0]);
      }
    } catch (error) {
      console.error('❌ JOIN MATCH ERROR:', error);
      Alert.alert('Error', 'Failed to join match. Please try again.');
    } finally {
      setJoining(null);
    }
  }, [session?.user?.id, router, userSkillLevel]);

  // TEAM JOIN IMPLEMENTATION
  const joinTeam = useCallback(async (match: EnhancedMatchData, position: number) => {
    try {
      console.log('🔄 JOINING TEAM:', { matchId: match.id, position, userId: session?.user?.id });
      
      const updateField = `player${position}_id`;
      
      const { error } = await supabase
        .from('matches')
        .update({ [updateField]: session?.user?.id })
        .eq('id', match.id);
      
      if (error) throw error;
      
      console.log('✅ SUCCESSFULLY JOINED TEAM');
      
      Alert.alert(
        'Successfully Joined!',
        'You have joined the match. Good luck!',
        [
          {
            text: 'View Match Details',
            onPress: () => router.push({
              pathname: '/(protected)/(screens)/match-details',
              params: { matchId: match.id }
            })
          },
          {
            text: 'Continue Browsing',
            onPress: () => fetchPublicMatches()
          }
        ]
      );
    } catch (error) {
      console.error('❌ JOIN TEAM ERROR:', error);
      Alert.alert('Error', 'Failed to join team. Please try again.');
    }
  }, [session?.user?.id, router, fetchPublicMatches]);

  // COMPONENT MOUNT EFFECT
  useEffect(() => {
    if (session?.user?.id) {
      fetchPublicMatches();
    }
  }, [session, fetchPublicMatches]);

  // ENHANCED MATCH CARD RENDERING WITH STATUS DISPLAY
  const renderMatchCard = useCallback((match: EnhancedMatchData, index: number) => {
    const startTime = new Date(match.start_time);
    const formattedDate = startTime.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short'
    });
    const formattedTime = startTime.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const availableSlots = match.availablePositions?.length || 0;
    const skillLevel = getSkillLevelDescription(match.averageSkillLevel);
    const skillColor = getSkillLevelColor(match.averageSkillLevel);
    
    const timeUntilMatch = match.timeUntilMatch || 0;
    const hoursUntil = Math.floor(timeUntilMatch / (1000 * 60 * 60));
    const daysUntil = Math.floor(hoursUntil / 24);
    
    const timeUntilText = daysUntil > 0 
      ? `${daysUntil}d ${hoursUntil % 24}h`
      : hoursUntil > 0 
        ? `${hoursUntil}h`
        : 'Soon';
    
    // Status display logic
    const getStatusDisplay = () => {
      const normalizedStatus = normalizeStatus(match.status);
      switch (normalizedStatus) {
        case MatchStatus.PENDING:
          return { text: 'Scheduled', color: '#3b82f6', bgColor: '#eff6ff' };
        case MatchStatus.RECRUITING:
          return { text: 'Recruiting', color: '#059669', bgColor: '#ecfdf5' };
        default:
          return { text: `Status ${normalizedStatus}`, color: '#6b7280', bgColor: '#f9fafb' };
      }
    };
    
    const statusInfo = getStatusDisplay();
    
    return (
      <View 
        key={`match-${match.id}-${index}`}
        className="mb-4 p-4 rounded-xl bg-card border border-border/30 shadow-sm"
      >
        {/* Header with Status Badge */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center mr-2">
              <Ionicons name="people-outline" size={16} color="#059669" />
            </View>
            <Text className="font-semibold">Public Match</Text>
            <View 
              className="ml-2 px-2 py-1 rounded-full"
              style={{ backgroundColor: statusInfo.bgColor }}
            >
              <Text 
                className="text-xs font-medium"
                style={{ color: statusInfo.color }}
              >
                {statusInfo.text}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-sm font-medium">{formattedDate}</Text>
            <Text className="text-xs text-muted-foreground">{formattedTime} • {timeUntilText}</Text>
          </View>
        </View>
        
        {/* Location and Court Info */}
        {(match.region || match.court) && (
          <View className="flex-row items-center mb-3">
            <Ionicons name="location-outline" size={16} color="#888" style={{ marginRight: 4 }} />
            <Text className="text-sm text-muted-foreground">
              {match.region}{match.court ? `, Court ${match.court}` : ''}
            </Text>
          </View>
        )}
        
        {/* Skill Level and Match Info */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View 
              className="px-2 py-1 rounded-full mr-2"
              style={{ backgroundColor: skillColor + '20' }}
            >
              <Text 
                className="text-xs font-medium"
                style={{ color: skillColor }}
              >
                {skillLevel}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              Avg: {Math.round(match.averageSkillLevel)}
            </Text>
          </View>
          
          <View className="flex-row items-center">
            <Ionicons name="people" size={14} color="#888" style={{ marginRight: 4 }} />
            <Text className="text-sm font-medium">
              {4 - availableSlots}/4 players
            </Text>
          </View>
        </View>
        
        {/* Team Composition */}
        <View className="flex-row justify-between mb-4">
          {/* Team 1 */}
          <View className="flex-1 mr-2">
            <Text className="text-sm font-medium mb-1 text-primary">Team 1</Text>
            <View className="space-y-1">
              {[match.player1, match.player2].map((player, idx) => (
                <Text key={idx} className="text-xs">
                  {player 
                    ? (player.full_name || player.email.split('@')[0])
                    : 'Open Position'
                  }
                </Text>
              ))}
            </View>
          </View>
          
          {/* VS Divider */}
          <View className="items-center justify-center px-2">
            <Text className="text-sm font-bold text-muted-foreground">VS</Text>
          </View>
          
          {/* Team 2 */}
          <View className="flex-1 ml-2">
            <Text className="text-sm font-medium mb-1 text-indigo-600">Team 2</Text>
            <View className="space-y-1">
              {[match.player3, match.player4].map((player, idx) => (
                <Text key={idx} className="text-xs">
                  {player 
                    ? (player.full_name || player.email.split('@')[0])
                    : 'Open Position'
                  }
                </Text>
              ))}
            </View>
          </View>
        </View>
        
        {/* Description */}
        {match.description && (
          <View className="mb-3 p-2 bg-muted/30 rounded">
            <Text className="text-sm italic">{match.description}</Text>
          </View>
        )}
        
        {/* Action Button */}
        <Button 
          size="sm" 
          variant={match.isCurrentUserInMatch ? "outline" : "default"} 
          className="w-full"
          onPress={() => handleJoinMatch(match)}
          disabled={joining === match.id}
        >
          {joining === match.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className={`text-sm ${match.isCurrentUserInMatch ? "text-primary" : "text-primary-foreground"}`}>
              {match.isCurrentUserInMatch 
                ? 'View Match Details' 
                : availableSlots > 0 
                  ? `Join Match (${availableSlots} ${availableSlots === 1 ? 'spot' : 'spots'} left)` 
                  : 'Match Full'
              }
            </Text>
          )}
        </Button>
      </View>
    );
  }, [handleJoinMatch, joining]);

  // DEBUG MODAL IMPLEMENTATION
  const renderDebugModal = () => (
    <Modal
      visible={showDebugModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDebugModal(false)}
    >
      <View className="flex-1 bg-black/50 justify-center p-4">
        <View className="bg-background rounded-xl max-h-[80%]">
          <View className="flex-row justify-between items-center p-4 border-b border-border">
            <H3>Debug Information</H3>
            <TouchableOpacity onPress={() => setShowDebugModal(false)}>
              <Ionicons name="close" size={24} color={colorScheme === 'dark' ? '#ddd' : '#333'} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4">
            <Text className="font-mono text-xs">{debugInfo}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // LOADING STATE
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1a7ebd" />
          <Text className="mt-4 text-muted-foreground">Loading public matches...</Text>
          <Button 
            variant="outline" 
            className="mt-4"
            onPress={() => setShowDebugModal(true)}
          >
            <Text>Show Debug Info</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // MAIN COMPONENT RENDER
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Enhanced Header with Debug Controls */}
      <View className="px-6 pt-6 pb-4 border-b border-border/30">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <H1>Public Matches</H1>
            <Text className="text-muted-foreground">
              {filteredMatches.length} available • {publicMatches.length} total
            </Text>
          </View>
          <View className="flex-row gap-2">
           
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center"
              onPress={() => fetchPublicMatches()}
            >
              <Ionicons name="refresh" size={20} color="#1a7ebd" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Quick Search */}
        <View className="flex-row items-center bg-muted/30 rounded-lg px-4 py-2">
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            className="flex-1 ml-2 text-foreground"
            placeholder="Quick search..."
            value={filters.searchQuery}
            onChangeText={(text) => setFilters(prev => ({ ...prev, searchQuery: text }))}
            placeholderTextColor="#888"
          />
          {filters.searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Enhanced Status Filters */}
        <View className="flex-row mt-3 gap-2">
          <TouchableOpacity
            className={`px-3 py-1 rounded-full ${
              filters.availableSlotsOnly 
                ? 'bg-primary' 
                : 'bg-muted/30'
            }`}
            onPress={() => setFilters(prev => ({ 
              ...prev, 
              availableSlotsOnly: !prev.availableSlotsOnly 
            }))}
          >
            <Text className={`text-xs ${
              filters.availableSlotsOnly ? 'text-primary-foreground' : 'text-foreground'
            }`}>
              Available Slots Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#1a7ebd"
            colors={['#1a7ebd']}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 20 }}
      >


        {filteredMatches.length > 0 ? (
          filteredMatches.map(renderMatchCard)
        ) : (
          <View className="bg-card rounded-xl p-8 items-center my-6">
            <Ionicons name="search-outline" size={48} color="#888" />
            <Text className="text-lg font-medium mt-4 mb-2">
              {publicMatches.length === 0 ? 'No public matches found' : 'No matches match your filters'}
            </Text>
            <Text className="text-muted-foreground text-center mb-4">
              {publicMatches.length === 0 
                ? 'There are no public matches in the database'
                : 'Try adjusting your search terms or filters'
              }
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => setShowDebugModal(true)}
              >
                <Text>Debug Info</Text>
              </Button>
              <Button
                variant="default"
                onPress={() => router.push('/(protected)/(screens)/create-match')}
              >
                <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
                <Text>Create Public Match</Text>
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
      
      {renderDebugModal()}
    </SafeAreaView>
  );
}