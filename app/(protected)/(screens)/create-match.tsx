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
import {
  SetScoreInput,
  SetScore,
} from "@/components/create-match/SetScoreInput";

// NOTIFICATION INTEGRATION: Import notification helpers
import { NotificationHelpers } from '@/services/notificationHelpers';

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

// WIZARD STEP CONFIGURATION
enum WizardStep {
  MATCH_TYPE_TIME = 1,
  PLAYER_SELECTION = 2,
  LOCATION_SETTINGS = 3,
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
      PREDEFINED_COURTS.map((court) => court.region)
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
          court.region.toLowerCase().includes(query)
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

          {/* Region Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="border-b border-border"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <TouchableOpacity
              className={`px-4 py-2 rounded-full mr-2 ${
                !selectedRegion ? "bg-primary" : "bg-muted/30"
              }`}
              onPress={() => setSelectedRegion(null)}
            >
              <Text
                className={
                  !selectedRegion
                    ? "text-white font-medium"
                    : "text-muted-foreground"
                }
              >
                All Regions
              </Text>
            </TouchableOpacity>
            {regions.map((region) => (
              <TouchableOpacity
                key={region}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selectedRegion === region ? "bg-primary" : "bg-muted/30"
                }`}
                onPress={() => setSelectedRegion(region)}
              >
                <Text
                  className={
                    selectedRegion === region
                      ? "text-white font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {region}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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

/**
 * WIZARD PROGRESS INDICATOR COMPONENT
 */
interface ProgressIndicatorProps {
  currentStep: WizardStep;
  totalSteps: number;
  completedSteps: Set<WizardStep>;
  stepConfig: StepConfig[];
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  completedSteps,
  stepConfig,
}) => {
  const currentIndex =
    stepConfig.findIndex((step) => step.id === currentStep) + 1;

  return (
    <View className=" dark:bg-gray-900/80  dark:border-gray-700">
      {/* Step indicators */}
      <View className="flex-row">
        {stepConfig.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = step.id === currentStep;
          const currentIdx = stepConfig.findIndex((s) => s.id === currentStep);
          const isPassed = index < currentIdx;

          return (
            <View key={step.id} className="flex-row items-center">
              <View className="items-center">
                <View
                  className={`w-12 h-12 rounded-full border items-center justify-center ${
                    isCompleted || isPassed
                      ? "bg-primary border-primary"
                      : isCurrent
                        ? "bg-gray-100 border-primary"
                        : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isCompleted || isPassed ? (
                    <Ionicons
                      name="tennisball-outline"
                      size={24}
                      color="white"
                    />
                  ) : (
                    <Ionicons
                      name={step.icon as any}
                      size={24}
                      color={isCurrent ? "#2148ce" : "#9ca3af"}
                    />
                  )}
                </View>
              </View>

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
    </View>
  );
};

/**
 * SLIDE TRANSITION CONTAINER
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
  const slideAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: isActive ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isActive, slideAnimation]);

  if (!isActive) return null;

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: slideAnimation,
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
    WizardStep.MATCH_TYPE_TIME
  );
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(
    new Set()
  );
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward"
  );

  // 3. CORE STATE HOOKS
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : []
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  // 4. IMPROVED DATE AND TIME STATE
  // Store the complete start and end date/time
  const getDefaultStartDateTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 30) * 30;

    const startDateTime = new Date(now);
    if (roundedMinutes === 60) {
      startDateTime.setHours(startDateTime.getHours() + 1, 0, 0, 0);
    } else {
      startDateTime.setMinutes(roundedMinutes, 0, 0);
    }

    return startDateTime;
  };

  const getDefaultEndDateTime = (startDateTime: Date) => {
    const endDateTime = new Date(startDateTime);
    endDateTime.setTime(endDateTime.getTime() + 90 * 60 * 1000); // Add 90 minutes
    return endDateTime;
  };

  const [startDateTime, setStartDateTime] = useState(getDefaultStartDateTime());
  const [endDateTime, setEndDateTime] = useState(
    getDefaultEndDateTime(getDefaultStartDateTime())
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

  // 10. COMPUTED VALUES WITH USEMEMO
  const isPastMatch = useMemo(() => {
    const now = new Date();
    // Consider it a past match if it starts within 15 minutes from now
    return startDateTime.getTime() <= now.getTime() + 15 * 60 * 1000;
  }, [startDateTime]);

  const isFutureMatch = useMemo(() => {
    const now = new Date();
    // It's a future match if it's more than 15 minutes from now
    return startDateTime.getTime() > now.getTime() + 15 * 60 * 1000;
  }, [startDateTime]);

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

  // 11. WIZARD CONFIGURATION
  const stepConfig: StepConfig[] = useMemo(() => {
    const baseSteps = [
      {
        id: WizardStep.MATCH_TYPE_TIME,
        title: "Time",
        description: "Set match date and time",
        icon: "time-outline",
      },
      {
        id: WizardStep.PLAYER_SELECTION,
        title: "Players",
        description: "Select team members",
        icon: "people-outline",
      },
      {
        id: WizardStep.LOCATION_SETTINGS,
        title: "Location",
        description: "Set location and match settings",
        icon: "location-outline",
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
          "id, email, full_name, avatar_url, glicko_rating, preferred_hand, court_playing_side"
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

  // 13. EFFECT HOOKS
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
        selectedFriends.includes(friend.id)
      );
      setSelectedPlayers(selected);
    } else {
      setSelectedPlayers([]);
    }
  }, [selectedFriends, friends]);

  // Auto-update end time when start time changes
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

  // Update region and court when a court is selected
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
      date.getDate()
    );
    setStartDateTime(newStartDateTime);

    // Update end date if it's on a different day
    const newEndDateTime = new Date(endDateTime);
    if (
      newEndDateTime.getDate() !== date.getDate() ||
      newEndDateTime.getMonth() !== date.getMonth() ||
      newEndDateTime.getFullYear() !== date.getFullYear()
    ) {
      newEndDateTime.setFullYear(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      setEndDateTime(newEndDateTime);
    }
  };

  const handleStartTimeChange = (time: Date) => {
    const newStartDateTime = new Date(startDateTime);
    newStartDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
    setStartDateTime(newStartDateTime);
  };

  const handleEndTimeChange = (time: Date) => {
    const newEndDateTime = new Date(endDateTime);
    newEndDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);

    // If end time is before start time, assume it's the next day
    if (newEndDateTime <= startDateTime) {
      newEndDateTime.setDate(newEndDateTime.getDate() + 1);
    }

    setEndDateTime(newEndDateTime);
    setEndTimeManuallyChanged(true);
  };

  // ========================================
  // WIZARD NAVIGATION FUNCTIONS
  // ========================================

  const goToNextStep = useCallback(() => {
    const currentIndex = stepConfig.findIndex(
      (step) => step.id === currentStep
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < stepConfig.length) {
      setSlideDirection("forward");
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
      setCurrentStep(stepConfig[nextIndex].id);
    }
  }, [currentStep, stepConfig]);

  const goToPreviousStep = useCallback(() => {
    const currentIndex = stepConfig.findIndex(
      (step) => step.id === currentStep
    );
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      setSlideDirection("backward");
      setCurrentStep(stepConfig[prevIndex].id);
    }
  }, [currentStep, stepConfig]);

  const goToStep = useCallback(
    (step: WizardStep) => {
      if (step !== currentStep) {
        const currentIndex = stepConfig.findIndex((s) => s.id === currentStep);
        const targetIndex = stepConfig.findIndex((s) => s.id === step);
        setSlideDirection(targetIndex > currentIndex ? "forward" : "backward");
        setCurrentStep(step);
      }
    },
    [currentStep, stepConfig]
  );

  // ========================================
  // STEP VALIDATION FUNCTIONS
  // ========================================

  const validateCurrentStep = useCallback((): {
    isValid: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];

    switch (currentStep) {
      case WizardStep.MATCH_TYPE_TIME:
        if (endDateTime <= startDateTime) {
          errors.push("End time must be after start time");
        }

        const matchDuration = endDateTime.getTime() - startDateTime.getTime();
        const minDuration = 30 * 60 * 1000;
        const maxDuration = 4 * 60 * 60 * 1000;

        if (matchDuration < minDuration) {
          errors.push("Match duration must be at least 30 minutes");
        }

        if (matchDuration > maxDuration) {
          errors.push("Match duration cannot exceed 4 hours");
        }

        if (isPastMatch) {
          const now = new Date();
          const daysDiff =
            (now.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS) {
            errors.push(
              `Cannot record matches older than ${VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS} days`
            );
          }
        } else {
          // For future matches, ensure they're at least 15 minutes in the future
          const now = new Date();
          const minFutureTime = now.getTime() + 15 * 60 * 1000;
          if (startDateTime.getTime() <= minFutureTime) {
            errors.push(
              "Future matches must be scheduled at least 15 minutes from now"
            );
          }

          const daysDiff =
            (startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > VALIDATION_CONFIG.MAX_FUTURE_DAYS) {
            errors.push(
              `Cannot schedule matches more than ${VALIDATION_CONFIG.MAX_FUTURE_DAYS} days in advance`
            );
          }
        }
        break;

      case WizardStep.PLAYER_SELECTION:
        if (isPastMatch) {
          if (!teamComposition.isValidForPast) {
            errors.push(
              "Past matches require exactly 4 players (you + 3 friends)"
            );
          }
        } else {
          if (!teamComposition.isValidForFuture) {
            errors.push("You must be part of the match");
          }
        }
        break;

      case WizardStep.LOCATION_SETTINGS:
        if (isPublicMatch && !region.trim()) {
          errors.push("Public matches require a location to be specified");
        }
        break;

      case WizardStep.SCORE_ENTRY:
        if (isPastMatch) {
          if (!isSet1Valid || !isSet2Valid) {
            errors.push("Please enter valid scores for both sets");
          }

          if (showSet3 && !isSet3Valid) {
            errors.push("Please enter a valid score for the third set");
          }
        }
        break;

      case WizardStep.REVIEW_SUBMIT:
        // Final validation happens in createMatch function
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [
    currentStep,
    startDateTime,
    endDateTime,
    isPastMatch,
    isFutureMatch,
    teamComposition,
    isPublicMatch,
    region,
    isSet1Valid,
    isSet2Valid,
    showSet3,
    isSet3Valid,
  ]);

  // ========================================
  // BUSINESS LOGIC FUNCTIONS
  // ========================================

  // ENHANCED: Score input handlers with keyboard management
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
      // Dismiss keyboard when last score is entered
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
      // Dismiss keyboard when final score is entered
      Keyboard.dismiss();
    }
  };

  // CORRECTED: Backspace navigation with proper field sequence
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
      // team1Set1 has no previous field
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

  const validateMatch = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (endDateTime <= startDateTime) {
      errors.push("End time must be after start time");
    }

    const matchDuration = endDateTime.getTime() - startDateTime.getTime();
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
        (now.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS) {
        errors.push(
          `Cannot record matches older than ${VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS} days`
        );
      }

      if (isPublicMatch) {
        errors.push("Past matches cannot be made public");
      }
    } else {
      const now = new Date();
      const minFutureTime = now.getTime() + 15 * 60 * 1000;
      if (startDateTime.getTime() <= minFutureTime) {
        errors.push(
          "Future matches must be scheduled at least 15 minutes from now"
        );
      }

      if (!teamComposition.isValidForFuture) {
        errors.push("You must be part of the match");
      }

      const daysDiff =
        (startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > VALIDATION_CONFIG.MAX_FUTURE_DAYS) {
        errors.push(
          `Cannot schedule matches more than ${VALIDATION_CONFIG.MAX_FUTURE_DAYS} days in advance`
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

      if (isPastMatch) {
        const winnerTeam = determineWinnerTeam();

        const playerIds = [session?.user?.id, ...selectedFriends].filter(
          (id) => id != null
        ) as string[];
        if (playerIds.length !== 4) {
          throw new Error("Could not form a team of 4 players");
        }

        const now = new Date();
        const validationHours = useQuickValidation
          ? VALIDATION_CONFIG.QUICK_VALIDATION_HOURS
          : VALIDATION_CONFIG.DISPUTE_WINDOW_HOURS;
        const validationDeadline = new Date(
          now.getTime() + validationHours * 60 * 60 * 1000
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
          processing_method: "postgresql_cron_job",
        });

        const { data: matchResult, error: matchError } = await supabase
          .from("matches")
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        // NOTIFICATION INTEGRATION: Send match confirmation notifications
        await NotificationHelpers.sendMatchConfirmationNotifications(
          playerIds,
          matchResult.id
        );

        console.log(
          "✅ Match created successfully. PostgreSQL cron job will process ratings after validation period."
        );

        const validationHoursDisplay = useQuickValidation
          ? "1 hour"
          : "24 hours";

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
          ]
        );

        Vibration.vibrate([100, 50, 100]);
      } else {
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
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
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

        // NOTIFICATION INTEGRATION: Send match invitations and schedule reminders
        if (profile?.full_name && session?.user?.id) {
          const playerIds = [session.user.id, ...selectedFriends].filter(Boolean) as string[];
          
          await NotificationHelpers.sendMatchInvitationNotifications(
            playerIds,
            session.user.id,
            profile.full_name,
            matchResult.id,
            matchData.start_time
          );

          await NotificationHelpers.scheduleMatchReminder(
            playerIds,
            matchResult.id,
            matchData.start_time
          );
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
      Alert.alert(
        "Error",
        `Failed to create match: ${(error as Error).message}`,
        [{ text: "OK" }]
      );
      Vibration.vibrate(300);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // STEP RENDER FUNCTIONS
  // ========================================

  const renderStep1MatchTypeTime = () => (
    <SlideContainer
      isActive={currentStep === WizardStep.MATCH_TYPE_TIME}
      direction={slideDirection}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content */}
        <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
          <View className="mb-6 mt-6">
            <H2 className="mb-2">Match Date & Time</H2>
            {isPastMatch && (
              <ValidationInfoCard
                isPastMatch={isPastMatch}
                isDemo={useQuickValidation}
              />
            )}

            <View className="bg-card rounded-xl p-5 border border-border/30">
              <CustomDateTimePicker
                label="Match Date"
                value={startDateTime}
                onChange={handleDateChange}
                mode="date"
                minimumDate={(() => {
                  const minDate = new Date();
                  minDate.setDate(
                    minDate.getDate() - VALIDATION_CONFIG.MIN_MATCH_AGE_DAYS
                  );
                  return minDate;
                })()}
                maximumDate={(() => {
                  const maxDate = new Date();
                  maxDate.setDate(
                    maxDate.getDate() + VALIDATION_CONFIG.MAX_FUTURE_DAYS
                  );
                  return maxDate;
                })()}
              />

              <View className="flex-row gap-4 mt-4">
                <View className="flex-1">
                  <CustomDateTimePicker
                    label="Start Time"
                    value={startDateTime}
                    onChange={handleStartTimeChange}
                    mode="time"
                  />
                </View>
                <View className="flex-1">
                  <CustomDateTimePicker
                    label="End Time"
                    value={endDateTime}
                    onChange={handleEndTimeChange}
                    mode="time"
                  />
                </View>
              </View>

              <View className="mt-4 p-3 bg-muted/30 rounded-lg">
                <Text className="text-sm text-muted-foreground">
                  Duration:{" "}
                  {Math.round(
                    (endDateTime.getTime() - startDateTime.getTime()) /
                      (1000 * 60)
                  )}{" "}
                  minutes
                </Text>
                {endDateTime.getDate() !== startDateTime.getDate() && (
                  <Text className="text-xs text-muted-foreground mt-1">
                    Match ends the next day
                  </Text>
                )}
              </View>

              <View className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary">
                <View className="flex-row items-center">
                  <Ionicons
                    name={isPastMatch ? "time-outline" : "calendar-outline"}
                    size={20}
                    color="#2148ce"
                  />
                  <Text className="ml-2 font-medium text-primary">
                    {isPastMatch ? "Past Match Mode" : "Future Match Mode"}
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground mt-1">
                  {isPastMatch
                    ? "Recording a completed match. Scores will enter validation period."
                    : "Scheduling a future match. Players can join before match time."}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SlideContainer>
  );

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
        {/* Main Content */}
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
                        />
                      ))}

                      {Array(2 - teamComposition.team1Players.length)
                        .fill(0)
                        .map((_, i) => (
                          <TouchableOpacity
                            key={`team1-empty-${i}`}
                            className="flex-row items-center mb-2 p-2 w-32 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
                            onPress={() => setShowPlayerModal(true)}
                            activeOpacity={0.7}
                          >
                            <MatchPlayerAvatar
                              player={null}
                              team={1}
                              size="md"
                              isPlaceholder={true}
                              onPress={() => setShowPlayerModal(true)}
                            />
                            <View className="flex-1 ml-3">
                              <Text className="text-sm text-primary/70 font-medium">
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
                        />
                      ))}

                      {Array(2 - teamComposition.team2Players.length)
                        .fill(0)
                        .map((_, i) => (
                          <TouchableOpacity
                            key={`team2-empty-${i}`}
                            className="flex-row items-center mb-2 p-2 w-32 rounded-lg border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 active:bg-indigo-500/10"
                            onPress={() => setShowPlayerModal(true)}
                            activeOpacity={0.7}
                          >
                            <MatchPlayerAvatar
                              player={null}
                              team={2}
                              size="md"
                              isPlaceholder={true}
                              onPress={() => setShowPlayerModal(true)}
                            />
                            <View className="flex-1 ml-3">
                              <Text className="text-sm text-indigo-500/70 font-medium">
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

  const renderStep3LocationSettings = () => (
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
        {/* Main Content */}
        <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
          <View className="mb-6 mt-6">
          <H2 className="mb-2">Location & Settings</H2>
          <Text className="text-muted-foreground mb-6">
            Specify where the match {isPastMatch ? "was" : "will be"} played and
            match settings
          </Text>

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

            {/* Demo mode toggle for past matches */}
            {isPastMatch && (
              <View className="border-t border-border/30 pt-6">
                <Text className="text-lg font-semibold mb-4">
                  Validation Settings
                </Text>

                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-muted-foreground">
                      Demo Mode (1-hour validation)
                    </Text>
                    <View className="flex-row items-center">
                      <TouchableOpacity
                        className={`w-12 h-6 rounded-full ${
                          useQuickValidation ? "bg-primary" : "bg-muted"
                        }`}
                        onPress={() =>
                          setUseQuickValidation(!useQuickValidation)
                        }
                      >
                        <View
                          className={`w-5 h-5 rounded-full bg-white m-0.5 transition-transform ${
                            useQuickValidation
                              ? "translate-x-6"
                              : "translate-x-0"
                          }`}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {useQuickValidation
                      ? "Using 1-hour validation period for testing"
                      : "Standard 24-hour validation period"}
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
        {/* Main Content */}
        <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
          <View className="mb-6 mt-6">
            <H2 className="mb-2">Match Scores</H2>
            <Text className="text-muted-foreground mb-6">
              Enter the scores for each set played
            </Text>

            <View className="bg-card rounded-xl p-5 border border-border/30">
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
                onBackspace={handleBackspaceNavigation}
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
                  onTeam2Change={handleTeam2Set3Change}
                  onBackspace={handleBackspaceNavigation}
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
      direction={slideDirection}    >
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
        {/* Main Content */}
        <View className="px-6 bg-background rounded-t-3xl relative z-10 -mt-6">
          <View className="mb-6 mt-6">
          <H2 className="mb-2">Review Match</H2>
          <Text className="text-muted-foreground mb-6">
            Review all details before {isPastMatch ? "recording" : "scheduling"}{" "}
            your match
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
                    (1000 * 60)
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
                  <Ionicons name="location-outline" size={16} color="#2148ce" />
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
                  <Ionicons name="settings-outline" size={16} color="#2148ce" />
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
                {useQuickValidation ? "1 hour" : "24 hours"} to dispute scores.
                Ratings will only be applied after the validation period
                expires.
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
  // WIZARD NAVIGATION CONTROLS
  // ========================================

  const renderNavigationControls = () => {
    const currentStepValidation = validateCurrentStep();
    const canProceed = currentStepValidation.isValid;
    const currentIndex = stepConfig.findIndex(
      (step) => step.id === currentStep
    );
    const isLastStep = currentIndex === stepConfig.length - 1;

    return (
      <View className="px-6 py-4 bg-white/80 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700">
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
                <Text className="ml-1 text-black font-medium">Previous</Text>
              </View>
            </Button>
          )}

          {/* Next/Submit Button */}
          {!isLastStep ? (
            <Button
              variant="default"
              className={`${currentIndex === 0 ? "flex-1" : "flex-[2]"}`}
              onPress={goToNextStep}
              disabled={!canProceed}
            >
              <View className="flex-row items-center">
                <Text className="mr-1 font-extrabold text-white">
                  {stepConfig[currentIndex + 1]?.title || "Next"}
                </Text>
                <Ionicons name="arrow-forward" size={22} color="white" />
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
                <Text className="text-primary-foreground font-medium">
                  {isPastMatch ? "Record Match" : "Schedule Match"}
                </Text>
              )}
            </Button>
          )}
        </View>

        {/* Validation Errors */}
        {!currentStepValidation.isValid &&
          currentStepValidation.errors.length > 0 && (
            <View className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <View className="flex-row items-start">
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color="#ef4444"
                  style={{ marginTop: 1 }}
                />
                <View className="flex-1 ml-2">
                  {currentStepValidation.errors.map((error, index) => (
                    <Text
                      key={index}
                      className="text-sm text-red-600 dark:text-red-400"
                    >
                      {error}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )}
      </View>
    );
  };

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
          source={require("../../../assets/padelcourt.jpg")} // Adjust path as needed
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

      {/* Header */}
        <View
          className="flex-row  mx-auto  items-center"
        >
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            stepConfig={stepConfig}
          />
        </View>
      {/* Step Content */}
      <View className="flex-1 relative z-10">

        {renderStep1MatchTypeTime()}
        {renderStep2PlayerSelection()}
        {renderStep3LocationSettings()}
        {renderStep4ScoreEntry()}
        {renderStep5ReviewSubmit()}
      </View>

      {/* Navigation Controls */}
      {renderNavigationControls()}
    </SafeAreaView>
  );
}
