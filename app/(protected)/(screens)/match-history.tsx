import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase';
import { SafeAreaView } from '@/components/safe-area-view';

// **TECHNICAL SPECIFICATION 1: Enhanced match status enumeration with confirmations**
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
  RECRUITING = 6,   // Enhanced for public matches
}

// **TECHNICAL SPECIFICATION 2: Comprehensive match data interface with confirmation and avatar support**
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
  // **NEW: Confirmation and validation fields**
  validation_status?: string;
  all_confirmed?: boolean;
  confirmation_status?: string;
  rating_applied?: boolean;
  player1: { id: string; full_name: string | null; email: string; glicko_rating: string | null; avatar_url: string | null; } | null;
  player2: { id: string; full_name: string | null; email: string; glicko_rating: string | null; avatar_url: string | null; } | null;
  player3: { id: string; full_name: string | null; email: string; glicko_rating: string | null; avatar_url: string | null; } | null;
  player4: { id: string; full_name: string | null; email: string; glicko_rating: string | null; avatar_url: string | null; } | null;
  // ENHANCEMENT: Computed properties for improved performance
  isTeam1?: boolean;
  needsScores?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  isCompleted?: boolean;
  needsConfirmation?: boolean;
  isDisputed?: boolean;
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
  userIsPlayer1?: boolean;
  userIsPlayer2?: boolean;
  userIsPlayer3?: boolean;
  userIsPlayer4?: boolean;
}

// **TECHNICAL SPECIFICATION 3: Enhanced filter type definition with confirmation options**
type FilterType = 'all' | 'upcoming' | 'completed' | 'attention' | 'recent' | 'public' | 'private' | 'needs_confirmation' | 'disputed';

// **TECHNICAL SPECIFICATION 4: Visibility and confirmation statistics interface**
interface MatchStatistics {
  totalPublic: number;
  totalPrivate: number;
  publicCompleted: number;
  privateCompleted: number;
  publicUpcoming: number;
  privateUpcoming: number;
  needsConfirmation: number;
  disputed: number;
  pendingRating: number;
}

// **TECHNICAL SPECIFICATION 5: UserAvatar Component Interface and Implementation**
interface UserAvatarProps {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    glicko_rating?: string | null;
    avatar_url: string | null;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  teamIndex?: number;
  isCurrentUser?: boolean;
  isPublicMatch?: boolean;
  showTeamBadge?: boolean;
  style?: any;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md', 
  teamIndex, 
  isCurrentUser = false,
  isPublicMatch = false,
  showTeamBadge = false,
  style 
}) => {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }[size];

  const sizeStyle = {
    xs: { width: 24, height: 24, borderRadius: 12 },
    sm: { width: 32, height: 32, borderRadius: 16 },
    md: { width: 40, height: 40, borderRadius: 20 },
    lg: { width: 48, height: 48, borderRadius: 24 }
  }[size];

  const textSize = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-lg'
  }[size];

  // **AVATAR BACKGROUND COLOR CALCULATION WITH VISIBILITY CONTEXT**
  const getBgColor = () => {
    if (isCurrentUser) {
      return isPublicMatch ? 'bg-blue-600' : 'bg-primary';
    }
    
    // Team-based colors with visibility context
    if (teamIndex === 0 || teamIndex === 1) {
      return isPublicMatch ? 'bg-blue-500' : 'bg-primary'; // Team 1
    }
    if (teamIndex === 2 || teamIndex === 3) {
      return isPublicMatch ? 'bg-purple-500' : 'bg-indigo-500'; // Team 2
    }
    
    return 'bg-gray-500'; // Default/neutral
  };

  // **ENHANCED FALLBACK TEXT GENERATION**
  const getInitial = () => {
    if (isCurrentUser) return 'Y';
    
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  const shouldShowImage = user.avatar_url && !imageLoadError && !isCurrentUser;

  // **TEAM BADGE RENDERING WITH VISIBILITY CONTEXT**
  const renderTeamBadge = () => {
    if (!showTeamBadge || teamIndex === undefined) return null;
    
    const teamNumber = teamIndex <= 1 ? 1 : 2;
    const badgeColor = teamNumber === 1 
      ? (isPublicMatch ? 'bg-blue-600' : 'bg-primary')
      : (isPublicMatch ? 'bg-purple-600' : 'bg-indigo-500');
    
    return (
      <View className={`absolute -top-1 -right-1 ${badgeColor} rounded-full w-4 h-4 items-center justify-center border border-white`}>
        <Text className="text-white text-[8px] font-bold">
          {teamNumber}
        </Text>
      </View>
    );
  };

  // **CURRENT USER INDICATOR**
  const renderCurrentUserIndicator = () => {
    if (!isCurrentUser) return null;
    
    return (
      <View className="absolute -top-1 -left-1 bg-green-500 rounded-full w-4 h-4 items-center justify-center border border-white">
        <Ionicons name="checkmark" size={10} color="white" />
      </View>
    );
  };

  if (shouldShowImage) {
    return (
      <View className={`${sizeClasses} rounded-full ${getBgColor()} items-center justify-center overflow-hidden relative`} style={style}>
        <Image
          source={{ uri: user.avatar_url }}
          style={sizeStyle}
          resizeMode="cover"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoadError(true);
            setImageLoading(false);
          }}
          onLoadStart={() => setImageLoading(true)}
        />
        {/* **LOADING STATE OVERLAY** */}
        {imageLoading && (
          <View 
            className={`absolute inset-0 ${getBgColor()} items-center justify-center`}
          >
            <Text className={`${textSize} font-bold text-white`}>
              {getInitial()}
            </Text>
          </View>
        )}
        {renderTeamBadge()}
        {renderCurrentUserIndicator()}
      </View>
    );
  }

  // **FALLBACK TO TEXT INITIAL WITH ENHANCED STYLING**
  return (
    <View className={`${sizeClasses} rounded-full ${getBgColor()} items-center justify-center relative`} style={style}>
      <Text className={`${textSize} font-bold text-white`}>
        {getInitial()}
      </Text>
      {renderTeamBadge()}
      {renderCurrentUserIndicator()}
    </View>
  );
};

