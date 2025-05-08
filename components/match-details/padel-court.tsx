import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface PlayerDetail {
  id: string;
  full_name: string | null;
  email: string;
  glicko_rating: string | null;
  avatar_url: string | null;
}

interface PadelCourtProps {
  player1: PlayerDetail;
  player2: PlayerDetail;
  player3: PlayerDetail;
  player4: PlayerDetail;
  highlightTeam?: 1 | 2; // To highlight the winning team
}

const PadelCourt: React.FC<PadelCourtProps> = ({
  player1,
  player2,
  player3,
  player4,
  highlightTeam
}) => {
  const getInitials = (player: PlayerDetail) => {
    if (player.full_name) {
      return player.full_name.charAt(0).toUpperCase();
    }
    return player.email.charAt(0).toUpperCase();
  };

  const getShortName = (player: PlayerDetail) => {
    if (player.full_name) {
      const nameParts = player.full_name.split(' ');
      return nameParts[0];
    }
    return player.email.split('@')[0];
  };

  return (
    <View className="w-full aspect-[1.4] mb-4">
      {/* Outer court border */}
      <View className="w-full h-full bg-green-200 rounded-lg overflow-hidden border-2 border-green-300">
        
        {/* Center net */}
        <View className="absolute top-0 left-1/2 w-1 h-full bg-white" style={{ marginLeft: -0.5 }} />
        
        {/* Court lines */}
        <View className="absolute top-[15%] left-0 w-full h-px bg-white" />
        <View className="absolute top-[85%] left-0 w-full h-px bg-white" />
        <View className="absolute top-[15%] left-[15%] w-px h-[70%] bg-white" />
        <View className="absolute top-[15%] left-[85%] w-px h-[70%] bg-white" />
        <View className="absolute top-[15%] left-[50%] w-px h-[70%] bg-white" style={{ marginLeft: -0.5 }} />
        
        {/* Service boxes */}
        <View className="absolute top-[50%] left-0 w-full h-px bg-white" />
        
        {/* Team 1 - Player 1 (Back) */}
        <View 
          className={`absolute top-[5%] left-[25%] w-12 h-12 rounded-full items-center justify-center -ml-6 ${
            highlightTeam === 1 ? 'bg-yellow-500' : 'bg-primary/80'
          }`}
        >
          <Text className="text-lg font-bold text-white">{getInitials(player1)}</Text>
        </View>
        <View className="absolute top-[18%] left-[25%] items-center -ml-12">
          <Text className="text-xs font-medium" numberOfLines={1}>{getShortName(player1)}</Text>
        </View>
        
        {/* Team 1 - Player 2 (Front) */}
        <View 
          className={`absolute top-[40%] left-[25%] w-12 h-12 rounded-full items-center justify-center -ml-6 ${
            highlightTeam === 1 ? 'bg-yellow-500' : 'bg-primary/80'
          }`}
        >
          <Text className="text-lg font-bold text-white">{getInitials(player2)}</Text>
        </View>
        <View className="absolute top-[53%] left-[25%] items-center -ml-12">
          <Text className="text-xs font-medium" numberOfLines={1}>{getShortName(player2)}</Text>
        </View>
        
        {/* Team 2 - Player 3 (Back) */}
        <View 
          className={`absolute top-[5%] left-[75%] w-12 h-12 rounded-full items-center justify-center -ml-6 ${
            highlightTeam === 2 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
        >
          <Text className="text-lg font-bold text-white">{getInitials(player3)}</Text>
        </View>
        <View className="absolute top-[18%] left-[75%] items-center -ml-12">
          <Text className="text-xs font-medium" numberOfLines={1}>{getShortName(player3)}</Text>
        </View>
        
        {/* Team 2 - Player 4 (Front) */}
        <View 
          className={`absolute top-[40%] left-[75%] w-12 h-12 rounded-full items-center justify-center -ml-6 ${
            highlightTeam === 2 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
        >
          <Text className="text-lg font-bold text-white">{getInitials(player4)}</Text>
        </View>
        <View className="absolute top-[53%] left-[75%] items-center -ml-12">
          <Text className="text-xs font-medium" numberOfLines={1}>{getShortName(player4)}</Text>
        </View>

        {/* Team designations */}
        <View className="absolute bottom-[5%] left-[25%] -ml-10 bg-primary/10 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-primary">Team 1</Text>
        </View>
        <View className="absolute bottom-[5%] left-[75%] -ml-10 bg-blue-500/10 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-blue-500">Team 2</Text>
        </View>
      </View>
    </View>
  );
};

export default PadelCourt;