import { useState, useCallback, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, Keyboard, TextInput } from "react-native";
import { WizardStep, MatchData, Court } from "@/types/create-match";
import { Friend } from "@/types";
import {
  getDefaultStartDateTime,
  getDefaultEndDateTime,
  SetScore,
  validateFinalMatch,
  determineWinnerTeam,
  createMatchData,
  isFirstMatch,
} from "@/utils/create-match-utils";
import { VALIDATION_CONFIG } from "@/constants/create-match";
import { FEATURE_FLAGS } from "@/constants/features";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { NotificationHelpers } from "@/services/notificationHelpers";

export const useCreateMatchState = () => {
  const { friendId } = useLocalSearchParams();
  const { profile, session } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    WizardStep.LOCATION_SETTINGS,
  );
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(
    new Set(),
  );
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward",
  );

  // Core state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    friendId ? [friendId as string] : [],
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Friend[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  // Date and time state
  const [startDateTime, setStartDateTime] = useState<Date>(
    getDefaultStartDateTime(),
  );
  const [endDateTime, setEndDateTime] = useState<Date>(
    getDefaultEndDateTime(getDefaultStartDateTime()),
  );

  // Location state
  const [region, setRegion] = useState("");
  const [court, setCourt] = useState("");
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [showCourtModal, setShowCourtModal] = useState(false);

  // Match settings
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [matchDescription, setMatchDescription] = useState("");
  const [useQuickValidation, setUseQuickValidation] = useState(false);

  // Score state
  const [set1Score, setSet1Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set2Score, setSet2Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [set3Score, setSet3Score] = useState<SetScore>({ team1: 0, team2: 0 });
  const [showSet3, setShowSet3] = useState(false);

  // Input refs for score navigation
  const team1Set1Ref = useRef<TextInput>(null);
  const team2Set1Ref = useRef<TextInput>(null);
  const team1Set2Ref = useRef<TextInput>(null);
  const team2Set2Ref = useRef<TextInput>(null);
  const team1Set3Ref = useRef<TextInput>(null);
  const team2Set3Ref = useRef<TextInput>(null);

  // Computed properties
  const isPastMatch = endDateTime <= new Date();
  const isFutureMatch = startDateTime > new Date();

  // Score validation
  const isSet1Valid =
    set1Score.team1 >= 0 &&
    set1Score.team2 >= 0 &&
    (set1Score.team1 > 0 || set1Score.team2 > 0);
  const isSet2Valid =
    set2Score.team1 >= 0 &&
    set2Score.team2 >= 0 &&
    (set2Score.team1 > 0 || set2Score.team2 > 0);
  const isSet3Valid =
    set3Score.team1 >= 0 &&
    set3Score.team2 >= 0 &&
    (set3Score.team1 > 0 || set3Score.team2 > 0);

  // Navigation functions
  const goToNextStep = useCallback(() => {
    const currentIndex = Object.values(WizardStep).indexOf(currentStep);
    const nextStep = Object.values(WizardStep)[currentIndex + 1];

    if (nextStep && nextStep !== WizardStep.SCORE_ENTRY) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(nextStep);
      setSlideDirection("forward");
    } else if (nextStep === WizardStep.SCORE_ENTRY && isPastMatch) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(nextStep);
      setSlideDirection("forward");
    } else if (!isPastMatch) {
      // Skip score entry for future matches
      const reviewStep = Object.values(WizardStep)[currentIndex + 2];
      if (reviewStep) {
        setCompletedSteps((prev) => new Set([...prev, currentStep]));
        setCurrentStep(reviewStep);
        setSlideDirection("forward");
      }
    }
  }, [currentStep, isPastMatch]);

  const goToPreviousStep = useCallback(() => {
    const currentIndex = Object.values(WizardStep).indexOf(currentStep);
    const prevStep = Object.values(WizardStep)[currentIndex - 1];

    if (prevStep) {
      setCurrentStep(prevStep);
      setSlideDirection("backward");
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: WizardStep) => {
      const currentIndex = Object.values(WizardStep).indexOf(currentStep);
      const targetIndex = Object.values(WizardStep).indexOf(step);

      setCurrentStep(step);
      setSlideDirection(targetIndex > currentIndex ? "forward" : "backward");
    },
    [currentStep],
  );

  // Date handling
  const handleDateChange = useCallback(
    (newDate: Date) => {
      setStartDateTime(newDate);

      // Adjust end time to maintain duration but ensure it's valid
      const duration = endDateTime.getTime() - startDateTime.getTime();
      const newEndTime = new Date(newDate.getTime() + duration);
      setEndDateTime(newEndTime);
    },
    [startDateTime, endDateTime],
  );

  // Score input handlers
  const handleScoreChange = useCallback(
    (set: "set1" | "set2" | "set3", team: "team1" | "team2", value: string) => {
      const numValue = parseInt(value) || 0;

      if (set === "set1") {
        setSet1Score((prev) => ({ ...prev, [team]: numValue }));
      } else if (set === "set2") {
        setSet2Score((prev) => ({ ...prev, [team]: numValue }));
      } else if (set === "set3") {
        setSet3Score((prev) => ({ ...prev, [team]: numValue }));
      }
    },
    [],
  );

  // Match creation
  const createMatch = useCallback(async () => {
    try {
      // Feature flag validation
      if (
        (!FEATURE_FLAGS.FUTURE_MATCH_SCHEDULING_ENABLED && isFutureMatch) ||
        (!FEATURE_FLAGS.PUBLIC_MATCHES_ENABLED && isPublicMatch)
      ) {
        Alert.alert(
          "Feature Unavailable",
          !FEATURE_FLAGS.FUTURE_MATCH_SCHEDULING_ENABLED && isFutureMatch
            ? "Scheduling matches in the future is currently disabled."
            : "Creating public matches is currently disabled.",
        );
        return;
      }

      const validation = validateFinalMatch(
        endDateTime,
        startDateTime,
        isPastMatch,
        selectedPlayers,
        isSet1Valid,
        isSet2Valid,
        isSet3Valid,
        showSet3,
        isPublicMatch,
        selectedCourt,
        region,
      );

      if (!validation.isValid) {
        Alert.alert("Validation Error", validation.errors.join("\n"));
        return;
      }

      setLoading(true);

      const winnerTeam = isPastMatch
        ? determineWinnerTeam(set1Score, set2Score, set3Score, showSet3)
        : 0;

      const matchData = createMatchData(
        session?.user?.id as string,
        selectedFriends,
        set1Score,
        set2Score,
        set3Score,
        showSet3,
        winnerTeam,
        startDateTime,
        endDateTime,
        region,
        court,
        matchDescription,
        isPastMatch,
        isPublicMatch,
      );

      const { data: matchResult, error } = await supabase
        .from("matches")
        .insert(matchData)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Send notifications
      const playerIds = [session?.user?.id, ...selectedFriends].filter(
        (id) => id != null,
      ) as string[];

      try {
        await NotificationHelpers.sendMatchConfirmationNotifications(
          playerIds,
          matchResult.id,
          session!.user.id,
        );
      } catch (notificationError) {
        console.warn("Failed to send notifications:", notificationError);
      }

      const firstMatch = await isFirstMatch(session!.user.id);

      Alert.alert(
        "✅ Match Created Successfully!",
        firstMatch
          ? "Welcome to Padel! Your first match has been recorded."
          : "Your match has been recorded.",
      );

      // Reset form or navigate away
      setLoading(false);
    } catch (error) {
      console.error("Failed to create match:", error);
      Alert.alert("Error", "Failed to create match. Please try again.");
      setLoading(false);
    }
  }, [
    isFutureMatch,
    isPublicMatch,
    endDateTime,
    startDateTime,
    isPastMatch,
    selectedPlayers,
    isSet1Valid,
    isSet2Valid,
    isSet3Valid,
    showSet3,
    selectedCourt,
    region,
    session?.user?.id,
    selectedFriends,
    set1Score,
    set2Score,
    set3Score,
    matchDescription,
  ]);

  return {
    // State
    currentStep,
    completedSteps,
    slideDirection,
    loading,
    refreshing,
    friends,
    selectedFriends,
    selectedPlayers,
    showPlayerModal,
    startDateTime,
    endDateTime,
    region,
    court,
    selectedCourt,
    showCourtModal,
    isPublicMatch,
    matchDescription,
    useQuickValidation,
    set1Score,
    set2Score,
    set3Score,
    showSet3,
    profile,

    // Computed
    isPastMatch,
    isFutureMatch,
    isSet1Valid,
    isSet2Valid,
    isSet3Valid,

    // Refs
    team1Set1Ref,
    team2Set1Ref,
    team1Set2Ref,
    team2Set2Ref,
    team1Set3Ref,
    team2Set3Ref,

    // Setters
    setCurrentStep,
    setCompletedSteps,
    setSlideDirection,
    setLoading,
    setRefreshing,
    setFriends,
    setSelectedFriends,
    setSelectedPlayers,
    setShowPlayerModal,
    setStartDateTime,
    setEndDateTime,
    setRegion,
    setCourt,
    setSelectedCourt,
    setShowCourtModal,
    setIsPublicMatch,
    setMatchDescription,
    setUseQuickValidation,
    setSet1Score,
    setSet2Score,
    setSet3Score,
    setShowSet3,

    // Actions
    goToNextStep,
    goToPreviousStep,
    goToStep,
    handleDateChange,
    handleScoreChange,
    createMatch,
  };
};
