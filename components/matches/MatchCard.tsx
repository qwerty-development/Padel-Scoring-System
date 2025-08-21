import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Image as ExpoImage } from "@/components/image";

// Match the MatchData type from your dashboard
export enum MatchStatus {
  PENDING = 1,
  NEEDS_CONFIRMATION = 2,
  CANCELLED = 3,
  COMPLETED = 4,
  NEEDS_SCORES = 5,
  RECRUITING = 6,
}

export interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  status: number;
  created_at: string;
  completed_at: string | null;
  start_time: string;
  end_time: string | null;
  region: string | null;
  court: string | null;
  team1_score_set1: number | null;
  team2_score_set1: number | null;
  team1_score_set2: number | null;
  team2_score_set2: number | null;
  team1_score_set3: number | null;
  team2_score_set3: number | null;
  winner_team: number | null;
  is_public: boolean;
  description: string | null;
  validation_status?: string;
  all_confirmed?: boolean;
  confirmation_status?: string;
  rating_applied?: boolean;
  player1?: any;
  player2?: any;
  player3?: any;
  player4?: any;

  // Computed properties
  isTeam1?: boolean;
  userWon?: boolean;
  setScores?: string;
  isCompleted?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  needsScores?: boolean;
  needsConfirmation?: boolean;
  isDisputed?: boolean;
  teammate?: any;
  opponents?: any[];
  team1Sets?: number;
  team2Sets?: number;
}

export interface MatchCardProps {
  match: MatchData;
  onPress?: (match: MatchData) => void;
}

