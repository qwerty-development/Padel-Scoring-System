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
  Dimensions,
  Keyboard,
  FlatList,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { Friend } from "@/types";

import { PlayerSelectionModal } from "@/components/create-match/PlayerSelectionModal";
import { CustomDateTimePicker } from "@/components/create-match/DateTimePicker";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import {
  SetScoreInput,
  SetScore,
} from "@/components/create-match/SetScoreInput";

// NOTIFICATION INTEGRATION: Import notification helpers
import { NotificationHelpers } from "@/services/notificationHelpers";

// --- Add import for feature flags ---
import { FEATURE_FLAGS } from "@/constants/features";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ENHANCEMENT: Add validation status enum
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

// PREDEFINED COURTS DATA
const PREDEFINED_COURTS = [
  // Dubai Courts
  {
    id: "dub-001",
    name: "The Padel Lab",
    region: "Dubai",
    area: "Al Quoz",
    type: "indoor",
  },
  {
    id: "dub-002",
    name: "Just Padel",
    region: "Dubai",
    area: "Business Bay",
    type: "indoor",
  },
  {
    id: "dub-003",
    name: "Padel Pro Dubai",
    region: "Dubai",
    area: "Dubai Sports City",
    type: "outdoor",
  },
  {
    id: "dub-004",
    name: "The Smash Room",
    region: "Dubai",
    area: "JLT",
    type: "indoor",
  },
  {
    id: "dub-005",
    name: "ISD Sports City",
    region: "Dubai",
    area: "Dubai Sports City",
    type: "outdoor",
  },
  {
    id: "dub-006",
    name: "Real Padel Club",
    region: "Dubai",
    area: "Al Barsha",
    type: "indoor",
  },
  {
    id: "dub-007",
    name: "Dubai Padel Academy",
    region: "Dubai",
    area: "Al Khawaneej",
    type: "outdoor",
  },
  {
    id: "dub-008",
    name: "Reform Athletica",
    region: "Dubai",
    area: "Dubai Design District",
    type: "indoor",
  },

  // Abu Dhabi Courts
  {
    id: "ad-001",
    name: "Zayed Sports City",
    region: "Abu Dhabi",
    area: "Zayed City",
    type: "outdoor",
  },
  {
    id: "ad-002",
    name: "Al Forsan Padel",
    region: "Abu Dhabi",
    area: "Khalifa City",
    type: "outdoor",
  },
  {
    id: "ad-003",
    name: "NYU Abu Dhabi",
    region: "Abu Dhabi",
    area: "Saadiyat Island",
    type: "indoor",
  },
  {
    id: "ad-004",
    name: "Yas Marina Circuit",
    region: "Abu Dhabi",
    area: "Yas Island",
    type: "outdoor",
  },

  // Sharjah Courts
  {
    id: "shj-001",
    name: "Sharjah Golf & Shooting Club",
    region: "Sharjah",
    area: "Al Dhaid",
    type: "outdoor",
  },
  {
    id: "shj-002",
    name: "Al Jazeera Cultural Club",
    region: "Sharjah",
    area: "Al Majaz",
    type: "indoor",
  },

  // Ajman Courts
  {
    id: "ajm-001",
    name: "Ajman Club",
    region: "Ajman",
    area: "Al Jurf",
    type: "outdoor",
  },

  // Generic Courts (for other areas)
  {
    id: "gen-001",
    name: "Community Court 1",
    region: "Other",
    area: "Community Center",
    type: "outdoor",
  },
  {
    id: "gen-002",
    name: "Community Court 2",
    region: "Other",
    area: "Community Center",
    type: "outdoor",
  },
  {
    id: "gen-003",
    name: "Sports Complex A",
    region: "Other",
    area: "Sports District",
    type: "indoor",
  },
  {
    id: "gen-004",
    name: "Sports Complex B",
    region: "Other",
    area: "Sports District",
    type: "indoor",
  },
];

interface Court {
  id: string;
  name: string;
  region: string;
  area: string;
  type: "indoor" | "outdoor";
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  glicko_rating: string | null;
  glicko_rd: string | null;
  glicko_vol: string | null;
  avatar_url?: string | null;
  friends_list?: string[];
}

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
  updated_by?: string;
  validation_deadline?: string;
  validation_status?: string;
  rating_applied?: boolean;
  report_count?: number;
  creator_confirmed?: boolean;
}

// WIZARD STEP CONFIGURATION
enum WizardStep {
  LOCATION_SETTINGS = 1,
  MATCH_TYPE_TIME = 2,
  PLAYER_SELECTION = 3,
  SCORE_ENTRY = 4,
  REVIEW_SUBMIT = 5,
}

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: string;
  canSkip?: boolean;
  isOptional?: boolean;
}

/**
 * COURT SELECTION MODAL COMPONENT
 */
interface CourtSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCourt: (court: Court) => void;
  selectedCourt: Court | null;
}

