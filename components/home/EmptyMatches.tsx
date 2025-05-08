import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export function EmptyMatches() {
  return (
    <View className="bg-card rounded-xl p-6 items-center">
      <Ionicons name="tennisball-outline" size={48} color="#888" />
      <Text className="text-lg font-medium mt-4 mb-2">No matches yet</Text>
      <Text className="text-muted-foreground text-center mb-4">
        Start playing and recording your matches to see them here
      </Text>
      <Button
        variant="default"
        onPress={() => router.push('/(protected)/(screens)/create-match')}
      >
        <Text>Create First Match</Text>
      </Button>
    </View>
  );
}