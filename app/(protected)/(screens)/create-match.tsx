import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Image,
  Vibration,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3 } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { Friend } from "@/types";

import { PlayerSelectionModal } from "@/components/create-match/PlayerSelectionModal";
import { CustomDateTimePicker } from "@/components/create-match/DateTimePicker";
import {
  SetScoreInput,
  SetScore,
} from "@/components/create-match/SetScoreInput";

// ENHANCEMENT: Add validation status enum - create this file if it doesn't exist
export enum ValidationStatus {
  PENDING = "pending",
  VALIDATED = "validated",
  DISPUTED = "disputed",
  EXPIRED = "expired",
}

// ENHANCEMENT: Enhanced Match Status Enum with validation support
export enum MatchStatus {
  PENDING = 1, // Future match, waiting for start time
  NEEDS_CONFIRMATION = 2, // Match finished, waiting for score confirmation
  CANCELLED = 3, // Match was cancelled
  COMPLETED = 4, // Match completed with scores recorded
  RECRUITING = 5, // Public match looking for players
}

// ENHANCEMENT: Validation configuration constants
const VALIDATION_CONFIG = {
  DISPUTE_WINDOW_HOURS: 24,
  DISPUTE_THRESHOLD: 2,
  MIN_MATCH_AGE_DAYS: 7,
  MAX_FUTURE_DAYS: 30,
  RATING_CALCULATION_DELAY_MS: 1000,
  VALIDATION_WARNING_HOURS: 6,
  QUICK_VALIDATION_HOURS: 1, // For testing/demo purposes
};

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
}

// ENHANCEMENT: Enhanced MatchData interface with validation fields
interface MatchData {
  id?: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  created_at?: string;
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
  is_public: boolean;
  description?: string;
  // ENHANCEMENT: Validation fields
  validation_deadline?: string;
  validation_status?: string;
  rating_applied?: boolean;
  report_count?: number;
}

/**
 * ENHANCEMENT: Validation Info Card Component
 * Displays information about the score validation system
 */
interface ValidationInfoCardProps {
  isPastMatch: boolean;
  isDemo?: boolean;
}

