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

// TECHNICAL SPECIFICATION 3: ENHANCED filter type definition with visibility options
type FilterType = 'all' | 'upcoming' | 'completed' | 'attention' | 'recent' | 'public' | 'private';

// TECHNICAL SPECIFICATION 4: Visibility statistics interface
interface VisibilityStats {
  totalPublic: number;
  totalPrivate: number;
  publicCompleted: number;
  privateCompleted: number;
  publicUpcoming: number;
  privateUpcoming: number;
}

export default function EnhancedMatchHistoryWithVisibility() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // TECHNICAL SPECIFICATION 5: ENHANCED state management with visibility-aware data structures
  const [allMatches, setAllMatches] = useState<EnhancedMatchData[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<{
    all: EnhancedMatchData[];
    upcoming: EnhancedMatchData[];
    completed: EnhancedMatchData[];
    attention: EnhancedMatchData[];
    recent: EnhancedMatchData[];
    public: EnhancedMatchData[];
    private: EnhancedMatchData[];
  }>({
    all: [],
    upcoming: [],
    completed: [],
    attention: [],
    recent: [],
    public: [],
    private: []
  });
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'opponent' | 'result' | 'visibility'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibilityStats, setVisibilityStats] = useState<VisibilityStats>({
    totalPublic: 0,
    totalPrivate: 0,
    publicCompleted: 0,
    privateCompleted: 0,
    publicUpcoming: 0,
    privateUpcoming: 0
  });
  const { session } = useAuth();

  // TECHNICAL SPECIFICATION 6: Component lifecycle management
  useEffect(() => {
    if (session?.user?.id) {
      fetchMatches();
    }
  }, [session, friendId]);

  useEffect(() => {
    applyFilters();
  }, [filter, allMatches, searchQuery, sortBy, sortOrder]);

  // TECHNICAL SPECIFICATION 7: Calculate visibility statistics
  useEffect(() => {
    calculateVisibilityStats();
  }, [allMatches]);

  // TECHNICAL SPECIFICATION 8: Visibility statistics calculation
  const calculateVisibilityStats = () => {
    const stats: VisibilityStats = {
      totalPublic: 0,
      totalPrivate: 0,
      publicCompleted: 0,
      privateCompleted: 0,
      publicUpcoming: 0,
      privateUpcoming: 0
    };

    allMatches.forEach(match => {
      if (match.is_public) {
        stats.totalPublic++;
        if (match.isCompleted) stats.publicCompleted++;
        if (match.isFuture) stats.publicUpcoming++;
      } else {
        stats.totalPrivate++;
        if (match.isCompleted) stats.privateCompleted++;
        if (match.isFuture) stats.privateUpcoming++;
      }
    });

    setVisibilityStats(stats);
  };

  // TECHNICAL SPECIFICATION 9: ENHANCED filter application with visibility-based logic
  const applyFilters = () => {
    console.log('🔍 Match History: Applying filters with visibility support', {
      totalMatches: allMatches.length,
      activeFilter: filter,
      searchQuery,
      sortBy,
      sortOrder
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // ENHANCED: Visibility-aware base filtering
    const baseFiltered = {
      all: allMatches,
      
      // Future matches based purely on start_time
      upcoming: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        const isFuture = startTime > now;
        return isFuture;
      }),
      
      // Completed matches based on score existence
      completed: allMatches.filter(match => {
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const endTime = match.end_time ? new Date(match.end_time) : null;
        const startTime = new Date(match.start_time);
        const isPastOrEnded = endTime ? endTime < now : startTime < now;
        const isCompleted = hasScores && isPastOrEnded;
        return isCompleted;
      }),
      
      // Attention-needed matches based on time and score analysis
      attention: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasNoScores = !match.team1_score_set1 && !match.team2_score_set1;
        const needsAttention = (isPast && hasNoScores && match.status !== MatchStatus.CANCELLED) || 
                              match.status === MatchStatus.NEEDS_CONFIRMATION;
        return needsAttention;
      }),
      
      // Recent matches within last week
      recent: allMatches.filter(match => {
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
        const isRecent = matchDate >= weekAgo && hasScores;
        return isRecent;
      }),

      // ENHANCEMENT: NEW visibility-based filters
      public: allMatches.filter(match => match.is_public === true),
      private: allMatches.filter(match => match.is_public === false)
    };

    // TECHNICAL SPECIFICATION 10: Enhanced search filtering with visibility context
    let searchFiltered = baseFiltered;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      Object.keys(searchFiltered).forEach(key => {
        searchFiltered[key as keyof typeof searchFiltered] = searchFiltered[key as keyof typeof searchFiltered].filter(match => {
          const visibilityText = match.is_public ? 'public open' : 'private invitation';
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
            match.player4?.email,
            visibilityText // ENHANCEMENT: Include visibility in search
          ].filter(Boolean).join(' ').toLowerCase();
          
          return searchableText.includes(query);
        });
      });
    }

    // TECHNICAL SPECIFICATION 11: ENHANCED sorting algorithms with visibility support
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

          // ENHANCEMENT: NEW visibility-based sorting
          case 'visibility':
            if (a.is_public !== b.is_public) {
              comparison = a.is_public ? 1 : -1; // Public matches first when ascending
            } else {
              // Secondary sort by date if visibility is same
              const dateA = new Date(a.start_time);
              const dateB = new Date(b.start_time);
              comparison = dateB.getTime() - dateA.getTime();
            }
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    });

    console.log('📊 Match History: Filter results with visibility', {
      all: searchFiltered.all.length,
      upcoming: searchFiltered.upcoming.length,
      completed: searchFiltered.completed.length,
      attention: searchFiltered.attention.length,
      recent: searchFiltered.recent.length,
      public: searchFiltered.public.length,
      private: searchFiltered.private.length
    });

    setFilteredMatches(searchFiltered);
  };

  // TECHNICAL SPECIFICATION 12: Enhanced data fetching with comprehensive processing
  const fetchMatches = async (shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      console.log('🚀 Match History: Fetching matches with visibility data', {
        userId: session?.user?.id,
        friendId,
        shouldRefresh
      });
      
      // Enhanced query with comprehensive player data
      let query = supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, avatar_url)
        `);
      
      // Friend-specific or user-specific filtering
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

      console.log('📊 Match History: Raw data received with visibility info:', {
        count: data?.length || 0,
        sampleMatch: data?.[0],
        publicMatches: data?.filter(m => m.is_public).length || 0,
        privateMatches: data?.filter(m => !m.is_public).length || 0
      });

      // TECHNICAL SPECIFICATION 13: Comprehensive match data processing with visibility context
      const now = new Date();
      const processedData: EnhancedMatchData[] = (data || []).map(match => {
        const userId = session?.user?.id;
        const startTime = new Date(match.start_time);
        const endTime = match.end_time ? new Date(match.end_time) : null;
        
        // Enhanced team determination
        const isTeam1 = match.player1_id === userId || match.player2_id === userId;
        
        // Time-based classifications
        const isFuture = startTime > now;
        const isPast = endTime ? endTime < now : startTime < now;
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const isCompleted = hasScores && isPast;
        const needsScores = isPast && !hasScores && match.status !== MatchStatus.CANCELLED;
        
        // Enhanced teammate and opponent identification
        let teammate = null;
        let opponents: any[] = [];
        
        if (isTeam1) {
          teammate = match.player1_id === userId ? match.player2 : match.player1;
          opponents = [match.player3, match.player4].filter(Boolean);
        } else {
          teammate = match.player3_id === userId ? match.player4 : match.player3;
          opponents = [match.player1, match.player2].filter(Boolean);
        }
        
        // Comprehensive set-based winner determination
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
          
          // Winner determination with fallback logic
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
        
        // Enhanced score formatting
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
        
        // Additional computed properties
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

        console.log(`🔄 Match History: Processed match ${match.id} with visibility ${match.is_public ? 'PUBLIC' : 'PRIVATE'}`, {
          isTeam1,
          hasScores,
          userWon,
          team1Sets,
          team2Sets,
          needsScores,
          isFuture,
          isCompleted,
          is_public: match.is_public
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

  // TECHNICAL SPECIFICATION 14: Enhanced user interaction handlers
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

  const handleSort = (by: 'date' | 'opponent' | 'result' | 'visibility') => {
    if (sortBy === by) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(by);
      setSortOrder('desc');
    }
  };

  // TECHNICAL SPECIFICATION 15: Visibility badge component for consistent UI
  const renderVisibilityBadge = (isPublic: boolean, size: 'small' | 'medium' = 'small') => {
    const iconSize = size === 'medium' ? 16 : 12;
    const textClass = size === 'medium' ? 'text-sm' : 'text-xs';
    const paddingClass = size === 'medium' ? 'px-3 py-2' : 'px-2 py-1';
    
    return (
      <View className={`flex-row items-center ${paddingClass} rounded-full ${
        isPublic 
          ? 'bg-blue-100 dark:bg-blue-900/30' 
          : 'bg-gray-100 dark:bg-gray-800/50'
      }`}>
        <Ionicons 
          name={isPublic ? 'globe-outline' : 'lock-closed-outline'} 
          size={iconSize} 
          color={isPublic ? '#2563eb' : '#6b7280'} 
          style={{ marginRight: 4 }}
        />
        <Text className={`${textClass} font-medium ${
          isPublic 
            ? 'text-blue-700 dark:text-blue-300' 
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {isPublic ? 'Public' : 'Private'}
        </Text>
      </View>
    );
  };

  // TECHNICAL SPECIFICATION 16: ENHANCED filter buttons with visibility indicators
  const renderFilterButtons = () => (
    <View className="bg-background border-b border-border">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {(['all', 'upcoming', 'completed', 'attention', 'recent', 'public', 'private'] as FilterType[]).map((filterType) => {
          const count = filteredMatches[filterType]?.length || 0;
          const isActive = filter === filterType;
          
          // ENHANCEMENT: Special styling for visibility filters
          const isVisibilityFilter = filterType === 'public' || filterType === 'private';
          const baseClasses = isActive 
            ? (isVisibilityFilter 
                ? (filterType === 'public' ? 'bg-blue-600' : 'bg-gray-600')
                : 'bg-primary')
            : 'bg-muted/30';
          
          return (
            <TouchableOpacity
              key={filterType}
              className={`px-4 py-3 mx-1 rounded-lg ${baseClasses}`}
              onPress={() => handleFilterChange(filterType)}
            >
              <View className="flex-row items-center">
                {/* ENHANCEMENT: Add icons for visibility filters */}
                {isVisibilityFilter && (
                  <Ionicons 
                    name={filterType === 'public' ? 'globe-outline' : 'lock-closed-outline'} 
                    size={14} 
                    color={isActive ? '#fff' : (filterType === 'public' ? '#2563eb' : '#6b7280')}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text className={`font-medium capitalize ${
                  isActive ? 'text-primary-foreground' : 'text-foreground'
                }`}>
                  {filterType === 'attention' ? 'Needs Attention' : filterType}
                </Text>
                {count > 0 && (
                  <View className={`ml-2 px-2 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-primary-foreground/20' 
                      : (isVisibilityFilter 
                          ? (filterType === 'public' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800/40')
                          : 'bg-primary/20')
                  }`}>
                    <Text className={`text-xs font-bold ${
                      isActive ? 'text-primary-foreground' : 
                      (isVisibilityFilter 
                        ? (filterType === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400')
                        : 'text-primary')
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

  // TECHNICAL SPECIFICATION 17: ENHANCED search and sort controls with visibility options
  const renderSearchAndSort = () => (
    <View className="p-4 bg-background border-b border-border">
      {/* Search Bar with visibility hint */}
      <View className="flex-row items-center bg-muted/30 rounded-lg px-3 py-2 mb-3">
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          className="flex-1 ml-2 text-foreground"
          placeholder="Search matches, opponents, locations, visibility..."
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
      
      {/* Sort Controls with visibility option */}
      <View className="flex-row justify-between items-center">
        <Text className="text-sm text-muted-foreground">Sort by:</Text>
        <View className="flex-row gap-2">
          {['date', 'opponent', 'result', 'visibility'].map((sortType) => (
            <TouchableOpacity
              key={sortType}
              onPress={() => handleSort(sortType as any)}
              className={`px-3 py-1 rounded-full flex-row items-center ${
                sortBy === sortType 
                  ? (sortType === 'visibility' ? 'bg-blue-600' : 'bg-primary')
                  : 'bg-muted/30'
              }`}
            >
              {/* ENHANCEMENT: Add icon for visibility sort */}
              {sortType === 'visibility' && (
                <Ionicons 
                  name="eye-outline" 
                  size={12} 
                  color={sortBy === sortType ? '#fff' : '#666'} 
                  style={{ marginRight: 4 }}
                />
              )}
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

  // TECHNICAL SPECIFICATION 18: ENHANCED match card rendering with comprehensive visibility information
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

    // Enhanced status styling with visibility context
    const getMatchStyle = () => {
      if (match.isFuture) {
        return {
          bgColor: match.is_public ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-indigo-50 dark:bg-indigo-900/30',
          iconName: 'calendar-outline',
          iconColor: match.is_public ? '#1d4ed8' : '#4f46e5',
          status: match.is_public ? 'Public Match' : 'Private Match'
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
        {/* ENHANCED header with status, metadata, and visibility indicator */}
        <View className={`px-4 py-3 ${style.bgColor}`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-8 h-8 rounded-full bg-white/90 items-center justify-center mr-3">
                <Ionicons name={style.iconName as any} size={18} color={style.iconColor} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="font-medium mr-2" style={{ color: style.iconColor }}>
                    {style.status}
                  </Text>
                  {/* ENHANCEMENT: Visibility badge in header */}
                  {renderVisibilityBadge(match.is_public)}
                </View>
                <Text className="text-xs opacity-75">
                  {formattedDate} • {formattedTime}
                </Text>
              </View>
            </View>
            
            {/* Enhanced metadata display with visibility context */}
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
              {/* ENHANCEMENT: Show open slots for public matches */}
              {match.is_public && match.isFuture && (
                <Text className="text-xs opacity-75 mt-1">
                  {getOpenSlotsText(match)}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        {/* Enhanced match content with visibility-aware information */}
        <View className="p-5 bg-card dark:bg-card/90">
          {/* ENHANCEMENT: Visibility-specific information banner */}
          {match.is_public && (
            <View className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
              <View className="flex-row items-center">
                <Ionicons name="globe" size={16} color="#2563eb" style={{ marginRight: 8 }} />
                <Text className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  {match.isFuture 
                    ? 'Open for anyone to discover and join' 
                    : 'This was a public match visible to all users'}
                </Text>
              </View>
            </View>
          )}

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
                  <View className="flex-1">
                    <Text className="text-sm text-muted-foreground">
                      {match.is_public ? 'Open for Anyone' : 'Awaiting Invite'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {match.is_public ? 'Public slot' : 'Private invitation'}
                    </Text>
                  </View>
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
                  <Text className="text-xs text-muted-foreground">
                    {match.is_public ? 'Public Match' : 'Private Match'}
                  </Text>
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
                  <View className="flex-1 items-end mr-3">
                    <Text className="text-sm text-muted-foreground text-right">
                      {match.is_public ? 'Open for Anyone' : 'Awaiting Invite'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {match.is_public ? 'Public slot' : 'Private invitation'}
                    </Text>
                  </View>
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
                  <View className="flex-1 items-end mr-3">
                    <Text className="text-sm text-muted-foreground text-right">
                      {match.is_public ? 'Open for Anyone' : 'Awaiting Invite'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {match.is_public ? 'Public slot' : 'Private invitation'}
                    </Text>
                  </View>
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
              {/* ENHANCEMENT: Show visibility context in results */}
              <View className="ml-2">
                {renderVisibilityBadge(match.is_public, 'small')}
              </View>
            </View>
          )}
          
          {/* ENHANCED action indicators for non-completed matches with visibility context */}
          {!match.isCompleted && (
            <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border/30">
              <View className="flex-row items-center">
                {match.isFuture ? (
                  <>
                    <Ionicons 
                      name={match.is_public ? "globe-outline" : "people-outline"} 
                      size={16} 
                      color={match.is_public ? "#2563eb" : "#3b82f6"} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text className={`text-sm ${
                      match.is_public ? 'text-blue-600 dark:text-blue-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {match.is_public 
                        ? `Public • ${getOpenSlotsText(match)}`
                        : `Private • ${getOpenSlotsText(match)}`}
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
          
          {/* Enhanced quick stats for completed matches with visibility info */}
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
              <View className="items-center">
                <Text className="text-xs text-muted-foreground">Visibility</Text>
                <Text className={`text-sm font-medium ${
                  match.is_public ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {match.is_public ? 'Public' : 'Private'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Helper function for open slots display
  const getOpenSlotsText = (match: EnhancedMatchData) => {
    const openSlots = 4 - [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean).length;
    
    if (openSlots === 0) return 'Match is full';
    if (openSlots === 1) return '1 open slot';
    return `${openSlots} open slots`;
  };

  // TECHNICAL SPECIFICATION 19: ENHANCED empty state with visibility-aware contextual messaging
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
        // ENHANCEMENT: NEW visibility-specific empty states
        case 'public':
          return {
            title: "No public matches found",
            message: "Create public matches to let anyone discover and join your games",
            icon: "globe-outline"
          };
        case 'private':
          return {
            title: "No private matches found",
            message: "Create private matches for invitation-only games with specific friends",
            icon: "lock-closed-outline"
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
        <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
          filter === 'public' ? 'bg-blue-100 dark:bg-blue-900/30' :
          filter === 'private' ? 'bg-gray-100 dark:bg-gray-800/30' :
          'bg-primary/10'
        }`}>
          <Ionicons 
            name={emptyState.icon as any} 
            size={32} 
            color={
              filter === 'public' ? '#2563eb' :
              filter === 'private' ? '#6b7280' :
              '#1a7ebd'
            } 
          />
        </View>
        <Text className="text-lg font-medium mt-2 mb-2">{emptyState.title}</Text>
        <Text className="text-muted-foreground text-center mb-6">
          {emptyState.message}
        </Text>
        
        {/* ENHANCEMENT: Visibility-specific action buttons */}
        {(filter === 'all' || filter === 'upcoming' || filter === 'public' || filter === 'private') && (
          <View className="w-full space-y-3">
            <Button
              variant="default"
              onPress={() => router.push('/(protected)/(screens)/create-match')}
              className="w-full"
            >
              <Ionicons name="add" size={18} style={{ marginRight: 8 }} />
              <Text>
                {filter === 'public' ? 'Create Public Match' :
                 filter === 'private' ? 'Create Private Match' :
                 'Create Match'}
              </Text>
            </Button>
            
            {/* Show alternative option for visibility filters */}
            {filter === 'public' && (
              <Button
                variant="outline"
                onPress={() => setFilter('private')}
                className="w-full"
              >
                <Ionicons name="lock-closed-outline" size={18} style={{ marginRight: 8 }} />
                <Text>View Private Matches</Text>
              </Button>
            )}
            
            {filter === 'private' && (
              <Button
                variant="outline"
                onPress={() => setFilter('public')}
                className="w-full"
              >
                <Ionicons name="globe-outline" size={18} style={{ marginRight: 8 }} />
                <Text>View Public Matches</Text>
              </Button>
            )}
          </View>
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

  // Loading state with enhanced UI
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
          <View className="mt-4 flex-row gap-4">
            <View className="items-center">
              <View className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center">
                <Ionicons name="globe" size={12} color="#2563eb" />
              </View>
              <Text className="text-xs text-muted-foreground mt-1">Public</Text>
            </View>
            <View className="items-center">
              <View className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center">
                <Ionicons name="lock-closed" size={12} color="#6b7280" />
              </View>
              <Text className="text-xs text-muted-foreground mt-1">Private</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Get the current matches to display based on filter
  const currentMatches = filteredMatches[filter] || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Enhanced filter buttons with visibility options */}
      {renderFilterButtons()}
      
      {/* Search and sort controls with visibility features */}
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
        {/* ENHANCED summary statistics with visibility breakdown */}
        {currentMatches.length > 0 && filter === 'all' && (
          <View className="bg-card rounded-xl p-4 mb-4 border border-border/30">
            <Text className="text-lg font-semibold mb-3">Match Summary</Text>
            
            {/* Primary stats row */}
            <View className="flex-row justify-around mb-4">
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

            {/* ENHANCEMENT: Visibility breakdown */}
            <View className="border-t border-border/30 pt-4">
              <Text className="text-sm font-medium mb-3 text-center">Visibility Breakdown</Text>
              <View className="flex-row justify-around">
                <TouchableOpacity 
                  onPress={() => setFilter('public')}
                  className="items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                >
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="globe" size={16} color="#2563eb" />
                    <Text className="text-lg font-bold text-blue-600 dark:text-blue-400 ml-1">
                      {visibilityStats.totalPublic}
                    </Text>
                  </View>
                  <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">Public Matches</Text>
                  <Text className="text-xs text-muted-foreground">
                    {visibilityStats.publicCompleted} completed • {visibilityStats.publicUpcoming} upcoming
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setFilter('private')}
                  className="items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/20"
                >
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="lock-closed" size={16} color="#6b7280" />
                    <Text className="text-lg font-bold text-gray-600 dark:text-gray-400 ml-1">
                      {visibilityStats.totalPrivate}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-600 dark:text-gray-400 font-medium">Private Matches</Text>
                  <Text className="text-xs text-muted-foreground">
                    {visibilityStats.privateCompleted} completed • {visibilityStats.privateUpcoming} upcoming
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ENHANCED visibility-specific summary for filter-specific views */}
        {currentMatches.length > 0 && (filter === 'public' || filter === 'private') && (
          <View className={`rounded-xl p-4 mb-4 border ${
            filter === 'public' 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700'
          }`}>
            <View className="flex-row items-center mb-3">
              <Ionicons 
                name={filter === 'public' ? 'globe' : 'lock-closed'} 
                size={20} 
                color={filter === 'public' ? '#2563eb' : '#6b7280'} 
              />
              <Text className={`text-lg font-semibold ml-2 ${
                filter === 'public' ? 'text-blue-800 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {filter === 'public' ? 'Public Matches' : 'Private Matches'}
              </Text>
            </View>
            <Text className={`text-sm mb-3 ${
              filter === 'public' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {filter === 'public' 
                ? 'These matches are visible to all users and open for anyone to discover and join'
                : 'These matches are invitation-only and visible only to selected players'}
            </Text>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {filter === 'public' ? visibilityStats.totalPublic : visibilityStats.totalPrivate}
                </Text>
                <Text className="text-xs text-muted-foreground">Total</Text>
              </View>
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {filter === 'public' ? visibilityStats.publicCompleted : visibilityStats.privateCompleted}
                </Text>
                <Text className="text-xs text-muted-foreground">Completed</Text>
              </View>
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {filter === 'public' ? visibilityStats.publicUpcoming : visibilityStats.privateUpcoming}
                </Text>
                <Text className="text-xs text-muted-foreground">Upcoming</Text>
              </View>
            </View>
          </View>
        )}

        {/* Match list with enhanced visibility features */}
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