const CourtSelectionModal: React.FC<CourtSelectionModalProps> = ({
  visible,
  onClose,
  onSelectCourt,
  selectedCourt,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regions = useMemo(() => {
    const uniqueRegions = new Set(
      PREDEFINED_COURTS.map((court) => court.region),
    );
    return Array.from(uniqueRegions).sort();
  }, []);

  const filteredCourts = useMemo(() => {
    let courts = PREDEFINED_COURTS;

    if (selectedRegion) {
      courts = courts.filter((court) => court.region === selectedRegion);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      courts = courts.filter(
        (court) =>
          court.name.toLowerCase().includes(query) ||
          court.area.toLowerCase().includes(query) ||
          court.region.toLowerCase().includes(query),
      );
    }

    return courts;
  }, [searchQuery, selectedRegion]);

  const renderCourtItem = ({ item }: { item: Court }) => {
    const isSelected = selectedCourt?.id === item.id;

    return (
      <TouchableOpacity
        className={`p-4 mb-2 rounded-xl border ${
          isSelected
            ? "bg-primary/10 border-primary"
            : "bg-card border-border/30"
        }`}
        onPress={() => {
          onSelectCourt(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text
                className={`font-semibold ${isSelected ? "text-primary" : ""}`}
              >
                {item.name}
              </Text>
              {item.type === "indoor" ? (
                <View className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                  <Text className="text-xs text-blue-700 dark:text-blue-300">
                    Indoor
                  </Text>
                </View>
              ) : (
                <View className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
                  <Text className="text-xs text-green-700 dark:text-green-300">
                    Outdoor
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-muted-foreground">
              {item.area} • {item.region}
            </Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#2148ce" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-background mt-20 rounded-t-3xl">
          {/* Header */}
          <View className="p-6 border-b border-border">
            <View className="flex-row items-center justify-between mb-4">
              <H2>Select Court</H2>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="flex-row items-center bg-muted/30 rounded-xl px-4 py-3">
              <Ionicons
                name="search"
                size={20}
                color="#666"
                style={{ marginRight: 8 }}
              />
              <TextInput
                className="flex-1 text-foreground"
                placeholder="Search courts..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Courts List */}
          <FlatList
            data={filteredCourts}
            keyExtractor={(item) => item.id}
            renderItem={renderCourtItem}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-12">
                <Ionicons name="search" size={48} color="#666" />
                <Text className="text-muted-foreground mt-2">
                  No courts found
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

/**
 * ENHANCEMENT: Validation Info Card Component
 */
interface ValidationInfoCardProps {
  isPastMatch: boolean;
  isDemo?: boolean;
}

const ValidationInfoCard: React.FC<ValidationInfoCardProps> = ({
  isPastMatch,
  isDemo = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [expanded, animatedHeight]);

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
  onPress?: () => void;
}

function MatchPlayerAvatar({
  player,
  team = 1,
  size = "md",
  showBorder = false,
  showTeamIndicator = false,
  isPlaceholder = false,
  showShadow = true,
  onPress,
}: MatchPlayerAvatarProps) {
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

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

  const getTeamStyling = () => {
    const baseStyles = {
      1: {
        bgColor: "bg-primary",
        bgColorFallback: "bg-primary/80",
        borderColor: "#2148ce",
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

  const extractPlayerInitial = (): string => {
    if (isPlaceholder) return "?";
    if (!player) return "?";

    if (player.full_name?.trim()) {
      const sanitizedName = player.full_name.trim();
      if (sanitizedName.length > 0) {
        return sanitizedName.charAt(0).toUpperCase();
      }
    }

    if (player.email?.trim()) {
      const sanitizedEmail = player.email.trim();
      if (sanitizedEmail.length > 0) {
        return sanitizedEmail.charAt(0).toUpperCase();
      }
    }

    return "?";
  };

  const shouldDisplayAvatarImage = (): boolean => {
    if (isPlaceholder || !player?.avatar_url) return false;

    const trimmedUrl = player.avatar_url.trim();
    return Boolean(trimmedUrl && trimmedUrl.length > 0 && !imageLoadError);
  };

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

  // Wrap in TouchableOpacity if onPress is provided
  const AvatarContainer = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  if (isPlaceholder) {
    return (
      <View className="relative">
        <AvatarContainer
          {...containerProps}
          className={`${sizeConfig.containerClass} rounded-full border-2 border-dashed items-center justify-center ${
            team === 1 ? "border-primary/40" : "border-indigo-500/40"
          } ${onPress ? "bg-gray-50 dark:bg-gray-800" : ""}`}
          style={getContainerStyle()}
        >
          <Ionicons
            name={onPress ? "add" : "help-outline"}
            size={size === "md" ? 20 : 16}
            color={team === 1 ? "#2148ce" : "#6366f1"}
          />
        </AvatarContainer>

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

  if (shouldDisplayAvatarImage()) {
    return (
      <View className="relative">
        <AvatarContainer
          {...containerProps}
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

          {imageLoading && (
            <View
              className={`absolute inset-0 ${teamStyle.bgColorFallback} items-center justify-center`}
            >
              <Text className={`${sizeConfig.textClass} font-bold text-white`}>
                {extractPlayerInitial()}
              </Text>

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
        </AvatarContainer>

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

        {player?.isCurrentUser && (
          <View className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-green-500 items-center justify-center border-2 border-white dark:border-gray-800">
            <Ionicons name="person" size={8} color="white" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="relative">
      <AvatarContainer
        {...containerProps}
        className={`${sizeConfig.containerClass} rounded-full ${teamStyle.bgColor} items-center justify-center`}
        style={getContainerStyle()}
      >
        <Text className={`${sizeConfig.textClass} font-bold text-white`}>
          {extractPlayerInitial()}
        </Text>
      </AvatarContainer>

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
  onRemove?: () => void;
  onSwapTeam?: () => void;
}

function TeamPlayerRow({
  player,
  team,
  showRating = false,
  onRemove,
  onSwapTeam,
}: TeamPlayerRowProps) {
  return (
    <View className="flex-row items-center mb-2 p-2 rounded-lg bg-white/40 dark:bg-white/5 relative">
      {/* Remove button - only for non-current users */}
      {!player.isCurrentUser && onRemove && (
        <TouchableOpacity
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center z-10"
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={12} color="white" />
        </TouchableOpacity>
      )}

      {/* Swap button - only for non-current users */}
      {!player.isCurrentUser && onSwapTeam && (
        <TouchableOpacity
          className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 rounded-full items-center justify-center z-10"
          onPress={onSwapTeam}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal" size={10} color="white" />
        </TouchableOpacity>
      )}

      <MatchPlayerAvatar
        player={{
          id: player.id,
          full_name: player.name,
          email: player.email || "",
          avatar_url: player.avatar_url,
          isCurrentUser: player.isCurrentUser,
        }}
        team={team}
        size="sm"
        showBorder={true}
        showShadow={true}
      />

      <View className="flex-1 ml-2">
        <Text className="font-medium text-xs" numberOfLines={1}>
          {player.isCurrentUser ? "You" : player.name}
        </Text>
        {showRating && player.glicko_rating && (
          <Text className="text-xs text-muted-foreground">
            {Math.round(Number(player.glicko_rating))}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * ENHANCED WIZARD PROGRESS INDICATOR WITH CLICKABLE STEPS
 */
interface ProgressIndicatorProps {
  currentStep: WizardStep;
  totalSteps: number;
  completedSteps: Set<WizardStep>;
  stepConfig: StepConfig[];
  onStepPress: (step: WizardStep) => void;
  canNavigateToStep: (step: WizardStep) => boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  completedSteps,
  stepConfig,
  onStepPress,
  canNavigateToStep,
}) => {
  const currentIndex = stepConfig.findIndex((step) => step.id === currentStep);

  return (
    <View className="dark:bg-gray-900/80 mb-3 dark:border-gray-700">
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="p-4 self-start"
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color="#2148ce" />
          <Text className="ml-2 text-primary font-medium">Back</Text>
        </View>
      </TouchableOpacity>

      {/* Step indicators */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center">
          {stepConfig.map((step, index) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = step.id === currentStep;
            const isPassed = index < currentIndex;
            const canNavigate = canNavigateToStep(step.id);

            return (
              <View key={step.id} className="flex-row items-center">
                {/* Step Circle */}
                <TouchableOpacity
                  className="items-center"
                  onPress={() => canNavigate && onStepPress(step.id)}
                  disabled={!canNavigate}
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-12 h-12 rounded-full border-2 items-center justify-center ${
                      isCompleted || isPassed
                        ? "bg-primary border-primary"
                        : isCurrent
                          ? "bg-gray-100 border-primary"
                          : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {isCompleted || isPassed ? (
                      <Ionicons name="checkmark" size={24} color="white" />
                    ) : (
                      <Ionicons
                        name={step.icon as any}
                        size={20}
                        color={isCurrent ? "#2148ce" : "#9ca3af"}
                      />
                    )}
                  </View>

                  {/* Step Label */}
                  <Text
                    className={`text-xs mt-1 text-center ${
                      isCurrent
                        ? "text-primary font-semibold"
                        : isCompleted || isPassed
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </Text>
                </TouchableOpacity>

                {/* Connector Line */}
                {index < stepConfig.length - 1 && (
                  <View
                    className={`w-8 h-0.5 mx-2 ${
                      isPassed || isCompleted
                        ? "bg-primary"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

/**
 * ENHANCED SLIDE TRANSITION CONTAINER WITH BETTER ANIMATIONS
 */
interface SlideContainerProps {
  children: React.ReactNode;
  isActive: boolean;
  direction?: "forward" | "backward";
}

const SlideContainer: React.FC<SlideContainerProps> = ({
  children,
  isActive,
  direction = "forward",
}) => {
  const slideAnimation = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const fadeAnimation = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isActive, slideAnimation, fadeAnimation]);

  if (!isActive && slideAnimation._value === 0) return null;

  return (
    <Animated.View
      pointerEvents={isActive ? "auto" : "none"}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        opacity: fadeAnimation,
        transform: [
          {
            translateX: slideAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [direction === "forward" ? 50 : -50, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

export default function CreateMatchWizard() {
  // ========================================
  // CRITICAL: ALL HOOKS DECLARED FIRST
  // ========================================

  // 1. ROUTING HOOKS
  const { friendId } = useLocalSearchParams();
  const { profile, session } = useAuth();

  // 2. WIZARD STATE HOOKS
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    WizardStep.LOCATION_SETTINGS,
  );
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(
    new Set(),
  );
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward",
  );

  // 3. CORE STATE HOOKS
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : [],
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  // 4. IMPROVED DATE AND TIME STATE
  const getDefaultStartDateTime = () => {
    const now = new Date();
    // Default to 2 hours ago, rounded to nearest 15 minutes
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const minutes = twoHoursAgo.getMinutes();
    const roundedMinutes = Math.floor(minutes / 15) * 15;
    
    twoHoursAgo.setMinutes(roundedMinutes, 0, 0);
    return twoHoursAgo;
  };

  const getDefaultEndDateTime = (startDateTime: Date) => {
    // Default end time is start time + 90 minutes, but max 30 minutes before now
    const now = new Date();
    const maxEndTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 min before now
    const proposedEndTime = new Date(startDateTime.getTime() + 90 * 60 * 1000);
    
    return proposedEndTime <= maxEndTime ? proposedEndTime : maxEndTime;
  };

  const [startDateTime, setStartDateTime] = useState(getDefaultStartDateTime());
  const [endDateTime, setEndDateTime] = useState(
    getDefaultEndDateTime(getDefaultStartDateTime()),
  );
  const [endTimeManuallyChanged, setEndTimeManuallyChanged] = useState(false);

  // 5. MATCH SETTINGS STATE
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [matchDescription, setMatchDescription] = useState("");

  // 6. VALIDATION STATE
  const [useQuickValidation, setUseQuickValidation] = useState(false);

  // 7. REF HOOKS
  const team1Set1Ref = useRef<TextInput>(null);
  const team2Set1Ref = useRef<TextInput>(null);
  const team1Set2Ref = useRef<TextInput>(null);
  const team2Set2Ref = useRef<TextInput>(null);
  const team1Set3Ref = useRef<TextInput>(null);
  const team2Set3Ref = useRef<TextInput>(null);

  // 8. SCORE STATE
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [isSet1Valid, setIsSet1Valid] = useState(false);
  const [isSet2Valid, setIsSet2Valid] = useState(false);
  const [isSet3Valid, setIsSet3Valid] = useState(false);
  const [showSet3, setShowSet3] = useState(false);

  // 9. LOCATION STATE
  const [region, setRegion] = useState("");
  const [court, setCourt] = useState("");
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [showCourtModal, setShowCourtModal] = useState(false);

  // 10. COMPUTED VALUES WITH USEMEMO - FIXED VERSION
  const isPastMatch = useMemo(() => {
    const now = new Date();
    return startDateTime.getTime() <= now.getTime() + 15 * 60 * 1000;
  }, [startDateTime]);

  const isFutureMatch = useMemo(() => {
    const now = new Date();
    return startDateTime.getTime() > now.getTime() + 15 * 60 * 1000;
  }, [startDateTime]);

  const teamComposition = useMemo(() => {
    // Use selectedPlayers for consistent calculation
    const totalPlayers = 1 + selectedPlayers.length; // Current user + selected players
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

    const result = {
      totalPlayers,
      availableSlots,
      team1Players,
      team2Players,
      isComplete: totalPlayers === 4,
      isValidForPast: totalPlayers === 4,
      isValidForFuture: totalPlayers >= 1,
    };

    return result;
  }, [selectedPlayers, session?.user?.id, profile]);

  // 11. WIZARD CONFIGURATION
  const stepConfig: StepConfig[] = useMemo(() => {
    const baseSteps = [
      {
        id: WizardStep.LOCATION_SETTINGS,
        title: "Details",
        description: "Set location and time",
        icon: "information-circle-outline",
      },
      {
        id: WizardStep.PLAYER_SELECTION,
        title: "Players",
        description: "Select team members",
        icon: "people-outline",
      },
    ];

    if (isPastMatch) {
      baseSteps.push({
        id: WizardStep.SCORE_ENTRY,
        title: "Scores",
        description: "Enter match scores",
        icon: "trophy-outline",
      });
    }

    baseSteps.push({
      id: WizardStep.REVIEW_SUBMIT,
      title: "Review",
      description: "Review and submit",
      icon: "checkmark-outline",
    });

    return baseSteps;
  }, [isPastMatch]);

  const totalSteps = stepConfig.length;

  // 12. CALLBACK HOOKS
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

  // 13. PLAYER MANAGEMENT FUNCTIONS
  const removePlayer = useCallback((playerId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.id !== playerId));
    setSelectedFriends(prev => prev.filter(id => id !== playerId));
  }, []);

  const swapPlayerTeam = useCallback((playerId: string) => {
    setSelectedPlayers(prev => {
      const playerIndex = prev.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return prev;
      
      const newPlayers = [...prev];
      const player = newPlayers[playerIndex];
      
      // Remove player from current position
      newPlayers.splice(playerIndex, 1);
      
      // Find appropriate position on other team
      // Team 1 positions: 0 (after current user)
      // Team 2 positions: 1, 2
      if (playerIndex === 0) {
        // Player was on team 1, move to team 2 (position 1 or 2)
        const team2HasSpace = newPlayers.length < 3;
        if (team2HasSpace) {
          newPlayers.push(player);
        } else {
          // Team 2 is full, swap with first team 2 player
          newPlayers.splice(1, 0, player);
        }
      } else {
        // Player was on team 2, move to team 1 (position 0)
        newPlayers.unshift(player);
      }
      
      return newPlayers;
    });
  }, []);

  // 14. EFFECT HOOKS
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
    if (selectedFriends.length > 0 && friends.length > 0) {
      const selected = friends.filter((friend) =>
        selectedFriends.includes(friend.id),
      );
      setSelectedPlayers(selected);
    } else {
      setSelectedPlayers([]);
    }
  }, [selectedFriends, friends]);

  useEffect(() => {
    if (!endTimeManuallyChanged) {
      setEndDateTime(getDefaultEndDateTime(startDateTime));
    }
  }, [startDateTime, endTimeManuallyChanged]);

  useEffect(() => {
    if (isPastMatch && isPublicMatch) {
      setIsPublicMatch(false);
    }
  }, [isPastMatch, isPublicMatch]);

  useEffect(() => {
    if (selectedCourt) {
      setRegion(selectedCourt.region);
      setCourt(selectedCourt.name);
    }
  }, [selectedCourt]);

  // Handler functions for date/time updates
  const handleDateChange = (date: Date) => {
    const newStartDateTime = new Date(startDateTime);
    newStartDateTime.setFullYear(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    setStartDateTime(newStartDateTime);

    const newEndDateTime = new Date(endDateTime);
    if (
      newEndDateTime.getDate() !== date.getDate() ||
      newEndDateTime.getMonth() !== date.getMonth() ||
      newEndDateTime.getFullYear() !== date.getFullYear()
    ) {
      newEndDateTime.setFullYear(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      setEndDateTime(newEndDateTime);
    }
  };

  const handleStartTimeChange = (time: Date) => {
    const newStartDateTime = new Date(startDateTime);
    newStartDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
    setStartDateTime(newStartDateTime);

    if (endDateTime) {
      const dur = endDateTime.getTime() - startDateTime.getTime();
      const newEnd = new Date(newStartDateTime.getTime() + dur);
      setEndDateTime(newEnd);
    }
  };

  const handleEndTimeChange = (t: Date) => {
    const newEnd = new Date(startDateTime);
    newEnd.setHours(t.getHours(), t.getMinutes(), 0, 0);
    if (newEnd <= startDateTime) newEnd.setDate(newEnd.getDate() + 1);
    setEndDateTime(newEnd);
    setEndTimeManuallyChanged(true);
  };


  const validateCurrentStep = useCallback((): {
    isValid: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];

    console.log(`🔍 Validating step: ${currentStep}, isPastMatch: ${isPastMatch}`);

    switch (currentStep) {
      case WizardStep.LOCATION_SETTINGS:
        // Only validate location settings
        if (isPublicMatch && !selectedCourt && !region.trim()) {
          errors.push("Public matches require a location to be specified");
        }
        break;

      case WizardStep.MATCH_TYPE_TIME:
        // Only validate date/time logic
        const now = new Date();
        
        // Create properly normalized date objects for comparison
        const normalizedStart = new Date(startDateTime);
        const normalizedEnd = new Date(endDateTime);
        
        // Ensure same date for time comparison
        if (normalizedEnd.getDate() === normalizedStart.getDate()) {
          if (normalizedEnd.getTime() <= normalizedStart.getTime()) {
            errors.push("End time must be after start time");
          }
        }

        const matchDurationMs = normalizedEnd.getTime() - normalizedStart.getTime();
        const minDurationMs = 30 * 60 * 1000; // 30 minutes
        const maxDurationMs = 6 * 60 * 60 * 1000; // 6 hours

        if (matchDurationMs < minDurationMs) {
          errors.push("Match duration must be at least 30 minutes");
        }

        if (matchDurationMs > maxDurationMs) {
          errors.push("Match duration cannot exceed 6 hours");
        }

        // Past match validation
        if (isPastMatch) {
          const daysDiff = (now.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS) {
            errors.push(`Cannot record matches older than ${VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS} days`);
          }
        } else {
          // Future match validation
          const minFutureTime = now.getTime() + 15 * 60 * 1000; // 15 minutes from now
          if (normalizedStart.getTime() <= minFutureTime) {
            errors.push("Future matches must be scheduled at least 15 minutes from now");
          }

          const daysDiff = (normalizedStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > VALIDATION_CONFIG.MAX_FUTURE_DAYS) {
            errors.push(`Cannot schedule matches more than ${VALIDATION_CONFIG.MAX_FUTURE_DAYS} days in advance`);
          }
        }
        break;

      case WizardStep.PLAYER_SELECTION:
        // Only validate player selection
        console.log(`🔍 Player validation - selectedPlayers.length: ${selectedPlayers.length}, isPastMatch: ${isPastMatch}`);
        
        if (isPastMatch) {
          // Past matches require exactly 3 friends (4 total including user)
          if (selectedPlayers.length !== 3) {
            errors.push(`Past matches require exactly 4 players (you + 3 friends). Currently selected: ${selectedPlayers.length + 1}/4`);
          }
        } else {
          // Future matches require at least the user (can be 1-4 total)
          if (selectedPlayers.length > 3) {
            errors.push("Cannot select more than 3 additional players");
          }
          // No minimum requirement for future matches
        }
        break;

      case WizardStep.SCORE_ENTRY:
        // Only validate if this is a past match and we're in score entry
        if (isPastMatch) {
          console.log(`🔍 Score validation - set1Valid: ${isSet1Valid}, set2Valid: ${isSet2Valid}, showSet3: ${showSet3}, set3Valid: ${isSet3Valid}`);
          
          if (!isSet1Valid || !isSet2Valid) {
            errors.push("Please enter valid scores for both sets");
          }

          if (showSet3 && !isSet3Valid) {
            errors.push("Please enter a valid score for the third set");
          }
        }
        break;

      case WizardStep.REVIEW_SUBMIT:
        // Final validation - but this should be caught by previous steps
        // We can do a final sanity check here but shouldn't repeat all validations
        if (isPastMatch && (!isSet1Valid || !isSet2Valid)) {
          errors.push("Score validation incomplete");
        }
        if (isPastMatch && selectedPlayers.length !== 3) {
          errors.push("Player selection incomplete");
        }
        break;
    }

    console.log(`🔍 Validation result for step ${currentStep}:`, { isValid: errors.length === 0, errors });
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [
    currentStep,
    startDateTime,
    endDateTime,
    isPastMatch,
    selectedPlayers.length,
    isPublicMatch,
    selectedCourt,
    region,
    isSet1Valid,
    isSet2Valid,
    showSet3,
    isSet3Valid,
  ]);

  // ========================================
  // ENHANCED WIZARD NAVIGATION FUNCTIONS
  // ========================================

  const goToNextStep = useCallback(() => {
    const currentIndex = stepConfig.findIndex(
      (step) => step.id === currentStep,
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < stepConfig.length) {
      // Validate current step before proceeding
      const validation = validateCurrentStep();
      if (!validation.isValid) {
        Alert.alert("Validation Error", validation.errors.join("\n"), [
          { text: "OK" },
        ]);
        return;
      }

      setSlideDirection("forward");
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
      setCurrentStep(stepConfig[nextIndex].id);

      // Add haptic feedback
      Vibration.vibrate(50);
    }
  }, [currentStep, stepConfig, validateCurrentStep]);

  const goToPreviousStep = useCallback(() => {
    const currentIndex = stepConfig.findIndex(
      (step) => step.id === currentStep,
    );
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      setSlideDirection("backward");
      setCurrentStep(stepConfig[prevIndex].id);

      // Add haptic feedback
      Vibration.vibrate(50);
    }
  }, [currentStep, stepConfig]);

  // NEW: Enhanced step navigation with validation
  const goToStep = useCallback(
    (targetStep: WizardStep) => {
      const currentIndex = stepConfig.findIndex(
        (step) => step.id === currentStep,
      );
      const targetIndex = stepConfig.findIndex(
        (step) => step.id === targetStep,
      );

      if (targetIndex === -1) return;

      // If going forward, validate current step
      if (targetIndex > currentIndex) {
        const validation = validateCurrentStep();
        if (!validation.isValid) {
          Alert.alert(
            "Cannot Skip Steps",
            `Please complete "${stepConfig[currentIndex].title}" first.\n\n${validation.errors.join("\n")}`,
            [{ text: "OK" }],
          );
          return;
        }

        // Mark current step as completed
        setCompletedSteps((prev) => new Set(prev).add(currentStep));
      }

      // Set direction based on navigation
      setSlideDirection(targetIndex > currentIndex ? "forward" : "backward");
      setCurrentStep(targetStep);

      // Add haptic feedback
      Vibration.vibrate(targetIndex > currentIndex ? [50, 50] : 50);
    },
    [currentStep, stepConfig, validateCurrentStep],
  );

  // NEW: Check if we can navigate to a specific step
  const canNavigateToStep = useCallback(
    (targetStep: WizardStep) => {
      const currentIndex = stepConfig.findIndex(
        (step) => step.id === currentStep,
      );
      const targetIndex = stepConfig.findIndex(
        (step) => step.id === targetStep,
      );

      if (targetIndex === -1) return false;

      // Can always go backward to completed steps
      if (targetIndex <= currentIndex) return true;

      // Can go forward only one step at a time (and only if current step is valid)
      if (targetIndex === currentIndex + 1) {
        const validation = validateCurrentStep();
        return validation.isValid;
      }

      // Cannot skip multiple steps forward
      return false;
    },
    [currentStep, stepConfig, validateCurrentStep],
  );

  // ========================================
  // BUSINESS LOGIC FUNCTIONS (SAME AS BEFORE)
  // ========================================

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
    } else if (!showSet3 && text.length === 1 && /^\d$/.test(text)) {
      Keyboard.dismiss();
    }
  };

  const handleTeam1Set3Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      team2Set3Ref.current?.focus();
    }
  };

  const handleTeam2Set3Change = (text: string) => {
    if (text.length === 1 && /^\d$/.test(text)) {
      Keyboard.dismiss();
    }
  };

  const handleBackspaceNavigation = useCallback((currentField: string) => {
    switch (currentField) {
      case "team2Set1":
        team1Set1Ref.current?.focus();
        break;
      case "team1Set2":
        team2Set1Ref.current?.focus();
        break;
      case "team2Set2":
        team1Set2Ref.current?.focus();
        break;
      case "team1Set3":
        team2Set2Ref.current?.focus();
        break;
      case "team2Set3":
        team1Set3Ref.current?.focus();
        break;
      default:
        break;
    }
  }, []);

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

  /**
   * FIXED: Final validation that only checks essential requirements
   */
  const validateFinalMatch = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Essential date/time validation
    if (endDateTime <= startDateTime) {
      errors.push("End time must be after start time");
    }

    // Essential player validation
    if (isPastMatch && selectedPlayers.length !== 3) {
      errors.push("Past matches require exactly 4 players total");
    }

    // Essential score validation for past matches
    if (isPastMatch) {
      if (!isSet1Valid || !isSet2Valid) {
        errors.push("Please enter valid scores for both sets");
      }
      if (showSet3 && !isSet3Valid) {
        errors.push("Please enter a valid score for the third set");
      }
    }

    // Public match location requirement
    if (isPublicMatch && !selectedCourt && !region.trim()) {
      errors.push("Public matches require a location");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const isFirstMatch = async (userId: string): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .or(`player1_id.eq.${userId},player2_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`);

      if (error) {
        console.error('Error checking first match:', error);
        return false;
      }
      return count === 0;
    } catch (error) {
      console.error('Error checking first match:', error);
      return false;
    }
  };

  const createMatch = async () => {
    try {
      // Prevent creation if disabled by feature flags
      if (
        (!FEATURE_FLAGS.FUTURE_MATCH_SCHEDULING_ENABLED && isFutureMatch) ||
        (!FEATURE_FLAGS.PUBLIC_MATCHES_ENABLED && isPublicMatch)
      ) {
        Alert.alert(
          "Feature Unavailable",
          !FEATURE_FLAGS.FUTURE_MATCH_SCHEDULING_ENABLED && isFutureMatch
            ? "Scheduling matches in the future is currently disabled."
            : "Creating public matches is currently disabled."
        );
        return;
      }

      const validation = validateFinalMatch();

      if (!validation.isValid) {
        Alert.alert("Validation Error", validation.errors.join("\n"), [
          { text: "OK" },
        ]);
        return;
      }

      setLoading(true);

      if (isPastMatch) {
        const winnerTeam = determineWinnerTeam();

        // Use selectedPlayers to get player IDs
        const playerIds = [session?.user?.id];
        selectedPlayers.forEach((player) => {
          playerIds.push(player.id);
        });
        
        const filteredPlayerIds = playerIds.filter((id) => id != null) as string[];
        
        if (filteredPlayerIds.length !== 4) {
          throw new Error("Could not form a team of 4 players");
        }

        const now = new Date();
        const validationHours = useQuickValidation
          ? VALIDATION_CONFIG.QUICK_VALIDATION_HOURS
          : VALIDATION_CONFIG.DISPUTE_WINDOW_HOURS;
        const validationDeadline = new Date(
          now.getTime() + validationHours * 60 * 60 * 1000,
        );

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
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          region: region.trim() || null,
          court: court.trim() || null,
          is_public: false,
          description: matchDescription.trim() || null,
          rating_applied: false,
        };

        let matchResult;
        try {
          const { data: insertResult, error: matchError } = await supabase
            .from("matches")
            .insert(matchData)
            .select()
            .single();

          if (matchError) {
            console.error("Database insert error:", matchError);
            throw new Error(`Database error: ${matchError.message}`);
          }

          matchResult = insertResult;
        } catch (dbError) {
          console.error("Failed to insert match:", dbError);
          throw dbError;
        }

        try {
          await NotificationHelpers.sendMatchConfirmationNotifications(
            filteredPlayerIds,
            matchResult.id,
            session!.user.id,
          );
        } catch (notificationError) {
          console.warn("Failed to send notifications:", notificationError);
        }

        const validationHoursDisplay = useQuickValidation
          ? "1 hour"
          : "24 hours";

        const firstMatch = await isFirstMatch(session!.user.id);
        
        Alert.alert(
          "✅ Match Created Successfully!",
          `Match has been recorded with automatic validation system.\n\n` +
            `⏰ Validation Period: ${validationHoursDisplay}\n\n` +
            `🤖 Rating Processing: Automated server processing\n` +
            `📊 Ratings will be calculated and applied automatically after validation period expires.\n\n` +
            `📢 All players can report issues during validation period.\n` +
            `💡 You can delete this match within 24 hours if needed.` +
            (firstMatch ? `\n\n🎉 Congratulations on creating your first match!\n🎯 Server automation will handle rating calculations every 30 minutes.` : ''),
          [
            {
              text: "View Match Details",
              onPress: () =>
                router.replace({
                  pathname: "/(protected)/(screens)/match-details",
                  params: { matchId: matchResult.id },
                }),
            },
            {
              text: "OK",
              onPress: () => router.replace("/(protected)/(tabs)"),
            },
          ],
        );

        Vibration.vibrate([100, 50, 100]);
      } else {
        // Use selectedPlayers IDs for future matches
        const playerIds = selectedPlayers.map(p => p.id);
        
        const matchData: MatchData = {
          player1_id: session?.user?.id as string,
          player2_id: playerIds[0] || null,
          player3_id: playerIds[1] || null,
          player4_id: playerIds[2] || null,
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
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          region: region.trim() || null,
          court: court.trim() || null,
          is_public: isPublicMatch,
          description: matchDescription.trim() || null,
          updated_by: session?.user?.id as string,
        };

        let matchResult;
        try {
          const { data: insertResult, error: matchError } = await supabase
            .from("matches")
            .insert(matchData)
            .select()
            .single();

          if (matchError) {
            console.error("Database insert error:", matchError);
            throw new Error(`Database error: ${matchError.message}`);
          }

          matchResult = insertResult;
        } catch (dbError) {
          console.error("Failed to insert future match:", dbError);
          throw dbError;
        }

        try {
          if (profile?.full_name && session?.user?.id) {
            const allPlayerIds = [session.user.id, ...playerIds].filter(
              Boolean,
            ) as string[];

            await NotificationHelpers.sendMatchInvitationNotifications(
              allPlayerIds,
              session.user.id,
              profile.full_name,
              matchResult.id,
              matchData.start_time,
            );

            await NotificationHelpers.scheduleMatchReminder(
              allPlayerIds,
              matchResult.id,
              matchData.start_time,
            );
          }
        } catch (notificationError) {
          console.warn("Failed to send notifications:", notificationError);
        }

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

      let errorMessage = "Failed to create match";

      if (error instanceof Error) {
        errorMessage = `Failed to create match: ${error.message}`;
      }

      Alert.alert("Error", errorMessage, [{ text: "OK" }]);
      Vibration.vibrate(300);
    } finally {
      setLoading(false);
    }
  };

  const { width: screenWidth } = Dimensions.get("window");
  const CARD_WIDTH = 80;
  const CARD_HEIGHT = 100;
  const CARD_SPACING = 16;

  type Props = {
    selectedDate: Date;
    onDateSelect: (d: Date) => void;
    onCalendarPress: () => void;
    pastDays?: number;
    futureDays?: number;
  };

  const SwipeableDateCards = ({
    selectedDate,
    onDateSelect,
    onCalendarPress,
    pastDays = 3,
    futureDays = 10,
  }: Props) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const [dates, setDates] = useState<Date[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number>(pastDays);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
      const today = new Date();
      const generated: Date[] = [];

      for (let i = pastDays; i > 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        generated.push(d);
      }
      generated.push(new Date(today));
      for (let i = 1; i <= futureDays; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        generated.push(d);
      }

      setDates(generated);

      if (selectedDate) {
        const idx = generated.findIndex(
          (d) => d.toDateString() === selectedDate.toDateString(),
        );
        if (idx >= 0 && idx !== selectedIndex) {
          setSelectedIndex(idx);
        }
      }

      if (!isInitialized) {
        const targetIndex = selectedDate
          ? generated.findIndex(
              (d) => d.toDateString() === selectedDate.toDateString(),
            )
          : pastDays;

        const finalIndex = targetIndex >= 0 ? targetIndex : pastDays;

        if (!selectedDate) {
          onDateSelect(generated[pastDays]);
        }

        requestAnimationFrame(() => {
          const offsetX = finalIndex * (CARD_WIDTH + CARD_SPACING);
          scrollViewRef.current?.scrollTo({
            x: Math.max(0, offsetX + 30),
            animated: false,
          });
          setIsInitialized(true);
        });
      }
    }, [pastDays, futureDays, selectedDate, isInitialized]);

    const handlePress = (d: Date, idx: number) => {
      setSelectedIndex(idx);
      onDateSelect(d);
    };

    const formatDate = (d: Date) => {
      const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      if (d.toDateString() === today.toDateString())
        return { main: "Today", sub: d.getDate().toString() };
      if (d.toDateString() === tomorrow.toDateString())
        return { main: "Tomorrow", sub: d.getDate().toString() };
      if (d.toDateString() === yesterday.toDateString())
        return { main: "Yesterday", sub: d.getDate().toString() };
      return { main: labels[d.getDay()], sub: d.getDate().toString() };
    };

    const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
    const isPast = (d: Date) => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      const c = new Date(d);
      c.setHours(0, 0, 0, 0);
      return c < t;
    };

    return (
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-semibold text-foreground">
            Select Date
          </Text>
          <TouchableOpacity onPress={onCalendarPress} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingHorizontal: (screenWidth - CARD_WIDTH) / 2,
          }}
        >
          {dates.map((d, idx) => {
            const selected = idx === selectedIndex;
            const { main, sub } = formatDate(d);
            return (
              <TouchableOpacity
                key={`${d.getTime()}-${idx}`}
                onPress={() => handlePress(d, idx)}
                activeOpacity={0.8}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  marginRight: idx === dates.length - 1 ? 0 : CARD_SPACING,
                }}
                className={`
                rounded-xl border-2 justify-center items-center relative
                ${selected ? "bg-primary border-primary shadow-lg" : "bg-card border-border/30"}
                ${isToday(d) && !selected ? "border-primary/50" : ""}
              `}
              >
                <Text
                  className={`text-xs font-medium mb-1 ${
                    selected
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {main}
                </Text>
                <Text
                  className={`text-lg font-bold ${
                    selected ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {sub}
                </Text>

                {isPast(d) && !selected && (
                  <View className="absolute top-2 right-2">
                    <View className="w-2 h-2 bg-amber-500/60 rounded-full" />
                  </View>
                )}
                {isToday(d) && !selected && (
                  <View className="absolute bottom-2 left-1/2 -ml-1">
                    <View className="w-2 h-2 bg-primary rounded-full" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const CustomPastTimeSelector = ({
    label,
    value,
    onChange,
    isEndTime = false,
    startTime
  }: {
    label: string;
    value: Date;
    onChange: (date: Date) => void;
    isEndTime?: boolean;
    startTime?: Date;
  }) => {
    const [showPicker, setShowPicker] = useState(false);
    
    const getMaxTime = () => {
      const now = new Date();
      const selectedDate = new Date(value);
      const today = new Date();
      
      // If selected date is today, max time is 30 minutes ago
      if (selectedDate.toDateString() === today.toDateString()) {
        const maxTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
        return maxTime;
      }
      
      // If it's a past date, max time is end of day (23:59)
      const maxTime = new Date(selectedDate);
      maxTime.setHours(23, 59, 0, 0);
      return maxTime;
    };

    const getMinTime = () => {
      if (isEndTime && startTime) {
        // End time must be at least 30 minutes after start time
        return new Date(startTime.getTime() + 30 * 60 * 1000);
      }
      
      // For start time, use beginning of selected day
      const minTime = new Date(value);
      minTime.setHours(0, 0, 0, 0);
      return minTime;
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    const isTimeValid = (selectedTime: Date) => {
      const maxTime = getMaxTime();
      const minTime = getMinTime();
      
      return selectedTime >= minTime && selectedTime <= maxTime;
    };

    return (
      <View className="flex-1">
        <Text className="text-xs font-medium text-muted-foreground mb-1">{label}</Text>
        
        <TouchableOpacity
          className="bg-background dark:bg-background/60 border border-border rounded-lg px-3 py-3 flex-row items-center justify-between"
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center flex-1">
            <Ionicons name="time-outline" size={16} color="#2148ce" />
            <Text className="ml-2 text-foreground font-medium">
              {formatTime(value)}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        <DateTimePickerModal
          isVisible={showPicker}
          mode="time"
          date={value}
          maximumDate={getMaxTime()}
          minimumDate={getMinTime()}
          onConfirm={(selectedTime) => {
            if (isTimeValid(selectedTime)) {
              onChange(selectedTime);
            } else {
              Alert.alert(
                "Invalid Time",
                `Please select a time between ${formatTime(getMinTime())} and ${formatTime(getMaxTime())}`
              );
            }
            setShowPicker(false);
          }}
          onCancel={() => setShowPicker(false)}
        />
        

      </View>
    );
  };

  // ========================================
  // RENDER STEP FUNCTIONS (SAME AS BEFORE BUT USING SlideContainer)
  // ========================================

  const renderStep1MatchTypeTime = () => {
    const [isCalendarVisible, setCalendarVisible] = useState(false);

    const handleDateCardSelect = (d: Date) => {
      const current = new Date(startDateTime);
      const newDT = new Date(d);
      newDT.setHours(
        current.getHours(),
        current.getMinutes(),
        current.getSeconds(),
        0,
      );
      handleDateChange(newDT);
    };

    const handleStartTimeChange = (t: Date) => {
      const newStartDateTime = new Date(startDateTime);
      newStartDateTime.setHours(t.getHours(), t.getMinutes(), 0, 0);
      setStartDateTime(newStartDateTime);

      if (endDateTime) {
        const dur = endDateTime.getTime() - startDateTime.getTime();
        const newEnd = new Date(newStartDateTime.getTime() + dur);
        setEndDateTime(newEnd);
      }
    };

    const handleEndTimeChange = (t: Date) => {
      const newEnd = new Date(startDateTime);
      newEnd.setHours(t.getHours(), t.getMinutes(), 0, 0);
      if (newEnd <= startDateTime) newEnd.setDate(newEnd.getDate() + 1);
      setEndDateTime(newEnd);
    };

    const formatDisplayDate = (date: Date) => {
      return date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatDisplayTime = (date: Date) => {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    return (
      <SlideContainer
        isActive={currentStep === WizardStep.MATCH_TYPE_TIME}
        direction={slideDirection}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
            <View className="mb-6 mt-6">
              <H2 className="mb-2">Match Date & Time</H2>
              <Text className="text-muted-foreground mb-6">
                Select when your match will take place
              </Text>

              <View className="bg-card rounded-xl p-6 border border-border/30 shadow-sm">
                <SwipeableDateCards
                  selectedDate={startDateTime}
                  onDateSelect={handleDateCardSelect}
                  onCalendarPress={() => setCalendarVisible(true)}
                  pastDays={VALIDATION_CONFIG?.MIN_MATCH_AGE_DAYS || 3}
                  futureDays={0}
                />

                <DateTimePickerModal
                  isVisible={isCalendarVisible}
                  mode="datetime"
                  date={startDateTime}
                  onConfirm={(d) => {
                    handleDateCardSelect(d);
                    setCalendarVisible(false);
                  }}
                  onCancel={() => setCalendarVisible(false)}
                />

                <View className="mb-6">
                  <Text className="text-lg font-semibold text-foreground mb-4">
                    Select Times
                  </Text>
                  
                  {/* Enhanced time selection with better visual hierarchy */}
                  <View className="bg-white/90 dark:bg-white/5 rounded-2xl p-5 border border-white/20 shadow-lg">
                    <View className="flex-row gap-4 mb-4">
                      <CustomPastTimeSelector
                        label="Match Started"
                        value={startDateTime}
                        onChange={handleStartTimeChange}
                      />
                      <CustomPastTimeSelector
                        label="Match Ended"
                        value={endDateTime}
                        onChange={handleEndTimeChange}
                        isEndTime={true}
                        startTime={startDateTime}
                      />
                    </View>
                    
                                         {/* Duration indicator */}
                     <View className="flex-row items-center justify-center p-2 bg-primary/10 rounded-lg">
                       <Ionicons name="stopwatch-outline" size={14} color="#2148ce" />
                       <Text className="ml-1 text-xs font-medium text-primary">
                         {Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000)} minutes
                       </Text>
                     </View>
                  </View>
                </View>

                <View className="mb-6 p-4 bg-muted/20 rounded-lg border border-border/10">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                    <Text className="ml-2 text-lg font-semibold text-foreground">
                      Match Summary
                    </Text>
                  </View>

                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted-foreground">
                        Date:
                      </Text>
                      <Text className="text-sm font-medium text-foreground">
                        {formatDisplayDate(startDateTime)}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted-foreground">
                        Start Time:
                      </Text>
                      <Text className="text-sm font-medium text-foreground">
                        {formatDisplayTime(startDateTime)}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted-foreground">
                        End Time:
                      </Text>
                      <Text className="text-sm font-medium text-foreground">
                        {formatDisplayTime(endDateTime)}
                      </Text>
                    </View>

                    <View className="h-px bg-border/30 my-2" />

                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted-foreground">
                        Duration:
                      </Text>
                      <Text className="text-sm font-medium text-foreground">
                        {Math.round(
                          (endDateTime.getTime() - startDateTime.getTime()) /
                            60000,
                        )}{" "}
                        minutes
                      </Text>
                    </View>

                    {endDateTime.getDate() !== startDateTime.getDate() && (
                      <View className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border-l-2 border-amber-500">
                        <Text className="text-xs text-amber-700 dark:text-amber-300">
                          ⚠️ Match ends the next day
                        </Text>
                      </View>
                    )}
                  </View>
                </View>


              </View>

              {isPastMatch && (
                <View className="mt-6">
                  <ValidationInfoCard
                    isPastMatch={isPastMatch}
                    isDemo={useQuickValidation}
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SlideContainer>
    );
  };

  const renderStep2PlayerSelection = () => (
    <SlideContainer
      isActive={currentStep === WizardStep.PLAYER_SELECTION}
      direction={slideDirection}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2148ce"
            colors={["#2148ce"]}
          />
        }
      >
        <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
          <View className="mb-6 mt-6">
            <H2 className="mb-2">Team Composition</H2>
            <Text className="text-muted-foreground mb-6">
              {isPastMatch
                ? "Select all 4 players who participated in this match"
                : "Select players for your match (you can add more later)"}
            </Text>

            <View className="bg-card rounded-xl p-5 border border-border/30">
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-lg font-semibold">
                    Players Selected
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {teamComposition.totalPlayers}/4 players
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

              {/* Team visualization */}
              <View className="bg-white/80 dark:bg-white/10 rounded-2xl p-5 mb-6 border border-white/50">
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
                          onRemove={!player.isCurrentUser ? () => removePlayer(player.id) : undefined}
                          onSwapTeam={!player.isCurrentUser ? () => swapPlayerTeam(player.id) : undefined}
                        />
                      ))}

                      {Array(2 - teamComposition.team1Players.length)
                        .fill(0)
                        .map((_, i) => (
                          <TouchableOpacity
                            key={`team1-empty-${i}`}
                            className="flex-row items-center mb-2 p-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
                            onPress={() => setShowPlayerModal(true)}
                            activeOpacity={0.7}
                          >
                            <MatchPlayerAvatar
                              player={null}
                              team={1}
                              size="sm"
                              isPlaceholder={true}
                              onPress={() => setShowPlayerModal(true)}
                            />
                            <View className="flex-1 ml-2">
                              <Text className="text-xs text-primary/70 font-medium">
                                Tap to add
                              </Text>
                            </View>
                          </TouchableOpacity>
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
                        <Text className="font-bold text-indigo-600">
                          Team 2
                        </Text>
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
                          onRemove={!player.isCurrentUser ? () => removePlayer(player.id) : undefined}
                          onSwapTeam={!player.isCurrentUser ? () => swapPlayerTeam(player.id) : undefined}
                        />
                      ))}

                      {Array(2 - teamComposition.team2Players.length)
                        .fill(0)
                        .map((_, i) => (
                          <TouchableOpacity
                            key={`team2-empty-${i}`}
                            className="flex-row items-center mb-2 p-2 rounded-lg border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 active:bg-indigo-500/10"
                            onPress={() => setShowPlayerModal(true)}
                            activeOpacity={0.7}
                          >
                            <MatchPlayerAvatar
                              player={null}
                              team={2}
                              size="sm"
                              isPlaceholder={true}
                              onPress={() => setShowPlayerModal(true)}
                            />
                            <View className="flex-1 ml-2">
                              <Text className="text-xs text-indigo-500/70 font-medium">
                                Tap to add
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* Info card similar to Step 1's ValidationInfoCard */}
              <View className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary">
                <View className="flex-row items-center">
                  <Ionicons name="people-outline" size={20} color="#2148ce" />
                  <Text className="ml-2 font-medium text-primary">
                    Team Selection
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground mt-1">
                  {isPastMatch
                    ? "All 4 players must be selected for match validation."
                    : "Add players now or invite them later before match time."}
                </Text>
              </View>

              {/* Player management */}
              <View className="flex-row gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 py-3"
                  onPress={() => setShowPlayerModal(true)}
                  style={{
                    shadowColor: "#2148ce",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons name="people-outline" size={18} color="#2148ce" />
                    <Text className="ml-2 font-medium">
                      {selectedPlayers.length === 0
                        ? "Select Players"
                        : "Manage Team"}
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
            </View>
          </View>
        </View>
      </ScrollView>
    </SlideContainer>
  );

  const renderStep3LocationSettings = () => {
    const [isCalendarVisible, setCalendarVisible] = useState(false);

    const handleDateCardSelect = (d: Date) => {
      const current = new Date(startDateTime);
      const newDT = new Date(d);
      newDT.setHours(
        current.getHours(),
        current.getMinutes(),
        current.getSeconds(),
        0,
      );
      handleDateChange(newDT);
    };

    const handleStartTimeChange = (t: Date) => {
      const newStartDateTime = new Date(startDateTime);
      newStartDateTime.setHours(t.getHours(), t.getMinutes(), 0, 0);
      setStartDateTime(newStartDateTime);

      if (endDateTime) {
        const dur = endDateTime.getTime() - startDateTime.getTime();
        const newEnd = new Date(newStartDateTime.getTime() + dur);
        setEndDateTime(newEnd);
      }
    };

    const handleEndTimeChange = (t: Date) => {
      const newEnd = new Date(startDateTime);
      newEnd.setHours(t.getHours(), t.getMinutes(), 0, 0);
      if (newEnd <= startDateTime) newEnd.setDate(newEnd.getDate() + 1);
      setEndDateTime(newEnd);
    };

    return (
      <SlideContainer
        isActive={currentStep === WizardStep.LOCATION_SETTINGS}
        direction={slideDirection}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2148ce"
              colors={["#2148ce"]}
            />
          }
        >
          <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
            <View className="mb-6 mt-6">
              <H2 className="mb-2">Match Details</H2>
              <Text className="text-muted-foreground mb-6">
                When and where did you play this match?
              </Text>

              {/* Date & Time Section */}
              <View className="bg-card rounded-xl p-6 border border-border/30 shadow-sm mb-6">
                <SwipeableDateCards
                  selectedDate={startDateTime}
                  onDateSelect={handleDateCardSelect}
                  onCalendarPress={() => setCalendarVisible(true)}
                  pastDays={VALIDATION_CONFIG?.MIN_MATCH_AGE_DAYS || 3}
                  futureDays={0}
                />

                <DateTimePickerModal
                  isVisible={isCalendarVisible}
                  mode="datetime"
                  date={startDateTime}
                  onConfirm={(d) => {
                    handleDateCardSelect(d);
                    setCalendarVisible(false);
                  }}
                  onCancel={() => setCalendarVisible(false)}
                  maximumDate={new Date()}
                />

                <View className="mb-6">
                  <Text className="text-lg font-semibold text-foreground mb-4">
                    Select Times
                  </Text>
                  
                  {/* Enhanced time selection with better visual hierarchy */}
                  <View className="bg-white/90 dark:bg-white/5 rounded-2xl p-5 border border-white/20 shadow-lg">
                    <View className="flex-row gap-4 mb-4">
                      <CustomPastTimeSelector
                        label="Match Started"
                        value={startDateTime}
                        onChange={handleStartTimeChange}
                      />
                      <CustomPastTimeSelector
                        label="Match Ended"
                        value={endDateTime}
                        onChange={handleEndTimeChange}
                        isEndTime={true}
                        startTime={startDateTime}
                      />
                    </View>
                    
                    {/* Duration indicator */}
                    <View className="flex-row items-center justify-center p-2 bg-primary/10 rounded-lg">
                      <Ionicons name="stopwatch-outline" size={14} color="#2148ce" />
                      <Text className="ml-1 text-xs font-medium text-primary">
                        {Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000)} minutes
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

            <View className="bg-card rounded-xl p-5 border border-border/30">
              {/* Location details */}
              <View className="mb-6">
                <Text className="text-lg font-semibold mb-4">
                  Court Selection
                </Text>

                <TouchableOpacity
                  className="p-4 bg-background dark:bg-background/60 border border-border rounded-lg active:bg-muted/50"
                  onPress={() => setShowCourtModal(true)}
                  activeOpacity={0.8}
                >
                  {selectedCourt ? (
                    <View>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-medium">
                            {selectedCourt.name}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {selectedCourt.area} • {selectedCourt.region}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          {selectedCourt.type === "indoor" ? (
                            <View className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded mr-2">
                              <Text className="text-xs text-blue-700 dark:text-blue-300">
                                Indoor
                              </Text>
                            </View>
                          ) : (
                            <View className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded mr-2">
                              <Text className="text-xs text-green-700 dark:text-green-300">
                                Outdoor
                              </Text>
                            </View>
                          )}
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#666"
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-between">
                      <Text className="text-muted-foreground">
                        Select a court
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </View>
                  )}
                </TouchableOpacity>

                {isPublicMatch && !selectedCourt && (
                  <Text className="text-xs text-red-500 mt-1">
                    * Required for public matches
                  </Text>
                )}
              </View>

              {/* Match settings for future matches */}
              {!isPastMatch && (
                <View className="border-t border-border/30 pt-6">
                  <Text className="text-lg font-semibold mb-4">
                    Match Settings
                  </Text>

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
                      numberOfLines={3}
                      maxLength={200}
                      textAlignVertical="top"
                    />
                    <Text className="text-xs text-muted-foreground mt-1">
                      {matchDescription.length}/200 characters
                    </Text>
                  </View>
                </View>
              )}


            </View>
          </View>
        </View>
      </ScrollView>
    </SlideContainer>
    );
  };

  const renderStep4ScoreEntry = () => {
    if (!isPastMatch) return null;

    return (
      <SlideContainer
        isActive={currentStep === WizardStep.SCORE_ENTRY}
        direction={slideDirection}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2148ce"
              colors={["#2148ce"]}
            />
          }
        >
          <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
            <View className="mb-6 mt-6">
              <H2 className="mb-2">Match Scores</H2>
              <Text className="text-muted-foreground mb-6">
                Enter the scores for each set played
              </Text>

              <View className="bg-card rounded-xl p-5 border border-border/30">
                {/* Set 1 with auto-jump to Set 2 */}
                <SetScoreInput
                  setNumber={1}
                  value={set1Score}
                  onChange={setSet1Score}
                  onValidate={setIsSet1Valid}
                  team1Ref={team1Set1Ref}
                  team2Ref={team2Set1Ref}
                  onTeam1Change={handleTeam1Set1Change}
                  onTeam2Change={handleTeam2Set1Change}
                  onBackspace={handleBackspaceNavigation}
                  nextSetTeam1Ref={team1Set2Ref}
                  nextSetTeam2Ref={team2Set2Ref}
                  enableAutoJump={true}
                />

                {/* Set 2 with conditional auto-jump to Set 3 */}
                <SetScoreInput
                  setNumber={2}
                  value={set2Score}
                  onChange={setSet2Score}
                  onValidate={setIsSet2Valid}
                  team1Ref={team1Set2Ref}
                  team2Ref={team2Set2Ref}
                  onTeam1Change={handleTeam1Set2Change}
                  onTeam2Change={handleTeam2Set2Change}
                  onBackspace={handleBackspaceNavigation}
                  nextSetTeam1Ref={showSet3 ? team1Set3Ref : undefined}
                  nextSetTeam2Ref={showSet3 ? team2Set3Ref : undefined}
                  enableAutoJump={true}
                />

                {/* Set 3 (if shown) - no auto-jump after this */}
                {showSet3 && (
                  <SetScoreInput
                    setNumber={3}
                    value={set3Score}
                    onChange={setSet3Score}
                    onValidate={setIsSet3Valid}
                    team1Ref={team1Set3Ref}
                    team2Ref={team2Set3Ref}
                    onTeam1Change={handleTeam1Set3Change}
                    onTeam2Change={handleTeam2Set3Change}
                    onBackspace={handleBackspaceNavigation}
                    nextSetTeam1Ref={undefined}
                    nextSetTeam2Ref={undefined}
                    enableAutoJump={true}
                  />
                )}

                {isSet1Valid && isSet2Valid && (
                  <View className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary">
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
            </View>
          </View>
        </ScrollView>
      </SlideContainer>
    );
  };

  const renderStep5ReviewSubmit = () => (
    <SlideContainer
      isActive={currentStep === WizardStep.REVIEW_SUBMIT}
      direction={slideDirection}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2148ce"
            colors={["#2148ce"]}
          />
        }
      >
        <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
          <View className="mb-6 mt-6">
            <H2 className="mb-2">Review Match</H2>
            <Text className="text-muted-foreground mb-6">
              Review all details before{" "}
              {isPastMatch ? "recording" : "scheduling"} your match
            </Text>

            {/* Match Summary */}
            <View className="bg-card rounded-xl p-5 border border-border/30 mb-6">
              <H3 className="mb-4">Match Summary</H3>

              {/* Date & Time */}
              <View className="mb-4 p-4 bg-background/60 rounded-lg">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="calendar-outline" size={16} color="#2148ce" />
                  <Text className="ml-2 font-medium">Date & Time</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {startDateTime.toLocaleDateString()} •{" "}
                  {startDateTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {endDateTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  Duration:{" "}
                  {Math.round(
                    (endDateTime.getTime() - startDateTime.getTime()) /
                      (1000 * 60),
                  )}{" "}
                  minutes
                </Text>
                {endDateTime.getDate() !== startDateTime.getDate() && (
                  <Text className="text-xs text-muted-foreground mt-1">
                    Match ends the next day
                  </Text>
                )}
              </View>

              {/* Players */}
              <View className="mb-4 p-4 bg-background/60 rounded-lg">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="people-outline" size={16} color="#2148ce" />
                  <Text className="ml-2 font-medium">
                    Players ({teamComposition.totalPlayers}/4)
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-primary mb-1">
                      Team 1
                    </Text>
                    {teamComposition.team1Players.map((player, index) => (
                      <Text
                        key={player.id}
                        className="text-sm text-muted-foreground"
                      >
                        {player.isCurrentUser ? "You" : player.name}
                      </Text>
                    ))}
                    {Array(2 - teamComposition.team1Players.length)
                      .fill(0)
                      .map((_, i) => (
                        <Text
                          key={`t1-empty-${i}`}
                          className="text-sm text-muted-foreground/50 italic"
                        >
                          Open slot
                        </Text>
                      ))}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-indigo-600 mb-1">
                      Team 2
                    </Text>
                    {teamComposition.team2Players.map((player, index) => (
                      <Text
                        key={player.id}
                        className="text-sm text-muted-foreground"
                      >
                        {player.name}
                      </Text>
                    ))}
                    {Array(2 - teamComposition.team2Players.length)
                      .fill(0)
                      .map((_, i) => (
                        <Text
                          key={`t2-empty-${i}`}
                          className="text-sm text-muted-foreground/50 italic"
                        >
                          Open slot
                        </Text>
                      ))}
                  </View>
                </View>
              </View>

              {/* Location */}
              {selectedCourt && (
                <View className="mb-4 p-4 bg-background/60 rounded-lg">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color="#2148ce"
                    />
                    <Text className="ml-2 font-medium">Location</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {selectedCourt.name}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {selectedCourt.area} • {selectedCourt.region}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    {selectedCourt.type === "indoor" ? (
                      <View className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                        <Text className="text-xs text-blue-700 dark:text-blue-300">
                          Indoor
                        </Text>
                      </View>
                    ) : (
                      <View className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded">
                        <Text className="text-xs text-green-700 dark:text-green-300">
                          Outdoor
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Scores for past matches */}
              {isPastMatch && isSet1Valid && isSet2Valid && (
                <View className="mb-4 p-4 bg-background/60 rounded-lg">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="trophy-outline" size={16} color="#2148ce" />
                    <Text className="ml-2 font-medium">Match Result</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground mb-2">
                    Set 1: {set1Score.team1} - {set1Score.team2}
                  </Text>
                  <Text className="text-sm text-muted-foreground mb-2">
                    Set 2: {set2Score.team1} - {set2Score.team2}
                  </Text>
                  {showSet3 && (
                    <Text className="text-sm text-muted-foreground mb-2">
                      Set 3: {set3Score.team1} - {set3Score.team2}
                    </Text>
                  )}
                  <Text className="text-sm font-medium text-primary">
                    Winner: Team {determineWinnerTeam()}
                  </Text>
                </View>
              )}

              {/* Match Settings */}
              {!isPastMatch && (
                <View className="mb-4 p-4 bg-background/60 rounded-lg">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="settings-outline"
                      size={16}
                      color="#2148ce"
                    />
                    <Text className="ml-2 font-medium">Settings</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    Visibility: {isPublicMatch ? "Public" : "Private"}
                  </Text>
                  {matchDescription && (
                    <Text className="text-sm text-muted-foreground mt-1">
                      Description: {matchDescription}
                    </Text>
                  )}
                </View>
              )}

              {/* Validation Mode for past matches */}
              {isPastMatch && (
                <View className="p-4 bg-background/60 rounded-lg">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color="#2148ce"
                    />
                    <Text className="ml-2 font-medium">Validation Mode</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {useQuickValidation
                      ? "Demo Mode: 1-hour validation"
                      : "Standard: 24-hour validation"}
                  </Text>
                </View>
              )}
            </View>

            {/* Validation Warning for Past Matches */}
            {isPastMatch && (
              <View className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="time-outline" size={20} color="#d97706" />
                  <Text className="ml-2 font-semibold text-amber-800 dark:text-amber-200">
                    Validation Period Notice
                  </Text>
                </View>
                <Text className="text-sm text-amber-700 dark:text-amber-300">
                  After recording, all players will have{" "}
                  {useQuickValidation ? "1 hour" : "24 hours"} to dispute
                  scores. Ratings will only be applied after the validation
                  period expires.
                </Text>
              </View>
            )}

            {/* Action Summary */}
            <View className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <View className="flex-row items-center mb-2">
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#2148ce"
                />
                <Text className="ml-2 font-semibold text-primary">
                  What happens next?
                </Text>
              </View>
              {isPastMatch ? (
                <View className="space-y-1">
                  <Text className="text-sm text-primary/80">
                    • Match will be recorded immediately
                  </Text>
                  <Text className="text-sm text-primary/80">
                    • All players will be notified
                  </Text>
                  <Text className="text-sm text-primary/80">
                    • {useQuickValidation ? "1-hour" : "24-hour"} validation
                    period starts
                  </Text>
                  <Text className="text-sm text-primary/80">
                    • Ratings update after validation
                  </Text>
                </View>
              ) : (
                <View className="space-y-1">
                  <Text className="text-sm text-primary/80">
                    • Match will be scheduled
                  </Text>
                  {isPublicMatch && (
                    <Text className="text-sm text-primary/80">
                      • Visible to all players in the area
                    </Text>
                  )}
                  {!teamComposition.isComplete && (
                    <Text className="text-sm text-primary/80">
                      • Open for players to join
                    </Text>
                  )}
                  <Text className="text-sm text-primary/80">
                    • Players will receive notifications
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SlideContainer>
  );

  // ========================================
  // ENHANCED WIZARD NAVIGATION CONTROLS
  // ========================================

  const renderNavigationControls = () => {
    const currentStepValidation = validateCurrentStep();
    const canProceed = currentStepValidation.isValid;
    const currentIndex = stepConfig.findIndex(
      (step) => step.id === currentStep,
    );
    const isLastStep = currentIndex === stepConfig.length - 1;

    return (
      <View className="px-6 py-4 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <View className="flex-row gap-3">
          {/* Previous Button */}
          {currentIndex > 0 && (
            <Button
              variant="outline"
              className="flex-1"
              onPress={goToPreviousStep}
            >
              <View className="flex-row items-center">
                <Ionicons name="chevron-back" size={16} color="#2148ce" />
                <Text className="ml-1 font-medium">Previous</Text>
              </View>
            </Button>
          )}

          {/* Next/Submit Button */}
          {!isLastStep ? (
            <Button
              variant="default"
              className={`${currentIndex === 0 ? "flex-1" : "flex-[2]"}`}
              onPress={goToNextStep}
              disabled={!canProceed || loading}
            >
              <View className="flex-row items-center">
                <Text className="mr-1 font-bold text-white">
                  Next: {stepConfig[currentIndex + 1]?.title || "Continue"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </View>
            </Button>
          ) : (
            <Button
              variant="default"
              className="flex-[2]"
              onPress={createMatch}
              disabled={loading || !canProceed}
            >
              {loading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-primary-foreground font-medium">
                    {isPastMatch ? "Recording..." : "Scheduling..."}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Ionicons
                    name={isPastMatch ? "save" : "calendar"}
                    size={18}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-primary-foreground font-bold">
                    {isPastMatch ? "Record Match" : "Schedule Match"}
                  </Text>
                </View>
              )}
            </Button>
          )}
        </View>

        {/* Enhanced Validation Errors */}
        {!currentStepValidation.isValid &&
          currentStepValidation.errors.length > 0 && (
            <View className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <View className="flex-row items-start">
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color="#ef4444"
                  style={{ marginTop: 1 }}
                />
                <View className="flex-1 ml-3">
                  <Text className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
                    Please fix the following issues:
                  </Text>
                  {currentStepValidation.errors.map((error, index) => (
                    <Text
                      key={index}
                      className="text-sm text-red-600 dark:text-red-400"
                    >
                      • {error}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )}

        {/* Step Progress Info */}
        <View className="mt-3 flex-row items-center justify-center">
          <Text className="text-xs text-muted-foreground">
            Step {currentIndex + 1} of {stepConfig.length} •{" "}
            {Math.round(((currentIndex + 1) / stepConfig.length) * 100)}%
            Complete
          </Text>
        </View>
      </View>
    );
  };

  // ========================================
  // MAIN COMPONENT RETURN
  // ========================================

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Background Image covering header + top content */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 250,
          zIndex: 0,
        }}
      >
        <Image
          source={require("../../../assets/padelcourt.jpg")}
          style={{
            width: "100%",
            height: "100%",
          }}
          resizeMode="cover"
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          }}
        />
      </View>

      {/* Enhanced Header with Progress Indicator */}
      <View className="relative z-20">
        <ProgressIndicator
          currentStep={currentStep}
          totalSteps={totalSteps}
          completedSteps={completedSteps}
          stepConfig={stepConfig}
          onStepPress={goToStep}
          canNavigateToStep={canNavigateToStep}
        />
      </View>

      {/* Step Content Container */}
      <View className="flex-1 relative z-10">
        {renderStep1MatchTypeTime()}
        {renderStep2PlayerSelection()}
        {renderStep3LocationSettings()}
        {renderStep4ScoreEntry()}
        {renderStep5ReviewSubmit()}
      </View>

      {/* Modals */}
      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={setSelectedFriends}
        loading={loading}
        maxSelections={3}
        isPastMatch={isPastMatch} // ADD THIS LINE
      />

      <CourtSelectionModal
        visible={showCourtModal}
        onClose={() => setShowCourtModal(false)}
        onSelectCourt={setSelectedCourt}
        selectedCourt={selectedCourt}
      />

      {/* Enhanced Navigation Controls */}
      {renderNavigationControls()}
    </SafeAreaView>
  );
}
