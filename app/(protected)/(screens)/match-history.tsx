import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

// TECHNICAL SPECIFICATION 1: Enhanced match status enumeration
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
  RECRUITING = 6,   // Enhanced for public matches
}

// TECHNICAL SPECIFICATION 2: Comprehensive match data interface
interface EnhancedMatchData {
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
  created_at: string;
  completed_at: string | null;
  start_time: string;
  end_time: string | null;
  winner_team: number | null;
  region: string | null;
  court: string | null;
  is_public: boolean;
  description: string | null;
  player1: { id: string; full_name: string | null; email: string } | null;
  player2: { id: string; full_name: string | null; email: string } | null;
  player3: { id: string; full_name: string | null; email: string } | null;
  player4: { id: string; full_name: string | null; email: string } | null;
  // ENHANCEMENT: Computed properties for improved performance
  isTeam1?: boolean;
  needsScores?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  isCompleted?: boolean;
  teammate?: any;
  opponents?: any[];
  team1Sets?: number;
  team2Sets?: number;
  teamWon?: boolean;
  isTied?: boolean;
  userWon?: boolean;
  setScores?: string;
  matchDuration?: number;
  timeUntilMatch?: number;
  daysAgo?: number;
}

// TECHNICAL SPECIFICATION 3: Enhanced filter type definition
type FilterType = 'all' | 'upcoming' | 'completed' | 'attention' | 'recent';