// **TECHNICAL SPECIFICATION 6: Enhanced Empty Slot Avatar Component**
interface EmptySlotAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  teamIndex?: number;
  isPublicMatch?: boolean;
  style?: any;
}

const EmptySlotAvatar: React.FC<EmptySlotAvatarProps> = ({ 
  size = 'md', 
  teamIndex, 
  isPublicMatch = false,
  style 
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }[size];

  const textSize = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-lg'
  }[size];

  // **TEAM-BASED BORDER COLORS WITH VISIBILITY CONTEXT**
  const getBorderColor = () => {
    if (teamIndex === 0 || teamIndex === 1) {
      return isPublicMatch ? 'border-blue-400' : 'border-primary'; // Team 1
    }
    if (teamIndex === 2 || teamIndex === 3) {
      return isPublicMatch ? 'border-purple-400' : 'border-indigo-400'; // Team 2
    }
    return 'border-gray-400'; // Default
  };

  const getTextColor = () => {
    if (teamIndex === 0 || teamIndex === 1) {
      return isPublicMatch ? 'text-blue-400' : 'text-primary'; // Team 1
    }
    if (teamIndex === 2 || teamIndex === 3) {
      return isPublicMatch ? 'text-purple-400' : 'text-indigo-400'; // Team 2
    }
    return 'text-gray-400'; // Default
  };

  return (
    <View 
      className={`${sizeClasses} rounded-full border-2 border-dashed ${getBorderColor()} items-center justify-center bg-gray-50 dark:bg-gray-800/50`} 
      style={style}
    >
      <Text className={`${textSize} font-bold ${getTextColor()}`}>
        ?
      </Text>
    </View>
  );
};

