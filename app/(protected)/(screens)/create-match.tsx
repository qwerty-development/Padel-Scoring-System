import React from "react";
import { View, ScrollView, TouchableOpacity, TextInput, Alert, ToastAndroid, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { SafeAreaView } from "@/components/safe-area-view";

// Extracted components
import { ProgressIndicator } from "@/components/create-match/ProgressIndicator";
import { SlideContainer } from "@/components/create-match/SlideContainer";
import { CourtSelectionModal } from "@/components/create-match/CourtSelectionModal";
import { ValidationInfoCard } from "@/components/create-match/ValidationInfoCard";
import { PlayerSelectionModal } from "@/components/create-match/PlayerSelectionModal";

// Custom hook
import { useCreateMatchState } from "@/hooks/useCreateMatchState";

// Types and constants
import { WizardStep, StepConfig } from "@/types/create-match";
import { VALIDATION_CONFIG, PREDEFINED_COURTS } from "@/constants/create-match";

export default function CreateMatchWizardRefactored() {
  const router = useRouter();
  
  // Debug state for tracking actions
  const [debugLog, setDebugLog] = React.useState<string[]>([]);
  const [lastButtonPress, setLastButtonPress] = React.useState<string>("Never");
  
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 4)]); // Keep last 5 logs
  };
  
  const {
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

    // Computed
    isPastMatch,
    isFutureMatch,
    isSet1Valid,
    isSet2Valid,
    isSet3Valid,

    // Actions
    goToNextStep,
    goToPreviousStep,
    goToStep,
    handleDateChange,
    handleScoreChange,
    createMatch,

    // Refs
    team1Set1Ref,
    team2Set1Ref,
    team1Set2Ref,
    team2Set2Ref,
    team1Set3Ref,
    team2Set3Ref,

    // Setters
    setCompletedSteps,
    setCurrentStep,
    setSlideDirection,
    setSelectedCourt,
    setShowCourtModal,
    setShowPlayerModal,
    setSelectedPlayers,
    setSelectedFriends,
    setRefreshing,
    setShowSet3,
  } = useCreateMatchState();

  // Define our custom step sequence since we combined location and time
  const customStepSequence = [
    WizardStep.LOCATION_SETTINGS, // Step 1: Location & Time
    WizardStep.PLAYER_SELECTION,  // Step 2: Players
    ...(isPastMatch ? [WizardStep.SCORE_ENTRY] : []), // Step 3: Scores (if past match)
    WizardStep.REVIEW_SUBMIT,     // Step 4: Review
  ];
  
  // Log initial state
  React.useEffect(() => {
    addDebugLog(`🚀 Component initialized - isPastMatch: ${isPastMatch}`);
    addDebugLog(`📋 Step sequence: [${customStepSequence.join(', ')}]`);
    addDebugLog(`📍 Starting at step: ${currentStep}`);
  }, []);

  // Step configuration
  const stepConfig: StepConfig[] = [
    {
      id: WizardStep.LOCATION_SETTINGS,
      title: "Location & Time",
      description: "Where and when will you play?",
      icon: "location-outline",
    },
    {
      id: WizardStep.PLAYER_SELECTION,
      title: "Players",
      description: "Who played?",
      icon: "people-outline",
    },
    ...(isPastMatch
      ? [
          {
            id: WizardStep.SCORE_ENTRY,
            title: "Scores",
            description: "What were the scores?",
            icon: "trophy-outline",
          },
        ]
      : []),
    {
      id: WizardStep.REVIEW_SUBMIT,
      title: "Review",
      description: "Confirm and submit",
      icon: "checkmark-outline",
    },
  ];

  // Custom navigation functions that use our step sequence
  const goToNextStepCustom = async () => {
    addDebugLog("🚀 goToNextStepCustom function called!");
    
    const validation = validateCurrentStep();
    addDebugLog(`✅ Validation result: ${validation.isValid ? 'PASS' : 'FAIL'} - ${validation.errors.join(', ') || 'No errors'}`);
    
    if (!validation.isValid) {
      addDebugLog("❌ Validation failed, showing error alert");
      // Error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Please Complete Required Fields",
        validation.errors.join("\n"),
        [{ text: "OK" }]
      );
      return;
    }
    
    addDebugLog("✅ Validation passed, proceeding to next step");
    
    // Success haptic feedback for advancing
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const currentIndex = customStepSequence.indexOf(currentStep);
    const nextStep = customStepSequence[currentIndex + 1];
    
    addDebugLog(`📊 Current index: ${currentIndex}, Next step: ${nextStep}`);
    addDebugLog(`🎯 Step sequence: [${customStepSequence.join(', ')}]`);
    addDebugLog(`📍 Current step: ${currentStep}`);
    
    if (nextStep) {
      addDebugLog(`🚀 Moving from step ${currentStep} to step ${nextStep}`);
      
      // Show step progression feedback
      const stepNames = {
        [WizardStep.LOCATION_SETTINGS]: "Location & Time",
        [WizardStep.MATCH_TYPE_TIME]: "Match Type & Time",
        [WizardStep.PLAYER_SELECTION]: "Player Selection", 
        [WizardStep.SCORE_ENTRY]: "Score Entry",
        [WizardStep.REVIEW_SUBMIT]: "Review & Submit"
      };
      
      // Show toast notification for step progression
      const message = `✅ Moving to ${stepNames[nextStep]}`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        // For iOS, you could use a third-party toast library or just haptic feedback
        // The haptic feedback above already provides good feedback
      }
      
      addDebugLog(`🔄 Setting completed steps...`);
      setCompletedSteps((prev: Set<WizardStep>) => {
        const newSet = new Set([...prev, currentStep]);
        addDebugLog(`✅ Completed steps updated: [${Array.from(newSet).join(', ')}]`);
        return newSet;
      });
      
      addDebugLog(`🔄 Setting current step to ${nextStep}...`);
      setCurrentStep(nextStep);
      
      addDebugLog(`🔄 Setting slide direction to forward...`);
      setSlideDirection("forward");
      
      addDebugLog(`✅ Step transition completed to step ${nextStep}`);
      
      // Force a re-render and show success
      setTimeout(() => {
        addDebugLog(`⏰ After timeout - checking if step changed...`);
        Alert.alert(
          "✅ Step Changed Successfully!",
          `You are now on step: ${stepNames[nextStep] || nextStep}`,
          [{ text: "OK" }]
        );
      }, 100);
      
    } else {
      addDebugLog("❌ No next step found");
      Alert.alert("❌ Error", "No next step found in sequence");
    }
  };

  const goToPreviousStepCustom = async () => {
    // Light haptic feedback for navigation
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const currentIndex = customStepSequence.indexOf(currentStep);
    const prevStep = customStepSequence[currentIndex - 1];
    
    if (prevStep) {
      setCurrentStep(prevStep);
      setSlideDirection("backward");
    }
  };

  // Validation functions
  const canNavigateToStep = (step: WizardStep): boolean => {
    // Check if step exists in our custom sequence
    return customStepSequence.includes(step) && (completedSteps.has(step) || step === currentStep);
  };

  const validateCurrentStep = () => {
    const errors: string[] = [];
    
    switch (currentStep) {
      case WizardStep.LOCATION_SETTINGS:
        // Validate location and time selection
        if (!selectedCourt) {
          errors.push("Please select a court");
        }
        // Note: Time selection is optional for now as it's still being developed
        // if (selectedTimes.length === 0) {
        //   errors.push("Please select at least one time slot");
        // }
        break;
        
      case WizardStep.PLAYER_SELECTION:
        // Validate that we have exactly 4 players (including current user)
        if (selectedPlayers.length !== 3) {
          errors.push("Please select exactly 3 other players (4 total including you)");
        }
        break;
        
      case WizardStep.SCORE_ENTRY:
        // Validate scores if it's a past match
        if (isPastMatch) {
          // Check Set 1
          if (set1Score.team1 === 0 && set1Score.team2 === 0) {
            errors.push("Please enter scores for Set 1");
          } else if (!isValidPadelScore(set1Score.team1, set1Score.team2)) {
            errors.push("Set 1 scores are not valid for Padel");
          }
          
          // Check Set 2
          if (set2Score.team1 === 0 && set2Score.team2 === 0) {
            errors.push("Please enter scores for Set 2");
          } else if (!isValidPadelScore(set2Score.team1, set2Score.team2)) {
            errors.push("Set 2 scores are not valid for Padel");
          }
          
          // Check Set 3 if visible
          if (showSet3) {
            if (set3Score.team1 === 0 && set3Score.team2 === 0) {
              errors.push("Please enter scores for Set 3");
            } else if (!isValidPadelScore(set3Score.team1, set3Score.team2)) {
              errors.push("Set 3 scores are not valid for Padel");
            }
          }
        }
        break;
        
      case WizardStep.REVIEW_SUBMIT:
        // All previous validations should pass
        const locationValid = selectedCourt; // Time selection is optional for now
        const playersValid = selectedPlayers.length === 3;
        const scoresValid = !isPastMatch || (
          isValidPadelScore(set1Score.team1, set1Score.team2) &&
          isValidPadelScore(set2Score.team1, set2Score.team2) &&
          (!showSet3 || isValidPadelScore(set3Score.team1, set3Score.team2))
        );
        
        if (!locationValid) {
          errors.push("Please complete location selection");
        }
        if (!playersValid) {
          errors.push("Please select exactly 3 other players");
        }
        if (!scoresValid) {
          errors.push("Please complete score entry with valid Padel scores");
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Fetch friends function (simplified)
  const fetchFriends = async () => {
    setRefreshing(true);
    // Implementation would go here
    setRefreshing(false);
  };

  // Generate time slots (individual hours) - limited based on selected date
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const selectedDateObj = new Date(selectedDate);
    
    // Check if selected date is today
    const isToday = selectedDateObj.toDateString() === now.toDateString();
    
    if (isToday) {
      // For today, only show times up to 1 hour before now
      const maxHour = Math.max(0, now.getHours() - 1);
      for (let hour = 0; hour <= maxHour; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    } else {
      // For past dates, show all hours
      for (let hour = 0; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    
    return slots;
  };

  // Generate dates (only past dates - start with today, then yesterday, then go back)
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    
    // Start with today (index 0), then yesterday (index 1), then go back in time
    for (let i = 0; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      let label;
      if (i === 0) {
        label = "Today";
      } else if (i === 1) {
        label = "Yesterday";
      } else if (i === 7) {
        label = "1 week ago";
      } else if (i === 14) {
        label = "2 weeks ago";
      } else if (i === 30) {
        label = "1 month ago";
      } else {
        label = date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          day: 'numeric' 
        });
      }
      
      dates.push({
        label,
        date,
        value: date.toISOString().split('T')[0]
      });
    }
    return dates;
  };

  const dateOptions = generateDates();
  const [selectedTimes, setSelectedTimes] = React.useState<string[]>([]);
  const [selectedDate, setSelectedDate] = React.useState(dateOptions[0].value);
  const [showSuccessScreen, setShowSuccessScreen] = React.useState(false);
  
  // Generate time slots based on selected date
  const timeSlots = React.useMemo(() => {
    const slots = [];
    const now = new Date();
    const selectedDateObj = new Date(selectedDate);
    
    // Check if selected date is today
    const isToday = selectedDateObj.toDateString() === now.toDateString();
    
    if (isToday) {
      // For today, only show times up to 1 hour before now
      const maxHour = Math.max(0, now.getHours() - 1);
      for (let hour = 0; hour <= maxHour; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    } else {
      // For past dates, show all hours
      for (let hour = 0; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    
    return slots;
  }, [selectedDate]);

  // Set default court if none selected
  React.useEffect(() => {
    if (!selectedCourt) {
      addDebugLog("🔍 No court selected, finding default court");
      // Find "The Padel Lab" as default court
      const defaultCourt = PREDEFINED_COURTS.find(court => court.name === "The Padel Lab");
      if (defaultCourt) {
        addDebugLog(`✅ Setting default court: ${defaultCourt.name}`);
        setSelectedCourt(defaultCourt);
      } else {
        addDebugLog("❌ Default court not found");
      }
    } else {
      addDebugLog(`✅ Court already selected: ${selectedCourt.name}`);
    }
  }, [selectedCourt, setSelectedCourt]);

  // Enhanced createMatch function with haptic feedback and success screen
  const handleCreateMatch = async () => {
    try {
      // Trigger haptic feedback on button press
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await createMatch();
      
      // Success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success screen
      setShowSuccessScreen(true);
      
      // Navigate back after showing success screen for 2 seconds
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error) {
      // Error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Error handling is already done in the createMatch function
      console.log("Match creation failed:", error);
    }
  };

  // Padel score validation
  const VALID_PADEL_SCORES = [
    { team1: 6, team2: 0 }, { team1: 6, team2: 1 }, { team1: 6, team2: 2 },
    { team1: 6, team2: 3 }, { team1: 6, team2: 4 }, { team1: 7, team2: 5 },
    { team1: 7, team2: 6 }, { team1: 0, team2: 6 }, { team1: 1, team2: 6 },
    { team1: 2, team2: 6 }, { team1: 3, team2: 6 }, { team1: 4, team2: 6 },
    { team1: 5, team2: 7 }, { team1: 6, team2: 7 },
  ];

  const isValidPadelScore = (team1: number, team2: number): boolean => {
    return VALID_PADEL_SCORES.some(
      (score) => score.team1 === team1 && score.team2 === team2,
    );
  };

  // Handle time selection (consecutive)
  const handleTimeSelection = (time: string) => {
    const timeIndex = timeSlots.indexOf(time);
    
    if (selectedTimes.includes(time)) {
      // If clicking on a selected time, remove it and all times after it
      const currentIndex = selectedTimes.indexOf(time);
      setSelectedTimes(selectedTimes.slice(0, currentIndex));
    } else {
      // If no times selected, start with this time
      if (selectedTimes.length === 0) {
        setSelectedTimes([time]);
      } else {
        // Check if the new time is consecutive
        const lastSelectedIndex = timeSlots.indexOf(selectedTimes[selectedTimes.length - 1]);
        if (timeIndex === lastSelectedIndex + 1) {
          // Add consecutive time
          setSelectedTimes([...selectedTimes, time]);
        } else {
          // Start new selection
          setSelectedTimes([time]);
        }
      }
    }
  };

  // Simplified step render functions
  const renderLocationStep = () => (
    <SlideContainer
      isActive={currentStep === WizardStep.LOCATION_SETTINGS}
      direction={slideDirection}
    >
      <View className="flex-1 bg-white rounded-t-3xl">
        {/* Progress Dots */}
        <View className="flex-row justify-center pt-6 pb-4 px-8">
          {customStepSequence.map((step, index) => {
            const currentIndex = customStepSequence.indexOf(currentStep);
            return (
              <View
                key={step}
                className={`flex-1 h-1 mx-2 rounded-full ${
                  index <= currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            );
          })}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6">
            <Text className="text-2xl font-bold mb-2 text-blue-600">📍 Location & Time</Text>
            <Text className="text-gray-600 mb-6 text-base">
              Select the padel club and the time your match took place.
            </Text>

            {/* Court Selection */}
            <View className="mb-6 p-4 border border-gray-200 rounded-2xl bg-white">
              <Text className="text-base font-semibold mb-3 text-gray-900">Court</Text>
              <TouchableOpacity 
                onPress={() => setShowCourtModal(true)} 
                className="bg-gray-50 rounded-2xl p-4 flex-row items-center justify-between border border-gray-200"
              >
                <Text className="text-gray-900 font-medium text-base">
                  {selectedCourt ? selectedCourt.name : "Select a court"}
                </Text>
                <Ionicons name="search" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Date Selection */}
            <View className="mb-6 p-4 border border-gray-200 rounded-2xl bg-white">
              <Text className="text-base font-semibold mb-3 text-gray-900">Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-3 px-1">
                  {dateOptions.map((dateOption) => (
                    <TouchableOpacity
                      key={dateOption.value}
                      onPress={() => setSelectedDate(dateOption.value)}
                      className={`px-6 py-6 rounded-xl border-2 min-w-[100px] ${
                        selectedDate === dateOption.value 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      <Text className={`font-medium text-center ${
                        selectedDate === dateOption.value ? 'text-white' : 'text-gray-900'
                      }`}>
                        {dateOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Time Selection Grid */}
            <View className="mb-6 p-4 border border-gray-200 rounded-2xl bg-white">
              <Text className="text-base font-semibold mb-3 text-gray-900">Time</Text>
              <View className="flex-row flex-wrap gap-2">
                {timeSlots.map((time) => (
                  <TouchableOpacity
                    key={time}
                    onPress={() => handleTimeSelection(time)}
                    className={`px-3 py-3 rounded-lg border-2 ${
                      selectedTimes.includes(time)
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                    style={{ width: '22%' }}
                  >
                    <Text
                      className={`text-center text-sm font-medium ${
                        selectedTimes.includes(time) ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {selectedTimes.length > 0 && (
                <View className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Text className="text-blue-800 font-medium">
                    Selected: {selectedTimes[0]} - {selectedTimes[selectedTimes.length - 1]} 
                    ({selectedTimes.length} hour{selectedTimes.length > 1 ? 's' : ''})
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </SlideContainer>
  );



  const renderPlayerStep = () => (
    <SlideContainer
      isActive={currentStep === WizardStep.PLAYER_SELECTION}
      direction={slideDirection}
    >
      <View className="flex-1 bg-white rounded-t-3xl">
        {/* Progress Dots */}
        <View className="flex-row justify-center pt-6 pb-4 px-8">
          {customStepSequence.map((step, index) => {
            const currentIndex = customStepSequence.indexOf(currentStep);
            return (
              <View
                key={step}
                className={`flex-1 h-1 mx-2 rounded-full ${
                  index <= currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            );
          })}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6">
            <Text className="text-2xl font-bold mb-2 text-purple-600">👥 Players</Text>
            <Text className="text-gray-600 mb-6 text-base">
              Select 3 other players for your match (4 players total including you)
            </Text>

            {/* Team Layout */}
            <View className="mb-6 p-4 border border-gray-200 rounded-2xl bg-white">
              <View className="flex-row justify-between mb-6">
                <Text className="text-base font-semibold text-blue-600">Team 1</Text>
                <Text className="text-base font-semibold text-purple-600">Team 2</Text>
              </View>

              {/* Players Grid */}
              <View className="flex-row items-center justify-center">
                {/* Team 1 */}
                <View className="flex-row gap-4">
                  {/* Team 1 - Position 1 (Current User) */}
                  <View className="w-20 items-center">
                    <View className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-600 items-center justify-center mb-2">
                      <View className="w-12 h-12 rounded-full bg-gray-300 items-center justify-center">
                        <Text className="text-white font-bold">J</Text>
                      </View>
                    </View>
                    <Text className="text-sm font-medium text-gray-900">John</Text>
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-600">★</Text>
                      <Text className="text-xs text-gray-600 ml-1">8.5</Text>
                    </View>
                  </View>

                  {/* Team 1 - Position 2 */}
                  <View className="w-20 items-center">
                    <TouchableOpacity 
                      onPress={() => setShowPlayerModal(true)}
                      className="w-16 h-16 rounded-full border-2 border-dashed border-gray-400 items-center justify-center mb-2"
                    >
                      <Text className="text-gray-400 text-2xl">+</Text>
                    </TouchableOpacity>
                    <Text className="text-sm font-medium text-gray-900">P2</Text>
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-600">★</Text>
                      <Text className="text-xs text-gray-600 ml-1">-</Text>
                    </View>
                  </View>
                </View>

                {/* Divider */}
                <View className="w-px h-20 bg-gray-300 mx-6" />

                {/* Team 2 */}
                <View className="flex-row gap-4">
                  {/* Team 2 - Position 3 */}
                  <View className="w-20 items-center">
                    <TouchableOpacity 
                      onPress={() => setShowPlayerModal(true)}
                      className="w-16 h-16 rounded-full border-2 border-dashed border-gray-400 items-center justify-center mb-2"
                    >
                      <Text className="text-gray-400 text-2xl">+</Text>
                    </TouchableOpacity>
                    <Text className="text-sm font-medium text-gray-900">P3</Text>
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-600">★</Text>
                      <Text className="text-xs text-gray-600 ml-1">-</Text>
                    </View>
                  </View>

                  {/* Team 2 - Position 4 */}
                  <View className="w-20 items-center">
                    <TouchableOpacity 
                      onPress={() => setShowPlayerModal(true)}
                      className="w-16 h-16 rounded-full border-2 border-dashed border-gray-400 items-center justify-center mb-2"
                    >
                      <Text className="text-gray-400 text-2xl">+</Text>
                    </TouchableOpacity>
                    <Text className="text-sm font-medium text-gray-900">P4</Text>
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-600">★</Text>
                      <Text className="text-xs text-gray-600 ml-1">-</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Selected Players Info */}
              {selectedPlayers.length > 0 && (
                <View className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Text className="text-blue-800 font-medium text-sm">
                    Selected: {selectedPlayers.length}/3 players
                  </Text>
                  <View className="mt-2">
                    {selectedPlayers.map((player, index) => (
                      <View key={player.id} className="flex-row items-center justify-between py-1">
                        <Text className="text-blue-800 text-sm">{player.full_name}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const newPlayers = selectedPlayers.filter((p) => p.id !== player.id);
                            setSelectedPlayers(newPlayers);
                            setSelectedFriends(newPlayers.map((p) => p.id));
                          }}
                          className="px-2 py-1 bg-red-100 rounded"
                        >
                          <Text className="text-red-600 text-xs">Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </SlideContainer>
  );

  const renderScoreStep = () => {
    if (!isPastMatch) return null;

    return (
      <SlideContainer
        isActive={currentStep === WizardStep.SCORE_ENTRY}
        direction={slideDirection}
      >
                    <View className="flex-1 bg-white rounded-t-3xl">
        {/* Progress Dots */}
        <View className="flex-row justify-center pt-6 pb-4 px-8">
          {customStepSequence.map((step, index) => {
            const currentIndex = customStepSequence.indexOf(currentStep);
            return (
              <View
                key={step}
                className={`flex-1 h-1 mx-2 rounded-full ${
                  index <= currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            );
          })}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6">
            <Text className="text-xl font-bold mb-2 text-gray-900">Match Scores</Text>
            <Text className="text-gray-600 mb-6 text-sm">
              Enter the scores for each set
            </Text>

            {/* Match Card Style Score Input */}
            <View className="mb-6 p-4 border border-gray-200 rounded-2xl bg-white">
              <View className="flex-row justify-between">
                {/* Team Names Section */}
                <View className="flex-1 mr-6">
                  {/* Team 1 Players */}
                  <View className="mb-3">
                    <View className="flex-row items-center mb-2">
                      <View className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-600 items-center justify-center mr-3">
                        <Text className="text-blue-800 font-bold text-xs">J</Text>
                      </View>
                      <Text className="text-sm font-semibold text-gray-900">You</Text>
                    </View>
                    
                    {selectedPlayers.length > 0 && (
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-yellow-100 border-2 border-yellow-500 items-center justify-center mr-3">
                          <Text className="text-yellow-800 font-bold text-xs">
                            {selectedPlayers[0]?.full_name?.charAt(0) || 'P'}
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold text-gray-900">
                          {selectedPlayers[0]?.full_name?.split(' ')[0] || 'Player'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Divider */}
                  <View className="h-px bg-gray-300 my-4" />

                  {/* Team 2 Players */}
                  <View className="mt-3">
                    {selectedPlayers.length > 1 && (
                      <View className="flex-row items-center mb-2">
                        <View className="w-10 h-10 rounded-full bg-gray-300 border-2 border-gray-400 items-center justify-center mr-3">
                          <Text className="text-white font-bold text-xs">
                            {selectedPlayers[1]?.full_name?.charAt(0) || 'P'}
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold text-gray-900">
                          {selectedPlayers[1]?.full_name?.split(' ')[0] || 'Player'}
                        </Text>
                      </View>
                    )}
                    
                    {selectedPlayers.length > 2 && (
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-500 items-center justify-center mr-3">
                          <Text className="text-purple-800 font-bold text-xs">
                            {selectedPlayers[2]?.full_name?.charAt(0) || 'P'}
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold text-gray-900">
                          {selectedPlayers[2]?.full_name?.split(' ')[0] || 'Player'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Score Section */}
                <View className="flex-shrink-0">
                  {/* Team 1 Scores */}
                  <View className="flex-row mb-4">
                    {[1, 2, 3].map((setNum) => (
                      <TextInput
                          className={`w-14 h-14 border rounded-xl bg-white text-center text-xl font-bold ${
                            setNum === 1 && set1Score.team1 > 0 && set1Score.team2 > 0 
                              ? isValidPadelScore(set1Score.team1, set1Score.team2)
                                ? 'border-green-500 bg-green-50'
                                : 'border-red-500 bg-red-50'
                              : setNum === 2 && set2Score.team1 > 0 && set2Score.team2 > 0 
                                ? isValidPadelScore(set2Score.team1, set2Score.team2)
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-red-500 bg-red-50'
                                : setNum === 3 && set3Score.team1 > 0 && set3Score.team2 > 0 
                                  ? isValidPadelScore(set3Score.team1, set3Score.team2)
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-red-500 bg-red-50'
                                  : setNum === 3 && !showSet3
                                    ? 'border-gray-200 bg-gray-50'
                                    : 'border-gray-300'
                          }`}
                          keyboardType="number-pad"
                          maxLength={1}
                          placeholder="-"
                          placeholderTextColor="#9ca3af"
                          editable={setNum === 3 ? showSet3 : true}
                          value={
                            setNum === 1 ? (set1Score.team1 > 0 ? set1Score.team1.toString() : "") :
                            setNum === 2 ? (set2Score.team1 > 0 ? set2Score.team1.toString() : "") :
                            (set3Score.team1 > 0 ? set3Score.team1.toString() : "")
                          }
                          onChangeText={(text) => {
                            const setName = setNum === 1 ? "set1" : setNum === 2 ? "set2" : "set3";
                            handleScoreChange(setName as "set1" | "set2" | "set3", "team1", text);
                            
                            // Auto-advance logic
                            if (text) {
                              if (setNum === 1 && team1Set2Ref?.current) {
                                setTimeout(() => team1Set2Ref.current?.focus(), 50);
                              } else if (setNum === 2 && (showSet3 ? team1Set3Ref?.current : team2Set1Ref?.current)) {
                                setTimeout(() => {
                                  if (showSet3) team1Set3Ref?.current?.focus();
                                  else team2Set1Ref?.current?.focus();
                                }, 50);
                              } else if (setNum === 3 && team2Set1Ref?.current) {
                                setTimeout(() => team2Set1Ref?.current?.focus(), 50);
                              }
                            }
                          }}
                          ref={setNum === 1 ? team1Set1Ref : setNum === 2 ? team1Set2Ref : team1Set3Ref}
                          key={setNum}
                          style={{ marginRight: setNum === 3 ? 0 : 20 }}
                        />
                    ))}
                  </View>

                  {/* Score Divider */}
                  <View className="flex-row mb-4">
                    <View className="w-14 h-px bg-gray-300" style={{ marginRight: 20 }} />
                    <View className="w-14 h-px bg-gray-300" style={{ marginRight: 20 }} />
                    <View className="w-14 h-px bg-gray-300" />
                  </View>

                  {/* Team 2 Scores */}
                  <View className="flex-row">
                    {[1, 2, 3].map((setNum) => (
                      <TextInput
                          className={`w-14 h-14 border rounded-xl bg-white text-center text-xl font-bold ${
                            setNum === 1 && set1Score.team1 > 0 && set1Score.team2 > 0 
                              ? isValidPadelScore(set1Score.team1, set1Score.team2)
                                ? 'border-green-500 bg-green-50'
                                : 'border-red-500 bg-red-50'
                              : setNum === 2 && set2Score.team1 > 0 && set2Score.team2 > 0 
                                ? isValidPadelScore(set2Score.team1, set2Score.team2)
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-red-500 bg-red-50'
                                : setNum === 3 && set3Score.team1 > 0 && set3Score.team2 > 0 
                                  ? isValidPadelScore(set3Score.team1, set3Score.team2)
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-red-500 bg-red-50'
                                  : setNum === 3 && !showSet3
                                    ? 'border-gray-200 bg-gray-50'
                                    : 'border-gray-300'
                          }`}
                          keyboardType="number-pad"
                          maxLength={1}
                          placeholder="-"
                          placeholderTextColor="#9ca3af"
                          editable={setNum === 3 ? showSet3 : true}
                          value={
                            setNum === 1 ? (set1Score.team2 > 0 ? set1Score.team2.toString() : "") :
                            setNum === 2 ? (set2Score.team2 > 0 ? set2Score.team2.toString() : "") :
                            (set3Score.team2 > 0 ? set3Score.team2.toString() : "")
                          }
                          onChangeText={(text) => {
                            const setName = setNum === 1 ? "set1" : setNum === 2 ? "set2" : "set3";
                            handleScoreChange(setName as "set1" | "set2" | "set3", "team2", text);
                            
                            // Check if we need to enable Set 3 after completing Set 2
                            if (setNum === 2 && text) {
                              const set1Valid = isValidPadelScore(set1Score.team1, set1Score.team2);
                              const newSet2Score = parseInt(text) || 0;
                              const set2Valid = isValidPadelScore(set2Score.team1, newSet2Score);
                              
                              if (set1Valid && set2Valid) {
                                const team1SetsWon = (set1Score.team1 > set1Score.team2 ? 1 : 0) + 
                                                    (set2Score.team1 > newSet2Score ? 1 : 0);
                                const team2SetsWon = (set1Score.team2 > set1Score.team1 ? 1 : 0) + 
                                                    (newSet2Score > set2Score.team1 ? 1 : 0);
                                
                                if (team1SetsWon === 1 && team2SetsWon === 1) {
                                  setShowSet3(true);
                                  // Auto-focus on Set 3 Team 1
                                  setTimeout(() => team1Set3Ref?.current?.focus(), 100);
                                }
                              }
                            }
                            
                            // Auto-advance logic for other sets
                            if (text && setNum === 1 && team2Set2Ref?.current) {
                              setTimeout(() => team2Set2Ref.current?.focus(), 50);
                            }
                          }}
                          ref={setNum === 1 ? team2Set1Ref : setNum === 2 ? team2Set2Ref : team2Set3Ref}
                          key={setNum}
                          style={{ marginRight: setNum === 3 ? 0 : 20 }}
                        />
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      </SlideContainer>
    );
  };

  const renderReviewStep = () => (
    <SlideContainer
      isActive={currentStep === WizardStep.REVIEW_SUBMIT}
      direction={slideDirection}
    >
      <View className="flex-1 bg-white rounded-t-3xl">
        {/* Progress Dots */}
        <View className="flex-row justify-center pt-6 pb-4 px-8">
          {customStepSequence.map((step, index) => {
            const currentIndex = customStepSequence.indexOf(currentStep);
            return (
              <View
                key={step}
                className={`flex-1 h-1 mx-2 rounded-full ${
                  index <= currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            );
          })}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6">
            <Text className="text-xl font-bold mb-2 text-gray-900">Review & Submit</Text>
            <Text className="text-gray-600 mb-6 text-sm">
              Review your match details before submitting
            </Text>

            {/* Match Card Style Summary */}
            <View className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
              {/* Header with date and court */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600">
                    {startDateTime.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })} at {startDateTime.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </Text>
                  {selectedCourt && (
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="location-outline" size={14} color="#666" />
                      <Text className="text-xs text-gray-600 ml-1">
                        {selectedCourt.name}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Status Badge */}
                <View className="px-2 py-1 rounded-full bg-blue-100">
                  <Text className="text-xs font-medium text-blue-700">
                    {isPastMatch ? "Completed" : "Scheduled"}
                  </Text>
                </View>
              </View>

              {/* Teams */}
              <View className="space-y-3">
                {/* Team 1 */}
                <View>
                  <Text className="text-xs text-gray-500 mb-1">TEAM 1</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-row -space-x-2">
                      {/* Current User Avatar */}
                      <View className="w-8 h-8 rounded-full bg-blue-100 border-2 border-blue-600 items-center justify-center">
                        <Text className="text-blue-800 font-bold text-xs">J</Text>
                      </View>
                      {/* Second Player Avatar */}
                      {selectedPlayers.length > 0 && (
                        <View className="w-8 h-8 rounded-full bg-yellow-100 border-2 border-white items-center justify-center">
                          <Text className="text-yellow-800 font-bold text-xs">
                            {selectedPlayers[0]?.full_name?.charAt(0) || 'P'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm flex-1" numberOfLines={1}>
                      You{selectedPlayers.length > 0 && ` & ${selectedPlayers[0]?.full_name?.split(' ')[0] || 'Player'}`}
                    </Text>
                  </View>
                </View>

                {/* Team 2 */}
                <View>
                  <Text className="text-xs text-gray-500 mb-1">TEAM 2</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-row -space-x-2">
                      {/* Third Player Avatar */}
                      {selectedPlayers.length > 1 && (
                        <View className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white items-center justify-center">
                          <Text className="text-white font-bold text-xs">
                            {selectedPlayers[1]?.full_name?.charAt(0) || 'P'}
                          </Text>
                        </View>
                      )}
                      {/* Fourth Player Avatar */}
                      {selectedPlayers.length > 2 && (
                        <View className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white items-center justify-center">
                          <Text className="text-purple-800 font-bold text-xs">
                            {selectedPlayers[2]?.full_name?.charAt(0) || 'P'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm flex-1" numberOfLines={1}>
                      {selectedPlayers.length > 1 
                        ? `${selectedPlayers[1]?.full_name?.split(' ')[0] || 'Player'}${selectedPlayers.length > 2 ? ` & ${selectedPlayers[2]?.full_name?.split(' ')[0] || 'Player'}` : ''}`
                        : "TBD"
                      }
                    </Text>
                  </View>
                </View>
              </View>

              {/* Scores */}
              {isPastMatch && (set1Score.team1 > 0 || set1Score.team2 > 0 || set2Score.team1 > 0 || set2Score.team2 > 0) && (
                <View className="mt-3 pt-3 border-t border-gray-200">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <Text className="text-xs text-gray-500">Score:</Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-medium">
                          {set1Score.team1}-{set1Score.team2}
                        </Text>
                        <Text className="text-sm font-medium">
                          {set2Score.team1}-{set2Score.team2}
                        </Text>
                        {showSet3 && set3Score.team1 > 0 && set3Score.team2 > 0 && (
                          <Text className="text-sm font-medium">
                            {set3Score.team1}-{set3Score.team2}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </SlideContainer>
  );

  // Debug panel to show current state
  const renderDebugPanel = () => {
    const currentStepValidation = validateCurrentStep();
    const currentStepIndex = customStepSequence.indexOf(currentStep);
    
    return (
      <View className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-4 mx-4 mb-4">
        <Text className="text-yellow-800 font-bold text-lg mb-2">🐛 DEBUG INFO</Text>
        
        {/* Current Step Info */}
        <View className="mb-3">
          <Text className="text-yellow-800 font-semibold">📍 Current Step:</Text>
          <Text className="text-yellow-700">ID: {currentStep} | Index: {currentStepIndex}</Text>
          <Text className="text-yellow-700">Sequence: [{customStepSequence.join(', ')}]</Text>
        </View>
        
        {/* State Values */}
        <View className="mb-3">
          <Text className="text-yellow-800 font-semibold">🏗️ State Values:</Text>
          <Text className="text-yellow-700">Court: {selectedCourt?.name || 'NULL'}</Text>
          <Text className="text-yellow-700">Times: [{selectedTimes.join(', ')}]</Text>
          <Text className="text-yellow-700">Players: {selectedPlayers.length}/3</Text>
          <Text className="text-yellow-700">isPastMatch: {isPastMatch.toString()}</Text>
        </View>
        
        {/* Validation Results */}
        <View className="mb-3">
          <Text className="text-yellow-800 font-semibold">✅ Validation:</Text>
          <Text className="text-yellow-700">Is Valid: {currentStepValidation.isValid.toString()}</Text>
          <Text className="text-yellow-700">Errors: {currentStepValidation.errors.length > 0 ? currentStepValidation.errors.join(', ') : 'None'}</Text>
        </View>
        
        {/* Navigation State */}
        <View className="mb-3">
          <Text className="text-yellow-800 font-semibold">🎮 Navigation:</Text>
          <Text className="text-yellow-700">Can Proceed: {currentStepValidation.isValid.toString()}</Text>
          <Text className="text-yellow-700">Is Last Step: {(currentStepIndex === customStepSequence.length - 1).toString()}</Text>
          <Text className="text-yellow-700">Next Step: {customStepSequence[currentStepIndex + 1] || 'None'}</Text>
        </View>
        
        {/* Button State */}
        <View className="mb-3">
          <Text className="text-yellow-800 font-semibold">🔘 Button State:</Text>
          <Text className="text-yellow-700">Next Button Disabled: {(!currentStepValidation.isValid).toString()}</Text>
          <Text className="text-yellow-700">Next Button Color: {currentStepValidation.isValid ? 'Blue' : 'Gray'}</Text>
          <Text className="text-yellow-700">Last Button Press: {lastButtonPress}</Text>
        </View>
        
        {/* Debug Actions */}
        <View className="mb-3">
          <Text className="text-yellow-800 font-semibold">🧪 Debug Actions:</Text>
          <TouchableOpacity 
            onPress={() => {
              const validation = validateCurrentStep();
              Alert.alert(
                "🔍 Manual Validation Test",
                `Step: ${currentStep}\nValid: ${validation.isValid}\nErrors: ${validation.errors.join(', ') || 'None'}`
              );
            }}
            className="bg-yellow-600 px-3 py-2 rounded mt-2"
          >
            <Text className="text-white text-center font-semibold">Test Validation</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => {
              const currentIndex = customStepSequence.indexOf(currentStep);
              const nextStep = customStepSequence[currentIndex + 1];
              Alert.alert(
                "➡️ Next Step Test",
                `Current: ${currentStep} (index ${currentIndex})\nNext: ${nextStep || 'None'}\nSequence: [${customStepSequence.join(', ')}]`
              );
            }}
            className="bg-blue-600 px-3 py-2 rounded mt-2"
          >
            <Text className="text-white text-center font-semibold">Test Next Step</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => {
              addDebugLog("🧪 Manual test of goToNextStepCustom");
              goToNextStepCustom();
            }}
            className="bg-green-600 px-3 py-2 rounded mt-2"
          >
            <Text className="text-white text-center font-semibold">Test Navigation Function</Text>
          </TouchableOpacity>
        </View>
        
        {/* Debug Log */}
        <View>
          <Text className="text-yellow-800 font-semibold">📝 Debug Log:</Text>
          {debugLog.map((log, index) => (
            <Text key={index} className="text-yellow-700 text-xs mb-1">
              {log}
            </Text>
          ))}
          {debugLog.length === 0 && (
            <Text className="text-yellow-700 text-xs italic">No actions yet...</Text>
          )}
        </View>
      </View>
    );
  };

  // Navigation controls
  const renderNavigationControls = () => {
    const currentStepValidation = validateCurrentStep();
    const canProceed = currentStepValidation.isValid;
    const isLastStep = customStepSequence.indexOf(currentStep) === customStepSequence.length - 1;

    return (
      <View className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200">
        <View className="flex-row gap-4">
          {customStepSequence.indexOf(currentStep) > 0 && (
            <TouchableOpacity
              onPress={goToPreviousStepCustom}
              className="flex-1 bg-gray-500 py-4 rounded-full flex-row items-center justify-center"
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Back</Text>
            </TouchableOpacity>
          )}

          {!isLastStep && (
            <TouchableOpacity
              onPress={() => {
                const now = new Date().toLocaleTimeString();
                setLastButtonPress(now);
                addDebugLog(`🔴 Next button pressed at ${now}`);
                
                if (!canProceed) {
                  // Show why button is disabled
                  const validation = validateCurrentStep();
                  addDebugLog(`❌ Button disabled: ${validation.errors.join(', ')}`);
                  Alert.alert(
                    "❌ Cannot Proceed",
                    `Button is disabled because:\n\n${validation.errors.join('\n') || 'Unknown validation error'}`,
                    [{ text: "OK", style: "default" }]
                  );
                } else {
                  // Show immediate feedback that button was pressed
                  addDebugLog(`✅ Button enabled, proceeding to next step`);
                  Alert.alert(
                    "🔴 Next Button Pressed!",
                    `Current Step: ${currentStep}\nCan Proceed: ${canProceed}\nValidation: ${validateCurrentStep().isValid ? 'PASS' : 'FAIL'}\nErrors: ${validateCurrentStep().errors.join(', ') || 'None'}`,
                    [
                      {
                        text: "Cancel",
                        style: "cancel"
                      },
                      {
                        text: "Continue to Next Step",
                        onPress: goToNextStepCustom
                      }
                    ]
                  );
                }
              }}
              disabled={!canProceed}
              className={`flex-1 py-4 rounded-full flex-row items-center justify-center ${
                !canProceed ? 'bg-gray-400' : 'bg-blue-600'
              }`}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold mr-2">Next</Text>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          )}

          {isLastStep && (
            <TouchableOpacity
              onPress={handleCreateMatch}
              disabled={loading || !canProceed}
              className={`flex-1 py-4 rounded-full flex-row items-center justify-center ${
                loading || !canProceed ? 'bg-gray-400' : 'bg-green-600'
              }`}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">
                {loading ? "Creating..." : "Create Match"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Success screen component
  const renderSuccessScreen = () => (
    <View className="flex-1 bg-white items-center justify-center px-8">
      {/* Success Icon */}
      <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-6">
        <Ionicons name="checkmark" size={48} color="white" />
      </View>
      
      {/* Success Text */}
      <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
        Match Created Successfully!
      </Text>
      
      <Text className="text-gray-600 text-center text-base">
        Your match has been recorded and all players have been notified.
      </Text>
      
      {/* Loading indicator */}
      <View className="mt-8 flex-row items-center">
        <View className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse" />
        <Text className="text-gray-500 text-sm">Returning to matches...</Text>
      </View>
    </View>
  );

  // Show success screen if match was created
  if (showSuccessScreen) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        {renderSuccessScreen()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-blue-600">
      {/* Blue Header */}
      <ProgressIndicator
        currentStep={currentStep}
        totalSteps={customStepSequence.length}
        completedSteps={completedSteps}
        stepConfig={stepConfig}
        onStepPress={goToStep}
        canNavigateToStep={canNavigateToStep}
      />

      {/* Content Container */}
      <View className="flex-1 relative">
        {/* Debug Panel - Always visible */}
        {renderDebugPanel()}
        
        {renderLocationStep()}
        {renderPlayerStep()}
        {renderScoreStep()}
        {renderReviewStep()}
      </View>

      {/* Navigation Controls - Pinned to bottom */}
      {renderNavigationControls()}

      {/* Modals */}
      <CourtSelectionModal
        visible={showCourtModal}
        onClose={() => setShowCourtModal(false)}
        onSelectCourt={setSelectedCourt}
        selectedCourt={selectedCourt}
      />

      <PlayerSelectionModal
        visible={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        friends={friends}
        selectedFriends={selectedFriends}
        onSelectFriends={(friendIds: string[]) => {
          setSelectedFriends(friendIds);
          // Convert friend IDs to Friend objects
          const selectedFriendObjects = friends.filter((friend) =>
            friendIds.includes(friend.id),
          );
          setSelectedPlayers(selectedFriendObjects);
        }}
        loading={loading}
      />
    </SafeAreaView>
  );
}

