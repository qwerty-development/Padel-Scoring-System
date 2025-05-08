import React from 'react';
import { View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';

interface SetScore {
  team1: number | null;
  team2: number | null;
}

interface ScoreCardProps {
  setScores: SetScore[];
  team1Sets: number;
  team2Sets: number;
  winnerTeam?: number;
  userTeam?: 1 | 2;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  setScores,
  team1Sets,
  team2Sets,
  winnerTeam,
  userTeam
}) => {
  const userWon = userTeam && userTeam === winnerTeam;
  const userLost = userTeam && userTeam !== winnerTeam;

  const renderSetScore = (setNumber: number, team1Score: number | null, team2Score: number | null) => {
    if (team1Score === null || team2Score === null) return null;

    const team1Won = team1Score > team2Score;
    const team2Won = team2Score > team1Score;

    return (
      <View className="mb-2">
        <View className="flex-row items-center mb-1">
          <Text className="text-xs text-muted-foreground w-12">Set {setNumber}</Text>
          <View className="flex-1 h-1 mx-2 bg-muted rounded-full overflow-hidden">
            <View 
              className={`h-full ${team1Won ? 'bg-primary' : 'bg-blue-500'}`} 
              style={{ 
                width: `${
                  (Math.max(team1Score, team2Score) === 0) 
                    ? 50 
                    : (Math.max(team1Score, team2Score) === team1Score 
                      ? 100 
                      : team1Score / Math.max(team1Score, team2Score) * 100)
                }%` 
              }} 
            />
          </View>
        </View>
        <View className="flex-row">
          <View className="w-12" /> {/* Spacer to align with label */}
          <View className="flex-row flex-1 justify-between px-2">
            <Text className={`text-lg font-semibold ${team1Won ? 'text-primary' : ''}`}>
              {team1Score}
            </Text>
            <Text className={`text-lg font-semibold ${team2Won ? 'text-blue-500' : ''}`}>
              {team2Score}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="bg-card rounded-xl p-6 mb-6">
      {/* Match result banner */}
      {userTeam && (winnerTeam === 1 || winnerTeam === 2) && (
        <View className={`absolute top-0 right-0 left-0 rounded-t-xl items-center justify-center py-1 ${
          userWon ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}>
          <Text className={`text-sm font-semibold ${
            userWon ? 'text-green-500' : 'text-red-500'
          }`}>
            {userWon ? 'You Won!' : 'You Lost'}
          </Text>
        </View>
      )}

      {/* Score header */}
      <View className="flex-row justify-between items-center mb-6 mt-3">
        <View className="items-center flex-1">
          <View className="w-8 h-8 rounded-full bg-primary/80 items-center justify-center mb-1">
            <Text className="text-sm font-bold text-white">T1</Text>
          </View>
          <Text className="text-xs">Team 1</Text>
        </View>
        
        <View className="items-center px-6">
          <Text className="text-4xl font-bold text-primary">{team1Sets}</Text>
          <Text className="text-xs text-muted-foreground">Sets</Text>
        </View>
        
        <View className="items-center">
          <Text className="text-2xl font-bold">vs</Text>
        </View>
        
        <View className="items-center px-6">
          <Text className="text-4xl font-bold text-blue-500">{team2Sets}</Text>
          <Text className="text-xs text-muted-foreground">Sets</Text>
        </View>
        
        <View className="items-center flex-1">
          <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mb-1">
            <Text className="text-sm font-bold text-white">T2</Text>
          </View>
          <Text className="text-xs">Team 2</Text>
        </View>
      </View>
      
      {/* Winner trophy */}
      {winnerTeam && (
        <View className="absolute top-12 left-1/2 -translate-x-6">
          <View className={`bg-${winnerTeam === 1 ? 'primary' : 'blue-500'}/10 p-2 rounded-full`}>
            <Ionicons name="trophy" size={24} color={winnerTeam === 1 ? '#fbbf24' : '#3b82f6'} />
          </View>
        </View>
      )}
      
      <View className="h-px bg-border my-3" />
      
      {/* Set scores */}
      <View className="mt-4">
        {setScores.map((set, index) => (
          renderSetScore(index + 1, set.team1, set.team2)
        ))}
      </View>
    </View>
  );
};

export default ScoreCard;