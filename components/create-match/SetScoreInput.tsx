import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";

// Valid padel set scores
const VALID_SCORES = [
  { team1: 6, team2: 0 },
  { team1: 6, team2: 1 },
  { team1: 6, team2: 2 },
  { team1: 6, team2: 3 },
  { team1: 6, team2: 4 },
  { team1: 7, team2: 5 },
  { team1: 7, team2: 6 },
  { team1: 0, team2: 6 },
  { team1: 1, team2: 6 },
  { team1: 2, team2: 6 },
  { team1: 3, team2: 6 },
  { team1: 4, team2: 6 },
  { team1: 5, team2: 7 },
  { team1: 6, team2: 7 },
];

// Helper to check if a score is valid in padel
const isValidScore = (team1: number, team2: number): boolean => {
  return VALID_SCORES.some(
    (score) => score.team1 === team1 && score.team2 === team2,
  );
};

export interface SetScore {
  team1: number;
  team2: number;
}

interface SetScoreInputProps {
  setNumber: number;
  value: SetScore;
  onChange: (score: SetScore) => void;
  onValidate: (isValid: boolean) => void;
  team1Ref?: React.RefObject<TextInput>;
  team2Ref?: React.RefObject<TextInput>;
  onTeam1Change?: (text: string) => void;
  onTeam2Change?: (text: string) => void;
  onBackspace?: (currentField: string) => void;
  // References to next set's inputs for auto-jumping
  nextSetTeam1Ref?: React.RefObject<TextInput>;
  nextSetTeam2Ref?: React.RefObject<TextInput>;
  // Auto-jump behavior control
  enableAutoJump?: boolean;
}

