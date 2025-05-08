import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddFriendButtonProps {
  onPress: () => void;
}

export function AddFriendButton({ onPress }: AddFriendButtonProps) {
  return (
    <TouchableOpacity 
      className="w-10 h-10 rounded-full items-center justify-center"
      onPress={onPress}
    >
      <Ionicons name="person-add" size={20} color="#333" />
    </TouchableOpacity>
  );
}