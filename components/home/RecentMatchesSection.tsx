import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { H3 } from '@/components/ui/typography';
import { MatchCard } from './MatchCard';
import { EmptyMatches } from './EmptyMatches';
import { MatchData } from '@/types';

interface RecentMatchesSectionProps {
  matches: MatchData[];
  userId: string;
}

export function RecentMatchesSection({ matches, userId }: RecentMatchesSectionProps) {
  return (
    <>
      <View className="mb-4 flex-row justify-between items-center">
        <H3>Recent Matches</H3>
        <TouchableOpacity 
          onPress={() => {
            router.push('/(protected)/(screens)/match-history');
          }}
        >
          <Text className="text-primary">See All</Text>
        </TouchableOpacity>
      </View>
      
      {matches.length > 0 
        ? matches.map(match => (
            <MatchCard key={match.id} match={match} userId={userId} />
          ))
        : <EmptyMatches />
      }
    </>
  );
}