import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';

interface PlayerDetail {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  glicko_rd: string | null;
  avatar_url: string | null;
}

interface PlayerStatsCardProps {
  player: PlayerDetail;
  position: string;
  teamColor?: string;
  onPress?: () => void;
}

const PlayerStatsCard: React.FC<PlayerStatsCardProps> = ({
  player,
  position,
  teamColor = '#fbbf24',
  onPress
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to player profile
      router.push({
        pathname: '/(protected)/profile/[userId]',
        params: { userId: player.id }
      });
    }
  };

  const rating = player.glicko_rating ? Math.round(parseFloat(player.glicko_rating)) : '-';
  const uncertainty = player.glicko_rd ? Math.round(parseFloat(player.glicko_rd)) : '-';

  return (
    <TouchableOpacity 
      onPress={handlePress}
      className="bg-card rounded-lg p-4 mb-3 flex-row items-center"
    >
      <View 
        className="w-12 h-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: teamColor + 'CC' }} // CC adds 80% opacity
      >
        <Text className="text-lg font-bold text-white">
          {player.full_name?.charAt(0)?.toUpperCase() || player.email.charAt(0).toUpperCase()}
        </Text>
      </View>
      
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="font-medium">{player.full_name || player.email.split('@')[0]}</Text>
          <View className="ml-2 px-2 py-0.5 bg-muted rounded-full">
            <Text className="text-xs text-muted-foreground">{position}</Text>
          </View>
        </View>
        <View className="flex-row mt-1">
          <View className="flex-row items-center mr-4">
            <Ionicons name="stats-chart-outline" size={14} color="#888" style={{ marginRight: 2 }} />
            <Text className="text-xs text-muted-foreground">{rating}</Text>
          </View>
          {rating !== '-' && uncertainty !== '-' && (
            <View className="flex-row items-center">
              <Ionicons name="pulse-outline" size={14} color="#888" style={{ marginRight: 2 }} />
              <Text className="text-xs text-muted-foreground">±{uncertainty}</Text>
            </View>
          )}
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#888" />
    </TouchableOpacity>
  );
};

export default PlayerStatsCard;