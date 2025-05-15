import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { useColorScheme } from '@/lib/useColorScheme';

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
  return VALID_SCORES.some(score => 
    score.team1 === team1 && score.team2 === team2
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
}

export function SetScoreInput({ 
  setNumber, 
  value, 
  onChange, 
  onValidate,
  team1Ref,
  team2Ref,
  onTeam1Change,
  onTeam2Change
}: SetScoreInputProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Initialize with empty strings if value is 0, otherwise use the value
  const [team1Input, setTeam1Input] = useState(value.team1 === 0 ? '' : value.team1.toString());
  const [team2Input, setTeam2Input] = useState(value.team2 === 0 ? '' : value.team2.toString());
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Update input fields when value prop changes
  useEffect(() => {
    setTeam1Input(value.team1 === 0 ? '' : value.team1.toString());
    setTeam2Input(value.team2 === 0 ? '' : value.team2.toString());
  }, [value]);

  // Validate score whenever inputs change
  useEffect(() => {
    const team1Value = team1Input === '' ? 0 : parseInt(team1Input);
    const team2Value = team2Input === '' ? 0 : parseInt(team2Input);
    
    // Only validate if both inputs have values
    if (team1Input === '' || team2Input === '') {
      setIsValid(false);
      onValidate(false);
      setErrorMessage('');
      return;
    }
    
    // Check if this is a valid padel score
    const valid = isValidScore(team1Value, team2Value);
    
    setIsValid(valid);
    onValidate(valid);
    
    // Set appropriate error message
    if (team1Input === '' && team2Input === '') {
      setErrorMessage('');
    } else if (!valid) {
      setErrorMessage('Invalid score. Valid padel set scores include: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6 (or reverse)');
    } else {
      setErrorMessage('');
    }
  }, [team1Input, team2Input, onValidate]);

  const handleTeam1Change = (text: string) => {
    // Only allow numbers or empty
    if (text === '' || /^\d*$/.test(text)) {
      setTeam1Input(text);
      
      // Only update parent if it's a number or empty
      const numValue = text === '' ? 0 : parseInt(text);
      onChange({ ...value, team1: numValue });
      
      // Auto-jump to team2 input if a valid digit is entered
      if (text.length === 1 && team2Ref?.current) {
        team2Ref.current.focus();
      }
      
      // Call the onTeam1Change callback if provided
      if (onTeam1Change) {
        onTeam1Change(text);
      }
    }
  };

  const handleTeam2Change = (text: string) => {
    // Only allow numbers or empty
    if (text === '' || /^\d*$/.test(text)) {
      setTeam2Input(text);
      
      // Only update parent if it's a number or empty
      const numValue = text === '' ? 0 : parseInt(text);
      onChange({ ...value, team2: numValue });
      
      // Call the onTeam2Change callback if provided
      if (onTeam2Change) {
        onTeam2Change(text);
      }
    }
  };

  // Helper to provide score suggestions
  const getSuggestions = () => {
    const team1Value = team1Input === '' ? 0 : parseInt(team1Input);
    const team2Value = team2Input === '' ? 0 : parseInt(team2Input);
    
    // Determine which team's score we're trying to match
    const team1Matches = VALID_SCORES.filter(score => score.team1 === team1Value);
    const team2Matches = VALID_SCORES.filter(score => score.team2 === team2Value);
    
    // If team1 score is valid with some team2 score, suggest those
    if (team1Input !== '' && team1Matches.length > 0) {
      return {
        title: `Valid scores with ${team1Value} for Team 1:`,
        suggestions: team1Matches.map(s => `${team1Value}-${s.team2}`)
      };
    }
    
    // If team2 score is valid with some team1 score, suggest those
    if (team2Input !== '' && team2Matches.length > 0) {
      return {
        title: `Valid scores with ${team2Value} for Team 2:`,
        suggestions: team2Matches.map(s => `${s.team1}-${team2Value}`)
      };
    }
    
    // Default suggestions
    return {
      title: "Common set scores:",
      suggestions: ["6-0", "6-3", "6-4", "7-5", "7-6"]
    };
  };

  // Get current suggestions based on input
  const { title: suggestionsTitle, suggestions } = getSuggestions();
  
  // Apply suggested score
  const applySuggestion = (score: string) => {
    const [team1, team2] = score.split('-').map(s => parseInt(s));
    setTeam1Input(team1.toString());
    setTeam2Input(team2.toString());
    onChange({ team1, team2 });
  };

  return (
    <View className="mb-4 p-4 bg-background dark:bg-background/40 rounded-xl border border-border/30">
      <Text className="font-semibold text-lg mb-2">Set {setNumber}</Text>
      
      <View className="flex-row items-center justify-center mt-2">
        <View className="items-center w-20">
          <Text className="text-sm text-muted-foreground mb-2">Team 1</Text>
          <TextInput
            ref={team1Ref}
            className={`w-16 h-16 border rounded-lg text-center text-2xl font-bold ${
              isValid 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : team1Input !== '' 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : 'border-border bg-card dark:bg-card/50'
            }`}
            value={team1Input}
            onChangeText={handleTeam1Change}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            placeholderTextColor={isDark ? '#999' : '#777'}
          />
        </View>
        
        <Text className="text-2xl font-bold mx-3 mt-6">-</Text>
        
        <View className="items-center w-20">
          <Text className="text-sm text-muted-foreground mb-2">Team 2</Text>
          <TextInput
            ref={team2Ref}
            className={`w-16 h-16 border rounded-lg text-center text-2xl font-bold ${
              isValid 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : team2Input !== '' 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : 'border-border bg-card dark:bg-card/50'
            }`}
            value={team2Input}
            onChangeText={handleTeam2Change}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            placeholderTextColor={isDark ? '#999' : '#777'}
          />
        </View>
      </View>

      {/* Validation message */}
      <View className="mt-3 min-h-5">
        {team1Input !== '' || team2Input !== '' ? (
          isValid ? (
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color={isDark ? '#4ade80' : '#22c55e'} />
              <Text className="text-green-600 dark:text-green-400 ml-1">Valid score</Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="alert-circle" size={16} color={isDark ? '#f87171' : '#ef4444'} />
              <Text className="text-red-500 dark:text-red-400 ml-1 flex-shrink text-xs">{errorMessage}</Text>
            </View>
          )
        ) : null}
      </View>
      
      {/* Score suggestions */}
      {(!isValid && (team1Input !== '' || team2Input !== '')) && (
        <View className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <Text className="text-xs text-muted-foreground mb-2">{suggestionsTitle}</Text>
          <View className="flex-row flex-wrap">
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                className="bg-primary/10 dark:bg-primary/20 rounded-full py-1.5 px-3 m-1"
                onPress={() => applySuggestion(suggestion)}
              >
                <Text className="text-primary dark:text-primary-foreground">{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}