export default function EnhancedMatchHistoryWithConfirmations() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // **TECHNICAL SPECIFICATION 7: Enhanced state management with confirmation-aware data structures**
  const [allMatches, setAllMatches] = useState<EnhancedMatchData[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<{
    all: EnhancedMatchData[];
    upcoming: EnhancedMatchData[];
    completed: EnhancedMatchData[];
    attention: EnhancedMatchData[];
    recent: EnhancedMatchData[];
    public: EnhancedMatchData[];
    private: EnhancedMatchData[];
    needs_confirmation: EnhancedMatchData[];
    disputed: EnhancedMatchData[];
  }>({
    all: [],
    upcoming: [],
    completed: [],
    attention: [],
    recent: [],
    public: [],
    private: [],
    needs_confirmation: [],
    disputed: []
  });
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'opponent' | 'result' | 'visibility' | 'confirmation'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [matchStats, setMatchStats] = useState<MatchStatistics>({
    totalPublic: 0,
    totalPrivate: 0,
    publicCompleted: 0,
    privateCompleted: 0,
    publicUpcoming: 0,
    privateUpcoming: 0,
    needsConfirmation: 0,
    disputed: 0,
    pendingRating: 0
  });
  const { session } = useAuth();

  // **TECHNICAL SPECIFICATION 8: Component lifecycle management**
  useEffect(() => {
    if (session?.user?.id) {
      fetchMatches();
    }
  }, [session, friendId]);

  useEffect(() => {
    applyFilters();
  }, [filter, allMatches, searchQuery, sortBy, sortOrder]);

  // **TECHNICAL SPECIFICATION 9: Calculate comprehensive match statistics**
  useEffect(() => {
    calculateMatchStatistics();
  }, [allMatches]);

  // **TECHNICAL SPECIFICATION 10: Comprehensive match statistics calculation**
  const calculateMatchStatistics = () => {
    const stats: MatchStatistics = {
      totalPublic: 0,
      totalPrivate: 0,
      publicCompleted: 0,
      privateCompleted: 0,
      publicUpcoming: 0,
      privateUpcoming: 0,
      needsConfirmation: 0,
      disputed: 0,
      pendingRating: 0
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

      // **NEW: Confirmation-related statistics**
      if (match.needsConfirmation) stats.needsConfirmation++;
      if (match.isDisputed) stats.disputed++;
      if (match.isCompleted && !match.rating_applied) stats.pendingRating++;
    });

    setMatchStats(stats);
  };

  // **TECHNICAL SPECIFICATION 11: Enhanced filter application with confirmation-based logic**
  const applyFilters = () => {
    console.log('🔍 Match History: Applying filters with confirmation support', {
      totalMatches: allMatches.length,
      activeFilter: filter,
      searchQuery,
      sortBy,
      sortOrder
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // **ENHANCED: Confirmation-aware base filtering**
    const baseFiltered = {
      all: allMatches,
      
      // Future matches based purely on start_time
      upcoming: allMatches.filter(match => {
        const startTime = new Date(match.start_time);
        const isFuture = startTime > now;
        return isFuture && match.status !== MatchStatus.CANCELLED;
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
                              match.status === MatchStatus.NEEDS_CONFIRMATION ||
                              match.needsConfirmation ||
                              match.isDisputed;
        return needsAttention;
      }),
      
      // Recent matches within last week
      recent: allMatches.filter(match => {
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const matchDate = new Date(match.completed_at || match.end_time || match.start_time);
        const isRecent = matchDate >= weekAgo && hasScores;
        return isRecent;
      }),

      // Visibility-based filters
      public: allMatches.filter(match => match.is_public === true),
      private: allMatches.filter(match => match.is_public === false),

      // **NEW: Confirmation-based filters**
      needs_confirmation: allMatches.filter(match => {
        const statusNum = typeof match.status === 'string' ? parseInt(match.status, 10) : match.status;
        const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
        const isCompleted = statusNum === 4 && hasScores;
        
        if (!isCompleted || !session?.user?.id) return false;
        
        // Show matches where user hasn't confirmed yet
        return match.confirmation_status === 'pending' && !match.all_confirmed;
      }),

      disputed: allMatches.filter(match => {
        return match.validation_status === 'disputed' || 
               match.confirmation_status === 'rejected';
      })
    };

    // **TECHNICAL SPECIFICATION 12: Enhanced search filtering with confirmation context**
    let searchFiltered = baseFiltered;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      Object.keys(searchFiltered).forEach(key => {
        searchFiltered[key as keyof typeof searchFiltered] = searchFiltered[key as keyof typeof searchFiltered].filter(match => {
          const visibilityText = match.is_public ? 'public open' : 'private invitation';
          const confirmationText = match.needsConfirmation ? 'needs confirmation' : 
                                 match.isDisputed ? 'disputed rejected' : 
                                 match.all_confirmed ? 'confirmed' : '';
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
            visibilityText,
            confirmationText // **NEW: Include confirmation status in search**
          ].filter(Boolean).join(' ').toLowerCase();
          
          return searchableText.includes(query);
        });
      });
    }

    // **TECHNICAL SPECIFICATION 13: Enhanced sorting algorithms with confirmation support**
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

          // **NEW: Confirmation-based sorting**
          case 'confirmation':
            // Priority: disputed > needs confirmation > confirmed > no confirmation needed
            const getPriority = (match: EnhancedMatchData) => {
              if (match.isDisputed) return 4;
              if (match.needsConfirmation) return 3;
              if (match.all_confirmed) return 2;
              return 1;
            };
            
            const priorityA = getPriority(a);
            const priorityB = getPriority(b);
            
            if (priorityA !== priorityB) {
              comparison = priorityB - priorityA; // Higher priority first
            } else {
              // Secondary sort by date
              const dateA = new Date(a.start_time);
              const dateB = new Date(b.start_time);
              comparison = dateB.getTime() - dateA.getTime();
            }
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    });

    console.log('📊 Match History: Filter results with confirmation support', {
      all: searchFiltered.all.length,
      upcoming: searchFiltered.upcoming.length,
      completed: searchFiltered.completed.length,
      attention: searchFiltered.attention.length,
      recent: searchFiltered.recent.length,
      public: searchFiltered.public.length,
      private: searchFiltered.private.length,
      needs_confirmation: searchFiltered.needs_confirmation.length,
      disputed: searchFiltered.disputed.length
    });

    setFilteredMatches(searchFiltered);
  };

  // **TECHNICAL SPECIFICATION 14: Enhanced data fetching with confirmation fields and avatar support**
  const fetchMatches = async (shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      console.log('🚀 Match History: Fetching matches with confirmation data and avatars', {
        userId: session?.user?.id,
        friendId,
        shouldRefresh
      });
      
      // **ENHANCED query with confirmation fields and comprehensive player data**
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

      console.log('📊 Match History: Raw data received with confirmation info and avatars:', {
        count: data?.length || 0,
        sampleMatch: data?.[0],
        publicMatches: data?.filter(m => m.is_public).length || 0,
        privateMatches: data?.filter(m => !m.is_public).length || 0,
        needsConfirmation: data?.filter(m => m.confirmation_status === 'pending' && !m.all_confirmed).length || 0,
        disputed: data?.filter(m => m.validation_status === 'disputed' || m.confirmation_status === 'rejected').length || 0
      });

      // **TECHNICAL SPECIFICATION 15: Comprehensive match data processing with confirmation context and avatar support**
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
        
        // **NEW: Confirmation-based classifications**
        const statusNum = typeof match.status === 'string' ? parseInt(match.status, 10) : match.status;
        const needsConfirmation = statusNum === 4 && hasScores && 
                                 match.confirmation_status === 'pending' && 
                                 !match.all_confirmed;
        const isDisputed = match.validation_status === 'disputed' || 
                          match.confirmation_status === 'rejected';
        
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
          needsConfirmation, // **NEW**
          isDisputed, // **NEW**
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
          // User position flags for avatar rendering
          userIsPlayer1: match.player1_id === userId,
          userIsPlayer2: match.player2_id === userId,
          userIsPlayer3: match.player3_id === userId,
          userIsPlayer4: match.player4_id === userId
        };

        console.log(`🔄 Match History: Processed match ${match.id} with confirmation data`, {
          isTeam1,
          hasScores,
          userWon,
          team1Sets,
          team2Sets,
          needsScores,
          needsConfirmation,
          isDisputed,
          isFuture,
          isCompleted,
          is_public: match.is_public,
          confirmation_status: match.confirmation_status,
          validation_status: match.validation_status
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

  // **TECHNICAL SPECIFICATION 16: Enhanced user interaction handlers**
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

  const handleSort = (by: 'date' | 'opponent' | 'result' | 'visibility' | 'confirmation') => {
    if (sortBy === by) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(by);
      setSortOrder('desc');
    }
  };

  // **TECHNICAL SPECIFICATION 17: Enhanced visibility badge component for consistent UI**
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

  // **NEW: Confirmation badge component**
  const renderConfirmationBadge = (match: EnhancedMatchData, size: 'small' | 'medium' = 'small') => {
    if (!match.isCompleted) return null;

    const iconSize = size === 'medium' ? 16 : 12;
    const textClass = size === 'medium' ? 'text-sm' : 'text-xs';
    const paddingClass = size === 'medium' ? 'px-3 py-2' : 'px-2 py-1';
    
    if (match.isDisputed) {
      return (
        <View className={`flex-row items-center ${paddingClass} rounded-full bg-red-100 dark:bg-red-900/30`}>
          <Ionicons 
            name="alert-circle-outline" 
            size={iconSize} 
            color="#dc2626" 
            style={{ marginRight: 4 }}
          />
          <Text className={`${textClass} font-medium text-red-700 dark:text-red-300`}>
            Disputed
          </Text>
        </View>
      );
    }
    
    if (match.needsConfirmation) {
      return (
        <View className={`flex-row items-center ${paddingClass} rounded-full bg-amber-100 dark:bg-amber-900/30`}>
          <Ionicons 
            name="time-outline" 
            size={iconSize} 
            color="#d97706" 
            style={{ marginRight: 4 }}
          />
          <Text className={`${textClass} font-medium text-amber-700 dark:text-amber-300`}>
            Needs Confirmation
          </Text>
        </View>
      );
    }
    
    if (match.all_confirmed) {
      return (
        <View className={`flex-row items-center ${paddingClass} rounded-full bg-green-100 dark:bg-green-900/30`}>
          <Ionicons 
            name="checkmark-circle-outline" 
            size={iconSize} 
            color="#059669" 
            style={{ marginRight: 4 }}
          />
          <Text className={`${textClass} font-medium text-green-700 dark:text-green-300`}>
            Confirmed
          </Text>
        </View>
      );
    }

    return null;
  };

  // **TECHNICAL SPECIFICATION 18: Enhanced filter buttons with confirmation indicators**
  const renderFilterButtons = () => (
    <View className="bg-background border-b border-border">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {(['all', 'upcoming', 'completed', 'attention', 'recent', 'public', 'private', 'needs_confirmation', 'disputed'] as FilterType[]).map((filterType) => {
          const count = filteredMatches[filterType]?.length || 0;
          const isActive = filter === filterType;
          
          // Enhanced styling for confirmation filters
          const isConfirmationFilter = filterType === 'needs_confirmation' || filterType === 'disputed';
          const isVisibilityFilter = filterType === 'public' || filterType === 'private';
          
          const baseClasses = isActive 
            ? (isConfirmationFilter 
                ? (filterType === 'needs_confirmation' ? 'bg-amber-600' : 'bg-red-600')
                : isVisibilityFilter 
                  ? (filterType === 'public' ? 'bg-blue-600' : 'bg-gray-600')
                  : 'bg-primary')
            : 'bg-muted/30';
          
          const getFilterIcon = () => {
            switch (filterType) {
              case 'needs_confirmation': return 'time-outline';
              case 'disputed': return 'alert-circle-outline';
              case 'public': return 'globe-outline';
              case 'private': return 'lock-closed-outline';
              default: return null;
            }
          };

          const getFilterLabel = () => {
            switch (filterType) {
              case 'needs_confirmation': return 'Needs Confirmation';
              case 'attention': return 'Needs Attention';
              default: return filterType.charAt(0).toUpperCase() + filterType.slice(1);
            }
          };

          const icon = getFilterIcon();
          
          return (
            <TouchableOpacity
              key={filterType}
              className={`px-4 py-3 mx-1 rounded-lg ${baseClasses}`}
              onPress={() => handleFilterChange(filterType)}
            >
              <View className="flex-row items-center">
                {icon && (
                  <Ionicons 
                    name={icon as any} 
                    size={14} 
                    color={isActive ? '#fff' : (
                      isConfirmationFilter 
                        ? (filterType === 'needs_confirmation' ? '#d97706' : '#dc2626')
                        : isVisibilityFilter 
                          ? (filterType === 'public' ? '#2563eb' : '#6b7280')
                          : '#666'
                    )}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text className={`font-medium ${
                  isActive ? 'text-primary-foreground' : 'text-foreground'
                }`}>
                  {getFilterLabel()}
                </Text>
                {count > 0 && (
                  <View className={`ml-2 px-2 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-primary-foreground/20' 
                      : (isConfirmationFilter 
                          ? (filterType === 'needs_confirmation' ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-red-100 dark:bg-red-900/40')
                          : isVisibilityFilter 
                            ? (filterType === 'public' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800/40')
                            : 'bg-primary/20')
                  }`}>
                    <Text className={`text-xs font-bold ${
                      isActive ? 'text-primary-foreground' : 
                      (isConfirmationFilter 
                        ? (filterType === 'needs_confirmation' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')
                        : isVisibilityFilter 
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

  // **TECHNICAL SPECIFICATION 19: Enhanced search and sort controls with confirmation options**
  const renderSearchAndSort = () => (
    <View className="p-4 bg-background border-b border-border">
      {/* Search Bar with confirmation hint */}
      <View className="flex-row items-center bg-muted/30 rounded-lg px-3 py-2 mb-3">
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          className="flex-1 ml-2 text-foreground"
          placeholder="Search matches, opponents, locations, confirmation status..."
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
      
      {/* Sort Controls with confirmation option */}
      <View className="flex-row justify-between items-center">
        <Text className="text-sm text-muted-foreground">Sort by:</Text>
        <View className="flex-row gap-2">
          {['date', 'opponent', 'result', 'visibility', 'confirmation'].map((sortType) => (
            <TouchableOpacity
              key={sortType}
              onPress={() => handleSort(sortType as any)}
              className={`px-3 py-1 rounded-full flex-row items-center ${
                sortBy === sortType 
                  ? (sortType === 'confirmation' ? 'bg-amber-600' : 
                     sortType === 'visibility' ? 'bg-blue-600' : 'bg-primary')
                  : 'bg-muted/30'
              }`}
            >
              {sortType === 'visibility' && (
                <Ionicons 
                  name="eye-outline" 
                  size={12} 
                  color={sortBy === sortType ? '#fff' : '#666'} 
                  style={{ marginRight: 4 }}
                />
              )}
              {sortType === 'confirmation' && (
                <Ionicons 
                  name="checkmark-circle-outline" 
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

  // **TECHNICAL SPECIFICATION 20: Enhanced match card rendering with confirmation information and avatars**
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

    // **Enhanced status styling with confirmation context**
    const getMatchStyle = () => {
      // Priority: disputed > needs confirmation > regular status
      if (match.isDisputed) {
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/30',
          iconName: 'alert-circle-outline',
          iconColor: '#dc2626',
          status: 'Disputed Match'
        };
      } else if (match.needsConfirmation) {
        return {
          bgColor: 'bg-amber-50 dark:bg-amber-900/30',
          iconName: 'time-outline',
          iconColor: '#d97706',
          status: 'Needs Confirmation'
        };
      } else if (match.isFuture) {
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
            status: match.all_confirmed ? 'Confirmed Victory' : 'Victory'
          };
        } else if (match.isTied) {
          return {
            bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
            iconName: 'remove-circle-outline',
            iconColor: '#d97706',
            status: match.all_confirmed ? 'Confirmed Draw' : 'Draw'
          };
        } else {
          return {
            bgColor: 'bg-red-50 dark:bg-red-900/30',
            iconName: 'close-circle-outline',
            iconColor: '#dc2626',
            status: match.all_confirmed ? 'Confirmed Defeat' : 'Defeat'
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
        className={`mb-4 rounded-xl border border-border/30 overflow-hidden`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
        onPress={() => {
          router.push({
            pathname: '/(protected)/(screens)/match-details',
            params: { 
              matchId: match.id,
              mode: match.needsScores ? 'score-entry' : match.needsConfirmation ? 'confirmation' : undefined
            }
          });
        }}
      >
        {/* **ENHANCED header with status, metadata, confirmation, and visibility indicators** */}
        <View className={`px-4 py-3 ${style.bgColor}`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-8 h-8 rounded-full bg-white/90 items-center justify-center mr-3">
                <Ionicons name={style.iconName as any} size={18} color={style.iconColor} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center flex-wrap gap-2">
                  <Text className="font-medium" style={{ color: style.iconColor }}>
                    {style.status}
                  </Text>
                  {/* **ENHANCEMENT: Both visibility and confirmation badges** */}
                  {renderVisibilityBadge(match.is_public)}
                  {renderConfirmationBadge(match)}
                </View>
                <Text className="text-xs opacity-75">
                  {formattedDate} • {formattedTime}
                </Text>
              </View>
            </View>
            
            {/* Enhanced metadata display with confirmation context */}
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
              {/* **ENHANCEMENT: Show rating status** */}
              {match.isCompleted && !match.rating_applied && (
                <Text className="text-xs opacity-75 mt-1">
                  Rating pending
                </Text>
              )}
            </View>
          </View>
        </View>
        
        {/* **Enhanced match content with confirmation-aware information and avatars** */}
        <View className="p-5 bg-card dark:bg-card/90">
          {/* **ENHANCEMENT: Confirmation-specific information banner** */}
          {match.isDisputed && (
            <View className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
              <View className="flex-row items-center">
                <Ionicons name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 8 }} />
                <Text className="text-sm text-red-800 dark:text-red-300 font-medium">
                  This match result is disputed and requires review
                </Text>
              </View>
            </View>
          )}

          {match.needsConfirmation && (
            <View className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-4 border-amber-500">
              <View className="flex-row items-center">
                <Ionicons name="time" size={16} color="#d97706" style={{ marginRight: 8 }} />
                <Text className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  Waiting for all players to confirm this match result
                </Text>
              </View>
            </View>
          )}

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

          {/* **ENHANCED Team composition with avatars** */}
          <View className="flex-row justify-between items-start mb-4">
            {/* **Team 1 - Your team with avatars** */}
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-2 font-medium">Your Team</Text>
              
              {/* **Player 1 with avatar** */}
              <View className="flex-row items-center mb-2">
                {match.player1 ? (
                  <UserAvatar 
                    user={match.player1}
                    size="md"
                    teamIndex={0}
                    isCurrentUser={match.userIsPlayer1}
                    isPublicMatch={match.is_public}
                    style={{ marginRight: 12 }}
                  />
                ) : (
                  <EmptySlotAvatar 
                    size="md"
                    teamIndex={0}
                    isPublicMatch={match.is_public}
                    style={{ marginRight: 12 }}
                  />
                )}
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
              
              {/* **Player 2 with avatar** */}
              <View className="flex-row items-center">
                {match.player2 ? (
                  <UserAvatar 
                    user={match.player2}
                    size="md"
                    teamIndex={1}
                    isCurrentUser={match.userIsPlayer2}
                    isPublicMatch={match.is_public}
                    style={{ marginRight: 12 }}
                  />
                ) : (
                  <EmptySlotAvatar 
                    size="md"
                    teamIndex={1}
                    isPublicMatch={match.is_public}
                    style={{ marginRight: 12 }}
                  />
                )}
                <View className="flex-1">
                  <Text className={`text-sm ${match.userIsPlayer2 ? 'font-bold text-primary' : 'font-medium'}`}>
                    {match.userIsPlayer2 ? 'You' : 
                     match.player2?.full_name || 
                     match.player2?.email?.split('@')[0] || 
                     (match.is_public ? 'Open for Anyone' : 'Awaiting Invite')}
                  </Text>
                  {match.player2 ? (
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player2.glicko_rating || '-'}
                    </Text>
                  ) : (
                    <Text className="text-xs text-muted-foreground">
                      {match.is_public ? 'Public slot' : 'Private invitation'}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            
            {/* **Score section with enhanced display** */}
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
                  {/* **NEW: Confirmation status in score area** */}
                  {match.isCompleted && (
                    <Text className={`text-xs mt-1 ${
                      match.all_confirmed ? 'text-green-600 dark:text-green-400' :
                      match.needsConfirmation ? 'text-amber-600 dark:text-amber-400' :
                      match.isDisputed ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                    }`}>
                      {match.all_confirmed ? 'Confirmed' :
                       match.needsConfirmation ? 'Pending' :
                       match.isDisputed ? 'Disputed' : 'Unconfirmed'}
                    </Text>
                  )}
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
            
            {/* **Team 2 - Opponents with avatars** */}
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-2 font-medium text-right">Opponents</Text>
              
              {/* **Player 3 with avatar** */}
              <View className="flex-row items-center justify-end mb-2">
                <View className="flex-1 items-end mr-3">
                  <Text className={`text-sm ${match.userIsPlayer3 ? 'font-bold text-indigo-600' : 'font-medium'} text-right`}>
                    {match.userIsPlayer3 ? 'You' : 
                     match.player3?.full_name || 
                     match.player3?.email?.split('@')[0] || 
                     (match.is_public ? 'Open for Anyone' : 'Awaiting Invite')}
                  </Text>
                  {match.player3 ? (
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player3.glicko_rating || '-'}
                    </Text>
                  ) : (
                    <Text className="text-xs text-muted-foreground">
                      {match.is_public ? 'Public slot' : 'Private invitation'}
                    </Text>
                  )}
                </View>
                {match.player3 ? (
                  <UserAvatar 
                    user={match.player3}
                    size="md"
                    teamIndex={2}
                    isCurrentUser={match.userIsPlayer3}
                    isPublicMatch={match.is_public}
                  />
                ) : (
                  <EmptySlotAvatar 
                    size="md"
                    teamIndex={2}
                    isPublicMatch={match.is_public}
                  />
                )}
              </View>
              
              {/* **Player 4 with avatar** */}
              <View className="flex-row items-center justify-end">
                <View className="flex-1 items-end mr-3">
                  <Text className={`text-sm ${match.userIsPlayer4 ? 'font-bold text-indigo-600' : 'font-medium'} text-right`}>
                    {match.userIsPlayer4 ? 'You' : 
                     match.player4?.full_name || 
                     match.player4?.email?.split('@')[0] || 
                     (match.is_public ? 'Open for Anyone' : 'Awaiting Invite')}
                  </Text>
                  {match.player4 ? (
                    <Text className="text-xs text-muted-foreground">
                      Rating: {match.player4.glicko_rating || '-'}
                    </Text>
                  ) : (
                    <Text className="text-xs text-muted-foreground">
                      {match.is_public ? 'Public slot' : 'Private invitation'}
                    </Text>
                  )}
                </View>
                {match.player4 ? (
                  <UserAvatar 
                    user={match.player4}
                    size="md"
                    teamIndex={3}
                    isCurrentUser={match.userIsPlayer4}
                    isPublicMatch={match.is_public}
                  />
                ) : (
                  <EmptySlotAvatar 
                    size="md"
                    teamIndex={3}
                    isPublicMatch={match.is_public}
                  />
                )}
              </View>
            </View>
          </View>
          
          {/* **Enhanced match description** */}
          {match.description && (
            <View className="mb-3 p-3 bg-muted/20 rounded-lg">
              <Text className="text-sm italic">{match.description}</Text>
            </View>
          )}
          
          {/* **Enhanced result display for completed matches with confirmation status** */}
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
              {/* **ENHANCEMENT: Show badges in results** */}
              <View className="ml-2 flex-row gap-1">
                {renderVisibilityBadge(match.is_public, 'small')}
                {renderConfirmationBadge(match, 'small')}
              </View>
            </View>
          )}
          
          {/* **ENHANCED action indicators for non-completed matches with confirmation context** */}
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
          
          {/* **Enhanced quick stats for completed matches with confirmation info** */}
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
                <Text className="text-xs text-muted-foreground">Status</Text>
                <Text className={`text-sm font-medium ${
                  match.all_confirmed ? 'text-green-600 dark:text-green-400' :
                  match.needsConfirmation ? 'text-amber-600 dark:text-amber-400' :
                  match.isDisputed ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {match.all_confirmed ? 'Confirmed' :
                   match.needsConfirmation ? 'Pending' :
                   match.isDisputed ? 'Disputed' : 'Final'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // **Helper function for open slots display**
  const getOpenSlotsText = (match: EnhancedMatchData) => {
    const openSlots = 4 - [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean).length;
    
    if (openSlots === 0) return 'Match is full';
    if (openSlots === 1) return '1 open slot';
    return `${openSlots} open slots`;
  };

  // **TECHNICAL SPECIFICATION 21: Enhanced empty state with confirmation-aware contextual messaging**
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
        // **NEW: Confirmation-specific empty states**
        case 'needs_confirmation':
          return {
            title: "No matches need confirmation",
            message: "All completed matches have been confirmed by all players",
            icon: "checkmark-circle-outline"
          };
        case 'disputed':
          return {
            title: "No disputed matches",
            message: "All match results are accepted by all players",
            icon: "shield-checkmark-outline"
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
      <View className="bg-card rounded-xl p-8 items-center border border-border/30 m-6" style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
          filter === 'public' ? 'bg-blue-100 dark:bg-blue-900/30' :
          filter === 'private' ? 'bg-gray-100 dark:bg-gray-800/30' :
          filter === 'needs_confirmation' ? 'bg-amber-100 dark:bg-amber-900/30' :
          filter === 'disputed' ? 'bg-red-100 dark:bg-red-900/30' :
          'bg-primary/10'
        }`}>
          <Ionicons 
            name={emptyState.icon as any} 
            size={32} 
            color={
              filter === 'public' ? '#2563eb' :
              filter === 'private' ? '#6b7280' :
              filter === 'needs_confirmation' ? '#d97706' :
              filter === 'disputed' ? '#dc2626' :
              '#2148ce'
            } 
          />
        </View>
        <Text className="text-lg font-medium mt-2 mb-2">{emptyState.title}</Text>
        <Text className="text-muted-foreground text-center mb-6">
          {emptyState.message}
        </Text>
        
        {/* **Enhanced action buttons for all filter types** */}
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
            
            {/* **Show alternative options** */}
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
        
        {/* **Show filter alternatives for confirmation states** */}
        {(filter === 'needs_confirmation' || filter === 'disputed') && (
          <View className="w-full space-y-3">
            <Button
              variant="outline"
              onPress={() => setFilter('completed')}
              className="w-full"
            >
              <Ionicons name="checkmark-done-outline" size={18} style={{ marginRight: 8 }} />
              <Text>View All Completed Matches</Text>
            </Button>
            
            <Button
              variant="outline"
              onPress={() => setFilter('all')}
              className="w-full"
            >
              <Ionicons name="list-outline" size={18} style={{ marginRight: 8 }} />
              <Text>View All Matches</Text>
            </Button>
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

  // **Loading state with enhanced UI**
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#2148ce" />
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
            <View className="items-center">
              <View className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full items-center justify-center">
                <Ionicons name="time" size={12} color="#d97706" />
              </View>
              <Text className="text-xs text-muted-foreground mt-1">Pending</Text>
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
      {/* **Enhanced filter buttons with confirmation options** */}
      {renderFilterButtons()}
      
      {/* **Search and sort controls with confirmation features** */}
      {renderSearchAndSort()}
      
      {/* **Enhanced content area** */}
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#2148ce"
            colors={['#2148ce']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* **ENHANCED summary statistics with confirmation breakdown** */}
        {currentMatches.length > 0 && filter === 'all' && (
          <View className="bg-card rounded-xl p-4 mb-4 border border-border/30" style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <Text className="text-lg font-semibold mb-3">Match Summary</Text>
            
            {/* **Primary stats row** */}
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
                  {matchStats.needsConfirmation}
                </Text>
                <Text className="text-xs text-muted-foreground">Pending</Text>
              </View>
            </View>

            {/* **ENHANCEMENT: Multi-section breakdown** */}
            <View className="border-t border-border/30 pt-4">
              {/* **Visibility Section** */}
              <Text className="text-sm font-medium mb-3 text-center">Visibility Breakdown</Text>
              <View className="flex-row justify-around mb-4">
                <TouchableOpacity 
                  onPress={() => setFilter('public')}
                  className="items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                >
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="globe" size={16} color="#2563eb" />
                    <Text className="text-lg font-bold text-blue-600 dark:text-blue-400 ml-1">
                      {matchStats.totalPublic}
                    </Text>
                  </View>
                  <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">Public Matches</Text>
                  <Text className="text-xs text-muted-foreground">
                    {matchStats.publicCompleted} completed • {matchStats.publicUpcoming} upcoming
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setFilter('private')}
                  className="items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/20"
                >
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="lock-closed" size={16} color="#6b7280" />
                    <Text className="text-lg font-bold text-gray-600 dark:text-gray-400 ml-1">
                      {matchStats.totalPrivate}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-600 dark:text-gray-400 font-medium">Private Matches</Text>
                  <Text className="text-xs text-muted-foreground">
                    {matchStats.privateCompleted} completed • {matchStats.privateUpcoming} upcoming
                  </Text>
                </TouchableOpacity>
              </View>

              {/* **NEW: Confirmation Section** */}
              <Text className="text-sm font-medium mb-3 text-center">Confirmation Status</Text>
              <View className="flex-row justify-around">
                <TouchableOpacity 
                  onPress={() => setFilter('needs_confirmation')}
                  className="items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20"
                >
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="time" size={16} color="#d97706" />
                    <Text className="text-lg font-bold text-amber-600 dark:text-amber-400 ml-1">
                      {matchStats.needsConfirmation}
                    </Text>
                  </View>
                  <Text className="text-xs text-amber-600 dark:text-amber-400 font-medium">Needs Confirmation</Text>
                  <Text className="text-xs text-muted-foreground">
                    Awaiting player confirmation
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setFilter('disputed')}
                  className="items-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20"
                >
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="alert-circle" size={16} color="#dc2626" />
                    <Text className="text-lg font-bold text-red-600 dark:text-red-400 ml-1">
                      {matchStats.disputed}
                    </Text>
                  </View>
                  <Text className="text-xs text-red-600 dark:text-red-400 font-medium">Disputed Matches</Text>
                  <Text className="text-xs text-muted-foreground">
                    Require admin review
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* **ENHANCED filter-specific summary displays** */}
        {currentMatches.length > 0 && (filter === 'needs_confirmation' || filter === 'disputed') && (
          <View className={`rounded-xl p-4 mb-4 border ${
            filter === 'needs_confirmation' 
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`} style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <View className="flex-row items-center mb-3">
              <Ionicons 
                name={filter === 'needs_confirmation' ? 'time' : 'alert-circle'} 
                size={20} 
                color={filter === 'needs_confirmation' ? '#d97706' : '#dc2626'} 
              />
              <Text className={`text-lg font-semibold ml-2 ${
                filter === 'needs_confirmation' ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {filter === 'needs_confirmation' ? 'Matches Needing Confirmation' : 'Disputed Matches'}
              </Text>
            </View>
            <Text className={`text-sm mb-3 ${
              filter === 'needs_confirmation' ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {filter === 'needs_confirmation' 
                ? 'These matches are waiting for all players to confirm the results before ratings are applied'
                : 'These matches have disputed results and require admin review to resolve'}
            </Text>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'needs_confirmation' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {filter === 'needs_confirmation' ? matchStats.needsConfirmation : matchStats.disputed}
                </Text>
                <Text className="text-xs text-muted-foreground">Total</Text>
              </View>
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'needs_confirmation' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {matchStats.pendingRating}
                </Text>
                <Text className="text-xs text-muted-foreground">Rating Pending</Text>
              </View>
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'needs_confirmation' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {currentMatches.length}
                </Text>
                <Text className="text-xs text-muted-foreground">Showing</Text>
              </View>
            </View>
          </View>
        )}

        {/* **Enhanced visibility-specific summary for public/private filters** */}
        {currentMatches.length > 0 && (filter === 'public' || filter === 'private') && (
          <View className={`rounded-xl p-4 mb-4 border ${
            filter === 'public' 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700'
          }`} style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
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
                  {filter === 'public' ? matchStats.totalPublic : matchStats.totalPrivate}
                </Text>
                <Text className="text-xs text-muted-foreground">Total</Text>
              </View>
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {filter === 'public' ? matchStats.publicCompleted : matchStats.privateCompleted}
                </Text>
                <Text className="text-xs text-muted-foreground">Completed</Text>
              </View>
              <View className="items-center">
                <Text className={`text-xl font-bold ${
                  filter === 'public' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {filter === 'public' ? matchStats.publicUpcoming : matchStats.privateUpcoming}
                </Text>
                <Text className="text-xs text-muted-foreground">Upcoming</Text>
              </View>
            </View>
          </View>
        )}

        {/* **Match list with enhanced confirmation features and avatars** */}
        {currentMatches.length > 0 
          ? currentMatches.map(renderMatchCard)
          : renderEmptyMatches()
        }
        
        {/* **Bottom padding** */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}