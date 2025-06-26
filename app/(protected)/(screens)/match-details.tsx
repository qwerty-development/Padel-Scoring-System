import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  RefreshControl,
  TextInput,
  Alert,
  Vibration,
  Animated,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { format } from "date-fns";

import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { SafeAreaView } from "@/components/safe-area-view";
import {
  SetScoreInput,
  SetScore,
} from "@/components/create-match/SetScoreInput";
import { useColorScheme } from "@/lib/useColorScheme";
import { useMatchReporting } from "@/hooks/useMatchReporting";
import { ReportReason, ValidationStatus } from "@/types/match-reporting";
import { NotificationHelpers } from '@/services/notificationHelpers';
import { MatchConfirmationSection } from "@/components/MatchConfirmationSection";
import { useMatchConfirmation } from "@/hooks/useMatchConfirmation";
import { EnhancedRatingService } from "@/services/enhanced-rating.service";

// CORRECTED: Enhanced match status enumeration with proper TEXT database handling
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5, // Custom UI status
  RECRUITING = 6,
}

// CRITICAL FIX: Database type handling utilities for TEXT status field
const statusToString = (status: MatchStatus | number): string => {
  return String(status);
};

const statusFromString = (status: string | number): number => {
  if (typeof status === 'string') {
    const parsed = parseInt(status, 10);
    return isNaN(parsed) ? MatchStatus.PENDING : parsed;
  }
  return typeof status === 'number' ? status : MatchStatus.PENDING;
};

// CRITICAL FIX: Safe status comparison for TEXT database field
const isStatusEqual = (dbStatus: string | number, compareStatus: MatchStatus): boolean => {
  const dbStatusNum = statusFromString(dbStatus);
  return dbStatusNum === compareStatus;
};

// FIXED: Proper database type handling utilities for score fields
const ensureInteger = (value: any): number => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return typeof value === 'number' ? value : 0;
};

const ensureIntegerOrNull = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  return ensureInteger(value);
};

// ENHANCED: Match validation utilities
const validateScore = (score: number): boolean => {
  return Number.isInteger(score) && score >= 0 && score <= 7;
};

const validateSetScore = (team1: number, team2: number): boolean => {
  if (!validateScore(team1) || !validateScore(team2)) return false;
  
  // Padel scoring rules validation
  const diff = Math.abs(team1 - team2);
  const winner = Math.max(team1, team2);
  const loser = Math.min(team1, team2);
  
  // Must win by 2 if score reaches 6-6, otherwise first to 6
  if (winner === 6) {
    return loser <= 4 || (loser === 5 && diff >= 1) || (loser === 6 && diff >= 2);
  }
  
  // 7 points only allowed in tiebreak situations
  if (winner === 7) {
    return loser === 6 || loser === 5;
  }
  
  return true;
};

// ENHANCED: Comprehensive interface definitions with better type safety AND AVATAR SUPPORT
interface PlayerDetail {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
  avatar_url: string | null; // CRITICAL: Avatar support
}

interface MatchDetail {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: string | number;
  created_at: string;
  completed_at: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  validation_deadline: string | null;
  validation_status?: string;
  is_public: boolean;
  description: string | null;
  all_confirmed?: boolean;
  confirmation_status?: string;
  player1: PlayerDetail;
  player2: PlayerDetail | null;
  player3: PlayerDetail | null;
  player4: PlayerDetail | null;
}

interface GlickoRating {
  rating: number;
  rd: number;
  vol: number;
}

// ENHANCED: Advanced match state interface with comprehensive permission system
interface MatchState {
  isFuture: boolean;
  isPast: boolean;
  needsScores: boolean;
  hasScores: boolean;
  canJoin: boolean;
  userParticipating: boolean;
  userTeam: 1 | 2 | null;
  team1Sets: number;
  team2Sets: number;
  winnerTeam: number;
  userWon: boolean | null;
  canCancel: boolean;
  hoursFromCompletion: number;
  isCreator: boolean;
  canEnterScores: boolean;
  canViewScores: boolean;
  matchPhase: 'upcoming' | 'active' | 'completed' | 'cancelled';
  timeStatus: 'early' | 'soon' | 'now' | 'recent' | 'old';
  showConfirmationSection: boolean;
}

// ENHANCED: Score entry state with validation
interface ScoreEntryState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestedWinner: number | null;
}

// ENHANCEMENT: Player Avatar Component with Advanced Features
interface PlayerAvatarProps {
  player: PlayerDetail | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isCurrentUser?: boolean;
  isCreator?: boolean;
  teamColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'yellow';
  showBorder?: boolean;
  showStatus?: boolean;
  statusType?: 'creator' | 'you' | 'winner' | 'empty';
}

