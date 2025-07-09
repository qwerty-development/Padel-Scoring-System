import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

// Simplified match status
export enum MatchStatus {
  PENDING = 1,
  CANCELLED = 3,
  COMPLETED = 4,
  RECRUITING = 6,
}

// Streamlined match interface
interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  status: number;
  start_time: string;
  end_time: string | null;
  winner_team: number | null;
  region: string | null;
  court: string | null;
  is_public: boolean;
  description: string | null;
  player1: { id: string; full_name: string | null; email: string; avatar_url: string | null; } | null;
  player2: { id: string; full_name: string | null; email: string; avatar_url: string | null; } | null;
  player3: { id: string; full_name: string | null; email: string; avatar_url: string | null; } | null;
  player4: { id: string; full_name: string | null; email: string; avatar_url: string | null; } | null;
  
  // Computed properties
  isTeam1?: boolean;
  isFuture?: boolean;
  isCompleted?: boolean;
  needsScores?: boolean;
  userWon?: boolean;
  setScores?: string;
  opponents?: any[];
}

type FilterType = 'all' | 'upcoming' | 'completed' | 'attention';

// Clean Avatar Component
interface AvatarProps {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  size?: 'sm' | 'md' | 'lg';
  isCurrentUser?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', isCurrentUser = false }) => {
  const [imageError, setImageError] = useState(false);

  const sizeStyle = {
    sm: { width: 32, height: 32, borderRadius: 16 },
    md: { width: 40, height: 40, borderRadius: 20 },
    lg: { width: 48, height: 48, borderRadius: 24 }
  }[size];