const ValidationInfoCard: React.FC<ValidationInfoCardProps> = ({
  isPastMatch,
  isDemo = false,
}) => {
  // ALL HOOKS DECLARED FIRST - CRITICAL FOR REACT RULES
  const [expanded, setExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded, animatedHeight]);

  // EARLY RETURN AFTER ALL HOOKS - SAFE PATTERN
  if (!isPastMatch) return null;

  return (
    <View className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 items-center justify-center mr-3">
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#2563eb"
            />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-blue-800 dark:text-blue-300">
              Score Validation System Active
            </Text>
            <Text className="text-sm text-blue-600 dark:text-blue-400">
              {isDemo ? "1-hour" : "24-hour"} dispute window • Tap to learn more
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#2563eb"
        />
      </TouchableOpacity>

      <Animated.View
        style={{
          maxHeight: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 500],
          }),
          opacity: animatedHeight,
          overflow: "hidden",
        }}
      >
        <View className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <Text className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            The validation system protects rating integrity:
          </Text>

          <View className="space-y-2">
            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">1.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                After recording scores, all participants have{" "}
                {isDemo ? "1 hour" : "24 hours"} to dispute if incorrect
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">2.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                Ratings are only applied after the dispute window closes
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">3.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                If 2+ players report issues, the match is disputed and ratings
                are not applied
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-blue-600 dark:text-blue-400 mr-2">4.</Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                Match creator can delete within 24 hours if mistakes were made
              </Text>
            </View>
          </View>

          {isDemo && (
            <View className="mt-3 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <View className="flex-row items-center">
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#d97706"
                  style={{ marginRight: 6 }}
                />
                <Text className="text-xs text-amber-700 dark:text-amber-400">
                  Demo Mode: Using 1-hour validation for testing
                </Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

/**
 * Advanced Match Player Avatar Component
 * Implements comprehensive image loading with team-specific styling
 * Optimized for create match screen with contextual visual enhancements
 */
interface MatchPlayerAvatarProps {
  player: {
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
    isCurrentUser?: boolean;
  } | null;
  team?: 1 | 2;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBorder?: boolean;
  showTeamIndicator?: boolean;
  isPlaceholder?: boolean;
  showShadow?: boolean;
}

function MatchPlayerAvatar({
  player,
  team = 1,
  size = "md",
  showBorder = false,
  showTeamIndicator = false,
  isPlaceholder = false,
  showShadow = true,
}: MatchPlayerAvatarProps) {
  // State management for image loading lifecycle
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  // Comprehensive size configuration matrix
  const avatarSizeConfiguration = {
    xs: {
      containerClass: "w-6 h-6",
      imageStyle: { width: 24, height: 24, borderRadius: 12 },
      textClass: "text-xs",
      borderWidth: 1,
      indicatorSize: "w-3 h-3",
      indicatorTextClass: "text-[8px]",
    },
    sm: {
      containerClass: "w-8 h-8",
      imageStyle: { width: 32, height: 32, borderRadius: 16 },
      textClass: "text-sm",
      borderWidth: 2,
      indicatorSize: "w-4 h-4",
      indicatorTextClass: "text-[9px]",
    },
    md: {
      containerClass: "w-12 h-12",
      imageStyle: { width: 48, height: 48, borderRadius: 24 },
      textClass: "text-lg",
      borderWidth: 2,
      indicatorSize: "w-5 h-5",
      indicatorTextClass: "text-[10px]",
    },
    lg: {
      containerClass: "w-16 h-16",
      imageStyle: { width: 64, height: 64, borderRadius: 32 },
      textClass: "text-xl",
      borderWidth: 3,
      indicatorSize: "w-6 h-6",
      indicatorTextClass: "text-xs",
    },
    xl: {
      containerClass: "w-20 h-20",
      imageStyle: { width: 80, height: 80, borderRadius: 40 },
      textClass: "text-2xl",
      borderWidth: 4,
      indicatorSize: "w-7 h-7",
      indicatorTextClass: "text-sm",
    },
  };

  const sizeConfig = avatarSizeConfiguration[size];

  // Team-specific styling configuration
  const getTeamStyling = () => {
    const baseStyles = {
      1: {
        bgColor: "bg-primary",
        bgColorFallback: "bg-primary/80",
        borderColor: "#1a7ebd",
        indicatorBg: "bg-primary",
        teamLabel: "T1",
        teamColor: "#ffffff",
      },
      2: {
        bgColor: "bg-indigo-500",
        bgColorFallback: "bg-indigo-500/80",
        borderColor: "#6366f1",
        indicatorBg: "bg-indigo-500",
        teamLabel: "T2",
        teamColor: "#ffffff",
      },
    };
    return baseStyles[team];
  };

  const teamStyle = getTeamStyling();

  /**
   * Advanced Fallback Character Extraction Algorithm
   * Priority: full_name -> email -> placeholder
   */
  const extractPlayerInitial = (): string => {
    if (isPlaceholder) return "?";
    if (!player) return "?";

    // Primary extraction: full_name
    if (player.full_name?.trim()) {
      const sanitizedName = player.full_name.trim();
      if (sanitizedName.length > 0) {
        return sanitizedName.charAt(0).toUpperCase();
      }
    }

    // Secondary extraction: email
    if (player.email?.trim()) {
      const sanitizedEmail = player.email.trim();
      if (sanitizedEmail.length > 0) {
        return sanitizedEmail.charAt(0).toUpperCase();
      }
    }

    return "?";
  };

  /**
   * Avatar Image Availability Validation
   */
  const shouldDisplayAvatarImage = (): boolean => {
    if (isPlaceholder || !player?.avatar_url) return false;

    const trimmedUrl = player.avatar_url.trim();
    return Boolean(trimmedUrl && trimmedUrl.length > 0 && !imageLoadError);
  };

  /**
   * Dynamic Container Styling with Team Context
   */
  const getContainerStyle = () => {
    let baseStyle = {
      shadowColor: showShadow ? "#000" : "transparent",
      shadowOffset: showShadow
        ? { width: 0, height: 2 }
        : { width: 0, height: 0 },
      shadowOpacity: showShadow ? 0.15 : 0,
      shadowRadius: showShadow ? 4 : 0,
      elevation: showShadow ? 3 : 0,
    };

    if (showBorder) {
      baseStyle = {
        ...baseStyle,
        borderWidth: sizeConfig.borderWidth,
        borderColor: teamStyle.borderColor,
      };
    }

    return baseStyle;
  };

  /**
   * Image Loading Event Handlers
   */
  const handleImageLoadSuccess = (): void => {
    setImageLoading(false);
  };

  const handleImageLoadFailure = (): void => {
    console.warn(`Match player avatar load failure:`, {
      playerId: player?.id,
      playerName: player?.full_name || player?.email,
      avatarUrl: player?.avatar_url,
      team,
      component: "MatchPlayerAvatar",
    });

    setImageLoadError(true);
    setImageLoading(false);
  };

  const handleImageLoadStart = (): void => {
    setImageLoading(true);
  };

  // Placeholder Avatar Rendering
  if (isPlaceholder) {
    return (
      <View className="relative">
        <View
          className={`${sizeConfig.containerClass} rounded-full border-2 border-dashed items-center justify-center ${
            team === 1 ? "border-primary/40" : "border-indigo-500/40"
          }`}
          style={getContainerStyle()}
        >
          <Text
            className={`${sizeConfig.textClass} ${
              team === 1 ? "text-primary/60" : "text-indigo-500/60"
            }`}
          >
            ?
          </Text>
        </View>

        {showTeamIndicator && (
          <View
            className={`absolute -top-1 -right-1 ${sizeConfig.indicatorSize} rounded-full ${teamStyle.indicatorBg} items-center justify-center border-2 border-white dark:border-gray-800`}
          >
            <Text
              className={`${sizeConfig.indicatorTextClass} font-bold text-white`}
            >
              {teamStyle.teamLabel}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Avatar Image Rendering Branch
  if (shouldDisplayAvatarImage()) {
    return (
      <View className="relative">
        <View
          className={`${sizeConfig.containerClass} rounded-full ${teamStyle.bgColor} items-center justify-center overflow-hidden`}
          style={getContainerStyle()}
        >
          <Image
            source={{ uri: player!.avatar_url! }}
            style={sizeConfig.imageStyle}
            resizeMode="cover"
            onLoad={handleImageLoadSuccess}
            onError={handleImageLoadFailure}
            onLoadStart={handleImageLoadStart}
          />

          {/* Loading State Overlay */}
          {imageLoading && (
            <View
              className={`absolute inset-0 ${teamStyle.bgColorFallback} items-center justify-center`}
            >
              <Text className={`${sizeConfig.textClass} font-bold text-white`}>
                {extractPlayerInitial()}
              </Text>

              {/* Subtle loading indicator */}
              <View
                className="absolute bottom-1 right-1 bg-white/20 rounded-full p-0.5"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 1,
                  elevation: 1,
                }}
              ></View>
            </View>
          )}
        </View>

        {/* Team Indicator Badge */}
        {showTeamIndicator && (
          <View
            className={`absolute -top-1 -right-1 ${sizeConfig.indicatorSize} rounded-full ${teamStyle.indicatorBg} items-center justify-center border-2 border-white dark:border-gray-800`}
          >
            <Text
              className={`${sizeConfig.indicatorTextClass} font-bold text-white`}
            >
              {teamStyle.teamLabel}
            </Text>
          </View>
        )}

        {/* Current User Indicator */}
        {player?.isCurrentUser && (
          <View className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center border-2 border-white dark:border-gray-800">
            <Ionicons name="person" size={8} color="white" />
          </View>
        )}
      </View>
    );
  }

  // Text Initial Fallback with Team Styling
  return (
    <View className="relative">
      <View
        className={`${sizeConfig.containerClass} rounded-full ${teamStyle.bgColor} items-center justify-center`}
        style={getContainerStyle()}
      >
        <Text className={`${sizeConfig.textClass} font-bold text-white`}>
          {extractPlayerInitial()}
        </Text>
      </View>

      {/* Team Indicator Badge */}
      {showTeamIndicator && (
        <View
          className={`absolute -top-1 -right-1 ${sizeConfig.indicatorSize} rounded-full ${teamStyle.indicatorBg} items-center justify-center border-2 border-white dark:border-gray-800`}
        >
          <Text
            className={`${sizeConfig.indicatorTextClass} font-bold text-white`}
          >
            {teamStyle.teamLabel}
          </Text>
        </View>
      )}

      {/* Current User Indicator */}
      {player?.isCurrentUser && (
        <View className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center border-2 border-white dark:border-gray-800">
          <Ionicons name="person" size={8} color="white" />
        </View>
      )}
    </View>
  );
}

/**
 * Enhanced Team Player Row Component
 * Displays individual player with avatar and contextual information
 */
interface TeamPlayerRowProps {
  player: {
    id: string;
    name: string;
    isCurrentUser: boolean;
    email?: string;
    avatar_url?: string | null;
    glicko_rating?: string | null;
  };
  team: 1 | 2;
  showRating?: boolean;
}

function TeamPlayerRow({
  player,
  team,
  showRating = false,
}: TeamPlayerRowProps) {
  return (
    <View className="flex-row items-center mb-2 p-2 w-32 rounded-lg bg-white/40 dark:bg-white/5">
      <MatchPlayerAvatar
        player={{
          id: player.id,
          full_name: player.name,
          email: player.email || "",
          avatar_url: player.avatar_url,
          isCurrentUser: player.isCurrentUser,
        }}
        team={team}
        size="md"
        showBorder={true}
        showShadow={true}
      />

      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="font-medium" numberOfLines={1}>
            {player.isCurrentUser ? "You" : player.name}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function CreateMatchScreen() {
  // ========================================
  // CRITICAL: ALL HOOKS DECLARED FIRST
  // MAINTAINS PROPER REACT HOOKS ORDERING
  // ========================================

  // 1. ROUTING HOOKS
  const { friendId } = useLocalSearchParams();
  const { profile, session } = useAuth();

  // 2. CORE STATE HOOKS
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : [],
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  // 3. DATE AND TIME STATE
  const [matchDate, setMatchDate] = useState(new Date());
  const [matchStartTime, setMatchStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now;
  });
  const [matchEndTime, setMatchEndTime] = useState(() => {
    const date = new Date();
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    date.setHours(date.getHours() + 1, 30);
    return date;
  });

  // 4. MATCH SETTINGS STATE
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [matchDescription, setMatchDescription] = useState("");

  // 5. ENHANCEMENT: VALIDATION STATE
  const [useQuickValidation, setUseQuickValidation] = useState(false);
  const [showValidationInfo, setShowValidationInfo] = useState(true);

  // 6. REF HOOKS
  const team1Set1Ref = useRef<TextInput>(null);
  const team2Set1Ref = useRef<TextInput>(null);
  const team1Set2Ref = useRef<TextInput>(null);
  const team2Set2Ref = useRef<TextInput>(null);
  const team1Set3Ref = useRef<TextInput>(null);
  const team2Set3Ref = useRef<TextInput>(null);

  // 7. SCORE STATE
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);

  // 8. LOCATION STATE
  const [region, setRegion] = useState("");
  const [court, setCourt] = useState("");

  // 9. COMPUTED VALUES WITH USEMEMO
  const isPastMatch = useMemo(() => {
    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes(),
    );
    const now = new Date();
    const bufferTime = 15 * 60 * 1000;
    return combinedStartTime.getTime() <= now.getTime() + bufferTime;
  }, [matchDate, matchStartTime]);

  const isFutureMatch = useMemo(() => {
    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes(),
    );
    const now = new Date();
    const minFutureTime = 15 * 60 * 1000;
    return combinedStartTime.getTime() > now.getTime() + minFutureTime;
  }, [matchDate, matchStartTime]);

  const teamComposition = useMemo(() => {
    const totalPlayers = 1 + selectedFriends.length;
    const availableSlots = 4 - totalPlayers;

    const team1Players = [
      {
        id: session?.user?.id || "",
        name:
          profile?.full_name || session?.user?.email?.split("@")[0] || "You",
        isCurrentUser: true,
        email: session?.user?.email || "",
        avatar_url: profile?.avatar_url || null,
        glicko_rating: profile?.glicko_rating || null,
      },
    ];
    const team2Players: Array<{
      id: string;
      name: string;
      isCurrentUser: boolean;
      email: string;
      avatar_url: string | null;
      glicko_rating: string | null;
    }> = [];

    selectedPlayers.forEach((player, index) => {
      const playerInfo = {
        id: player.id,
        name: player.full_name || player.email?.split("@")[0] || "Player",
        isCurrentUser: false,
        email: player.email,
        avatar_url: player.avatar_url || null,
        glicko_rating: player.glicko_rating || null,
      };

      if (index === 0) {
        team1Players.push(playerInfo);
      } else {
        team2Players.push(playerInfo);
      }
    });

    return {
      totalPlayers,
      availableSlots,
      team1Players,
      team2Players,
      isComplete: totalPlayers === 4,
      isValidForPast: totalPlayers === 4,
      isValidForFuture: totalPlayers >= 1,
    };
  }, [selectedFriends, selectedPlayers, session?.user?.id, profile]);

  // 10. CALLBACK HOOKS
  const fetchFriends = useCallback(async () => {
    try {
      if (
        !profile?.friends_list ||
        !Array.isArray(profile.friends_list) ||
        profile.friends_list.length === 0
      ) {
        setFriends([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, avatar_url, glicko_rating, preferred_hand, court_playing_side",
        )
        .in("id", profile.friends_list);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [fetchFriends]);

  // 11. EFFECT HOOKS
  useEffect(() => {
    if (session?.user?.id) {
      setLoading(true);
      fetchFriends().finally(() => setLoading(false));
    }
  }, [session, fetchFriends]);

  useEffect(() => {
    if (!isPastMatch) {
      setShowSet3(false);
      return;
    }

    const team1WonSet1 = set1Score.team1 > set1Score.team2;
    const team1WonSet2 = set2Score.team1 > set2Score.team2;

    const isTied =
      (team1WonSet1 && !team1WonSet2) || (!team1WonSet1 && team1WonSet2);

    setShowSet3(isTied && isSet1Valid && isSet2Valid);

    if (!isTied) {
      setSet3Score({ team1: 0, team2: 0 });
    }
  }, [set1Score, set2Score, isSet1Valid, isSet2Valid, isPastMatch]);

  useEffect(() => {
    if (selectedFriends.length > 0) {
      const selected = friends.filter((friend) =>
        selectedFriends.includes(friend.id),
      );
      setSelectedPlayers(selected);
    } else {
      setSelectedPlayers([]);
    }
  }, [selectedFriends, friends]);

  useEffect(() => {
    const startTime = new Date(matchStartTime);
    const newEndTime = new Date(startTime);
    newEndTime.setHours(newEndTime.getHours() + 1, 30);
    setMatchEndTime(newEndTime);
  }, [matchStartTime]);

  useEffect(() => {
    if (isPastMatch && isPublicMatch) {
      setIsPublicMatch(false);
    }
  }, [isPastMatch, isPublicMatch]);

  // ========================================
  // ALL HOOKS DECLARED ABOVE THIS LINE
  // BUSINESS LOGIC FUNCTIONS BELOW
  // ========================================

  // Enhanced navigation between score inputs
  const handleTeam1Set1Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set1Ref.current?.focus();
    }
  };

  const handleTeam2Set1Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team1Set2Ref.current?.focus();
    }
  };

  const handleTeam1Set2Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set2Ref.current?.focus();
    }
  };

  const handleTeam2Set2Change = (text: string) => {
    if (showSet3 && text.length === 1 && /^\d$/.test(text)) {
      team1Set3Ref.current?.focus();
    }
  };

  const handleTeam1Set3Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set3Ref.current?.focus();
    }
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

    if (team1Sets > team2Sets) return 1;
    if (team2Sets > team1Sets) return 2;
    return 0;
  };

  // ENHANCEMENT: Enhanced validation with comprehensive error checking
  const validateMatch = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    const combinedStartTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchStartTime.getHours(),
      matchStartTime.getMinutes(),
    );

    const combinedEndTime = new Date(
      matchDate.getFullYear(),
      matchDate.getMonth(),
      matchDate.getDate(),
      matchEndTime.getHours(),
      matchEndTime.getMinutes(),
    );

    if (combinedEndTime <= combinedStartTime) {
      errors.push("End time must be after start time");
    }

    const matchDuration =
      combinedEndTime.getTime() - combinedStartTime.getTime();
    const minDuration = 30 * 60 * 1000;
    const maxDuration = 4 * 60 * 60 * 1000;

    if (matchDuration < minDuration) {
      errors.push("Match duration must be at least 30 minutes");
    }

    if (matchDuration > maxDuration) {
      errors.push("Match duration cannot exceed 4 hours");
    }

    if (isPastMatch) {
      if (!teamComposition.isValidForPast) {
        errors.push("Past matches require exactly 4 players (you + 3 friends)");
      }

      if (!isSet1Valid || !isSet2Valid) {
        errors.push("Please enter valid scores for both sets");
      }

      if (showSet3 && !isSet3Valid) {
        errors.push("Please enter a valid score for the third set");
      }

      const now = new Date();
      const daysDiff =
        (now.getTime() - combinedStartTime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS) {
        errors.push(
          `Cannot record matches older than ${VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS} days`,
        );
      }

      if (isPublicMatch) {
        errors.push("Past matches cannot be made public");
      }
    } else {
      if (!isFutureMatch) {
        errors.push(
          "Future matches must be scheduled at least 15 minutes from now",
        );
      }

      if (!teamComposition.isValidForFuture) {
        errors.push("You must be part of the match");
      }

      const now = new Date();
      const daysDiff =
        (combinedStartTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > VALIDATION_CONFIG.MAX_FUTURE_DAYS) {
        errors.push(
          `Cannot schedule matches more than ${VALIDATION_CONFIG.MAX_FUTURE_DAYS} days in advance`,
        );
      }
    }

    if (isPublicMatch && !region.trim()) {
      errors.push("Public matches require a location to be specified");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // CRITICAL MODIFICATION: Enhanced createMatch function with validation system
  const createMatch = async () => {
    try {
      const validation = validateMatch();

      if (!validation.isValid) {
        Alert.alert("Validation Error", validation.errors.join("\n"), [
          { text: "OK" },
        ]);
        return;
      }

      setLoading(true);

      const combinedStartTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchStartTime.getHours(),
        matchStartTime.getMinutes(),
      );

      const combinedEndTime = new Date(
        matchDate.getFullYear(),
        matchDate.getMonth(),
        matchDate.getDate(),
        matchEndTime.getHours(),
        matchEndTime.getMinutes(),
      );

      if (isPastMatch) {
        // SIMPLIFIED PAST MATCH PROCESSING WITH POSTGRESQL CRON INTEGRATION
        const winnerTeam = determineWinnerTeam();
  
        const playerIds = [session?.user?.id, ...selectedFriends].filter(
          (id) => id != null,
        ) as string[];
        if (playerIds.length !== 4) {
          throw new Error("Could not form a team of 4 players");
        }
  
        // STEP 1: Calculate validation deadline
        const now = new Date();
        const validationHours = useQuickValidation
          ? VALIDATION_CONFIG.QUICK_VALIDATION_HOURS
          : VALIDATION_CONFIG.DISPUTE_WINDOW_HOURS;
        const validationDeadline = new Date(
          now.getTime() + validationHours * 60 * 60 * 1000,
        );
  
        // STEP 2: Create match with validation metadata (SIMPLIFIED)
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: selectedFriends[0] || null,
          player3_id: selectedFriends[1] || null,
          player4_id: selectedFriends[2] || null,
          team1_score_set1: set1Score.team1,
          team2_score_set1: set1Score.team2,
          team1_score_set2: set2Score.team1,
          team2_score_set2: set2Score.team2,
          team1_score_set3: showSet3 ? set3Score.team1 : null,
          team2_score_set3: showSet3 ? set3Score.team2 : null,
          winner_team: winnerTeam,
          status: MatchStatus.COMPLETED,
          completed_at: new Date().toISOString(),
          start_time: combinedStartTime.toISOString(),
          end_time: combinedEndTime.toISOString(),
          region: region.trim() || null,
          court: court.trim() || null,
          is_public: false,
          description: matchDescription.trim() || null,
          // VALIDATION FIELDS: Let PostgreSQL cron job handle rating calculations
          validation_deadline: validationDeadline.toISOString(),
          validation_status: "pending",
          rating_applied: false,
          report_count: 0,
        };
  
        console.log("🎯 Creating past match with PostgreSQL cron validation:", {
          validation_deadline: matchData.validation_deadline,
          validation_status: matchData.validation_status,
          rating_applied: matchData.rating_applied,
          hours_until_deadline: validationHours,
          processing_method: "postgresql_cron_job"
        });
  
        // STEP 3: Insert match record (PostgreSQL cron will handle rating calculation)
        const { data: matchResult, error: matchError } = await supabase
          .from("matches")
          .insert(matchData)
          .select()
          .single();
  
        if (matchError) throw matchError;
  
        console.log("✅ Match created successfully. PostgreSQL cron job will process ratings after validation period.");
  
        // STEP 4: Enhanced success feedback with PostgreSQL cron integration
        const validationHoursDisplay = useQuickValidation ? "1 hour" : "24 hours";
  
        Alert.alert(
          "✅ Match Created Successfully!",
          `Match has been recorded with automatic validation system.\n\n` +
          `⏰ Validation Period: ${validationHoursDisplay}\n\n` +
          `🤖 Rating Processing: Automated server processing\n` +
          `📊 Ratings will be calculated and applied automatically after validation period expires.\n\n` +
          `📢 All players can report issues during validation period.\n` +
          `💡 You can delete this match within 24 hours if needed.\n\n` +
          `🎯 Server automation will handle rating calculations every 30 minutes.`,
          [
            {
              text: "View Match Details",
              onPress: () =>
                router.push({
                  pathname: "/(protected)/(screens)/match-details",
                  params: { matchId: matchResult.id },
                }),
            },
            {
              text: "OK",
              onPress: () => router.push("/(protected)/(tabs)"),
            },
          ],
        );
  
        Vibration.vibrate([100, 50, 100]);
  
      } else {
        // Future match - no validation needed (unchanged logic)
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: selectedFriends[0] || null,
          player3_id: selectedFriends[1] || null,
          player4_id: selectedFriends[2] || null,
          team1_score_set1: null,
          team2_score_set1: null,
          team1_score_set2: null,
          team2_score_set2: null,
          team1_score_set3: null,
          team2_score_set3: null,
          winner_team: null,
          status: teamComposition.isComplete
            ? MatchStatus.PENDING
            : MatchStatus.RECRUITING,
          completed_at: null,
          start_time: combinedStartTime.toISOString(),
          end_time: combinedEndTime.toISOString(),
          region: region.trim() || null,
          court: court.trim() || null,
          is_public: isPublicMatch,
          description: matchDescription.trim() || null,
        };

        const { data: matchResult, error: matchError } = await supabase
          .from("matches")
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        let statusMessage = "";
        if (teamComposition.isComplete) {
          statusMessage = isPublicMatch
            ? "Your public match has been scheduled successfully!"
            : "Your private match has been scheduled successfully!";
        } else {
          statusMessage = isPublicMatch
            ? "Your public match has been created! Other players can now join."
            : `Private match created with ${teamComposition.availableSlots} open slot${teamComposition.availableSlots > 1 ? "s" : ""}. Invite more friends to complete the match.`;
        }

        Alert.alert("Match Scheduled!", statusMessage, [
          { text: "OK", onPress: () => router.push("/(protected)/(tabs)") },
        ]);

        Vibration.vibrate(100);
      }
    } catch (error) {
      console.error("Error creating match:", error);
      Alert.alert(
        "Error",
        `Failed to create match: ${(error as Error).message}`,
        [{ text: "OK" }],
      );
      Vibration.vibrate(300);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced player section with validation awareness
  const renderPlayerSection = () => (
    <View
      className={`mb-6 p-5 rounded-2xl border border-border/30 ${
        isPastMatch
          ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20"
          : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
      }`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <H3>Team Composition</H3>
          <Text className="text-sm text-muted-foreground">
            {teamComposition.totalPlayers}/4 players selected
          </Text>
        </View>
        <View
          className={`px-4 py-2 rounded-full ${
            isPastMatch
              ? "bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800"
              : "bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800"
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              isPastMatch
                ? "text-amber-800 dark:text-amber-200"
                : "text-blue-800 dark:text-blue-200"
            }`}
          >
            {isPastMatch ? "Past Match" : "Future Match"}
          </Text>
        </View>
      </View>

      {/* ENHANCEMENT: Updated context information with validation details */}
      <View className="mb-6 p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50">
        <View className="flex-row items-center mb-2">
          <Ionicons
            name={isPastMatch ? "time-outline" : "calendar-outline"}
            size={16}
            color={isPastMatch ? "#d97706" : "#2563eb"}
          />
          <Text className="ml-2 text-sm font-medium">
            {isPastMatch
              ? "Recording Completed Match"
              : "Scheduling Future Match"}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground leading-relaxed">
          {isPastMatch
            ? "Past matches require exactly 4 players. Scores will enter a validation period before ratings are applied."
            : "Future matches can be created with 1-4 players. Missing positions can be filled later."}
        </Text>
      </View>

      {/* Team visualization - unchanged from working version */}
      <View
        className="bg-white/80 dark:bg-white/10 rounded-2xl p-5 mb-6 border border-white/50"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View className="flex-row justify-between">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-xl bg-primary items-center justify-center mr-3 shadow-sm">
                <Text className="text-sm font-bold text-white">T1</Text>
              </View>
              <View>
                <Text className="font-bold text-primary">Team 1</Text>
                <Text className="text-xs text-muted-foreground">
                  {teamComposition.team1Players.length}/2 players
                </Text>
              </View>
            </View>

            <View className="space-y-2">
              {teamComposition.team1Players.map((player, index) => (
                <TeamPlayerRow
                  key={player.id}
                  player={player}
                  team={1}
                  showRating={isPastMatch}
                />
              ))}

              {Array(2 - teamComposition.team1Players.length)
                .fill(0)
                .map((_, i) => (
                  <View
                    key={`team1-empty-${i}`}
                    className="flex-row items-center mb-2 p-2 w-32 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5"
                  >
                    <MatchPlayerAvatar
                      player={null}
                      team={1}
                      size="md"
                      isPlaceholder={true}
                    />
                    <View className="flex-1 ml-3">
                      <Text className="text-sm text-muted-foreground">
                        Open Position
                      </Text>
                      <Text className="text-xs text-muted-foreground/70">
                        {isPastMatch
                          ? "Required for past matches"
                          : "Available slot"}
                      </Text>
                    </View>
                    <View className="px-2 py-1 rounded-full bg-primary/10">
                      <Text className="text-xs font-medium text-primary/70">
                        Team 1
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>

          <View className="items-center justify-center px-4">
            <View className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 items-center justify-center shadow-md">
              <Text className="text-lg font-black text-slate-600 dark:text-slate-300">
                VS
              </Text>
            </View>
          </View>

          <View className="flex-1 ml-3">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-xl bg-indigo-500 items-center justify-center mr-3 shadow-sm">
                <Text className="text-sm font-bold text-white">T2</Text>
              </View>
              <View>
                <Text className="font-bold text-indigo-600">Team 2</Text>
                <Text className="text-xs text-muted-foreground">
                  {teamComposition.team2Players.length}/2 players
                </Text>
              </View>
            </View>

            <View className="space-y-2">
              {teamComposition.team2Players.map((player, index) => (
                <TeamPlayerRow
                  key={player.id}
                  player={player}
                  team={2}
                  showRating={isPastMatch}
                />
              ))}

              {Array(2 - teamComposition.team2Players.length)
                .fill(0)
                .map((_, i) => (
                  <View
                    key={`team2-empty-${i}`}
                    className="flex-row items-center mb-2 p-2 w-32  rounded-lg border-2 border-dashed border-indigo-500/30 bg-indigo-500/5"
                  >
                    <MatchPlayerAvatar
                      player={null}
                      team={2}
                      size="md"
                      isPlaceholder={true}
                    />
                    <View className="flex-1 ml-3">
                      <Text className="text-sm text-muted-foreground">
                        Open Position
                      </Text>
                      <Text className="text-xs text-muted-foreground/70">
                        {isPastMatch
                          ? "Required for past matches"
                          : "Available slot"}
                      </Text>
                    </View>
                    <View className="px-2 py-1 rounded-full bg-indigo-500/10">
                      <Text className="text-xs font-medium text-indigo-600/70">
                        Team 2
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        </View>
      </View>

      {/* Player management - unchanged */}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 py-3"
          onPress={() => setShowPlayerModal(true)}
          style={{
            shadowColor: "#1a7ebd",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={18} color="#1a7ebd" />
            <Text className="ml-2 font-medium">
              {selectedPlayers.length === 0 ? "Select Players" : "Manage Team"}
            </Text>
          </View>
        </Button>

        {selectedPlayers.length > 0 && (
          <Button
            variant="ghost"
            className="px-4"
            onPress={() => {
              setSelectedFriends([]);
              setSelectedPlayers([]);
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </Button>
        )}
      </View>

      {/* Status indicators - unchanged */}
      <View className="mt-4 p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50">
        <View className="flex-row items-center">
          <View
            className={`w-3 h-3 rounded-full mr-3 ${
              teamComposition.isComplete
                ? "bg-green-500"
                : teamComposition.totalPlayers >= 2
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <View className="flex-1">
            <Text
              className={`text-sm font-medium ${
                teamComposition.isComplete
                  ? "text-green-600 dark:text-green-400"
                  : teamComposition.totalPlayers >= 2
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {teamComposition.isComplete
                ? "Match is ready!"
                : teamComposition.totalPlayers >= 2
                  ? `${teamComposition.availableSlots} slot${teamComposition.availableSlots > 1 ? "s" : ""} remaining`
                  : "Need more players"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {teamComposition.isComplete
                ? "All positions filled and ready to start"
                : isPastMatch
                  ? "Past matches require exactly 4 players"
                  : "You can create the match and fill remaining slots later"}
            </Text>
          </View>
          {teamComposition.isComplete && (
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          )}
        </View>
      </View>
    </View>
  );

  // ENHANCEMENT: Enhanced time section with validation options
  const renderTimeSection = () => (
    <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
      <H3 className="mb-4">Date & Time</H3>

      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4 mb-4">
        <CustomDateTimePicker
          label="Match Date"
          value={matchDate}
          onChange={setMatchDate}
          mode="date"
          minimumDate={isPastMatch ? undefined : new Date()}
          maximumDate={
            isPastMatch
              ? new Date()
              : (() => {
                  const maxDate = new Date();
                  maxDate.setDate(
                    maxDate.getDate() + VALIDATION_CONFIG.MAX_FUTURE_DAYS,
                  );
                  return maxDate;
                })()
          }
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

        <View className="mt-3 p-2 bg-muted/30 rounded">
          <Text className="text-sm text-muted-foreground">
            Duration:{" "}
            {Math.round(
              (matchEndTime.getTime() - matchStartTime.getTime()) / (1000 * 60),
            )}{" "}
            minutes
          </Text>
        </View>
      </View>

      {/* Match settings for future matches */}
      {!isPastMatch && (
        <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4 mb-4">
          <Text className="text-base font-medium mb-3">Match Settings</Text>

          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-muted-foreground">
                Match Visibility
              </Text>
              <View className="flex-row items-center">
                <Text
                  className={`text-sm mr-3 ${!isPublicMatch ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  Private
                </Text>
                <TouchableOpacity
                  className={`w-12 h-6 rounded-full ${
                    isPublicMatch ? "bg-primary" : "bg-muted"
                  }`}
                  onPress={() => setIsPublicMatch(!isPublicMatch)}
                >
                  <View
                    className={`w-5 h-5 rounded-full bg-white m-0.5 transition-transform ${
                      isPublicMatch ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </TouchableOpacity>
                <Text
                  className={`text-sm ml-3 ${isPublicMatch ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  Public
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              {isPublicMatch
                ? "Anyone can discover and join this match"
                : "Only invited players can see this match"}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Description (Optional)
            </Text>
            <TextInput
              className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-3 text-foreground"
              value={matchDescription}
              onChangeText={setMatchDescription}
              placeholder="Add details about the match..."
              placeholderTextColor="#888"
              multiline
              numberOfLines={2}
              maxLength={200}
            />
          </View>
        </View>
      )}

      {/* Location details */}
      <View className="bg-background/60 dark:bg-background/30 rounded-lg p-4">
        <Text className="text-base font-medium mb-3">Location Details</Text>

        <View className="mb-4">
          <Text className="text-sm font-medium mb-2 text-muted-foreground">
            Court {isPublicMatch && "*"}
          </Text>
          <TextInput
            className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
            value={court}
            onChangeText={setCourt}
            placeholder="Court name or number"
            placeholderTextColor="#888"
          />
        </View>

        <View>
          <Text className="text-sm font-medium mb-2 text-muted-foreground">
            Region/Location {isPublicMatch && "*"}
          </Text>
          <TextInput
            className="bg-background dark:bg-background/60 border border-border rounded-lg px-4 py-2 text-foreground"
            value={region}
            onChangeText={setRegion}
            placeholder="City, venue, or area"
            placeholderTextColor="#888"
          />
        </View>

        {isPublicMatch && (
          <Text className="text-xs text-muted-foreground mt-2">
            * Required for public matches
          </Text>
        )}
      </View>
    </View>
  );

  const renderScoreSection = () => {
    if (!isPastMatch) return null;

    return (
      <View className="mb-6 p-4 rounded-xl bg-card border border-border/30">
        <H3 className="mb-4">Match Score</H3>

        <SetScoreInput
          setNumber={1}
          value={set1Score}
          onChange={setSet1Score}
          onValidate={setIsSet1Valid}
          team1Ref={team1Set1Ref}
          team2Ref={team2Set1Ref}
          onTeam1Change={handleTeam1Set1Change}
          onTeam2Change={handleTeam2Set1Change}
        />

        <SetScoreInput
          setNumber={2}
          value={set2Score}
          onChange={setSet2Score}
          onValidate={setIsSet2Valid}
          team1Ref={team1Set2Ref}
          team2Ref={team2Set2Ref}
          onTeam1Change={handleTeam1Set2Change}
          onTeam2Change={handleTeam2Set2Change}
        />

        {showSet3 && (
          <SetScoreInput
            setNumber={3}
            value={set3Score}
            onChange={setSet3Score}
            onValidate={setIsSet3Valid}
            team1Ref={team1Set3Ref}
            team2Ref={team2Set3Ref}
            onTeam1Change={handleTeam1Set3Change}
          />
        )}

        {isSet1Valid && isSet2Valid && (
          <View className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary">
            <Text className="text-lg font-semibold">
              Winner: Team {determineWinnerTeam()}
            </Text>
            <Text className="text-muted-foreground">
              {determineWinnerTeam() === 1
                ? `${teamComposition.team1Players.map((p) => (p.isCurrentUser ? "You" : p.name)).join(" & ")} won this match`
                : `${teamComposition.team2Players.map((p) => p.name).join(" & ")} won this match`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ENHANCEMENT: Enhanced submit button state with validation awareness
  const getSubmitButtonState = () => {
    const validation = validateMatch();

    return {
      disabled: loading || !validation.isValid,
      text: loading
        ? isPastMatch
          ? "Recording Match..."
          : "Creating Match..."
        : isPastMatch
          ? "Record Match"
          : teamComposition.isComplete
            ? "Schedule Match"
            : "Create Match",
      subtitle:
        !validation.isValid && validation.errors.length > 0
          ? validation.errors[0]
          : isPastMatch && !loading && validation.isValid
            ? `${useQuickValidation ? "1-hour" : "24-hour"} validation period will begin`
            : null,
    };
  };

  const submitState = getSubmitButtonState();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a7ebd"
            colors={["#1a7ebd"]}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center pt-4 pb-2">
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-background dark:bg-card"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1a7ebd" />
          </TouchableOpacity>
          <H1>{isPastMatch ? "Record Match" : "Schedule Match"}</H1>
        </View>

        {/* ENHANCEMENT: Updated description with validation context */}
        <Text className="text-muted-foreground mb-6 ml-1">
          {isPastMatch
            ? `Record completed match`
            : "Create future match for you and your friends"}
        </Text>

        {/* ENHANCEMENT: Add ValidationInfoCard for past matches */}
        <ValidationInfoCard
          isPastMatch={isPastMatch}
          isDemo={useQuickValidation}
        />

        {renderTimeSection()}
        {renderPlayerSection()}
        {renderScoreSection()}

        {/* ENHANCEMENT: Enhanced submit section */}
        <View className="mt-2 mb-10">
          <Button
            className="w-full"
            size="lg"
            variant="default"
            onPress={createMatch}
            disabled={submitState.disabled}
            style={{
              shadowColor: submitState.disabled ? "transparent" : "#1a7ebd",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: submitState.disabled ? 0 : 0.3,
              shadowRadius: 8,
              elevation: submitState.disabled ? 0 : 6,
            }}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator
                  size="small"
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text className="text-primary-foreground font-medium">
                  {submitState.text}
                </Text>
              </View>
            ) : (
              <Text className="text-primary-foreground font-medium">
                {submitState.text}
              </Text>
            )}
          </Button>

          {submitState.subtitle && (
            <Text
              className={`text-sm mt-2 text-center ${
                submitState.disabled &&
                submitState.subtitle.includes("validation")
                  ? "text-muted-foreground"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {submitState.subtitle}
            </Text>
          )}
        </View>
      </ScrollView>

      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={setSelectedFriends}
        loading={loading}
        maxSelections={isPastMatch ? 3 : 3}
      />
    </SafeAreaView>
  );
}
