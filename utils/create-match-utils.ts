import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import {
  MatchData,
  MatchStatus,
  ValidationStatus,
  WizardStep,
} from "@/types/create-match";
import { VALIDATION_CONFIG } from "@/constants/create-match";
import { FEATURE_FLAGS } from "@/constants/features";
import { NotificationHelpers } from "@/services/notificationHelpers";

export interface SetScore {
  team1: number;
  team2: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Score input handling utilities
export const handleScoreInputChange = (
  text: string,
  nextRef?: React.RefObject<any>,
) => {
  if (text.length === 1 && /^\d$/.test(text)) {
    nextRef?.current?.focus();
  }
};

export const handleBackspaceNavigation = (
  currentField: string,
  refs: { [key: string]: React.RefObject<any> },
) => {
  const fieldToRefMap = {
    team2Set1: "team1Set1",
    team1Set2: "team2Set1",
    team2Set2: "team1Set2",
    team1Set3: "team2Set2",
    team2Set3: "team1Set3",
  };

  const targetField = fieldToRefMap[currentField as keyof typeof fieldToRefMap];
  if (targetField && refs[targetField]) {
    refs[targetField].current?.focus();
  }
};

// Winner determination
export const determineWinnerTeam = (
  set1Score: SetScore,
  set2Score: SetScore,
  set3Score: SetScore,
  showSet3: boolean,
): number => {
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

// Score validation
export const validateSetScore = (score: SetScore): boolean => {
  return (
    score.team1 >= 0 && score.team2 >= 0 && (score.team1 > 0 || score.team2 > 0)
  );
};

// Final match validation
export const validateFinalMatch = (
  endDateTime: Date,
  startDateTime: Date,
  isPastMatch: boolean,
  selectedPlayers: any[],
  isSet1Valid: boolean,
  isSet2Valid: boolean,
  isSet3Valid: boolean,
  showSet3: boolean,
  isPublicMatch: boolean,
  selectedCourt: any,
  region: string,
): ValidationResult => {
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

// Check if this is user's first match
export const isFirstMatch = async (userId: string): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(
        `player1_id.eq.${userId},player2_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`,
      );

    if (error) {
      console.error("Error checking first match:", error);
      return false;
    }
    return count === 0;
  } catch (error) {
    console.error("Error checking first match:", error);
    return false;
  }
};

// Date and time formatting utilities
export const formatDisplayDate = (date: Date): string => {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDisplayTime = (date: Date): string => {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Default date/time calculations
export const getDefaultStartDateTime = (): Date => {
  const now = new Date();
  // Default to 2 hours ago, rounded to nearest 15 minutes
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const minutes = twoHoursAgo.getMinutes();
  const roundedMinutes = Math.floor(minutes / 15) * 15;

  twoHoursAgo.setMinutes(roundedMinutes, 0, 0);
  return twoHoursAgo;
};

export const getDefaultEndDateTime = (startDateTime: Date): Date => {
  // Default end time is start time + 90 minutes, but max 30 minutes before now
  const now = new Date();
  const maxEndTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 min before now
  const proposedEndTime = new Date(startDateTime.getTime() + 90 * 60 * 1000);

  return proposedEndTime <= maxEndTime ? proposedEndTime : maxEndTime;
};

// Wizard step validation
export const validateCurrentStep = (
  currentStep: WizardStep,
  // Add other parameters as needed for validation
): ValidationResult => {
  const errors: string[] = [];

  switch (currentStep) {
    case WizardStep.LOCATION_SETTINGS:
      // Add location validation logic
      break;
    case WizardStep.MATCH_TYPE_TIME:
      // Add time validation logic
      break;
    case WizardStep.PLAYER_SELECTION:
      // Add player validation logic
      break;
    case WizardStep.SCORE_ENTRY:
      // Add score validation logic
      break;
    case WizardStep.REVIEW_SUBMIT:
      // Add final validation logic
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Match creation utility
export const createMatchData = (
  sessionUserId: string,
  selectedFriends: string[],
  set1Score: SetScore,
  set2Score: SetScore,
  set3Score: SetScore,
  showSet3: boolean,
  winnerTeam: number,
  startDateTime: Date,
  endDateTime: Date,
  region: string,
  court: string,
  matchDescription: string,
  isPastMatch: boolean,
  isPublicMatch: boolean,
): MatchData => {
  return {
    player1_id: sessionUserId,
    player2_id: selectedFriends[0] || null,
    player3_id: selectedFriends[1] || null,
    player4_id: selectedFriends[2] || null,
    team1_score_set1: isPastMatch ? set1Score.team1 : null,
    team2_score_set1: isPastMatch ? set1Score.team2 : null,
    team1_score_set2: isPastMatch ? set2Score.team1 : null,
    team2_score_set2: isPastMatch ? set2Score.team2 : null,
    team1_score_set3: isPastMatch && showSet3 ? set3Score.team1 : null,
    team2_score_set3: isPastMatch && showSet3 ? set3Score.team2 : null,
    winner_team: isPastMatch ? winnerTeam : null,
    status: isPastMatch ? MatchStatus.COMPLETED : MatchStatus.PENDING,
    completed_at: isPastMatch ? new Date().toISOString() : null,
    start_time: startDateTime.toISOString(),
    end_time: endDateTime.toISOString(),
    region: region.trim() || null,
    court: court.trim() || null,
    is_public: isPublicMatch,
    description: matchDescription.trim() || null,
    rating_applied: false,
  };
};
