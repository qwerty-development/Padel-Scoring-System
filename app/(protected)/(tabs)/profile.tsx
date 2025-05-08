import React from 'react';
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from '@expo/vector-icons';

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { router } from 'expo-router';

export default function Profile() {
  const { signOut, profile } = useAuth();

  const renderAvatar = () => (
    <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
      <Text className="text-4xl font-bold text-primary-foreground">
        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
      </Text>
    </View>
  );

  const renderInfoCard = (title: string, value: string | null, icon: keyof typeof Ionicons.glyphMap) => (
    <View className="bg-card rounded-lg p-4 mb-3 flex-row items-center">
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color="#fbbf24" />
      </View>
      <View className="flex-1">
        <Text className="text-sm text-muted-foreground">{title}</Text>
        <Text className="font-medium">{value || 'Not set'}</Text>
      </View>
    </View>
  );

  const renderStatsCard = () => (
    <View className="bg-card rounded-lg p-6 mb-6">
      <H3 className="mb-4">Player Statistics</H3>
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_rating?.toFixed(0) || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Glicko Rating</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_rd?.toFixed(0) || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Rating Deviation</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-primary">
            {profile?.glicko_vol?.toFixed(3) || '-'}
          </Text>
          <Text className="text-sm text-muted-foreground">Volatility</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView>
        {/* Header with court background */}
        <View className="relative items-center pt-16 pb-8 px-6">
          <View className="relative z-10">
            {renderAvatar()}
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <H1 className="mb-1">{profile?.full_name || 'Anonymous Player'}</H1>
                {profile?.nickname && (
                  <H2 className="text-muted-foreground">"{profile.nickname}"</H2>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-6 pb-8">
          {/* Stats Card */}
          {renderStatsCard()}

          {/* Personal Info Section */}
          <H3 className="mb-4">Personal Information</H3>
          {renderInfoCard("Age", profile?.age, "person-outline")}
          {renderInfoCard("Gender", profile?.sex, "body-outline")}
          {renderInfoCard("Email", profile?.email, "mail-outline")}

          {/* Playing Preferences Section */}
          <H3 className="mb-4 mt-6">Playing Preferences</H3>
          {renderInfoCard("Preferred Hand", profile?.preferred_hand, "hand-left-outline")}
          {renderInfoCard("Court Position", profile?.court_playing_side, "tennisball-outline")}
          {renderInfoCard("Preferred Area", profile?.preferred_area, "location-outline")}

          {/* Account Actions */}
          <View className="mt-8">
            <Button
              className="w-full mb-4"
              size="default"
              variant="outline"
              onPress={() => {router.push('/(protected)/(screens)/edit-profile');
              }}
            >
              <Text>Edit Profile</Text>
            </Button>
            
            <Button
              className="w-full"
              size="default"
              variant="destructive"
              onPress={async () => {
                await signOut();
              }}
            >
              <Text>Sign Out</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}