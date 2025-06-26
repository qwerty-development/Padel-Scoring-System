import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Vibration,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { H3 } from '@/components/ui/typography';
import { useAuth } from '@/context/supabase-provider';
import { 
  MatchConfirmationService, 
  ConfirmationSummary,
  MatchConfirmation 
} from '@/services/match-confirmation.service';

interface MatchConfirmationSectionProps {
  matchId: string;
  players: Array<{
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }>;
  isCreator: boolean;
  onConfirmationUpdate?: () => void;
}

export const MatchConfirmationSection: React.FC<MatchConfirmationSectionProps> = ({
  matchId,
  players,
  isCreator,
  onConfirmationUpdate
}) => {
  const { profile } = useAuth();
  const [confirmationStatus, setConfirmationStatus] = useState<ConfirmationSummary | null>(null);
  const [userConfirmation, setUserConfirmation] = useState<MatchConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Load confirmation status
  useEffect(() => {
    loadConfirmationStatus();

    // Subscribe to real-time updates
    const subscription = MatchConfirmationService.subscribeToConfirmationUpdates(
      matchId,
      () => {
        loadConfirmationStatus();
        onConfirmationUpdate?.();
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [matchId]);

  const loadConfirmationStatus = async () => {
    try {
      setLoading(true);
      const status = await MatchConfirmationService.getMatchConfirmationStatus(matchId);
      setConfirmationStatus(status);

      // Find user's confirmation
      if (status && profile) {
        const userConf = status.confirmations.find(c => c.player_id === profile.id);
        setUserConfirmation(userConf || null);
      }
    } catch (error) {
      console.error('Error loading confirmation status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!profile) return;

    Alert.alert(
      'Confirm Match Score',
      'Are you sure you want to confirm these scores? Once all players confirm, ratings will be applied immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await MatchConfirmationService.confirmMatchScore(matchId, profile.id);
              
              if (result.success) {
                Vibration.vibrate([100, 50, 100]);
                if (result.should_apply_ratings) {
                  Alert.alert(
                    'All Players Confirmed!', 
                    'Ratings have been applied immediately.',
                    [{ text: 'OK' }]
                  );
                }
                await loadConfirmationStatus();
                onConfirmationUpdate?.();
              } else {
                Alert.alert('Error', result.message);
              }
            } catch (error) {
              console.error('Error confirming match:', error);
              Alert.alert('Error', 'Failed to confirm match score');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleReject = async () => {
    if (!profile) return;

    setActionLoading(true);
    try {
      const result = await MatchConfirmationService.rejectMatchScore(
        matchId, 
        profile.id, 
        rejectionReason.trim() || undefined
      );
      
      if (result.success) {
        Vibration.vibrate([200, 100, 200]);
        setShowRejectModal(false);
        setRejectionReason('');
        
        if (result.should_cancel) {
          Alert.alert(
            'Match Cancelled',
            'The match has been cancelled due to multiple rejections. No ratings will be applied.',
            [{ text: 'OK' }]
          );
        }
        
        await loadConfirmationStatus();
        onConfirmationUpdate?.();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error rejecting match:', error);
      Alert.alert('Error', 'Failed to reject match score');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="p-4 bg-background/60 rounded-lg">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (!confirmationStatus) return null;

  const getPlayerConfirmationStatus = (playerId: string) => {
    const confirmation = confirmationStatus.confirmations.find(c => c.player_id === playerId);
    return confirmation?.status || 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Ionicons name="checkmark-circle" size={20} color="#10b981" />;
      case 'rejected':
        return <Ionicons name="close-circle" size={20} color="#ef4444" />;
      default:
        return <Ionicons name="time-outline" size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  // FIXED: Check if user needs to make a decision
  const userNeedsToDecide = () => {
    if (!profile) return false;
    
    // Check if user is one of the players
    const isPlayer = players.some(player => player.id === profile.id);
    if (!isPlayer) return false;
    
    // If no confirmation record exists yet, user needs to decide
    if (!userConfirmation) return true;
    
    // If confirmation record exists but status is pending, user needs to decide
    return userConfirmation.status === 'pending';
  };

  // FIXED: Get user's current status for display
  const getUserStatus = () => {
    if (!profile) return 'not_player';
    
    const isPlayer = players.some(player => player.id === profile.id);
    if (!isPlayer) return 'not_player';
    
    return userConfirmation?.status || 'pending';
  };

  return (
    <>
      <View className="bg-background/80 rounded-xl p-4 mb-4">
        <View className="flex-row items-center mb-4">
          <Ionicons name="shield-checkmark-outline" size={24} color="#2148ce" />
          <H3 className="ml-2 flex-1">Score Confirmation</H3>
          {confirmationStatus.all_confirmed && (
            <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
              <Text className="text-xs font-semibold text-green-700 dark:text-green-300">
                All Confirmed
              </Text>
            </View>
          )}
          {confirmationStatus.should_cancel && (
            <View className="bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">
              <Text className="text-xs font-semibold text-red-700 dark:text-red-300">
                Cancelled
              </Text>
            </View>
          )}
        </View>



        {/* Player Confirmations */}
        <View className="space-y-2 mb-4">
          {players.map((player) => {
            const status = getPlayerConfirmationStatus(player.id);
            const isCurrentUser = player.id === profile?.id;
            
            return (
              <View 
                key={player.id} 
                className={`flex-row items-center justify-between p-3 rounded-lg border ${
                  isCurrentUser 
                    ? 'bg-primary/10 border-primary/20' 
                    : 'bg-background/40 border-border/30'
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3">
                    <Text className="text-xs font-bold text-primary">
                      {(player.full_name || player.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium">
                      {player.full_name || player.email.split('@')[0]}
                      {isCurrentUser && ' (You)'}
                    </Text>
                    {player.id === players[0].id && (
                      <Text className="text-xs text-muted-foreground">Creator</Text>
                    )}
                  </View>
                </View>
                <View className="flex-row items-center">
                  {getStatusIcon(status)}
                  <Text className={`ml-2 text-sm capitalize font-medium ${getStatusColor(status)}`}>
                    {status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* FIXED: User Actions - Show buttons when user needs to decide */}
        {userNeedsToDecide() && !confirmationStatus.should_cancel && (
          <View className="space-y-3">
            {/* Information banner */}
            <View className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#2563eb" style={{ marginTop: 2, marginRight: 8 }} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                    Score Confirmation Required
                  </Text>
                  <Text className="text-xs text-blue-700 dark:text-blue-400 leading-4">
                    Please confirm or reject the match scores. Your decision affects rating application.
                  </Text>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                onPress={handleConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                    <Text className="ml-2 text-white font-medium">Confirm Scores</Text>
                  </View>
                )}
              </Button>
              
              <Button
                variant="destructive"
                className="flex-1"
                onPress={() => setShowRejectModal(true)}
                disabled={actionLoading}
              >
                <View className="flex-row items-center">
                  <Ionicons name="close-circle-outline" size={18} color="white" />
                  <Text className="ml-2 text-white font-medium">Reject Scores</Text>
                </View>
              </Button>
            </View>
          </View>
        )}

        {/* Status Messages */}
        {confirmationStatus.all_confirmed && (
          <View className="mt-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <View className="flex-row items-start">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" style={{ marginTop: 2, marginRight: 8 }} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                  All Players Confirmed
                </Text>
                <Text className="text-xs text-green-700 dark:text-green-400">
                  All players have confirmed the scores. Ratings have been applied immediately.
                </Text>
              </View>
            </View>
          </View>
        )}

        {confirmationStatus.should_cancel && (
          <View className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <View className="flex-row items-start">
              <Ionicons name="close-circle" size={20} color="#ef4444" style={{ marginTop: 2, marginRight: 8 }} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                  Match Cancelled
                </Text>
                <Text className="text-xs text-red-700 dark:text-red-400">
                  Match cancelled due to multiple rejections. No ratings have been applied.
                </Text>
              </View>
            </View>
          </View>
        )}

        {!confirmationStatus.all_confirmed && !confirmationStatus.should_cancel && !userNeedsToDecide() && (
          <View className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <View className="flex-row items-start">
              <Ionicons name="time-outline" size={20} color="#2563eb" style={{ marginTop: 2, marginRight: 8 }} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                  Waiting for Confirmations
                </Text>
                <Text className="text-xs text-blue-700 dark:text-blue-400">
                  Waiting for all players to confirm. If not all confirmed within 24 hours, 
                  the validation period will determine if ratings are applied.
                </Text>
              </View>
            </View>
          </View>
        )}

    
      </View>

      {/* Enhanced Rejection Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl p-6 pb-8">
            <View className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full self-center mb-6" />
            
            <View className="flex-row items-center mb-4">
              <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
              <H3 className="ml-2">Reject Match Score</H3>
            </View>
            
            <View className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mb-4">
              <View className="flex-row items-start">
                <Ionicons name="warning" size={16} color="#d97706" style={{ marginTop: 2, marginRight: 6 }} />
                <Text className="text-sm text-amber-800 dark:text-amber-300 flex-1">
                  Rejecting scores may cancel the match if multiple players reject. 
                  This action cannot be undone.
                </Text>
              </View>
            </View>
            
            <Text className="text-sm text-muted-foreground mb-3">
              Please provide a reason for rejecting the match scores (optional):
            </Text>
            
            <TextInput
              className="bg-background/60 rounded-lg p-4 mb-6 text-foreground border border-gray-200 dark:border-gray-700 min-h-[80px]"
              placeholder="Enter reason for rejection..."
              placeholderTextColor="#666"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
            
            <Text className="text-xs text-muted-foreground text-right mb-4">
              {rejectionReason.length}/200
            </Text>
            
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
              >
                <Text>Cancel</Text>
              </Button>
              
              <Button
                variant="destructive"
                className="flex-1"
                onPress={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white">Reject Score</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};