// Small Avatar component compatible with your existing one
interface AvatarProps {
  user: {
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  size?: number;
  showBorder?: boolean;
  borderColor?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 32,
  showBorder = false,
  borderColor = "#ffffff",
}) => {
  if (!user) {
    return (
      <View
        className="bg-gray-300 dark:bg-gray-600 items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: showBorder ? 2 : 0,
          borderColor: showBorder ? borderColor : "transparent",
        }}
      >
        <Text className="text-xs text-gray-600 dark:text-gray-300 font-bold">
          ?
        </Text>
      </View>
    );
  }

  const getInitial = () => {
    if (user.full_name?.trim()) {
      return user.full_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: showBorder ? 2 : 0,
    borderColor: showBorder ? borderColor : "transparent",
  };

  if (user.avatar_url) {
    return (
      <ExpoImage
        source={{ uri: user.avatar_url }}
        style={containerStyle}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      className="bg-blue-500 items-center justify-center"
      style={containerStyle}
    >
      <Text className="text-xs font-bold text-white">{getInitial()}</Text>
    </View>
  );
};

// Small PlayerAvatarStack component
interface PlayerAvatarStackProps {
  players: ({
    id?: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null)[];
  size?: number;
}

const PlayerAvatarStack: React.FC<PlayerAvatarStackProps> = ({
  players,
  size = 32,
}) => {
  const validPlayers = players.filter(Boolean);

  return (
    <View className="flex-row items-center">
      {validPlayers.map((player, index) => (
        <View
          key={`${player?.id || index}`}
          style={{
            marginLeft: index > 0 ? -8 : 0,
            zIndex: validPlayers.length - index,
          }}
        >
          <Avatar
            user={player}
            size={size}
            showBorder={true}
            borderColor="#ffffff"
          />
        </View>
      ))}
    </View>
  );
};

const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  const router = useRouter();

  // Format date and time from start_time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    // Get weekday short (Sun, Mon, etc.)
    const weekdayShort = date.toLocaleDateString("en-US", { weekday: "short" });

    // Get day and month (13 Jul)
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "short" });

    // Get time (10:30AM)
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return {
      dateLabel: `${weekdayShort}, ${day} ${month}`,
      timeLabel: time,
    };
  };

  const { dateLabel, timeLabel } = formatDateTime(match.start_time);

  // Status pill configuration
  const getStatusConfig = () => {
    if (match.isCompleted) {
      if (match.isDisputed) {
        return {
          text: "Disputed",
          className:
            "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
        };
      } else if (match.needsConfirmation) {
        return {
          text: "Pending ▸",
          className:
            "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
        };
      } else if (match.all_confirmed) {
        return {
          text: "Confirmed",
          className:
            "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
        };
      }
    }
    // Default for upcoming matches
    return {
      text: "Pending ▸",
      className:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    };
  };

  const statusConfig = getStatusConfig();

  // Get teammate name with fallback and truncation
  const getTeammateName = () => {
    if (!match.teammate) return "";
    const name =
      match.teammate.full_name || match.teammate.email?.split("@")[0] || "TBD";
    // Truncate very long names
    return name.length > 12 ? `${name.substring(0, 12)}...` : name;
  };

  // Get opponents label with truncation
  const getOpponentsLabel = () => {
    if (!match.opponents || match.opponents.length === 0) return "TBD & TBD";
    const names = match.opponents
      .map((p) => {
        const name = p?.full_name || p?.email?.split("@")[0] || "TBD";
        // Truncate individual names if too long
        return name.length > 12 ? `${name.substring(0, 12)}...` : name;
      })
      .join(" & ");

    // If the combined label is still too long, truncate the whole thing
    return names.length > 25 ? `${names.substring(0, 25)}...` : names;
  };

  // Build score columns based on user's team
  const buildScoreColumns = () => {
    const isTeam1 = match.isTeam1;

    const getSetScores = (setNum: 1 | 2 | 3) => {
      const team1Score =
        setNum === 1
          ? match.team1_score_set1
          : setNum === 2
            ? match.team1_score_set2
            : match.team1_score_set3;
      const team2Score =
        setNum === 1
          ? match.team2_score_set1
          : setNum === 2
            ? match.team2_score_set2
            : match.team2_score_set3;

      if (team1Score === null || team2Score === null) {
        return { userScore: null, oppScore: null, userWon: false };
      }

      const userScore = isTeam1 ? team1Score : team2Score;
      const oppScore = isTeam1 ? team2Score : team1Score;
      const userWon = userScore > oppScore;

      return { userScore, oppScore, userWon };
    };

    return [getSetScores(1), getSetScores(2), getSetScores(3)];
  };

  const scoreColumns = buildScoreColumns();

  // Determine if user's team won the match
  const userTeamWon = match.userWon;

  // Handle card press
  const handlePress = () => {
    if (onPress) {
      onPress(match);
    } else {
      // Default navigation behavior
      const mode = match.needsScores
        ? "score-entry"
        : match.needsConfirmation
          ? "confirmation"
          : undefined;

      router.push({
        pathname: "/(protected)/(screens)/match-details",
        params: {
          matchId: match.id,
          ...(mode && { mode }),
        },
      });
    }
  };

  // Accessibility label
  const opponentsText = getOpponentsLabel();
  const accessibilityLabel = `Match on ${dateLabel} at ${timeLabel}. You vs ${opponentsText}. Status ${statusConfig.text}.`;

  return (
    <TouchableOpacity
      className="bg-white border  dark:bg-gray-800 rounded-2xl p-4 mb-4  border-gray-300 dark:border-gray-700"
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel}
    >
      {/* Header row: date/time/venue on left, status pill on right */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {dateLabel} • {timeLabel}
          </Text>
          {(match.court || match.region) && (
            <View className="flex-row items-center mt-1">
              <Ionicons
                name="location-outline"
                size={12}
                color="#6b7280"
                style={{ marginRight: 4 }}
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {match.court || match.region}
              </Text>
            </View>
          )}
        </View>

        <View className={`px-2 py-1 rounded-full ${statusConfig.className}`}>
          <Text className="text-xs font-medium">{statusConfig.text}</Text>
        </View>
      </View>

      {/* Teams and Scores Section */}
      <View>
        {/* My team row - aligned with scores */}
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center flex-1 min-w-0">
            <PlayerAvatarStack
              players={[match.player1, match.teammate].filter(Boolean)}
              size={32}
            />
            <View className="flex-row items-center ml-3 flex-1 min-w-0">
              <Text
                className="text-sm text-gray-900 dark:text-gray-100 flex-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                You & {getTeammateName()}
              </Text>
              {/* Show green dot only if user's team won */}
              {match.isCompleted && userTeamWon && (
                <View className="w-2 h-2 bg-emerald-600 rounded-full ml-2 flex-shrink-0" />
              )}
            </View>
          </View>

          {/* User scores row */}
          <View className="flex-row items-center flex-shrink-0">
            {scoreColumns.map((column, index) => (
              <View key={`user-${index}`} className="w-12 items-center">
                <Text
                  className={`text-xl font-semibold ${
                    column.userScore !== null
                      ? column.userWon
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-500"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {column.userScore ?? "-"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Divider - under team names and score columns */}
        <View className="flex-row justify-between my-1">
          {/* Big line under team names/avatars */}
          <View className="flex-1 mr-3">
            <View className="h-px bg-black/60 dark:bg-white/20" />
          </View>
          {/* Score column dividers */}
          <View className="flex-row items-center flex-shrink-0">
            {scoreColumns.map((_, index) => (
              <View key={`divider-${index}`} className="w-12 items-center">
                <View className="w-8 h-px bg-black/60 dark:bg-white/20" />
              </View>
            ))}
          </View>
        </View>

        {/* Opponents row - aligned with scores */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 min-w-0">
            <PlayerAvatarStack players={match.opponents || []} size={32} />
            <View className="flex-row items-center ml-3 flex-1 min-w-0">
              <Text
                className="text-sm text-gray-900 dark:text-gray-100 flex-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {getOpponentsLabel()}
              </Text>
              {/* Show green dot only if opponents won */}
              {match.isCompleted && !userTeamWon && (
                <View className="w-2 h-2 bg-emerald-600 rounded-full ml-2 flex-shrink-0" />
              )}
            </View>
          </View>

          {/* Opponent scores row */}
          <View className="flex-row items-center flex-shrink-0">
            {scoreColumns.map((column, index) => (
              <View key={`opp-${index}`} className="w-12 items-center">
                <Text
                  className={`text-xl font-semibold ${
                    column.oppScore !== null
                      ? !column.userWon
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-500"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {column.oppScore ?? "-"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default MatchCard;
