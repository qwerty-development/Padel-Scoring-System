import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FriendSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

export function FriendSearchBar({ value, onChangeText, onClear }: FriendSearchBarProps) {
  return (
    <View className="bg-card rounded-xl flex-row items-center px-4 py-2 mb-4">
      <Ionicons name="search" size={20} color="#9ca3af" />
      <TextInput
        className="flex-1 ml-2 text-foreground"
        placeholder="Search friends"
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Ionicons name="close-circle" size={20} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </View>
  );
}