export default function EnhancedMatchHistory() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // TECHNICAL SPECIFICATION 4: State management with enhanced data structures
  const [allMatches, setAllMatches] = useState<EnhancedMatchData[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<{
    all: EnhancedMatchData[];
    upcoming: EnhancedMatchData[];
    completed: EnhancedMatchData[];
    attention: EnhancedMatchData[];
    recent: EnhancedMatchData[];
  }>({
    all: [],
    upcoming: [],
    completed: [],
    attention: [],
    recent: []
  });
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'opponent' | 'result'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { session } = useAuth();

  // TECHNICAL SPECIFICATION 5: Component lifecycle management
  useEffect(() => {
    if (session?.user?.id) {
      fetchMatches();
    }
  }, [session, friendId]);

  useEffect(() => {
    applyFilters();
  }, [filter, allMatches, searchQuery, sortBy, sortOrder]);

  // TECHNICAL SPECIFICATION 6: Enhanced filter application with time-based logic
  const applyFilters = () => {
    console.log('🔍 Match History: Applying filters', {
      totalMatches: allMatches.length,
      activeFilter: filter,
      searchQuery,
      sortBy,
      sortOrder
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // CRITICAL FIX: Time-based classification replacing status dependency
    const baseFiltered = {
      all: allMatches,
      
      // FIXED: Future matches based purely on start_time
      upcoming: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        const isFuture = startTime > now;
        console.log(`📅 Match ${match.id} upcoming check:`, {
          startTime: startTime.toISOString(),
          currentTime: now.toISOString(),
          isFuture
        });
        return isFuture;
      }),
      
      // FIXED: Completed matches based on score existence
      completed: allMatches.filter(match => {
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const endTime = match.end_time ? new Date(match.end_time) : null;
        const startTime = new Date(match.start_time);
        const isPastOrEnded = endTime ? endTime < now : startTime < now;
        const isCompleted = hasScores && isPastOrEnded;
        
        console.log(`✅ Match ${match.id} completed check:`, {
          hasScores,
          isPastOrEnded,
          isCompleted,
          endTime: endTime?.toISOString(),
          startTime: startTime.toISOString()
        });
        
        return isCompleted;
      }),
      
      // FIXED: Attention-needed matches based on time and score analysis
      attention: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasNoScores = !match.team1_score_set1 && !match.team2_score_set1;
        const needsAttention = (isPast && hasNoScores && match.status !== MatchStatus.CANCELLED) || 
                              match.status === MatchStatus.NEEDS_CONFIRMATION;
        
        console.log(`⚠️ Match ${match.id} attention check:`, {
          isPast,
          hasNoScores,
          needsAttention,
          status: match.status
        });
        
        return needsAttention;
      }),
      
      // ENHANCEMENT: Recent matches within last week
      recent: allMatches.filter(match => {
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
        const isRecent = matchDate >= weekAgo && hasScores;
        
        console.log(`📊 Match ${match.id} recent check:`, {
          matchDate: matchDate.toISOString(),
          weekAgo: weekAgo.toISOString(),
          isRecent,
          hasScores
        });
        
        return isRecent;
      })
    };

    // TECHNICAL SPECIFICATION 7: Advanced search filtering
    let searchFiltered = baseFiltered;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      Object.keys(searchFiltered).forEach(key => {
        searchFiltered[key as keyof typeof searchFiltered] = searchFiltered[key as keyof typeof searchFiltered].filter(match => {
          const searchableText = [
            match.region,
            match.court,
            match.description,
            match.player1?.full_name,
            match.player2?.full_name,
            match.player3?.full_name,
            match.player4?.full_name,
            match.player1?.email,
            match.player2?.email,
            match.player3?.email,
            match.player4?.email
          ].filter(Boolean).join(' ').toLowerCase();
          
          return searchableText.includes(query);
        });
      });
    }

    // TECHNICAL SPECIFICATION 8: Enhanced sorting algorithms
    Object.keys(searchFiltered).forEach(key => {
      searchFiltered[key as keyof typeof searchFiltered].sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'date':
            const dateA = new Date(a.start_time);
            const dateB = new Date(b.start_time);
            comparison = dateA.getTime() - dateB.getTime();
            break;
            
          case 'opponent':
            const opponentA = a.opponents?.[0]?.full_name || a.opponents?.[0]?.email || '';
            const opponentB = b.opponents?.[0]?.full_name || b.opponents?.[0]?.email || '';
            comparison = opponentA.localeCompare(opponentB);
            break;
            
          case 'result':
            // Sort by win/loss, then by margin
            if (a.userWon !== b.userWon) {
              comparison = (b.userWon ? 1 : 0) - (a.userWon ? 1 : 0);
            } else {
              const marginA = Math.abs((a.team1Sets || 0) - (a.team2Sets || 0));
              const marginB = Math.abs((b.team1Sets || 0) - (b.team2Sets || 0));
              comparison = marginB - marginA;
            }
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    });

    console.log('📊 Match History: Filter results', {
      all: searchFiltered.all.length,
      upcoming: searchFiltered.upcoming.length,
      completed: searchFiltered.completed.length,
      attention: searchFiltered.attention.length,
      recent: searchFiltered.recent.length
    });

    setFilteredMatches(searchFiltered);
  };

  // TECHNICAL SPECIFICATION 9: Enhanced data fetching with comprehensive processing
  const fetchMatches = async (shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      console.log('🚀 Match History: Fetching matches', {
        userId: session?.user?.id,
        friendId,
        shouldRefresh
      });
      
      // REQUIREMENT: Enhanced query with comprehensive player data
      let query = supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `);
      
      // TECHNICAL SPECIFICATION 10: Friend-specific or user-specific filtering
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

      if (error) {
        console.error('❌ Match History: Fetch error:', error);
        throw error;
      }

      console.log('📊 Match History: Raw data received:', {
        count: data?.length || 0,
        sampleMatch: data?.[0]
      });

      // TECHNICAL SPECIFICATION 11: Comprehensive match data processing
      const now = new Date();
      const processedData: EnhancedMatchData[] = (data || []).map(match => {
        const userId = session?.user?.id;
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        
        // FIXED: Enhanced team determination
        const isTeam1 = match.player1_id === userId || match.player2_id === userId;
        
        // FIXED: Time-based classifications
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const isCompleted = hasScores && isPast;
        const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
        
        // TECHNICAL SPECIFICATION 12: Enhanced teammate and opponent identification
        let teammate = null;
        let opponents: any[] = [];
        
        if (isTeam1) {
          teammate = match.player1_id === userId ? match.player2 : match.player1;
          opponents = [match.player3, match.player4].filter(Boolean);
        } else {
          teammate = match.player3_id === userId ? match.player4 : match.player3;
          opponents = [match.player1, match.player2].filter(Boolean);
        }
        
        // CRITICAL FIX: Comprehensive set-based winner determination
        let team1Sets = 0;
        let team2Sets = 0;
        let userWon = false;
        
        if (hasScores) {
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
          
          // ENHANCED: Winner determination with fallback logic
          if (match.winner_team) {
            userWon = (isTeam1 && match.winner_team === 1) || (!isTeam1 && match.winner_team === 2);
          } else {
            if (team1Sets > team2Sets) {
              userWon = isTeam1;
            } else if (team2Sets > team1Sets) {
              userWon = !isTeam1;
            }
          }
        }
        
        const teamWon = userWon;
        const isTied = team1Sets === team2Sets && hasScores;
        
        // TECHNICAL SPECIFICATION 13: Enhanced score formatting
        let setScores = '';
        if (hasScores) {
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
        
        // TECHNICAL SPECIFICATION 14: Additional computed properties
        const matchDuration = match.start_time && match.end_time 
          ? new Date(match.end_time).getTime() - new Date(match.start_time).getTime()
          : 0;
        
        const timeUntilMatch = isFuture 
          ? startTime.getTime() - now.getTime()
          : 0;
        
        const daysAgo = isPast 
          ? Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        const enhancedMatch: EnhancedMatchData = {
          ...match,
          isTeam1,
          needsScores,
          isFuture,
          isPast,
          isCompleted,
          teammate,
          opponents,
          team1Sets,
          team2Sets,
          teamWon,
          isTied,
          userWon,
          setScores,
          matchDuration,
          timeUntilMatch,
          daysAgo,
          // User position flags for UI rendering
          userIsPlayer1: match.player1_id === userId,
          userIsPlayer2: match.player2_id === userId,
          userIsPlayer3: match.player3_id === userId,
          userIsPlayer4: match.player4_id === userId
        };

        console.log(`🔄 Match History: Processed match ${match.id}`, {
          isTeam1,
          hasScores,
          userWon,
          team1Sets,
          team2Sets,
          needsScores,
          isFuture,
          isCompleted
        });

        return enhancedMatch;
      });

      setAllMatches(processedData);
      
    } catch (error) {
      console.error('💥 Match History: Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // TECHNICAL SPECIFICATION 15: Enhanced user interaction handlers
  const onRefresh = () => {
    fetchMatches(true);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    console.log('🔄 Match History: Filter changed to', newFilter);
    setFilter(newFilter);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSort = (by: 'date' | 'opponent' | 'result') => {
    if (sortBy === by) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(by);
      setSortOrder('desc');
    }
  };

  // TECHNICAL SPECIFICATION 16: Enhanced filter buttons with indicators
  const renderFilterButtons = () => (
    <View className="bg-background border-b border-border">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {(['all', 'upcoming', 'completed', 'attention', 'recent'] as FilterType[]).map((filterType) => {
          const count = filteredMatches[filterType]?.length || 0;
          const isActive = filter === filterType;
          
          return (
            <TouchableOpacity
              key={filterType}
              className={`px-4 py-3 mx-1 rounded-lg ${
                isActive 
                  ? 'bg-primary' 
                  : 'bg-muted/30'
              }`}
              onPress={() => handleFilterChange(filterType)}
            >
              <View className="flex-row items-center">
                <Text className={`font-medium capitalize ${
                  isActive ? 'text-primary-foreground' : 'text-foreground'
                }`}>
                  {filterType === 'attention' ? 'Needs Attention' : filterType}
                </Text>
                {count > 0 && (
                  <View className={`ml-2 px-2 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-primary-foreground/20' 
                      : 'bg-primary/20'
                  }`}>
                    <Text className={`text-xs font-bold ${
                      isActive ? 'text-primary-foreground' : 'text-primary'
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
  );

  // TECHNICAL SPECIFICATION 17: Enhanced search and sort controls
  const renderSearchAndSort = () => (
    <View className="p-4 bg-background border-b border-border">
      {/* Search Bar */}
      <View className="flex-row items-center bg-muted/30 rounded-lg px-3 py-2 mb-3">
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          className="flex-1 ml-2 text-foreground"
          placeholder="Search matches, opponents, locations..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#888"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Sort Controls */}
      <View className="flex-row justify-between items-center">
        <Text className="text-sm text-muted-foreground">Sort by:</Text>
        <View className="flex-row gap-2">
          {['date', 'opponent', 'result'].map((sortType) => (
            <TouchableOpacity
              key={sortType}
              onPress={() => handleSort(sortType as any)}
              className={`px-3 py-1 rounded-full flex-row items-center ${
                sortBy === sortType ? 'bg-primary' : 'bg-muted/30'
              }`}
            >
              <Text className={`text-xs capitalize ${
                sortBy === sortType ? 'text-primary-foreground' : 'text-foreground'
              }`}>
                {sortType}
              </Text>
              {sortBy === sortType && (
                <Ionicons 
                  name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={12} 
                  color={sortBy === sortType ? '#fff' : '#333'} 
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // TECHNICAL SPECIFICATION 18: Enhanced match card rendering with comprehensive information
  const renderMatchCard = (match: EnhancedMatchData) => {
    const matchDate = new Date(match.start_time);
    const now = new Date();
    const isToday = matchDate.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === matchDate.toDateString();
    const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === matchDate.toDateString();
    
    const formattedDate = isToday 
      ? 'Today' 
      : isTomorrow
        ? 'Tomorrow'
        : isYesterday
          ? 'Yesterday'
          : matchDate.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: matchDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
    
    const formattedTime = matchDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });

    // TECHNICAL SPECIFICATION 19: Enhanced status styling with comprehensive states
    const getMatchStyle = () => {
      if (match.isFuture) {
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/30',
          iconName: 'calendar-outline',
          iconColor: '#1d4ed8',
          status: 'Upcoming'
        };
      } else if (match.needsScores) {
        return {
          bgColor: 'bg-amber-50 dark:bg-amber-900/30',
          iconName: 'alert-circle-outline',
          iconColor: '#d97706',
          status: 'Needs Scores'
        };
      } else if (match.status === MatchStatus.NEEDS_CONFIRMATION) {
        return {
          bgColor: 'bg-amber-50 dark:bg-amber-900/30',
          iconName: 'help-circle-outline',
          iconColor: '#d97706',
          status: 'Needs Confirmation'
        };
      } else if (match.isCompleted) {
        if (match.userWon) {
          return {
            bgColor: 'bg-green-50 dark:bg-green-900/30',
            iconName: 'trophy-outline',
            iconColor: '#059669',
            status: 'Victory'
          };
        } else if (match.isTied) {
          return {
            bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
            iconName: 'remove-circle-outline',
            iconColor: '#d97706',
            status: 'Draw'
          };
        } else {
          return {
            bgColor: 'bg-red-50 dark:bg-red-900/30',
            iconName: 'close-circle-outline',
            iconColor: '#dc2626',
            status: 'Defeat'
          };
        }
      } else {
        return {
          bgColor: 'bg-card',
          iconName: 'help-outline',
          iconColor: '#6b7280',
          status: 'Unknown'
        };
      }
    };
    
    const style = getMatchStyle();

    return (
      <TouchableOpacity
        key={match.id}
        className={`mb-4 rounded-xl border border-border/30 overflow-hidden shadow-sm`}
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
        {/* Enhanced header with status and metadata */}
        <View className={`px-4 py-3 ${style.bgColor}`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-white/90 items-center justify-center mr-3">
                <Ionicons name={style.iconName as any} size={18} color={style.iconColor} />
              </View>
              <View>
                <Text className="font-medium" style={{ color: style.iconColor }}>
                  {style.status}
                </Text>
                <Text className="text-xs opacity-75">
                  {formattedDate} • {formattedTime}
                </Text>
              </View>
            </View>
            
            {/* Enhanced metadata display */}
            <View className="items-end">
              {(match.region || match.court) && (
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={14} color={style.iconColor} style={{ marginRight: 4 }} />
                  <Text className="text-xs" style={{ color: style.iconColor }}>
                    {match.court || match.region}
                  </Text>
                </View>
              )}
              {match.matchDuration > 0 && (
                <Text className="text-xs opacity-75">
                  {Math.round(match.matchDuration / (1000 * 60))}min
                </Text>
              )}
            </View>
          </View>
        </View>
        
        {/* Enhanced match content */}
        <View className="p-5 bg-card dark:bg-card/90">
          {/* Team composition with enhanced player display */}
          <View className="flex-row justify-between items-start mb-4">
            {/* Team 1 - Your team */}
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-2 font-medium">Your Team</Text>
              
              {/* Player 1 */}
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
                  <Text className="text-sm font-bold text-white">
                    {match.userIsPlayer1 ? 'Y' : 
                     match.player1?.full_name?.charAt(0)?.toUpperCase() || 
                     match.player1?.email?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className={`text-sm ${match.userIsPlayer1 ? 'font-bold text-primary' : 'font-medium'}`}>
                    {match.userIsPlayer1 ? 'You' : 
                     match.player1?.full_name || 
                     match.player1?.email?.split('@')[0] || 'Player 1'}
                  </Text>
                  {match.player1 && (
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player1.glicko_rating || '-'}
                    </Text>
                  )}
                </View>
              </View>
              
              {/* Player 2 */}
              {match.player2 ? (
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-primary/80 items-center justify-center mr-3">
                    <Text className="text-sm font-bold text-white">
                      {match.userIsPlayer2 ? 'Y' : 
                       match.player2?.full_name?.charAt(0)?.toUpperCase() || 
                       match.player2?.email?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-sm ${match.userIsPlayer2 ? 'font-bold text-primary' : 'font-medium'}`}>
                      {match.userIsPlayer2 ? 'You' : 
                       match.player2?.full_name || 
                       match.player2?.email?.split('@')[0] || 'Player 2'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player2.glicko_rating || '-'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center opacity-50">
                  <View className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center mr-3">
                    <Text className="text-sm font-bold text-white">?</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">Open Slot</Text>
                </View>
              )}
            </View>
            
            {/* Score section with enhanced display */}
            <View className="items-center px-4">
              {match.setScores ? (
                <View className="items-center">
                  <Text className="text-xs text-muted-foreground mb-1">Sets</Text>
                  <View className="flex-row items-center">
                    <Text className={`text-3xl font-bold ${
                      match.isTeam1 
                        ? (match.teamWon ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
                        : (!match.teamWon ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
                    }`}>
                      {match.isTeam1 ? match.team1Sets : match.team2Sets}
                    </Text>
                    <Text className="text-2xl mx-2 text-muted-foreground">-</Text>
                    <Text className={`text-3xl font-bold ${
                      match.isTeam1 
                        ? (!match.teamWon ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
                        : (match.teamWon ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
                    }`}>
                      {match.isTeam1 ? match.team2Sets : match.team1Sets}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground mt-1">
                    {match.setScores}
                  </Text>
                </View>
              ) : (
                <View className="items-center">
                  <Text className="text-2xl font-bold text-muted-foreground">VS</Text>
                  <Text className="text-xs text-muted-foreground">No scores yet</Text>
                </View>
              )}
            </View>
            
            {/* Team 2 - Opponents */}
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-2 font-medium text-right">Opponents</Text>
              
              {/* Player 3 */}
              {match.player3 ? (
                <View className="flex-row items-center justify-end mb-2">
                  <View className="flex-1 items-end mr-3">
                    <Text className={`text-sm ${match.userIsPlayer3 ? 'font-bold text-indigo-600' : 'font-medium'} text-right`}>
                      {match.userIsPlayer3 ? 'You' : 
                       match.player3?.full_name || 
                       match.player3?.email?.split('@')[0] || 'Player 3'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player3.glicko_rating || '-'}
                    </Text>
                  </View>
                  <View className="w-10 h-10 rounded-full bg-indigo-500 items-center justify-center">
                    <Text className="text-sm font-bold text-white">
                      {match.userIsPlayer3 ? 'Y' : 
                       match.player3?.full_name?.charAt(0)?.toUpperCase() || 
                       match.player3?.email?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center justify-end mb-2 opacity-50">
                  <Text className="text-sm text-muted-foreground mr-3">Open Slot</Text>
                  <View className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center">
                    <Text className="text-sm font-bold text-white">?</Text>
                  </View>
                </View>
              )}
              
              {/* Player 4 */}
              {match.player4 ? (
                <View className="flex-row items-center justify-end">
                  <View className="flex-1 items-end mr-3">
                    <Text className={`text-sm ${match.userIsPlayer4 ? 'font-bold text-indigo-600' : 'font-medium'} text-right`}>
                      {match.userIsPlayer4 ? 'You' : 
                       match.player4?.full_name || 
                       match.player4?.email?.split('@')[0] || 'Player 4'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player4.glicko_rating || '-'}
                    </Text>
                  </View>
                  <View className="w-10 h-10 rounded-full bg-indigo-500/80 items-center justify-center">
                    <Text className="text-sm font-bold text-white">
                      {match.userIsPlayer4 ? 'Y' : 
                       match.player4?.full_name?.charAt(0)?.toUpperCase() || 
                       match.player4?.email?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center justify-end opacity-50">
                  <Text className="text-sm text-muted-foreground mr-3">Open Slot</Text>
                  <View className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center">
                    <Text className="text-sm font-bold text-white">?</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          
          {/* Enhanced match description */}
          {match.description && (
            <View className="mb-3 p-3 bg-muted/20 rounded-lg">
              <Text className="text-sm italic">{match.description}</Text>
            </View>
          )}
          
          {/* Enhanced result display for completed matches */}
          {match.isCompleted && (
            <View className={`p-3 rounded-lg flex-row items-center justify-center mt-3 ${
              match.userWon 
                ? 'bg-green-50 dark:bg-green-900/30' 
                : match.isTied
                  ? 'bg-yellow-50 dark:bg-yellow-900/30'
                  : 'bg-red-50 dark:bg-red-900/30'
            }`}>
              <Ionicons 
                name={
                  match.userWon ? "trophy" : 
                  match.isTied ? "remove-circle" : "trending-down"
                } 
                size={20} 
                color={
                  match.userWon ? "#059669" : 
                  match.isTied ? "#d97706" : "#dc2626"
                } 
                style={{ marginRight: 8 }} 
              />
              <Text className={`font-medium ${
                match.userWon 
                  ? 'text-green-800 dark:text-green-300' 
                  : match.isTied
                    ? 'text-yellow-800 dark:text-yellow-300'
                    : 'text-red-800 dark:text-red-300'
              }`}>
                {match.userWon ? 'Victory' : match.isTied ? 'Draw' : 'Defeat'}
              </Text>
              {match.setScores && (
                <Text className={`ml-2 text-sm ${
                  match.userWon 
                    ? 'text-green-600 dark:text-green-400' 
                    : match.isTied
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  ({match.setScores})
                </Text>
              )}
            </View>
          )}
          
          {/* Enhanced action indicators for non-completed matches */}
          {!match.isCompleted && (
            <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border/30">
              <View className="flex-row items-center">
                {match.isFuture ? (
                  <>
                    <Ionicons name="people-outline" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
                    <Text className="text-sm text-blue-600 dark:text-blue-400">
                      {getOpenSlotsText(match)}
                    </Text>
                  </>
                ) : match.needsScores ? (
                  <>
                    <Ionicons name="create-outline" size={16} color="#d97706" style={{ marginRight: 6 }} />
                    <Text className="text-sm text-amber-600 dark:text-amber-400">
                      Tap to add scores
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
                    <Text className="text-sm text-green-600 dark:text-green-400">
                      Ready to view
                    </Text>
                  </>
                )}
              </View>
              
              <View className="flex-row items-center">
                <Text className="text-sm text-muted-foreground mr-1">View details</Text>
                <Ionicons name="chevron-forward" size={16} color="#888" />
              </View>
            </View>
          )}
          
          {/* Enhanced quick stats for completed matches */}
          {match.isCompleted && match.matchDuration > 0 && (
            <View className="flex-row justify-around mt-3 pt-3 border-t border-border/30">
              <View className="items-center">
                <Text className="text-xs text-muted-foreground">Duration</Text>
                <Text className="text-sm font-medium">
                  {Math.round(match.matchDuration / (1000 * 60))} min
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-muted-foreground">Sets</Text>
                <Text className="text-sm font-medium">
                  {(match.team1Sets || 0) + (match.team2Sets || 0)}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-muted-foreground">Margin</Text>
                <Text className="text-sm font-medium">
                  {Math.abs((match.team1Sets || 0) - (match.team2Sets || 0))}
                </Text>
              </View>
              {match.daysAgo !== undefined && (
                <View className="items-center">
                  <Text className="text-xs text-muted-foreground">When</Text>
                  <Text className="text-sm font-medium">
                    {match.daysAgo === 0 ? 'Today' : 
                     match.daysAgo === 1 ? 'Yesterday' : 
                     `${match.daysAgo}d ago`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // TECHNICAL SPECIFICATION 20: Helper functions
  const getOpenSlotsText = (match: EnhancedMatchData) => {
    const openSlots = 4 - [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean).length;
    
    if (openSlots === 0) return 'Match is full';
    if (openSlots === 1) return '1 open slot';
    return `${openSlots} open slots`;
  };

  // TECHNICAL SPECIFICATION 21: Enhanced empty state with contextual messaging
  const renderEmptyMatches = () => {
    const getEmptyMessage = () => {
      switch (filter) {
        case 'all':
          return {
            title: "No matches found",
            message: friendId 
              ? "You haven't played any matches with this friend yet" 
              : "You haven't played any matches yet",
            icon: "tennisball-outline"
          };
        case 'upcoming':
          return {
            title: "No upcoming matches",
            message: "Schedule a match to see it here",
            icon: "calendar-outline"
          };
        case 'completed':
          return {
            title: "No completed matches",
            message: "Complete some matches to see your history",
            icon: "checkmark-circle-outline"
          };
        case 'attention':
          return {
            title: "Nothing needs attention",
            message: "All your matches are up to date",
            icon: "checkmark-done-outline"
          };
        case 'recent':
          return {
            title: "No recent matches",
            message: "Play some matches this week to see them here",
            icon: "time-outline"
          };
        default:
          return {
            title: "No matches found",
            message: "Try adjusting your filters or search",
            icon: "search-outline"
          };
      }
    };

    const emptyState = getEmptyMessage();

    return (
      <View className="bg-card rounded-xl p-8 items-center border border-border/30 m-6">
        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Ionicons name={emptyState.icon as any} size={32} color="#1a7ebd" />
        </View>
        <Text className="text-lg font-medium mt-2 mb-2">{emptyState.title}</Text>
        <Text className="text-muted-foreground text-center mb-6">
          {emptyState.message}
        </Text>
        
        {(filter === 'all' || filter === 'upcoming') && (
          <Button
            variant="default"
            onPress={() => router.push('/(protected)/(screens)/create-match')}
            className="w-full"
          >
            <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
            <Text>Create Match</Text>
          </Button>
        )}
        
        {searchQuery.length > 0 && (
          <Button
            variant="outline"
            onPress={() => setSearchQuery('')}
            className="w-full mt-3"
          >
            <Text>Clear Search</Text>
          </Button>
        )}
      </View>
    );
  };

  // TECHNICAL SPECIFICATION 22: Loading state with enhanced UI
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1a7ebd" />
          <Text className="mt-4 text-muted-foreground">Loading match history...</Text>
          {friendId && (
            <Text className="mt-2 text-sm text-muted-foreground">
              Filtering matches with friend
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Get the current matches to display based on filter
  const currentMatches = filteredMatches[filter] || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Enhanced filter buttons */}
      {renderFilterButtons()}
      
      {/* Search and sort controls */}
      {renderSearchAndSort()}
      
      {/* Enhanced content area */}
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#1a7ebd"
            colors={['#1a7ebd']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary statistics */}
        {currentMatches.length > 0 && filter === 'all' && (
          <View className="bg-card rounded-xl p-4 mb-4 border border-border/30">
            <Text className="text-lg font-semibold mb-3">Match Summary</Text>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">
                  {allMatches.filter(m => m.isCompleted).length}
                </Text>
                <Text className="text-xs text-muted-foreground">Completed</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-blue-500">
                  {allMatches.filter(m => m.isFuture).length}
                </Text>
                <Text className="text-xs text-muted-foreground">Upcoming</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-green-500">
                  {allMatches.filter(m => m.userWon).length}
                </Text>
                <Text className="text-xs text-muted-foreground">Won</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-amber-500">
                  {allMatches.filter(m => m.needsScores || m.status === MatchStatus.NEEDS_CONFIRMATION).length}
                </Text>
                <Text className="text-xs text-muted-foreground">Attention</Text>
              </View>
            </View>
          </View>
        )}

        {/* Match list */}
        {currentMatches.length > 0 
          ? currentMatches.map(renderMatchCard)
          : renderEmptyMatches()
        }
        
        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}