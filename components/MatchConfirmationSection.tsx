// components/MatchConfirmationSectionV2.tsx
// FIXED version with proper imports and error handling

import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { H3 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useMatchConfirmationV2 } from "@/hooks/useMatchConfirmation";

interface Player {
  id: string;
  full_name: string | null;
  email: string;
}

interface MatchConfirmationSectionV2Props {
  matchId: string;
  players: Player[];
  onUpdate?: () => void;
}

export const MatchConfirmationSectionV2: React.FC<
  MatchConfirmationSectionV2Props
> = ({ matchId, players, onUpdate }) => {
  const { profile } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const {
    status,
    loading,
    processing,
    approveMatch,
    reportMatch,
    canTakeAction,
    hasApproved,
    hasReported,
    isPending,
    timeRemaining,
    refresh,
  } = useMatchConfirmationV2(matchId);

  const handleApprove = async () => {
    Alert.alert(
      "Confirm Match",
      "Are you sure you want to confirm these match scores?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const result = await approveMatch();

            if (result.success) {
              Alert.alert("Success", result.message);
              onUpdate?.();
            } else {
              Alert.alert("Error", result.message);
            }
          },
        },
      ],
    );
  };

  const handleReport = async () => {
    const result = await reportMatch(reportReason.trim() || undefined);

    if (result.success) {
      setShowReportModal(false);
      setReportReason("");
      Alert.alert("Success", result.message);
      onUpdate?.();
    } else {
      Alert.alert("Error", result.message);
    }
  };

  if (loading) {
    return (
      <View className="p-4 bg-background/60 rounded-lg">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (!status || !profile) return null;

  // Check if user is a participant
  const isParticipant = players.some((p) => p.id === profile.id);
  if (!isParticipant) return null;

  // Helper to get player confirmation
  const getPlayerConfirmation = (playerId: string) => {
    const conf = status.player_confirmations.find(
      (c) => c.player_id === playerId,
    );
    return conf?.action || "pending";
  };

  const getStatusIcon = (action: string) => {
    switch (action) {
      case "approved":
        return <Ionicons name="checkmark-circle" size={20} color="#10b981" />;
      case "reported":
        return <Ionicons name="alert-circle" size={20} color="#ef4444" />;
      default:
        return <Ionicons name="time-outline" size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = (action: string) => {
    switch (action) {
      case "approved":
        return "text-green-600";
      case "reported":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  };

  return (
    <>
      <View className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base text-gray-900">
            Match Confirmation
          </Text>
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-500 mr-2">
              {status.approved_count}/4
            </Text>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          </View>
        </View>

        {/* Separator Line */}
        <View className="h-px bg-gray-200 mb-4" />



        {/* Player List */}
        <View className="mb-4">
          {players.map((player, index) => {
            const action = getPlayerConfirmation(player.id);
            const isCurrentUser = player.id === profile?.id;

            return (
              <View key={player.id}>
                <View className="flex-row items-center justify-between py-4">
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-primary">
                        {(player.full_name || player.email)
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-sm font-medium">
                      {player.full_name || player.email.split("@")[0]}
                      {isCurrentUser && " (You)"}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    {getStatusIcon(action)}
                    <Text
                      className={`ml-2 text-sm capitalize ${getStatusColor(action)}`}
                    >
                      {action}
                    </Text>
                  </View>
                </View>
                {index < players.length - 1 && (
                  <View className="h-px bg-gray-200" />
                )}
              </View>
            );
          })}
        </View>

        {/* Action Buttons */}
        {canTakeAction && (
          <View className="space-y-3">
            <View className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <Text className="text-sm text-blue-700 dark:text-blue-300">
                ℹ️ You have {timeRemaining} to confirm or report this match.
              </Text>
            </View>

            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                onPress={handleApprove}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="white"
                    />
                    <Text className="ml-2 text-white font-medium">Confirm</Text>
                  </View>
                )}
              </Button>

              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowReportModal(true)}
                disabled={processing}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#ef4444"
                  />
                  <Text className="ml-2 text-red-600 font-medium">Report</Text>
                </View>
              </Button>
            </View>
          </View>
        )}





        {status.confirmation_status === "cancelled" && (
          <View className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <View className="flex-row items-center">
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text className="ml-2 text-sm font-medium text-red-800 dark:text-red-300">
                Match Cancelled - No Ratings Applied
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl p-6 pb-8">
            <View className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full self-center mb-6" />

            <View className="flex-row items-center mb-4">
              <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
              <H3 className="ml-2">Report Match Issue</H3>
            </View>

            <View className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mb-4">
              <Text className="text-sm text-amber-800 dark:text-amber-300">
                ⚠️ If 2 or more players report, the match will be cancelled.
              </Text>
            </View>

            <Text className="text-sm text-muted-foreground mb-3">
              Reason (optional):
            </Text>

            <TextInput
              className="bg-background/60 rounded-lg p-4 mb-6 text-foreground border border-gray-200 dark:border-gray-700 min-h-[80px]"
              placeholder="Incorrect scores, wrong players, etc..."
              placeholderTextColor="#666"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />

            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason("");
                }}
              >
                <Text>Cancel</Text>
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                onPress={handleReport}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white">Report Issue</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};