export function SetScoreInput({
  setNumber,
  value,
  onChange,
  onValidate,
  team1Ref,
  team2Ref,
  onTeam1Change,
  onTeam2Change,
  onBackspace,
  nextSetTeam1Ref,
  nextSetTeam2Ref,
  enableAutoJump = true,
}: SetScoreInputProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // FIXED: Helper function to convert score to display string
  const scoreToString = (score: number, hasBeenSet: boolean = false) => {
    // If the score was never set (initial state), show empty
    // If the score was explicitly set to 0, show "0"
    if (score === 0 && !hasBeenSet) return "";
    return score.toString();
  };

  // FIXED: Track whether values have been explicitly set
  const [team1HasBeenSet, setTeam1HasBeenSet] = useState(value.team1 !== 0);
  const [team2HasBeenSet, setTeam2HasBeenSet] = useState(value.team2 !== 0);

  // FIXED: Initialize properly handling 0 values
  const [team1Input, setTeam1Input] = useState(
    scoreToString(value.team1, value.team1 !== 0),
  );
  const [team2Input, setTeam2Input] = useState(
    scoreToString(value.team2, value.team2 !== 0),
  );
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // FIXED: Update input fields when value prop changes, respecting explicit 0s
  useEffect(() => {
    // Only update if the value actually changed, and respect explicitly set 0s
    const newTeam1String = scoreToString(
      value.team1,
      team1HasBeenSet || value.team1 !== 0,
    );
    const newTeam2String = scoreToString(
      value.team2,
      team2HasBeenSet || value.team2 !== 0,
    );

    if (newTeam1String !== team1Input) {
      setTeam1Input(newTeam1String);
    }
    if (newTeam2String !== team2Input) {
      setTeam2Input(newTeam2String);
    }
  }, [value.team1, value.team2, team1HasBeenSet, team2HasBeenSet]);

  // Validate score whenever inputs change
  useEffect(() => {
    // FIXED: Parse values correctly, treating empty as unset (not 0)
    const team1Value = team1Input === "" ? null : parseInt(team1Input);
    const team2Value = team2Input === "" ? null : parseInt(team2Input);

    // Only validate if both inputs have values (including 0)
    if (team1Value === null || team2Value === null) {
      setIsValid(false);
      onValidate(false);
      setErrorMessage("");
      setShowSuggestions(team1Input !== "" || team2Input !== "");
      return;
    }

    // Check if this is a valid padel score
    const valid = isValidScore(team1Value, team2Value);

    setIsValid(valid);
    onValidate(valid);
    setShowSuggestions(false);

    // Set appropriate error message (more subtle)
    if (!valid && team1Input !== "" && team2Input !== "") {
      setErrorMessage("Invalid padel score");
    } else {
      setErrorMessage("");
    }

    // Auto-dismiss keyboard when both scores are entered and valid
    // But only if this is the last set or no next set available
    if (valid && team1Input !== "" && team2Input !== "" && !nextSetTeam1Ref) {
      setTimeout(() => {
        Keyboard.dismiss();
      }, 500);
    }
  }, [team1Input, team2Input, onValidate, nextSetTeam1Ref]);

  const handleTeam1Change = (text: string) => {
    // Only allow numbers or empty
    if (text === "" || /^\d*$/.test(text)) {
      setTeam1Input(text);
      setTeam1HasBeenSet(text !== ""); // Mark as explicitly set if not empty

      // FIXED: Update parent with proper value
      const numValue = text === "" ? 0 : parseInt(text);
      onChange({ ...value, team1: numValue });

      // Auto-jump to team2 input if a valid digit is entered
      if (
        enableAutoJump &&
        text.length === 1 &&
        /^\d$/.test(text) &&
        team2Ref?.current
      ) {
        setTimeout(() => {
          team2Ref.current?.focus();
        }, 50); // Small delay for smoother UX
      }

      // Call the onTeam1Change callback if provided
      if (onTeam1Change) {
        onTeam1Change(text);
      }
    }
  };

  const handleTeam2Change = (text: string) => {
    // Only allow numbers or empty
    if (text === "" || /^\d*$/.test(text)) {
      setTeam2Input(text);
      setTeam2HasBeenSet(text !== ""); // Mark as explicitly set if not empty

      // FIXED: Update parent with proper value
      const numValue = text === "" ? 0 : parseInt(text);
      onChange({ ...value, team2: numValue });

      // AUTO-JUMP: Auto-jump to next set if current set is complete and valid
      if (enableAutoJump && text.length === 1 && /^\d$/.test(text)) {
        // FIXED: Get actual numeric values for validation
        const team1Value = team1Input === "" ? null : parseInt(team1Input);
        const team2Value = numValue;

        // Check if this creates a valid score (both values must be set)
        if (team1Value !== null && isValidScore(team1Value, team2Value)) {
          // If there's a next set, jump to it
          if (nextSetTeam1Ref?.current) {
            setTimeout(() => {
              nextSetTeam1Ref.current?.focus();
            }, 300); // Slightly longer delay to show the valid state
          } else {
            // If no next set, dismiss keyboard
            setTimeout(() => {
              Keyboard.dismiss();
            }, 500);
          }
        }
      }

      // Call the onTeam2Change callback if provided
      if (onTeam2Change) {
        onTeam2Change(text);
      }
    }
  };

  // Enhanced backspace handling with field identification
  const handleTeam1KeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === "Backspace" && team1Input === "" && onBackspace) {
      onBackspace(`team1Set${setNumber}`);
    }
  };

  const handleTeam2KeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === "Backspace" && team2Input === "") {
      if (team1Input !== "") {
        // If team1 has content, go back to team1
        team1Ref?.current?.focus();
      } else if (onBackspace) {
        // If team1 is empty, go to previous set
        onBackspace(`team2Set${setNumber}`);
      }
    }
  };

  // Helper to provide score suggestions
  const getSuggestions = () => {
    const team1Value = team1Input === "" ? null : parseInt(team1Input);
    const team2Value = team2Input === "" ? null : parseInt(team2Input);

    // Determine which team's score we're trying to match
    const team1Matches =
      team1Value !== null
        ? VALID_SCORES.filter((score) => score.team1 === team1Value)
        : [];
    const team2Matches =
      team2Value !== null
        ? VALID_SCORES.filter((score) => score.team2 === team2Value)
        : [];

    // If team1 score is valid with some team2 score, suggest those
    if (team1Input !== "" && team1Matches.length > 0) {
      return {
        title: `Valid scores with ${team1Value} for Team 1:`,
        suggestions: team1Matches
          .map((s) => `${team1Value}-${s.team2}`)
          .slice(0, 4),
      };
    }

    // If team2 score is valid with some team2 score, suggest those
    if (team2Input !== "" && team2Matches.length > 0) {
      return {
        title: `Valid scores with ${team2Value} for Team 2:`,
        suggestions: team2Matches
          .map((s) => `${s.team1}-${team2Value}`)
          .slice(0, 4),
      };
    }

    // Default suggestions
    return {
      title: "Common set scores:",
      suggestions: ["6-0", "6-3", "6-4", "7-5"],
    };
  };

  // Get current suggestions based on input
  const { title: suggestionsTitle, suggestions } = getSuggestions();

  // Apply suggested score with auto-jump capability
  const applySuggestion = (score: string) => {
    const [team1, team2] = score.split("-").map((s) => parseInt(s));
    setTeam1Input(team1.toString());
    setTeam2Input(team2.toString());
    setTeam1HasBeenSet(true); // Mark both as explicitly set
    setTeam2HasBeenSet(true);
    onChange({ team1, team2 });
    setShowSuggestions(false);

    // If auto-jump is enabled and there's a next set, jump to it
    if (enableAutoJump && nextSetTeam1Ref?.current) {
      setTimeout(() => {
        nextSetTeam1Ref.current?.focus();
      }, 300);
    } else {
      Keyboard.dismiss();
    }
  };

  // Determine styling based on validation state
  const getInputStyling = (hasValue: boolean, isTeam1: boolean) => {
    if (isValid && team1Input !== "" && team2Input !== "") {
      return "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200";
    }

    if (errorMessage && team1Input !== "" && team2Input !== "") {
      return "border-red-300 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-300";
    }

    if (hasValue) {
      return "border-blue-300 bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-200";
    }

    return "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  };

  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-semibold text-lg">Set {setNumber}</Text>
        {isValid && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text className="ml-1 text-sm text-green-600 dark:text-green-400 font-medium">
              Valid
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-center space-x-4">
        {/* Team 1 Score */}
        <View className="items-center">
          <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
            Team 1
          </Text>
          <TextInput
            ref={team1Ref}
            className={`w-16 h-16 border-2 rounded-xl text-center text-2xl font-bold ${getInputStyling(team1Input !== "", true)}`}
            value={team1Input}
            onChangeText={handleTeam1Change}
            onKeyPress={handleTeam1KeyPress}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            placeholder="0"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
        </View>

        {/* VS Separator */}
        <View className="items-center">
          <Text className="text-2xl font-black text-gray-400 dark:text-gray-500 mb-2">
            -
          </Text>
        </View>

        {/* Team 2 Score */}
        <View className="items-center">
          <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
            Team 2
          </Text>
          <TextInput
            ref={team2Ref}
            className={`w-16 h-16 border-2 rounded-xl text-center text-2xl font-bold ${getInputStyling(team2Input !== "", false)}`}
            value={team2Input}
            onChangeText={handleTeam2Change}
            onKeyPress={handleTeam2KeyPress}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            placeholder="0"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
        </View>
      </View>

      {/* Subtle Error Message */}
      {errorMessage && (
        <View className="mt-3 p-2 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30">
          <Text className="text-center text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </Text>
        </View>
      )}

      {/* Score Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Text className="text-sm text-blue-700 dark:text-blue-300 mb-2 font-medium">
            {suggestionsTitle}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((score, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => applySuggestion(score)}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-800 rounded-full"
                activeOpacity={0.7}
              >
                <Text className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  {score}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Auto-jump indicator for better UX */}
      {enableAutoJump && isValid && nextSetTeam1Ref && (
        <View className="mt-2 flex-row items-center justify-center">
          <Ionicons name="arrow-forward" size={14} color="#10b981" />
          <Text className="ml-1 text-xs text-green-600 dark:text-green-400">
            Auto-jumping to Set {setNumber + 1}
          </Text>
        </View>
      )}
    </View>
  );
}