  const textSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }[size];

  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const bgColor = isCurrentUser ? 'bg-blue-500' : 'bg-background';

  if (user.avatar_url && !imageError) {
    return (
      <View className="relative">
        <Image
          source={{ uri: user.avatar_url }}
          style={sizeStyle}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
        {isCurrentUser && (
          <View className="absolute -top-1 -right-1 bg-blue-500 rounded-full w-4 h-4 items-center justify-center border-2 border-white">
            <Ionicons name="person" size={8} color="white" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={`${bgColor} items-center justify-center relative`} style={sizeStyle}>
      <Text className={`${textSize} font-bold text-white`}>
        {getInitial()}
      </Text>
      {isCurrentUser && (
        <View className="absolute -top-1 -right-1 bg-blue-500 rounded-full w-4 h-4 items-center justify-center border-2 border-white">
          <Ionicons name="person" size={8} color="white" />
        </View>
      )}
    </View>
  );
};

export default function CleanMatchHistory() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchMatches();
    }
  }, [session, friendId]);

  const fetchMatches = async (shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      let query = supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, avatar_url),
          player2:profiles!player2_id(id, full_name, email, avatar_url),
          player3:profiles!player3_id(id, full_name, email, avatar_url),
          player4:profiles!player4_id(id, full_name, email, avatar_url)
        `);
      
      if (friendId) {
        query = query.or(
          `and(player1_id.eq.${session?.user?.id},or(player2_id.eq.${friendId},player3_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player2_id.eq.${session?.user?.id},or(player1_id.eq.${friendId},player3_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player3_id.eq.${session?.user?.id},or(player1_id.eq.${friendId},player2_id.eq.${friendId},player4_id.eq.${friendId})),` +
          `and(player4_id.eq.${session?.user?.id},or(player1_id.eq.${friendId},player2_id.eq.${friendId},player3_id.eq.${friendId}))`
        );
      } else {
        query = query.or(
          `player1_id.eq.${session?.user?.id},` +
          `player2_id.eq.${session?.user?.id},` +
          `player3_id.eq.${session?.user?.id},` +
          `player4_id.eq.${session?.user?.id}`
        );
      }
      
      query = query.order('start_time', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const processedData: MatchData[] = (data || []).map(match => {
        const userId = session?.user?.id;
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        const now = new Date();
        
        const isTeam1 = match.player1_id === userId || match.player2_id === userId;
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const isCompleted = hasScores && isPast;
        const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
        
        let opponents: any[] = [];
        if (isTeam1) {
          opponents = [match.player3, match.player4].filter(Boolean);
        } else {
          opponents = [match.player1, match.player2].filter(Boolean);
        }
        
        let userWon = false;
        let setScores = '';
        
        if (hasScores) {
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
          
          if (match.winner_team) {
            userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
          } else {
            userWon = (isTeam1 && team1Sets > team2Sets) || (!isTeam1 && team2Sets > team1Sets);
          }
          
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

        return {
          ...match,
          isTeam1,
          isFuture,
          isCompleted,
          needsScores,
          userWon,
          setScores,
          opponents
        };
      });

      setMatches(processedData);
      
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getFilteredMatches = () => {
    let filtered = matches;

    // Apply filter
    switch (filter) {
      case 'upcoming':
        filtered = matches.filter(match => match.isFuture);
        break;
      case 'completed':
        filtered = matches.filter(match => match.isCompleted);
        break;
      case 'attention':
        filtered = matches.filter(match => match.needsScores);
        break;
      default:
        filtered = matches;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(match => {
        const searchableText = [
          match.region,
          match.court,
          match.player1?.full_name,
          match.player2?.full_name,
          match.player3?.full_name,
          match.player4?.full_name,
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchableText.includes(query);
      });
    }

    return filtered;
  };

  const onRefresh = () => {
    fetchMatches(true);
  };

  const renderMatchCard = (match: MatchData) => {
    const matchDate = new Date(match.start_time);
    const now = new Date();
    const isToday = matchDate.toDateString() === now.toDateString();
    
    const formattedDate = isToday 
      ? 'Today' 
      : matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const formattedTime = matchDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    return (
      <TouchableOpacity
        key={match.id}
        className="bg-card dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { 
              matchId: match.id,
              mode: match.needsScores ? 'score-entry' : undefined
            }
          });
        }}
      >
        {/* Header */}
        <View className="flex-row  items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className={`w-3 h-3 rounded-full mr-3 ${
              match.isFuture ? 'bg-blue-500' : 
              match.isCompleted ? (match.userWon ? 'bg-green-500' : 'bg-red-500') :
              'bg-orange-500'
            }`} />
            <View>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formattedDate} • {formattedTime}
              </Text>
              {(match.region || match.court) && (
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {match.court || match.region}
                </Text>
              )}
            </View>
          </View>
          
          <View className="flex-row items-center">
            {match.is_public && (
              <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full mr-2">
                <Text className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  Public
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </View>
        </View>

        {/* Players */}
        <View className="flex-row items-center justify-between">
          {/* Your team */}
          <View className="flex-1">
            <View className="flex-row items-center mb-2">
              {match.player1 && (
                <Avatar 
                  user={match.player1}
                  size="sm"
                  isCurrentUser={match.player1_id === session?.user?.id}
                />
              )}
              {match.player2 && (
                <Avatar 
                  user={match.player2}
                  size="sm"
                  isCurrentUser={match.player2_id === session?.user?.id}
                  style={{ marginLeft: -8 }}
                />
              )}
            </View>
            <View>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {match.isTeam1 ? 'Your Team' : 'Opponents'}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {match.player1?.full_name || 'Player 1'} & {match.player2?.full_name || 'Player 2'}
              </Text>
            </View>
          </View>

          {/* Score or VS */}
          <View className="items-center px-4">
            {match.setScores ? (
              <View className="items-center">
                <Text className={`text-lg font-bold ${
                  match.userWon ? 'text-green-600' : 'text-red-600'
                }`}>
                  {match.userWon ? 'W' : 'L'}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {match.setScores}
                </Text>
              </View>
            ) : (
              <Text className="text-lg font-bold text-gray-400">VS</Text>
            )}
          </View>

          {/* Opponents */}
          <View className="flex-1 items-end">
            <View className="flex-row items-center mb-2 justify-end">
              {match.player4 && (
                <Avatar 
                  user={match.player4}
                  size="sm"
                  isCurrentUser={match.player4_id === session?.user?.id}
                  style={{ marginRight: -8 }}
                />
              )}
              {match.player3 && (
                <Avatar 
                  user={match.player3}
                  size="sm"
                  isCurrentUser={match.player3_id === session?.user?.id}
                />
              )}
            </View>
            <View className="items-end">
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {!match.isTeam1 ? 'Your Team' : 'Opponents'}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {match.player3?.full_name || 'Player 3'} & {match.player4?.full_name || 'Player 4'}
              </Text>
            </View>
          </View>
        </View>

        {/* Status */}
        {(match.needsScores || match.isFuture) && (
          <View className={`mt-3 p-2 rounded-lg ${
            match.needsScores ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
            <Text className={`text-xs font-medium ${
              match.needsScores ? 'text-orange-700 dark:text-orange-300' : 'text-blue-700 dark:text-blue-300'
            }`}>
              {match.needsScores ? 'Needs scores' : 'Upcoming match'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View className="items-center justify-center py-16">
      <View className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-4">
        <Ionicons name="tennisball-outline" size={32} color="#9CA3AF" />
      </View>
      <Text className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        No matches found
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
        {filter === 'upcoming' ? 'No upcoming matches scheduled' :
         filter === 'completed' ? 'No completed matches yet' :
         filter === 'attention' ? 'All matches are up to date' :
         'Start playing to see your match history'}
      </Text>
      <Button
        onPress={() => router.push('/(protected)/(screens)/create-match')}
        className="bg-blue-500 hover:bg-blue-600"
      >
        <Text className="text-white font-medium">Create Match</Text>
      </Button>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-backround dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">Loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredMatches = getFilteredMatches();
  const stats = {
    all: matches.length,
    upcoming: matches.filter(m => m.isFuture).length,
    completed: matches.filter(m => m.isCompleted).length,
    attention: matches.filter(m => m.needsScores).length,
  };

  return (
    <SafeAreaView className="flex-1 bg-background  dark:bg-gray-900">
      {/* Header */}
      <View className=" dark:bg-gray-800 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Match History
        </Text>
        

        {/* Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="flex-row"
        >
          {(['all', 'upcoming', 'completed', 'attention'] as FilterType[]).map((filterType) => {
            const count = stats[filterType];
            const isActive = filter === filterType;
            
            return (
              <TouchableOpacity
                key={filterType}
                className={`mr-3 px-4 py-2 rounded-xl ${
                  isActive 
                    ? 'bg-blue-500' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
                onPress={() => setFilter(filterType)}
              >
                <View className="flex-row items-center">
                  <Text className={`font-medium capitalize ${
                    isActive 
                      ? 'text-white' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {filterType === 'attention' ? 'Needs Attention' : filterType}
                  </Text>
                  {count > 0 && (
                    <View className={`ml-2 px-2 py-0.5 rounded-full ${
                      isActive 
                        ? 'bg-card' 
                        : 'bg-blue-500'
                    }`}>
                      <Text className={`text-xs font-bold ${
                        isActive ? 'text-white' : 'text-white'
                      }`}>
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      {/* Content */}
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredMatches.length > 0 
          ? filteredMatches.map(renderMatchCard)
          : renderEmptyState()
        }
      </ScrollView>
    </SafeAreaView>
  );
}