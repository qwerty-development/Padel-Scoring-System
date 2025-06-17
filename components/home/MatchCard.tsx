import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { MatchData } from '@/types';

interface MatchCardProps {
  match: MatchData;
  userId: string;
}

export function MatchCard({ match, userId }: MatchCardProps) {
  const isTeam1 = match.player1_id === userId || match.player2_id === userId;
  const teamWon = match.winner_team === (isTeam1 ? 1 : 2);
  const isTied = match.winner_team === 0;
  
  // Your team's players
  const yourTeam = isTeam1 
    ? [match.player1, match.player2]
    : [match.player3, match.player4];
  
  // Opponent team's players
  const opponentTeam = isTeam1 
    ? [match.player3, match.player4]
    : [match.player1, match.player2];

  // Format the date
  const matchDate = new Date(match.created_at);
  const formattedDate = matchDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });

  // Format time and duration
  const getTimeAndDuration = () => {
    if (!match.start_time) return formattedDate;
    
    const startTime = new Date(match.start_time);
    const formattedTime = startTime.toLocaleTimeString(undefined, {
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    
    if (!match.end_time) return formattedTime;
    
    const endTime = new Date(match.end_time);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${formattedTime} · ${durationMinutes}m`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return `${formattedTime} · ${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    }
  };

  // Get scores for each set
  const getSetScores = () => {
    const sets = [
      {
        yourScore: isTeam1 ? match.team1_score_set1 : match.team2_score_set1,
        opponentScore: isTeam1 ? match.team2_score_set1 : match.team1_score_set1
      },
      {
        yourScore: isTeam1 ? match.team1_score_set2 : match.team2_score_set2,
        opponentScore: isTeam1 ? match.team2_score_set2 : match.team1_score_set2
      },
      {
        yourScore: isTeam1 ? match.team1_score_set3 : match.team2_score_set3,
        opponentScore: isTeam1 ? match.team2_score_set3 : match.team1_score_set3
      }
    ];

    // Ensure third set always has some value
    if (!sets[2].yourScore && !sets[2].opponentScore) {
      sets[2] = { yourScore: '-', opponentScore: '-' };
    }
    
    return sets;
  };

  // Get player initials for avatar
  const getInitials = (player: { full_name: string | null; email: string }) => {
    if (player.full_name) {
      const nameParts = player.full_name.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[1][0]}`;
      }
      return player.full_name.substring(0, 2).toUpperCase();
    }
    return player.email.substring(0, 2).toUpperCase();
  };

  const resultColorClass = teamWon ? 'bg-green-500' : (isTied ? 'bg-yellow-500' : 'bg-red-500');
  const resultBorderClass = teamWon ? styles.greenBorder : (isTied ? styles.yellowBorder : styles.redBorder);

  return (
    <TouchableOpacity
      style={[styles.cardContainer, resultBorderClass]}
      className="bg-card rounded-xl p-4 mb-3 overflow-hidden"
      onPress={() => {
        router.push({
          pathname: '/(protected)/(screens)/match-details',
          params: { matchId: match.id }
        });
      }}
    >
      {/* Result badge */}
      <View className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg ${resultColorClass}`}>
        <Text className="text-white font-medium text-xs">
          {teamWon ? 'Victory' : (isTied ? 'Tie' : 'Defeat')}
        </Text>
      </View>
      
      {/* Match Scores - Full width with sets */}
      <View className="mt-4 mb-6 w-full flex-row justify-between">
        {getSetScores().map((set, index) => (
          <View key={`set-${index}`} className="flex-1 items-center">
            <View style={styles.scoreContainer}>
              <Text style={styles.yourScore} className="text-3xl font-bold">
                {set.yourScore}
              </Text>
              <View style={styles.scoreDivider} />
              <Text style={styles.opponentScore} className="text-3xl font-bold">
                {set.opponentScore}
              </Text>
            </View>
            {index < 2 && <View style={styles.setDivider} />}
          </View>
        ))}
      </View>

      <View className="h-px bg-border mb-4" />
      
      {/* Location and Time */}
      <View className="flex-row justify-between items-center mb-5">
        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={14} color="#9ca3af" />
          <Text className="text-sm text-muted-foreground ml-1">
            {match.region || 'Unknown'}{match.court ? `, Court ${match.court}` : ''}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={14} color="#9ca3af" />
          <Text className="text-sm text-muted-foreground ml-1">
            {getTimeAndDuration()}
          </Text>
        </View>
      </View>
      
      {/* Divider */} 
      
      {/* Player Avatars */}
      <View className="flex-row justify-between">
        {/* Your Team */}
        <View className="flex-row">
          {yourTeam.map((player, index) => (
            <View 
              key={`your-team-${index}`}
              style={[
                styles.avatar, 
                styles.yourTeamAvatar,
                index === 1 ? { marginLeft: -10 } : {}
              ]}
            >
              <Text className="text-xs text-white font-bold">
                {getInitials(player)}
              </Text>
            </View>
          ))}
          <Text className="text-sm text-muted-foreground ml-2 self-center">You & Partner</Text>
        </View>
        
        {/* vs */}
        <Text className="text-sm text-muted-foreground self-center mx-1">vs</Text>
        
        {/* Opponent Team */}
        <View className="flex-row">
          <Text className="text-sm text-muted-foreground mr-2 self-center">Opponents</Text>
          {opponentTeam.map((player, index) => (
            <View 
              key={`opponent-team-${index}`}
              style={[
                styles.avatar, 
                styles.opponentTeamAvatar,
                index === 0 ? { marginRight: -10 } : {}
              ]}
            >
              <Text className="text-xs text-white font-bold">
                {getInitials(player)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderLeftWidth: 4,
  },
  greenBorder: {
    borderLeftColor: '#10b981', // Green 500
  },
  redBorder: {
    borderLeftColor: '#ef4444', // Red 500
  },
  yellowBorder: {
    borderLeftColor: '#f59e0b', // Yellow 500
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  yourTeamAvatar: {
    backgroundColor: '#2148ce', // Primary color
  },
  opponentTeamAvatar: {
    backgroundColor: '#6b7280', // Gray color
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 65,
  },
  yourScore: {
    marginBottom: 4,
    alignSelf: 'flex-start',
    marginLeft: -32,
  },
  opponentScore: {
    marginTop: 4,
    opacity: 0.8,
    alignSelf: 'flex-end',
    marginRight: -32,
  },
  scoreDivider: {
    height: 2,
    width: 32,
    backgroundColor: '#F2B602', // Gray-300
    transform: [{ rotate: '-45deg' }],
  },
  setDivider: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#e5e7eb', // Gray-200
    height: '100%',
  }
});