function PlayerAvatar({ 
  player, 
  size = 'md', 
  isCurrentUser = false,
  isCreator = false,
  teamColor = 'primary',
  showBorder = true,
  showStatus = false,
  statusType = 'empty'
}: PlayerAvatarProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeConfig = {
    xs: { container: 'w-6 h-6', text: 'text-xs', style: { width: 24, height: 24, borderRadius: 12 } },
    sm: { container: 'w-8 h-8', text: 'text-sm', style: { width: 32, height: 32, borderRadius: 16 } },
    md: { container: 'w-12 h-12', text: 'text-lg', style: { width: 48, height: 48, borderRadius: 24 } },
    lg: { container: 'w-16 h-16', text: 'text-xl', style: { width: 64, height: 64, borderRadius: 32 } },
    xl: { container: 'w-20 h-20', text: 'text-2xl', style: { width: 80, height: 80, borderRadius: 40 } }
  };

  const colorConfig = {
    primary: 'bg-primary',
    secondary: 'bg-indigo-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    yellow: 'bg-yellow-500'
  };

  const config = sizeConfig[size];
  const bgColor = player ? colorConfig[teamColor] : 'bg-gray-300 dark:bg-gray-700';
  
  // Enhanced border for current user
  const borderClass = showBorder 
    ? isCurrentUser 
      ? 'border-2 border-yellow-400 shadow-lg' 
      : 'border-2 border-white dark:border-gray-700 shadow-md'
    : '';

  // Get the fallback initial
  const getInitial = () => {
    if (!player) return '?';
    if (player.full_name?.trim()) {
      return player.full_name.charAt(0).toUpperCase();
    }
    if (player.email) {
      return player.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  const shouldShowImage = player?.avatar_url && !imageLoadError;

  return (
    <View className="items-center">
      {/* Avatar Container */}
      <View className={`${config.container} rounded-full ${bgColor} items-center justify-center ${borderClass} overflow-hidden relative`}>
        {shouldShowImage ? (
          <>
            <Image
              source={{ uri: player.avatar_url }}
              style={config.style}
              resizeMode="cover"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoadError(true);
                setImageLoading(false);
              }}
              onLoadStart={() => setImageLoading(true)}
            />
            {/* Loading state overlay */}
            {imageLoading && (
              <View 
                className={`absolute inset-0 ${bgColor} items-center justify-center`}
                style={{
                  backgroundColor: teamColor === 'primary' ? 'rgba(26, 126, 189, 0.8)' :
                                   teamColor === 'secondary' ? 'rgba(99, 102, 241, 0.8)' :
                                   teamColor === 'success' ? 'rgba(34, 197, 94, 0.8)' :
                                   teamColor === 'warning' ? 'rgba(245, 158, 11, 0.8)' :
                                   teamColor === 'yellow' ? 'rgba(234, 179, 8, 0.8)' :
                                   'rgba(156, 163, 175, 0.8)'
                }}
              >
                <Text className={`${config.text} font-bold text-white`}>
                  {getInitial()}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text className={`${config.text} font-bold text-white`}>
            {getInitial()}
          </Text>
        )}

        {/* Status indicators */}
        {isCurrentUser && (
          <View className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full w-4 h-4 items-center justify-center border border-white">
            <Ionicons name="person" size={8} color="white" />
          </View>
        )}
        
        {isCreator && !isCurrentUser && (
          <View className="absolute -bottom-1 -right-1 bg-purple-500 rounded-full w-4 h-4 items-center justify-center border border-white">
            <Ionicons name="star" size={8} color="white" />
          </View>
        )}
      </View>

      {/* Status badges */}
      {showStatus && statusType && (
        <View className="mt-1">
          {statusType === 'creator' && (
            <View className="bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-purple-700 dark:text-purple-300">Creator</Text>
            </View>
          )}
          {statusType === 'you' && (
            <View className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-yellow-700 dark:text-yellow-300">You</Text>
            </View>
          )}
          {statusType === 'winner' && (
            <View className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-green-700 dark:text-green-300">Winner</Text>
            </View>
          )}
          {statusType === 'empty' && !player && (
            <View className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">Open</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function EnhancedMatchDetails() {
  const { matchId, mode } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { session, profile } = useAuth();

  // ENHANCED: Score entry state management with validation
  const [editingScores, setEditingScores] = useState(mode === "score-entry");
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);
  const [scoreValidation, setScoreValidation] = useState<ScoreEntryState>({
    isValid: false,
    errors: [],
    warnings: [],
    suggestedWinner: null
  });

  // NEW: MODIFIED Collapsible state management - Performance starts collapsed
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  // NEW: Expandable FAB state management
  const [fabExpanded, setFabExpanded] = useState(false);
  const [fabAnimValue] = useState(new Animated.Value(0));

  // ENHANCED: UI state management
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [animatedValue] = useState(new Animated.Value(0));
  
  // CRITICAL: Match reporting state management
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>(ReportReason.INCORRECT_SCORE);
  const [reportDetails, setReportDetails] = useState('');

  // NEW: Match confirmation hook
  const {
    confirmationStatus,
    userConfirmation,
    needsConfirmation,
    isFullyConfirmed,
    isCancelled,
    loading: confirmationLoading
  } = useMatchConfirmation(matchId as string);
  
  // REQUIREMENT 1: Enhanced match state calculation with comprehensive analysis
  const matchState = useMemo((): MatchState => {
    if (!match || !session?.user?.id) {
      return {
        isFuture: false,
        isPast: false,
        needsScores: false,
        hasScores: false,
        canJoin: false,
        userParticipating: false,
        userTeam: null,
        team1Sets: 0,
        team2Sets: 0,
        winnerTeam: 0,
        userWon: null,
        canCancel: false,
        hoursFromCompletion: 0,
        isCreator: false,
        canEnterScores: false,
        canViewScores: true,
        matchPhase: 'upcoming',
        timeStatus: 'early',
        showConfirmationSection: false,
      };
    }

    console.log('🔍 Enhanced Match Details: Calculating comprehensive match state for:', match.id);

    // ENHANCED: Advanced time-based analysis
    const now = new Date();
    const startTime = new Date(match.start_time);
    const endTime = match.end_time ? new Date(match.end_time) : null;
    const completedTime = match.completed_at ? new Date(match.completed_at) : null;
    
    const isFuture = startTime > now;
    const isPast = endTime ? endTime < now : startTime < now;
    const hasScores = match.team1_score_set1 !== null && match.team2_score_set1 !== null;
    
    // FIXED: Use proper integer comparison for status
    const statusInt = ensureInteger(match.status);
    const needsScores = isPast && !hasScores && statusInt !== MatchStatus.CANCELLED;

    // ENHANCED: Time categorization for better UX
    const minutesToStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    const hoursFromCompletion = completedTime 
      ? (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60)
      : endTime && !isFuture 
        ? (now.getTime() - endTime.getTime()) / (1000 * 60 * 60)
        : 0;

    const timeStatus: MatchState['timeStatus'] = 
      minutesToStart > 1440 ? 'early' :    // More than 24 hours
      minutesToStart > 60 ? 'soon' :        // 1-24 hours
      minutesToStart > -60 ? 'now' :        // Within 1 hour
      hoursFromCompletion < 24 ? 'recent' : // Last 24 hours
      'old';                                // More than 24 hours ago

    const matchPhase: MatchState['matchPhase'] = 
      statusInt === MatchStatus.CANCELLED ? 'cancelled' :
      hasScores ? 'completed' :
      isPast ? 'active' :
      'upcoming';

    // ENHANCED: Advanced permission system
    const userId = session.user.id;
    const isCreator = userId === match.player1_id;
    
    const canCancel = isCreator && 
                     statusInt !== MatchStatus.CANCELLED &&
                     (isFuture || hoursFromCompletion < 24);

    const canEnterScores = isCreator && needsScores;
    const canViewScores = hasScores || matchState?.userParticipating || isCreator;

    // ENHANCED: User participation analysis
    const isPlayer1 = match.player1_id === userId;
    const isPlayer2 = match.player2_id === userId;
    const isPlayer3 = match.player3_id === userId;
    const isPlayer4 = match.player4_id === userId;
    
    const userParticipating = isPlayer1 || isPlayer2 || isPlayer3 || isPlayer4;
    const userTeam: 1 | 2 | null = 
      (isPlayer1 || isPlayer2) ? 1 : 
      (isPlayer3 || isPlayer4) ? 2 : null;

    const hasOpenSlots = !match.player2_id || !match.player3_id || !match.player4_id;
    const canJoin = isFuture && !userParticipating && hasOpenSlots;

    // ENHANCED: Advanced score analysis with better winner determination
    let team1Sets = 0, team2Sets = 0, winnerTeam = 0;
    
    if (hasScores) {
      // Set 1 analysis
      const t1s1 = ensureIntegerOrNull(match.team1_score_set1) || 0;
      const t2s1 = ensureIntegerOrNull(match.team2_score_set1) || 0;
      if (t1s1 > t2s1) team1Sets++;
      else if (t2s1 > t1s1) team2Sets++;
      
      // Set 2 analysis
      const t1s2 = ensureIntegerOrNull(match.team1_score_set2);
      const t2s2 = ensureIntegerOrNull(match.team2_score_set2);
      if (t1s2 !== null && t2s2 !== null) {
        if (t1s2 > t2s2) team1Sets++;
        else if (t2s2 > t1s2) team2Sets++;
      }
      
      // Set 3 analysis
      const t1s3 = ensureIntegerOrNull(match.team1_score_set3);
      const t2s3 = ensureIntegerOrNull(match.team2_score_set3);
      if (t1s3 !== null && t2s3 !== null) {
        if (t1s3 > t2s3) team1Sets++;
        else if (t2s3 > t1s3) team2Sets++;
      }
      
      // Winner determination with database fallback
      winnerTeam = ensureIntegerOrNull(match.winner_team) || 
                  (team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : 0);
    }

    const userWon: boolean | null = userParticipating && winnerTeam > 0 
      ? userTeam === winnerTeam 
      : null;

    // NEW: Show confirmation section if match is completed and has scores
    const showConfirmationSection = hasScores && statusInt === MatchStatus.COMPLETED && userParticipating;

    const finalState: MatchState = {
      isFuture,
      isPast,
      needsScores,
      hasScores,
      canJoin,
      userParticipating,
      userTeam,
      team1Sets,
      team2Sets,
      winnerTeam,
      userWon,
      canCancel,
      hoursFromCompletion,
      isCreator,
      canEnterScores,
      canViewScores,
      matchPhase,
      timeStatus,
      showConfirmationSection,
    };

    console.log('✅ Enhanced Match Details: Comprehensive final state:', finalState);
    return finalState;
  }, [match, session?.user?.id]);

  const {
    reports = [],
    canReport = { can_report: false, reason: 'Loading...' },
    reportingInfo = {
      totalReports: 0,
      hasReports: false,
      isDisputed: false,
      userCanReport: false,
      userHasReported: false,
      validationWindow: null,
      isValidationOpen: false,
      disputeThreshold: 2,
      reportsNeededForDispute: 2,
      validationStatus: 'pending' as any
    },
    reportMatch,
    isSubmitting = false,
    refresh: refreshReports
  } = useMatchReporting(matchId as string) || {};

  const shouldShowReportButton = useMemo(() => {
    console.log('🔍 [REPORT BUTTON] Evaluation starting...', {
      timestamp: new Date().toISOString()
    });

    // VALIDATION GATE 1: Essential data presence
    if (!match || !session?.user?.id) {
      console.log('❌ [REPORT BUTTON] Missing essential data', {
        hasMatch: !!match,
        hasUserId: !!session?.user?.id
      });
      return false;
    }

    // VALIDATION GATE 2: Match must have recorded scores
    if (!matchState.hasScores) {
      console.log('❌ [REPORT BUTTON] No scores recorded', {
        hasScores: matchState.hasScores,
        team1Set1: match.team1_score_set1,
        team2Set1: match.team2_score_set1
      });
      return false;
    }

    // VALIDATION GATE 3: User must be match participant
    if (!matchState.userParticipating) {
      console.log('❌ [REPORT BUTTON] User not participating', {
        userParticipating: matchState.userParticipating,
        userId: session.user.id,
        player1: match.player1_id,
        player2: match.player2_id,
        player3: match.player3_id,
        player4: match.player4_id
      });
      return false;
    }

    // VALIDATION GATE 4: Match must be completed (have completion timestamp)
    if (!match.completed_at) {
      console.log('❌ [REPORT BUTTON] Match not completed', {
        completedAt: match.completed_at,
        status: match.status
      });
      return false;
    }

    // VALIDATION GATE 5: Must be within 24-hour reporting window
    const completedTime = new Date(match.completed_at);
    const currentTime = new Date();
    const reportingWindowHours = 24;
    const reportingDeadline = new Date(completedTime.getTime() + (reportingWindowHours * 60 * 60 * 1000));
    const isWithinReportingWindow = currentTime < reportingDeadline;
    const hoursRemaining = Math.max(0, (reportingDeadline.getTime() - currentTime.getTime()) / (1000 * 60 * 60));

    if (!isWithinReportingWindow) {
      console.log('❌ [REPORT BUTTON] Outside reporting window', {
        completedAt: completedTime.toISOString(),
        currentTime: currentTime.toISOString(),
        reportingDeadline: reportingDeadline.toISOString(),
        hoursElapsed: Math.round((currentTime.getTime() - completedTime.getTime()) / (1000 * 60 * 60)),
        windowHours: reportingWindowHours
      });
      return false;
    }

    // VALIDATION GATE 6: User must not have already reported
    const userAlreadyReported = reports.some(report => report.reporter_id === session.user.id);
    
    if (userAlreadyReported) {
      console.log('❌ [REPORT BUTTON] User already reported', {
        userId: session.user.id,
        totalReports: reports.length,
        userReports: reports.filter(r => r.reporter_id === session.user.id).length
      });
      return false;
    }

    // VALIDATION GATE 7: Match must not be in disputed status
    if (reportingInfo.isDisputed) {
      console.log('❌ [REPORT BUTTON] Match already disputed', {
        isDisputed: reportingInfo.isDisputed,
        totalReports: reportingInfo.totalReports
      });
      return false;
    }

    // ALL VALIDATIONS PASSED
    console.log('✅ [REPORT BUTTON] All validations passed', {
      hoursRemaining: Math.round(hoursRemaining * 100) / 100,
      reportingDeadline: reportingDeadline.toISOString(),
      userCanReport: true
    });

    return true;
  }, [
    match,
    session?.user?.id,
    matchState.hasScores,
    matchState.userParticipating,
    reports,
    reportingInfo.isDisputed
  ]);

  // NEW: FAB Animation Control
  const toggleFAB = () => {
    const toValue = fabExpanded ? 0 : 1;
    setFabExpanded(!fabExpanded);
    
    Animated.spring(fabAnimValue, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8
    }).start();
    
    // Light haptic feedback
    Vibration.vibrate(50);
  };

  // ENHANCED: Real-time score validation
  const validateCurrentScores = useCallback((): ScoreEntryState => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!isSet1Valid) {
      errors.push("Set 1 scores are invalid");
    }
    
    if (!isSet2Valid) {
      errors.push("Set 2 scores are invalid");
    }
    
    if (showSet3 && !isSet3Valid) {
      errors.push("Set 3 scores are invalid");
    }
    
    // Advanced validation logic
    if (isSet1Valid && isSet2Valid) {
      const team1WonSet1 = set1Score.team1 > set1Score.team2;
      const team1WonSet2 = set2Score.team1 > set2Score.team2;
      
      if ((team1WonSet1 && team1WonSet2) || (!team1WonSet1 && !team1WonSet2)) {
        if (showSet3) {
          warnings.push("Match appears to be decided in 2 sets, but Set 3 is being entered");
        } else {
          warnings.push("Match was decided in 2 sets");
        }
      }
    }
    
    // Determine suggested winner
    let suggestedWinner: number | null = null;
    if (isSet1Valid && isSet2Valid) {
      let team1Sets = 0, team2Sets = 0;
      
      if (set1Score.team1 > set1Score.team2) team1Sets++;
      else team2Sets++;
      
      if (set2Score.team1 > set2Score.team2) team1Sets++;
      else team2Sets++;
      
      if (showSet3 && isSet3Valid) {
        if (set3Score.team1 > set3Score.team2) team1Sets++;
        else team2Sets++;
      }
      
      suggestedWinner = team1Sets > team2Sets ? 1 : team2Sets > team1Sets ? 2 : null;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestedWinner
    };
  }, [set1Score, set2Score, set3Score, isSet1Valid, isSet2Valid, isSet3Valid, showSet3]);

  // ENHANCED: Component lifecycle with better error handling
  useEffect(() => {
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  // ENHANCED: Real-time score validation
  useEffect(() => {
    if (editingScores) {
      setScoreValidation(validateCurrentScores());
    }
  }, [editingScores, validateCurrentScores]);

  // ENHANCED: Score state initialization with validation
  useEffect(() => {
    if (match && matchState.hasScores) {
      console.log('🔄 Enhanced Match Details: Initializing score state from match data');
      
      setSet1Score({
        team1: ensureInteger(match.team1_score_set1),
        team2: ensureInteger(match.team2_score_set1),
      });
      setSet2Score({
        team1: ensureInteger(match.team1_score_set2),
        team2: ensureInteger(match.team2_score_set2),
      });

      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setSet3Score({
          team1: ensureInteger(match.team1_score_set3),
          team2: ensureInteger(match.team2_score_set3),
        });
        setShowSet3(true);
      }

      setIsSet1Valid(true);
      setIsSet2Valid(true);
      if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) {
        setIsSet3Valid(true);
      }
    }
  }, [match, matchState.hasScores]);

  // ENHANCED: Set 3 visibility with smart logic
  useEffect(() => {
    if (!editingScores) return;

    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;
    const isTied = (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);

    setShowSet3(isTied && isSet1Valid && isSet2Valid);

    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
      setIsSet3Valid(false);
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid, editingScores]);

  // ENHANCED: Advanced data fetching with retry mechanism AND AVATAR SUPPORT
  const fetchMatchDetails = async (id: string, retryCount = 0) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }

      console.log('📡 Enhanced Match Details: Fetching match data for ID:', id);

      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:profiles!player1_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player2:profiles!player2_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player3:profiles!player3_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url),
          player4:profiles!player4_id(id, full_name, email, glicko_rating, glicko_rd, glicko_vol, avatar_url)
        `
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error('❌ Enhanced Match Details: Fetch error:', error);
        
        // Retry mechanism for network issues
        if (retryCount < 2 && (error.code === 'PGRST301' || error.message.includes('network'))) {
          console.log('🔄 Retrying fetch...', retryCount + 1);
          setTimeout(() => fetchMatchDetails(id, retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        
        throw error;
      }

      console.log('📊 Enhanced Match Details: Match data received:', {
        id: data.id,
        status: data.status,
        statusType: typeof data.status,
        hasScores: data.team1_score_set1 !== null,
        startTime: data.start_time,
        isPublic: data.is_public
      });

      setMatch(data);
    } catch (error) {
      console.error("💥 Enhanced Match Details: Error fetching match details:", error);
      
      if (retryCount === 0) {
        Alert.alert(
          "Error Loading Match",
          "Failed to load match details. Would you like to retry?",
          [
            { text: "Cancel", onPress: () => router.back() },
            { text: "Retry", onPress: () => fetchMatchDetails(id, 0) }
          ]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ENHANCED: Optimized refresh with visual feedback
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Vibration.vibrate(50); // Haptic feedback
    if (matchId) {
      fetchMatchDetails(matchId as string);
    }
  }, [matchId]);

  // NEW: EXPANDABLE FAB MENU WITH ANIMATION
  const renderExpandableFAB = () => {
    if (editingScores) return null;

    // Collect available action buttons
    const actionButtons = [];

    // Report button
    if (shouldShowReportButton) {
      actionButtons.push({
        key: 'report',
        icon: 'flag',
        color: '#dc2626',
        action: () => {
          setFabExpanded(false);
          fabAnimValue.setValue(0);
          setShowReportModal(true);
        },
        label: 'Report'
      });
    }

    // Edit button 
    if (matchState.isCreator && !isStatusEqual(match?.status, MatchStatus.CANCELLED)) {
      actionButtons.push({
        key: 'edit',
        icon: 'pencil',
        color: '#7c3aed',
        action: () => {
          setFabExpanded(false);
          fabAnimValue.setValue(0);
          
          const now = new Date();
          const startTime = new Date(match!.start_time);
          const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
          
          if (matchState.hoursFromCompletion > 24) {
            Alert.alert(
              "Cannot Edit",
              "This match is locked and cannot be edited after 24 hours.",
              [{ text: "OK" }]
            );
            return;
          }
          
          router.push({
            pathname: '/(protected)/(screens)/edit-match',
            params: { matchId: match!.id }
          });
        },
        label: 'Edit'
      });
    }

    // Score Entry button
    if (matchState.canEnterScores) {
      actionButtons.push({
        key: 'score',
        icon: 'create',
        color: '#059669',
        action: () => {
          setFabExpanded(false);
          fabAnimValue.setValue(0);
          setEditingScores(true);
        },
        label: 'Score'
      });
    }

    // Delete button
    if (matchState.canCancel) {
      actionButtons.push({
        key: 'delete',
        icon: 'trash',
        color: '#b91c1c',
        action: () => {
          setFabExpanded(false);
          fabAnimValue.setValue(0);
          cancelMatch();
        },
        label: 'Delete'
      });
    }

    return (
      <View className="absolute bottom-6 right-6">
        {/* Secondary Action Buttons */}
        {actionButtons.map((button, index) => {
          const translateY = fabAnimValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(60 * (index + 1))]
          });

          const scale = fabAnimValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1]
          });

          const opacity = fabAnimValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0.5, 1]
          });

          return (
            <Animated.View
              key={button.key}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                transform: [{ translateY }, { scale }],
                opacity,
              }}
            >
              <TouchableOpacity
                onPress={button.action}
                className="w-12 h-12 rounded-full items-center justify-center shadow-lg"
                style={{
                  backgroundColor: button.color,
                  shadowColor: button.color,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Ionicons name={button.icon as any} size={20} color="white" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Main FAB Button */}
        <Animated.View
          style={{
            transform: [{
              rotate: fabAnimValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '45deg']
              })
            }]
          }}
        >
          <TouchableOpacity
            onPress={toggleFAB}
            className="w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
            style={{
              shadowColor: "#2148ce",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Ionicons 
              name={fabExpanded ? "close" : "ellipsis-horizontal"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Share Button (Always Present) */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: -60,
            right: 14,
            transform: [{
              scale: fabAnimValue.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.9]
              })
            }],
            opacity: fabAnimValue.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.7]
            })
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setFabExpanded(false);
              fabAnimValue.setValue(0);
              shareMatch();
            }}
            className="w-12 h-12 rounded-full bg-blue-600 items-center justify-center shadow-lg"
            style={{
              shadowColor: "#2563eb",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Ionicons name="share-social" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // ENHANCED: Smart join functionality with team balancing
  const joinMatch = async () => {
    if (!match || !session?.user?.id) return;

    const availablePositions = [];
    if (!match.player2_id) availablePositions.push("player2_id");
    if (!match.player3_id) availablePositions.push("player3_id");
    if (!match.player4_id) availablePositions.push("player4_id");

    if (availablePositions.length === 0) {
      Alert.alert("Match Full", "This match is already full");
      return;
    }

    try {
      setSaving(true);

      // Smart team assignment based on skill levels
      let targetPosition = availablePositions[0];
      
      if (availablePositions.length > 1) {
        const userRating = profile?.glicko_rating ? parseFloat(profile.glicko_rating) : 1500;
        
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
        const team1Balance = Math.abs((team1Avg + userRating) / (team1Players.length + 1) - team2Avg);
        const team2Balance = Math.abs((team2Avg + userRating) / (team2Players.length + 1) - team1Avg);
        
        if (team1Balance < team2Balance && availablePositions.includes("player2_id")) {
          targetPosition = "player2_id";
        } else if (availablePositions.includes("player3_id")) {
          targetPosition = "player3_id";
        }
      }

      console.log('🎯 Enhanced Match Details: Joining match at position:', targetPosition);

      const { data, error } = await supabase
        .from("matches")
        .update({ [targetPosition]: session.user.id })
        .eq("id", match.id)
        .select();

      if (error) throw error;

      fetchMatchDetails(match.id);
      Vibration.vibrate([100, 50, 100]); // Success haptic pattern

      Alert.alert(
        "Successfully Joined!",
        "You have joined the match. Good luck!",
        [
          {
            text: "View Details",
            onPress: () => {
              // Auto-scroll to teams section
              Animated.timing(animatedValue, {
                toValue: 1,
                duration: 500,
                useNativeDriver: false,
              }).start();
            }
          },
          { text: "OK" }
        ]
      );

      if (!error && match.created_at && profile?.full_name) {
        // Send notification to match creator
        await NotificationHelpers.sendPublicMatchJoinedNotification(
          match.player1_id,
          profile.full_name,
          match.id
        );
      }
      
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error joining match:", error);
      Vibration.vibrate(200); // Error haptic
      Alert.alert("Error", "Failed to join the match. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // FIXED: Enhanced score saving with proper integer handling
  const saveMatchScores = async () => {
    if (!match || !session?.user?.id) return;

    if (!matchState.isCreator) {
      Alert.alert("Permission Denied", "Only the match creator can enter scores.");
      return;
    }

    const validation = validateCurrentScores();
    if (!validation.isValid) {
      Alert.alert(
        "Invalid Scores", 
        `Please fix the following issues:\n${validation.errors.join('\n')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      Alert.alert(
        "Score Validation Warning",
        `${validation.warnings.join('\n')}\n\nDo you want to continue?`,
        [
          { text: "Review", style: "cancel" },
          { text: "Continue", onPress: () => performScoreSave() }
        ]
      );
      return;
    }

    await performScoreSave();
  };

  // CRITICAL FIX: Score saving with explicit INTEGER type enforcement for PostgreSQL constraints
  const performScoreSave = async () => {
    if (!match) return;

    try {
      setSaving(true);

      const winnerTeam = scoreValidation.suggestedWinner || 0;
      
      console.log('💾 Enhanced Match Details: Saving scores with winner:', winnerTeam);

      // STEP 1: Calculate validation deadline with timezone awareness
      const now = new Date();
      const validationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // STEP 2: Construct update payload with comprehensive validation data
      const updateData = {
        // SCORE DATA: Explicit INTEGER casting for PostgreSQL constraints
        team1_score_set1: Number(ensureInteger(set1Score.team1)),
        team2_score_set1: Number(ensureInteger(set1Score.team2)),
        team1_score_set2: Number(ensureInteger(set2Score.team1)),
        team2_score_set2: Number(ensureInteger(set2Score.team2)),
        team1_score_set3: showSet3 ? Number(ensureInteger(set3Score.team1)) : null,
        team2_score_set3: showSet3 ? Number(ensureInteger(set3Score.team2)) : null,
        winner_team: Number(ensureInteger(winnerTeam)),
        
        // STATUS DATA: String format for TEXT database field
        status: "4", // COMPLETED status as string
        completed_at: new Date().toISOString(),
        
        // VALIDATION DATA: Critical for reporting system
        validation_deadline: validationDeadline.toISOString(),
        validation_status: 'pending',
        rating_applied: false, // CRITICAL: Defer rating application
        report_count: 0, // Reset report count for fresh validation
        
        // CONFIRMATION DATA: Initialize confirmation tracking
        confirmation_status: 'pending',
        all_confirmed: false,
        creator_confirmed: true // Creator auto-confirms
      };

      console.log('🔧 Enhanced Match Details: Update payload with confirmation:', updateData);

      // STEP 3: Execute database update with error handling
      const { data, error } = await supabase
        .from("matches")
        .update(updateData)
        .eq("id", match.id)
        .select();

      if (error) {
        console.error('❌ Enhanced Match Details: Database update error:', error);
        throw error;
      }

      // STEP 4: Calculate and store ratings (deferred application)
      await EnhancedRatingService.calculateAndStoreRatings(match.id);

      // STEP 5: Refresh match data including validation status
      fetchMatchDetails(match.id);
      setEditingScores(false);
      
      // STEP 6: Success feedback with validation information
      Vibration.vibrate([100, 50, 100, 50, 100]); // Enhanced success pattern

      Alert.alert(
        "Match Completed!",
        `Scores saved successfully.\n\n` +
        `✅ You have automatically confirmed the scores.\n` +
        `⏱️ Other players have 24 hours to confirm or reject.\n` +
        `📊 If all confirm, ratings apply immediately.\n` +
        `⚠️ If 2+ players reject, the match will be cancelled.\n\n` +
        `${winnerTeam === matchState.userTeam ? 'Congratulations on your victory!' : 'Better luck next time!'}`,
        [{ text: "OK" }]
      );

      if (!error && profile?.full_name) {
        // Get all player IDs
        const playerIds = [
          match.player1_id,
          match.player2_id,
          match.player3_id,
          match.player4_id
        ].filter(Boolean);
        
        // Send score confirmed notification
        await NotificationHelpers.sendMatchScoreConfirmedNotification(
          playerIds,
          session.user.id,
          profile.full_name,
          match.id
        );
      }
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error saving match scores:", error);
      Vibration.vibrate(300); // Error haptic
      Alert.alert(
        "Error Saving Scores",
        `Failed to save match scores: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  // ENHANCED: Advanced match cancellation with confirmation
  const cancelMatch = async () => {
    if (!match || !session?.user?.id || !matchState.canCancel) return;

    if (!matchState.isCreator) {
      Alert.alert("Permission Denied", "Only the match creator can delete matches.");
      return;
    }

    const timeInfo = getCancellationTimeInfo();
    
    Alert.alert(
      "Delete Match",
      `Are you sure you want to permanently delete this match?\n\n${timeInfo}\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              Vibration.vibrate(100);

              const { error } = await supabase
                .from("matches")
                .delete()
                .eq("id", match.id);
                
              if (error) throw error;
              
              Vibration.vibrate([100, 50, 100]);
              
              Alert.alert(
                "Match Deleted", 
                "The match has been permanently removed.",
                [
                  { 
                    text: "OK", 
                    onPress: () => router.replace("/(protected)/(tabs)")
                  }
                ]
              );

              if (!error && profile?.full_name) {
                const playerIds = [
                  match.player1_id,
                  match.player2_id,
                  match.player3_id,
                  match.player4_id
                ].filter(Boolean);
                
                // Send match cancelled notification
                await NotificationHelpers.sendMatchCancelledNotification(
                  playerIds,
                  session.user.id,
                  profile.full_name,
                  match.id
                );
              }

            } catch (error) {
              console.error("❌ Enhanced Match Details: Error deleting match:", error);
              Vibration.vibrate(300);
              Alert.alert("Error", "Failed to delete match");
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // ENHANCED: Advanced sharing with multiple formats AND VISIBILITY CONTEXT
  const shareMatch = async () => {
    if (!match) return;

    try {
      const playerNames = [
        match.player1?.full_name || "Player 1",
        match.player2?.full_name || "Player 2", 
        match.player3?.full_name || "Player 3",
        match.player4?.full_name || "Player 4"
      ];

      // ENHANCEMENT: Include visibility context in shared message
      const visibilityText = match.is_public ? '🌍 Public Match' : '🔒 Private Match';
      
      let message = '';
      
      if (matchState.isFuture) {
        message = `🎾 Padel Match Invitation\n${visibilityText}\n\n` +
                 `📅 ${formatDate(match.start_time)} at ${formatTime(match.start_time)}\n` +
                 `📍 ${match.region || 'TBD'}${match.court ? `, Court ${match.court}` : ''}\n\n` +
                 `Team 1: ${playerNames[0]} & ${playerNames[1]}\n` +
                 `Team 2: ${playerNames[2]} & ${playerNames[3]}\n\n`;
        
        // ENHANCEMENT: Add visibility-specific context
        if (match.is_public) {
          message += `This is a public match - anyone can discover and join! 🌟\n\n`;
        }
        
        message += `Join us for some padel! 🏆`;
      } else {
        message = `🏆 Padel Match Result\n${visibilityText}\n\n` +
                 `📊 Final Score: ${matchState.team1Sets}-${matchState.team2Sets}\n` +
                 `🏅 Winner: Team ${matchState.winnerTeam}\n\n` +
                 `Team 1: ${playerNames[0]} & ${playerNames[1]}\n` +
                 `Team 2: ${playerNames[2]} & ${playerNames[3]}\n\n`;
        
        if (match.team1_score_set1 !== null) {
          message += `Set Details:\n`;
          message += `Set 1: ${match.team1_score_set1}-${match.team2_score_set1}\n`;
          if (match.team1_score_set2 !== null) {
            message += `Set 2: ${match.team1_score_set2}-${match.team2_score_set2}\n`;
          }
          if (match.team1_score_set3 !== null) {
            message += `Set 3: ${match.team1_score_set3}-${match.team2_score_set3}\n`;
          }
        }
      }

      await Share.share({
        message,
        title: matchState.isFuture ? "Padel Match Invitation" : "Padel Match Result",
      });
    } catch (error) {
      console.error("❌ Enhanced Match Details: Error sharing match:", error);
    }
  };

  // ENHANCED: Utility functions with better formatting
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMMM d, yyyy");
  };

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "h:mm a");
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays === -1) return "Tomorrow";
    if (diffDays < 7 && diffDays > 0) return `${diffDays} days ago`;
    if (diffDays > -7 && diffDays < 0) return `In ${Math.abs(diffDays)} days`;
    
    return formatDate(dateString);
  };

  // CRITICAL FIX: Enhanced status determination with proper TEXT field handling
  const getStatusText = () => {
    if (matchState.isFuture) {
      return { text: "Upcoming", color: "text-blue-500" };
    }

    if (matchState.needsScores) {
      return { text: "Needs Scores", color: "text-amber-500" };
    }

    // CRITICAL FIX: Use safe status comparison for TEXT database field
    if (isStatusEqual(match?.status, MatchStatus.PENDING)) {
      return { text: "Pending", color: "text-blue-500" };
    }
    if (isStatusEqual(match?.status, MatchStatus.NEEDS_CONFIRMATION)) {
      return { text: "Needs Confirmation", color: "text-yellow-500" };
    }
    if (isStatusEqual(match?.status, MatchStatus.CANCELLED)) {
      return { text: "Cancelled", color: "text-gray-500" };
    }
    if (isStatusEqual(match?.status, MatchStatus.COMPLETED)) {
      return { text: "Completed", color: "text-green-500" };
    }
    
    return { text: "Unknown", color: "text-muted-foreground" };
  };

  const getCancellationTimeInfo = (): string => {
    if (!matchState.canCancel) return '';
    
    if (matchState.isFuture) {
      return 'Can delete until match starts';
    } else {
      const hoursRemaining = 24 - matchState.hoursFromCompletion;
      if (hoursRemaining > 1) {
        return `Can delete for ${Math.floor(hoursRemaining)} more hours`;
      } else {
        const minutesRemaining = Math.floor(hoursRemaining * 60);
        return `Can delete for ${minutesRemaining} more minutes`;
      }
    }
  };

  const getMatchDuration = (startTimeStr: string, endTimeStr: string): string => {
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));

    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  const calculateSetsPlayed = () => {
    if (!match) return 'N/A';
    let setsPlayed = 0;
    if (match.team1_score_set1 !== null && match.team2_score_set1 !== null) setsPlayed++;
    if (match.team1_score_set2 !== null && match.team2_score_set2 !== null) setsPlayed++;
    if (match.team1_score_set3 !== null && match.team2_score_set3 !== null) setsPlayed++;
    return setsPlayed || 'N/A';
  };

  // CRITICAL FIX: Match status display with proper TEXT field handling
  const getMatchStatus = (status: string | number) => {
    const statusNum = statusFromString(status);
    switch (statusNum) {
      case MatchStatus.PENDING: return 'Pending';
      case MatchStatus.NEEDS_CONFIRMATION: return 'Needs Confirmation';
      case MatchStatus.CANCELLED: return 'Cancelled';
      case MatchStatus.COMPLETED: return 'Completed';
      case MatchStatus.NEEDS_SCORES: return 'Needs Scores';
      case MatchStatus.RECRUITING: return 'Recruiting';
      default: return 'Unknown';
    }
  };

  // ENHANCEMENT: Visibility Badge Component for Match Visibility Indicator
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

  // ENHANCED: Set score rendering with better visual hierarchy
  const renderSetScore = (setNumber: number, team1Score: number | null, team2Score: number | null) => {
    if (team1Score === null || team2Score === null) return null;

    const team1Won = team1Score > team2Score;
    const team2Won = team2Score > team1Score;

    return (
      <View className="flex-row items-center justify-between mb-2 p-2 rounded-lg bg-muted/20">
        <Text className="text-muted-foreground w-12 font-medium text-sm">Set {setNumber}</Text>
        <View className="flex-row items-center flex-1 justify-center">
          <Text
            className={`text-lg font-bold ${
              team1Won ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {team1Score}
          </Text>
          <Text className="text-lg mx-3 text-muted-foreground">-</Text>
          <Text
            className={`text-lg font-bold ${
              team2Won ? "text-indigo-600" : "text-muted-foreground"
            }`}
          >
            {team2Score}
          </Text>
        </View>
        {(team1Won || team2Won) && (
          <View className="w-12 items-end">
            <View className={`px-1.5 py-0.5 rounded-full ${
              team1Won ? 'bg-primary/20' : 'bg-indigo-100 dark:bg-indigo-900/30'
            }`}>
              <Text className={`text-xs font-bold ${
                team1Won ? 'text-primary' : 'text-indigo-600'
              }`}>
                {team1Won ? "T1" : "T2"}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ENHANCED: Score editing section with real-time validation
  const renderScoreEditSection = () => {
    if (!matchState.isCreator) {
      return (
        <View className="bg-card rounded-xl p-6 mb-6 border border-amber-200 dark:border-amber-800">
          <View className="flex-row items-center mb-4">
            <Ionicons name="lock-closed-outline" size={24} color="#d97706" style={{ marginRight: 8 }} />
            <H3>Score Entry Restricted</H3>
          </View>
          <Text className="text-muted-foreground mb-4">
            Only the match creator ({match?.player1?.full_name || match?.player1?.email}) can enter scores for this match.
          </Text>
          <Button
            variant="outline"
            onPress={() => setEditingScores(false)}
            className="w-full"
          >
            <Text>Close</Text>
          </Button>
        </View>
      );
    }

    return (
      <View className="bg-card rounded-xl p-6 mb-6 border border-border/30">
        <View className="flex-row justify-between items-center mb-4">
          <H3>Edit Match Score</H3>
          <TouchableOpacity
            onPress={() => setEditingScores(false)}
            className="p-2"
          >
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Real-time validation display */}
        {scoreValidation.errors.length > 0 && (
          <View className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg mb-4">
            <Text className="text-red-800 dark:text-red-300 font-medium mb-1">Validation Errors:</Text>
            {scoreValidation.errors.map((error, index) => (
              <Text key={index} className="text-red-700 dark:text-red-400 text-sm">• {error}</Text>
            ))}
          </View>
        )}

        {scoreValidation.warnings.length > 0 && (
          <View className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg mb-4">
            <Text className="text-amber-800 dark:text-amber-300 font-medium mb-1">Warnings:</Text>
            {scoreValidation.warnings.map((warning, index) => (
              <Text key={index} className="text-amber-700 dark:text-amber-400 text-sm">• {warning}</Text>
            ))}
          </View>
        )}

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

        {scoreValidation.isValid && scoreValidation.suggestedWinner && (
          <View className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <View className="flex-row items-center justify-center">
              <Ionicons name="trophy-outline" size={20} color="#2148ce" style={{ marginRight: 8 }} />
              <Text className="text-lg font-semibold text-primary">
                Winner: Team {scoreValidation.suggestedWinner}
              </Text>
            </View>
            {matchState.userTeam === scoreValidation.suggestedWinner && (
              <Text className="text-center text-green-600 dark:text-green-400 mt-1 font-medium">
                🎉 Congratulations! Your team won!
              </Text>
            )}
          </View>
        )}

        <Button
          className="w-full mt-6"
          variant="default"
          onPress={saveMatchScores}
          disabled={saving || !scoreValidation.isValid}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-primary-foreground font-medium">
              Save Scores {scoreValidation.suggestedWinner && `(Team ${scoreValidation.suggestedWinner} Wins)`}
            </Text>
          )}
        </Button>
      </View>
    );
  };

  // NEW: UNIFIED AND CONDENSED MATCH OVERVIEW COMPONENT
  const renderCondensedMatchOverview = () => {
    const userId = session?.user?.id;
    const isUserPlayer = (playerId: string | undefined) => playerId === userId;

    return (
      <View className="bg-card rounded-xl p-4 mb-4 border border-border/30">
        <View className="flex-row items-center justify-between mb-4">
          <H3>Match Overview</H3>
          <View className="flex-row gap-2">
            {renderVisibilityBadge(match!.is_public)}
            {matchState.isCreator && (
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-xs text-primary font-medium">Creator</Text>
              </View>
            )}
          </View>
        </View>

        {/* CONDENSED Score Display */}
        {matchState.hasScores && (
          <View className="items-center mb-4">
            <View className="flex-row items-center justify-center mb-2">
              <Text className="text-3xl font-bold text-primary">
                {matchState.team1Sets}
              </Text>
              <Text className="text-xl mx-3 text-muted-foreground">-</Text>
              <Text className="text-3xl font-bold text-indigo-600">
                {matchState.team2Sets}
              </Text>
            </View>
            
            {matchState.userParticipating && (
              <View className={`px-3 py-1 rounded-full ${
                matchState.userWon === true
                  ? "bg-green-100 dark:bg-green-900/30"
                  : matchState.userWon === false
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-yellow-100 dark:bg-yellow-900/30"
              }`}>
                <Text
                  className={`font-bold text-sm ${
                    matchState.userWon === true
                      ? "text-green-800 dark:text-green-300"
                      : matchState.userWon === false
                        ? "text-red-800 dark:text-red-300"
                        : "text-yellow-800 dark:text-yellow-300"
                  }`}
                >
                  {matchState.userWon === true ? "🏆 Victory!" : 
                   matchState.userWon === false ? "😔 Defeat" : "🤝 Draw"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* CONDENSED Court Visualization WITH INLINE DETAILS */}
        <View className="aspect-[4/3] w-full bg-gradient-to-b from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 rounded-lg border-2 border-green-400 dark:border-green-700 overflow-hidden">
          {/* Team 1 Side - CONDENSED */}
          <View className="h-[45%] border-b border-dashed border-white dark:border-gray-400 relative">
            <View className="absolute top-1 left-1 right-1 flex-row justify-between items-center">
              <View className="bg-primary/90 px-2 py-0.5 rounded-full">
                <Text className="text-xs font-bold text-white">Team 1</Text>
              </View>
              {matchState.winnerTeam === 1 && (
                <View className="bg-yellow-500 px-2 py-0.5 rounded-full flex-row items-center">
                  <Ionicons name="trophy" size={10} color="white" />
                  <Text className="text-xs font-bold text-white ml-1">WIN</Text>
                </View>
              )}
            </View>

            <View className="flex-1 flex-row px-2 pb-1">
              {/* Player 1 - CONDENSED WITH INLINE RATING */}
              <View className="flex-1 items-center justify-center">
                <PlayerAvatar
                  player={match!.player1}
                  size="md"
                  isCurrentUser={isUserPlayer(match!.player1?.id)}
                  isCreator={matchState.isCreator}
                  teamColor="primary"
                  showBorder={true}
                />
                <View className="bg-white dark:bg-gray-800 rounded p-1 mt-1 min-w-[80px] items-center">
                  <Text className="text-xs font-medium text-center" numberOfLines={1}>
                    {match!.player1?.full_name?.split(' ')[0] ||
                      match!.player1?.email?.split("@")[0] ||
                      "Player 1"}
                  </Text>
                  {/* INLINE RATING */}
                  {match!.player1?.glicko_rating && (
                    <Text className="text-xs text-primary font-bold">
                      {Math.round(parseFloat(match!.player1.glicko_rating))}
                    </Text>
                  )}
                  {isUserPlayer(match!.player1?.id) && (
                    <Text className="text-xs text-yellow-600 font-bold">You</Text>
                  )}
                </View>
              </View>

              {/* Player 2 - CONDENSED WITH INLINE RATING */}
              <View className="flex-1 items-center justify-center">
                <PlayerAvatar
                  player={match!.player2}
                  size="md"
                  isCurrentUser={isUserPlayer(match!.player2?.id)}
                  teamColor="primary"
                  showBorder={true}
                />
                <View className="bg-white dark:bg-gray-800 rounded p-1 mt-1 min-w-[80px] items-center">
                  <Text className="text-xs font-medium text-center" numberOfLines={1}>
                    {match!.player2?.full_name?.split(' ')[0] ||
                      match!.player2?.email?.split("@")[0] ||
                      "Open"}
                  </Text>
                  {/* INLINE RATING */}
                  {match!.player2?.glicko_rating && (
                    <Text className="text-xs text-primary font-bold">
                      {Math.round(parseFloat(match!.player2.glicko_rating))}
                    </Text>
                  )}
                  {isUserPlayer(match!.player2?.id) && (
                    <Text className="text-xs text-yellow-600 font-bold">You</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* CONDENSED Court Net */}
          <View className="h-[10%] bg-gray-300 dark:bg-gray-600 flex-row items-center justify-center">
            <View className="h-[1px] w-full bg-gray-500 dark:bg-gray-400"></View>
            <View className="absolute w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full"></View>
          </View>

          {/* Team 2 Side - CONDENSED */}
          <View className="h-[45%] relative">
            <View className="flex-1 flex-row px-2 pt-1">
              {/* Player 3 - CONDENSED WITH INLINE RATING */}
              <View className="flex-1 items-center justify-center">
                <View className="bg-white dark:bg-gray-800 rounded p-1 mb-1 min-w-[80px] items-center">
                  <Text className="text-xs font-medium text-center" numberOfLines={1}>
                    {match!.player3?.full_name?.split(' ')[0] ||
                      match!.player3?.email?.split("@")[0] ||
                      "Open"}
                  </Text>
                  {/* INLINE RATING */}
                  {match!.player3?.glicko_rating && (
                    <Text className="text-xs text-indigo-600 font-bold">
                      {Math.round(parseFloat(match!.player3.glicko_rating))}
                    </Text>
                  )}
                  {isUserPlayer(match!.player3?.id) && (
                    <Text className="text-xs text-yellow-600 font-bold">You</Text>
                  )}
                </View>
                <PlayerAvatar
                  player={match!.player3}
                  size="md"
                  isCurrentUser={isUserPlayer(match!.player3?.id)}
                  teamColor="secondary"
                  showBorder={true}
                />
              </View>

              {/* Player 4 - CONDENSED WITH INLINE RATING */}
              <View className="flex-1 items-center justify-center">
                <View className="bg-white dark:bg-gray-800 rounded p-1 mb-1 min-w-[80px] items-center">
                  <Text className="text-xs font-medium text-center" numberOfLines={1}>
                    {match!.player4?.full_name?.split(' ')[0] ||
                      match!.player4?.email?.split("@")[0] ||
                      "Open"}
                  </Text>
                  {/* INLINE RATING */}
                  {match!.player4?.glicko_rating && (
                    <Text className="text-xs text-indigo-600 font-bold">
                      {Math.round(parseFloat(match!.player4.glicko_rating))}
                    </Text>
                  )}
                  {isUserPlayer(match!.player4?.id) && (
                    <Text className="text-xs text-yellow-600 font-bold">You</Text>
                  )}
                </View>
                <PlayerAvatar
                  player={match!.player4}
                  size="md"
                  isCurrentUser={isUserPlayer(match!.player4?.id)}
                  teamColor="secondary"
                  showBorder={true}
                />
              </View>
            </View>

            <View className="absolute bottom-1 left-1 right-1 flex-row justify-between items-center">
              <View className="bg-indigo-500/90 px-2 py-0.5 rounded-full">
                <Text className="text-xs font-bold text-white">Team 2</Text>
              </View>
              {matchState.winnerTeam === 2 && (
                <View className="bg-yellow-500 px-2 py-0.5 rounded-full flex-row items-center">
                  <Ionicons name="trophy" size={10} color="white" />
                  <Text className="text-xs font-bold text-white ml-1">WIN</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* CONDENSED Join Match Button */}
        {matchState.canJoin && (
          <View className="mt-3">
            <Button
              onPress={joinMatch}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium">
                  Join Match ({[match!.player1_id, match!.player2_id, match!.player3_id, match!.player4_id].filter(Boolean).length}/4)
                </Text>
              )}
            </Button>
          </View>
        )}
      </View>
    );
  };

  // MODIFIED: COLLAPSIBLE PERFORMANCE & INFO COMPONENT - PERFORMANCE STARTS COLLAPSED
  const renderCollapsiblePerformanceInfo = () => {
    const isDark = colorScheme === 'dark';

    return (
      <View className="bg-card rounded-xl border border-border/30 mb-4">
        {/* Performance Section - MODIFIED: Starts collapsed */}
        {matchState.userParticipating && matchState.hasScores && (
          <View>
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-border/30"
              onPress={() => setPerformanceExpanded(!performanceExpanded)}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                  <Ionicons name="person-outline" size={20} color="#2148ce" />
                </View>
                <View>
                  <Text className="font-medium">Your Performance</Text>
                  <Text className="text-xs text-muted-foreground">
                    {matchState.userWon === true ? 'Victory!' : matchState.userWon === false ? 'Defeat' : 'Draw'}
                  </Text>
                </View>
              </View>
              <Ionicons 
                name={performanceExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#888" 
              />
            </TouchableOpacity>

            {performanceExpanded && (
              <View className="p-4">
                {/* RELOCATED: Set Breakdown */}
                {matchState.hasScores && (
                  <View className="mb-4">
                    <Text className="font-medium mb-3">Set Breakdown</Text>
                    {renderSetScore(1, match!.team1_score_set1, match!.team2_score_set1)}
                    {renderSetScore(2, match!.team1_score_set2, match!.team2_score_set2)}
                    {match!.team1_score_set3 !== null &&
                      match!.team2_score_set3 !== null &&
                      renderSetScore(3, match!.team1_score_set3, match!.team2_score_set3)}
                  </View>
                )}

                <View className="flex-row justify-around mb-4">
                  <View className="items-center">
                    <View className={`w-14 h-14 rounded-full items-center justify-center mb-3 ${
                      matchState.userWon === true ? 'bg-green-100 dark:bg-green-900/30' : 
                      matchState.userWon === false ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
                    }`}>
                      <Ionicons 
                        name={matchState.userWon === true ? "trophy" : matchState.userWon === false ? "sad" : "remove"} 
                        size={28} 
                        color={matchState.userWon === true ? "#059669" : matchState.userWon === false ? "#dc2626" : "#d97706"} 
                      />
                    </View>
                    <Text className="text-sm font-medium">Result</Text>
                    <Text className={`text-xs ${
                      matchState.userWon === true ? 'text-green-600 dark:text-green-400' : 
                      matchState.userWon === false ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {matchState.userWon === true ? 'Victory' : matchState.userWon === false ? 'Defeat' : 'Draw'}
                    </Text>
                  </View>
                  
                  <View className="items-center">
                    <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-3">
                      <Text className="text-xl font-bold text-primary">
                        {matchState.userTeam === 1 ? matchState.team1Sets : matchState.team2Sets}
                      </Text>
                    </View>
                    <Text className="text-sm font-medium">Sets Won</Text>
                    <Text className="text-xs text-muted-foreground">Your Team</Text>
                  </View>
                  
                  <View className="items-center">
                    <View className="w-14 h-14 rounded-full bg-muted/30 items-center justify-center mb-3">
                      <Text className="text-xl font-bold">
                        {matchState.userTeam === 1 ? matchState.team2Sets : matchState.team1Sets}
                      </Text>
                    </View>
                    <Text className="text-sm font-medium">Sets Lost</Text>
                    <Text className="text-xs text-muted-foreground">Opponents</Text>
                  </View>
                </View>

                {/* Performance Insights */}
                <View className="pt-4 border-t border-border/30">
                  <Text className="text-sm font-medium mb-3">Match Insights</Text>
                  <View className="space-y-2">
                    <View className="flex-row items-center">
                      <Ionicons 
                        name={matchState.userWon ? "trending-up" : "trending-down"} 
                        size={16} 
                        color={matchState.userWon ? "#059669" : "#dc2626"} 
                        style={{ marginRight: 8 }}
                      />
                      <Text className="text-sm text-muted-foreground flex-1">
                        {matchState.userWon 
                          ? `Great job! You dominated this match with a ${Math.abs(matchState.team1Sets - matchState.team2Sets)}-set margin.`
                          : `Keep practicing! The margin was ${Math.abs(matchState.team1Sets - matchState.team2Sets)} set${Math.abs(matchState.team1Sets - matchState.team2Sets) !== 1 ? 's' : ''}.`
                        }
                      </Text>
                    </View>
                    
                    {match!.start_time && match!.end_time && (
                      <View className="flex-row items-center">
                        <Ionicons name="time" size={16} color="#888" style={{ marginRight: 8 }} />
                        <Text className="text-sm text-muted-foreground">
                          Match duration: {getMatchDuration(match!.start_time, match!.end_time)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Match Information Section */}
        <View>
          <TouchableOpacity
            className="flex-row items-center justify-between p-4"
            onPress={() => setInfoExpanded(!infoExpanded)}
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons name="information-circle" size={20} color="#2148ce" />
              </View>
              <View>
                <Text className="font-medium">Match Information</Text>
                <Text className="text-xs text-muted-foreground">
                  {formatRelativeTime(match!.start_time)} • {getMatchStatus(match!.status)}
                </Text>
              </View>
            </View>
            <Ionicons 
              name={infoExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#888" 
            />
          </TouchableOpacity>

          {infoExpanded && (
            <View className="px-4 pb-4">
              {/* Enhanced Timeline */}
              <View className="ml-4 mb-6">
                <View className="flex-row mb-4">
                  <View className="mr-4 items-center">
                    <View className="w-4 h-4 rounded-full bg-blue-500 shadow-sm" />
                    <View className="w-0.5 h-full bg-border absolute mt-4" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="time-outline" size={16} color={isDark ? '#aaa' : '#666'} style={{marginRight: 8}} />
                      <Text className="font-medium">Match Details</Text>
                    </View>
                    <View className="bg-primary/5 dark:bg-primary/10 py-2 px-3 rounded-lg">
                      <Text className="text-primary font-medium">
                        Duration: {match!.start_time && match!.end_time
                          ? getMatchDuration(match!.start_time, match!.end_time)
                          : "Not specified"}
                      </Text>
                      <Text className="text-xs text-primary/70 mt-1">
                        Status: {getMatchStatus(match!.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {match!.completed_at && (
                  <View className="flex-row">
                    <View className="mr-4 items-center">
                      <View className="w-4 h-4 rounded-full bg-amber-500 shadow-sm" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center mb-1">
                        <Ionicons name="checkmark-done-outline" size={16} color={isDark ? '#aaa' : '#666'} style={{marginRight: 8}} />
                        <Text className="font-medium">Completed</Text>
                      </View>
                      <Text className="text-muted-foreground">
                        {formatRelativeTime(match!.completed_at)} at {formatTime(match!.completed_at)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Quick Stats */}
              {(matchState.hasScores || ensureInteger(match!.status) === 4) && (
                <View className="pt-4 border-t border-border/30">
                  <Text className="font-medium mb-4">Quick Stats</Text>
                  <View className="grid grid-cols-3 gap-4">
                    <View className="items-center p-3 bg-muted/20 rounded-lg">
                      <Ionicons name="tennisball-outline" size={20} color={isDark ? '#aaa' : '#666'} />
                      <Text className="text-lg font-bold mt-1">{calculateSetsPlayed()}</Text>
                      <Text className="text-xs text-muted-foreground text-center">Sets Played</Text>
                    </View>

                    <View className="items-center p-3 bg-muted/20 rounded-lg">
                      <Ionicons name="trophy-outline" size={20} color={isDark ? '#aaa' : '#666'} />
                      <Text className="text-lg font-bold mt-1 text-primary">
                        {matchState.winnerTeam ? `T${matchState.winnerTeam}` : "N/A"}
                      </Text>
                      <Text className="text-xs text-muted-foreground text-center">Winner</Text>
                    </View>
                    
                    <View className="items-center p-3 bg-muted/20 rounded-lg">
                      <Ionicons name="people-outline" size={20} color={isDark ? '#aaa' : '#666'} />
                      <Text className="text-lg font-bold mt-1">
                        {[match!.player1_id, match!.player2_id, match!.player3_id, match!.player4_id].filter(Boolean).length}
                      </Text>
                      <Text className="text-xs text-muted-foreground text-center">Players</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderValidationStatusBanner = () => {
    // GUARD CLAUSE 1: No banner for matches without scores
    if (!match || !matchState.hasScores) return null;

    // GUARD CLAUSE 2: No banner for matches without validation data
    if (!match.validation_deadline) return null;

    const validationInfo = reportingInfo.validationWindow;
    
    // CRITICAL: Determine banner configuration based on validation state
    const getBannerConfig = () => {
      // STATE 1: Match is disputed
      if (reportingInfo.isDisputed) {
        return {
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          borderColor: 'border-red-500',
          iconName: 'alert-circle' as const,
          iconColor: '#dc2626',
          title: 'Match Under Dispute',
          description: `This match has been reported by ${reportingInfo.totalReports} players and is under review.`,
          showTimer: false,
          showReportButton: false
        };
      }

      // STATE 2: Validation window is open
      if (validationInfo?.is_open) {
        return {
          bgColor: validationInfo.hours_remaining > 12 
            ? 'bg-green-100 dark:bg-green-900/30' 
            : validationInfo.hours_remaining > 6
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-red-100 dark:bg-red-900/30',
          borderColor: validationInfo.hours_remaining > 12 
            ? 'border-green-500' 
            : validationInfo.hours_remaining > 6
              ? 'border-amber-500'
              : 'border-red-500',
          iconName: 'time-outline' as const,
          iconColor: validationInfo.status_color,
          title: 'Score Validation Period',
          description: reportingInfo.userHasReported
            ? 'You have reported this match. Waiting for validation period to end.'
            : 'Report incorrect scores within the validation window.',
          showTimer: true,
          showReportButton: reportingInfo.userCanReport && !reportingInfo.userHasReported
        };
      }

      // STATE 3: Validation completed
      if (match.validation_status === 'validated') {
        return {
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          borderColor: 'border-green-500',
          iconName: 'checkmark-circle' as const,
          iconColor: '#059669',
          title: 'Scores Validated',
          description: 'Match scores have been validated and ratings applied.',
          showTimer: false,
          showReportButton: false
        };
      }

      // STATE 4: Validation expired without dispute
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-800/30',
        borderColor: 'border-gray-400',
        iconName: 'lock-closed' as const,
        iconColor: '#6b7280',
        title: 'Validation Period Ended',
        description: 'The reporting window has closed for this match.',
        showTimer: false,
        showReportButton: false
      };
    };

    const config = getBannerConfig();

    return (
      <Animated.View 
        style={{ 
          opacity: animatedValue,
          transform: [{
            translateY: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, 0]
            })
          }]
        }}
        className={`${config.bgColor} rounded-xl p-4 mb-4 border-l-4 ${config.borderColor}`}
      >
        <View className="flex-row items-start">
          {/* ICON SECTION: Visual indicator of state */}
          <View className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 items-center justify-center mr-3"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Ionicons
              name={config.iconName}
              size={24}
              color={config.iconColor}
            />
          </View>

          {/* CONTENT SECTION: Information and actions */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="font-bold text-base">
                {config.title}
              </Text>
              
              {/* TIMER DISPLAY: Real-time countdown */}
              {config.showTimer && validationInfo && (
                <View className="px-3 py-1 rounded-full" 
                  style={{ backgroundColor: `${validationInfo.status_color}20` }}
                >
                  <Text className="text-sm font-bold" 
                    style={{ color: validationInfo.status_color }}
                  >
                    {validationInfo.status_text}
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-sm text-muted-foreground mb-3">
              {config.description}
            </Text>

            {/* REPORT STATUS: Current reporting statistics */}
            {reportingInfo.hasReports && (
              <View className="bg-white/50 dark:bg-black/20 p-2 rounded-lg mb-3">
                <Text className="text-xs font-medium">
                  Current Reports: {reportingInfo.totalReports}/{reportingInfo.disputeThreshold}
                  {reportingInfo.userHasReported && (
                    <Text className="text-primary"> (Including yours)</Text>
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* DISPUTED MATCH DETAILS: Additional context for disputed matches */}
        {reportingInfo.isDisputed && reports.length > 0 && (
          <View className="mt-4 pt-4 border-t border-red-300 dark:border-red-800">
            <Text className="text-sm font-medium mb-2">Reported Issues:</Text>
            {reports.slice(0, 3).map((report, index) => (
              <View key={report.id} className="flex-row items-center mb-1">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                <Text className="text-xs text-muted-foreground">
                  {report.reason.replace(/_/g, ' ').toLowerCase()}
                  {report.additional_details && ' - '}
                  {report.additional_details?.slice(0, 50)}
                  {report.additional_details && report.additional_details.length > 50 && '...'}
                </Text>
              </View>
            ))}
            {reports.length > 3 && (
              <Text className="text-xs text-muted-foreground mt-1">
                And {reports.length - 3} more...
              </Text>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  const renderReportingModal = () => {
    // STEP 1: Basic visibility check
    if (!showReportModal) return null;
  
    // STEP 2: Only check if user is participating (most permissive)
    if (!matchState.userParticipating) {
      console.log('🔍 Modal hidden: User not participating');
      return null;
    }
  
    // STEP 3: Don't block modal if user already reported (allow viewing)
    const reportReasonOptions = [
      { 
        value: ReportReason.INCORRECT_SCORE, 
        label: 'Incorrect Score', 
        icon: 'calculator-outline',
        description: 'The recorded score does not match what actually happened'
      },
      { 
        value: ReportReason.WRONG_PLAYERS, 
        label: 'Wrong Players', 
        icon: 'people-outline',
        description: 'One or more players listed did not participate'
      },
      { 
        value: ReportReason.MATCH_NOT_PLAYED, 
        label: 'Match Not Played', 
        icon: 'close-circle-outline',
        description: 'This match never took place'
      },
      { 
        value: ReportReason.DUPLICATE_MATCH, 
        label: 'Duplicate Entry', 
        icon: 'copy-outline',
        description: 'This match has been recorded multiple times'
      },
      { 
        value: ReportReason.OTHER, 
        label: 'Other Issue', 
        icon: 'alert-circle-outline',
        description: 'Another problem not listed above'
      }
    ];
  
    const handleSubmitReport = async () => {
      if (!reportReason) {
        Alert.alert('Error', 'Please select a reason for your report');
        return;
      }
  
      if (reportReason === ReportReason.OTHER && !reportDetails.trim()) {
        Alert.alert('Error', 'Please provide details for your report');
        return;
      }
  
      Alert.alert(
        'Confirm Report',
        `Are you sure you want to report this match?\n\nReason: ${
          reportReasonOptions.find(r => r.value === reportReason)?.label
        }\n\nThis action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Report Match',
            style: 'destructive',
            onPress: async () => {
              try {
                Vibration.vibrate(50);
  
                const result = await reportMatch(reportReason, reportDetails);
  
                if (result.success) {
                  Vibration.vibrate([100, 50, 100]);
                  
                  Alert.alert(
                    'Report Submitted',
                    `Your report has been recorded.\n\n${
                      reportingInfo.reportsNeededForDispute === 1
                        ? 'One more report will trigger a review of this match.'
                        : `${reportingInfo.reportsNeededForDispute} more reports needed for review.`
                    }`,
                    [{ text: 'OK' }]
                  );
  
                  setShowReportModal(false);
                  setReportReason(ReportReason.INCORRECT_SCORE);
                  setReportDetails('');
                  
                  if (profile?.full_name) {
                    const playerIds = [
                      match!.player1_id,
                      match!.player2_id,
                      match!.player3_id,
                      match!.player4_id
                    ].filter(Boolean);
                    
                    // Send score disputed notification
                    await NotificationHelpers.sendMatchScoreDisputedNotification(
                      playerIds,
                      session!.user.id,
                      profile.full_name,
                      match!.id
                    );
                  }
                } else {
                  Vibration.vibrate(200);
                  
                  Alert.alert(
                    'Report Failed',
                    result.error || 'Failed to submit report. Please try again.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Retry', onPress: handleSubmitReport }
                    ]
                  );
                }
              } catch (error) {
                console.error('Critical error submitting report:', error);
                Vibration.vibrate(300);
                
                Alert.alert(
                  'System Error',
                  'An unexpected error occurred. Please try again later.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        ]
      );
    };
  
    return (
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 bg-black/50">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1}
            onPress={() => setShowReportModal(false)}
          />
          
          <View className="bg-background rounded-t-3xl p-6 pb-10" style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          }}>
            <View className="flex-row justify-between items-center mb-6">
              <H2>Report Match Issue</H2>
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
  
            {/* Show different content based on user's report status */}
            {reportingInfo.userHasReported ? (
              <View className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={20} color="#059669" style={{ marginRight: 8 }} />
                  <Text className="text-green-800 dark:text-green-300 font-medium">
                    You have already reported this match
                  </Text>
                </View>
                <Text className="text-green-700 dark:text-green-400 text-sm mt-2">
                  Your report has been recorded and is being reviewed.
                </Text>
              </View>
            ) : (
              <>
                <View className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg mb-6">
                  <View className="flex-row items-start">
                    <Ionicons 
                      name="information-circle" 
                      size={20} 
                      color="#d97706" 
                      style={{ marginTop: 2, marginRight: 8 }} 
                    />
                    <View className="flex-1">
                      <Text className="text-amber-800 dark:text-amber-300 font-medium mb-1">
                        Important Information
                      </Text>
                      <Text className="text-amber-700 dark:text-amber-400 text-sm leading-5">
                        • Reports are permanent and cannot be withdrawn{'\n'}
                        • {reportingInfo.disputeThreshold} reports will mark this match as disputed{'\n'}
                        • False reports may result in account penalties{'\n'}
                        • Only report genuine scoring errors or issues
                      </Text>
                    </View>
                  </View>
                </View>
  
                <Text className="font-medium mb-3">Select Reason</Text>
                <View className="mb-6">
                  {reportReasonOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      className={`p-4 rounded-lg mb-2 border ${
                        reportReason === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card'
                      }`}
                      onPress={() => setReportReason(option.value)}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-start">
                        <View className="w-6 h-6 rounded-full border-2 mr-3 mt-0.5 items-center justify-center"
                          style={{
                            borderColor: reportReason === option.value ? '#2148ce' : '#888'
                          }}
                        >
                          {reportReason === option.value && (
                            <View className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center mb-1">
                            <Ionicons 
                              name={option.icon as any} 
                              size={18} 
                              color={reportReason === option.value ? '#2148ce' : '#888'}
                              style={{ marginRight: 6 }}
                            />
                            <Text className={`font-medium ${
                              reportReason === option.value ? 'text-primary' : ''
                            }`}>
                              {option.label}
                            </Text>
                          </View>
                          <Text className="text-sm text-muted-foreground">
                            {option.description}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
  
                {(reportReason === ReportReason.OTHER || reportDetails.length > 0) && (
                  <View className="mb-6">
                    <Text className="font-medium mb-2">
                      Additional Details {reportReason === ReportReason.OTHER && '*'}
                    </Text>
                    <TextInput
                      className="bg-card border border-border rounded-lg p-4 text-foreground"
                      placeholder="Please provide specific details about the issue..."
                      placeholderTextColor="#888"
                      value={reportDetails}
                      onChangeText={setReportDetails}
                      multiline
                      numberOfLines={4}
                      maxLength={500}
                      textAlignVertical="top"
                    />
                    <Text className="text-xs text-muted-foreground mt-1 text-right">
                      {reportDetails.length}/500
                    </Text>
                  </View>
                )}
  
                {reportingInfo.hasReports && (
                  <View className="bg-muted/30 p-3 rounded-lg mb-6">
                    <Text className="text-sm text-muted-foreground">
                      <Text className="font-medium">{reportingInfo.totalReports}</Text> report{reportingInfo.totalReports !== 1 ? 's' : ''} already submitted.
                      {reportingInfo.reportsNeededForDispute > 0 && (
                        <Text> {reportingInfo.reportsNeededForDispute} more needed for dispute.</Text>
                      )}
                    </Text>
                  </View>
                )}
              </>
            )}
  
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowReportModal(false)}
                disabled={isSubmitting}
              >
                <Text>Close</Text>
              </Button>
              
              {!reportingInfo.userHasReported && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onPress={handleSubmitReport}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white">Submit Report</Text>
                  )}
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Loading state with enhanced UI
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#2148ce" />
          <Text className="mt-4 text-muted-foreground">Loading match details...</Text>
          <View className="mt-6 bg-card rounded-xl p-4 w-full max-w-sm">
            <View className="flex-row items-center">
              <Ionicons name="information-circle-outline" size={16} color="#888" style={{ marginRight: 8 }} />
              <Text className="text-sm text-muted-foreground">
                Loading comprehensive match data
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
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
            <Ionicons name="arrow-back" size={24} color="#2148ce" />
          </Button>
          <H1>Match Not Found</H1>
        </View>
        <View className="bg-card rounded-xl p-6 items-center">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-medium mt-4 mb-2">Match Not Found</Text>
          <Text className="text-muted-foreground text-center mb-6">
            Could not find the match you're looking for. It may have been deleted or you don't have permission to view it.
          </Text>
          <Button
            variant="default"
            onPress={() => router.replace("/(protected)/(tabs)")}
            className="w-full"
          >
            <Text>Return to Home</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="p-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2148ce"]}
            tintColor="#2148ce"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Validation Status Banner */}
        {renderValidationStatusBanner()}
        
        {/* Status Banners */}
        {matchState.needsScores && (
          <Animated.View 
            style={{ opacity: animatedValue }}
            className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-4 mb-4 border-l-4 border-amber-500"
          >
            <View className="flex-row items-center">
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color="#d97706"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-bold text-amber-800 dark:text-amber-300">
                    Match Needs Scores
                  </Text>
                  {renderVisibilityBadge(match.is_public)}
                </View>
                <Text className="text-amber-700 dark:text-amber-400 text-sm">
                  {matchState.isCreator 
                    ? "As the match creator, you can enter the scores." 
                    : "Only the match creator can enter scores for this match."}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
        
        {matchState.isFuture && (
          <View className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 mb-4 border-l-4 border-blue-500">
            <View className="flex-row items-center">
              <Ionicons
                name="calendar-outline"
                size={24}
                color="#1d4ed8"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-bold text-blue-800 dark:text-blue-300">
                    Upcoming Match
                  </Text>
                  {renderVisibilityBadge(match.is_public)}
                </View>
                <Text className="text-blue-700 dark:text-blue-400 text-sm">
                  {formatRelativeTime(match.start_time)} • {formatTime(match.start_time)}
                  {match.is_public && (
                    <>
                      {" • "}
                      <Text className="font-medium">Open for anyone to join</Text>
                    </>
                  )}
                </Text>
              </View>
            </View>
          </View>
        )}

        {matchState.canCancel && !matchState.isFuture && (
          <View className="bg-red-100 dark:bg-red-900/30 rounded-xl p-4 mb-4 border-l-4 border-red-500">
            <View className="flex-row items-center">
              <Ionicons
                name="warning-outline"
                size={24}
                color="#dc2626"
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-bold text-red-800 dark:text-red-300">
                    Deletion Window Active
                  </Text>
                  {renderVisibilityBadge(match.is_public)}
                </View>
                <Text className="text-red-700 dark:text-red-400 text-sm">
                  {getCancellationTimeInfo()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Enhanced Date, Time and Location Card */}
        <View className="bg-card rounded-xl p-6 mb-6 border border-border/30">
          <View className="flex-row justify-between items-start">
            <View className="flex-row items-start flex-1">
              <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-4">
                <Ionicons name="calendar-outline" size={24} color="#2148ce" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold mb-1">
                  {formatRelativeTime(match.start_time)}
                </Text>
                <Text className="text-muted-foreground mb-2">
                  {formatDate(match.start_time)} • {formatTime(match.start_time)}
                  {match.end_time ? ` - ${formatTime(match.end_time)}` : ""}
                </Text>
                
                {/* Enhanced Duration and Phase Info WITH VISIBILITY */}
                <View className="flex-row items-center flex-wrap gap-2">
                  <View className="bg-primary/10 px-2 py-1 rounded-full">
                    <Text className="text-xs font-medium text-primary">
                      {matchState.matchPhase.toUpperCase()}
                    </Text>
                  </View>
                  {renderVisibilityBadge(match.is_public)}
                  {match.start_time && match.end_time && (
                    <View className="bg-muted/50 px-2 py-1 rounded-full">
                      <Text className="text-xs text-muted-foreground">
                        {getMatchDuration(match.start_time, match.end_time)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Location */}
            {(match.region || match.court) && (
              <View className="items-end">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="location-outline" size={16} color="#888" style={{ marginRight: 4 }} />
                  <Text className="text-sm font-medium">
                    {match.court || "Court"}
                  </Text>
                </View>
                {match.region && (
                  <Text className="text-xs text-muted-foreground text-right">
                    {match.region}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Score Editing Section */}
        {editingScores && renderScoreEditSection()}

        {/* NEW: CONDENSED MATCH OVERVIEW COMPONENT */}
        {!editingScores && renderCondensedMatchOverview()}

        {/* MODIFIED: COLLAPSIBLE PERFORMANCE & INFO COMPONENT */}
        {renderCollapsiblePerformanceInfo()}

        {/* Confirmation Section */}
        {matchState.showConfirmationSection && !editingScores && (
          <MatchConfirmationSection
            matchId={match.id}
            players={[
              match.player1,
              match.player2,
              match.player3,
              match.player4
            ].filter(Boolean) as PlayerDetail[]}
            isCreator={matchState.isCreator}
            onConfirmationUpdate={() => fetchMatchDetails(match.id)}
          />
        )}

        {/* CRITICAL COMPONENT: Match Reports Section */}
        {reportingInfo.hasReports && (
          <View className="bg-card rounded-xl p-5 mb-6 border border-border/30">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mr-3">
                <Ionicons name="flag-outline" size={20} color="#dc2626" />
              </View>
              <View className="flex-1">
                <H3>Match Reports</H3>
                <Text className="text-sm text-muted-foreground">
                  {reportingInfo.totalReports} report{reportingInfo.totalReports !== 1 ? 's' : ''} submitted
                </Text>
              </View>
              <View className={`px-3 py-1 rounded-full ${
                reportingInfo.isDisputed 
                  ? 'bg-red-100 dark:bg-red-900/30' 
                  : 'bg-amber-100 dark:bg-amber-900/30'
              }`}>
                <Text className={`text-xs font-bold ${
                  reportingInfo.isDisputed 
                    ? 'text-red-700 dark:text-red-300' 
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {reportingInfo.isDisputed ? 'DISPUTED' : 'REPORTED'}
                </Text>
              </View>
            </View>

            {/* Reports List */}
            <View className="space-y-3">
              {reports.slice(0, 5).map((report, index) => (
                <View key={report.id} className="p-3 bg-muted/20 rounded-lg">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center flex-1">
                      <View className="w-6 h-6 rounded-full bg-red-500 items-center justify-center mr-2">
                        <Text className="text-xs font-bold text-white">{index + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium">
                          {report.reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          By {report.reporter?.full_name || report.reporter?.email?.split('@')[0] || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {formatRelativeTime(report.created_at)}
                    </Text>
                  </View>
                  
                  {report.additional_details && (
                    <View className="mt-2 p-2 bg-background/50 rounded">
                      <Text className="text-xs text-muted-foreground italic">
                        "{report.additional_details}"
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              
              {reports.length > 5 && (
                <View className="p-2 bg-muted/10 rounded-lg">
                  <Text className="text-xs text-muted-foreground text-center">
                    And {reports.length - 5} more report{reports.length - 5 !== 1 ? 's' : ''}...
                  </Text>
                </View>
              )}
            </View>

            {/* Dispute Status */}
            {reportingInfo.isDisputed && (
              <View className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text className="font-medium text-red-800 dark:text-red-300">Match Under Review</Text>
                </View>
                <Text className="text-sm text-red-700 dark:text-red-400">
                  This match has been flagged for review due to multiple reports. 
                  Ratings may be adjusted pending investigation.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Enhanced Match Description */}
        {match.description && (
          <View className="bg-card rounded-xl p-5 mb-6 border border-border/30">
            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons name="document-text-outline" size={20} color="#2148ce" />
              </View>
              <Text className="font-medium">Match Notes</Text>
            </View>
            <View className="bg-muted/20 p-4 rounded-lg">
              <Text className="text-muted-foreground italic leading-6">
                "{match.description}"
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* NEW: EXPANDABLE FAB MENU */}
      {renderExpandableFAB()}

      {/* CRITICAL MODAL: Report Match Modal */}
      {renderReportingModal()}
    </SafeAreaView>
  );
} 